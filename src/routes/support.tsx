import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { SupportEmbeddedCheckout } from "@/components/SupportEmbeddedCheckout";
import { Coins, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Dobít kredity — Chmeloví Sportovci" },
      { name: "description", content: "Dobij si SportChmeláci Kredity a používej je uvnitř aplikace." },
      { property: "og:title", content: "Dobít kredity — Chmeloví Sportovci" },
      { property: "og:description", content: "Bezpečně dobij SportChmeláci Kredity kartou." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportPage,
});

const PRESETS = [100, 250, 500, 1000];

function SupportPage() {
  const { nickname, user, loading } = useAuth();
  const [amount, setAmount] = useState<number>(250);
  const [custom, setCustom] = useState("");
  const [checkout, setCheckout] = useState<number | null>(null);
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    if (!user) return;
    (supabase as any).rpc("site_credit_get_balance").then(({ data }: { data: unknown }) => setCredits(Number(data ?? 0)));
  }, [user]);

  const effective = custom.trim() ? Number(custom) : amount;
  const valid = Number.isFinite(effective) && Number.isInteger(effective) && effective >= 50 && effective <= 50000;

  if (!loading && !user) {
    return (
      <>
        <PaymentTestModeBanner />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-background/50 p-8 text-center backdrop-blur">
            <div className="pointer-events-none absolute inset-0 grid-bg opacity-25" />
            <div className="relative">
              <Coins className="mx-auto h-12 w-12 text-primary" />
              <h1 className="mt-3 font-display text-4xl tracking-widest neon-text">DOBÍJENÍ KREDITŮ</h1>
              <p className="mt-3 text-sm text-muted-foreground">Pro dobití SportChmeláci Kreditů se nejdřív přihlas.</p>
              <a href="/auth" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_22px_-6px_var(--color-primary)]">Přihlásit se →</a>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <PaymentTestModeBanner />
      <main className="mx-auto max-w-3xl px-4 py-6 pb-24">
        <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-background/40 p-6 shadow-[0_28px_80px_-54px_var(--color-primary)] md:p-10">
          <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
          <div className="scanline pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-accent">// SPORTCHMELÁCI WALLET</p>
                <h1 className="mt-2 font-display text-4xl tracking-[0.12em] neon-text md:text-6xl">DOBÍJ KREDITY</h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                  Místo jednorázového příspěvku si dobiješ <span className="text-primary">SportChmeláci Kredity</span>, které zůstávají na tvém účtu a můžeš je využít v aplikaci. <strong>1 Kč = 1 kredit.</strong>
                </p>
              </div>
              <div className="min-w-[170px] rounded-2xl border border-accent/30 bg-accent/5 p-4">
                <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-muted-foreground">Aktuální kredit</p>
                <p className="mt-1 font-display text-3xl text-accent">{credits.toLocaleString("cs-CZ")}</p>
                <p className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">1 kredit = 1 Kč</p>
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-primary/15 bg-background/40 p-3"><ShieldCheck className="h-4 w-4 text-accent" /><p className="mt-2 text-xs font-semibold">Bezpečná platba</p><p className="mt-1 text-[10px] text-muted-foreground">Stripe checkout</p></div>
              <div className="rounded-xl border border-primary/15 bg-background/40 p-3"><Coins className="h-4 w-4 text-primary" /><p className="mt-2 text-xs font-semibold">Připsání po zaplacení</p><p className="mt-1 text-[10px] text-muted-foreground">Pouze potvrzené platby</p></div>
              <div className="rounded-xl border border-primary/15 bg-background/40 p-3"><Sparkles className="h-4 w-4 text-accent" /><p className="mt-2 text-xs font-semibold">Bez výběru hotovosti</p><p className="mt-1 text-[10px] text-muted-foreground">Kredity nejsou bankovní zůstatek</p></div>
            </div>
          </div>
        </section>

        <section className="panel neon-border mt-6 p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl tracking-wider neon-text">Vyber dobití</h2><span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">MIN 50 · MAX 50 000</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESETS.map((p) => (
              <button key={p} type="button" onClick={() => { setAmount(p); setCustom(""); setCheckout(null); }} className={`rounded-xl border px-3 py-2.5 font-mono text-sm transition ${!custom.trim() && amount === p ? "border-primary/70 bg-primary/15 text-primary shadow-[0_0_18px_-12px_var(--color-primary)]" : "border-primary/20 text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>
                {p.toLocaleString("cs-CZ")} Kč
              </button>
            ))}
          </div>

          <label className="mt-4 block text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Vlastní dobití (Kč)
            <input type="number" min={50} max={50000} step={1} value={custom} onChange={(e) => { setCustom(e.target.value); setCheckout(null); }} placeholder="např. 300" className="mt-1 w-full rounded-xl border border-primary/25 bg-background/60 px-3 py-3 font-mono text-sm text-foreground outline-none focus:border-primary/60" />
          </label>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">Za zaplacených {valid ? effective.toLocaleString("cs-CZ") : "—"} Kč dostaneš {valid ? effective.toLocaleString("cs-CZ") : "—"} kreditů.</p>

          {checkout === null ? (
            <button type="button" disabled={!valid} onClick={() => setCheckout(Math.round(effective * 100))} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-7px_var(--color-primary)] disabled:opacity-40">
              Dobít {valid ? `${effective.toLocaleString("cs-CZ")} Kč` : "kredity"} →
            </button>
          ) : (
            <div className="mt-4">
              <SupportEmbeddedCheckout amountInCents={checkout} userId={user!.id} supporterNickname={nickname ?? undefined} customerEmail={user!.email ?? undefined} returnUrl={`${window.location.origin}/support/return?session_id={CHECKOUT_SESSION_ID}`} />
              <button type="button" onClick={() => setCheckout(null)} className="mt-3 w-full rounded-xl border border-primary/25 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground">Zpět na výběr</button>
            </div>
          )}
        </section>

        <p className="mt-4 text-center text-[10px] leading-5 text-muted-foreground">
          SportChmeláci Kredity jsou interní nepeněžní kredity pro používání funkcí aplikace. Nejsou směnitelné zpět za hotovost.
        </p>
      </main>
    </>
  );
}
