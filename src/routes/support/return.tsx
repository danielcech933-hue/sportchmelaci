import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coins, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { verifySiteCreditCheckout } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/support/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Podpora potvrzena — Chmeloví Sportovci" },
      { name: "description", content: "Potvrzení přijaté podpory pro Chmelové Sportovce." },
      { property: "og:title", content: "Podpora potvrzena — Chmeloví Sportovci" },
      { property: "og:description", content: "Potvrzení přijaté podpory pro Chmelové Sportovce." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SupportReturn,
});

function SupportReturn() {
  const { session_id: sessionId } = Route.useSearch();
  const { user } = useAuth();
  const [state, setState] = useState<"loading" | "success" | "error" | "missing">(sessionId ? "loading" : "missing");
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!sessionId || !user) return;
    let active = true;
    void (async () => {
      try {
        const result = await verifySiteCreditCheckout({
          data: { sessionId, environment: getStripeEnvironment() },
        });
        if (!active) return;
        if ("error" in result) {
          setState("error");
          setMessage(result.error);
          return;
        }
        setPaidAmount(result.paidAmountInCents / 100);
        setState("success");
      } catch (error) {
        if (!active) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Platbu se nepodařilo ověřit.");
      }
    })();
    return () => { active = false; };
  }, [sessionId, user]);

  if (!user && sessionId) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-center"><h1 className="font-display text-4xl tracking-widest neon-text">PŘIHLAŠ SE</h1><p className="mt-3 text-sm text-muted-foreground">Pro ověření podpory se musíš přihlásit do svého účtu.</p><Link to="/auth" className="mt-6 inline-block rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Přihlásit se</Link></main>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-background/50 p-8 backdrop-blur">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
        <div className="relative">
          {state === "loading" && <><Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" /><h1 className="mt-4 font-display text-4xl tracking-widest neon-text">OVĚŘUJI PLATBU</h1><p className="mt-3 text-sm text-muted-foreground">Kontroluji potvrzení platby v platebním systému.</p></>}
          {state === "success" && <><Coins className="mx-auto h-12 w-12 text-accent" /><h1 className="mt-4 font-display text-4xl tracking-widest neon-text">PODPORA PŘIJATA</h1><p className="mt-3 text-sm text-muted-foreground">Děkujeme za podporu projektu ve výši <strong className="text-accent">{paidAmount?.toLocaleString("cs-CZ")} Kč</strong>.</p><div className="mx-auto mt-5 max-w-md rounded-2xl border border-accent/30 bg-accent/5 p-4"><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Co se stane s příspěvkem</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Příspěvek jde na provoz a další vývoj aplikace, včetně nákupu Lovable kreditů. Nezvyšuje herní zůstatek ani jiné uživatelské kredity v aplikaci.</p></div><div className="mt-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-accent" /> platba potvrzena přes Stripe</div></>}
          {state === "error" && <><h1 className="font-display text-4xl tracking-widest neon-text">PLATBU NELZE OVĚŘIT</h1><p className="mt-3 text-sm text-muted-foreground">{message}</p><p className="mt-2 text-xs text-muted-foreground">Platbu prosím neopakuj. Pokud byla částka skutečně stržena, ověřením se můžeš vrátit později.</p></>}
          {state === "missing" && <><h1 className="font-display text-4xl tracking-widest neon-text">NIC K ZOBRAZENÍ</h1><p className="mt-3 text-sm text-muted-foreground">Chybí informace o platební relaci.</p></>}
          <Link to="/" className="mt-7 inline-block rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Zpět do lobby</Link>
        </div>
      </div>
    </main>
  );
}
