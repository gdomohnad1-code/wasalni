import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Options = {
  enabled: boolean;
  presence: "available" | "busy" | "offline";
  rideId?: string | null;
  /** Base interval (ms) when moving on a healthy battery. Default 8000. */
  intervalMs?: number;
};

type Coords = {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  ts: number;
};

const STATIONARY_SPEED_MS = 0.6;       // ~2 km/h
const STATIONARY_DISTANCE_M = 15;      // movement threshold to reset stationary
const STATIONARY_AFTER_MS = 60_000;    // after 1 min still → "stopped"
const BATTERY_LOW = 0.2;               // 20%
const BATTERY_CRITICAL = 0.1;          // 10%

function distMeters(a: Coords, b: Coords) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Broadcasts the driver's GPS location to driver_locations.
 * Background-friendly: keeps watchPosition alive while tab is alive,
 * requests Wake Lock to reduce sleep, throttles updates when stationary,
 * and surfaces battery warnings.
 */
export function useDriverLocationBroadcast({ enabled, presence, rideId, intervalMs = 8000 }: Options) {
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const lastCoordsRef = useRef<Coords | null>(null);
  const lastMovedAtRef = useRef<number>(Date.now());
  const presenceRef = useRef(presence);
  const rideRef = useRef(rideId ?? null);
  const wakeLockRef = useRef<any>(null);
  const batteryRef = useRef<{ level: number; charging: boolean } | null>(null);
  const lowBatteryNotifiedRef = useRef(false);
  const criticalBatteryNotifiedRef = useRef(false);

  useEffect(() => { presenceRef.current = presence; }, [presence]);
  useEffect(() => { rideRef.current = rideId ?? null; }, [rideId]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;
    let ticker: number | null = null;
    let visibilityHandler: (() => void) | null = null;

    const send = async (forcePresence?: "offline") => {
      const c = lastCoordsRef.current;
      if (!c) return;
      const { error } = await (supabase.rpc as any)("update_driver_location", {
        p_lat: c.lat,
        p_lng: c.lng,
        p_heading: c.heading,
        p_speed: c.speed,
        p_accuracy: c.accuracy,
        p_presence: forcePresence ?? presenceRef.current,
        p_ride_id: rideRef.current,
      });
      if (!error) lastSentRef.current = Date.now();
    };

    const computeInterval = () => {
      const base = intervalMs;
      const idleMs = Date.now() - lastMovedAtRef.current;
      const stationary = idleMs > STATIONARY_AFTER_MS;
      const lvl = batteryRef.current?.level ?? 1;
      const charging = batteryRef.current?.charging ?? true;

      let mult = 1;
      if (stationary) mult *= 4;                            // 4x slower when stopped
      if (!charging && lvl <= BATTERY_LOW) mult *= 2;       // 2x slower on low batt
      if (!charging && lvl <= BATTERY_CRITICAL) mult *= 2;  // 4x total when critical
      if (typeof document !== "undefined" && document.hidden && rideRef.current == null) mult *= 2;
      return base * mult;
    };

    if (!enabled) {
      if (lastCoordsRef.current) void send("offline");
      return;
    }

    // ---- Wake Lock (helps keep updates flowing when screen would otherwise sleep) ----
    const requestWakeLock = async () => {
      try {
        const anyNav: any = navigator;
        if (anyNav.wakeLock?.request) {
          wakeLockRef.current = await anyNav.wakeLock.request("screen");
        }
      } catch { /* ignore */ }
    };
    void requestWakeLock();

    visibilityHandler = () => {
      if (document.visibilityState === "visible" && !wakeLockRef.current) {
        void requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    // ---- Battery monitoring ----
    const setupBattery = async () => {
      try {
        const anyNav: any = navigator;
        if (!anyNav.getBattery) return;
        const bat = await anyNav.getBattery();
        const update = () => {
          batteryRef.current = { level: bat.level, charging: bat.charging };
          if (cancelled) return;
          if (!bat.charging && bat.level <= BATTERY_CRITICAL && !criticalBatteryNotifiedRef.current) {
            criticalBatteryNotifiedRef.current = true;
            toast.error("بطارية منخفضة جدًا — قللنا تحديث الموقع للحفاظ على شحن جهازك");
          } else if (!bat.charging && bat.level <= BATTERY_LOW && !lowBatteryNotifiedRef.current) {
            lowBatteryNotifiedRef.current = true;
            toast.warning("بطارية منخفضة — تم تقليل تحديث الموقع تلقائيًا");
          }
          if (bat.charging || bat.level > BATTERY_LOW) {
            lowBatteryNotifiedRef.current = false;
            criticalBatteryNotifiedRef.current = false;
          }
        };
        update();
        bat.addEventListener("levelchange", update);
        bat.addEventListener("chargingchange", update);
      } catch { /* ignore */ }
    };
    void setupBattery();

    // ---- Geolocation watch ----
    const onPos = (pos: GeolocationPosition) => {
      const next: Coords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: pos.coords.heading ?? null,
        speed: pos.coords.speed ?? null,
        accuracy: pos.coords.accuracy ?? null,
        ts: Date.now(),
      };
      const prev = lastCoordsRef.current;
      const moved =
        !prev ||
        distMeters(prev, next) > STATIONARY_DISTANCE_M ||
        (next.speed != null && next.speed > STATIONARY_SPEED_MS);
      if (moved) lastMovedAtRef.current = Date.now();
      lastCoordsRef.current = next;
      if (Date.now() - lastSentRef.current >= computeInterval()) void send();
    };
    const onErr = (e: GeolocationPositionError) => console.warn("geo:", e.message);

    watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 15000,
    });

    // Periodic flush — re-evaluates interval each tick (handles stationary/battery changes)
    ticker = window.setInterval(() => {
      if (!lastCoordsRef.current) return;
      if (Date.now() - lastSentRef.current >= computeInterval()) void send();
    }, Math.max(2000, Math.floor(intervalMs / 2)));

    return () => {
      cancelled = true;
      if (ticker) clearInterval(ticker);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (visibilityHandler) document.removeEventListener("visibilitychange", visibilityHandler);
      try { wakeLockRef.current?.release?.(); } catch { /* ignore */ }
      wakeLockRef.current = null;
      if (lastCoordsRef.current) void send("offline");
    };
  }, [enabled, intervalMs]);
}

/** Trigger SOS for current driver. */
export async function triggerSOS(message?: string) {
  let lat: number | null = null;
  let lng: number | null = null;
  try {
    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 }),
    );
    lat = pos.coords.latitude; lng = pos.coords.longitude;
  } catch { /* ignore */ }
  return (supabase.rpc as any)("trigger_driver_sos", { p_message: message ?? "حالة طوارئ", p_lat: lat, p_lng: lng });
}

/** Reactive battery state hook — useful for UI badges in the driver dashboard. */
export function useBatteryStatus() {
  const [state, setState] = useState<{ level: number; charging: boolean } | null>(null);
  useEffect(() => {
    let bat: any = null;
    let cancelled = false;
    const update = () => { if (!cancelled && bat) setState({ level: bat.level, charging: bat.charging }); };
    (async () => {
      try {
        const anyNav: any = navigator;
        if (!anyNav.getBattery) return;
        bat = await anyNav.getBattery();
        update();
        bat.addEventListener("levelchange", update);
        bat.addEventListener("chargingchange", update);
      } catch { /* ignore */ }
    })();
    return () => {
      cancelled = true;
      try {
        bat?.removeEventListener("levelchange", update);
        bat?.removeEventListener("chargingchange", update);
      } catch { /* ignore */ }
    };
  }, []);
  return state;
}
