import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendFcmToTokens } from "@/lib/fcm.server";
import { z } from "zod";

const Schema = z.object({
  audience: z.enum(["all", "drivers", "riders", "drivers_riders"]),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(1000),
});

export const sendBroadcastNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // permission gate: super_admin, full_control, or notifications
    const { data: perms } = await supabase
      .from("admin_permissions")
      .select("permission")
      .eq("user_id", userId);

    const allowed = (perms ?? []).some((p: any) =>
      ["super_admin", "full_control", "notifications"].includes(p.permission),
    );
    if (!allowed) {
      throw new Response("Forbidden", { status: 403 });
    }

    // resolve recipients
    let userIds: string[] = [];
    if (data.audience === "all") {
      const { data: rows } = await supabaseAdmin.from("profiles").select("id");
      userIds = (rows ?? []).map((r: any) => r.id);
    } else {
      const roles =
        data.audience === "drivers"
          ? ["driver"]
          : data.audience === "riders"
            ? ["rider"]
            : ["driver", "rider"];
      const { data: rows } = await supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .in("role", roles as any);
      userIds = Array.from(new Set((rows ?? []).map((r: any) => r.user_id)));
    }

    if (userIds.length === 0) return { sent: 0 };

    const payload = userIds.map((uid) => ({
      user_id: uid,
      title: data.title,
      body: data.body,
    }));

    // chunked insert
    const CHUNK = 500;
    let sent = 0;
    for (let i = 0; i < payload.length; i += CHUNK) {
      const slice = payload.slice(i, i + CHUNK);
      const { error } = await supabaseAdmin.from("notifications").insert(slice);
      if (error) throw new Response(error.message, { status: 500 });
      sent += slice.length;
    }

    return { sent };
  });
