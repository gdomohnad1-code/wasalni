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
import { Loader2, Search, Phone, Star, Car, AlertTriangle, Siren, BellRing, Power, RefreshCw, MapPin } from "lucide-react";
import { toast } from "sonner";

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
    <div className="space-y-4" dir="rtl">
      {/* KPI bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="إجمالي" value={counts.total} color="bg-primary/10 text-primary" />
        <Kpi label="متاح" value={counts.available} color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <Kpi label="مشغول" value={counts.busy} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
        <Kpi label="أوفلاين" value={counts.offline} color="bg-muted text-muted-foreground" />
        <Kpi label="خارج النطاق" value={counts.out_of_zone} color="bg-destructive/10 text-destructive" />
      </div>

      {/* Active SOS banner */}
      {alerts.filter((a) => a.type === "sos").length > 0 && (
        <Card className="p-3 border-destructive bg-destructive/10 flex items-center gap-3">
          <Siren className="h-5 w-5 text-destructive animate-pulse" />
          <div className="flex-1 text-sm font-bold text-destructive">
            {alerts.filter((a) => a.type === "sos").length} حالة طوارئ نشطة الآن
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_360px] gap-4 min-h-[600px]">
        {/* Drivers list */}
        <Card className="p-3 flex flex-col gap-2 max-h-[700px] overflow-hidden">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم، الهاتف، اللوحة..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList className="grid grid-cols-5 h-8">
              <TabsTrigger value="all" className="text-[11px]">الكل</TabsTrigger>
              <TabsTrigger value="available" className="text-[11px]">متاح</TabsTrigger>
              <TabsTrigger value="busy" className="text-[11px]">مشغول</TabsTrigger>
              <TabsTrigger value="offline" className="text-[11px]">أوفلاين</TabsTrigger>
              <TabsTrigger value="out_of_zone" className="text-[11px]">خارج</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1 overflow-y-auto space-y-1.5 -mx-1 px-1">
            {filtered.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">لا يوجد سائقون</p>}
            {filtered.map((d) => (
              <button key={d.driver_id} onClick={() => setSelected(d.driver_id)}
                className={`w-full text-right p-2.5 rounded-lg border transition ${selected === d.driver_id ? "bg-primary/10 border-primary" : "border-border hover:bg-muted"}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{d.profile?.full_name ?? "—"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{d.doc?.car_plate ?? "—"} · {d.profile?.phone ?? ""}</div>
                  </div>
                  <PresenceDot presence={d.presence} />
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-muted-foreground">{timeAgo(d.updated_at)}</span>
                  {d.in_zone === false && <Badge variant="destructive" className="h-4 text-[9px] px-1">خارج النطاق</Badge>}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Map */}
        <Card className="p-0 overflow-hidden min-h-[500px]">
          <LiveMap drivers={pins} geofences={geofences} selectedDriverId={selected} onSelectDriver={setSelected} routePoints={routePoints} />
        </Card>

        {/* Detail panel */}
        <Card className="p-4 max-h-[700px] overflow-y-auto">
          {!selected && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <MapPin className="h-10 w-10 mx-auto mb-2 opacity-30" />
              اختر سائقاً لعرض التفاصيل
            </div>
          )}
          {selected && !detail && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          {selected && detail && (
            <div className="space-y-3">
              <div>
                <h3 className="font-bold text-base">{detail.profile?.full_name ?? "—"}</h3>
                <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  <div className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {detail.profile?.phone ?? "—"}</div>
                  <div className="flex items-center gap-1.5"><Car className="h-3 w-3" /> {detail.doc?.car_model ?? "—"} · {detail.doc?.car_plate ?? "—"}</div>
                  <div className="flex items-center gap-1.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {Number(detail.profile?.rating ?? 5).toFixed(1)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Mini label="إجمالي الرحلات" value={detail.stats.total_rides} />
                <Mini label="إجمالي الدخل" value={`${detail.stats.total_earnings.toFixed(0)} ج.م`} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">الحالة:</span>
                <Badge variant={detail.doc?.account_status === "active" ? "default" : "destructive"}>
                  {detail.doc?.account_status === "active" ? "مفعّل" : detail.doc?.account_status}
                </Badge>
              </div>
              {detail.activeRide && (
                <Card className="p-2.5 border-primary/40 bg-primary/5">
                  <div className="text-[11px] font-bold text-primary mb-1">رحلة نشطة</div>
                  <div className="text-xs">من: {detail.activeRide.pickup_address}</div>
                  <div className="text-xs">إلى: {detail.activeRide.destination_address}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{detail.activeRide.price} ج.م</div>
                </Card>
              )}

              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">سجل التحركات (آخر):</label>
                <Select value={String(historyHours)} onValueChange={(v) => setHistoryHours(Number(v))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">ساعة</SelectItem>
                    <SelectItem value="6">6 ساعات</SelectItem>
                    <SelectItem value="24">24 ساعة</SelectItem>
                    <SelectItem value="72">3 أيام</SelectItem>
                    <SelectItem value="168">أسبوع</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{detail.history?.length ?? 0} نقطة معروضة على الخريطة</p>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1" onClick={() => setPushOpen(true)}>
                  <BellRing className="h-3.5 w-3.5" /> إشعار
                </Button>
                <Button size="sm" variant={detail.doc?.account_status === "active" ? "destructive" : "default"}
                  className="flex-1 h-8 text-xs gap-1"
                  onClick={() => handleToggleAccount(selected, detail.doc?.account_status)}>
                  <Power className="h-3.5 w-3.5" /> {detail.doc?.account_status === "active" ? "تعطيل" : "تفعيل"}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Open alerts */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> تنبيهات مفتوحة ({alerts.length})</h3>
          <Button size="sm" variant="ghost" onClick={load} className="h-7 gap-1"><RefreshCw className="h-3 w-3" /> تحديث</Button>
        </div>
        {alerts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">لا توجد تنبيهات.</p>}
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border">
              <div className="flex items-center gap-2 min-w-0">
                {a.type === "sos" ? <Siren className="h-4 w-4 text-destructive shrink-0" /> :
                  a.type === "out_of_zone" ? <MapPin className="h-4 w-4 text-amber-500 shrink-0" /> :
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{a.profile?.full_name ?? "—"} · <span className="text-muted-foreground font-normal">{labelForAlertType(a.type)}</span></div>
                  <div className="text-[11px] text-muted-foreground truncate">{a.message ?? "—"} · {timeAgo(a.created_at)}</div>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelected(a.driver_id); }}>عرض</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={async () => { await resolveAlertFn({ data: { id: a.id } }); load(); }}>إغلاق</Button>
              </div>
            </div>
          ))}
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
