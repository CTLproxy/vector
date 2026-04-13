import { useMemo } from 'react';
import { useStore } from '../store';
import { scorePlaces, ScoredPlace } from '../lib/scoring';

export function useScoredPlaces(): ScoredPlace[] {
  const places = useStore((s) => s.places);
  const userPosition = useStore((s) => s.userPosition);
  const sortMode = useStore((s) => s.sortMode);
  const filter = useStore((s) => s.filter);

  return useMemo(() => {
    let filtered = places;

    if (filter.types.length > 0) {
      filtered = filtered.filter((p) => filter.types.includes(p.type));
    }
    if (filter.tags.length > 0) {
      filtered = filtered.filter((p) =>
        p.tags.some((t) => filter.tags.includes(t)),
      );
    }

    return scorePlaces(filtered, userPosition, sortMode);
  }, [places, userPosition, sortMode, filter]);
}
