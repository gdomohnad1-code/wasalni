import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listLiveDrivers, getDriverDetail, toggleDriverAccount, listOpenAlerts,
  resolveAlert, listGeofences, pushToDriver,
} from "@/lib/live-tracking.functions";
import { LiveMap, type DriverPin } from "@/components/admin/LiveMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Phone, Star, Car, AlertTriangle, Siren, BellRing, Power, RefreshCw, MapPin, Activity, Users2, CircleDot, WifiOff, Navigation } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/admin/live")({
  component: LiveTrackingPage,
});

function LiveTrackingPage() {
  const fetchDrivers = useServerFn(listLiveDrivers);
  const fetchAlerts = useServerFn(listOpenAlerts);
  const fetchGeofences = useServerFn(listGeofences);
  const fetchDetail = useServerFn(getDriverDetail);
  const toggleAccount = useServerFn(toggleDriverAccount);
  const resolveAlertFn = useServerFn(resolveAlert);
  const pushFn = useServerFn(pushToDriver);

  const [drivers, setDrivers] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [geofences, setGeofences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "available" | "busy" | "offline" | "out_of_zone">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [historyHours, setHistoryHours] = useState(6);
  const [pushOpen, setPushOpen] = useState(false);
  const [pushMsg, setPushMsg] = useState({ title: "", body: "" });

  const load = async () => {
    const [a, b, c] = await Promise.all([fetchDrivers(), fetchAlerts(), fetchGeofences()]);
    setDrivers(a.drivers ?? []);
    setAlerts(b.alerts ?? []);
    setGeofences(c.zones ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, () => fetchDrivers().then((r) => setDrivers(r.drivers ?? [])))
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_alerts" }, () => fetchAlerts().then((r) => setAlerts(r.alerts ?? [])))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    fetchDetail({ data: { driverId: selected, hours: historyHours } }).then(setDetail);
  }, [selected, historyHours]);

  const filtered = useMemo(() => {
    return drivers.filter((d) => {
      if (filter === "out_of_zone") { if (d.in_zone !== false) return false; }
      else if (filter !== "all" && d.presence !== filter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const hay = `${d.profile?.full_name ?? ""} ${d.profile?.phone ?? ""} ${d.doc?.car_plate ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [drivers, filter, search]);

  const pins: DriverPin[] = filtered.map((d) => ({
    driver_id: d.driver_id, lat: Number(d.lat), lng: Number(d.lng),
    presence: d.presence, name: d.profile?.full_name, car_plate: d.doc?.car_plate,
  }));

  const routePoints: Array<[number, number]> | undefined = detail?.history?.length > 1
    ? detail.history.map((h: any) => [Number(h.lat), Number(h.lng)] as [number, number]) : undefined;

  const counts = useMemo(() => ({
    total: drivers.length,
    available: drivers.filter((d) => d.presence === "available").length,
    busy: drivers.filter((d) => d.presence === "busy").length,
    offline: drivers.filter((d) => d.presence === "offline").length,
    out_of_zone: drivers.filter((d) => d.in_zone === false).length,
  }), [drivers]);

  const handleToggleAccount = async (driverId: string, currentStatus: string) => {
    const next = currentStatus === "active" ? "suspend" : "activate";
    const reason = next === "suspend" ? prompt("سبب التعطيل (اختياري):") ?? undefined : undefined;
    await toggleAccount({ data: { driverId, action: next, reason } });
    toast.success(next === "suspend" ? "تم تعطيل الحساب" : "تم تفعيل الحساب");
    fetchDetail({ data: { driverId, hours: historyHours } }).then(setDetail);
  };

  const sendPush = async () => {
    if (!selected) return;
    if (!pushMsg.title.trim() || !pushMsg.body.trim()) return toast.error("املأ العنوان والرسالة");
    await pushFn({ data: { driverId: selected, title: pushMsg.title, body: pushMsg.body } });
    toast.success("تم الإرسال");
    setPushOpen(false); setPushMsg({ title: "", body: "" });
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">التتبع المباشر</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              تحديث لحظي للسائقين والتنبيهات
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={load} className="gap-1.5 rounded-full">
          <RefreshCw className="h-3.5 w-3.5" /> تحديث
        </Button>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="إجمالي" value={counts.total} icon={Users2} tone="primary" />
        <Kpi label="متاح" value={counts.available} icon={CircleDot} tone="green" />
        <Kpi label="مشغول" value={counts.busy} icon={Navigation} tone="amber" />
        <Kpi label="أوفلاين" value={counts.offline} icon={WifiOff} tone="muted" />
        <Kpi label="خارج النطاق" value={counts.out_of_zone} icon={MapPin} tone="destructive" />
      </div>

      {/* Active SOS banner */}
      {alerts.filter((a) => a.type === "sos").length > 0 && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="p-4 border-destructive/40 bg-gradient-to-l from-destructive/15 to-destructive/5 flex items-center gap-3 shadow-lg shadow-destructive/10">
            <div className="h-10 w-10 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
              <Siren className="h-5 w-5 text-destructive animate-pulse" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-extrabold text-destructive">
                {alerts.filter((a) => a.type === "sos").length} حالة طوارئ نشطة الآن
              </div>
              <div className="text-[11px] text-destructive/80">يحتاج تدخّل فوري</div>
            </div>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr_380px] gap-4 min-h-[600px]">
        {/* Drivers list */}
        <Card className="p-3 flex flex-col gap-3 max-h-[720px] overflow-hidden border-border/60 bg-card/60 backdrop-blur">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم، الهاتف، اللوحة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pr-9 rounded-xl bg-muted/40 border-transparent focus-visible:bg-background"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList className="grid grid-cols-5 h-9 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="all" className="text-[11px] rounded-lg">الكل</TabsTrigger>
              <TabsTrigger value="available" className="text-[11px] rounded-lg">متاح</TabsTrigger>
              <TabsTrigger value="busy" className="text-[11px] rounded-lg">مشغول</TabsTrigger>
              <TabsTrigger value="offline" className="text-[11px] rounded-lg">أوفلاين</TabsTrigger>
              <TabsTrigger value="out_of_zone" className="text-[11px] rounded-lg">خارج</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1 overflow-y-auto space-y-2 -mx-1 px-1 pb-1">
            {filtered.length === 0 && (
              <div className="text-center py-12">
                <Users2 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">لا يوجد سائقون</p>
              </div>
            )}
            {filtered.map((d) => {
              const active = selected === d.driver_id;
              return (
                <button
                  key={d.driver_id}
                  onClick={() => setSelected(d.driver_id)}
                  className={`group w-full text-right p-3 rounded-xl border transition-all ${
                    active
                      ? "bg-gradient-to-l from-primary/15 to-primary/5 border-primary/40 shadow-sm shadow-primary/10"
                      : "border-border/60 hover:bg-muted/60 hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center text-xs font-bold text-muted-foreground">
                        {(d.profile?.full_name ?? "—").slice(0, 1)}
                      </div>
                      <span className={`absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full ring-2 ring-card ${
                        d.presence === "available" ? "bg-green-500" : d.presence === "busy" ? "bg-amber-500" : "bg-gray-400"
                      }`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate">{d.profile?.full_name ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{d.doc?.car_plate ?? "—"} · {d.profile?.phone ?? ""}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">{timeAgo(d.updated_at)}</span>
                    {d.in_zone === false && <Badge variant="destructive" className="h-4 text-[9px] px-1.5">خارج النطاق</Badge>}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Map */}
        <Card className="p-0 overflow-hidden min-h-[500px] border-border/60 shadow-md">
          <LiveMap drivers={pins} geofences={geofences} selectedDriverId={selected} onSelectDriver={setSelected} routePoints={routePoints} />
        </Card>

        {/* Detail panel */}
        <Card className="p-4 max-h-[720px] overflow-y-auto border-border/60 bg-card/60 backdrop-blur">
          {!selected && (
            <div className="text-center py-16 text-sm text-muted-foreground">
              <div className="h-14 w-14 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
                <MapPin className="h-7 w-7 opacity-50" />
              </div>
              اختر سائقاً لعرض التفاصيل
            </div>
          )}
          {selected && !detail && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
          {selected && detail && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-border/60">
                <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-extrabold shrink-0">
                  {(detail.profile?.full_name ?? "—").slice(0, 1)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-base truncate">{detail.profile?.full_name ?? "—"}</h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {Number(detail.profile?.rating ?? 5).toFixed(1)}
                    <Badge variant={detail.doc?.account_status === "active" ? "secondary" : "destructive"} className="h-4 text-[9px] px-1.5 mr-1">
                      {detail.doc?.account_status === "active" ? "مفعّل" : detail.doc?.account_status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <InfoRow icon={Phone} text={detail.profile?.phone ?? "—"} />
                <InfoRow icon={Car} text={`${detail.doc?.car_model ?? "—"} · ${detail.doc?.car_plate ?? "—"}`} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Mini label="إجمالي الرحلات" value={detail.stats.total_rides} />
                <Mini label="إجمالي الدخل" value={`${detail.stats.total_earnings.toFixed(0)} ج.م`} />
              </div>

              {detail.activeRide && (
                <Card className="p-3 border-primary/30 bg-gradient-to-l from-primary/10 to-primary/5">
                  <div className="text-[11px] font-extrabold text-primary mb-1.5 flex items-center gap-1">
                    <Activity className="h-3 w-3" /> رحلة نشطة
                  </div>
                  <div className="text-xs space-y-0.5">
                    <div className="flex gap-1.5"><span className="text-muted-foreground">من:</span> {detail.activeRide.pickup_address}</div>
                    <div className="flex gap-1.5"><span className="text-muted-foreground">إلى:</span> {detail.activeRide.destination_address}</div>
                  </div>
                  <div className="text-sm font-bold text-primary mt-1.5">{detail.activeRide.price} ج.م</div>
                </Card>
              )}

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground font-semibold">سجل التحركات</label>
                <Select value={String(historyHours)} onValueChange={(v) => setHistoryHours(Number(v))}>
                  <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">آخر ساعة</SelectItem>
                    <SelectItem value="6">آخر 6 ساعات</SelectItem>
                    <SelectItem value="24">آخر 24 ساعة</SelectItem>
                    <SelectItem value="72">آخر 3 أيام</SelectItem>
                    <SelectItem value="168">آخر أسبوع</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{detail.history?.length ?? 0} نقطة على الخريطة</p>
              </div>

              <div className="flex gap-2 pt-3 border-t border-border/60">
                <Button size="sm" variant="outline" className="flex-1 h-9 text-xs gap-1.5 rounded-xl" onClick={() => setPushOpen(true)}>
                  <BellRing className="h-3.5 w-3.5" /> إشعار
                </Button>
                <Button
                  size="sm"
                  variant={detail.doc?.account_status === "active" ? "destructive" : "default"}
                  className="flex-1 h-9 text-xs gap-1.5 rounded-xl"
                  onClick={() => handleToggleAccount(selected, detail.doc?.account_status)}
                >
                  <Power className="h-3.5 w-3.5" /> {detail.doc?.account_status === "active" ? "تعطيل" : "تفعيل"}
                </Button>
              </div>
            </motion.div>
          )}
        </Card>
      </div>

      {/* Open alerts */}
      <Card className="p-4 border-border/60">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-extrabold flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            تنبيهات مفتوحة
            <Badge variant="secondary" className="h-5">{alerts.length}</Badge>
          </h3>
        </div>
        {alerts.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">لا توجد تنبيهات حالياً.</p>}
        <div className="space-y-2">
          {alerts.map((a) => {
            const danger = a.type === "sos";
            return (
              <div
                key={a.id}
                className={`flex items-center justify-between gap-2 p-3 rounded-xl border transition hover:bg-muted/40 ${
                  danger ? "border-destructive/30 bg-destructive/5" : "border-border/60"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                    danger ? "bg-destructive/15" : "bg-amber-500/15"
                  }`}>
                    {a.type === "sos" ? <Siren className="h-4 w-4 text-destructive" /> :
                      a.type === "out_of_zone" ? <MapPin className="h-4 w-4 text-amber-500" /> :
                      <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">
                      {a.profile?.full_name ?? "—"} · <span className="text-muted-foreground font-normal">{labelForAlertType(a.type)}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{a.message ?? "—"} · {timeAgo(a.created_at)}</div>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" onClick={() => { setSelected(a.driver_id); }}>عرض</Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs rounded-lg" onClick={async () => { await resolveAlertFn({ data: { id: a.id } }); load(); }}>إغلاق</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Push dialog */}
      <Dialog open={pushOpen} onOpenChange={setPushOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إرسال إشعار للسائق</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="العنوان" value={pushMsg.title} onChange={(e) => setPushMsg({ ...pushMsg, title: e.target.value })} />
            <Textarea placeholder="الرسالة" value={pushMsg.body} onChange={(e) => setPushMsg({ ...pushMsg, body: e.target.value })} rows={4} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPushOpen(false)}>إلغاء</Button>
            <Button onClick={sendPush}>إرسال</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-extrabold ${color.includes("text-") ? color.split(" ").find((c) => c.startsWith("text-")) : ""}`}>{value}</div>
    </Card>
  );
}
function Mini({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-muted rounded-lg p-2 text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-extrabold text-sm">{value}</div>
    </div>
  );
}
function PresenceDot({ presence }: { presence: string }) {
  const c = presence === "available" ? "bg-green-500" : presence === "busy" ? "bg-amber-500" : "bg-gray-400";
  return <span className={`h-2.5 w-2.5 rounded-full ${c} shrink-0 mt-1.5`} />;
}
function timeAgo(ts: string) {
  if (!ts) return "—";
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `قبل ${s}ث`;
  if (s < 3600) return `قبل ${Math.floor(s / 60)}د`;
  if (s < 86400) return `قبل ${Math.floor(s / 3600)}س`;
  return `قبل ${Math.floor(s / 86400)}ي`;
}
function labelForAlertType(t: string) {
  return t === "sos" ? "طوارئ SOS" : t === "out_of_zone" ? "خارج النطاق" : t === "idle" ? "خمول طويل" : t === "speeding" ? "سرعة زائدة" : t;
}
