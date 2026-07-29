import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SPORTS, type Match, type Bet } from "@/lib/matches";
import { fetchAllMatches, removeMatch, setMatchConfirmed, removeBetFromMatch } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { fetchAuditLog, actionLabel, type AuditEntry } from "@/lib/audit";


export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Moderation — Courtside" },
      { name: "description", content: "Review, confirm, or remove reported matches and bets." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Admin,
});

function Admin() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unconfirmed" | "confirmed" | "live">("unconfirmed");
  const [busy, setBusy] = useState<string | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);


  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate({ to: "/auth" }); return; }
    if (!isAdmin) return;
    reload();
  }, [authLoading, user, isAdmin]);

  async function reload() {
    setLoading(true);
    try {
      const [ms, a] = await Promise.all([fetchAllMatches(), fetchAuditLog(200)]);
      setMatches(ms);
      setAudit(a);
    } finally { setLoading(false); }
  }


  const visible = useMemo(() => {
    return matches.filter((m) => {
      if (filter === "unconfirmed") return !m.confirmedAt && !!m.endedAt;
      if (filter === "confirmed") return !!m.confirmedAt;
      if (filter === "live") return !m.endedAt;
      return true;
    });
  }, [matches, filter]);

  async function confirm(m: Match) {
    if (!user) return;
    setBusy(m.id);
    try { await setMatchConfirmed(m.id, user.id); await reload(); } finally { setBusy(null); }
  }
  async function unconfirm(m: Match) {
    setBusy(m.id);
    try { await setMatchConfirmed(m.id, null); await reload(); } finally { setBusy(null); }
  }
  async function del(m: Match) {
    if (!confirm_ok(`Delete match "${m.teamA} vs ${m.teamB}"? This cannot be undone.`)) return;
    setBusy(m.id);
    try { await removeMatch(m.id); await reload(); } finally { setBusy(null); }
  }
  async function deleteBet(m: Match, b: Bet) {
    if (!confirm_ok(`Remove ${b.bettor}'s bet on ${b.pick === "a" ? m.teamA : m.teamB}?`)) return;
    setBusy(m.id + b.id);
    try { await removeBetFromMatch(m.id, b.id); await reload(); } finally { setBusy(null); }
  }

  if (authLoading) return <main className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">Loading…</main>;

  if (!user) return null;

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="panel p-8 text-center">
          <h1 className="font-display text-3xl">Not authorized</h1>
          <p className="mt-3 text-sm text-muted-foreground">This area is for moderators only.</p>
          <Link to="/" className="mt-6 inline-block text-primary hover:underline">← Back to lobby</Link>
        </div>
      </main>
    );
  }

  const counts = {
    unconfirmed: matches.filter((m) => !m.confirmedAt && !!m.endedAt).length,
    confirmed: matches.filter((m) => !!m.confirmedAt).length,
    live: matches.filter((m) => !m.endedAt).length,
    all: matches.length,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-accent">Moderation</p>
          <h1 className="font-display text-4xl md:text-5xl">Review & Remove</h1>
          <p className="mt-2 text-sm text-muted-foreground">Confirm finished matches, delete incorrect entries, and remove bad bets.</p>
        </div>
      </header>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        {(["unconfirmed", "live", "confirmed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md border px-3 py-2 capitalize ${
              filter === f
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f} <span className="ml-1 text-xs opacity-70">({counts[f]})</span>
          </button>
        ))}
      </nav>

      {loading ? (
        <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="panel mt-8 p-12 text-center text-sm text-muted-foreground">Nothing here.</div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {visible.map((m) => {
            const cfg = SPORTS[m.sport];
            const setsA = m.sets.filter((s) => s.a > s.b).length;
            const setsB = m.sets.filter((s) => s.b > s.a).length;
            const isBusy = busy === m.id;
            return (
              <li key={m.id} className="panel p-4">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{cfg.emoji} {cfg.name}</span>
                      <span>·</span>
                      <span>by <span className="text-primary">{m.ownerNickname}</span></span>
                      <span>·</span>
                      <span>{new Date(m.startedAt).toLocaleString()}</span>
                      {m.endedAt ? (
                        <span className="rounded bg-accent/20 px-2 py-0.5 text-accent">Final</span>
                      ) : (
                        <span className="rounded bg-primary/20 px-2 py-0.5 text-primary">Live</span>
                      )}
                      {m.confirmedAt && (
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-400">
                          Confirmed
                        </span>
                      )}
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
                    {m.bets.length > 0 && (
                      <div className="mt-3 border-t border-border/60 pt-3">
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">Bets ({m.bets.length})</p>
                        <ul className="mt-1 divide-y divide-border/60">
                          {m.bets.map((b) => (
                            <li key={b.id} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                              <span className="font-semibold">{b.bettor}</span>
                              <span className="text-xs text-muted-foreground">on {b.pick === "a" ? m.teamA : m.teamB}</span>
                              {b.amount ? <span className="font-mono text-primary">${b.amount}</span> : null}
                              {b.note ? <span className="truncate text-muted-foreground">"{b.note}"</span> : null}
                              <button
                                onClick={() => deleteBet(m, b)}
                                disabled={busy === m.id + b.id}
                                className="ml-auto text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/match"
                      search={{ id: m.id }}
                      className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Open
                    </Link>
                    {m.confirmedAt ? (
                      <button
                        onClick={() => unconfirm(m)}
                        disabled={isBusy}
                        className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        Unconfirm
                      </button>
                    ) : (
                      <button
                        onClick={() => confirm(m)}
                        disabled={isBusy || !m.endedAt}
                        title={!m.endedAt ? "Finish the match first" : ""}
                        className="rounded-md bg-emerald-500 px-3 py-2 text-sm font-semibold text-black hover:brightness-110 disabled:opacity-40"
                      >
                        Confirm
                      </button>
                    )}
                    <button
                      onClick={() => del(m)}
                      disabled={isBusy}
                      className="rounded-md bg-destructive px-3 py-2 text-sm font-semibold text-destructive-foreground hover:brightness-110 disabled:opacity-50"
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

function confirm_ok(msg: string) {
  return typeof window !== "undefined" && window.confirm(msg);
}
