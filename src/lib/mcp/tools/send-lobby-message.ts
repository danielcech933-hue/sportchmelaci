import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";
import { NOT_AUTHENTICATED, errorResult, textResult } from "../result";

export default defineTool({
  name: "send_lobby_message",
  title: "Send lobby chat message",
  description: "Post a message to the public SportChmeláci lobby chat as the signed-in player.",
  inputSchema: {
    content: z.string().trim().min(1).max(500).describe("Message text to post in the lobby chat."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ content }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult(NOT_AUTHENTICATED);
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;
    const { data: profile } = await supabase.from("profile_public").select("nickname").eq("id", userId).maybeSingle();
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ user_id: userId, nickname: profile?.nickname ?? "player", content })
      .select("id,nickname,content,created_at");
    if (error) return errorResult(error.message);
    return textResult(JSON.stringify(data?.[0] ?? {}), { message: data?.[0] });
  },
});
