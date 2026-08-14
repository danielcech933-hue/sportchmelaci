import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coins, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { claimSiteCreditCheckout } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

export const Route = createFileRoute("/support/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Kredity připsány — Chmeloví Sportovci" },
      { name: "description", content: "Potvrzení dobití SportChmeláci Kreditů." },
      { property: "og:title", content: "Kredity připsány — Chmeloví Sportovci" },
      { property: "og:description", content: "Potvrzení dobití SportChmeláci Kreditů." },
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
  const [balance, setBalance] = useState<number | null>(null);
  const [credited, setCredited] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!sessionId || !user) return;
    let active = true;
    void (async () => {
      try {
        const result = await claimSiteCreditCheckout({
          data: { sessionId, userId: user.id, environment: getStripeEnvironment() },
        });
        if (!active) return;
        if ("error" in result) {
          setState("error");
          setMessage(result.error);
          return;
        }
        setCredited(result.credited);
        setBalance(result.balance);
        setState("success");
      } catch (error) {
        if (!active) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "Platbu se nepodařilo zpracovat.");
      }
    })();
    return () => { active = false; };
  }, [sessionId, user]);

  if (!user && sessionId) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-center"><h1 className="font-display text-4xl tracking-widest neon-text">PŘIHLAŠ SE</h1><p className="mt-3 text-sm text-muted-foreground">Pro připsání kreditů musíš být přihlášený do stejného účtu.</p><Link to="/auth" className="mt-6 inline-block rounded-xl bg-primary px-4 py-2 font-semibold text-primary-foreground">Přihlásit se</Link></main>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-background/50 p-8 backdrop-blur">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
        <div className="relative">
          {state === "loading" && <><Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" /><h1 className="mt-4 font-display text-4xl tracking-widest neon-text">OVĚŘUJI PLATBU</h1><p className="mt-3 text-sm text-muted-foreground">Kontroluji potvrzení a připisuji kredity na účet.</p></>}
          {state === "success" && <><Coins className="mx-auto h-12 w-12 text-accent" /><h1 className="mt-4 font-display text-4xl tracking-widest neon-text">KREDITY PŘIPSÁNY</h1><p className="mt-3 text-sm text-muted-foreground">Na účet bylo připsáno <strong className="text-accent">{credited?.toLocaleString("cs-CZ")} kreditů</strong>.</p><div className="mx-auto mt-5 max-w-xs rounded-2xl border border-accent/30 bg-accent/5 p-4"><p className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Nový zůstatek</p><p className="mt-1 font-display text-3xl text-accent">{balance?.toLocaleString("cs-CZ")}</p></div><div className="mt-4 inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5 text-accent" /> potvrzeno platebním systémem</div></>}
          {state === "error" && <><h1 className="font-display text-4xl tracking-widest neon-text">PLATBU NELZE PŘIPSAT</h1><p className="mt-3 text-sm text-muted-foreground">{message}</p><p className="mt-2 text-xs text-muted-foreground">Platbu prosím neopakuj. Pokud byla skutečně stržena, můžeš se vrátit později na tuto stránku a ověření zopakovat.</p></>}
          {state === "missing" && <><h1 className="font-display text-4xl tracking-widest neon-text">NIC K ZOBRAZENÍ</h1><p className="mt-3 text-sm text-muted-foreground">Chybí informace o platbě.</p></>}
          <Link to="/" className="mt-7 inline-block rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Zpět do lobby</Link>
        </div>
      </div>
    </main>
  );
}
