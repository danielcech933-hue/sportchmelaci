import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SPORT_LIST, SPORTS, type Match } from "@/lib/matches";
import { fetchAllMatches, createMatch } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";

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
      setRecent(all.slice(0, 6));
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
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Ready · Set · Play</p>
        <h1 className="mt-2 font-display text-5xl md:text-6xl">Your live scoreboard.</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Pick a sport and start scoring. Every match is saved under your nickname so friends can see who won.
        </p>
        {!loading && !user && (
          <Link to="/auth" className="mt-5 inline-block rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            Sign in to start a match →
          </Link>
        )}
        {user && nickname && (
          <p className="mt-4 text-sm text-muted-foreground">Playing as <span className="font-mono text-primary">{nickname}</span>.</p>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-display text-2xl tracking-wider text-muted-foreground">Choose sport</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {SPORT_LIST.map((s) => (
            <button
              key={s.id}
              onClick={() => start(s.id)}
              className="panel group flex flex-col items-start gap-3 p-5 text-left transition hover:border-primary hover:shadow-[0_0_0_1px_var(--color-primary),0_0_30px_-10px_var(--color-primary)]"
            >
              <span className="text-4xl">{s.emoji}</span>
              <span className="font-display text-xl tracking-wider">{s.name}</span>
              <span className="mt-auto text-xs text-muted-foreground group-hover:text-primary">
                {user ? "Start match →" : "Sign in to start →"}
              </span>
            </button>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-12">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-display text-2xl tracking-wider text-muted-foreground">Recent matches</h2>
            <Link to="/history" className="text-sm text-primary hover:underline">View all</Link>
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
                  <Link to="/match" search={{ id: m.id }} className="panel block p-4 hover:border-primary">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{cfg.emoji} {cfg.name}</span>
                      <span>by <span className="text-primary">{m.ownerNickname}</span></span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="truncate pr-2">{m.teamA}</span>
                      <span className="led-digit text-2xl">{a} : {b}</span>
                      <span className="truncate pl-2 text-right">{m.teamB}</span>
                    </div>
                    {showSets && (
                      <div className="mt-1 text-center font-mono text-[10px] text-muted-foreground">
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
