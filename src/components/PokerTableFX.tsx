import { motion } from "framer-motion";
import { Coins, Sparkles, Trophy, Zap } from "lucide-react";
import type { ReactNode } from "react";

type Phase = "deal" | "bet" | "raise" | "showdown" | "win";

const PHASES: { id: Phase; label: string }[] = [
  { id: "deal", label: "DEAL" },
  { id: "bet", label: "BET" },
  { id: "raise", label: "RAISE" },
  { id: "showdown", label: "SHOWDOWN" },
  { id: "win", label: "WIN" },
];

export function PokerTableFX({
  phase,
  pot,
  timer,
  action,
}: {
  phase: Phase;
  pot: number;
  timer: number;
  action: string;
}) {
  const phaseIndex = PHASES.findIndex((p) => p.id === phase);
  return (
    <div className="rounded-[24px] border border-amber-300/15 bg-black/45 p-3 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 font-mono text-[7px] font-black uppercase tracking-[.18em] text-emerald-300">
            <Sparkles className="h-3 w-3" /> LIVE FX
          </span>
          <span className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-white/35">{action}</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[.16em] text-amber-200">
          <Zap className="h-3 w-3" /> TURN {String(Math.max(timer, 0)).padStart(2, "0")}s
        </div>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {PHASES.map((item, index) => {
          const active = index === phaseIndex;
          const passed = index < phaseIndex;
          return (
            <div key={item.id} className="relative">
              {index > 0 && <div className={`absolute -left-1.5 top-1/2 h-px w-1.5 ${passed ? "bg-amber-300/70" : "bg-white/10"}`} />}
              <div className={`rounded-xl border px-2 py-2 text-center font-mono text-[7px] font-black tracking-[.16em] transition ${active ? "border-amber-300/55 bg-amber-300/10 text-amber-200 shadow-[0_0_24px_rgba(255,204,68,.16)]" : passed ? "border-emerald-300/25 bg-emerald-300/5 text-emerald-300/80" : "border-white/8 bg-white/[.02] text-white/30"}`}>
                {item.label}
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative mt-4 overflow-hidden rounded-[20px] border border-emerald-300/10 bg-[radial-gradient(ellipse_at_center,rgba(18,82,58,.65),rgba(2,10,10,.96)_65%)] px-4 py-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,204,68,.08),transparent_32%)]" />
        <motion.div animate={{ scale: activeScale(phase), opacity: activeOpacity(phase) }} className="relative mx-auto flex max-w-sm items-center justify-center gap-3 rounded-2xl border border-amber-300/20 bg-black/35 px-5 py-4 shadow-[0_18px_50px_-25px_rgba(0,0,0,.9)]">
          <Coins className="h-5 w-5 text-amber-300" />
          <div>
            <div className="font-mono text-[7px] font-black uppercase tracking-[.24em] text-white/30">CURRENT POT</div>
            <motion.div key={pot} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-3xl tracking-[.1em] text-amber-200">{pot.toLocaleString("cs-CZ")}</motion.div>
          </div>
        </motion.div>
        {phase === "showdown" && <ShowdownFX />}
        {phase === "win" && <WinFX pot={pot} />}
      </div>
    </div>
  );
}

function activeScale(phase: Phase) {
  return phase === "raise" || phase === "showdown" || phase === "win" ? [1, 1.025, 1] : 1;
}
function activeOpacity(phase: Phase) {
  return phase === "deal" ? [0.85, 1, 0.85] : 1;
}

function ShowdownFX() {
  return (
    <motion.div initial={{ opacity: 0, scale: .8 }} animate={{ opacity: [0, 1, .85], scale: [0.8, 1, 1] }} transition={{ duration: .8 }} className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="rounded-2xl border border-amber-300/45 bg-black/75 px-5 py-3 text-center shadow-[0_0_70px_rgba(255,204,68,.2)] backdrop-blur-xl">
        <div className="font-mono text-[7px] font-black uppercase tracking-[.35em] text-amber-300">SHOWDOWN</div>
        <div className="mt-1 flex items-center justify-center gap-2 font-display text-xl tracking-[.12em] text-white"><Trophy className="h-4 w-4 text-amber-300" /> REVEAL</div>
      </div>
    </motion.div>
  );
}

function WinFX({ pot }: { pot: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 18 }, (_, i) => (
        <motion.span key={i} className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-amber-200" initial={{ x: 0, y: 0, opacity: 0, scale: .2 }} animate={{ x: Math.cos(i * .9) * (80 + i * 6), y: Math.sin(i * .9) * (45 + i * 4), opacity: [0, 1, 0], scale: [0.2, 1, 0] }} transition={{ duration: 1 + i * .03, ease: "easeOut" }} />
      ))}
      <motion.div initial={{ opacity: 0, y: 12, scale: .88 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-300/55 bg-black/80 px-6 py-4 text-center shadow-[0_0_90px_rgba(255,204,68,.28)] backdrop-blur-xl">
        <div className="font-mono text-[7px] font-black uppercase tracking-[.35em] text-amber-300">WINNER</div>
        <div className="mt-1 flex items-center justify-center gap-2 font-display text-2xl tracking-[.12em] text-white"><Trophy className="h-5 w-5 text-amber-300" /> POT CLAIMED</div>
        <div className="mt-1 font-mono text-[9px] font-black uppercase tracking-[.18em] text-emerald-300">+{pot.toLocaleString("cs-CZ")} CHIPS</div>
      </motion.div>
    </div>
  );
}

export function PokerChipFlight({ children, delay = 0 }: { children?: ReactNode; delay?: number }) {
  return <motion.div initial={{ x: -70, y: 30, rotate: -25, opacity: 0 }} animate={{ x: 0, y: 0, rotate: 0, opacity: 1 }} transition={{ duration: .6, delay, ease: [0.22, 1, .36, 1] }}>{children}</motion.div>;
}
