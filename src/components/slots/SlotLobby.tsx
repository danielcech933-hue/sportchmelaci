import { Sparkles, Trophy, WalletCards } from "lucide-react";
import { DailyBonusWheel } from "@/components/slots/DailyBonusWheel";
import { CountUp } from "@/lib/fx";
import { useWallet } from "@/lib/wallet";

/** Minimal slot lobby: only the Wheel Fortune experience remains. */
export function SlotLobby() {
  const { userDollars, slotCZK } = useWallet();

  return (
    <main className="mx-auto max-w-5xl px-3 py-6 pb-32 sm:px-4 sm:py-10">
      <section className="relative overflow-hidden rounded-3xl border border-hop-gold/35 bg-black/55 p-5 shadow-[0_25px_90px_-45px_rgba(255,204,68,.65)] backdrop-blur-xl sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(255,204,68,.2),transparent_50%),radial-gradient(circle_at_85%_15%,rgba(77,255,166,.1),transparent_40%)]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.32em] text-hop-neon/80">
              <Sparkles className="h-4 w-4" /> Wheel Fortune
            </div>
            <h1 className="mt-1 font-display text-4xl tracking-[0.12em] slot-gold-text sm:text-6xl">KOLO ŠTĚSTÍ</h1>
            <p className="mt-2 max-w-2xl text-sm text-foreground/70 sm:text-base">
              Jediná herní aktivita v sekci Sloty. Každých 8 hodin můžeš roztočit kolo a získat garantovanou dolarovou odměnu.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-[17rem]">
            <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 px-3 py-2.5">
              <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.18em] text-emerald-200/70">
                <WalletCards className="h-3.5 w-3.5" /> Sport Dollars
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-200">
                <CountUp value={userDollars} prefix="$" />
              </div>
            </div>
            <div className="rounded-xl border border-hop-gold/35 bg-hop-gold/10 px-3 py-2.5">
              <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.18em] text-hop-gold/70">
                <Trophy className="h-3.5 w-3.5" /> Slot CZK
              </div>
              <div className="mt-1 font-mono text-lg font-bold text-hop-gold">
                <CountUp value={slotCZK} suffix=" CZK" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-hop-gold/25 bg-black/35 p-2 backdrop-blur-xl sm:p-3">
        <DailyBonusWheel />
      </section>
    </main>
  );
}
