import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SPORTS, type Match, type Bet } from "@/lib/matches";
import { fetchAllMatches } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";

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

type BetRow = Bet & { matchId: string; match: Match };

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
      for (const b of m.bets ?? []) {
        if (b.bettor?.toLowerCase() === nickname.toLowerCase()) {
          rows.push({ ...b, matchId: m.id, match: m });
        }
      }
    }
    return rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  }, [matches, nickname]);

  const stats = useMemo(() => {
    let wins = 0, losses = 0;
    for (const m of myMatches) {
      if (!m.endedAt) continue;
      const cfg = SPORTS[m.sport];
      const setsA = m.sets.filter((s) => s.a > s.b).length;
      const setsB = m.sets.filter((s) => s.b > s.a).length;
      const aWon = cfg.hasSets && m.sets.length > 0 ? setsA > setsB : m.scoreA > m.scoreB;
      const bWon = cfg.hasSets && m.sets.length > 0 ? setsB > setsA : m.scoreB > m.scoreA;
      if (aWon || bWon) { /* counted below */ }
      // Owner "wins" if their side... we don't track which side is theirs; skip W/L
    }
    let betWon = 0, betLost = 0, betOpen = 0, moneyNet = 0;
    for (const b of myBets) {
      if (b.status === "won") { betWon++; if (b.amount) moneyNet += b.amount; }
      else if (b.status === "lost") { betLost++; if (b.amount) moneyNet -= b.amount; }
      else betOpen++;
    }
    return { total: myMatches.length, finished: myMatches.filter((m) => m.endedAt).length, betWon, betLost, betOpen, moneyNet };
  }, [myMatches, myBets]);

  if (authLoading) return <main className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground">Loading…</main>;

  if (!user) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="panel p-8 text-center">
          <p className="text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to see your profile.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Profile</p>
        <h1 className="font-display text-4xl md:text-5xl">
          <span className="text-primary">{nickname ?? "player"}</span>
        </h1>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Matches" value={stats.total} />
        <Stat label="Finished" value={stats.finished} />
        <Stat label="Bets won" value={stats.betWon} />
        <Stat label="Bets lost" value={stats.betLost} />
        <Stat label="Net $" value={(stats.moneyNet >= 0 ? "+" : "") + stats.moneyNet.toFixed(0)} tone={stats.moneyNet >= 0 ? "good" : "bad"} />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl">My matches</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : myMatches.length === 0 ? (
          <div className="panel mt-4 p-8 text-center text-sm text-muted-foreground">
            No matches yet. <Link to="/" className="text-primary hover:underline">Start one →</Link>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {myMatches.map((m) => {
              const cfg = SPORTS[m.sport];
              const setsA = m.sets.filter((s) => s.a > s.b).length;
              const setsB = m.sets.filter((s) => s.b > s.a).length;
              return (
                <li key={m.id} className="panel p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                    </div>
                    <Link
                      to="/match"
                      search={{ id: m.id }}
                      className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
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
        <h2 className="font-display text-2xl">My bets</h2>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : myBets.length === 0 ? (
          <div className="panel mt-4 p-8 text-center text-sm text-muted-foreground">
            You haven't placed any bets yet.
          </div>
        ) : (
          <ul className="mt-4 grid gap-3">
            {myBets.map((b, i) => {
              const m = b.match;
              const cfg = SPORTS[m.sport];
              const pickTeam = b.pick === "a" ? m.teamA : b.pick === "b" ? m.teamB : "Draw";
              const tone =
                b.status === "won" ? "text-accent" :
                b.status === "lost" ? "text-destructive" :
                "text-muted-foreground";
              return (
                <li key={`${b.matchId}-${i}`} className="panel p-4">
                  <div className="flex flex-wrap items-center gap-4">
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
                      <span className={`text-xs uppercase tracking-widest ${tone}`}>{b.status ?? "open"}</span>
                      <Link
                        to="/match"
                        search={{ id: m.id }}
                        className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
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
  const color = tone === "good" ? "text-accent" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <div className="panel p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-3xl ${color}`}>{value}</div>
    </div>
  );
}
