import { AnimatePresence, motion } from "framer-motion";
import type { EpicGame } from "@/components/slots/EpicStage";

export type WinTier = "win" | "big" | "mega" | "epic" | "ultra";

export function getWinTier(multiplier: number): WinTier | null {
  if (!Number.isFinite(multiplier) || multiplier < 2) return null;
  if (multiplier >= 100) return "ultra";
  if (multiplier >= 50) return "epic";
  if (multiplier >= 20) return "mega";
  if (multiplier >= 8) return "big";
  return "win";
}

const TIER: Record<WinTier, { label: string; shake: number; confetti: number; hue: string }> = {
  win: { label: "NICE WIN", shake: 3, confetti: 26, hue: "#ffd86b" },
  big: { label: "BIG WIN", shake: 6, confetti: 46, hue: "#ffd029" },
  mega: { label: "MEGA WIN", shake: 10, confetti: 72, hue: "#ffb020" },
  epic: { label: "EPIC WIN", shake: 14, confetti: 100, hue: "#ff7ae0" },
  ultra: { label: "ULTRA WIN", shake: 18, confetti: 130, hue: "#8ff5ff" },
};

export function shakeKeyframes(tier: WinTier | null) {
  if (!tier) return { x: 0, y: 0 };
  const a = TIER[tier].shake;
  return { x: [0, -a, a, -a * 0.6, a * 0.4, 0], y: [0, a * 0.5, -a * 0.5, a * 0.3, 0, 0] };
}

/** Fullscreen cinematic win reveal: BIG / MEGA / EPIC / ULTRA. */
export function WinCinematic({
  tier,
  amount,
  multiplier,
  game,
}: {
  tier: WinTier | null;
  amount: number;
  multiplier: number;
  game: EpicGame;
}) {
  const cfg = tier ? TIER[tier] : null;
  const accent = game === "thunder-egg" ? "#ffd86b" : "#7fe9ff";
  return (
    <AnimatePresence>
      {cfg && amount > 0 && (
        <motion.div
          key={`${tier}-${amount}`}
          className="pointer-events-none fixed inset-0 z-[900] grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.06 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
          <motion.div
            className="absolute inset-0"
            style={{ background: `radial-gradient(circle at 50% 50%, ${cfg.hue}44, transparent 55%)` }}
            animate={{ opacity: [0.3, 0.95, 0.5], scale: [0.85, 1.12, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          />
          {/* radial light rays */}
          <motion.div
            className="absolute h-[140vmax] w-[140vmax] opacity-40"
            style={{
              backgroundImage: `repeating-conic-gradient(from 0deg, ${cfg.hue}33 0deg 6deg, transparent 6deg 14deg)`,
              maskImage: "radial-gradient(circle, black 10%, transparent 62%)",
              WebkitMaskImage: "radial-gradient(circle, black 10%, transparent 62%)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          />
          {/* confetti / particles */}
          {Array.from({ length: cfg.confetti }, (_, i) => {
            const angle = (i / cfg.confetti) * Math.PI * 2;
            const dist = 160 + (i % 7) * 48;
            const square = i % 3 === 0;
            return (
              <motion.span
                key={i}
                className={square ? "absolute h-2 w-1.5" : "absolute h-1.5 w-1.5 rounded-full"}
                style={{ background: i % 2 ? cfg.hue : accent, boxShadow: `0 0 12px ${cfg.hue}` }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
                animate={{
                  x: Math.cos(angle) * dist,
                  y: Math.sin(angle) * dist + (square ? 220 : 60),
                  opacity: 0,
                  scale: 1.3,
                  rotate: square ? 540 : 0,
                }}
                transition={{ duration: 1.5 + (i % 6) * 0.12, ease: "easeOut" }}
              />
            );
          })}
          <motion.div
            className="relative px-6 text-center"
            initial={{ scale: 0.4, y: 40, rotateX: -30 }}
            animate={{ scale: [0.4, 1.16, 1], y: 0, rotateX: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            <div className="font-mono text-[10px] font-black uppercase tracking-[.5em] text-white/70">
              {game === "thunder-egg" ? "OLYMPUS REWARD" : "DEEP WATER REWARD"}
            </div>
            <motion.h2
              className="mt-2 font-display text-5xl font-black uppercase tracking-[.12em] sm:text-8xl"
              style={{ color: cfg.hue, textShadow: `0 0 60px ${cfg.hue}, 0 8px 0 rgba(0,0,0,.55)` }}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1.1, repeat: Infinity }}
            >
              {cfg.label}
            </motion.h2>
            <motion.p
              className="mt-3 font-display text-3xl font-black text-white sm:text-5xl"
              style={{ textShadow: `0 0 34px ${accent}` }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              +{Math.round(amount).toLocaleString("cs-CZ")} Kč
            </motion.p>
            <p className="mt-1 font-mono text-[11px] font-black uppercase tracking-[.35em]" style={{ color: accent }}>
              {multiplier.toFixed(1)}× sázky
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
