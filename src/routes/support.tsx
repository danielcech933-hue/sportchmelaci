import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { SupportEmbeddedCheckout } from "@/components/SupportEmbeddedCheckout";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Podpoř ligu — Chmeloví Sportovci" },
      { name: "description", content: "Dobrovolný příspěvek na provoz ligy Chmeloví Sportovci — vyber částku a zaplať kartou." },
      { property: "og:title", content: "Podpoř ligu — Chmeloví Sportovci" },
      { property: "og:description", content: "Dobrovolný příspěvek na provoz ligy — rychle a bezpečně kartou." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SupportPage,
});

const PRESETS = [100, 250, 500, 1000];

function SupportPage() {
  const { nickname, user } = useAuth();
  const [amount, setAmount] = useState<number>(250);
  const [custom, setCustom] = useState("");
  const [checkout, setChecko] = useState<number | null>(null);

  const effective = custom.trim() ? Number(custom) : amount;
  const valid = Number.isFinite(effective) && effective >= 50 && effective <= 50000;

  return (
    <>
      <PaymentTestModeBanner />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-background/40 p-6 md:p-10">
          <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
          <div className="scanline pointer-events-none absolute inset-0" />
          <div className="relative">
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-accent">// SUPPORT THE LEAGUE</p>
            <h1 className="mt-2 font-display text-4xl tracking-widest neon-text md:text-6xl">🍺 PODPOŘ NÁS</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Dobrovolný příspěvek na provoz ligy. Nejde o sázku — herní dolary v aplikaci se tím nemění.
            </p>
          </div>
        </div>

        <section className="panel neon-border mt-6 p-5">
          <h2 className="font-display text-xl tracking-wider neon-text">Vyber částku</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => { setAmount(p); setCustom(""); setChecko(null); }}
                className={`rounded-md border px-3 py-2 font-mono text-sm transition ${
                  !custom.trim() && amount === p
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-primary/20 text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {p} Kč
              </button>
            ))}
          </div>

          <label className="mt-4 block text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Vlastní částka (Kč)
            <input
              type="number"
              min={50}
              max={50000}
              value={custom}
              onChange={(e) => { setCustom(e.target.value); setChecko(null); }}
              placeholder="např. 300"
              className="mt-1 w-full rounded-md border border-primary/25 bg-background/60 px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary/60"
            />
          </label>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">Min. 50 Kč · max. 50 000 Kč</p>

          {checkout === null ? (
            <button
              disabled={!valid}
              onClick={() => setChecko(Math.round(effective * 100))}
              className="mt-4 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Přispět {valid ? `${effective} Kč` : ""}
            </button>
          ) : (
            <div className="mt-4">
              <SupportEmbeddedCheckout
                amountInCents={checkout}
                supporterNickname={nickname ?? undefined}
                customerEmail={user?.email ?? undefined}
                returnUrl={`${window.location.origin}/support/return?session_id={CHECKOUT_SESSION_ID}`}
              />
              <button
                onClick={() => setChecko(null)}
                className="mt-3 w-full rounded-md border border-primary/25 px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Zpět na výběr částky
              </button>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
