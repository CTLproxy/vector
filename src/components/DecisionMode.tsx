import { useState, useRef, useCallback } from 'react';
import { ScoredPlace } from '../lib/scoring';
import { useStore } from '../store';
import { addPendingVisit } from '../lib/storage';

function RatingBadge({ rating }: { rating: number }) {
  const favMode = useStore((s) => s.favMode);
  if (favMode) return <p className="decision-rating">{rating >= 5 ? '❤️' : '♡'}</p>;
  return (
    <p className="decision-rating">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </p>
  );
}

interface Props {
  candidates: ScoredPlace[];
  onClose: () => void;
}

export default function DecisionMode({ candidates, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [accepted, setAccepted] = useState<ScoredPlace | null>(null);
  const [swipeDir, setSwipeDir] = useState<'left' | 'right' | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const userPosition = useStore((s) => s.userPosition);
  const markVisited = useStore((s) => s.markVisited);
  const markSkipped = useStore((s) => s.markSkipped);

  const current = candidates[currentIndex];

  const handleSwipe = useCallback(
    (direction: 'left' | 'right') => {
      setSwipeDir(direction);
      setTimeout(() => {
        if (direction === 'right') {
          setAccepted(candidates[currentIndex]);
        } else {
          if (currentIndex + 1 < candidates.length) {
            setCurrentIndex((i) => i + 1);
          } else {
            setAccepted(null);
            onClose();
          }
        }
        setSwipeDir(null);
      }, 250);
    },
    [currentIndex, candidates, onClose],
  );

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 60) {
      handleSwipe(dx > 0 ? 'right' : 'left');
    }
  };

  if (accepted) {
    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${accepted.place.lat},${accepted.place.lng}`;
    const handleNavigate = () => {
      addPendingVisit(accepted.place.id, accepted.place.name);
    };
    return (
      <div className="decision-overlay">
        <div className="decision-result">
          <h2>Let's go!</h2>
          <h3>{accepted.place.name}</h3>
          <p className={`place-type type-${accepted.place.type}`}>{accepted.place.type}</p>
          <RatingBadge rating={accepted.place.rating} />
          {userPosition && (
            <p className="place-distance">{accepted.distance.toFixed(1)} km away</p>
          )}
          <div className="decision-actions">
            <a
              className="btn-primary nav-link"
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleNavigate}
            >
              Navigate ↗
            </a>
          </div>
          <div className="decision-actions visited-actions">
            <button className="btn-visited" onClick={() => { markVisited(accepted.place.id); onClose(); }}>
              ✓ Visited
            </button>
            <button className="btn-skipped" onClick={() => { markSkipped(accepted.place.id); onClose(); }}>
              ✕ Skipped
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <div className="decision-overlay">
        <div className="decision-result">
          <h2>No more places</h2>
          <button className="btn-primary" onClick={onClose}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="decision-overlay">
      <div className="decision-header">
        <button className="btn-close" onClick={onClose}>✕</button>
        <span className="decision-progress">
          {currentIndex + 1} / {candidates.length}
        </span>
      </div>

      <div
        ref={cardRef}
        className={`decision-card ${swipeDir ? `swipe-${swipeDir}` : ''}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <h2>{current.place.name}</h2>
        <p className={`place-type type-${current.place.type}`}>{current.place.type}</p>
        <RatingBadge rating={current.place.rating} />
        {userPosition && (
          <p className="decision-distance">{current.distance.toFixed(1)} km</p>
        )}
        {current.place.notes && <p className="decision-notes">{current.place.notes}</p>}
        {current.place.tags.length > 0 && (
          <div className="place-tags">
            {current.place.tags.map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
        )}
      </div>

      <div className="decision-buttons">
        <button className="decision-skip" onClick={() => handleSwipe('left')}>
          ✕ Skip
        </button>
        <button className="decision-accept" onClick={() => handleSwipe('right')}>
          ✓ Go!
        </button>
      </div>
    </div>
  );
}
