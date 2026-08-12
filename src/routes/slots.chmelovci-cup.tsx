import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRightLeft, Beer, CircleDollarSign, Coins } from "lucide-react";
import { SlotMachine } from "@/components/slots/SlotMachine";
import { CurrencyExchangeModal } from "@/components/CurrencyExchangeModal";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";

export const Route = createFileRoute("/slots/chmelovci-cup")({
  head: () => ({
    meta: [
      { title: "Chmelovci Cup — sportovní slot" },
      {
        name: "description",
        content:
          "Chmelovci Cup: 5×3 sportovní slot s chmelovými symboly, zlatým WILD míčem, scatter půllitrem a bonusovou hrou.",
      },
      { property: "og:title", content: "Chmelovci Cup — Chmelovci Sportovci" },
      {
        property: "og:description",
        content: "Sportovní dolary lze převést do Slot CZK v pevném kurzu 100 $ = 10 000 Kč a použít je pro zábavní slot.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SlotsGamePage,
});

function SlotsGamePage() {
  const { nickname } = useAuth();
  const { userDollars, slotCZK } = useWallet();
  const [exchange, setExchange] = useState(false);

  return (
    <main className="mx-auto max-w-6xl px-3 py-5 pb-32 sm:px-4 sm:py-8">
      <header className="relative overflow-hidden rounded-[1.5rem] border border-hop-gold/35 bg-[linear-gradient(135deg,rgba(6,31,17,.96),rgba(2,8,6,.98)_55%,rgba(27,18,4,.94))] p-4 shadow-[0_20px_70px_-40px_rgba(255,204,68,.65)] backdrop-blur-xl sm:p-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(255,204,68,.2),transparent_38%),radial-gradient(circle_at_85%_100%,rgba(77,255,166,.1),transparent_40%)]" />
        <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="inline-flex items-center gap-2 font-mono text-[9px] font-bold uppercase tracking-[.3em] text-hop-neon/80">
                <Beer className="h-4 w-4" /> Chmelovci Cup Slot
              </p>
              <span className="rounded-full border border-hop-gold/25 bg-hop-gold/5 px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-[.18em] text-hop-gold/70">PLAY MONEY</span>
            </div>
            <h1 className="mt-1 font-display text-3xl tracking-[.12em] slot-gold-text sm:text-5xl">CHMELOVCI CUP</h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-foreground/70 sm:text-sm">
              5 válců · 3 řady · 5 linií · chmelové symboly · WILD zlatý míč · SCATTER půllitr · bonusová hra.
              Slot používá vlastní měnu <strong className="text-hop-gold">Slot CZK</strong> pouze pro zábavní hru.
            </p>
          </div>

          <div className="flex flex-col gap-2 lg:min-w-[250px]">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-hop-gold/20 bg-black/25 px-3 py-2">
                <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[.16em] text-white/40"><CircleDollarSign className="h-3 w-3" /> Sport účet</div>
                <div className="mt-0.5 font-display text-base text-hop-neon">${userDollars.toFixed(0)}</div>
              </div>
              <div className="rounded-xl border border-hop-gold/25 bg-hop-gold/[0.06] px-3 py-2">
                <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[.16em] text-white/40"><Coins className="h-3 w-3" /> Slot CZK</div>
                <div className="mt-0.5 font-display text-base text-hop-gold">{Math.round(slotCZK).toLocaleString("cs-CZ")} Kč</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/slots" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-hop-gold/35 px-3 py-2 text-[10px] font-black uppercase tracking-[.18em] text-hop-gold transition hover:bg-hop-gold/10">
                <ArrowLeft className="h-4 w-4" /> Lobby
              </Link>
              <button onClick={() => setExchange(true)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-hop-gold/55 bg-hop-gold/15 px-3 py-2 text-[10px] font-black uppercase tracking-[.18em] text-hop-gold transition hover:bg-hop-gold/25">
                <ArrowRightLeft className="h-4 w-4" /> Směnit
              </button>
            </div>
            <p className="text-center font-mono text-[8px] uppercase tracking-[.18em] text-white/30">Kurz směny: 100 $ = 10 000 Kč</p>
          </div>
        </div>
      </header>

      <section className="mt-5">
        <SlotMachine playerName={nickname ?? "Hráč"} onExchange={() => setExchange(true)} />
      </section>

      <CurrencyExchangeModal open={exchange} onClose={() => setExchange(false)} />
    </main>
  );
}
