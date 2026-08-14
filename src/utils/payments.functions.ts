import { createServerFn } from "@tanstack/react-start";
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

type CheckoutSessionResult = { clientSecret: string } | { error: string };

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
