import { motion } from "framer-motion";
import { SLOT_SYMBOLS, type SymKey } from "@/lib/slots";

const TIER_STYLE: Record<string, string> = {
  low: "text-hop-gold drop-shadow-[0_0_10px_rgba(77,255,166,0.55)]",
  mid: "drop-shadow-[0_0_14px_rgba(77,255,166,0.6)]",
  high: "drop-shadow-[0_0_18px_rgba(255,204,68,0.85)]",
  special: "drop-shadow-[0_0_22px_rgba(255,204,68,0.95)]",
};

interface SlotSymbolProps {
  symbol: SymKey;
  size?: "sm" | "md" | "lg";
  winning?: boolean;
  dim?: boolean;
}

export function SlotSymbol({ symbol, size = "md", winning = false, dim = false }: SlotSymbolProps) {
  const def = SLOT_SYMBOLS[symbol];
  const isLetter = def.tier === "low";
  const fontSize = size === "lg" ? "text-5xl sm:text-6xl" : size === "sm" ? "text-2xl" : "text-4xl sm:text-5xl";

  return (
    <motion.div
      className={`flex h-full w-full select-none items-center justify-center ${dim ? "opacity-35" : ""}`}
      animate={
        winning
          ? { scale: [1, 1.22, 1.08, 1.18], rotate: [0, -3, 3, 0] }
          : { scale: 1, rotate: 0 }
      }
      transition={winning ? { duration: 0.75, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
    >
      <span
        className={`${fontSize} font-display leading-none ${TIER_STYLE[def.tier]} ${
          isLetter ? "slot-gold-text font-black tracking-tight" : ""
        }`}
        aria-label={def.label}
      >
        {def.glyph}
      </span>
    </motion.div>
  );
}
