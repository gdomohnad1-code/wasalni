import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Clock, Navigation2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  etaToPickupSec: number;     // كم ثانية للوصول للراكب
  distanceToPickupKm: number; // المسافة للراكب
  rideDistanceKm: number;     // مسافة الرحلة الكاملة
  onAccept: () => void;
  onDismiss: () => void;       // عند الرفض أو انتهاء الوقت
};

const TIMEOUT_SEC = 30;

export function IncomingRideModal({ open, etaToPickupSec, distanceToPickupKm, rideDistanceKm, onAccept, onDismiss }: Props) {
  const [remaining, setRemaining] = useState(TIMEOUT_SEC);

  useEffect(() => {
    if (!open) { setRemaining(TIMEOUT_SEC); return; }
    setRemaining(TIMEOUT_SEC);
    const i = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(i); onDismiss(); return 0; }
        return r - 1;
      });
    }, 1000);

    // High-priority two-tone siren + vibration loop
    let audioCtx: AudioContext | null = null;
    let alarmInt: ReturnType<typeof setInterval> | null = null;
    let vibrateInt: ReturnType<typeof setInterval> | null = null;
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Resume in case browser autoplay policy suspended it
      audioCtx.resume?.().catch(() => {});

      const tone = (freq: number, start: number, dur: number, gain = 0.28) => {
        if (!audioCtx) return;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = "square";
        o.frequency.value = freq;
        // Attack/release envelope to avoid clicks
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(start); o.stop(start + dur + 0.02);
      };

      const playPattern = () => {
        if (!audioCtx) return;
        const t0 = audioCtx.currentTime;
        // Two-tone urgent pattern (like an ambulance / dispatch alarm)
        tone(1100, t0, 0.22);
        tone(760, t0 + 0.26, 0.22);
        tone(1100, t0 + 0.52, 0.22);
        tone(760, t0 + 0.78, 0.22);
      };
      playPattern();
      alarmInt = setInterval(playPattern, 1200);

      // Haptic feedback loop (if supported)
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.([300, 150, 300]);
        vibrateInt = setInterval(() => navigator.vibrate?.([300, 150, 300]), 1200);
      }
    } catch { /* ignore audio errors */ }

    return () => {
      clearInterval(i);
      if (alarmInt) clearInterval(alarmInt);
      if (vibrateInt) clearInterval(vibrateInt);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try { navigator.vibrate?.(0); } catch { /* noop */ }
      }
      audioCtx?.close().catch(() => {});
    };
  }, [open]);

  const pct = (remaining / TIMEOUT_SEC) * 100;
  const etaMin = Math.max(1, Math.ceil(etaToPickupSec / 60));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.8, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            dir="rtl"
          >
            {/* timer bar */}
            <div className="h-2 bg-gray-200 relative">
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: "linear" }}
                className={`h-full ${remaining <= 5 ? "bg-red-500" : "bg-emerald-500"}`}
              />
            </div>

            <div className="p-6 text-center bg-black text-white">
              <p className="text-xs uppercase tracking-widest opacity-70">طلب رحلة جديدة</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <Clock className="h-7 w-7 text-emerald-400" />
                <span className="text-5xl font-black tabular-nums">{etaMin}</span>
                <span className="text-lg font-bold opacity-80">دقيقة</span>
              </div>
              <p className="text-xs opacity-70 mt-1">وقت الوصول إلى الراكب</p>
            </div>

            <div className="p-5 grid grid-cols-2 gap-3 bg-gray-50">
              <Stat icon={<Navigation2 className="h-4 w-4" />} label="للراكب" value={`${distanceToPickupKm.toFixed(1)} كم`} />
              <Stat icon={<MapPin className="h-4 w-4" />} label="مسافة الرحلة" value={`${rideDistanceKm.toFixed(1)} كم`} />
            </div>

            <div className="p-5 pt-2 space-y-2">
              <Button
                onClick={onAccept}
                className="w-full h-14 text-base font-black bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl"
              >
                <Check className="h-5 w-5 ml-2" /> قبول ({remaining}ث)
              </Button>
              <Button
                onClick={onDismiss}
                variant="ghost"
                className="w-full h-10 text-sm text-gray-500 hover:text-red-600"
              >
                <X className="h-4 w-4 ml-1" /> رفض
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-3 text-center shadow-sm">
      <div className="flex items-center justify-center gap-1 text-gray-500 text-[11px]">{icon}{label}</div>
      <div className="font-black text-base mt-0.5">{value}</div>
    </div>
  );
}
