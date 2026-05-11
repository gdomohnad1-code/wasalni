import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendFcmToTokens } from "@/lib/fcm.server";
import { z } from "zod";

// ============= Helpers =============

async function pushAndNotify(userIds: string[], title: string, body: string) {
  if (userIds.length === 0) return;
  await supabaseAdmin
    .from("notifications")
    .insert(userIds.map((uid) => ({ user_id: uid, title, body })));
  try {
    const { data: tokens } = await supabaseAdmin
      .from("device_tokens")
      .select("token")
      .in("user_id", userIds);
    const list = (tokens ?? []).map((t: any) => t.token);
    if (list.length) {
      const r = await sendFcmToTokens(list, title, body);
      if (r.invalidTokens.length)
        await supabaseAdmin
          .from("device_tokens")
          .delete()
          .in("token", r.invalidTokens);
    }
  } catch (e) {
    console.error("FCM push (driver app) failed:", (e as any)?.message ?? e);
  }
}

async function ensureAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!roles?.some((r: any) => r.role === "admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

// ============= Get my application =============

export const getMyApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("driver_documents")
      .select("*")
      .eq("driver_id", userId)
      .maybeSingle();
    return { application: data };
  });

// ============= Submit / resubmit application =============

const SubmitSchema = z.object({
  id_card_front_url: z.string().url(),
  id_card_back_url: z.string().url(),
  selfie_url: z.string().url(),
  driver_license_url: z.string().url(),
  car_photo_url: z.string().url(),
  car_license_url: z.string().url(),
  car_type: z.string().min(1).max(60),
  car_model: z.string().min(1).max(80),
  car_plate: z.string().min(1).max(40),
});

export const submitDriverApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SubmitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Check eligibility: not active, not in cooldown
    const { data: existing } = await supabaseAdmin
      .from("driver_documents")
      .select("account_status, next_attempt_at")
      .eq("driver_id", userId)
      .maybeSingle();

    if (existing?.account_status === "active") {
      throw new Response("أنت بالفعل سائق مفعّل", { status: 400 });
    }
    if (
      existing?.account_status === "rejected" &&
      existing.next_attempt_at &&
      new Date(existing.next_attempt_at).getTime() > Date.now()
    ) {
      throw new Response("لا يمكن إعادة التقديم الآن", { status: 400 });
    }

    const payload = {
      driver_id: userId,
      ...data,
      account_status: "pending" as const,
      approved: false,
      submitted_at: new Date().toISOString(),
      rejection_reason: null,
      change_request_message: null,
      fields_to_fix: [],
      next_attempt_at: null,
    };

    const { error } = await supabaseAdmin
      .from("driver_documents")
      .upsert(payload, { onConflict: "driver_id" });
    if (error) throw new Response(error.message, { status: 500 });

    await pushAndNotify(
      [userId],
      "تم استلام طلبك ✅",
      "تم استلام طلب الانضمام كسائق. ستتم المراجعة خلال 48 ساعة.",
    );

    return { ok: true };
  });

// ============= Admin: list pending applications =============

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    let query = supabaseAdmin
      .from("driver_documents")
      .select("*")
      .order("submitted_at", { ascending: false, nullsFirst: false });
    if (data.status) query = query.eq("account_status", data.status as any);
    else
      query = query.in("account_status", [
        "pending",
        "changes_requested",
        "rejected",
      ] as any);
    const { data: rows, error } = await query;
    if (error) throw new Response(error.message, { status: 500 });

    // Attach profile info
    const ids = (rows ?? []).map((r: any) => r.driver_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin
          .from("profiles")
          .select("id, full_name, phone, avatar_url")
          .in("id", ids)
      : { data: [] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return {
      applications: (rows ?? []).map((r: any) => ({
        ...r,
        profile: map.get(r.driver_id) ?? null,
      })),
    };
  });

// ============= Admin: get one application detail =============

export const getApplicationDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { driverId: string }) =>
    z.object({ driverId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { data: app } = await supabaseAdmin
      .from("driver_documents")
      .select("*")
      .eq("driver_id", data.driverId)
      .maybeSingle();
    if (!app) throw new Response("Not found", { status: 404 });
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, avatar_url")
      .eq("id", data.driverId)
      .maybeSingle();
    // sign URLs that are paths to driver-applications bucket
    const fields = [
      "id_card_front_url",
      "id_card_back_url",
      "selfie_url",
      "driver_license_url",
      "car_photo_url",
      "car_license_url",
    ] as const;
    const signed: Record<string, string> = {};
    for (const f of fields) {
      const v = (app as any)[f] as string | null;
      if (v && v.startsWith("driver-applications/")) {
        const path = v.replace(/^driver-applications\//, "");
        const { data: s } = await supabaseAdmin.storage
          .from("driver-applications")
          .createSignedUrl(path, 60 * 60);
        if (s?.signedUrl) signed[f] = s.signedUrl;
      } else if (v) {
        signed[f] = v;
      }
    }
    return { application: app, profile, signedUrls: signed };
  });

// ============= Admin: approve =============

export const approveApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { driverId: string }) =>
    z.object({ driverId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("driver_documents")
      .update({
        account_status: "active",
        approved: true,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
        rejection_reason: null,
        change_request_message: null,
        fields_to_fix: [],
        next_attempt_at: null,
      })
      .eq("driver_id", data.driverId);
    if (error) throw new Response(error.message, { status: 500 });

    // Add driver role if missing
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: data.driverId, role: "driver" as any }, {
        onConflict: "user_id,role",
      });

    await pushAndNotify(
      [data.driverId],
      "🎉 تم قبولك كسائق",
      "تهانينا! تم تفعيل حسابك كسائق. يمكنك بدء العمل الآن.",
    );
    return { ok: true };
  });

// ============= Admin: reject =============

export const rejectApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { driverId: string; reason: string }) =>
    z
      .object({
        driverId: z.string().uuid(),
        reason: z.string().min(3).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const nextAttempt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: cur } = await supabaseAdmin
      .from("driver_documents")
      .select("rejection_count")
      .eq("driver_id", data.driverId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("driver_documents")
      .update({
        account_status: "rejected",
        approved: false,
        rejection_reason: data.reason,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
        next_attempt_at: nextAttempt,
        rejection_count: (cur?.rejection_count ?? 0) + 1,
      })
      .eq("driver_id", data.driverId);
    if (error) throw new Response(error.message, { status: 500 });

    await pushAndNotify(
      [data.driverId],
      "تم رفض طلب الانضمام",
      `السبب: ${data.reason}. يمكنك إعادة التقديم بعد 24 ساعة.`,
    );
    return { ok: true };
  });

// ============= Super-admin: manually create driver =============

const ManualCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(72),
  full_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().nullable(),
  car_type: z.string().trim().max(60).optional().nullable(),
  car_model: z.string().trim().max(80).optional().nullable(),
  car_plate: z.string().trim().max(40).optional().nullable(),
  id_card_front_url: z.string().url().optional().nullable(),
  id_card_back_url: z.string().url().optional().nullable(),
  selfie_url: z.string().url().optional().nullable(),
  driver_license_url: z.string().url().optional().nullable(),
  car_photo_url: z.string().url().optional().nullable(),
  car_license_url: z.string().url().optional().nullable(),
});

async function ensureMainSuperAdmin(userId: string) {
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = u?.user?.email?.toLowerCase();
  if (email !== "admin@wasalni.app") {
    throw new Response("Forbidden — main super admin only", { status: 403 });
  }
}

export const manuallyCreateDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ManualCreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureMainSuperAdmin(context.userId);

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.full_name,
          phone: data.phone ?? undefined,
        },
      });
    if (createErr || !created.user) {
      throw new Response(createErr?.message ?? "فشل إنشاء الحساب", { status: 400 });
    }
    const newId = created.user.id;

    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name, phone: data.phone ?? null })
      .eq("id", newId);

    // Force driver role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: "driver" as any });

    // Create activated driver_documents (allow incomplete)
    await supabaseAdmin.from("driver_documents").upsert(
      {
        driver_id: newId,
        car_type: data.car_type ?? null,
        car_model: data.car_model ?? null,
        car_plate: data.car_plate ?? null,
        id_card_front_url: data.id_card_front_url ?? null,
        id_card_back_url: data.id_card_back_url ?? null,
        selfie_url: data.selfie_url ?? null,
        driver_license_url: data.driver_license_url ?? null,
        car_photo_url: data.car_photo_url ?? null,
        car_license_url: data.car_license_url ?? null,
        account_status: "active" as any,
        approved: true,
        submitted_at: new Date().toISOString(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
      },
      { onConflict: "driver_id" },
    );

    return { ok: true, user_id: newId, email: data.email };
  });

// ============= Admin: request changes =============

const ChangeFieldsEnum = z.enum([
  "id_card_front_url",
  "id_card_back_url",
  "selfie_url",
  "driver_license_url",
  "car_photo_url",
  "car_license_url",
  "car_type",
  "car_model",
  "car_plate",
]);

export const requestApplicationChanges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { driverId: string; fields: string[]; message: string }) =>
      z
        .object({
          driverId: z.string().uuid(),
          fields: z.array(ChangeFieldsEnum).min(1).max(20),
          message: z.string().min(3).max(500),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("driver_documents")
      .update({
        account_status: "changes_requested",
        change_request_message: data.message,
        fields_to_fix: data.fields,
        reviewed_at: new Date().toISOString(),
        reviewed_by: context.userId,
        next_attempt_at: null,
      })
      .eq("driver_id", data.driverId);
    if (error) throw new Response(error.message, { status: 500 });

    await pushAndNotify(
      [data.driverId],
      "مطلوب تعديل بيانات طلبك",
      `${data.message} — افتح طلبك لتعديل البيانات المطلوبة.`,
    );
    return { ok: true };
  });
