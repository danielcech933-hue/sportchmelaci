import { createServerFn } from "@tanstack/react-start";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type CreditClaimResult = { balance: number; credited: number } | { error: string };

const validateTopupAmount = (amountInCents: number) => {
  if (!Number.isInteger(amountInCents) || amountInCents < 5000) {
    throw new Error("Minimální dobití je 50 Kč");
  }
  if (amountInCents > 5000000) {
    throw new Error("Maximální dobití je 50 000 Kč");
  }
};

export const createSupportCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: {
    amountInCents: number;
    supporterNickname?: string;
    customerEmail?: string;
    userId: string;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    validateTopupAmount(data.amountInCents);
    if (!data.userId) throw new Error("Přihlas se pro dobití kreditů");
    return data;
  })
  .handler(async ({ data }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const nickname = (data.supporterNickname ?? "").trim().slice(0, 40);
      const amountCzk = Math.round(data.amountInCents / 100);
      const metadata = {
        user_id: data.userId,
        product: "site_credits_topup",
        credits: String(amountCzk),
        ...(nickname ? { supporterNickname: nickname } : {}),
      };

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "czk",
              product_data: { name: `SportChmeláci Kredity · ${amountCzk} kreditů` },
              unit_amount: data.amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        metadata,
        payment_intent_data: {
          description: `SportChmeláci Kredity · ${amountCzk} kreditů`,
          metadata,
        },
        ...(data.customerEmail && { customer_email: data.customerEmail }),
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const claimSiteCreditCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; userId: string; environment: StripeEnv }) => {
    if (!data.sessionId?.trim()) throw new Error("Chybí Stripe session");
    if (!data.userId) throw new Error("Přihlas se pro připsání kreditů");
    return data;
  })
  .handler(async ({ data }): Promise<CreditClaimResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);
      const paid = session.payment_status === "paid";
      const sessionUserId = session.metadata?.user_id;
      const product = session.metadata?.product;
      const credits = Number(session.metadata?.credits ?? 0);
      const amountCzk = Math.round(Number(session.amount_total ?? 0) / 100);

      if (!paid) return { error: "Platba ještě není potvrzená." };
      if (product !== "site_credits_topup") return { error: "Neplatná kreditní transakce." };
      if (sessionUserId !== data.userId) return { error: "Tato platba nepatří tomuto účtu." };
      if (!Number.isInteger(credits) || credits < 50 || credits > 50000) return { error: "Neplatná částka kreditů." };
      if (credits !== amountCzk) return { error: "Částka platby nesouhlasí s kredity." };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: balance, error } = await (supabaseAdmin as any).rpc("site_credit_apply_checkout", {
        _user_id: data.userId,
        _stripe_session_id: data.sessionId,
        _amount_czk: credits,
        _metadata: {
          stripe_payment_status: session.payment_status,
          currency: session.currency,
          payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
        },
      });

      if (error) return { error: error.message };
      return { balance: Number(balance ?? 0), credited: credits };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
