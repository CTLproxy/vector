import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../store';
import { useScoredPlaces } from '../hooks/useScoredPlaces';

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

  useMapEvents({
    click(e) {
      if (isAddingPlace) {
        setAddingPosition({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });

  return null;
}

export default function MapView() {
  const userPosition = useStore((s) => s.userPosition);
  const setSelectedPlaceId = useStore((s) => s.setSelectedPlaceId);
  const isAddingPlace = useStore((s) => s.isAddingPlace);
  const addingPosition = useStore((s) => s.addingPosition);
  const scored = useScoredPlaces();

  const center: [number, number] = userPosition
    ? [userPosition.lat, userPosition.lng]
    : [48.8566, 2.3522]; // Default: Paris

  return (
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

      {userPosition && (
        <Marker position={[userPosition.lat, userPosition.lng]} icon={USER_ICON}>
          <Popup>You are here</Popup>
        </Marker>
      )}

      {scored.map(({ place, distance }) => (
        <Marker
          key={place.id}
          position={[place.lat, place.lng]}
          eventHandlers={{ click: () => setSelectedPlaceId(place.id) }}
        >
          <Popup>
            <strong>{place.name}</strong>
            <br />
            {place.type} · ★{place.rating}
            {distance > 0 && <> · {distance.toFixed(1)} km</>}
          </Popup>
        </Marker>
      ))}

      {isAddingPlace && addingPosition && (
        <Marker position={[addingPosition.lat, addingPosition.lng]}>
          <Popup>New place here</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
