import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Phone, MessageCircle, Star, Send, X, ArrowRight, Car, Share2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RideMap } from "@/components/RideMap";
import { RiderSafetyPanel } from "@/components/RiderSafetyPanel";
import { SmartSOSButton } from "@/components/SmartSOSButton";
import { AdSlot } from "@/components/AdSlot";
import { RateDialog } from "@/components/RateDialog";

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

function RidePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const cacheKey = `ride:last:${id}`;
  // Hydrate from localStorage synchronously so the UI survives refresh / brief offline
  const [ride, setRide] = useState<Ride | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(cacheKey);
      return raw ? (JSON.parse(raw) as Ride) : null;
    } catch { return null; }
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);

  // Countdown & ETA state are OWNED by leaf sub-components. Parent only stores
  // stable setter refs so high-frequency ticks from RideMap don't re-render
  // the whole route.
  const etaSetterRef = useRef<((n: number) => void) | null>(null);
  const onEta = useCallback((n: number) => {
    etaSetterRef.current?.(n);
  }, []);


  // Persist ride snapshot whenever it updates (survives refresh/offline)
  useEffect(() => {
    if (!ride) return;
    try { window.localStorage.setItem(cacheKey, JSON.stringify(ride)); } catch { /* quota */ }
    // Clear cache once the ride is fully closed
    if (ride.status === "completed" || ride.status === "cancelled") {
      const t = setTimeout(() => {
        try { window.localStorage.removeItem(cacheKey); } catch { /* noop */ }
      }, 60_000);
      return () => clearTimeout(t);
    }
  }, [ride, cacheKey]);

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

    // Refetch when the browser comes back online so we don't miss updates while disconnected
    const onOnline = () => { load(); };
    window.addEventListener("online", onOnline);

    // Auto-accept simulation: only triggers for users that are actually approved drivers.
    // The RPC verifies role + active driver_documents server-side and rejects rider self-accept.
    const timer = setTimeout(async () => {
      try {
        await supabase.rpc("driver_accept_ride" as any, { p_ride_id: id });
      } catch {
        /* not a driver or already accepted — ignore */
      }
    }, 5000);

    return () => {
      cancel = true;
      supabase.removeChannel(ch);
      window.removeEventListener("online", onOnline);
      clearTimeout(timer);
    };
  }, [id]);

  const startRide = useCallback(async () => {
    await supabase.from("rides").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", id);
  }, [id]);
  const endRide = useCallback(async () => {
    await supabase.from("rides").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
  }, [id]);
  const openChat = useCallback(() => setChatOpen(true), []);
  const closeChat = useCallback(() => setChatOpen(false), []);
  const openRate = useCallback(() => setRateOpen(true), []);
  const closeRate = useCallback(() => setRateOpen(false), []);
  const onRated = useCallback(() => setRide((r) => (r ? { ...r, rating: 5 } : r)), []);

  useEffect(() => {
    if (ride?.status === "completed" && !ride.rating) {
      setRateOpen(true);
    }
  }, [ride?.status, ride?.rating]);

  // Memoize map coordinate objects so RideMap's referential prop identity is
  // stable across parent renders (prevents re-mount / spurious effect churn).
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

  if (!ride) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }



  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-background">
      <div className="flex items-center gap-3 p-4 bg-card border-b sticky top-0 z-30">
        <button onClick={() => navigate({ to: "/home" })}><ArrowRight className="h-5 w-5 ltr:rotate-180" /></button>
        <h1 className="font-bold flex-1">{t("ride.title")}</h1>
        <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-bold">
          {RIDE_TYPES[ride.ride_type as keyof typeof RIDE_TYPES]?.label}
        </span>
      </div>

      <div className={`${ride.status === "in_progress" || ride.status === "accepted" ? "h-[60vh]" : "h-80"} mx-4 mt-4 mb-2 rounded-2xl overflow-hidden shadow-card transition-all`}>
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
      </div>

      {(ride.status === "accepted" || ride.status === "in_progress") && (
        <EtaBanner status={ride.status} setterRef={etaSetterRef} />
      )}

      <div className="px-4 flex-1">
        <AnimatePresence mode="wait">
          {ride.status === "searching" && <Searching key="s" />}
          {ride.status === "accepted" && <Accepted key="a" ride={ride} onStart={startRide} onChat={openChat} />}
          {ride.status === "in_progress" && <InProgress key="i" ride={ride} onEnd={endRide} onChat={openChat} />}
          {ride.status === "completed" && (
            <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
              <div className="text-6xl mb-3">✅</div>
              <p className="font-bold text-lg">{t("ride.completed")}</p>
              {!ride.rating && (
                <Button onClick={openRate} className="mt-4 bg-gradient-primary">
                  <Star className="h-4 w-4 ms-1" /> قيّم السائق
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {ride.status === "accepted" && <AdSlot placement="waiting_driver" className="mt-3" />}
        {ride.status === "completed" && <AdSlot placement="post_ride" className="mt-3" />}
      </div>

      <ChatSheet rideId={id} open={chatOpen} onClose={closeChat} />
      <RateDialog
        open={rateOpen}
        onClose={closeRate}
        rideId={id}

        role="rider"
        onDone={() => setRide((r) => (r ? { ...r, rating: 5 } : r))}
      />

      {(ride.status === "accepted" || ride.status === "in_progress") &&
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
// Leaf components below own their own high-frequency state so parent route
// stays inert against countdown & ETA ticks.
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
    <div className="mx-4 mb-2 rounded-2xl bg-foreground text-background px-4 py-3 flex items-center justify-between shadow-card">
      <div>
        <div className="text-[11px] opacity-70 uppercase tracking-wide">
          {status === "accepted" ? t("ride.driver_eta") : t("ride.arrival_eta")}
        </div>
        <div className="text-2xl font-black leading-tight">
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


const Accepted = memo(function Accepted({ ride, onStart, onChat }: { ride: Ride; onStart: () => void; onChat: () => void }) {
  const { t } = useI18n();
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="bg-card rounded-2xl p-5 shadow-card space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center text-2xl">🧑‍✈️</div>
        <div className="flex-1">
          <div className="font-bold">{t("ride.driver_name")}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Star className="h-3 w-3 fill-warning text-warning" /> 4.8 · Hyundai Accent · ABC 1234
          </div>
        </div>
      </div>
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
        <Button variant="outline" className="flex-1"><Phone className="h-4 w-4 ms-1" /> {t("ride.call")}</Button>
      </div>
      <ShareRideButton ride={ride} />
      <SmartSOSButton rideId={ride.id} pickup={{ lat: Number(ride.pickup_lat) || 30.0444, lng: Number(ride.pickup_lng) || 31.2357 }} />
      <Button onClick={onStart} className="w-full h-12 bg-gradient-primary font-bold">
        <Car className="h-5 w-5 ms-2" /> {t("ride.start")}
      </Button>
    </motion.div>
  );
});


const InProgress = memo(function InProgress({ ride, onEnd, onChat }: { ride: Ride; onEnd: () => void; onChat: () => void }) {
  const { t } = useI18n();
  // Countdown lives HERE — 1-second ticks never reach the parent route.
  const [countdown, setCountdown] = useState(() => (ride.duration_min ?? 0) * 60);
  useEffect(() => {
    setCountdown((ride.duration_min ?? 0) * 60);
    const i = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(i);
  }, [ride.duration_min]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="bg-card rounded-2xl p-5 shadow-card space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{t("ride.remaining")}</p>
        <div className="text-4xl font-black text-primary tracking-wider">{fmtTime(countdown)}</div>
      </div>
      <Button variant="outline" className="w-full" onClick={onChat}>
        <MessageCircle className="h-4 w-4 ms-1" /> {t("ride.msg_driver")}
      </Button>
      <ShareRideButton ride={ride} />
      <SmartSOSButton rideId={ride.id} pickup={{ lat: Number(ride.pickup_lat) || 30.0444, lng: Number(ride.pickup_lng) || 31.2357 }} />
      <Button onClick={onEnd} variant="destructive" className="w-full h-12 font-bold">{t("ride.end")}</Button>
    </motion.div>
  );
});


const ShareRideButton = memo(function ShareRideButton({ ride }: { ride: Ride }) {
  const { t } = useI18n();
  const share = () => {
    const link = `${window.location.origin}/ride/${ride.id}`;
    const driver = t("ride.driver_name");
    const car = "Hyundai Accent - ABC 1234";
    const msg = t("ride.share_msg")
      .replace("{driver}", driver)
      .replace("{car}", car)
      .replace("{link}", link);
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };
  return (
    <Button
      variant="outline"
      onClick={share}
      className="w-full h-11 rounded-xl border-success/40 text-success hover:bg-success/10 font-bold"
    >
      <Share2 className="h-4 w-4 ms-2" /> {t("ride.share_wa")}
    </Button>
  );
});



const ChatSheet = memo(function ChatSheet({ rideId, open, onClose }: { rideId: string; open: boolean; onClose: () => void }) {
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

  const quickReplies = [t("ride.quick_here"), t("ride.quick_jacket"), t("ride.quick_5min")];


  if (!open) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-foreground/40 z-[9999] flex items-end">
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
