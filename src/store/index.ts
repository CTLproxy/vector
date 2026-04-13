import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import {
  Place,
  PlaceType,
  GeoPosition,
  SortMode,
  FilterState,
  SavedList,
} from '../types';
import { loadPlaces, savePlaces, loadSavedLists, saveSavedLists } from '../lib/storage';

interface AppState {
  // Places
  places: Place[];
  addPlace: (p: Omit<Place, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePlace: (id: string, p: Partial<Omit<Place, 'id' | 'createdAt'>>) => void;
  deletePlace: (id: string) => void;
  setPlaces: (places: Place[]) => void;
  addPlaces: (places: Omit<Place, 'id' | 'createdAt' | 'updatedAt'>[]) => void;
  removePlaces: (ids: string[]) => void;
  detachPlacesFromList: (ids: string[]) => void;

  // Saved Lists
  savedLists: SavedList[];
  addSavedList: (list: Omit<SavedList, 'id'>) => SavedList;
  updateSavedList: (id: string, partial: Partial<Omit<SavedList, 'id'>>) => void;
  deleteSavedList: (id: string) => void;

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

  addPlaces: (newPlaces) => {
    const now = Date.now();
    const created: Place[] = newPlaces.map((p) => ({
      ...p,
      id: uuid(),
      createdAt: now,
      updatedAt: now,
    }));
    const next = [...get().places, ...created];
    savePlaces(next);
    set({ places: next });
  },

  removePlaces: (ids) => {
    const idSet = new Set(ids);
    const next = get().places.filter((p) => !idSet.has(p.id));
    savePlaces(next);
    set({ places: next });
  },

  detachPlacesFromList: (ids) => {
    const idSet = new Set(ids);
    const next = get().places.map((p) =>
      idSet.has(p.id) ? { ...p, sourceListId: undefined, updatedAt: Date.now() } : p,
    );
    savePlaces(next);
    set({ places: next });
  },

  // Saved Lists
  savedLists: loadSavedLists(),

  addSavedList: (list) => {
    const saved: SavedList = { ...list, id: uuid() };
    const next = [...get().savedLists, saved];
    saveSavedLists(next);
    set({ savedLists: next });
    return saved;
  },

  updateSavedList: (id, partial) => {
    const next = get().savedLists.map((l) =>
      l.id === id ? { ...l, ...partial } : l,
    );
    saveSavedLists(next);
    set({ savedLists: next });
  },

  deleteSavedList: (id) => {
    const next = get().savedLists.filter((l) => l.id !== id);
    saveSavedLists(next);
    set({ savedLists: next });
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
