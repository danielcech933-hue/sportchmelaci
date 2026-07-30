import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SPORTS, type Match, betsPool } from "@/lib/matches";
import {
  computeStandings,
  fetchTournament,
  type Tournament,
  type TournamentTeam,
} from "@/lib/tournaments-db";

export const Route = createFileRoute("/tournament")({
  validateSearch: (s: Record<string, unknown>) => ({ id: String(s.id ?? "") }),
  head: () => ({
    meta: [
      { title: "Detail turnaje — Chmeloví Sportovci" },
      { name: "description", content: "Rozpis zápasů, tabulka a turnajový pavouk s možností sázet na jednotlivé duely." },
      { property: "og:title", content: "Detail turnaje — Chmeloví Sportovci" },
      { property: "og:description", content: "Rozpis, tabulka, pavouk a sázky na duely turnaje." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TournamentDetail,
});

function TournamentDetail() {
  const { id } = Route.useSearch();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchTournament(id)
      .then((r) => {
        if (!alive) return;
        setTournament(r.tournament);
        setTeams(r.teams);
        setMatches(r.matches);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  if (loading) return <main className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Loading…</main>;
  if (!tournament)
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Turnaj nenalezen.</p>
        <Link to="/tournaments" className="mt-3 inline-block text-sm text-primary">← Zpět na turnaje</Link>
      </main>
    );

  const cfg = SPORTS[tournament.sport];
  const rounds = Array.from(new Set(matches.map((m) => m.round ?? 1))).sort((a, b) => a - b);

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-background/40 p-6 md:p-10">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="scanline pointer-events-none absolute inset-0" />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-accent">
            {cfg?.emoji} {cfg?.name} · {tournament.format === "round_robin" ? "KAŽDÝ S KAŽDÝM" : "PAVOUK"}
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-widest neon-text md:text-5xl">{tournament.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {teams.length} týmů · {matches.length} zápasů · sázky max $250, jedna na hráče
          </p>
          <Link to="/tournaments" className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            ← všechny turnaje
          </Link>
        </div>
      </div>

      {tournament.format === "round_robin" ? (
        <section className="panel neon-border mt-6 overflow-x-auto p-4">
          <h2 className="mb-3 font-display text-xl tracking-wider neon-text">📊 Tabulka</h2>
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <th className="py-2 text-left">#</th>
                <th className="py-2 text-left">Tým</th>
                <th className="py-2 text-right">Z</th>
                <th className="py-2 text-right">V</th>
                <th className="py-2 text-right">P</th>
                <th className="py-2 text-right">Skóre</th>
                <th className="py-2 text-right">Body</th>
              </tr>
            </thead>
            <tbody>
              {computeStandings(teams, matches).map((r, i) => (
                <tr key={r.name} className="border-t border-primary/10">
                  <td className="py-2 font-mono text-primary">{i + 1}</td>
                  <td className="py-2 font-semibold">{r.name}</td>
                  <td className="py-2 text-right font-mono">{r.played}</td>
                  <td className="py-2 text-right font-mono text-primary">{r.won}</td>
                  <td className="py-2 text-right font-mono">{r.lost}</td>
                  <td className="py-2 text-right font-mono">{r.scoreFor}:{r.scoreAgainst}</td>
                  <td className="py-2 text-right font-mono text-accent">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="mt-6 overflow-x-auto">
          <h2 className="mb-3 font-display text-xl tracking-wider neon-text">🕸️ Pavouk</h2>
          <div className="flex min-w-max gap-4">
            {rounds.map((r) => (
              <div key={r} className="flex w-64 flex-col justify-around gap-3">
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Kolo {r}</p>
                {matches.filter((m) => (m.round ?? 1) === r).map((m) => <MatchCard key={m.id} m={m} compact />)}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl tracking-wider neon-text">🗓️ Rozpis zápasů</h2>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Zatím žádné zápasy.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {matches.map((m) => <MatchCard key={m.id} m={m} />)}
          </div>
        )}
      </section>
    </main>
  );
}

function MatchCard({ m, compact }: { m: Match; compact?: boolean }) {
  const pool = betsPool(m.bets ?? []);
  const ended = !!m.endedAt;
  return (
    <Link to="/match" search={{ id: m.id }} className="panel neon-border block p-3 transition hover:brightness-110">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.3em]">
        <span className="text-muted-foreground">
          {m.round ? `R${m.round}` : ""}{m.slot != null ? `·${m.slot + 1}` : ""}
        </span>
        <span className={ended ? "text-accent" : "text-primary"}>{ended ? "HOTOVO" : "SÁZKY OTEVŘENÉ"}</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="truncate font-display text-base">{m.teamA}</span>
        <span className="font-mono text-xl text-primary">{m.scoreA} : {m.scoreB}</span>
        <span className="truncate text-right font-display text-base">{m.teamB}</span>
      </div>
      {!compact && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Pool ${pool} · {(m.bets ?? []).length} sázek
        </p>
      )}
    </Link>
  );
}
