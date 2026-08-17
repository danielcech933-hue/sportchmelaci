import { AnimatePresence, motion } from "framer-motion";
import { Coins, Fish, Gem, Minus, Plus, RotateCw, Waves, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";
import { EpicSymbolArt } from "@/components/slots/EpicSymbolArt";
import { EpicBackdrop, type EpicGame } from "@/components/slots/EpicStage";
import { EpicBonusCinematic, featureFor, EPIC_FEATURES } from "@/components/slots/EpicBonusCinematic";
import { EpicPaytablePanel } from "@/components/slots/EpicPaytablePanel";
import { WinCinematic, getWinTier, shakeKeyframes, type WinTier } from "@/components/slots/EpicWinSequence";
import { EpicBadge } from "@/components/slots/EpicFX";

type Cell = [number, number];

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
  divine_cells?: Cell[];
  lightning_cells?: Cell[];
  money_values?: number[];
  wild_count?: number;
  scatter_count?: number;
  collector?: number;
  multiplier?: number;
};

const META: Record<EpicGame, { title: string; kicker: string; cols: number; rows: number; pool: string[] }> = {
  "thunder-egg": {
    title: "THUNDER EGG",
    kicker: "OLYMPUS STORM",
    cols: 6,
    rows: 5,
    pool: ["zeus_k", "thunder", "eagle", "egg", "wild", "pillar", "hand", "zeus_q", "zeus_j", "zeus_10"],
  },
  "bass-bounty": {
    title: "BASS BOUNTY",
    kicker: "DEEP WATER HUNT",
    cols: 5,
    rows: 3,
    pool: ["fish_k", "hook", "lure", "fisher", "fish_money", "angler_wild", "boat_scatter", "fish_q", "fish_j", "fish_10"],
  },
};

const STANDARD_BETS = [5, 10, 20, 50, 100, 250, 500];
const PRIVILEGED_BETS = [5, 10, 20, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
const PRIVILEGED_NAMES = new Set(["danko", "chlaďar", "chladar", "midas", "m1das"]);

function playTone(kind: "spin" | "stop" | "win" | "bonus") {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const base = kind === "spin" ? 150 : kind === "stop" ? 240 : kind === "win" ? 420 : 620;
    osc.type = kind === "spin" ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(base, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(base * (kind === "spin" ? 1.7 : 2.05), ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(kind === "bonus" ? 0.12 : 0.055, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
    window.setTimeout(() => void ctx.close(), 720);
  } catch {
    /* audio is optional */
  }
}

function HudTile({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "gold" | "cyan" }) {
  const color = tone === "gold" ? "text-amber-200" : tone === "cyan" ? "text-cyan-200" : "text-white";
  return (
    <div className="min-w-[92px] rounded-xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur">
      <div className="font-mono text-[7px] font-black uppercase tracking-[.18em] text-white/35">{label}</div>
      <div className={`mt-0.5 font-display text-sm tracking-wider ${color}`}>{value}</div>
    </div>
  );
}

export function EpicSlotMachineCinematic({ game, playerName }: { game: EpicGame; playerName: string }) {
  const meta = META[game];
  const thunder = game === "thunder-egg";
  const { slotCZK, ready } = useWallet();
  const { nickname } = useAuth();
  const privileged = PRIVILEGED_NAMES.has((nickname ?? "").trim().toLocaleLowerCase("cs-CZ"));
  const betOptions = privileged ? PRIVILEGED_BETS : STANDARD_BETS;
  const [balance, setBalance] = useState(slotCZK);
  const [betIndex, setBetIndex] = useState(1);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [tier, setTier] = useState<WinTier | null>(null);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [revealId, setRevealId] = useState(0);
  const [shaking, setShaking] = useState(false);

  const bet = betOptions[Math.min(betIndex, betOptions.length - 1)] ?? 10;
  const maxBet = betOptions[betOptions.length - 1] ?? 500;

  useEffect(() => setBalance(slotCZK), [slotCZK]);
  useEffect(() => {
    if (betIndex >= betOptions.length) setBetIndex(Math.max(0, betOptions.length - 1));
  }, [betIndex, betOptions.length]);

  const fallback = useMemo(
    () =>
      Array.from({ length: meta.cols }, (_, c) =>
        Array.from({ length: meta.rows }, (_, r) => meta.pool[(c * 3 + r * 2) % meta.pool.length]),
      ),
    [meta],
  );

  const grid = result?.grid ?? fallback;
  const divine = useMemo(() => new Set((result?.divine_cells ?? []).map(([c, r]) => `${c}-${r}`)), [result]);
  const lightning = useMemo(() => new Set((result?.lightning_cells ?? []).map(([c, r]) => `${c}-${r}`)), [result]);
  const freeSpins = result?.free_spins_left ?? 0;
  const inBonus = Boolean(result && freeSpins > 0 && result.bonus_done === false);
  const collector = result?.collector ?? 0;
  const multiplier = Number(result?.multiplier ?? 1);

  const spin = useCallback(async () => {
    if (!ready || spinning) return;
    const amount = inBonus ? 0 : bet;
    if (!inBonus && amount > balance) {
      toast.error("Nedostatek Slot CZK — použij Směnárnu.");
      return;
    }

    setSpinning(true);
    setTier(null);
    setShaking(false);
    playTone("spin");

    const { data, error } = await supabase.rpc("slot_epic_spin", { _game_id: game, _bet: amount });
    if (error) {
      toast.error(error.message);
      setSpinning(false);
      return;
    }

    const next = (Array.isArray(data) ? data[0] : data) as Result;
    if (!next?.grid || next.columns !== meta.cols || next.rows !== meta.rows || !Number.isFinite(Number(next.slot_czk))) {
      toast.error("Server vrátil neplatný výsledek hry.");
      setSpinning(false);
      return;
    }

    window.setTimeout(() => {
      setResult(next);
      setBalance(Number(next.slot_czk));
      setSpinning(false);
      setRevealId((value) => value + 1);
      playTone("stop");

      const nextTier = getWinTier(Number(next.multiplier_of_bet ?? 0));
      setTier(nextTier);
      if (nextTier) {
        playTone("win");
        setShaking(true);
        window.setTimeout(() => setShaking(false), 900);
        window.setTimeout(() => setTier(null), 2900);
      }

      if (next.bonus_triggered && !next.bonus_done) {
        playTone("bonus");
        setBonusOpen(true);
        window.setTimeout(() => setBonusOpen(false), 3600);
      }

      if (next.total > 0) toast.success(`${next.feature}: +${next.total.toLocaleString("cs-CZ")} CZK`);
    }, 760);
  }, [balance, bet, game, inBonus, meta.cols, meta.rows, ready, spinning]);

  const frame = thunder
    ? "border-amber-300/60 shadow-[0_40px_140px_-55px_rgba(255,204,68,.9)]"
    : "border-cyan-300/55 shadow-[0_40px_140px_-55px_rgba(90,220,255,.85)]";

  return (
    <div className={`relative overflow-hidden rounded-[32px] border bg-[#04070c] p-2 sm:p-4 ${frame}`}>
      <EpicBackdrop game={game} spinning={spinning} />
      <div className="relative z-10 rounded-[26px] border border-white/10 bg-black/50 p-3 backdrop-blur-xl sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className={`font-mono text-[8px] font-black uppercase tracking-[.36em] ${thunder ? "text-amber-200" : "text-cyan-200"}`}>{meta.kicker} · SPORTCHMELÁCI ORIGINAL</div>
            <div className="mt-1 flex flex-wrap items-center gap-2"><h3 className="font-display text-3xl tracking-[.14em] text-white sm:text-4xl">{meta.title}</h3><EpicBadge>CINEMATIC EDITION</EpicBadge></div>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[.16em] text-white/40">{playerName} · SERVER RNG · SLOT CZK</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <HudTile label="SLOT CZK" value={`${balance.toLocaleString("cs-CZ")} Kč`} tone="gold" />
            <HudTile label="MULTIPLIER" value={`${multiplier.toFixed(1)}×`} tone={thunder ? "gold" : "cyan"} />
            <HudTile label="FREE SPINS" value={inBonus ? String(freeSpins) : "—"} />
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/55 px-2 py-2 backdrop-blur">
              <button type="button" aria-label="Snížit sázku" onClick={() => setBetIndex((i) => Math.max(0, i - 1))} disabled={inBonus} className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-white/70 disabled:opacity-30"><Minus className="h-3.5 w-3.5" /></button>
              <div className="min-w-[82px] text-center"><div className="font-mono text-[7px] font-black uppercase tracking-[.18em] text-white/35">SÁZKA</div><div className="font-display text-sm tracking-wider text-white">{bet.toLocaleString("cs-CZ")} Kč</div></div>
              <button type="button" aria-label="Zvýšit sázku" onClick={() => setBetIndex((i) => Math.min(betOptions.length - 1, i + 1))} disabled={inBonus} className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-white/70 disabled:opacity-30"><Plus className="h-3.5 w-3.5" /></button>
            </div>
            {privileged && <button type="button" onClick={() => setBetIndex(betOptions.length - 1)} disabled={inBonus} className="rounded-xl border border-amber-300/35 bg-amber-300/10 px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.14em] text-amber-200 disabled:opacity-30">MAX {maxBet.toLocaleString("cs-CZ")}</button>}
            <motion.button type="button" onClick={() => void spin()} disabled={!ready || spinning} whileTap={{ scale: 0.96 }} className={`inline-flex h-12 items-center gap-2 rounded-xl px-6 text-xs font-black uppercase tracking-[.18em] text-black transition disabled:cursor-not-allowed disabled:opacity-50 ${thunder ? "bg-gradient-to-b from-amber-200 to-amber-500 shadow-[0_0_45px_-12px_rgba(255,204,68,.95)]" : "bg-gradient-to-b from-cyan-200 to-cyan-500 shadow-[0_0_45px_-12px_rgba(90,220,255,.95)]"}`}>{spinning ? <RotateCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}{spinning ? "TOČÍME" : inBonus ? "FREE SPIN" : "SPIN"}</motion.button>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <motion.div animate={shaking ? shakeKeyframes(tier) : { x: 0, y: 0 }} transition={{ duration: 0.5 }} className="relative">
          <motion.div animate={spinning ? { scale: 1.012 } : { scale: 1 }} transition={{ duration: 0.5 }} className={`relative overflow-hidden rounded-[28px] border-2 bg-black/65 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_35px_100px_-45px_rgba(0,0,0,.95)] sm:p-3 ${thunder ? "border-amber-200/45" : "border-cyan-200/40"}`}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.1),transparent_30%),linear-gradient(180deg,transparent,rgba(0,0,0,.7))]" />
            <AnimatePresence>{spinning && <motion.div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-2/3 bg-gradient-to-b from-transparent via-white/15 to-transparent blur-2xl" initial={{ y: "-120%", opacity: 0 }} animate={{ y: "200%", opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.8, ease: "easeIn" }} />}</AnimatePresence>
            <div className="relative grid gap-1.5" style={{ gridTemplateColumns: `repeat(${meta.cols}, minmax(0,1fr))` }}>
              {grid.flatMap((column, c) => column.map((symbol, r) => {
                const key = `${c}-${r}`; const isDivine = divine.has(key); const isStrike = lightning.has(key); const isMoney = !thunder && symbol === "fish_money";
                return <motion.div key={`${revealId}-${key}`} initial={{ y: -26, opacity: 0.6, filter: "blur(6px)" }} animate={{ y: 0, opacity: 1, filter: "blur(0px)" }} transition={{ duration: 0.34, delay: c * 0.09 + r * 0.02, ease: [0.22, 1, 0.36, 1] }} className={`relative flex aspect-[.88] items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-b from-white/[.1] via-[#08121b] to-[#010204] ${isStrike ? "border-yellow-100 shadow-[0_0_42px_rgba(250,204,21,.95)]" : isDivine ? "border-amber-100 shadow-[0_0_38px_rgba(251,191,36,.8)]" : isMoney ? "border-amber-200/40 shadow-[0_0_26px_-6px_rgba(255,204,68,.6)]" : "border-white/8"}`}>
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.08),transparent_32%,transparent_68%,rgba(255,255,255,.035))]" /><EpicSymbolArt game={game} symbol={symbol} className="relative z-10" />
                  {isMoney && <motion.div animate={{ scale: [1, 1.05, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.1, repeat: Infinity }} className="absolute bottom-1.5 z-20 rounded-full border border-amber-200/40 bg-amber-300/10 px-2 py-0.5 font-mono text-[7px] font-black uppercase tracking-[.16em] text-amber-100">MONEY</motion.div>}
                  {isDivine && <motion.div animate={{ opacity: [0.2, 0.85, 0.2], scale: [0.85, 1.1, 0.85] }} transition={{ duration: 0.9, repeat: Infinity }} className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(circle,rgba(255,220,120,.3),transparent_60%)]" />}
                  {isStrike && <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.45, repeat: Infinity }} className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent_40%,rgba(255,248,170,.95)_49%,transparent_58%)]" />}
                </motion.div>;
              }))}
            </div>
            <AnimatePresence>{tier && result?.total ? <motion.div className="pointer-events-none absolute inset-0 z-40 grid place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div initial={{ scale: 0.6, y: 24 }} animate={{ scale: [1, 1.06, 1], y: 0 }} transition={{ duration: 0.7 }} className="text-center"><div className="font-mono text-[9px] font-black uppercase tracking-[.36em] text-white/60">{result.feature}</div><div className={`font-display text-[clamp(26px,5vw,60px)] tracking-[.12em] ${thunder ? "text-amber-200" : "text-cyan-200"} drop-shadow-[0_0_30px_rgba(255,255,255,.5)]`}>+{result.total.toLocaleString("cs-CZ")} CZK</div></motion.div></motion.div> : null}</AnimatePresence>
          </motion.div>
        </motion.div>

        <aside className="space-y-2">
          <FeatureStat icon={thunder ? <Zap className="h-4 w-4 text-amber-300" /> : <Fish className="h-4 w-4 text-cyan-300" />} title={thunder ? "DIVINE REVEAL" : "MEGA CATCH"} value={thunder ? `${result?.divine_cells?.length ?? 0} zásahů` : `${(result?.bonus_collected ?? 0).toLocaleString("cs-CZ")} CZK`} />
          <FeatureStat icon={thunder ? <Gem className="h-4 w-4 text-amber-300" /> : <Waves className="h-4 w-4 text-cyan-300" />} title={thunder ? "LIGHTNING STRIKES" : "COLLECTOR"} value={thunder ? `${result?.lightning_cells?.length ?? 0}×` : `${collector} / 4`} />
          <FeatureStat icon={<Coins className="h-4 w-4 text-amber-300" />} title="POSLEDNÍ VÝHRA" value={`${Number(result?.multiplier_of_bet ?? 0).toFixed(1)}× sázky`} />
          {!thunder && <div className="rounded-2xl border border-cyan-300/25 bg-cyan-300/[.04] p-3"><div className="flex items-center justify-between font-mono text-[8px] font-black uppercase tracking-[.18em] text-cyan-200"><span>COLLECTOR PROGRESS</span><span>{collector}/4</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-black/50"><motion.div animate={{ width: `${Math.min(100, (collector / 4) * 100)}%` }} className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" /></div></div>}
          {inBonus && <div className="rounded-2xl border border-amber-300/40 bg-amber-300/[.07] p-3 shadow-[0_0_35px_-18px_rgba(255,204,68,.9)]"><div className="flex items-center justify-between font-mono text-[8px] font-black uppercase tracking-[.17em] text-amber-200"><span>{featureFor(game, result?.bonus_mode).title}</span><span>{freeSpins} SPINŮ</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40"><motion.div animate={{ width: `${Math.min(100, Math.max(6, (freeSpins / 20) * 100))}%` }} className="h-full rounded-full bg-amber-300" /></div><p className="mt-2 text-[10px] text-white/50">{featureFor(game, result?.bonus_mode).blurb}</p></div>}
          <div className="rounded-2xl border border-white/10 bg-black/45 p-3"><div className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-white/45">FEATURE FLOW</div><div className="mt-2 space-y-1.5">{EPIC_FEATURES[game].map((feature, index) => <div key={feature.key} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[.025] px-2.5 py-2"><span className={`grid h-5 w-5 place-items-center rounded-full font-mono text-[8px] font-black ${thunder ? "bg-amber-300/10 text-amber-200" : "bg-cyan-300/10 text-cyan-200"}`}>{index + 1}</span><span className="font-mono text-[8px] font-black uppercase tracking-[.12em] text-white/65">{feature.title}</span></div>)}</div></div>
        </aside>
      </div>
      <div className="relative z-10 mt-3"><EpicPaytablePanel game={game} /></div>
      <EpicBonusCinematic open={bonusOpen} game={game} mode={result?.bonus_mode} spins={freeSpins} multiplier={multiplier} />
      <WinCinematic tier={tier} amount={result?.total ?? 0} multiplier={Number(result?.multiplier_of_bet ?? 0)} game={game} />
    </div>
  );
}

function FeatureStat({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/45 p-3"><div className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[.03]">{icon}</div><div className="min-w-0"><div className="font-mono text-[7px] font-black uppercase tracking-[.18em] text-white/35">{title}</div><div className="truncate font-display text-sm tracking-wider text-white">{value}</div></div></div>;
}
