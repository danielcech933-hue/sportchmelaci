import { useMemo } from "react";
import { motion } from "framer-motion";
import { Crown, Gem, Radio, Shield, Sparkles, Spade, Users, Zap } from "lucide-react";
import { LivePokerTournament } from "@/components/LivePokerTournament";
import { Poker3DCinematicTable } from "@/components/Poker3DCinematicTable";

const SEATS = [
  { name: "NORTH STAR", meta: "PRO", tone: "from-amber-300/25 to-orange-500/5" },
  { name: "NEON ACE", meta: "LIVE", tone: "from-cyan-300/25 to-blue-500/5" },
  { name: "CHMEL KING", meta: "VIP", tone: "from-emerald-300/25 to-teal-500/5" },
  { name: "ZERO TWO", meta: "LIVE", tone: "from-fuchsia-300/25 to-purple-500/5" },
  { name: "GOLD RIVER", meta: "PRO", tone: "from-yellow-300/25 to-amber-500/5" },
  { name: "NIGHT OWL", meta: "LIVE", tone: "from-sky-300/25 to-indigo-500/5" },
];

export function PokerArena3D() {
  const ambient = useMemo(() => Array.from({ length: 20 }, (_, i) => i), []);

  return (
    <div className="relative overflow-hidden rounded-[34px] border border-amber-400/20 bg-[#05070b] shadow-[0_40px_140px_-50px_rgba(255,196,67,.45)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(255,204,68,.16),transparent_28%),radial-gradient(circle_at_18%_70%,rgba(43,197,255,.09),transparent_26%),radial-gradient(circle_at_85%_66%,rgba(142,92,255,.10),transparent_26%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:28px_28px]" />
      {ambient.map((i) => (
        <motion.span key={i} className="pointer-events-none absolute h-1 w-1 rounded-full bg-white/40" style={{ left: `${4 + (i * 17) % 92}%`, top: `${8 + (i * 29) % 82}%` }} animate={{ opacity: [0, .45, 0], scale: [0, 1.8, 0] }} transition={{ duration: 3.4 + (i % 5) * .6, repeat: Infinity, delay: i * .17 }} />
      ))}

      <header className="relative z-10 flex flex-col gap-4 border-b border-white/8 bg-black/35 px-5 py-5 backdrop-blur-xl sm:px-7 sm:py-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[8px] font-black uppercase tracking-[.35em] text-amber-300/80"><Spade className="h-4 w-4" /> CHMEL ARENA · 3D CARD ROOM</div>
          <h2 className="mt-2 font-display text-4xl tracking-[.14em] text-white sm:text-6xl">NEON POKER <span className="text-amber-300">// LIVE</span></h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/45 sm:text-sm">Prostorový multiplayer Texas Hold’em: realtime stůl, soukromé karty, akce na tahu, side poty, showdown a server-authoritative vyhodnocení. Vše pouze v play-money režimu.</p>
        </div>
        <div className="flex flex-wrap gap-2 font-mono text-[8px] font-black uppercase tracking-[.16em]">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-emerald-300"><Radio className="h-3 w-3" /> REALTIME</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 text-cyan-300"><Shield className="h-3 w-3" /> SERVER AUTH</span>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-amber-300"><Gem className="h-3 w-3" /> PLAY MONEY</span>
        </div>
      </header>

      <section className="relative z-10 p-3 sm:p-5">
        <Poker3DCinematicTable />
      </section>

      <section className="relative z-10 px-3 pb-2 sm:px-5">
        <div className="relative overflow-hidden rounded-[30px] border border-amber-300/15 bg-gradient-to-b from-[#111824] via-[#071016] to-black p-3 sm:p-5 [perspective:1600px]">
          <div className="pointer-events-none absolute inset-x-[10%] top-[10%] h-32 rounded-full bg-amber-300/10 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-6%] left-[8%] right-[8%] h-32 rounded-full bg-cyan-300/8 blur-3xl" />
          <div className="relative mx-auto min-h-[330px] max-w-6xl [transform-style:preserve-3d] sm:min-h-[410px]">
            <motion.div initial={{ rotateX: 58, scale: .96, opacity: 0 }} animate={{ rotateX: 58, scale: 1, opacity: 1 }} transition={{ duration: .9, ease: "easeOut" }} className="absolute left-1/2 top-[50%] h-[70%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-[3px] border-amber-300/25 bg-[radial-gradient(ellipse_at_center,rgba(20,76,53,.95),rgba(2,11,12,.98)_58%,rgba(0,0,0,.99))] shadow-[0_45px_100px_-35px_rgba(0,0,0,.95),inset_0_0_0_10px_rgba(30,28,15,.55),inset_0_0_60px_rgba(0,0,0,.9)] [transform-style:preserve-3d]">
              <div className="absolute inset-[6%] rounded-[50%] border border-emerald-200/10" />
              <div className="absolute inset-[11%] rounded-[50%] border border-white/5" />
              <div className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-300/20 bg-black/20 shadow-[0_0_90px_rgba(255,204,68,.09)]" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"><div className="font-mono text-[8px] font-black uppercase tracking-[.4em] text-white/25">CHMEL ARENA</div><div className="mt-1 font-display text-2xl tracking-[.25em] text-amber-200/70">NO LIMIT</div></div>
            </motion.div>
            {SEATS.map((seat, i) => { const angle = -90 + i * 60; const radius = 42; const x = 50 + Math.cos((angle * Math.PI) / 180) * radius; const y = 48 + Math.sin((angle * Math.PI) / 180) * 31; return <motion.div key={seat.name} initial={{ opacity: 0, scale: .8, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: .15 + i * .08, duration: .45 }} className="absolute z-20 w-[145px] -translate-x-1/2 -translate-y-1/2 sm:w-[175px]" style={{ left: `${x}%`, top: `${y}%` }}><div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${seat.tone} bg-[#070a0f]/90 p-2.5 shadow-[0_22px_45px_-26px_rgba(0,0,0,.95)] backdrop-blur-xl`}><div className="flex items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/30 text-white/70"><Users className="h-4 w-4" /></div><div className="min-w-0"><div className="truncate font-display text-[12px] tracking-wider text-white">{seat.name}</div><div className="font-mono text-[7px] uppercase tracking-[.18em] text-white/35">{seat.meta}</div></div></div>{i === 0 && <Crown className="h-4 w-4 text-amber-300" />}</div><div className="mt-2 flex items-center justify-between rounded-lg border border-white/8 bg-black/30 px-2 py-1.5 font-mono text-[8px] uppercase tracking-[.12em]"><span className="text-white/35">STACK</span><span className="font-black text-amber-200">1 000</span></div><div className="mt-1.5 flex gap-1.5"><span className="grid h-7 w-5 place-items-center rounded-md border border-white/15 bg-gradient-to-b from-slate-700 to-black text-[7px] text-white/40">?</span><span className="grid h-7 w-5 place-items-center rounded-md border border-white/15 bg-gradient-to-b from-slate-700 to-black text-[7px] text-white/40">?</span><span className="ml-auto rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 font-mono text-[7px] font-black uppercase text-emerald-300">ONLINE</span></div></div></motion.div>; })}
            <div className="absolute left-1/2 top-[28%] z-30 -translate-x-1/2"><div className="flex items-center gap-2 rounded-2xl border border-amber-300/25 bg-black/65 px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.18em] text-amber-200 shadow-xl backdrop-blur-xl"><Zap className="h-4 w-4" /> LIVE TABLE SHELL</div></div>
          </div>
        </div>
      </section>

      <div className="relative z-10 grid gap-3 px-3 pb-3 pt-3 sm:grid-cols-3 sm:px-5 sm:pb-5">
        <ArenaFeature icon={<Sparkles />} title="CINEMATIC SHOWDOWN" text="Karty se rozdají, otočí a vítězná kombinace dostane vlastní win reveal." />
        <ArenaFeature icon={<Users />} title="6–9 PLAYER TABLES" text="Seat → ready → action → fold/call/raise/all-in → reconnect bez ztráty handy." />
        <ArenaFeature icon={<Shield />} title="SERVER AUTHORITATIVE" text="Shuffle, hand ranking, poty i výsledek handy rozhoduje server; klient jen zobrazuje stav." />
      </div>

      <div className="relative z-10 border-t border-white/8 bg-black/25 p-3 sm:p-5">
        <LivePokerTournament />
      </div>
    </div>
  );
}

function ArenaFeature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[.02] p-4"><div className="flex items-center gap-2 text-amber-300"><span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span><span className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-white/45">{title}</span></div><p className="mt-2 text-[10px] leading-relaxed text-white/42">{text}</p></div>;
}
