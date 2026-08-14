import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { SupportEmbeddedCheckout } from "@/components/SupportEmbeddedCheckout";
import { ExternalLink, HeartHandshake, Sparkles, Zap } from "lucide-react";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Podpoř vývoj — Chmeloví Sportovci" },
      { name: "description", content: "Podpoř vývoj Chmelových Sportovců. Prostředky používáme mimo jiné na Lovable kredity pro další aktualizace aplikace." },
      { property: "og:title", content: "Podpoř vývoj — Chmeloví Sportovci" },
      { property: "og:description", content: "Pomoz nám financovat další aktualizace a vývoj aplikace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportPage,
});

const PRESETS = [100, 250, 500, 1000];

function SupportPage() {
  const { nickname, user } = useAuth();
  const [amount, setAmount] = useState(250);
  const [custom, setCustom] = useState("");
  const [checkout, setCheckout] = useState<number | null>(null);
  const effective = custom.trim() ? Number(custom) : amount;
  const valid = Number.isFinite(effective) && Number.isInteger(effective) && effective >= 50 && effective <= 50000;

  if (!user) {
    return <><PaymentTestModeBanner /><main className="mx-auto max-w-3xl px-4 py-12"><section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-background/50 p-8 text-center backdrop-blur"><div className="pointer-events-none absolute inset-0 grid-bg opacity-25" /><div className="relative"><HeartHandshake className="mx-auto h-12 w-12 text-primary" /><h1 className="mt-3 font-display text-4xl tracking-widest neon-text">PODPOŘ VÝVOJ</h1><p className="mt-3 text-sm text-muted-foreground">Pro podporu projektu se nejdřív přihlas.</p><a href="/auth" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">Přihlásit se →</a></div></section></main></>;
  }

  return <>
    <PaymentTestModeBanner />
    <main className="mx-auto max-w-3xl px-4 py-6 pb-24">
      <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-background/40 p-6 shadow-[0_28px_80px_-54px_var(--color-primary)] md:p-10">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <div className="scanline pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-accent">// FUND THE NEXT UPDATE</p>
          <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="font-display text-4xl tracking-[0.12em] neon-text md:text-6xl">PODPOŘ VÝVOJ</h1><span className="rounded-full border border-accent/30 bg-accent/5 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-accent">LOVABLE CREDITS</span></div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Každý příspěvek pomáhá financovat další vývoj Chmelových Sportovců. Prostředky z této stránky používáme mimo jiné na <span className="text-primary">Lovable kredity</span>, díky kterým můžeme aplikaci dál aktualizovat a opravovat.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-primary/15 bg-background/40 p-3"><Zap className="h-4 w-4 text-primary" /><p className="mt-2 text-xs font-semibold">Další aktualizace</p><p className="mt-1 text-[10px] text-muted-foreground">Nové funkce a opravy</p></div><div className="rounded-xl border border-primary/15 bg-background/40 p-3"><Sparkles className="h-4 w-4 text-accent" /><p className="mt-2 text-xs font-semibold">Lovable AI</p><p className="mt-1 text-[10px] text-muted-foreground">Kredity pro další vývoj</p></div><div className="rounded-xl border border-primary/15 bg-background/40 p-3"><HeartHandshake className="h-4 w-4 text-primary" /><p className="mt-2 text-xs font-semibold">Komunita</p><p className="mt-1 text-[10px] text-muted-foreground">Bez herního zůstatku</p></div></div>
        </div>
      </section>

      <section className="panel neon-border mt-6 p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl tracking-wider neon-text">Vyber podporu</h2><span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">50–50 000 Kč</span></div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{PRESETS.map((p) => <button key={p} type="button" onClick={() => { setAmount(p); setCustom(""); setCheckout(null); }} className={`rounded-xl border px-3 py-2.5 font-mono text-sm transition ${!custom.trim() && amount === p ? "border-primary/70 bg-primary/15 text-primary" : "border-primary/20 text-muted-foreground hover:border-primary/50 hover:text-foreground"}`}>{p.toLocaleString("cs-CZ")} Kč</button>)}</div>
        <label className="mt-4 block text-xs uppercase tracking-[0.2em] text-muted-foreground">Vlastní částka (Kč)<input type="number" min={50} max={50000} step={1} value={custom} onChange={(e) => { setCustom(e.target.value); setCheckout(null); }} placeholder="např. 300" className="mt-1 w-full rounded-xl border border-primary/25 bg-background/60 px-3 py-3 font-mono text-sm text-foreground outline-none focus:border-primary/60" /></label>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">Příspěvek je určen na provoz a vývoj projektu, včetně nákupu Lovable kreditů. Nezvyšuje žádný herní zůstatek.</p>
        {checkout === null ? <button type="button" disabled={!valid} onClick={() => setCheckout(Math.round(effective * 100))} className="mt-4 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_0_24px_-7px_var(--color-primary)] disabled:opacity-40">Podpořit vývoj {valid ? `${effective.toLocaleString("cs-CZ")} Kč` : ""} →</button> : <div className="mt-4"><SupportEmbeddedCheckout amountInCents={checkout} supporterNickname={nickname ?? undefined} customerEmail={user.email ?? undefined} returnUrl={`${window.location.origin}/support/return?session_id={CHECKOUT_SESSION_ID}`} /><button type="button" onClick={() => setCheckout(null)} className="mt-3 w-full rounded-xl border border-primary/25 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground">Zpět na výběr</button></div>}
      </section>

      <section className="mt-5 rounded-2xl border border-accent/20 bg-accent/5 p-4 text-xs leading-5 text-muted-foreground"><p><span className="font-semibold text-foreground">Důležité:</span> Lovable kredity jsou vázané na Lovable workspace a jejich nákup spravuje vlastník/admin workspace. Tato stránka nemůže platbu automaticky připsat přímo do Lovable účtu; příspěvek jde projektu a následně ho používáme na nákup Lovable kreditů.</p><a href="https://lovable.dev/settings" target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 font-semibold text-primary hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Otevřít Lovable Settings</a></section>
    </main>
  </>;
}
