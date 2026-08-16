import { AnimatePresence, motion } from "framer-motion";
import { Fish, Gem, Hammer, Info, RotateCw, Sparkles, Trophy, Waves, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/lib/wallet";
import { EpicSymbolArt } from "@/components/slots/EpicSymbolArt";
import { EpicBadge, getBigWinTier, type BigWinTier } from "@/components/slots/EpicFX";

type EpicId = "thunder-egg" | "bass-bounty";
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

const META = {
  "thunder-egg": {
    title: "THUNDER EGG",
    kicker: "OLYMPUS STORM",
    cols: 6,
    rows: 5,
    accent: "amber",
    bonuses: ["STORM ASCENSION", "THUNDER WHEEL", "SUPREME THUNDER"],
    steps: ["CLUSTER", "CASCADE", "DIVINE", "LIGHTNING", "BONUS"],
    paytable: [
      ["THUNDER", "5×", "15×", "50×"],
      ["EAGLE", "3×", "8×", "25×"],
      ["PILLAR", "2×", "5×", "15×"],
      ["EGG", "1.5×", "4×", "10×"],
    ],
  },
  "bass-bounty": {
    title: "BASS BOUNTY",
    kicker: "WILD WATER",
    cols: 5,
    rows: 3,
    accent: "cyan",
    bonuses: ["MEGA CATCH", "DEEP WATER", "WILD EXPEDITION"],
    steps: ["MONEY", "COLLECT", "FREE SPINS", "RETRIGGER", "MEGA CATCH"],
    paytable: [
      ["FISH", "5×", "12×", "30×"],
      ["HOOK", "3×", "8×", "20×"],
      ["ANGLER", "2×", "5×", "15×"],
      ["BOAT", "1.5×", "4×", "10×"],
    ],
  },
} as const;

function bonusTitle(game: EpicId, mode?: string | null) {
  if (game === "thunder-egg") {
    if (mode === "wheel") return "THUNDER WHEEL";
    if (mode === "superstar") return "SUPREME THUNDER";
    return "STORM ASCENSION";
  }
  if (mode === "wheel") return "DEEP WATER";
  if (mode === "big_catch") return "MEGA CATCH";
  return "WILD EXPEDITION";
}

function playTone(kind: "spin" | "win" | "bonus") {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const base = kind === "spin" ? 150 : kind === "win" ? 420 : 620;
    osc.type = kind === "spin" ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(base, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(base * (kind === "spin" ? 1.7 : 2.05), ctx.currentTime + (kind === "spin" ? 0.25 : 0.42));
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(kind === "bonus" ? 0.12 : 0.06, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.65);
    window.setTimeout(() => void ctx.close(), 760);
  } catch {
    // Audio is optional.
  }
}

export function EpicSlotMachineCinematic({ game, playerName }: { game: EpicId; playerName: string }) {
  const meta = META[game];
  const { slotCZK, ready } = useWallet();
  const [balance, setBalance] = useState(slotCZK);
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [winTier, setWinTier] = useState<BigWinTier | null>(null);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [paytableOpen, setPaytableOpen] = useState(false);
  const [revealId, setRevealId] = useState(0);
  const [shake, setShake] = useState(false);

  useEffect(() => setBalance(slotCZK), [slotCZK]);

  const fallback = useMemo(() => {
    const pool = game === "thunder-egg"
      ? ["zeus_k", "thunder", "eagle", "egg", "wild", "pillar", "hand"]
      : ["fish_k", "hook", "lure", "fisher", "fish_money", "angler_wild", "boat_scatter"];
    return Array.from({ length: meta.cols }, (_, c) => Array.from({ length: meta.rows }, (_, r) => pool[(c + r * 2) % pool.length]));
  }, [game, meta.cols, meta.rows]);

  const grid = result?.grid ?? fallback;
  const divine = useMemo(() => new Set((result?.divine_cells ?? []).map(([c, r]) => `${c}-${r}`)), [result]);
  const lightning = useMemo(() => new Set((result?.lightning_cells ?? []).map(([c, r]) => `${c}-${r}`)), [result]);
  const inBonus = Boolean(result && (result.free_spins_left ?? 0) > 0 && result.bonus_done === false);

  async function spin() {
    if (!ready || spinning) return;
    const amount = inBonus ? 0 : bet;
    if (!inBonus && amount > balance) {
      toast.error("Nedostatek Slot CZK — použij Směnárnu.");
      return;
    }

    setSpinning(true);
    setWinTier(null);
    setShake(false);
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

      const tier = getBigWinTier(Number(next.multiplier_of_bet ?? 0));
      setWinTier(tier);
      if (tier) {
        playTone("win");
        setShake(true);
        window.setTimeout(() => setWinTier(null), 2800);
        window.setTimeout(() => setShake(false), 700);
      }

      if (next.bonus_triggered && !next.bonus_done) {
        playTone("bonus");
        setBonusOpen(true);
      }

      if (next.total > 0) toast.success(`${next.feature}: +${next.total.toLocaleString("cs-CZ")} CZK`);
    }, 720);
  }

  const tierLabel: Record<BigWinTier, string> = {
    win: "BIG WIN",
    big: "MEGA WIN",
    mega: "EPIC WIN",
    epic: "ULTRA WIN",
  };

  return (
    <div className={`relative overflow-hidden rounded-[32px] border bg-[#04070c] p-2 shadow-[0_40px_130px_-55px_rgba(255,204,68,.9)] sm:p-4 ${meta.accent === "amber" ? "border-amber-300/60" : "border-cyan-300/60"}`}>
      <CinematicScene game={game} spinning={spinning} />

      <div className="relative z-10 rounded-[26px] border border-white/10 bg-black/45 p-3 backdrop-blur-xl sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className={`font-mono text-[8px] font-black uppercase tracking-[.36em] ${meta.accent === "amber" ? "text-amber-200" : "text-cyan-200"}`}>{meta.kicker} · ORIGINAL EPIC</div>
            <div className="mt-1 flex flex-wrap items-center gap-2"><h3 className="font-display text-3xl tracking-[.14em] text-white sm:text-4xl">{meta.title}</h3><EpicBadge>CINEMATIC EDITION</EpicBadge></div>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[.16em] text-white/40">{playerName} · SERVER RNG · SLOT CZK</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Hud label="ZŮSTATEK" value={`${balance.toLocaleString("cs-CZ")} Kč`} />
            <label className="rounded-xl border border-white/10 bg-black/50 px-3 py-2"><span className="block font-mono text-[7px] font-black uppercase tracking-[.16em] text-white/35">SÁZKA</span><select value={bet} onChange={(event) => setBet(Number(event.target.value))} className="mt-0.5 bg-transparent text-xs font-black text-white outline-none"><option value={5}>5 Kč</option><option value={10}>10 Kč</option><option value={20}>20 Kč</option><option value={50}>50 Kč</option><option value={100}>100 Kč</option><option value={250}>250 Kč</option><option value={500}>500 Kč</option></select></label>
            <button type="button" onClick={() => void spin()} disabled={!ready || spinning} className="inline-flex h-11 items-center gap-2 rounded-xl bg-hop-gold px-5 text-xs font-black uppercase tracking-[.16em] text-black shadow-[0_0_40px_-12px_rgba(255,204,68,.95)] transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50">{spinning ? <RotateCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}{spinning ? "TOČÍME" : inBonus ? "FREE SPIN" : "SPIN"}</button>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <motion.div animate={shake ? { x: [0, -7, 6, -5, 4, 0], y: [0, 3, -3, 2, -1, 0] } : { x: 0, y: 0 }} transition={{ duration: 0.42 }} className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/65 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_35px_100px_-45px_rgba(0,0,0,.95)] sm:p-3">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,.1),transparent_30%),linear-gradient(180deg,transparent,rgba(0,0,0,.68))]" />
          <div className="pointer-events-none absolute left-2 right-2 top-1/2 z-20 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <AnimatePresence>{spinning && <motion.div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-2/3 bg-gradient-to-b from-transparent via-white/15 to-transparent blur-2xl" initial={{ y: "-120%", opacity: 0 }} animate={{ y: "200%", opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .82, ease: "easeIn" }} />}</AnimatePresence>

          <div className="relative grid gap-1.5" style={{ gridTemplateColumns: `repeat(${meta.cols}, minmax(0,1fr))` }}>
            {grid.flatMap((column, c) => column.map((symbol, r) => {
              const key = `${c}-${r}`;
              const isDivine = divine.has(key);
              const isStrike = lightning.has(key);
              const isMoney = game === "bass-bounty" && symbol === "fish_money";
              const revealDelay = spinning ? c * 0.055 : (c * 0.07) + (r * 0.018);
              return (
                <motion.div key={`${revealId}-${key}`} initial={{ y: spinning ? -18 : -6, opacity: 0.88, filter: spinning ? "blur(4px)" : "blur(0px)" }} animate={{ y: 0, opacity: 1, filter: "blur(0px)" }} transition={{ duration: spinning ? .38 + c * .04 : .3, delay: revealDelay }} className={`relative flex aspect-[.88] items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-b from-white/[.1] via-[#08121b] to-[#010204] ${isStrike ? "border-yellow-100 shadow-[0_0_42px_rgba(250,204,21,.98)]" : isDivine ? "border-amber-100 shadow-[0_0_38px_rgba(251,191,36,.8)]" : isMoney ? "border-emerald-200/25" : "border-white/8"}`}>
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,.08),transparent_32%,transparent_68%,rgba(255,255,255,.035))]" />
                  <EpicSymbolArt game={game} symbol={symbol} className="relative z-10 transition-transform duration-300 hover:scale-105" />
                  {isMoney && <motion.div animate={{ scale: [1, 1.04, 1], opacity: [.7, 1, .7] }} transition={{ duration: 1.1, repeat: Infinity }} className="absolute bottom-1.5 z-20 rounded-full border border-amber-200/35 bg-amber-300/10 px-2 py-0.5 font-mono text-[7px] font-black uppercase tracking-[.16em] text-amber-100">MONEY</motion.div>}
                  {isDivine && <motion.div animate={{ opacity: [0.2, .85, .2], scale: [0.8, 1.1, 0.8] }} transition={{ duration: .9, repeat: Infinity }} className="pointer-events-none absolute inset-0 rounded-xl bg-[radial-gradient(circle,rgba(255,220,120,.28),transparent_60%)]" />}
                  {isStrike && <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ duration: .45, repeat: Infinity }} className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,transparent_40%,rgba(255,248,170,.95)_49%,transparent_58%)]" />}
                </motion.div>
              );
            }))}
          </div>

          <AnimatePresence>{winTier && result?.total ? <motion.div className="pointer-events-none absolute inset-0 z-40 grid place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div initial={{ scale: .5, y: 30 }} animate={{ scale: [1, 1.08, 1], y: 0 }} transition={{ duration: .75 }} className="text-center"><div className={`font-display text-[clamp(28px,6vw,72px)] font-black tracking-[.12em] ${winTier === "epic" ? "text-fuchsia-200" : winTier === "mega" ? "text-cyan-200" : winTier === "big" ? "text-amber-200" : "text-white"} drop-shadow-[0_0_30px_rgba(255,255,255,.55)]`}>{tierLabel[winTier]}</div><div className="mt-2 font-mono text-sm font-black uppercase tracking-[.25em] text-hop-gold">+{result.total.toLocaleString("cs-CZ")} CZK</div></motion.div></motion.div> : null}</AnimatePresence>
        </motion.div>

        <aside className="space-y-2">
          <Stat icon={game === "thunder-egg" ? <Hammer /> : <Fish />} title={game === "thunder-egg" ? "DIVINE REVEAL" : "MEGA CATCH"} value={game === "thunder-egg" ? `${result?.divine_cells?.length ?? 0} zásahů` : `${(result?.bonus_collected ?? 0).toLocaleString("cs-CZ")} CZK`} />
          <Stat icon={<Zap />} title={game === "thunder-egg" ? "LIGHTNING" : "COLLECTOR"} value={game === "thunder-egg" ? `${result?.lightning_cells?.length ?? 0} strikes` : `${result?.collector ?? 0} / 4`} />
          <Stat icon={<Gem />} title="MULTIPLIER" value={`${Number(result?.multiplier ?? 1).toFixed(1)}×`} />
          <div className="rounded-2xl border border-white/10 bg-black/45 p-3.5">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-hop-gold" /><span className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-white/45">BONUS FLOW</span></div><button type="button" onClick={() => setBonusOpen(true)} className="rounded-md border border-white/10 p-1 text-white/40 hover:text-white"><Info className="h-3.5 w-3.5" /></button></div>
            <div className="mt-3 space-y-1.5">{meta.bonus.map((name, index) => <div key={name} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[.025] px-2.5 py-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-hop-gold/10 font-mono text-[8px] font-black text-hop-gold">{index + 1}</span><span className="font-mono text-[8px] font-black uppercase tracking-[.12em] text-white/65">{name}</span></div>)}</div>
            <button type="button" onClick={() => setPaytableOpen(true)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.16em] text-white/55 hover:text-white"><Info className="h-3.5 w-3.5" /> PAYTABLE</button>
          </div>
          {inBonus && <div className="rounded-2xl border border-hop-gold/40 bg-hop-gold/8 p-3 shadow-[0_0_35px_-18px_rgba(255,204,68,.9)]"><div className="flex items-center justify-between font-mono text-[8px] font-black uppercase tracking-[.17em] text-hop-gold"><span>FREE SPINS</span><span>{result?.free_spins_left ?? 0}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-black/40"><motion.div initial={{ width: "4%" }} animate={{ width: `${Math.min(100, Math.max(4, ((result?.free_spins_left ?? 0) / 20) * 100))}%` }} className="h-full rounded-full bg-hop-gold" /></div><div className="mt-2 text-[10px] text-white/45">{bonusTitle(game, result?.bonus_mode)} · {Number(result?.multiplier ?? 1).toFixed(1)}×</div></div>}
        </aside>
      </div>

      <div className="relative z-10 mt-3 flex items-center gap-1 overflow-x-auto rounded-2xl border border-white/8 bg-black/35 p-2">{meta.steps.map((step, index) => <div key={step} className={`min-w-[92px] rounded-xl border px-3 py-2 text-center ${result && index <= 2 ? "border-hop-gold/30 bg-hop-gold/8 text-hop-gold" : "border-white/8 bg-white/[.02] text-white/35"}`}><div className="font-mono text-[7px] font-black tracking-[.16em]">0{index + 1}</div><div className="mt-1 font-mono text-[7px] font-black uppercase tracking-[.11em]">{step}</div></div>)}</div>

      <AnimatePresence>
        {bonusOpen && (
          <motion.div className="fixed inset-0 z-[1000] grid place-items-center bg-black/88 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ opacity: 0, scale: .58, y: 35 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 170, damping: 15 }} className="relative w-full max-w-4xl overflow-hidden rounded-[34px] border border-white/15 bg-[#05080d] p-7 text-center shadow-[0_0_160px_-25px_rgba(255,204,68,.85)] sm:p-12">
              <CinematicBonusBackdrop game={game} />
              <div className="relative z-10"><div className="font-mono text-[9px] font-black uppercase tracking-[.42em] text-hop-neon">BONUS TRIGGERED</div><h4 className="mt-2 font-display text-4xl tracking-[.15em] text-white sm:text-7xl">{bonusTitle(game, result?.bonus_mode)}</h4><p className="mt-3 font-mono text-xs uppercase tracking-[.18em] text-white/55">{result?.free_spins_left ?? 0} FREE SPINS · {Number(result?.multiplier ?? 1).toFixed(1)}× MULTIPLIER</p><div className="mx-auto mt-8 grid max-w-xl gap-2 sm:grid-cols-3">{meta.bonus.map((name, index) => <motion.div key={name} animate={{ y: index === 0 ? [0,-7,0] : 0, opacity: index === 0 ? [0.55,1,0.55] : .55 }} transition={{ duration: 1.2, repeat: Infinity }} className={`rounded-2xl border p-4 ${index === 0 ? "border-hop-gold/60 bg-hop-gold/10" : "border-white/10 bg-white/[.02]"}`}><div className="font-mono text-[8px] font-black uppercase tracking-[.16em] text-white/45">0{index+1}</div><div className="mt-2 font-display text-lg text-white">{name}</div></motion.div>)}</div><button type="button" onClick={() => setBonusOpen(false)} className="mt-8 rounded-xl bg-hop-gold px-6 py-3 font-mono text-[9px] font-black uppercase tracking-[.18em] text-black">ENTER BONUS</button></div>
            </motion.div>
          </motion.div>
        )}
        {paytableOpen && (
          <motion.div className="fixed inset-0 z-[1000] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPaytableOpen(false)}>
            <motion.div onClick={(event) => event.stopPropagation()} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#080c13] p-5 shadow-[0_35px_120px_-40px_rgba(0,0,0,.95)] sm:p-7">
              <div className="flex items-center justify-between"><div><div className="font-mono text-[8px] font-black uppercase tracking-[.25em] text-hop-neon">PAYTABLE</div><h4 className="mt-1 font-display text-3xl tracking-[.08em] text-white">{meta.title}</h4></div><button type="button" onClick={() => setPaytableOpen(false)} className="rounded-lg border border-white/10 px-3 py-1 text-white/50 hover:text-white">×</button></div>
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/8"><div className="grid grid-cols-4 bg-white/[.03] px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.14em] text-white/35"><span>SYMBOL</span><span>3×</span><span>4×</span><span>5×</span></div>{meta.paytable.map(([symbol, x3, x4, x5]) => <div key={symbol} className="grid grid-cols-4 items-center border-t border-white/8 px-3 py-3 text-sm text-white/75"><span className="font-mono text-[9px] font-black uppercase tracking-[.14em]">{symbol}</span><span>{x3}</span><span>{x4}</span><span>{x5}</span></div>)}</div>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/8 bg-white/[.02] p-3 text-[10px] text-white/45"><Waves className="h-4 w-4 text-hop-gold" /> Play money only · Slot CZK · server-side result.</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Hud({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-right"><div className="font-mono text-[7px] font-black uppercase tracking-[.18em] text-white/35">{label}</div><div className="font-mono text-sm font-black text-hop-gold">{value}</div></div>;
}

function Stat({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/45 p-3"><div className="flex items-center gap-2 text-hop-gold"><span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span><span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/40">{title}</span></div><div className="mt-1.5 font-display text-lg text-white">{value}</div></div>;
}

function CinematicScene({ game, spinning }: { game: EpicId; spinning: boolean }) {
  if (game === "thunder-egg") {
    return <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(255,212,90,.18),transparent_28%),linear-gradient(180deg,#0b1020_0%,#07101d_45%,#020509_100%)]"/><motion.div animate={{ x: ["-25%", "20%", "-25%"], opacity: [.18,.34,.18] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-12 left-0 h-40 w-[120%] rounded-[50%] bg-slate-300/10 blur-3xl"/><motion.div animate={{ rotate: [0,2,-2,0], opacity:[.12,.34,.12] }} transition={{ duration: 4.2, repeat: Infinity }} className="absolute inset-x-0 top-8 h-52 bg-[linear-gradient(115deg,transparent_25%,rgba(255,237,153,.75)_50%,transparent_75%)] blur-2xl"/>{[0,1,2,3,4].map((i)=><motion.span key={i} animate={{ opacity:[0,.75,0], scaleY:[.7,1.15,.7] }} transition={{ duration:1.3 + i*.22, repeat:Infinity, delay:i*.25 }} className="absolute top-1/4 h-[55%] w-px bg-gradient-to-b from-transparent via-yellow-100 to-transparent" style={{ left:`${17+i*17}%`, transform: `rotate(${i%2?12:-10}deg)` }}/>}<motion.div animate={spinning ? { opacity:[.1,.8,.1], scale:[1,1.08,1] } : { opacity:[.08,.2,.08] }} transition={{ duration: .55, repeat: Infinity }} className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,204,68,.16),transparent_34%)]"/></div>;
  }
  return <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]"><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(44,210,255,.16),transparent_32%),linear-gradient(180deg,#04131c_0%,#06222a_48%,#020609_100%)]"/><motion.div animate={{ x:[-40,20,-40], opacity:[.18,.35,.18] }} transition={{ duration:10, repeat:Infinity }} className="absolute top-0 h-64 w-[120%] bg-[linear-gradient(100deg,transparent,rgba(120,246,255,.14),transparent)] blur-2xl"/><motion.div animate={{ rotate:[-2,2,-2] }} transition={{ duration:12, repeat:Infinity }} className="absolute inset-x-0 top-6 h-64 bg-[conic-gradient(from_200deg_at_50%_0%,transparent,rgba(89,228,255,.13),transparent_55%)] blur-xl"/>{Array.from({length:18}).map((_,i)=><motion.span key={i} animate={{ y:[0,-120], opacity:[0,.6,0] }} transition={{ duration:2.5+(i%5)*.4, repeat:Infinity, delay:(i%7)*.3 }} className="absolute bottom-0 h-1.5 w-1.5 rounded-full bg-cyan-200/60" style={{ left:`${4+(i*17)%92}%` }}/>}<motion.div animate={spinning ? { opacity:[.05,.32,.05] } : { opacity:[.04,.14,.04] }} transition={{ duration:1.2, repeat:Infinity }} className="absolute inset-0 bg-[radial-gradient(circle_at_50%_65%,rgba(45,220,255,.15),transparent_46%)]"/></div>;
}

function CinematicBonusBackdrop({ game }: { game: EpicId }) {
  return <div className="pointer-events-none absolute inset-0 overflow-hidden">{game === "thunder-egg" ? <><motion.div animate={{ rotate:360 }} transition={{ duration:18, repeat:Infinity, ease:"linear" }} className="absolute -left-28 top-1/2 h-[480px] w-[480px] rounded-full border border-amber-200/10"/><motion.div animate={{ scale:[1,1.15,1], opacity:[.18,.42,.18] }} transition={{ duration:2.6, repeat:Infinity }} className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,205,74,.22),transparent_38%)]"/><motion.div animate={{ x:[-15,15,-15], opacity:[0,.75,0] }} transition={{ duration:.8, repeat:Infinity }} className="absolute inset-y-0 left-1/4 w-px bg-gradient-to-b from-transparent via-amber-100 to-transparent"/></> : <><motion.div animate={{ scale:[1,1.12,1], opacity:[.16,.36,.16] }} transition={{ duration:3, repeat:Infinity }} className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(57,214,255,.23),transparent_40%)]"/>{Array.from({length:12}).map((_,i)=><motion.span key={i} animate={{ y:[70,-240], opacity:[0,.65,0], x:[0,(i%2?1:-1)*18,0] }} transition={{ duration:2.8+(i%4)*.35, repeat:Infinity, delay:i*.14 }} className="absolute bottom-[12%] h-2 w-2 rounded-full bg-cyan-100/60" style={{ left:`${8+i*7.2}%` }}/>)}</>}</div>;
}
