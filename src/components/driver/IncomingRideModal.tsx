import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Clock, Navigation2, X, Check, Flag, Car, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  etaToPickupSec: number;
  distanceToPickupKm: number;
  rideDistanceKm: number;
  pickupAddress?: string;
  dropoffAddress?: string;
  /** Gross fare in EGP — driver keeps 80% (net earning shown to driver) */
  fare?: number;
  vehicleType?: string;
  onAccept: () => void;
  onDismiss: () => void;
};

const TIMEOUT_SEC = 30;
const DRIVER_SHARE = 0.8;

export function IncomingRideModal({
  open,
  etaToPickupSec,
  distanceToPickupKm,
  rideDistanceKm,
  pickupAddress,
  dropoffAddress,
  fare,
  vehicleType,
  onAccept,
  onDismiss,
}: Props) {
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
      audioCtx.resume?.().catch(() => {});
      const tone = (freq: number, start: number, dur: number, gain = 0.28) => {
        if (!audioCtx) return;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = "square";
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(gain, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(start); o.stop(start + dur + 0.02);
      };
      const playPattern = () => {
        if (!audioCtx) return;
        const t0 = audioCtx.currentTime;
        tone(1100, t0, 0.22);
        tone(760, t0 + 0.26, 0.22);
        tone(1100, t0 + 0.52, 0.22);
        tone(760, t0 + 0.78, 0.22);
      };
      playPattern();
      alarmInt = setInterval(playPattern, 1200);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.([300, 150, 300]);
        vibrateInt = setInterval(() => navigator.vibrate?.([300, 150, 300]), 1200);
      }
    } catch { /* ignore */ }

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
  const tripMin = rideDistanceKm > 0 ? Math.max(1, Math.ceil((rideDistanceKm / 35) * 60)) : 0;
  const netEarning = fare && fare > 0 ? Math.round(fare * DRIVER_SHARE) : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
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

            {/* Header — Deep Navy */}
            <div className="p-5 text-center text-white" style={{ background: "linear-gradient(135deg, #0A192F 0%, #112D4E 100%)" }}>
              <p className="text-[11px] uppercase tracking-widest opacity-70">طلب رحلة جديدة</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <Clock className="h-6 w-6 text-emerald-400" />
                <span className="text-4xl font-black tabular-nums">{etaMin}</span>
                <span className="text-base font-bold opacity-80">دقيقة للراكب</span>
              </div>
              {vehicleType && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] bg-white/10 border border-white/15 rounded-full px-3 py-1">
                  <Car className="h-3.5 w-3.5" /> {vehicleType}
                </div>
              )}
            </div>

            {/* Net earning highlight — Emerald */}
            {netEarning > 0 && (
              <div className="px-5 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800">
                  <Wallet className="h-5 w-5" />
                  <span className="text-sm font-bold">صافي أرباحك المتوقع</span>
                </div>
                <div className="text-2xl font-black text-emerald-600 tabular-nums">
                  {netEarning} <span className="text-sm">ج.م</span>
                </div>
              </div>
            )}

            {/* Addresses */}
            <div className="p-4 space-y-2 bg-white">
              {pickupAddress && (
                <div className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3">
                  <div className="h-9 w-9 rounded-full bg-emerald-500 grid place-items-center shrink-0 text-white">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">نقطة الاستلام</p>
                    <p className="font-bold text-sm leading-tight line-clamp-2">{pickupAddress}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      على بُعد {etaMin} دقائق / {distanceToPickupKm.toFixed(1)} كم
                    </p>
                  </div>
                </div>
              )}
              {dropoffAddress && (
                <div className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3">
                  <div className="h-9 w-9 rounded-full bg-red-500 grid place-items-center shrink-0 text-white">
                    <Flag className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">الوجهة</p>
                    <p className="font-bold text-sm leading-tight line-clamp-2">{dropoffAddress}</p>
                    {tripMin > 0 && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        مدة الرحلة ~{tripMin} دقيقة / {rideDistanceKm.toFixed(1)} كم
                      </p>
                    )}
                  </div>
                </div>
              )}
              {!pickupAddress && !dropoffAddress && (
                <div className="grid grid-cols-2 gap-2">
                  <Stat icon={<Navigation2 className="h-4 w-4" />} label="للراكب" value={`${distanceToPickupKm.toFixed(1)} كم`} />
                  <Stat icon={<MapPin className="h-4 w-4" />} label="مسافة الرحلة" value={`${rideDistanceKm.toFixed(1)} كم`} />
                </div>
              )}
            </div>

            <div className="p-4 pt-1 space-y-2 bg-white">
              <Button
                onClick={onAccept}
                className="w-full h-14 text-base font-black bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/30"
              >
                <Check className="h-5 w-5 ml-2" /> قبول الرحلة ({remaining}ث)
              </Button>
              <Button
                onClick={onDismiss}
                variant="outline"
                className="w-full h-11 text-sm font-bold border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-300 rounded-2xl"
              >
                <X className="h-4 w-4 ml-1" /> تخطي
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
    <div className="bg-white rounded-xl p-3 text-center shadow-sm border border-gray-100">
      <div className="flex items-center justify-center gap-1 text-gray-500 text-[11px]">{icon}{label}</div>
      <div className="font-black text-base mt-0.5">{value}</div>
    </div>
  );
}
