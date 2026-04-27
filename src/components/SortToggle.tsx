import { SortMode } from '../types';
import { useStore } from '../store';

const MODES: { value: SortMode; label: string }[] = [
  { value: 'smart', label: '✦ Smart' },
  { value: 'distance', label: '⛖ Distance' },
  { value: 'rating', label: '★ Rating' },
];

export default function SortToggle() {
  const sortMode = useStore((s) => s.sortMode);
  const setSortMode = useStore((s) => s.setSortMode);

  return (
    <div className="sort-toggle">
      {MODES.map((m) => (
        <button
          key={m.value}
          className={`sort-btn ${sortMode === m.value ? 'active' : ''}`}
          onClick={() => setSortMode(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
