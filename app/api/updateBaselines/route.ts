import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, safeQueryAll, getErrorStatus, isConfigured } from '../_cosmos';

export async function POST(req: NextRequest) {
  if (!isConfigured()) return NextResponse.json({ error: 'Cosmos DB not configured' }, { status: 503 });
  try {
    const { updates } = await req.json();
    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: "'updates' must be non-empty array" }, { status: 400 });
    }

    const baselineMap = new Map(updates.map((u: any) => [u.name, u.baselineKW]));
    const names = updates.map((u: any) => u.name);

    // Use parameterized query with ARRAY_CONTAINS for safety and no string injection risk
    const safeNames = names.map((n: string) => `'${n.replace(/'/g, "\\'")}'`).join(',');

    console.log(`[Baseline] Querying ${names.length} equipment names…`);
    const t0 = Date.now();

    // Fetch only the fields we need — id (for patch key) and equipmentName (partition key)
    const items = await safeQueryAll<any>(
      'energy_readings',
      `SELECT c.id, c.equipmentName, c.baselineKW FROM c WHERE c.equipmentName IN (${safeNames})`
    );
    console.log(`[Baseline] Fetched ${items.length} readings in ${Date.now() - t0}ms`);

    // Only patch documents where value actually changed
    const toUpdate = items.filter(item => {
      const newVal = baselineMap.get(item.equipmentName);
      return newVal !== undefined && newVal !== item.baselineKW;
    });

    if (toUpdate.length === 0) {
      return NextResponse.json({ updated: 0, total: items.length, skipped: items.length });
    }

    const db = getDatabase()!;
    const container = db.container('energy_readings');

    // Larger batches + more concurrency = much faster on Cosmos DB
    // Cosmos allows ~50 concurrent requests per partition safely;
    // we batch by equipmentName (= partition key) to stay in same partition
    const BATCH_SIZE = 200;   // up from 100 — Cosmos handles this fine
    const CONCURRENCY = 5;    // run 5 batches in parallel
    let updated = 0;

    // Group by equipmentName so each batch hits one partition key
    const byEquip = new Map<string, typeof toUpdate>();
    for (const item of toUpdate) {
      if (!byEquip.has(item.equipmentName)) byEquip.set(item.equipmentName, []);
      byEquip.get(item.equipmentName)!.push(item);
    }

    // Flatten into batches per equipment (all same partition key = no cross-partition)
    const batches: (typeof toUpdate)[] = [];
    for (const [, items] of byEquip) {
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        batches.push(items.slice(i, i + BATCH_SIZE));
      }
    }

    // Process batches with controlled concurrency
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const chunk = batches.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(batch =>
          Promise.allSettled(
            batch.map(item =>
              container.item(item.id, item.equipmentName).patch([
                { op: 'set', path: '/baselineKW', value: baselineMap.get(item.equipmentName)! }
              ])
            )
          )
        )
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          updated += r.value.filter(x => x.status === 'fulfilled').length;
        }
      }
    }

    const elapsed = Date.now() - t0;
    console.log(`[Baseline] Patched ${updated}/${toUpdate.length} in ${elapsed}ms`);
    return NextResponse.json({ updated, total: items.length, elapsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: getErrorStatus(err) });
  }
}
