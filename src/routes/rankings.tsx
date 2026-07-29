import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchAllMatches } from "@/lib/matches-db";
import { fetchAllTeams, type Team } from "@/lib/teams-db";
import type { Match } from "@/lib/matches";

export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Courtside — ScoreboardaTeams" },
      { name: "description", content: "Rankings for teams and solo players by match victories." },
      { property: "og:title", content: "Courtside — ScoreboardaTeams" },
      { property: "og:description", content: "Rankings for teams and solo players by match victories." },
    ],
  }),
  component: RankingsPage,
});

function splitPlayers(name: string): string[] {
  return name
    .split(/\s*(?:&|\/|\+|,|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function winnerSide(m: Match): "A" | "B" | null {
  if (!m.endedAt) return null;
  let a = m.scoreA;
  let b = m.scoreB;
  if (a === 0 && b === 0 && m.sets && m.sets.length > 0) {
    a = m.sets.filter((s) => s.a > s.b).length;
    b = m.sets.filter((s) => s.b > s.a).length;
  }
  if (a > b) return "A";
  if (b > a) return "B";
  return null;
}

type Row = { key: string; label: string; wins: number; losses: number; played: number };

function RankingsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [tab, setTab] = useState<"solo" | "teams">("solo");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [m, t] = await Promise.all([fetchAllMatches(), fetchAllTeams().catch(() => [])]);
        setMatches(m);
        setTeams(t);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, []);

  const finished = useMemo(() => matches.filter((m) => m.endedAt), [matches]);

  const soloRows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    for (const m of finished) {
      const w = winnerSide(m);
      if (!w) continue;
      const aPlayers = splitPlayers(m.teamA);
      const bPlayers = splitPlayers(m.teamB);
      // solo = each side has exactly one player
      if (aPlayers.length !== 1 || bPlayers.length !== 1) continue;
      const a = aPlayers[0];
      const b = bPlayers[0];
      const rowA = map.get(a.toLowerCase()) ?? { key: a.toLowerCase(), label: a, wins: 0, losses: 0, played: 0 };
      const rowB = map.get(b.toLowerCase()) ?? { key: b.toLowerCase(), label: b, wins: 0, losses: 0, played: 0 };
      rowA.played++; rowB.played++;
      if (w === "A") { rowA.wins++; rowB.losses++; } else { rowB.wins++; rowA.losses++; }
      map.set(rowA.key, rowA); map.set(rowB.key, rowB);
    }
    return [...map.values()].sort((x, y) => y.wins - x.wins || y.played - x.played || x.label.localeCompare(y.label));
  }, [finished]);

  const teamRows = useMemo<Row[]>(() => {
    const teamNames = new Set(teams.map((t) => t.name.toLowerCase()));
    const map = new Map<string, Row>();
    for (const m of finished) {
      const w = winnerSide(m);
      if (!w) continue;
      const a = m.teamA.trim();
      const b = m.teamB.trim();
      const aIsTeam = teamNames.has(a.toLowerCase()) || splitPlayers(a).length > 1;
      const bIsTeam = teamNames.has(b.toLowerCase()) || splitPlayers(b).length > 1;
      if (aIsTeam) {
        const r = map.get(a.toLowerCase()) ?? { key: a.toLowerCase(), label: a, wins: 0, losses: 0, played: 0 };
        r.played++; if (w === "A") r.wins++; else r.losses++;
        map.set(r.key, r);
      }
      if (bIsTeam) {
        const r = map.get(b.toLowerCase()) ?? { key: b.toLowerCase(), label: b, wins: 0, losses: 0, played: 0 };
        r.played++; if (w === "B") r.wins++; else r.losses++;
        map.set(r.key, r);
      }
    }
    return [...map.values()].sort((x, y) => y.wins - x.wins || y.played - x.played || x.label.localeCompare(y.label));
  }, [finished, teams]);

  const rows = tab === "solo" ? soloRows : teamRows;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl tracking-wider">ScoreboardaTeams</h1>
      <p className="mt-1 text-sm text-muted-foreground">Rankings by match victories — solo players and teams.</p>

      <div className="mt-6 inline-flex rounded-md border border-border p-1 text-sm">
        <button
          onClick={() => setTab("solo")}
          className={`rounded px-3 py-1.5 ${tab === "solo" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >Solo players</button>
        <button
          onClick={() => setTab("teams")}
          className={`rounded px-3 py-1.5 ${tab === "teams" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
        >Teams</button>
      </div>

      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}

      <div className="panel mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">{tab === "solo" ? "Player" : "Team"}</th>
              <th className="px-4 py-2 text-right">W</th>
              <th className="px-4 py-2 text-right">L</th>
              <th className="px-4 py-2 text-right">Played</th>
              <th className="px-4 py-2 text-right">Win %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className="border-t border-border/40">
                <td className="px-4 py-2 font-mono text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2 font-medium">{r.label}</td>
                <td className="px-4 py-2 text-right font-mono text-primary">{r.wins}</td>
                <td className="px-4 py-2 text-right font-mono text-muted-foreground">{r.losses}</td>
                <td className="px-4 py-2 text-right font-mono">{r.played}</td>
                <td className="px-4 py-2 text-right font-mono">{r.played ? Math.round((r.wins / r.played) * 100) : 0}%</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No finished matches yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Manage rosters on the <Link to="/teams" className="text-primary underline">Teams</Link> page.
      </p>
    </main>
  );
}
