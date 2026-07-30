import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useNicknames } from "@/lib/nicknames";
import { SPORTS, type Match, betsPool } from "@/lib/matches";
import {
  computeStandings,
  fetchTournament,
  setTournamentSchedule,
  type Tournament,
  playerErrorMessage,
  updateTeamPlayers,
  type TournamentTeam,
} from "@/lib/tournaments-db";

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function ScheduleBar({
  tournament,
  onChange,
}: {
  tournament: Tournament;
  onChange: (ts: number | null) => void;
}) {
  const { isAdmin } = useAuth();
  const [edit, setEdit] = useState(false);
  const [when, setWhen] = useState(() =>
    tournament.scheduledAt ? toLocalInput(new Date(tournament.scheduledAt)) : "",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(ts: number | null) {
    setBusy(true);
    setErr(null);
    try {
      await setTournamentSchedule(tournament.id, ts);
      onChange(ts);
      setEdit(false);
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "Nepodařilo se uložit termín.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-accent">
        🗓️{" "}
        {tournament.scheduledAt
          ? new Date(tournament.scheduledAt).toLocaleString("cs-CZ", {
              weekday: "short",
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "bez termínu"}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setEdit((v) => !v)}
            className="ml-3 rounded border border-primary/30 px-2 py-0.5 text-[10px] text-primary hover:bg-primary/10"
          >
            {edit ? "zavřít" : "změnit termín"}
          </button>
        )}
      </p>
      {isAdmin && edit && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="rounded-md border border-primary/25 bg-background/60 px-2.5 py-1.5 font-mono text-sm text-primary outline-none focus:border-primary/60"
          />
          <button
            type="button"
            disabled={busy || !when}
            onClick={() => void save(new Date(when).getTime())}
            className="rounded-md bg-primary px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-40"
          >
            Uložit
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save(null)}
            className="rounded-md border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Zrušit termín
          </button>
        </div>
      )}
      {err && <p className="mt-1 text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}


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
          <ScheduleBar
            tournament={tournament}
            onChange={(ts: number | null) => {
              setTournament((prev) => (prev ? { ...prev, scheduledAt: ts } : prev));
              void fetchTournament(id).then((r) => setMatches(r.matches)).catch(() => {});
            }}
          />
          <Link to="/tournaments" className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
            ← všechny turnaje
          </Link>

        </div>
      </div>

      <section className="mt-6">
        <h2 className="mb-3 font-display text-xl tracking-wider neon-text">👥 Soupisky</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {teams.map((t) => (
            <RosterCard
              key={t.id}
              team={t}
              takenElsewhere={teams.filter((x) => x.id !== t.id).flatMap((x) => x.players)}
              onChange={(players: string[]) => setTeams((prev) => prev.map((x) => (x.id === t.id ? { ...x, players } : x)))}
            />
          ))}
        </div>
      </section>


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
      {m.scheduledAt && !ended && (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
          🗓️ {new Date(m.scheduledAt).toLocaleString("cs-CZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
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

function RosterCard({
  team,
  takenElsewhere,
  onChange,
}: {
  team: TournamentTeam;
  takenElsewhere: string[];
  onChange: (players: string[]) => void;
}) {
  const { isAdmin } = useAuth();
  const nicknames = useNicknames();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(players: string[]) {
    setBusy(true);
    setErr(null);
    try {
      await updateTeamPlayers(team.id, players);
      onChange(players);
      setValue("");
    } catch (e) {
      setErr(playerErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    const name = value.trim();
    if (!name) return;
    const lower = name.toLowerCase();
    if (team.players.some((p) => p.toLowerCase() === lower)) {
      setErr("Tento hráč už v týmu je.");
      return;
    }
    if (takenElsewhere.some((p) => p.toLowerCase() === lower)) {
      setErr(`Hráč "${name}" už je v jiném týmu tohoto turnaje.`);
      return;
    }
    void save([...team.players, name]);
  }

  const available = nicknames.filter(
    (n) => ![...team.players, ...takenElsewhere].some((p) => p.toLowerCase() === n.toLowerCase()),
  );

  return (
    <div className="panel neon-border p-4">
      <h3 className="font-display text-lg tracking-wide">{team.name}</h3>
      {team.players.length === 0 ? (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Bez hráčů</p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {team.players.map((p) => (
            <li key={p} className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2 truncate">
                <span className="text-primary">▸</span> {p}
              </span>
              {isAdmin && (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Odebrat ${p}`}
                  onClick={() => void save(team.players.filter((x) => x !== p))}
                  className="rounded border border-border px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <form onSubmit={add} className="mt-3 flex items-center gap-1.5">
          <input
            value={value}
            list={`roster-${team.id}`}
            placeholder="Přidat hráče"
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-md border border-primary/20 bg-background/60 px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary/60"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground disabled:opacity-40"
          >
            +
          </button>
          <datalist id={`roster-${team.id}`}>
            {available.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </form>
      )}
      {err && <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
    </div>
  );
}
