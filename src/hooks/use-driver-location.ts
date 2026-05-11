import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Options = {
  enabled: boolean;
  presence: "available" | "busy" | "offline";
  rideId?: string | null;
  intervalMs?: number;
};

/**
 * Broadcasts the driver's GPS location to driver_locations via the update_driver_location RPC.
 * Stops cleanly on unmount or when disabled (sends one final 'offline' ping).
 */
export function useDriverLocationBroadcast({ enabled, presence, rideId, intervalMs = 8000 }: Options) {
  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef<number>(0);
  const lastCoordsRef = useRef<{ lat: number; lng: number; heading: number | null; speed: number | null; accuracy: number | null } | null>(null);
  const presenceRef = useRef(presence);
  const rideRef = useRef(rideId ?? null);

  useEffect(() => { presenceRef.current = presence; }, [presence]);
  useEffect(() => { rideRef.current = rideId ?? null; }, [rideId]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const send = async () => {
      const c = lastCoordsRef.current;
      if (!c) return;
      const { error } = await supabase.rpc("update_driver_location", {
        p_lat: c.lat,
        p_lng: c.lng,
        p_heading: c.heading,
        p_speed: c.speed,
        p_accuracy: c.accuracy,
        p_presence: presenceRef.current,
        p_ride_id: rideRef.current,
      });
      if (!error) lastSentRef.current = Date.now();
    };

    if (!enabled) {
      // Mark offline once, with last known coords if any
      if (lastCoordsRef.current) {
        const c = lastCoordsRef.current;
        supabase.rpc("update_driver_location", {
          p_lat: c.lat, p_lng: c.lng, p_heading: c.heading, p_speed: c.speed,
          p_accuracy: c.accuracy, p_presence: "offline" as any, p_ride_id: null,
        });
      }
      return;
    }

    const onPos = (pos: GeolocationPosition) => {
      lastCoordsRef.current = {
        lat: pos.coords.latitude, lng: pos.coords.longitude,
        heading: pos.coords.heading ?? null, speed: pos.coords.speed ?? null,
        accuracy: pos.coords.accuracy ?? null,
      };
      if (Date.now() - lastSentRef.current >= intervalMs) void send();
    };
    const onErr = (e: GeolocationPositionError) => console.warn("geo:", e.message);

    watchIdRef.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true, maximumAge: 5000, timeout: 15000,
    });

    // also force a periodic flush even if position events stall
    const ticker = setInterval(() => { if (lastCoordsRef.current) void send(); }, intervalMs);

    return () => {
      clearInterval(ticker);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      // best-effort offline ping
      if (lastCoordsRef.current) {
        const c = lastCoordsRef.current;
        supabase.rpc("update_driver_location", {
          p_lat: c.lat, p_lng: c.lng, p_heading: c.heading, p_speed: c.speed,
          p_accuracy: c.accuracy, p_presence: "offline" as any, p_ride_id: null,
        });
      }
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
  return supabase.rpc("trigger_driver_sos", { p_message: message ?? "حالة طوارئ", p_lat: lat, p_lng: lng });
}
