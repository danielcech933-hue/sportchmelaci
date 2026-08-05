import { motion } from "framer-motion";
import { HOF_BOTS, hofFlame, type HofEntry } from "@/lib/slots";

interface ScoreboardProps {
  playerName: string;
  playerBest: number;
  compact?: boolean;
}

export function SlotsScoreboard({ playerName, playerBest, compact }: ScoreboardProps) {
  const rows: HofEntry[] = [...HOF_BOTS, { name: `${playerName} (ty)`, multiplier: playerBest }]
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, 8);

  return (
    <div className="rounded-2xl border border-hop-gold/35 bg-black/50 p-3 backdrop-blur-xl">
      <p className="font-display text-sm tracking-[0.18em] slot-gold-text">🏆 HALL OF FAME</p>
      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-hop-neon/70">
        Nejvyšší násobitel z jedné točky
      </p>
      <ul className={`mt-3 space-y-1.5 ${compact ? "" : "sm:space-y-2"}`}>
        {rows.map((r, i) => {
          const me = !r.bot;
          return (
            <motion.li
              key={r.name}
              layout
              className={`flex items-center justify-between rounded-xl border px-2.5 py-1.5 text-xs ${
                me
                  ? "border-hop-neon/60 bg-hop-neon/10"
                  : i === 0
                    ? "border-hop-gold/60 bg-hop-gold/10"
                    : "border-hop-gold/15 bg-hop-950/60"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="font-mono text-[10px] text-hop-gold/70">#{i + 1}</span>
                <span className={`truncate ${me ? "text-hop-neon" : "text-foreground/90"}`}>{r.name}</span>
              </span>
              <span className="ml-2 shrink-0 font-display text-sm slot-gold-text">
                {r.multiplier.toFixed(0)}x {hofFlame(r.multiplier)}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
