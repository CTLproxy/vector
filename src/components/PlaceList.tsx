import { ScoredPlace } from '../lib/scoring';
import { useStore } from '../store';
import { addPendingVisit } from '../lib/storage';

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

function RatingDisplay({ placeId, rating }: { placeId: string; rating: number }) {
  const favMode = useStore((s) => s.favMode);
  const updatePlace = useStore((s) => s.updatePlace);

  const setRating = (v: number) => {
    updatePlace(placeId, { rating: v });
  };

  if (favMode) {
    return (
      <span
        className="place-rating interactive"
        onClick={(e) => { e.stopPropagation(); setRating(rating >= 5 ? 1 : 5); }}
      >
        {rating >= 5 ? '❤️' : '♡'}
      </span>
    );
  }

  return (
    <span className="place-rating interactive" onClick={(e) => e.stopPropagation()}>
      {[1, 2, 3, 4, 5].map((v) => (
        <span
          key={v}
          className={`card-star ${v <= rating ? 'filled' : ''}`}
          onClick={() => setRating(v)}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function PlaceCard({ scored }: { scored: ScoredPlace }) {
  const { place, distance } = scored;
  const setSelectedPlaceId = useStore((s) => s.setSelectedPlaceId);
  const userPosition = useStore((s) => s.userPosition);
  const savedLists = useStore((s) => s.savedLists);

  const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
  const sourceList = place.sourceListId ? savedLists.find((l) => l.id === place.sourceListId) : null;

  return (
    <div className={`place-card ${place.visitedAt ? 'place-card-visited' : ''}`} onClick={() => setSelectedPlaceId(place.id)}>
      <div className="place-card-info">
        <div className="place-card-header">
          <span className="place-name">{place.name}</span>
          <span className={`place-type type-${place.type}`}>{place.type}</span>
          {place.visitedAt && <span className="visited-tag">✓</span>}
          {place.skipped && <span className="skipped-tag">✕</span>}
        </div>
        <div className="place-card-meta">
          <RatingDisplay placeId={place.id} rating={place.rating} />
          {userPosition && <span className="place-distance">{formatDistance(distance)}</span>}
        </div>
        {place.tags.length > 0 && (
          <div className="place-tags">
            {place.tags.map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
            {sourceList && <span className="tag list-tag">📋 {sourceList.name}</span>}
          </div>
        )}
      </div>
      <a
        className="nav-button"
        href={navUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => { e.stopPropagation(); addPendingVisit(place.id, place.name); }}
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
