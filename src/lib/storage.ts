import { Place, PlacesFile } from '../types';

const STORAGE_KEY = 'vector_places';

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

export function exportToJson(places: Place[]): string {
  const file: PlacesFile = {
    version: 1,
    places,
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

export function downloadJson(places: Place[], filename = 'travel_places.json'): void {
  const blob = new Blob([exportToJson(places)], { type: 'application/json' });
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
