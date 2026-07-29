import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { SPORTS, loadMatches, upsertMatch, deleteMatch, type Match, type Bet } from "@/lib/matches";

const searchSchema = z.object({ id: z.string() });

export const Route = createFileRoute("/match")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Match — Courtside" },
      { name: "description", content: "Live scoreboard for your current match." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MatchPage,
});

function MatchPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    const found = loadMatches().find((m) => m.id === id);
    if (!found) navigate({ to: "/" });
    else setMatch(found);
  }, [id, navigate]);

  function update(next: Match) {
    setMatch(next);
    upsertMatch(next);
  }

  if (!match) return null;
  const cfg = SPORTS[match.sport];

  const bump = (side: "a" | "b", delta: number) => {
    const key = side === "a" ? "scoreA" : "scoreB";
    update({ ...match, [key]: Math.max(0, match[key] + delta) });
  };

  const finishSet = () => {
    update({
      ...match,
      sets: [...match.sets, { a: match.scoreA, b: match.scoreB }],
      scoreA: 0,
      scoreB: 0,
    });
  };

  const finishMatch = () => {
    update({ ...match, endedAt: Date.now() });
    navigate({ to: "/history" });
  };

  const resetScore = () => update({ ...match, scoreA: 0, scoreB: 0 });

  const remove = () => {
    if (confirm("Delete this match?")) {
      deleteMatch(match.id);
      navigate({ to: "/" });
    }
  };

  const setsA = match.sets.filter((s) => s.a > s.b).length;
  const setsB = match.sets.filter((s) => s.b > s.a).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between text-sm">
        <Link to="/" className="text-muted-foreground hover:text-foreground">← Lobby</Link>
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
          {cfg.emoji} {cfg.name}
        </span>
      </div>

      <div className="panel p-4 md:p-8">
        {/* Team names */}
        <div className="grid grid-cols-2 gap-3 md:gap-8">
          <input
            value={match.teamA}
            onChange={(e) => update({ ...match, teamA: e.target.value })}
            className="w-full bg-transparent text-center font-display text-2xl tracking-wider outline-none focus:text-primary md:text-4xl"
          />
          <input
            value={match.teamB}
            onChange={(e) => update({ ...match, teamB: e.target.value })}
            className="w-full bg-transparent text-center font-display text-2xl tracking-wider outline-none focus:text-primary md:text-4xl"
          />
        </div>

        {/* Sets indicator */}
        {cfg.hasSets && (
          <div className="mt-2 grid grid-cols-2 gap-3 text-center text-xs text-muted-foreground md:gap-8">
            <div>{cfg.setLabel}s won: <span className="font-mono text-primary">{setsA}</span></div>
            <div>{cfg.setLabel}s won: <span className="font-mono text-primary">{setsB}</span></div>
          </div>
        )}

        {/* Scoreboard */}
        <div className="mt-4 grid grid-cols-2 gap-3 md:gap-8">
          {(["a", "b"] as const).map((side) => {
            const score = side === "a" ? match.scoreA : match.scoreB;
            return (
              <div key={side} className="rounded-2xl bg-background/60 p-4 md:p-8">
                <div className="led-digit text-center text-[6rem] leading-none md:text-[10rem]">
                  {score}
                </div>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => bump(side, -1)}
                    className="h-12 w-12 rounded-full border border-border text-xl hover:bg-surface-2"
                    aria-label="minus"
                  >−</button>
                  <button
                    onClick={() => bump(side, 1)}
                    className="h-16 flex-1 rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-[0_0_30px_-10px_var(--color-primary)] active:scale-95"
                    aria-label="plus one"
                  >+1</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Set history */}
        {match.sets.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">Previous {cfg.setLabel.toLowerCase()}s:</span>
            {match.sets.map((s, i) => (
              <span key={i} className="rounded-md border border-border bg-background/60 px-2 py-1 font-mono">
                {s.a}–{s.b}
              </span>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {cfg.hasSets && (
            <button
              onClick={finishSet}
              className="rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20"
            >
              End {cfg.setLabel}
            </button>
          )}
          <button
            onClick={resetScore}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2"
          >
            Reset score
          </button>
          <button
            onClick={finishMatch}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Finish match
          </button>
          <button
            onClick={remove}
            className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Delete
          </button>
        </div>
      </div>
    </main>
  );
}
