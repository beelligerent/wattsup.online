import { NextRequest, NextResponse } from 'next/server';
import { getDatabase, safeQueryAll, getErrorStatus, isConfigured } from '../../_cosmos';

type Params = { params: Promise<{ containerId: string }> };

function notConfigured() {
  return NextResponse.json({ error: 'Cosmos DB not configured' }, { status: 503 });
}

// GET  /api/cosmos/:containerId  — filtered query via URL params
export async function GET(req: NextRequest, { params }: Params) {
  if (!isConfigured()) return notConfigured();
  const { containerId } = await params;
  const { searchParams } = req.nextUrl;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const area = searchParams.get('area');
  const limit = searchParams.get('limit');

  try {
    let query = 'SELECT * FROM c WHERE 1=1';
    const parameters: any[] = [];
    if (startDate) { query += ' AND c.timestamp >= @startDate'; parameters.push({ name: '@startDate', value: startDate }); }
    if (endDate) { const e = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`; query += ' AND c.timestamp <= @endDate'; parameters.push({ name: '@endDate', value: e }); }
    if (area && area !== 'All Areas') { query += ' AND c.area = @area'; parameters.push({ name: '@area', value: area }); }
    if (limit) { const n = parseInt(limit); if (!isNaN(n)) query = query.replace('SELECT', `SELECT TOP ${n}`); }

    const resources = await safeQueryAll(containerId, query, parameters);
    if (resources.length > 0 && (resources[0] as any).timestamp) {
      resources.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return NextResponse.json(resources);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: getErrorStatus(err) });
  }
}

// POST /api/cosmos/:containerId  — arbitrary query in body
export async function POST(req: NextRequest, { params }: Params) {
  if (!isConfigured()) return notConfigured();
  const { containerId } = await params;

  try {
    const body = await req.json();
    const { query, parameters = [] } = body;
    if (!query) return NextResponse.json({ error: "'query' required" }, { status: 400 });

    const resources = await safeQueryAll(containerId, query, parameters);
    if (resources.length > 0 && (resources[0] as any).timestamp) {
      resources.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return NextResponse.json(resources);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: getErrorStatus(err) });
  }
}
