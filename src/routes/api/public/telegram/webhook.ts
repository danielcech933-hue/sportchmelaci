import { createFileRoute } from "@tanstack/react-router";
import {
  callTelegram,
  getTelegramConfig,
  hashPhone,
  phoneLast4,
  safeEqual,
  telegramWebhookSecret,
} from "@/lib/telegram.server";

type TgContact = { phone_number?: string; user_id?: number };
type TgUpdate = {
  message?: {
    chat?: { id?: number };
    from?: { id?: number; username?: string };
    text?: string;
    contact?: TgContact;
  };
};

const SHARE_KEYBOARD = {
  keyboard: [[{ text: "📱 Sdílet moje telefonní číslo", request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

function normalizePhone(value: string) {
  const trimmed = value.trim().replace(/[\s()-]/g, "");
  return trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed;
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const config = getTelegramConfig();
        if (!config) return Response.json({ ok: true, disabled: true });

        const expected = telegramWebhookSecret(config.token);
        const actual = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
        if (!safeEqual(actual, expected)) return new Response("Unauthorized", { status: 401 });

        const update = (await request.json()) as TgUpdate;
        const message = update.message;
        const chatId = message?.chat?.id;
        const fromId = message?.from?.id;
        if (!chatId || !fromId) return Response.json({ ok: true, ignored: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as unknown as {
          rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
          from: (table: string) => { update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => Promise<{ error: unknown }> } };
        };

        const text = (message?.text ?? "").trim();
        if (text.startsWith("/start")) {
          const token = text.split(/\s+/)[1] ?? "";
          if (!token) {
            await callTelegram(config.token, "sendMessage", { chat_id: chatId, text: "Ahoj! Otevři ověřovací odkaz ze SportChmeláci." });
            return Response.json({ ok: true });
          }

          const { data: bound } = await admin.rpc("telegram_bind_chat", { _token: token, _telegram_chat_id: chatId });
          if (!bound) {
            await callTelegram(config.token, "sendMessage", { chat_id: chatId, text: "Tento ověřovací odkaz už vypršel. Spusť propojení znovu v aplikaci." });
            return Response.json({ ok: true });
          }

          await callTelegram(config.token, "sendMessage", {
            chat_id: chatId,
            text: "Ověření je zdarma přes Telegram — žádná SMS.\n\nKlepni na tlačítko níže a potvrď sdílení svého telefonního čísla.",
            reply_markup: SHARE_KEYBOARD,
          });
          return Response.json({ ok: true });
        }

        const contact = message?.contact;
        if (contact?.phone_number) {
          if (contact.user_id !== fromId) {
            await callTelegram(config.token, "sendMessage", { chat_id: chatId, text: "Použij prosím tlačítko „Sdílet moje telefonní číslo“ a sdílej svoje vlastní číslo.", reply_markup: SHARE_KEYBOARD });
            return Response.json({ ok: true, rejected: "contact_mismatch" });
          }

          const { data: pendingToken } = await admin.rpc("telegram_pending_token", { _telegram_chat_id: chatId });
          const token = typeof pendingToken === "string" ? pendingToken : null;
          if (!token) {
            await callTelegram(config.token, "sendMessage", { chat_id: chatId, text: "Nemám aktivní ověřovací relaci. Vrať se do SportChmeláci a spusť ověření znovu." });
            return Response.json({ ok: true, rejected: "no_session" });
          }

          const phone = normalizePhone(contact.phone_number);
          const { data: userId, error } = await admin.rpc("telegram_complete_link", {
            _token: token,
            _telegram_user_id: fromId,
            _telegram_chat_id: chatId,
            _telegram_username: message?.from?.username ?? null,
            _phone_hash: hashPhone(phone, config.token),
            _phone_last4: phoneLast4(phone),
          });
          if (error || !userId) {
            console.error("[telegram] complete_link failed", error);
            await callTelegram(config.token, "sendMessage", { chat_id: chatId, text: "Propojení se nepodařilo dokončit. Zkus to prosím znovu." });
            return Response.json({ ok: true, rejected: "link_failed" });
          }

          const { error: storeError } = await admin.from("telegram_verifications").update({ phone_number: phone }).eq("user_id", String(userId));
          if (storeError) console.error("[telegram] private phone store failed", storeError);

          await callTelegram(config.token, "sendMessage", { chat_id: chatId, text: "✅ Hotovo! Telefon je ověřený přes Telegram. Veřejné telefonní volání je volitelné v profilu.", reply_markup: { remove_keyboard: true } });
          return Response.json({ ok: true, verified: true });
        }

        return Response.json({ ok: true, ignored: true });
      },
    },
  },
});
