import { ScoredPlace } from '../lib/scoring';
import { useStore } from '../store';

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

function PlaceCard({ scored }: { scored: ScoredPlace }) {
  const { place, distance } = scored;
  const setSelectedPlaceId = useStore((s) => s.setSelectedPlaceId);
  const userPosition = useStore((s) => s.userPosition);

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;

  return (
    <div className="place-card" onClick={() => setSelectedPlaceId(place.id)}>
      <div className="place-card-info">
        <div className="place-card-header">
          <span className="place-name">{place.name}</span>
          <span className={`place-type type-${place.type}`}>{place.type}</span>
        </div>
        <div className="place-card-meta">
          <span className="place-rating">{'★'.repeat(place.rating)}{'☆'.repeat(5 - place.rating)}</span>
          {userPosition && <span className="place-distance">{formatDistance(distance)}</span>}
        </div>
        {place.tags.length > 0 && (
          <div className="place-tags">
            {place.tags.map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
        )}
      </div>
      <a
        className="nav-button"
        href={navUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title="Navigate"
      >
        ↗
      </a>
    </div>
  );
}

export default function PlaceList({ scored }: { scored: ScoredPlace[] }) {
  if (scored.length === 0) {
    return (
      <div className="empty-state">
        <p>No places yet. Tap the + button and click the map to add one.</p>
      </div>
    );
  }

  return (
    <div className="place-list">
      {scored.map((s) => (
        <PlaceCard key={s.place.id} scored={s} />
      ))}
    </div>
  );
}
