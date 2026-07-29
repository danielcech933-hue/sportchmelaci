import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { SPORTS, SPORT_LIST, type SportId, type Match } from "@/lib/matches";
import { createMatch, fetchAllMatches } from "@/lib/matches-db";
import { fetchAllTeams, type Team } from "@/lib/teams-db";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/schedule-hero.jpg";
import nohejbalLegendsAsset from "@/assets/nohejbal-legends.png.asset.json";
import tennisLegendsAsset from "@/assets/tennis-legends.png.asset.json";
import volleyballLegendsAsset from "@/assets/volleyball-legends.png.asset.json";
import footballLegendsAsset from "@/assets/football-legends.png.asset.json";
import padelLegendsAsset from "@/assets/padel-legends.png.asset.json";

const SPORT_BG: Record<string, string> = {
  tennis: tennisLegendsAsset.url,
  volleyball: volleyballLegendsAsset.url,
  nohejball: nohejbalLegendsAsset.url,
  football: footballLegendsAsset.url,
  padel: padelLegendsAsset.url,
};

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
  const [nicknames, setNicknames] = useState<string[]>([]);
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
    supabase.from("profiles").select("nickname").order("nickname", { ascending: true })
      .then(({ data }) => setNicknames((data ?? []).map((p) => p.nickname).filter(Boolean)));
    fetchAllMatches().then((all) =>
      setUpcoming(all.filter((m) => m.scheduledAt && (m.scheduledAt > Date.now() || !m.endedAt) && m.sets.length === 0 && m.scoreA === 0 && m.scoreB === 0)
        .sort((a, b) => (a.scheduledAt! - b.scheduledAt!)))
    ).catch(() => {});
  }, [user]);

  const playerOptions = useMemo(() => {
    const set = new Set<string>([...nicknames, ...teams.map((t) => t.name)]);
    return Array.from(set);
  }, [teams, nicknames]);

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

  const chipBase = "rounded-md px-3 py-1.5 text-xs uppercase tracking-widest transition-all";
  const chipOn = "bg-primary text-primary-foreground shadow-[0_0_20px_-4px_hsl(45_100%_60%/0.7)]";
  const chipOff = "text-muted-foreground hover:text-foreground";

  return (
    <main className="relative mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-10">
      {/* Fixed sport background reacting to selected sport */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {Object.entries(SPORT_BG).map(([id, url]) => (
          <img
            key={id}
            src={url}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover saturate-125 contrast-110 transition-all duration-700 ease-out ${
              sport === id ? "opacity-40 scale-105" : "opacity-0 scale-110"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/60" />
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="absolute inset-0 mix-blend-screen bg-[radial-gradient(circle_at_30%_20%,hsl(45_100%_60%/0.25),transparent_60%)]" />
      </div>
      <div className="relative z-10">
      <section className="relative overflow-hidden rounded-2xl neon-border scanline">
        <img src={heroImg} alt="" width={1600} height={720} className="h-40 w-full object-cover opacity-60 sm:h-60" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-25" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 sm:text-xs">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
            Fixture control
          </div>
          <h1 className="mt-2 font-display text-3xl tracking-wider neon-text sm:text-6xl">SCHEDULE <span className="text-primary">MATCH</span></h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:text-xs">// Plan ahead and share the fixture</p>
        </div>
      </section>

      <form onSubmit={submit} className="relative mt-6 overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-4 backdrop-blur sm:p-5">
        <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
        <div className="relative space-y-5">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">Sport</label>
            <div className="mt-2 flex flex-wrap gap-1 rounded-md border border-primary/30 bg-background/40 p-1 backdrop-blur">
              {SPORT_LIST.map((s) => (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setSport(s.id)}
                  className={`${chipBase} ${sport === s.id ? chipOn : chipOff}`}
                >{s.emoji} {s.name}</button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <PlayersInput label="Team A" players={playersA} onChange={setPlayersA} options={playerOptions} />
            <PlayersInput label="Team B" players={playersB} onChange={setPlayersB} options={playerOptions} />
          </div>

          <div>
            <label className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">Kick-off</label>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="mt-2 w-full rounded-md border border-primary/30 bg-background/40 px-3 py-2 font-mono text-sm text-primary neon-text focus:border-primary focus:outline-none focus:shadow-[0_0_20px_-8px_var(--color-primary)]"
            />
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}

          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link to="/teams" className="text-center text-xs uppercase tracking-[0.25em] text-primary hover:underline sm:text-left">// Manage teams →</Link>
            <button disabled={busy} className="w-full rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-4px_hsl(45_100%_60%/0.7)] disabled:opacity-50 sm:w-auto">
              Schedule match
            </button>
          </div>
        </div>
      </form>

      <section className="mt-10">
        <h2 className="font-display text-xl tracking-[0.25em] text-primary/80 neon-text sm:text-2xl">UPCOMING</h2>
        <ul className="mt-3 space-y-2">
          {upcoming.map((m) => {
            const cfg = SPORTS[m.sport];
            return (
              <li key={m.id}>
                <Link to="/match" search={{ id: m.id }} className="relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-primary/25 bg-background/60 p-3 backdrop-blur transition hover:border-primary hover:shadow-[0_0_20px_-10px_var(--color-primary)] sm:p-4">
                  <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                  <div className="relative min-w-0 flex-1">
                    <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{cfg.emoji} {cfg.name} · by <span className="text-primary">{m.ownerNickname}</span></p>
                    <p className="mt-1 truncate font-display text-base tracking-wide sm:text-lg">{m.teamA} <span className="text-muted-foreground">vs</span> {m.teamB}</p>
                  </div>
                  <div className="relative shrink-0 text-right font-mono text-[10px] leading-tight text-primary neon-text sm:text-xs">
                    {m.scheduledAt ? new Date(m.scheduledAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                  </div>
                </Link>
              </li>
            );
          })}
          {upcoming.length === 0 && (
            <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-background/40 px-4 py-8 text-center backdrop-blur">
              <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
              <div className="relative font-display text-xl tracking-widest text-muted-foreground neon-text">NO FIXTURES</div>
              <p className="relative mt-1 text-xs uppercase tracking-[0.25em] text-muted-foreground">No upcoming matches scheduled</p>
            </div>
          )}
        </ul>
      </section>
      </div>
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
        <label className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">{label}</label>
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
              className="w-full rounded-md border border-primary/30 bg-background/40 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:shadow-[0_0_20px_-8px_var(--color-primary)]"
              maxLength={60}
            />
            {players.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-md border border-primary/25 px-2 text-xs text-muted-foreground hover:border-destructive hover:text-destructive"
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
