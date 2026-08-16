import { useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Fish, Flame, Gem, Hammer, Info, RotateCw, Sparkles, Trophy, Waves, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/lib/wallet";
import { BonusChoiceGlow, BonusStep, EpicBadge, TrophyPulse, WinBurst, getBigWinTier, type BigWinTier } from "@/components/slots/EpicFX";

type EpicId = "thunder-egg" | "bass-bounty";
const META = {
  "thunder-egg": { title: "THUNDER EGG", subtitle: "OLYMPUS STORM", cols: 6, rows: 5, theme: "from-indigo-950 via-slate-950 to-black", border: "border-amber-300/45", accent: "text-amber-200", accentBg: "from-amber-400/18 via-indigo-500/8 to-transparent" },
  "bass-bounty": { title: "BASS BOUNTY", subtitle: "WILD WATER", cols: 5, rows: 3, theme: "from-cyan-950 via-slate-950 to-black", border: "border-cyan-300/45", accent: "text-cyan-200", accentBg: "from-cyan-400/18 via-blue-500/8 to-transparent" },
} as const;

type Result = {
  grid: string[][];
  columns: number;
  rows: number;
  total: number;
  multiplier_of_bet: number;
  slot_czk: number;
  feature: string;
  bonus_triggered?: boolean;
  bonus_mode?: string | null;
  free_spins_left?: number;
  bonus_done?: boolean;
  bonus_collected?: number;
  retriggered?: boolean;
  divine_cells?: [number, number][];
  coin_values?: number[];
  lightning_cells?: [number, number][];
  money_values?: number[];
  wild_count?: number;
  scatter_count?: number;
  collector?: number;
  multiplier?: number;
};

const SYMBOLS: Record<EpicId, Record<string, string>> = {
  "thunder-egg": { zeus_k: "K", zeus_q: "Q", zeus_j: "J", zeus_10: "10", thunder: "⚡", eagle: "🦅", pillar: "🏛", egg: "🥚", wild: "☄", hand: "✋", scatter: "◈" },
  "bass-bounty": { fisher: "🎣", fish_k: "K", fish_q: "Q", fish_j: "J", fish_10: "10", hook: "🪝", lure: "🐟", boat_scatter: "⚓", angler_wild: "🎣", fish_money: "💰" },
};

const PAYTABLE: Record<EpicId, Array<{ symbol: string; x3: string; x4: string; x5: string }>> = {
  "thunder-egg": [
    { symbol: "⚡", x3: "5×", x4: "15×", x5: "50×" },
    { symbol: "🦅", x3: "3×", x4: "8×", x5: "25×" },
    { symbol: "🏛", x3: "2×", x4: "5×", x5: "15×" },
    { symbol: "🥚", x3: "1.5×", x4: "4×", x5: "10×" },
    { symbol: "K / Q / J", x3: "0.8×", x4: "1.5×", x5: "5×" },
  ],
  "bass-bounty": [
    { symbol: "🐟", x3: "5×", x4: "12×", x5: "30×" },
    { symbol: "🪝", x3: "3×", x4: "8×", x5: "20×" },
    { symbol: "🎣", x3: "2×", x4: "5×", x5: "15×" },
    { symbol: "⚓", x3: "1.5×", x4: "4×", x5: "10×" },
    { symbol: "K / Q / J", x3: "0.8×", x4: "1.5×", x5: "5×" },
  ],
};

function labelForMode(mode?: string | null) {
  if (mode === "storm") return "STORM ASCENSION";
  if (mode === "wheel") return "THUNDER WHEEL";
  if (mode === "superstar") return "SUPREME THUNDER";
  if (mode === "big_catch") return "MEGA CATCH";
  return "BONUS FEATURE";
}

function chime(kind: "spin" | "win" | "bonus") {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = kind === "spin" ? "sawtooth" : "triangle";
    const base = kind === "bonus" ? 520 : kind === "win" ? 420 : 220;
    osc.frequency.setValueAtTime(base, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(base * (kind === "spin" ? 1.65 : 2.2), ctx.currentTime + (kind === "spin" ? 0.22 : 0.42));
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(kind === "bonus" ? 0.11 : 0.07, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === "bonus" ? 0.55 : 0.45));
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.6);
    window.setTimeout(() => void ctx.close(), 700);
  } catch { /* audio is optional */ }
}

export function EpicSlotMachine({ game, playerName }: { game: EpicId; playerName: string }) {
  const meta = META[game], symbols = SYMBOLS[game];
  const { slotCZK, ready } = useWallet();
  const [displayBalance, setDisplayBalance] = useState(slotCZK);
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [bonusMode, setBonusMode] = useState<string | null>(null);
  const [showBonus, setShowBonus] = useState(false);
  const [showPaytable, setShowPaytable] = useState(false);
  const [winTier, setWinTier] = useState<BigWinTier | null>(null);

  const fallback = useMemo(() => Array.from({ length: meta.cols }, (_, c) => Array.from({ length: meta.rows }, (_, r) => Object.keys(symbols)[(c + r) % Object.keys(symbols).length])), [game, meta.cols, meta.rows, symbols]);
  const grid = result?.grid ?? fallback;
  const divine = useMemo(() => new Set((result?.divine_cells ?? []).map(([c, r]) => `${c}-${r}`)), [result]);
  const lightning = useMemo(() => new Set((result?.lightning_cells ?? []).map(([c, r]) => `${c}-${r}`)), [result]);
  const moneyValues = result?.money_values ?? [];
  const freeSpins = result?.free_spins_left ?? 0;

  async function spin() {
    if (!ready || spinning) return;
    const bonusSpin = Boolean(result && freeSpins > 0 && result.bonus_done === false);
    const amount = bonusSpin ? 0 : bet;
    if (!bonusSpin && amount > displayBalance) { toast.error("Nedostatek Slot CZK — použij Směnárnu."); return; }
    setSpinning(true); setWinTier(null); setShowBonus(false); chime("spin");
    const { data, error } = await supabase.rpc("slot_epic_spin", { _game_id: game, _bet: amount });
    if (error) { toast.error(error.message); setSpinning(false); return; }
    const next = (Array.isArray(data) ? data[0] : data) as Result;
    if (!next?.grid || next.columns !== meta.cols || next.rows !== meta.rows || !Number.isFinite(Number(next.slot_czk))) {
      toast.error("Server vrátil neplatný výsledek hry."); setSpinning(false); return;
    }
    const tier = getBigWinTier(Number(next.multiplier_of_bet ?? 0));
    window.setTimeout(() => {
      setResult(next); setDisplayBalance(Number(next.slot_czk)); setSpinning(false); setWinTier(tier);
      if (next.bonus_triggered && !next.bonus_done) { setBonusMode(next.bonus_mode ?? "bonus"); setShowBonus(true); chime("bonus"); window.setTimeout(() => setShowBonus(false), 3400); }
      else if (next.total > 0) chime("win");
      if (next.total > 0) toast.success(`${next.feature}: +${next.total.toLocaleString("cs-CZ")} CZK`);
      if (tier) window.setTimeout(() => setWinTier(null), 2100);
    }, 550);
  }

  return (
    <div className={`relative overflow-hidden rounded-[1.75rem] border ${meta.border} bg-gradient-to-br ${meta.theme} p-3 sm:p-5`}>
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${meta.accentBg}`} />
      <motion.div className="pointer-events-none absolute -left-20 top-10 h-44 w-44 rounded-full bg-hop-gold/10 blur-3xl" animate={{ x: [0, 50, 0], y: [0, 18, 0], opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 4, repeat: Infinity }} />
      <motion.div className="pointer-events-none absolute -right-20 bottom-10 h-52 w-52 rounded-full bg-cyan-300/10 blur-3xl" animate={{ x: [0, -35, 0], y: [0, -20, 0], opacity: [0.15, 0.38, 0.15] }} transition={{ duration: 5, repeat: Infinity }} />

      <div className="relative flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/55 p-3 backdrop-blur-xl sm:p-4">
        <div>
          <div className={`font-mono text-[8px] font-black uppercase tracking-[.3em] ${meta.accent}`}>{meta.subtitle}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2"><h3 className="font-display text-2xl tracking-[.12em] text-white sm:text-3xl">{meta.title}</h3><EpicBadge>EPIC EDITION</EpicBadge></div>
          <p className="mt-1 text-[11px] text-white/55">{playerName} · Server RNG · pouze Slot CZK</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-right"><div className="font-mono text-[8px] uppercase tracking-[.2em] text-white/40">ZŮSTATEK</div><div className="font-mono text-sm font-black text-hop-gold">{displayBalance.toLocaleString("cs-CZ")} Kč</div></div>
          <select value={bet} onChange={(e) => setBet(Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white"><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option><option value={500}>500</option></select>
          <button type="button" onClick={() => void spin()} disabled={!ready || spinning} className="inline-flex items-center gap-2 rounded-xl bg-hop-gold px-4 py-2.5 text-xs font-black uppercase tracking-[.14em] text-black disabled:opacity-50">{spinning ? <RotateCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}{spinning ? "TOČÍME" : freeSpins > 0 ? "FREE SPIN" : "SPIN"}</button>
        </div>
      </div>

      <div className="relative mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className={`relative rounded-[1.5rem] border ${meta.border} bg-black/60 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_30px_90px_-40px_rgba(255,204,68,.8)]`}>
          {spinning && <motion.div initial={{ y: "-100%" }} animate={{ y: "200%" }} transition={{ duration: 0.9, ease: "easeIn" }} className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent blur-xl" />}
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${meta.cols},minmax(0,1fr))` }}>
            {grid.flatMap((col, c) => col.map((symbol, r) => {
              const key = `${c}-${r}`;
              const isDivine = divine.has(key), isLightning = lightning.has(key);
              const valueIndex = Math.min(c * meta.rows + r, Math.max(0, moneyValues.length - 1));
              const money = game === "bass-bounty" && symbol === "fish_money" ? moneyValues[valueIndex] : undefined;
              return (
                <motion.div key={key} className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-b from-white/[.08] to-black/65 ${isLightning ? "border-yellow-300 shadow-[0_0_26px_rgba(250,204,21,.95)]" : isDivine ? "border-amber-200/80 shadow-[0_0_22px_rgba(251,191,36,.7)]" : "border-white/10"}`} animate={spinning ? { y: [0, 12, -10, 0], scale: [1, 0.95, 1.02, 1] } : isDivine ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={{ duration: spinning ? 0.38 + c * 0.045 : isDivine ? 0.8 : 0.45, delay: spinning ? c * 0.04 : 0, repeat: spinning || isDivine ? Infinity : 0 }}>
                  <span className={`relative z-10 font-display text-lg sm:text-3xl ${symbol === "wild" || symbol === "hand" || symbol === "egg" || symbol === "scatter" || symbol === "fish_money" || symbol === "boat_scatter" ? "text-hop-gold drop-shadow-[0_0_16px_rgba(255,204,68,.95)]" : "text-white"}`}>{symbols[symbol] ?? symbol}</span>
                  {money !== undefined && <span className="absolute bottom-1 rounded-full border border-emerald-200/20 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[8px] font-black text-emerald-100">{money}×</span>}
                  {isLightning && <Zap className="absolute inset-0 m-auto h-10 w-10 text-yellow-200 opacity-85 animate-pulse" />}
                </motion.div>
              );
            }))}
          </div>
          <WinBurst tier={winTier} amount={Number(result?.total ?? 0)} />
        </div>

        <aside className="space-y-2">
          {game === "thunder-egg" ? <>
            <EpicMeter icon={<Hammer className="h-4 w-4" />} title="DIVINE REVEAL" value={`${result?.divine_cells?.length ?? 0} polí`} />
            <EpicMeter icon={<Zap className="h-4 w-4" />} title="LIGHTNING" value={`${result?.lightning_cells?.length ?? 0} zásahy`} />
            <EpicMeter icon={<Gem className="h-4 w-4" />} title="MULTIPLIER" value={`${Number(result?.multiplier ?? 1).toFixed(1)}×`} />
          </> : <>
            <EpicMeter icon={<Fish className="h-4 w-4" />} title="MONEY CATCH" value={`${(result?.bonus_collected ?? 0).toLocaleString("cs-CZ")}×`} />
            <EpicMeter icon={<Flame className="h-4 w-4" />} title="WILD COLLECTOR" value={`${result?.collector ?? 0}/4`} />
            <EpicMeter icon={<Waves className="h-4 w-4" />} title="MULTIPLIER" value={`${Number(result?.multiplier ?? 1).toFixed(1)}×`} />
          </>}

          <div className="rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-xl">
            <div className="flex items-center justify-between"><div className="font-mono text-[8px] uppercase tracking-[.2em] text-white/40">BONUS PROGRESS</div><Sparkles className="h-4 w-4 text-hop-gold" /></div>
            <div className="mt-2 grid gap-1.5">
              {game === "thunder-egg" ? <>
                <BonusStep index={1} label="Divine Reveal" active={Boolean(result?.divine_cells?.length)} icon={<Hammer className="h-3.5 w-3.5 text-hop-gold" />} />
                <BonusStep index={2} label="Lightning Strike" active={Boolean(result?.lightning_cells?.length)} icon={<Zap className="h-3.5 w-3.5 text-hop-gold" />} />
                <BonusStep index={3} label="Storm Bonus" active={Boolean(bonusMode)} icon={<Trophy className="h-3.5 w-3.5 text-hop-gold" />} />
              </> : <>
                <BonusStep index={1} label="Money Symbols" active={Boolean(result?.money_values?.length)} icon={<Gem className="h-3.5 w-3.5 text-hop-gold" />} />
                <BonusStep index={2} label="Collector Wild" active={Boolean(result?.collector)} icon={<Fish className="h-3.5 w-3.5 text-hop-gold" />} />
                <BonusStep index={3} label="Mega Catch" active={Boolean(bonusMode)} icon={<Trophy className="h-3.5 w-3.5 text-hop-gold" />} />
              </>}
            </div>
            {freeSpins > 0 && <div className="mt-2 rounded-xl border border-hop-gold/40 bg-hop-gold/10 p-2"><div className="font-mono text-[8px] uppercase tracking-[.2em] text-hop-gold/75">FREE SPINS</div><div className="mt-1 font-display text-2xl text-white">{freeSpins}</div></div>}
          </div>

          <button type="button" onClick={() => setShowPaytable((v) => !v)} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/45 px-3 py-3 text-left backdrop-blur-xl hover:border-hop-gold/30">
            <span className="inline-flex items-center gap-2 font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/65"><Info className="h-4 w-4 text-hop-gold" /> Výherní tabulka</span>
            <span className="font-mono text-[8px] text-hop-gold">{showPaytable ? "SKRÝT" : "ZOBRAZIT"}</span>
          </button>
        </aside>
      </div>

      <AnimatePresence>
        {showPaytable && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="relative mt-3 overflow-hidden rounded-2xl border border-hop-gold/20 bg-black/45 p-3 backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between"><div className="font-mono text-[8px] font-black uppercase tracking-[.22em] text-hop-gold">{meta.title} · PAYTABLE</div><div className="font-mono text-[7px] uppercase tracking-[.16em] text-white/35">3 / 4 / 5 symbolů</div></div>
            <div className="grid gap-1.5">
              {PAYTABLE[game].map((row) => <div key={row.symbol} className="grid grid-cols-[1fr_repeat(3,72px)] items-center rounded-xl border border-white/7 bg-white/[.02] px-3 py-2 text-center"><div className="text-left font-display text-lg text-white">{row.symbol}</div><div className="font-mono text-[9px] font-black text-white/65">{row.x3}</div><div className="font-mono text-[9px] font-black text-hop-gold">{row.x4}</div><div className="font-mono text-[9px] font-black text-white/80">{row.x5}</div></div>)}
            </div>
            <p className="mt-2 font-mono text-[7px] uppercase tracking-[.14em] text-white/30">Play money · Slot CZK · payout rules are server-controlled.</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBonus && (
          <motion.div className="fixed inset-0 z-[999] grid place-items-center bg-black/86 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BonusChoiceGlow>
              <motion.div initial={{ scale: 0.55, opacity: 0, rotateX: 30 }} animate={{ scale: 1, opacity: 1, rotateX: 0 }} transition={{ type: "spring", stiffness: 160, damping: 12 }} className={`relative w-full max-w-3xl overflow-hidden rounded-[2.2rem] border ${meta.border} bg-gradient-to-br ${meta.theme} p-6 text-center sm:p-10`}>
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,204,68,.28),transparent_40%),linear-gradient(120deg,rgba(34,211,238,.08),transparent_45%,rgba(217,70,239,.1))]" />
                <div className="relative flex flex-col items-center"><TrophyPulse /><div className="mt-4 font-mono text-[10px] font-black uppercase tracking-[.4em] text-hop-neon">BONUS TRIGGERED</div><h4 className="mt-2 font-display text-4xl tracking-[.14em] text-white sm:text-6xl">{labelForMode(bonusMode)}</h4><p className="mt-3 max-w-2xl font-mono text-[10px] uppercase tracking-[.2em] text-white/55">Serverový bonus · žádná další sázka během free spinů · násobitel se přenáší podle pravidel hry</p><div className="mt-6 grid w-full gap-2 sm:grid-cols-3">{game === "thunder-egg" ? <><BonusStep index={1} label="THUNDER WHEEL" active icon={<Zap className="h-3.5 w-3.5 text-hop-gold" />} /><BonusStep index={2} label="STORM ASCENSION" active icon={<Sparkles className="h-3.5 w-3.5 text-hop-gold" />} /><BonusStep index={3} label="SUPREME THUNDER" active icon={<Trophy className="h-3.5 w-3.5 text-hop-gold" />} /></> : <><BonusStep index={1} label="MONEY RAIN" active icon={<Gem className="h-3.5 w-3.5 text-hop-gold" />} /><BonusStep index={2} label="COLLECTOR" active icon={<Fish className="h-3.5 w-3.5 text-hop-gold" />} /><BonusStep index={3} label="MEGA CATCH" active icon={<Trophy className="h-3.5 w-3.5 text-hop-gold" />} /></>}</div><div className="mt-5 font-mono text-xs uppercase tracking-[.18em] text-hop-gold">{freeSpins} FREE SPINS · {Number(result?.multiplier ?? 1).toFixed(1)}× MULTIPLIER</div></div>
              </motion.div>
            </BonusChoiceGlow>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EpicMeter({ icon, title, value }: { icon: ReactNode; title: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-xl"><div className="flex items-center gap-2 text-hop-gold"><span>{icon}</span><span className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-white/45">{title}</span></div><div className="mt-2 font-display text-lg text-white">{value}</div></div>;
}
