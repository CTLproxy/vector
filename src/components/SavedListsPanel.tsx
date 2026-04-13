import { useState } from 'react';
import { useStore } from '../store';
import { SavedList, PlaceType } from '../types';
import { fetchGoogleSavedList, diffListPlaces } from '../lib/google-list';

type SyncState = 'idle' | 'syncing' | 'review';

interface SyncResult {
  listId: string;
  added: { name: string; lat: number; lng: number; sourceUrl: string }[];
  removed: { id: string; name: string }[];
  unchanged: number;
}

export default function SavedListsPanel({ onClose }: { onClose: () => void }) {
  const savedLists = useStore((s) => s.savedLists);
  const places = useStore((s) => s.places);
  const addPlaces = useStore((s) => s.addPlaces);
  const removePlaces = useStore((s) => s.removePlaces);
  const detachPlacesFromList = useStore((s) => s.detachPlacesFromList);
  const updateSavedList = useStore((s) => s.updateSavedList);
  const deleteSavedList = useStore((s) => s.deleteSavedList);

  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState('');
  const [removedAction, setRemovedAction] = useState<Record<string, 'remove' | 'keep'>>({});

  const handleSync = async (list: SavedList) => {
    setSyncState('syncing');
    setError('');
    try {
      const remote = await fetchGoogleSavedList(list.url);
      const localListPlaces = places
        .filter((p) => p.sourceListId === list.id)
        .map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, name: p.name }));

      const diff = diffListPlaces(remote.places, localListPlaces);

      if (diff.added.length === 0 && diff.removed.length === 0) {
        updateSavedList(list.id, { lastSyncedAt: Date.now() });
        setSyncState('idle');
        setError('Already up to date.');
        return;
      }

      setSyncResult({
        listId: list.id,
        added: diff.added,
        removed: diff.removed,
        unchanged: diff.unchanged,
      });
      // Default all removed to 'remove'
      const actions: Record<string, 'remove' | 'keep'> = {};
      diff.removed.forEach((r) => { actions[r.id] = 'remove'; });
      setRemovedAction(actions);
      setSyncState('review');
    } catch (err) {
      setError(`Sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setSyncState('idle');
    }
  };

  const handleApplySync = () => {
    if (!syncResult) return;

    // Add new places
    if (syncResult.added.length > 0) {
      addPlaces(
        syncResult.added.map((p) => ({
          name: p.name || 'Unnamed Place',
          type: 'restaurant' as PlaceType,
          lat: p.lat,
          lng: p.lng,
          rating: 3,
          tags: [],
          notes: '',
          sourceUrl: p.sourceUrl,
          sourceListId: syncResult.listId,
        })),
      );
    }

    // Handle removed places
    const toRemove = syncResult.removed
      .filter((r) => removedAction[r.id] === 'remove')
      .map((r) => r.id);
    const toDetach = syncResult.removed
      .filter((r) => removedAction[r.id] === 'keep')
      .map((r) => r.id);

    if (toRemove.length > 0) removePlaces(toRemove);
    if (toDetach.length > 0) detachPlacesFromList(toDetach);

    // Update list metadata
    updateSavedList(syncResult.listId, {
      lastSyncedAt: Date.now(),
      placeCount: syncResult.unchanged + syncResult.added.length,
    });

    setSyncResult(null);
    setSyncState('idle');
  };

  const handleDeleteList = (list: SavedList) => {
    if (!confirm(`Remove tracked list "${list.name}"? Places will remain but lose their list association.`)) return;
    // Detach all places from this list
    const ids = places.filter((p) => p.sourceListId === list.id).map((p) => p.id);
    if (ids.length > 0) detachPlacesFromList(ids);
    deleteSavedList(list.id);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <h3>Saved Lists</h3>

        {savedLists.length === 0 && (
          <p className="settings-hint">
            No saved lists yet. Import a Google Maps shared list using the 📎 button.
          </p>
        )}

        {syncState === 'review' && syncResult && (
          <div className="sync-review">
            <h4>Sync Changes</h4>
            {syncResult.added.length > 0 && (
              <div className="sync-section">
                <p className="sync-label">+ {syncResult.added.length} new place{syncResult.added.length !== 1 ? 's' : ''}</p>
                {syncResult.added.map((p, i) => (
                  <div key={i} className="sync-item added">{p.name || 'Unnamed'}</div>
                ))}
              </div>
            )}
            {syncResult.removed.length > 0 && (
              <div className="sync-section">
                <p className="sync-label">− {syncResult.removed.length} removed from remote list</p>
                {syncResult.removed.map((r) => (
                  <div key={r.id} className="sync-item removed">
                    <span>{r.name}</span>
                    <div className="sync-item-actions">
                      <button
                        className={`sync-choice ${removedAction[r.id] === 'remove' ? 'active-danger' : ''}`}
                        onClick={() => setRemovedAction((s) => ({ ...s, [r.id]: 'remove' }))}
                      >
                        Remove
                      </button>
                      <button
                        className={`sync-choice ${removedAction[r.id] === 'keep' ? 'active-keep' : ''}`}
                        onClick={() => setRemovedAction((s) => ({ ...s, [r.id]: 'keep' }))}
                      >
                        Keep
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="settings-hint">{syncResult.unchanged} unchanged</p>
            <div className="form-actions">
              <button className="btn-secondary" onClick={() => { setSyncState('idle'); setSyncResult(null); }}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleApplySync}>Apply Changes</button>
            </div>
          </div>
        )}

        {syncState !== 'review' && savedLists.map((list) => (
          <div key={list.id} className="saved-list-card">
            <div className="saved-list-info">
              <span className="saved-list-name">{list.name}</span>
              <span className="saved-list-meta">
                {list.placeCount} places · synced {new Date(list.lastSyncedAt).toLocaleDateString()}
              </span>
            </div>
            <div className="saved-list-actions">
              <button
                className="btn-secondary btn-sm"
                onClick={() => handleSync(list)}
                disabled={syncState === 'syncing'}
              >
                {syncState === 'syncing' ? '…' : '↻ Sync'}
              </button>
              <button
                className="btn-danger btn-sm"
                onClick={() => handleDeleteList(list)}
              >
                ✕
              </button>
            </div>
          </div>
        ))}

        {error && <p className="sync-status">{error}</p>}

        {syncState === 'syncing' && (
          <div className="import-status">
            <div className="spinner" />
            <p>Syncing…</p>
          </div>
        )}

        <button className="btn-secondary close-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
