import { AnimatePresence, motion } from "framer-motion";
import { Coins, Crown, Gem, Radio, Sparkles, Trophy, UserRound, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PokerTableFX, PokerChipFlight } from "@/components/PokerTableFX";

const BOARD = [
  { rank: "A", suit: "♠", red: false },
  { rank: "K", suit: "♦", red: true },
  { rank: "10", suit: "♥", red: true },
  { rank: "7", suit: "♣", red: false },
  { rank: "2", suit: "♠", red: false },
];

const SEATS = [
  ["NORTH STAR", 2480, "7%", "50%", "amber"],
  ["NEON ACE", 1820, "25%", "89%", "cyan"],
  ["CHMEL KING", 3160, "72%", "89%", "emerald"],
  ["ZERO TWO", 930, "86%", "50%", "purple"],
  ["GOLD RIVER", 2040, "72%", "11%", "gold"],
  ["NIGHT OWL", 1260, "25%", "11%", "sky"],
] as const;

const TONE: Record<string, string> = {
  amber: "from-amber-300/25 via-amber-500/10 to-black border-amber-300/35",
  cyan: "from-cyan-300/20 via-cyan-500/8 to-black border-cyan-300/30",
  emerald: "from-emerald-300/20 via-emerald-500/8 to-black border-emerald-300/30",
  purple: "from-fuchsia-300/20 via-purple-500/8 to-black border-purple-300/30",
  gold: "from-yellow-300/22 via-amber-500/8 to-black border-yellow-300/30",
  sky: "from-sky-300/20 via-blue-500/8 to-black border-sky-300/30",
};

function Card({ rank, suit, red, faceDown = false, delay = 0 }: { rank: string; suit: string; red?: boolean; faceDown?: boolean; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: -32, rotateY: 180, scale: 0.75 }} animate={{ opacity: 1, y: 0, rotateY: faceDown ? 180 : 0, scale: 1 }} transition={{ duration: 0.58, delay, ease: [0.22, 1, 0.36, 1] }} className="[transform-style:preserve-3d]">
      <div className="relative h-16 w-11 overflow-hidden rounded-[10px] border border-white/25 bg-gradient-to-b from-white to-zinc-200 shadow-[0_12px_24px_-12px_rgba(0,0,0,.9)] sm:h-20 sm:w-14">
        {faceDown ? <div className="absolute inset-1.5 rounded-md border border-amber-300/25 bg-[radial-gradient(circle_at_30%_30%,rgba(255,208,75,.25),transparent_25%),linear-gradient(135deg,#0b1019,#111b2d)]"><div className="absolute inset-2 rounded border border-amber-200/10" /></div> : <div className={`flex h-full flex-col items-center justify-center font-display font-black ${red ? "text-rose-600" : "text-zinc-950"}`}><span className="text-lg leading-none">{rank}</span><span className="text-sm leading-none">{suit}</span></div>}
      </div>
    </motion.div>
  );
}

function Chips({ amount, accent }: { amount: number; accent: string }) {
  const color = accent === "cyan" ? "border-cyan-200/55" : accent === "emerald" ? "border-emerald-200/55" : "border-amber-200/55";
  return <div className="flex items-end gap-[3px]">{Array.from({ length: Math.min(5, Math.max(3, Math.ceil(amount / 700))) }).map((_, i) => <PokerChipFlight key={i} delay={i * .04}><motion.span initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`block h-2.5 w-7 rounded-full border ${color} bg-gradient-to-b from-white/15 to-black shadow-[0_4px_8px_rgba(0,0,0,.75)]`} /></PokerChipFlight>)}</div>;
}

export function Poker3DCinematicTable() {
  const [phase, setPhase] = useState(0);
  const [timer, setTimer] = useState(18);
  useEffect(() => { const p = window.setInterval(() => setPhase((x) => (x + 1) % 5), 4200); const t = window.setInterval(() => setTimer((x) => (x <= 1 ? 25 : x - 1)), 1000); return () => { window.clearInterval(p); window.clearInterval(t); }; }, []);
  const liveSeat = [1, 4, 0, 3, 2][phase];
  const visible = [0, 3, 5, 5, 5][phase];
  const pot = useMemo(() => [120, 280, 640, 1160, 1480][phase], [phase]);
  const action = ["DEALING", "BET 120", "RAISE 480", "SHOWDOWN", "WIN"][phase];
  const phaseId = (["deal", "bet", "raise", "showdown", "win"] as const)[phase];

  return (
    <section className="relative overflow-hidden rounded-[30px] border border-amber-300/20 bg-[#03060a] p-3 shadow-[0_35px_120px_-55px_rgba(255,204,68,.65)] sm:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,202,80,.13),transparent_26%),radial-gradient(circle_at_50%_100%,rgba(24,177,117,.12),transparent_45%)]" />
      <PokerTableFX phase={phaseId} pot={pot} timer={timer} action={action} />
      <div className="relative mt-3 flex items-center justify-between rounded-2xl border border-white/8 bg-black/45 px-3 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-2"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 font-mono text-[7px] font-black uppercase tracking-[.18em] text-emerald-300"><Radio className="h-3 w-3" /> LIVE ENGINE</span><span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/35">CINEMATIC TABLE</span></div>
        <span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-amber-300">{action} · {timer.toString().padStart(2, "0")}s</span>
      </div>

      <div className="relative mx-auto mt-3 aspect-[1.65] max-w-6xl [perspective:1800px] sm:aspect-[1.8]">
        <motion.div animate={{ rotateX: 56 }} className="absolute left-1/2 top-[54%] h-[66%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[5px] border-amber-200/20 bg-[radial-gradient(ellipse_at_center,rgba(16,90,55,.96),rgba(4,19,17,.99)_55%,#020507_75%)] shadow-[0_50px_120px_-35px_rgba(0,0,0,.95),inset_0_0_60px_rgba(0,0,0,.95)] [transform-style:preserve-3d]>
          <div className="absolute inset-[6%] rounded-[50%] border border-amber-100/10" /><div className="absolute inset-[11%] rounded-[50%] border border-white/5" />
          <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-[24px] border border-white/8 bg-black/30 px-4 py-3 backdrop-blur"><Coins className="h-4 w-4 text-amber-300" /><span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/35">POT</span><span className="font-display text-xl text-amber-200">{pot}</span></div>
        </motion.div>

        <AnimatePresence mode="wait"><motion.div key={visible} className="absolute left-1/2 top-[48%] z-20 flex -translate-x-1/2 -translate-y-1/2 gap-1.5 sm:gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{BOARD.map((card, i) => i < visible ? <Card key={i} {...card} delay={i * .12} /> : <div key={i} className="h-16 w-11 rounded-[10px] border border-amber-200/10 bg-black/25 sm:h-20 sm:w-14" />)}</motion.div></AnimatePresence>

        {SEATS.map(([name, stack, top, left, accent], i) => { const active = i === liveSeat; return <motion.div key={name} animate={active ? { scale: [1, 1.045, 1] } : { scale: 1 }} transition={{ duration: 1.35, repeat: active ? Infinity : 0 }} className="absolute z-30 w-[118px] -translate-x-1/2 -translate-y-1/2 sm:w-[160px]" style={{ top, left }}>
          <div className={`rounded-2xl border bg-gradient-to-br ${TONE[accent]} p-2.5 shadow-[0_24px_45px_-25px_rgba(0,0,0,.95)] backdrop-blur-xl ${active ? "ring-2 ring-amber-300/55 shadow-[0_0_35px_rgba(255,204,68,.25)]" : ""}`}>
            <div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-black/30"><UserRound className="h-3.5 w-3.5 text-white/70" /></div><div className="min-w-0"><div className="truncate font-display text-[10px] text-white">{name}</div><div className="font-mono text-[7px] uppercase tracking-[.16em] text-white/35">{active ? "ACTION" : "SEATED"}</div></div>{i === 0 && <Crown className="ml-auto h-3.5 w-3.5 text-amber-300" />}</div>
            <div className="mt-2 flex items-center justify-between gap-2"><Chips amount={stack} accent={accent} /><span className="font-mono text-[8px] font-black text-amber-200">{stack}</span></div>
            <div className="mt-2 flex gap-1.5"><Card rank="A" suit="♠" faceDown /><Card rank="K" suit="♣" faceDown delay={.05} /></div>
          </div>
          {active && <motion.div className="mx-auto mt-1 h-1 rounded-full bg-amber-300 shadow-[0_0_16px_rgba(255,204,68,.9)]" animate={{ width: ["30%", "90%", "30%"] }} transition={{ duration: 1.4, repeat: Infinity }} />}
        </motion.div>; })}

        <motion.div initial={{ opacity: 0, y: 8, scale: .92 }} animate={{ opacity: phase === 3 ? 1 : 0, y: phase === 3 ? 0 : 8, scale: phase === 3 ? 1 : .92 }} className="absolute left-1/2 top-[69%] z-50 -translate-x-1/2 rounded-2xl border border-amber-300/55 bg-black/85 px-5 py-3 text-center shadow-[0_0_70px_rgba(255,204,68,.3)] backdrop-blur-xl"><div className="font-mono text-[7px] font-black uppercase tracking-[.3em] text-amber-300">SHOWDOWN</div><div className="mt-1 flex items-center gap-2 font-display text-xl text-white"><Trophy className="h-4 w-4 text-amber-300" /> CHMEL KING WINS</div><div className="mt-1 font-mono text-[8px] text-emerald-300">+{pot} CHIPS · FULL HOUSE</div></motion.div>
        <motion.div className="absolute left-1/2 top-[17%] z-50 -translate-x-1/2" animate={{ rotate: [0, 3, -3, 0] }} transition={{ duration: 1.1, repeat: Infinity }}><div className="flex items-center gap-2 rounded-xl border border-amber-300/25 bg-black/65 px-3 py-2 font-mono text-[7px] font-black uppercase tracking-[.18em] text-amber-200 shadow-xl backdrop-blur-xl"><Zap className="h-3.5 w-3.5" /> TURN RING</div></motion.div>
      </div>

      <div className="relative mt-3 grid gap-2 sm:grid-cols-4">{[["DEAL","Karty letí do stolu"],["BET","Chips se přesunou do potu"],["SHOWDOWN","Karty se otočí"],["WIN","Pot přiletí vítězi"]].map(([title,text], i)=><motion.div key={title} animate={{ borderColor: phase === i ? "rgba(255,204,68,.5)" : "rgba(255,255,255,.08)" }} className="rounded-xl border bg-black/30 p-3"><div className="flex items-center gap-2"><Gem className="h-3.5 w-3.5 text-amber-300"/><span className="font-mono text-[7px] font-black uppercase tracking-[.18em] text-white/45">{title}</span></div><div className="mt-1 text-[9px] text-white/35">{text}</div></motion.div>)}</div>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-cyan-300/10 bg-cyan-300/[.03] px-3 py-2 font-mono text-[8px] text-white/35"><Sparkles className="h-3.5 w-3.5 text-cyan-300" /> Cinematic presentation layer — actual multiplayer actions remain server-authoritative below.</div>
    </section>
  );
}
