import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRightLeft, Beer } from "lucide-react";
import { SlotMachine } from "@/components/slots/SlotMachine";
import { CurrencyExchangeModal } from "@/components/CurrencyExchangeModal";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";

export const Route = createFileRoute("/slots/chmelovci-cup")({
  head: () => ({
    meta: [
      { title: "Chmelovci Cup — sportovní výherní automat" },
      {
        name: "description",
        content:
          "Chmelovci Cup: prémiový sportovní slot 5×3 s free spiny, zlatými WILD míči, scatter půllitry a žebříčkem nejvyšších násobitelů.",
      },
      { property: "og:title", content: "Chmelovci Cup — sportovní výherní automat" },
      {
        property: "og:description",
        content: "Roztoč 5 válců na nočním stadionu obrostlém chmelem. Free spiny až 50× a násobitel až 8×.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SlotsGamePage,
});

function SlotsGamePage() {
  const { nickname } = useAuth();
  const { userDollars } = useWallet();
  const [exchange, setExchange] = useState(false);

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 pb-32 sm:px-4 sm:py-10">
      <header className="relative overflow-hidden rounded-2xl border border-hop-gold/35 bg-black/50 p-5 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(255,204,68,0.25),transparent_60%)]" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-hop-neon/80">
              <Beer className="h-4 w-4" /> Chmelovci Cup Slot
            </p>
            <h1 className="mt-1 font-display text-3xl tracking-[0.12em] slot-gold-text sm:text-5xl">CHMELOVCI CUP</h1>
            <p className="mt-2 max-w-2xl text-sm text-foreground/75">
              5 válců, 3 řady, 5 výherních linií, zlaté WILD míče, scatter půllitry a bonusová hra „Chmelové
              šílenství". Hraje se pouze o zábavní kredity — bez reálných peněz.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Link
              to="/slots"
              className="inline-flex items-center gap-1.5 rounded-xl border border-hop-gold/40 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-hop-gold"
            >
              <ArrowLeft className="h-4 w-4" /> Lobby
            </Link>
            <button
              onClick={() => setExchange(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-hop-gold/50 bg-hop-gold/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-hop-gold"
            >
              <ArrowRightLeft className="h-4 w-4" /> ${userDollars.toFixed(0)}
            </button>
          </div>
        </div>
      </header>

      <section className="mt-6">
        <SlotMachine playerName={nickname ?? "Hráč"} onExchange={() => setExchange(true)} />
      </section>

      <CurrencyExchangeModal open={exchange} onClose={() => setExchange(false)} />
    </main>
  );
}
