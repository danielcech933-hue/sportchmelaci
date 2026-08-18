import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Crown, RotateCcw, ShieldCheck, Sparkles, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
] as const;
const CORNERS = [
  [1, 2, 4, 5], [2, 3, 5, 6], [4, 5, 7, 8], [5, 6, 8, 9], [7, 8, 10, 11], [8, 9, 11, 12],
  [10, 11, 13, 14], [11, 12, 14, 15], [13, 14, 16, 17], [14, 15, 17, 18], [16, 17, 19, 20], [17, 18, 20, 21],
  [19, 20, 22, 23], [20, 21, 23, 24], [22, 23, 25, 26], [23, 24, 25, 27],
  [25, 26, 28, 29], [26, 27, 29, 30], [28, 29, 31, 32], [29, 30, 32, 33], [31, 32, 34, 35], [32, 33, 35, 36],
] as const;
const ROUND_SEC = 15;
const BET_SEC = 10;
const SPIN_SEC = 3;

type Phase = "BETTING" | "SPINNING" | "RESULT";
type BetMap = Record<string, number>;

const isRed = (n: number) => RED.has(n);
const roundNow = () => Math.floor(Date.now() / 1000 / ROUND_SEC);
const cycleNow = () => Math.floor(Date.now() / 1000) % ROUND_SEC;
const keyFor = (type: string, value: string | null) => {
  if (type === "number") return String(value);
  if (type === "low") return "1-18";
  if (type === "high") return "19-36";
  if (type === "dozen") return `doz_${value}`;
  if (type === "corner") return `corner_${value}`;
  return type;
};
const parseBetKey = (key: string) => {
  if (/^\d+$/.test(key)) return { type: "number", value: key };
  if (key.startsWith("corner_")) return { type: "corner", value: key.slice(7) };
  if (key === "1-18") return { type: "low", value: null };
  if (key === "19-36") return { type: "high", value: null };
  if (key.startsWith("doz_")) return { type: "dozen", value: key.slice(4) };
  return { type: key, value: null };
};

function polar(cx: number, cy: number, radius: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
}

function sectorPath(cx: number, cy: number, rOuter: number, rInner: number, start: number, end: number) {
  const p1 = polar(cx, cy, rOuter, start);
  const p2 = polar(cx, cy, rOuter, end);
  const p3 = polar(cx, cy, rInner, end);
  const p4 = polar(cx, cy, rInner, start);
  return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 0 0 ${p4.x} ${p4.y} Z`;
}

function tone(n: number) {
  if (n === 0) return { fill: "#0e6948", stroke: "#7fe0b7" };
  if (isRed(n)) return { fill: "#8b202b", stroke: "#d97480" };
  return { fill: "#171a1d", stroke: "#5c6268" };
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
  const [ballRotation, setBallRotation] = useState(0);
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
    setWheelRotation((cur) => cur + 360 * 6 - idx * seg);
    setBallRotation((cur) => cur - 360 * 9 - idx * seg);

    window.setTimeout(() => {
      setPending(null);
      setWinning(result);
      setHistory((xs) => [result, ...xs].slice(0, 14));
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

  const wheelNumbers = WHEEL.map((n, i) => {
    const angle = i * (360 / WHEEL.length);
    const t = tone(n);
    return { n, angle, fill: t.fill, stroke: t.stroke };
  });

  return (
    <div className="mx-auto w-full max-w-[1320px] space-y-4 pb-8 select-none">
      <section className="overflow-hidden rounded-[28px] border border-[#c8a858]/25 bg-[#080d0a] shadow-[0_32px_100px_-65px_rgba(200,168,88,.7)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 bg-gradient-to-r from-[#0e1812] via-[#101612] to-[#0a120e] px-5 py-4 sm:px-7">
          <div>
            <div className="flex items-center gap-2 font-display text-[22px] tracking-[.16em] text-[#f3dfa3]"><Crown className="h-4 w-4 text-[#d7b85f]" /> IMPERIAL ROULETTE</div>
            <div className="mt-1 font-mono text-[8px] uppercase tracking-[.32em] text-white/35">EUROPEAN SINGLE ZERO · SERVER AUTHORITATIVE · PLAY MONEY</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-full border border-white/10 px-3 py-2 font-mono text-[9px] text-white/35">ROUND {round}</div>
            <div className={cn("rounded-full border px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[.16em]", phase === "BETTING" ? "border-emerald-300/30 bg-emerald-300/[.05] text-emerald-200" : phase === "SPINNING" ? "border-amber-200/30 bg-amber-200/[.05] text-amber-100" : "border-cyan-200/20 bg-cyan-200/[.04] text-cyan-100")}>{phase === "BETTING" ? `SÁZKY · ${timeLeft}s` : phase === "SPINNING" ? `KULIČKA V POHYBU · ${timeLeft}s` : `DALŠÍ KOLO · ${timeLeft}s`}</div>
            <button onClick={() => setSound((x) => !x)} className="rounded-full border border-white/10 bg-black/20 p-2 text-white/45 hover:text-white">{sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
          </div>
        </header>

        <div className="grid gap-6 p-4 lg:grid-cols-[minmax(500px,1.08fr)_minmax(360px,.92fr)] lg:p-7">
          <div className="flex items-center justify-center rounded-[24px] border border-[#c8a858]/12 bg-[radial-gradient(circle_at_50%_45%,#143726_0%,#0b1a13_47%,#060a08_76%)] p-3 sm:p-6">
            <div className="relative aspect-square w-full max-w-[560px]">
              <div className="absolute inset-0 rounded-full border-[18px] border-[#6e531f] bg-[#0a1510] shadow-[inset_0_0_90px_rgba(0,0,0,.95),0_18px_50px_rgba(0,0,0,.45)]" />
              <div className="absolute inset-[2.5%] rounded-full border border-[#d6b662]/25 bg-[radial-gradient(circle,#204935 0%,#123222 44%,#08130d 73%)]" />
              <motion.svg viewBox="0 0 560 560" className="absolute inset-[4%] h-[92%] w-[92%]" animate={{ rotate: wheelRotation }} transition={{ duration: SPIN_SEC, ease: [0.12, 0.82, 0.22, 1] }}>
                {wheelNumbers.map(({ n, angle, fill, stroke }) => {
                  const start = angle - 360 / WHEEL.length / 2;
                  const end = angle + 360 / WHEEL.length / 2;
                  const label = polar(280, 280, 210, angle);
                  return (
                    <g key={n}>
                      <path d={sectorPath(280, 280, 252, 186, start, end)} fill={fill} stroke={stroke} strokeWidth="1.25" />
                      <text x={label.x} y={label.y + 3} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="ui-monospace, monospace">{n}</text>
                    </g>
                  );
                })}
                <circle cx="280" cy="280" r="186" fill="none" stroke="#d6b662" strokeOpacity=".22" strokeWidth="2" />
                <circle cx="280" cy="280" r="153" fill="#10140f" stroke="#a7853d" strokeOpacity=".5" strokeWidth="7" />
                <circle cx="280" cy="280" r="110" fill="#1b1510" stroke="#d4b25d" strokeOpacity=".65" strokeWidth="7" />
                <circle cx="280" cy="280" r="78" fill="#060708" stroke="#ecd58b" strokeOpacity=".16" strokeWidth="2" />
                <circle cx="280" cy="280" r="60" fill="#0b0d0c" stroke="#fff" strokeOpacity=".04" />
              </motion.svg>
              <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                <div className="font-mono text-[7px] uppercase tracking-[.32em] text-white/25">{pending == null ? "VÝSLEDEK" : "BALL IN PLAY"}</div>
                <div className={cn("mt-1 font-display text-5xl sm:text-6xl", pending != null ? "text-white/15" : winning == null ? "text-white/15" : isRed(winning) ? "text-rose-200" : winning === 0 ? "text-emerald-200" : "text-white")}>{pending != null ? "—" : winning ?? "—"}</div>
              </div>
              <div className="pointer-events-none absolute left-1/2 top-[2%] -translate-x-1/2 text-[#f4dfa0] drop-shadow-[0_0_10px_rgba(244,223,160,.65)]">▼</div>
              {pending != null && (
                <motion.div className="pointer-events-none absolute left-1/2 top-[10%] h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white/70 bg-white shadow-[0_0_18px_8px_rgba(255,255,255,.55)]" animate={{ rotate: 360 * 3 }} transition={{ duration: SPIN_SEC, ease: "linear" }} style={{ transformOrigin: "0 210px" }} />
              )}
            </div>
          </div>

          <aside className="grid content-center gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="BALANCE" value={`$${serverBalance.toLocaleString()}`} accent="text-emerald-200" />
              <Stat label="TOTAL STAKE" value={`$${total.toLocaleString()}`} accent="text-[#f0d98b]" />
            </div>
            <div className="rounded-2xl border border-white/8 bg-[#0b110e] p-4">
              <div className="aaa-meta">TABLE STATE</div>
              <div className="mt-2 font-display text-3xl tracking-[.12em] text-white">{phase === "SPINNING" ? "BALL IN PLAY" : phase}</div>
              <p className="mt-1 text-xs leading-5 text-white/35">{phase === "BETTING" ? "Dealer is accepting bets. Place chips on the carpet below." : phase === "SPINNING" ? "The result is hidden until the ball completes its landing animation." : "Winning number confirmed. Next round opens automatically."}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[#0b110e] p-4">
              <div className="flex items-center justify-between"><div className="aaa-meta">LAST RESULTS</div><span className="font-mono text-[8px] text-white/20">14 ROLLS</span></div>
              <div className="mt-3 flex flex-wrap gap-2">{history.length ? history.map((n, i) => <span key={`${n}-${i}`} className={cn("grid h-9 min-w-9 place-items-center rounded-full border px-2 font-mono text-[9px] font-black", n === 0 ? "border-emerald-300/40 bg-emerald-950 text-emerald-100" : isRed(n) ? "border-rose-300/30 bg-rose-950 text-white" : "border-white/10 bg-black text-white")}>{n}</span>) : <span className="font-mono text-[9px] text-white/20">Čekám na první výsledek…</span>}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="STRAIGHT" value="36×" />
              <Stat label="CORNER" value="9×" />
              <Stat label="DOZEN" value="3×" />
              <Stat label="EVEN MONEY" value="2×" />
            </div>
          </aside>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#c8a858]/22 bg-[#0a1710] p-4 shadow-[0_25px_80px_-55px_rgba(200,168,88,.55)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
          <div><div className="aaa-meta text-[#e5c873]">EUROPEAN WHEEL</div><h2 className="mt-1 font-display text-2xl tracking-[.14em] text-white">SÁZKOVÝ KOBEREC</h2></div>
          <div className="flex items-center gap-2"><div className="rounded-full border border-[#d6b662]/20 bg-black/20 px-4 py-2 font-mono text-[10px] font-black text-[#f0d98b]">${serverBalance.toLocaleString()}</div>{total > 0 && phase === "BETTING" && <button onClick={() => void cancel()} className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/20 bg-rose-300/[.04] px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[.16em] text-rose-200"><RotateCcw className="h-3.5 w-3.5"/> Vrátit</button>}</div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">{[10, 50, 100, 500, 1000, 5000, 10000].map((v) => <button key={v} onClick={() => setChip(v)} disabled={phase !== "BETTING"} className={cn("rounded-full border px-4 py-2 font-mono text-[9px] font-black transition disabled:cursor-not-allowed disabled:opacity-30", chip === v ? "border-[#f2dd98] bg-[#f2dd98] text-[#17120a] shadow-[0_0_22px_rgba(242,221,152,.18)]" : "border-white/10 bg-black/20 text-white/50 hover:border-[#d6b662]/35 hover:text-white")}>${v.toLocaleString()}</button>)}</div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[#9e7e37]/30 bg-[#0b3a24]">
          <div className="grid grid-cols-[54px_repeat(12,minmax(42px,1fr))] grid-rows-3 gap-px bg-[#7b642d]/35 p-px sm:grid-cols-[62px_repeat(12,minmax(48px,1fr))]">
            <button onClick={() => void place("0")} disabled={!canBet} className="row-span-3 flex items-center justify-center bg-[#0c6a47] font-display text-2xl text-white transition hover:brightness-110 disabled:opacity-40">{0}</button>
            {ROWS.map((row, ri) => row.map((n) => <button key={n} onClick={() => void place(String(n))} disabled={!canBet} className={cn("relative flex min-h-14 items-center justify-center font-display text-lg transition hover:brightness-110 disabled:opacity-35 sm:min-h-16 sm:text-xl", isRed(n) ? "bg-[#8b202b] text-white" : "bg-[#15191a] text-white")}>{n}{bets[String(n)] > 0 && <span className="absolute right-1 top-1 rounded-full bg-[#f1d98d] px-1.5 py-0.5 font-mono text-[7px] font-black text-black">${bets[String(n)].toLocaleString()}</span>}</button>))}
          </div>
          <div className="grid grid-cols-3 gap-px bg-[#7b642d]/35 p-px">
            {["doz_1", "doz_2", "doz_3"].map((k, i) => <QuickBet key={k} label={`${i + 1}. TUZET`} odds="3×" amount={bets[k] ?? 0} disabled={!canBet} onClick={() => void place(k)} />)}
          </div>
          <div className="grid grid-cols-6 gap-px bg-[#7b642d]/35 p-px">
            {[['low','1–18','2×'],['even','SUDÁ','2×'],['red','ČERVENÁ','2×'],['black','ČERNÁ','2×'],['odd','LICHÁ','2×'],['high','19–36','2×']].map(([k,label,odds]) => <QuickBet key={k} label={label} odds={odds} amount={bets[k] ?? 0} disabled={!canBet} onClick={() => void place(k)} />)}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-cyan-200/10 bg-[#071016] p-4">
          <div className="flex items-start justify-between gap-4"><div><div className="aaa-meta text-cyan-100/75">CORNER BET · 4 ČÍSLA</div><p className="mt-1 text-xs text-white/35">Klikni na jednu čtveřici. Příklad: <span className="text-white/75">8 · 9 · 11 · 12</span> → výplata 9×.</p></div><Sparkles className="h-4 w-4 text-cyan-200"/></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{CORNERS.map((c) => { const key = `corner_${c.join(",")}`; return <button key={key} onClick={() => void place(key)} disabled={!canBet} className={cn("rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-30", bets[key] > 0 ? "border-cyan-200/45 bg-cyan-200/10" : "border-white/8 bg-black/20 hover:border-cyan-200/25") }><div className="flex items-center justify-between"><span className="font-mono text-[9px] font-black tracking-[.14em] text-white/75">{c.join(" · ")}</span><span className="font-mono text-[8px] text-cyan-200">9×</span></div>{bets[key] > 0 && <div className="mt-1 font-mono text-[7px] text-[#f0d98b]">STAKE ${bets[key].toLocaleString()}</div>}</button>; })}</div>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, accent = "text-white" }: { label: string; value: string; accent?: string }) {
  return <div className="rounded-2xl border border-white/8 bg-[#0b110e] p-4"><div className="aaa-meta">{label}</div><div className={cn("mt-2 font-display text-2xl tracking-[.08em]", accent)}>{value}</div></div>;
}

function QuickBet({ label, odds, amount, disabled, onClick }: { label: string; odds: string; amount: number; disabled: boolean; onClick: () => void }) {
  return <button disabled={disabled} onClick={onClick} className={cn("min-h-12 bg-[#113a25] px-2 py-3 text-center transition hover:bg-[#174a30] disabled:opacity-35", amount > 0 && "bg-[#1b4c34] shadow-[inset_0_0_0_1px_rgba(240,217,139,.45)]")}><span className="block font-mono text-[8px] font-black uppercase tracking-[.13em] text-white/75">{label}</span><span className="mt-1 block font-mono text-[8px] text-[#efd98d]">{odds}</span>{amount > 0 && <span className="mt-1 block font-mono text-[7px] font-black text-white">${amount.toLocaleString()}</span>}</button>;
}
