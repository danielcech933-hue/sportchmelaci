import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TelegramStatus = {
  configured: boolean;
  verified: boolean;
  phoneLast4: string | null;
  telegramUsername: string | null;
  verifiedAt: string | null;
  botUsername: string | null;
};

export type TelegramLinkStart =
  | { ok: true; deepLink: string; expiresAt: string; botUsername: string }
  | { ok: false; reason: "not_configured" | "failed" };

/** Current Telegram verification state for the signed-in player. */
export const getTelegramStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TelegramStatus> => {
    const { getTelegramConfig } = await import("./telegram.server");
    const config = getTelegramConfig();

    const { data } = await (context.supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> };
        };
      };
    })
      .from("telegram_verifications")
      .select("phone_last4,telegram_username,verified_at")
      .eq("user_id", context.userId)
      .maybeSingle();

    return {
      configured: Boolean(config),
      verified: Boolean(data?.["verified_at"]),
      phoneLast4: (data?.["phone_last4"] as string | undefined) ?? null,
      telegramUsername: (data?.["telegram_username"] as string | undefined) ?? null,
      verifiedAt: (data?.["verified_at"] as string | undefined) ?? null,
      botUsername: config?.username ?? null,
    };
  });

/** Creates a one-time, 15-minute deep link that binds this account to the Telegram chat. */
export const startTelegramLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TelegramLinkStart> => {
    const { getTelegramConfig } = await import("./telegram.server");
    const config = getTelegramConfig();
    if (!config) return { ok: false, reason: "not_configured" };

    const { data, error } = await (context.supabase as unknown as {
      rpc: (n: string) => Promise<{ data: Array<{ token: string; expires_at: string }> | null; error: unknown }>;
    }).rpc("telegram_start_link");

    const row = data?.[0];
    if (error || !row) {
      console.error("[telegram] start_link failed", error);
      return { ok: false, reason: "failed" };
    }

    return {
      ok: true,
      deepLink: `https://t.me/${config.username}?start=${row.token}`,
      expiresAt: row.expires_at,
      botUsername: config.username,
    };
  });

/** Registers the webhook with Telegram. Admin-only, runs once after the bot token is set. */
export const registerTelegramWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { baseUrl: string }) => {
    if (!/^https:\/\/[a-z0-9.-]+$/i.test(input.baseUrl.replace(/\/$/, ""))) throw new Error("Invalid base URL");
    return { baseUrl: input.baseUrl.replace(/\/$/, "") };
  })
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await (context.supabase as unknown as {
      rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: boolean | null }>;
    }).rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const { getTelegramConfig, telegramWebhookSecret, callTelegram } = await import("./telegram.server");
    const config = getTelegramConfig();
    if (!config) return { ok: false, reason: "not_configured" as const };

    const res = await callTelegram(config.token, "setWebhook", {
      url: `${data.baseUrl}/api/public/telegram/webhook`,
      secret_token: telegramWebhookSecret(config.token),
      allowed_updates: ["message"],
    });
    return { ok: res.ok, status: res.status, body: res.body };
  });

/**
 * End-to-end ready match reminder over the free Telegram channel.
 * Sends nothing when the bot token is missing or the player is not linked.
 */
export const sendTelegramMatchReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; title: string; startsAt?: string; note?: string }) => ({
    userId: String(input.userId),
    title: String(input.title).slice(0, 200),
    startsAt: input.startsAt ? String(input.startsAt).slice(0, 40) : undefined,
    note: input.note ? String(input.note).slice(0, 300) : undefined,
  }))
  .handler(async ({ data, context }) => {
    const { getTelegramConfig, callTelegram } = await import("./telegram.server");
    const config = getTelegramConfig();
    if (!config) return { ok: false, reason: "not_configured" as const };

    // Players may only trigger reminders for themselves; admins for anyone.
    if (data.userId !== context.userId) {
      const { data: isAdmin } = await (context.supabase as unknown as {
        rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: boolean | null }>;
      }).rpc("has_role", { _user_id: context.userId, _role: "admin" });
      if (!isAdmin) throw new Error("Forbidden");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> };
        };
      };
    })
      .from("telegram_verifications")
      .select("telegram_chat_id,notifications_enabled")
      .eq("user_id", data.userId)
      .maybeSingle();

    const chatId = row?.["telegram_chat_id"] as number | undefined;
    if (!chatId || row?.["notifications_enabled"] === false) {
      return { ok: false, reason: "not_linked" as const };
    }

    const lines = [
      `🏆 <b>Připomínka zápasu</b>`,
      data.title,
      data.startsAt ? `🕒 ${data.startsAt}` : null,
      data.note ?? null,
    ].filter(Boolean);

    const res = await callTelegram(config.token, "sendMessage", {
      chat_id: chatId,
      text: lines.join("\n"),
      parse_mode: "HTML",
    });
    return { ok: res.ok, status: res.status };
  });
