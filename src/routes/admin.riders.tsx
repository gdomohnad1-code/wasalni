import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listRiders,
  getRiderDetails,
  adjustRiderBalance,
  sendDirectNotification,
} from "@/lib/admin-riders.functions";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Search, Wallet, ArrowDownCircle, ArrowUpCircle,
  Bell, Car, Phone, Star, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/admin/riders")({
  component: RidersAdmin,
});

type Rider = {
  id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  wallet_balance: number;
  rating: number | null;
  created_at: string;
};

const PRESETS = [
  "تذكير: لديك رحلة قادمة قريبًا",
  "تم إضافة رصيد إلى محفظتك",
  "عرض خاص: خصم على رحلتك القادمة",
  "نأسف للإزعاج، يرجى التواصل مع خدمة العملاء",
  "تم تحديث بيانات حسابك",
  "أخرى…",
];

function RidersAdmin() {
  const fnList = useServerFn(listRiders);
  const fnDetails = useServerFn(getRiderDetails);
  const fnAdjust = useServerFn(adjustRiderBalance);
  const fnNotify = useServerFn(sendDirectNotification);

  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Rider | null>(null);
  const [details, setDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [view, setView] = useState<"profile" | "rides" | "balance" | "notify">("profile");

  // balance form
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // notify form
  const [preset, setPreset] = useState(PRESETS[0]);
  const [title, setTitle] = useState("إشعار من إدارة وصلني");
  const [body, setBody] = useState(PRESETS[0]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fnList();
      setRiders(r.riders as Rider[]);
    } catch (e: any) {
      toast.error(e?.message || "تعذر التحميل");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openRider = async (r: Rider) => {
    setSelected(r);
    setView("profile");
    setAmount(""); setNote("");
    setPreset(PRESETS[0]); setBody(PRESETS[0]); setTitle("إشعار من إدارة وصلني");
    setLoadingDetails(true);
    try {
      const d = await fnDetails({ data: { riderId: r.id } });
      setDetails(d);
    } catch (e: any) {
      toast.error(e?.message || "تعذر تحميل البيانات");
    } finally {
      setLoadingDetails(false);
    }
  };

  const filtered = useMemo(() => {
    if (!q) return riders;
    const s = q.toLowerCase();
    return riders.filter(
      (r) => r.full_name?.toLowerCase().includes(s) || (r.phone || "").includes(s),
    );
  }, [riders, q]);

  const submitBalance = async (action: "add" | "withdraw") => {
    if (!selected) return;
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("ادخل قيمة صحيحة"); return; }
    setBusy(true);
    try {
      const res = await fnAdjust({ data: { riderId: selected.id, amount: amt, action, note: note || undefined } });
      toast.success(`تم — الرصيد الجديد: ${res.balance.toFixed(2)} ج.م`);
      setAmount(""); setNote("");
      // refresh
      const d = await fnDetails({ data: { riderId: selected.id } });
      setDetails(d);
      setRiders((prev) => prev.map((x) => x.id === selected.id ? { ...x, wallet_balance: res.balance } : x));
      setSelected({ ...selected, wallet_balance: res.balance });
    } catch (e: any) {
      toast.error(e?.message || "تعذر التنفيذ");
    } finally {
      setBusy(false);
    }
  };

  const submitNotify = async () => {
    if (!selected) return;
    if (!title.trim() || !body.trim()) { toast.error("اكتب العنوان والمحتوى"); return; }
    setBusy(true);
    try {
      await fnNotify({ data: { userId: selected.id, title, body } });
      toast.success("تم إرسال الإشعار");
    } catch (e: any) {
      toast.error(e?.message || "تعذر الإرسال");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الهاتف" className="pr-9" />
        </div>
        <Badge variant="outline" className="self-center px-3 py-1.5">{filtered.length} عميل</Badge>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">لا يوجد عملاء</Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => openRider(r)}
              className="group flex flex-col items-center gap-2 p-3 rounded-xl bg-card hover:bg-muted/50 border border-border transition shadow-sm hover:shadow-elegant"
            >
              <Avatar className="h-20 w-20 ring-2 ring-primary/10 group-hover:ring-primary/40 transition">
                <AvatarImage src={r.avatar_url ?? undefined} className="object-cover" />
                <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">
                  {r.full_name?.[0] ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="text-sm font-semibold text-center line-clamp-1 w-full">{r.full_name || "—"}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Wallet className="h-3 w-3" />{Number(r.wallet_balance ?? 0).toFixed(0)} ج.م
              </div>
            </button>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setDetails(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>ملف العميل</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* header */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-l from-primary/10 to-transparent border border-border">
                <Avatar className="h-20 w-20 ring-2 ring-primary/30">
                  <AvatarImage src={selected.avatar_url ?? undefined} className="object-cover" />
                  <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">{selected.full_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="font-bold text-lg">{selected.full_name}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{selected.phone || "—"}</div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />{Number(selected.rating ?? 5).toFixed(1)}</span>
                    <span className="flex items-center gap-1"><Wallet className="h-3.5 w-3.5 text-primary" />{Number(selected.wallet_balance ?? 0).toFixed(2)} ج.م</span>
                  </div>
                </div>
              </div>

              {/* action buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Button variant={view === "rides" ? "default" : "outline"} className="gap-1.5" onClick={() => setView("rides")}>
                  <Car className="h-4 w-4" /> الرحلات
                </Button>
                <Button variant={view === "balance" ? "default" : "outline"} className="gap-1.5" onClick={() => { setView("balance"); }}>
                  <ArrowUpCircle className="h-4 w-4" /> إضافة / سحب رصيد
                </Button>
                <Button variant={view === "notify" ? "default" : "outline"} className="gap-1.5" onClick={() => setView("notify")}>
                  <Bell className="h-4 w-4" /> إرسال إشعار
                </Button>
                <Button variant={view === "profile" ? "default" : "outline"} className="gap-1.5" onClick={() => setView("profile")}>
                  بياناته
                </Button>
              </div>

              {loadingDetails ? (
                <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
              ) : (
                <>
                  {view === "profile" && details?.profile && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[
                        ["الاسم الكامل", details.profile.full_name],
                        ["الهاتف", details.profile.phone],
                        ["كود الإحالة", details.profile.referral_code],
                        ["التقييم", Number(details.profile.rating ?? 5).toFixed(1)],
                        ["رصيد المحفظة", `${Number(details.profile.wallet_balance ?? 0).toFixed(2)} ج.م`],
                        ["تاريخ التسجيل", new Date(details.profile.created_at).toLocaleDateString("ar-EG")],
                      ].map(([label, val]) => (
                        <div key={label} className="p-3 rounded-lg bg-muted/30">
                          <div className="text-xs text-muted-foreground">{label}</div>
                          <div className="font-semibold">{val || "—"}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {view === "rides" && (
                    <div className="space-y-2">
                      {(details?.rides ?? []).length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">لا توجد رحلات</p>
                      ) : (
                        details.rides.map((r: any) => (
                          <div key={r.id} className="p-3 rounded-lg border border-border bg-card space-y-2">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                              <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</span>
                            </div>
                            <div className="text-sm flex items-center gap-2">
                              <span className="line-clamp-1">{r.pickup_address}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="line-clamp-1">{r.destination_address}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>السعر: <b className="text-foreground">{Number(r.price).toFixed(2)} ج.م</b></span>
                              {r.distance_km && <span>{Number(r.distance_km).toFixed(1)} كم</span>}
                              {r.rating && <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500 fill-amber-500" />{r.rating}</span>}
                            </div>
                            {r.driver ? (
                              <div className="flex items-center gap-2 pt-2 border-t border-border">
                                <Avatar className="h-7 w-7"><AvatarImage src={r.driver.avatar_url ?? undefined} /><AvatarFallback>{r.driver.full_name?.[0]}</AvatarFallback></Avatar>
                                <div className="text-xs">
                                  <div className="font-semibold">السائق: {r.driver.full_name}</div>
                                  <div className="text-muted-foreground">{r.driver.phone}</div>
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground pt-1">— لم يُسند سائق —</div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {view === "balance" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="القيمة بالجنيه" />
                        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة (اختياري)" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button onClick={() => submitBalance("add")} disabled={busy} className="gap-1.5">
                          <ArrowUpCircle className="h-4 w-4" /> إضافة رصيد
                        </Button>
                        <Button variant="outline" onClick={() => submitBalance("withdraw")} disabled={busy} className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                          <ArrowDownCircle className="h-4 w-4" /> سحب رصيد
                        </Button>
                      </div>
                      {(details?.transactions ?? []).length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">آخر الحركات</h4>
                          <div className="space-y-1.5 max-h-48 overflow-y-auto">
                            {details.transactions.slice(0, 10).map((t: any) => (
                              <div key={t.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                                <span className="text-muted-foreground">{new Date(t.created_at).toLocaleString("ar-EG")}</span>
                                <span className="text-foreground/80 line-clamp-1 flex-1 px-2">{t.description}</span>
                                <span className={`font-bold ${Number(t.amount) >= 0 ? "text-primary" : "text-destructive"}`}>
                                  {Number(t.amount) >= 0 ? "+" : ""}{Number(t.amount).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {view === "notify" && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">رسالة جاهزة</label>
                        <Select value={preset} onValueChange={(v) => { setPreset(v); if (v !== "أخرى…") setBody(v); else setBody(""); }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PRESETS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الإشعار" />
                      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="نص الإشعار" rows={4} />
                      <Button onClick={submitNotify} disabled={busy} className="w-full gap-1.5">
                        <Bell className="h-4 w-4" /> إرسال الإشعار
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
