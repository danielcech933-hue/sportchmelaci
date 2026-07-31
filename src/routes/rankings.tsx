import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { fetchAllMatches } from "@/lib/matches-db";
import { fetchAllTeams, type Team } from "@/lib/teams-db";
import { SPORT_LIST, type Match, type SportId } from "@/lib/matches";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/lib/avatars";
import heroImg from "@/assets/scoreboard-hero.jpg";
import goldImg from "@/assets/rank-gold.jpg";
import silverImg from "@/assets/rank-silver.jpg";
import bronzeImg from "@/assets/rank-bronze.jpg";


export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Courtside — Scoreboard 🏆" },
      { name: "description", content: "Rankings for teams and solo players by match victories." },
      { property: "og:title", content: "Courtside — Scoreboard 🏆" },
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

const PODIUM = [
  { img: goldImg, label: "CHAMPION", ring: "shadow-[0_0_60px_-10px_hsl(45_100%_60%/0.7)] border-primary/60" },
  { img: silverImg, label: "RUNNER-UP", ring: "shadow-[0_0_50px_-12px_hsl(200_100%_70%/0.55)] border-sky-400/50" },
  { img: bronzeImg, label: "THIRD", ring: "shadow-[0_0_50px_-12px_hsl(20_100%_60%/0.55)] border-orange-500/50" },
];

function RankingsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [profiles, setProfiles] = useState<{ nickname: string; avatar_path: string | null }[]>([]);
  const [tab, setTab] = useState<"solo" | "teams">("solo");
  const [sport, setSport] = useState<SportId | "all">("all");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [m, t, p] = await Promise.all([
          fetchAllMatches(),
          fetchAllTeams().catch(() => [] as Team[]),
          supabase.from("profiles").select("nickname, avatar_path").then((r) => (r.data ?? []) as { nickname: string; avatar_path: string | null }[]),
        ]);
        setMatches(m);
        setTeams(t);
        setProfiles(p);
      } catch (e) {
        setErr((e as Error).message);
      }
    })();
  }, []);

  const avatarByNick = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of profiles) if (p.nickname) m.set(p.nickname.trim().toLowerCase(), p.avatar_path);
    return m;
  }, [profiles]);

  const finished = useMemo(
    () => matches.filter((m) => m.endedAt && (sport === "all" || m.sport === sport)),
    [matches, sport],
  );

  const soloRows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    // Seed with every registered nickname so users without matches still appear
    for (const p of profiles) {
      const name = p.nickname?.trim();
      if (!name) continue;
      map.set(name.toLowerCase(), { key: name.toLowerCase(), label: name, wins: 0, losses: 0, played: 0 });
    }
    for (const m of finished) {
      const w = winnerSide(m);
      if (!w) continue;
      const aPlayers = splitPlayers(m.teamA);
      const bPlayers = splitPlayers(m.teamB);
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
  }, [finished, profiles]);

  const teamRows = useMemo<Row[]>(() => {
    const teamNames = new Set(teams.map((t) => t.name.toLowerCase()));
    const map = new Map<string, Row>();
    // Seed with every registered team so empty teams still appear
    for (const t of teams) {
      const name = t.name.trim();
      if (!name) continue;
      map.set(name.toLowerCase(), { key: name.toLowerCase(), label: name, wins: 0, losses: 0, played: 0 });
    }
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
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const chipBase = "rounded-md px-3 py-1.5 text-xs uppercase tracking-widest transition-all";
  const chipOn = "bg-primary text-primary-foreground shadow-[0_0_20px_-4px_hsl(45_100%_60%/0.7)]";
  const chipOff = "text-muted-foreground hover:text-foreground";

  return (
    <main className="relative mx-auto max-w-5xl px-4 py-10">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl neon-border scanline">
        <img
          src={heroImg}
          alt=""
          width={1600}
          height={720}
          className="h-56 w-full object-cover opacity-70 sm:h-72"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary/80">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
            Live rankings
          </div>
          <h1 className="mt-2 font-display text-5xl tracking-wider neon-text sm:text-7xl">
            SCOREBOARD <span className="text-primary">🏆</span>
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Holographic leaderboard — solo players and teams ranked by match victories.
          </p>
        </div>
      </section>

      {/* FILTERS */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-md border border-primary/30 bg-background/40 p-1 backdrop-blur">
          <button onClick={() => setTab("solo")} className={`${chipBase} ${tab === "solo" ? chipOn : chipOff}`}>Solo</button>
          <button onClick={() => setTab("teams")} className={`${chipBase} ${tab === "teams" ? chipOn : chipOff}`}>Teams</button>
        </div>
        <div className="inline-flex flex-wrap rounded-md border border-primary/30 bg-background/40 p-1 backdrop-blur">
          <button onClick={() => setSport("all")} className={`${chipBase} ${sport === "all" ? chipOn : chipOff}`}>All</button>
          {SPORT_LIST.map((s) => (
            <button
              key={s.id}
              onClick={() => setSport(s.id)}
              className={`${chipBase} ${sport === s.id ? chipOn : chipOff}`}
            >{s.emoji} {s.name}</button>
          ))}
        </div>
      </div>

      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}

      {/* PODIUM */}
      {podium.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {podium.map((r, i) => {
            const p = PODIUM[i];
            return (
              <div
                key={r.key}
                className={`relative overflow-hidden rounded-2xl border bg-background/60 p-4 backdrop-blur ${p.ring}`}
                style={{ transform: i === 0 ? "translateY(-8px)" : undefined }}
              >
                <div className="absolute inset-0 grid-bg opacity-20" />
                <div className="relative flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-primary/40">
                    <img src={p.img} alt="" width={800} height={800} loading="lazy" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 text-center font-display text-2xl neon-text text-primary">
                      #{i + 1}
                    </div>
                  </div>
                  {tab === "solo" && avatarByNick.has(r.key) && (
                    <Avatar path={avatarByNick.get(r.key)} nickname={r.label} size={48} />
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-primary/70">{p.label}</div>
                    <div className="truncate font-display text-2xl tracking-wider">{r.label}</div>
                    <div className="mt-1 flex items-center gap-3 font-mono text-xs text-muted-foreground">
                      <span className="text-primary">{r.wins}W</span>
                      <span>{r.losses}L</span>
                      <span>{r.played ? Math.round((r.wins / r.played) * 100) : 0}%</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE */}
      <div className="relative mt-6 overflow-hidden rounded-2xl border border-primary/25 bg-background/50 backdrop-blur">
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
        <div className="no-scrollbar relative overflow-x-auto">
        <table className="relative w-full min-w-[420px] text-sm">

          <thead className="bg-primary/5 text-[10px] uppercase tracking-[0.25em] text-primary/70">
            <tr>
              <th className="px-4 py-3 text-left">Rank</th>
              <th className="px-4 py-3 text-left">{tab === "solo" ? "Player" : "Team"}</th>
              <th className="px-4 py-3 text-right">W</th>
              <th className="px-4 py-3 text-right">L</th>
              <th className="px-4 py-3 text-right hidden sm:table-cell">Played</th>
              <th className="px-4 py-3 text-right">Win %</th>
            </tr>
          </thead>
          <tbody>
            {rest.map((r, i) => {
              const rank = i + 4;
              const pct = r.played ? Math.round((r.wins / r.played) * 100) : 0;
              return (
                <tr key={r.key} className="border-t border-primary/10 transition-colors hover:bg-primary/5">
                  <td className="px-4 py-3 font-mono text-muted-foreground">{rank.toString().padStart(2, "0")}</td>
                  <td className="px-4 py-3 font-medium">
                    <span className="inline-flex items-center gap-2">
                      {tab === "solo" && avatarByNick.has(r.key) && (
                        <Avatar path={avatarByNick.get(r.key)} nickname={r.label} size={28} />
                      )}
                      <span className="truncate">{r.label}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-primary neon-text">{r.wins}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{r.losses}</td>
                  <td className="px-4 py-3 text-right font-mono hidden sm:table-cell">{r.played}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-gradient-to-r from-primary/70 to-primary shadow-[0_0_8px_hsl(45_100%_60%/0.8)]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="font-mono text-xs">{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center">
                  <div className="font-display text-2xl tracking-widest text-muted-foreground neon-text">NO SIGNAL</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.3em] text-muted-foreground">No players or teams yet</div>
                </td>

              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>


      <p className="mt-4 text-xs uppercase tracking-[0.25em] text-muted-foreground">
        // Manage rosters on the <Link to="/teams" className="text-primary underline">Teams</Link> grid
      </p>
    </main>
  );
}
