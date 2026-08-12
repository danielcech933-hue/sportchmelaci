import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Reel } from "./Reel";
import { ControlBar } from "./ControlBar";
import { SlotsScoreboard } from "./SlotsScoreboard";
import { PaytableModal } from "./PaytableModal";
import { BonusPickModal, BonusRecapModal, type BonusOption } from "./BonusModal";
import { BigWinOverlay } from "./BigWinOverlay";
import { MAX_BET, PAYLINES, REELS, ROWS, formatKc, loadBestMultiplier, saveBestMultiplier, spinGrid, type Grid, type LineWin } from "@/lib/slots";
import { useWallet } from "@/lib/wallet";

const SPIN_DURATION = 2500;
const STOP_STEP = 200;
const STOP_BASE = SPIN_DURATION - STOP_STEP * (REELS - 1);

function fireConfetti() {
  const shoot = (x: number) => confetti({ particleCount: 90, spread: 80, startVelocity: 55, origin: { x, y: 0.75 }, colors: ["#ffcc44", "#b8860b", "#4dffa6", "#fff3bf"], scalar: 1.1 });
  shoot(0.2); shoot(0.8); window.setTimeout(() => shoot(0.5), 250);
}

function normalizeGrid(value: unknown): Grid {
  const fallback = spinGrid();
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: REELS }, (_, reel) => {
    const column = Array.isArray(source[reel]) ? source[reel] : [];
    return Array.from({ length: ROWS }, (_, row) => column[row] ?? fallback[reel][row]);
  }) as Grid;
}

export function SlotMachine({ playerName, onExchange, onWin }: { playerName: string; onExchange?: () => void; onWin?: (multiplier: number) => void }) {
  const { slotCZK, spinSlot, pickBonus } = useWallet();
  const [isSpinning, setIsSpinning] = useState(false);
  const [bet, setBet] = useState(10);
  const [grid, setGrid] = useState<Grid>(() => spinGrid());
  const [stoppedReels, setStoppedReels] = useState(REELS);
  const [anticipation, setAnticipation] = useState(false);
  const [winLines, setWinLines] = useState<LineWin[]>([]);
  const [scatterCells, setScatterCells] = useState<[number, number][]>([]);
  const [lastWin, setLastWin] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [freeSpinsLeft, setFreeSpinsLeft] = useState(0);
  const [bonusMultiplier, setBonusMultiplier] = useState(1);
  const [bonusTotal, setBonusTotal] = useState(0);
  const [bonusSpinsGranted, setBonusSpinsGranted] = useState(0);
  const [pickOptions, setPickOptions] = useState<BonusOption[] | null>(null);
  const [recap, setRecap] = useState<{ total: number; spins: number; mult: number } | null>(null);
  const [bigWin, setBigWin] = useState<{ amount: number; multiplier: number } | null>(null);
  const [showPaytable, setShowPaytable] = useState(false);
  const [showHof, setShowHof] = useState(false);
  const [bestMultiplier, setBestMultiplier] = useState(0);
  const [autoLeft, setAutoLeft] = useState(0);
  const busy = isSpinning;
  const timers = useRef<number[]>([]);

  useEffect(() => setBestMultiplier(loadBestMultiplier()), []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const doSpin = useCallback(async () => {
    if (busy || pickOptions || recap) return;
    const isFree = freeSpinsLeft > 0;
    if (!isFree && slotCZK < bet) { setMessage("Nedostatek Slot CZK — sniž sázku nebo použij směnárnu."); setAutoLeft(0); return; }
    setMessage(null); setWinLines([]); setScatterCells([]); setLastWin(0); setBigWin(null); setIsSpinning(true); setStoppedReels(0); setAnticipation(false);
    const response = await spinSlot(isFree ? 0 : bet);
    if (!response.ok || !response.result) { setIsSpinning(false); setStoppedReels(REELS); setMessage(response.error ?? "Točka se nepovedla. Zkus to znovu."); setAutoLeft(0); return; }
    const result = response.result;
    const next = normalizeGrid(result.grid);
    setGrid(next);
    const stopTimers = Array.from({ length: REELS }, (_, reel) => window.setTimeout(() => { setStoppedReels(reel + 1); if (reel === REELS - 1) { setAnticipation(false); setIsSpinning(false); } }, STOP_BASE + reel * STOP_STEP));
    timers.current.push(...stopTimers);
    setTimeout(() => {
      const wins = (result.line_wins ?? []) as LineWin[];
      setWinLines(wins); setScatterCells(result.scatter_count >= 3 ? result.scatter_cells : []); setLastWin(Number(result.total ?? 0)); setFreeSpinsLeft(Number(result.free_spins_left ?? 0)); setBonusTotal(Number(result.bonus_total ?? 0));
      const total = Number(result.total ?? 0); const m = Number(result.multiplier_of_bet ?? 0);
      if (total > 0) { if (m > bestMultiplier) setBestMultiplier(saveBestMultiplier(m)); if (m >= 10) onWin?.(m); if (m >= 20) { setBigWin({ amount: total, multiplier: m }); fireConfetti(); timers.current.push(window.setTimeout(() => setBigWin(null), 3200)); } }
      if (!isFree && result.free_spins_triggered && result.bonus_options?.length) setPickOptions(result.bonus_options);
      if (isFree && result.bonus_done) { setRecap({ total: Number(result.bonus_total ?? 0), spins: bonusSpinsGranted, mult: bonusMultiplier }); setBonusSpinsGranted(0); }
    }, STOP_BASE + (REELS - 1) * STOP_STEP + 50);
  }, [bestMultiplier, bet, bonusMultiplier, bonusSpinsGranted, busy, freeSpinsLeft, onWin, pickOptions, recap, slotCZK, spinSlot]);

  useEffect(() => {
    if (busy || pickOptions || recap) return;
    if (freeSpinsLeft > 0) { const t = window.setTimeout(() => void doSpin(), 900); return () => window.clearTimeout(t); }
    if (autoLeft > 0) { const t = window.setTimeout(() => { setAutoLeft((n) => n - 1); void doSpin(); }, 700); return () => window.clearTimeout(t); }
  }, [busy, freeSpinsLeft, autoLeft, pickOptions, recap, doSpin]);

  const winningRowsFor = (reel: number) => { const rows = new Set<number>(); winLines.forEach((w) => w.cells.forEach(([r, row]) => r === reel && rows.add(row))); scatterCells.forEach(([r, row]) => r === reel && rows.add(row)); return [...rows]; };
  const hasWin = winLines.length > 0 || scatterCells.length > 0;

  return (
    <div className="relative" data-slot-spinning={busy ? "true" : "false"}>
      <div className="pointer-events-none absolute -inset-8 -z-10 overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_15%_0%,rgba(255,204,68,.28),transparent_38%),radial-gradient(circle_at_90%_12%,rgba(77,255,166,.2),transparent_35%),linear-gradient(160deg,#092d18,#020a05_55%,#07180d)] shadow-[0_35px_100px_-35px_rgba(0,0,0,.95)]" />
      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-hop-gold/30 bg-black/40 px-4 py-2.5 backdrop-blur-xl">
        <div><p className="font-display text-base tracking-[.18em] slot-gold-text">CHMELOVCI CUP</p><p className="font-mono text-[8px] uppercase tracking-[.24em] text-hop-neon/60">SPORTOVNÍ SLOT · 5 VÁLCŮ / 3 ŘADY</p></div>
        <div className="hidden rounded-lg border border-hop-gold/20 bg-hop-gold/5 px-3 py-1 text-right sm:block"><p className="font-mono text-[8px] uppercase tracking-widest text-hop-gold/60">STATUS</p><p className={`font-display text-xs ${busy ? "text-hop-gold" : "text-hop-neon"}`}>{busy ? "TOČÍME" : "READY"}</p></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div>
          {freeSpinsLeft > 0 || bonusSpinsGranted > 0 ? <motion.div className="mb-3 flex items-center justify-between rounded-2xl border border-hop-gold/50 bg-hop-gold/10 px-4 py-2" initial={{ y: -14, opacity: 0 }} animate={{ y: 0, opacity: 1 }}><span className="font-display text-sm tracking-[.16em] slot-gold-text">FREE SPINY</span><span className="font-mono text-xs text-hop-neon">zbývá {freeSpinsLeft} · {bonusMultiplier}x · {formatKc(bonusTotal)}</span></motion.div> : null}
          <div className={`relative rounded-[1.5rem] border border-hop-gold/45 bg-[linear-gradient(145deg,#0b351e,#03140a_45%,#061b0f)] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_25px_70px_-35px_rgba(255,204,68,.8)] sm:p-4 ${anticipation ? "brightness-75" : ""}`}>
            <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-hop-gold/70 to-transparent" />
            <div className="relative rounded-xl border border-hop-gold/15 bg-black/35 p-2 sm:p-3"><div className="relative flex gap-2 sm:gap-3">
              {grid.slice(0, REELS).map((col, reel) => <Reel key={reel} reelIndex={reel} final={col.slice(0, ROWS)} spinning={isSpinning && reel >= stoppedReels} slow={anticipation && reel >= 2} winningRows={winningRowsFor(reel)} hasWin={hasWin} />)}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none"><AnimatePresence>{winLines.map((w) => { const pattern = PAYLINES[w.line]; if (!pattern) return null; const pts = pattern.slice(0, w.count).map((row, reel) => `${(reel + .5) * (100 / REELS)},${(row + .5) * (100 / ROWS)}`).join(" "); return <motion.polyline key={w.line} points={pts} fill="none" stroke="#ffcc44" strokeWidth={1.1} strokeLinecap="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: [.4, 1, .7] }} exit={{ opacity: 0 }} transition={{ duration: .5, opacity: { duration: 1, repeat: Infinity } }} style={{ filter: "drop-shadow(0 0 6px #ffcc44)" }} />; })}</AnimatePresence></svg>
            </div></div>
            <div className="mt-3 flex min-h-7 items-center justify-center text-center">{message ? <span className="flex flex-wrap items-center justify-center gap-2"><span className="rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-1 text-[11px] font-bold text-rose-300">{message}</span>{onExchange && <button onClick={onExchange} className="rounded-full border border-hop-gold/50 bg-hop-gold/15 px-3 py-1 text-[11px] font-black uppercase tracking-[.14em] text-hop-gold">Směnárna</button>}</span> : lastWin > 0 ? <motion.span key={lastWin} initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-sm tracking-[.14em] slot-gold-text">VÝHRA {formatKc(lastWin)} · {(lastWin / bet).toFixed(1)}x</motion.span> : <span className="font-mono text-[10px] uppercase tracking-[.28em] text-hop-neon/60">5 VÁLCŮ · 3 ŘADY · 5 LINIÍ</span>}</div>
          </div>
          <ControlBar balance={slotCZK} bet={bet} lastWin={lastWin} spinning={busy} freeSpinsLeft={freeSpinsLeft} autoLeft={autoLeft} onBet={setBet} onMaxBet={() => setBet(MAX_BET)} onSpin={() => void doSpin()} onAuto={(n) => setAutoLeft(n)} onStopAuto={() => setAutoLeft(0)} onInfo={() => setShowPaytable(true)} onHof={() => setShowHof(true)} />
        </div>
        <aside className="hidden lg:block"><SlotsScoreboard playerName={playerName} playerBest={bestMultiplier} /></aside>
      </div>
      <div className="mt-4 lg:hidden"><SlotsScoreboard playerName={playerName} playerBest={bestMultiplier} compact /></div>
      <AnimatePresence>{bigWin && <BigWinOverlay amount={bigWin.amount} multiplier={bigWin.multiplier} />}{showPaytable && <PaytableModal bet={bet} onClose={() => setShowPaytable(false)} />}{pickOptions && <BonusPickModal options={pickOptions} onConfirm={async (opt) => { const res = await pickBonus(opt.mult); if (!res.ok) { setMessage(res.error ?? "Volba bonusu se nepovedla."); return; } setPickOptions(null); setBonusMultiplier(opt.mult); setFreeSpinsLeft(opt.spins); setBonusSpinsGranted(opt.spins); setBonusTotal(0); setAutoLeft(0); }} />}{recap && <BonusRecapModal total={recap.total} spins={recap.spins} mult={recap.mult} onClose={() => { setRecap(null); setBonusMultiplier(1); setBonusTotal(0); fireConfetti(); }} />}{showHof && <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 1 }} onClick={() => setShowHof(false)}><div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}><SlotsScoreboard playerName={playerName} playerBest={bestMultiplier} /><button onClick={() => setShowHof(false)} className="mx-auto mt-3 block rounded-full border border-hop-gold/50 px-5 py-2 text-xs font-bold uppercase tracking-[.2em] text-hop-gold">Zavřít</button></div></motion.div>}</AnimatePresence>
    </div>
  );
}
