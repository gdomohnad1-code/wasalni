import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendFcmToTokens } from "@/lib/fcm.server";
import { z } from "zod";

const Schema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
});

export const sendTestPushToSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: rows } = await supabaseAdmin
      .from("device_tokens")
      .select("token")
      .eq("user_id", userId);
    const tokens = (rows ?? []).map((r: any) => r.token);
    if (tokens.length === 0) {
      return { success: 0, failure: 0, tokens: 0, message: "no-tokens" };
    }
    const result = await sendFcmToTokens(tokens, data.title, data.body);
    if (result.invalidTokens.length > 0) {
      await supabaseAdmin
        .from("device_tokens")
        .delete()
        .in("token", result.invalidTokens);
    }
    return {
      success: result.success,
      failure: result.failure,
      tokens: tokens.length,
      message: "sent",
    };
  });

export const listMyDeviceTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data } = await supabaseAdmin
      .from("device_tokens")
      .select("token, platform, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return (data ?? []).map((r: any) => ({
      token: r.token,
      platform: r.platform,
      created_at: r.created_at,
    }));
  });
