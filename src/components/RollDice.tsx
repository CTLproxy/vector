import { useState, useEffect, useRef, useMemo } from 'react';
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

type RollMode = 'top-picks' | 'wild-card';

interface Props {
  candidates: ScoredPlace[];
  onClose: () => void;
}

const ROLL_DURATION = 1800;
const TICK_INITIAL = 60;
const TICK_FINAL = 250;

export default function RollDice({ candidates, onClose }: Props) {
  const [rollMode, setRollMode] = useState<RollMode>('top-picks');
  const [phase, setPhase] = useState<'pick' | 'rolling' | 'result'>('pick');
  const [displayPlace, setDisplayPlace] = useState<ScoredPlace>(candidates[0]);
  const [winner, setWinner] = useState<ScoredPlace | null>(null);
  const userPosition = useStore((s) => s.userPosition);
  const favMode = useStore((s) => s.favMode);
  const markVisited = useStore((s) => s.markVisited);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const MIN_RATING = 4;

  const pool = useMemo(() => {
    if (rollMode === 'wild-card') return candidates;
    // Top Picks: only favourites (rating 5 in fav mode) or high-rated (>=4)
    const topPicks = candidates.filter((s) =>
      favMode ? s.place.rating >= 5 : s.place.rating >= MIN_RATING,
    );
    return topPicks.length > 0 ? topPicks : candidates;
  }, [candidates, rollMode, favMode]);

  const roll = () => {
    // Pick a random winner upfront
    const picked = pool[Math.floor(Math.random() * pool.length)];
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
        idx = Math.floor(Math.random() * pool.length);
      } while (idx === lastIdx && pool.length > 1);
      lastIdx = idx;
      setDisplayPlace(pool[idx]);

      // Slow down the ticking as we approach the end
      const progress = elapsed / ROLL_DURATION;
      const delay = TICK_INITIAL + (TICK_FINAL - TICK_INITIAL) * progress * progress;
      timerRef.current = setTimeout(tick, delay);
    };

    tick();
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
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
            <a
              className="btn-primary nav-link"
              href={navUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => addPendingVisit(winner.place.id, winner.place.name)}
            >
              Navigate ↗
            </a>
            <button className="decision-skip" onClick={handleReroll}>
              🎲 Re-roll
            </button>
          </div>
          <div className="decision-actions visited-actions">
            <button className="btn-visited" onClick={() => { markVisited(winner.place.id); onClose(); }}>
              ✓ Visited
            </button>
            <button className="btn-skipped" onClick={() => { onClose(); }}>
              ✕ Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mode picker (before rolling)
  if (phase === 'pick') {
    return (
      <div className="decision-overlay">
        <div className="decision-header">
          <button className="btn-close" onClick={onClose}>✕</button>
          <span className="decision-progress">Pick a mode</span>
        </div>
        <div className="roll-mode-picker">
          <button
            className={`roll-mode-btn ${rollMode === 'top-picks' ? 'active' : ''}`}
            onClick={() => setRollMode('top-picks')}
          >
            <span className="roll-mode-icon">⭐</span>
            <span className="roll-mode-label">Top Picks</span>
            <span className="roll-mode-hint">Favorites & highly rated</span>
          </button>
          <button
            className={`roll-mode-btn ${rollMode === 'wild-card' ? 'active' : ''}`}
            onClick={() => setRollMode('wild-card')}
          >
            <span className="roll-mode-icon">🃏</span>
            <span className="roll-mode-label">Wild Card</span>
            <span className="roll-mode-hint">Anything goes!</span>
          </button>
        </div>
        <p className="roll-pool-count">{pool.length} place{pool.length !== 1 ? 's' : ''} in pool</p>
        <button className="decision-accept roll-go-btn" onClick={roll}>
          🎲 Roll!
        </button>
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
        <div className="decision-card">
          <h2>{displayPlace.place.name}</h2>
          <p className={`place-type type-${displayPlace.place.type}`}>{displayPlace.place.type}</p>
          <RatingBadge rating={displayPlace.place.rating} />
          {userPosition && (
            <p className="decision-distance">{displayPlace.distance.toFixed(1)} km</p>
          )}
          {displayPlace.place.tags.length > 0 && (
            <div className="place-tags">
              {displayPlace.place.tags.map((t) => (
                <span key={t} className="tag">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
