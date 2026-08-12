import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL_NUMBERS = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const BOARD_GRID = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];
const ROUND_SEC = 15;
const BETTING_SEC = 10;
const SPIN_SEC = 3;

type BetMap = Record<string, number>;

function roundNow() {
  return Math.floor(Date.now() / 1000 / ROUND_SEC);
}

function cycleNow() {
  return Math.floor(Date.now() / 1000) % ROUND_SEC;
}

function mapBet(key: string): { type: string; value: string | null } {
  if (/^\d+$/.test(key)) return { type: "number", value: key };
  if (key === "1-18") return { type: "low", value: null };
  if (key === "19-36") return { type: "high", value: null };
  if (key === "doz_1") return { type: "dozen", value: "1" };
  if (key === "doz_2") return { type: "dozen", value: "2" };
  if (key === "doz_3") return { type: "dozen", value: "3" };
  return { type: key, value: null };
}

function displayNumberColor(n: number) {
  if (n === 0) return "text-emerald-400";
  return RED_NUMBERS.has(n) ? "text-red-400" : "text-zinc-100";
}

export function LiveRouletteServer() {
  const { user, balance = 0, refreshProfile } = useAuth();
  const [selectedChip, setSelectedChip] = useState(10);
  const [bets, setBets] = useState<BetMap>({});
  const [serverBalance, setServerBalance] = useState(Number(balance));
  const [round, setRound] = useState(roundNow());
  const [cycle, setCycle] = useState(cycleNow());
  const [phase, setPhase] = useState<"BETTING" | "SPINNING" | "RESULT">("BETTING");
  const [timeLeft, setTimeLeft] = useState(BETTING_SEC);
  const [winningNumber, setWinningNumber] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [rotation, setRotation] = useState(0);
  const settledRound = useRef<number | null>(null);

  useEffect(() => setServerBalance(Number(balance)), [balance]);

  const loadRoundBets = useCallback(async (roundNo: number) => {
    if (!user) return;
    const { data } = await supabase
      .from("roulette_bets")
      .select("bet_type,bet_value,amount")
      .eq("round_no", roundNo)
      .eq("user_id", user.id)
      .eq("settled", false);
    const next: BetMap = {};
    for (const row of data ?? []) {
      const key = row.bet_type === "number" ? String(row.bet_value) : row.bet_type === "low" ? "1-18" : row.bet_type === "high" ? "19-36" : row.bet_type === "dozen" ? `doz_${row.bet_value}` : row.bet_type;
      next[key] = (next[key] ?? 0) + Number(row.amount ?? 0);
    }
    setBets(next);
  }, [user]);

  useEffect(() => {
    void loadRoundBets(round);
  }, [loadRoundBets, round]);

  const settlePreviousRound = useCallback(async (roundNo: number) => {
    const previous = roundNo - 1;
    if (previous < 0 || settledRound.current === previous) return;
    settledRound.current = previous;
    const { data, error } = await supabase.rpc("roulette_settle", { _round_no: previous });
    if (error) {
      settledRound.current = null;
      return;
    }
    const result = Number((data as { result?: number } | null)?.result);
    if (!Number.isInteger(result) || result < 0 || result > 36) return;
    setWinningNumber(result);
    setHistory((items) => [result, ...items.filter((n) => n !== result).slice(0, 7)]);
    const index = WHEEL_NUMBERS.indexOf(result);
    const segment = 360 / WHEEL_NUMBERS.length;
    setRotation((current) => current + 360 * 5 + (360 - index * segment));
    await refreshProfile?.();
    if (user) {
      const { data: balanceRow } = await supabase.from("profiles").select("balance").eq("id", user.id).maybeSingle();
      if (balanceRow?.balance != null) setServerBalance(Number(balanceRow.balance));
    }
  }, [refreshProfile, user]);

  useEffect(() => {
    const tick = () => {
      const nextRound = roundNow();
      const nextCycle = cycleNow();
      if (nextRound !== round) {
        setRound(nextRound);
        setBets({});
        settledRound.current = null;
      }
      setCycle(nextCycle);
      if (nextCycle < BETTING_SEC) {
        setPhase("BETTING");
        setTimeLeft(BETTING_SEC - nextCycle);
      } else if (nextCycle < BETTING_SEC + SPIN_SEC) {
        setPhase("SPINNING");
        setTimeLeft(BETTING_SEC + SPIN_SEC - nextCycle);
        void settlePreviousRound(nextRound);
      } else {
        setPhase("RESULT");
        setTimeLeft(ROUND_SEC - nextCycle);
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [round, settlePreviousRound]);

  const totalBet = useMemo(() => Object.values(bets).reduce((sum, value) => sum + value, 0), [bets]);
  const canBet = Boolean(user) && phase === "BETTING" && selectedChip > 0 && serverBalance >= selectedChip;

  const placeBet = useCallback(async (key: string) => {
    if (!canBet) return;
    const mapped = mapBet(key);
    const { data, error } = await supabase.rpc("roulette_place_bet", {
      _round_no: round,
      _bet_type: mapped.type,
      _bet_value: mapped.value,
      _amount: selectedChip,
    });
    if (error) {
      toast.error(error.message.includes("round_closed") ? "Kolo už je uzavřené." : error.message.includes("insufficient_balance") ? "Nedostatek dolarů." : "Sázku se nepodařilo přijmout.");
      return;
    }
    const nextBalance = Number((data as { balance?: number } | null)?.balance);
    if (Number.isFinite(nextBalance)) setServerBalance(nextBalance);
    setBets((current) => ({ ...current, [key]: (current[key] ?? 0) + selectedChip }));
  }, [canBet, round, selectedChip]);

  const cancelBets = useCallback(async () => {
    if (phase !== "BETTING" || totalBet <= 0) return;
    const { data, error } = await supabase.rpc("roulette_cancel_bets", { _round_no: round });
    if (error) {
      toast.error("Sázky už nejdou zrušit — kolo se mezitím uzavřelo.");
      return;
    }
    setBets({});
    const nextBalance = Number((data as { balance?: number } | null)?.balance);
    if (Number.isFinite(nextBalance)) setServerBalance(nextBalance);
    toast.success("Sázky byly vráceny na účet.");
  }, [phase, round, totalBet]);

  return (
    <div className="space-y-5 select-none">
      <section className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-b from-zinc-950 via-black to-zinc-950 p-5 shadow-2xl sm:p-6">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.25em] text-amber-400"><Sparkles className="h-4 w-4" /> Royal European Roulette</div>
            <div className="mt-1 flex items-center gap-2 text-[10px] text-emerald-300/80"><ShieldCheck className="h-3.5 w-3.5" /> SERVER AUTHORITATIVE</div>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 font-mono text-xs">
            <Clock className="h-4 w-4 text-amber-400" />
            <span className={cn("font-black", phase === "BETTING" ? "text-emerald-400" : phase === "SPINNING" ? "text-amber-400" : "text-sky-300")}>{phase === "BETTING" ? `SÁZKY ${timeLeft}s` : phase === "SPINNING" ? "ROZTÁČÍME" : `DALŠÍ KOLO ${timeLeft}s`}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-col items-center gap-4">
          <div className="relative flex h-60 w-60 items-center justify-center">
            <div className="absolute inset-0 rounded-full border-8 border-amber-500/30 bg-zinc-900 shadow-[0_0_50px_rgba(245,158,11,.18)]" />
            <motion.div
              className="absolute inset-2 rounded-full border-4 border-amber-400/50"
              animate={{ rotate: rotation }}
              transition={{ duration: SPIN_SEC, ease: [0.15, 0.85, 0.25, 1] }}
            >
              {WHEEL_NUMBERS.map((num, index) => {
                const angle = index * (360 / WHEEL_NUMBERS.length);
                return <span key={num} className={cn("absolute left-1/2 top-1/2 font-mono text-[9px] font-black", displayNumberColor(num))} style={{ transform: `rotate(${angle}deg) translateY(-101px) rotate(${-angle}deg)` }}>{num}</span>;
              })}
            </motion.div>
            <div className="absolute -top-2 z-20 text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,.9)]">▼</div>
            <div className="relative z-10 flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 border-amber-400/50 bg-black shadow-xl">
              <span className="font-mono text-[8px] uppercase tracking-widest text-zinc-500">VÝSLEDEK</span>
              <span className={cn("font-display text-4xl", winningNumber == null ? "text-zinc-500" : displayNumberColor(winningNumber))}>{winningNumber ?? "--"}</span>
            </div>
          </div>
          <div className="flex max-w-full gap-1.5 overflow-x-auto">
            {history.map((n, i) => <span key={`${n}-${i}`} className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border font-mono text-[10px] font-bold", n === 0 ? "border-emerald-500/30 bg-emerald-950 text-emerald-300" : RED_NUMBERS.has(n) ? "border-red-500/30 bg-red-950 text-red-300" : "border-white/10 bg-zinc-900 text-zinc-300")}>{n}</span>)}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-black/90 p-4 shadow-xl sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><div className="font-mono text-xs font-black uppercase tracking-widest text-amber-400">Sázkový stůl</div><div className="mt-1 text-[10px] text-zinc-500">Každý žeton se ihned odečítá serverem.</div></div>
          <div className="flex items-center gap-2"><span className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 font-mono text-xs text-amber-300">${serverBalance.toFixed(0)}</span>{totalBet > 0 && phase === "BETTING" && <button onClick={() => void cancelBets()} className="inline-flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2 font-mono text-[10px] font-black uppercase text-red-300"><RotateCcw className="h-3.5 w-3.5" /> Vrátit</button>}</div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {[10, 50, 100, 500].map((value) => <button key={value} onClick={() => setSelectedChip(value)} className={cn("rounded-xl border px-3 py-2 font-mono text-xs font-black", selectedChip === value ? "border-amber-400 bg-amber-400 text-black" : "border-white/10 bg-white/5 text-zinc-300")}>${value}</button>)}
        </div>

        <div className="grid gap-2 sm:grid-cols-6">
          {[['red','ČERVENÁ 2×'],['black','ČERNÁ 2×'],['even','SUDÁ 2×'],['odd','LICHÁ 2×'],['1-18','1–18 2×'],['19-36','19–36 2×']].map(([key,label]) => <BetButton key={key} label={label} amount={bets[key] ?? 0} disabled={!canBet} onClick={() => void placeBet(key)} />)}
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {[['doz_1','1. TUCET 3×'],['doz_2','2. TUCET 3×'],['doz_3','3. TUCET 3×']].map(([key,label]) => <BetButton key={key} label={label} amount={bets[key] ?? 0} disabled={!canBet} onClick={() => void placeBet(key)} />)}
        </div>

        <div className="mt-3 grid gap-1.5 md:grid-cols-[56px_minmax(0,1fr)]">
          <BetButton label="0" amount={bets["0"] ?? 0} disabled={!canBet} onClick={() => void placeBet("0")} green />
          <div className="grid grid-cols-12 gap-1.5">
            {BOARD_GRID.flat().map((n) => <BetButton key={n} label={String(n)} amount={bets[String(n)] ?? 0} disabled={!canBet} onClick={() => void placeBet(String(n))} number={n} />)}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-xs"><span className="text-zinc-500">Potvrzeno v tomto kole</span><span className="font-black text-amber-300">${totalBet.toFixed(0)}</span></div>
      </section>
    </div>
  );
}

function BetButton({ label, amount, disabled, onClick, green, number }: { label: string; amount: number; disabled: boolean; onClick: () => void; green?: boolean; number?: number }) {
  const red = number != null && RED_NUMBERS.has(number);
  return <button disabled={disabled} onClick={onClick} className={cn("relative min-h-11 rounded-xl border px-2 py-2 font-mono text-[10px] font-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40", green ? "border-emerald-500/40 bg-emerald-950 text-emerald-300" : red ? "border-red-500/30 bg-red-950/60 text-red-300" : "border-white/10 bg-zinc-900 text-zinc-200 hover:border-amber-500/40", amount > 0 && "ring-2 ring-amber-400")}>{label}{amount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] text-black">${amount}</span>}</button>;
}
