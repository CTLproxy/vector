import { useState } from 'react';
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
import { useStore } from './store';
import { useGeolocation } from './hooks/useGeolocation';
import { useScoredPlaces } from './hooks/useScoredPlaces';

const DECISION_COUNT = 5;

export default function App() {
  useGeolocation();

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

  return (
    <div className="app">
      {/* Map section */}
      <div className="app-map">
        <MapView />
        {isAddingPlace && (
          <div className="map-banner">Tap on the map to pick a location</div>
        )}
      </div>

      {/* Toolbar */}
      <div className="app-toolbar">
        <SortToggle />
        <div className="toolbar-actions">
          <button
            className="btn-icon"
            onClick={() => setShowDecision(true)}
            title="Decision mode"
            disabled={scored.length === 0}
          >
            🎯
          </button>
          <button
            className="btn-icon"
            onClick={() => setShowRollDice(true)}
            title="Roll dice"
            disabled={scored.length === 0}
          >
            🎲
          </button>
          <button
            className="btn-icon"
            onClick={() => setShowImportLink(true)}
            title="Import from link"
          >
            📎
          </button>
          <button
            className="btn-icon"
            onClick={() => setIsAddingPlace(!isAddingPlace)}
            title={isAddingPlace ? 'Cancel' : 'Add place'}
          >
            {isAddingPlace ? '✕' : '+'}
          </button>
          <button
            className="btn-icon"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <FilterBar />

      {/* List section */}
      <div className="app-list">
        <PlaceList scored={scored} />
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
    </div>
  );
}
