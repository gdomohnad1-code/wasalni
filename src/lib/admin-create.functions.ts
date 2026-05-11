import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const Schema = z.object({
  identifier: z.string().trim().min(3).max(80),
  password: z.string().min(6).max(72),
  full_name: z.string().trim().min(1).max(80),
  permission: z.enum([
    "super_admin",
    "full_control",
    "assigner",
    "collections",
    "notifications",
    "viewer",
  ]),
});

async function ensureAdmin(userId: string) {
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (u?.user?.email?.toLowerCase() !== "admin@wasalni.app") {
    throw new Response("Forbidden — main admin only", { status: 403 });
  }
}

export const createAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.identifier);
    const email = isEmail
      ? data.identifier.toLowerCase()
      : `${data.identifier.toLowerCase().replace(/[^a-z0-9_.-]/g, "")}@admins.wasalni.local`;

    // Create the auth user (email auto-confirmed so they can sign in immediately)
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.full_name, is_admin_created: true },
      });
    if (createErr || !created.user) {
      throw new Response(createErr?.message ?? "فشل إنشاء الحساب", { status: 400 });
    }
    const newId = created.user.id;

    // Profile is auto-created by handle_new_user trigger; ensure name set
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.full_name })
      .eq("id", newId);

    // Force admin role (trigger may have set 'rider' if email isn't in admin_emails)
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newId);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newId, role: "admin" as any });

    // Set permission
    await supabaseAdmin
      .from("admin_permissions")
      .delete()
      .eq("user_id", newId);
    await supabaseAdmin.from("admin_permissions").insert({
      user_id: newId,
      permission: data.permission,
      granted_by: context.userId,
    });

    // Remember the password (visible only to main admin via getAdminPassword)
    await (supabaseAdmin as any)
      .from("admin_credentials")
      .upsert(
        { user_id: newId, email, password: data.password, updated_by: context.userId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    return {
      ok: true,
      user_id: newId,
      login_email: email,
      is_synthetic_email: !isEmail,
    };
  });

const ResetSchema = z.object({
  user_id: z.string().uuid(),
  password: z.string().min(6).max(72),
});

export const resetAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResetSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    // Confirm target is actually an admin
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Response("المستخدم ليس مسؤولًا", { status: 400 });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    if (error) throw new Response(error.message, { status: 400 });

    // Remember new password
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (u?.user?.email) {
      await (supabaseAdmin as any).from("admin_credentials").upsert(
        { user_id: data.user_id, email: u.user.email, password: data.password, updated_by: context.userId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    }

    return { ok: true };
  });

const ResetByEmailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(72),
});

export const resetPasswordByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ResetByEmailSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    // Look up user by email via admin API (paged scan)
    let foundId: string | null = null;
    let page = 1;
    while (page <= 10 && !foundId) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Response(error.message, { status: 400 });
      const u = list.users.find((x) => x.email?.toLowerCase() === data.email);
      if (u) foundId = u.id;
      if (list.users.length < 200) break;
      page++;
    }
    if (!foundId) throw new Response("لا يوجد حساب مسجَّل بهذا البريد بعد", { status: 404 });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(foundId, {
      password: data.password,
    });
    if (error) throw new Response(error.message, { status: 400 });

    await (supabaseAdmin as any).from("admin_credentials").upsert(
      { user_id: foundId, email: data.email, password: data.password, updated_by: context.userId, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    return { ok: true, user_id: foundId };
  });

const GetByEmailSchema = z.object({ email: z.string().trim().toLowerCase().email() });

export const getAdminPasswordByEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetByEmailSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { data: row } = await (supabaseAdmin as any)
      .from("admin_credentials")
      .select("password, updated_at")
      .eq("email", data.email)
      .maybeSingle();
    if (!row) return { ok: false as const };
    return { ok: true as const, password: row.password as string, updated_at: row.updated_at as string };
  });

const GetByIdSchema = z.object({ user_id: z.string().uuid() });

export const getAdminPasswordById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GetByIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { data: row } = await (supabaseAdmin as any)
      .from("admin_credentials")
      .select("password, updated_at")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!row) return { ok: false as const };
    return { ok: true as const, password: row.password as string, updated_at: row.updated_at as string };
  });
