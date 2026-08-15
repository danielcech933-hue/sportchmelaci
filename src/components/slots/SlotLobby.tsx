import { useState } from "react";
import { ArrowRightLeft, ChevronRight, Dices, Sparkles, Trophy, WalletCards } from "lucide-react";
import { CurrencyExchangeModal } from "@/components/CurrencyExchangeModal";
import { DailyBonusWheel } from "@/components/slots/DailyBonusWheel";
import { SlotGameLibrary } from "@/components/slots/SlotGameLibrary";
import { CountUp } from "@/lib/fx";
import { useWallet } from "@/lib/wallet";

export function SlotLobby() {
  const { userDollars, slotCZK } = useWallet();
  const [exchangeOpen, setExchangeOpen] = useState(false);

  return (
    <main className="relative mx-auto max-w-[1480px] overflow-hidden px-3 pb-32 pt-4 sm:px-5 sm:pt-6">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_0%,rgba(255,204,68,.12),transparent_28%),radial-gradient(circle_at_90%_8%,rgba(77,255,166,.10),transparent_26%),radial-gradient(circle_at_50%_45%,rgba(0,119,255,.06),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 -z-10 opacity-60 [background-image:linear-gradient(rgba(255,255,255,.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.018)_1px,transparent_1px)] [background-size:32px_32px]" />

      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[#070b10]/95 shadow-[0_30px_100px_-50px_rgba(0,0,0,.95)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(255,204,68,.12),transparent_36%,rgba(20,70,110,.11)_64%,transparent)]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#ffcc44]/8 blur-3xl" />
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[1fr_390px] lg:items-end lg:p-9">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 font-mono text-[9px] font-black uppercase tracking-[.34em] text-[#4dffa6]">
              <Dices className="h-4 w-4" /> CHMEL SYSTEMS · PLAY MONEY
            </div>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
              <h1 className="font-display text-5xl tracking-[.11em] text-white sm:text-7xl">SLOTY</h1>
              <span className="mb-2 rounded-full border border-[#ffcc44]/35 bg-[#ffcc44]/8 px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[.2em] text-[#ffcc44]">SPORT CHMELÁCI</span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/58 sm:text-base">
              Premium slot lobby s originálními sportovními hrami, vlastním art direction a serverovým RNG. Všechny výhry jsou pouze herní Slot CZK.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 font-mono text-[8px] font-black uppercase tracking-[.17em] text-white/42">
              <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5">5 ORIGINAL GAMES</span>
              <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5">SERVER RNG</span>
              <span className="rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5">SLOT CZK</span>
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-black/35 p-3 backdrop-blur-xl sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[8px] font-black uppercase tracking-[.25em] text-white/35">WALLET STATUS</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4dffa6]/25 bg-[#4dffa6]/7 px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[.16em] text-[#4dffa6]"><span className="h-1.5 w-1.5 rounded-full bg-[#4dffa6] shadow-[0_0_8px_#4dffa6]" /> ONLINE</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-[#4dffa6]/20 bg-[#4dffa6]/5 p-3">
                <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[.16em] text-[#4dffa6]/65"><WalletCards className="h-3.5 w-3.5" /> SPORT DOLLARS</div>
                <div className="mt-1 text-xl font-black text-[#9affc9]"><CountUp value={userDollars} prefix="$" /></div>
              </div>
              <div className="rounded-2xl border border-[#ffcc44]/20 bg-[#ffcc44]/5 p-3">
                <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[.16em] text-[#ffcc44]/65"><Trophy className="h-3.5 w-3.5" /> SLOT CZK</div>
                <div className="mt-1 text-xl font-black text-[#ffe89b]"><CountUp value={slotCZK} suffix=" CZK" /></div>
              </div>
            </div>
            <button type="button" onClick={() => setExchangeOpen(true)} className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#ffcc44]/35 bg-[#ffcc44]/8 px-4 py-3 font-mono text-[9px] font-black uppercase tracking-[.2em] text-[#ffcc44] transition hover:border-[#ffcc44]/70 hover:bg-[#ffcc44]/15 hover:shadow-[0_0_40px_-14px_rgba(255,204,68,.9)]">
              <ArrowRightLeft className="h-4 w-4" /> SMĚNÁRNA <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[26px] border border-white/10 bg-[#070b10]/92 p-2 shadow-[0_18px_70px_-50px_rgba(0,0,0,.9)] sm:p-3">
        <DailyBonusWheel />
      </section>

      <SlotGameLibrary onExchange={() => setExchangeOpen(true)} />

      <section className="mt-4 flex items-center gap-3 rounded-[20px] border border-white/8 bg-black/25 px-4 py-3 font-mono text-[8px] uppercase tracking-[.2em] text-white/33">
        <Sparkles className="h-4 w-4 text-[#ffcc44]/55" /> OCHRANA HRY · SERVEROVÉ RNG · POUZE HERNÍ MĚNA · ŽÁDNÉ REÁLNÉ VÝPLATY
      </section>

      <CurrencyExchangeModal open={exchangeOpen} onClose={() => setExchangeOpen(false)} />
    </main>
  );
}
