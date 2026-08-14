import { useState } from "react";
import { Play, RefreshCw, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Match = {
  id: string;
  status: "READY" | "IN_PROGRESS" | "COMPLETED" | "ABANDONED";
  squad_version: number;
  opponent_name: string;
  opponent_ovr: number;
  user_score: number;
  opponent_score: number;
  reward_coins: number;
  reward_xp: number;
  result?: "WIN" | "DRAW" | "LOSS";
};

function errorText(error: unknown): string {
  const raw = String((error as { message?: string })?.message ?? error ?? "");
  if (raw.includes("squad_not_ready")) return "Sestava není připravená na zápas.";
  if (raw.includes("squad_changed_since_match_creation")) return "Sestava se od vytvoření zápasu změnila. Vytvoř nový zápas.";
  if (raw.includes("active_match_exists")) return "Už máš rozehraný FUT zápas.";
  if (raw.includes("match_not_in_progress")) return "Zápas není právě rozehraný.";
  if (raw.includes("club_not_found")) return "FUT klub nebyl nalezen.";
  return raw || "Operace se nepodařila.";
}

export function FutMatchPanel() {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      if (!match) return;
      const { data, error: rpcError } = await supabase.rpc("fc_match_get" as never, { _match_id: match.id } as never);
      if (rpcError) throw rpcError;
      setMatch(data as unknown as Match);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }

  async function createMatch() {
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("fc_match_create" as never, { _opponent_name: "Chmelová AI", _opponent_ovr: 75 } as never);
      if (rpcError) throw rpcError;
      setMatch(data as unknown as Match);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function startMatch() {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("fc_match_start" as never, { _match_id: match.id } as never);
      if (rpcError) throw rpcError;
      setMatch(data as unknown as Match);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function setScore(userScore: number, opponentScore: number) {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("fc_match_set_score" as never, {
        _match_id: match.id,
        _user_score: Math.max(0, userScore),
        _opponent_score: Math.max(0, opponentScore),
      } as never);
      if (rpcError) throw rpcError;
      setMatch(data as unknown as Match);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function completeMatch() {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc("fc_match_complete" as never, { _match_id: match.id } as never);
      if (rpcError) throw rpcError;
      setMatch(data as unknown as Match);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-primary/20 bg-background/50 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">FUT Match</p>
          <h2 className="font-display text-2xl uppercase tracking-[0.08em] text-primary">Zápasový režim</h2>
          <p className="mt-1 text-xs text-muted-foreground">Start a skóre jsou server-authoritative. Výhra při dokončení připíše reward do FUT klubu.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={!match || loading || busy} className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground disabled:opacity-40"><RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Obnovit</button>
      </div>

      {!match ? (
        <button type="button" onClick={() => void createMatch()} disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-40"><Play className="h-4 w-4" /> Vytvořit zápas</button>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Soupeř" value={`${match.opponent_name} · ${match.opponent_ovr} OVR`} />
            <Stat label="Stav" value={match.status === "IN_PROGRESS" ? "Probíhá" : match.status === "READY" ? "Připraven" : match.status} />
            <Stat label="Skóre" value={`${match.user_score} : ${match.opponent_score}`} />
          </div>

          {match.status === "READY" && (
            <button type="button" onClick={() => void startMatch()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary-foreground disabled:opacity-40"><Play className="h-4 w-4" /> Spustit zápas</button>
          )}

          {match.status === "IN_PROGRESS" && (
            <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
              <div className="grid grid-cols-2 gap-4">
                {["Ty", match.opponent_name].map((label, index) => {
                  const score = index === 0 ? match.user_score : match.opponent_score;
                  return <div key={label} className="text-center"><p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p><p className="mt-1 font-display text-5xl text-primary">{score}</p><div className="mt-3 flex justify-center gap-2"><button type="button" onClick={() => void setScore(index === 0 ? score - 1 : match.user_score, index === 1 ? score - 1 : match.opponent_score)} disabled={busy} className="h-10 w-10 rounded-full border border-border">−</button><button type="button" onClick={() => void setScore(index === 0 ? score + 1 : match.user_score, index === 1 ? score + 1 : match.opponent_score)} disabled={busy} className="h-10 w-10 rounded-full border border-primary/40 bg-primary/10 text-primary">+</button></div></div>;
                })}
              </div>
              <button type="button" onClick={() => void completeMatch()} disabled={busy} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-primary disabled:opacity-40"><Trophy className="h-4 w-4" /> Dokončit zápas a vyzvednout reward</button>
            </div>
          )}

          {match.status === "COMPLETED" && (
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-center"><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">Výsledek</p><p className="mt-1 font-display text-3xl text-primary">{match.result ?? (match.user_score > match.opponent_score ? "WIN" : match.user_score === match.opponent_score ? "DRAW" : "LOSS")}</p><p className="mt-2 text-sm text-muted-foreground">+{match.reward_coins} coins · +{match.reward_xp} XP</p><button type="button" onClick={() => setMatch(null)} className="mt-4 rounded-xl border border-border/60 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Nový zápas</button></div>
          )}
        </div>
      )}

      {error && <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-300">{error}</div>}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-border/60 bg-background/50 p-3"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary/70">{label}</p><p className="mt-1 text-sm font-semibold text-foreground">{value}</p></div>;
}
