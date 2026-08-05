import { motion } from "framer-motion";
import { formatKc } from "@/lib/slots";

export function BigWinOverlay({ amount, multiplier }: { amount: number; multiplier: number }) {
  const tier = multiplier >= 100 ? "MEGA WIN" : multiplier >= 50 ? "SUPER WIN" : "BIG WIN";
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/55" />
      <motion.div
        className="relative text-center"
        initial={{ scale: 0.3, rotate: -12 }}
        animate={{ scale: [0.3, 1.18, 1], rotate: [-12, 4, 0] }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      >
        <motion.h2
          className="font-display text-5xl tracking-[0.1em] slot-gold-text sm:text-7xl"
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.1, repeat: Infinity }}
          style={{ textShadow: "0 10px 40px rgba(255,204,68,0.6)" }}
        >
          {tier}
        </motion.h2>
        <p className="mt-2 font-display text-2xl text-hop-neon drop-shadow-[0_0_20px_rgba(77,255,166,0.8)] sm:text-4xl">
          {formatKc(amount)}
        </p>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.3em] text-hop-gold/90">
          {multiplier.toFixed(0)}x sázky
        </p>
      </motion.div>
    </motion.div>
  );
}
