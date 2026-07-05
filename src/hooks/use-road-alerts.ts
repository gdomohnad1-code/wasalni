import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RoadAlertType = "bump" | "police" | "accident" | "traffic" | "hazard" | "closure";

export interface RoadAlert {
  id: string;
  created_by: string;
  type: RoadAlertType;
  lat: number;
  lng: number;
  note: string | null;
  confirms: number;
  created_at: string;
  expires_at: string;
}

export const ALERT_META: Record<RoadAlertType, { emoji: string; label: string; color: string }> = {
  bump:     { emoji: "⚠️", label: "مطب مفاجئ",       color: "#f59e0b" },
  police:   { emoji: "🚓", label: "لجنة / كمين",     color: "#2563eb" },
  accident: { emoji: "💥", label: "حادثة",           color: "#dc2626" },
  traffic:  { emoji: "🚗", label: "زحمة شديدة",      color: "#ea580c" },
  hazard:   { emoji: "🕳️", label: "حتة مكسرة / خطر", color: "#7c3aed" },
  closure:  { emoji: "🚧", label: "طريق مقفول",      color: "#0f172a" },
};

// Rough km distance
function distKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Live-subscribe to active road alerts near a given center.
 * Filters client-side by radiusKm. Refetches on realtime insert/update/delete.
 */
export function useRoadAlerts(center: { lat: number; lng: number } | null, radiusKm = 15) {
  const [alerts, setAlerts] = useState<RoadAlert[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase
        .from("road_alerts")
        .select("*")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(200);
      if (!mounted) return;
      const list = (data as RoadAlert[] | null) || [];
      setAlerts(center ? list.filter((a) => distKm(center, a) <= radiusKm) : list);
    };

    load();

    const ch = supabase
      .channel("road-alerts-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "road_alerts" },
        () => { void load(); },
      )
      .subscribe();

    // Refresh every 60s to drop expired ones client-side
    const tm = setInterval(load, 60_000);

    return () => {
      mounted = false;
      supabase.removeChannel(ch);
      clearInterval(tm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, radiusKm]);

  return alerts;
}
