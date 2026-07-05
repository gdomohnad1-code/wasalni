import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import {
  ArrowRight, MapPin, Navigation, Loader2, Clock, Users, Zap,
  ShieldCheck, Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RIDE_TYPES, type RideTypeKey, type TripMode,
  calcPrice, calcDuration, haversineKm, calcCommission, PLATFORM_COMMISSION_RATE,
} from "@/lib/pricing";
import { geocodeAddress, reverseGeocode, type LatLng } from "@/lib/geocode";
import { GoogleMap } from "@/components/GoogleMap";
import { BottomSheet, type SheetState } from "@/components/BottomSheet";
import { SkeletonFare, SkeletonVehicle } from "@/components/ui/skeleton";
import { AdSlot } from "@/components/AdSlot";
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

const SUGGEST_AR = ["مدينة نصر", "المعادي", "وسط البلد", "مصر الجديدة", "التجمع الخامس", "الزمالك"];
const SUGGEST_EN = ["Nasr City", "Maadi", "Downtown", "Heliopolis", "5th Settlement", "Zamalek"];

// Per-vehicle ETA badge (mock — driver dispatch fills real value)
const ETA_MIN: Record<RideTypeKey, number> = { shared: 2, private: 3, female: 5, vip: 4, package: 6 };
const CAPACITY: Record<RideTypeKey, number> = { shared: 1, private: 4, female: 6, vip: 4, package: 1 };

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
  const [sheet, setSheet] = useState<SheetState>("half");
  const [landmarkNote, setLandmarkNote] = useState("");
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

  // Auto-expand sheet once we have a full route
  useEffect(() => {
    if (pickupCoords && destCoords && sheet === "collapsed") setSheet("half");
  }, [pickupCoords, destCoords, sheet]);

  const oneWayDistance =
    pickupCoords && destCoords ? haversineKm(pickupCoords, destCoords) : 0;
  const distance = tripMode === "roundtrip" ? oneWayDistance * 2 : oneWayDistance;
  const duration = distance ? calcDuration(distance) : 0;
  const price = oneWayDistance ? calcPrice(oneWayDistance, rideType, tripMode, duration) : 0;
  const commission = price ? calcCommission(price) : 0;

  // Compute fare per vehicle type for the carousel
  const fareFor = (k: RideTypeKey) =>
    oneWayDistance ? calcPrice(oneWayDistance, k, tripMode, duration) : 0;

  const isRoutePricing = !!pickupCoords && !!destCoords && !geoLoading;

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

  const canContinue = !!pickup && !!destination && !!pickupCoords && !!destCoords;

  return (
    <div className="fixed inset-0 mx-auto max-w-md bg-background overflow-hidden">
      {/* Full-screen map with pickup/destination markers + polyline */}
      <GoogleMap
        className="absolute inset-0"
        pickup={pickupCoords}
        destination={destCoords}
        fallback={{ center: { lat: 30.0444, lng: 31.2357 }, zoom: 13 }}
        interactive
      />

      {/* Top vignette */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-background/60 to-transparent z-10" />

      {/* Top back pill */}
      <div className="absolute inset-x-0 top-0 z-20 pt-4 px-4 flex items-center justify-between gap-3">
        <button
          onClick={() => navigate({ to: "/home" })}
          className="glass-pill h-11 w-11 rounded-full grid place-items-center"
          aria-label={t("book.title")}
        >
          <ArrowRight className="h-5 w-5 ltr:rotate-180" />
        </button>
        <div className="glass-pill rounded-full px-4 py-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <span className="text-[12px] font-bold">{t("book.title")}</span>
        </div>
        <div className="w-11" />
      </div>

      {/* Sheet */}
      <BottomSheet state={sheet} onStateChange={setSheet} heights={{ collapsed: 190, half: 480, full: 700 }}>
        <div className="px-5 pb-6 space-y-4">
          {/* Pickup / Destination */}
          <div className="space-y-2.5 pt-1">
            <FieldRow
              icon={<span className="h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-primary/20" />}
              value={pickup}
              onChange={setPickup}
              placeholder={t("book.pickup_ph")}
              trailing={
                <button onClick={detectLocation} className="p-1.5 text-primary" aria-label="GPS">
                  {gpsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                </button>
              }
            />
            <div className="ms-4 h-4 border-s-2 border-dashed border-border" />
            <FieldRow
              icon={<span className="h-2.5 w-2.5 rounded-sm bg-success ring-2 ring-success/20" />}
              value={destination}
              onChange={setDestination}
              placeholder={t("book.dest_ph")}
              trailing={geoLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
            />
            {destination && !geoLoading && !destCoords && (
              <p className="text-[11px] text-destructive ps-4">{t("book.not_found")}</p>
            )}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pt-1">
              {SUGGEST.map((s) => (
                <button
                  key={s}
                  onClick={() => setDestination(s)}
                  className="shrink-0 text-[11px] font-semibold bg-muted hover:bg-primary hover:text-primary-foreground px-3 py-1.5 rounded-full transition"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Trip mode */}
          <Tabs value={tripMode} onValueChange={(v) => setTripMode(v as TripMode)}>
            <TabsList className="grid grid-cols-3 w-full rounded-xl bg-muted p-1 h-10">
              <TabsTrigger value="oneway"    className="rounded-lg text-[12px] font-bold">{t("book.mode_oneway")}</TabsTrigger>
              <TabsTrigger value="roundtrip" className="rounded-lg text-[12px] font-bold">{t("book.mode_roundtrip")}</TabsTrigger>
              <TabsTrigger value="multistop" className="rounded-lg text-[12px] font-bold">{t("book.mode_multistop")}</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Vehicle carousel */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-[13px] font-black tracking-tight">{t("book.service")}</h3>
              {isRoutePricing && (
                <span className="text-[10px] text-muted-foreground font-semibold">{distance.toFixed(1)} كم • {duration} د</span>
              )}
            </div>
            <div className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
              {(Object.entries(RIDE_TYPES) as [RideTypeKey, typeof RIDE_TYPES[RideTypeKey]][]).map(([k, v]) => {
                if (isRoutePricing) {
                  const fare = fareFor(k);
                  const active = rideType === k;
                  const isVip = k === "vip";
                  return (
                    <motion.button
                      key={k}
                      onClick={() => setRideType(k)}
                      whileTap={{ scale: 0.97 }}
                      className={`shrink-0 w-[168px] rounded-2xl p-3 text-right border-2 transition
                        ${active ? "border-primary shadow-elevated bg-card"
                                 : "border-border bg-card/70 hover:border-primary/40"}
                        ${isVip && active ? "ring-2 ring-vip/30" : ""}`}
                    >
                      <div className={`relative h-16 rounded-xl grid place-items-center text-4xl mb-2
                        ${isVip ? "bg-gradient-vip" : "bg-muted"}`}>
                        <span className="drop-shadow-sm">{v.icon}</span>
                        <span className={`absolute top-1.5 start-1.5 flex items-center gap-0.5 text-[9px] font-black
                          bg-background text-foreground rounded-full px-1.5 py-0.5 shadow-soft`}>
                          <Clock className="h-2.5 w-2.5" />
                          {ETA_MIN[k]}د
                        </span>
                      </div>
                      <div className="font-extrabold text-[13px] truncate">{v.short}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold">
                          <Users className="h-3 w-3" />{CAPACITY[k]}
                        </span>
                        <span className={`text-[15px] font-black ${isVip ? "text-vip" : "text-foreground"}`}>
                          {fare}
                          <span className="text-[10px] font-bold text-muted-foreground mr-0.5">ج.م</span>
                        </span>
                      </div>
                    </motion.button>
                  );
                }
                return <SkeletonVehicle key={k} />;
              })}
            </div>
          </div>

          {/* Fare breakdown */}
          {isRoutePricing ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-4 bg-gradient-primary text-primary-foreground shadow-elevated"
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-vip" />
                <span className="text-[11px] font-bold opacity-90">{t("book.final_price")}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-[10px] opacity-70">{RIDE_TYPES[rideType].label} • {tripMode === "roundtrip" ? "ذهاب وعودة" : tripMode === "multistop" ? "بالساعة" : "ذهاب فقط"}</span>
                <span className="text-3xl font-black tracking-tight">
                  {price}
                  <span className="text-sm font-bold opacity-80 mr-1">ج.م</span>
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-primary-foreground/20 flex justify-between text-[10.5px] opacity-80">
                <span>{t("book.commission")} ({Math.round(PLATFORM_COMMISSION_RATE * 100)}%)</span>
                <span>{commission} ج.م</span>
              </div>
            </motion.div>
          ) : destination ? (
            <SkeletonFare />
          ) : null}

          {/* Confirm CTA */}
          <Button
            onClick={() => setConfirming(true)}
            disabled={!canContinue}
            className="w-full h-14 rounded-2xl text-base font-black bg-gradient-primary shadow-elevated disabled:opacity-50"
          >
            {t("book.continue")} <ArrowRight className="h-5 w-5 ms-2 ltr:rotate-180" />
          </Button>
        </div>
      </BottomSheet>

      {/* Confirm sheet (blur backdrop + slide-up) */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            key="confirm-back"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-primary/40 backdrop-blur-md flex items-end"
            onClick={() => setConfirming(false)}
          >
            <motion.div
              key="confirm-sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 32, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card w-full max-w-md mx-auto rounded-t-[28px] p-6 shadow-xl-soft"
            >
              <div className="h-1.5 w-12 bg-muted-foreground/30 rounded-full mx-auto mb-4" />
              <h2 className="text-xl font-black tracking-tight mb-4">{t("book.confirm_title")}</h2>
              <AdSlot placement="pre_confirm" className="mb-3" />
              <div className="space-y-2.5 text-sm">
                <Row k={t("book.from")} v={pickup} icon={<MapPin className="h-4 w-4 text-primary" />} />
                <Row k={t("book.to")}   v={destination} icon={<MapPin className="h-4 w-4 text-success" />} />
                <Row k={t("book.service_short")} v={`${RIDE_TYPES[rideType].icon} ${RIDE_TYPES[rideType].label}`} />
                <Row k={t("book.distance")} v={`${distance.toFixed(1)} ${t("c.km")}`} />
                <Row k={t("book.time")}     v={`${duration} ${t("c.min")}`} />
                <div className="flex justify-between items-center pt-3 mt-1 border-t border-border">
                  <span className="font-black">{t("book.total")}</span>
                  <span className="text-3xl font-black tracking-tight text-primary">
                    {price}
                    <span className="text-sm text-muted-foreground mr-1">{t("c.currency")}</span>
                  </span>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setConfirming(false)}>{t("book.edit")}</Button>
                <Button className="flex-1 h-12 rounded-xl bg-gradient-primary shadow-elevated" onClick={handleConfirm} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : t("book.confirm")}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FieldRow({
  icon, value, onChange, placeholder, trailing,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/70 border border-border px-3 h-12">
      <div className="shrink-0 grid place-items-center">{icon}</div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full bg-transparent border-0 px-0 focus-visible:ring-0 shadow-none text-sm font-semibold"
      />
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

function Row({ k, v, icon }: { k: string; v: string; icon?: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 items-start">
      <span className="text-muted-foreground flex items-center gap-1.5">{icon}{k}</span>
      <span className="font-bold text-end flex-1">{v}</span>
    </div>
  );
}
