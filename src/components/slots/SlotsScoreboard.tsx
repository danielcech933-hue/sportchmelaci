import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { hofFlame, type HofEntry } from "@/lib/slots";

interface ScoreboardProps { playerName: string; playerBest: number; compact?: boolean; }
type LeaderboardRow = { user_id: string; nickname: string; best_multiplier: number; spins: number; best_win: number };

export function SlotsScoreboard({ playerName, playerBest, compact }: ScoreboardProps) {
  const [rows, setRows] = useState<HofEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.rpc("slot_leaderboard", { _limit: 8 }).then(({ data, error }) => {
      if (!active) return;
      if (error || !Array.isArray(data)) { setRows([]); setLoading(false); return; }
      setRows(data.map((r: LeaderboardRow) => ({ name: r.nickname, multiplier: Number(r.best_multiplier) || 0, spins: Number(r.spins) || 0, bestWin: Number(r.best_win) || 0 })));
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const currentName = `${playerName} (ty)`;
  const fallback: HofEntry[] = rows.length ? rows : (playerBest > 0 ? [{ name: currentName, multiplier: playerBest }] : []);
  const sorted = [...fallback].sort((a, b) => b.multiplier - a.multiplier).slice(0, 8);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-hop-gold/35 bg-[linear-gradient(145deg,rgba(16,37,25,.96),rgba(2,9,5,.98))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_18px_50px_-25px_rgba(255,204,68,.7)] backdrop-blur-xl">
      <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-hop-gold/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div><p className="font-display text-sm tracking-[0.18em] slot-gold-text">CHMELOVCI CUP</p><p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-hop-neon/70">HALL OF FAME · skuteční hráči</p></div>
        <div className="rounded-lg border border-hop-gold/25 bg-black/30 px-2 py-1 text-center"><div className="font-mono text-[8px] uppercase tracking-widest text-hop-neon/60">TOP</div><div className="font-display text-sm slot-gold-text">{sorted[0]?.multiplier.toFixed(0) ?? 0}x</div></div>
      </div>
      {loading ? <div className="relative mt-4 rounded-xl border border-hop-gold/10 bg-black/20 px-3 py-5 text-center font-mono text-[9px] uppercase tracking-[.2em] text-hop-neon/50">Načítám hráče…</div> : sorted.length === 0 ? <div className="relative mt-4 rounded-xl border border-hop-gold/10 bg-black/20 px-3 py-5 text-center font-mono text-[9px] uppercase tracking-[.2em] text-hop-neon/50">Zatím žádná odehraná kola</div> : <ul className={`relative mt-3 space-y-1.5 ${compact ? "" : "sm:space-y-2"}`}>
        {sorted.map((r, i) => {
          const me = r.name === playerName || r.name === currentName;
          return <motion.li key={`${r.name}-${i}`} layout className={`flex items-center justify-between rounded-xl border px-2.5 py-1.5 text-xs ${me ? "border-hop-neon/60 bg-hop-neon/10 shadow-[0_0_18px_-10px_rgba(77,255,166,.9)]" : i === 0 ? "border-hop-gold/60 bg-hop-gold/10" : "border-hop-gold/15 bg-hop-950/60"}`}>
            <span className="flex min-w-0 items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-md border border-hop-gold/20 bg-black/25 font-mono text-[9px] text-hop-gold/80">{i + 1}</span><span className={`truncate ${me ? "font-bold text-hop-neon" : "text-foreground/90"}`}>{r.name}</span></span>
            <span className="ml-2 shrink-0 text-right"><span className="font-display text-sm slot-gold-text">{r.multiplier.toFixed(0)}x {hofFlame(r.multiplier)}</span>{r.spins ? <span className="ml-2 hidden font-mono text-[8px] text-hop-neon/50 sm:inline">{r.spins} spinů</span> : null}</span>
          </motion.li>;
        })}
      </ul>}
    </div>
  );
}
