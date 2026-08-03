import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Pencil, Trash2, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SPORTS, type Match } from "@/lib/matches";
import { fetchAllMatches, removeMatch, updateMatchFixture } from "@/lib/matches-db";
import { fetchTournaments, type Tournament } from "@/lib/tournaments-db";
import { useMatchHistory } from "@/lib/odds";
import { OddsPill } from "@/components/OddsBoard";
import { useMatchesRealtime } from "@/lib/live";
import heroImg from "@/assets/schedule-hero.jpg";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "Plán zápasů — Chmeloví Sportovci" },
      { name: "description", content: "Přehled všech naplánovaných zápasů a turnajů — sport, hráči a čas výkopu." },
      { property: "og:title", content: "Plán zápasů — Chmeloví Sportovci" },
      { property: "og:description", content: "Přehled všech naplánovaných zápasů a turnajů — sport, hráči a čas výkopu." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SchedulePage,
});

function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function SchedulePage() {
  const { user, isAdmin, loading } = useAuth();
  const [upcoming, setUpcoming] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const { history } = useMatchHistory();
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchAllMatches()
      .then((all) =>
        setUpcoming(
          all
            .filter(
              (m) =>
                m.scheduledAt &&
                !m.endedAt &&
                m.sets.length === 0 &&
                m.scoreA === 0 &&
                m.scoreB === 0,
            )
            .sort((a, b) => a.scheduledAt! - b.scheduledAt!),
        ),
      )
      .catch(() => {});
    fetchTournaments()
      .then((all) =>
        setTournaments(
          all
            .filter((t) => t.scheduledAt && t.scheduledAt > Date.now() - 6 * 3600_000)
            .sort((a, b) => a.scheduledAt! - b.scheduledAt!),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useMatchesRealtime(() => load());

  if (loading) return null;

  return (
    <main className="relative mx-auto max-w-3xl px-3 py-6 pb-32 sm:px-4 sm:py-10">
      <section className="relative overflow-hidden rounded-2xl neon-border scanline">
        <img src={heroImg} alt="" width={1600} height={720} className="h-36 w-full object-cover opacity-60 sm:h-56" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-25" />
        <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6">
          <div className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 sm:text-xs">
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-primary shadow-[0_0_10px] shadow-primary" />
            Fixture feed
          </div>
          <h1 className="mt-2 font-display text-3xl tracking-wider neon-text sm:text-5xl">
            PLÁN <span className="text-primary">ZÁPASŮ</span>
          </h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:text-xs">
            // Nový zápas i turnaj se plánuje v Lobby
          </p>
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/20 bg-background/50 px-3 py-2 backdrop-blur">
        <p className="text-xs text-muted-foreground">
          {isAdmin ? "Admin režim — můžeš upravovat a mazat fixtury." : "Pouze pro čtení."}
        </p>
        <Link to="/" className="text-xs uppercase tracking-[0.25em] text-primary hover:underline">
          // Naplánovat v Lobby →
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="font-display text-xl tracking-[0.25em] text-primary/80 neon-text sm:text-2xl">NAPLÁNOVANÉ ZÁPASY</h2>
        <ul className="mt-3 space-y-2">
          {upcoming.map((m) => {
            const cfg = SPORTS[m.sport];
            return (
              <li
                key={m.id}
                className="relative overflow-hidden rounded-xl border border-primary/25 bg-background/60 backdrop-blur transition hover:border-primary/60"
              >
                <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                <div className="relative flex items-start gap-3 p-3 sm:p-4">
                  <Link to="/match" search={{ id: m.id }} className="min-w-0 flex-1">
                    <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                      {cfg.emoji} {cfg.name} · by <span className="text-primary">{m.ownerNickname}</span>
                    </p>
                    <p className="mt-1 truncate font-display text-base tracking-wide sm:text-lg">
                      {m.teamA} <span className="text-muted-foreground">vs</span> {m.teamB}
                    </p>
                    <p className="mt-1"><OddsPill match={m} history={history} /></p>
                  </Link>
                  <div className="shrink-0 text-right">
                    <span className="inline-flex items-center gap-1 font-mono text-[10px] leading-tight text-primary neon-text sm:text-xs">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(m.scheduledAt!).toLocaleString("cs-CZ", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {isAdmin && (
                      <div className="mt-2 flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditing(editing === m.id ? null : m.id)}
                          aria-label="Upravit zápas"
                          className="rounded-md border border-primary/30 p-1.5 text-muted-foreground hover:border-primary hover:text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm("Smazat naplánovaný zápas?")) return;
                            await removeMatch(m.id);
                            load();
                          }}
                          aria-label="Smazat zápas"
                          className="rounded-md border border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin && editing === m.id && (
                  <EditFixture
                    match={m}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                      setEditing(null);
                      load();
                    }}
                  />
                )}
              </li>
            );
          })}
          {upcoming.length === 0 && <Empty label="Žádný naplánovaný zápas" />}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl tracking-[0.25em] text-primary/80 neon-text sm:text-2xl">PLÁNOVANÉ TURNAJE</h2>
        <ul className="mt-3 space-y-2">
          {tournaments.map((t) => {
            const cfg = SPORTS[t.sport];
            return (
              <li key={t.id}>
                <Link
                  to="/tournament"
                  search={{ id: t.id }}
                  className="relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-accent/30 bg-background/60 p-3 backdrop-blur transition hover:border-accent sm:p-4"
                >
                  <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
                  <div className="relative min-w-0 flex-1">
                    <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
                      🏆 {cfg?.emoji} {cfg?.name} · {t.format === "round_robin" ? "každý s každým" : "pavouk"}
                    </p>
                    <p className="mt-1 truncate font-display text-base tracking-wide sm:text-lg">{t.name}</p>
                  </div>
                  <div className="relative shrink-0 text-right font-mono text-[10px] leading-tight text-accent sm:text-xs">
                    {new Date(t.scheduledAt!).toLocaleString("cs-CZ", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </Link>
              </li>
            );
          })}
          {tournaments.length === 0 && <Empty label="Žádný naplánovaný turnaj" />}
        </ul>
      </section>

      {!user && (
        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link to="/auth" className="text-primary underline">Přihlas se</Link> pro sázky a zapisování skóre.
        </p>
      )}
    </main>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-background/40 px-4 py-8 text-center backdrop-blur">
      <div className="absolute inset-0 grid-bg opacity-10 pointer-events-none" />
      <div className="relative font-display text-xl tracking-widest text-muted-foreground neon-text">NO FIXTURES</div>
      <p className="relative mt-1 text-xs uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
    </div>
  );
}

function EditFixture({ match, onClose, onSaved }: { match: Match; onClose: () => void; onSaved: () => void }) {
  const [teamA, setTeamA] = useState(match.teamA);
  const [teamB, setTeamB] = useState(match.teamB);
  const [when, setWhen] = useState(toLocalInput(match.scheduledAt ?? Date.now()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const ts = new Date(when).getTime();
      if (!ts || isNaN(ts)) throw new Error("Neplatné datum");
      await updateMatchFixture(match.id, { teamA: teamA.trim(), teamB: teamB.trim(), scheduledAt: ts });
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const field =
    "w-full rounded-md border border-primary/30 bg-background/40 px-3 py-2 text-sm focus:border-primary focus:outline-none";

  return (
    <div className="relative border-t border-primary/20 bg-background/70 p-3 sm:p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">Admin úprava</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input value={teamA} onChange={(e) => setTeamA(e.target.value)} className={field} maxLength={80} aria-label="Tým A" />
        <input value={teamB} onChange={(e) => setTeamB(e.target.value)} className={field} maxLength={80} aria-label="Tým B" />
      </div>
      <label className="mt-2 flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 shrink-0 text-primary" />
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className={`${field} font-mono text-primary`}
          aria-label="Nový čas"
        />
      </label>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          Uložit změny
        </button>
        <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-xs text-muted-foreground">
          Zrušit
        </button>
      </div>
    </div>
  );
}
