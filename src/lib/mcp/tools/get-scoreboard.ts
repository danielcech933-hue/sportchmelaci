import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { NOT_AUTHENTICATED, errorResult, textResult } from "../result";

export default defineTool({
  name: "get_scoreboard",
  title: "Get scoreboard",
  description: "Return the community player ranking ordered by ELO rating.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many players to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult(NOT_AUTHENTICATED);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("profiles")
      .select("nickname,elo,arcade_points")
      .order("elo", { ascending: false })
      .limit(limit);
    if (error) return errorResult(error.message);
    const rows = (data ?? []).map((r, i) => ({ rank: i + 1, ...r }));
    return textResult(JSON.stringify(rows), { ranking: rows });
  },
});
