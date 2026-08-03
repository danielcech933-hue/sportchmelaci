import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { SPORTS, type Match } from "@/lib/matches";
import { fetchMatch, saveMatch, reopenMatch } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { useMatchesRealtime, LiveBadge } from "@/lib/live";
import { useIsParticipant } from "@/lib/participants";


const searchSchema = z.object({ id: z.string() });

export const Route = createFileRoute("/live")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Live rozhodčí — Chmeloví Sportovci" },
      { name: "description", content: "Mobilní rozhraní rozhodčího pro živé zapisování skóre zápasu v reálném čase." },
      { property: "og:title", content: "Live rozhodčí — Chmeloví Sportovci" },
      { property: "og:description", content: "Zapisuj body v reálném čase, skóre se okamžitě promítne všem divákům." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LiveRefereePage,
});

type Snapshot = { scoreA: number; scoreB: number; sets: Match["sets"] };

function LiveRefereePage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [match, setMatch] = useState<Match | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const history = useRef<Snapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const localEdit = useRef(false);

  useEffect(() => {
    fetchMatch(id).then((m) => (m ? setMatch(m) : setNotFound(true)));
  }, [id]);

  useMatchesRealtime(
    () => {
      if (localEdit.current) return;
      fetchMatch(id).then((m) => m && setMatch(m));
    },
    { matchId: id },
  );

  const isParticipant = useIsParticipant(match);

  if (notFound)
    return (
      <main className="mx-auto max-w-xl px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">Zápas nenalezen.</p>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">← Lobby</Link>
      </main>
    );
  if (!match || authLoading) return null;

  const cfg = SPORTS[match.sport];
  const finished = !!match.endedAt;
  // Participants (1v1, 2v2, tournament team members) and the admin may score.
  const canScore = (isParticipant || isAdmin) && !finished;
  const canOverride = isAdmin;


  async function commit(next: Match, snapshot?: Snapshot) {
    if (snapshot) {
      history.current.push(snapshot);
      setCanUndo(true);
    }
    localEdit.current = true;
    setMatch(next);
    setErr(null);
    try {
      await saveMatch(next);
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "Uložení selhalo");
    } finally {
      setTimeout(() => (localEdit.current = false), 500);
    }
  }

  function snap(m: Match): Snapshot {
    return { scoreA: m.scoreA, scoreB: m.scoreB, sets: m.sets };
  }

  const bump = (side: "a" | "b", delta: number) => {
    if (!canScore || !match) return;
    const key = side === "a" ? "scoreA" : "scoreB";
    void commit({ ...match, [key]: Math.max(0, match[key] + delta) }, snap(match));
  };

  const endSet = () => {
    if (!canScore || !match) return;
    void commit(
      { ...match, sets: [...match.sets, { a: match.scoreA, b: match.scoreB }], scoreA: 0, scoreB: 0 },
      snap(match),
    );
  };

  const undo = () => {
    const prev = history.current.pop();
    if (!prev || !match) return;
    setCanUndo(history.current.length > 0);
    void commit({ ...match, ...prev });
  };

  const finish = async () => {
    if (!canScore || !match) return;
    if (!confirm("Ukončit zápas? Sázky se vypořádají a výsledek se propíše do turnaje.")) return;
    setBusy(true);
    await commit({ ...match, endedAt: Date.now() });
    setBusy(false);
    navigate({ to: "/match", search: { id: match.id } });
  };

  const setsA = match.sets.filter((s) => s.a > s.b).length;
  const setsB = match.sets.filter((s) => s.b > s.a).length;

  return (
    <main className="mx-auto max-w-xl px-3 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Link to="/match" search={{ id: match.id }} className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground hover:text-foreground">
          ← detail
        </Link>
        {!match.endedAt ? <LiveBadge /> : <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">HOTOVO</span>}
      </div>

      <p className="text-center font-mono text-[10px] uppercase tracking-[0.35em] text-primary">
        {cfg.emoji} {cfg.name} · rozhodčí
      </p>

      {!canScore && (
        <p className="panel mt-3 p-3 text-center text-xs text-muted-foreground">
          {match.endedAt ? "Zápas je ukončený." : "Zapisovat může jen zakladatel zápasu nebo admin."}
        </p>
      )}

      {cfg.hasSets && (
        <p className="mt-3 text-center font-mono text-xs text-muted-foreground">
          {cfg.setLabel}y: <span className="text-primary">{setsA}</span> : <span className="text-accent">{setsB}</span>
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        {(["a", "b"] as const).map((side) => {
          const score = side === "a" ? match.scoreA : match.scoreB;
          const name = side === "a" ? match.teamA : match.teamB;
          return (
            <div key={side} className="panel neon-border flex flex-col items-center gap-3 p-3">
              <span className={`w-full truncate text-center font-display text-lg tracking-wide ${side === "a" ? "text-primary" : "text-accent"}`}>
                {name}
              </span>
              <div className="led-digit text-center text-[5rem] leading-none">{score}</div>
              <button
                onClick={() => bump(side, 1)}
                disabled={!canScore}
                className={`h-24 w-full rounded-2xl text-4xl font-bold active:scale-95 disabled:opacity-40 ${
                  side === "a" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
                }`}
                aria-label={`Bod pro ${name}`}
              >
                +1
              </button>
              <button
                onClick={() => bump(side, -1)}
                disabled={!canScore}
                className="h-12 w-full rounded-xl border border-border text-2xl text-muted-foreground active:scale-95 disabled:opacity-40"
                aria-label={`Odebrat bod ${name}`}
              >
                −1
              </button>
            </div>
          );
        })}
      </div>

      {match.sets.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
          {match.sets.map((s, i) => (
            <span key={i} className="rounded-md border border-border bg-background/60 px-2 py-1 font-mono text-xs">
              {s.a}–{s.b}
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 grid gap-2">
        <button
          onClick={undo}
          disabled={!canScore || !canUndo}
          className="h-12 rounded-xl border border-border text-sm font-semibold hover:bg-surface-2 disabled:opacity-40"
        >
          ↩︎ Vrátit poslední bod
        </button>
        {cfg.hasSets && (
          <button
            onClick={endSet}
            disabled={!canScore}
            className="h-12 rounded-xl border border-accent bg-accent/10 text-sm font-semibold text-accent disabled:opacity-40"
          >
            Ukončit {cfg.setLabel.toLowerCase()}
          </button>
        )}
        <button
          onClick={finish}
          disabled={!canScore || busy}
          className="h-14 rounded-xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-40"
        >
          🏁 Ukončit zápas
        </button>
      </div>

      {err && <p className="mt-3 text-center text-xs" style={{ color: "var(--danger)" }}>{err}</p>}
    </main>
  );
}
