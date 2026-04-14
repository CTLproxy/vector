import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { downloadJson, importFromFile } from '../lib/storage';
import { getCorsProxy, setCorsProxy } from '../lib/cors-proxy';
import { ThemeType } from '../types';
import {
  getSyncId,
  setSyncId,
  clearSyncId,
  getLastSyncedAt,
  createSyncBlob,
  performSync,
} from '../lib/cloud-sync';

interface Props {
  onClose: () => void;
  onOpenSavedLists: () => void;
}

export default function SettingsPanel({ onClose, onOpenSavedLists }: Props) {
  const places = useStore((s) => s.places);
  const savedLists = useStore((s) => s.savedLists);
  const setPlaces = useStore((s) => s.setPlaces);
  const setSavedLists = useStore((s) => s.setSavedLists);
  const favMode = useStore((s) => s.favMode);
  const setFavMode = useStore((s) => s.setFavMode);
  const radiusKm = useStore((s) => s.radiusKm);
  const setRadiusKm = useStore((s) => s.setRadiusKm);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  // Non-linear radius: slider 0-100 maps to 0-50 km
  // 0-50 → 0-5 km (0.1 km precision), 50-75 → 5-10 km (0.5 km), 75-100 → 10-50 km
  const kmToSlider = (km: number): number => {
    if (km <= 0) return 0;
    if (km <= 5) return (km / 5) * 50;
    if (km <= 10) return 50 + ((km - 5) / 5) * 25;
    return 75 + ((km - 10) / 40) * 25;
  };

  const sliderToKm = (v: number): number => {
    if (v <= 0) return 0;
    if (v <= 50) return Math.round((v / 50) * 5 * 10) / 10; // 0.1 precision
    if (v <= 75) return Math.round((5 + ((v - 50) / 25) * 5) * 2) / 2; // 0.5 precision
    return Math.round(10 + ((v - 75) / 25) * 40); // 1 km precision
  };

  const formatRadius = (km: number): string => {
    if (km <= 0) return 'Off';
    if (km < 1) return `${Math.round(km * 1000)}m`;
    if (km % 1 === 0) return `${km} km`;
    return `${km.toFixed(1)} km`;
  };
  const [syncStatus, setSyncStatus] = useState('');
  const [proxyUrl, setProxyUrl] = useState(getCorsProxy);
  const [swUpdate, setSwUpdate] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);
  const [cloudSyncId, setCloudSyncId] = useState(getSyncId() || '');
  const [syncKeyInput, setSyncKeyInput] = useState('');
  const [syncing, setSyncing] = useState(false);

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

  const handleCreateSyncKey = async () => {
    setSyncing(true);
    setSyncStatus('');
    try {
      const blobId = await createSyncBlob(places, savedLists);
      setCloudSyncId(blobId);
      setSyncStatus(`Sync key created! Share this key with your other devices: ${blobId}`);
    } catch (err) {
      setSyncStatus(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectSyncKey = () => {
    const key = syncKeyInput.trim();
    if (!key) return;
    setSyncId(key);
    setCloudSyncId(key);
    setSyncKeyInput('');
    setSyncStatus('Sync key saved. Tap "Sync Now" to pull data.');
  };

  const handleCloudSync = async () => {
    setSyncing(true);
    setSyncStatus('');
    try {
      const { places: merged, savedLists: mergedLists, result } = await performSync(places, savedLists);
      setPlaces(merged);
      setSavedLists(mergedLists);
      setSyncStatus(`Synced! ${result.merged} places total.`);
    } catch (err) {
      setSyncStatus(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnectSync = () => {
    clearSyncId();
    setCloudSyncId('');
    setSyncStatus('Sync disconnected.');
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
          <h4>Theme</h4>
          <div className="settings-row theme-row">
            {([['dark', '🌙 Dark'], ['light', '☀️ Light']] as [ThemeType, string][]).map(([t, label]) => (
              <button
                key={t}
                className={`theme-btn ${theme === t ? 'active' : ''}`}
                onClick={() => setTheme(t)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="settings-row theme-row">
            {([['dark-glass', '🌑 Dark Glass'], ['glass', '💎 Glass'], ['light-glass', '🤍 Light Glass']] as [ThemeType, string][]).map(([t, label]) => (
              <button
                key={t}
                className={`theme-btn ${theme === t ? 'active' : ''}`}
                onClick={() => setTheme(t)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

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
              max="100"
              step="1"
              value={kmToSlider(radiusKm)}
              onChange={(e) => setRadiusKm(sliderToKm(Number(e.target.value)))}
            />
            <span className="radius-value">
              {formatRadius(radiusKm)}
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
          <h4>Cloud Sync</h4>
          {cloudSyncId ? (
            <>
              <p className="settings-hint">
                Sync key: <code className="sync-key-display">{cloudSyncId}</code>
              </p>
              <p className="settings-hint">
                Last synced: {getLastSyncedAt() ? new Date(getLastSyncedAt()).toLocaleString() : 'Never'}
              </p>
              <div className="settings-row">
                <button className="btn-primary" onClick={handleCloudSync} disabled={syncing}>
                  {syncing ? 'Syncing…' : '↻ Sync Now'}
                </button>
                <button className="btn-secondary" onClick={handleDisconnectSync}>
                  Disconnect
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="settings-hint">
                Create a sync key to sync between devices automatically. Or enter a key from another device.
              </p>
              <div className="settings-row">
                <button className="btn-primary" onClick={handleCreateSyncKey} disabled={syncing}>
                  {syncing ? 'Creating…' : 'Create Sync Key'}
                </button>
              </div>
              <div className="settings-row" style={{ flexDirection: 'column', gap: '6px' }}>
                <input
                  type="text"
                  value={syncKeyInput}
                  onChange={(e) => setSyncKeyInput(e.target.value)}
                  placeholder="Paste sync key from another device"
                />
                <button className="btn-secondary" onClick={handleConnectSyncKey} disabled={!syncKeyInput.trim()}>
                  Connect
                </button>
              </div>
            </>
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
