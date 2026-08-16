import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, ChevronDown } from "lucide-react";
import { EpicSymbolArt } from "@/components/slots/EpicSymbolArt";
import { EPIC_FEATURES } from "@/components/slots/EpicBonusCinematic";
import type { EpicGame } from "@/components/slots/EpicStage";
import { cn } from "@/lib/utils";

type Row = { symbol: string; label: string; pays: string };

const PAYS: Record<EpicGame, Row[]> = {
  "thunder-egg": [
    { symbol: "thunder", label: "Thunderbolt", pays: "3× 5 / 4× 15 / 5× 50" },
    { symbol: "eagle", label: "Storm Eagle", pays: "3× 3 / 4× 8 / 5× 25" },
    { symbol: "pillar", label: "Temple Pillar", pays: "3× 2 / 4× 5 / 5× 15" },
    { symbol: "egg", label: "Thunder Egg", pays: "3× 1.5 / 4× 4 / 5× 10" },
    { symbol: "wild", label: "Divine Wild", pays: "nahrazuje vše" },
    { symbol: "zeus_k", label: "K / Q / J / 10", pays: "3× 0.8 / 4× 1.5 / 5× 5" },
  ],
  "bass-bounty": [
    { symbol: "lure", label: "Trophy Bass", pays: "3× 5 / 4× 12 / 5× 30" },
    { symbol: "hook", label: "Deep Hook", pays: "3× 3 / 4× 8 / 5× 20" },
    { symbol: "fisher", label: "Angler", pays: "3× 2 / 4× 5 / 5× 15" },
    { symbol: "boat_scatter", label: "Anchor Scatter", pays: "3+ spouští bonus" },
    { symbol: "fish_money", label: "Money Coin", pays: "hodnota coinu × sázka" },
    { symbol: "fish_k", label: "K / Q / J / 10", pays: "3× 0.8 / 4× 1.5 / 5× 5" },
  ],
};

/** Professional paytable panel placed under the reels — never overlays the board. */
export function EpicPaytablePanel({ game }: { game: EpicGame }) {
  const [open, setOpen] = useState(false);
  const hue = game === "thunder-egg" ? "text-amber-200" : "text-cyan-200";

  return (
    <section className="mt-3 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/45 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="inline-flex items-center gap-2">
          <BookOpen className={cn("h-4 w-4", hue)} />
          <span className="font-mono text-[9px] font-black uppercase tracking-[.28em] text-white/70">VÝPLATNÍ TABULKA & BONUSY</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-white/50 transition-transform", open && "rotate-180")} />
      </button>
      <motion.div initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} className="overflow-hidden">
        <div className="grid gap-3 border-t border-white/8 p-4 lg:grid-cols-2">
          <div className="grid gap-2 sm:grid-cols-2">
            {PAYS[game].map((row) => (
              <div key={row.symbol} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.03] p-2.5">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-white/10 bg-gradient-to-b from-white/[.08] to-black/70">
                  <EpicSymbolArt game={game} symbol={row.symbol} className="h-9 w-9 max-h-9 max-w-9" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-display text-sm text-white">{row.label}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[.12em] text-white/45">{row.pays}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-2">
            {EPIC_FEATURES[game].map((feature, index) => (
              <div key={feature.key} className="rounded-xl border border-white/8 bg-white/[.03] p-3">
                <div className="flex items-center gap-2">
                  <span className={cn("grid h-6 w-6 place-items-center rounded-md bg-white/[.06] font-mono text-[10px] font-black", hue)}>{index + 1}</span>
                  <p className="font-display text-sm tracking-[.06em] text-white">{feature.title}</p>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">{feature.blurb}</p>
              </div>
            ))}
            <p className="px-1 font-mono text-[8px] uppercase tracking-[.18em] text-white/30">
              Všechny výsledky generuje server · pouze Slot CZK · play money
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
