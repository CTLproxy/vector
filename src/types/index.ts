export type PlaceType = 'restaurant' | 'bar' | 'cafe';

export interface Place {
  id: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  rating: number; // 1-5
  tags: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
  /** Original Google/Apple Maps URL this place was imported from */
  sourceUrl?: string;
  /** ID of the SavedList this place was imported from (if any) */
  sourceListId?: string;
  /** Timestamp when the place was marked as visited */
  visitedAt?: number;
  /** Whether the place was skipped during decision mode */
  skipped?: boolean;
}

/** A tracked Google Maps saved list that can be re-synced */
export interface SavedList {
  id: string;
  name: string;
  url: string;
  lastSyncedAt: number;
  placeCount: number;
}

export interface PlacesFile {
  version: number;
  places: Place[];
  savedLists?: SavedList[];
  exportedAt: number;
}

export interface GeoPosition {
  lat: number;
  lng: number;
}

export type SortMode = 'distance' | 'rating' | 'smart';

export interface FilterState {
  types: PlaceType[];
  tags: string[];
}

export type ThemeType = 'dark' | 'light' | 'glass' | 'dark-glass' | 'light-glass';

/** A place the user navigated to but hasn't confirmed visiting yet */
export interface PendingVisit {
  placeId: string;
  placeName: string;
  navigatedAt: number;
}

/** User preferences persisted to localStorage */
export interface UserPrefs {
  favMode: boolean;
  radiusKm: number;
  theme: ThemeType;
  /** Number of days before visited flag auto-expires (default 30) */
  visitedExpiryDays: number;
  /** Sync mode: 'manual' = on demand, 'live' = auto-sync on every change */
  syncMode: 'manual' | 'live';
  /** When true, all network requests are suppressed — app runs fully offline */
  offlineMode: boolean;
}
