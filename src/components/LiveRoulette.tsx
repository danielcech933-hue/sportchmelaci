import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

// Definice červených čísel
const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const REDS_SET = new Set(RED_NUMBERS);

// Reálné pořadí čísel na evropském ruletovém kole (po směru hodinových ručiček)
const WHEEL_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
];

// Mřížka stolu (3x12)
const BOARD_GRID = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

interface BetMap {
  [key: string]: number;
}

export function LiveRoulette() {
  const { balance = 0, updateBalance, refreshProfile } = useAuth();

  // Stavy
  const [selectedChip, setSelectedChip] = useState<number>(10);
  const [bets, setBets] = useState<BetMap>({});
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [lastWinningNumber, setLastWinningNumber] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);

  // Ref pro bezpečný přístup k aktuálním sázkám
  const betsRef = useRef<BetMap>({});
  betsRef.current = bets;

  // Celková hodnota sázek
  const totalBetAmount = Object.values(bets).reduce((a, b) => a + b, 0);

  // Přidání sázky
  const handlePlaceBet = (betKey: string) => {
    if (isSpinning) return;
    if (balance < totalBetAmount + selectedChip) {
      toast.error("Nedostatek prostředků na účtu.");
      return;
    }

    setBets((prev) => ({
      ...prev,
      [betKey]: (prev[betKey] || 0) + selectedChip,
    }));
  };

  const clearBets = () => {
    if (isSpinning) return;
    setBets({});
  };

  // Spuštění točení rulety s výpočtem výher
  const spinWheel = async () => {
    if (totalBetAmount === 0) {
      toast.error("Nejprve polož sázky na stůl!");
      return;
    }
    if (balance < totalBetAmount) {
      toast.error("Nemáš dostatečný zůstatek na tyto sázky.");
      return;
    }
    if (isSpinning) return;

    setIsSpinning(true);

    const currentBets = { ...betsRef.current };

    if (updateBalance) {
      await updateBalance(-totalBetAmount);
    }

    const winningIndex = Math.floor(Math.random() * WHEEL_NUMBERS.length);
    const winningNum = WHEEL_NUMBERS[winningIndex];

    const segmentAngle = 360 / WHEEL_NUMBERS.length;
    const extraSpins = 360 * 5;
    const targetAngle = extraSpins + (360 - winningIndex * segmentAngle);

    setWheelRotation((prev) => prev + targetAngle);

    setTimeout(async () => {
      setLastWinningNumber(winningNum);
      setHistory((prev) => [winningNum, ...prev.slice(0, 8)]);

      let totalPayout = 0;
      Object.entries(currentBets).forEach(([key, amount]) => {
        totalPayout += calculateBetPayout(key, amount, winningNum);
      });

      if (totalPayout > 0) {
        toast.success(`🎉 Výhra! Získáváš $${totalPayout}`);
        if (updateBalance) {
          await updateBalance(totalPayout);
        }
      } else {
        toast.error("Tentokrát to nevyšlo.");
      }

      if (refreshProfile) {
        await refreshProfile();
      }

      setBets({});
      setIsSpinning(false);
    }, 4000);
  };

  return (
    <div className="space-y-6 select-none">
      {/* VISUÁL RULETOVÉHO KOLA S ANIMACÍ */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-zinc-950 via-black to-zinc-950 p-6 backdrop-blur-xl shadow-2xl flex flex-col items-center">
        <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400 flex items-center gap-1 mb-4">
          <Sparkles className="h-3 w-3" /> Royal European Roulette
        </span>

        <div className="relative flex items-center justify-center my-2">
          <div className="absolute -top-3 z-20 h-4 w-4 rounded-full bg-amber-400 border-2 border-white shadow-lg shadow-amber-500/50" />

          <motion.div
            animate={{ rotate: wheelRotation }}
            transition={{ duration: 4, ease: [0.15, 0.85, 0.35, 1.0] }}
            className="relative flex h-52 w-52 items-center justify-center rounded-full border-8 border-amber-600/40 bg-gradient-to-tr from-zinc-900 via-zinc-800 to-zinc-900 shadow-2xl"
          >
            <div className="z-10 flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 border-amber-500/50 bg-black/90 shadow-inner">
              <span className="font-mono text-[9px] uppercase text-zinc-500">POSLEDNÍ</span>
              <span
                className={cn(
                  "font-display text-3xl font-black",
                  lastWinningNumber === 0 && "text-emerald-400",
                  lastWinningNumber !== null && REDS_SET.has(lastWinningNumber) && "text-red-500",
                  lastWinningNumber !== null &&
                    !REDS_SET.has(lastWinningNumber) &&
                    lastWinningNumber !== 0 &&
                    "text-zinc-100",
                )}
              >
                {lastWinningNumber !== null ? lastWinningNumber : "--"}
              </span>
            </div>

            {WHEEL_NUMBERS.map((num, idx) => {
              const angle = (360 / WHEEL_NUMBERS.length) * idx;
              const isRed = REDS_SET.has(num);
              return (
                <div
                  key={idx}
                  className="absolute h-full w-full text-center"
                  style={{ transform: `rotate(${angle}deg)` }}
                >
                  <span
                    className={cn(
                      "inline-block pt-1.5 font-mono text-[10px] font-black",
                      num === 0 && "text-emerald-400",
                      isRed && "text-red-500",
                      !isRed && num !== 0 && "text-zinc-200",
                    )}
                  >
                    {num}
                  </span>
                </div>
              );
            })}
          </motion.div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto mt-4 p-1">
          {history.map((num, idx) => (
            <span
              key={idx}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg font-mono text-xs font-bold border",
                num === 0 && "border-emerald-500/40 bg-emerald-950/60 text-emerald-400",
                REDS_SET.has(num) && "border-red-500/40 bg-red-950/60 text-red-400",
                !REDS_SET.has(num) && num !== 0 && "border-white/10 bg-zinc-900 text-zinc-300",
              )}
            >
              {num}
            </span>
          ))}
        </div>
      </div>

      {/* SÁZKOVÝ STŮL */}
      <div className="rounded-3xl border border-white/10 bg-black/90 p-5 backdrop-blur-xl space-y-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-black uppercase tracking-widest text-amber-400">Sázkový Stůl</span>
          {totalBetAmount > 0 && (
            <button
              onClick={clearBets}
              disabled={isSpinning}
              className="inline-flex items-center gap-1 font-mono text-xs text-red-400 hover:text-red-300 transition disabled:opacity-50"
            >
              <RotateCcw className="h-3 w-3" /> Vyčistit sázky (${totalBetAmount})
            </button>
          )}
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            <OutsideBetBtn
              label="ČERVENÁ 2×"
              betKey="red"
              color="red"
              bets={bets}
              onClick={handlePlaceBet}
              disabled={isSpinning}
            />
            <OutsideBetBtn
              label="ČERNÁ 2×"
              betKey="black"
              color="black"
              bets={bets}
              onClick={handlePlaceBet}
              disabled={isSpinning}
            />
            <OutsideBetBtn
              label="SUDÁ 2×"
              betKey="even"
              color="dark"
              bets={bets}
              onClick={handlePlaceBet}
              disabled={isSpinning}
            />
            <OutsideBetBtn
              label="LICHÁ 2×"
              betKey="odd"
              color="dark"
              bets={bets}
              onClick={handlePlaceBet}
              disabled={isSpinning}
            />
            <OutsideBetBtn
              label="1–18"
              betKey="1-18"
              color="dark"
              bets={bets}
              onClick={handlePlaceBet}
              disabled={isSpinning}
            />
            <OutsideBetBtn
              label="19–36"
              betKey="19-36"
              color="dark"
              bets={bets}
              onClick={handlePlaceBet}
              disabled={isSpinning}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <OutsideBetBtn
              label="1. TUCET (1-12) 3×"
              betKey="doz_1"
              color="dark"
              bets={bets}
              onClick={handlePlaceBet}
              disabled={isSpinning}
            />
            <OutsideBetBtn
              label="2. TUCET (13-24) 3×"
              betKey="doz_2"
              color="dark"
              bets={bets}
              onClick={handlePlaceBet}
              disabled={isSpinning}
            />
            <OutsideBetBtn
              label="3. TUCET (25-36) 3×"
              betKey="doz_3"
              color="dark"
              bets={bets}
              onClick={handlePlaceBet}
              disabled={isSpinning}
            />
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-2 select-none">
          <button
            disabled={isSpinning}
            onClick={() => handlePlaceBet("0")}
            className={cn(
              "relative flex w-14 shrink-0 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-950/60 font-mono text-base font-bold text-emerald-400 hover:bg-emerald-500/20 transition active:scale-95 disabled:opacity-50",
              bets["0"] && "ring-2 ring-amber-400 bg-emerald-900/80",
            )}
          >
            <span>0</span>
            {bets["0"] && <ChipBadge amount={bets["0"]} />}
          </button>

          <div className="grid flex-1 grid-rows-3 gap-1.5 min-w-[620px]">
            {BOARD_GRID.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-12 gap-1.5">
                {row.map((num) => {
                  const isRed = REDS_SET.has(num);
                  const betKey = num.toString();
                  const currentBet = bets[betKey];

                  return (
                    <button
                      key={num}
                      disabled={isSpinning}
                      onClick={() => handlePlaceBet(betKey)}
                      className={cn(
                        "relative flex h-12 items-center justify-center rounded-xl font-mono text-sm font-bold border transition duration-150 active:scale-95 disabled:opacity-50",
                        isRed && "border-red-500/30 bg-red-950/50 text-red-400 hover:bg-red-900/60",
                        !isRed && "border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800",
                        currentBet && "ring-2 ring-amber-400 font-black",
                      )}
                    >
                      {num}
                      {currentBet && <ChipBadge amount={currentBet} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-zinc-400 mr-1">Hodnota žetonu:</span>
            {[10, 50, 100, 500].map((val) => (
              <button
                key={val}
                onClick={() => setSelectedChip(val)}
                className={cn(
                  "rounded-xl border px-3 py-2 font-mono text-xs font-black uppercase transition",
                  selectedChip === val
                    ? "border-amber-400 bg-amber-400 text-black shadow-lg shadow-amber-500/20 scale-105"
                    : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10",
                )}
              >
                +${val}
              </button>
            ))}
            <button
              onClick={() => setSelectedChip(balance)}
              className={cn(
                "rounded-xl border px-3 py-2 font-mono text-xs font-black uppercase transition",
                selectedChip === balance
                  ? "border-amber-400 bg-amber-400 text-black shadow-lg shadow-amber-500/20 scale-105"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10",
              )}
            >
              MAX
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right font-mono text-xs">
              <span className="text-zinc-500 block">Zůstatek</span>
              <span className="font-bold text-amber-400 text-sm">${balance}</span>
            </div>

            <button
              onClick={spinWheel}
              disabled={isSpinning || totalBetAmount === 0}
              className="rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 px-6 py-3 font-mono text-xs font-black uppercase tracking-wider text-black shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 disabled:opacity-40 transition"
            >
              {isSpinning ? "Točí se..." : `VSADIT $${totalBetAmount}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChipBadge({ amount }: { amount: number }) {
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1 font-mono text-[10px] font-black text-black shadow-md border border-black z-20 pointer-events-none"
    >
      ${amount}
    </motion.span>
  );
}

function OutsideBetBtn({
  label,
  betKey,
  color,
  bets,
  onClick,
  disabled,
}: {
  label: string;
  betKey: string;
  color: "red" | "black" | "dark";
  bets: BetMap;
  onClick: (key: string) => void;
  disabled: boolean;
}) {
  const currentBet = bets[betKey];
  return (
    <button
      disabled={disabled}
      onClick={() => onClick(betKey)}
      className={cn(
        "relative rounded-xl border p-2.5 font-mono text-[11px] font-bold uppercase transition active:scale-95 disabled:opacity-50",
        color === "red" && "border-red-500/30 bg-red-950/40 text-red-400 hover:bg-red-900/50",
        color === "black" && "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800",
        color === "dark" && "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10",
        currentBet && "ring-2 ring-amber-400 font-black",
      )}
    >
      {label}
      {currentBet && <ChipBadge amount={currentBet} />}
    </button>
  );
}

function calculateBetPayout(betKey: string, amount: number, winningNum: number): number {
  const isRed = REDS_SET.has(winningNum);

  if (betKey === winningNum.toString()) return amount * 36;
  if (betKey === "red" && isRed) return amount * 2;
  if (betKey === "black" && !isRed && winningNum !== 0) return amount * 2;
  if (betKey === "even" && winningNum !== 0 && winningNum % 2 === 0) return amount * 2;
  if (betKey === "odd" && winningNum % 2 !== 0) return amount * 2;
  if (betKey === "1-18" && winningNum >= 1 && winningNum <= 18) return amount * 2;
  if (betKey === "19-36" && winningNum >= 19 && winningNum <= 36) return amount * 2;
  if (betKey === "doz_1" && winningNum >= 1 && winningNum <= 12) return amount * 3;
  if (betKey === "doz_2" && winningNum >= 13 && winningNum <= 24) return amount * 3;
  if (betKey === "doz_3" && winningNum >= 25 && winningNum <= 36) return amount * 3;

  return 0;
}
