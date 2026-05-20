'use client';
import { get, set, del } from 'idb-keyval';
import { useStore } from '../store/useStore';

const CACHE_KEY = 'wattsup_preload_cache';
// 5-minute TTL — enough to feel live without hammering the DB
const CACHE_TTL_MS = 5 * 60 * 1000;

// Max readings to cache in IndexedDB — beyond this we skip caching to avoid
// the 5 MB IDB item limit, but the data is still shown in the UI.
const MAX_CACHE_READINGS = 10_000;

export const PreloadService = {
  async preload(
    userId: string,
    onProgress: (progress: number, status: string) => void
  ): Promise<void> {
    try {
      onProgress(5, 'Checking cache...');

      let cachedData: any = null;
      try {
        cachedData = await get(CACHE_KEY);
      } catch {
        // IndexedDB not available — skip cache
      }

      const cachedAt = cachedData?._cachedAt
        ? new Date(cachedData._cachedAt).getTime()
        : 0;
      const cacheAge = Date.now() - cachedAt;
      const cacheValid = cachedData?.readings?.length > 0 && cacheAge < CACHE_TTL_MS;

      if (cacheValid) {
        onProgress(15, 'Restoring from cache...');
        useStore.getState().setAllData(cachedData);
        onProgress(100, `Ready — ${cachedData.readings.length} readings loaded from cache`);
        // Silently refresh in background so next open is current
        this.fetchAndStore(userId).catch(console.error);
        return;
      }

      // No valid cache — fetch from server
      await this.fetchAndStore(userId, onProgress);
    } catch (error: any) {
      console.error('[Preload] Error:', error);
      onProgress(100, `Error: ${error.message ?? 'Failed to load data'}`);
      // Don't leave the app stuck — mark as loaded
      useStore.getState().setLoaded(true);
    }
  },

  async fetchAndStore(
    userId: string,
    onProgress?: (progress: number, status: string) => void
  ): Promise<void> {
    if (onProgress) onProgress(20, 'Connecting to database...');

    // NO client-side timeout — the server handles its own timeouts per query.
    // Large datasets (25k+ readings) legitimately take >45s on cold Cosmos starts.
    let response: Response;
    try {
      response = await fetch(
        `/api/preloadAllData?userId=${encodeURIComponent(userId)}`
        // deliberately no AbortController — let the server finish
      );
    } catch (err: any) {
      throw new Error(`Network error reaching server: ${err.message}`);
    }

    if (!response.ok) {
      let msg = `Server returned ${response.status}`;
      try {
        const body = await response.json();
        msg = body.error || body.message || msg;
        if (response.status === 503) {
          msg += ' — Set COSMOS_ENDPOINT and COSMOS_KEY in your .env file';
        }
      } catch { /* ignore parse error */ }
      throw new Error(msg);
    }

    if (onProgress) onProgress(65, 'Parsing energy data...');

    let data: any;
    try {
      data = await response.json();
    } catch (err: any) {
      throw new Error(`Failed to parse server response: ${err.message}`);
    }

    // Defensive defaults — guard against undefined fields
    data.readings  = Array.isArray(data.readings)  ? data.readings  : [];
    data.files     = Array.isArray(data.files)      ? data.files     : [];
    data.logs      = Array.isArray(data.logs)       ? data.logs      : [];
    data.settings  = Array.isArray(data.settings)   ? data.settings  : [];
    data.summaries = data.summaries ?? { equipment: [], area: [] };
    data.costRules = Array.isArray(data.costRules)  ? data.costRules : [];
    data.roles     = Array.isArray(data.roles)      ? data.roles     : [];

    // Server already sorts by timestamp — skip the expensive client-side re-sort
    // on large datasets to keep the UI thread responsive.
    if (data.readings.length <= 5_000) {
      data.readings.sort(
        (a: any, b: any) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    }

    if (onProgress) onProgress(85, `Loaded ${data.readings.length} energy readings...`);

    // Push to Zustand store — this triggers all React re-renders
    useStore.getState().setAllData(data);

    // Log to console so the developer can confirm data arrived in UI
    console.log(
      `[PreloadService] Store updated: ${data.readings.length} readings,`,
      `${data.summaries.equipment.length} equipment,`,
      `${data.files.length} files`
    );

    // Cache — skip if dataset is too large to avoid exceeding IDB limits
    if (onProgress) onProgress(93, 'Caching data locally...');
    try {
      if (data.readings.length <= MAX_CACHE_READINGS) {
        await set(CACHE_KEY, { ...data, _cachedAt: new Date().toISOString() });
        console.log('[PreloadService] Cache written successfully.');
      } else {
        // Cache a trimmed version (most-recent readings only) so the app
        // loads fast on refresh while the full set loads in background
        const trimmedData = {
          ...data,
          readings: data.readings.slice(0, MAX_CACHE_READINGS),
          _cachedAt: new Date().toISOString(),
          _trimmed: true,
        };
        await set(CACHE_KEY, trimmedData);
        console.log(
          `[PreloadService] Cache written with trimmed ${MAX_CACHE_READINGS} readings (full set: ${data.readings.length}).`
        );
      }
    } catch (e) {
      console.warn('[PreloadService] Cache write failed (non-fatal):', e);
    }

    if (onProgress) onProgress(100, `Ready — ${data.readings.length} readings loaded`);
  },

  async clearCache(): Promise<void> {
    try {
      await del(CACHE_KEY);
      console.log('[PreloadService] Cache cleared');
    } catch (e) {
      console.warn('[PreloadService] Cache clear failed:', e);
    }
  },
};
