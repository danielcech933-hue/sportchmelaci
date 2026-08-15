import { createHmac } from "node:crypto";

const DEFAULT_FROM = "SportChmeláci <noreply@sportchmelovci.chmelovci.com>";

function config() {
  const apiKey = process.env.RESEND_API_KEY;
  // Lovable secret setup may provide only the API key while the verified
  // SportChmeláci domain is already configured in Resend. Keep the sender
  // server-side and use the verified domain as the safe fallback.
  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  if (!apiKey) return null;
  return { apiKey, from };
}

export async function sendVerificationCodeEmail(to: string, otp: string) {
  const cfg = config();
  if (!cfg) throw new Error("email_provider_not_configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: cfg.from,
      to: [to],
      subject: "SportChmeláci · ověřovací kód",
      text: [
        "SportChmeláci",
        "",
        `Tvůj ověřovací kód je: ${otp}`,
        "",
        "Kód platí 10 minut. Pokud jsi o ověření nežádal(a), tento e-mail ignoruj.",
      ].join("\n"),
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>SportChmeláci</h2><p>Tvůj ověřovací kód:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 20px;background:#111;color:#fff;border-radius:12px;text-align:center">${otp}</div><p style="color:#666">Kód platí 10 minut. Pokud jsi o ověření nežádal(a), tento e-mail ignoruj.</p></div>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[email-otp] send failed", response.status, body);
    throw new Error("email_send_failed");
  }
}

export function randomOtp() {
  const bytes = new Uint32Array(1);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
    return String(bytes[0] % 1_000_000).padStart(6, "0");
  }
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

export function hashOtp(userId: string, phone: string, issuedAt: number, otp: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createHmac("sha256", secret).update(`${userId}|${phone}|${issuedAt}|${otp}`).digest("hex");
}
