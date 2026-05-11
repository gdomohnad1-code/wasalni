import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { ArrowRight, MapPin, Navigation, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RIDE_TYPES, type RideTypeKey, type TripMode,
  calcPrice, calcDuration, haversineKm, calcCommission, PLATFORM_COMMISSION_RATE,
} from "@/lib/pricing";
import { geocodeAddress, reverseGeocode, type LatLng } from "@/lib/geocode";
import { FakeMap } from "@/components/FakeMap";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/book")({
  validateSearch: z.object({
    type: z.enum(["private", "shared", "package", "female", "vip"]).default("private"),
  }),
  component: BookPage,
});

const SUGGEST_AR = ["مدينة نصر", "المعادي", "وسط البلد", "مصر الجديدة", "التجمع الخامس", "الزمالك", "مول العرب"];
const SUGGEST_EN = ["Nasr City", "Maadi", "Downtown", "Heliopolis", "5th Settlement", "Zamalek", "Mall of Arabia"];

function BookPage() {
  const navigate = useNavigate();
  const { type } = Route.useSearch();
  const { t, lang } = useI18n();
  const [rideType, setRideType] = useState<RideTypeKey>(type);
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null);
  const [destCoords, setDestCoords] = useState<LatLng | null>(null);
  const [tripMode, setTripMode] = useState<TripMode>("oneway");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const destDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SUGGEST = lang === "ar" ? SUGGEST_AR : SUGGEST_EN;

  useEffect(() => {
    detectLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setPickup(t("book.cairo"));
      setPickupCoords({ lat: 30.0444, lng: 31.2357 });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPickupCoords(coords);
        const name = await reverseGeocode(coords);
        setPickup(name ?? `${t("book.your_loc")} (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);
        setGpsLoading(false);
      },
      () => {
        setPickup(t("book.cairo_eg"));
        setPickupCoords({ lat: 30.0444, lng: 31.2357 });
        setGpsLoading(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (destDebounce.current) clearTimeout(destDebounce.current);
    if (!destination.trim()) { setDestCoords(null); return; }
    setGeoLoading(true);
    destDebounce.current = setTimeout(async () => {
      const c = await geocodeAddress(destination);
      setDestCoords(c);
      setGeoLoading(false);
    }, 600);
    return () => { if (destDebounce.current) clearTimeout(destDebounce.current); };
  }, [destination]);

  const oneWayDistance =
    pickupCoords && destCoords ? haversineKm(pickupCoords, destCoords) : 0;
  const distance = tripMode === "roundtrip" ? oneWayDistance * 2 : oneWayDistance;
  const duration = distance ? calcDuration(distance) : 0;
  const price = oneWayDistance ? calcPrice(oneWayDistance, rideType, tripMode, duration) : 0;
  const commission = price ? calcCommission(price) : 0;

  const handleConfirm = async () => {
    if (!pickupCoords || !destCoords) {
      toast.error(t("book.coords_err"));
      return;
    }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("c.must_signin"));
      const { data, error } = await supabase.from("rides").insert({
        rider_id: user.id,
        pickup_address: pickup,
        destination_address: destination,
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        destination_lat: destCoords.lat,
        destination_lng: destCoords.lng,
        ride_type: rideType,
        distance_km: distance,
        duration_min: duration,
        price,
        round_trip: tripMode === "roundtrip",
        status: "searching",
      }).select().single();
      if (error) throw error;
      toast.success(t("book.searching_driver"));
      navigate({ to: "/ride/$id", params: { id: data.id } });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col">
      <div className="flex items-center gap-3 p-4 bg-card border-b">
        <button onClick={() => navigate({ to: "/home" })} className="p-2 -ms-2">
          <ArrowRight className="h-5 w-5 ltr:rotate-180" />
        </button>
        <h1 className="font-bold text-lg">{t("book.title")}</h1>
      </div>

      <div className="h-56 mx-4 mt-4">
        <FakeMap pickup={pickup} destination={destination} />
      </div>

      <div className="p-4 space-y-4 flex-1">
        <div>
          <Label className="text-xs">{t("book.pickup")}</Label>
          <div className="relative">
            <MapPin className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
            <Input value={pickup} onChange={(e) => setPickup(e.target.value)} className="ps-10 pe-10" placeholder={t("book.pickup_ph")} />
            <button onClick={detectLocation} className="absolute start-2 top-1/2 -translate-y-1/2 p-1.5 text-primary">
              {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <Label className="text-xs">{t("book.destination")}</Label>
          <div className="relative">
            <MapPin className="absolute end-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} className="ps-10 pe-10" placeholder={t("book.dest_ph")} />
            {geoLoading && (
              <Loader2 className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          {destination && !geoLoading && !destCoords && (
            <p className="text-[11px] text-destructive mt-1">{t("book.not_found")}</p>
          )}
          <div className="flex gap-2 mt-2 flex-wrap">
            {SUGGEST.map((s) => (
              <button key={s} onClick={() => setDestination(s)}
                className="text-xs bg-muted hover:bg-accent px-3 py-1 rounded-full transition">{s}</button>
            ))}
          </div>
        </div>

        <Tabs value={tripMode} onValueChange={(v) => setTripMode(v as TripMode)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="oneway">{t("book.mode_oneway")}</TabsTrigger>
            <TabsTrigger value="roundtrip">{t("book.mode_roundtrip")}</TabsTrigger>
            <TabsTrigger value="multistop">{t("book.mode_multistop")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div>
          <Label className="text-xs">{t("book.service")}</Label>
          <div className="grid grid-cols-5 gap-2 mt-1">
            {(Object.entries(RIDE_TYPES) as [RideTypeKey, typeof RIDE_TYPES[RideTypeKey]][]).map(([k, v]) => (
              <button key={k} onClick={() => setRideType(k)}
                className={`p-2 rounded-xl border-2 transition ${rideType === k ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                <div className="text-2xl">{v.icon}</div>
                <div className="text-[10px] mt-1 font-semibold">{v.label}</div>
              </button>
            ))}
          </div>
        </div>

        {distance > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-primary text-primary-foreground rounded-2xl p-4 shadow-soft">
            <div className="flex justify-between text-sm">
              <span>{t("book.distance")}</span><span className="font-bold">{distance.toFixed(1)} {t("c.km")}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span>{t("book.duration")}</span><span className="font-bold">{duration} {t("c.min")}</span>
            </div>
            {tripMode === "multistop" && (
              <div className="text-[11px] mt-1 opacity-90">{t("book.multistop_note")}</div>
            )}
            <div className="flex justify-between mt-2 pt-2 border-t border-white/30">
              <span className="font-bold">{t("book.final_price")}</span>
              <span className="font-black text-2xl">{price} {t("c.currency")}</span>
            </div>
            <div className="flex justify-between text-[11px] opacity-90 mt-1">
              <span>{t("book.commission")} ({Math.round(PLATFORM_COMMISSION_RATE * 100)}%)</span>
              <span>{commission} {t("c.currency")}</span>
            </div>
          </motion.div>
        )}

        <Button
          onClick={() => setConfirming(true)}
          disabled={!pickup || !destination}
          className="w-full h-14 text-base font-bold bg-gradient-primary shadow-soft"
        >
          {t("book.continue")}
        </Button>
      </div>

      {confirming && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-foreground/40 z-50 flex items-end">
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-card w-full max-w-md mx-auto rounded-t-3xl p-6 shadow-elevated">
            <div className="h-1.5 w-12 bg-border rounded-full mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-4">{t("book.confirm_title")}</h2>
            <div className="space-y-2 text-sm">
              <Row k={t("book.from")} v={pickup} />
              <Row k={t("book.to")} v={destination} />
              <Row k={t("book.service_short")} v={`${RIDE_TYPES[rideType].icon} ${RIDE_TYPES[rideType].label}`} />
              <Row k={t("book.distance")} v={`${distance} ${t("c.km")}`} />
              <Row k={t("book.time")} v={`${duration} ${t("c.min")}`} />
              <div className="flex justify-between items-center pt-3 border-t">
                <span className="font-bold">{t("book.total")}</span>
                <span className="text-2xl font-black text-primary">{price} {t("c.currency")}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)}>{t("book.edit")}</Button>
              <Button className="flex-1 bg-gradient-primary" onClick={handleConfirm} disabled={creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : t("book.confirm")}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold text-end flex-1">{v}</span>
    </div>
  );
}
