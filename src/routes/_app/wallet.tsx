import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, ArrowDown, ArrowUp, CreditCard, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { profile, refresh } = useAuth();
  const [txs, setTxs] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(50);
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [processing, setProcessing] = useState(false);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50);
    setTxs(data || []);
  };

  useEffect(() => { load(); }, []);

  const cleanCard = cardNumber.replace(/\s/g, "");
  const cardBrand = cleanCard.startsWith("4") ? "visa" : (/^(5[1-5]|2[2-7])/.test(cleanCard) ? "mastercard" : null);

  const formatCard = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const formatExp = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  const topup = async () => {
    if (cleanCard.length < 16 || !cardBrand) return toast.error("رقم بطاقة غير صحيح (Visa / Mastercard فقط)");
    if (!cardName.trim()) return toast.error("ادخل اسم حامل البطاقة");
    if (expiry.length < 5) return toast.error("تاريخ انتهاء غير صحيح");
    if (cvv.length < 3) return toast.error("CVV غير صحيح");
    if (amount < 10) return toast.error("الحد الأدنى للشحن 10 ج.م");

    setProcessing(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setProcessing(false); return; }

    // محاكاة عملية الدفع البنكية (يمكن ربطها لاحقاً ببوابة دفع حقيقية)
    await new Promise((r) => setTimeout(r, 1200));

    const last4 = cleanCard.slice(-4);
    await supabase.from("wallet_transactions").insert({
      user_id: user.id,
      type: "topup",
      amount,
      description: `شحن عبر ${cardBrand === "visa" ? "Visa" : "Mastercard"} •••• ${last4}`,
    });
    await supabase.from("profiles").update({ wallet_balance: (profile?.wallet_balance || 0) + amount }).eq("id", user.id);
    toast.success(`تم شحن ${amount} ج.م ✨`);
    setOpen(false);
    setCardNumber(""); setCardName(""); setExpiry(""); setCvv("");
    setProcessing(false);
    refresh();
    load();
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-gradient-hero text-primary-foreground p-6 pb-12 rounded-b-3xl shadow-soft">
        <h1 className="font-bold text-xl mb-6">المحفظة</h1>
        <p className="text-sm opacity-90">رصيدك الحالي</p>
        <div className="text-5xl font-black mt-1">{profile?.wallet_balance?.toFixed(0) || 0} <span className="text-xl">ج.م</span></div>
        <Button onClick={() => setOpen(true)} className="mt-5 bg-white text-primary hover:bg-white/90 font-bold">
          <Plus className="h-4 w-4 ml-1" /> شحن الرصيد
        </Button>
      </div>

      <div className="p-4">
        <h2 className="font-bold mb-3">سجل العمليات</h2>
        <div className="space-y-2">
          {txs.length === 0 && <p className="text-center text-sm text-muted-foreground py-10">لا يوجد عمليات بعد</p>}
          {txs.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-card p-3 rounded-xl shadow-card flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${t.type === "topup" || t.type === "refund" || t.type === "referral_bonus" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                {t.type === "topup" || t.type === "refund" || t.type === "referral_bonus" ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{t.description || t.type}</div>
                <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("ar-EG")}</div>
              </div>
              <div className={`font-bold ${t.type === "topup" || t.type === "refund" || t.type === "referral_bonus" ? "text-success" : "text-destructive"}`}>
                {t.type === "ride_payment" ? "-" : "+"}{t.amount} ج.م
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>شحن المحفظة</DialogTitle>
          </DialogHeader>

          <div>
            <p className="text-xs text-muted-foreground mb-2">اختر المبلغ</p>
            <div className="grid grid-cols-3 gap-2">
              {[20, 50, 100, 200, 500, 1000].map((v) => (
                <button key={v} onClick={() => setAmount(v)}
                  className={`p-3 rounded-xl border-2 font-bold transition ${amount === v ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40"}`}>
                  {v}
                </button>
              ))}
            </div>
            <Input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} className="mt-2" placeholder="مبلغ مخصص" />
          </div>

          {/* بطاقة الدفع */}
          <div className="mt-4 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-white p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <CreditCard className="h-6 w-6 opacity-80" />
              <div className="flex gap-1.5">
                <span className={`text-[10px] font-black px-2 py-1 rounded ${cardBrand === "visa" ? "bg-white text-blue-700" : "bg-white/20"}`}>VISA</span>
                <span className={`text-[10px] font-black px-2 py-1 rounded ${cardBrand === "mastercard" ? "bg-white text-orange-600" : "bg-white/20"}`}>MC</span>
              </div>
            </div>
            <div className="mt-4 tracking-[0.2em] font-mono text-lg" dir="ltr">
              {cardNumber || "•••• •••• •••• ••••"}
            </div>
            <div className="mt-3 flex justify-between text-[11px] uppercase opacity-80">
              <span>{cardName || "اسم حامل البطاقة"}</span>
              <span dir="ltr">{expiry || "MM/YY"}</span>
            </div>
          </div>

          <div className="space-y-2 mt-3">
            <Input dir="ltr" placeholder="رقم البطاقة" value={cardNumber} onChange={(e) => setCardNumber(formatCard(e.target.value))} inputMode="numeric" />
            <Input placeholder="اسم حامل البطاقة" value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} />
            <div className="grid grid-cols-2 gap-2">
              <Input dir="ltr" placeholder="MM/YY" value={expiry} onChange={(e) => setExpiry(formatExp(e.target.value))} inputMode="numeric" />
              <Input dir="ltr" placeholder="CVV" value={cvv} onChange={(e) => setCvv(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" />
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-2">
            <Lock className="h-3 w-3" /> الدفع آمن ومشفّر — Visa و Mastercard فقط
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={processing}>إلغاء</Button>
            <Button onClick={topup} disabled={processing} className="bg-gradient-primary">
              {processing ? "جارٍ الدفع..." : `ادفع ${amount} ج.م`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
