import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SPORT_LIST, SPORTS, loadMatches, newMatch, upsertMatch, type Match } from "@/lib/matches";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Courtside — Pick a Sport" },
      { name: "description", content: "Start a live scoreboard for tennis, volleyball, nohejball, football or padel." },
      { property: "og:title", content: "Courtside — Pick a Sport" },
      { property: "og:description", content: "Start a live scoreboard for the sport you're playing." },
    ],
  }),
  component: Lobby,
});

function Lobby() {
  const navigate = useNavigate();
  const [recent, setRecent] = useState<Match[]>([]);

  useEffect(() => {
    setRecent(loadMatches().slice(0, 3));
  }, []);

  function start(sportId: (typeof SPORT_LIST)[number]["id"]) {
    const m = newMatch(sportId);
    upsertMatch(m);
    navigate({ to: "/match", search: { id: m.id } });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <section className="mb-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">Ready · Set · Play</p>
        <h1 className="mt-2 font-display text-5xl md:text-6xl">Your live scoreboard.</h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Pick a sport and start scoring. Every match is saved to your history — right here on this device.
        </p>
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
              <span className="mt-auto text-xs text-muted-foreground group-hover:text-primary">Start match →</span>
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
                      <span>{new Date(m.startedAt).toLocaleDateString()}</span>
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
