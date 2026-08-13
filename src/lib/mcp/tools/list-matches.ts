import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { NOT_AUTHENTICATED, errorResult, textResult } from "../result";

export default defineTool({
  name: "list_matches",
  title: "List matches",
  description:
    "List matches from the scoreboard. Use scope 'upcoming' for scheduled fixtures, 'recent' for finished matches, or 'all'. Optionally filter by sport.",
  inputSchema: {
    scope: z.enum(["upcoming", "recent", "all"]).default("recent").describe("Which matches to return."),
    sport: z.string().trim().min(1).optional().describe("Filter by sport key, e.g. 'tennis'."),
    limit: z.number().int().min(1).max(50).default(10).describe("Maximum number of matches."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ scope, sport, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult(NOT_AUTHENTICATED);
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("matches")
      .select(
        "id,sport,team_a,team_b,score_a,score_b,sets,scheduled_at,started_at,ended_at,confirmed_at,tournament_id",
      )
      .limit(limit);

    if (sport) query = query.eq("sport", sport);
    if (scope === "upcoming") {
      query = query.is("ended_at", null).not("scheduled_at", "is", null).order("scheduled_at", { ascending: true });
    } else if (scope === "recent") {
      query = query.not("ended_at", "is", null).order("ended_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? []), { matches: data ?? [] });
  },
});
