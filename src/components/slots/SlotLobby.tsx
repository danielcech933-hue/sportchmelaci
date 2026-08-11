import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRightLeft, Beer, CircleDot, Club, Sparkles } from "lucide-react";
import { CurrencyExchangeModal } from "@/components/CurrencyExchangeModal";
import { DailyBonusWheel } from "@/components/slots/DailyBonusWheel";
import { LiveRoulette } from "@/components/LiveRoulette";
import { LivePokerTournament } from "@/components/LivePokerTournament";
import { CountUp, MagneticText, TiltCard } from "@/lib/fx";
import { useWallet } from "@/lib/wallet";
import { cn } from "@/lib/utils";

const GAMES = [
  {
    slug: "/slots/chmelovci-cup" as const,
    title: "Chmelovci Cup",
    tag: "5 × 3 · 5 linií",
    desc: "Sportovní slot na nočním stadionu obrostlém chmelem. WILD míče, scatter půllitry a free spiny až 50×.",
    emoji: "🍺",
    live: true,
  },
];

type Tab = "slots" | "roulette" | "poker";
const TABS: { key: Tab; label: string; icon: typeof Beer }[] = [
  { key: "slots", label: "Automat Chmelovci Cup", icon: Beer },
  { key: "roulette", label: "Živá Ruleta", icon: CircleDot },
  { key: "poker", label: "Poker Turnaje", icon: Club },
];

/** Herní lobby — sloty, živá ruleta, poker turnaje + směnárna. */
export function SlotLobby() {
  const { userDollars, slotCZK } = useWallet();
  const [exchange, setExchange] = useState(false);
  const [tab, setTab] = useState<Tab>("slots");

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 pb-32 sm:px-4 sm:py-10">
      <header className="relative overflow-hidden rounded-2xl border border-hop-gold/35 bg-black/50 p-5 backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(255,204,68,0.25),transparent_60%)]" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-hop-neon/80">
              <Beer className="h-4 w-4" /> Herní lobby
            </p>
            <MagneticText text="CASINO" className="mt-1 font-display text-3xl tracking-[0.12em] slot-gold-text sm:text-5xl" />
            <p className="mt-2 max-w-2xl text-sm text-foreground/75">
              Automat, živá multiplayer ruleta a poker turnaje. Herní kredity (Slot CZK) jsou oddělené od sportovních
              dolarů — převádí se ve směnárně kurzem 1 : 100. Ruleta i poker hrají přímo o dolary z profilu.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <span className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-xs text-emerald-200">
                <CountUp value={userDollars} prefix="$" />
              </span>
              <span className="rounded-lg border border-hop-gold/40 bg-hop-gold/10 px-2.5 py-1.5 font-mono text-xs text-hop-gold">
                <CountUp value={slotCZK} suffix=" CZK" />
              </span>
            </div>
            <button
              onClick={() => setExchange(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-hop-gold/50 bg-hop-gold/15 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-hop-gold transition hover:bg-hop-gold/25"
            >
              <ArrowRightLeft className="h-4 w-4" /> Směnárna
            </button>
          </div>
        </div>
      </header>

      {/* Přepínač her */}
      <nav className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-hop-gold/25 bg-black/40 p-2 backdrop-blur-xl">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "fx-text relative inline-flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-[11px] font-black uppercase tracking-[0.18em] transition",
                active
                  ? "border border-hop-gold/70 bg-hop-gold/20 text-hop-gold shadow-[0_0_30px_-10px_rgba(255,204,68,0.9)]"
                  : "border border-transparent text-foreground/70 hover:text-hop-gold",
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </nav>

      <AnimatePresence mode="wait">
        <motion.section
          key={tab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="mt-5"
        >
          {tab === "slots" && (
            <>
              <DailyBonusWheel />
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {GAMES.map((g) => (
                  <TiltCard key={g.slug} intensity={9} className="rounded-2xl">
                    <Link
                      to={g.slug}
                      className="group block overflow-hidden rounded-2xl border border-hop-gold/30 bg-black/60 backdrop-blur-xl transition hover:border-hop-gold/70 hover:shadow-[0_0_50px_-12px_rgba(255,204,68,0.8)]"
                    >
                      <div className="relative flex h-40 items-center justify-center bg-[radial-gradient(circle_at_30%_10%,rgba(255,204,68,0.35),transparent_60%),linear-gradient(180deg,#062012,#020905)]">
                        <span className="text-6xl transition-transform duration-500 group-hover:scale-125">{g.emoji}</span>
                        <span className="absolute right-2 top-2 rounded-full border border-hop-neon/50 bg-hop-neon/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-hop-neon">
                          {g.live ? "Live" : "Brzy"}
                        </span>
                      </div>
                      <div className="p-4">
                        <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-hop-neon/70">{g.tag}</p>
                        <h2 className="fx-text mt-1 font-display text-xl tracking-[0.1em] slot-gold-text">{g.title}</h2>
                        <p className="mt-2 text-xs text-foreground/70">{g.desc}</p>
                        <span className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-hop-gold">
                          <Sparkles className="h-3.5 w-3.5" /> Hrát
                        </span>
                      </div>
                    </Link>
                  </TiltCard>
                ))}
              </div>
            </>
          )}
          {tab === "roulette" && <LiveRoulette />}
          {tab === "poker" && <LivePokerTournament />}
        </motion.section>
      </AnimatePresence>

      <CurrencyExchangeModal open={exchange} onClose={() => setExchange(false)} />
    </main>
  );
}
