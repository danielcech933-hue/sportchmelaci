import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createSupportCheckout } from "@/utils/payments.functions";

interface Props {
  amountInCents: number;
  userId: string;
  supporterNickname?: string;
  customerEmail?: string;
  returnUrl?: string;
}

export function SupportEmbeddedCheckout({
  amountInCents,
  userId,
  supporterNickname,
  customerEmail,
  returnUrl,
}: Props) {
  const fetchClientSecret = async (): Promise<string> => {
    const result = await createSupportCheckout({
      data: {
        amountInCents,
        userId,
        supporterNickname,
        customerEmail,
        returnUrl: returnUrl || window.location.href,
        environment: getStripeEnvironment(),
      },
    });
    if ("error" in result) throw new Error(result.error);
    if (!result.clientSecret) throw new Error("Stripe nevrátil client secret");
    return result.clientSecret;
  };

  return (
    <div id="checkout" className="rounded-xl border border-primary/25 bg-background/60 p-2">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
