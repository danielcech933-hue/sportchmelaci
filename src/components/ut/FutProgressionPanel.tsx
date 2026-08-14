import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Progression = {
  level: number;
  xp: number;
  required_xp: number;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  win_rate: number;
};

export function FutProgressionPanel() {
  const [progression, setProgression] = useState<Progression | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("fc_fut_progression_get" as never, {} as never);
      if (error) throw error;
      setProgression(data as unknown as Progression);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const progress = progression
    ? Math.min(100, Math.round((progression.xp / Math.max(1, progression.required_xp)) * 100))
    : 0;

  return (
    <section className="rounded-3xl border border-primary/20 bg-background/50 p-4 sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">FUT Progress</p>
          <h2 className="font-display text-2xl uppercase tracking-[0.08em] text-primary">Sezónní level</h2>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground disabled:opacity-40">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Obnovit
        </button>
      </div>

      {!progression ? (
        <p className="mt-4 text-sm text-muted-foreground">Načítám progres...</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Level</p>
              <p className="mt-1 font-display text-5xl text-primary">{progression.level}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">XP</p>
              <p className="mt-1 font-mono text-lg text-foreground">{progression.xp} / {progression.required_xp}</p>
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted/50">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Zápasy" value={progression.matches_played} />
            <Stat label="Výhry" value={progression.wins} />
            <Stat label="Remízy" value={progression.draws} />
            <Stat label="Prohry" value={progression.losses} />
          </div>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
            <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary/80"><Trophy className="h-4 w-4" /> Win rate</span>
            <span className="font-display text-2xl text-primary">{progression.win_rate}%</span>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-border/60 bg-background/50 p-3"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/70">{label}</p><p className="mt-1 font-display text-2xl text-foreground">{value}</p></div>;
}
