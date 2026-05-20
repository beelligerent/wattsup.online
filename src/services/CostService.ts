'use client';
import { CosmosService } from './CosmosService';
import { CostRules } from '../types';
import { DataService } from './DataService';

const COST_RULES_DOC_ID = 'current_rules';
const CONTAINER_ID = 'cost_rules';

export const CostService = {
  getCostRules: async (): Promise<CostRules | null> => {
    try {
      const container = await CosmosService.getContainer(CONTAINER_ID);
      const { resource } = await container.item(COST_RULES_DOC_ID, COST_RULES_DOC_ID).read();
      return resource as CostRules || null;
    } catch (error: any) {
      if (error.code === 404) return null;
      console.error("Error fetching cost rules from Cosmos DB:", error);
      return null;
    }
  },

  saveCostRules: async (rules: CostRules) => {
    try {
      await CosmosService.upsertItem(CONTAINER_ID, {
        ...rules,
        id: COST_RULES_DOC_ID,
        updatedAt: new Date().toISOString()
      });
      
      await DataService.addAuditLog('Price Update', `Energy Price: ${rules.energyPrice}, Demand Charge: ${rules.demandCharge}, VAT: ${rules.vat}%`);
    } catch (error) {
      console.error("Error saving cost rules to Cosmos DB:", error);
      throw error;
    }
  },

  subscribeToCostRules: (callback: (rules: CostRules) => void) => {
    // Cosmos DB doesn't support real-time snapshots like Firestore.
    // We'll fetch once and then set up a polling interval as a fallback.
    CostService.getCostRules().then(rules => {
      if (rules) callback(rules);
    });
    
    let isSubscribed = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const poll = async () => {
      if (!isSubscribed) return;
      try {
        const rules = await CostService.getCostRules();
        if (isSubscribed && rules) {
          callback(rules);
          timeoutId = setTimeout(poll, 30000); // Poll every 30 seconds
        }
      } catch (error) {
        console.error("Cost rules polling error:", error);
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
