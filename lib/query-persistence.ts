import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";

const CACHE_KEY = "TRIPDOCHUB_QUERY_CACHE";
const CACHE_VERSION = 1;

interface CacheData {
  version: number;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Persist query cache to AsyncStorage.
 * Only caches specific queries that benefit from offline-first UX.
 */
export async function persistQueryCache(queryClient: QueryClient): Promise<void> {
  try {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    // Only persist specific queries that improve UX
    const keysToCache = [
      "trips.list",
      "trips.listArchived", 
      "documents.inbox",
      "user.credits",
      "user.me",
    ];
    
    const dataToCache: Record<string, unknown> = {};
    
    for (const query of queries) {
      const queryKey = query.queryKey;
      const keyString = Array.isArray(queryKey) && queryKey.length > 0 
        ? String(queryKey[0]) 
        : "";
      
      // Check if this query should be cached
      if (keysToCache.some(k => keyString.includes(k)) && query.state.data !== undefined) {
        dataToCache[JSON.stringify(queryKey)] = query.state.data;
      }
    }
    
    const cacheData: CacheData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      data: dataToCache,
    };
    
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn("[QueryPersistence] Failed to persist cache:", error);
  }
}

/**
 * Restore query cache from AsyncStorage.
 * Returns cached data that can be used to hydrate the query client.
 */
export async function restoreQueryCache(queryClient: QueryClient): Promise<void> {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (!cached) return;
    
    const cacheData: CacheData = JSON.parse(cached);
    
    // Check version compatibility
    if (cacheData.version !== CACHE_VERSION) {
      await AsyncStorage.removeItem(CACHE_KEY);
      return;
    }
    
    // Check if cache is too old (24 hours)
    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - cacheData.timestamp > maxAge) {
      await AsyncStorage.removeItem(CACHE_KEY);
      return;
    }
    
    // Hydrate the query client with cached data
    for (const [keyString, data] of Object.entries(cacheData.data)) {
      try {
        const queryKey = JSON.parse(keyString);
        queryClient.setQueryData(queryKey, data);
      } catch {
        // Skip invalid entries
      }
    }
    
    console.log("[QueryPersistence] Cache restored successfully");
  } catch (error) {
    console.warn("[QueryPersistence] Failed to restore cache:", error);
  }
}

/**
 * Clear the persisted query cache.
 */
export async function clearQueryCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.warn("[QueryPersistence] Failed to clear cache:", error);
  }
}
