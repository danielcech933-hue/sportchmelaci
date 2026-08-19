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
    const [{ data, error }, { data: wallet }] = await Promise.all([
      supabase
        .from("profile_public")
        .select("id,nickname,elo,arcade_points,created_at")
        .eq("id", ctx.getUserId()!)
        .maybeSingle(),
      supabase.rpc("get_my_wallet"),
    ]);
    if (error) return errorResult(error.message);
    if (!data) return errorResult("No profile found for this account.");
    const w = (Array.isArray(wallet) ? wallet[0] : wallet) as { balance?: number; slot_czk?: number } | null;
    const profile = { ...data, balance: Number(w?.balance ?? 0), slot_czk: Number(w?.slot_czk ?? 0) };
    return textResult(JSON.stringify(profile), { profile });

  },
});
