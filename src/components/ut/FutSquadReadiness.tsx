import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Readiness = {
  ready: boolean;
  squad_id: string;
  formation: string;
  starting_xi: number;
  bench: number;
  reserves: number;
  captain_count: number;
  version: number;
  issues: string[];
};

function message(code: string) {
  const map: Record<string, string> = {
    invalid_formation: "Formace není podporovaná.",
    invalid_starting_xi: "Základní sestava musí mít přesně 11 hráčů.",
    invalid_bench_count: "Na lavičce je příliš mnoho hráčů.",
    invalid_reserve_count: "V rezervě je příliš mnoho hráčů.",
    invalid_captain: "Musí být právě jeden kapitán ze základní sestavy.",
    invalid_role: "Sestava obsahuje neplatnou roli hráče.",
    invalid_slot: "Sestava obsahuje neplatný slot.",
    duplicate_card: "Stejná karta je v sestavě vícekrát.",
    squad_not_found: "Aktivní sestava nebyla nalezena.",
  };
  return map[code] ?? code.replaceAll("_", " ");
}

export function FutSquadReadiness() {
  const [state, setState] = useState<Readiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: squad, error: squadError } = await supabase.rpc("fc_squad_get_active" as never, {} as never);
      if (squadError) throw squadError;
      if (!squad) {
        setState(null);
        return;
      }

      const { data, error: readinessError } = await supabase.rpc("fc_squad_match_readiness" as never, { _squad_id: (squad as { id: string }).id } as never);
      if (readinessError) throw readinessError;
      setState(data as unknown as Readiness);
    } catch (e) {
      setError(String((e as { message?: string })?.message ?? e ?? "Nepodařilo se ověřit sestavu."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  if (loading) {
    return <div className="rounded-2xl border border-primary/15 bg-background/40 px-4 py-3 text-xs text-muted-foreground">Ověřuji připravenost sestavy…</div>;
  }

  if (error) {
    return <div className="rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger"><div className="flex items-center justify-between gap-3"><span>{error}</span><button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest underline"><RefreshCw className="h-3 w-3" /> Znovu</button></div></div>;
  }

  if (!state) return null;

  const issues = (state.issues ?? []).map(message);

  return (
    <div className={cn("mb-4 rounded-2xl border px-4 py-3", state.ready ? "border-emerald-300/25 bg-emerald-300/5" : "border-amber-300/25 bg-amber-300/5")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {state.ready ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <ShieldAlert className="h-4 w-4 text-amber-300" />}
          <span className="font-mono text-[10px] uppercase tracking-[0.28em]">Předzápasová kontrola · {state.ready ? "Připraveno" : "Není připraveno"}</span>
        </div>
        <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary"><RefreshCw className="h-3 w-3" /> Obnovit</button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-5">
        <span>XI <b className="text-foreground">{state.starting_xi}/11</b></span>
        <span>Lavička <b className="text-foreground">{state.bench}/7</b></span>
        <span>Rezervy <b className="text-foreground">{state.reserves}/5</b></span>
        <span>Kapitán <b className="text-foreground">{state.captain_count}/1</b></span>
        <span>Formace <b className="text-foreground">{state.formation}</b></span>
      </div>
      {!state.ready && issues.length > 0 && <div className="mt-2 space-y-1 text-[11px] text-amber-100/80">{issues.map((issue) => <div key={issue}>• {issue}</div>)}</div>}
    </div>
  );
}
