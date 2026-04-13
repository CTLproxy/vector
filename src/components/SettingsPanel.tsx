import { useState } from 'react';
import { useStore } from '../store';
import { downloadJson, importFromFile } from '../lib/storage';
import { pickSyncFile, loadFromSyncFile, saveToSyncFile, hasSyncFile } from '../lib/sync';
import { getCorsProxy, setCorsProxy } from '../lib/cors-proxy';

interface Props {
  onClose: () => void;
  onOpenSavedLists: () => void;
}

export default function SettingsPanel({ onClose, onOpenSavedLists }: Props) {
  const places = useStore((s) => s.places);
  const savedLists = useStore((s) => s.savedLists);
  const setPlaces = useStore((s) => s.setPlaces);
  const favMode = useStore((s) => s.favMode);
  const setFavMode = useStore((s) => s.setFavMode);
  const radiusKm = useStore((s) => s.radiusKm);
  const setRadiusKm = useStore((s) => s.setRadiusKm);
  const [syncStatus, setSyncStatus] = useState('');
  const [proxyUrl, setProxyUrl] = useState(getCorsProxy);

  const handleExport = () => {
    downloadJson(places, savedLists);
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

  const handleProxyChange = (value: string) => {
    setProxyUrl(value);
    setCorsProxy(value);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <h3>Settings</h3>

        <section>
          <h4>Rating Mode</h4>
          <p className="settings-hint">
            In Favourites mode, places are either ❤️ favourite (★5) or not.
            Original ratings are preserved.
          </p>
          <div className="settings-row">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={favMode}
                onChange={(e) => setFavMode(e.target.checked)}
              />
              Favourites mode
            </label>
          </div>
        </section>

        <section>
          <h4>Search Radius</h4>
          <p className="settings-hint">
            Only show places within this distance. Set to 0 to show all.
          </p>
          <div className="settings-row radius-row">
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
            />
            <span className="radius-value">
              {radiusKm === 0 ? 'Off' : `${radiusKm} km`}
            </span>
          </div>
        </section>

        <section>
          <h4>Saved Lists</h4>
          <p className="settings-hint">
            Manage Google Maps saved lists imported via share links.
          </p>
          <div className="settings-row">
            <button className="btn-secondary" onClick={onOpenSavedLists}>
              {savedLists.length > 0
                ? `Manage ${savedLists.length} List${savedLists.length !== 1 ? 's' : ''}`
                : 'No Lists Yet'}
            </button>
          </div>
        </section>

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
          <h4>CORS Proxy</h4>
          <p className="settings-hint">
            Used to resolve short share URLs. Leave empty to use the default proxy.
          </p>
          <input
            type="text"
            value={proxyUrl}
            onChange={(e) => handleProxyChange(e.target.value)}
            placeholder="https://api.codetabs.com/v1/proxy?quest="
          />
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
