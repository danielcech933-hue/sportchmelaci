import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Crown, RotateCcw, ShieldCheck, Sparkles, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const CORNERS = [
  [1, 2, 4, 5], [2, 3, 5, 6], [4, 5, 7, 8], [5, 6, 8, 9], [7, 8, 10, 11], [8, 9, 11, 12],
  [10, 11, 13, 14], [11, 12, 14, 15], [13, 14, 16, 17], [14, 15, 17, 18], [16, 17, 19, 20], [17, 18, 20, 21],
  [19, 20, 22, 23], [20, 21, 23, 24], [22, 23, 25, 26], [23, 24, 26, 27], [25, 26, 28, 29], [26, 27, 29, 30],
  [28, 29, 31, 32], [29, 30, 32, 33], [31, 32, 34, 35], [32, 33, 35, 36],
] as const;
const ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
] as const;
const ROUND_SEC = 15;
const BET_SEC = 10;
const SPIN_SEC = 3;

type Phase = "BETTING" | "SPINNING" | "RESULT";
type BetMap = Record<string, number>;

const isRed = (n: number) => RED.has(n);
const keyFor = (type: string, value: string | null) =>
  type === "number" ? String(value) :
  type === "low" ? "1-18" :
  type === "high" ? "19-36" :
  type === "dozen" ? `doz_${value}` :
  type === "corner" ? `corner_${value}` : type;
const parseBetKey = (key: string) => {
  if (/^\d+$/.test(key)) return { type: "number", value: key };
  if (key.startsWith("corner_")) return { type: "corner", value: key.slice(7) };
  if (key === "1-18") return { type: "low", value: null };
  if (key === "19-36") return { type: "high", value: null };
  if (key.startsWith("doz_")) return { type: "dozen", value: key.slice(4) };
  return { type: key, value: null };
};
const roundNow = () => Math.floor(Date.now() / 1000 / ROUND_SEC);
const cycleNow = () => Math.floor(Date.now() / 1000) % ROUND_SEC;

function numberTone(n: number) {
  if (n === 0) return "border-emerald-300/45 bg-[#0d6b47] text-white shadow-[inset_0_0_18px_rgba(255,255,255,.08)]";
  if (isRed(n)) return "border-rose-300/25 bg-[#8c2029] text-white shadow-[inset_0_0_18px_rgba(255,255,255,.05)]";
  return "border-white/10 bg-[#13171a] text-white shadow-[inset_0_0_18px_rgba(255,255,255,.025)]";
}

export function UltraRouletteTablePro() {
  const { user, balance = 0, refreshProfile } = useAuth();
  const [chip, setChip] = useState(100);
  const [bets, setBets] = useState<BetMap>({});
  const [serverBalance, setServerBalance] = useState(Number(balance));
  const [round, setRound] = useState(roundNow());
  const [phase, setPhase] = useState<Phase>("BETTING");
  const [timeLeft, setTimeLeft] = useState(BET_SEC);
  const [winning, setWinning] = useState<number | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [sound, setSound] = useState(true);
  const settled = useRef<number | null>(null);

  useEffect(() => setServerBalance(Number(balance)), [balance]);

  const loadBets = useCallback(async (r: number) => {
    if (!user) return;
    const { data } = await supabase
      .from("roulette_bets")
      .select("bet_type,bet_value,amount")
      .eq("round_no", r)
      .eq("user_id", user.id)
      .eq("settled", false);
    const next: BetMap = {};
    for (const row of data ?? []) {
      const key = keyFor(row.bet_type, row.bet_value == null ? null : String(row.bet_value));
      next[key] = (next[key] ?? 0) + Number(row.amount ?? 0);
    }
    setBets(next);
  }, [user]);

  useEffect(() => { void loadBets(round); }, [loadBets, round]);

  const settle = useCallback(async (r: number) => {
    const prev = r - 1;
    if (prev < 0 || settled.current === prev) return;
    settled.current = prev;
    const { data, error } = await supabase.rpc("roulette_settle", { _round_no: prev });
    if (error) {
      settled.current = null;
      return;
    }
    const result = Number((data as { result?: number } | null)?.result);
    if (!Number.isInteger(result) || result < 0 || result > 36) return;

    setWinning(null);
    setPending(result);
    const idx = WHEEL.indexOf(result);
    const seg = 360 / WHEEL.length;
    setWheelRotation((cur) => cur + 360 * 6 + (360 - idx * seg));

    window.setTimeout(() => {
      setPending(null);
      setWinning(result);
      setHistory((xs) => [result, ...xs].slice(0, 16));
      void refreshProfile?.();
      if (user) {
        void supabase.from("profiles").select("balance").eq("id", user.id).maybeSingle().then(({ data: row }) => {
          if (row?.balance != null) setServerBalance(Number(row.balance));
        });
      }
    }, SPIN_SEC * 1000);
  }, [refreshProfile, user]);

  useEffect(() => {
    const tick = () => {
      const r = roundNow();
      const c = cycleNow();
      if (r !== round) {
        setRound(r);
        setBets({});
        settled.current = null;
      }
      if (c < BET_SEC) {
        setPhase("BETTING");
        setTimeLeft(BET_SEC - c);
      } else if (c < BET_SEC + SPIN_SEC) {
        setPhase("SPINNING");
        setTimeLeft(BET_SEC + SPIN_SEC - c);
        void settle(r);
      } else {
        setPhase("RESULT");
        setTimeLeft(ROUND_SEC - c);
      }
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [round, settle]);

  const total = useMemo(() => Object.values(bets).reduce((a, b) => a + b, 0), [bets]);
  const canBet = Boolean(user) && phase === "BETTING" && serverBalance >= chip;

  const place = useCallback(async (key: string) => {
    if (!canBet) return;
    const bet = parseBetKey(key);
    const { data, error } = await supabase.rpc("roulette_place_bet", {
      _round_no: round,
      _bet_type: bet.type,
      _bet_value: bet.value,
      _amount: chip,
    });
    if (error) {
      toast.error(
        error.message.includes("insufficient_balance") ? "Nedostatek dolarů." :
        error.message.includes("round_closed") ? "Sázky jsou uzavřené." :
        error.message.includes("invalid_corner") ? "Neplatná čtveřice." :
        "Sázku se nepodařilo přijmout."
      );
      return;
    }
    const bal = Number((data as { balance?: number } | null)?.balance);
    if (Number.isFinite(bal)) setServerBalance(bal);
    setBets((x) => ({ ...x, [key]: (x[key] ?? 0) + chip }));
  }, [canBet, chip, round]);

  const cancel = useCallback(async () => {
    if (phase !== "BETTING" || !total) return;
    const { data, error } = await supabase.rpc("roulette_cancel_bets", { _round_no: round });
    if (error) {
      toast.error("Sázky už nejdou vrátit.");
      return;
    }
    setBets({});
    const bal = Number((data as { balance?: number } | null)?.balance);
    if (Number.isFinite(bal)) setServerBalance(bal);
    toast.success("Sázky vráceny.");
  }, [phase, round, total]);

  return (
    <div className="mx-auto w-full max-w-[1380px] space-y-5 select-none pb-6">
      <section className="overflow-hidden rounded-[32px] border border-amber-100/15 bg-[#070b0a] shadow-[0_45px_120px_-70px_rgba(212,175,55,.55)]">
        <div className="border-b border-white/8 bg-gradient-to-r from-[#0b1711] via-[#101513] to-[#0b1711] px-4 py-4 sm:px-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 font-display text-xl tracking-[.16em] text-[#f4dfa0]"><Crown className="h-4 w-4 text-[#d8b55b]" /> IMPERIAL ROULETTE</div>
              <div className="mt-1 font-mono text-[8px] uppercase tracking-[.30em] text-white/35">EUROPEAN SINGLE ZERO · SERVER AUTHORITATIVE · PLAY MONEY</div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full border border-white/8 bg-white/[.025] px-3 py-2 font-mono text-[9px] uppercase tracking-[.18em] text-white/45">ROUND {round}</div>
              <div className={cn("rounded-full border px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[.18em]", phase === "BETTING" ? "border-emerald-300/25 bg-emerald-300/[.05] text-emerald-200" : phase === "SPINNING" ? "border-amber-200/30 bg-amber-200/[.05] text-amber-100" : "border-cyan-200/20 bg-cyan-200/[.04] text-cyan-100")}>{phase === "BETTING" ? `SÁZKY · ${timeLeft}s` : phase === "SPINNING" ? `KULIČKA V KOLE · ${timeLeft}s` : `DALŠÍ KOLO · ${timeLeft}s`}</div>
              <button onClick={() => setSound((x) => !x)} aria-label="Zvuk" className="rounded-full border border-white/8 bg-white/[.025] p-2 text-white/45 hover:text-white">{sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-7">
          <div className="grid items-center gap-6 xl:grid-cols-[minmax(420px,560px)_minmax(0,1fr)]">
            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="relative aspect-square overflow-hidden rounded-full border-[18px] border-[#6b5120] bg-[#0b2218] shadow-[inset_0_0_90px_rgba(0,0,0,.9),0_0_70px_rgba(212,175,55,.12)]">
                <div className="absolute inset-[4%] rounded-full border border-[#d8b55b]/20 bg-[radial-gradient(circle_at_50%_45%,#1a3b2b_0%,#0d2118_48%,#050908_74%)]" />
                <motion.div className="absolute inset-[7%]" animate={{ rotate: wheelRotation }} transition={{ duration: SPIN_SEC, ease: [0.12, 0.82, 0.22, 1] }}>
                  {WHEEL.map((n, i) => {
                    const a = i * (360 / WHEEL.length);
                    return (
                      <div key={n} className="absolute left-1/2 top-1/2 h-[46%] w-px origin-bottom bg-white/8" style={{ transform: `rotate(${a}deg) translateY(-100%)` }}>
                        <span
                          className={cn("absolute -left-[15px] -top-[15px] grid h-[30px] w-[30px] place-items-center rounded-full border font-mono text-[8px] font-black shadow-lg", n === 0 ? "border-emerald-200/50 bg-[#0d6b47] text-white" : isRed(n) ? "border-rose-200/30 bg-[#8c2029] text-white" : "border-white/10 bg-[#15191c] text-white")}
                          style={{ transform: `rotate(${-a}deg)` }}
                        >{n}</span>
                      </div>
                    );
                  })}
                  <div className="absolute inset-[16%] rounded-full border border-[#d8b55b]/25 bg-[conic-gradient(from_12deg,rgba(216,181,91,.08),transparent_15%,rgba(216,181,91,.05),transparent_45%,rgba(216,181,91,.07))]" />
                  <div className="absolute inset-[22%] rounded-full border-[10px] border-[#7f632a]/70 bg-[radial-gradient(circle_at_36%_28%,#f6e7ae_0%,#b48a2e_35%,#3a2b12_62%,#12100a_100%)] shadow-[inset_0_0_24px_rgba(0,0,0,.85)]">
                    <div className="absolute inset-[18%] rounded-full border border-white/15 bg-[#090909]" />
                  </div>
                  <div className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#f4dfa0]/30 bg-[#11100b] shadow-[0_0_30px_rgba(212,175,55,.12)]">
                    <div className="font-display text-xs tracking-[.18em] text-[#e7cb80]">ZERO</div>
                  </div>
                </motion.div>
                <div className="absolute left-1/2 top-[7%] z-20 h-0 w-0 -translate-x-1/2 border-l-[11px] border-r-[11px] border-t-[18px] border-l-transparent border-r-transparent border-t-[#f4dfa0] drop-shadow-[0_0_9px_rgba(244,223,160,.8)]" />
                {pending !== null && (
                  <motion.div
                    className="absolute left-1/2 top-[9%] z-30 h-4 w-4 -translate-x-1/2 rounded-full bg-white shadow-[0_0_18px_7px_rgba(255,255,255,.75)]"
                    animate={{ x: [0, 90, 155, 115, 35, -80, -145, -90, 0], y: [0, -15, 65, 150, 190, 135, 55, -18, 0], scale: [1, 1.15, .95, 1.08, .9, 1.14, .92, 1.1, 1] }}
                    transition={{ duration: SPIN_SEC, ease: "easeInOut" }}
                  />
                )}
                <div className="pointer-events-none absolute inset-[38%] grid place-items-center">
                  <div className="rounded-2xl border border-black/20 bg-black/55 px-5 py-4 text-center backdrop-blur-md">
                    <div className="font-mono text-[7px] uppercase tracking-[.30em] text-white/35">VÝSLEDEK</div>
                    <div className={cn("mt-1 font-display text-5xl", winning == null || phase === "SPINNING" ? "text-white/15" : isRed(winning) ? "text-rose-200" : winning === 0 ? "text-emerald-200" : "text-white")}>{phase === "SPINNING" ? "—" : winning ?? "—"}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <InfoPanel label="STAV STOlu"><div className="font-display text-3xl tracking-[.12em] text-[#f4dfa0]">{phase}</div><p className="mt-1 text-xs text-white/30">{phase === "BETTING" ? "Dealer přijímá sázky." : phase === "SPINNING" ? "Kulička je stále v pohybu." : "Výsledek potvrzen."}</p></InfoPanel>
              <InfoPanel label="BALANCE"><div className="font-display text-3xl text-emerald-200">${serverBalance.toLocaleString()}</div><p className="mt-1 text-xs text-white/30">server wallet</p></InfoPanel>
              <InfoPanel label="POSLEDNÍ VÝSLEDKY"><div className="flex flex-wrap gap-1.5">{history.map((n, i) => <span key={`${n}-${i}`} className={cn("grid h-8 w-8 place-items-center rounded-full border font-mono text-[9px] font-black", n === 0 ? "border-emerald-200/40 bg-emerald-900/70 text-white" : isRed(n) ? "border-rose-200/25 bg-rose-900/70 text-white" : "border-white/8 bg-white/[.03] text-white")}>{n}</span>)}</div></InfoPanel>
              <InfoPanel label="PRAVIDLA"><div className="grid grid-cols-2 gap-2 text-[8px] font-mono uppercase tracking-[.15em] text-white/35"><span>Číslo 36×</span><span>Corner 9×</span><span>Tucet 3×</span><span>Sudá/lichá 2×</span></div></InfoPanel>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[#d8b55b]/15 bg-[#0b1d14] shadow-[0_40px_100px_-70px_rgba(216,181,91,.6)]">
        <div className="border-b border-white/8 px-4 py-4 sm:px-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div><div className="font-mono text-[8px] uppercase tracking-[.30em] text-[#d8b55b]/60">IMPERIAL BETTING CARPET</div><h2 className="mt-1 font-display text-3xl tracking-[.12em] text-[#f2e5bc]">SÁZKOVÝ STŮL</h2></div>
            <div className="flex flex-wrap items-center gap-2"><div className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 font-mono text-xs text-amber-100">${serverBalance.toLocaleString()}</div>{total > 0 && phase === "BETTING" && <button onClick={() => void cancel()} className="inline-flex items-center gap-1 rounded-xl border border-rose-300/15 bg-rose-300/[.03] px-3 py-2 text-[9px] font-black uppercase tracking-[.16em] text-rose-200"><RotateCcw className="h-3.5 w-3.5" /> VRÁTIT SÁZKY</button>}</div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">{[10, 50, 100, 500, 1000, 5000, 10000].map((v) => <button key={v} disabled={phase !== "BETTING"} onClick={() => setChip(v)} className={cn("rounded-full border px-4 py-2 font-mono text-[10px] font-black transition disabled:opacity-25", chip === v ? "border-amber-100 bg-amber-100 text-black shadow-[0_0_22px_rgba(216,181,91,.22)]" : "border-white/10 bg-white/[.025] text-white/50 hover:border-amber-100/30 hover:text-white")}>${v.toLocaleString()}</button>)}</div>
        </div>

        <div className="p-4 sm:p-7">
          <div className="mx-auto max-w-[1180px] rounded-[28px] border border-[#d8b55b]/15 bg-[#0c4a31] p-3 shadow-[inset_0_0_50px_rgba(0,0,0,.35),0_20px_50px_-35px_rgba(0,0,0,.7)] sm:p-5">
            <div className="grid grid-cols-[56px_repeat(12,minmax(0,1fr))] gap-1.5 sm:grid-cols-[72px_repeat(12,minmax(0,1fr))]">
              <button disabled={!canBet} onClick={() => void place("0")} className="row-span-3 min-h-[194px] rounded-xl border border-emerald-200/20 bg-[#0d6b47] font-display text-3xl text-white shadow-[inset_0_0_18px_rgba(0,0,0,.28)] transition hover:brightness-110 disabled:opacity-30">0</button>
              {ROWS.flatMap((row, rowIndex) => row.map((n) => <button key={n} disabled={!canBet} onClick={() => void place(String(n))} className={cn("relative min-h-[58px] rounded-lg border font-display text-lg font-black transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-30 sm:min-h-[62px]", isRed(n) ? "border-rose-200/25 bg-[#981f2a] text-white" : "border-white/10 bg-[#141919] text-white", bets[String(n)] && "ring-2 ring-amber-100/80")}>{n}{bets[String(n)] ? <span className="absolute right-1 top-1 rounded-full bg-amber-100 px-1.5 py-0.5 font-mono text-[7px] font-black text-black">${bets[String(n)]}</span> : null}</button>))}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2"><Quick label="1–18" bet="1-18" odds="2×" amount={bets["1-18"] ?? 0} disabled={!canBet} onClick={() => void place("1-18")} /><Quick label="ČERVENÁ" bet="red" odds="2×" amount={bets.red ?? 0} disabled={!canBet} onClick={() => void place("red")} tone="red" /><Quick label="ČERNÁ" bet="black" odds="2×" amount={bets.black ?? 0} disabled={!canBet} onClick={() => void place("black")} tone="black" /><Quick label="19–36" bet="19-36" odds="2×" amount={bets["19-36"] ?? 0} disabled={!canBet} onClick={() => void place("19-36")} /></div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4"><Quick label="SUDÁ" bet="even" odds="2×" amount={bets.even ?? 0} disabled={!canBet} onClick={() => void place("even")} /><Quick label="LICHÁ" bet="odd" odds="2×" amount={bets.odd ?? 0} disabled={!canBet} onClick={() => void place("odd")} /><Quick label="1. TUCET" bet="doz_1" odds="3×" amount={bets.doz_1 ?? 0} disabled={!canBet} onClick={() => void place("doz_1")} /><Quick label="2. TUCET" bet="doz_2" odds="3×" amount={bets.doz_2 ?? 0} disabled={!canBet} onClick={() => void place("doz_2")} /></div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2"><Quick label="3. TUCET" bet="doz_3" odds="3×" amount={bets.doz_3 ?? 0} disabled={!canBet} onClick={() => void place("doz_3")} /><div className="rounded-xl border border-amber-100/10 bg-[#092b1d] px-4 py-3"><div className="font-mono text-[8px] uppercase tracking-[.24em] text-white/35">CELKEM VSZAZENO</div><div className="mt-1 font-display text-2xl text-[#f2e5bc]">${total.toLocaleString()}</div></div></div>
          </div>

          <div className="mx-auto mt-4 max-w-[1180px] rounded-[24px] border border-cyan-200/10 bg-[#071a23] p-4">
            <div className="flex items-center justify-between gap-3"><div><div className="font-mono text-[8px] uppercase tracking-[.26em] text-cyan-200/65">CORNER BET · 4 ČÍSLA · 9×</div><p className="mt-1 text-xs text-white/32">Vyber čtveřici sousedních čísel. Např. 8 · 9 · 11 · 12.</p></div><Sparkles className="h-4 w-4 text-cyan-200/70" /></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{CORNERS.map((corner) => { const key = `corner_${corner.join(",")}`; const amount = bets[key] ?? 0; return <button key={key} disabled={!canBet} onClick={() => void place(key)} className={cn("rounded-xl border px-3 py-3 text-left transition disabled:opacity-30", amount ? "border-cyan-200/60 bg-cyan-200/[.09]" : "border-white/8 bg-black/15 hover:border-cyan-200/25") }><div className="flex items-center justify-between gap-2"><span className="font-mono text-[9px] font-black tracking-[.12em] text-white">{corner.join(" · ")}</span><span className="font-mono text-[8px] text-cyan-200">9×</span></div>{amount ? <div className="mt-1 text-[8px] text-amber-200">VLOŽENO ${amount.toLocaleString()}</div> : <div className="mt-1 text-[8px] text-white/20">CORNER</div>}</button>; })}</div>
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoPanel({ label, children }: { label: string; children: ReactNode }) {
  return <div className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="font-mono text-[7px] uppercase tracking-[.26em] text-white/30">{label}</div><div className="mt-2">{children}</div></div>;
}

function Quick({ label, odds, amount, disabled, onClick, tone }: { label: string; bet: string; odds: string; amount: number; disabled: boolean; onClick: () => void; tone?: "red" | "black" }) {
  return <button disabled={disabled} onClick={onClick} className={cn("rounded-xl border px-3 py-3 text-left transition hover:-translate-y-0.5 disabled:opacity-30", tone === "red" ? "border-rose-200/20 bg-[#981f2a]/85" : tone === "black" ? "border-white/10 bg-[#15191c]" : "border-white/8 bg-[#092b1d]")}>{<div className="flex items-center justify-between gap-2"><span className="font-mono text-[8px] font-black uppercase tracking-[.20em] text-white/65">{label}</span><span className="font-mono text-[8px] text-amber-100">{odds}</span></div>}{amount ? <div className="mt-1 text-[8px] text-amber-200">STAKE ${amount.toLocaleString()}</div> : null}</button>;
}
