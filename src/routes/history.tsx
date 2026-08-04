import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SPORTS, type Match } from "@/lib/matches";
import { fetchAllMatches, removeMatch } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { AdminScoreOverride } from "@/components/AdminScoreOverride";
import { isSoloMatch } from "@/lib/stats";
import { playerEmoji } from "@/lib/emoji";
import heroImg from "@/assets/history-hero.jpg";


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
    <main className="relative mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
      <section className="relative overflow-hidden rounded-2xl neon-border scanline">
        <img src={heroImg} alt="" width={1600} height={720} className="h-40 w-full object-cover opacity-60 sm:h-60" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-25" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-8">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 sm:text-xs">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
            Archive
          </div>
          <h1 className="mt-2 font-display text-3xl tracking-wider neon-text sm:text-6xl">MATCH <span className="text-primary">HISTORY</span></h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:text-xs">// Every match, saved under each player's nickname</p>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        {user && (
          <label className="inline-flex items-center gap-2 rounded-md border border-primary/25 bg-background/40 px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground backdrop-blur">
            <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
            My matches only
          </label>
        )}
      </div>

      {!user && (
        <div className="relative mt-6 overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur">
          <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
          <p className="relative text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to see and post matches.
          </p>
        </div>
      )}

      {user && loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : user && visible.length === 0 ? (
        <div className="relative mt-8 overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-12 text-center backdrop-blur">
          <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
          <div className="relative font-display text-2xl tracking-widest text-muted-foreground neon-text">NO SIGNAL</div>
          <Link to="/" className="relative mt-4 inline-block text-primary hover:underline">Start your first match →</Link>
        </div>
      ) : user && (
        <ul className="mt-8 grid gap-3">
          {visible.map((m) => {
            const cfg = SPORTS[m.sport];
            const setsA = m.sets.filter((s) => s.a > s.b).length;
            const setsB = m.sets.filter((s) => s.b > s.a).length;
            const isOwner = m.ownerId === user.id;
            return (
              <li key={m.id} className="relative overflow-hidden rounded-xl border border-primary/25 bg-background/60 p-3 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_0_40px_-16px_var(--color-primary)] sm:p-4">
                <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                      <span>{cfg.emoji} {cfg.name}</span>
                      <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase tracking-widest text-primary/80">
                        {isSoloMatch(m) ? "🧍 Solo" : "🤝 Team"}
                      </span>
                      <span>·</span>
                      <span>by <span className="text-primary">{playerEmoji(m.ownerNickname)} {m.ownerNickname}</span></span>
                      <span className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline">{new Date(m.startedAt).toLocaleString()}</span>
                      <span className="sm:hidden">{new Date(m.startedAt).toLocaleDateString()}</span>
                      {m.endedAt && <span className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-accent">Final</span>}
                    </div>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                      <span className="min-w-0 truncate text-sm sm:text-base">{m.teamA}</span>
                      <span className="led-digit text-xl transition-all duration-500 sm:text-3xl">
                        {cfg.hasSets && m.sets.length > 0 ? `${setsA} : ${setsB}` : `${m.scoreA} : ${m.scoreB}`}
                      </span>
                      <span className="min-w-0 truncate text-right text-sm sm:text-base">{m.teamB}</span>
                    </div>
                    {cfg.hasSets && m.sets.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 font-mono text-[10px] text-muted-foreground sm:text-xs">
                        {m.sets.map((s, i) => <span key={i}>({s.a}–{s.b})</span>)}
                      </div>
                    )}
                    {isAdmin && <div className="mt-3"><AdminScoreOverride match={m} onSaved={reload} /></div>}
                  </div>
                  <div className="flex shrink-0 gap-2 sm:flex-col md:flex-row">
                    <Link
                      to="/match"
                      search={{ id: m.id }}
                      className="flex-1 rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-4px_var(--color-primary)] transition hover:brightness-110 sm:flex-none"
                    >
                      {isOwner ? (m.endedAt ? "View" : "Resume") : "View"}
                    </Link>
                    {(isOwner || isAdmin) && (
                      <button
                        onClick={() => remove(m.id)}
                        className="flex-1 rounded-md border border-primary/25 px-3 py-2 text-sm text-muted-foreground transition hover:border-destructive hover:text-destructive sm:flex-none"
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
