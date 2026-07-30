const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full border-b border-destructive/40 bg-destructive/15 px-4 py-2 text-center text-xs text-destructive-foreground">
        Ostré platby zatím nejsou nastavené. Dokonči go-live v sekci Payments.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-accent/40 bg-accent/10 px-4 py-2 text-center text-xs text-accent">
        Testovací režim — žádné skutečné peníze se nestrhnou. Testovací karta 4242 4242 4242 4242.
      </div>
    );
  }
  return null;
}
