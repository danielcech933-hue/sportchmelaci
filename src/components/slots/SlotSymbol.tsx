import { motion } from "framer-motion";
import { Beer, CircleDot, Footprints, Medal, Megaphone, Trophy } from "lucide-react";
import { SLOT_SYMBOLS, type SymKey } from "@/lib/slots";

interface SlotSymbolProps {
  symbol: SymKey;
  size?: "sm" | "md" | "lg";
  winning?: boolean;
  dim?: boolean;
}

const ICONS: Partial<Record<SymKey, typeof Trophy>> = {
  whistle: Megaphone,
  boots: Footprints,
  silver: Medal,
  gold: Trophy,
  wild: CircleDot,
  scatter: Beer,
};

const PALETTE: Record<SymKey, { card: string; icon: string; glow: string }> = {
  ten: { card: "from-slate-800 to-slate-950 border-slate-500/30", icon: "text-slate-200", glow: "shadow-slate-500/20" },
  j: { card: "from-slate-800 to-slate-950 border-slate-500/30", icon: "text-slate-200", glow: "shadow-slate-500/20" },
  q: { card: "from-slate-800 to-slate-950 border-slate-500/30", icon: "text-slate-200", glow: "shadow-slate-500/20" },
  k: { card: "from-slate-800 to-slate-950 border-slate-500/30", icon: "text-slate-200", glow: "shadow-slate-500/20" },
  a: { card: "from-emerald-950 to-slate-950 border-emerald-400/30", icon: "text-emerald-300", glow: "shadow-emerald-400/20" },
  whistle: { card: "from-emerald-900 to-slate-950 border-emerald-300/40", icon: "text-emerald-300", glow: "shadow-emerald-400/30" },
  boots: { card: "from-lime-950 to-slate-950 border-lime-300/40", icon: "text-lime-300", glow: "shadow-lime-400/30" },
  silver: { card: "from-slate-700 to-slate-950 border-slate-200/45", icon: "text-slate-100", glow: "shadow-slate-100/30" },
  gold: { card: "from-amber-900 to-slate-950 border-amber-300/60", icon: "text-amber-300", glow: "shadow-amber-300/40" },
  wild: { card: "from-amber-950 via-yellow-900 to-emerald-950 border-amber-300/80", icon: "text-yellow-200", glow: "shadow-yellow-300/60" },
  scatter: { card: "from-emerald-950 via-green-900 to-amber-950 border-hop-gold/70", icon: "text-hop-gold", glow: "shadow-hop-gold/50" },
};

const SIZE: Record<NonNullable<SlotSymbolProps["size"]>, { icon: string; text: string; badge: string }> = {
  sm: { icon: "h-7 w-7", text: "text-lg", badge: "text-[7px]" },
  md: { icon: "h-10 w-10 sm:h-12 sm:w-12", text: "text-2xl sm:text-3xl", badge: "text-[8px] sm:text-[9px]" },
  lg: { icon: "h-14 w-14", text: "text-4xl", badge: "text-[10px]" },
};

export function SlotSymbol({ symbol, size = "md", winning = false, dim = false }: SlotSymbolProps) {
  const def = SLOT_SYMBOLS[symbol];
  const palette = PALETTE[symbol];
  const Icon = ICONS[symbol];
  const sizeDef = SIZE[size];
  const isRank = !Icon;

  return (
    <motion.div
      className={`relative flex h-full w-full items-center justify-center p-1.5 sm:p-2 ${dim ? "opacity-25" : ""}`}
      animate={winning ? { scale: [1, 1.12, 1.04, 1.1], y: [0, -2, 0, -1] } : { scale: 1, y: 0 }}
      transition={winning ? { duration: 0.72, repeat: Infinity, ease: "easeInOut" } : { duration: 0.18 }}
      aria-label={def.label}
    >
      <div
        className={`relative flex h-full w-full min-h-0 items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-br ${palette.card} shadow-lg ${palette.glow}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_35%_20%,rgba(255,255,255,0.18),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/10" />

        {isRank ? (
          <span className={`${sizeDef.text} relative z-10 font-black italic tracking-tight text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.8)]`}>
            {def.glyph}
          </span>
        ) : (
          <Icon className={`relative z-10 ${sizeDef.icon} ${palette.icon} drop-shadow-[0_3px_6px_rgba(0,0,0,0.75)]`} strokeWidth={2.2} />
        )}

        <span className={`absolute bottom-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap font-black uppercase tracking-[0.16em] text-white/65 ${sizeDef.badge}`}>
          {symbol === "wild" ? "WILD" : symbol === "scatter" ? "SCATTER" : def.label}
        </span>

        {winning && (
          <motion.div
            className="pointer-events-none absolute inset-0 rounded-xl border-2 border-amber-200/80"
            animate={{ opacity: [0.25, 1, 0.35], boxShadow: ["0 0 0px rgba(255,204,68,0)", "0 0 24px rgba(255,204,68,0.8)", "0 0 8px rgba(255,204,68,0.3)"] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        )}
      </div>
    </motion.div>
  );
}
