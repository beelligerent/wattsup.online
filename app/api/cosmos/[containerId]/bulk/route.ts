import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, getErrorStatus, isConfigured } from '../../../_cosmos';

type Params = { params: Promise<{ containerId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  if (!isConfigured()) return NextResponse.json({ error: 'Cosmos DB not configured' }, { status: 503 });
  const { containerId } = await params;
  try {
    const { items } = await req.json();
    if (!Array.isArray(items)) return NextResponse.json({ error: "'items' must be array" }, { status: 400 });
    if (items.length === 0) return NextResponse.json({ count: 0 });

    const db = getDatabase()!;
    const container = db.container(containerId);
    const batchSize = 50;
    let success = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const results = await Promise.allSettled(batch.map(item => container.items.upsert(item)));
      success += results.filter(r => r.status === 'fulfilled').length;
      if (i + batchSize < items.length) await new Promise(r => setTimeout(r, 100));
    }
    return NextResponse.json({ count: success, total: items.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: getErrorStatus(err) });
  }
}
