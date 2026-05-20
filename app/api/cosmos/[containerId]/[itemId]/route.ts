import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, getErrorStatus, isConfigured } from '../../../_cosmos';

type Params = { params: Promise<{ containerId: string; itemId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  if (!isConfigured()) return NextResponse.json({ error: 'Cosmos DB not configured' }, { status: 503 });
  const { containerId, itemId } = await params;
  const partitionKey = req.nextUrl.searchParams.get('partitionKey') || itemId;
  try {
    const db = getDatabase()!;
    const { resource } = await db.container(containerId).item(itemId, partitionKey).read();
    if (!resource) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(resource);
  } catch (err: any) {
    const s = getErrorStatus(err);
    if (s === 404) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ error: err.message }, { status: s });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  if (!isConfigured()) return NextResponse.json({ error: 'Cosmos DB not configured' }, { status: 503 });
  const { containerId, itemId } = await params;
  const partitionKey = req.nextUrl.searchParams.get('partitionKey') || itemId;
  try {
    const db = getDatabase()!;
    await db.container(containerId).item(itemId, partitionKey).delete();
    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    const s = getErrorStatus(err);
    if (s === 404) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    return NextResponse.json({ error: err.message }, { status: s });
  }
}
