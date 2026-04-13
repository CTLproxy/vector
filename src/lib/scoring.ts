import { GeoPosition, Place, SortMode } from '../types';

/**
 * Haversine distance in km between two coordinates.
 */
export function haversineKm(a: GeoPosition, b: GeoPosition): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Smart score: combines rating and distance so that distance does not
 * overpower high-rated places.
 *
 * Formula:
 *   score = (rating / 5) * RATING_WEIGHT + (1 - clamp(dist / MAX_DIST, 0, 1)) * DISTANCE_WEIGHT
 *
 * Higher is better. Deterministic, O(1) per item.
 */
const RATING_WEIGHT = 0.6;
const DISTANCE_WEIGHT = 0.4;
const MAX_DISTANCE_KM = 10; // beyond 10 km distance contribution is 0

export function smartScore(place: Place, userPos: GeoPosition): number {
  const dist = haversineKm(userPos, { lat: place.lat, lng: place.lng });
  const ratingNorm = place.rating / 5;
  const distNorm = 1 - Math.min(dist / MAX_DISTANCE_KM, 1);
  return ratingNorm * RATING_WEIGHT + distNorm * DISTANCE_WEIGHT;
}

export interface ScoredPlace {
  place: Place;
  distance: number;
  score: number;
}

export function scorePlaces(
  places: Place[],
  userPos: GeoPosition | null,
  sortMode: SortMode,
): ScoredPlace[] {
  const scored: ScoredPlace[] = places.map((place) => {
    const distance = userPos
      ? haversineKm(userPos, { lat: place.lat, lng: place.lng })
      : 0;
    const score = userPos ? smartScore(place, userPos) : place.rating / 5;
    return { place, distance, score };
  });

  switch (sortMode) {
    case 'distance':
      scored.sort((a, b) => a.distance - b.distance);
      break;
    case 'rating':
      scored.sort((a, b) => b.place.rating - a.place.rating);
      break;
    case 'smart':
    default:
      scored.sort((a, b) => b.score - a.score);
      break;
  }

  return scored;
}
