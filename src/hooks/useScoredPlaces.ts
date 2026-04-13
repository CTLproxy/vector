import { useMemo } from 'react';
import { useStore } from '../store';
import { scorePlaces, ScoredPlace, haversineKm } from '../lib/scoring';

export function useScoredPlaces(): ScoredPlace[] {
  const places = useStore((s) => s.places);
  const userPosition = useStore((s) => s.userPosition);
  const mapCenter = useStore((s) => s.mapCenter);
  const followMe = useStore((s) => s.followMe);
  const sortMode = useStore((s) => s.sortMode);
  const filter = useStore((s) => s.filter);
  const favMode = useStore((s) => s.favMode);
  const radiusKm = useStore((s) => s.radiusKm);

  // Radius origin: user position in Follow Me mode, otherwise map center
  const radiusOrigin = followMe ? userPosition : mapCenter;

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

    // Radius filter: exclude places outside the radius from the chosen origin
    if (radiusOrigin && radiusKm > 0) {
      filtered = filtered.filter(
        (p) => haversineKm(radiusOrigin, { lat: p.lat, lng: p.lng }) <= radiusKm,
      );
    }

    // In fav mode, reinterpret ratings: 5 stays 5, everything else becomes 1
    const effective = favMode
      ? filtered.map((p) => (p.rating < 5 ? { ...p, rating: 1 } : p))
      : filtered;

    return scorePlaces(effective, userPosition, sortMode);
  }, [places, userPosition, radiusOrigin, sortMode, filter, favMode, radiusKm]);
}
