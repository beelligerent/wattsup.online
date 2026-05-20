import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, safeQueryAll, getErrorStatus, isConfigured } from '../../../_cosmos';

type Params = { params: Promise<{ containerId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!isConfigured()) return NextResponse.json({ error: 'Cosmos DB not configured' }, { status: 503 });
  const { containerId } = await params;
  try {
    const db = getDatabase()!;
    const container = db.container(containerId);
    const { resource: def } = await container.read();
    const pkPath = def?.partitionKey?.paths?.[0]?.replace('/', '') || 'id';

    const items = await safeQueryAll<any>(containerId, `SELECT c.id, c["${pkPath}"] AS pk FROM c`);
    let deleted = 0;
    for (const item of items) {
      try { await container.item(item.id, item.pk ?? item.id).delete(); deleted++; } catch {}
    }
    return NextResponse.json({ deleted, total: items.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: getErrorStatus(err) });
  }
}
