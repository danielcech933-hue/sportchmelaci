import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type MatchRow = {
  id: string;
  status: "READY" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  opponent_name: string;
  opponent_ovr: number;
  user_score: number;
  opponent_score: number;
  reward_coins: number;
  reward_xp: number;
  completed_at: string | null;
};

export function FutMatchHistory() {
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("fc_matches" as never)
      .select("id,status,opponent_name,opponent_ovr,user_score,opponent_score,reward_coins,reward_xp,completed_at")
      .order("created_at", { ascending: false })
      .limit(20);

    if (queryError) {
      setError(queryError.message || "Historii zápasů se nepodařilo načíst.");
      setLoading(false);
      return;
    }

    setMatches((data ?? []) as unknown as MatchRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const completed = useMemo(() => matches.filter((m) => m.status === "COMPLETED"), [matches]);
  const stats = useMemo(() => {
    const wins = completed.filter((m) => m.user_score > m.opponent_score).length;
    const draws = completed.filter((m) => m.user_score === m.opponent_score).length;
    const losses = completed.length - wins - draws;
    return { wins, draws, losses };
  }, [completed]);

  return (
    <section className="rounded-3xl border border-primary/20 bg-background/50 p-4 sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">FUT Record</p>
          <h2 className="font-display text-2xl uppercase tracking-[0.08em] text-primary">Historie zápasů</h2>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground disabled:opacity-40">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Obnovit
        </button>
      </div>

      {error && <p className="mt-4 text-xs text-red-300">{error}</p>}

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <Stat label="Odehráno" value={String(completed.length)} />
        <Stat label="Výhry" value={String(stats.wins)} />
        <Stat label="Remízy" value={String(stats.draws)} />
        <Stat label="Prohry" value={String(stats.losses)} />
      </div>

      <div className="mt-4 space-y-2">
        {!loading && !completed.length && <p className="rounded-2xl border border-border/50 bg-background/40 p-4 text-sm text-muted-foreground">Zatím nemáš dokončený FUT zápas.</p>}
        {completed.map((m) => {
          const result = m.user_score > m.opponent_score ? "WIN" : m.user_score === m.opponent_score ? "DRAW" : "LOSS";
          return (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-background/40 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border", result === "WIN" ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground")}>
                  <Trophy className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">vs {m.opponent_name} · {m.opponent_ovr} OVR</p>
                  <p className="text-[11px] text-muted-foreground">{m.completed_at ? new Date(m.completed_at).toLocaleString("cs-CZ") : "Dokončeno"}</p>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className={cn("font-mono text-sm font-bold", result === "WIN" ? "text-primary" : "text-foreground")}>{result} · {m.user_score}:{m.opponent_score}</p>
                <p className="text-[11px] text-muted-foreground">+{m.reward_coins} coins · +{m.reward_xp} XP</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border/60 bg-background/50 p-3"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/70">{label}</p><p className="mt-1 text-lg font-semibold text-foreground">{value}</p></div>;
}
