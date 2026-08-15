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

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const config = getTelegramConfig();
        // Bot not configured yet: accept and ignore, never crash the app.
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
        };

        const text = (message?.text ?? "").trim();
        if (text.startsWith("/start")) {
          const token = text.split(/\s+/)[1] ?? "";
          if (!token) {
            await callTelegram(config.token, "sendMessage", {
              chat_id: chatId,
              text: "Ahoj! Otevři prosím ověřovací odkaz přímo v aplikaci SportChmeláci — dostaneš jednorázový odkaz na propojení.",
            });
            return Response.json({ ok: true });
          }

          const { data: bound } = await admin.rpc("telegram_bind_chat", {
            _token: token,
            _telegram_chat_id: chatId,
          });
          if (!bound) {
            await callTelegram(config.token, "sendMessage", {
              chat_id: chatId,
              text: "Tento odkaz už vypršel. Vrať se do aplikace a vygeneruj nový ověřovací odkaz.",
            });
            return Response.json({ ok: true });
          }

          await callTelegram(config.token, "sendMessage", {
            chat_id: chatId,
            text: "Ověření je zdarma přes Telegram — žádná SMS.\n\nKlepni na tlačítko níže a potvrď sdílení svého telefonního čísla. Ukládáme jen zabezpečený hash čísla a poslední 4 číslice.",
            reply_markup: SHARE_KEYBOARD,
          });
          return Response.json({ ok: true });
        }

        const contact = message?.contact;
        if (contact?.phone_number) {
          // Anti-spoof: the shared contact must belong to the sender.
          if (contact.user_id !== fromId) {
            await callTelegram(config.token, "sendMessage", {
              chat_id: chatId,
              text: "Sdílené číslo nepatří tvému Telegram účtu. Použij prosím tlačítko „Sdílet moje telefonní číslo“.",
              reply_markup: SHARE_KEYBOARD,
            });
            return Response.json({ ok: true, rejected: "contact_mismatch" });
          }

          const { data: pendingToken } = await admin.rpc("telegram_pending_token", {
            _telegram_chat_id: chatId,
          });
          const token = typeof pendingToken === "string" ? pendingToken : null;
          if (!token) {
            await callTelegram(config.token, "sendMessage", {
              chat_id: chatId,
              text: "Nemám aktivní žádost o propojení. Vrať se do aplikace a klepni na „Ověřit zdarma přes Telegram“.",
            });
            return Response.json({ ok: true, rejected: "no_session" });
          }

          const { data: userId, error } = await admin.rpc("telegram_complete_link", {
            _token: token,
            _telegram_user_id: fromId,
            _telegram_chat_id: chatId,
            _telegram_username: message?.from?.username ?? null,
            _phone_hash: hashPhone(contact.phone_number, config.token),
            _phone_last4: phoneLast4(contact.phone_number),
          });

          if (error || !userId) {
            console.error("[telegram] complete_link failed", error);
            await callTelegram(config.token, "sendMessage", {
              chat_id: chatId,
              text: "Propojení se nepodařilo dokončit. Zkus to prosím znovu z aplikace.",
            });
            return Response.json({ ok: true, rejected: "link_failed" });
          }

          await callTelegram(config.token, "sendMessage", {
            chat_id: chatId,
            text: "✅ Hotovo! Telefon je ověřený přes Telegram a účet je propojený. Sem ti budeme posílat připomínky zápasů.",
            reply_markup: { remove_keyboard: true },
          });
          return Response.json({ ok: true, verified: true });
        }

        return Response.json({ ok: true, ignored: true });
      },
    },
  },
});
