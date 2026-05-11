import { supabase } from "@/integrations/supabase/client";

export async function destinationForUser(userId: string): Promise<"/admin" | "/home"> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return data?.some((r) => r.role === "admin") ? "/admin" : "/home";
}
