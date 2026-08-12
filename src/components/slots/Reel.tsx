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
    const half = makeStrip(6);
    return [...half, ...half];
  }, [spinning, reelIndex]);

  // The RPC contract is 5 reels × 3 rows. Never allow malformed data to
  // change the visual height of a reel or make symbols overflow the viewport.
  const safeFinal = final.slice(0, ROWS);

  return (
    <div
      className="relative min-w-0 flex-1 overflow-hidden rounded-xl slot-cell"
      data-reel-spinning={spinning ? "true" : "false"}
    >
      <div className="pointer-events-none absolute inset-0 z-20 rounded-xl ring-1 ring-hop-gold/20" />

      <div className="relative h-[16.5rem] sm:h-[19.5rem] overflow-hidden">
        {spinning ? (
          <motion.div
            key={`strip-${reelIndex}`}
            className="absolute inset-x-0 top-0 flex h-[400%] flex-col slot-blur"
            initial={{ y: "0%" }}
            animate={{ y: "-50%" }}
            transition={{ duration: slow ? 0.9 : 0.32, ease: "linear", repeat: Infinity }}
          >
            {strip.map((s, i) => (
              <div key={i} className="min-h-0 flex-1">
                <SlotSymbol symbol={s} />
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key={`final-${reelIndex}-${safeFinal.join("-")}`}
            className="absolute inset-0 grid grid-rows-3 overflow-hidden"
            initial={{ y: -26 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 620, damping: 16, mass: 0.7 }}
          >
            {Array.from({ length: ROWS }, (_, row) => (
              <div key={row} className="min-h-0 overflow-hidden">
                {safeFinal[row] ? (
                  <SlotSymbol
                    symbol={safeFinal[row]}
                    winning={winningRows.includes(row)}
                    dim={hasWin && !winningRows.includes(row)}
                  />
                ) : null}
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {slow && spinning && (
        <div className="pointer-events-none absolute inset-0 z-10 slot-speedlines opacity-40" />
      )}
    </div>
  );
}
