import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendFcmToTokens } from "@/lib/fcm.server";
import { z } from "zod";

async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!(data ?? []).some((r: any) => r.role === "admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

export const listRiders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "rider" as any);
    const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id)));
    if (ids.length === 0) return { riders: [] };
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, avatar_url, wallet_balance, rating, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false });
    return { riders: profiles ?? [] };
  });

export const getRiderDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ riderId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.riderId)
      .maybeSingle();
    const { data: rides } = await supabaseAdmin
      .from("rides")
      .select("*")
      .eq("rider_id", data.riderId)
      .order("created_at", { ascending: false })
      .limit(100);
    const driverIds = Array.from(new Set((rides ?? []).map((r: any) => r.driver_id).filter(Boolean)));
    let drivers: any[] = [];
    if (driverIds.length) {
      const { data: dp } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone, avatar_url")
        .in("id", driverIds);
      drivers = dp ?? [];
    }
    const driverMap = Object.fromEntries(drivers.map((d) => [d.id, d]));
    const ridesWithDriver = (rides ?? []).map((r: any) => ({
      ...r,
      driver: r.driver_id ? driverMap[r.driver_id] ?? null : null,
    }));
    const { data: txs } = await supabaseAdmin
      .from("wallet_transactions")
      .select("*")
      .eq("user_id", data.riderId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { profile, rides: ridesWithDriver, transactions: txs ?? [] };
  });

export const adjustRiderBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      riderId: z.string().uuid(),
      amount: z.number().positive(),
      action: z.enum(["add", "withdraw"]),
      note: z.string().max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("wallet_balance")
      .eq("id", data.riderId)
      .maybeSingle();
    if (!profile) throw new Response("Rider not found", { status: 404 });
    const current = Number(profile.wallet_balance ?? 0);
    const delta = data.action === "add" ? data.amount : -data.amount;
    const next = current + delta;
    if (next < 0) throw new Response("الرصيد غير كافٍ للسحب", { status: 400 });

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ wallet_balance: next })
      .eq("id", data.riderId);
    if (upErr) throw new Response(upErr.message, { status: 500 });

    await supabaseAdmin.from("wallet_transactions").insert({
      user_id: data.riderId,
      type: data.action === "add" ? "topup" : "refund",
      amount: delta,
      description: data.note || (data.action === "add" ? "إضافة رصيد من الإدارة" : "سحب رصيد من الإدارة"),
    } as any);

    return { balance: next };
  });

export const sendDirectNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      userId: z.string().uuid(),
      title: z.string().min(1).max(120),
      body: z.string().min(1).max(1000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin.from("notifications").insert({
      user_id: data.userId,
      title: data.title,
      body: data.body,
    } as any);
    if (error) throw new Response(error.message, { status: 500 });

    try {
      const { data: tokenRows } = await supabaseAdmin
        .from("device_tokens")
        .select("token")
        .eq("user_id", data.userId);
      const tokens = (tokenRows ?? []).map((r: any) => r.token);
      if (tokens.length > 0) {
        await sendFcmToTokens(tokens, data.title, data.body);
      }
    } catch (e: any) {
      console.error("FCM send failed:", e?.message ?? e);
    }
    return { ok: true };
  });
