import { Place, PlacesFile, SavedList, UserPrefs } from '../types';

const STORAGE_KEY = 'vector_places';
const LISTS_KEY = 'vector_saved_lists';
const PREFS_KEY = 'vector_prefs';

export const DEFAULT_PREFS: UserPrefs = { favMode: false, radiusKm: 5, followMe: false };

export function loadPlaces(): Place[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePlaces(places: Place[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
}

export function loadSavedLists(): SavedList[] {
  try {
    const raw = localStorage.getItem(LISTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSavedLists(lists: SavedList[]): void {
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
}

export function loadPrefs(): UserPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: UserPrefs): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function exportToJson(places: Place[], savedLists?: SavedList[]): string {
  const file: PlacesFile = {
    version: 1,
    places,
    savedLists,
    exportedAt: Date.now(),
  };
  return JSON.stringify(file, null, 2);
}

export function parseImportFile(json: string): Place[] | null {
  try {
    const parsed: PlacesFile = JSON.parse(json);
    if (parsed.version && Array.isArray(parsed.places)) {
      return parsed.places;
    }
    return null;
  } catch {
    return null;
  }
}

export function downloadJson(places: Place[], savedLists?: SavedList[], filename = 'travel_places.json'): void {
  const blob = new Blob([exportToJson(places, savedLists)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFromFile(): Promise<Place[] | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const text = await file.text();
      resolve(parseImportFile(text));
    };
    input.click();
  });
}
