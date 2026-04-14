import { useState, useEffect, useRef } from 'react';
import { ScoredPlace } from '../lib/scoring';
import { useStore } from '../store';

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

const ROLL_DURATION = 1800;
const TICK_INITIAL = 60;
const TICK_FINAL = 250;

export default function RollDice({ candidates, onClose }: Props) {
  const [phase, setPhase] = useState<'rolling' | 'result'>('rolling');
  const [displayPlace, setDisplayPlace] = useState<ScoredPlace>(candidates[0]);
  const [winner, setWinner] = useState<ScoredPlace | null>(null);
  const userPosition = useStore((s) => s.userPosition);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const roll = () => {
    // Pick a random winner upfront
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    setWinner(picked);
    setPhase('rolling');

    const startTime = Date.now();
    let lastIdx = -1;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= ROLL_DURATION) {
        setDisplayPlace(picked);
        setPhase('result');
        return;
      }

      // Pick a random place to flash (different from current)
      let idx;
      do {
        idx = Math.floor(Math.random() * candidates.length);
      } while (idx === lastIdx && candidates.length > 1);
      lastIdx = idx;
      setDisplayPlace(candidates[idx]);

      // Slow down the ticking as we approach the end
      const progress = elapsed / ROLL_DURATION;
      const delay = TICK_INITIAL + (TICK_FINAL - TICK_INITIAL) * progress * progress;
      timerRef.current = setTimeout(tick, delay);
    };

    tick();
  };

  useEffect(() => {
    roll();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReroll = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    roll();
  };

  if (phase === 'result' && winner) {
    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${winner.place.lat},${winner.place.lng}`;
    return (
      <div className="decision-overlay">
        <div className="decision-result">
          <h2>🎲 You got:</h2>
          <h3>{winner.place.name}</h3>
          <p className={`place-type type-${winner.place.type}`}>{winner.place.type}</p>
          <RatingBadge rating={winner.place.rating} />
          {userPosition && (
            <p className="place-distance">{winner.distance.toFixed(1)} km away</p>
          )}
          <div className="decision-actions">
            <a className="btn-primary nav-link" href={navUrl} target="_blank" rel="noopener noreferrer">
              Navigate ↗
            </a>
            <button className="btn-secondary" onClick={handleReroll}>
              🎲 Re-roll
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Rolling animation
  return (
    <div className="decision-overlay">
      <div className="decision-header">
        <button className="btn-close" onClick={onClose}>✕</button>
        <span className="decision-progress">Rolling…</span>
      </div>

      <div className="dice-rolling">
        <div className="dice-icon">🎲</div>
        <div className="dice-flash-card">
          <h2>{displayPlace.place.name}</h2>
          <p className={`place-type type-${displayPlace.place.type}`}>{displayPlace.place.type}</p>
        </div>
      </div>
    </div>
  );
}
