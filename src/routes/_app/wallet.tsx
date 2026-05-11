import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_app/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { profile } = useAuth();
  const [txs, setTxs] = useState<any[]>([]);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setTxs(data || []);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-md mx-auto">
      <div className="bg-gradient-hero text-primary-foreground p-6 pb-10 rounded-b-3xl shadow-soft">
        <h1 className="font-bold text-xl mb-6">المحفظة</h1>
        <p className="text-sm opacity-90">رصيدك الحالي</p>
        <div className="text-5xl font-black mt-1">
          {profile?.wallet_balance?.toFixed(0) || 0} <span className="text-xl">ج.م</span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-2 bg-muted/50 border border-border rounded-xl p-3 mb-4">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            لإضافة رصيد إلى محفظتك، يمكنك التواصل مع السائق مباشرةً أو طلب الشحن من إدارة التطبيق.
          </p>
        </div>

        <h2 className="font-bold mb-3">سجل العمليات</h2>
        <div className="space-y-2">
          {txs.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">لا يوجد عمليات بعد</p>
          )}
          {txs.map((t, i) => {
            const positive = t.type === "topup" || t.type === "refund" || t.type === "referral_bonus";
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card p-3 rounded-xl shadow-card flex items-center gap-3"
              >
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {positive ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{t.description || t.type}</div>
                  <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString("ar-EG")}</div>
                </div>
                <div className={`font-bold ${positive ? "text-success" : "text-destructive"}`}>
                  {positive ? "+" : "-"}{t.amount} ج.م
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
