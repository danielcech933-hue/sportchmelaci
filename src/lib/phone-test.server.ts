import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export function normalizeTestPhone(value: string) {
  const raw = value.trim().replace(/[\s().-]/g, "");
  return raw.startsWith("00") ? `+${raw.slice(2)}` : raw;
}

function secret() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return value;
}

export function deriveTestOtp(userId: string, phone: string, issuedAt: number) {
  const normalized = normalizeTestPhone(phone);
  const digest = createHmac("sha256", secret())
    .update(`${userId}|${normalized}|${issuedAt}`)
    .digest("hex");
  return String(parseInt(digest.slice(0, 12), 16) % 1_000_000).padStart(6, "0");
}

export function safeOtpEqual(a: string, b: string) {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

type Pending = {
  phone: string;
  issuedAt: number;
  expiresAt: number;
  attempts: number;
  otpHash?: string;
};

type Verified = {
  phone: string;
  verifiedAt: string;
  source: "test_admin" | "sms" | "test_email";
};

export function readPending(metadata: Record<string, unknown>): Pending | null {
  const p = metadata["sportchmelaci_phone_challenge"];
  if (!p || typeof p !== "object") return null;
  const x = p as Record<string, unknown>;
  if (typeof x.phone !== "string" || typeof x.issuedAt !== "number" || typeof x.expiresAt !== "number" || typeof x.attempts !== "number") return null;
  return { phone: x.phone, issuedAt: x.issuedAt, expiresAt: x.expiresAt, attempts: x.attempts, otpHash: typeof x.otpHash === "string" ? x.otpHash : undefined };
}

export function readVerified(metadata: Record<string, unknown>): Verified | null {
  const v = metadata["sportchmelaci_verified_phone"];
  if (!v || typeof v !== "object") return null;
  const x = v as Record<string, unknown>;
  if (typeof x.phone !== "string" || typeof x.verifiedAt !== "string") return null;
  const source = x.source === "sms" ? "sms" : x.source === "test_email" ? "test_email" : "test_admin";
  return { phone: x.phone, verifiedAt: x.verifiedAt, source };
}

export async function getServerUser(userId: string) {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data.user) throw new Error("user_not_found");
  return data.user;
}

export async function isServerAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  return Boolean(data);
}

export async function updateMetadata(userId: string, metadata: Record<string, unknown>) {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: metadata });
  if (error) throw error;
}

export async function getPendingAdminChallenges() {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const pending = data.users.flatMap((u) => {
    const p = readPending((u.user_metadata ?? {}) as Record<string, unknown>);
    if (!p) return [];
    if (p.expiresAt <= Date.now()) return [];
    return [{
      userId: u.id,
      email: u.email ?? null,
      phone: p.phone,
      issuedAt: p.issuedAt,
      expiresAt: p.expiresAt,
      attempts: p.attempts,
      code: deriveTestOtp(u.id, p.phone, p.issuedAt),
    }];
  });
  return pending;
}
