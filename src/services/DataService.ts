'use client';
import { CosmosService } from "./CosmosService";
import { BlobStorageService } from "./BlobStorageService";
import { MeterReading, UploadedFile } from "../types";

const READINGS_CONTAINER = "energy_readings";
const FILES_CONTAINER = "uploaded_files";
const LOGS_CONTAINER = "audit_logs";
const SETTINGS_CONTAINER = "system_settings";

export const DataService = {

  async uploadFileToStorage(file: File | Blob, path: string): Promise<string> {
    return await BlobStorageService.uploadFile(file, path);
  },

  async deleteFileFromStorage(path: string): Promise<void> {
    await BlobStorageService.deleteFile(path);
  },

  async saveReadings(
    readings: MeterReading[],
    fileMetadata?: Omit<UploadedFile, "id" | "uploadedAt">
  ): Promise<void> {
    if (!CosmosService.isConfigured) {
      throw new Error("Cosmos DB is not configured. Set COSMOS_ENDPOINT and COSMOS_KEY.");
    }

    // Attempt Blob Storage upload (non-fatal)
    let storagePath = "";
    let downloadUrl = "";
    if (fileMetadata && BlobStorageService.isConfigured) {
      storagePath = `uploads/${Date.now()}_${fileMetadata.fileName}`;
      downloadUrl = await BlobStorageService.uploadFile(
        new Blob([fileMetadata.content || ""], { type: "text/csv" }),
        storagePath
      );
    }

    // Save file record to Cosmos DB
    let fileId = "";
    if (fileMetadata) {
      fileId = `file_${Date.now()}`;
      const fileRecord = {
        ...fileMetadata,
        id: fileId,
        uploadedAt: new Date().toISOString(),
        storagePath: storagePath || undefined,
        downloadUrl: downloadUrl || undefined,
      };
      // Remove 'content' field — too large for Cosmos 2MB limit
      const { content: _content, ...fileRecordWithoutContent } = fileRecord as any;
      await CosmosService.upsertItem(FILES_CONTAINER, { ...fileRecordWithoutContent, id: fileId });
    }

    // Save readings in bulk
    const baseTime = Date.now();
    const itemsToSave = readings.map((reading, index) => {
      const readingId = `reading_${baseTime}_${index}_${Math.random().toString(36).substr(2, 9)}`;
      return {
        ...reading,
        id: readingId,
        fileId: fileId || undefined,
      };
    });

    console.log(`[DataService] Saving ${itemsToSave.length} readings to Cosmos DB...`);
    await CosmosService.bulkUpsert(READINGS_CONTAINER, itemsToSave);
    console.log(`[DataService] Save complete.`);
  },

  async updateEquipmentBaselines(
    updates: { name: string; baselineKW: number }[]
  ): Promise<void> {
    if (!CosmosService.isConfigured) return;
    try {
      console.log(`[DataService] Sending ${updates.length} baseline updates to server…`);
      // Use the fast server-side endpoint — does the read-modify-write cycle
      // entirely on the server in one HTTP request instead of fetching all
      // readings to the client and re-uploading them.
      const response = await fetch("/api/updateBaselines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      const result = await response.json();
      console.log(`[DataService] Baseline update complete: ${result.updated}/${result.total} readings updated.`);
    } catch (error: any) {
      console.error("Error (updateEquipmentBaselines):", error);
      throw error;
    }
  },

  async getReadings(forceRefresh = false): Promise<MeterReading[]> {
    if (!CosmosService.isConfigured) return [];
    try {
      return await CosmosService.getAllItems<MeterReading>(
        READINGS_CONTAINER,
        "SELECT * FROM c"
      );
    } catch (error: any) {
      console.error("Cosmos DB Error (getReadings):", error);
      return [];
    }
  },

  async getFilteredReadings(
    area?: string,
    startDate?: string,
    endDate?: string
  ): Promise<MeterReading[]> {
    if (!CosmosService.isConfigured) return [];
    try {
      return await CosmosService.getScopedItems<MeterReading>(READINGS_CONTAINER, {
        area: area === "All Areas" ? undefined : area,
        startDate,
        endDate,
      });
    } catch (error: any) {
      console.error("Cosmos DB Error (getFilteredReadings):", error);
      return [];
    }
  },

  /**
   * Clear all readings and uploaded files using the server-side bulk delete endpoint.
   * This is much faster than deleting item-by-item from the client.
   */
  async clearAllReadings(): Promise<void> {
    if (!CosmosService.isConfigured) return;
    try {
      // Use the server-side bulk delete endpoint for speed
      const [readingsRes, filesRes] = await Promise.allSettled([
        fetch(`/api/cosmos/${READINGS_CONTAINER}/deleteAll`, { method: "DELETE" }),
        fetch(`/api/cosmos/${FILES_CONTAINER}/deleteAll`, { method: "DELETE" }),
      ]);

      for (const result of [readingsRes, filesRes]) {
        if (result.status === "rejected") {
          console.error("Bulk delete failed:", result.reason);
        } else if (!result.value.ok) {
          const text = await result.value.text();
          console.error("Bulk delete HTTP error:", text);
        }
      }

      console.log("[DataService] clearAllReadings complete");
    } catch (error: any) {
      console.error("Cosmos DB Error (clearAllReadings):", error);
      throw error;
    }
  },

  async getUploadedFiles(): Promise<UploadedFile[]> {
    if (!CosmosService.isConfigured) return [];
    try {
      return await CosmosService.getAllItems<UploadedFile>(
        FILES_CONTAINER,
        "SELECT * FROM c"
      );
    } catch (error: any) {
      console.error("Cosmos DB Error (getUploadedFiles):", error);
      return [];
    }
  },

  async deleteUploadedFile(fileId: string): Promise<void> {
    if (!CosmosService.isConfigured) return;
    try {
      const container = await CosmosService.getContainer(FILES_CONTAINER);
      const { resource: fileData } = await container.item(fileId, fileId).read();

      if (fileData?.storagePath) {
        await this.deleteFileFromStorage(fileData.storagePath);
      }

      // Delete associated readings via bulk delete query
      const safeId = fileId.replace(/'/g, "\\'");
      const readings = await CosmosService.getAllItems<any>(
        READINGS_CONTAINER,
        `SELECT * FROM c WHERE c.fileId = '${safeId}'`
      );

      if (readings.length > 0) {
        await CosmosService.bulkUpsert(
          READINGS_CONTAINER,
          readings.map((r: any) => ({ ...r, _deleted: true }))
        );

        // Actually delete each reading
        for (const r of readings) {
          try {
            await CosmosService.deleteItem(READINGS_CONTAINER, r.id, r.equipmentName || r.id);
          } catch (e) {
            // Non-fatal — item may already be gone
          }
        }
      }

      await CosmosService.deleteItem(FILES_CONTAINER, fileId, fileId);
    } catch (error: any) {
      console.error("Cosmos DB Error (deleteUploadedFile):", error);
      throw error;
    }
  },

  async addAuditLog(action: string, details: string, userEmail?: string): Promise<void> {
    if (!CosmosService.isConfigured) return;
    try {
      const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      const timestamp = new Date().toISOString();
      await CosmosService.upsertItem(LOGS_CONTAINER, {
        id: logId,
        // Use id as partition key (matches container partition key /id)
        user: userEmail || "system",
        action,
        details,
        timestamp,
      });
    } catch (error: any) {
      // Audit log failure is non-fatal
      console.warn("Cosmos DB Warning (addAuditLog):", error.message);
    }
  },

  async getAuditLogs(): Promise<any[]> {
    if (!CosmosService.isConfigured) return [];
    try {
      // Use POST query with ORDER BY so newest logs appear first
      // safeQueryAll on the server strips ORDER BY — so we sort client-side
      const logs = await CosmosService.getAllItems<any>(
        LOGS_CONTAINER,
        "SELECT * FROM c"
      );
      // Sort newest first client-side
      return logs.sort((a: any, b: any) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ).slice(0, 500);
    } catch (error: any) {
      console.error("Cosmos DB Error (getAuditLogs):", error);
      return [];
    }
  },

  async getBaselineConfig(): Promise<any | null> {
    if (!CosmosService.isConfigured) return null;
    try {
      const container = await CosmosService.getContainer(SETTINGS_CONTAINER);
      const { resource } = await container.item("baseline_config", "baseline_config").read();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404 || error.message?.includes("404")) return null;
      console.error("Cosmos DB Error (getBaselineConfig):", error);
      return null;
    }
  },

  async saveBaselineConfig(data: any, userEmail?: string): Promise<void> {
    if (!CosmosService.isConfigured) return;
    try {
      await CosmosService.upsertItem(SETTINGS_CONTAINER, {
        ...data,
        id: "baseline_config",
        updatedAt: new Date().toISOString(),
        updatedBy: userEmail || "system",
      });
    } catch (error: any) {
      console.error("Cosmos DB Error (saveBaselineConfig):", error);
    }
  },
};
