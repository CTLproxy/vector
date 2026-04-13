import { useEffect } from 'react';
import { useStore } from '../store';
import { getCurrentPosition } from '../lib/geo';

export function useGeolocation() {
  const setUserPosition = useStore((s) => s.setUserPosition);

  useEffect(() => {
    getCurrentPosition()
      .then(setUserPosition)
      .catch(() => {
        // Geolocation unavailable or denied — user can pick manually
      });
  }, [setUserPosition]);
}
