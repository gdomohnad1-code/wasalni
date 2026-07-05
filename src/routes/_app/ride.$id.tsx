import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Phone, MessageCircle, Star, Send, X, ArrowRight, Car, Share2, MapPin, Navigation2, Siren, Flag, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { retryMutation } from "@/lib/network";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RideMap } from "@/components/RideMap";
import { RiderSafetyPanel } from "@/components/RiderSafetyPanel";
import { SmartSOSButton } from "@/components/SmartSOSButton";
import { AdSlot } from "@/components/AdSlot";
import { RateDialog } from "@/components/RateDialog";
import { TripCompletionModal } from "@/components/driver/TripCompletionModal";
import { triggerSOS } from "@/hooks/use-driver-location";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { RIDE_TYPES } from "@/lib/pricing";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/ride/$id")({
  component: RidePage,
});

interface Ride {
  id: string;
  status: string;
  pickup_address: string;
  destination_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  ride_type: string;
  distance_km: number;
  duration_min: number;
  price: number;
  driver_id: string | null;
  rider_id: string;
  rating: number | null;
  accepted_at: string | null;
  started_at: string | null;
  landmark_note: string | null;
  silent_ride: boolean | null;
  ac_preference: string | null;
  start_pin: string | null;
}

type DriverInfo = {
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
  rating: number | null;
  car_model: string | null;
  car_plate: string | null;
  car_type: string | null;
};

type RiderInfo = {
  full_name: string;
  avatar_url: string | null;
  phone: string | null;
};

function RidePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { user } = useAuth();
  const cacheKey = `ride:last:${id}`;

  const [ride, setRide] = useState<Ride | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(cacheKey);
      return raw ? (JSON.parse(raw) as Ride) : null;
    } catch { return null; }
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [riderInfo, setRiderInfo] = useState<RiderInfo | null>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  // Client-only ARRIVED phase for the driver flow (accepted → arrived → in_progress).
  // Persisted per-ride so a refresh keeps the driver on the "start trip" button.
  const arrivedKey = `ride:arrived:${id}`;
  const [arrivedLocal, setArrivedLocal] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(arrivedKey) === "1"; } catch { return false; }
  });

  const isDriver = !!(user && ride?.driver_id && user.id === ride.driver_id);
  const isRider = !!(user && ride && user.id === ride.rider_id);

  // ETA state (owned by leaf).
  const etaSetterRef = useRef<((n: number) => void) | null>(null);
  const onEta = useCallback((n: number) => { etaSetterRef.current?.(n); }, []);

  // Persist ride snapshot
  useEffect(() => {
    if (!ride) return;
    try { window.localStorage.setItem(cacheKey, JSON.stringify(ride)); } catch { /* quota */ }
    if (ride.status === "completed" || ride.status === "cancelled") {
      const t = setTimeout(() => {
        try {
          window.localStorage.removeItem(cacheKey);
          window.localStorage.removeItem(arrivedKey);
        } catch { /* noop */ }
      }, 60_000);
      return () => clearTimeout(t);
    }
  }, [ride, cacheKey, arrivedKey]);

  // Load ride + realtime subscription
  useEffect(() => {
    let cancel = false;
    const load = async () => {
      const { data } = await supabase.from("rides").select("*").eq("id", id).maybeSingle();
      if (data && !cancel) setRide(data as Ride);
    };
    load();

    const ch = supabase.channel(`ride-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${id}` },
        (payload) => setRide(payload.new as Ride))
      .subscribe();

    const onOnline = () => { load(); };
    window.addEventListener("online", onOnline);

    // Auto-accept simulation: only fires for actual approved drivers (server-side check in RPC).
    const timer = setTimeout(async () => {
      try { await supabase.rpc("driver_accept_ride" as any, { p_ride_id: id }); }
      catch { /* ignore */ }
    }, 5000);

    return () => {
      cancel = true;
      supabase.removeChannel(ch);
      window.removeEventListener("online", onOnline);
      clearTimeout(timer);
    };
  }, [id]);

  // When we know the driver_id, fetch their profile+car for the rider view
  useEffect(() => {
    const drvId = ride?.driver_id;
    if (!drvId) { setDriverInfo(null); return; }
    let cancel = false;
    (async () => {
      const [p, d] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url, phone, rating").eq("id", drvId).maybeSingle(),
        supabase.from("driver_documents").select("car_model, car_plate, car_type").eq("driver_id", drvId).maybeSingle(),
      ]);
      if (cancel) return;
      setDriverInfo({
        full_name: p.data?.full_name || "السائق",
        avatar_url: p.data?.avatar_url ?? null,
        phone: p.data?.phone ?? null,
        rating: p.data?.rating ?? null,
        car_model: d.data?.car_model ?? null,
        car_plate: d.data?.car_plate ?? null,
        car_type: d.data?.car_type ?? null,
      });
    })();
    return () => { cancel = true; };
  }, [ride?.driver_id]);

  // Fetch rider info when the driver is viewing
  useEffect(() => {
    const rId = ride?.rider_id;
    if (!rId || !isDriver) { setRiderInfo(null); return; }
    let cancel = false;
    supabase.from("profiles").select("full_name, avatar_url, phone").eq("id", rId).maybeSingle()
      .then(({ data }) => {
        if (cancel) return;
        setRiderInfo({
          full_name: data?.full_name || "الراكب",
          avatar_url: data?.avatar_url ?? null,
          phone: data?.phone ?? null,
        });
      });
    return () => { cancel = true; };
  }, [ride?.rider_id, isDriver]);

  // Driver actions ----------------------------------------------------------
  const markArrived = useCallback(() => {
    setArrivedLocal(true);
    try { window.localStorage.setItem(arrivedKey, "1"); } catch { /* quota */ }
    toast.success("تم إبلاغ الراكب بوصولك 📍");
  }, [arrivedKey]);

  const startRide = useCallback(async () => {
    const startedAt = new Date().toISOString();
    setRide((r) => (r ? { ...r, status: "in_progress", started_at: startedAt } as Ride : r));
    retryMutation(
      () => supabase.from("rides").update({ status: "in_progress", started_at: startedAt }).eq("id", id),
      { label: "بدء الرحلة" },
    );
  }, [id]);

  const openCompletion = useCallback(() => setCompletionOpen(true), []);
  const closeCompletion = useCallback(() => setCompletionOpen(false), []);

  const finalizeCompletion = useCallback(async (received: number, changeToWallet: number) => {
    const endedId = id;
    setRide((r) => (r ? { ...r, status: "completed" } as Ride : r));
    setCompletionOpen(false);
    if (changeToWallet > 0) toast.success(`تم إيداع ${changeToWallet} ج.م في محفظة الراكب ⚡`);
    else toast.success("تم إنهاء الرحلة 💰");
    retryMutation(
      () => supabase.rpc("complete_ride_with_change" as any, {
        p_ride_id: endedId,
        p_received_cash: received,
        p_change_to_wallet: changeToWallet,
      }),
      {
        label: "إنهاء الرحلة",
        onFinalFail: () => {
          toast.error("تعذّر إنهاء الرحلة — من فضلك حاول مرة أخرى");
          setRide((r) => (r ? { ...r, status: "in_progress" } as Ride : r));
        },
      },
    );
  }, [id]);

  // Rider-only fallback end (legacy path)
  const endRide = useCallback(async () => {
    const completedAt = new Date().toISOString();
    setRide((r) => (r ? { ...r, status: "completed", completed_at: completedAt } as Ride : r));
    retryMutation(
      () => supabase.from("rides").update({ status: "completed", completed_at: completedAt }).eq("id", id),
      { label: "إنهاء الرحلة" },
    );
  }, [id]);

  const openChat = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);
  const openRate = useCallback(() => setRateOpen(true), []);
  const closeRate = useCallback(() => setRateOpen(false), []);

  useEffect(() => {
    if (ride?.status === "completed" && !ride.rating) setRateOpen(true);
  }, [ride?.status, ride?.rating]);

  const pickupLL = useMemo(
    () => (ride?.pickup_lat != null && ride?.pickup_lng != null
      ? { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng) }
      : null),
    [ride?.pickup_lat, ride?.pickup_lng],
  );
  const destLL = useMemo(
    () => (ride?.destination_lat != null && ride?.destination_lng != null
      ? { lat: Number(ride.destination_lat), lng: Number(ride.destination_lng) }
      : null),
    [ride?.destination_lat, ride?.destination_lng],
  );

  const doSOS = useCallback(async () => {
    if (!confirm("سيتم إرسال إشارة طوارئ إلى الإدارة. هل أنت متأكد؟")) return;
    const { error } = await triggerSOS("طلب طوارئ من داخل الرحلة");
    if (error) return toast.error("تعذر إرسال إشارة الطوارئ");
    toast.success("تم إرسال إشارة الطوارئ");
  }, []);

  const shareWhatsApp = useCallback(() => {
    if (!ride) return;
    const link = `${window.location.origin}/ride/${ride.id}`;
    const driver = driverInfo?.full_name || t("ride.driver_name");
    const car = `${driverInfo?.car_model || "—"} · ${driverInfo?.car_plate || ""}`;
    const msg = t("ride.share_msg")
      .replace("{driver}", driver)
      .replace("{car}", car)
      .replace("{link}", link);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
  }, [ride, driverInfo, t]);

  if (!ride) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // Effective driver-side phase (uses local ARRIVED for the UI progression)
  const driverPhase: "accepted" | "arrived" | "in_progress" | "completed" | "other" =
    ride.status === "accepted"
      ? (arrivedLocal ? "arrived" : "accepted")
      : ride.status === "in_progress" ? "in_progress"
      : ride.status === "completed" ? "completed" : "other";

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background relative" dir="rtl">
      <div className="flex items-center gap-3 p-4 bg-card border-b sticky top-0 z-30">
        <button onClick={() => navigate({ to: isDriver ? "/driver" : "/home" })}>
          <ArrowRight className="h-5 w-5 ltr:rotate-180" />
        </button>
        <h1 className="font-bold flex-1">{t("ride.title")}</h1>
        <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-bold">
          {RIDE_TYPES[ride.ride_type as keyof typeof RIDE_TYPES]?.label}
        </span>
      </div>

      {/* Map */}
      <div className={`${ride.status === "in_progress" || ride.status === "accepted" ? "h-[60vh]" : "h-80"} mx-4 mt-4 mb-2 rounded-2xl overflow-hidden shadow-card transition-all relative`}>
        {pickupLL && destLL ? (
          <RideMap
            pickup={pickupLL}
            destination={destLL}
            driverId={ride.driver_id}
            phase={ride.status as any}
            acceptedAt={ride.accepted_at}
            startedAt={ride.started_at}
            durationMin={ride.duration_min}
            onEta={onEta}
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center text-sm text-muted-foreground">
            {t("ride.title")}
          </div>
        )}

        {/* Glassmorphic floating top bar over the map — SOS + WhatsApp share */}
        {(ride.status === "accepted" || ride.status === "in_progress") && (
          <div className="absolute top-3 inset-x-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
            <button
              onClick={doSOS}
              className="pointer-events-auto h-11 w-11 rounded-full bg-red-500/90 hover:bg-red-500 backdrop-blur-md text-white grid place-items-center shadow-xl border border-white/20"
              aria-label="SOS"
            >
              <Siren className="h-5 w-5" />
            </button>
            <button
              onClick={shareWhatsApp}
              className="pointer-events-auto h-11 px-4 rounded-full bg-emerald-500/90 hover:bg-emerald-500 backdrop-blur-md text-white flex items-center gap-2 shadow-xl border border-white/20 font-bold text-sm"
            >
              <Share2 className="h-4 w-4" /> مشاركة الرحلة
            </button>
          </div>
        )}
      </div>

      {(ride.status === "accepted" || ride.status === "in_progress") && (
        <EtaBanner status={ride.status} setterRef={etaSetterRef} />
      )}

      <div className="px-4 flex-1 pb-6">
        <AnimatePresence mode="wait">
          {ride.status === "searching" && <Searching key="s" />}

          {/* Driver-side panels ------------------------------------------------ */}
          {isDriver && driverPhase === "accepted" && (
            <DriverActivePanel
              key="d-accept"
              ride={ride}
              riderInfo={riderInfo}
              phase="accepted"
              onChat={openChat}
              onPrimary={markArrived}
            />
          )}
          {isDriver && driverPhase === "arrived" && (
            <DriverActivePanel
              key="d-arrived"
              ride={ride}
              riderInfo={riderInfo}
              phase="arrived"
              onChat={openChat}
              onPrimary={startRide}
            />
          )}
          {isDriver && driverPhase === "in_progress" && (
            <DriverActivePanel
              key="d-inprog"
              ride={ride}
              riderInfo={riderInfo}
              phase="in_progress"
              onChat={openChat}
              onPrimary={openCompletion}
            />
          )}

          {/* Rider-side panels ------------------------------------------------- */}
          {!isDriver && ride.status === "accepted" && (
            <Accepted key="a" ride={ride} driverInfo={driverInfo} onStart={startRide} onChat={openChat} />
          )}
          {!isDriver && ride.status === "in_progress" && (
            <InProgress key="i" ride={ride} driverInfo={driverInfo} onEnd={endRide} onChat={openChat} />
          )}

          {ride.status === "completed" && (
            <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
              <div className="text-6xl mb-3">✅</div>
              <p className="font-bold text-lg">{t("ride.completed")}</p>
              {!ride.rating && (
                <Button onClick={openRate} className="mt-4 bg-gradient-primary">
                  <Star className="h-4 w-4 ms-1" /> {isDriver ? "قيّم الراكب" : "قيّم السائق"}
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {ride.status === "accepted" && !isDriver && <AdSlot placement="waiting_driver" className="mt-3" />}
        {ride.status === "completed" && <AdSlot placement="post_ride" className="mt-3" />}
      </div>

      <ChatSheet rideId={id} open={chatOpen} onClose={closeChat} isDriver={isDriver} />

      <RateDialog
        open={rateOpen}
        onClose={closeRate}
        rideId={id}
        role={isDriver ? "driver" : "rider"}
        onDone={() => setRide((r) => (r ? { ...r, rating: 5 } : r))}
      />

      <TripCompletionModal
        open={completionOpen}
        totalFare={Number(ride.price || 0)}
        riderName={riderInfo?.full_name || "الراكب"}
        onClose={closeCompletion}
        onCompleteTrip={finalizeCompletion}
      />

      {isRider && (ride.status === "accepted" || ride.status === "in_progress") &&
        ride.pickup_lat && ride.pickup_lng && ride.destination_lat && ride.destination_lng && (
          <RiderSafetyPanel
            rideId={id}
            driverId={ride.driver_id}
            pickup={{ lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng) }}
            destination={{ lat: Number(ride.destination_lat), lng: Number(ride.destination_lng) }}
          />
        )}
    </div>
  );
}

const fmtTime = (s: number) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// -----------------------------------------------------------------------------
// Leaf components — memoized so GPS ticks in RideMap never re-render them.
// -----------------------------------------------------------------------------

const EtaBanner = memo(function EtaBanner({
  status,
  setterRef,
}: {
  status: string;
  setterRef: React.MutableRefObject<((n: number) => void) | null>;
}) {
  const { t } = useI18n();
  const [etaSec, setEtaSec] = useState(0);
  useEffect(() => {
    setterRef.current = setEtaSec;
    return () => { setterRef.current = null; };
  }, [setterRef]);
  if (etaSec <= 0) return null;
  return (
    <div className="mx-4 mb-2 rounded-2xl px-4 py-3 flex items-center justify-between shadow-card" style={{ background: "#0A192F", color: "white" }}>
      <div>
        <div className="text-[11px] opacity-70 uppercase tracking-wide">
          {status === "accepted" ? t("ride.driver_eta") : t("ride.arrival_eta")}
        </div>
        <div className="text-2xl font-black leading-tight text-emerald-400">
          {Math.ceil(etaSec / 60)} {t("ride.min")}
        </div>
      </div>
      <div className="text-xs opacity-70">
        {status === "accepted" ? t("ride.on_the_way") : t("ride.in_route")}
      </div>
    </div>
  );
});

const Searching = memo(function Searching() {
  const { t } = useI18n();
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="bg-card rounded-2xl p-6 shadow-card text-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="h-16 w-16 mx-auto rounded-full border-4 border-primary/20 border-t-primary mb-4" />
      <h3 className="font-bold text-lg">{t("ride.searching")}</h3>
      <p className="text-sm text-muted-foreground mt-1">{t("ride.searching_sub")}</p>
    </motion.div>
  );
});

// -----------------------------------------------------------------------------
// Rider panels
// -----------------------------------------------------------------------------

const DriverCard = memo(function DriverCard({ info }: { info: DriverInfo | null }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3">
      <div className="h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center text-2xl overflow-hidden shrink-0">
        {info?.avatar_url
          ? <img src={info.avatar_url} alt={info.full_name} className="h-full w-full object-cover" />
          : "🧑‍✈️"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold truncate">{info?.full_name || t("ride.driver_name")}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
          <Star className="h-3 w-3 fill-warning text-warning" />
          {(info?.rating ?? 4.8).toFixed(1)} · {info?.car_model || "—"} · {info?.car_plate || "—"}
        </div>
      </div>
    </div>
  );
});

const Accepted = memo(function Accepted({ ride, driverInfo, onStart, onChat }: { ride: Ride; driverInfo: DriverInfo | null; onStart: () => void; onChat: () => void }) {
  const { t } = useI18n();
  const callHref = driverInfo?.phone ? `tel:${driverInfo.phone}` : undefined;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="bg-card rounded-2xl p-5 shadow-card space-y-4">
      <DriverCard info={driverInfo} />

      {ride.start_pin && (
        <div className="rounded-2xl bg-gradient-primary text-primary-foreground p-4 shadow-elevated">
          <div className="flex items-center justify-between mb-1.5">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest opacity-80">رمز الركوب</div>
              <div className="text-[11px] opacity-75">اعطي السائق الرقم ده لبدء الرحلة</div>
            </div>
            <span className="text-lg">🔐</span>
          </div>
          <div className="flex justify-center gap-2 mt-2">
            {ride.start_pin.split("").map((d, i) => (
              <div key={i} className="h-12 w-11 rounded-xl bg-white/15 backdrop-blur-sm grid place-items-center text-2xl font-black tracking-widest">
                {d}
              </div>
            ))}
          </div>
        </div>
      )}
      {ride.landmark_note && (
        <div className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/20 p-3 text-[13px]">
          <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-primary/80">{t("ride.landmark_hint")}</div>
            <div className="font-semibold">{ride.landmark_note}</div>
          </div>
        </div>
      )}
      {(ride.silent_ride || (ride.ac_preference && ride.ac_preference !== "any")) && (
        <div className="flex flex-wrap gap-2">
          {ride.silent_ride && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/10 text-primary rounded-full px-2.5 py-1">
              🔇 {t("book.silent_title").replace("🔇 ", "")}
            </span>
          )}
          {ride.ac_preference === "on" && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-primary/10 text-primary rounded-full px-2.5 py-1">
              ❄️ {t("book.ac_on")}
            </span>
          )}
          {ride.ac_preference === "off" && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-muted text-foreground rounded-full px-2.5 py-1">
              ❄️ {t("book.ac_off")}
            </span>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onChat}><MessageCircle className="h-4 w-4 ms-1" /> {t("ride.chat")}</Button>
        <Button variant="outline" className="flex-1" asChild={!!callHref} disabled={!callHref}>
          {callHref ? <a href={callHref}><Phone className="h-4 w-4 ms-1" /> {t("ride.call")}</a> : <span><Phone className="h-4 w-4 ms-1" /> {t("ride.call")}</span>}
        </Button>
      </div>
      <SmartSOSButton rideId={ride.id} pickup={{ lat: Number(ride.pickup_lat) || 30.0444, lng: Number(ride.pickup_lng) || 31.2357 }} />
      <Button onClick={onStart} className="w-full h-12 bg-gradient-primary font-bold">
        <Car className="h-5 w-5 ms-2" /> {t("ride.start")}
      </Button>
    </motion.div>
  );
});

const InProgress = memo(function InProgress({ ride, driverInfo, onEnd, onChat }: { ride: Ride; driverInfo: DriverInfo | null; onEnd: () => void; onChat: () => void }) {
  const { t } = useI18n();
  const [countdown, setCountdown] = useState(() => (ride.duration_min ?? 0) * 60);
  useEffect(() => {
    setCountdown((ride.duration_min ?? 0) * 60);
    const i = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(i);
  }, [ride.duration_min]);
  const callHref = driverInfo?.phone ? `tel:${driverInfo.phone}` : undefined;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="bg-card rounded-2xl p-5 shadow-card space-y-4">
      <DriverCard info={driverInfo} />
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{t("ride.remaining")}</p>
        <div className="text-4xl font-black text-emerald-500 tracking-wider">{fmtTime(countdown)}</div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onChat}>
          <MessageCircle className="h-4 w-4 ms-1" /> {t("ride.msg_driver")}
        </Button>
        <Button variant="outline" className="flex-1" asChild={!!callHref} disabled={!callHref}>
          {callHref ? <a href={callHref}><Phone className="h-4 w-4 ms-1" /> {t("ride.call")}</a> : <span><Phone className="h-4 w-4 ms-1" /> {t("ride.call")}</span>}
        </Button>
      </div>
      <SmartSOSButton rideId={ride.id} pickup={{ lat: Number(ride.pickup_lat) || 30.0444, lng: Number(ride.pickup_lng) || 31.2357 }} />
      <Button onClick={onEnd} variant="destructive" className="w-full h-12 font-bold">{t("ride.end")}</Button>
    </motion.div>
  );
});

// -----------------------------------------------------------------------------
// Driver panel — unified for accepted / arrived / in_progress phases.
// Sequential status buttons follow the spec:
//   accepted    → "وصلت لموقع العميل 📍"
//   arrived     → "بدء الرحلة 🚀"
//   in_progress → "إنهاء الرحلة وتحصيل الكاش ✔️"
// -----------------------------------------------------------------------------

const DriverActivePanel = memo(function DriverActivePanel({
  ride,
  riderInfo,
  phase,
  onChat,
  onPrimary,
}: {
  ride: Ride;
  riderInfo: RiderInfo | null;
  phase: "accepted" | "arrived" | "in_progress";
  onChat: () => void;
  onPrimary: () => void;
}) {
  const target =
    phase === "in_progress"
      ? { lat: Number(ride.destination_lat), lng: Number(ride.destination_lng), label: ride.destination_address }
      : { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng), label: ride.pickup_address };
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=driving&dir_action=navigate`;
  const waze = `https://waze.com/ul?ll=${target.lat},${target.lng}&navigate=yes`;
  const callHref = riderInfo?.phone ? `tel:${riderInfo.phone}` : undefined;

  const primaryLabel =
    phase === "accepted" ? "وصلت لموقع العميل 📍"
    : phase === "arrived" ? "بدء الرحلة 🚀"
    : "إنهاء الرحلة وتحصيل الكاش ✔️";

  const primaryIcon =
    phase === "accepted" ? <MapPin className="h-5 w-5" />
    : phase === "arrived" ? <Car className="h-5 w-5" />
    : <CheckCircle2 className="h-5 w-5" />;

  const primaryColor =
    phase === "in_progress"
      ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30"
      : phase === "arrived"
      ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30"
      : "bg-[#0A192F] hover:bg-[#112D4E] shadow-black/20";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="bg-card rounded-2xl p-5 shadow-card space-y-4"
    >
      {/* Rider card */}
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center text-2xl overflow-hidden shrink-0">
          {riderInfo?.avatar_url
            ? <img src={riderInfo.avatar_url} alt={riderInfo.full_name} className="h-full w-full object-cover" />
            : "👤"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">الراكب</div>
          <div className="font-black truncate">{riderInfo?.full_name || "الراكب"}</div>
          <div className="text-xs text-emerald-600 font-bold">
            {Number(ride.price || 0).toFixed(0)} ج.م
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button variant="outline" size="icon" onClick={onChat} className="h-11 w-11 rounded-full">
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="outline" size="icon"
            asChild={!!callHref} disabled={!callHref}
            className="h-11 w-11 rounded-full text-emerald-600 border-emerald-200"
          >
            {callHref ? <a href={callHref}><Phone className="h-4 w-4" /></a> : <span><Phone className="h-4 w-4" /></span>}
          </Button>
        </div>
      </div>

      {/* Address block */}
      <div className="space-y-2">
        <div className="flex items-start gap-3 bg-muted/50 rounded-xl p-3">
          <div className="h-8 w-8 rounded-full bg-emerald-500 text-white grid place-items-center shrink-0"><MapPin className="h-4 w-4" /></div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">نقطة الاستلام</div>
            <div className="font-bold text-sm leading-tight line-clamp-2">{ride.pickup_address}</div>
          </div>
        </div>
        <div className="flex items-start gap-3 bg-muted/50 rounded-xl p-3">
          <div className="h-8 w-8 rounded-full bg-red-500 text-white grid place-items-center shrink-0"><Flag className="h-4 w-4" /></div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">الوجهة</div>
            <div className="font-bold text-sm leading-tight line-clamp-2">{ride.destination_address}</div>
          </div>
        </div>
      </div>

      {/* External navigation */}
      <div className="grid grid-cols-2 gap-2">
        <a
          href={gmaps} target="_blank" rel="noopener noreferrer"
          className="h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Navigation2 className="h-4 w-4" /> ابدأ الملاحة 🧭
        </a>
        <a
          href={waze} target="_blank" rel="noopener noreferrer"
          className="h-12 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-black flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          <Navigation2 className="h-4 w-4" /> Waze
        </a>
      </div>

      {/* Primary sequential action */}
      <Button
        onClick={onPrimary}
        className={`w-full h-14 rounded-2xl text-white text-base font-black shadow-lg ${primaryColor}`}
      >
        {primaryIcon}
        <span className="ms-2">{primaryLabel}</span>
      </Button>
    </motion.div>
  );
});

// -----------------------------------------------------------------------------
// Chat — role-aware quick replies.
// -----------------------------------------------------------------------------

const ChatSheet = memo(function ChatSheet({ rideId, open, onClose, isDriver }: { rideId: string; open: boolean; onClose: () => void; isDriver: boolean }) {
  const { t } = useI18n();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [me, setMe] = useState<string>("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id || ""));
  }, []);

  useEffect(() => {
    if (!open) return;
    supabase.from("chat_messages").select("*").eq("ride_id", rideId).order("created_at").then(({ data }) => {
      if (data) setMessages(data);
    });
    const ch = supabase.channel(`chat-${rideId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `ride_id=eq.${rideId}` },
        (p) => setMessages((m) => [...m, p.new]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [open, rideId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async (override?: string) => {
    const body = (override ?? text).trim();
    if (!body) return;
    await supabase.from("chat_messages").insert({ ride_id: rideId, sender_id: me, content: body });
    if (!override) setText("");
  };

  const riderReplies = ["أنا في موقعي الحالي 📍", "5 دقائق وسأكون عندك ⏱️", t("ride.quick_here"), t("ride.quick_jacket")];
  const driverReplies = ["أنا في الطريق إليك 🚗", "وصلت لموقعك 📍", "من فضلك تعال إلى السيارة"];
  const quickReplies = isDriver ? driverReplies : riderReplies;

  if (!open) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-foreground/40 z-[9999] flex items-end" dir="rtl">
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card w-full max-w-md mx-auto rounded-t-3xl flex flex-col h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold">{t("ride.chat_title")}</h3>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {messages.length === 0 && <p className="text-center text-sm text-muted-foreground mt-10">{t("ride.chat_start")}</p>}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_id === me ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${m.sender_id === me ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="px-3 pt-2 flex gap-2 overflow-x-auto scrollbar-hide">
          {quickReplies.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="shrink-0 text-[12px] font-semibold bg-muted hover:bg-primary hover:text-primary-foreground px-3 py-1.5 rounded-full transition"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex gap-2 p-3 border-t">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("ride.chat_ph")}
            onKeyDown={(e) => e.key === "Enter" && send()} />
          <Button onClick={() => send()} size="icon" className="bg-gradient-primary"><Send className="h-4 w-4" /></Button>
        </div>
      </motion.div>
    </motion.div>
  );
});
