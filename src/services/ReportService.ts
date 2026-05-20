'use client';
import { CosmosService } from "./CosmosService";
import { BlobStorageService } from "./BlobStorageService";
import { Report, CustomReport } from '../types';

const REPORTS_CONTAINER = 'reports';
const TEMPLATES_CONTAINER = 'custom_report_templates';

export const ReportService = {
  saveReport: async (report: Report, fileBlob?: Blob) => {
    if (!CosmosService.isConfigured) return;
    try {
      let downloadUrl = report.downloadUrl;
      let storagePath = report.storagePath;

      if (fileBlob) {
        const reportId = report.id || `report_${Date.now()}`;
        storagePath = `reports/${report.userId}/${reportId}.pdf`;
        
        // Convert Blob to File for BlobStorageService
        const file = new File([fileBlob], `${reportId}.pdf`, { type: 'application/pdf' });
        downloadUrl = await BlobStorageService.uploadFile(file, storagePath);
      }

      const reportId = report.id || `report_${Date.now()}`;
      const reportToSave = {
        ...report,
        id: reportId,
        downloadUrl,
        storagePath,
        generatedAt: report.generatedAt || new Date().toISOString()
      };

      await CosmosService.upsertItem(REPORTS_CONTAINER, reportToSave);
      console.log('Report saved successfully to Cosmos DB');
    } catch (e: any) {
      console.error('Cosmos DB Error (saveReport):', e);
    }
  },

  deleteReport: async (reportId: string, storagePath?: string) => {
    if (!CosmosService.isConfigured) return;
    try {
      // Delete from Cosmos DB
      // We need the partition key, which is likely userId. 
      // For simplicity, we'll fetch the report first to get the userId.
      const container = await CosmosService.getContainer(REPORTS_CONTAINER);
      const { resource: report } = await container.item(reportId, reportId).read();
      
      if (report) {
        await CosmosService.deleteItem(REPORTS_CONTAINER, reportId, reportId);
      }

      // Delete from Storage if path exists
      if (storagePath) {
        await BlobStorageService.deleteFile(storagePath);
      }
      console.log('Report deleted successfully');
    } catch (e: any) {
      console.error('Cosmos DB Error (deleteReport):', e);
    }
  },

  getReports: async (userId: string): Promise<Report[]> => {
    if (!CosmosService.isConfigured) return [];
    try {
      const query = {
        query: "SELECT * FROM c WHERE c.userId = @userId ORDER BY c.generatedAt DESC",
        parameters: [{ name: "@userId", value: userId }]
      };
      return await CosmosService.getAllItems<Report>(REPORTS_CONTAINER, query);
    } catch (e: any) {
      console.error('Cosmos DB Error (getReports):', e);
      return [];
    }
  },

  saveCustomReportTemplate: async (userId: string, report: CustomReport) => {
    if (!CosmosService.isConfigured) return;
    try {
      await CosmosService.upsertItem(TEMPLATES_CONTAINER, {
        ...report,
        id: userId,
        userId,
        updatedAt: new Date().toISOString()
      });
      console.log('Custom report template saved to Cosmos DB');
    } catch (e: any) {
      console.error('Cosmos DB Error (saveCustomReportTemplate):', e);
    }
  },

  getCustomReportTemplate: async (userId: string): Promise<CustomReport | null> => {
    if (!CosmosService.isConfigured) return null;
    try {
      const container = await CosmosService.getContainer(TEMPLATES_CONTAINER);
      const { resource } = await container.item(userId, userId).read();
      return resource as CustomReport || null;
    } catch (e: any) {
      if (e.code === 404) return null;
      console.error('Cosmos DB Error (getCustomReportTemplate):', e);
      return null;
    }
  }
};
