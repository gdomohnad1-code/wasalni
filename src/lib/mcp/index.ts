import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMyRides from "./tools/list-my-rides";
import getMyProfile from "./tools/get-my-profile";
import fileComplaint from "./tools/file-complaint";

// The OAuth issuer MUST be the direct Supabase host. VITE_SUPABASE_PROJECT_ID is
// inlined by Vite at build time; the fallback keeps the issuer well-formed during
// the manifest-extract eval (a token never verifies against the sentinel).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "wasalny-mcp",
  title: "Wasalny MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Wasalny ride & delivery app. Use `get_my_profile` to fetch the signed-in user's profile and wallet balance, `list_my_rides` to review their recent trips, and `file_complaint` to submit a support ticket on their behalf.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMyProfile, listMyRides, fileComplaint],
});
