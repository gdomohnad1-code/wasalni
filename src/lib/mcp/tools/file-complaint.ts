import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function userClient(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "file_complaint",
  title: "File a complaint",
  description:
    "Submit a support complaint on behalf of the signed-in user. Returns the created complaint id.",
  inputSchema: {
    subject: z.string().min(3).max(120).describe("Short subject line."),
    message: z.string().min(5).max(4000).describe("Full complaint details."),
    category: z
      .string()
      .optional()
      .describe("Category, e.g. 'general', 'driver', 'payment'. Defaults to 'general'."),
    ride_id: z.string().uuid().optional().describe("Optional related ride id."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ subject, message, category, ride_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = userClient(ctx);
    const { data, error } = await sb
      .from("complaints")
      .insert({
        user_id: ctx.getUserId()!,
        subject,
        message,
        category: category ?? "general",
        ride_id: ride_id ?? null,
      })
      .select("id,subject,status,created_at")
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: `Complaint filed: ${data?.id}` }],
      structuredContent: { complaint: data },
    };
  },
});
