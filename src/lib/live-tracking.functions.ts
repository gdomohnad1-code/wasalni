import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendFcmToTokens } from "@/lib/fcm.server";
import { z } from "zod";

// ---------- helpers ----------
async function ensureAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const ok = (data ?? []).some((r: any) => r.role === "admin");
  if (!ok) throw new Response("Forbidden", { status: 403 });
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ---------- list active drivers (admin) ----------
export const listLiveDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { data: locations } = await supabaseAdmin.from("driver_locations").select("*");
    const ids = (locations ?? []).map((l: any) => l.driver_id);
    if (ids.length === 0) return { drivers: [] as any[] };

    const [{ data: profiles }, { data: docs }, { data: rideCounts }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, phone, avatar_url, rating").in("id", ids),
      supabaseAdmin.from("driver_documents").select("driver_id, car_model, car_plate, account_status").in("driver_id", ids),
      supabaseAdmin.from("rides").select("driver_id, status").in("driver_id", ids),
    ]);

    const profMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const docMap = new Map((docs ?? []).map((d: any) => [d.driver_id, d]));
    const countMap = new Map<string, number>();
    (rideCounts ?? []).forEach((r: any) => {
      if (r.status === "completed") countMap.set(r.driver_id, (countMap.get(r.driver_id) ?? 0) + 1);
    });

    const drivers = (locations ?? []).map((l: any) => ({
      ...l,
      profile: profMap.get(l.driver_id) ?? null,
      doc: docMap.get(l.driver_id) ?? null,
      total_rides: countMap.get(l.driver_id) ?? 0,
    }));
    return { drivers };
  });

// ---------- get driver detail with route history ----------
export const getDriverDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ driverId: z.string().uuid(), hours: z.number().min(1).max(168).default(6) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const since = new Date(Date.now() - data.hours * 3600_000).toISOString();
    const [{ data: profile }, { data: doc }, { data: location }, { data: history }, { data: activeRide }, { data: completed }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*").eq("id", data.driverId).maybeSingle(),
        supabaseAdmin.from("driver_documents").select("*").eq("driver_id", data.driverId).maybeSingle(),
        supabaseAdmin.from("driver_locations").select("*").eq("driver_id", data.driverId).maybeSingle(),
        supabaseAdmin.from("driver_location_history").select("lat,lng,recorded_at,speed,ride_id").eq("driver_id", data.driverId).gte("recorded_at", since).order("recorded_at", { ascending: true }).limit(2000),
        supabaseAdmin.from("rides").select("*").eq("driver_id", data.driverId).in("status", ["accepted", "in_progress"]).maybeSingle(),
        supabaseAdmin.from("rides").select("price, completed_at").eq("driver_id", data.driverId).eq("status", "completed"),
      ]);
    return {
      profile, doc, location, history: history ?? [], activeRide,
      stats: {
        total_rides: (completed ?? []).length,
        total_earnings: (completed ?? []).reduce((s: number, r: any) => s + Number(r.price ?? 0) * 0.8, 0),
      },
    };
  });

// ---------- toggle driver account status (active/suspended) ----------
export const toggleDriverAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ driverId: z.string().uuid(), action: z.enum(["activate", "suspend"]), reason: z.string().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    if (data.action === "suspend") {
      await supabaseAdmin.from("driver_documents").update({
        account_status: "suspended", suspension_reason: data.reason ?? "تم التعطيل من الإدارة",
      }).eq("driver_id", data.driverId);
    } else {
      await supabaseAdmin.from("driver_documents").update({
        account_status: "active", suspension_reason: null,
      }).eq("driver_id", data.driverId);
    }
    await supabaseAdmin.from("notifications").insert({
      user_id: data.driverId,
      title: data.action === "suspend" ? "تم تعطيل حسابك" : "تم تفعيل حسابك",
      body: data.action === "suspend" ? (data.reason ?? "تم تعطيل حسابك من الإدارة") : "تم تفعيل حسابك مرة أخرى، يمكنك العمل الآن.",
    });
    return { ok: true };
  });

// ---------- find nearest available driver ----------
export const findNearestDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ lat: z.number(), lng: z.number(), radiusKm: z.number().min(0.1).max(100).default(15) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data: rows } = await supabaseAdmin.from("driver_locations").select("driver_id, lat, lng, presence, updated_at").eq("presence", "available");
    const fresh = (rows ?? []).filter((r: any) => Date.now() - new Date(r.updated_at).getTime() < 5 * 60_000);
    const ranked = fresh
      .map((r: any) => ({ ...r, distance_km: haversineKm({ lat: data.lat, lng: data.lng }, { lat: r.lat, lng: r.lng }) }))
      .filter((r: any) => r.distance_km <= data.radiusKm)
      .sort((a: any, b: any) => a.distance_km - b.distance_km)
      .slice(0, 5);
    if (ranked.length === 0) return { drivers: [] };
    const ids = ranked.map((r: any) => r.driver_id);
    const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, phone, rating").in("id", ids);
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return { drivers: ranked.map((r: any) => ({ ...r, profile: map.get(r.driver_id) })) };
  });

// ---------- analytics ----------
export const getAnalyticsOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ days: z.number().min(1).max(90).default(7) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const since = new Date(Date.now() - data.days * 86400_000).toISOString();

    const [{ data: rides }, { data: locations }, { data: pickups }] = await Promise.all([
      supabaseAdmin.from("rides").select("id, status, price, created_at, completed_at, driver_id, pickup_lat, pickup_lng, distance_km, rating"),
      supabaseAdmin.from("driver_locations").select("driver_id, presence"),
      supabaseAdmin.from("rides").select("pickup_lat, pickup_lng").gte("created_at", since).not("pickup_lat", "is", null),
    ]);

    const ridesArr = rides ?? [];
    const recent = ridesArr.filter((r: any) => r.created_at >= since);

    // daily series
    const byDay = new Map<string, { day: string; rides: number; revenue: number }>();
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
      byDay.set(d, { day: d, rides: 0, revenue: 0 });
    }
    recent.forEach((r: any) => {
      const d = String(r.created_at).slice(0, 10);
      const slot = byDay.get(d);
      if (slot) { slot.rides += 1; slot.revenue += Number(r.price ?? 0); }
    });

    const completedRecent = recent.filter((r: any) => r.status === "completed");
    const ratingsRecent = completedRecent.filter((r: any) => r.rating).map((r: any) => Number(r.rating));

    return {
      kpi: {
        total_rides: ridesArr.length,
        completed_rides: ridesArr.filter((r: any) => r.status === "completed").length,
        revenue: ridesArr.filter((r: any) => r.status === "completed").reduce((s: number, r: any) => s + Number(r.price ?? 0), 0),
        active_drivers: (locations ?? []).filter((l: any) => l.presence !== "offline").length,
        available_drivers: (locations ?? []).filter((l: any) => l.presence === "available").length,
        avg_rating: ratingsRecent.length ? ratingsRecent.reduce((a, b) => a + b, 0) / ratingsRecent.length : 0,
      },
      daily: Array.from(byDay.values()),
      heatmap: (pickups ?? []).map((p: any) => [Number(p.pickup_lat), Number(p.pickup_lng), 0.6]),
    };
  });

// ---------- driver daily stats (for driver dashboard) ----------
export const getDriverDailyStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const startISO = start.toISOString();
    const { data: rides } = await supabaseAdmin.from("rides").select("price, status, distance_km, duration_min, completed_at").eq("driver_id", userId).gte("created_at", startISO);
    const completed = (rides ?? []).filter((r: any) => r.status === "completed");
    const earnings = completed.reduce((s: number, r: any) => s + Number(r.price ?? 0) * 0.8, 0);
    const minutes = completed.reduce((s: number, r: any) => s + Number(r.duration_min ?? 0), 0);
    return {
      rides_today: completed.length,
      earnings_today: earnings,
      hours_today: minutes / 60,
      distance_today: completed.reduce((s: number, r: any) => s + Number(r.distance_km ?? 0), 0),
    };
  });

// ---------- geofences CRUD ----------
const PolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
});

export const listGeofences = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data } = await supabaseAdmin.from("geofences").select("*").order("created_at", { ascending: false });
    return { zones: data ?? [] };
  });

export const saveGeofence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().min(1).max(120),
      polygon: PolygonSchema,
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#3b82f6"),
      active: z.boolean().default(true),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    if (data.id) {
      await supabaseAdmin.from("geofences").update({ name: data.name, polygon: data.polygon, color: data.color, active: data.active }).eq("id", data.id);
      return { id: data.id };
    }
    const { data: row } = await supabaseAdmin.from("geofences").insert({ name: data.name, polygon: data.polygon, color: data.color, active: data.active, created_by: userId }).select("id").single();
    return { id: row?.id };
  });

export const deleteGeofence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    await supabaseAdmin.from("geofences").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------- alerts ----------
export const listOpenAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data: alerts } = await supabaseAdmin.from("driver_alerts").select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(100);
    const ids = Array.from(new Set((alerts ?? []).map((a: any) => a.driver_id)));
    const { data: profs } = ids.length ? await supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", ids) : { data: [] as any[] };
    const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
    return { alerts: (alerts ?? []).map((a: any) => ({ ...a, profile: map.get(a.driver_id) })) };
  });

export const resolveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    await supabaseAdmin.from("driver_alerts").update({ resolved: true, resolved_by: userId, resolved_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true };
  });

// ---------- send push to specific driver from dashboard ----------
export const pushToDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ driverId: z.string().uuid(), title: z.string().min(1).max(120), body: z.string().min(1).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    await supabaseAdmin.from("notifications").insert({ user_id: data.driverId, title: data.title, body: data.body });
    try {
      const { data: tokens } = await supabaseAdmin.from("device_tokens").select("token").eq("user_id", data.driverId);
      const list = (tokens ?? []).map((t: any) => t.token);
      if (list.length) await sendFcmToTokens(list, data.title, data.body);
    } catch (e) { console.error("FCM:", e); }
    return { ok: true };
  });
