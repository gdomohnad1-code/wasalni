import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, RotateCcw, Star } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RIDE_TYPES, type RideTypeKey } from "@/lib/pricing";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/trips")({
  component: TripsPage,
});

function TripsPage() {
  const [rides, setRides] = useState<any[]>([]);
  const [pendingRatings, setPendingRatings] = useState<Record<string, number>>({});
  const [pendingComments, setPendingComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t, locale } = useI18n();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("rides").select("*").eq("rider_id", user.id).order("created_at", { ascending: false });
      setRides(data || []);
    })();
  }, []);

  const rebook = async (r: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("rides").insert({
      rider_id: user.id,
      pickup_address: r.pickup_address,
      destination_address: r.destination_address,
      ride_type: r.ride_type,
      distance_km: r.distance_km,
      duration_min: r.duration_min,
      price: r.price,
      status: "searching",
    }).select().single();
    if (error) return toast.error(error.message);
    toast.success(t("trips.rebooking"));
    navigate({ to: "/ride/$id", params: { id: data.id } });
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-gradient-hero text-primary-foreground p-6 rounded-b-3xl">
        <h1 className="font-bold text-xl">{t("trips.title")}</h1>
        <p className="opacity-90 text-sm">{rides.length} {t("trips.count_unit")}</p>
      </div>

      <div className="p-4 space-y-3">
        {rides.length === 0 && <p className="text-center text-muted-foreground py-10">{t("trips.empty")}</p>}
        {rides.map((r, i) => {
          const type = RIDE_TYPES[r.ride_type as RideTypeKey];
          return (
            <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-card rounded-2xl p-4 shadow-card">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-bold">
                  {type?.icon} {type?.label}
                </span>
                <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString(locale)}</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2"><MapPin className="h-3 w-3 text-primary" /> {r.pickup_address}</div>
                <div className="flex items-center gap-2"><MapPin className="h-3 w-3 text-destructive" /> {r.destination_address}</div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">{r.price} {t("c.currency")}</span>
                  {r.rating && <span className="flex items-center gap-0.5 text-xs"><Star className="h-3 w-3 fill-warning text-warning" /> {r.rating}</span>}
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{r.status}</span>
                </div>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => rebook(r)}>
                    <RotateCcw className="h-3 w-3 ms-1" /> {t("trips.rebook")}
                  </Button>
                </div>
              </div>
              {!r.rating && (() => {
                const stars = pendingRatings[r.id] || 0;
                const comment = pendingComments[r.id] || "";
                const lowRating = stars > 0 && stars < 3;
                const submitRating = async (asComplaint: boolean) => {
                  if (!stars) return;
                  setSubmitting(r.id);
                  const { error } = await supabase.from("rides").update({ rating: stars, rating_comment: comment || null }).eq("id", r.id);
                  if (error) { setSubmitting(null); return toast.error(error.message); }
                  if (asComplaint) {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                      const { error: cErr } = await supabase.from("complaints").insert({
                        user_id: user.id,
                        ride_id: r.id,
                        category: "ride_rating",
                        subject: `شكوى على رحلة (${stars} نجوم)`,
                        message: comment || "تقييم منخفض بدون تفاصيل",
                        priority: stars === 1 ? "high" : "medium",
                      });
                      if (cErr) { setSubmitting(null); return toast.error(cErr.message); }
                    }
                  }
                  setSubmitting(null);
                  toast.success(asComplaint ? "تم إرسال الشكوى" : "شكرًا لتقييمك");
                  setRides((rs) => rs.map((x) => (x.id === r.id ? { ...x, rating: stars, rating_comment: comment || null } : x)));
                  setPendingRatings((p) => { const { [r.id]: _, ...rest } = p; return rest; });
                  setPendingComments((p) => { const { [r.id]: _, ...rest } = p; return rest; });
                  if (asComplaint) navigate({ to: "/support" });
                };
                return (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1" dir="ltr">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <button key={n} type="button"
                            onClick={() => setPendingRatings((p) => ({ ...p, [r.id]: n }))}
                            className="p-0.5" aria-label={`${n} stars`}>
                            <Star className={`h-5 w-5 ${n <= stars ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                          </button>
                        ))}
                      </div>
                      {!lowRating && (
                        <Button size="sm" disabled={!stars || submitting === r.id} onClick={() => submitRating(false)}>
                          قيّم
                        </Button>
                      )}
                    </div>
                    {lowRating && (
                      <div className="space-y-2">
                        <Textarea
                          value={comment}
                          onChange={(e) => setPendingComments((p) => ({ ...p, [r.id]: e.target.value }))}
                          placeholder="اكتب سبب التقييم المنخفض..."
                          rows={3}
                          className="text-sm"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" disabled={submitting === r.id} onClick={() => submitRating(false)}>
                            قيّم
                          </Button>
                          <Button size="sm" variant="destructive" disabled={submitting === r.id} onClick={() => submitRating(true)}>
                            إرسال شكوى
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
