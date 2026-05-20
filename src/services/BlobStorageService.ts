'use client';
import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";

const accountName = process.env.NEXT_PUBLIC_AZURE_STORAGE_ACCOUNT_NAME || "";
// FIX: Strip leading '?' from SAS token if present — common misconfiguration
const rawSasToken = process.env.NEXT_PUBLIC_AZURE_STORAGE_SAS_TOKEN || "";
const sasToken = rawSasToken.startsWith("?") ? rawSasToken.slice(1) : rawSasToken;
const containerName = process.env.NEXT_PUBLIC_AZURE_STORAGE_CONTAINER_NAME || "wattsup-data";

export const BlobStorageService = {
  get isConfigured(): boolean {
    return !!(accountName && sasToken);
  },

  getContainerClient(): ContainerClient {
    if (!this.isConfigured) throw new Error("Azure Blob Storage not configured. Set NEXT_PUBLIC_AZURE_STORAGE_ACCOUNT_NAME and NEXT_PUBLIC_AZURE_STORAGE_SAS_TOKEN.");
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net?${sasToken}`
    );
    return blobServiceClient.getContainerClient(containerName);
  },

  async uploadFile(file: File | Blob, path: string): Promise<string> {
    if (!this.isConfigured) {
      console.warn("[BlobStorage] Not configured — skipping file upload to Blob Storage.");
      return ""; // FIX: Return empty string instead of throwing — Cosmos upload still proceeds
    }

    try {
      const containerClient = this.getContainerClient();
      const blockBlobClient = containerClient.getBlockBlobClient(path);

      // FIX: Set correct content type — text/csv for CSV files
      const contentType = file.type || "text/csv";
      await blockBlobClient.uploadData(file, {
        blobHTTPHeaders: { blobContentType: contentType },
      });

      console.log(`[BlobStorage] Uploaded: ${path}`);
      return blockBlobClient.url;
    } catch (err: any) {
      // FIX: Don't crash the upload — Blob failure is non-fatal
      // The readings are still saved to Cosmos DB
      console.error("[BlobStorage] Upload failed (non-fatal):", err.message);
      return "";
    }
  },

  async deleteFile(path: string): Promise<void> {
    if (!this.isConfigured || !path) return;
    try {
      const containerClient = this.getContainerClient();
      const blockBlobClient = containerClient.getBlockBlobClient(path);
      await blockBlobClient.deleteIfExists();
    } catch (err: any) {
      console.warn("[BlobStorage] Delete failed (non-fatal):", err.message);
    }
  },

  async getDownloadUrl(path: string): Promise<string> {
    if (!this.isConfigured) return "";
    try {
      const containerClient = this.getContainerClient();
      const blockBlobClient = containerClient.getBlockBlobClient(path);
      return blockBlobClient.url;
    } catch (err: any) {
      console.warn("[BlobStorage] getDownloadUrl failed:", err.message);
      return "";
    }
  },
};
