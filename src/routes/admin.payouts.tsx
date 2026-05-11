import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Check, X, Download, Wallet } from "lucide-react";

export const Route = createFileRoute("/admin/payouts")({
  component: PayoutsAdmin,
});

type Withdrawal = {
  id: string;
  driver_id: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  created_at: string;
  processed_at: string | null;
  profile?: { full_name: string; phone: string | null; avatar_url: string | null; wallet_balance: number } | null;
};

type DriverBalance = { id: string; full_name: string; avatar_url: string | null; wallet_balance: number; phone: string | null };

function PayoutsAdmin() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Withdrawal[]>([]);
  const [balances, setBalances] = useState<DriverBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "history" | "balances">("pending");
  const [selected, setSelected] = useState<Withdrawal | null>(null);
  const [action, setAction] = useState<"approved" | "rejected">("approved");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: wr }, { data: drvRoles }] = await Promise.all([
      supabase.from("withdrawal_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id").eq("role", "driver"),
    ]);
    const driverIds = [...new Set([...(wr ?? []).map((w) => w.driver_id), ...(drvRoles ?? []).map((r) => r.user_id)])];
    const { data: profs } = await supabase.from("profiles").select("id, full_name, phone, avatar_url, wallet_balance").in("id", driverIds);
    const map = new Map(profs?.map((p) => [p.id, p]) ?? []);
    setRequests((wr ?? []).map((w) => ({ ...w, profile: map.get(w.driver_id) ?? null })) as Withdrawal[]);
    setBalances((drvRoles ?? []).map((r) => map.get(r.user_id)).filter(Boolean) as DriverBalance[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("payouts-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawal_requests" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const submit = async () => {
    if (!selected || !user) return;
    if (action === "rejected" && !reason.trim()) { toast.error("اكتب سبب الرفض"); return; }
    setBusy(true);

    const { error: upErr } = await supabase.from("withdrawal_requests").update({
      status: action,
      reason: reason.trim() || null,
      processed_by: user.id,
      processed_at: new Date().toISOString(),
    }).eq("id", selected.id).eq("status", "pending");

    if (upErr) { setBusy(false); toast.error("تعذر تنفيذ العملية"); return; }

    if (action === "approved") {
      const newBalance = Number(selected.profile?.wallet_balance ?? 0) - Number(selected.amount);
      await supabase.from("profiles").update({ wallet_balance: newBalance }).eq("id", selected.driver_id);
      await supabase.from("wallet_transactions").insert({
        user_id: selected.driver_id,
        amount: -Number(selected.amount),
        type: "withdrawal" as any,
        description: `سحب رصيد - تمت الموافقة #${selected.id.slice(0, 8)}`,
      });
      await supabase.from("notifications").insert({
        user_id: selected.driver_id,
        title: "تمت الموافقة على طلب السحب",
        body: `تم سحب ${selected.amount} ج.م من رصيدك`,
      } as any).then(() => {});
    } else {
      await supabase.from("notifications").insert({
        user_id: selected.driver_id,
        title: "تم رفض طلب السحب",
        body: reason,
      } as any).then(() => {});
    }

    setBusy(false);
    toast.success(action === "approved" ? "تمت الموافقة" : "تم الرفض");
    setSelected(null); setReason("");
  };

  const exportCsv = () => {
    const rows = [["التاريخ", "السائق", "الهاتف", "المبلغ", "الحالة", "السبب"]];
    requests.forEach((r) => rows.push([
      new Date(r.created_at).toLocaleString("ar-EG"),
      r.profile?.full_name ?? "",
      r.profile?.phone ?? "",
      String(r.amount),
      r.status,
      r.reason ?? "",
    ]));
    const csv = "\uFEFF" + rows.map((r) => r.map((c) => `"${(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `payouts-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const pending = requests.filter((r) => r.status === "pending");
  const history = requests.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[
          { k: "pending", l: "طلبات السحب", n: pending.length },
          { k: "history", l: "السجل", n: history.length },
          { k: "balances", l: "أرصدة السائقين", n: balances.length },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
              tab === t.k ? "bg-primary text-primary-foreground border-primary shadow-elegant" : "bg-card border-border text-muted-foreground hover:border-primary/40"
            }`}>
            {t.l} <span className="text-[11px] opacity-80">({t.n})</span>
          </button>
        ))}
        <Button variant="outline" size="sm" className="ms-auto gap-1.5" onClick={exportCsv}><Download className="h-4 w-4" /> تصدير</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr>
                  <th className="text-right p-3 font-semibold">السائق</th>
                  {tab !== "balances" && <th className="text-right p-3 font-semibold">المبلغ</th>}
                  {tab === "balances" && <th className="text-right p-3 font-semibold">الرصيد الحالي</th>}
                  <th className="text-right p-3 font-semibold hidden md:table-cell">{tab === "balances" ? "الهاتف" : "التاريخ"}</th>
                  {tab !== "balances" && <th className="text-right p-3 font-semibold">الحالة</th>}
                  {tab === "pending" && <th className="text-right p-3"></th>}
                </tr>
              </thead>
              <tbody>
                {tab === "balances" ? (
                  balances.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-12 text-muted-foreground">لا يوجد سائقون</td></tr>
                  ) : balances.map((b) => (
                    <tr key={b.id} className="border-t border-border">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8"><AvatarImage src={b.avatar_url ?? undefined} /><AvatarFallback>{b.full_name?.[0]}</AvatarFallback></Avatar>
                          <span className="font-semibold">{b.full_name}</span>
                        </div>
                      </td>
                      <td className="p-3"><span className="font-bold text-primary">{Number(b.wallet_balance).toFixed(2)} ج.م</span></td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground">{b.phone ?? "—"}</td>
                    </tr>
                  ))
                ) : (
                  (tab === "pending" ? pending : history).length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">{tab === "pending" ? "لا توجد طلبات سحب جديدة" : "لا توجد سجلات"}</td></tr>
                  ) : (tab === "pending" ? pending : history).map((r) => (
                    <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8"><AvatarImage src={r.profile?.avatar_url ?? undefined} /><AvatarFallback>{r.profile?.full_name?.[0]}</AvatarFallback></Avatar>
                          <div>
                            <div className="font-semibold">{r.profile?.full_name}</div>
                            <div className="text-xs text-muted-foreground">{r.profile?.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-bold text-primary">{Number(r.amount).toFixed(2)} ج.م</td>
                      <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString("ar-EG")}</td>
                      <td className="p-3">
                        {r.status === "pending" && <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">قيد الانتظار</Badge>}
                        {r.status === "approved" && <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">تمت الموافقة</Badge>}
                        {r.status === "rejected" && <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">مرفوض</Badge>}
                      </td>
                      {tab === "pending" && (
                        <td className="p-3 text-left">
                          <div className="flex gap-1.5 justify-end">
                            <Button size="sm" className="gap-1 h-8" onClick={() => { setSelected(r); setAction("approved"); setReason(""); }}>
                              <Check className="h-3.5 w-3.5" /> موافقة
                            </Button>
                            <Button size="sm" variant="outline" className="gap-1 h-8 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => { setSelected(r); setAction("rejected"); setReason(""); }}>
                              <X className="h-3.5 w-3.5" /> رفض
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{action === "approved" ? "تأكيد الموافقة على السحب" : "رفض طلب السحب"}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/40 flex items-center gap-3">
                <Wallet className="h-8 w-8 text-primary" />
                <div>
                  <div className="font-bold">{selected.profile?.full_name}</div>
                  <div className="text-sm text-muted-foreground">المبلغ المطلوب: <span className="font-bold text-foreground">{Number(selected.amount).toFixed(2)} ج.م</span></div>
                  <div className="text-xs text-muted-foreground">الرصيد الحالي: {Number(selected.profile?.wallet_balance ?? 0).toFixed(2)} ج.م</div>
                </div>
              </div>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={action === "rejected" ? "سبب الرفض (مطلوب)" : "ملاحظات (اختياري)"} rows={3} />
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>إلغاء</Button>
            <Button onClick={submit} disabled={busy} variant={action === "rejected" ? "destructive" : "default"}>
              {busy && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              {action === "approved" ? "تأكيد الموافقة" : "تأكيد الرفض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
