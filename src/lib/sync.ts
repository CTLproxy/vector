import { exportToJson, parseImportFile } from './storage';
import { Place } from '../types';

/**
 * Sync via File System Access API (where supported) or fallback to download/upload.
 *
 * MVP: last-write-wins, no merge logic.
 */

let syncFileHandle: FileSystemFileHandle | null = null;

export async function pickSyncFile(): Promise<boolean> {
  try {
    if (!('showOpenFilePicker' in window)) return false;
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      multiple: false,
    });
    syncFileHandle = handle;
    return true;
  } catch {
    return false;
  }
}

export async function loadFromSyncFile(): Promise<Place[] | null> {
  if (!syncFileHandle) return null;
  try {
    const file = await syncFileHandle.getFile();
    const text = await file.text();
    return parseImportFile(text);
  } catch {
    return null;
  }
}

export async function saveToSyncFile(places: Place[]): Promise<boolean> {
  if (!syncFileHandle) return false;
  try {
    const writable = await (syncFileHandle as any).createWritable();
    await writable.write(exportToJson(places));
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export function hasSyncFile(): boolean {
  return syncFileHandle !== null;
}
