import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { animateMarkerTo, cancelMarkerAnim, type MarkerAnimState } from "@/lib/marker-lerp";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ALERT_META, type RoadAlert } from "@/hooks/use-road-alerts";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type LL = { lat: number; lng: number };

type Props = {
  driver: LL | null;
  heading?: number | null;
  hotspots?: { lat: number; lng: number; weight: number }[];
  roadAlerts?: RoadAlert[];
  pickup?: LL | null;
  destination?: LL | null;
  routeTo?: LL | null; // current navigation target (pickup or destination)
  className?: string;
};

const carIcon = (heading = 0) =>
  L.divIcon({
    html: `<div style="transform: rotate(${heading}deg); transition: transform 0.6s; background:#000; color:#fff; width:42px; height:42px; border-radius:9999px; display:flex; align-items:center; justify-content:center; font-size:22px; border:3px solid #fff; box-shadow:0 6px 16px rgba(0,0,0,.4);">🚗</div>`,
    className: "",
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });

const dot = (color: string) =>
  L.divIcon({
    html: `<div style="background:${color}; width:18px; height:18px; border-radius:9999px; border:3px solid #fff; box-shadow:0 0 0 6px ${color}33;"></div>`,
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });

async function osrmRoute(a: LL, b: LL): Promise<LL[] | null> {
  try {
    const r = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`,
    );
    if (!r.ok) return null;
    const j = await r.json();
    const coords: [number, number][] = j?.routes?.[0]?.geometry?.coordinates ?? [];
    return coords.map(([lng, lat]) => ({ lat, lng }));
  } catch {
    return null;
  }
}

export function DriverLiveMap({
  driver,
  heading,
  hotspots = [],
  pickup,
  destination,
  routeTo,
  className,
}: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layers = useRef<{
    car?: L.Marker;
    pickup?: L.Marker;
    dest?: L.Marker;
    route?: L.Polyline;
    hotspots: L.Circle[];
  }>({ hotspots: [] });
  const carAnim = useRef<MarkerAnimState>({});
  const followRef = useRef(true);

  // init
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const center: [number, number] = driver ? [driver.lat, driver.lng] : [30.0444, 31.2357];
    const map = L.map(elRef.current, { zoomControl: false, attributionControl: false }).setView(center, 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    map.on("dragstart", () => { followRef.current = false; });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; layers.current = { hotspots: [] }; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // car marker + auto-follow (smooth LERP between GPS pings)
  useEffect(() => {
    const map = mapRef.current; if (!map || !driver) return;
    if (!layers.current.car) {
      layers.current.car = L.marker([driver.lat, driver.lng], { icon: carIcon(heading ?? 0), zIndexOffset: 2000 }).addTo(map);
      carAnim.current.from = driver;
    } else {
      animateMarkerTo(layers.current.car, driver, carAnim.current, 1500);
      layers.current.car.setIcon(carIcon(heading ?? 0));
    }
    if (followRef.current) map.setView([driver.lat, driver.lng], Math.max(map.getZoom(), 14), { animate: true });
    return () => { cancelMarkerAnim(carAnim.current); };
  }, [driver?.lat, driver?.lng, heading]);

  // hotspots (red circles)
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    layers.current.hotspots.forEach((c) => map.removeLayer(c));
    layers.current.hotspots = hotspots.map((h) =>
      L.circle([h.lat, h.lng], {
        radius: 400 + h.weight * 200,
        color: "#ef4444",
        fillColor: "#ef4444",
        fillOpacity: Math.min(0.18 + h.weight * 0.05, 0.45),
        weight: 2,
        dashArray: "4 6",
      }).addTo(map),
    );
  }, [JSON.stringify(hotspots)]);

  // pickup / dest markers
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (pickup) {
      if (!layers.current.pickup) layers.current.pickup = L.marker([pickup.lat, pickup.lng], { icon: dot("#16a34a") }).addTo(map);
      else layers.current.pickup.setLatLng([pickup.lat, pickup.lng]);
    } else if (layers.current.pickup) { map.removeLayer(layers.current.pickup); layers.current.pickup = undefined; }

    if (destination) {
      if (!layers.current.dest) layers.current.dest = L.marker([destination.lat, destination.lng], { icon: dot("#ef4444") }).addTo(map);
      else layers.current.dest.setLatLng([destination.lat, destination.lng]);
    } else if (layers.current.dest) { map.removeLayer(layers.current.dest); layers.current.dest = undefined; }
  }, [pickup?.lat, pickup?.lng, destination?.lat, destination?.lng]);

  // route polyline (driver -> routeTo)
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    let cancel = false;
    if (layers.current.route) { map.removeLayer(layers.current.route); layers.current.route = undefined; }
    if (driver && routeTo) {
      osrmRoute(driver, routeTo).then((p) => {
        if (cancel || !p || p.length < 2 || !mapRef.current) return;
        layers.current.route = L.polyline(p.map((q) => [q.lat, q.lng] as [number, number]), {
          color: "#000", weight: 5, opacity: 0.85, lineCap: "round",
        }).addTo(mapRef.current);
        followRef.current = false;
        const bounds = L.latLngBounds([[driver.lat, driver.lng], [routeTo.lat, routeTo.lng]]);
        mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      });
    }
    return () => { cancel = true; };
  }, [routeTo?.lat, routeTo?.lng, !!driver]);

  return <div ref={elRef} className={className ?? "w-full h-full"} />;
}
