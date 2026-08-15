import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});

function normalizePhone(value: string) {
  const trimmed = value.trim().replace(/[\s()-]/g, "");
  return trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed;
}

async function hashText(value: string) {
  const data = new TextEncoder().encode(`${token}:${value}`);
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
  if (!supabaseUrl || !serviceRoleKey || !token) return json({ error: "telegram_not_configured" }, 500);

  const update = await req.json();
  const message = update?.message;
  const from = message?.from;
  const chatId = message?.chat?.id;
  if (!from?.id || chatId === undefined) return json({ ok: true });

  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const text = typeof message?.text === "string" ? message.text : undefined;
  const startToken = parseStart(text);

  if (startToken) {
    const tokenHash = await hashText(startToken);
    const { data: session, error } = await db
      .from("telegram_phone_verification_sessions")
      .select("id,expires_at,verified_at")
      .eq("token_hash", tokenHash)
      .gt("expires_at", new Date().toISOString())
      .is("verified_at", null)
      .maybeSingle();

    if (error || !session) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: "Tento ověřovací odkaz je neplatný nebo expiroval. Vrať se do SportChmeláci a spusť ověření znovu.",
      });
      return json({ ok: true });
    }

    // Bind the pending session to the Telegram account that opened the deep link.
    await db
      .from("telegram_phone_verification_sessions")
      .update({ telegram_user_id: Number(from.id) })
      .eq("id", session.id);

    await telegram("sendMessage", {
      chat_id: chatId,
      text: "SportChmeláci – ověření telefonu zdarma. Stiskni tlačítko níže a sdílej svoje vlastní číslo. Číslo použijeme jen pro ověření účtu a nebudeme ho zobrazovat ostatním hráčům.",
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

  // Telegram only sends request_contact in private chats; require the shared contact
  // to belong to the same Telegram user who pressed the button.
  if (Number(contact.user_id) !== Number(from.id)) {
    await telegram("sendMessage", { chat_id: chatId, text: "Prosím sdílej svoje vlastní číslo, ne kontakt jiné osoby." });
    return json({ ok: true });
  }

  const phone = normalizePhone(String(contact.phone_number));
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    await telegram("sendMessage", { chat_id: chatId, text: "Telefonní číslo nemá platný mezinárodní formát." });
    return json({ ok: true });
  }

  const { data: session, error: sessionError } = await db
    .from("telegram_phone_verification_sessions")
    .select("id,expires_at")
    .eq("telegram_user_id", Number(from.id))
    .is("verified_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError || !session) {
    await telegram("sendMessage", { chat_id: chatId, text: "Ověřovací relace není aktivní. Spusť propojení znovu ze SportChmeláci." });
    return json({ ok: true });
  }

  const phoneHash = await hashText(`phone:${phone}`);
  const phoneLast4 = phone.replace(/\D/g, "").slice(-4);

  const { error: updateError } = await db
    .from("telegram_phone_verification_sessions")
    .update({
      verified_at: new Date().toISOString(),
      phone_hash: phoneHash,
      phone_last4: phoneLast4,
    })
    .eq("id", session.id);

  if (updateError) {
    await telegram("sendMessage", { chat_id: chatId, text: "Ověření se nepodařilo dokončit. Zkus to prosím znovu." });
    return json({ error: "verification_failed" }, 500);
  }

  await telegram("sendMessage", {
    chat_id: chatId,
    text: `✅ Telefon ověřen. Číslo končí na ${phoneLast4}. Můžeš se vrátit do SportChmeláci.`,
    reply_markup: { remove_keyboard: true },
  });

  return json({ ok: true });
});
