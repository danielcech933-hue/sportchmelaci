import { createServerFn } from "@tanstack/react-start";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };
type SupportVerificationResult = { paidAmountInCents: number; currency: string } | { error: string };

export const createSupportCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: {
    amountInCents: number;
    supporterNickname?: string;
    customerEmail?: string;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!Number.isInteger(data.amountInCents) || data.amountInCents < 5000) {
      throw new Error("Minimální podpora je 50 Kč");
    }
    if (data.amountInCents > 5000000) {
      throw new Error("Maximální podpora je 50 000 Kč");
    }
    return data;
  })
  .handler(async ({ data }): Promise<CheckoutSessionResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const nickname = (data.supporterNickname ?? "").trim().slice(0, 40);

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "czk",
              product_data: { name: "Podpora Chmeloví Sportovci" },
              unit_amount: data.amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        payment_intent_data: { description: "Podpora Chmeloví Sportovci — prostředky na provoz a Lovable credits" },
        ...(data.customerEmail && { customer_email: data.customerEmail }),
        ...(nickname && { metadata: { supporterNickname: nickname, purpose: "lovable_credits_and_project_support" } }),
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

/**
 * Verifies a completed support payment on the server.
 * This does not alter the user's wallet or game balances; the support page
 * only confirms the Stripe payment and the paid amount.
 */
export const verifySiteCreditCheckout = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    const sessionId = data.sessionId.trim();
    if (!sessionId || sessionId.length > 255) {
      throw new Error("Neplatné ID platební relace.");
    }
    return { ...data, sessionId };
  })
  .handler(async ({ data }): Promise<SupportVerificationResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);

      if (session.mode !== "payment" || session.status !== "complete" || session.payment_status !== "paid") {
        return { error: "Platba zatím není potvrzena jako uhrazená." };
      }

      const amount = Number(session.amount_total ?? 0);
      const currency = String(session.currency ?? "").toLowerCase();
      if (!Number.isInteger(amount) || amount <= 0 || currency !== "czk") {
        return { error: "Platební relace nemá očekávané údaje podpory." };
      }

      return { paidAmountInCents: amount, currency };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
