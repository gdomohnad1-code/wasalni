import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Search, FileCheck, FileX, ShieldAlert, ShieldX, ShieldCheck, Star } from "lucide-react";

export const Route = createFileRoute("/admin/drivers")({
  component: DriversAdmin,
});

type DriverRow = {
  driver_id: string;
  approved: boolean;
  is_online: boolean;
  account_status: "active" | "suspended" | "banned";
  car_plate: string | null;
  car_model: string | null;
  driver_license_url: string | null;
  car_license_url: string | null;
  car_photo_url: string | null;
  rejection_reason: string | null;
  suspension_reason: string | null;
  profile?: { full_name: string; phone: string | null; avatar_url: string | null; rating: number | null } | null;
};

const STATUS_BADGE: Record<DriverRow["account_status"], string> = {
  active: "bg-primary/10 text-primary border-primary/20",
  suspended: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  banned: "bg-destructive/10 text-destructive border-destructive/20",
};
const STATUS_LABEL: Record<DriverRow["account_status"], string> = {
  active: "نشط", suspended: "معلّق", banned: "محظور",
};

function DriversAdmin() {
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<DriverRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: docs } = await supabase.from("driver_documents").select("*").order("created_at", { ascending: false });
    const ids = (docs ?? []).map((d) => d.driver_id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone, avatar_url, rating").in("id", ids);
    const map = new Map(profiles?.map((p) => [p.id, p]) ?? []);
    setRows((docs ?? []).map((d) => ({ ...d, profile: map.get(d.driver_id) ?? null })) as DriverRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = async (patch: Record<string, any>) => {
    if (!selected) return;
    setBusy(true);
    const { error } = await supabase.from("driver_documents").update(patch).eq("driver_id", selected.driver_id);
    setBusy(false);
    if (error) { toast.error("تعذر حفظ التغييرات"); return; }
    toast.success("تم التحديث");
    setSelected(null); setReason(""); load();
  };

  const filtered = rows.filter((r) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (r.profile?.full_name || "").toLowerCase().includes(s) ||
      (r.profile?.phone || "").includes(s) ||
      (r.car_plate || "").toLowerCase().includes(s);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الهاتف أو رقم اللوحة" className="pr-9" />
        </div>
        <Badge variant="outline" className="self-center px-3 py-1.5">{filtered.length} سائق</Badge>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground">لا يوجد سائقون</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-right p-3 font-semibold">السائق</th>
                  <th className="text-right p-3 font-semibold hidden md:table-cell">الهاتف</th>
                  <th className="text-right p-3 font-semibold hidden lg:table-cell">السيارة</th>
                  <th className="text-right p-3 font-semibold">التقييم</th>
                  <th className="text-right p-3 font-semibold">الحالة</th>
                  <th className="text-right p-3 font-semibold">الوثائق</th>
                  <th className="text-right p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <tr key={d.driver_id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9"><AvatarImage src={d.profile?.avatar_url ?? undefined} /><AvatarFallback>{d.profile?.full_name?.[0] ?? "?"}</AvatarFallback></Avatar>
                        <div className="font-semibold">{d.profile?.full_name ?? "—"}</div>
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground">{d.profile?.phone ?? "—"}</td>
                    <td className="p-3 hidden lg:table-cell text-muted-foreground">{d.car_model ?? "—"} {d.car_plate ? `· ${d.car_plate}` : ""}</td>
                    <td className="p-3"><div className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /><span className="font-semibold">{Number(d.profile?.rating ?? 5).toFixed(1)}</span></div></td>
                    <td className="p-3"><Badge className={STATUS_BADGE[d.account_status] + " border"} variant="outline">{STATUS_LABEL[d.account_status]}</Badge></td>
                    <td className="p-3">
                      {d.approved ? (
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">مكتملة</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">قيد المراجعة</Badge>
                      )}
                    </td>
                    <td className="p-3 text-left"><Button size="sm" variant="outline" onClick={() => setSelected(d)}>التفاصيل</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setReason(""); } }}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader><DialogTitle>تفاصيل السائق</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-14 w-14"><AvatarImage src={selected.profile?.avatar_url ?? undefined} /><AvatarFallback>{selected.profile?.full_name?.[0]}</AvatarFallback></Avatar>
                <div className="flex-1">
                  <div className="font-bold text-lg">{selected.profile?.full_name}</div>
                  <div className="text-sm text-muted-foreground">{selected.profile?.phone}</div>
                </div>
                <Badge className={STATUS_BADGE[selected.account_status] + " border"} variant="outline">{STATUS_LABEL[selected.account_status]}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/30"><div className="text-xs text-muted-foreground">السيارة</div><div className="font-semibold">{selected.car_model || "—"}</div></div>
                <div className="p-3 rounded-lg bg-muted/30"><div className="text-xs text-muted-foreground">رقم اللوحة</div><div className="font-semibold">{selected.car_plate || "—"}</div></div>
              </div>

              <div>
                <h4 className="font-semibold mb-2 text-sm">الوثائق المرفوعة</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { url: selected.driver_license_url, label: "رخصة قيادة" },
                    { url: selected.car_license_url, label: "رخصة سيارة" },
                    { url: selected.car_photo_url, label: "صورة السيارة" },
                  ].map((doc) => (
                    <a key={doc.label} href={doc.url ?? "#"} target="_blank" rel="noreferrer" className={`block aspect-square rounded-lg border-2 ${doc.url ? "border-primary/40 bg-muted/20 hover:border-primary" : "border-dashed border-border bg-muted/10"} overflow-hidden relative group`}>
                      {doc.url ? (
                        <img src={doc.url} alt={doc.label} className="w-full h-full object-cover" />
                      ) : (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">غير مرفوع</div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] py-1 text-center">{doc.label}</div>
                    </a>
                  ))}
                </div>
              </div>

              {(selected.rejection_reason || selected.suspension_reason) && (
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm">
                  <div className="font-semibold text-destructive mb-1">سبب سابق</div>
                  <div className="text-foreground/80">{selected.rejection_reason || selected.suspension_reason}</div>
                </div>
              )}

              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب (مطلوب عند الرفض / التعليق / الحظر)" rows={2} />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button size="sm" className="gap-1" onClick={() => update({ approved: true, rejection_reason: null })} disabled={busy}>
                  <FileCheck className="h-4 w-4" /> قبول الوثائق
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { if (!reason.trim()) { toast.error("اكتب السبب"); return; } update({ approved: false, rejection_reason: reason }); }} disabled={busy}>
                  <FileX className="h-4 w-4" /> رفض الوثائق
                </Button>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => update({ account_status: "active", suspension_reason: null })} disabled={busy}>
                  <ShieldCheck className="h-4 w-4" /> تفعيل
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-amber-600 border-amber-500/30 hover:bg-amber-500/10" onClick={() => { if (!reason.trim()) { toast.error("اكتب السبب"); return; } update({ account_status: "suspended", suspension_reason: reason }); }} disabled={busy}>
                  <ShieldAlert className="h-4 w-4" /> تعليق
                </Button>
                <Button size="sm" variant="outline" className="gap-1 col-span-2 sm:col-span-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { if (!reason.trim()) { toast.error("اكتب السبب"); return; } update({ account_status: "banned", suspension_reason: reason }); }} disabled={busy}>
                  <ShieldX className="h-4 w-4" /> حظر
                </Button>
                {busy && <div className="col-span-full flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
