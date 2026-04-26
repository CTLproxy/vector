import { useState, useEffect } from 'react';
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
import { useStore } from './store';
import { useGeolocation } from './hooks/useGeolocation';
import { useScoredPlaces } from './hooks/useScoredPlaces';
import { getSyncId, performSync } from './lib/cloud-sync';

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

  const scored = useScoredPlaces();
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
                disabled={scored.length === 0}
              >
                🎯 <span className="toolbar-label">Decide</span>
              </button>
              <button
                className="toolbar-btn"
                onClick={() => setShowRollDice(true)}
                title="Roll dice"
                disabled={scored.length === 0}
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
                      ⚙ Settings
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
      {addingPosition && <AddPlaceForm />}
      {selectedPlaceId && <PlaceDetail />}
      {showDecision && (
        <DecisionMode
          candidates={scored.slice(0, DECISION_COUNT)}
          onClose={() => setShowDecision(false)}
        />
      )}
      {showRollDice && scored.length > 0 && (
        <RollDice
          candidates={scored}
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
        />
      )}
    </div>
  );
}
