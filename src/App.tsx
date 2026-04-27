import { useState, useEffect, useMemo, useRef } from 'react';
import MapView from './components/MapView';
import PlaceList from './components/PlaceList';
import SortToggle from './components/SortToggle';
import FilterBar from './components/FilterBar';
import AddPlaceForm from './components/AddPlaceForm';
import PlaceDetail from './components/PlaceDetail';
import DecisionMode from './components/DecisionMode';
import RollDice from './components/RollDice';
import SettingsPanel from './components/SettingsPanel';
import ImportLinkModal from './components/ImportLinkModal';
import SavedListsPanel from './components/SavedListsPanel';
import ManagePlaces from './components/ManagePlaces';
import VisitConfirmation from './components/VisitConfirmation';
import { useStore } from './store';
import { useGeolocation } from './hooks/useGeolocation';
import { useScoredPlaces } from './hooks/useScoredPlaces';
import { getSyncId, performSync, scheduleDeltaSync, pullRemoteChanges } from './lib/cloud-sync';
import { loadPendingVisits, savePendingVisits } from './lib/storage';
import { PendingVisit, Place, SavedList } from './types';

const DECISION_COUNT = 5;

export default function App() {
  useGeolocation();
  const theme = useStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Auto-sync on app start and when returning from background
  const setPlaces = useStore((s) => s.setPlaces);
  const setSavedLists = useStore((s) => s.setSavedLists);
  const expireVisitedPlaces = useStore((s) => s.expireVisitedPlaces);

  // Pending visits – show confirmation on app start
  const [pendingVisits, setPendingVisits] = useState<PendingVisit[]>(() => loadPendingVisits());

  const dismissPendingVisit = (placeId: string) => {
    setPendingVisits((prev) => {
      const next = prev.filter((v) => v.placeId !== placeId);
      savePendingVisits(next);
      return next;
    });
  };

  const dismissAllPendingVisits = () => {
    setPendingVisits([]);
    savePendingVisits([]);
  };

  // Expire visited places on mount
  useEffect(() => {
    expireVisitedPlaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const doSync = () => {
      const syncId = getSyncId();
      if (!syncId) return;
      const places = useStore.getState().places;
      const savedLists = useStore.getState().savedLists;
      performSync(places, savedLists)
        .then(({ places: merged, savedLists: mergedLists }) => {
          setPlaces(merged);
          setSavedLists(mergedLists);
        })
        .catch(() => {/* silent fail on auto-sync */});
    };

    doSync();

    const onVisible = () => {
      if (document.visibilityState === 'visible') doSync();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live sync: subscribe to place/savedList changes and auto-sync
  const syncMode = useStore((s) => s.syncMode);
  const prevPlacesRef = useRef(useStore.getState().places);
  const prevListsRef = useRef(useStore.getState().savedLists);

  // Callback to apply merged data from sync
  const applyMerged = (mergedPlaces: Place[], mergedLists: SavedList[]) => {
    const current = useStore.getState();
    // Compare by serialized content, not just length — updates (e.g. visited flag) don't change length
    if (JSON.stringify(mergedPlaces) !== JSON.stringify(current.places)) {
      prevPlacesRef.current = mergedPlaces; // prevent re-triggering sync
      setPlaces(mergedPlaces);
    }
    if (JSON.stringify(mergedLists) !== JSON.stringify(current.savedLists)) {
      prevListsRef.current = mergedLists;
      setSavedLists(mergedLists);
    }
  };

  useEffect(() => {
    if (syncMode !== 'live' || !getSyncId()) return;

    // Auto-push on local changes
    const unsub = useStore.subscribe((state) => {
      const placesChanged = state.places !== prevPlacesRef.current;
      const listsChanged = state.savedLists !== prevListsRef.current;
      prevPlacesRef.current = state.places;
      prevListsRef.current = state.savedLists;

      if (placesChanged || listsChanged) {
        scheduleDeltaSync(
          () => ({ places: state.places, savedLists: state.savedLists }),
          applyMerged,
        );
      }
    });

    // Periodic pull for remote changes (every 30s)
    const pullInterval = setInterval(() => {
      const { places: p, savedLists: sl } = useStore.getState();
      pullRemoteChanges(p, sl)
        .then((result) => { if (result) applyMerged(result.places, result.savedLists); })
        .catch(() => {/* silent */});
    }, 30_000);

    return () => {
      unsub();
      clearInterval(pullInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncMode, setPlaces, setSavedLists]);

  const scored = useScoredPlaces();
  // Exclude visited places from Decide and Roll
  const unvisitedScored = useMemo(
    () => scored.filter((s) => !s.place.visitedAt),
    [scored],
  );
  const isAddingPlace = useStore((s) => s.isAddingPlace);
  const setIsAddingPlace = useStore((s) => s.setIsAddingPlace);
  const selectedPlaceId = useStore((s) => s.selectedPlaceId);
  const addingPosition = useStore((s) => s.addingPosition);

  const [showDecision, setShowDecision] = useState(false);
  const [showRollDice, setShowRollDice] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showImportLink, setShowImportLink] = useState(false);
  const [showSavedLists, setShowSavedLists] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="app">
      {/* Map section */}
      <div className="app-map">
        <MapView />
        {isAddingPlace && (
          <div className="map-banner">Tap on the map to pick a location</div>
        )}
      </div>

      {/* Right panel (toolbar + filter + list) */}
      <div className="app-panel">
        {/* Toolbar */}
        <div className="app-toolbar">
          <div className="toolbar-left">
            <SortToggle />
          </div>
          <div className="toolbar-right">
            <div className="toolbar-group">
              <button
                className="toolbar-btn"
                onClick={() => setShowDecision(true)}
                title="Decision mode"
                disabled={unvisitedScored.length === 0}
              >
                💎 <span className="toolbar-label">Decide</span>
              </button>
              <button
                className="toolbar-btn"
                onClick={() => setShowRollDice(true)}
                title="Roll dice"
                disabled={unvisitedScored.length === 0}
              >
                🎲 <span className="toolbar-label">Roll</span>
              </button>
              <div className="toolbar-more-wrap">
                <button
                  className="toolbar-btn toolbar-btn-more"
                  onClick={() => setShowMore(!showMore)}
                  title="More actions"
                >
                  •••
                </button>
              {showMore && (
                <>
                  <div className="toolbar-dropdown-backdrop" onClick={() => setShowMore(false)} />
                  <div className="toolbar-dropdown">
                    <button
                      className="toolbar-dropdown-item"
                      onClick={() => { setIsAddingPlace(!isAddingPlace); setShowMore(false); }}
                    >
                      {isAddingPlace ? '✕ Cancel' : '＋ Add Place'}
                    </button>
                    <button
                      className="toolbar-dropdown-item"
                      onClick={() => { setShowImportLink(true); setShowMore(false); }}
                    >
                      📎 Import Link
                    </button>
                    <button
                      className="toolbar-dropdown-item"
                      onClick={() => { setShowManage(true); setShowMore(false); }}
                    >
                      📋 Manage Places
                    </button>
                    <button
                      className="toolbar-dropdown-item"
                      onClick={() => { setShowSettings(true); setShowMore(false); }}
                    >
                      ⚙️ Settings
                    </button>
                  </div>
                </>
              )}
              </div>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <FilterBar />

        {/* List section */}
        <div className="app-list">
          <PlaceList scored={scored} />
        </div>
      </div>

      {/* Modals */}
      {pendingVisits.length > 0 && !showDecision && !showRollDice && !showSettings && (
        <VisitConfirmation
          pendingVisits={pendingVisits}
          onDismiss={dismissPendingVisit}
          onDone={dismissAllPendingVisits}
        />
      )}
      {addingPosition && <AddPlaceForm />}
      {selectedPlaceId && <PlaceDetail />}
      {showDecision && (
        <DecisionMode
          candidates={unvisitedScored.slice(0, DECISION_COUNT)}
          onClose={() => setShowDecision(false)}
        />
      )}
      {showRollDice && unvisitedScored.length > 0 && (
        <RollDice
          candidates={unvisitedScored}
          onClose={() => setShowRollDice(false)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          onOpenSavedLists={() => { setShowSettings(false); setShowSavedLists(true); }}
        />
      )}
      {showImportLink && (
        <ImportLinkModal onClose={() => setShowImportLink(false)} />
      )}
      {showSavedLists && (
        <SavedListsPanel onClose={() => setShowSavedLists(false)} />
      )}
      {showManage && (
        <ManagePlaces
          onClose={() => setShowManage(false)}
          onAddPlace={() => setIsAddingPlace(true)}
          onImportLink={() => setShowImportLink(true)}
          onSettings={() => setShowSettings(true)}
          onSync={async () => {
            const syncId = getSyncId();
            if (!syncId) return;
            const places = useStore.getState().places;
            const savedLists = useStore.getState().savedLists;
            const { places: merged, savedLists: mergedLists } = await performSync(places, savedLists);
            setPlaces(merged);
            setSavedLists(mergedLists);
          }}
        />
      )}
    </div>
  );
}
