import { NextResponse } from 'next/server';
import { isConfigured } from '../_cosmos';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    cosmosConfigured: isConfigured(),
    database: process.env.COSMOS_DATABASE_ID || 'WattsUpDB',
    timestamp: new Date().toISOString(),
  });
}
