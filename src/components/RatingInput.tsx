import { useStore } from '../store';

interface Props {
  value: number;
  onChange: (v: number) => void;
}

export default function RatingInput({ value, onChange }: Props) {
  const favMode = useStore((s) => s.favMode);

  if (favMode) {
    return (
      <button
        type="button"
        className={`fav-toggle ${value >= 5 ? 'is-fav' : ''}`}
        onClick={() => onChange(value >= 5 ? 1 : 5)}
      >
        {value >= 5 ? '❤️ Fav' : '♡ Fav'}
      </button>
    );
  }

  return (
    <div className="rating-input">
      {[1, 2, 3, 4, 5].map((v) => (
        <button
          key={v}
          type="button"
          className={`star-btn ${v <= value ? 'filled' : ''}`}
          onClick={() => onChange(v)}
        >
          ★
        </button>
      ))}
    </div>
  );
}
