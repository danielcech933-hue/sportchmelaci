import { createHash, timingSafeEqual } from "crypto";

export type TelegramConfig = { token: string; username: string };

/** Returns null when the admin has not configured the bot yet — nothing paid, nothing required at build time. */
export function getTelegramConfig(): TelegramConfig | null {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const username = (process.env["TELEGRAM_BOT_USERNAME"] ?? "").replace(/^@/, "");
  if (!token || !username) return null;
  return { token, username };
}

export function telegramWebhookSecret(token: string): string {
  return createHash("sha256").update(`telegram-webhook:${token}`).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hashPhone(phone: string, token: string): string {
  const normalized = phone.replace(/[^\d+]/g, "").replace(/^00/, "+");
  return createHash("sha256").update(`sportchmelaci:${token}:${normalized}`).digest("hex");
}

export function phoneLast4(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-4);
}

export async function callTelegram(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    console.error(`[telegram] ${method} failed [${response.status}]: ${text}`);
  }
  return { ok: response.ok, status: response.status, body: text };
}
