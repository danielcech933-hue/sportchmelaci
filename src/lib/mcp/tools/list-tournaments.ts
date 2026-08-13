import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { NOT_AUTHENTICATED, errorResult, textResult } from "../result";

export default defineTool({
  name: "list_tournaments",
  title: "List tournaments",
  description: "List tournaments with their sport, format, status and scheduled start.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).default(10).describe("How many tournaments to return."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult(NOT_AUTHENTICATED);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("tournaments")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data ?? []), { tournaments: data ?? [] });
  },
});
