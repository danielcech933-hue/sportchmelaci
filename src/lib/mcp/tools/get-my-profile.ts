import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { NOT_AUTHENTICATED, errorResult, textResult } from "../result";

export default defineTool({
  name: "get_my_profile",
  title: "Get my profile",
  description: "Return the signed-in player's nickname, ELO, dollar balance and slot credits.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult(NOT_AUTHENTICATED);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,nickname,elo,balance,slot_czk,arcade_points,created_at")
      .eq("id", ctx.getUserId()!)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!data) return errorResult("No profile found for this account.");
    return textResult(JSON.stringify(data), { profile: data });
  },
});
