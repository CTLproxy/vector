import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
  Place,
  PlaceType,
  GeoPosition,
  SortMode,
  FilterState,
} from '../types';
import { loadPlaces, savePlaces } from '../lib/storage';

interface AppState {
  // Places
  places: Place[];
  addPlace: (p: Omit<Place, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePlace: (id: string, p: Partial<Omit<Place, 'id' | 'createdAt'>>) => void;
  deletePlace: (id: string) => void;
  setPlaces: (places: Place[]) => void;

  // Location
  userPosition: GeoPosition | null;
  setUserPosition: (pos: GeoPosition | null) => void;

  // Sorting
  sortMode: SortMode;
  setSortMode: (mode: SortMode) => void;

  // Filters
  filter: FilterState;
  setFilterTypes: (types: PlaceType[]) => void;
  setFilterTags: (tags: string[]) => void;

  // UI
  selectedPlaceId: string | null;
  setSelectedPlaceId: (id: string | null) => void;
  isAddingPlace: boolean;
  setIsAddingPlace: (v: boolean) => void;
  addingPosition: GeoPosition | null;
  setAddingPosition: (pos: GeoPosition | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
  places: loadPlaces(),

  addPlace: (p) => {
    const now = Date.now();
    const place: Place = { ...p, id: uuid(), createdAt: now, updatedAt: now };
    const next = [...get().places, place];
    savePlaces(next);
    set({ places: next, isAddingPlace: false, addingPosition: null });
  },

  updatePlace: (id, partial) => {
    const next = get().places.map((p) =>
      p.id === id ? { ...p, ...partial, updatedAt: Date.now() } : p,
    );
    savePlaces(next);
    set({ places: next });
  },

  deletePlace: (id) => {
    const next = get().places.filter((p) => p.id !== id);
    savePlaces(next);
    set({ places: next, selectedPlaceId: null });
  },

  setPlaces: (places) => {
    savePlaces(places);
    set({ places });
  },

  userPosition: null,
  setUserPosition: (pos) => set({ userPosition: pos }),

  sortMode: 'smart',
  setSortMode: (mode) => set({ sortMode: mode }),

  filter: { types: [], tags: [] },
  setFilterTypes: (types) => set((s) => ({ filter: { ...s.filter, types } })),
  setFilterTags: (tags) => set((s) => ({ filter: { ...s.filter, tags } })),

  selectedPlaceId: null,
  setSelectedPlaceId: (id) => set({ selectedPlaceId: id }),

  isAddingPlace: false,
  setIsAddingPlace: (v) => set({ isAddingPlace: v }),

  addingPosition: null,
  setAddingPosition: (pos) => set({ addingPosition: pos }),
}));
