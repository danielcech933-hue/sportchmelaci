import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Fish, Flame, Gem, Hammer, Lightning, RotateCw, Sparkles, Trophy, Waves, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/lib/wallet";
import type { SlotVariantId } from "./SlotVariantFrame";

const META = {
  "thunder-egg": {
    title: "THUNDER EGG",
    subtitle: "OLYMPUS STORM",
    cols: 6,
    rows: 5,
    theme: "from-indigo-950 via-slate-950 to-black",
    border: "border-amber-300/45",
    accent: "text-amber-200",
  },
  "bass-bounty": {
    title: "BASS BOUNTY",
    subtitle: "WILD WATER",
    cols: 5,
    rows: 3,
    theme: "from-cyan-950 via-slate-950 to-black",
    border: "border-cyan-300/45",
    accent: "text-cyan-200",
  },
} as const;

type EpicId = keyof typeof META;
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
  "thunder-egg": {
    zeus_k: "K", zeus_q: "Q", zeus_j: "J", zeus_10: "10", thunder: "⚡", eagle: "🦅", pillar: "🏛", egg: "🥚", wild: "☄", hand: "✋", scatter: "◈",
  },
  "bass-bounty": {
    fisher: "🎣", fish_k: "K", fish_q: "Q", fish_j: "J", fish_10: "10", hook: "🪝", lure: "🐟", boat_scatter: "⚓", angler_wild: "🎣", fish_money: "💰",
  },
};

function labelForMode(mode?: string | null) {
  if (mode === "storm") return "STORM ASCENSION";
  if (mode === "wheel") return "THUNDER WHEEL";
  if (mode === "superstar") return "SUPREME THUNDER";
  if (mode === "big_catch") return "MEGA CATCH";
  return "BONUS FEATURE";
}

export function EpicSlotMachine({ game, playerName }: { game: EpicId; playerName: string }) {
  const meta = META[game];
  const symbols = SYMBOLS[game];
  const { slotCZK, ready } = useWallet();
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [bonusMode, setBonusMode] = useState<string | null>(null);
  const [showBonus, setShowBonus] = useState(false);

  const fallback = useMemo(() => Array.from({ length: meta.cols }, (_, c) => Array.from({ length: meta.rows }, (_, r) => Object.keys(symbols)[(c + r) % Object.keys(symbols).length])), [game]);
  const grid = result?.grid ?? fallback;

  async function spin() {
    if (!ready || spinning) return;
    const bonusSpin = Boolean(result && (result.free_spins_left ?? 0) > 0);
    const amount = bonusSpin ? 0 : bet;
    if (!bonusSpin && amount > slotCZK) return;
    setSpinning(true);
    setResult(null);
    const { data, error } = await supabase.rpc("slot_epic_spin", { _game_id: game, _bet: amount });
    if (error) {
      toast.error(error.message);
      setSpinning(false);
      return;
    }
    const next = (Array.isArray(data) ? data[0] : data) as Result;
    if (!next?.grid || next.columns !== meta.cols || next.rows !== meta.rows) {
      toast.error("Server vrátil neplatný výsledek hry.");
      setSpinning(false);
      return;
    }
    window.setTimeout(() => {
      setResult(next);
      setSpinning(false);
      if (next.bonus_triggered && !bonusMode && !next.bonus_done) {
        setBonusMode(next.bonus_mode ?? "bonus");
        setShowBonus(true);
        window.setTimeout(() => setShowBonus(false), 2200);
      }
      if (next.total > 0) toast.success(`${next.feature}: +${next.total.toLocaleString("cs-CZ")} CZK`);
    }, 700);
  }

  const divine = new Set((result?.divine_cells ?? []).map(([c, r]) => `${c}-${r}`));
  const lightning = new Set((result?.lightning_cells ?? []).map(([c, r]) => `${c}-${r}`));
  const moneyValues = result?.money_values ?? [];

  return (
    <div className={`relative overflow-hidden rounded-[1.75rem] border ${meta.border} bg-gradient-to-br ${meta.theme} p-3 sm:p-5`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.12),transparent_35%),linear-gradient(180deg,transparent,rgba(0,0,0,.65))]" />
      <div className="relative flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/50 p-3 backdrop-blur-xl">
        <div><div className={`font-mono text-[8px] font-black uppercase tracking-[.3em] ${meta.accent}`}>{meta.subtitle}</div><h3 className="mt-1 font-display text-2xl tracking-[.12em] text-white sm:text-3xl">{meta.title}</h3><p className="mt-1 text-[11px] text-white/55">{playerName} · Server RNG · pouze Slot CZK</p></div>
        <div className="flex items-center gap-2"><div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-right"><div className="font-mono text-[8px] uppercase tracking-[.2em] text-white/40">ZŮSTATEK</div><div className="font-mono text-sm font-black text-hop-gold">{slotCZK.toLocaleString("cs-CZ")} Kč</div></div><select value={bet} onChange={(e) => setBet(Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white"><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option><option value={200}>200</option><option value={500}>500</option></select><button type="button" onClick={() => void spin()} disabled={!ready || spinning} className="inline-flex items-center gap-2 rounded-xl bg-hop-gold px-4 py-2.5 text-xs font-black uppercase tracking-[.14em] text-black disabled:opacity-50">{spinning ? <RotateCw className="h-4 w-4 animate-spin"/> : <Zap className="h-4 w-4"/>}{spinning ? "TOČÍME" : "SPIN"}</button></div>
      </div>

      <div className="relative mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <div className={`relative rounded-[1.5rem] border ${meta.border} bg-black/55 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_30px_80px_-40px_rgba(255,204,68,.8)]`}>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${meta.cols},minmax(0,1fr))` }}>
            {grid.flatMap((col, c) => col.map((symbol, r) => {
              const key = `${c}-${r}`;
              const isDivine = divine.has(key);
              const isLightning = lightning.has(key);
              const valueIndex = Math.min((c * meta.rows + r), Math.max(0, moneyValues.length - 1));
              const money = game === "bass-bounty" && symbol === "fish_money" ? moneyValues[valueIndex] : undefined;
              return <motion.div key={key} className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-b from-white/[.08] to-black/65 ${isLightning ? "border-yellow-300 shadow-[0_0_22px_rgba(250,204,21,.9)]" : isDivine ? "border-amber-200/80 shadow-[0_0_18px_rgba(251,191,36,.65)]" : "border-white/10"}`} animate={spinning ? { scale: [1,.94,1], filter: ["blur(0px)","blur(1.5px)","blur(0px)"] } : isDivine ? { scale: [1,1.04,1] } : { scale: 1 }} transition={{ duration: isDivine ? .8 : .45, repeat: isDivine ? Infinity : 0 }}>
                <span className={`relative z-10 font-display text-lg sm:text-3xl ${symbol.includes("wild") || symbol === "hand" || symbol === "egg" || symbol === "scatter" || symbol === "fish_money" ? "text-hop-gold drop-shadow-[0_0_14px_rgba(255,204,68,.95)]" : "text-white"}`}>{symbols[symbol] ?? symbol}</span>
                {money !== undefined && <span className="absolute bottom-1 rounded-full bg-emerald-400/15 px-1.5 py-0.5 font-mono text-[8px] font-black text-emerald-200">{money}×</span>}
                {isLightning && <Lightning className="absolute inset-0 m-auto h-10 w-10 text-yellow-200 opacity-80 animate-pulse"/>}
              </motion.div>;
            }))}
          </div>
          <AnimatePresence>{(result?.total ?? 0) > 0 && <motion.div initial={{ opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1.08 }} exit={{ opacity: 0 }} className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center"><div className="font-display text-4xl tracking-[.16em] text-hop-gold drop-shadow-[0_0_24px_rgba(255,204,68,.95)]">+{result?.total.toLocaleString("cs-CZ")} CZK</div><div className="font-mono text-[9px] uppercase tracking-[.32em] text-white/70">{result?.feature}</div></motion.div>}</AnimatePresence>
        </div>

        <aside className="space-y-2">
          {game === "thunder-egg" ? <>
            <EpicMeter icon={<Hammer className="h-4 w-4"/>} title="DIVINE REVEAL" value={`${result?.divine_cells?.length ?? 0} polí`} />
            <EpicMeter icon={<Zap className="h-4 w-4"/>} title="LIGHTNING" value={`${result?.lightning_cells?.length ?? 0} zásahy`} />
            <EpicMeter icon={<Gem className="h-4 w-4"/>} title="MULTIPLIER" value={`${Number(result?.multiplier ?? 1).toFixed(1)}×`} />
          </> : <>
            <EpicMeter icon={<Fish className="h-4 w-4"/>} title="MONEY CATCH" value={`${(result?.bonus_collected ?? 0).toLocaleString("cs-CZ")}×`} />
            <EpicMeter icon={<Flame className="h-4 w-4"/>} title="WILD COLLECTOR" value={`${result?.collector ?? 0}/4`} />
            <EpicMeter icon={<Waves className="h-4 w-4"/>} title="MULTIPLIER" value={`${Number(result?.multiplier ?? 1).toFixed(1)}×`} />
          </>}
          <div className="rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-xl"><div className="font-mono text-[8px] uppercase tracking-[.2em] text-white/40">BONUS</div><div className="mt-2 flex items-center justify-between gap-2"><span className="font-display text-sm text-white">{bonusMode ? labelForMode(bonusMode) : "Připraveno"}</span><Sparkles className="h-4 w-4 text-hop-gold"/></div><div className="mt-2 text-[9px] leading-relaxed text-white/45">Speciální sekce je serverově řízená a vizuál reaguje na skutečný výsledek.</div></div>
        </aside>
      </div>

      <AnimatePresence>{showBonus && <motion.div className="fixed inset-0 z-[999] grid place-items-center bg-black/80 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div initial={{ scale: .6, rotate: -4, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 180, damping: 12 }} className={`relative max-w-xl overflow-hidden rounded-[2rem] border ${meta.border} bg-black/80 p-8 text-center shadow-[0_0_110px_-20px_rgba(255,204,68,.9)]`}><div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,204,68,.24),transparent_45%),linear-gradient(135deg,rgba(34,211,238,.08),transparent_40%,rgba(217,70,239,.1))]"/><motion.div animate={{ rotate: [0,8,-8,0], scale: [1,1.12,1] }} transition={{ duration: .9, repeat: Infinity }} className="relative mx-auto mb-4 grid h-24 w-24 place-items-center rounded-full border border-hop-gold/60 bg-hop-gold/10 shadow-[0_0_55px_rgba(255,204,68,.4)]"><Trophy className="h-11 w-11 text-hop-gold"/></motion.div><div className="relative font-mono text-[10px] font-black uppercase tracking-[.35em] text-hop-neon">BONUS TRIGGERED</div><h4 className="relative mt-2 font-display text-4xl tracking-[.14em] text-white sm:text-6xl">{labelForMode(bonusMode)}</h4><p className="relative mt-3 font-mono text-xs uppercase tracking-[.2em] text-white/55">{result?.free_spins_left ?? 0} FREE SPINS · {Number(result?.multiplier ?? 1).toFixed(1)}× MULTIPLIER</p></motion.div></motion.div>}</AnimatePresence>
    </div>
  );
}

function EpicMeter({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-xl"><div className="flex items-center gap-2 text-hop-gold"><span>{icon}</span><span className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-white/45">{title}</span></div><div className="mt-2 font-display text-lg text-white">{value}</div></div>;
}
