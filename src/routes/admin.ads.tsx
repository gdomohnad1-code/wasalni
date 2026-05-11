import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Megaphone, Plus, Pencil, Play, Pause, Trash2, BarChart3, Eye, MousePointerClick, Upload,
} from "lucide-react";
import { AdSlot } from "@/components/AdSlot";
import { AdAreaPicker } from "@/components/admin/AdAreaPicker";

export const Route = createFileRoute("/admin/ads")({
  component: AdsManagerPage,
});

const AD_TYPES = [
  { v: "banner", l: "بانر" },
  { v: "popup", l: "نافذة منبثقة" },
  { v: "video", l: "فيديو" },
  { v: "story", l: "ستوري" },
  { v: "notification", l: "إشعار" },
  { v: "fullscreen", l: "ملء الشاشة" },
  { v: "reward", l: "إعلان مكافأة" },
] as const;

const PLACEMENTS = [
  { v: "home", l: "الصفحة الرئيسية" },
  { v: "book", l: "صفحة الحجز" },
  { v: "waiting_driver", l: "انتظار السائق" },
  { v: "driver_app", l: "تطبيق السائق" },
  { v: "pre_confirm", l: "قبل تأكيد الرحلة" },
  { v: "post_ride", l: "بعد انتهاء الرحلة" },
] as const;

const AUDIENCES = [
  { v: "both", l: "الاثنين" },
  { v: "riders", l: "العملاء فقط" },
  { v: "drivers", l: "السائقين فقط" },
] as const;

const MEDIA_TYPES = [
  { v: "image", l: "صورة" },
  { v: "video", l: "فيديو" },
  { v: "gif", l: "GIF" },
  { v: "link", l: "رابط فقط" },
  { v: "qr", l: "QR Code" },
] as const;

const STATUSES = [
  { v: "draft", l: "مسودة" },
  { v: "scheduled", l: "مجدول" },
  { v: "active", l: "نشط" },
  { v: "paused", l: "موقوف" },
  { v: "ended", l: "منتهي" },
] as const;

type AdRow = any;

function makeEmptyForm() {
  const now = new Date();
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return {
    title: "", description: "",
    type: "banner",
    placements: [] as string[],
    target_audience: "both",
    target_cities: "",
    target_min_rides: "" as string,
    target_max_rides: "" as string,
    media_type: "image",
    media_url: "",
    external_link: "",
    qr_data: "",
    start_at: fmt(now), end_at: fmt(end),
    daily_start_hour: "" as string,
    daily_end_hour: "" as string,
    max_impressions_per_user: 0,
    priority: 0,
    is_sponsored: false,
    sponsor_name: "",
    status: "draft",
    auto_rotate: true,
    target_area_lat: null as number | null,
    target_area_lng: null as number | null,
    target_area_radius_m: 2000,
  };
}
type AdForm = ReturnType<typeof makeEmptyForm>;

function AdsManagerPage() {
  const [rows, setRows] = useState<AdRow[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [stats, setStats] = useState<Record<string, { imp: number; click: number; conv: number }>>({});
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AdRow | null>(null);
  const [analyticsAd, setAnalyticsAd] = useState<AdRow | null>(null);

  const load = async () => {
    const { data } = await supabase.from("ads").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
    const { data: ev } = await supabase.from("ad_events").select("ad_id, event_type");
    const map: typeof stats = {};
    (ev ?? []).forEach((e: any) => {
      if (!map[e.ad_id]) map[e.ad_id] = { imp: 0, click: 0, conv: 0 };
      if (e.event_type === "impression") map[e.ad_id].imp++;
      else if (e.event_type === "click") map[e.ad_id].click++;
      else if (e.event_type === "conversion") map[e.ad_id].conv++;
    });
    setStats(map);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-ads")
      .on("postgres_changes", { event: "*", schema: "public", table: "ads" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ad_events" }, load)
      .subscribe();
    const iv = setInterval(load, 1000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("ads").update({ status: status as any }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("تم التحديث");
  };

  const remove = async (id: string) => {
    if (!confirm("حذف الإعلان نهائياً؟")) return;
    const { error } = await supabase.from("ads").delete().eq("id", id);
    if (error) toast.error(error.message); else toast.success("تم الحذف");
  };

  const totals = useMemo(() => {
    let imp = 0, click = 0;
    Object.values(stats).forEach((s) => { imp += s.imp; click += s.click; });
    return { imp, click, ctr: imp > 0 ? ((click / imp) * 100).toFixed(1) : "0" };
  }, [stats]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-extrabold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" /> مدير الإعلانات
          </h2>
          <p className="text-sm text-muted-foreground">تحكم كامل في الإعلانات داخل التطبيق</p>
        </div>
        <Button onClick={() => { setEditing(null); setEditorOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> إعلان جديد
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4"><div className="text-xs text-muted-foreground">إعلانات</div><div className="text-2xl font-extrabold">{rows.length}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">إجمالي المشاهدات</div><div className="text-2xl font-extrabold">{totals.imp}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">إجمالي الضغطات</div><div className="text-2xl font-extrabold">{totals.click}</div></Card>
        <Card className="p-4"><div className="text-xs text-muted-foreground">CTR</div><div className="text-2xl font-extrabold">{totals.ctr}%</div></Card>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">الكل ({rows.length})</TabsTrigger>
          {STATUSES.map((s) => (
            <TabsTrigger key={s.v} value={s.v}>{s.l} ({rows.filter((r) => r.status === s.v).length})</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العنوان</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>الأماكن</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>الأولوية</TableHead>
              <TableHead>المشاهدات</TableHead>
              <TableHead>CTR</TableHead>
              <TableHead className="text-left">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => {
              const s = stats[r.id] ?? { imp: 0, click: 0, conv: 0 };
              const ctr = s.imp > 0 ? ((s.click / s.imp) * 100).toFixed(1) : "0";
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-semibold">
                    {r.title}
                    {r.is_sponsored && <Badge variant="secondary" className="mr-2 text-[10px]">برعاية</Badge>}
                  </TableCell>
                  <TableCell>{AD_TYPES.find((t) => t.v === r.type)?.l}</TableCell>
                  <TableCell className="text-xs">{(r.placements ?? []).map((p: string) => PLACEMENTS.find((x) => x.v === p)?.l).join("، ")}</TableCell>
                  <TableCell>{AUDIENCES.find((a) => a.v === r.target_audience)?.l}</TableCell>
                  <TableCell>
                    <Badge variant={r.status === "active" ? "default" : r.status === "paused" ? "destructive" : "secondary"}>
                      {STATUSES.find((s) => s.v === r.status)?.l}
                    </Badge>
                  </TableCell>
                  <TableCell>{r.priority}</TableCell>
                  <TableCell>{s.imp}</TableCell>
                  <TableCell>{ctr}%</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setAnalyticsAd(r)} title="تحليلات"><BarChart3 className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setEditorOpen(true); }} title="تعديل"><Pencil className="h-4 w-4" /></Button>
                      {r.status === "active" ? (
                        <Button size="icon" variant="ghost" onClick={() => setStatus(r.id, "paused")} title="إيقاف"><Pause className="h-4 w-4" /></Button>
                      ) : (
                        <Button size="icon" variant="ghost" onClick={() => setStatus(r.id, "active")} title="تفعيل"><Play className="h-4 w-4" /></Button>
                      )}
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(r.id)} title="حذف"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">لا توجد إعلانات</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <AdEditor open={editorOpen} onOpenChange={setEditorOpen} editing={editing} onSaved={load} />
      <AdAnalyticsDialog ad={analyticsAd} onClose={() => setAnalyticsAd(null)} />
    </div>
  );
}

function AdEditor({
  open, onOpenChange, editing, onSaved,
}: { open: boolean; onOpenChange: (v: boolean) => void; editing: AdRow | null; onSaved: () => void }) {
  const [form, setForm] = useState<AdForm>(makeEmptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title ?? "",
        description: editing.description ?? "",
        type: editing.type ?? "banner",
        placements: editing.placements ?? [],
        target_audience: editing.target_audience ?? "both",
        target_cities: (editing.target_cities ?? []).join(", "),
        target_min_rides: editing.target_min_rides?.toString() ?? "",
        target_max_rides: editing.target_max_rides?.toString() ?? "",
        media_type: editing.media_type ?? "image",
        media_url: editing.media_url ?? "",
        external_link: editing.external_link ?? "",
        qr_data: editing.qr_data ?? "",
        start_at: editing.start_at ? editing.start_at.slice(0, 16) : "",
        end_at: editing.end_at ? editing.end_at.slice(0, 16) : "",
        daily_start_hour: editing.daily_start_hour?.toString() ?? "",
        daily_end_hour: editing.daily_end_hour?.toString() ?? "",
        max_impressions_per_user: editing.max_impressions_per_user ?? 0,
        priority: editing.priority ?? 0,
        is_sponsored: editing.is_sponsored ?? false,
        sponsor_name: editing.sponsor_name ?? "",
        status: editing.status ?? "draft",
        auto_rotate: editing.auto_rotate ?? true,
        target_area_lat: editing.target_area_lat ?? null,
        target_area_lng: editing.target_area_lng ?? null,
        target_area_radius_m: editing.target_area_radius_m ?? 2000,
      });
    } else {
      setForm(makeEmptyForm());
    }
  }, [editing, open]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("ads").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("ads").getPublicUrl(path);
      setForm((f) => ({ ...f, media_url: data.publicUrl }));
      toast.success("تم رفع الوسائط");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الرفع");
    } finally {
      setUploading(false);
    }
  };

  const togglePlacement = (v: string) => {
    setForm((f) => ({
      ...f,
      placements: f.placements.includes(v) ? f.placements.filter((p) => p !== v) : [...f.placements, v],
    }));
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("اكتب عنوان الإعلان"); return; }
    if (form.placements.length === 0) { toast.error("اختر مكان ظهور واحد على الأقل"); return; }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(),
        description: form.description || null,
        type: form.type,
        placements: form.placements,
        target_audience: form.target_audience,
        target_cities: form.target_cities ? form.target_cities.split(",").map((c) => c.trim()).filter(Boolean) : [],
        target_min_rides: form.target_min_rides ? parseInt(form.target_min_rides) : null,
        target_max_rides: form.target_max_rides ? parseInt(form.target_max_rides) : null,
        media_type: form.media_type,
        media_url: form.media_url || null,
        external_link: form.external_link || null,
        qr_data: form.qr_data || null,
        start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        daily_start_hour: form.daily_start_hour ? parseInt(form.daily_start_hour) : null,
        daily_end_hour: form.daily_end_hour ? parseInt(form.daily_end_hour) : null,
        max_impressions_per_user: form.max_impressions_per_user,
        priority: form.priority,
        is_sponsored: form.is_sponsored,
        sponsor_name: form.sponsor_name || null,
        status: form.status,
        auto_rotate: form.auto_rotate,
        target_area_lat: form.target_area_lat,
        target_area_lng: form.target_area_lng,
        target_area_radius_m: form.target_area_lat != null ? form.target_area_radius_m : null,
      };
      const { error } = editing
        ? await supabase.from("ads").update(payload).eq("id", editing.id)
        : await supabase.from("ads").insert(payload);
      if (error) throw error;
      toast.success(editing ? "تم تحديث الإعلان" : "تم إنشاء الإعلان");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "تعديل إعلان" : "إنشاء إعلان جديد"}</DialogTitle></DialogHeader>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label>العنوان</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AD_TYPES.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>أماكن الظهور</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {PLACEMENTS.map((p) => (
                  <label key={p.v} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={form.placements.includes(p.v)} onCheckedChange={() => togglePlacement(p.v)} />
                    {p.l}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label>الفئة المستهدفة</Label>
              <Select value={form.target_audience} onValueChange={(v) => setForm({ ...form, target_audience: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{AUDIENCES.map((a) => <SelectItem key={a.v} value={a.v}>{a.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div>
              <Label>المدن المستهدفة (اختياري، مفصولة بفواصل)</Label>
              <Input value={form.target_cities} onChange={(e) => setForm({ ...form, target_cities: e.target.value })} placeholder="القاهرة، الجيزة" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>أقل عدد رحلات</Label>
                <Input type="number" value={form.target_min_rides} onChange={(e) => setForm({ ...form, target_min_rides: e.target.value })} />
              </div>
              <div>
                <Label>أقصى عدد رحلات</Label>
                <Input type="number" value={form.target_max_rides} onChange={(e) => setForm({ ...form, target_max_rides: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <Label>نوع الوسائط</Label>
              <Select value={form.media_type} onValueChange={(v) => setForm({ ...form, media_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MEDIA_TYPES.map((m) => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {(form.media_type === "image" || form.media_type === "video" || form.media_type === "gif") && (
              <div>
                <Label>رفع وسائط</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept={form.media_type === "video" ? "video/*" : "image/*"}
                    onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                    disabled={uploading}
                  />
                  {uploading && <Upload className="h-4 w-4 animate-pulse" />}
                </div>
                {form.media_url && <div className="text-xs text-muted-foreground truncate mt-1">{form.media_url}</div>}
              </div>
            )}

            <div>
              <Label>رابط خارجي (يُفتح عند النقر)</Label>
              <Input value={form.external_link} onChange={(e) => setForm({ ...form, external_link: e.target.value })} placeholder="https://..." />
            </div>

            {form.media_type === "qr" && (
              <div>
                <Label>محتوى QR</Label>
                <Input value={form.qr_data} onChange={(e) => setForm({ ...form, qr_data: e.target.value })} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>تاريخ البدء</Label>
                <Input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} />
              </div>
              <div>
                <Label>تاريخ الانتهاء</Label>
                <Input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>ساعة البدء يومياً (0-23)</Label>
                <Input type="number" min={0} max={23} value={form.daily_start_hour} onChange={(e) => setForm({ ...form, daily_start_hour: e.target.value })} />
              </div>
              <div>
                <Label>ساعة الانتهاء يومياً</Label>
                <Input type="number" min={0} max={23} value={form.daily_end_hour} onChange={(e) => setForm({ ...form, daily_end_hour: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>أقصى مرات ظهور لكل مستخدم (0 = بلا حد)</Label>
              <Input type="number" min={0} value={form.max_impressions_per_user} onChange={(e) => setForm({ ...form, max_impressions_per_user: parseInt(e.target.value) || 0 })} />
            </div>

            <div>
              <Label>الأولوية: {form.priority}</Label>
              <Slider min={0} max={10} step={1} value={[form.priority]} onValueChange={(v) => setForm({ ...form, priority: v[0] })} />
            </div>

            <div className="flex items-center justify-between">
              <Label>تدوير تلقائي</Label>
              <Switch checked={form.auto_rotate} onCheckedChange={(v) => setForm({ ...form, auto_rotate: v })} />
            </div>

            <div className="flex items-center justify-between">
              <Label>إعلان مدفوع (برعاية)</Label>
              <Switch checked={form.is_sponsored} onCheckedChange={(v) => setForm({ ...form, is_sponsored: v })} />
            </div>
            {form.is_sponsored && (
              <div>
                <Label>اسم الراعي</Label>
                <Input value={form.sponsor_name} onChange={(e) => setForm({ ...form, sponsor_name: e.target.value })} />
              </div>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="border-t pt-4">
          <Label className="mb-2 block">معاينة</Label>
          <div className="bg-muted/40 rounded-lg p-4">
            {form.title ? (
              <PreviewCard form={form} />
            ) : (
              <div className="text-center text-sm text-muted-foreground py-6">أضف عنواناً لرؤية المعاينة</div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جاري الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewCard({ form }: { form: AdForm }) {
  return (
    <div className="max-w-sm mx-auto">
      <Card className="overflow-hidden">
        {form.is_sponsored && (
          <Badge variant="secondary" className="m-2 text-[10px]">{form.sponsor_name ? `برعاية ${form.sponsor_name}` : "إعلان"}</Badge>
        )}
        {form.media_url ? (
          form.media_type === "video" ? (
            <video src={form.media_url} className="w-full h-40 object-cover" muted autoPlay loop />
          ) : (
            <img src={form.media_url} alt="" className="w-full h-40 object-cover" />
          )
        ) : (
          <div className="h-40 bg-gradient-to-br from-primary/30 to-primary/5" />
        )}
        <div className="p-3">
          <div className="font-bold">{form.title}</div>
          {form.description && <div className="text-xs text-muted-foreground mt-1">{form.description}</div>}
        </div>
      </Card>
    </div>
  );
}

function AdAnalyticsDialog({ ad, onClose }: { ad: AdRow | null; onClose: () => void }) {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    if (!ad) return;
    supabase.from("ad_events").select("*").eq("ad_id", ad.id).order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setEvents(data ?? []));
  }, [ad?.id]);
  if (!ad) return null;
  const imp = events.filter((e) => e.event_type === "impression").length;
  const click = events.filter((e) => e.event_type === "click").length;
  const conv = events.filter((e) => e.event_type === "conversion").length;
  const ctr = imp > 0 ? ((click / imp) * 100).toFixed(1) : "0";

  return (
    <Dialog open={!!ad} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>تحليلات: {ad.title}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-4 gap-3">
          <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" /> مشاهدات</div><div className="text-2xl font-extrabold">{imp}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground flex items-center gap-1"><MousePointerClick className="h-3 w-3" /> ضغطات</div><div className="text-2xl font-extrabold">{click}</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">CTR</div><div className="text-2xl font-extrabold">{ctr}%</div></Card>
          <Card className="p-3"><div className="text-xs text-muted-foreground">تحويلات</div><div className="text-2xl font-extrabold">{conv}</div></Card>
        </div>
        <div className="max-h-64 overflow-y-auto border rounded-lg">
          <Table>
            <TableHeader><TableRow><TableHead>النوع</TableHead><TableHead>المستخدم</TableHead><TableHead>الوقت</TableHead></TableRow></TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell><Badge variant="outline">{e.event_type}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{e.user_id?.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs">{new Date(e.created_at).toLocaleString("ar-EG")}</TableCell>
                </TableRow>
              ))}
              {events.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">لا توجد أحداث</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
