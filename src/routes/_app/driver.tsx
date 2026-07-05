import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Car, MapPin, DollarSign, Loader2, CheckCircle2, Clock, XCircle, AlertTriangle, Camera, Siren, Activity, BatteryFull, BatteryLow, BatteryCharging, Power, Navigation2, Flag, PhoneCall, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { submitDriverApplication } from "@/lib/driver-applications.functions";
import { useDriverLocationBroadcast, triggerSOS, useBatteryStatus } from "@/hooks/use-driver-location";
import { useI18n } from "@/lib/i18n";
import { DriverLiveMap, type LL } from "@/components/driver/DriverLiveMap";
import { IncomingRideModal } from "@/components/driver/IncomingRideModal";
import { DriverReadyScreen } from "@/components/driver/DriverReadyScreen";
import { ArrivalConfirmModal } from "@/components/driver/ArrivalConfirmModal";
import { RateDialog } from "@/components/RateDialog";
import { HomeDestSheet } from "@/components/driver/HomeDestSheet";

export const Route = createFileRoute("/_app/driver")({
  component: DriverPage,
});

function DriverPage() {
  const { user, roles, refresh } = useAuth();
  const isDriver = roles.includes("driver");
  const [docs, setDocs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    if (!user) return;
    supabase.from("driver_documents").select("*").eq("driver_id", user.id).maybeSingle().then(({ data }) => {
      setDocs(data);
      setLoading(false);
    });
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [user]);

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  let content: React.ReactNode;
  if (isDriver && docs?.account_status === "active") {
    content = <DriverDashboard docs={docs} setDocs={setDocs} />;
  } else {
    const status = docs?.account_status;
    if (status === "pending") content = <StatusPending docs={docs} />;
    else if (status === "rejected" && !(docs.next_attempt_at && new Date(docs.next_attempt_at).getTime() <= Date.now())) {
      content = <StatusRejected docs={docs} onReady={reload} />;
    } else {
      content = <DriverApplicationForm docs={docs} onDone={() => { refresh(); reload(); }} />;
    }
  }

  return (
    <>
      {content}
      <Link
        to="/home"
        className="fixed top-3 left-3 z-[9999] bg-black/80 text-white text-[11px] font-bold px-3 py-2 rounded-full shadow-lg backdrop-blur border border-dashed border-white/40 hover:bg-black"
      >
        👤 معاينة الراكب
      </Link>
    </>
  );
}

// ============= Status: Pending =============

function StatusPending({ docs }: { docs: any }) {
  const { t } = useI18n();
  const submitted = docs.submitted_at ? new Date(docs.submitted_at).getTime() : Date.now();
  const deadline = submitted + 48 * 60 * 60 * 1000;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const tm = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(tm); }, []);
  const remaining = Math.max(0, deadline - now);
  const hrs = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  return (
    <div className="max-w-md mx-auto p-4">
      <div className="bg-card rounded-2xl p-6 shadow-card text-center mt-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 grid place-items-center mx-auto mb-4">
          <Clock className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">{t("driver.pending_title")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("driver.pending_desc")}</p>
        <div className="bg-muted rounded-xl p-4 mb-2">
          <p className="text-xs text-muted-foreground mb-1">{t("driver.pending_remaining")}</p>
          <p className="text-2xl font-black text-primary">{hrs} {t("driver.unit_h")} : {String(mins).padStart(2, "0")} {t("driver.unit_m")}</p>
        </div>
        <p className="text-xs text-muted-foreground">{t("driver.pending_notify")}</p>
      </div>
    </div>
  );
}

// ============= Status: Rejected (cooldown) =============

function StatusRejected({ docs, onReady }: { docs: any; onReady: () => void }) {
  const { t } = useI18n();
  const target = new Date(docs.next_attempt_at).getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const tm = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= target) onReady();
    }, 1000);
    return () => clearInterval(tm);
  }, [target]);
  const remaining = Math.max(0, target - now);
  const hrs = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  return (
    <div className="max-w-md mx-auto p-4">
      <div className="bg-card rounded-2xl p-6 shadow-card text-center mt-6">
        <div className="h-20 w-20 rounded-full bg-destructive/10 grid place-items-center mx-auto mb-4">
          <XCircle className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-xl font-bold mb-2">{t("driver.rejected_title")}</h2>
        {docs.rejection_reason && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg p-3 mb-4 text-start">
            <span className="font-bold">{t("driver.rejection_reason")}</span> {docs.rejection_reason}
          </div>
        )}
        <p className="text-sm text-muted-foreground mb-4">{t("driver.rejected_desc")}</p>
        <div className="bg-muted rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">{t("driver.remaining")}</p>
          <p className="text-3xl font-black text-foreground tabular-nums">
            {String(hrs).padStart(2, "0")} : {String(mins).padStart(2, "0")} : {String(secs).padStart(2, "0")}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============= Application Form =============

const STEPS = ["الهوية", "الرخصة", "السيارة", "مراجعة"] as const;

function DriverApplicationForm({ docs, onDone }: { docs: any; onDone: () => void }) {
  const { user } = useAuth();
  const submitFn = useServerFn(submitDriverApplication);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const fieldsToFix: string[] = docs?.fields_to_fix ?? [];
  const isResubmit = docs?.account_status === "changes_requested";

  // Form state — preload existing values when resubmitting
  const [carType, setCarType] = useState(docs?.car_type ?? "");
  const [carModel, setCarModel] = useState(docs?.car_model ?? "");
  const [carPlate, setCarPlate] = useState(docs?.car_plate ?? "");
  const [urls, setUrls] = useState<Record<string, string>>({
    id_card_front_url: docs?.id_card_front_url ?? "",
    id_card_back_url: docs?.id_card_back_url ?? "",
    selfie_url: docs?.selfie_url ?? "",
    driver_license_url: docs?.driver_license_url ?? "",
    car_photo_url: docs?.car_photo_url ?? "",
    car_license_url: docs?.car_license_url ?? "",
  });

  const needsFix = (key: string) => isResubmit && fieldsToFix.includes(key);

  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const upload = async (key: string, file: File) => {
    if (!user) throw new Error("not authenticated");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${user.id}/${key}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("driver-applications").upload(path, file, { upsert: true, contentType: file.type || "image/jpeg" });
    if (error) throw error;
    setUrls((p) => ({ ...p, [key]: `driver-applications/${path}` }));
  };

  const onCapture = (key: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-picking same file
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("صورة فقط"); return; }
    // Local preview
    const localUrl = URL.createObjectURL(f);
    setPreviews((p) => { if (p[key]) URL.revokeObjectURL(p[key]); return { ...p, [key]: localUrl }; });
    setUploadingKey(key);
    try {
      await upload(key, f);
      toast.success("تم التقاط الصورة ✅");
    } catch (err: any) {
      toast.error(err.message ?? "فشل الرفع");
      setPreviews((p) => { URL.revokeObjectURL(p[key]); const n = { ...p }; delete n[key]; return n; });
    } finally {
      setUploadingKey(null);
    }
  };

  const retake = (key: string) => {
    setPreviews((p) => { if (p[key]) URL.revokeObjectURL(p[key]); const n = { ...p }; delete n[key]; return n; });
    setUrls((p) => ({ ...p, [key]: "" }));
  };

  const allFilled = useMemo(() => {
    return urls.id_card_front_url && urls.id_card_back_url && urls.selfie_url
      && urls.driver_license_url && urls.car_photo_url && urls.car_license_url
      && carType.trim() && carModel.trim() && carPlate.trim();
  }, [urls, carType, carModel, carPlate]);

  const send = async () => {
    if (!allFilled) { toast.error("املأ كل الحقول وارفع كل الصور"); return; }
    setSubmitting(true);
    try {
      // Convert stored "driver-applications/<path>" to a URL placeholder for zod url() check
      // Backend handles both signed URLs and bucket paths via `signedUrls` path logic;
      // submitter sends fully-qualified Supabase storage URL for compatibility.
      const toSubmit: Record<string, string> = {};
      const keys = ["id_card_front_url", "id_card_back_url", "selfie_url", "driver_license_url", "car_photo_url", "car_license_url"];
      for (const k of keys) {
        const v = urls[k];
        if (v.startsWith("driver-applications/")) {
          const path = v.replace(/^driver-applications\//, "");
          // Use Supabase public-style URL (private bucket → admin signs it later for viewing)
          const { data: pub } = supabase.storage.from("driver-applications").getPublicUrl(path);
          toSubmit[k] = pub.publicUrl;
        } else {
          toSubmit[k] = v;
        }
      }
      await submitFn({
        data: {
          ...toSubmit as any,
          car_type: carType.trim(),
          car_model: carModel.trim(),
          car_plate: carPlate.trim(),
        },
      });
      toast.success("تم إرسال طلبك ✅");
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "تعذّر الإرسال");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="text-center mb-4">
        <div className="text-5xl mb-2">🚗</div>
        <h1 className="font-bold text-xl">سجّل كسائق</h1>
        <p className="text-xs text-muted-foreground">{STEPS[step]} ({step + 1}/{STEPS.length})</p>
        <Progress value={((step + 1) / STEPS.length) * 100} className="mt-3 h-1.5" />
      </div>

      {isResubmit && docs?.change_request_message && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3 mb-4 text-sm flex gap-2">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold mb-1">مطلوب تعديل البيانات التالية:</p>
            <p>{docs.change_request_message}</p>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl p-5 shadow-card space-y-4">
        {step === 0 && (
          <>
            <CameraField label="صورة البطاقة (وجه)" k="id_card_front_url" url={urls.id_card_front_url} preview={previews.id_card_front_url} uploading={uploadingKey === "id_card_front_url"} onCapture={onCapture("id_card_front_url")} onRetake={() => retake("id_card_front_url")} highlight={needsFix("id_card_front_url")} />
            <CameraField label="صورة البطاقة (ظهر)" k="id_card_back_url" url={urls.id_card_back_url} preview={previews.id_card_back_url} uploading={uploadingKey === "id_card_back_url"} onCapture={onCapture("id_card_back_url")} onRetake={() => retake("id_card_back_url")} highlight={needsFix("id_card_back_url")} />
            <CameraField label="سيلفي شخصي" k="selfie_url" url={urls.selfie_url} preview={previews.selfie_url} uploading={uploadingKey === "selfie_url"} onCapture={onCapture("selfie_url")} onRetake={() => retake("selfie_url")} highlight={needsFix("selfie_url")} facing="user" />
          </>
        )}
        {step === 1 && (
          <>
            <CameraField label="رخصة القيادة (وجه)" k="driver_license_url" url={urls.driver_license_url} preview={previews.driver_license_url} uploading={uploadingKey === "driver_license_url"} onCapture={onCapture("driver_license_url")} onRetake={() => retake("driver_license_url")} highlight={needsFix("driver_license_url")} />
          </>
        )}
        {step === 2 && (
          <>
            <Field label="نوع السيارة" v={carType} setV={setCarType} placeholder="سيدان / SUV / هاتشباك" highlight={needsFix("car_type")} />
            <Field label="موديل السيارة" v={carModel} setV={setCarModel} placeholder="هيونداي اكسنت 2020" highlight={needsFix("car_model")} />
            <Field label="رقم اللوحة" v={carPlate} setV={setCarPlate} placeholder="أ ب ج 1234" highlight={needsFix("car_plate")} />
            <CameraField label="صورة السيارة" k="car_photo_url" url={urls.car_photo_url} preview={previews.car_photo_url} uploading={uploadingKey === "car_photo_url"} onCapture={onCapture("car_photo_url")} onRetake={() => retake("car_photo_url")} highlight={needsFix("car_photo_url")} />
            <CameraField label="رخصة السيارة" k="car_license_url" url={urls.car_license_url} preview={previews.car_license_url} uploading={uploadingKey === "car_license_url"} onCapture={onCapture("car_license_url")} onRetake={() => retake("car_license_url")} highlight={needsFix("car_license_url")} />
          </>
        )}
        {step === 3 && (
          <div className="space-y-3 text-sm">
            <p className="text-center text-muted-foreground">راجع البيانات قبل الإرسال:</p>
            <SummaryRow label="نوع السيارة" v={carType} />
            <SummaryRow label="الموديل" v={carModel} />
            <SummaryRow label="رقم اللوحة" v={carPlate} />
            <SummaryRow label="الصور المرفوعة" v={Object.values(urls).filter(Boolean).length + " / 6"} />
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {step > 0 && (
            <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)}>السابق</Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button className="flex-1 bg-gradient-primary" onClick={() => setStep((s) => s + 1)}>التالي</Button>
          ) : (
            <Button onClick={send} disabled={submitting || !allFilled} className="flex-1 h-12 bg-gradient-primary font-bold">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "إرسال الطلب"}
            </Button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-center text-muted-foreground mt-3">
        المراجعة خلال 48 ساعة. ستصلك إشعار فور الانتهاء.
      </p>
    </div>
  );
}

function Field({ label, v, setV, placeholder, highlight }: { label: string; v: string; setV: (s: string) => void; placeholder?: string; highlight?: boolean }) {
  return (
    <div>
      <Label className={highlight ? "text-destructive" : ""}>{label} {highlight && <span className="text-[10px]">(يلزم التعديل)</span>}</Label>
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className={highlight ? "border-destructive" : ""} />
    </div>
  );
}

function CameraField({ label, k, url, preview, uploading, onCapture, onRetake, highlight, facing = "environment" }: {
  label: string; k: string; url: string; preview?: string; uploading?: boolean;
  onCapture: (e: React.ChangeEvent<HTMLInputElement>) => void; onRetake: () => void;
  highlight?: boolean; facing?: "environment" | "user";
}) {
  const has = Boolean(url) || Boolean(preview);
  const inputId = `cam-${k}`;
  return (
    <div>
      <Label className={highlight ? "text-destructive" : ""}>
        {label} {highlight && <span className="text-[10px]">(يلزم التعديل)</span>}
      </Label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture={facing}
        className="hidden"
        onChange={onCapture}
      />
      {has ? (
        <div className={`relative rounded-xl overflow-hidden border-2 ${highlight ? "border-destructive" : "border-primary"} bg-black/5`}>
          {preview && <img src={preview} alt={label} className="w-full h-44 object-cover" />}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> جاري الرفع...
            </div>
          )}
          {!uploading && url && (
            <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[11px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> تم
            </div>
          )}
          <div className="p-2 flex gap-2 bg-card">
            <Button type="button" variant="outline" size="sm" className="flex-1 gap-1" onClick={onRetake} disabled={uploading}>
              <Camera className="h-4 w-4" /> إعادة التصوير
            </Button>
          </div>
        </div>
      ) : (
        <label htmlFor={inputId} className="cursor-pointer block">
          <div className={`border-2 border-dashed rounded-xl p-6 text-center transition ${
            highlight ? "border-destructive bg-destructive/5" : "border-border hover:border-primary hover:bg-primary/5"
          }`}>
            <Camera className={`h-8 w-8 mx-auto mb-2 ${highlight ? "text-destructive" : "text-muted-foreground"}`} />
            <div className="text-sm font-bold">افتح الكاميرا والتقط صورة</div>
            <div className="text-[11px] text-muted-foreground mt-1">تصوير مباشر — غير مسموح بالرفع من المعرض</div>
          </div>
        </label>
      )}
    </div>
  );
}

function SummaryRow({ label, v }: { label: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-border py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{v || "—"}</span>
    </div>
  );
}


// ============= Driver Dashboard (Uber-style) =============

const READY_KEY = (uid: string) => `wsl_driver_ready_seen_${uid}`;
const DECLINED_KEY = "wsl_declined_rides";

function loadDeclined(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DECLINED_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}
function saveDeclined(s: Set<string>) {
  try { sessionStorage.setItem(DECLINED_KEY, JSON.stringify([...s])); } catch {}
}

function distKm(a: LL, b: LL) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function aggregateHotspots(rides: any[], cellSize = 0.01) {
  const cells = new Map<string, { lat: number; lng: number; count: number }>();
  rides.forEach((r) => {
    if (!r.pickup_lat || !r.pickup_lng) return;
    const key = `${Math.round(r.pickup_lat / cellSize)},${Math.round(r.pickup_lng / cellSize)}`;
    const cur = cells.get(key);
    if (cur) {
      cur.count++;
      cur.lat = (cur.lat * (cur.count - 1) + Number(r.pickup_lat)) / cur.count;
      cur.lng = (cur.lng * (cur.count - 1) + Number(r.pickup_lng)) / cur.count;
    } else {
      cells.set(key, { lat: Number(r.pickup_lat), lng: Number(r.pickup_lng), count: 1 });
    }
  });
  return [...cells.values()]
    .filter((c) => c.count >= 2)
    .map((c) => ({ lat: c.lat, lng: c.lng, weight: Math.min(c.count - 1, 5) }));
}

function DriverDashboard({ docs, setDocs }: { docs: any; setDocs: (d: any) => void }) {
  const { user } = useAuth();
  const [showReady, setShowReady] = useState(false);
  const [pos, setPos] = useState<LL | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [searchingRides, setSearchingRides] = useState<any[]>([]);
  const [activeRide, setActiveRide] = useState<any>(null);
  const [earnings, setEarnings] = useState({ today: 0, total: 0, rides: 0 });
  const [incoming, setIncoming] = useState<any | null>(null);
  const [sosLoading, setSosLoading] = useState(false);
  const [arrivalPrompt, setArrivalPrompt] = useState<null | "pickup" | "destination">(null);
  const arrivalFiredRef = useRef<Set<string>>(new Set());
  const declinedRef = useRef<Set<string>>(loadDeclined());
  const [rateRideId, setRateRideId] = useState<string | null>(null);
  const [unratedRides, setUnratedRides] = useState<any[]>([]);
  const [homeSheetOpen, setHomeSheetOpen] = useState(false);

  const isOnline = !!docs.is_online;
  const presence: "available" | "busy" | "offline" =
    !isOnline ? "offline" : activeRide ? "busy" : "available";

  useEffect(() => {
    if (!user) return;
    if (docs.approved && docs.account_status === "active" && !localStorage.getItem(READY_KEY(user.id))) {
      setShowReady(true);
    }
  }, [user?.id]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPos({ lat: 30.0444, lng: 31.2357 });
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        if (p.coords.heading != null && !isNaN(p.coords.heading)) setHeading(p.coords.heading);
      },
      () => setPos((cur) => cur ?? { lat: 30.0444, lng: 31.2357 }),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  useDriverLocationBroadcast({ enabled: isOnline, presence, rideId: activeRide?.id ?? null });
  const battery = useBatteryStatus();

  const load = async () => {
    if (!user) return;
    const [av, ac, comp, today, unrated] = await Promise.all([
      supabase.from("rides").select("*").eq("status", "searching").order("created_at", { ascending: false }).limit(50),
      supabase.from("rides").select("*").eq("driver_id", user.id).in("status", ["accepted", "in_progress"]).maybeSingle(),
      supabase.from("rides").select("price").eq("driver_id", user.id).eq("status", "completed"),
      supabase.from("rides").select("price, completed_at").eq("driver_id", user.id).eq("status", "completed").gte("completed_at", new Date(new Date().setHours(0,0,0,0)).toISOString()),
      supabase.from("rides").select("id, pickup_address, destination_address, completed_at, price").eq("driver_id", user.id).eq("status", "completed").is("driver_rating", null).order("completed_at", { ascending: false }).limit(10),
    ]);
    setSearchingRides(av.data || []);
    setActiveRide(ac.data || null);
    const totalE = (comp.data || []).reduce((s: number, r: any) => s + Number(r.price || 0), 0) * 0.8;
    const todayE = (today.data || []).reduce((s: number, r: any) => s + Number(r.price || 0), 0) * 0.8;
    setEarnings({ today: todayE, total: totalE, rides: (today.data || []).length });
    setUnratedRides(unrated.data || []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("driver-rides-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const hotspots = useMemo(() => aggregateHotspots(searchingRides), [searchingRides]);

  useEffect(() => {
    if (!isOnline || activeRide || incoming || !pos) return;
    const homeOn = !!docs?.home_mode_active && docs?.home_dest_lat != null && docs?.home_dest_lng != null;
    const home: LL | null = homeOn ? { lat: Number(docs.home_dest_lat), lng: Number(docs.home_dest_lng) } : null;
    const candidates = searchingRides
      .filter((r) => !declinedRef.current.has(r.id) && r.pickup_lat && r.pickup_lng && r.rider_id !== user?.id)
      .map((r) => ({ r, d: distKm(pos, { lat: Number(r.pickup_lat), lng: Number(r.pickup_lng) }) }))
      .filter((x) => x.d < 15)
      .filter(({ r }) => {
        // Destination-match filter: only rides that move driver closer to home
        if (!home || !r.destination_lat || !r.destination_lng) return true;
        const pickup: LL = { lat: Number(r.pickup_lat), lng: Number(r.pickup_lng) };
        const dest: LL = { lat: Number(r.destination_lat), lng: Number(r.destination_lng) };
        const dPickupHome = distKm(pickup, home);
        const dDestHome = distKm(dest, home);
        // Ride is "on the way home" if the destination is at least 2km closer to home than the pickup,
        // OR the destination is already within 5km of home (final leg).
        return dPickupHome - dDestHome > 2 || dDestHome < 5;
      })
      .sort((a, b) => a.d - b.d);
    if (candidates.length) setIncoming(candidates[0].r);
  }, [searchingRides, isOnline, activeRide, incoming, pos, user?.id, docs?.home_mode_active, docs?.home_dest_lat, docs?.home_dest_lng]);

  const acceptIncoming = async () => {
    if (!incoming || !user) return;
    const ride = incoming;
    setIncoming(null);
    const { error } = await supabase.from("rides").update({
      driver_id: user.id, status: "accepted", accepted_at: new Date().toISOString(),
    }).eq("id", ride.id).eq("status", "searching");
    if (error) { toast.error("الرحلة تم أخذها بالفعل"); return; }
    toast.success("قبلت الرحلة ✅");
    load();
  };

  const dismissIncoming = () => {
    if (incoming) {
      declinedRef.current.add(incoming.id);
      saveDeclined(declinedRef.current);
    }
    setIncoming(null);
  };

  const startTrip = async () => {
    if (!activeRide) return;
    await supabase.from("rides").update({ status: "in_progress", started_at: new Date().toISOString() }).eq("id", activeRide.id);
    toast.success("بدأت الرحلة");
  };
  const endTrip = async () => {
    if (!activeRide) return;
    const endedId = activeRide.id;
    await supabase.from("rides").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", endedId);
    toast.success("تم إنهاء الرحلة 💰");
    setRateRideId(endedId);
  };

  const toggleOnline = async (v: boolean) => {
    if (!user) return;
    await supabase.from("driver_documents").update({ is_online: v }).eq("driver_id", user.id);
    setDocs({ ...docs, is_online: v });
    toast.success(v ? "أنت الآن متاح للعمل" : "تم إيقاف الاستقبال");
  };

  const saveHomeDest = async ({ address, coords }: { address: string; coords: LL }) => {
    if (!user) return;
    const { error } = await supabase.from("driver_documents").update({
      home_dest_address: address,
      home_dest_lat: coords.lat,
      home_dest_lng: coords.lng,
      home_mode_active: true,
    }).eq("driver_id", user.id);
    if (error) { toast.error("تعذر الحفظ"); return; }
    setDocs({ ...docs, home_dest_address: address, home_dest_lat: coords.lat, home_dest_lng: coords.lng, home_mode_active: true });
  };

  const toggleHomeMode = async () => {
    if (!user) return;
    if (!docs?.home_dest_lat) { setHomeSheetOpen(true); return; }
    const next = !docs.home_mode_active;
    await supabase.from("driver_documents").update({ home_mode_active: next }).eq("driver_id", user.id);
    setDocs({ ...docs, home_mode_active: next });
    toast.success(next ? "تم تفعيل وضع مروّح لبيتي 🏠" : "تم إيقاف وضع مروّح لبيتي");
  };

  const sendSOS = async () => {
    if (!confirm("سيتم إرسال إشارة طوارئ إلى الإدارة. هل أنت متأكد؟")) return;
    setSosLoading(true);
    const { error } = await triggerSOS("طلب طوارئ من السائق");
    setSosLoading(false);
    if (error) return toast.error("تعذر إرسال SOS");
    toast.success("تم إرسال إشارة الطوارئ");
  };

  const closeReady = () => {
    if (user) localStorage.setItem(READY_KEY(user.id), "1");
    setShowReady(false);
    if (!isOnline) toggleOnline(true);
  };

  const phase: "idle" | "to_pickup" | "in_progress" = !activeRide
    ? "idle"
    : activeRide.status === "accepted" ? "to_pickup" : "in_progress";

  const pickup: LL | null = activeRide?.pickup_lat ? { lat: Number(activeRide.pickup_lat), lng: Number(activeRide.pickup_lng) } : null;
  const destination: LL | null = activeRide?.destination_lat ? { lat: Number(activeRide.destination_lat), lng: Number(activeRide.destination_lng) } : null;
  const routeTo: LL | null = phase === "to_pickup" ? pickup : phase === "in_progress" ? destination : null;
  const distToTarget = pos && routeTo ? distKm(pos, routeTo) : 0;
  const etaMin = Math.max(1, Math.ceil((distToTarget / 35) * 60));

  // Auto-detect arrival within ~120m and prompt the driver to confirm
  useEffect(() => {
    if (!activeRide || !routeTo || !pos) return;
    if (phase !== "to_pickup" && phase !== "in_progress") return;
    const key = `${activeRide.id}:${phase}`;
    if (arrivalFiredRef.current.has(key)) return;
    if (distToTarget <= 0.12) {
      arrivalFiredRef.current.add(key);
      setArrivalPrompt(phase === "to_pickup" ? "pickup" : "destination");
      try {
        new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=").play().catch(() => {});
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      } catch { /* ignore */ }
    }
  }, [distToTarget, phase, activeRide?.id, routeTo, pos]);

  const confirmArrival = async () => {
    if (arrivalPrompt === "pickup") await startTrip();
    else if (arrivalPrompt === "destination") await endTrip();
    setArrivalPrompt(null);
  };

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" dir="rtl">
      <DriverLiveMap
        driver={pos}
        heading={heading}
        hotspots={isOnline && !activeRide ? hotspots : []}
        pickup={pickup}
        destination={phase === "in_progress" ? destination : null}
        routeTo={routeTo}
        className="absolute inset-0"
      />

      <div className="absolute top-0 inset-x-0 z-20 p-4 pointer-events-none">
        <div className="flex justify-between items-start gap-3 pointer-events-auto">
          <div className="bg-black/80 backdrop-blur-md text-white rounded-2xl px-4 py-3 shadow-xl flex items-center gap-3">
            <button
              onClick={() => toggleOnline(!isOnline)}
              className={`h-11 w-11 rounded-full grid place-items-center transition ${isOnline ? "bg-emerald-500" : "bg-gray-700"}`}
              aria-label="toggle online"
            >
              <Power className="h-5 w-5" />
            </button>
            <div>
              <div className="text-[10px] uppercase opacity-60 tracking-widest">الحالة</div>
              <div className="font-black text-sm flex items-center gap-1.5">
                {isOnline ? (
                  <><span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> متاح</>
                ) : "غير متاح"}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-end">
            <div className="bg-black/80 backdrop-blur-md text-white rounded-2xl px-4 py-2 shadow-xl text-end">
              <div className="text-[10px] uppercase opacity-60 tracking-widest">أرباح اليوم</div>
              <div className="font-black text-lg leading-tight">{earnings.today.toFixed(0)} ج.م</div>
              <div className="text-[10px] opacity-70">{earnings.rides} رحلة</div>
            </div>
            <button
              onClick={sendSOS}
              disabled={sosLoading}
              className="h-10 w-10 rounded-full bg-red-500 hover:bg-red-600 grid place-items-center shadow-xl text-white"
              aria-label="SOS"
            >
              <Siren className="h-4 w-4" />
            </button>
          </div>
        </div>

        {battery && !battery.charging && battery.level <= 0.2 && (
          <div className="mt-2 mx-auto w-fit bg-red-500/90 text-white text-xs px-3 py-1 rounded-full flex items-center gap-1.5 pointer-events-auto">
            <BatteryLow className="h-3.5 w-3.5" /> بطارية {Math.round(battery.level * 100)}% — وضع توفير
          </div>
        )}
      </div>

      <div className="absolute bottom-0 inset-x-0 z-20">
        {!activeRide && (
          <IdlePanel
            isOnline={isOnline}
            searchingCount={searchingRides.filter((r) => r.rider_id !== user?.id).length}
            hotspotCount={hotspots.length}
            todayEarnings={earnings.today}
            totalRides={earnings.rides}
            car={`${docs.car_model || ""} · ${docs.car_plate || ""}`}
            homeMode={!!docs?.home_mode_active}
            homeAddress={docs?.home_dest_address ?? null}
            onSetHome={() => setHomeSheetOpen(true)}
            onToggleHome={toggleHomeMode}
          />
        )}
        {activeRide && phase === "to_pickup" && pickup && (
          <ToPickupPanel
            address={activeRide.pickup_address}
            distanceKm={distToTarget}
            etaMin={etaMin}
            target={pickup}
            onArrived={startTrip}
          />
        )}
        {activeRide && phase === "in_progress" && destination && (
          <InTripPanel
            address={activeRide.destination_address}
            distanceKm={distToTarget}
            etaMin={etaMin}
            price={activeRide.price}
            target={destination}
            onEnd={endTrip}
          />
        )}
      </div>

      <IncomingRideModal
        open={!!incoming}
        etaToPickupSec={
          incoming && pos
            ? (distKm(pos, { lat: Number(incoming.pickup_lat), lng: Number(incoming.pickup_lng) }) / 35) * 3600
            : 0
        }
        distanceToPickupKm={
          incoming && pos
            ? distKm(pos, { lat: Number(incoming.pickup_lat), lng: Number(incoming.pickup_lng) })
            : 0
        }
        rideDistanceKm={Number(incoming?.distance_km || 0)}
        onAccept={acceptIncoming}
        onDismiss={dismissIncoming}
      />

      <ArrivalConfirmModal
        open={!!arrivalPrompt}
        kind={arrivalPrompt ?? "pickup"}
        address={arrivalPrompt === "pickup" ? activeRide?.pickup_address ?? "" : activeRide?.destination_address ?? ""}
        onConfirm={confirmArrival}
        onDismiss={() => setArrivalPrompt(null)}
      />


      {!activeRide && unratedRides.length > 0 && (
        <div className="fixed top-20 inset-x-0 z-30 px-3 pointer-events-none">
          <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 rounded-2xl p-3 shadow-card pointer-events-auto">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs">
                <div className="font-bold text-amber-900">عندك {unratedRides.length} تقييم معلّق</div>
                <div className="text-amber-700 truncate max-w-[200px]">
                  آخر رحلة: {unratedRides[0].destination_address}
                </div>
              </div>
              <Button size="sm" onClick={() => setRateRideId(unratedRides[0].id)} className="bg-gradient-primary">
                قيّم العميل
              </Button>
            </div>
          </div>
        </div>
      )}

      {rateRideId && (
        <RateDialog
          open={!!rateRideId}
          onClose={() => setRateRideId(null)}
          rideId={rateRideId}
          role="driver"
          onDone={() => {
            setUnratedRides((rs) => rs.filter((x) => x.id !== rateRideId));
            load();
          }}
        />
      )}

      {showReady && <DriverReadyScreen onStart={closeReady} name={user?.user_metadata?.full_name?.split(" ")[0]} />}
    </div>
  );
}

function IdlePanel({ isOnline, searchingCount, hotspotCount, totalRides, car, homeMode, homeAddress, onSetHome, onToggleHome }: {
  isOnline: boolean; searchingCount: number; hotspotCount: number;
  todayEarnings: number; totalRides: number; car: string;
  homeMode: boolean; homeAddress: string | null;
  onSetHome: () => void; onToggleHome: () => void;
}) {
  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="bg-white rounded-t-3xl shadow-2xl p-5 pb-7"
    >
      <div className="h-1.5 w-12 bg-gray-200 rounded-full mx-auto mb-4" />
      {!isOnline ? (
        <div className="text-center py-2">
          <p className="text-lg font-black">اضغط على زر التشغيل لاستقبال الرحلات</p>
          <p className="text-sm text-gray-500 mt-1">{car}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="h-12 w-12 rounded-full bg-emerald-100 grid place-items-center"
            >
              <Activity className="h-6 w-6 text-emerald-600" />
            </motion.div>
            <div className="flex-1">
              <p className="font-black text-base">
                {homeMode ? "🏠 مروّح لبيتي — طلبات على الطريق بس" : "في انتظار طلبات الرحلات..."}
              </p>
              <p className="text-xs text-gray-500">{car}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Pill icon={<Clock className="h-3.5 w-3.5" />} label="طلبات قريبة" value={String(searchingCount)} />
            <Pill icon={<MapPin className="h-3.5 w-3.5" />} label="مناطق مزدحمة" value={String(hotspotCount)} accent="red" />
            <Pill icon={<DollarSign className="h-3.5 w-3.5" />} label="رحلات اليوم" value={String(totalRides)} />
          </div>

          {/* وجهة مروّح — Destination match toggle */}
          <div className={`mt-3 rounded-2xl p-3 border flex items-center gap-3 ${homeMode ? "bg-primary/5 border-primary/30" : "bg-gray-50 border-gray-200"}`}>
            <button
              type="button"
              onClick={onToggleHome}
              className={`h-11 w-11 rounded-2xl grid place-items-center shrink-0 transition ${homeMode ? "bg-primary text-primary-foreground shadow-md" : "bg-white text-gray-500 border border-gray-200"}`}
              aria-label="وجهة مروّح"
            >
              <Home className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="font-black text-[13px] leading-tight">
                {homeMode ? "وضع مروّح لبيتي شغّال" : "وجهة مروّح"}
              </div>
              <div className="text-[11px] text-gray-500 leading-tight truncate">
                {homeAddress
                  ? homeAddress
                  : "حدد بيتك — هنبعتلك الطلبات اللي على الطريق بس"}
              </div>
            </div>
            <button
              type="button"
              onClick={onSetHome}
              className="text-[11px] font-bold text-primary underline underline-offset-2 shrink-0"
            >
              {homeAddress ? "تغيير" : "حدد"}
            </button>
          </div>

          {hotspotCount > 0 && (
            <div className="mt-3 bg-red-50 border border-red-100 rounded-xl p-2.5 text-xs text-red-700 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              الدوائر الحمراء على الخريطة = مناطق فيها طلبات كتيرة الآن
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

function Pill({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "red" }) {
  return (
    <div className={`rounded-xl p-2.5 text-center ${accent === "red" ? "bg-red-50" : "bg-gray-50"}`}>
      <div className={`flex items-center justify-center gap-1 text-[10px] ${accent === "red" ? "text-red-600" : "text-gray-500"}`}>{icon}{label}</div>
      <div className={`font-black text-base mt-0.5 ${accent === "red" ? "text-red-700" : ""}`}>{value}</div>
    </div>
  );
}

function navUrl(t: LL) {
  // Prefer Google Maps turn-by-turn; falls back to web on desktop
  return `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}&travelmode=driving&dir_action=navigate`;
}
function wazeNavUrl(t: LL) {
  return `https://waze.com/ul?ll=${t.lat},${t.lng}&navigate=yes`;
}

function NavButtons({ target }: { target: LL }) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-3">
      <a
        href={navUrl(target)}
        target="_blank"
        rel="noopener noreferrer"
        className="h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <Navigation2 className="h-4 w-4" /> Google Maps
      </a>
      <a
        href={wazeNavUrl(target)}
        target="_blank"
        rel="noopener noreferrer"
        className="h-12 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <Navigation2 className="h-4 w-4" /> Waze
      </a>
    </div>
  );
}

function ToPickupPanel({ address, distanceKm, etaMin, target, onArrived }: {
  address: string; distanceKm: number; etaMin: number; target: LL; onArrived: () => void;
}) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="bg-white rounded-t-3xl shadow-2xl p-5 pb-7"
    >
      <div className="h-1.5 w-12 bg-gray-200 rounded-full mx-auto mb-4" />
      <div className="flex items-center gap-3 mb-4">
        <div className="h-12 w-12 rounded-full bg-emerald-500 grid place-items-center">
          <Navigation2 className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">في الطريق إلى الراكب</p>
          <p className="font-black text-base line-clamp-1">{address}</p>
        </div>
        <button className="h-11 w-11 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center" aria-label="call">
          <PhoneCall className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Pill icon={<Clock className="h-3.5 w-3.5" />} label="الوصول" value={`${etaMin} د`} />
        <Pill icon={<MapPin className="h-3.5 w-3.5" />} label="المسافة" value={`${distanceKm.toFixed(1)} كم`} />
      </div>
      <NavButtons target={target} />
      <Button onClick={onArrived} className="w-full h-14 text-base font-black bg-black hover:bg-gray-900 text-white rounded-2xl">
        <Car className="h-5 w-5 ml-2" /> الراكب ركب — بدء الرحلة
      </Button>
    </motion.div>
  );
}

function InTripPanel({ address, distanceKm, etaMin, price, target, onEnd }: {
  address: string; distanceKm: number; etaMin: number; price: number; target: LL; onEnd: () => void;
}) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="bg-white rounded-t-3xl shadow-2xl p-5 pb-7"
    >
      <div className="h-1.5 w-12 bg-gray-200 rounded-full mx-auto mb-4" />
      <div className="flex items-center gap-3 mb-4">
        <div className="h-12 w-12 rounded-full bg-blue-500 grid place-items-center">
          <Flag className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">رحلة جارية</p>
          <p className="font-black text-base line-clamp-1">{address}</p>
        </div>
        <div className="text-end">
          <p className="text-[10px] text-gray-500">السعر</p>
          <p className="font-black text-emerald-600">{Number(price || 0).toFixed(0)} ج.م</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Pill icon={<Clock className="h-3.5 w-3.5" />} label="الوصول" value={`${etaMin} د`} />
        <Pill icon={<MapPin className="h-3.5 w-3.5" />} label="المسافة" value={`${distanceKm.toFixed(1)} كم`} />
      </div>
      <NavButtons target={target} />
      <Button onClick={onEnd} className="w-full h-14 text-base font-black bg-red-500 hover:bg-red-600 text-white rounded-2xl">
        <Flag className="h-5 w-5 ml-2" /> إنهاء الرحلة
      </Button>
    </motion.div>
  );
}
