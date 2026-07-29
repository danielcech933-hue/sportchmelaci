import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SPORTS, type Match, type Bet } from "@/lib/matches";
import { fetchAllMatches } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import heroImg from "@/assets/profile-hero.jpg";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your Profile — Courtside" },
      { name: "description", content: "Your matches and betting history under your nickname." },
      { property: "og:title", content: "Your Profile — Courtside" },
      { property: "og:description", content: "Your matches and betting history." },
    ],
  }),
  component: Profile,
});

type BetStatus = "won" | "lost" | "open";
type BetRow = Bet & { matchId: string; match: Match; status: BetStatus };

function winnerSideOf(m: Match): "a" | "b" | null {
  if (!m.endedAt) return null;
  const cfg = SPORTS[m.sport];
  if (cfg.hasSets && m.sets.length > 0) {
    const a = m.sets.filter((s) => s.a > s.b).length;
    const b = m.sets.filter((s) => s.b > s.a).length;
    if (a === b) return null;
    return a > b ? "a" : "b";
  }
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? "a" : "b";
}

function Profile() {
  const { user, nickname, loading: authLoading } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    fetchAllMatches()
      .then(setMatches)
      .finally(() => setLoading(false));
  }, [user]);

  const myMatches = useMemo(
    () => matches.filter((m) => m.ownerId === user?.id),
    [matches, user],
  );

  const myBets: BetRow[] = useMemo(() => {
    if (!nickname) return [];
    const rows: BetRow[] = [];
    for (const m of matches) {
      const w = winnerSideOf(m);
      for (const b of m.bets ?? []) {
        if (b.bettor?.toLowerCase() === nickname.toLowerCase()) {
          const status: BetStatus = w ? (b.pick === w ? "won" : "lost") : "open";
          rows.push({ ...b, matchId: m.id, match: m, status });
        }
      }
    }
    return rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [matches, nickname]);

  const stats = useMemo(() => {
    let betWon = 0, betLost = 0, betOpen = 0, moneyNet = 0;
    for (const b of myBets) {
      if (b.status === "won") { betWon++; if (b.amount) moneyNet += b.amount; }
      else if (b.status === "lost") { betLost++; if (b.amount) moneyNet -= b.amount; }
      else betOpen++;
    }
    const victories = myMatches.filter((m) => {
      const w = winnerSideOf(m);
      if (!w || !nickname) return false;
      const winner = w === "a" ? m.teamA : m.teamB;
      return winner.trim().toLowerCase() === nickname.toLowerCase();
    }).length;
    return { total: myMatches.length, victories, betWon, betLost, betOpen, moneyNet };
  }, [myMatches, myBets, nickname]);

  if (authLoading) return <main className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">Loading…</main>;

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur">
          <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
          <p className="relative text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to see your profile.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
      <section className="relative overflow-hidden rounded-2xl neon-border scanline">
        <img src={heroImg} alt="" width={1600} height={720} className="h-40 w-full object-cover opacity-60 sm:h-64" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-25" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-8">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 sm:text-xs">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
            Player profile
          </div>
          <h1 className="mt-2 truncate font-display text-3xl tracking-wider neon-text sm:text-7xl">
            <span className="text-primary">{nickname ?? "PLAYER"}</span>
          </h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:text-xs">// Matches & betting history</p>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-5">
        <Stat label="Matches" value={stats.total} />
        <Stat label="Victories" value={stats.victories} tone={stats.victories > 0 ? "good" : undefined} />
        <Stat label="Bets won" value={stats.betWon} />
        <Stat label="Bets lost" value={stats.betLost} />
        <Stat label="Net $" value={(stats.moneyNet >= 0 ? "+" : "") + stats.moneyNet.toFixed(0)} tone={stats.moneyNet >= 0 ? "good" : "bad"} />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl tracking-[0.25em] text-primary/80 neon-text">MY MATCHES</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : myMatches.length === 0 ? (
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur">
            <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
            <p className="relative text-sm text-muted-foreground">
              No matches yet. <Link to="/" className="text-primary hover:underline">Start one →</Link>
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {myMatches.map((m) => {
              const cfg = SPORTS[m.sport];
              const setsA = m.sets.filter((s) => s.a > s.b).length;
              const setsB = m.sets.filter((s) => s.b > s.a).length;
              return (
                <li key={m.id} className="relative overflow-hidden rounded-xl border border-primary/25 bg-background/60 p-3 backdrop-blur transition hover:border-primary/60 sm:p-4">
                  <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                  <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
                        <span>{cfg.emoji} {cfg.name}</span>
                        <span>·</span>
                        <span className="hidden sm:inline">{new Date(m.startedAt).toLocaleString()}</span>
                        <span className="sm:hidden">{new Date(m.startedAt).toLocaleDateString()}</span>
                        {m.endedAt && <span className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-accent">Final</span>}
                      </div>
                      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                        <span className="min-w-0 truncate text-sm sm:text-base">{m.teamA}</span>
                        <span className="led-digit text-xl sm:text-3xl">
                          {cfg.hasSets && m.sets.length > 0 ? `${setsA} : ${setsB}` : `${m.scoreA} : ${m.scoreB}`}
                        </span>
                        <span className="min-w-0 truncate text-right text-sm sm:text-base">{m.teamB}</span>
                      </div>
                    </div>
                    <Link
                      to="/match"
                      search={{ id: m.id }}
                      className="shrink-0 rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground shadow-[0_0_20px_-4px_hsl(45_100%_60%/0.7)]"
                    >
                      {m.endedAt ? "View" : "Resume"}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl tracking-[0.25em] text-primary/80 neon-text">MY BETS</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : myBets.length === 0 ? (
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur">
            <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
            <p className="relative text-sm text-muted-foreground">You haven't placed any bets yet.</p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {myBets.map((b) => {
              const m = b.match;
              const cfg = SPORTS[m.sport];
              const pickTeam = b.pick === "a" ? m.teamA : m.teamB;
              const tone =
                b.status === "won" ? "text-accent border-accent/40 bg-accent/10" :
                b.status === "lost" ? "text-destructive border-destructive/40 bg-destructive/10" :
                "text-muted-foreground border-primary/25 bg-background/40";
              return (
                <li key={b.id} className="relative overflow-hidden rounded-xl border border-primary/25 bg-background/60 p-4 backdrop-blur transition hover:border-primary/60">
                  <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                  <div className="relative flex flex-wrap items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{cfg.emoji} {m.teamA} vs {m.teamB}</span>
                        <span>·</span>
                        <span>{new Date(b.createdAt ?? m.startedAt).toLocaleString()}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="text-sm">Picked <span className="text-primary font-semibold">{pickTeam}</span></span>
                        {b.amount ? <span className="text-sm">· ${b.amount}</span> : null}
                        {b.note ? <span className="text-sm text-muted-foreground">· "{b.note}"</span> : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-widest ${tone}`}>{b.status}</span>
                      <Link
                        to="/match"
                        search={{ id: m.id }}
                        className="rounded-md border border-primary/25 px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-foreground"
                      >
                        Match
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-accent" : tone === "bad" ? "text-destructive" : "text-primary";
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-background/60 p-4 backdrop-blur">
      <div className="absolute inset-0 grid-bg opacity-15 pointer-events-none" />
      <div className="relative text-[10px] uppercase tracking-[0.3em] text-primary/70">{label}</div>
      <div className={`relative mt-1 font-display text-3xl neon-text ${color}`}>{value}</div>
    </div>
  );
}
