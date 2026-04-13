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
}

export interface PlacesFile {
  version: number;
  places: Place[];
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
