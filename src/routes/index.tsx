import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SPORT_LIST, SPORTS, type Match } from "@/lib/matches";
import { fetchAllMatches, createMatch } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import heroImg from "@/assets/lobby-hero.jpg";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Courtside — Pick a Sport" },
      { name: "description", content: "Start a live scoreboard for tennis, volleyball, nohejball, football or padel. Save every match under your nickname." },
      { property: "og:title", content: "Courtside — Pick a Sport" },
      { property: "og:description", content: "Start a live scoreboard for tennis, volleyball, nohejball, football or padel." },
    ],
  }),
  component: Lobby,
});

function Lobby() {
  const navigate = useNavigate();
  const { user, nickname, loading } = useAuth();
  const [recent, setRecent] = useState<Match[]>([]);
  const [upcoming, setUpcoming] = useState<Match[]>([]);

  useEffect(() => {
    if (!user) { setRecent([]); setUpcoming([]); return; }
    fetchAllMatches().then((all) => {
      const up = all
        .filter((m) => m.scheduledAt && !m.endedAt && m.sets.length === 0 && m.scoreA === 0 && m.scoreB === 0)
        .sort((a, b) => (a.scheduledAt! - b.scheduledAt!));
      setUpcoming(up.slice(0, 5));
      setRecent(all.filter((m) => !!m.endedAt).slice(0, 6));
    }).catch(() => { setRecent([]); setUpcoming([]); });
  }, [user]);

  async function start(sportId: (typeof SPORT_LIST)[number]["id"]) {
    if (!user) { navigate({ to: "/auth" }); return; }
    const cfg = SPORTS[sportId];
    const id = await createMatch({
      ownerId: user.id,
      sport: sportId,
      teamA: cfg.defaultTeams[0],
      teamB: cfg.defaultTeams[1],
    });
    navigate({ to: "/match", search: { id } });
  }

  return (
    <main className="relative mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl neon-border scanline">
        <img src={heroImg} alt="" width={1600} height={720} className="h-48 w-full object-cover opacity-70 sm:h-72" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-8">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 sm:text-xs">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
            Ready · Set · Play
          </div>
          <h1 className="mt-2 font-display text-4xl leading-none tracking-wider neon-text sm:text-7xl">
            YOUR LIVE <span className="text-primary">SCOREBOARD</span>
          </h1>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground sm:text-sm">
            Pick a sport and start scoring. Every match is saved under your nickname.
          </p>
          {!loading && !user && (
            <Link to="/auth" className="mt-4 inline-block w-fit rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-4px_hsl(45_100%_60%/0.7)]">
              Sign in to start →
            </Link>
          )}
          {user && nickname && (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:text-xs">
              // Playing as <span className="text-primary neon-text">{nickname}</span>
            </p>
          )}
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="relative mt-8 overflow-hidden rounded-2xl border border-primary/25 bg-background/50 backdrop-blur">
          <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
          <div className="relative flex items-center gap-3 border-b border-primary/20 bg-primary/5 px-4 py-2">
            <span className="inline-block h-2 w-2 animate-pulse-glow rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
            <p className="font-mono text-[11px] uppercase tracking-[0.35em] text-primary">On the schedule</p>
            <Link to="/schedule" className="ml-auto text-xs text-primary/80 hover:text-primary hover:underline">See all →</Link>
          </div>
          <ul className="relative divide-y divide-primary/10">
            {upcoming.map((m) => {
              const cfg = SPORTS[m.sport];
              const when = m.scheduledAt ? new Date(m.scheduledAt) : null;
              return (
                <li key={m.id}>
                  <Link to="/match" search={{ id: m.id }} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-3 py-3 transition hover:bg-primary/10 sm:px-4">
                    <span className="row-span-2 text-xl">{cfg.emoji}</span>
                    <span className="min-w-0 truncate font-display text-base tracking-wide sm:text-lg">
                      {m.teamA} <span className="text-muted-foreground">vs</span> {m.teamB}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-primary neon-text sm:text-xs">
                      {when ? when.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                    <span className="col-span-2 truncate text-[10px] text-muted-foreground sm:text-[11px]">
                      {cfg.name} · by <span className="text-primary">{m.ownerNickname}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-4 font-display text-2xl tracking-[0.25em] text-primary/80 neon-text">CHOOSE SPORT</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {SPORT_LIST.map((s) => {
            const isNohejbal = s.id === "nohejball";
            return (
              <button
                key={s.id}
                onClick={() => start(s.id)}
                className={`group relative flex flex-col items-start gap-3 overflow-hidden rounded-xl border p-5 text-left backdrop-blur transition hover:shadow-[0_0_0_1px_var(--color-primary),0_0_30px_-8px_var(--color-primary)] ${
                  isNohejbal
                    ? "border-primary/40 bg-background/40 hover:border-primary"
                    : "border-primary/25 bg-background/60 hover:border-primary"
                }`}
              >
                {isNohejbal && (
                  <>
                    <img
                      src={nohejbalLegendsAsset.url}
                      alt=""
                      aria-hidden
                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-45 saturate-125 contrast-110 transition duration-500 group-hover:scale-105 group-hover:opacity-70"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
                    <div className="pointer-events-none absolute inset-0 mix-blend-screen bg-[radial-gradient(circle_at_30%_20%,hsl(45_100%_60%/0.25),transparent_60%)]" />
                  </>
                )}
                <div className={`absolute inset-0 grid-bg transition ${isNohejbal ? "opacity-25 group-hover:opacity-40" : "opacity-15 group-hover:opacity-30"}`} />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
                <span className={`relative text-4xl ${isNohejbal ? "drop-shadow-[0_0_12px_hsl(45_100%_60%/0.7)]" : ""}`}>{s.emoji}</span>
                <span className={`relative font-display text-xl tracking-wider ${isNohejbal ? "neon-text text-primary" : ""}`}>{s.name}</span>
                <span className="relative mt-auto text-xs uppercase tracking-[0.2em] text-muted-foreground group-hover:text-primary">
                  {user ? "Start match →" : "Sign in →"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-2xl tracking-[0.25em] text-primary/80 neon-text">RECENT MATCHES</h2>
            <Link to="/history" className="text-sm text-primary hover:underline">View all →</Link>
          </div>
          <ul className="grid gap-3 md:grid-cols-3">
            {recent.map((m) => {
              const cfg = SPORTS[m.sport];
              const setsA = m.sets.filter((s) => s.a > s.b).length;
              const setsB = m.sets.filter((s) => s.b > s.a).length;
              const showSets = cfg.hasSets && m.sets.length > 0;
              const a = showSets ? setsA : m.scoreA;
              const b = showSets ? setsB : m.scoreB;
              return (
                <li key={m.id}>
                  <Link to="/match" search={{ id: m.id }} className="group relative block overflow-hidden rounded-xl border border-primary/25 bg-background/60 p-4 backdrop-blur transition hover:border-primary">
                    <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                    <div className="relative flex items-center justify-between text-xs text-muted-foreground">
                      <span>{cfg.emoji} {cfg.name}</span>
                      <span>by <span className="text-primary">{m.ownerNickname}</span></span>
                    </div>
                    <div className="relative mt-3 flex items-center justify-between">
                      <span className="truncate pr-2">{m.teamA}</span>
                      <span className="led-digit text-2xl">{a} : {b}</span>
                      <span className="truncate pl-2 text-right">{m.teamB}</span>
                    </div>
                    {showSets && (
                      <div className="relative mt-1 text-center font-mono text-[10px] text-muted-foreground">
                        {m.sets.map((s, i) => <span key={i} className="mx-1">{s.a}–{s.b}</span>)}
                      </div>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
