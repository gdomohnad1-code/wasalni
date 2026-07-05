import type L from "leaflet";

export type LL = { lat: number; lng: number };

export interface MarkerAnimState {
  raf?: number;
  from?: LL;
  heading?: number;
}

/** Bearing (0..360) from `a` to `b` in degrees, 0 = north, clockwise. */
export function computeHeading(a: LL, b: LL): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Rotate the inner element of a Leaflet divIcon marker (expects a child `.rot`). */
export function rotateMarker(marker: L.Marker, heading: number) {
  const el = (marker as any).getElement?.() as HTMLElement | null;
  if (!el) return;
  const rot = el.querySelector(".rot") as HTMLElement | null;
  if (rot) rot.style.transform = `rotate(${heading}deg)`;
}

/**
 * Smoothly animate a Leaflet marker from its current position to `to`
 * using ease-out interpolation over `duration` ms. Cancels any prior tween.
 * If the marker has a `.rot` child element, rotates it toward the travel bearing.
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
  // Update heading toward the new destination (only if segment is meaningful ~1m+)
  const meaningful = Math.hypot(dLat, dLng) > 1e-5;
  if (meaningful) {
    const targetHeading = computeHeading(current, to);
    // Smooth heading: pick shortest rotation direction
    const prev = state.heading ?? targetHeading;
    let delta = ((targetHeading - prev + 540) % 360) - 180;
    state.heading = prev + delta;
    rotateMarker(marker, state.heading);
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

