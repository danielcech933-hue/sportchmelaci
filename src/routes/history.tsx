import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SPORTS, type Match } from "@/lib/matches";
import { fetchAllMatches, removeMatch } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Match History — Courtside" },
      { name: "description", content: "Every scored match, saved under each player's nickname." },
      { property: "og:title", content: "Match History — Courtside" },
      { property: "og:description", content: "All matches, by every player." },
    ],
  }),
  component: History,
});

function History() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [mineOnly, setMineOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try { setMatches(await fetchAllMatches()); } finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, [user]);

  async function remove(id: string) {
    if (!confirm("Delete this match?")) return;
    await removeMatch(id);
    reload();
  }

  const visible = mineOnly && user ? matches.filter((m) => m.ownerId === user.id) : matches;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl md:text-5xl">Match History</h1>
          <p className="mt-2 text-muted-foreground">Every match, saved under each player's nickname.</p>
        </div>
        {user && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            My matches only
          </label>
        )}
      </div>

      {!user && (
        <div className="panel mt-6 p-6 text-center text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to see and post matches.
        </div>
      )}

      {user && loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : user && visible.length === 0 ? (
        <div className="panel mt-8 p-12 text-center">
          <p className="text-muted-foreground">No matches yet.</p>
          <Link to="/" className="mt-4 inline-block text-primary hover:underline">Start your first match →</Link>
        </div>
      ) : user && (
        <ul className="mt-8 grid gap-3">
          {visible.map((m) => {
            const cfg = SPORTS[m.sport];
            const setsA = m.sets.filter((s) => s.a > s.b).length;
            const setsB = m.sets.filter((s) => s.b > s.a).length;
            const isOwner = m.ownerId === user.id;
            return (
              <li key={m.id} className="panel p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{cfg.emoji} {cfg.name}</span>
                      <span>·</span>
                      <span>by <span className="text-primary">{m.ownerNickname}</span></span>
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
                      {isOwner ? (m.endedAt ? "View" : "Resume") : "View"}
                    </Link>
                    {isOwner && (
                      <button
                        onClick={() => remove(m.id)}
                        className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                      >
                        Delete
                      </button>
                    )}
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
