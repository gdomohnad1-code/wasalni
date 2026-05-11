import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trophy, Users, Car, Wallet, BadgePercent, Eye, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/influencers")({
  component: InfluencersAdmin,
});

type RewardType = "discount" | "credit" | "ride_percentage" | "fixed_bonus";

type Stat = {
  id: string;
  name: string;
  phone: string;
  code: string;
  reward_type: RewardType;
  reward_value: number;
  user_discount_value: number;
  active: boolean;
  users_count: number;
  signups_count: number;
  rides_count: number;
  total_rewards: number;
  total_discounts: number;
  created_at: string;
};

const REWARD_LABEL: Record<RewardType, string> = {
  discount: "خصم",
  credit: "رصيد",
  ride_percentage: "نسبة من الرحلات",
  fixed_bonus: "مكافأة ثابتة",
};

function InfluencersAdmin() {
  const [rows, setRows] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Stat> | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("influencer_stats" as any)
      .select("*")
      .order("total_rewards", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-inf")
      .on("postgres_changes", { event: "*", schema: "public", table: "influencers" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "influencer_redemptions" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("influencers").update({ active }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(active ? "تم التفعيل" : "تم الإيقاف"); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("حذف المؤثر نهائيًا؟")) return;
    const { error } = await supabase.from("influencers").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("تم الحذف"); load(); }
  };

  const leaderboard = [...rows].sort((a, b) => b.total_rewards - a.total_rewards);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">المؤثرون والإحالات</h2>
        <Button onClick={() => setEditing({ reward_type: "fixed_bonus", reward_value: 0, user_discount_value: 0, active: true })}>
          <Plus className="h-4 w-4 ml-1" /> مؤثر جديد
        </Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">الكل ({rows.length})</TabsTrigger>
          <TabsTrigger value="leaderboard"><Trophy className="h-4 w-4 ml-1" /> Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <div className="bg-card rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>الكود</TableHead>
                  <TableHead>المكافأة</TableHead>
                  <TableHead className="text-center"><Users className="h-4 w-4 inline" /></TableHead>
                  <TableHead className="text-center"><Car className="h-4 w-4 inline" /></TableHead>
                  <TableHead className="text-center"><Wallet className="h-4 w-4 inline" /></TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">جارٍ التحميل…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">لا يوجد مؤثرون بعد</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-semibold">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                    <TableCell><Badge variant="secondary" className="font-mono">{r.code}</Badge></TableCell>
                    <TableCell className="text-xs">{REWARD_LABEL[r.reward_type]} • {r.reward_value}{r.reward_type === "ride_percentage" ? "%" : " ج.م"}</TableCell>
                    <TableCell className="text-center">{r.users_count}</TableCell>
                    <TableCell className="text-center">{r.rides_count}</TableCell>
                    <TableCell className="text-center font-bold">{Number(r.total_rewards).toFixed(2)}</TableCell>
                    <TableCell><Switch checked={r.active} onCheckedChange={(v) => toggleActive(r.id, v)} /></TableCell>
                    <TableCell className="text-left">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setDetailsId(r.id)}><Eye className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          <div className="space-y-2">
            {leaderboard.slice(0, 50).map((r, i) => (
              <div key={r.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-full grid place-items-center font-bold ${i < 3 ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.code} • {r.users_count} مستخدم • {r.rides_count} رحلة</div>
                </div>
                <div className="text-left">
                  <div className="font-bold text-primary">{Number(r.total_rewards).toFixed(2)} ج.م</div>
                  <div className="text-[10px] text-muted-foreground">إجمالي المكافآت</div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <InfluencerEditor editing={editing} onClose={() => setEditing(null)} onSaved={load} />
      <DetailsSheet id={detailsId} onClose={() => setDetailsId(null)} rows={rows} />
    </div>
  );
}

function InfluencerEditor({ editing, onClose, onSaved }: { editing: Partial<Stat> | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Partial<Stat>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(editing || {}); }, [editing]);

  const save = async () => {
    if (!form.name || !form.phone || !form.code) { toast.error("الاسم والهاتف والكود إجباريون"); return; }
    setSaving(true);
    const payload = {
      name: form.name,
      phone: form.phone,
      code: (form.code || "").toUpperCase().trim(),
      reward_type: form.reward_type || "fixed_bonus",
      reward_value: Number(form.reward_value || 0),
      user_discount_value: Number(form.user_discount_value || 0),
      active: form.active ?? true,
    };
    const { error } = form.id
      ? await supabase.from("influencers").update(payload).eq("id", form.id)
      : await supabase.from("influencers").insert(payload);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("تم الحفظ"); onSaved(); onClose(); }
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{form.id ? "تعديل المؤثر" : "مؤثر جديد"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>الاسم</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>رقم الهاتف</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>كود الخصم</Label><Input className="font-mono uppercase" value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SARA10" /></div>
          <div>
            <Label>نوع المكافأة</Label>
            <Select value={form.reward_type || "fixed_bonus"} onValueChange={(v) => setForm({ ...form, reward_type: v as RewardType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed_bonus">مكافأة ثابتة</SelectItem>
                <SelectItem value="ride_percentage">نسبة من الرحلات (%)</SelectItem>
                <SelectItem value="credit">رصيد للمؤثر</SelectItem>
                <SelectItem value="discount">خصم</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>قيمة المكافأة</Label><Input type="number" value={form.reward_value ?? 0} onChange={(e) => setForm({ ...form, reward_value: Number(e.target.value) })} /></div>
            <div><Label>خصم للمستخدم (ج.م)</Label><Input type="number" value={form.user_discount_value ?? 0} onChange={(e) => setForm({ ...form, user_discount_value: Number(e.target.value) })} /></div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <Label>نشط</Label>
            <Switch checked={form.active ?? true} onCheckedChange={(v) => setForm({ ...form, active: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailsSheet({ id, onClose, rows }: { id: string | null; onClose: () => void; rows: Stat[] }) {
  const inf = rows.find((r) => r.id === id);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data } = await supabase
        .from("influencer_redemptions")
        .select("id, event_type, reward_amount, discount_amount, created_at, user_id, ride_id")
        .eq("influencer_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      setEvents(data || []);
    };
    load();
    const ch = supabase
      .channel(`inf-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "influencer_redemptions", filter: `influencer_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  if (!inf) return null;

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{inf.name} <span className="font-mono text-xs ms-2">{inf.code}</span></SheetTitle></SheetHeader>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <Stat icon={<Users className="h-4 w-4" />} label="مستخدمون" value={inf.users_count} />
          <Stat icon={<BadgePercent className="h-4 w-4" />} label="تسجيلات" value={inf.signups_count} />
          <Stat icon={<Car className="h-4 w-4" />} label="رحلات" value={inf.rides_count} />
          <Stat icon={<Wallet className="h-4 w-4" />} label="إجمالي المكافآت" value={`${Number(inf.total_rewards).toFixed(2)}`} />
          <Stat icon={<BadgePercent className="h-4 w-4" />} label="إجمالي الخصومات" value={`${Number(inf.total_discounts).toFixed(2)}`} />
        </div>

        <h3 className="font-bold mt-6 mb-2">آخر الاستخدامات</h3>
        <div className="space-y-2">
          {events.length === 0 && <div className="text-sm text-muted-foreground">لا يوجد استخدامات بعد</div>}
          {events.map((e) => (
            <div key={e.id} className="bg-muted/50 rounded-lg p-2 text-xs flex items-center justify-between">
              <div>
                <Badge variant="outline">{e.event_type}</Badge>
                <span className="ms-2 text-muted-foreground">{new Date(e.created_at).toLocaleString("ar-EG")}</span>
              </div>
              <div className="font-mono">+{Number(e.reward_amount).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1">{icon} {label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}
