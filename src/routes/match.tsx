import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { SPORTS, type Match } from "@/lib/matches";
import { fetchMatch, saveMatch, removeMatch } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { useNicknames, NicknamesDatalist, NICKNAMES_DATALIST_ID } from "@/lib/nicknames";
import { useMatchesRealtime, LiveBadge } from "@/lib/live";
import { NickLink } from "@/lib/profile-links";
import { BettingModule } from "@/components/BettingModule";

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
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nicknames = useNicknames();
  const [match, setMatch] = useState<Match | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    fetchMatch(id).then((m) => {
      if (!m) setNotFound(true);
      else setMatch(m);
    }).catch((e) => setActionError(e instanceof Error ? e.message : "Zápas se nepodařilo načíst."));
  }, [id]);

  useMatchesRealtime(
    () => {
      if (dirty.current) return;
      fetchMatch(id).then((m) => m && setMatch(m)).catch(() => undefined);
    },
    { matchId: id },
  );

  useEffect(() => {
    if (!match || !dirty.current) return;
    const t = setTimeout(() => {
      dirty.current = false;
      saveMatch(match).catch((e) => console.error("save failed", e));
    }, 400);
    return () => clearTimeout(t);
  }, [match]);

  if (notFound) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 text-center">
        <h1 className="font-display text-3xl tracking-wider text-primary">Zápas nenalezen</h1>
        <p className="mt-2 text-muted-foreground">Tento zápas už není dostupný.</p>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">← Lobby</Link>
      </main>
    );
  }
  if (!match || authLoading) return null;

  const cfg = SPORTS[match.sport];
  const isOwner = !!user && user.id === match.ownerId;

  function update(next: Match) {
    dirty.current = true;
    setActionError(null);
    setMatch(next);
  }

  const bump = (side: "a" | "b", delta: number) => {
    if (!isOwner || match.endedAt) return;
    const key = side === "a" ? "scoreA" : "scoreB";
    update({ ...match, [key]: Math.max(0, match[key] + delta) });
  };
  const finishSet = () => {
    if (!isOwner || match.endedAt) return;
    update({ ...match, sets: [...match.sets, { a: match.scoreA, b: match.scoreB }], scoreA: 0, scoreB: 0 });
  };
  const finishMatch = async () => {
    if (!isOwner || finishBusy || match.endedAt) return;
    setActionError(null);
    setFinishBusy(true);
    const next = { ...match, endedAt: Date.now() };
    setMatch(next);
    dirty.current = false;
    try {
      await saveMatch(next);
      const persisted = await fetchMatch(match.id);
      if (!persisted?.endedAt) {
        throw new Error("Zápas se nepodařilo v databázi označit jako ukončený. Zkus to znovu.");
      }
      setMatch(persisted);
      navigate({ to: "/admin", hash: "pending-approvals" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Ukončení zápasu se nepodařilo.";
      setActionError(message);
      const persisted = await fetchMatch(match.id).catch(() => null);
      if (persisted) setMatch(persisted);
    } finally {
      setFinishBusy(false);
    }
  };
  const resetScore = () => isOwner && !match.endedAt && update({ ...match, scoreA: 0, scoreB: 0 });
  const remove = async () => {
    if (!isOwner) return;
    if (!confirm("Delete this match? Any open bets will be refunded.")) return;
    await removeMatch(match.id);
    navigate({ to: "/" });
  };

  const setsA = match.sets.filter((s) => s.a > s.b).length;
  const setsB = match.sets.filter((s) => s.b > s.a).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between text-sm">
        <Link to="/" className="text-muted-foreground hover:text-foreground">← Lobby</Link>
        <span className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-primary">
          {!match.endedAt && <LiveBadge />}
          {cfg.emoji} {cfg.name} · by {match.ownerNickname}
        </span>
      </div>

      <header className="mb-4">
        <h1 className="font-display text-3xl tracking-wider text-primary md:text-5xl">
          {cfg.emoji} {cfg.name} — {match.teamA} vs {match.teamB}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {match.endedAt ? "Čeká na schválení adminem" : "Live scoreboard · probíhá právě teď"}
        </p>
      </header>

      {actionError && (
        <div className="panel mb-4 border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {!isOwner && (
        <div className="panel mb-4 p-3 text-center text-xs text-muted-foreground">
          You're spectating. Only <span className="text-primary">{match.ownerNickname}</span> can update this match.
        </div>
      )}

      <div className="panel p-4 md:p-8">
        <div className="grid grid-cols-2 gap-3 md:gap-8">
          <input value={match.teamA} disabled={!isOwner || !!match.endedAt} list={NICKNAMES_DATALIST_ID} onChange={(e) => update({ ...match, teamA: e.target.value })} className="w-full bg-transparent text-center font-display text-2xl tracking-wider outline-none focus:text-primary md:text-4xl disabled:opacity-90" />
          <input value={match.teamB} disabled={!isOwner || !!match.endedAt} list={NICKNAMES_DATALIST_ID} onChange={(e) => update({ ...match, teamB: e.target.value })} className="w-full bg-transparent text-center font-display text-2xl tracking-wider outline-none focus:text-primary md:text-4xl disabled:opacity-90" />
        </div>
        <NicknamesDatalist options={nicknames} />
        <Lineup teamA={match.teamA} teamB={match.teamB} canEdit={isAdmin && !match.endedAt} onChange={(a, b) => update({ ...match, teamA: a, teamB: b })} />
        {cfg.hasSets && <div className="mt-2 grid grid-cols-2 gap-3 text-center text-xs text-muted-foreground md:gap-8"><div>{cfg.setLabel}s won: <span className="font-mono text-primary">{setsA}</span></div><div>{cfg.setLabel}s won: <span className="font-mono text-primary">{setsB}</span></div></div>}
        <div className="mt-4 grid grid-cols-2 gap-3 md:gap-8">
          {(["a", "b"] as const).map((side) => {
            const score = side === "a" ? match.scoreA : match.scoreB;
            return <div key={side} className="rounded-2xl bg-background/60 p-4 md:p-8"><div className="led-digit text-center text-[6rem] leading-none md:text-[10rem]">{score}</div>{isOwner && !match.endedAt && <div className="mt-4 flex items-center justify-center gap-2"><button onClick={() => bump(side, -1)} className="h-12 w-12 rounded-full border border-border text-xl hover:bg-surface-2" aria-label="minus">−</button><button onClick={() => bump(side, 1)} className="h-16 flex-1 rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-[0_0_30px_-10px_var(--color-primary)] active:scale-95" aria-label="plus one">+1</button></div>}</div>;
          })}
        </div>
        {match.sets.length > 0 && <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm"><span className="text-muted-foreground">Previous {cfg.setLabel.toLowerCase()}s:</span>{match.sets.map((s, i) => <span key={i} className="rounded-md border border-border bg-background/60 px-2 py-1 font-mono">{s.a}–{s.b}</span>)}</div>}
        {isOwner && <div className="mt-8 flex flex-wrap justify-center gap-2">{cfg.hasSets && !match.endedAt && <button onClick={finishSet} className="rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20">End {cfg.setLabel}</button>}{!match.endedAt && <button onClick={resetScore} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">Reset score</button>}{!match.endedAt && <button onClick={finishMatch} disabled={finishBusy} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">{finishBusy ? "Ukončuji…" : "Finish match"}</button>}<button onClick={remove} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Delete</button>{!match.endedAt && <Link to="/live" search={{ id: match.id }} className="rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">📱 Live rozhodčí</Link>}</div>}
      </div>
      <BettingModule match={match} onRefresh={async () => { const m = await fetchMatch(match.id); if (m) setMatch(m); }} />
    </main>
  );
}

function splitPlayers(name: string): string[] { return name.split(/\s*(?:&|\/|,|\+| vs\.? | and )\s*/i).map((s) => s.trim()).filter(Boolean); }

function Lineup({ teamA, teamB, canEdit, onChange }: { teamA: string; teamB: string; canEdit: boolean; onChange: (a: string, b: string) => void }) {
  const a = splitPlayers(teamA); const b = splitPlayers(teamB); const total = a.length + b.length; if (total <= 2 && !canEdit) return null;
  const join = (arr: string[]) => arr.filter((s) => s.trim()).join(" & ");
  const setSide = (side: "a" | "b", players: string[]) => { const joined = join(players); if (side === "a") onChange(joined || teamA, teamB); else onChange(teamA, joined || teamB); };
  const updatePlayer = (side: "a" | "b", i: number, val: string) => { const src = side === "a" ? [...a] : [...b]; src[i] = val; setSide(side, src); };
  const removePlayer = (side: "a" | "b", i: number) => { const src = side === "a" ? [...a] : [...b]; src.splice(i, 1); setSide(side, src.length ? src : [""]); };
  const addPlayer = (side: "a" | "b") => { const src = side === "a" ? [...a, ""] : [...b, ""]; setSide(side, src); };
  return <div className="mt-6 grid grid-cols-2 gap-3 md:gap-8">{[{ players: a, key: "a" as const }, { players: b, key: "b" as const }].map((side, idx) => <div key={idx} className="rounded-2xl border border-border/60 bg-background/40 p-3 md:p-4"><div className="flex items-center justify-between"><span className={`text-[10px] font-mono uppercase tracking-[0.3em] ${idx === 0 ? "text-primary" : "text-accent"}`}>{idx === 0 ? "Team A" : "Team B"}</span><span className="text-[10px] text-muted-foreground">{side.players.length} {side.players.length === 1 ? "player" : "players"}</span></div><ul className="mt-2 space-y-1">{side.players.map((p, i) => <li key={i} className="flex items-center gap-2 text-sm"><span className={`inline-block h-2 w-2 rounded-full ${idx === 0 ? "bg-primary" : "bg-accent"}`} />{canEdit ? <><input value={p} list={NICKNAMES_DATALIST_ID} onChange={(e) => updatePlayer(side.key, i, e.target.value)} className="flex-1 rounded border border-border bg-background/60 px-2 py-1 text-sm outline-none focus:border-primary" /><button onClick={() => removePlayer(side.key, i)} className="text-muted-foreground hover:text-foreground" aria-label="Remove player">×</button></> : <span className="truncate"><NickLink nickname={p} /></span>}</li>)}</ul>{canEdit && <button onClick={() => addPlayer(side.key)} className="mt-2 text-xs text-primary hover:underline">+ Add player</button>}</div>)}</div>;
}
