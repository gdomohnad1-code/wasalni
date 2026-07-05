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
  name: "list_my_rides",
  title: "List my rides",
  description:
    "List the signed-in user's recent rides (as rider) with pickup, destination, price, and status.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max number of rides to return (default 10)."),
    status: z
      .string()
      .optional()
      .describe("Optional status filter, e.g. 'completed', 'cancelled', 'in_progress'."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, status }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = userClient(ctx);
    let q = sb
      .from("rides")
      .select(
        "id,created_at,pickup_address,destination_address,price,distance_km,status,rating,ride_type,completed_at",
      )
      .eq("rider_id", ctx.getUserId()!)
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (status) q = q.eq("status", status as never);
    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { rides: data ?? [] },
    };
  },
});
