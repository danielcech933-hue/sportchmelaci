import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Gift, Loader2, Sparkles, Trophy, Zap, Flame } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";

/** Segmenty kola — výhry $5, $10, $20, $50. Skutečnou výhru určuje server. */
const SEGMENTS = [5, 10, 20, 50, 5, 10, 20, 50] as const;
const SEG_ANGLE = 360 / SEGMENTS.length;
const SPIN_MS = 4500;
const SEGMENT_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  5: { bg: "#059669", text: "#a7f3d0", border: "#10b981" },
  10: { bg: "#0284c7", text: "#bae6fd", border: "#38bdf8" },
  20: { bg: "#7c3aed", text: "#ddd6fe", border: "#a855f7" },
  50: { bg: "#d97706", text: "#fef08a", border: "#fbbf24" },
};

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function DailyBonusWheel() {
  const { user } = useAuth();
  const { claimDailyBonus, dailyBonusStatus } = useWallet();
  const [nextClaimAt, setNextClaimAt] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const timers = useRef<number[]>([]);

  const refreshCooldown = useCallback(async () => {
    if (!user) {
      setNextClaimAt(null);
      setHydrated(true);
      return;
    }

    const status = await dailyBonusStatus();
    if (status.ok) setNextClaimAt(status.nextClaimAt ?? null);
    setHydrated(true);
  }, [dailyBonusStatus, user]);

  useEffect(() => {
    void refreshCooldown();
    setResult(null);
  }, [refreshCooldown]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const remainingMs = useMemo(() => {
    if (!nextClaimAt) return 0;
    const ts = Date.parse(nextClaimAt);
    return Number.isFinite(ts) ? Math.max(0, ts - now) : 0;
  }, [nextClaimAt, now]);

  const canSpin = hydrated && Boolean(user) && !spinning && remainingMs <= 0;
  const countdown = hydrated ? fmt(remainingMs) : "--:--:--";

  const triggerConfetti = (prize: number) => {
    if (prize === 50) {
      const end = Date.now() + 2000;
      const interval = window.setInterval(() => {
        if (Date.now() > end) return window.clearInterval(interval);
        confetti({ startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000, origin: { x: Math.random(), y: Math.random() - 0.2 } });
      }, 200);
    } else {
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 }, colors: ["#ffcc44", "#a855f7", "#38bdf8", "#10b981"] });
    }
  };

  const spin = useCallback(async () => {
    if (!canSpin) return;

    setSpinning(true);
    setResult(null);

    // The server chooses the prize, applies the dollars and locks the 8h cooldown.
    // The client only animates to the already-authorized result.
    const reward = await claimDailyBonus();
    if (!reward.ok || !reward.prize) {
      setSpinning(false);
      toast.error(reward.error ?? "Výhru se nepodařilo připsat.");
      await refreshCooldown();
      return;
    }

    const prize = reward.prize;
    const targetIndex = SEGMENTS.findIndex((value) => value === prize);
    const current = angle % 360;
    const target = (360 - (targetIndex * SEG_ANGLE + SEG_ANGLE / 2) - current + 720) % 360;
    setAngle((a) => a + 360 * 8 + target);

    timers.current.push(window.setTimeout(() => {
      setSpinning(false);
      setResult(prize);
      setNextClaimAt(reward.nextClaimAt ?? null);
      triggerConfetti(prize);
      toast.success(prize === 50 ? "🔥 LEGENDÁRNÍ JACKPOT! +$50 🔥" : `Skvěle! Vyhráváš +$${prize}`, { duration: prize === 50 ? 5000 : 3000 });
    }, SPIN_MS));
  }, [angle, canSpin, claimDailyBonus, refreshCooldown]);

  return (
    <section className="relative overflow-hidden rounded-3xl border-2 border-hop-gold/40 bg-gradient-to-br from-black/90 via-zinc-950/80 to-black/95 p-6 backdrop-blur-2xl shadow-[0_0_50px_rgba(255,204,68,0.15)]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-hop-gold/10 blur-[80px]" />
      <div className="pointer-events-none absolute -left-10 -bottom-10 h-64 w-64 rounded-full bg-purple-600/10 blur-[80px]" />
      <div className="relative grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
        <div className="mx-auto relative">
          <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-700 ${spinning ? "bg-gradient-to-r from-amber-500 via-purple-500 to-cyan-500 opacity-60 scale-105" : "bg-hop-gold/20 opacity-30"}`} />
          <div className="relative h-56 w-56 sm:h-64 sm:w-64">
            <motion.div animate={spinning ? { y: [0, -4, 0] } : { y: 0 }} transition={{ repeat: Infinity, duration: 0.15 }} className="absolute left-1/2 -top-3 z-30 -translate-x-1/2 drop-shadow-[0_0_12px_rgba(255,204,68,1)]"><div className="text-3xl text-amber-400">▼</div></motion.div>
            <div className="absolute -inset-2 rounded-full border border-hop-gold/30 bg-black/40 p-1 backdrop-blur-sm shadow-[inset_0_0_15px_rgba(0,0,0,0.8)]">
              {[...Array(12)].map((_, i) => <div key={i} className={`absolute h-2 w-2 rounded-full ${spinning ? "animate-ping bg-amber-400" : "bg-hop-gold/40"}`} style={{ top: `${50 + 47 * Math.sin((i * 30 * Math.PI) / 180)}%`, left: `${50 + 47 * Math.cos((i * 30 * Math.PI) / 180)}%`, transform: "translate(-50%, -50%)" }} />)}
            </div>
            <motion.div className="relative h-full w-full rounded-full border-4 border-amber-400/80 shadow-[0_0_30px_rgba(255,204,68,0.4)] overflow-hidden" style={{ background: `conic-gradient(${SEGMENTS.map((v, i) => `${SEGMENT_COLORS[v].bg} ${i * SEG_ANGLE}deg ${(i + 1) * SEG_ANGLE}deg`).join(",")})` }} animate={{ rotate: angle }} transition={{ duration: SPIN_MS / 1000, ease: [0.15, 0.85, 0.25, 1] }}>
              {SEGMENTS.map((v, i) => { const conf = SEGMENT_COLORS[v]; return <div key={i} className="absolute left-1/2 top-1/2 font-mono font-black select-none" style={{ transform: `rotate(${i * SEG_ANGLE + SEG_ANGLE / 2}deg) translateY(-85px) translateX(-50%)`, transformOrigin: "top left", color: conf.text, textShadow: `0 0 8px ${conf.border}` }}><span className="text-xs sm:text-sm font-extrabold flex items-center gap-0.5">${v}</span></div>; })}
            </motion.div>
            <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-300 bg-gradient-to-tr from-black via-zinc-900 to-amber-950 shadow-[0_0_15px_rgba(0,0,0,0.9)] flex items-center justify-center"><Zap className={`h-5 w-5 ${spinning ? "text-amber-400 animate-bounce" : "text-amber-400/70"}`} /></div>
          </div>
        </div>
        <div className="min-w-0 text-center lg:text-left space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400"><Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-300" /> Ultra Wheel 8H</div>
          <h2 className="font-display text-3xl sm:text-4xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 drop-shadow-[0_2px_10px_rgba(255,204,68,0.3)]">KOLO ŠTĚSTÍ</h2>
          <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto lg:mx-0">Roztoč kolo každých <span className="text-amber-300 font-semibold">8 hodin</span> a získej garantovanou výhru <span className="text-emerald-400 font-semibold">$5</span>, <span className="text-cyan-400 font-semibold">$10</span>, <span className="text-purple-400 font-semibold">$20</span> nebo legendárních <span className="text-amber-400 font-bold">$50</span>!</p>
          <AnimatePresence>{result !== null && !spinning && <motion.div initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-2 inline-block rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 px-4 py-2"><p className="font-display text-lg tracking-wider text-amber-300 flex items-center gap-2 justify-center lg:justify-start"><Trophy className="h-5 w-5 text-amber-400 animate-bounce" /> VÝHRA: +${result} DOLLARS</p></motion.div>}</AnimatePresence>
          <div className="pt-2"><button onClick={() => void spin()} disabled={!canSpin} className={`relative group overflow-hidden w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-2xl px-8 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 ${canSpin ? "border-2 border-amber-400 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-black shadow-[0_0_30px_rgba(255,204,68,0.5)] hover:scale-105 active:scale-95 cursor-pointer" : "border border-zinc-800 bg-zinc-900/80 text-zinc-500 cursor-not-allowed opacity-70"}`}>{spinning ? <><Loader2 className="h-5 w-5 animate-spin text-black" /><span>NAČÍTÁM VÝHRU…</span></> : !user ? <><Gift className="h-5 w-5 text-zinc-500" /><span>PŘIHLAS SE PRO KOLO</span></> : canSpin ? <><Flame className="h-5 w-5 text-black animate-pulse" /><span>ROZTOČIT KOLO ($5 - $50)</span></> : <><Gift className="h-5 w-5 text-zinc-500" /><span>DALŠÍ POKUS ZA {countdown}</span></>}</button></div>
        </div>
      </div>
    </section>
  );
}
