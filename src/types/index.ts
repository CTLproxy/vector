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

/** User preferences persisted to localStorage */
export interface UserPrefs {
  favMode: boolean;
  radiusKm: number;
}
