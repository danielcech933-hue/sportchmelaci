import { useState } from "react";
import { motion } from "framer-motion";
import { formatKc } from "@/lib/slots";

export interface BonusOption {
  spins: number;
  mult: number;
}

export function BonusPickModal({
  options,
  onConfirm,
}: {
  options: BonusOption[];
  onConfirm: (opt: BonusOption) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/85 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={{ scaleY: 0, opacity: 0.9 }}
        animate={{ scaleY: 1, opacity: 0 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        style={{
          transformOrigin: "bottom",
          background: "linear-gradient(0deg, #ff7a18, #ffcc44 45%, transparent 80%)",
        }}
      />
      <div className="relative w-full max-w-xl rounded-2xl slot-frame p-5 text-center sm:p-8">
        <motion.h2
          className="font-display text-2xl tracking-[0.16em] slot-gold-text sm:text-4xl"
          initial={{ scale: 0.6, rotate: -6 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 12 }}
        >
          CHMELOVÉ ŠÍLENSTVÍ
        </motion.h2>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.26em] text-hop-neon/80">
          Vyber jeden zlatý půllitr
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {options.map((o, i) => {
            const isPicked = picked === i;
            return (
              <motion.button
                key={i}
                disabled={picked !== null}
                onClick={() => {
                  setPicked(i);
                  window.setTimeout(() => onConfirm(o), 1500);
                }}
                whileHover={picked === null ? { scale: 1.06, rotate: -2 } : undefined}
                whileTap={{ scale: 0.94 }}
                animate={
                  picked === null
                    ? { y: [0, -6, 0] }
                    : isPicked
                      ? { scale: 1.12, y: 0 }
                      : { opacity: 0.25, scale: 0.94 }
                }
                transition={picked === null ? { duration: 1.8, repeat: Infinity, delay: i * 0.2 } : { duration: 0.4 }}
                className="rounded-2xl border border-hop-gold/50 bg-hop-950/80 p-4"
              >
                <span className="block text-5xl drop-shadow-[0_0_18px_rgba(255,204,68,0.9)]">🍺</span>
                {isPicked ? (
                  <motion.span
                    className="mt-2 block font-display text-sm slot-gold-text"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {o.spins} spinů
                    <br />
                    {o.mult}x
                  </motion.span>
                ) : (
                  <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.18em] text-hop-neon/70">
                    ???
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export function BonusRecapModal({ total, spins, mult, onClose }: { total: number; spins: number; mult: number; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full max-w-lg rounded-2xl slot-frame p-6 text-center"
        initial={{ scale: 0.7, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 240, damping: 14 }}
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-hop-neon/80">Bonus dokončen</p>
        <h2 className="mt-2 font-display text-3xl tracking-[0.12em] slot-gold-text sm:text-5xl">{formatKc(total)}</h2>
        <p className="mt-2 text-xs text-foreground/80">
          {spins} free spinů · globální násobitel {mult}x
        </p>
        <button
          onClick={onClose}
          className="mt-5 rounded-full border border-hop-gold/60 bg-hop-gold/15 px-6 py-2 font-display text-sm uppercase tracking-[0.2em] text-hop-gold"
        >
          Přidat do zůstatku
        </button>
      </motion.div>
    </motion.div>
  );
}
