import { useStore } from '../store';

/**
 * Check if network requests are currently allowed.
 * Returns false if offline mode is enabled OR browser is offline.
 */
export function isNetworkAvailable(): boolean {
  const { offlineMode, isOnline } = useStore.getState();
  if (offlineMode) return false;
  return isOnline;
}

/**
 * Guarded fetch: silently returns null when offline instead of throwing.
 * Use this for all non-critical network requests (sync, proxy, etc.).
 */
export async function guardedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response | null> {
  if (!isNetworkAvailable()) return null;
  try {
    return await fetch(input, init);
  } catch {
    // Network error (DNS failure, no connection, etc.)
    return null;
  }
}
