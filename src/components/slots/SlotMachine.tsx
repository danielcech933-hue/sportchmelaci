import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Reel } from "./Reel";
import { ControlBar } from "./ControlBar";
import { SlotsScoreboard } from "./SlotsScoreboard";
import { PaytableModal } from "./PaytableModal";
import { BonusPickModal, BonusRecapModal, type BonusOption } from "./BonusModal";
import { BigWinOverlay } from "./BigWinOverlay";
import {
  MAX_BET,
  PAYLINES,
  REELS,
  START_BALANCE,
  evaluateSpin,
  formatKc,
  hasAnticipation,
  loadBestMultiplier,
  saveBestMultiplier,
  spinGrid,
  type Grid,
  type LineWin,
} from "@/lib/slots";

const STOP_BASE = 420;
const STOP_STEP = 230;
const ANTICIPATION_EXTRA = 900;

function randomBonusOptions(): BonusOption[] {
  const pool: BonusOption[] = [
    { spins: 10, mult: 2 },
    { spins: 15, mult: 3 },
    { spins: 20, mult: 2 },
    { spins: 25, mult: 4 },
    { spins: 30, mult: 3 },
    { spins: 50, mult: 8 },
  ];
  return [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
}

function fireConfetti() {
  const shoot = (x: number) =>
    confetti({
      particleCount: 90,
      spread: 80,
      startVelocity: 55,
      origin: { x, y: 0.75 },
      colors: ["#ffcc44", "#b8860b", "#4dffa6", "#fff3bf"],
      scalar: 1.1,
    });
  shoot(0.2);
  shoot(0.8);
  window.setTimeout(() => shoot(0.5), 250);
}

export function SlotMachine({ playerName }: { playerName: string }) {
  const [balance, setBalance] = useState(START_BALANCE);
  const [bet, setBet] = useState(10);
  const [grid, setGrid] = useState<Grid>(() => spinGrid());
  const [spinningReels, setSpinningReels] = useState<boolean[]>(() => Array(REELS).fill(false));
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

  const busy = spinningReels.some(Boolean);
  const timers = useRef<number[]>([]);

  useEffect(() => setBestMultiplier(loadBestMultiplier()), []);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const doSpin = useCallback(() => {
    if (busy || pickOptions || recap) return;
    const isFree = freeSpinsLeft > 0;
    if (!isFree && balance < bet) {
      setMessage("Nedostatek zůstatku — sniž sázku.");
      return;
    }

    setMessage(null);
    setWinLines([]);
    setScatterCells([]);
    setLastWin(0);
    setBigWin(null);

    if (isFree) setFreeSpinsLeft((n) => n - 1);
    else setBalance((b) => b - bet);

    const next = spinGrid();
    const tense = hasAnticipation(next);
    setSpinningReels(Array(REELS).fill(true));
    setAnticipation(false);

    for (let reel = 0; reel < REELS; reel++) {
      const extra = tense && reel >= 2 ? ANTICIPATION_EXTRA * (reel - 1) : 0;
      const at = STOP_BASE + reel * STOP_STEP + extra;
      if (tense && reel === 2) {
        timers.current.push(window.setTimeout(() => setAnticipation(true), STOP_BASE + STOP_STEP + 60));
      }
      timers.current.push(
        window.setTimeout(() => {
          setGrid((g) => g.map((col, i) => (i === reel ? next[reel] : col)));
          setSpinningReels((s) => s.map((v, i) => (i === reel ? false : v)));
          if (reel === REELS - 1) {
            setAnticipation(false);
            finish(next, isFree);
          }
        }, at),
      );
    }

    function finish(final: Grid, wasFree: boolean) {
      const mult = wasFree ? bonusMultiplier : 1;
      const res = evaluateSpin(final, bet, mult);
      setWinLines(res.lineWins);
      setScatterCells(res.scatterCount >= 3 ? res.scatterCells : []);
      setLastWin(res.total);

      if (res.total > 0) {
        setBalance((b) => b + res.total);
        if (wasFree) setBonusTotal((t) => t + res.total);
        const m = res.total / bet;
        if (m > bestMultiplier) setBestMultiplier(saveBestMultiplier(m));
        if (m >= 20) {
          setBigWin({ amount: res.total, multiplier: m });
          fireConfetti();
          timers.current.push(window.setTimeout(() => setBigWin(null), 3200));
        }
      }

      if (res.freeSpinsTriggered && !wasFree) {
        setBonusTotal(res.total);
        timers.current.push(window.setTimeout(() => setPickOptions(randomBonusOptions()), 700));
      }
    }
  }, [balance, bet, bestMultiplier, bonusMultiplier, busy, freeSpinsLeft, pickOptions, recap]);

  /* Free spins + autoplay driver */
  useEffect(() => {
    if (busy || pickOptions || recap) return;
    if (freeSpinsLeft > 0) {
      const t = window.setTimeout(doSpin, 900);
      return () => window.clearTimeout(t);
    }
    if (bonusSpinsGranted > 0) {
      setRecap({ total: bonusTotal, spins: bonusSpinsGranted, mult: bonusMultiplier });
      setBonusSpinsGranted(0);
      return;
    }
    if (autoLeft > 0) {
      const t = window.setTimeout(() => {
        setAutoLeft((n) => n - 1);
        doSpin();
      }, 700);
      return () => window.clearTimeout(t);
    }
  }, [busy, freeSpinsLeft, autoLeft, pickOptions, recap, bonusSpinsGranted, bonusTotal, bonusMultiplier, doSpin]);

  const winningRowsFor = (reel: number) => {
    const rows = new Set<number>();
    winLines.forEach((w) => w.cells.forEach(([r, row]) => r === reel && rows.add(row)));
    scatterCells.forEach(([r, row]) => r === reel && rows.add(row));
    return [...rows];
  };
  const hasWin = winLines.length > 0 || scatterCells.length > 0;

  return (
    <div className="relative">
      {/* stadion + chmel pozadí */}
      <div className="pointer-events-none absolute -inset-6 -z-10 overflow-hidden rounded-3xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_-10%,rgba(255,204,68,0.25),transparent_55%),radial-gradient(circle_at_85%_10%,rgba(77,255,166,0.18),transparent_50%),linear-gradient(180deg,#051f10,#020a05)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:repeating-linear-gradient(90deg,rgba(255,255,255,0.5)_0_1px,transparent_1px_44px)]" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div>
          {freeSpinsLeft > 0 || bonusSpinsGranted > 0 ? (
            <motion.div
              className="mb-3 flex items-center justify-between rounded-2xl border border-hop-gold/50 bg-hop-gold/10 px-4 py-2"
              initial={{ y: -14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
            >
              <span className="font-display text-sm tracking-[0.16em] slot-gold-text">FREE SPINY</span>
              <span className="font-mono text-xs text-hop-neon">
                zbývá {freeSpinsLeft} · {bonusMultiplier}x · {formatKc(bonusTotal)}
              </span>
            </motion.div>
          ) : null}

          <div className={`relative rounded-2xl slot-frame slot-led p-3 sm:p-4 ${anticipation ? "brightness-75" : ""}`}>
            <div className="relative flex gap-2 sm:gap-3">
              {grid.map((col, reel) => (
                <Reel
                  key={reel}
                  reelIndex={reel}
                  final={col}
                  spinning={spinningReels[reel]}
                  slow={anticipation && reel >= 2}
                  winningRows={winningRowsFor(reel)}
                  hasWin={hasWin}
                />
              ))}

              {/* zlaté výherní linie */}
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <AnimatePresence>
                  {winLines.map((w) => {
                    const pattern = PAYLINES[w.line];
                    const pts = pattern
                      .slice(0, w.count)
                      .map((row, reel) => `${(reel + 0.5) * (100 / REELS)},${(row + 0.5) * (100 / 3)}`)
                      .join(" ");
                    return (
                      <motion.polyline
                        key={w.line}
                        points={pts}
                        fill="none"
                        stroke="#ffcc44"
                        strokeWidth={1.1}
                        strokeLinecap="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: [0.4, 1, 0.7] }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, opacity: { duration: 1, repeat: Infinity } }}
                        style={{ filter: "drop-shadow(0 0 6px #ffcc44)" }}
                      />
                    );
                  })}
                </AnimatePresence>
              </svg>
            </div>

            <div className="mt-3 flex min-h-6 items-center justify-center text-center">
              {message ? (
                <span className="rounded-full border border-rose-400/50 bg-rose-500/10 px-3 py-1 text-[11px] font-bold text-rose-300">
                  {message}
                </span>
              ) : lastWin > 0 ? (
                <motion.span
                  key={lastWin}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="font-display text-sm tracking-[0.14em] slot-gold-text"
                >
                  VÝHRA {formatKc(lastWin)} · {(lastWin / bet).toFixed(1)}x
                </motion.span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-hop-neon/60">
                  5 válců · 3 řady · 5 linií
                </span>
              )}
            </div>
          </div>

          <ControlBar
            balance={balance}
            bet={bet}
            lastWin={lastWin}
            spinning={busy}
            freeSpinsLeft={freeSpinsLeft}
            autoLeft={autoLeft}
            onBet={setBet}
            onMaxBet={() => setBet(MAX_BET)}
            onSpin={doSpin}
            onAuto={(n) => setAutoLeft(n)}
            onStopAuto={() => setAutoLeft(0)}
            onInfo={() => setShowPaytable(true)}
            onHof={() => setShowHof(true)}
          />
        </div>

        <aside className="hidden lg:block">
          <SlotsScoreboard playerName={playerName} playerBest={bestMultiplier} />
        </aside>
      </div>

      <div className="mt-4 lg:hidden">
        <SlotsScoreboard playerName={playerName} playerBest={bestMultiplier} compact />
      </div>

      <AnimatePresence>
        {bigWin && <BigWinOverlay amount={bigWin.amount} multiplier={bigWin.multiplier} />}
        {showPaytable && <PaytableModal bet={bet} onClose={() => setShowPaytable(false)} />}
        {pickOptions && (
          <BonusPickModal
            options={pickOptions}
            onConfirm={(opt) => {
              setPickOptions(null);
              setBonusMultiplier(opt.mult);
              setFreeSpinsLeft(opt.spins);
              setBonusSpinsGranted(opt.spins);
              setAutoLeft(0);
            }}
          />
        )}
        {recap && (
          <BonusRecapModal
            total={recap.total}
            spins={recap.spins}
            mult={recap.mult}
            onClose={() => {
              setRecap(null);
              setBonusMultiplier(1);
              setBonusTotal(0);
              fireConfetti();
            }}
          />
        )}
        {showHof && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHof(false)}
          >
            <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <SlotsScoreboard playerName={playerName} playerBest={bestMultiplier} />
              <button
                onClick={() => setShowHof(false)}
                className="mx-auto mt-3 block rounded-full border border-hop-gold/50 px-5 py-2 text-xs font-bold uppercase tracking-[0.2em] text-hop-gold"
              >
                Zavřít
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
