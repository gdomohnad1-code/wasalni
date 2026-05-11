import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type LL = { lat: number; lng: number };

const dot = (color: string) =>
  L.divIcon({
    html: `<div style="background:${color};width:16px;height:16px;border-radius:9999px;border:3px solid #fff;box-shadow:0 0 0 6px ${color}33;"></div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

async function osrmRoute(a: LL, b: LL): Promise<LL[] | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const coords: [number, number][] = j?.routes?.[0]?.geometry?.coordinates ?? [];
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return null;
  }
}

export function BookMap({
  pickup,
  destination,
  className,
}: {
  pickup: LL | null;
  destination: LL | null;
  className?: string;
}) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layers = useRef<{ pickup?: L.Marker; dest?: L.Marker; route?: L.Polyline }>({});

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const center: [number, number] = pickup
      ? [pickup.lat, pickup.lng]
      : [30.0444, 31.2357];
    const map = L.map(elRef.current, { zoomControl: false, attributionControl: false }).setView(center, 13);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layers.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const L_ = layers.current;

    if (pickup) {
      if (!L_.pickup) L_.pickup = L.marker([pickup.lat, pickup.lng], { icon: dot("#16a34a") }).addTo(map);
      else L_.pickup.setLatLng([pickup.lat, pickup.lng]);
    } else if (L_.pickup) {
      map.removeLayer(L_.pickup);
      L_.pickup = undefined;
    }

    if (destination) {
      if (!L_.dest) L_.dest = L.marker([destination.lat, destination.lng], { icon: dot("#ef4444") }).addTo(map);
      else L_.dest.setLatLng([destination.lat, destination.lng]);
    } else if (L_.dest) {
      map.removeLayer(L_.dest);
      L_.dest = undefined;
    }

    if (L_.route) {
      map.removeLayer(L_.route);
      L_.route = undefined;
    }

    if (pickup && destination) {
      // Straight line first for instant feedback
      L_.route = L.polyline(
        [
          [pickup.lat, pickup.lng],
          [destination.lat, destination.lng],
        ],
        { color: "#000", weight: 4, opacity: 0.6 }
      ).addTo(map);

      let cancel = false;
      osrmRoute(pickup, destination).then((p) => {
        if (cancel || !p || p.length < 2 || !mapRef.current) return;
        if (L_.route) map.removeLayer(L_.route);
        L_.route = L.polyline(
          p.map((pt) => [pt.lat, pt.lng] as [number, number]),
          { color: "#000", weight: 5, opacity: 0.9, lineCap: "round" }
        ).addTo(map);
      });

      const bounds = L.latLngBounds([
        [pickup.lat, pickup.lng],
        [destination.lat, destination.lng],
      ]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
      return () => {
        cancel = true;
      };
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 14, { animate: true });
    }
  }, [pickup?.lat, pickup?.lng, destination?.lat, destination?.lng]);

  return <div ref={elRef} className={className ?? "w-full h-full rounded-2xl overflow-hidden"} />;
}
