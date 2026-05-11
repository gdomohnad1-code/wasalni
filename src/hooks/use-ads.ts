import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdPlacement =
  | "home" | "book" | "waiting_driver" | "driver_app" | "pre_confirm" | "post_ride";

export type Ad = {
  id: string;
  title: string;
  description: string | null;
  type: "banner" | "popup" | "video" | "story" | "notification" | "fullscreen" | "reward";
  placements: AdPlacement[];
  media_type: "image" | "video" | "gif" | "link" | "qr";
  media_url: string | null;
  external_link: string | null;
  qr_data: string | null;
  priority: number;
  max_impressions_per_user: number;
  daily_start_hour: number | null;
  daily_end_hour: number | null;
  is_sponsored: boolean;
  sponsor_name: string | null;
  auto_rotate: boolean;
  target_area_lat: number | null;
  target_area_lng: number | null;
  target_area_radius_m: number | null;
};

function distM(a: number, b: number, c: number, d: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(c - a);
  const dLng = toRad(d - b);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

let userPos: { lat: number; lng: number } | null = null;
function ensurePos(): Promise<{ lat: number; lng: number } | null> {
  if (userPos) return Promise.resolve(userPos);
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { userPos = { lat: p.coords.latitude, lng: p.coords.longitude }; resolve(userPos); },
      () => resolve(null),
      { timeout: 4000, maximumAge: 60000 },
    );
  });
}

const ROTATION_KEY = "ads_rotation_v1";
const SHOWN_KEY = "ads_shown_v1";

function readJSON<T>(k: string, fb: T): T {
  try { return JSON.parse(localStorage.getItem(k) || "") ?? fb; } catch { return fb; }
}
function writeJSON(k: string, v: any) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* noop */ }
}

export function useAds(placement: AdPlacement) {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("ads")
        .select("*")
        .contains("placements", [placement])
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });
      if (error || cancelled || !data) return;

      const now = new Date();
      const hour = now.getHours();
      const shownMap = readJSON<Record<string, number>>(SHOWN_KEY, {});

      const pos = await ensurePos();

      const eligible = (data as Ad[]).filter((a) => {
        if (a.daily_start_hour != null && a.daily_end_hour != null) {
          if (a.daily_start_hour <= a.daily_end_hour) {
            if (hour < a.daily_start_hour || hour > a.daily_end_hour) return false;
          } else {
            if (hour < a.daily_start_hour && hour > a.daily_end_hour) return false;
          }
        }
        if (a.max_impressions_per_user > 0 && (shownMap[a.id] ?? 0) >= a.max_impressions_per_user) return false;
        if (a.target_area_lat != null && a.target_area_lng != null && a.target_area_radius_m) {
          if (!pos) return false;
          if (distM(pos.lat, pos.lng, a.target_area_lat, a.target_area_lng) > a.target_area_radius_m) return false;
        }
        return true;
      });

      if (eligible.length === 0) { setAd(null); return; }

      const rot = readJSON<Record<string, string>>(ROTATION_KEY, {});
      const lastId = rot[placement];
      let next = eligible[0];
      if (eligible.length > 1 && lastId) {
        const idx = eligible.findIndex((e) => e.id === lastId);
        if (idx >= 0) next = eligible[(idx + 1) % eligible.length];
      }
      rot[placement] = next.id;
      writeJSON(ROTATION_KEY, rot);

      shownMap[next.id] = (shownMap[next.id] ?? 0) + 1;
      writeJSON(SHOWN_KEY, shownMap);

      // Log impression (best-effort)
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        supabase.from("ad_events").insert({
          ad_id: next.id, user_id: auth.user.id, event_type: "impression",
          metadata: { placement },
        });
      }

      setAd(next);
    })();
    return () => { cancelled = true; };
  }, [placement]);

  const trackClick = async () => {
    if (!ad) return;
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      await supabase.from("ad_events").insert({
        ad_id: ad.id, user_id: auth.user.id, event_type: "click",
        metadata: { placement },
      });
    }
  };

  return { ad, trackClick };
}
