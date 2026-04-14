import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../store';
import { useScoredPlaces } from '../hooks/useScoredPlaces';
import { getCurrentPosition } from '../lib/geo';

// Fix default marker icons (Leaflet + bundler issue)
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const USER_ICON = new L.Icon({
  iconUrl: 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="8" fill="#4361ee" stroke="#fff" stroke-width="3"/></svg>'
  ),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function FlyToUser() {
  const map = useMap();
  const userPosition = useStore((s) => s.userPosition);

  useEffect(() => {
    if (userPosition) {
      map.flyTo([userPosition.lat, userPosition.lng], 14, { duration: 1 });
    }
  }, [userPosition, map]);

  return null;
}

function MapClickHandler() {
  const isAddingPlace = useStore((s) => s.isAddingPlace);
  const setAddingPosition = useStore((s) => s.setAddingPosition);
  const setMapCenter = useStore((s) => s.setMapCenter);

  useMapEvents({
    click(e) {
      if (isAddingPlace) {
        setAddingPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
    moveend(e) {
      const c = e.target.getCenter();
      setMapCenter({ lat: c.lat, lng: c.lng });
    },
  });

  return null;
}

/** Exposes the Leaflet map instance to the parent via ref */
function MapRefSetter({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
}

function LocateButton({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const setUserPosition = useStore((s) => s.setUserPosition);
  const [locating, setLocating] = useState(false);

  const handleLocate = useCallback(async () => {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setUserPosition(pos);
      mapRef.current?.flyTo([pos.lat, pos.lng], 15, { duration: 1 });
    } catch {
      // silently fail — user denied or unavailable
    } finally {
      setLocating(false);
    }
  }, [setUserPosition, mapRef]);

  return (
    <button
      className="map-ctrl-btn map-locate-btn"
      onClick={handleLocate}
      title="Show my location"
      disabled={locating}
    >
      {locating ? '…' : '◎'}
    </button>
  );
}

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

function SearchBox({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q,
        format: 'json',
        limit: '5',
        addressdetails: '0',
      });
      const res = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { 'Accept-Language': 'en' },
      });
      if (!res.ok) { setResults([]); return; }
      const data: { display_name: string; lat: string; lon: string }[] = await res.json();
      setResults(data.map((d) => ({ name: d.display_name, lat: +d.lat, lng: +d.lon })));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    setOpen(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(value), 350);
  };

  const handleSelect = (r: { lat: number; lng: number }) => {
    mapRef.current?.flyTo([r.lat, r.lng], 14, { duration: 1 });
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="map-search">
      <input
        className="map-search-input"
        type="text"
        placeholder="Search location…"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
      />
      {open && (results.length > 0 || loading) && (
        <div className="map-search-results">
          {loading && results.length === 0 && (
            <div className="map-search-item map-search-loading">Searching…</div>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              className="map-search-item"
              onMouseDown={() => handleSelect(r)}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MapView() {
  const userPosition = useStore((s) => s.userPosition);
  const setSelectedPlaceId = useStore((s) => s.setSelectedPlaceId);
  const isAddingPlace = useStore((s) => s.isAddingPlace);
  const addingPosition = useStore((s) => s.addingPosition);
  const scored = useScoredPlaces();
  const mapRef = useRef<L.Map | null>(null);

  const center: [number, number] = userPosition
    ? [userPosition.lat, userPosition.lng]
    : [48.8566, 2.3522]; // Default: Paris

  return (
    <>
    <MapContainer
      center={center}
      zoom={13}
      className="map-container"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FlyToUser />
      <MapClickHandler />
      <MapRefSetter mapRef={mapRef} />

      {userPosition && (
        <Marker position={[userPosition.lat, userPosition.lng]} icon={USER_ICON}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {scored.map(({ place, distance }) => (
        <Marker
          key={place.id}
          position={[place.lat, place.lng]}
        >
          <Popup>
            <div
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedPlaceId(place.id)}
            >
              <strong>{place.name}</strong>
              <br />
              {place.type} · ★{place.rating}
              {distance > 0 && <> · {distance.toFixed(1)} km</>}
              <br />
              <small style={{ color: '#4361ee' }}>Tap for details</small>
            </div>
          </Popup>
        </Marker>
      ))}

      {isAddingPlace && addingPosition && (
        <Marker position={[addingPosition.lat, addingPosition.lng]}>
          <Popup>New place here</Popup>
        </Marker>
      )}
    </MapContainer>

    <div className="map-controls">
      <SearchBox mapRef={mapRef} />
      <div className="map-ctrl-group">
        <button
          className="map-ctrl-btn"
          onClick={() => mapRef.current?.zoomIn()}
          title="Zoom in"
        >
          +
        </button>
        <button
          className="map-ctrl-btn"
          onClick={() => mapRef.current?.zoomOut()}
          title="Zoom out"
        >
          −
        </button>
      </div>
      <LocateButton mapRef={mapRef} />
    </div>
    </>
  );
}
