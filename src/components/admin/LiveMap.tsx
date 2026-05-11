import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

// Fix default marker icons (Vite breaks default paths)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type DriverPin = {
  driver_id: string;
  lat: number;
  lng: number;
  presence: "available" | "busy" | "offline";
  name?: string;
  car_plate?: string;
};

type Geofence = { id: string; name: string; polygon: any; color?: string; active?: boolean };

type Props = {
  drivers: DriverPin[];
  geofences?: Geofence[];
  selectedDriverId?: string | null;
  onSelectDriver?: (id: string) => void;
  routePoints?: Array<[number, number]>; // polyline overlay
  heatPoints?: Array<[number, number, number]>;
  className?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
};

const PRESENCE_COLOR: Record<string, string> = {
  available: "#16a34a",
  busy: "#f59e0b",
  offline: "#6b7280",
};

function pinHtml(color: string, label: string) {
  return `<div style="background:${color};color:#fff;border:2px solid #fff;border-radius:9999px;padding:4px 8px;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,.3);white-space:nowrap;">${label}</div>`;
}

export function LiveMap({
  drivers, geofences = [], selectedDriverId, onSelectDriver,
  routePoints, heatPoints, className,
  initialCenter = [30.0444, 31.2357], initialZoom = 11,
}: Props) {
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylineRef = useRef<L.Polyline | null>(null);
  const heatLayerRef = useRef<any>(null);
  const geofenceLayerRef = useRef<L.LayerGroup | null>(null);

  // init
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, { zoomControl: true }).setView(initialCenter, initialZoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    mapRef.current = map;
    geofenceLayerRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; markersRef.current.clear(); };
  }, []);

  // drivers markers
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const seen = new Set<string>();
    drivers.forEach((d) => {
      seen.add(d.driver_id);
      const color = PRESENCE_COLOR[d.presence] ?? "#6b7280";
      const html = pinHtml(color, d.car_plate || (d.name ?? "سائق"));
      const icon = L.divIcon({ html, className: "driver-pin", iconSize: [60, 24], iconAnchor: [30, 12] });
      const existing = markersRef.current.get(d.driver_id);
      if (existing) {
        existing.setLatLng([d.lat, d.lng]);
        existing.setIcon(icon);
      } else {
        const m = L.marker([d.lat, d.lng], { icon }).addTo(map);
        m.on("click", () => onSelectDriver?.(d.driver_id));
        markersRef.current.set(d.driver_id, m);
      }
    });
    // remove stale
    markersRef.current.forEach((m, id) => {
      if (!seen.has(id)) { map.removeLayer(m); markersRef.current.delete(id); }
    });
  }, [drivers, onSelectDriver]);

  // pan to selected
  useEffect(() => {
    const map = mapRef.current; if (!map || !selectedDriverId) return;
    const d = drivers.find((x) => x.driver_id === selectedDriverId);
    if (d) map.flyTo([d.lat, d.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [selectedDriverId, drivers]);

  // route polyline
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (polylineRef.current) { map.removeLayer(polylineRef.current); polylineRef.current = null; }
    if (routePoints && routePoints.length > 1) {
      polylineRef.current = L.polyline(routePoints, { color: "#3b82f6", weight: 4, opacity: 0.85 }).addTo(map);
    }
  }, [routePoints]);

  // heatmap
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (heatLayerRef.current) { map.removeLayer(heatLayerRef.current); heatLayerRef.current = null; }
    if (heatPoints && heatPoints.length > 0) {
      heatLayerRef.current = (L as any).heatLayer(heatPoints, { radius: 28, blur: 22, maxZoom: 17 }).addTo(map);
    }
  }, [heatPoints]);

  // geofences
  useEffect(() => {
    const layer = geofenceLayerRef.current; if (!layer) return;
    layer.clearLayers();
    geofences.forEach((g) => {
      try {
        const coords = g.polygon?.coordinates?.[0];
        if (!coords) return;
        const latlngs: [number, number][] = coords.map((c: any) => [Number(c[1]), Number(c[0])]);
        const poly = L.polygon(latlngs, {
          color: g.color || "#3b82f6", weight: 2, fillOpacity: 0.12,
          dashArray: g.active === false ? "6 6" : undefined,
        });
        poly.bindTooltip(g.name);
        layer.addLayer(poly);
      } catch { /* ignore bad polygon */ }
    });
  }, [geofences]);

  return <div ref={mapElRef} className={className ?? "w-full h-full min-h-[400px] rounded-xl overflow-hidden"} />;
}
