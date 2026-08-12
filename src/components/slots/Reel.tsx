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
const CELL_HEIGHT = 100 / ROWS;

export function Reel({ final, spinning, slow, winningRows, hasWin, reelIndex }: ReelProps) {
  const strip = useMemo(() => {
    const base = makeStrip(18);
    return [...base, ...base, ...base];
  }, [reelIndex, spinning]);

  const safeFinal = final.slice(0, ROWS);
  const isWinningRow = (row: number) => winningRows.includes(row);
  const spinDuration = slow ? 0.62 : 0.34;
  const reelDelay = reelIndex * 0.035;

  return (
    <div
      className="group relative min-w-0 flex-1 overflow-hidden rounded-[18px] border border-[#b8860b]/45 bg-[#020906] shadow-[inset_0_0_42px_rgba(0,0,0,.9),0_0_24px_rgba(255,204,68,.08)]"
      data-reel-spinning={spinning ? "true" : "false"}
      data-reel-index={reelIndex}
    >
      <div className="pointer-events-none absolute inset-0 z-40 rounded-[18px] ring-1 ring-inset ring-[#fff3bf]/10" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-16 bg-gradient-to-b from-[#010403] via-[#03150a]/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-16 bg-gradient-to-t from-[#010403] via-[#03150a]/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-1 top-1/2 z-40 h-px bg-gradient-to-r from-transparent via-[#ffd65a]/80 to-transparent shadow-[0_0_10px_rgba(255,204,68,.85)]" />
      <div className="pointer-events-none absolute left-0 top-1/2 z-40 -translate-y-1/2 border-y-[6px] border-l-[9px] border-y-transparent border-l-[#ffd65a] drop-shadow-[0_0_6px_rgba(255,204,68,.9)]" />
      <div className="pointer-events-none absolute right-0 top-1/2 z-40 -translate-y-1/2 border-y-[6px] border-r-[9px] border-y-transparent border-r-[#ffd65a] drop-shadow-[0_0_6px_rgba(255,204,68,.9)]" />

      <div className="relative h-[16.5rem] overflow-hidden sm:h-[19.5rem]">
        {spinning ? (
          <motion.div
            key={`strip-${reelIndex}`}
            className="absolute inset-x-0 top-0 flex flex-col slot-blur"
            style={{ height: `${strip.length * CELL_HEIGHT}%` }}
            initial={{ y: "0%" }}
            animate={{ y: "-66.6667%" }}
            transition={{ duration: spinDuration, ease: "linear", repeat: Infinity, repeatType: "loop", delay: reelDelay }}
          >
            {strip.map((symbol, index) => (
              <div key={`${reelIndex}-${index}`} className="h-[3.7037%] min-h-0 shrink-0 border-b border-white/[0.025]">
                <SlotSymbol symbol={symbol} />
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key={`final-${reelIndex}-${safeFinal.join("-")}`}
            className="absolute inset-0 grid grid-rows-3 overflow-hidden"
            initial={{ y: -46, opacity: 0.72 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 19, mass: 0.62 }}
          >
            {Array.from({ length: ROWS }, (_, row) => (
              <div
                key={row}
                className={`relative min-h-0 overflow-hidden border-b border-[#d5a62f]/[0.09] last:border-b-0 transition-all duration-300 ${isWinningRow(row) ? "z-10 bg-[#ffd34f]/[0.055]" : hasWin ? "opacity-45" : ""}`}
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(31,132,69,.12),transparent_65%)]" />
                {safeFinal[row] ? <SlotSymbol symbol={safeFinal[row]} winning={isWinningRow(row)} dim={hasWin && !isWinningRow(row)} /> : null}
                {isWinningRow(row) && (
                  <motion.div
                    className="pointer-events-none absolute inset-1 rounded-xl border border-[#ffe38a]/75 shadow-[inset_0_0_22px_rgba(255,204,68,.13),0_0_18px_rgba(255,204,68,.18)]"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: [0.35, 1, 0.35], scale: [0.98, 1, 0.98] }}
                    transition={{ duration: 1.05, repeat: Infinity }}
                  />
                )}
              </div>
            ))}
          </motion.div>
        )}
      </div>

      <div className="pointer-events-none absolute inset-x-2 bottom-1 z-40 h-px bg-gradient-to-r from-transparent via-[#ffd65a]/30 to-transparent" />
      {slow && spinning && <div className="pointer-events-none absolute inset-0 z-20 slot-speedlines opacity-60" />}
      {spinning && <div className="pointer-events-none absolute inset-x-0 top-1/2 z-30 h-16 -translate-y-1/2 bg-gradient-to-b from-transparent via-white/[0.025] to-transparent" />}
    </div>
  );
}
