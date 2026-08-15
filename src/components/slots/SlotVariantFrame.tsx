import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type SlotVariantId = "neon-pints" | "hop-highway" | "golden-chmel" | "cursed-kegs" | "stadium-legends";

const VARIANTS: Record<SlotVariantId, { kicker: string; description: string; theme: string; glow: string; tags: string[]; board: string; title: string }> = {
  "neon-pints": { kicker: "NEON CASCADE", description: "Cyber sportbar v noci. Série symbolů exploduje a uvolňuje prostor pro další pád.", theme: "from-cyan-500/25 via-emerald-400/10 to-black", glow: "shadow-[0_0_55px_-20px_rgba(34,211,238,.9)]", tags: ["CASCADES", "RESPIN", "HIGH VOL"], board: "border-cyan-300/35 bg-[#03141a]", title: "NEON PINTS" },
  "hop-highway": { kicker: "BOOST CIRCUIT", description: "Futuristický závodní okruh. Boost symboly zvyšují napětí a aktivují rychlé respiny.", theme: "from-amber-400/25 via-orange-500/10 to-black", glow: "shadow-[0_0_55px_-20px_rgba(251,191,36,.9)]", tags: ["BOOST", "RESPIN", "MID VOL"], board: "border-amber-300/35 bg-[#181006]", title: "HOP HIGHWAY" },
  "golden-chmel": { kicker: "GOLD SERIES", description: "Prémiový stadion plný trofejí. Zvláštní symboly se mění na násobitele během bonusu.", theme: "from-yellow-300/25 via-yellow-700/10 to-black", glow: "shadow-[0_0_55px_-20px_rgba(250,204,21,.9)]", tags: ["MULTIPLIER", "BONUS", "HIGH VOL"], board: "border-yellow-300/35 bg-[#171306]", title: "GOLDEN CHMEL" },
  "cursed-kegs": { kicker: "DARK CELLAR", description: "Temný sklep pod stadionem. Prokleté sudy mění sousední symboly na wild a řetězí výhry.", theme: "from-fuchsia-500/25 via-purple-500/10 to-black", glow: "shadow-[0_0_55px_-20px_rgba(217,70,239,.9)]", tags: ["WILD CHAIN", "MYSTERY", "EXTREME"], board: "border-fuchsia-300/35 bg-[#120817]", title: "CURSED KEGS" },
  "stadium-legends": { kicker: "HALL OF FAME", description: "Velká sportovní aréna. Legendární symboly mohou zůstat na místě a pomáhat v dalších spínech.", theme: "from-sky-400/25 via-blue-600/10 to-black", glow: "shadow-[0_0_55px_-20px_rgba(56,189,248,.9)]", tags: ["STICKY WILD", "FREE SPINS", "MID VOL"], board: "border-sky-300/35 bg-[#06121d]", title: "STADIUM LEGENDS" },
};

export function SlotVariantFrame({ game, children }: { game: SlotVariantId; children: ReactNode }) {
  const meta = VARIANTS[game];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("relative overflow-hidden rounded-[2rem] border p-3 sm:p-5", meta.board, meta.glow)}>
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", meta.theme)} />
      <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:28px_28px]" />
      <div className="relative mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur-xl sm:flex-row sm:items-end sm:justify-between">
        <div><div className="font-mono text-[9px] font-black uppercase tracking-[.28em] text-hop-neon/80">{meta.kicker}</div><h3 className="mt-1 font-display text-2xl tracking-[.12em] text-white sm:text-3xl">{meta.title}</h3><p className="mt-2 max-w-2xl text-xs leading-relaxed text-white/60">{meta.description}</p></div>
        <div className="flex flex-wrap gap-1.5">{meta.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-white/[.04] px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[.14em] text-white/55">{tag}</span>)}</div>
      </div>
      <div className="relative rounded-[1.75rem] border border-white/10 bg-black/35 p-2 sm:p-3">{children}</div>
    </motion.div>
  );
}
