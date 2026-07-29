import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SPORTS, loadMatches, deleteMatch, type Match } from "@/lib/matches";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Match History — Courtside" },
      { name: "description", content: "All the matches you've scored, saved on this device." },
      { property: "og:title", content: "Match History — Courtside" },
      { property: "og:description", content: "All the matches you've scored." },
    ],
  }),
  component: History,
});

function History() {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => { setMatches(loadMatches()); }, []);

  function remove(id: string) {
    if (!confirm("Delete this match?")) return;
    deleteMatch(id);
    setMatches(loadMatches());
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-4xl md:text-5xl">Match History</h1>
      <p className="mt-2 text-muted-foreground">Saved locally on this device.</p>

      {matches.length === 0 ? (
        <div className="panel mt-8 p-12 text-center">
          <p className="text-muted-foreground">No matches yet.</p>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">Start your first match →</Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-3">
          {matches.map((m) => {
            const cfg = SPORTS[m.sport];
            const setsA = m.sets.filter((s) => s.a > s.b).length;
            const setsB = m.sets.filter((s) => s.b > s.a).length;
            return (
              <li key={m.id} className="panel p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{cfg.emoji} {cfg.name}</span>
                      <span>·</span>
                      <span>{new Date(m.startedAt).toLocaleString()}</span>
                      {m.endedAt && <span className="rounded bg-accent/20 px-2 py-0.5 text-accent">Final</span>}
                    </div>
                    <div className="mt-2 flex items-center gap-4">
                      <span className="min-w-0 flex-1 truncate">{m.teamA}</span>
                      <span className="led-digit text-2xl md:text-3xl">
                        {cfg.hasSets && m.sets.length > 0 ? `${setsA} : ${setsB}` : `${m.scoreA} : ${m.scoreB}`}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-right">{m.teamB}</span>
                    </div>
                    {cfg.hasSets && m.sets.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 text-xs font-mono text-muted-foreground">
                        {m.sets.map((s, i) => <span key={i}>({s.a}–{s.b})</span>)}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to="/match"
                      search={{ id: m.id }}
                      className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                    >
                      {m.endedAt ? "View" : "Resume"}
                    </Link>
                    <button
                      onClick={() => remove(m.id)}
                      className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
