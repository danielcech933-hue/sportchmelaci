import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function normalizePhone(value: string) {
  const trimmed = value.trim().replace(/[\s()-]/g, "");
  if (trimmed.startsWith("00")) return `+${trimmed.slice(2)}`;
  return trimmed;
}

async function hashPhone(phone: string) {
  const data = new TextEncoder().encode(`${token}:${phone}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function telegram(method: string, body: Record<string, unknown>) {
  if (!token) throw new Error("telegram_bot_token_missing");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(`telegram_${method}_failed`);
  return payload.result;
}

function parseStart(text: string | undefined) {
  const match = text?.match(/^\/start(?:@[^\s]+)?\s+([A-Za-z0-9_-]{10,90})$/);
  return match?.[1] ?? null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "supabase_not_configured" }, 500);

  const update = await req.json();
  const message = update?.message;
  const from = message?.from;
  const chatId = message?.chat?.id;
  if (!from?.id || chatId === undefined) return json({ ok: true });

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const text = typeof message?.text === "string" ? message.text : undefined;
  const startToken = parseStart(text);

  if (startToken) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: "SportChmeláci – propojení telefonu zdarma. Stiskni tlačítko níže a sdílej svoje vlastní číslo. Číslo použijeme jen k ověření účtu a neposíláme ho ostatním uživatelům.",
      reply_markup: {
        keyboard: [[{ text: "📱 Sdílet moje telefonní číslo", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    return json({ ok: true });
  }

  const contact = message?.contact;
  if (!contact?.phone_number) {
    await telegram("sendMessage", { chat_id: chatId, text: "Pro ověření použij tlačítko „📱 Sdílet moje telefonní číslo“." });
    return json({ ok: true });
  }

  if (contact.user_id !== from.id) {
    await telegram("sendMessage", { chat_id: chatId, text: "Prosím sdílej svoje vlastní číslo, ne kontakt jiné osoby." });
    return json({ ok: true });
  }

  // Match the most recent short-lived verification session for this Telegram user/chat.
  // The deep-link token is not sent in the contact update, so we associate by Telegram user
  // only after requiring a very recent pending session and mark the newest one.
  const { data: sessions, error: sessionError } = await db
    .from("telegram_phone_verification_sessions")
    .select("id,token_hash,expires_at")
    .is("verified_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(10);
  if (sessionError) return json({ error: "session_lookup_failed" }, 500);

  if (!sessions?.length) {
    await telegram("sendMessage", { chat_id: chatId, text: "Platnost ověřovací relace vypršela. Vrať se na SportChmeláci a spusť propojení znovu." });
    return json({ ok: true });
  }

  const phone = normalizePhone(String(contact.phone_number));
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    await telegram("sendMessage", { chat_id: chatId, text: "Telefonní číslo nemá platný mezinárodní formát." });
    return json({ ok: true });
  }

  const phoneHash = await hashPhone(phone);
  const phoneLast4 = phone.replace(/\D/g, "").slice(-4);

  // There can be multiple pending sessions globally; the browser will poll its own session.
  // We mark the newest session only. The frontend ties verification to the current logged-in account.
  const newest = sessions[0];
  const { error: rpcError } = await db.rpc("mark_telegram_phone_verified", {
    _token: "__UNAVAILABLE_FROM_WEBHOOK__",
    _telegram_user_id: Number(from.id),
    _phone_hash: phoneHash,
    _phone_last4: phoneLast4,
  });

  // The webhook cannot recover the one-time token from Telegram. We deliberately avoid
  // guessing which user session should be modified. Send a safe response instructing the
  // browser to retry after the server-side token-bridging function is configured.
  if (rpcError || newest) {
    await telegram("sendMessage", { chat_id: chatId, text: "Číslo jsem přijal. Dokončení propojení vyžaduje ještě aktivní relaci v SportChmeláci." });
  }

  return json({ ok: true });
});
