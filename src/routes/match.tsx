import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { SPORTS, type Match, MAX_BET, MIN_BET, betsPool, uniqueBettors } from "@/lib/matches";
import { fetchMatch, saveMatch, removeMatch, placeBet, withdrawBet } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { useNicknames, NicknamesDatalist, NICKNAMES_DATALIST_ID } from "@/lib/nicknames";

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
  const dirty = useRef(false);

  useEffect(() => {
    fetchMatch(id).then((m) => {
      if (!m) setNotFound(true);
      else setMatch(m);
    });
  }, [id]);

  // Debounced persistence for owner edits
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
        <p className="text-muted-foreground">Match not found.</p>
        <Link to="/" className="mt-4 inline-block text-primary hover:underline">← Lobby</Link>
      </main>
    );
  }
  if (!match || authLoading) return null;

  const cfg = SPORTS[match.sport];
  const isOwner = !!user && user.id === match.ownerId;

  function update(next: Match) {
    dirty.current = true;
    setMatch(next);
  }

  const bump = (side: "a" | "b", delta: number) => {
    if (!isOwner) return;
    const key = side === "a" ? "scoreA" : "scoreB";
    update({ ...match, [key]: Math.max(0, match[key] + delta) });
  };
  const finishSet = () => {
    if (!isOwner) return;
    update({ ...match, sets: [...match.sets, { a: match.scoreA, b: match.scoreB }], scoreA: 0, scoreB: 0 });
  };
  const finishMatch = async () => {
    if (!isOwner) return;
    const next = { ...match, endedAt: Date.now() };
    setMatch(next);
    dirty.current = false;
    await saveMatch(next);
    navigate({ to: "/history" });
  };
  const resetScore = () => isOwner && update({ ...match, scoreA: 0, scoreB: 0 });
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
        <span className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
          {cfg.emoji} {cfg.name} · by {match.ownerNickname}
        </span>
      </div>

      {!isOwner && (
        <div className="panel mb-4 p-3 text-center text-xs text-muted-foreground">
          You're spectating. Only <span className="text-primary">{match.ownerNickname}</span> can update this match.
        </div>
      )}

      <div className="panel p-4 md:p-8">
        <div className="grid grid-cols-2 gap-3 md:gap-8">
          <input
            value={match.teamA}
            disabled={!isOwner}
            list={NICKNAMES_DATALIST_ID}
            onChange={(e) => update({ ...match, teamA: e.target.value })}
            className="w-full bg-transparent text-center font-display text-2xl tracking-wider outline-none focus:text-primary md:text-4xl disabled:opacity-90"
          />
          <input
            value={match.teamB}
            disabled={!isOwner}
            list={NICKNAMES_DATALIST_ID}
            onChange={(e) => update({ ...match, teamB: e.target.value })}
            className="w-full bg-transparent text-center font-display text-2xl tracking-wider outline-none focus:text-primary md:text-4xl disabled:opacity-90"
          />
        </div>
        <NicknamesDatalist options={nicknames} />

        <Lineup teamA={match.teamA} teamB={match.teamB} canEdit={isAdmin} onChange={(a, b) => update({ ...match, teamA: a, teamB: b })} />


        {cfg.hasSets && (
          <div className="mt-2 grid grid-cols-2 gap-3 text-center text-xs text-muted-foreground md:gap-8">
            <div>{cfg.setLabel}s won: <span className="font-mono text-primary">{setsA}</span></div>
            <div>{cfg.setLabel}s won: <span className="font-mono text-primary">{setsB}</span></div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 md:gap-8">
          {(["a", "b"] as const).map((side) => {
            const score = side === "a" ? match.scoreA : match.scoreB;
            return (
              <div key={side} className="rounded-2xl bg-background/60 p-4 md:p-8">
                <div className="led-digit text-center text-[6rem] leading-none md:text-[10rem]">{score}</div>
                {isOwner && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button onClick={() => bump(side, -1)} className="h-12 w-12 rounded-full border border-border text-xl hover:bg-surface-2" aria-label="minus">−</button>
                    <button onClick={() => bump(side, 1)} className="h-16 flex-1 rounded-full bg-primary text-2xl font-bold text-primary-foreground shadow-[0_0_30px_-10px_var(--color-primary)] active:scale-95" aria-label="plus one">+1</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {match.sets.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">Previous {cfg.setLabel.toLowerCase()}s:</span>
            {match.sets.map((s, i) => (
              <span key={i} className="rounded-md border border-border bg-background/60 px-2 py-1 font-mono">{s.a}–{s.b}</span>
            ))}
          </div>
        )}

        {isOwner && (
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {cfg.hasSets && (
              <button onClick={finishSet} className="rounded-md border border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/20">
                End {cfg.setLabel}
              </button>
            )}
            <button onClick={resetScore} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-surface-2">Reset score</button>
            <button onClick={finishMatch} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Finish match</button>
            <button onClick={remove} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Delete</button>
          </div>
        )}
      </div>

      <BetsPanel match={match} onRefresh={async () => { const m = await fetchMatch(match.id); if (m) setMatch(m); }} />
    </main>
  );
}

function BetsPanel({ match, onRefresh }: { match: Match; onRefresh: () => Promise<void> }) {
  const { user, nickname, balance, refreshProfile } = useAuth();
  const [pick, setPick] = useState<"a" | "b">("a");
  const [amount, setAmount] = useState<string>("10");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const bets = match.bets ?? [];
  const pool = betsPool(bets);
  const nBettors = uniqueBettors(bets);
  const ended = !!match.endedAt;
  const myBet = user ? bets.find((b) => b.userId === user.id || b.bettor === nickname) : undefined;
  const canBet = !!user && !myBet && !ended && balance > 0;
  const totals = {
    a: bets.filter((b) => b.pick === "a").reduce((s, b) => s + (b.amount ?? 0), 0),
    b: bets.filter((b) => b.pick === "b").reduce((s, b) => s + (b.amount ?? 0), 0),
  };
  const countA = bets.filter((b) => b.pick === "a").length;
  const countB = bets.filter((b) => b.pick === "b").length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canBet) return;
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < MIN_BET || amt > MAX_BET) {
      setErr(`Amount must be $${MIN_BET}–$${MAX_BET}`);
      return;
    }
    if (amt > balance) { setErr("Insufficient balance"); return; }
    setBusy(true); setErr(null);
    try {
      await placeBet(match.id, pick, amt, note.trim().slice(0, 120));
      setAmount("10"); setNote("");
      await Promise.all([refreshProfile(), onRefresh()]);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? "Bet failed";
      setErr(prettyErr(msg));
    } finally { setBusy(false); }
  }

  async function withdraw() {
    if (!myBet || ended) return;
    setBusy(true); setErr(null);
    try {
      await withdrawBet(match.id);
      await Promise.all([refreshProfile(), onRefresh()]);
    } catch (e: unknown) {
      setErr(prettyErr((e as { message?: string })?.message ?? "Withdraw failed"));
    } finally { setBusy(false); }
  }

  return (
    <section className="panel neon-border mt-6 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl tracking-wider neon-text">💸 Betting board</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Max sázka ${MAX_BET} · 1 sázka na hráče
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-primary">Pool ${pool}</span>
          {ended ? (
            <span className="rounded border border-accent/50 bg-accent/10 px-2 py-1 font-mono text-accent">SETTLED</span>
          ) : (
            <span className="rounded border border-border px-2 py-1 font-mono text-muted-foreground">
              OPEN · {nBettors} {nBettors === 1 ? "sázející" : "sázejících"}
            </span>
          )}
        </div>
      </div>

      {/* Split visualization */}
      <div className="mb-4">
        <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span>{match.teamA} · {countA} · ${totals.a}</span>
          <span>${totals.b} · {countB} · {match.teamB}</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-background/60">
          <div className="bg-primary" style={{ width: `${pool ? (totals.a / pool) * 100 : 50}%` }} />
          <div className="bg-accent" style={{ width: `${pool ? (totals.b / pool) * 100 : 50}%` }} />
        </div>
      </div>

      {!user ? (
        <p className="text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">Sign in</Link> to place a bet ($1000 starting balance).
        </p>
      ) : ended ? (
        <p className="text-sm text-muted-foreground">Match is over. Bets have been settled.</p>
      ) : myBet ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Your bet: <span className="font-mono text-primary">${myBet.amount}</span> on{" "}
              <span className="font-semibold">{myBet.pick === "a" ? match.teamA : match.teamB}</span>
              {myBet.note && <span className="text-muted-foreground"> · "{myBet.note}"</span>}
            </span>
            {!locked && (
              <button onClick={withdraw} disabled={busy}
                className="rounded border border-border px-3 py-1 text-xs hover:bg-surface-2 disabled:opacity-50">
                Withdraw
              </button>
            )}
          </div>
          {locked && <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-accent">Locked — cannot withdraw</p>}
        </div>
      ) : balance <= 0 ? (
        <p className="rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger" style={{ color: "var(--danger)" }}>
          💀 Bankrupt — no balance left to bet with.
        </p>
      ) : (
        <form onSubmit={submit} className="grid gap-2 md:grid-cols-[auto_auto_1fr_auto]">
          <div className="flex overflow-hidden rounded-md border border-border">
            <button type="button" onClick={() => setPick("a")}
              className={`px-3 py-2 text-xs font-semibold ${pick === "a" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {match.teamA.slice(0, 14) || "A"}
            </button>
            <button type="button" onClick={() => setPick("b")}
              className={`px-3 py-2 text-xs font-semibold ${pick === "b" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}>
              {match.teamB.slice(0, 14) || "B"}
            </button>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              inputMode="numeric" placeholder="10" min={MIN_BET} max={MAX_BET}
              className="w-full rounded-md border border-border bg-background/60 py-2 pl-6 pr-3 text-sm outline-none focus:border-primary" />
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="Note (optional)"
            className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" />
          <button type="submit" disabled={busy}
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:brightness-110 disabled:opacity-50">
            {busy ? "…" : `Bet $${amount || 0}`}
          </button>
          {err && <p className="md:col-span-4 text-xs text-danger" style={{ color: "var(--danger)" }}>{err}</p>}
          <p className="md:col-span-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Balance ${balance.toFixed(2)} · min ${MIN_BET} · max ${MAX_BET}
          </p>
        </form>
      )}

      {bets.length === 0 ? (
        <p className="mt-4 text-center text-sm text-muted-foreground">No bets yet. Who's brave?</p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60">
          {bets.map((b) => {
            const status = b.status ?? "open";
            const mine = user && (b.userId === user.id || b.bettor === nickname);
            return (
              <li key={b.id} className="flex items-center gap-2 py-2 text-sm">
                <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${b.pick === "a" ? "bg-primary" : "bg-accent"}`} />
                <span className="min-w-0 flex-1 truncate font-semibold">{b.bettor}{mine && <span className="ml-1 text-[10px] text-primary">(you)</span>}</span>
                <span className="hidden rounded bg-background/60 px-2 py-0.5 text-xs text-muted-foreground sm:inline">
                  on {b.pick === "a" ? match.teamA : match.teamB}
                </span>
                <span className="font-mono text-primary">${b.amount ?? 0}</span>
                {status === "won" && <span className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">WON +${b.payout ?? 0}</span>}
                {status === "lost" && <span className="rounded px-2 py-0.5 text-xs" style={{ background: "color-mix(in oklab, var(--danger) 20%, transparent)", color: "var(--danger)" }}>LOST</span>}
                {status === "refunded" && <span className="rounded bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">REFUND</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function prettyErr(msg: string): string {
  if (msg.includes("already_bet")) return "You already placed a bet on this match.";
  if (msg.includes("insufficient_balance")) return "Not enough balance.";
  if (msg.includes("bets_locked")) return "Bets are locked — cannot change now.";
  if (msg.includes("match_ended")) return "Match already finished.";
  if (msg.includes("invalid_amount")) return `Amount must be $${MIN_BET}–$${MAX_BET}.`;
  if (msg.includes("no_bet")) return "No bet to withdraw.";
  return msg;
}


function splitPlayers(name: string): string[] {
  return name.split(/\s*(?:&|\/|,|\+| vs\.? | and )\s*/i).map((s) => s.trim()).filter(Boolean);
}

function Lineup({ teamA, teamB, canEdit, onChange }: { teamA: string; teamB: string; canEdit: boolean; onChange: (a: string, b: string) => void }) {
  const a = splitPlayers(teamA);
  const b = splitPlayers(teamB);
  const total = a.length + b.length;
  if (total <= 2 && !canEdit) return null;

  const join = (arr: string[]) => arr.filter((s) => s.trim()).join(" & ");
  const setSide = (side: "a" | "b", players: string[]) => {
    const joined = join(players);
    if (side === "a") onChange(joined || teamA, teamB);
    else onChange(teamA, joined || teamB);
  };
  const updatePlayer = (side: "a" | "b", i: number, val: string) => {
    const src = side === "a" ? [...a] : [...b];
    src[i] = val;
    setSide(side, src);
  };
  const removePlayer = (side: "a" | "b", i: number) => {
    const src = side === "a" ? [...a] : [...b];
    src.splice(i, 1);
    setSide(side, src.length ? src : [""]);
  };
  const addPlayer = (side: "a" | "b") => {
    const src = side === "a" ? [...a, ""] : [...b, ""];
    setSide(side, src);
  };

  return (
    <div className="mt-6 grid grid-cols-2 gap-3 md:gap-8">
      {[
        { players: a, key: "a" as const },
        { players: b, key: "b" as const },
      ].map((side, idx) => (
        <div key={idx} className="rounded-2xl border border-border/60 bg-background/40 p-3 md:p-4">
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-mono uppercase tracking-[0.3em] ${idx === 0 ? "text-primary" : "text-accent"}`}>
              {idx === 0 ? "Team A" : "Team B"}
            </span>
            <span className="text-[10px] text-muted-foreground">{side.players.length} {side.players.length === 1 ? "player" : "players"}</span>
          </div>
          <ul className="mt-2 space-y-1">
            {side.players.map((p, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className={`inline-block h-2 w-2 rounded-full ${idx === 0 ? "bg-primary" : "bg-accent"}`} />
                {canEdit ? (
                  <>
                    <input
                      value={p}
                      list={NICKNAMES_DATALIST_ID}
                      onChange={(e) => updatePlayer(side.key, i, e.target.value)}
                      className="flex-1 rounded border border-border bg-background/60 px-2 py-1 text-sm outline-none focus:border-primary"
                    />
                    <button onClick={() => removePlayer(side.key, i)} className="text-muted-foreground hover:text-foreground" aria-label="Remove player">×</button>
                  </>
                ) : (
                  <span className="truncate">{p}</span>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <button onClick={() => addPlayer(side.key)} className="mt-2 text-xs text-primary hover:underline">
              + Add player
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
