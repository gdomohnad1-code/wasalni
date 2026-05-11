import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Car, FileText, MapPin, DollarSign, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { RIDE_TYPES, type RideTypeKey } from "@/lib/pricing";

export const Route = createFileRoute("/_app/driver")({
  component: DriverPage,
});

function DriverPage() {
  const { user, roles, refresh } = useAuth();
  const isDriver = roles.includes("driver");
  const [docs, setDocs] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("driver_documents").select("*").eq("driver_id", user.id).maybeSingle().then(({ data }) => {
      setDocs(data);
      setLoading(false);
    });
  }, [user]);

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!isDriver || !docs) return <DriverOnboarding onDone={() => { refresh(); }} />;

  return <DriverDashboard docs={docs} setDocs={setDocs} />;
}

function DriverOnboarding({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [carModel, setCarModel] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [files, setFiles] = useState<{ [k: string]: File | null }>({});
  const [submitting, setSubmitting] = useState(false);

  const onFile = (k: string, f: File | null) => setFiles((p) => ({ ...p, [k]: f }));

  const submit = async () => {
    if (!user || !files.driver_license || !files.car_license || !files.car_photo) {
      toast.error("لازم ترفع كل الوثائق");
      return;
    }
    setSubmitting(true);
    try {
      const upload = async (key: string, f: File) => {
        const path = `${user.id}/${key}-${Date.now()}.${f.name.split(".").pop()}`;
        const { error } = await supabase.storage.from("driver-docs").upload(path, f);
        if (error) throw error;
        return path;
      };
      const [dl, cl, cp] = await Promise.all([
        upload("driver-license", files.driver_license),
        upload("car-license", files.car_license),
        upload("car-photo", files.car_photo),
      ]);
      await supabase.from("driver_documents").upsert({
        driver_id: user.id,
        driver_license_url: dl,
        car_license_url: cl,
        car_photo_url: cp,
        car_model: carModel,
        car_plate: carPlate,
        approved: true, // auto-approve for demo
      });
      await supabase.from("user_roles").insert({ user_id: user.id, role: "driver" }).select();
      toast.success("تم تسجيلك سائقاً ✅");
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="text-center mb-6">
        <div className="text-5xl mb-2">🚗</div>
        <h1 className="font-bold text-xl">سجّل كسائق</h1>
        <p className="text-sm text-muted-foreground">ارفع وثائقك وابدأ تكسب فوراً</p>
      </div>

      <div className="bg-card rounded-2xl p-5 shadow-card space-y-4">
        <div>
          <Label>موديل السيارة</Label>
          <Input value={carModel} onChange={(e) => setCarModel(e.target.value)} placeholder="هيونداي اكسنت 2020" />
        </div>
        <div>
          <Label>رقم اللوحة</Label>
          <Input value={carPlate} onChange={(e) => setCarPlate(e.target.value)} placeholder="أ ب ج 1234" />
        </div>
        <FileField label="رخصة القيادة" k="driver_license" onFile={onFile} f={files.driver_license} />
        <FileField label="رخصة السيارة" k="car_license" onFile={onFile} f={files.car_license} />
        <FileField label="صورة السيارة" k="car_photo" onFile={onFile} f={files.car_photo} />

        <Button onClick={submit} disabled={submitting} className="w-full h-12 bg-gradient-primary font-bold">
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "إرسال الطلب"}
        </Button>
      </div>
    </div>
  );
}

function FileField({ label, k, onFile, f }: { label: string; k: string; onFile: (k: string, f: File | null) => void; f: File | null }) {
  return (
    <div>
      <Label>{label}</Label>
      <label className="cursor-pointer block">
        <div className={`border-2 border-dashed rounded-xl p-3 text-center text-sm transition ${f ? "border-primary bg-primary/5" : "border-border"}`}>
          {f ? <span className="flex items-center justify-center gap-1"><CheckCircle2 className="h-4 w-4 text-primary" /> {f.name}</span> : "اختر ملف..."}
        </div>
        <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => onFile(k, e.target.files?.[0] ?? null)} />
      </label>
    </div>
  );
}

function DriverDashboard({ docs, setDocs }: { docs: any; setDocs: (d: any) => void }) {
  const { user } = useAuth();
  const [available, setAvailable] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [earnings, setEarnings] = useState(0);
  const [tab, setTab] = useState("available");

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

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-gradient-hero text-primary-foreground p-6 rounded-b-3xl">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-bold text-xl">واجهة السائق</h1>
            <p className="text-sm opacity-90">{docs.car_model} · {docs.car_plate}</p>
          </div>
          <div className="flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-2 rounded-full">
            <span className="text-xs font-bold">{docs.is_online ? "متاح" : "غير متاح"}</span>
            <Switch checked={!!docs.is_online} onCheckedChange={toggleOnline} />
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
