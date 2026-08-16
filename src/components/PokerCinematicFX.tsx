import { AnimatePresence, motion } from "framer-motion";
import { Coins, Crown, Sparkles, Trophy, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function PokerCinematicFX() {
  const [phase, setPhase] = useState<"idle" | "deal" | "chips" | "showdown" | "win">("idle");
  const [pot, setPot] = useState(240);

  useEffect(() => {
    const phases = ["deal", "chips", "showdown", "win"] as const;
    let i = 0;
    const timer = window.setInterval(() => {
      setPhase(phases[i % phases.length]);
      setPot([240, 520, 980, 1640][i % 4]);
      i += 1;
      window.setTimeout(() => setPhase("idle"), 1800);
    }, 4200);
    return () => window.clearInterval(timer);
  }, []);

  const sparkles = useMemo(() => Array.from({ length: 18 }, (_, i) => i), []);

  return (
    <div className="pointer-events-none absolute inset-0 z-[60] overflow-hidden">
      {sparkles.map((i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-amber-200/70"
          style={{ left: `${8 + ((i * 19) % 84)}%`, top: `${12 + ((i * 31) % 72)}%` }}
          animate={{ opacity: [0, 0.8, 0], scale: [0, 1.7, 0], y: [0, -14, -28] }}
          transition={{ duration: 2.4 + (i % 4) * 0.35, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}

      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div
            key={phase}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.08 }}
            className="absolute inset-0 grid place-items-center"
          >
            <motion.div
              animate={phase === "win" ? { scale: [1, 1.08, 1], rotate: [0, -1, 1, 0] } : { scale: 1 }}
              transition={phase === "win" ? { duration: 0.8, repeat: 2 } : { duration: 0.25 }}
              className="rounded-[26px] border border-amber-200/35 bg-black/70 px-7 py-5 text-center shadow-[0_0_100px_rgba(255,204,68,.22)] backdrop-blur-xl"
            >
              {phase === "deal" && <Sparkles className="mx-auto h-6 w-6 text-cyan-300" />}
              {phase === "chips" && <Coins className="mx-auto h-6 w-6 text-amber-300" />}
              {phase === "showdown" && <Crown className="mx-auto h-6 w-6 text-amber-200" />}
              {phase === "win" && <Trophy className="mx-auto h-7 w-7 text-amber-200" />}
              <div className="mt-2 font-mono text-[8px] font-black uppercase tracking-[.35em] text-white/45">
                {phase === "deal" ? "CARDS IN FLIGHT" : phase === "chips" ? "POT BUILDUP" : phase === "showdown" ? "SHOWDOWN" : "WINNER REVEAL"}
              </div>
              <div className="mt-1 font-display text-2xl tracking-[.15em] text-white">
                {phase === "deal" ? "DEAL" : phase === "chips" ? `${pot} CHIPS` : phase === "showdown" ? "REVEAL" : "CHMEL KING WINS"}
              </div>
              {phase === "win" && <div className="mt-1 font-mono text-xs font-black text-emerald-300">+{pot.toLocaleString("cs-CZ")} CHIPS</div>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "win" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.45, 0] }}
          transition={{ duration: 1.3, repeat: 2 }}
          className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,204,68,.2),transparent_45%)]"
        />
      )}
    </div>
  );
}
