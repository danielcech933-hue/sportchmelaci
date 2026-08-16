import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Fish, Flame, Gem, Hammer, RotateCw, Sparkles, Trophy, Waves, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/lib/wallet";
import { EpicSymbolArt } from "@/components/slots/EpicSymbolArt";
import { BonusChoiceGlow, EpicBadge, WinBurst, getBigWinTier, type BigWinTier } from "@/components/slots/EpicFX";

type EpicId = "thunder-egg" | "bass-bounty";

type Result = {
  grid: string[][]; columns: number; rows: number; total: number; multiplier_of_bet: number; slot_czk: number; feature: string;
  bonus_triggered?: boolean; bonus_mode?: string | null; free_spins_left?: number; bonus_done?: boolean; bonus_collected?: number;
  retriggered?: boolean; divine_cells?: [number, number][]; lightning_cells?: [number, number][]; money_values?: number[];
  wild_count?: number; scatter_count?: number; collector?: number; multiplier?: number;
};

const META = {
  "thunder-egg": { title: "THUNDER EGG", subtitle: "OLYMPUS STORM", cols: 6, rows: 5, theme: "from-[#090d1e] via-[#07101e] to-black", border: "border-amber-300/50", accent: "text-amber-200", glow: "bg-amber-300/10", bonus: ["STORM ASCENSION", "THUNDER WHEEL", "SUPREME THUNDER"] },
  "bass-bounty": { title: "BASS BOUNTY", subtitle: "WILD WATER", cols: 5, rows: 3, theme: "from-[#03141d] via-[#061622] to-black", border: "border-cyan-300/50", accent: "text-cyan-200", glow: "bg-cyan-300/10", bonus: ["MEGA CATCH", "DEEP WATER", "WILD EXPEDITION"] },
} as const;

function chime(kind: "spin" | "win" | "bonus") {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
    const base = kind === "spin" ? 180 : kind === "win" ? 420 : 560;
    osc.type = kind === "spin" ? "sawtooth" : "triangle"; osc.frequency.setValueAtTime(base, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(base * (kind === "spin" ? 1.7 : 2.1), ctx.currentTime + .35);
    gain.gain.setValueAtTime(.0001, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(kind === "bonus" ? .1 : .065, ctx.currentTime + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .5); osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .55);
    window.setTimeout(() => void ctx.close(), 700);
  } catch {}
}

function modeTitle(mode: string | null | undefined, game: EpicId) {
  if (game === "thunder-egg") return mode === "wheel" ? "THUNDER WHEEL" : mode === "superstar" ? "SUPREME THUNDER" : "STORM ASCENSION";
  return mode === "big_catch" ? "MEGA CATCH" : mode === "wheel" ? "DEEP WATER" : "WILD EXPEDITION";
}

export function EpicSlotMachinePro({ game, playerName }: { game: EpicId; playerName: string }) {
  const meta = META[game];
  const { slotCZK, ready } = useWallet();
  const [balance, setBalance] = useState(slotCZK);
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [showBonus, setShowBonus] = useState(false);
  const [winTier, setWinTier] = useState<BigWinTier | null>(null);
  const [bonusChoiceOpen, setBonusChoiceOpen] = useState(false);

  useEffect(() => setBalance(slotCZK), [slotCZK]);
  const grid = result?.grid ?? useMemo(() => Array.from({ length: meta.cols }, (_, c) => Array.from({ length: meta.rows }, (_, r) => ["zeus_k", "thunder", "eagle", "egg", "wild", "fish_money", "fish_k", "hook"][(c + r) % 8])), [meta.cols, meta.rows]);
  const divine = new Set((result?.divine_cells ?? []).map(([c, r]) => `${c}-${r}`));
  const lightning = new Set((result?.lightning_cells ?? []).map(([c, r]) => `${c}-${r}`));

  async function spin() {
    if (!ready || spinning) return;
    const inBonus = Boolean(result && (result.free_spins_left ?? 0) > 0 && result.bonus_done === false);
    const amount = inBonus ? 0 : bet;
    if (!inBonus && amount > balance) { toast.error("Nedostatek Slot CZK — použij Směnárnu."); return; }
    setSpinning(true); setShowBonus(false); setWinTier(null); chime("spin");
    const { data, error } = await supabase.rpc("slot_epic_spin", { _game_id: game, _bet: amount });
    if (error) { toast.error(error.message); setSpinning(false); return; }
    const next = (Array.isArray(data) ? data[0] : data) as Result;
    if (!next?.grid || next.columns !== meta.cols || next.rows !== meta.rows || !Number.isFinite(Number(next.slot_czk))) { toast.error("Server vrátil neplatný výsledek hry."); setSpinning(false); return; }
    window.setTimeout(() => {
      setResult(next); setBalance(Number(next.slot_czk)); setSpinning(false);
      const tier = getBigWinTier(Number(next.multiplier_of_bet ?? 0)); setWinTier(tier);
      if (tier) window.setTimeout(() => setWinTier(null), 2800);
      if (next.bonus_triggered && !next.bonus_done) { chime("bonus"); setShowBonus(true); window.setTimeout(() => setShowBonus(false), 4200); }
      else if (next.total > 0) chime("win");
      if (next.total > 0) toast.success(`${next.feature}: +${next.total.toLocaleString("cs-CZ")} CZK`);
    }, 650);
  }

  return <div className={`relative overflow-hidden rounded-[28px] border ${meta.border} bg-gradient-to-br ${meta.theme} p-2 shadow-[0_30px_90px_-40px_rgba(255,204,68,.65)] sm:p-4`}>
    <motion.div className={`pointer-events-none absolute -left-16 -top-8 h-56 w-56 rounded-full ${meta.glow} blur-3xl`} animate={{ scale: [1, 1.2, 1], opacity: [.25, .55, .25] }} transition={{ duration: 4, repeat: Infinity }} />
    <motion.div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-white/5 blur-3xl" animate={{ x: [0, -30, 0], opacity: [.15, .35, .15] }} transition={{ duration: 5, repeat: Infinity }} />

    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/45 p-3 backdrop-blur-xl sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><div className={`font-mono text-[8px] font-black uppercase tracking-[.3em] ${meta.accent}`}>{meta.subtitle}</div><div className="mt-1 flex items-center gap-2"><h3 className="font-display text-2xl tracking-[.12em] text-white sm:text-3xl">{meta.title}</h3><EpicBadge>ORIGINAL EPIC</EpicBadge></div><p className="mt-1 font-mono text-[9px] uppercase tracking-[.16em] text-white/40">{playerName} · SERVER RNG · SLOT CZK</p></div>
        <div className="flex flex-wrap items-center gap-2"><div className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-right"><div className="font-mono text-[7px] uppercase tracking-[.2em] text-white/35">ZŮSTATEK</div><div className="font-mono text-sm font-black text-hop-gold">{balance.toLocaleString("cs-CZ")} Kč</div></div><select value={bet} onChange={e => setBet(Number(e.target.value))} className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white"><option value={5}>5 Kč</option><option value={10}>10 Kč</option><option value={20}>20 Kč</option><option value={50}>50 Kč</option><option value={100}>100 Kč</option><option value={250}>250 Kč</option></select><button type="button" onClick={() => void spin()} disabled={!ready || spinning} className="inline-flex items-center gap-2 rounded-xl bg-hop-gold px-4 py-2.5 text-xs font-black uppercase tracking-[.14em] text-black shadow-[0_0_30px_-12px_rgba(255,204,68,.95)] disabled:opacity-50">{spinning ? <RotateCw className="h-4 w-4 animate-spin"/> : <Zap className="h-4 w-4"/>}{spinning ? "TOČÍME" : result?.free_spins_left ? "FREE SPIN" : "SPIN"}</button></div>
      </div>
    </div>

    <div className="relative mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-black/55 p-2 shadow-inner">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,.08),transparent_40%)]"/>
        {spinning && <motion.div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-1/2 bg-gradient-to-b from-transparent via-white/12 to-transparent blur-2xl" initial={{ y: "-100%" }} animate={{ y: "220%" }} transition={{ duration: .8, ease: "easeIn" }} />}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${meta.cols}, minmax(0, 1fr))` }}>
          {grid.flatMap((col, c) => col.map((symbol, r) => { const key = `${c}-${r}`; const isDivine = divine.has(key); const isLightning = lightning.has(key); const isMoney = game === "bass-bounty" && symbol === "fish_money"; return <motion.div key={key} className={`relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-b from-white/[.08] via-black/40 to-black/75 ${isLightning ? "border-yellow-200/90 shadow-[0_0_32px_rgba(250,204,21,.95)]" : isDivine ? "border-amber-100/80 shadow-[0_0_30px_rgba(251,191,36,.7)]" : "border-white/8"}`} animate={spinning ? { y: [0, 14, -12, 0], rotateX: [0, 12, -8, 0], scale: [1, .96, 1.02, 1] } : isDivine ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={{ duration: spinning ? .32 + c * .045 : isDivine ? .85 : .4, delay: spinning ? c * .035 : 0, repeat: spinning || isDivine ? Infinity : 0 }}>
            <EpicSymbolArt game={game} symbol={symbol} className={isMoney ? "animate-pulse" : ""}/>
            {isMoney && <div className="absolute bottom-1 z-20 rounded-full border border-emerald-200/20 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[7px] font-black text-emerald-100">MONEY</div>}
            {isLightning && <Zap className="absolute inset-0 m-auto z-20 h-10 w-10 text-yellow-100 animate-pulse" />}
          </motion.div>; }))}
        </div>
        <WinBurst tier={winTier} amount={result?.total ?? 0} />
      </div>

      <aside className="space-y-2">
        <StatCard icon={game === "thunder-egg" ? <Hammer/> : <Fish/>} title={game === "thunder-egg" ? "DIVINE REVEAL" : "MONEY CATCH"} value={game === "thunder-egg" ? `${result?.divine_cells?.length ?? 0} zásahů` : `${(result?.bonus_collected ?? 0).toLocaleString("cs-CZ")}×`} />
        <StatCard icon={<Zap/>} title={game === "thunder-egg" ? "LIGHTNING" : "COLLECTOR WILD"} value={game === "thunder-egg" ? `${result?.lightning_cells?.length ?? 0} strike` : `${result?.collector ?? 0}/4`} />
        <StatCard icon={<Gem/>} title="MULTIPLIER" value={`${Number(result?.multiplier ?? 1).toFixed(1)}×`} />
        <div className="rounded-2xl border border-white/10 bg-black/40 p-3"><div className="flex items-center gap-2 text-hop-gold"><Sparkles className="h-4 w-4"/><span className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-white/45">BONUS MODES</span></div><div className="mt-2 grid gap-1.5">{meta.bonus.map((name, i) => <button key={name} type="button" onClick={() => setBonusChoiceOpen(true)} className="rounded-lg border border-white/8 bg-white/[.02] px-2 py-1.5 text-left font-mono text-[8px] font-black uppercase tracking-[.12em] text-white/65 hover:border-hop-gold/30 hover:text-white">{i + 1}. {name}</button>)}</div></div>
      </aside>
    </div>

    <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/8 bg-black/35 px-3 py-2 font-mono text-[8px] uppercase tracking-[.16em] text-white/35"><span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5"/> Cinematic FX</span><span>{result?.feature ?? "READY"}</span><span>{meta.cols}×{meta.rows}</span></div>

    <AnimatePresence>{showBonus && <motion.div className="fixed inset-0 z-[1000] grid place-items-center bg-black/85 p-4 backdrop-blur-md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div initial={{ opacity: 0, scale: .55, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 190, damping: 13 }} className="relative w-full max-w-2xl overflow-hidden rounded-[30px] border border-hop-gold/60 bg-[#07090d] p-8 text-center shadow-[0_0_120px_-18px_rgba(255,204,68,.9)]"><motion.div className="pointer-events-none absolute inset-0" animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }} transition={{ duration: 4, repeat: Infinity }} style={{ backgroundImage: "radial-gradient(circle at 30% 20%, rgba(255,216,107,.24), transparent 24%), radial-gradient(circle at 75% 70%, rgba(77,255,166,.16), transparent 24%), linear-gradient(135deg, transparent, rgba(255,255,255,.05), transparent)" }}/><motion.div animate={{ scale: [1,1.16,1], rotate: [0,4,-4,0] }} transition={{ duration: 1.05, repeat: Infinity }} className="relative mx-auto mb-5 grid h-28 w-28 place-items-center rounded-full border border-hop-gold/70 bg-hop-gold/10 shadow-[0_0_65px_rgba(255,204,68,.45)]"><Trophy className="h-14 w-14 text-hop-gold"/></motion.div><div className="relative font-mono text-[10px] font-black uppercase tracking-[.4em] text-hop-neon">BONUS TRIGGERED</div><h4 className="relative mt-2 font-display text-4xl tracking-[.15em] text-white sm:text-6xl">{modeTitle(result?.bonus_mode, game)}</h4><p className="relative mt-3 font-mono text-xs uppercase tracking-[.2em] text-white/55">{result?.free_spins_left ?? 0} FREE SPINS · {Number(result?.multiplier ?? 1).toFixed(1)}× MULTIPLIER</p><div className="relative mx-auto mt-6 max-w-md"><BonusChoiceGlow active={true}>{game === "thunder-egg" ? "Rozbij vejce a odhal božský násobitel" : "Sbírej úlovky, navyšuj kolektor a chyť Mega Catch"}</BonusChoiceGlow></div></motion.div></motion.div>}
    {bonusChoiceOpen && <motion.div className="fixed inset-0 z-[1001] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBonusChoiceOpen(false)}><motion.div onClick={e => e.stopPropagation()} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b1018] p-5 shadow-[0_30px_100px_-35px_rgba(0,0,0,.95)]"><div className="flex items-center justify-between"><div><div className="font-mono text-[8px] uppercase tracking-[.2em] text-hop-neon">BONUS GUIDE</div><h4 className="font-display text-2xl text-white">{meta.title}</h4></div><button className="rounded-lg border border-white/10 px-2 py-1 text-white/50" onClick={() => setBonusChoiceOpen(false)}>×</button></div><div className="mt-4 grid gap-2">{meta.bonus.map((name, i) => <div key={name} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.02] p-3"><div className="grid h-8 w-8 place-items-center rounded-full bg-hop-gold/10 font-mono text-xs text-hop-gold">{i+1}</div><div><p className="font-display text-sm text-white">{name}</p><p className="text-[10px] text-white/45">Serverově řízený bonusový režim s unikátními VFX a payout logikou.</p></div></div>)}</div></motion.div></motion.div>}
    </AnimatePresence>
  </div>;
}

function StatCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-black/40 p-3"><div className="flex items-center gap-2 text-hop-gold"><span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span><span className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-white/45">{title}</span></div><div className="mt-2 font-display text-lg text-white">{value}</div></div>;
}
