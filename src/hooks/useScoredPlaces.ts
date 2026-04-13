import { useMemo } from 'react';
import { useStore } from '../store';
import { scorePlaces, ScoredPlace, haversineKm } from '../lib/scoring';

export function useScoredPlaces(): ScoredPlace[] {
  const places = useStore((s) => s.places);
  const userPosition = useStore((s) => s.userPosition);
  const sortMode = useStore((s) => s.sortMode);
  const filter = useStore((s) => s.filter);
  const favMode = useStore((s) => s.favMode);
  const radiusKm = useStore((s) => s.radiusKm);

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

    // Radius filter: exclude places outside the radius (only when we have a position)
    if (userPosition && radiusKm > 0) {
      filtered = filtered.filter(
        (p) => haversineKm(userPosition, { lat: p.lat, lng: p.lng }) <= radiusKm,
      );
    }

    // In fav mode, reinterpret ratings: 5 stays 5, everything else becomes 1
    const effective = favMode
      ? filtered.map((p) => (p.rating < 5 ? { ...p, rating: 1 } : p))
      : filtered;

    return scorePlaces(effective, userPosition, sortMode);
  }, [places, userPosition, sortMode, filter, favMode, radiusKm]);
}
