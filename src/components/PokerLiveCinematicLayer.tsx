import { AnimatePresence, motion } from "framer-motion";
import { CircleDollarSign, Crown, Gem, Sparkles, Trophy, UserRound, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Phase = "deal" | "bet" | "raise" | "showdown" | "win";

const BOARD = [
  { rank: "A", suit: "♠", red: false },
  { rank: "K", suit: "♦", red: true },
  { rank: "10", suit: "♥", red: true },
  { rank: "7", suit: "♣", red: false },
  { rank: "2", suit: "♠", red: false },
];

const SEATS = [
  { name: "NORTH STAR", stack: 2480, top: "7%", left: "50%" },
  { name: "NEON ACE", stack: 1820, top: "27%", left: "89%" },
  { name: "CHMEL KING", stack: 3160, top: "73%", left: "89%" },
  { name: "ZERO TWO", stack: 930, top: "87%", left: "50%" },
  { name: "GOLD RIVER", stack: 2040, top: "73%", left: "11%" },
  { name: "NIGHT OWL", stack: 1260, top: "27%", left: "11%" },
];

function CardFace({ rank, suit, red, down = false, delay = 0 }: { rank: string; suit: string; red: boolean; down?: boolean; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -24, rotateY: 180, scale: 0.78 }}
      animate={{ opacity: 1, y: 0, rotateY: down ? 180 : 0, scale: 1 }}
      transition={{ duration: 0.58, delay, ease: [0.22, 1, 0.36, 1] }}
      className="[transform-style:preserve-3d]"
    >
      <div className="relative h-16 w-11 overflow-hidden rounded-[11px] border border-white/25 bg-gradient-to-b from-white via-zinc-100 to-zinc-300 shadow-[0_15px_26px_-15px_rgba(0,0,0,.9)] sm:h-20 sm:w-14">
        {down ? (
          <div className="absolute inset-1.5 rounded-md border border-amber-300/30 bg-[radial-gradient(circle_at_30%_30%,rgba(255,208,75,.28),transparent_25%),linear-gradient(135deg,#09101a,#14243a)]">
            <div className="absolute inset-2 rounded border border-amber-200/10" />
          </div>
        ) : (
          <div className={`flex h-full flex-col items-center justify-center font-display leading-none ${red ? "text-rose-600" : "text-zinc-950"}`}>
            <span className="text-lg font-black">{rank}</span>
            <span className="text-[13px]">{suit}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ChipBurst({ amount }: { amount: number }) {
  return (
    <motion.div className="pointer-events-none absolute left-1/2 top-1/2 z-40 -translate-x-1/2 -translate-y-1/2" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.1, 1.15, 1.35] }} transition={{ duration: 1.2 }}>
      <div className="flex items-center gap-2 rounded-2xl border border-amber-300/50 bg-black/85 px-4 py-2 shadow-[0_0_60px_rgba(255,204,68,.35)] backdrop-blur-xl">
        <CircleDollarSign className="h-4 w-4 text-amber-300" />
        <span className="font-display text-xl tracking-wider text-amber-200">+{amount.toLocaleString("cs-CZ")}</span>
      </div>
    </motion.div>
  );
}

export function PokerLiveCinematicLayer() {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const phases: Phase[] = ["deal", "bet", "raise", "showdown", "win"];
  const phase = phases[phaseIndex];
  const [seconds, setSeconds] = useState(25);

  useEffect(() => {
    const phaseTimer = window.setInterval(() => setPhaseIndex((p) => (p + 1) % phases.length), 4400);
    const tick = window.setInterval(() => setSeconds((s) => (s <= 1 ? 25 : s - 1)), 1000);
    return () => { window.clearInterval(phaseTimer); window.clearInterval(tick); };
  }, []);

  const visibleBoard = phase === "deal" ? 0 : phase === "bet" ? 3 : 5;
  const pot = useMemo(() => ({ deal: 80, bet: 220, raise: 540, showdown: 1160, win: 1160 } as Record<Phase, number>)[phase], [phase]);
  const action = phase === "deal" ? "DEALING" : phase === "bet" ? "BET 120" : phase === "raise" ? "RAISE 480" : phase === "showdown" ? "SHOWDOWN" : "PAYOUT";

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-amber-300/20 bg-[#03060a] p-3 shadow-[0_35px_120px_-55px_rgba(255,204,68,.65)] sm:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,204,68,.12),transparent_24%),radial-gradient(circle_at_50%_90%,rgba(20,180,120,.14),transparent_44%)]" />
      <div className="relative mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/8 bg-black/45 px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-2"><span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 font-mono text-[7px] font-black uppercase tracking-[.18em] text-emerald-300">LIVE ENGINE</span><span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/35">CINEMATIC TABLE</span></div>
        <span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-amber-300">{action} · {seconds.toString().padStart(2, "0")}s</span>
      </div>

      <div className="relative mx-auto aspect-[1.65] max-w-6xl [perspective:1800px] sm:aspect-[1.8]">
        <motion.div animate={{ rotateX: 56 }} transition={{ duration: 0.8 }} className="absolute left-1/2 top-[54%] h-[66%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[5px] border-amber-200/20 bg-[radial-gradient(ellipse_at_center,rgba(16,90,55,.96),rgba(4,19,17,.99)_55%,#020507_75%)] shadow-[0_50px_120px_-35px_rgba(0,0,0,.95),inset_0_0_60px_rgba(0,0,0,.95)] [transform-style:preserve-3d]>
          <div className="absolute inset-[6%] rounded-[50%] border border-amber-100/10" />
          <div className="absolute inset-[11%] rounded-[50%] border border-white/5" />
          <motion.div animate={{ scale: [1, 1.03, 1], opacity: [0.75, 1, 0.75] }} transition={{ duration: 1.8, repeat: Infinity }} className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-[24px] border border-white/8 bg-black/30 px-4 py-3 backdrop-blur">
            <CircleDollarSign className="h-4 w-4 text-amber-300" /><span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/35">POT</span><span className="font-display text-xl tracking-wider text-amber-200">{pot.toLocaleString("cs-CZ")}</span>
          </motion.div>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key={visibleBoard} className="absolute left-1/2 top-[48%] z-20 flex -translate-x-1/2 -translate-y-1/2 gap-1.5 sm:gap-2" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            {BOARD.map((card, i) => i < visibleBoard ? <CardFace key={i} {...card} delay={i * 0.11} /> : <div key={i} className="h-16 w-11 rounded-[10px] border border-amber-200/10 bg-black/25 sm:h-20 sm:w-14" />)}
          </motion.div>
        </AnimatePresence>

        {SEATS.map((seat, i) => {
          const active = phaseIndex % SEATS.length === i;
          return <motion.div key={seat.name} animate={active ? { scale: [1, 1.045, 1] } : { scale: 1 }} transition={{ duration: 1.25, repeat: active ? Infinity : 0 }} className="absolute z-30 w-[118px] -translate-x-1/2 -translate-y-1/2 sm:w-[160px]" style={{ top: seat.top, left: seat.left }}>
            <div className={`rounded-2xl border bg-gradient-to-br from-white/[.05] via-black/70 to-black p-2.5 shadow-[0_24px_45px_-25px_rgba(0,0,0,.95)] backdrop-blur-xl ${active ? "border-amber-300/55 ring-2 ring-amber-300/25 shadow-[0_0_35px_rgba(255,204,68,.22)]" : "border-white/10"}`}>
              <div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/30"><UserRound className="h-3.5 w-3.5 text-white/70" /></div><div className="min-w-0"><div className="truncate font-display text-[10px] tracking-wider text-white">{seat.name}</div><div className="font-mono text-[7px] uppercase tracking-[.16em] text-white/35">{active ? "ACTION" : "SEATED"}</div></div>{i === 0 && <Crown className="ml-auto h-3.5 w-3.5 text-amber-300" />}</div>
              <div className="mt-2 flex items-center justify-between rounded-lg border border-white/8 bg-black/30 px-2 py-1.5"><span className="font-mono text-[7px] font-black uppercase tracking-[.12em] text-white/35">STACK</span><span className="font-mono text-[8px] font-black text-amber-200">{seat.stack}</span></div>
              <div className="mt-2 flex gap-1.5"><CardFace rank="A" suit="♠" red={false} down /><CardFace rank="K" suit="♣" red={false} down delay={0.05} /></div>
            </div>
          </motion.div>;
        })}

        <motion.div className="absolute left-1/2 top-[18%] z-50 -translate-x-1/2" animate={{ y: [0, -2, 0] }} transition={{ duration: 1.3, repeat: Infinity }}>
          <div className="flex items-center gap-2 rounded-xl border border-amber-300/25 bg-black/65 px-3 py-2 font-mono text-[7px] font-black uppercase tracking-[.18em] text-amber-200 shadow-xl backdrop-blur-xl"><Zap className="h-3.5 w-3.5" /> TURN RING · {seconds}s</div>
        </motion.div>

        <AnimatePresence>
          {phase === "showdown" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="absolute left-1/2 top-[69%] z-50 -translate-x-1/2 rounded-2xl border border-amber-300/55 bg-black/85 px-5 py-3 text-center shadow-[0_0_70px_rgba(255,204,68,.3)] backdrop-blur-xl"
            >
              <div className="font-mono text-[7px] font-black uppercase tracking-[.3em] text-amber-300">SHOWDOWN</div>
              <div className="mt-1 flex items-center gap-2 font-display text-xl tracking-[.12em] text-white">
                <Trophy className="h-4 w-4 text-amber-300" /> CHMEL KING WINS
              </div>
              <div className="mt-1 font-mono text-[8px] text-emerald-300">+{pot.toLocaleString("cs-CZ")} CHIPS · FULL HOUSE</div>
            </motion.div>
          )}
          {phase === "win" && <ChipBurst amount={pot} />}
        </AnimatePresence>
      </div>

      <div className="relative mt-3 grid gap-2 sm:grid-cols-4">
        {["DEAL", "BET", "SHOWDOWN", "WIN"].map((title, i) => <motion.div key={title} animate={{ borderColor: phaseIndex === i ? "rgba(255,204,68,.5)" : "rgba(255,255,255,.08)" }} className="rounded-xl border bg-black/30 p-3"><div className="flex items-center gap-2"><Gem className="h-3.5 w-3.5 text-amber-300"/><span className="font-mono text-[7px] font-black uppercase tracking-[.18em] text-white/45">{title}</span></div><div className="mt-1 text-[9px] text-white/35">{title === "DEAL" ? "Karty vstoupí na stůl" : title === "BET" ? "Žetony proudí do potu" : title === "SHOWDOWN" ? "Karty se otočí" : "Pot získá vítěz"}</div></motion.div>)}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[.03] px-3 py-2 font-mono text-[8px] text-white/35"><Sparkles className="h-3.5 w-3.5 text-cyan-300" /> Cinematic presentation layer pro pokerovou arénu.</div>
    </section>
  );
}
