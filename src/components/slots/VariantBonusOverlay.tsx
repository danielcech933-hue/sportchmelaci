import { AnimatePresence, motion } from "framer-motion";
import { Flame, Gauge, Gem, Skull, Trophy, Zap } from "lucide-react";
import type { SlotVariantId } from "./SlotVariantFrame";

const META: Record<string, { title: string; subtitle: string; icon: typeof Flame; palette: string; particle: string }> = {
  "cascade_rush": { title: "NEON CASCADE RUSH", subtitle: "CHAIN REACTOR ACTIVATED", icon: Zap, palette: "from-cyan-500/20 via-emerald-500/10 to-black", particle: "bg-cyan-300" },
  "boost_rush": { title: "BOOST OVERDRIVE", subtitle: "5× TURBO SPINS UNLOCKED", icon: Gauge, palette: "from-orange-500/25 via-amber-500/10 to-black", particle: "bg-orange-300" },
  "golden_frenzy": { title: "GOLDEN FRENZY", subtitle: "THE STADIUM LIGHTS UP", icon: Gem, palette: "from-yellow-400/25 via-amber-500/10 to-black", particle: "bg-yellow-200" },
  "mystery_vault": { title: "MYSTERY VAULT", subtitle: "THE KEG HAS BEEN UNSEALED", icon: Skull, palette: "from-fuchsia-500/25 via-purple-500/10 to-black", particle: "bg-fuchsia-300" },
  "wild_chain": { title: "CURSED WILD CHAIN", subtitle: "WILDS ARE SPREADING", icon: Flame, palette: "from-purple-500/25 via-fuchsia-500/10 to-black", particle: "bg-purple-300" },
  "hall_of_fame": { title: "HALL OF FAME", subtitle: "LEGENDS NEVER LEAVE THE FIELD", icon: Trophy, palette: "from-sky-400/25 via-blue-500/10 to-black", particle: "bg-sky-200" },
};

export function VariantBonusOverlay({ type, spins, multiplier, game, onDone }: { type?: string; spins?: number; multiplier?: number; game?: SlotVariantId; onDone?: () => void }) {
  const meta = type ? META[type] : undefined;
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[80] grid place-items-center bg-black/80 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onAnimationComplete={() => window.setTimeout(() => onDone?.(), 2600)}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {Array.from({ length: 26 }, (_, i) => <motion.i key={i} className={`absolute h-1.5 w-1.5 rounded-full ${meta.particle}`} initial={{ x: "50vw", y: "50vh", opacity: 0, scale: 0 }} animate={{ x: `${(i * 37) % 100}vw`, y: `${(i * 61) % 100}vh`, opacity: [0, 1, 0], scale: [0, 1.6, .2], rotate: i * 37 }} transition={{ duration: 1.8 + (i % 5) * .18, ease: "easeOut" }} />)}
        </div>
        <motion.div initial={{ scale: .55, y: 50, rotateX: -20 }} animate={{ scale: [1, 1.05, 1], y: 0, rotateX: 0 }} transition={{ duration: .7, type: "spring" }} className={`relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/15 bg-gradient-to-br ${meta.palette} p-1 shadow-[0_0_100px_-25px_rgba(255,204,68,.9)]`}>
          <motion.div className="absolute inset-x-10 top-0 h-px bg-white/80" animate={{ opacity: [0, 1, .2, 1, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />
          <div className="relative rounded-[1.8rem] border border-white/10 bg-black/70 p-8 text-center">
            <motion.div initial={{ scale: .6 }} animate={{ scale: [1, 1.08, 1] }} transition={{ duration: .7, repeat: Infinity, repeatDelay: 1.2 }} className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-white/20 bg-white/5 shadow-[0_0_50px_-10px_rgba(255,255,255,.7)]"><Icon className="h-12 w-12 text-hop-gold" /></motion.div>
            <div className="mt-5 font-mono text-[10px] font-black uppercase tracking-[.42em] text-hop-neon">BONUS TRIGGERED</div>
            <h2 className="mt-2 font-display text-3xl tracking-[.08em] text-white sm:text-5xl">{meta.title}</h2>
            <p className="mt-3 font-mono text-xs uppercase tracking-[.22em] text-white/60">{meta.subtitle}</p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="font-mono text-[8px] uppercase tracking-[.2em] text-white/40">FREE SPINS</div><div className="mt-1 font-display text-3xl text-hop-gold">{spins || 0}</div></div>
              <div className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="font-mono text-[8px] uppercase tracking-[.2em] text-white/40">MULTIPLIER</div><div className="mt-1 font-display text-3xl text-hop-neon">{multiplier || 1}×</div></div>
            </div>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-hop-gold" initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 2.2, ease: "linear" }} /></div>
            <p className="mt-4 font-mono text-[8px] uppercase tracking-[.18em] text-white/30">{game ?? "SPORT CHMELÁCI"} · SERVER AUTHORITATIVE BONUS</p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
