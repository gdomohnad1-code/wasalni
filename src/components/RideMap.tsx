import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { animateMarkerTo, cancelMarkerAnim, type MarkerAnimState } from "@/lib/marker-lerp";

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export type LL = { lat: number; lng: number };

type Phase = "searching" | "accepted" | "in_progress" | "completed";

type Props = {
  pickup: LL;
  destination: LL;
  driverId?: string | null;
  phase: Phase;
  acceptedAt?: string | null;   // ISO
  startedAt?: string | null;    // ISO
  durationMin?: number;
  onEta?: (etaSec: number) => void;
  className?: string;
};

const dot = (color: string, size = 16, ring = 6) =>
  L.divIcon({
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:9999px;border:3px solid #fff;box-shadow:0 0 0 ${ring}px ${color}33;"></div>`,
    className: "",
    iconSize: [size + ring * 2, size + ring * 2],
    iconAnchor: [(size + ring * 2) / 2, (size + ring * 2) / 2],
  });

const carIcon = L.divIcon({
  html: `<div style="background:#000;color:#fff;width:38px;height:38px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.35);">🚗</div>`,
  className: "",
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

function haversineKm(a: LL, b: LL) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Walk distance along [..LL..] and return point at `targetKm`
function pointAt(path: LL[], targetKm: number): { p: LL; remainingKm: number } {
  if (path.length < 2) return { p: path[0], remainingKm: 0 };
  let acc = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = haversineKm(path[i - 1], path[i]);
    if (acc + seg >= targetKm) {
      const t = (targetKm - acc) / seg;
      return {
        p: {
          lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t,
          lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t,
        },
        remainingKm: totalKm(path) - targetKm,
      };
    }
    acc += seg;
  }
  return { p: path[path.length - 1], remainingKm: 0 };
}

function totalKm(path: LL[]) {
  let s = 0;
  for (let i = 1; i < path.length; i++) s += haversineKm(path[i - 1], path[i]);
  return s;
}

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

export function RideMap({
  pickup, destination, driverId, phase, acceptedAt, startedAt, durationMin = 15, onEta, className,
}: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{
    pickup?: L.Marker; dest?: L.Marker; car?: L.Marker;
    routeMain?: L.Polyline; routeApproach?: L.Polyline;
  }>({});

  const [tripPath, setTripPath] = useState<LL[]>([]);
  const [approachPath, setApproachPath] = useState<LL[]>([]);
  const [realDriver, setRealDriver] = useState<LL | null>(null);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">(
    () => (typeof window !== "undefined" && (localStorage.getItem("map_style") as any)) || "streets"
  );
  const baseLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);

  // Init map
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { zoomControl: false, attributionControl: false })
      .setView([pickup.lat, pickup.lng], 13);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; layersRef.current = {}; baseLayerRef.current = null; labelsLayerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply / switch tile layers based on selected style
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    if (baseLayerRef.current) { map.removeLayer(baseLayerRef.current); baseLayerRef.current = null; }
    if (labelsLayerRef.current) { map.removeLayer(labelsLayerRef.current); labelsLayerRef.current = null; }

    if (mapStyle === "satellite") {
      baseLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, attribution: "Esri" }
      ).addTo(map);
      labelsLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19, opacity: 0.9 }
      ).addTo(map);
    } else {
      baseLayerRef.current = L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19, attribution: "© OpenStreetMap" }
      ).addTo(map);
    }
    try { localStorage.setItem("map_style", mapStyle); } catch {}
  }, [mapStyle]);

  // Fetch trip route pickup -> destination
  useEffect(() => {
    let cancel = false;
    osrmRoute(pickup, destination).then((p) => {
      if (cancel) return;
      setTripPath(p && p.length > 1 ? p : [pickup, destination]);
    });
    return () => { cancel = true; };
  }, [pickup.lat, pickup.lng, destination.lat, destination.lng]);

  // Subscribe to driver location updates
  useEffect(() => {
    if (!driverId) { setRealDriver(null); return; }
    let cancel = false;
    supabase.from("driver_locations").select("lat,lng").eq("driver_id", driverId).maybeSingle()
      .then(({ data }) => { if (!cancel && data) setRealDriver({ lat: data.lat, lng: data.lng }); });
    const ch = supabase.channel(`drv-${driverId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}`,
      }, (p: any) => {
        const n = p.new;
        if (n?.lat && n?.lng) setRealDriver({ lat: n.lat, lng: n.lng });
      }).subscribe();
    return () => { cancel = true; supabase.removeChannel(ch); };
  }, [driverId]);

  // Pick a simulated driver origin (offset 1.5–3km from pickup) once we know phase=accepted
  const simStart = useMemo<LL | null>(() => {
    if (phase !== "accepted" && phase !== "in_progress" && phase !== "completed") return null;
    // Stable seed-ish offset
    const ang = ((pickup.lat + pickup.lng) * 1000) % (2 * Math.PI);
    const km = 2.2;
    const dLat = (km / 111) * Math.cos(ang);
    const dLng = (km / (111 * Math.cos((pickup.lat * Math.PI) / 180))) * Math.sin(ang);
    return { lat: pickup.lat + dLat, lng: pickup.lng + dLng };
  }, [phase, pickup.lat, pickup.lng]);

  // Approach route: simStart -> pickup
  useEffect(() => {
    if (!simStart) { setApproachPath([]); return; }
    let cancel = false;
    osrmRoute(simStart, pickup).then((p) => {
      if (cancel) return;
      setApproachPath(p && p.length > 1 ? p : [simStart, pickup]);
    });
    return () => { cancel = true; };
  }, [simStart, pickup.lat, pickup.lng]);

  // Compute simulated driver position based on elapsed time + phase
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1500);
    return () => clearInterval(i);
  }, []);

  const driverPos: LL | null = useMemo(() => {
    if (realDriver) return realDriver;
    if (!simStart) return null;
    const SPEED_KMH = 40;
    if (phase === "accepted" && acceptedAt && approachPath.length > 1) {
      const elapsedH = Math.max(0, (now - new Date(acceptedAt).getTime()) / 3600_000);
      const traveled = Math.min(totalKm(approachPath), elapsedH * SPEED_KMH);
      return pointAt(approachPath, traveled).p;
    }
    if (phase === "in_progress" && startedAt && tripPath.length > 1) {
      const elapsedH = Math.max(0, (now - new Date(startedAt).getTime()) / 3600_000);
      const traveled = Math.min(totalKm(tripPath), elapsedH * SPEED_KMH);
      return pointAt(tripPath, traveled).p;
    }
    if (phase === "completed") return destination;
    return simStart;
  }, [realDriver, simStart, phase, acceptedAt, startedAt, approachPath, tripPath, now, destination]);

  // Compute ETA
  useEffect(() => {
    if (!onEta) return;
    const SPEED_KMH = 35;
    let remKm = 0;
    if (phase === "accepted" && driverPos && approachPath.length > 1) {
      // remaining distance from current pos to pickup along approachPath
      const total = totalKm(approachPath);
      const traveled = total - haversineKm(driverPos, pickup);
      remKm = Math.max(0, total - Math.max(0, traveled));
      // simpler: straight-line for stability
      remKm = haversineKm(driverPos, pickup);
    } else if (phase === "in_progress" && driverPos && tripPath.length > 1) {
      remKm = haversineKm(driverPos, destination);
    } else if (phase === "searching") {
      onEta(0); return;
    } else { onEta(0); return; }
    onEta(Math.max(30, Math.round((remKm / SPEED_KMH) * 3600)));
  }, [driverPos, phase, approachPath, tripPath, pickup, destination, onEta]);

  // Render markers + polylines
  useEffect(() => {
    const map = mapRef.current; if (!map) return;
    const L_ = layersRef.current;

    if (!L_.pickup) L_.pickup = L.marker([pickup.lat, pickup.lng], { icon: dot("#16a34a") }).addTo(map);
    else L_.pickup.setLatLng([pickup.lat, pickup.lng]);

    if (!L_.dest) L_.dest = L.marker([destination.lat, destination.lng], { icon: dot("#ef4444") }).addTo(map);
    else L_.dest.setLatLng([destination.lat, destination.lng]);

    // Trip route polyline
    if (L_.routeMain) { map.removeLayer(L_.routeMain); L_.routeMain = undefined; }
    if (tripPath.length > 1) {
      L_.routeMain = L.polyline(tripPath.map((p) => [p.lat, p.lng] as [number, number]), {
        color: phase === "in_progress" ? "#000" : "#94a3b8",
        weight: 5, opacity: 0.9, lineCap: "round",
      }).addTo(map);
    }

    // Approach polyline (driver -> pickup)
    if (L_.routeApproach) { map.removeLayer(L_.routeApproach); L_.routeApproach = undefined; }
    if (phase === "accepted" && approachPath.length > 1) {
      L_.routeApproach = L.polyline(approachPath.map((p) => [p.lat, p.lng] as [number, number]), {
        color: "#000", weight: 5, opacity: 0.9, dashArray: "2 8", lineCap: "round",
      }).addTo(map);
    }

    // Car
    if (driverPos) {
      if (!L_.car) L_.car = L.marker([driverPos.lat, driverPos.lng], { icon: carIcon, zIndexOffset: 1000 }).addTo(map);
      else L_.car.setLatLng([driverPos.lat, driverPos.lng]);
    } else if (L_.car) {
      map.removeLayer(L_.car); L_.car = undefined;
    }

    // Fit bounds
    const pts: [number, number][] = [
      [pickup.lat, pickup.lng], [destination.lat, destination.lng],
    ];
    if (driverPos) pts.push([driverPos.lat, driverPos.lng]);
    const bounds = L.latLngBounds(pts);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: true });
  }, [tripPath, approachPath, driverPos, phase, pickup.lat, pickup.lng, destination.lat, destination.lng]);

  return <div ref={elRef} className={className ?? "w-full h-full rounded-2xl overflow-hidden"} />;
}
