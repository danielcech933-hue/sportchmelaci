import { useState } from "react";
import { SPORTS, type Match, type SetScore } from "@/lib/matches";
import { adminOverrideScore } from "@/lib/matches-db";
import { Pencil, Save, X } from "lucide-react";

/**
 * Admin-only final score override. Saving triggers a server-side recalculation
 * of the affected players' stats / ELO and the leaderboards.
 */
export function AdminScoreOverride({ match, onSaved }: { match: Match; onSaved: () => void }) {
  const cfg = SPORTS[match.sport];
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(match.scoreA);
  const [b, setB] = useState(match.scoreB);
  const [sets, setSets] = useState<SetScore[]>(match.sets ?? []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await adminOverrideScore(match.id, { scoreA: a, scoreB: b, sets: cfg.hasSets ? sets : undefined });
      setOpen(false);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Uložení selhalo");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-primary/40 px-3 py-2 text-sm text-primary transition hover:bg-primary/10"
      >
        <span className="inline-flex items-center gap-1.5"><Pencil className="h-3.5 w-3.5" /> Upravit skóre</span>
      </button>
    );
  }

  const num = "w-16 rounded-md border border-primary/30 bg-background/70 px-2 py-1 text-center font-mono text-sm";

  return (
    <div className="w-full rounded-xl border border-primary/40 bg-background/70 p-3 neon-box-gold">
      <div className="text-[10px] uppercase tracking-[0.25em] text-primary/80">// Admin override 🛠️🤖</div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="truncate">{match.teamA}</span>
        <input type="number" className={num} value={a} onChange={(e) => setA(Number(e.target.value))} />
        <span className="text-muted-foreground">:</span>
        <input type="number" className={num} value={b} onChange={(e) => setB(Number(e.target.value))} />
        <span className="truncate">{match.teamB}</span>
      </div>
      {cfg.hasSets && (
        <div className="mt-2 flex flex-wrap gap-2">
          {sets.map((s, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md border border-primary/20 px-1.5 py-1">
              <span className="text-[10px] uppercase text-muted-foreground">{cfg.setLabel} {i + 1}</span>
              <input
                type="number"
                className="w-12 bg-transparent text-center font-mono text-sm"
                value={s.a}
                onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, a: Number(e.target.value) } : x)))}
              />
              <span className="text-muted-foreground">–</span>
              <input
                type="number"
                className="w-12 bg-transparent text-center font-mono text-sm"
                value={s.b}
                onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, b: Number(e.target.value) } : x)))}
              />
            </span>
          ))}
          <button
            onClick={() => setSets([...sets, { a: 0, b: 0 }])}
            className="rounded-md border border-primary/25 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            + {cfg.setLabel}
          </button>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" /> Uložit a přepočítat
        </button>
        <button
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/25 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" /> Zrušit
        </button>
      </div>
    </div>
  );
}
