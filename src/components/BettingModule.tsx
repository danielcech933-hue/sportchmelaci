import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { SPORTS, MIN_BET, betsPool, uniqueBettors, type Match } from "@/lib/matches";
import { placeMarketBet, withdrawBet } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { useMatchHistory, computeOdds, formatOdds, formatPct } from "@/lib/odds";
import { marketsFor, type MarketOption } from "@/lib/markets";
import { OddsBoard } from "@/components/OddsBoard";

const QUICK = [10, 50, 100, 500];

function prettyErr(msg: string): string {
  if (msg.includes("already_bet")) return "Na tento zápas už máš sázku.";
  if (msg.includes("insufficient_balance")) return "Nemáš dost peněz.";
  if (msg.includes("match_ended")) return "Zápas už skončil.";
  if (msg.includes("invalid_amount")) return `Minimální sázka je $${MIN_BET}.`;
  if (msg.includes("invalid_odds")) return "Neplatný kurz.";
  if (msg.includes("no_bet")) return "Není co stáhnout.";
  return msg;
}

function selectionLabel(option: MarketOption, match: Match) {
  return option.side === "a" ? match.teamA : option.side === "b" ? match.teamB : option.label;
}

export function BettingModule({ match, onRefresh }: { match: Match; onRefresh: () => Promise<void> }) {
  const { user, nickname, balance, refreshProfile } = useAuth();
  const { history, loading: histLoading } = useMatchHistory();
  const [amount, setAmount] = useState(10);
  const [tabId, setTabId] = useState("winner");
  const [optId, setOptId] = useState("win-a");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cfg = SPORTS[match.sport];
  const bets = match.bets ?? [];
  const pool = betsPool(bets);
  const nBettors = uniqueBettors(bets);
  const ended = !!match.endedAt;
  const settled = !!match.confirmedAt;
  const myBet = user ? bets.find((b) => b.userId === user.id || b.bettor === nickname) : undefined;

  const modelOdds = useMemo(() => computeOdds(match, history), [match, history]);
  const tabs = useMemo(() => marketsFor(match, modelOdds), [match, modelOdds]);
  const tab = tabs.find((t) => t.id === tabId) ?? tabs[0];
  const option: MarketOption = tab.options.find((o) => o.id === optId) ?? tab.options[0];
  const pick = option.side ?? "draw";
  const potentialWin = Math.round(amount * option.odds * 100) / 100;
  const myLockedOdds = myBet?.lockedOdds ?? null;
  const myPotential = myBet?.lockedOdds && myBet.amount ? Math.round(myBet.amount * myBet.lockedOdds * 100) / 100 : null;

  const totals = {
    a: bets.filter((b) => b.pick === "a").reduce((s, b) => s + (b.amount ?? 0), 0),
    b: bets.filter((b) => b.pick === "b").reduce((s, b) => s + (b.amount ?? 0), 0),
  };
  const pctA = pool ? (totals.a / pool) * 100 : 50;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || ended || myBet) return;
    if (!Number.isFinite(amount) || amount < MIN_BET) { setErr(`Minimální sázka je $${MIN_BET}.`); return; }
    if (amount > balance) { setErr("Nemáš dost peněz."); return; }
    setBusy(true); setErr(null);
    try {
      await placeMarketBet({
        matchId: match.id,
        marketId: tab.id,
        optionId: option.id,
        pick,
        amount,
        lockedOdds: option.odds,
        marketLabel: tab.label,
        selectionLabel: option.label,
        note,
      });
      setNote("");
      await Promise.all([refreshProfile(), onRefresh()]);
    } catch (e2: unknown) {
      setErr(prettyErr((e2 as { message?: string })?.message ?? "Sázka selhala"));
    } finally { setBusy(false); }
  }

  async function withdraw() {
    if (!myBet || ended) return;
    setBusy(true); setErr(null);
    try { await withdrawBet(match.id); await Promise.all([refreshProfile(), onRefresh()]); }
    catch (e: unknown) { setErr(prettyErr((e as { message?: string })?.message ?? "Nepovedlo se")); }
    finally { setBusy(false); }
  }

  const currentStatus = settled ? "SETTLED" : ended ? "ČEKÁ NA ADMINA" : `OPEN · ${nBettors}`;

  return (
    <>
      <OddsBoard match={match} history={history} loading={histLoading} betAmount={!myBet && !ended ? amount : 0} betPick={pick === "draw" ? "a" : pick} />
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: "easeOut" }} className="glass neon-border mt-6 overflow-hidden p-4 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl tracking-wider neon-text">💸 Sázkový terminál <span className="text-sm text-muted-foreground">· {cfg.emoji} {cfg.name}</span></h2>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Simulované kurzy · kurz se uzamkne při vsazení</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-primary">Pool ${pool}</span>
            <span className="rounded border border-accent/50 bg-accent/10 px-2 py-1 font-mono text-accent">{currentStatus}</span>
          </div>
        </div>

        <div className="mb-5">
          <div className="mb-1 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"><span>{match.teamA} · ${totals.a}</span><span>${totals.b} · {match.teamB}</span></div>
          <div className="flex h-2 overflow-hidden rounded-full bg-background/60"><motion.div className="bg-primary" animate={{ width: `${pctA}%` }} transition={{ duration: 0.5 }} /><motion.div className="bg-accent" animate={{ width: `${100 - pctA}%` }} transition={{ duration: 0.5 }} /></div>
        </div>

        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {tabs.map((t) => <button key={t.id} type="button" disabled={ended} onClick={() => { setTabId(t.id); setOptId(t.options[0].id); }} className={`glass-glow shrink-0 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition ${t.id === tab.id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"} disabled:opacity-40`}>{t.label}</button>)}
        </div>

        <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <span className="text-primary">Modelová marže:</span> {(tab.margin * 100).toFixed(1)} % · nejde o live kurz od bookmakerů.
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={tab.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {tab.options.map((o) => {
              const active = o.id === option.id;
              return <motion.button key={o.id} type="button" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} disabled={ended} onClick={() => setOptId(o.id)} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left transition ${active ? "border-accent bg-accent/15 shadow-[0_0_28px_-12px_var(--color-accent)]" : "border-border bg-background/40 hover:border-primary/60"} disabled:opacity-40`}><span className="min-w-0 truncate text-sm">{o.label}</span><span className={`shrink-0 font-mono text-base ${active ? "text-accent" : "text-primary"}`}>{formatOdds(o.odds)}</span></motion.button>;
            })}
          </motion.div>
        </AnimatePresence>

        <div className="mt-5">
          {!user ? <p className="text-sm text-muted-foreground"><Link to="/auth" className="text-primary hover:underline">Přihlas se</Link> a můžeš sázet.</p> : settled ? <p className="text-sm text-muted-foreground">Admin schválil výsledek. Sázky jsou vypořádané podle uzamčených kurzů.</p> : ended ? <p className="text-sm text-muted-foreground">Zápas skončil. Čeká se na schválení adminem, teprve potom proběhne vypořádání.</p> : myBet ? (
            <div className="rounded-xl border border-primary/50 bg-primary/10 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><span className="mr-2 rounded bg-primary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground">Tiket aktivní</span><span className="font-mono text-primary">${myBet.amount}</span> · {myBet.marketLabel ?? myBet.marketId ?? "Vítěz"} · {myBet.selectionLabel ?? (myBet.pick === "draw" ? "Remíza" : myBet.pick === "a" ? match.teamA : match.teamB)} · <span className="text-accent">@ {myLockedOdds?.toFixed(2)}</span></div><button onClick={withdraw} disabled={busy} className="glass-glow rounded border border-border px-3 py-1 text-xs disabled:opacity-50">Stáhnout sázku</button></div></div>
          ) : balance <= 0 ? <p className="rounded border p-3 text-sm" style={{ borderColor: "var(--danger)", color: "var(--danger)" }}>💀 Bankrot — žádný zůstatek na sázky.</p> : (
            <form onSubmit={submit} className="rounded-xl border border-primary/25 bg-background/40 p-3">
              <div className="flex flex-wrap items-center gap-2"><div className="relative flex-1 min-w-[140px]"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span><input value={String(amount)} onChange={(e)=>setAmount(Number(e.target.value.replace(/[^\d]/g,""))||0)} inputMode="numeric" className="w-full rounded-md border border-border bg-background/60 py-2 pl-6 pr-3 font-mono text-lg outline-none focus:border-primary" /></div>{QUICK.map(q=><motion.button key={q} type="button" whileTap={{scale:0.94}} onClick={()=>setAmount(a=>a+q)} className="glass-glow rounded-md border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-xs text-primary">+${q}</motion.button>)}<motion.button type="button" whileTap={{scale:0.94}} onClick={()=>setAmount(Math.floor(balance))} className="glass-glow rounded-md border border-accent bg-accent/15 px-3 py-2 font-mono text-xs font-bold uppercase tracking-[0.15em] text-accent">Max / All-in</motion.button></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3"><div className="rounded-lg border border-accent/40 bg-accent/5 p-2"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">Kurz</p><p className="font-mono text-xl text-accent">@ {formatOdds(option.odds)}</p></div><div className="rounded-lg border border-primary/40 bg-primary/5 p-2"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-primary">Potenciální výhra</p><p className="font-mono text-xl text-primary">${potentialWin.toFixed(2)}</p></div><div className="rounded-lg border border-border bg-background/40 p-2"><p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Šance modelu</p><p className="font-mono text-xl">{formatPct(option.modelProbability ?? 0.5)}</p></div></div>
              <input value={note} onChange={e=>setNote(e.target.value)} maxLength={80} placeholder="Poznámka (nepovinné)" className="mt-2 w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" />
              <motion.button type="submit" disabled={busy} whileHover={{scale:1.01}} whileTap={{scale:0.98}} className="mt-3 w-full rounded-md bg-accent px-4 py-3 font-display text-lg tracking-widest text-accent-foreground shadow-[0_0_30px_-10px_var(--color-accent)] disabled:opacity-50">{busy?"…":`VSADIT $${amount} · ${option.label}`}</motion.button>
              {err && <p className="mt-2 text-xs" style={{color:"var(--danger)"}}>{err}</p>}
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Zůstatek ${balance.toFixed(2)} · min ${MIN_BET} · kurz {formatOdds(option.odds)} · šance {formatPct(option.modelProbability ?? 0.5)}</p>
            </form>
          )}
          {myBet && myPotential !== null && <div className="mt-2 text-xs text-muted-foreground">Uzamčený kurz <b className="text-accent">@ {myLockedOdds?.toFixed(2)}</b> · potenciální návrat ${myPotential.toFixed(2)}</div>}
        </div>

        {bets.length===0 ? <p className="mt-4 text-center text-sm text-muted-foreground">Zatím žádné sázky. Kdo je odvážný?</p> : <ul className="mt-4 divide-y divide-border/60">{bets.map(b=>{const status=b.status??"open"; const mine=user&&(b.userId===user.id||b.bettor===nickname); const selection=b.selectionLabel ?? (b.pick==="draw"?"Remíza":b.pick==="a"?match.teamA:match.teamB); return <li key={b.id} className="flex flex-wrap items-center gap-2 py-2 text-sm"><span className={`inline-block h-2 w-2 shrink-0 rounded-full ${b.pick==="a"?"bg-primary":b.pick==="b"?"bg-accent":"bg-foreground"}`} /><span className="min-w-0 flex-1 truncate font-semibold">{b.bettor}{mine&&<span className="ml-1 text-[10px] text-primary">(ty)</span>}<span className="ml-2 text-[10px] text-muted-foreground">{b.marketLabel??b.marketId??"Vítěz"} · {selection} @ {b.lockedOdds?.toFixed(2) ?? "—"}</span></span><span className="font-mono text-primary">${b.amount??0}</span>{status==="won"&&<span className="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">WON +${b.payout??0}</span>}{status==="lost"&&<span className="rounded px-2 py-0.5 text-xs" style={{background:"color-mix(in oklab, var(--danger) 20%, transparent)",color:"var(--danger)"}}>LOST</span>}{status==="refunded"&&<span className="rounded bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">REFUND</span>}</li>})}</ul>}
      </motion.section>
    </>
  );
}
