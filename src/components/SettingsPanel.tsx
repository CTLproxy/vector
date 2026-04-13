import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { downloadJson, importFromFile } from '../lib/storage';
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
  const [swUpdate, setSwUpdate] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      // Already waiting
      if (reg.waiting) { setSwUpdate(reg.waiting); return; }
      // Listen for new SW
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            setSwUpdate(sw);
          }
        });
      });
      // Check for updates now
      reg.update();
    });
  }, []);

  const handleForceUpdate = () => {
    if (swUpdate) {
      setUpdating(true);
      swUpdate.postMessage({ type: 'SKIP_WAITING' });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    } else {
      // No waiting SW — just clear caches and reload
      setUpdating(true);
      caches.keys().then((names) =>
        Promise.all(names.map((n) => caches.delete(n)))
      ).then(() => window.location.reload());
    }
  };

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

  const handleSync = () => {
    // Export current data, then immediately offer import
    // This way user can save to cloud drive, then load from another device
    downloadJson(places, savedLists, 'vector_sync.json');
    setSyncStatus('Sync file downloaded. Save it to iCloud/Google Drive to access from other devices.');
  };

  const handleSyncLoad = async () => {
    const imported = await importFromFile();
    if (imported) {
      setPlaces(imported);
      setSyncStatus(`Synced ${imported.length} places from file.`);
    }
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
            Only show places within this distance from the map center. Set to 0 to show all.
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
          <h4>Sync Between Devices</h4>
          <p className="settings-hint">
            To sync: tap "Save Sync File" to download your data as a file.
            Save it to iCloud Drive, Google Drive, or Dropbox.
            On another device, tap "Load Sync File" and pick the same file.
          </p>
          <div className="settings-row">
            <button className="btn-secondary" onClick={handleSync}>
              Save Sync File
            </button>
            <button className="btn-primary" onClick={handleSyncLoad}>
              Load Sync File
            </button>
          </div>
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
          <p className="settings-meta">
            Version {__APP_VERSION__}
            {swUpdate && <span className="update-badge"> — Update available!</span>}
          </p>
          <div className="settings-row" style={{ justifyContent: 'center' }}>
            <button
              className={swUpdate ? 'btn-primary' : 'btn-secondary'}
              onClick={handleForceUpdate}
              disabled={updating}
            >
              {updating ? 'Updating…' : swUpdate ? 'Update Now' : 'Force Refresh'}
            </button>
          </div>
        </section>

        <button className="btn-secondary close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
