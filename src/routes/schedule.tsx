import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { SPORTS, SPORT_LIST, type SportId, type Match } from "@/lib/matches";
import { createMatch, fetchAllMatches } from "@/lib/matches-db";
import { fetchAllTeams, type Team } from "@/lib/teams-db";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "Courtside — Schedule a match" },
      { name: "description", content: "Plan upcoming matches with a date, time, and teams from your roster." },
      { property: "og:title", content: "Courtside — Schedule a match" },
      { property: "og:description", content: "Plan upcoming matches with a date, time, and teams from your roster." },
    ],
  }),
  component: SchedulePage,
});

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function SchedulePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [sport, setSport] = useState<SportId>("tennis");
  const [playersA, setPlayersA] = useState<string[]>([""]);
  const [playersB, setPlayersB] = useState<string[]>([""]);
  const [when, setWhen] = useState(() => {
    const d = new Date(); d.setHours(d.getHours() + 1, 0, 0, 0);
    return toLocalInput(d);
  });
  const [teams, setTeams] = useState<Team[]>([]);
  const [upcoming, setUpcoming] = useState<Match[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const cfg = SPORTS[sport];
    setPlayersA((v) => (v.some((p) => p.trim()) ? v : [cfg.defaultTeams[0]]));
    setPlayersB((v) => (v.some((p) => p.trim()) ? v : [cfg.defaultTeams[1]]));
  }, [sport]);


  useEffect(() => {
    if (!user) return;
    fetchAllTeams().then(setTeams).catch(() => {});
    fetchAllMatches().then((all) =>
      setUpcoming(all.filter((m) => m.scheduledAt && (m.scheduledAt > Date.now() || !m.endedAt) && m.sets.length === 0 && m.scoreA === 0 && m.scoreB === 0)
        .sort((a, b) => (a.scheduledAt! - b.scheduledAt!)))
    ).catch(() => {});
  }, [user]);

  const teamOptions = useMemo(() => teams.map((t) => t.name), [teams]);

  if (loading) return null;
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-muted-foreground">Please <Link to="/auth" className="text-primary underline">sign in</Link> to schedule matches.</p>
      </main>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const ts = new Date(when).getTime();
      if (!ts || isNaN(ts)) throw new Error("Pick a valid date");
      const joinPlayers = (list: string[], fallback: string) => {
        const cleaned = list.map((p) => p.trim()).filter(Boolean);
        return cleaned.length ? cleaned.join(" & ") : fallback;
      };
      const id = await createMatch({
        ownerId: user!.id,
        sport,
        teamA: joinPlayers(playersA, SPORTS[sport].defaultTeams[0]),
        teamB: joinPlayers(playersB, SPORTS[sport].defaultTeams[1]),
        scheduledAt: ts,
      });
      navigate({ to: "/match", search: { id } });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }


  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl">Schedule a match</h1>
      <p className="mt-1 text-sm text-muted-foreground">Plan ahead and share the fixture with your crew.</p>

      <form onSubmit={submit} className="panel mt-6 space-y-4 p-5">
        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Sport</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {SPORT_LIST.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => setSport(s.id)}
                className={`rounded-md border px-3 py-2 text-sm ${sport === s.id ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
              >
                {s.emoji} {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <PlayersInput label="Team A" players={playersA} onChange={setPlayersA} options={teamOptions} />
          <PlayersInput label="Team B" players={playersB} onChange={setPlayersB} options={teamOptions} />
        </div>


        <div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground">Kick-off</label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="mt-2 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
          />
        </div>

        {err && <p className="text-sm text-destructive">{err}</p>}

        <div className="flex items-center justify-between">
          <Link to="/teams" className="text-xs text-primary hover:underline">Manage teams →</Link>
          <button disabled={busy} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            Schedule match
          </button>
        </div>
      </form>

      <section className="mt-10">
        <h2 className="font-display text-2xl tracking-wider text-muted-foreground">Upcoming</h2>
        <ul className="mt-3 space-y-2">
          {upcoming.map((m) => {
            const cfg = SPORTS[m.sport];
            return (
              <li key={m.id}>
                <Link to="/match" search={{ id: m.id }} className="panel flex items-center justify-between p-4 hover:border-primary">
                  <div>
                    <p className="text-xs text-muted-foreground">{cfg.emoji} {cfg.name} · by <span className="text-primary">{m.ownerNickname}</span></p>
                    <p className="mt-1 font-display text-lg">{m.teamA} <span className="text-muted-foreground">vs</span> {m.teamB}</p>
                  </div>
                  <div className="text-right font-mono text-xs text-primary">
                    {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString() : ""}
                  </div>
                </Link>
              </li>
            );
          })}
          {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming matches scheduled.</p>}
        </ul>
      </section>
    </main>
  );
}

function PlayersInput({ label, players, onChange, options }: { label: string; players: string[]; onChange: (v: string[]) => void; options: string[] }) {
  const listId = `teams-${label.replace(/\s/g, "")}`;
  const update = (i: number, v: string) => onChange(players.map((p, idx) => (idx === i ? v : p)));
  const add = () => onChange([...players, ""]);
  const remove = (i: number) => onChange(players.length > 1 ? players.filter((_, idx) => idx !== i) : players);
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</label>
        <button type="button" onClick={add} className="text-xs text-primary hover:underline">+ Add player</button>
      </div>
      <div className="mt-2 space-y-2">
        {players.map((p, i) => (
          <div key={i} className="flex gap-2">
            <input
              list={listId}
              value={p}
              onChange={(e) => update(i, e.target.value)}
              placeholder={i === 0 ? "Player or team name" : `Player ${i + 1}`}
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
              maxLength={60}
            />
            {players.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-md border border-border px-2 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
                aria-label="Remove player"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
      <datalist id={listId}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
    </div>
  );
}

