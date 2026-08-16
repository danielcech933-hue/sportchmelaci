import { AnimatePresence, motion } from "framer-motion";
import { Zap, Sparkles, Trophy } from "lucide-react";
import type { ReactNode } from "react";

export type BigWinTier = "win" | "big" | "mega" | "epic";

export function getBigWinTier(multiplier: number): BigWinTier | null {
  if (!Number.isFinite(multiplier) || multiplier < 2) return null;
  if (multiplier >= 50) return "epic";
  if (multiplier >= 20) return "mega";
  if (multiplier >= 10) return "big";
  return "win";
}

const TIER_LABEL: Record<BigWinTier, string> = {
  win: "BIG WIN",
  big: "MEGA WIN",
  mega: "EPIC WIN",
  epic: "ULTRA WIN",
};

export function WinBurst({ tier, amount }: { tier: BigWinTier | null; amount: number }) {
  return (
    <AnimatePresence>
      {tier && amount > 0 && (
        <motion.div
          key={`${tier}-${amount}`}
          className="pointer-events-none absolute inset-0 z-30 grid place-items-center overflow-hidden rounded-[1.5rem]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,204,68,.34),transparent_42%),linear-gradient(90deg,transparent,rgba(255,255,255,.06),transparent)]"
            animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.9, 1.06, 0.9] }}
            transition={{ duration: 1.1, repeat: Infinity }}
          />
          {Array.from({ length: 18 }).map((_, index) => (
            <motion.span
              key={index}
              className="absolute h-1.5 w-1.5 rounded-full bg-hop-gold shadow-[0_0_14px_rgba(255,204,68,.95)]"
              initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
              animate={{
                x: Math.cos((index / 18) * Math.PI * 2) * (120 + (index % 4) * 35),
                y: Math.sin((index / 18) * Math.PI * 2) * (90 + (index % 5) * 30),
                opacity: 0,
                scale: 1.4,
              }}
              transition={{ duration: 1.15 + (index % 5) * 0.08, ease: "easeOut" }}
            />
          ))}
          <motion.div
            initial={{ y: 24, scale: 0.6, rotate: -2 }}
            animate={{ y: 0, scale: [1, 1.08, 1], rotate: [0, -1, 1, 0] }}
            transition={{ duration: 0.8, type: "spring", stiffness: 160, damping: 10 }}
            className="relative text-center"
          >
            <div className="font-mono text-[10px] font-black uppercase tracking-[.4em] text-hop-neon">{TIER_LABEL[tier]}</div>
            <div className="mt-1 font-display text-5xl font-black tracking-[.14em] text-hop-gold drop-shadow-[0_0_30px_rgba(255,204,68,.95)] sm:text-7xl">
              +{amount.toLocaleString("cs-CZ")} Kč
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function BonusChoiceGlow({ children }: { children: ReactNode }) {
  return (
    <motion.div
      animate={{ boxShadow: ["0 0 20px rgba(255,204,68,.15)", "0 0 58px rgba(255,204,68,.52)", "0 0 20px rgba(255,204,68,.15)"] }}
      transition={{ duration: 1.25, repeat: Infinity }}
      className="rounded-[2rem]"
    >
      {children}
    </motion.div>
  );
}

export function BonusStep({ index, label, active, icon }: { index: number; label: string; active: boolean; icon?: ReactNode }) {
  return (
    <motion.div
      animate={active ? { y: [0, -2, 0], opacity: [0.72, 1, 0.72] } : { opacity: 0.45 }}
      transition={{ duration: 1.1, repeat: active ? Infinity : 0 }}
      className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${active ? "border-hop-gold/55 bg-hop-gold/10" : "border-white/8 bg-black/25"}`}
    >
      <span className="grid h-5 w-5 place-items-center rounded-md bg-black/30 font-mono text-[9px] font-black text-hop-gold">{index}</span>
      {icon ?? <Sparkles className="h-3.5 w-3.5 text-hop-neon" />}
      <span className="font-mono text-[8px] font-black uppercase tracking-[.13em] text-white/75">{label}</span>
    </motion.div>
  );
}

export function EpicBadge({ children }: { children: ReactNode }) {
  return (
    <motion.span
      animate={{ opacity: [0.65, 1, 0.65], scale: [1, 1.03, 1] }}
      transition={{ duration: 1.4, repeat: Infinity }}
      className="inline-flex items-center gap-1 rounded-full border border-hop-gold/50 bg-hop-gold/10 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[.18em] text-hop-gold"
    >
      <Zap className="h-3 w-3" />
      {children}
    </motion.span>
  );
}

export function TrophyPulse() {
  return (
    <motion.div
      animate={{ rotate: [0, 6, -6, 0], scale: [1, 1.08, 1] }}
      transition={{ duration: 0.95, repeat: Infinity }}
      className="grid h-12 w-12 place-items-center rounded-full border border-hop-gold/50 bg-hop-gold/10 shadow-[0_0_38px_rgba(255,204,68,.38)]"
    >
      <Trophy className="h-6 w-6 text-hop-gold" />
    </motion.div>
  );
}
