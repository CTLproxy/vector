import { Place, SavedList } from '../types';

const SYNC_API = '/api/sync';
const SYNC_KEY = 'vector_sync_id';
const SYNC_TS_KEY = 'vector_last_synced';
const TOMBSTONE_KEY = 'vector_tombstones';

export interface SyncData {
  version: number;
  places: Place[];
  savedLists: SavedList[];
  tombstones: { id: string; deletedAt: number }[];
  updatedAt: number;
}

/** Get the stored sync blob ID */
export function getSyncId(): string | null {
  return localStorage.getItem(SYNC_KEY);
}

/** Store the sync blob ID */
export function setSyncId(id: string): void {
  localStorage.setItem(SYNC_KEY, id);
}

/** Clear sync configuration */
export function clearSyncId(): void {
  localStorage.removeItem(SYNC_KEY);
  localStorage.removeItem(SYNC_TS_KEY);
}

/** Get last synced timestamp */
export function getLastSyncedAt(): number {
  return Number(localStorage.getItem(SYNC_TS_KEY) || '0');
}

function setLastSyncedAt(ts: number): void {
  localStorage.setItem(SYNC_TS_KEY, String(ts));
}

/** Get tombstones (deleted place IDs) */
export function getTombstones(): { id: string; deletedAt: number }[] {
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Add a tombstone when a place is deleted */
export function addTombstone(id: string): void {
  const tombstones = getTombstones();
  if (!tombstones.find((t) => t.id === id)) {
    tombstones.push({ id, deletedAt: Date.now() });
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(tombstones));
  }
}

/** Remove tombstones older than 30 days */
function pruneTombstones(tombstones: { id: string; deletedAt: number }[]): { id: string; deletedAt: number }[] {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return tombstones.filter((t) => t.deletedAt > cutoff);
}

/** Validate a sync key against the server, returns true if valid */
export async function validateSyncKey(key: string): Promise<boolean> {
  const response = await fetch(`${SYNC_API}?key=${encodeURIComponent(key)}`, {
    method: 'GET',
  });
  if (response.status === 403) return false;
  if (!response.ok) throw new Error(`Validation failed (${response.status})`);
  return true;
}

/** Connect a sync key (validates it first) */
export async function connectSyncKey(key: string): Promise<void> {
  const valid = await validateSyncKey(key);
  if (!valid) throw new Error('Invalid or revoked sync key');
  setSyncId(key);
}

/** Pull data from cloud */
async function pullFromCloud(syncKey: string): Promise<SyncData | null> {
  const response = await fetch(`${SYNC_API}?key=${encodeURIComponent(syncKey)}`);
  if (response.status === 403) throw new Error('Invalid or revoked sync key');
  if (!response.ok) throw new Error(`Failed to pull sync data (${response.status})`);
  return response.json();
}

/** Push data to cloud */
async function pushToCloud(syncKey: string, data: SyncData): Promise<void> {
  const response = await fetch(`${SYNC_API}?key=${encodeURIComponent(syncKey)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (response.status === 403) throw new Error('Invalid or revoked sync key');
  if (!response.ok) throw new Error(`Failed to push sync data (${response.status})`);
}

/** Merge local and remote data. Returns merged places and savedLists. */
function mergeData(
  local: { places: Place[]; savedLists: SavedList[]; tombstones: { id: string; deletedAt: number }[] },
  remote: SyncData,
): { places: Place[]; savedLists: SavedList[]; tombstones: { id: string; deletedAt: number }[] } {
  // Merge tombstones
  const tombstoneMap = new Map<string, number>();
  for (const t of [...local.tombstones, ...remote.tombstones]) {
    const existing = tombstoneMap.get(t.id);
    if (!existing || t.deletedAt > existing) {
      tombstoneMap.set(t.id, t.deletedAt);
    }
  }
  const mergedTombstones = pruneTombstones(
    Array.from(tombstoneMap.entries()).map(([id, deletedAt]) => ({ id, deletedAt })),
  );
  const tombstoneIds = new Set(mergedTombstones.map((t) => t.id));

  // Merge places: union by ID, newer wins, filtered by tombstones
  const placeMap = new Map<string, Place>();
  for (const p of remote.places) {
    if (!tombstoneIds.has(p.id) || (tombstoneMap.get(p.id)! < p.updatedAt)) {
      placeMap.set(p.id, p);
    }
  }
  for (const p of local.places) {
    if (tombstoneIds.has(p.id) && tombstoneMap.get(p.id)! >= p.updatedAt) {
      continue; // Deleted
    }
    const existing = placeMap.get(p.id);
    if (!existing || p.updatedAt >= existing.updatedAt) {
      placeMap.set(p.id, p);
    }
  }

  // Merge saved lists: union by ID, simpler — local always wins for same ID
  const listMap = new Map<string, SavedList>();
  for (const l of remote.savedLists) {
    listMap.set(l.id, l);
  }
  for (const l of local.savedLists) {
    listMap.set(l.id, l); // local wins
  }

  return {
    places: Array.from(placeMap.values()),
    savedLists: Array.from(listMap.values()),
    tombstones: mergedTombstones,
  };
}

export interface SyncResult {
  pulled: number;
  pushed: number;
  merged: number;
}

/** Perform a full sync: pull → merge → push */
export async function performSync(
  localPlaces: Place[],
  localSavedLists: SavedList[],
): Promise<{ places: Place[]; savedLists: SavedList[]; result: SyncResult }> {
  const syncKey = getSyncId();
  if (!syncKey) throw new Error('No sync key configured');

  const remote = await pullFromCloud(syncKey);
  const localTombstones = getTombstones();

  if (!remote) {
    // No data on server yet — push current state
    const data: SyncData = {
      version: 1,
      places: localPlaces,
      savedLists: localSavedLists,
      tombstones: pruneTombstones(localTombstones),
      updatedAt: Date.now(),
    };
    await pushToCloud(syncKey, data);
    setLastSyncedAt(Date.now());
    return {
      places: localPlaces,
      savedLists: localSavedLists,
      result: { pulled: 0, pushed: localPlaces.length, merged: 0 },
    };
  }

  const merged = mergeData(
    { places: localPlaces, savedLists: localSavedLists, tombstones: localTombstones },
    remote,
  );

  // Push merged data back
  const syncData: SyncData = {
    version: 1,
    ...merged,
    updatedAt: Date.now(),
  };
  await pushToCloud(syncKey, syncData);

  // Update local tombstones
  localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(merged.tombstones));
  setLastSyncedAt(Date.now());

  const newFromRemote = merged.places.length - localPlaces.length;
  return {
    places: merged.places,
    savedLists: merged.savedLists,
    result: {
      pulled: Math.max(0, newFromRemote),
      pushed: Math.max(0, -newFromRemote),
      merged: merged.places.length,
    },
  };
}

// ===== Delta (live) sync =====

let _deltaSyncTimer: ReturnType<typeof setTimeout> | null = null;
let _deltaSyncInFlight = false;

/**
 * Schedule a debounced delta sync. Only sends places changed since lastSyncedAt.
 * Debounces by 1.5s to batch rapid changes.
 */
export function scheduleDeltaSync(
  getState: () => { places: Place[]; savedLists: SavedList[] },
  onMerged: (places: Place[], savedLists: SavedList[]) => void,
): void {
  if (_deltaSyncTimer) clearTimeout(_deltaSyncTimer);
  _deltaSyncTimer = setTimeout(() => {
    _deltaSyncTimer = null;
    if (_deltaSyncInFlight) return; // skip if previous still running
    const { places, savedLists } = getState();
    _deltaSyncInFlight = true;
    performDeltaSync(places, savedLists)
      .then((result) => {
        if (result) onMerged(result.places, result.savedLists);
      })
      .catch(() => {/* silent fail for live sync */})
      .finally(() => { _deltaSyncInFlight = false; });
  }, 1500);
}

/**
 * Delta sync: pulls remote, merges only locally changed places (since lastSyncedAt),
 * and pushes the merged result. Falls back to full sync if no previous sync timestamp.
 */
async function performDeltaSync(
  localPlaces: Place[],
  localSavedLists: SavedList[],
): Promise<{ places: Place[]; savedLists: SavedList[] } | null> {
  const syncKey = getSyncId();
  if (!syncKey) return null;

  const lastSynced = getLastSyncedAt();
  if (!lastSynced) {
    // No previous sync — do a full sync
    const result = await performSync(localPlaces, localSavedLists);
    return { places: result.places, savedLists: result.savedLists };
  }

  const remote = await pullFromCloud(syncKey);
  const localTombstones = getTombstones();

  if (!remote) {
    // Server empty, push everything
    const data: SyncData = {
      version: 1,
      places: localPlaces,
      savedLists: localSavedLists,
      tombstones: pruneTombstones(localTombstones),
      updatedAt: Date.now(),
    };
    await pushToCloud(syncKey, data);
    setLastSyncedAt(Date.now());
    return { places: localPlaces, savedLists: localSavedLists };
  }

  // Identify locally changed places since last sync
  const changedLocally = localPlaces.filter((p) => p.updatedAt > lastSynced || p.createdAt > lastSynced);
  const newTombstones = localTombstones.filter((t) => t.deletedAt > lastSynced);

  // If nothing changed locally and remote hasn't changed either, skip
  if (changedLocally.length === 0 && newTombstones.length === 0 && remote.updatedAt <= lastSynced) {
    return null;
  }

  // Full merge for correctness, but the key optimization is:
  // we only do the network round-trip when there are actual changes
  const merged = mergeData(
    { places: localPlaces, savedLists: localSavedLists, tombstones: localTombstones },
    remote,
  );

  const syncData: SyncData = {
    version: 1,
    ...merged,
    updatedAt: Date.now(),
  };
  await pushToCloud(syncKey, syncData);
  localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(merged.tombstones));
  setLastSyncedAt(Date.now());

  return { places: merged.places, savedLists: merged.savedLists };
}
