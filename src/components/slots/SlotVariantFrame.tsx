import type { ReactNode } from "react";
import { Activity, Beer, CircleDollarSign, Flag, Gem, ShieldAlert, Sparkles, Trophy, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type SlotVariantId = "neon-pints" | "hop-highway" | "golden-chmel" | "cursed-kegs" | "stadium-legends";

type VariantMeta = {
  title: string;
  kicker: string;
  description: string;
  theme: string;
  glow: string;
  board: string;
  accent: string;
  tags: string[];
  feature: string;
  icon: typeof Beer;
  hud: string;
};

const VARIANTS: Record<SlotVariantId, VariantMeta> = {
  "neon-pints": { title: "NEON PINTS", kicker: "NEON CASCADE", description: "Cyber sportbar po zápase. Výhry se řetězí, světla blikají a každý další pád působí jako nový zásah.", theme: "from-cyan-500/25 via-emerald-400/10 to-[#02070b]", glow: "shadow-[0_0_80px_-28px_rgba(34,211,238,.95)]", board: "border-cyan-300/35 bg-[#03141a]", accent: "text-cyan-200", tags: ["CASCADES", "RESPIN", "HIGH VOL"], feature: "NEON BOOST", icon: Beer, hud: "from-cyan-400/15 via-emerald-300/5 to-transparent" },
  "hop-highway": { title: "HOP HIGHWAY", kicker: "BOOST CIRCUIT", description: "Futuristický závodní okruh. Dráhy, checkpointy a boostery dávají hře úplně jiný rytmus.", theme: "from-amber-400/25 via-orange-500/10 to-[#0b0702]", glow: "shadow-[0_0_80px_-28px_rgba(251,146,60,.95)]", board: "border-orange-300/35 bg-[#181006]", accent: "text-orange-200", tags: ["BOOST", "RESPIN", "MID VOL"], feature: "BOOST RUN", icon: Flag, hud: "from-orange-400/15 via-yellow-300/5 to-transparent" },
  "golden-chmel": { title: "GOLDEN CHMEL", kicker: "GOLD SERIES", description: "Prémiová sportovní gala aréna. Trofeje, diamantové momenty a velké násobitelové pulzy.", theme: "from-yellow-300/25 via-yellow-700/10 to-[#0c0801]", glow: "shadow-[0_0_90px_-26px_rgba(250,204,21,1)]", board: "border-yellow-300/40 bg-[#171306]", accent: "text-yellow-100", tags: ["MULTIPLIER", "BONUS", "HIGH VOL"], feature: "GOLDEN FRENZY", icon: Gem, hud: "from-yellow-300/15 via-amber-200/5 to-transparent" },
  "cursed-kegs": { title: "CURSED KEGS", kicker: "DARK CELLAR", description: "Zakletý stadionový sklep. Mystery sudy, temné symboly a agresivní wild řetězení.", theme: "from-fuchsia-500/25 via-purple-500/10 to-[#09020e]", glow: "shadow-[0_0_85px_-26px_rgba(217,70,239,.95)]", board: "border-fuchsia-300/35 bg-[#120817]", accent: "text-fuchsia-100", tags: ["WILD CHAIN", "MYSTERY", "EXTREME"], feature: "CURSED WILD", icon: ShieldAlert, hud: "from-fuchsia-400/15 via-purple-400/5 to-transparent" },
  "stadium-legends": { title: "STADIUM LEGENDS", kicker: "HALL OF FAME", description: "Velká arena pod světly. Legendární sportovní momenty, sticky wilds a free-spin jízda.", theme: "from-sky-400/25 via-blue-600/10 to-[#020a12]", glow: "shadow-[0_0_85px_-26px_rgba(56,189,248,.95)]", board: "border-sky-300/35 bg-[#06121d]", accent: "text-sky-100", tags: ["STICKY WILD", "FREE SPINS", "MID VOL"], feature: "LEGEND MULTIPLIER", icon: Trophy, hud: "from-sky-400/15 via-blue-300/5 to-transparent" },
};

function VariantDecor({ game }: { game: SlotVariantId }) {
  if (game === "neon-pints") return <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(90deg,transparent_0,rgba(34,211,238,.18)_1px,transparent_1px),linear-gradient(transparent_0,rgba(16,185,129,.12)_1px,transparent_1px)] [background-size:22px_22px]" />;
  if (game === "hop-highway") return <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(165deg,transparent_0,transparent_28px,rgba(251,146,60,.22)_29px,transparent_30px)]" />;
  if (game === "golden-chmel") return <div className="pointer-events-none absolute inset-0 rounded-[2rem] border-[10px] border-yellow-200/[0.03]" />;
  if (game === "cursed-kegs") return <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_20%_25%,rgba(217,70,239,.24),transparent_18%),radial-gradient(circle_at_80%_65%,rgba(124,58,237,.22),transparent_20%),linear-gradient(145deg,transparent_35%,rgba(20,4,28,.55)_70%)]" />;
  return <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(125,211,252,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,.12)_1px,transparent_1px)] [background-size:34px_34px]" />;
}

export function SlotVariantFrame({ game, children }: { game: SlotVariantId; children: ReactNode }) {
  const meta = VARIANTS[game];
  const Icon = meta.icon;
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.995 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={cn("relative overflow-hidden rounded-[2rem] border p-2 sm:p-4", meta.board, meta.glow)}>
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br", meta.theme)} />
      <VariantDecor game={game} />

      <div className="relative grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-end">
        <div className="rounded-2xl border border-white/10 bg-black/50 p-4 backdrop-blur-xl sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[.22em]", meta.accent)}>
              <Icon className="h-3.5 w-3.5" /> {meta.kicker}
            </span>
            <span className="rounded-full border border-hop-gold/20 bg-hop-gold/5 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[.18em] text-hop-gold/75">PLAY MONEY</span>
          </div>
          <h3 className="mt-2 font-display text-3xl tracking-[.14em] text-white sm:text-4xl">{meta.title}</h3>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-white/60 sm:text-sm">{meta.description}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">{meta.tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-black/25 px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[.14em] text-white/55">{tag}</span>)}</div>
        </div>

        <div className={cn("rounded-2xl border border-white/10 bg-gradient-to-br p-4 backdrop-blur-xl", meta.hud)}>
          <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[.22em] text-white/45"><Activity className="h-3.5 w-3.5" /> Herní režim</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/30 p-2"><Zap className="h-3.5 w-3.5 text-hop-gold" /><p className="mt-1 font-mono text-[7px] uppercase tracking-[.12em] text-white/40">Feature</p><p className="text-[9px] font-black text-white/75">{meta.feature}</p></div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-2"><CircleDollarSign className="h-3.5 w-3.5 text-hop-neon" /><p className="mt-1 font-mono text-[7px] uppercase tracking-[.12em] text-white/40">Měna</p><p className="text-[9px] font-black text-white/75">Slot CZK</p></div>
          </div>
        </div>
      </div>

      <div className="relative mt-3 rounded-[1.75rem] border border-white/10 bg-black/35 p-2 sm:p-3">{children}</div>
      <div className="relative mt-2 flex items-center justify-between px-1 font-mono text-[7px] uppercase tracking-[.18em] text-white/30"><span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> {meta.title}</span><span className="inline-flex items-center gap-1"><Trophy className="h-3 w-3" /> {meta.feature}</span></div>
    </motion.div>
  );
}
