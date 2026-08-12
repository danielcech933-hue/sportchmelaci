import { useMemo } from "react";
import { motion } from "framer-motion";
import { SlotSymbol } from "./SlotSymbol";
import { makeStrip, type SymKey } from "@/lib/slots";

interface ReelProps {
  final: SymKey[];
  spinning: boolean;
  slow?: boolean;
  winningRows: number[];
  hasWin: boolean;
  reelIndex: number;
}

const ROWS = 3;

export function Reel({ final, spinning, slow, winningRows, hasWin, reelIndex }: ReelProps) {
  const strip = useMemo(() => {
    const half = makeStrip(7);
    return [...half, ...half];
  }, [spinning, reelIndex]);

  const safeFinal = final.slice(0, ROWS);
  const isWinningRow = (row: number) => winningRows.includes(row);

  return (
    <div
      className="relative min-w-0 flex-1 overflow-hidden rounded-[14px] border border-hop-gold/25 bg-[#020b06] shadow-[inset_0_0_35px_rgba(0,0,0,0.85),0_0_18px_rgba(255,204,68,0.08)]"
      data-reel-spinning={spinning ? "true" : "false"}
    >
      <div className="pointer-events-none absolute inset-0 z-30 rounded-[14px] ring-1 ring-inset ring-white/10" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-16 bg-gradient-to-b from-black/75 via-black/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-16 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="pointer-events-none absolute left-0 top-1/2 z-30 h-px w-2 bg-hop-gold shadow-[0_0_8px_rgba(255,204,68,0.9)]" />
      <div className="pointer-events-none absolute right-0 top-1/2 z-30 h-px w-2 bg-hop-gold shadow-[0_0_8px_rgba(255,204,68,0.9)]" />

      <div className="relative h-[16.5rem] overflow-hidden sm:h-[19.5rem]">
        {spinning ? (
          <motion.div
            key={`strip-${reelIndex}`}
            className="absolute inset-x-0 top-0 flex h-[400%] flex-col slot-blur"
            initial={{ y: "0%" }}
            animate={{ y: "-50%" }}
            transition={{ duration: slow ? 0.9 : 0.32, ease: "linear", repeat: Infinity }}
          >
            {strip.map((s, i) => (
              <div key={i} className="min-h-0 flex-1 py-0.5">
                <SlotSymbol symbol={s} />
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key={`final-${reelIndex}-${safeFinal.join("-")}`}
            className="absolute inset-0 grid grid-rows-3 overflow-hidden"
            initial={{ y: -34 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 620, damping: 16, mass: 0.7 }}
          >
            {Array.from({ length: ROWS }, (_, row) => (
              <div
                key={row}
                className={`relative min-h-0 overflow-hidden border-b border-white/[0.035] last:border-b-0 transition-all duration-300 ${
                  isWinningRow(row) ? "z-10 bg-hop-gold/[0.045]" : hasWin ? "opacity-45" : ""
                }`}
              >
                {safeFinal[row] ? (
                  <SlotSymbol
                    symbol={safeFinal[row]}
                    winning={isWinningRow(row)}
                    dim={hasWin && !isWinningRow(row)}
                  />
                ) : null}
                {isWinningRow(row) && (
                  <motion.div
                    className="pointer-events-none absolute inset-0 rounded-lg border border-hop-gold/70 shadow-[inset_0_0_18px_rgba(255,204,68,0.12),0_0_14px_rgba(255,204,68,0.15)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.35, 1, 0.35] }}
                    transition={{ duration: 1.15, repeat: Infinity }}
                  />
                )}
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {slow && spinning && (
        <div className="pointer-events-none absolute inset-0 z-10 slot-speedlines opacity-50" />
      )}
    </div>
  );
}
