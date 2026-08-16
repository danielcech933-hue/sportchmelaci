import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Fish, Flame, Gem, Hammer, Info, RotateCw, Sparkles, Trophy, Waves, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/lib/wallet";
import { EpicSymbolArt } from "@/components/slots/EpicSymbolArt";
import { EpicBadge, WinBurst, getBigWinTier, type BigWinTier } from "@/components/slots/EpicFX";

type EpicId = "thunder-egg" | "bass-bounty";
type Cell = [number, number];

type Result = {
  grid: string[][]; columns: number; rows: number; total: number; multiplier_of_bet: number; slot_czk: number; feature: string;
  bonus_triggered?: boolean; bonus_mode?: string | null; free_spins_left?: number; bonus_done?: boolean;
  bonus_collected?: number; retriggered?: boolean; divine_cells?: Cell[]; lightning_cells?: Cell[];
  money_values?: number[]; wild_count?: number; scatter_count?: number; collector?: number; multiplier?: number;
};

const META = {
  "thunder-egg": {
    title: "THUNDER EGG", kicker: "OLYMPUS STORM", cols: 6, rows: 5,
    frame: "border-amber-300/50", base: "from-[#070a14] via-[#0c1425] to-black", glow: "bg-amber-300/12",
    bonus: ["STORM ASCENSION", "THUNDER WHEEL", "SUPREME THUNDER"],
    steps: ["Cluster pays", "Cascades", "Divine reveal", "Lightning", "Bonus"],
  },
  "bass-bounty": {
    title: "BASS BOUNTY", kicker: "WILD WATER", cols: 5, rows: 3,
    frame: "border-cyan-300/50", base: "from-[#021018] via-[#06202b] to-black", glow: "bg-cyan-300/12",
    bonus: ["MEGA CATCH", "DEEP WATER", "WILD EXPEDITION"],
    steps: ["Money symbols", "Wild collector", "Free spins", "Retrigger", "Mega catch"],
  },
} as const;

function modeTitle(mode: string | null | undefined, game: EpicId) {
  if (game === "thunder-egg") return mode === "wheel" ? "THUNDER WHEEL" : mode === "superstar" ? "SUPREME THUNDER" : "STORM ASCENSION";
  return mode === "big_catch" ? "MEGA CATCH" : mode === "wheel" ? "DEEP WATER" : "WILD EXPEDITION";
}

function playTone(kind: "spin" | "win" | "bonus") {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = kind === "spin" ? 160 : kind === "win" ? 420 : 580;
    osc.type = kind === "spin" ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(start, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(start * (kind === "spin" ? 1.55 : 2.15), ctx.currentTime + (kind === "spin" ? .24 : .42));
    gain.gain.setValueAtTime(.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(kind === "bonus" ? .11 : .06, ctx.currentTime + .03);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + (kind === "bonus" ? .65 : .45));
    osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .7);
    window.setTimeout(() => void ctx.close(), 800);
  } catch { /* optional audio */ }
}

export function EpicSlotMachinePremium({ game, playerName }: { game: EpicId; playerName: string }) {
  const meta = META[game];
  const { slotCZK, ready } = useWallet();
  const [balance, setBalance] = useState(slotCZK);
  const [bet, setBet] = useState(10);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [winTier, setWinTier] = useState<BigWinTier | null>(null);
  const [bonusOpen, setBonusOpen] = useState(false);
  const [paytableOpen, setPaytableOpen] = useState(false);

  useEffect(() => setBalance(slotCZK), [slotCZK]);
  const fallback = useMemo(() => Array.from({ length: meta.cols }, (_, c) => Array.from({ length: meta.rows }, (_, r) => {
    const pool = game === "thunder-egg" ? ["zeus_k", "thunder", "eagle", "egg", "wild", "pillar", "hand"] : ["fish_k", "hook", "lure", "fisher", "fish_money", "angler_wild", "boat_scatter"];
    return pool[(c + r) % pool.length];
  })), [game, meta.cols, meta.rows]);
  const grid = result?.grid ?? fallback;
  const divine = useMemo(() => new Set((result?.divine_cells ?? []).map(([c, r]) => `${c}-${r}`)), [result]);
  const lightning = useMemo(() => new Set((result?.lightning_cells ?? []).map(([c, r]) => `${c}-${r}`)), [result]);
  const inBonus = Boolean(result && (result.free_spins_left ?? 0) > 0 && result.bonus_done === false);

  async function spin() {
    if (!ready || spinning) return;
    const amount = inBonus ? 0 : bet;
    if (!inBonus && amount > balance) { toast.error("Nedostatek Slot CZK — použij Směnárnu."); return; }
    setSpinning(true); setWinTier(null); playTone("spin");
    const { data, error } = await supabase.rpc("slot_epic_spin", { _game_id: game, _bet: amount });
    if (error) { toast.error(error.message); setSpinning(false); return; }
    const next = (Array.isArray(data) ? data[0] : data) as Result;
    if (!next?.grid || next.columns !== meta.cols || next.rows !== meta.rows || !Number.isFinite(Number(next.slot_czk))) {
      toast.error("Server vrátil neplatný výsledek hry."); setSpinning(false); return;
    }
    window.setTimeout(() => {
      setResult(next); setBalance(Number(next.slot_czk)); setSpinning(false);
      const tier = getBigWinTier(Number(next.multiplier_of_bet ?? 0));
      setWinTier(tier);
      if (tier) { playTone("win"); window.setTimeout(() => setWinTier(null), 2600); }
      if (next.bonus_triggered && !next.bonus_done) { playTone("bonus"); setBonusOpen(true); }
      if (next.total > 0) toast.success(`${next.feature}: +${next.total.toLocaleString("cs-CZ")} CZK`);
    }, 560);
  }

  return (
    <div className={`relative overflow-hidden rounded-[30px] border ${meta.frame} bg-gradient-to-br ${meta.base} p-2 shadow-[0_35px_120px_-55px_rgba(255,204,68,.8)] sm:p-4`}>
      <SceneBackdrop game={game} spinning={spinning} />
      <div className="relative rounded-[24px] border border-white/10 bg-black/45 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.08)] backdrop-blur-xl sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="font-mono text-[8px] font-black uppercase tracking-[.34em] text-white/45">{meta.kicker} · SPORT CHMELÁCI EPIC</div>
            <div className="mt-1 flex flex-wrap items-center gap-2"><h3 className="font-display text-3xl tracking-[.14em] text-white sm:text-4xl">{meta.title}</h3><EpicBadge>PREMIUM EDITION</EpicBadge></div>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[.16em] text-white/35">{playerName} · SERVER RNG · SLOT CZK</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-right"><div className="font-mono text-[7px] uppercase tracking-[.18em] text-white/35">ZŮSTATEK</div><div className="font-mono text-sm font-black text-hop-gold">{balance.toLocaleString("cs-CZ")} Kč</div></div>
            <div className="rounded-xl border border-white/10 bg-black/45 px-2 py-2"><div className="font-mono text-[7px] uppercase tracking-[.18em] text-white/35">SÁZKA</div><select value={bet} onChange={e => setBet(Number(e.target.value))} className="mt-0.5 bg-transparent text-xs font-black text-white outline-none"><option value={5}>5 Kč</option><option value={10}>10 Kč</option><option value={20}>20 Kč</option><option value={50}>50 Kč</option><option value={100}>100 Kč</option><option value={250}>250 Kč</option><option value={500}>500 Kč</option></select></div>
            <button type="button" onClick={() => void spin()} disabled={!ready || spinning} className="inline-flex h-11 items-center gap-2 rounded-xl bg-hop-gold px-5 text-xs font-black uppercase tracking-[.16em] text-black shadow-[0_0_36px_-12px_rgba(255,204,68,.9)] disabled:cursor-not-allowed disabled:opacity-50">{spinning ? <RotateCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}{spinning ? "TOČÍME" : inBonus ? "FREE SPIN" : "SPIN"}</button>
          </div>
        </div>
      </div>

      <div className="relative mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-black/60 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_35px_90px_-45px_rgba(0,0,0,.9)] sm:p-3">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,.12),transparent_34%),linear-gradient(180deg,transparent,rgba(0,0,0,.72))]" />
          <div className="pointer-events-none absolute left-2 right-2 top-1/2 z-10 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          {spinning && <motion.div className="pointer-events-none absolute inset-x-0 top-0 z-30 h-2/3 bg-gradient-to-b from-transparent via-white/12 to-transparent blur-2xl" initial={{ y: "-120%" }} animate={{ y: "200%" }} transition={{ duration: .8, ease: "easeIn" }} />}
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${meta.cols}, minmax(0,1fr))` }}>
            {grid.flatMap((col, c) => col.map((symbol, r) => {
              const key = `${c}-${r}`; const divineHit = divine.has(key); const strike = lightning.has(key); const money = game === "bass-bounty" && symbol === "fish_money";
              return <motion.div key={key} className={`relative flex aspect-[.9] items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-b from-white/[.08] via-[#07111a] to-black ${strike ? "border-yellow-200 shadow-[0_0_38px_rgba(250,204,21,.95)]" : divineHit ? "border-amber-100 shadow-[0_0_34px_rgba(251,191,36,.75)]" : "border-white/8"}`} animate={spinning ? { y:[0,14,-10,0], scale:[1,.96,1.02,1], rotateZ:[0,.5,-.5,0] } : divineHit ? { scale:[1,1.06,1] } : money ? { boxShadow:["0 0 0 rgba(255,204,68,0)","0 0 24px rgba(255,204,68,.45)","0 0 0 rgba(255,204,68,0)"] } : { scale:1 }} transition={{ duration:spinning ? .33 + c*.045 : divineHit || money ? .9 : .35, delay:spinning ? c*.04 : 0, repeat:spinning || divineHit || money ? Infinity : 0 }}>
                <EpicSymbolArt game={game} symbol={symbol} className="z-10" />
                {money && <div className="absolute bottom-1.5 rounded-full border border-amber-200/30 bg-amber-300/10 px-2 py-0.5 font-mono text-[7px] font-black uppercase tracking-[.16em] text-amber-100">MONEY</div>}
                {strike && <motion.div className="pointer-events-none absolute inset-0" animate={{ opacity:[0,.8,0] }} transition={{ duration:.45, repeat:Infinity }} style={{ background:"linear-gradient(135deg,transparent 42%,rgba(255,244,160,.95) 49%,transparent 56%)" }} />}
              </motion.div>;
            }))}
          </div>
          <WinBurst tier={winTier} amount={result?.total ?? 0} />
        </div>

        <aside className="space-y-2">
          <Stat title={game === "thunder-egg" ? "DIVINE REVEAL" : "MEGA CATCH"} value={game === "thunder-egg" ? `${result?.divine_cells?.length ?? 0} zásahů` : `${(result?.bonus_collected ?? 0).toLocaleString("cs-CZ")} CZK`} icon={game === "thunder-egg" ? <Hammer /> : <Fish />} />
          <Stat title={game === "thunder-egg" ? "LIGHTNING" : "COLLECTOR"} value={game === "thunder-egg" ? `${result?.lightning_cells?.length ?? 0} strike` : `${result?.collector ?? 0} / 4`} icon={<Zap />} />
          <Stat title="MULTIPLIER" value={`${Number(result?.multiplier ?? 1).toFixed(1)}×`} icon={<Gem />} />
          <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-hop-gold" /><span className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/45">BONUS FLOW</span></div><button onClick={() => setBonusOpen(true)} className="rounded-md border border-white/10 p-1 text-white/40 hover:text-white"><Info className="h-3.5 w-3.5" /></button></div>
            <div className="mt-3 space-y-1.5">{meta.bonus.map((name, i) => <div key={name} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[.02] px-2.5 py-2"><span className="grid h-5 w-5 place-items-center rounded-full bg-hop-gold/10 font-mono text-[8px] font-black text-hop-gold">{i+1}</span><span className="font-mono text-[8px] font-black uppercase tracking-[.12em] text-white/65">{name}</span></div>)}</div>
          </div>
        </aside>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-white/8 bg-black/35 p-2.5"><div className="font-mono text-[8px] uppercase tracking-[.18em] text-white/30">FEATURE</div><div className="mt-1 font-display text-lg text-white">{result?.feature ?? "READY"}</div></div>
        <div className="rounded-xl border border-white/8 bg-black/35 p-2.5"><div className="font-mono text-[8px] uppercase tracking-[.18em] text-white/30">FREE SPINS</div><div className="mt-1 font-display text-lg text-white">{result?.free_spins_left ?? 0}</div></div>
        <button onClick={() => setPaytableOpen(true)} className="rounded-xl border border-hop-gold/20 bg-hop-gold/[.04] p-2.5 text-left hover:border-hop-gold/50"><div className="font-mono text-[8px] uppercase tracking-[.18em] text-hop-gold/60">PAYTABLE</div><div className="mt-1 flex items-center gap-1 font-display text-lg text-white">Zobrazit <Info className="h-4 w-4 text-hop-gold" /></div></button>
      </div>

      <AnimatePresence>
        {bonusOpen && <motion.div className="fixed inset-0 z-[1000] grid place-items-center bg-black/85 p-4 backdrop-blur-lg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setBonusOpen(false)}>
          <motion.div onClick={(e) => e.stopPropagation()} initial={{ opacity: 0, scale: .62, rotate: -4 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 170, damping: 12 }} className={`relative w-full max-w-3xl overflow-hidden rounded-[32px] border ${meta.frame} bg-gradient-to-br ${meta.base} p-7 text-center shadow-[0_0_140px_-20px_rgba(255,204,68,.9)] sm:p-10`}>
            <motion.div className={`pointer-events-none absolute inset-0 ${meta.glow}`} animate={{ opacity:[.25,.75,.25], scale:[.96,1.04,.96] }} transition={{ duration:1.4, repeat:Infinity }} />
            <div className="relative"><div className="font-mono text-[9px] font-black uppercase tracking-[.42em] text-hop-neon">BONUS FEATURE</div><h4 className="mt-2 font-display text-4xl tracking-[.16em] text-white sm:text-6xl">{modeTitle(result?.bonus_mode, game)}</h4><p className="mx-auto mt-3 max-w-xl text-sm text-white/55">Cinematic bonus sekvence je napojená přímo na serverový stav hry. Každý spin pokračuje z uložené bonus session.</p><div className="mt-7 grid gap-2 sm:grid-cols-3">{meta.steps.slice(1).map((step, i) => <div key={step} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-left"><div className="font-mono text-[8px] uppercase tracking-[.18em] text-hop-gold/60">STEP {i+1}</div><div className="mt-1 font-display text-lg text-white">{step}</div></div>)}</div><button onClick={() => setBonusOpen(false)} className="mt-7 rounded-xl bg-hop-gold px-6 py-3 font-mono text-[10px] font-black uppercase tracking-[.18em] text-black">ZAVŘÍT</button></div>
          </motion.div>
        </motion.div>}
        {paytableOpen && <motion.div className="fixed inset-0 z-[1001] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPaytableOpen(false)}>
          <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#080d14] p-5 shadow-[0_30px_100px_-40px_rgba(0,0,0,.95)] sm:p-6">
            <div className="flex items-center justify-between"><div><div className="font-mono text-[8px] uppercase tracking-[.22em] text-hop-neon">PAYTABLE</div><h4 className="font-display text-3xl text-white">{meta.title}</h4></div><button onClick={() => setPaytableOpen(false)} className="text-xl text-white/40 hover:text-white">×</button></div>
            <div className="mt-5 grid gap-2">{(game === "thunder-egg" ? [["⚡","5×","15×","50×"],["EAGLE","3×","8×","25×"],["PILLAR","2×","5×","15×"],["EGG","1.5×","4×","10×"]] : [["FISH","5×","12×","30×"],["HOOK","3×","8×","20×"],["WILD","2×","5×","15×"],["BOAT","1.5×","4×","10×"]]).map(([s,a,b,c]) => <div key={s} className="grid grid-cols-[1.2fr_repeat(3,minmax(0,1fr))] items-center gap-2 rounded-xl border border-white/8 bg-white/[.02] p-3"><span className="font-mono text-xs font-black text-white">{s}</span><span className="font-mono text-xs text-white/55">{a}</span><span className="font-mono text-xs text-white/55">{b}</span><span className="font-mono text-xs font-black text-hop-gold">{c}</span></div>)}</div>
          </motion.div>
        </motion.div>}
      </AnimatePresence>
    </div>
  );
}

function SceneBackdrop({ game, spinning }: { game: EpicId; spinning: boolean }) {
  return <div className="pointer-events-none absolute inset-0 overflow-hidden">
    {game === "thunder-egg" ? <>
      <motion.div className="absolute -inset-10 bg-[radial-gradient(circle_at_25%_20%,rgba(113,162,255,.18),transparent_26%),radial-gradient(circle_at_80%_65%,rgba(255,204,68,.12),transparent_22%)]" animate={{ scale: spinning ? [1,1.06,1] : [1,1.02,1] }} transition={{ duration: spinning ? .9 : 4, repeat: Infinity }} />
      <div className="absolute inset-x-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(87,127,255,.18),transparent)]" />
      <motion.div className="absolute -left-20 top-8 h-1 w-[80%] rotate-[16deg] bg-gradient-to-r from-transparent via-cyan-100/60 to-transparent blur-sm" animate={{ x:[-60,180,360] }} transition={{ duration:2.6, repeat:Infinity, ease:"linear" }} />
    </> : <>
      <motion.div className="absolute -inset-10 bg-[radial-gradient(circle_at_22%_20%,rgba(39,208,255,.18),transparent_24%),radial-gradient(circle_at_70%_65%,rgba(33,145,189,.18),transparent_28%)]" animate={{ scale:[1,1.04,1], opacity:[.55,.85,.55] }} transition={{ duration:5, repeat:Infinity }} />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(0deg,rgba(0,122,159,.2),transparent)]" />
      <motion.div className="absolute right-16 top-5 h-1 w-40 rotate-[20deg] bg-gradient-to-r from-transparent via-cyan-100/35 to-transparent blur-sm" animate={{ x:[80,-140,80] }} transition={{ duration:3.2, repeat:Infinity, ease:"easeInOut" }} />
    </>}
  </div>;
}

function Stat({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-black/40 p-3.5"><div className="flex items-center gap-2 text-hop-gold"><span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span><span className="font-mono text-[8px] font-black uppercase tracking-[.19em] text-white/45">{title}</span></div><div className="mt-2 font-display text-lg text-white">{value}</div></div>;
}
