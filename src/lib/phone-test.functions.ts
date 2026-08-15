import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  deriveTestOtp,
  getPendingAdminChallenges,
  getServerUser,
  isServerAdmin,
  normalizeTestPhone,
  readPending,
  readVerified,
  safeOtpEqual,
  updateMetadata,
} from "./phone-test.server";

const OTP_TTL_MS = 10 * 60_000;
const START_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;

export const getPhoneVerificationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const user = await getServerUser(context.userId);
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const verified = readVerified(metadata);
    const pending = readPending(metadata);
    return {
      verified: Boolean(verified),
      phone: verified?.phone ?? null,
      verifiedAt: verified?.verifiedAt ?? null,
      source: verified?.source ?? null,
      pending: pending && pending.expiresAt > Date.now()
        ? { phone: pending.phone, expiresAt: pending.expiresAt, attempts: pending.attempts }
        : null,
    };
  });

export const startTestPhoneVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string }) => ({ phone: String(input.phone).slice(0, 32) }))
  .handler(async ({ data, context }) => {
    const phone = normalizeTestPhone(data.phone);
    if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("invalid_phone");

    const user = await getServerUser(context.userId);
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const existing = readPending(metadata);
    if (existing && existing.expiresAt > Date.now() && Date.now() - existing.issuedAt < START_COOLDOWN_MS) {
      return { ok: true, reused: true, expiresAt: existing.expiresAt };
    }

    const issuedAt = Date.now();
    const challenge = {
      phone,
      issuedAt,
      expiresAt: issuedAt + OTP_TTL_MS,
      attempts: 0,
    };
    await updateMetadata(context.userId, {
      ...metadata,
      sportchmelaci_phone_challenge: challenge,
    });

    return { ok: true, reused: false, expiresAt: challenge.expiresAt };
  });

export const verifyTestPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phone: string; otp: string }) => ({
    phone: String(input.phone).slice(0, 32),
    otp: String(input.otp).replace(/\D/g, "").slice(0, 6),
  }))
  .handler(async ({ data, context }) => {
    if (!/^\d{6}$/.test(data.otp)) return { ok: false, reason: "invalid_code" as const };

    const user = await getServerUser(context.userId);
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const pending = readPending(metadata);
    if (!pending) return { ok: false, reason: "no_challenge" as const };
    if (pending.expiresAt <= Date.now()) return { ok: false, reason: "expired" as const };
    if (pending.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" as const };

    const phone = normalizeTestPhone(data.phone);
    if (phone !== pending.phone) return { ok: false, reason: "phone_mismatch" as const };

    const expected = deriveTestOtp(context.userId, pending.phone, pending.issuedAt);
    if (!safeOtpEqual(expected, data.otp)) {
      await updateMetadata(context.userId, {
        ...metadata,
        sportchmelaci_phone_challenge: { ...pending, attempts: pending.attempts + 1 },
      });
      return { ok: false, reason: pending.attempts + 1 >= MAX_ATTEMPTS ? "locked" as const : "invalid_code" as const };
    }

    const verifiedAt = new Date().toISOString();
    await updateMetadata(context.userId, {
      ...metadata,
      sportchmelaci_verified_phone: {
        phone: pending.phone,
        verifiedAt,
        source: "test_admin",
      },
      sportchmelaci_phone_challenge: null,
    });

    await supabaseAdmin.from("phone_verifications").upsert({
      user_id: context.userId,
      phone_public: false,
      updated_at: verifiedAt,
    });

    return { ok: true, phone: pending.phone, verifiedAt };
  });

export const getAdminTestPhoneChallenges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!(await isServerAdmin(context.userId))) throw new Error("forbidden");
    return getPendingAdminChallenges();
  });

export const getPublicVerifiedPhone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => ({ userId: String(input.userId) }))
  .handler(async ({ data }) => {
    const user = await getServerUser(data.userId);
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const verified = readVerified(metadata);
    if (!verified) return null;

    const { data: pref } = await supabaseAdmin
      .from("phone_verifications")
      .select("phone_public")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (!pref?.phone_public) return null;
    return { phone: verified.phone, verifiedAt: verified.verifiedAt };
  });

export const setPublicPhoneForSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { enabled: boolean }) => ({ enabled: Boolean(input.enabled) }))
  .handler(async ({ data, context }) => {
    const user = await getServerUser(context.userId);
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
    const verified = readVerified(metadata);
    if (!verified) throw new Error("phone_not_verified");
    const { error } = await supabaseAdmin.from("phone_verifications").upsert({
      user_id: context.userId,
      phone_public: data.enabled,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return data.enabled;
  });
