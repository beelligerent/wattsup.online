import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, getErrorStatus, isConfigured } from '../../../_cosmos';

type Params = { params: Promise<{ containerId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  if (!isConfigured()) return NextResponse.json({ error: 'Cosmos DB not configured' }, { status: 503 });
  const { containerId } = await params;
  try {
    const item = await req.json();
    if (!item?.id) return NextResponse.json({ error: "Item must have 'id'" }, { status: 400 });
    const db = getDatabase()!;
    const { resource } = await db.container(containerId).items.upsert(item);
    return NextResponse.json(resource);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: getErrorStatus(err) });
  }
}
