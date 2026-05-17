import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Phone, MessageCircle, Star, Send, X, ArrowRight, Car } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RideMap } from "@/components/RideMap";
import { RiderSafetyPanel } from "@/components/RiderSafetyPanel";
import { AdSlot } from "@/components/AdSlot";
import { RateDialog } from "@/components/RateDialog";
import { toast } from "sonner";
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
}

function RidePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [ride, setRide] = useState<Ride | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [rated, setRated] = useState(false);
  const [stars, setStars] = useState(5);
  const [countdown, setCountdown] = useState(0);
  const [etaSec, setEtaSec] = useState(0);

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

    // Auto-accept simulation: only triggers for users that are actually approved drivers.
    // The RPC verifies role + active driver_documents server-side and rejects rider self-accept.
    const timer = setTimeout(async () => {
      try {
        await supabase.rpc("driver_accept_ride" as any, { p_ride_id: id });
      } catch {
        /* not a driver or already accepted — ignore */
      }
    }, 5000);

    return () => { cancel = true; supabase.removeChannel(ch); clearTimeout(timer); };
  }, [id]);

  useEffect(() => {
    if (ride?.status !== "in_progress") return;
    setCountdown(ride.duration_min * 60);
    const i = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(i);
  }, [ride?.status, ride?.duration_min]);

  const startRide = async () => {
    await supabase.from("rides").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", id);
  };
  const endRide = async () => {
    await supabase.from("rides").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
  };
  const submitRating = async () => {
    await supabase.from("rides").update({ rating: stars }).eq("id", id);
    setRated(true);
    toast.success(t("ride.thank_rating"));
    setTimeout(() => navigate({ to: "/home" }), 1200);
  };

  if (!ride) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

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
        {ride.pickup_lat && ride.pickup_lng && ride.destination_lat && ride.destination_lng ? (
          <RideMap
            pickup={{ lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng) }}
            destination={{ lat: Number(ride.destination_lat), lng: Number(ride.destination_lng) }}
            driverId={ride.driver_id}
            phase={ride.status as any}
            acceptedAt={ride.accepted_at}
            startedAt={ride.started_at}
            durationMin={ride.duration_min}
            onEta={setEtaSec}
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full bg-muted flex items-center justify-center text-sm text-muted-foreground">
            {t("ride.title")}
          </div>
        )}
      </div>

      {(ride.status === "accepted" || ride.status === "in_progress") && etaSec > 0 && (
        <div className="mx-4 mb-2 rounded-2xl bg-foreground text-background px-4 py-3 flex items-center justify-between shadow-card">
          <div>
            <div className="text-[11px] opacity-70 uppercase tracking-wide">
              {ride.status === "accepted" ? t("ride.driver_eta") : t("ride.arrival_eta")}
            </div>
            <div className="text-2xl font-black leading-tight">
              {Math.ceil(etaSec / 60)} {t("ride.min")}
            </div>
          </div>
          <div className="text-xs opacity-70">
            {ride.status === "accepted" ? t("ride.on_the_way") : t("ride.in_route")}
          </div>
        </div>
      )}

      <div className="px-4 flex-1">
        <AnimatePresence mode="wait">
          {ride.status === "searching" && <Searching key="s" />}
          {ride.status === "accepted" && <Accepted key="a" onStart={startRide} onChat={() => setChatOpen(true)} />}
          {ride.status === "in_progress" && <InProgress key="i" countdown={fmtTime(countdown)} onEnd={endRide} onChat={() => setChatOpen(true)} />}
          {ride.status === "completed" && !rated && <RateBox key="r" stars={stars} setStars={setStars} onSubmit={submitRating} />}
          {ride.status === "completed" && rated && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-10">
              <div className="text-6xl mb-3">✅</div>
              <p className="font-bold text-lg">{t("ride.completed")}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {ride.status === "accepted" && <AdSlot placement="waiting_driver" className="mt-3" />}
        {ride.status === "completed" && <AdSlot placement="post_ride" className="mt-3" />}
      </div>

      <ChatSheet rideId={id} open={chatOpen} onClose={() => setChatOpen(false)} />

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

function Searching() {
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
}

function Accepted({ onStart, onChat }: { onStart: () => void; onChat: () => void }) {
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
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onChat}><MessageCircle className="h-4 w-4 ms-1" /> {t("ride.chat")}</Button>
        <Button variant="outline" className="flex-1"><Phone className="h-4 w-4 ms-1" /> {t("ride.call")}</Button>
      </div>
      <Button onClick={onStart} className="w-full h-12 bg-gradient-primary font-bold">
        <Car className="h-5 w-5 ms-2" /> {t("ride.start")}
      </Button>
    </motion.div>
  );
}

function InProgress({ countdown, onEnd, onChat }: { countdown: string; onEnd: () => void; onChat: () => void }) {
  const { t } = useI18n();
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="bg-card rounded-2xl p-5 shadow-card space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{t("ride.remaining")}</p>
        <div className="text-4xl font-black text-primary tracking-wider">{countdown}</div>
      </div>
      <Button variant="outline" className="w-full" onClick={onChat}>
        <MessageCircle className="h-4 w-4 ms-1" /> {t("ride.msg_driver")}
      </Button>
      <Button onClick={onEnd} variant="destructive" className="w-full h-12 font-bold">{t("ride.end")}</Button>
    </motion.div>
  );
}

function RateBox({ stars, setStars, onSubmit }: { stars: number; setStars: (n: number) => void; onSubmit: () => void }) {
  const { t } = useI18n();
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="bg-card rounded-2xl p-6 shadow-card text-center">
      <div className="text-5xl mb-2">🎉</div>
      <h3 className="font-bold text-lg mb-1">{t("ride.rate_title")}</h3>
      <p className="text-sm text-muted-foreground mb-4">{t("ride.rate_sub")}</p>
      <div className="flex justify-center gap-2 mb-5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)}>
            <Star className={`h-9 w-9 ${n <= stars ? "fill-warning text-warning" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      <Button onClick={onSubmit} className="w-full h-12 bg-gradient-primary font-bold">{t("ride.submit_rating")}</Button>
    </motion.div>
  );
}

function ChatSheet({ rideId, open, onClose }: { rideId: string; open: boolean; onClose: () => void }) {
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

  const send = async () => {
    if (!text.trim()) return;
    await supabase.from("chat_messages").insert({ ride_id: rideId, sender_id: me, content: text });
    setText("");
  };

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
        <div className="flex gap-2 p-3 border-t">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("ride.chat_ph")}
            onKeyDown={(e) => e.key === "Enter" && send()} />
          <Button onClick={send} size="icon" className="bg-gradient-primary"><Send className="h-4 w-4" /></Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
