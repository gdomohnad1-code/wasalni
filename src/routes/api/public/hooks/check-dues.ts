import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import "@tanstack/react-start";

const FREEZE_DAYS = 5;
const REMINDER_DAYS = 3;

// Daily cron — freezes drivers with unpaid dues older than 5 days,
// sends reminders at 3 days.
export const Route = createFileRoute("/api/public/hooks/check-dues")({
  server: {
    handlers: {
      POST: async () => {
        const now = Date.now();
        const freezeCutoff = new Date(now - FREEZE_DAYS * 86400000).toISOString();
        const remindCutoff = new Date(now - REMINDER_DAYS * 86400000).toISOString();
        const reminderRepeat = new Date(now - 24 * 3600000).toISOString();

        // Aggregate unpaid commissions per driver (oldest + total)
        const { data: commissions, error: cErr } = await supabaseAdmin
          .from("driver_commissions")
          .select("driver_id, amount, created_at")
          .eq("status", "unpaid");
        if (cErr) return Response.json({ error: cErr.message }, { status: 500 });

        const byDriver = new Map<string, { oldest: string; total: number }>();
        for (const c of commissions ?? []) {
          const cur = byDriver.get(c.driver_id) ?? { oldest: c.created_at, total: 0 };
          if (c.created_at < cur.oldest) cur.oldest = c.created_at;
          cur.total += Number(c.amount);
          byDriver.set(c.driver_id, cur);
        }

        const toFreeze: string[] = [];
        const toRemind: { id: string; total: number }[] = [];
        for (const [driverId, info] of byDriver.entries()) {
          if (info.oldest <= freezeCutoff) toFreeze.push(driverId);
          else if (info.oldest <= remindCutoff) toRemind.push({ id: driverId, total: info.total });
        }

        let frozen = 0;
        let reminders = 0;

        // Freeze
        if (toFreeze.length) {
          const { data: docs } = await supabaseAdmin
            .from("driver_documents")
            .select("driver_id, account_status")
            .in("driver_id", toFreeze);
          const eligible = (docs ?? [])
            .filter((d) => d.account_status === "active")
            .map((d) => d.driver_id);

          if (eligible.length) {
            const { error: fErr } = await supabaseAdmin
              .from("driver_documents")
              .update({
                account_status: "suspended",
                suspension_reason: "تجميد تلقائي - مستحقات غير مدفوعة لأكثر من 5 أيام",
                dues_since: new Date().toISOString(),
              })
              .in("driver_id", eligible);
            if (!fErr) {
              frozen = eligible.length;
              await supabaseAdmin.from("notifications").insert(
                eligible.map((id) => ({
                  user_id: id,
                  title: "تم تجميد حسابك",
                  body: "تم تجميد حسابك تلقائيًا بسبب عدم سداد المستحقات. يرجى التواصل مع الإدارة.",
                }))
              );
            }
          }
        }

        // Reminders (skip if already reminded in last 24h)
        if (toRemind.length) {
          const ids = toRemind.map((r) => r.id);
          const { data: docs } = await supabaseAdmin
            .from("driver_documents")
            .select("driver_id, last_reminder_at")
            .in("driver_id", ids);
          const lastMap = new Map((docs ?? []).map((d: any) => [d.driver_id, d.last_reminder_at]));

          const eligible = toRemind.filter((r) => {
            const last = lastMap.get(r.id);
            return !last || last < reminderRepeat;
          });

          if (eligible.length) {
            await supabaseAdmin.from("notifications").insert(
              eligible.map((r) => ({
                user_id: r.id,
                title: "تذكير: مستحقات مستحقة الدفع",
                body: `لديك مستحقات بقيمة ${r.total.toFixed(2)} ج.م. يجب سدادها قبل تجميد الحساب.`,
              }))
            );
            await supabaseAdmin
              .from("driver_documents")
              .update({ last_reminder_at: new Date().toISOString() })
              .in("driver_id", eligible.map((r) => r.id));
            reminders = eligible.length;
          }
        }

        return Response.json({
          ok: true,
          checked: byDriver.size,
          frozen,
          reminders,
        });
      },
    },
  },
});
