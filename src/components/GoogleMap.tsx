import { useEffect, useRef, useState } from "react";

/**
 * Minimalist Google Map component — declarative wrapper.
 * - Loads Maps JS SDK asynchronously via the shared browser key
 * - Applies a custom stripped-down JSON style (no POIs, muted colors)
 * - Renders pickup / destination markers + a bold polyline between them
 * - Renders an optional driver marker (car icon)
 */

declare global {
  interface Window {
    __wasalny_maps_ready?: Promise<void>;
    __wasalny_maps_init?: () => void;
  }
}


export type LatLng = { lat: number; lng: number };

interface Props {
  pickup?: LatLng | null;
  destination?: LatLng | null;
  driver?: LatLng | null;
  className?: string;
  /** center + zoom fallback when neither pickup nor destination is set */
  fallback?: { center: LatLng; zoom: number };
  interactive?: boolean;
  showControls?: boolean;
}

// Minimalist Uber-style map — stripped POIs, muted grays, subtle water
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#f5f7fa" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f7fa" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7d8794" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#e7ecf3" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c6dcf0" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#8ea8c3" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#eef1f5" }] },
];

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as
  | string
  | undefined;
const TRACKING_ID = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as
  | string
  | undefined;

function loadMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__wasalny_maps_ready) return window.__wasalny_maps_ready;
  if (!BROWSER_KEY) return Promise.reject(new Error("Missing Google Maps browser key"));

  window.__wasalny_maps_ready = new Promise<void>((resolve) => {
    window.__wasalny_maps_init = () => resolve();
    const s = document.createElement("script");
    const channel = TRACKING_ID ? `&channel=${encodeURIComponent(TRACKING_ID)}` : "";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${BROWSER_KEY}&loading=async&callback=__wasalny_maps_init${channel}`;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  });
  return window.__wasalny_maps_ready;
}

const CAIRO = { lat: 30.0444, lng: 31.2357 };

// SVG car icon for driver marker
const CAR_ICON =
  "M18 5a2 2 0 011.9 1.4l1.8 5.3H2.3l1.8-5.3A2 2 0 016 5h12zm3 8v4a1 1 0 01-1 1h-1a1 1 0 01-1-1v-1H6v1a1 1 0 01-1 1H4a1 1 0 01-1-1v-4l1-2h16l1 2zM7 15a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm10 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z";

export function GoogleMap({
  pickup,
  destination,
  driver,
  className,
  fallback = { center: CAIRO, zoom: 13 },
  interactive = true,
  showControls = false,
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pickupMarker = useRef<google.maps.Marker | null>(null);
  const destMarker = useRef<google.maps.Marker | null>(null);
  const driverMarker = useRef<google.maps.Marker | null>(null);
  const polyline = useRef<google.maps.Polyline | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadMaps()
      .then(() => {
        if (cancelled || !el.current || !window.google) return;
        mapRef.current = new window.google.maps.Map(el.current, {
          center: pickup ?? fallback.center,
          zoom: fallback.zoom,
          styles: MAP_STYLE,
          disableDefaultUI: !showControls,
          gestureHandling: interactive ? "greedy" : "none",
          clickableIcons: false,
          backgroundColor: "#f5f7fa",
        });
        setReady(true);
      })
      .catch((e) => setError(e.message ?? "Map failed to load"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update pickup marker
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google) return;
    if (pickup) {
      if (!pickupMarker.current) {
        pickupMarker.current = new window.google.maps.Marker({
          map: mapRef.current,
          position: pickup,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#0A192F",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
          },
          zIndex: 3,
        });
      } else {
        pickupMarker.current.setPosition(pickup);
      }
    } else {
      pickupMarker.current?.setMap(null);
      pickupMarker.current = null;
    }
  }, [pickup, ready]);

  // Update destination marker
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google) return;
    if (destination) {
      if (!destMarker.current) {
        destMarker.current = new window.google.maps.Marker({
          map: mapRef.current,
          position: destination,
          icon: {
            path: "M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z",
            fillColor: "#10B981",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 1.6,
            anchor: new window.google.maps.Point(12, 22),
          },
          zIndex: 3,
        });
      } else {
        destMarker.current.setPosition(destination);
      }
    } else {
      destMarker.current?.setMap(null);
      destMarker.current = null;
    }
  }, [destination, ready]);

  // Polyline between pickup & destination + auto-fit bounds
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google) return;
    polyline.current?.setMap(null);
    polyline.current = null;
    if (pickup && destination) {
      polyline.current = new window.google.maps.Polyline({
        map: mapRef.current,
        path: [pickup, destination],
        geodesic: true,
        strokeColor: "#0A192F",
        strokeOpacity: 1,
        strokeWeight: 5,
      });
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(destination);
      mapRef.current.fitBounds(bounds, { top: 80, bottom: 320, left: 40, right: 40 });
    } else if (pickup) {
      mapRef.current.panTo(pickup);
      mapRef.current.setZoom(15);
    }
  }, [pickup, destination, ready]);

  // Driver marker (car icon)
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google) return;
    if (driver) {
      if (!driverMarker.current) {
        driverMarker.current = new window.google.maps.Marker({
          map: mapRef.current,
          position: driver,
          icon: {
            path: CAR_ICON,
            fillColor: "#0A192F",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 1.5,
            scale: 1.2,
            anchor: new window.google.maps.Point(12, 12),
          },
          zIndex: 5,
        });
      } else {
        driverMarker.current.setPosition(driver);
      }
    } else {
      driverMarker.current?.setMap(null);
      driverMarker.current = null;
    }
  }, [driver, ready]);

  if (error) {
    return (
      <div className={"grid place-items-center bg-muted text-muted-foreground text-sm " + (className ?? "")}>
        تعذّر تحميل الخريطة
      </div>
    );
  }
  if (!BROWSER_KEY) {
    return (
      <div className={"grid place-items-center bg-muted text-muted-foreground text-sm " + (className ?? "")}>
        الخريطة غير مهيّأة
      </div>
    );
  }
  return (
    <div className={"relative overflow-hidden bg-muted " + (className ?? "")}>
      <div ref={el} className="absolute inset-0 map-fade-in" />
      {!ready && <div className="absolute inset-0 shimmer" />}
    </div>
  );
}
