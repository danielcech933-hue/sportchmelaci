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
      className="group relative min-w-0 flex-1 overflow-hidden rounded-[18px] border border-[#b8860b]/45 bg-[#020906] shadow-[inset_0_0_42px_rgba(0,0,0,.9),0_0_24px_rgba(255,204,68,.08)]"
      data-reel-spinning={spinning ? "true" : "false"}
    >
      <div className="pointer-events-none absolute inset-0 z-40 rounded-[18px] ring-1 ring-inset ring-[#fff3bf]/10" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-14 bg-gradient-to-b from-[#010403] via-[#03150a]/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-14 bg-gradient-to-t from-[#010403] via-[#03150a]/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-1 top-1/2 z-40 h-px bg-gradient-to-r from-transparent via-[#ffd65a]/75 to-transparent shadow-[0_0_9px_rgba(255,204,68,.8)]" />
      <div className="pointer-events-none absolute left-0 top-1/2 z-40 -translate-y-1/2 border-y-[5px] border-l-[8px] border-y-transparent border-l-[#ffd65a] drop-shadow-[0_0_5px_rgba(255,204,68,.8)]" />
      <div className="pointer-events-none absolute right-0 top-1/2 z-40 -translate-y-1/2 border-y-[5px] border-r-[8px] border-y-transparent border-r-[#ffd65a] drop-shadow-[0_0_5px_rgba(255,204,68,.8)]" />

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
              <div key={i} className="min-h-0 flex-1 border-b border-white/[0.025] py-0.5">
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
                className={`relative min-h-0 overflow-hidden border-b border-[#d5a62f]/[0.09] last:border-b-0 transition-all duration-300 ${
                  isWinningRow(row) ? "z-10 bg-[#ffd34f]/[0.055]" : hasWin ? "opacity-45" : ""
                }`}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(31,132,69,.12),transparent_65%)]" />
                {safeFinal[row] ? (
                  <SlotSymbol
                    symbol={safeFinal[row]}
                    winning={isWinningRow(row)}
                    dim={hasWin && !isWinningRow(row)}
                  />
                ) : null}
                {isWinningRow(row) && (
                  <motion.div
                    className="pointer-events-none absolute inset-1 rounded-xl border border-[#ffe38a]/75 shadow-[inset_0_0_22px_rgba(255,204,68,.13),0_0_18px_rgba(255,204,68,.18)]"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.15, repeat: Infinity }}
                  />
                )}
              </div>
            ))}
          </motion.div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-2 bottom-1 z-40 h-px bg-gradient-to-r from-transparent via-[#ffd65a]/30 to-transparent" />
      {slow && spinning && (
        <div className="pointer-events-none absolute inset-0 z-20 slot-speedlines opacity-60" />
      )}
    </div>
  );
}
