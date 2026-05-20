'use client';
// CosmosService — proxies all Cosmos DB calls through the Express server (/api/cosmos/*)
// The actual @azure/cosmos SDK lives in Next.js API routes; the client never has direct DB access.

export const CosmosService = {
  isConfigured: true, // Server is assumed to be configured if it's running

  async getContainer(containerId: string): Promise<any> {
    return {
      item: (itemId: string, partitionKey: string) => ({
        read: async () => {
          const response = await fetch(`/api/cosmos/${containerId}/${encodeURIComponent(itemId)}?partitionKey=${encodeURIComponent(partitionKey)}`);
          if (response.status === 404) return { resource: null };
          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `HTTP ${response.status}`);
          }
          return { resource: await response.json() };
        },
        delete: async () => {
          const response = await fetch(
            `/api/cosmos/${containerId}/${encodeURIComponent(itemId)}?partitionKey=${encodeURIComponent(partitionKey)}`,
            { method: 'DELETE' }
          );
          if (!response.ok && response.status !== 204) {
            const text = await response.text();
            throw new Error(text || `HTTP ${response.status}`);
          }
        }
      }),
      items: {
        upsert: async (item: any) => {
          const response = await fetch(`/api/cosmos/${containerId}/upsert`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          });
          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `HTTP ${response.status}`);
          }
          return { resource: await response.json() };
        },
        query: (querySpec: any) => ({
          fetchAll: async () => {
            const response = await fetch(`/api/cosmos/${containerId}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: typeof querySpec === 'string' ? querySpec : querySpec.query,
                parameters: typeof querySpec === 'object' ? (querySpec.parameters || []) : [],
              }),
            });
            if (!response.ok) {
              const text = await response.text();
              throw new Error(text || `HTTP ${response.status}`);
            }
            return { resources: await response.json() };
          },
        }),
        bulk: async (operations: any[]) => {
          // FIX: Use the dedicated /bulk endpoint for efficiency
          const upsertOps = operations.filter(op => op.operationType === 'Upsert').map(op => op.resourceBody);
          if (upsertOps.length > 0) {
            await CosmosService.bulkUpsert(containerId, upsertOps);
          }
        },
      },
    };
  },

  /**
   * Fetch all items from a container using a query
   */
  async getAllItems<T>(containerId: string, querySpec?: any): Promise<T[]> {
    const container = await this.getContainer(containerId);
    const { resources } = await container.items
      .query(querySpec || 'SELECT * FROM c')
      .fetchAll();
    return resources as T[];
  },

  /**
   * Fetch items with scoped URL query parameters (area, date range, limit)
   */
  async getScopedItems<T>(
    containerId: string,
    filters: { area?: string; startDate?: string; endDate?: string; limit?: number }
  ): Promise<T[]> {
    const params = new URLSearchParams();
    if (filters.area) params.append('area', filters.area);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`/api/cosmos/${containerId}?${params.toString()}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
    return (await response.json()) as T[];
  },

  /**
   * Upsert a single item
   */
  async upsertItem<T>(containerId: string, item: T): Promise<T> {
    const container = await this.getContainer(containerId);
    const { resource } = await container.items.upsert(item);
    return resource as T;
  },

  /**
   * Delete an item by id and partition key
   */
  async deleteItem(containerId: string, id: string, partitionKey: string): Promise<void> {
    const response = await fetch(
      `/api/cosmos/${containerId}/${encodeURIComponent(id)}?partitionKey=${encodeURIComponent(partitionKey)}`,
      { method: 'DELETE' }
    );
    if (!response.ok && response.status !== 204) {
      const text = await response.text();
      throw new Error(text || `HTTP ${response.status}`);
    }
  },

  /**
   * Bulk upsert energy readings (chunked to 500 items per request)
   */
  async bulkUpsert(containerId: string, items: any[]): Promise<void> {
    const chunkSize = 500;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const response = await fetch(`/api/cosmos/${containerId}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: chunk }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
    }
  },
};
