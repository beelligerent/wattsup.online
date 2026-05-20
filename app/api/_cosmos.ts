// Shared Cosmos DB client for all API routes
import { CosmosClient } from '@azure/cosmos';

const endpoint = process.env.COSMOS_ENDPOINT || '';
const key = process.env.COSMOS_KEY || '';
const databaseId = process.env.COSMOS_DATABASE_ID || 'WattsUpDB';

let _client: CosmosClient | null = null;
let _database: ReturnType<CosmosClient['database']> | null = null;

function getClient() {
  if (!_client && endpoint && key) {
    _client = new CosmosClient({
      endpoint, key,
      connectionPolicy: {
        requestTimeout: 120000,
        retryOptions: { maxRetryAttemptCount: 5, fixedRetryIntervalInMilliseconds: 0, maxWaitTimeInSeconds: 60 },
      },
    });
    _database = _client.database(databaseId);
  }
  return { client: _client, database: _database };
}

export function getDatabase() {
  const { database } = getClient();
  return database;
}

export function isConfigured() {
  return !!(endpoint && key);
}

export async function safeQueryAll<T>(containerId: string, query: string, parameters: any[] = []): Promise<T[]> {
  const db = getDatabase();
  if (!db) throw new Error('Cosmos DB not configured');

  const cleanQuery = query.replace(/\s+ORDER\s+BY\s+[^\s]+((\s+(ASC|DESC))?)/gi, '').trim();
  const container = db.container(containerId);

  try {
    const iterator = container.items.query({ query: cleanQuery, parameters }, { maxItemCount: 5000 });
    const allItems: T[] = [];
    while (iterator.hasMoreResults()) {
      const { resources } = await iterator.fetchNext();
      if (resources) allItems.push(...resources);
    }
    return allItems;
  } catch (err: any) {
    console.error(`[Cosmos] Query failed on '${containerId}':`, err.message);
    throw err;
  }
}

export async function ensureContainers() {
  const db = getDatabase();
  if (!db) return;
  const containers = [
    { id: 'energy_readings', partitionKey: '/equipmentName' },
    { id: 'uploaded_files', partitionKey: '/id' },
    { id: 'audit_logs', partitionKey: '/id' },
    { id: 'system_settings', partitionKey: '/id' },
    { id: 'users', partitionKey: '/uid' },
    { id: 'roles', partitionKey: '/id' },
    { id: 'reports', partitionKey: '/id' },
    { id: 'ai_reports', partitionKey: '/id' },
    { id: 'cost_rules', partitionKey: '/id' },
    { id: 'custom_report_templates', partitionKey: '/id' },
  ];
  for (const c of containers) {
    try {
      await db.containers.createIfNotExists({ id: c.id, partitionKey: { paths: [c.partitionKey] } });
    } catch (e: any) {
      console.warn(`[Cosmos] Could not ensure container '${c.id}':`, e.message);
    }
  }
}

export function getErrorStatus(error: any): number {
  const code = error?.code || error?.statusCode;
  const n = parseInt(String(code), 10);
  return n >= 100 && n < 600 ? n : 500;
}
