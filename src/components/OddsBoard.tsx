import type { Match } from "@/lib/matches";
import {
  computeOdds,
  formatOdds,
  formatPct,
  poolTotals,
  projectedPayout,
  type MatchOdds,
  type SideStats,
} from "@/lib/odds";

/** Compact odds badge for list/card views. */
export function OddsPill({ match, history }: { match: Match; history: Match[] }) {
  if (match.endedAt) return null;
  const o = computeOdds(match, history);
  return (
    <span className="inline-flex flex-wrap items-center gap-1 font-mono text-[10px] uppercase tracking-[0.15em]">
      <span className="rounded border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-primary">
        {formatOdds(o.oddsA)}
      </span>
      <span className="text-muted-foreground">kurz</span>
      <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-accent">
        {formatOdds(o.oddsB)}
      </span>
    </span>
  );
}

function StatLine({ s }: { s: SideStats }) {
  if (s.games === 0) return <>Bez historie · základní kurz</>;
  return (
    <>
      {s.wins}V / {s.losses}P · {formatPct(s.winRate)} úspěšnost
      {s.sportGames > 0 && <> · {s.sportWins}/{s.sportGames} v tomto sportu</>}
    </>
  );
}

/** Full odds + prediction panel for the match detail view. */
export function OddsBoard({
  match,
  history,
  loading,
  betAmount = 0,
  betPick,
}: {
  match: Match;
  history: Match[];
  loading?: boolean;
  betAmount?: number;
  betPick?: "a" | "b";
}) {
  if (loading) {
    return (
      <section className="panel mt-6 p-4 text-center text-sm text-muted-foreground">
        Počítám kurzy…
      </section>
    );
  }

  const o: MatchOdds = computeOdds(match, history);
  const { a, b, pool } = poolTotals(match.bets ?? []);
  const nBets = (match.bets ?? []).length;
  const ended = !!match.endedAt;

  const side = (label: string, stats: SideStats, prob: number, odds: number, tone: "primary" | "accent", isFav: boolean) => (
    <div
      className={`rounded-lg border p-3 ${tone === "primary" ? "border-primary/40 bg-primary/5" : "border-accent/40 bg-accent/5"}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-display text-base">{label}</span>
        <span className={`font-mono text-2xl ${tone === "primary" ? "text-primary" : "text-accent"}`}>
          {formatOdds(odds)}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background/60">
        <div className={tone === "primary" ? "h-full bg-primary" : "h-full bg-accent"} style={{ width: `${prob * 100}%` }} />
      </div>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Šance {formatPct(prob)} {isFav && <span className="text-accent">· favorit</span>}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        <StatLine s={stats} />
      </p>
    </div>
  );

  const preview = betAmount > 0 && betPick && !ended
    ? {
        pari: projectedPayout(match.bets ?? [], betPick, betAmount),
        odds: Math.round(betAmount * (betPick === "a" ? o.oddsA : o.oddsB) * 100) / 100,
      }
    : null;

  return (
    <section className="panel neon-border mt-6 p-4 md:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl tracking-wider neon-text">📈 Kurzy a předpovědi</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Automatický model z historie hráčů{o.marketWeight > 0 && <> + {formatPct(o.marketWeight)} nálada sázejících</>}
          </p>
        </div>
        <span className="rounded border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Spolehlivost {formatPct(o.confidence)}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {side(match.teamA, o.statsA, o.probA, o.oddsA, "primary", o.favourite === "a")}
        {side(match.teamB, o.statsB, o.probB, o.oddsB, "accent", o.favourite === "b")}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Pool" value={`$${pool}`} />
        <Stat label="Sázek" value={String(nBets)} />
        <Stat label={match.teamA.slice(0, 10) || "A"} value={`$${a}`} />
        <Stat label={match.teamB.slice(0, 10) || "B"} value={`$${b}`} />
      </div>

      {preview && (
        <div className="mt-4 rounded-lg border border-accent/40 bg-accent/5 p-3 text-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Možná výhra</p>
          <p className="mt-1">
            ${betAmount} na <span className="font-semibold">{betPick === "a" ? match.teamA : match.teamB}</span> →{" "}
            <span className="font-mono text-accent">${preview.pari.toFixed(2)}</span> z aktuálního poolu
            <span className="text-muted-foreground"> · ${preview.odds.toFixed(2)} podle kurzu</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Výplata je pari-mutuel — konečná částka závisí na tom, kolik se do konce zápasu vsadí.
          </p>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2 text-center">
      <p className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="font-mono text-base text-primary">{value}</p>
    </div>
  );
}
