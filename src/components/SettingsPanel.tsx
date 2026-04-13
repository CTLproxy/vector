import { useState } from 'react';
import { useStore } from '../store';
import { downloadJson, importFromFile } from '../lib/storage';
import { pickSyncFile, loadFromSyncFile, saveToSyncFile, hasSyncFile } from '../lib/sync';

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const places = useStore((s) => s.places);
  const setPlaces = useStore((s) => s.setPlaces);
  const [syncStatus, setSyncStatus] = useState('');

  const handleExport = () => {
    downloadJson(places);
  };

  const handleImport = async () => {
    const imported = await importFromFile();
    if (imported) {
      setPlaces(imported);
      setSyncStatus(`Imported ${imported.length} places.`);
    }
  };

  const handlePickSync = async () => {
    const ok = await pickSyncFile();
    setSyncStatus(ok ? 'Sync file selected.' : 'File System Access not supported. Use export/import instead.');
  };

  const handleLoadFromFile = async () => {
    const loaded = await loadFromSyncFile();
    if (loaded) {
      setPlaces(loaded);
      setSyncStatus(`Loaded ${loaded.length} places from sync file.`);
    } else {
      setSyncStatus('Failed to load from sync file.');
    }
  };

  const handleSaveToFile = async () => {
    const ok = await saveToSyncFile(places);
    setSyncStatus(ok ? 'Saved to sync file.' : 'Failed to save.');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>

        <section>
          <h4>Import / Export</h4>
          <div className="settings-row">
            <button className="btn-secondary" onClick={handleExport}>
              Export JSON
            </button>
            <button className="btn-secondary" onClick={handleImport}>
              Import JSON
            </button>
          </div>
        </section>

        <section>
          <h4>File Sync</h4>
          <p className="settings-hint">
            Select a JSON file on iCloud Drive / Google Drive for syncing between devices.
          </p>
          <div className="settings-row">
            <button className="btn-secondary" onClick={handlePickSync}>
              Pick Sync File
            </button>
          </div>
          {hasSyncFile() && (
            <div className="settings-row">
              <button className="btn-secondary" onClick={handleLoadFromFile}>
                Load from File
              </button>
              <button className="btn-primary" onClick={handleSaveToFile}>
                Save to File
              </button>
            </div>
          )}
          {syncStatus && <p className="sync-status">{syncStatus}</p>}
        </section>

        <section>
          <p className="settings-meta">{places.length} places saved</p>
        </section>

        <button className="btn-secondary close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
