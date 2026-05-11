import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Car, MapPin, DollarSign, Loader2, CheckCircle2, Clock, XCircle, AlertTriangle, Camera, Upload, Siren, Activity, BatteryFull, BatteryLow, BatteryCharging } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { submitDriverApplication } from "@/lib/driver-applications.functions";
import { RIDE_TYPES, type RideTypeKey } from "@/lib/pricing";
import { useDriverLocationBroadcast, triggerSOS, useBatteryStatus } from "@/hooks/use-driver-location";

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

  // Active driver → dashboard
  if (isDriver && docs?.account_status === "active") {
    return <DriverDashboard docs={docs} setDocs={setDocs} />;
  }

  // Status screens for application lifecycle
  const status = docs?.account_status;
  if (status === "pending") return <StatusPending docs={docs} />;
  if (status === "rejected") {
    const ready = docs.next_attempt_at && new Date(docs.next_attempt_at).getTime() <= Date.now();
    if (!ready) return <StatusRejected docs={docs} onReady={reload} />;
  }
  // changes_requested OR rejected-but-cooldown-passed OR no record yet → show form
  return <DriverApplicationForm docs={docs} onDone={() => { refresh(); reload(); }} />;
}

// ============= Status: Pending =============

function StatusPending({ docs }: { docs: any }) {
  const submitted = docs.submitted_at ? new Date(docs.submitted_at).getTime() : Date.now();
  const deadline = submitted + 48 * 60 * 60 * 1000;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const remaining = Math.max(0, deadline - now);
  const hrs = Math.floor(remaining / 3600000);
  const mins = Math.floor((remaining % 3600000) / 60000);
  return (
    <div className="max-w-md mx-auto p-4">
      <div className="bg-card rounded-2xl p-6 shadow-card text-center mt-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 grid place-items-center mx-auto mb-4">
          <Clock className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">طلبك قيد المراجعة</h2>
        <p className="text-sm text-muted-foreground mb-4">
          تم استلام طلب الانضمام كسائق وفريقنا يراجع البيانات. سيتم الرد خلال 48 ساعة.
        </p>
        <div className="bg-muted rounded-xl p-4 mb-2">
          <p className="text-xs text-muted-foreground mb-1">الوقت المتبقي للمراجعة</p>
          <p className="text-2xl font-black text-primary">{hrs} س : {String(mins).padStart(2, "0")} د</p>
        </div>
        <p className="text-xs text-muted-foreground">سنرسل لك إشعاراً فور الانتهاء من المراجعة.</p>
      </div>
    </div>
  );
}

// ============= Status: Rejected (cooldown) =============

function StatusRejected({ docs, onReady }: { docs: any; onReady: () => void }) {
  const target = new Date(docs.next_attempt_at).getTime();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= target) onReady();
    }, 1000);
    return () => clearInterval(t);
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
        <h2 className="text-xl font-bold mb-2">تم رفض طلبك</h2>
        {docs.rejection_reason && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-lg p-3 mb-4 text-right">
            <span className="font-bold">السبب:</span> {docs.rejection_reason}
          </div>
        )}
        <p className="text-sm text-muted-foreground mb-4">
          يمكنك إعادة التقديم بعد انتهاء المدة التالية:
        </p>
        <div className="bg-muted rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">الوقت المتبقي</p>
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


function DriverDashboard({ docs, setDocs }: { docs: any; setDocs: (d: any) => void }) {
  const { user } = useAuth();
  const [available, setAvailable] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [earnings, setEarnings] = useState(0);
  const [tab, setTab] = useState("available");
  const [sosLoading, setSosLoading] = useState(false);

  const isOnline = !!docs.is_online;
  const currentRide = active[0]?.id ?? null;
  const presence: "available" | "busy" | "offline" =
    !isOnline ? "offline" : currentRide ? "busy" : "available";

  // Live location broadcast (every 8s while online)
  useDriverLocationBroadcast({ enabled: isOnline, presence, rideId: currentRide });
  const battery = useBatteryStatus();

  const load = async () => {
    if (!user) return;
    const [av, ac, comp] = await Promise.all([
      supabase.from("rides").select("*").eq("status", "searching").order("created_at", { ascending: false }).limit(20),
      supabase.from("rides").select("*").eq("driver_id", user.id).in("status", ["accepted", "in_progress"]).order("created_at", { ascending: false }),
      supabase.from("rides").select("price").eq("driver_id", user.id).eq("status", "completed"),
    ]);
    setAvailable(av.data || []);
    setActive(ac.data || []);
    setEarnings((comp.data || []).reduce((s: number, r: any) => s + Number(r.price || 0), 0) * 0.8);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("driver-rides")
      .on("postgres_changes", { event: "*", schema: "public", table: "rides" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const accept = async (r: any) => {
    if (!user) return;
    const { error } = await supabase.from("rides").update({
      driver_id: user.id, status: "accepted", accepted_at: new Date().toISOString(),
    }).eq("id", r.id).eq("status", "searching");
    if (error) return toast.error(error.message);
    toast.success("قبلت الرحلة");
  };

  const toggleOnline = async (v: boolean) => {
    if (!user) return;
    await supabase.from("driver_documents").update({ is_online: v }).eq("driver_id", user.id);
    setDocs({ ...docs, is_online: v });
  };

  const sendSOS = async () => {
    if (!confirm("سيتم إرسال إشارة طوارئ إلى الإدارة. هل أنت متأكد؟")) return;
    setSosLoading(true);
    const { error } = await triggerSOS("طلب طوارئ من السائق");
    setSosLoading(false);
    if (error) return toast.error("تعذر إرسال SOS");
    toast.success("تم إرسال إشارة الطوارئ");
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-gradient-hero text-primary-foreground p-6 rounded-b-3xl">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-bold text-xl">واجهة السائق</h1>
            <p className="text-sm opacity-90">{docs.car_model} · {docs.car_plate}</p>
            {isOnline && (
              <div className="flex items-center gap-1.5 mt-2 text-xs opacity-90">
                <Activity className="h-3 w-3 animate-pulse" />
                <span>يتم بث الموقع</span>
              </div>
            )}
            {battery && (
              <div className="flex items-center gap-1.5 mt-1 text-xs opacity-90">
                {battery.charging
                  ? <BatteryCharging className="h-3 w-3" />
                  : battery.level <= 0.2
                    ? <BatteryLow className="h-3 w-3 text-red-200" />
                    : <BatteryFull className="h-3 w-3" />}
                <span>
                  {Math.round(battery.level * 100)}%
                  {!battery.charging && battery.level <= 0.2 && " · وضع توفير الطاقة"}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 items-end">
            <div className="flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-2 rounded-full">
              <span className="text-xs font-bold">{isOnline ? "متاح" : "غير متاح"}</span>
              <Switch checked={isOnline} onCheckedChange={toggleOnline} />
            </div>
            <Button onClick={sendSOS} disabled={sosLoading} size="sm" className="bg-destructive hover:bg-destructive/90 gap-1.5 h-8">
              <Siren className="h-3.5 w-3.5" /> SOS
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <Stat icon={DollarSign} label="الأرباح" value={`${earnings.toFixed(0)} ج.م`} />
          <Stat icon={Car} label="نشطة" value={String(active.length)} />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="p-4">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="available">متاحة ({available.length})</TabsTrigger>
          <TabsTrigger value="active">نشطة ({active.length})</TabsTrigger>
          <TabsTrigger value="earnings">الأرباح</TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-2 mt-4">
          {available.length === 0 && <Empty msg="لا يوجد رحلات متاحة حالياً" />}
          {available.map((r) => <RideCard key={r.id} r={r} action={() => accept(r)} actionLabel="قبول" />)}
        </TabsContent>
        <TabsContent value="active" className="space-y-2 mt-4">
          {active.length === 0 && <Empty msg="لا يوجد رحلات نشطة" />}
          {active.map((r) => <RideCard key={r.id} r={r} action={() => window.location.assign(`/ride/${r.id}`)} actionLabel="فتح" />)}
        </TabsContent>
        <TabsContent value="earnings" className="mt-4">
          <div className="bg-card rounded-2xl p-6 shadow-card text-center">
            <DollarSign className="h-10 w-10 text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">إجمالي الأرباح</p>
            <p className="text-4xl font-black text-primary mt-1">{earnings.toFixed(0)} ج.م</p>
            <p className="text-xs text-muted-foreground mt-2">عمولة وصلني 20%</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-white/15 backdrop-blur rounded-xl p-3">
      <Icon className="h-4 w-4 mb-1" />
      <div className="text-xs opacity-90">{label}</div>
      <div className="font-bold text-lg">{value}</div>
    </div>
  );
}

function RideCard({ r, action, actionLabel }: { r: any; action: () => void; actionLabel: string }) {
  const type = RIDE_TYPES[r.ride_type as RideTypeKey];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-4 shadow-card">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-bold">{type?.icon} {type?.label}</span>
        <span className="font-bold text-primary text-lg">{r.price} ج.م</span>
      </div>
      <div className="text-sm space-y-1 mb-3">
        <div className="flex items-center gap-2"><MapPin className="h-3 w-3 text-primary" /> {r.pickup_address}</div>
        <div className="flex items-center gap-2"><MapPin className="h-3 w-3 text-destructive" /> {r.destination_address}</div>
      </div>
      <div className="flex justify-between items-center text-xs text-muted-foreground mb-3">
        <span>{r.distance_km} كم · {r.duration_min} دقيقة</span>
      </div>
      <Button onClick={action} className="w-full bg-gradient-primary">{actionLabel}</Button>
    </motion.div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-center text-sm text-muted-foreground py-10">{msg}</p>;
}
