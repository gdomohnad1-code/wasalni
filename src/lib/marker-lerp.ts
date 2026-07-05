import type L from "leaflet";

export type LL = { lat: number; lng: number };

export interface MarkerAnimState {
  raf?: number;
  from?: LL;
}

/**
 * Smoothly animate a Leaflet marker from its current position to `to`
 * using ease-out interpolation over `duration` ms. Cancels any prior tween.
 */
export function animateMarkerTo(
  marker: L.Marker,
  to: LL,
  state: MarkerAnimState,
  duration = 1500,
) {
  const current = state.from ?? (marker.getLatLng() as unknown as LL);
  // Snap if very small delta (< 0.3m) to avoid jitter
  const dLat = to.lat - current.lat;
  const dLng = to.lng - current.lng;
  if (Math.abs(dLat) < 1e-6 && Math.abs(dLng) < 1e-6) {
    marker.setLatLng([to.lat, to.lng]);
    state.from = to;
    return;
  }
  if (state.raf) cancelAnimationFrame(state.raf);
  const start = performance.now();
  const from = current;
  const step = (t: number) => {
    const k = Math.min(1, (t - start) / duration);
    // ease-out cubic
    const e = 1 - Math.pow(1 - k, 3);
    const lat = from.lat + (to.lat - from.lat) * e;
    const lng = from.lng + (to.lng - from.lng) * e;
    marker.setLatLng([lat, lng]);
    if (k < 1) {
      state.raf = requestAnimationFrame(step);
    } else {
      state.from = to;
      state.raf = undefined;
    }
  };
  state.raf = requestAnimationFrame(step);
}

export function cancelMarkerAnim(state: MarkerAnimState) {
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = undefined;
}
