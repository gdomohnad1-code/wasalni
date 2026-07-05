import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

const HOLD_MS = 3000;

type Props = {
  rideId: string;
  pickup: { lat: number; lng: number };
};

export function SmartSOSButton({ rideId, pickup }: Props) {
  const { t } = useI18n();
  const [progress, setProgress] = useState(0); // 0..1
  const [firing, setFiring] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const myPosRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => { myPosRef.current = { lat: p.coords.latitude, lng: p.coords.longitude }; },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const cancel = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    startRef.current = null;
    setProgress(0);
  };

  const tick = (ts: number) => {
    if (startRef.current === null) startRef.current = ts;
    const p = Math.min(1, (ts - startRef.current) / HOLD_MS);
    setProgress(p);
    if (p >= 1) {
      cancel();
      void fire();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const start = () => {
    if (firing) return;
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    rafRef.current = requestAnimationFrame(tick);
  };

  const fire = async () => {
    setFiring(true);
    const pos = myPosRef.current ?? pickup;
    if (navigator.vibrate) navigator.vibrate([120, 60, 120, 60, 200]);

    // 1) Notify admin via SOS RPC (reuses driver_alerts flow)
    try {
      await supabase.rpc("trigger_driver_sos" as any, {
        p_message: `🚨 SOS رحلة راكب ${rideId.slice(0, 8)}`,
        p_lat: pos.lat,
        p_lng: pos.lng,
      });
    } catch { /* keep going */ }

    // 2) Load emergency contacts + rider name
    let contacts: string[] = [];
    let riderName = "";
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) {
        const { data } = await supabase
          .from("profiles")
          .select("emergency_contacts, full_name")
          .eq("id", u.user.id)
          .maybeSingle();
        contacts = ((data as any)?.emergency_contacts ?? []).filter(Boolean);
        riderName = (data as any)?.full_name ?? "";
      }
    } catch { /* ignore */ }

    // 3) Compose SMS to registered emergency contacts
    const mapLink = `https://www.google.com/maps?q=${pos.lat},${pos.lng}`;
    const rideLink = `${window.location.origin}/ride/${rideId}`;
    const body = t("sos.sms_body")
      .replace("{name}", riderName || t("sos.a_rider"))
      .replace("{map}", mapLink)
      .replace("{ride}", rideLink);

    if (contacts.length > 0) {
      const to = contacts.join(",");
      // sms: scheme with multiple recipients works on iOS/Android
      window.location.href = `sms:${to}?body=${encodeURIComponent(body)}`;
      toast.success(t("sos.sent_contacts").replace("{n}", String(contacts.length)));
    } else {
      toast.warning(t("sos.no_contacts"));
    }

    setTimeout(() => setFiring(false), 800);
  };

  const pct = Math.round(progress * 100);
  const holding = progress > 0 && !firing;

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <button
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={t("sos.title")}
        className="relative w-full h-14 rounded-2xl bg-destructive text-destructive-foreground font-black tracking-tight overflow-hidden select-none active:scale-[0.99] transition-transform shadow-elevated"
      >
        <div
          className="absolute inset-y-0 start-0 bg-destructive-foreground/25 transition-[width] duration-75"
          style={{ width: `${pct}%` }}
        />
        <div className="relative flex items-center justify-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span>{holding ? t("sos.hold_progress").replace("{n}", String(Math.max(1, Math.ceil((1 - progress) * 3)))) : t("sos.hold_hint")}</span>
        </div>
      </button>
      <p className="text-[10.5px] text-muted-foreground">{t("sos.subtitle")}</p>

      <AnimatePresence>
        {firing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-x-4 top-4 z-[10000] mx-auto max-w-md rounded-2xl bg-destructive text-destructive-foreground p-4 shadow-2xl text-center font-bold"
          >
            🚨 {t("sos.fired")}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
