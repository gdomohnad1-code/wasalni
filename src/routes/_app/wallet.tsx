import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/wallet")({
  component: WalletPage,
});

function WalletPage() {
  const { profile, refresh } = useAuth();
  const { t, locale } = useI18n();
  const [txs, setTxs] = useState<any[]>([]);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;


  const load = async (uid?: string) => {
    let userId = uid;
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;
    }
    const { data } = await supabase
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    setTxs(data || []);
  };

  useEffect(() => {
    let userId: string | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;
      await load(userId);

      channel = supabase
        .channel(`wallet-${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${userId}` },
          (payload) => {
            setTxs((prev) => {
              if (prev.some((t) => t.id === (payload.new as any).id)) return prev;
              return [payload.new as any, ...prev].slice(0, 50);
            });
            refresh?.();
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
          () => { refresh?.(); },
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [refresh]);



  return (
    <div className="max-w-md mx-auto">
      <div className="bg-gradient-hero text-primary-foreground p-6 pb-10 rounded-b-3xl shadow-soft">
        <h1 className="font-bold text-xl mb-6">{t("wallet.title")}</h1>
        <p className="text-sm opacity-90">{t("wallet.balance")}</p>
        <div className="text-5xl font-black mt-1">
          {profile?.wallet_balance?.toFixed(0) || 0} <span className="text-xl">{t("c.currency")}</span>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-2 bg-muted/50 border border-border rounded-xl p-3 mb-4">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">{t("wallet.info")}</p>
        </div>

        <h2 className="font-bold mb-3">{t("wallet.history")}</h2>
        <div className="space-y-2">
          {txs.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-10">{t("wallet.empty")}</p>
          )}
          {txs.map((tx, i) => {
            const positive = tx.type === "topup" || tx.type === "refund" || tx.type === "referral_bonus";
            const isChange = tx.type === "refund" && tx.ride_id;
            return (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-card p-3 rounded-xl shadow-card flex items-center gap-3"
              >
                <div className={`h-10 w-10 rounded-full flex items-center justify-center ${positive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                  {positive ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm font-semibold">{tx.description || tx.type}</div>
                    {isChange && (
                      <span className="text-[10px] bg-success/15 text-success font-bold px-2 py-0.5 rounded-full">
                        باقي فكة
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString(locale)}</div>
                  <div className="text-[10px] text-muted-foreground/80 font-mono mt-0.5 flex gap-2 flex-wrap">
                    <span>#{String(tx.id).slice(0, 8)}</span>
                    {tx.ride_id && <span>رحلة: {String(tx.ride_id).slice(0, 8)}</span>}
                  </div>
                </div>
                <div className={`font-bold whitespace-nowrap ${positive ? "text-success" : "text-destructive"}`}>
                  {positive ? "+" : "-"}{tx.amount} {t("c.currency")}
                </div>
              </motion.div>
            );
          })}

        </div>
      </div>
    </div>
  );
}
