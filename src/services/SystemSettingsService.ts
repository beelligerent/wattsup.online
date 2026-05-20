'use client';
import { CosmosService } from "./CosmosService";

export interface SystemSettings {
  logoUrl?: string;
  defaultDateFilter?: any;
  defaultStartDate?: string;
  defaultEndDate?: string;
  updatedAt: string;
  updatedBy?: string;
  id?: string;
}

const CONTAINER_NAME = 'system_settings';

export const SystemSettingsService = {
  async getSettings(id: string = 'general'): Promise<SystemSettings | null> {
    if (!CosmosService.isConfigured) return null;
    try {
      const container = await CosmosService.getContainer(CONTAINER_NAME);
      const { resource } = await container.item(id, id).read();
      return resource as SystemSettings || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      console.error(`Cosmos DB Error (getSettings - ${id}):`, error);
      return null;
    }
  },

  async updateSettings(id: string, settings: Partial<SystemSettings>): Promise<void> {
    if (!CosmosService.isConfigured) return;
    try {
      const existing = await this.getSettings(id);
      await CosmosService.upsertItem(CONTAINER_NAME, {
        ...existing,
        ...settings,
        id,
        updatedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error(`Cosmos DB Error (updateSettings - ${id}):`, error);
    }
  },

  async updateLogo(logoUrl: string): Promise<void> {
    await this.updateSettings('general', { logoUrl });
  },

  // Azure Cosmos DB JS SDK does not support real-time snapshots like Firestore.
  // We'll use a simple polling mechanism.
  subscribeToSettings(callback: (settings: SystemSettings | null) => void, id: string = 'general') {
    if (!CosmosService.isConfigured) return () => {};
    
    let isSubscribed = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const poll = async () => {
      if (!isSubscribed) return;
      try {
        const settings = await this.getSettings(id);
        if (isSubscribed) {
          callback(settings);
          timeoutId = setTimeout(poll, 30000); // Poll every 30 seconds
        }
      } catch (error) {
        console.error("Polling error:", error);
        if (isSubscribed) {
          timeoutId = setTimeout(poll, 60000); // Retry after 1 minute on error
        }
      }
    };

    poll();

    return () => {
      isSubscribed = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }
};
