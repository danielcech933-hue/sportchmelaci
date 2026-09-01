import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Gift, Loader2, Sparkles, Trophy, Zap, Flame, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";

const SEGMENTS = [5, 10, 20, 50, 5, 10, 20, 50] as const;
const TEST_PRIZES = [5, 10, 20, 50] as const;
const SEG_ANGLE = 360 / SEGMENTS.length;
const SPIN_MS = 4500;

const SEGMENT_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  5: { bg: "#059669", text: "#a7f3d0", border: "#10b981" },
  10: { bg: "#0284c7", text: "#bae6fd", border: "#38bdf8" },
  20: { bg: "#7c3aed", text: "#ddd6fe", border: "#a855f7" },
  50: { bg: "#d97706", text: "#fef08a", border: "#fbbf24" },
};

function formatCountdown(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

function isPreviewHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host.startsWith("id-preview--");
}

export function DailyBonusWheel() {
  const { user } = useAuth();
  const { claimDailyBonus, dailyBonusStatus } = useWallet();
  const [previewHost, setPreviewHost] = useState(false);
  useEffect(() => { setPreviewHost(isPreviewHost()); }, []);
  const timers = useRef<number[]>([]);

  const [nextClaimAt, setNextClaimAt] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

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

  useEffect(() => {
    return () => timers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const remainingMs = useMemo(() => {
    if (!nextClaimAt) return 0;
    const timestamp = Date.parse(nextClaimAt);
    return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : 0;
  }, [nextClaimAt, now]);

  const canSpin = hydrated && Boolean(user) && !spinning && remainingMs <= 0;
  const canPreviewSpin = previewHost && hydrated && !spinning;
  const countdown = hydrated ? formatCountdown(remainingMs) : "--:--:--";

  const firePrizeConfetti = useCallback((prize: number) => {
    if (prize === 50) {
      const end = Date.now() + 1800;
      const id = window.setInterval(() => {
        if (Date.now() >= end) {
          window.clearInterval(id);
          return;
        }
        confetti({
          startVelocity: 28,
          spread: 360,
          ticks: 55,
          zIndex: 1000,
          origin: { x: Math.random(), y: Math.random() - 0.15 },
        });
      }, 180);
      timers.current.push(id);
      return;
    }
    confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
  }, []);

  const animateToPrize = useCallback(
    (prize: number, segmentIndex: number, onDone?: () => void) => {
      if (!Number.isInteger(segmentIndex) || segmentIndex < 0 || segmentIndex >= SEGMENTS.length) return;
      if (SEGMENTS[segmentIndex] !== prize) return;

      setResult(null);
      const current = ((angle % 360) + 360) % 360;
      const target = (360 - (segmentIndex * SEG_ANGLE + SEG_ANGLE / 2) - current + 720) % 360;
      setAngle((currentAngle) => currentAngle + 360 * 8 + target);

      const timer = window.setTimeout(() => {
        setSpinning(false);
        setResult(prize);
        firePrizeConfetti(prize);
        onDone?.();
      }, SPIN_MS);
      timers.current.push(timer);
    },
    [angle, firePrizeConfetti],
  );

  const spin = useCallback(async () => {
    if (!canSpin) return;
    setSpinning(true);
    setResult(null);

    const reward = await claimDailyBonus();
    if (!reward.ok || reward.prize == null || reward.segmentIndex == null) {
      setSpinning(false);
      toast.error(reward.error ?? "Výhru se nepodařilo připsat.");
      await refreshCooldown();
      return;
    }

    animateToPrize(reward.prize, reward.segmentIndex, () => {
      setNextClaimAt(reward.nextClaimAt ?? null);
      toast.success(
        reward.prize === 50 ? "🔥 LEGENDÁRNÍ JACKPOT! +$50 🔥" : `Skvěle! Vyhráváš +$${reward.prize}`,
        { duration: reward.prize === 50 ? 5000 : 3000 },
      );
    });
  }, [animateToPrize, canSpin, claimDailyBonus, refreshCooldown]);

  const previewSpin = useCallback(() => {
    if (!canPreviewSpin) return;
    setSpinning(true);
    const prize = TEST_PRIZES[Math.floor(Math.random() * TEST_PRIZES.length)];
    const matching = SEGMENTS.flatMap((value, index) => (value === prize ? [index] : []));
    const segmentIndex = matching[Math.floor(Math.random() * matching.length)];
    animateToPrize(prize, segmentIndex, () => {
      toast.success(`TEST MODE: +$${prize} — bez zápisu do účtu.`, { duration: 2500 });
    });
  }, [animateToPrize, canPreviewSpin]);

  return (
    <section className="relative overflow-hidden rounded-3xl border-2 border-hop-gold/40 bg-gradient-to-br from-black/90 via-zinc-950/80 to-black/95 p-6 shadow-[0_0_50px_rgba(255,204,68,0.15)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 rounded-full bg-hop-gold/10 blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-64 w-64 rounded-full bg-purple-600/10 blur-[80px]" />

      <div className="relative grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
        <div className="relative mx-auto">
          <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-700 ${spinning ? "scale-105 bg-gradient-to-r from-amber-500 via-purple-500 to-cyan-500 opacity-60" : "bg-hop-gold/20 opacity-30"}`} />
          <div className="relative h-56 w-56 sm:h-64 sm:w-64">
            <motion.div
              animate={spinning ? { y: [0, -4, 0] } : { y: 0 }}
              transition={{ repeat: Infinity, duration: 0.15 }}
              className="absolute -top-3 left-1/2 z-30 -translate-x-1/2 text-3xl text-amber-400 drop-shadow-[0_0_12px_rgba(255,204,68,1)]"
            >
              ▼
            </motion.div>

            <div className="absolute -inset-2 rounded-full border border-hop-gold/30 bg-black/40 p-1 shadow-[inset_0_0_15px_rgba(0,0,0,0.8)] backdrop-blur-sm">
              {Array.from({ length: 12 }).map((_, index) => {
                const radians = (index * 30 * Math.PI) / 180;
                return (
                  <div
                    key={index}
                    className={`absolute h-2 w-2 rounded-full ${spinning ? "animate-ping bg-amber-400" : "bg-hop-gold/40"}`}
                    style={{
                      top: `${(50 + 47 * Math.sin(radians)).toFixed(4)}%`,
                      left: `${(50 + 47 * Math.cos(radians)).toFixed(4)}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                );
              })}
            </div>

            <motion.div
              className="relative h-full w-full overflow-hidden rounded-full border-4 border-amber-400/80 shadow-[0_0_30px_rgba(255,204,68,0.4)]"
              style={{
                background: `conic-gradient(${SEGMENTS.map((value, index) => `${SEGMENT_COLORS[value].bg} ${index * SEG_ANGLE}deg ${(index + 1) * SEG_ANGLE}deg`).join(",")})`,
              }}
              animate={{ rotate: angle }}
              transition={{ duration: SPIN_MS / 1000, ease: [0.15, 0.85, 0.25, 1] }}
            >
              {SEGMENTS.map((value, index) => {
                const color = SEGMENT_COLORS[value];
                return (
                  <div
                    key={index}
                    className="absolute left-1/2 top-1/2 select-none font-mono font-black"
                    style={{
                      transform: `rotate(${index * SEG_ANGLE + SEG_ANGLE / 2}deg) translateY(-85px) translateX(-50%)`,
                      transformOrigin: "top left",
                      color: color.text,
                      textShadow: `0 0 8px ${color.border}`,
                    }}
                  >
                    <span className="flex items-center gap-0.5 text-xs font-extrabold sm:text-sm">${value}</span>
                  </div>
                );
              })}
            </motion.div>

            <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-300 bg-gradient-to-tr from-black via-zinc-900 to-amber-950 shadow-[0_0_15px_rgba(0,0,0,0.9)]">
              <Zap className={`h-5 w-5 ${spinning ? "animate-bounce text-amber-400" : "text-amber-400/70"}`} />
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-3 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-widest text-amber-400">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-300" />
            Ultra Wheel 8H
          </div>

          <h2 className="bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-500 bg-clip-text font-display text-3xl tracking-wider text-transparent drop-shadow-[0_2px_10px_rgba(255,204,68,0.3)] sm:text-4xl">
            KOLO ŠTĚSTÍ
          </h2>

          <p className="mx-auto max-w-md text-xs text-zinc-400 sm:text-sm lg:mx-0">
            Roztoč kolo každých <span className="font-semibold text-amber-300">8 hodin</span> a získej garantovanou výhru <span className="font-semibold text-emerald-400">$5</span>, <span className="font-semibold text-cyan-400">$10</span>, <span className="font-semibold text-purple-400">$20</span> nebo legendárních <span className="font-bold text-amber-400">$50</span>.
          </p>

          <AnimatePresence>
            {result !== null && !spinning && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-2 inline-block rounded-xl border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 px-4 py-2"
              >
                <p className="flex items-center justify-center gap-2 font-display text-lg tracking-wider text-amber-300 lg:justify-start">
                  <Trophy className="h-5 w-5 animate-bounce text-amber-400" />
                  VÝHRA: +${result} DOLLARS
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 lg:justify-start">
            <button
              onClick={() => void spin()}
              disabled={!canSpin}
              className={`group relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-2xl px-8 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all duration-300 sm:w-auto ${canSpin ? "cursor-pointer border-2 border-amber-400 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-black shadow-[0_0_30px_rgba(255,204,68,0.5)] hover:scale-105 active:scale-95" : "cursor-not-allowed border border-zinc-800 bg-zinc-900/80 text-zinc-500 opacity-70"}`}
            >
              {spinning ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-black" />
                  <span>NAČÍTÁM VÝHRU…</span>
                </>
              ) : !user ? (
                <>
                  <Gift className="h-5 w-5 text-zinc-500" />
                  <span>PŘIHLAS SE PRO KOLO</span>
                </>
              ) : canSpin ? (
                <>
                  <Flame className="h-5 w-5 animate-pulse text-black" />
                  <span>ROZTOČIT KOLO</span>
                </>
              ) : (
                <>
                  <Gift className="h-5 w-5 text-zinc-500" />
                  <span>DALŠÍ POKUS ZA {countdown}</span>
                </>
              )}
            </button>

            {canPreviewSpin && (
              <button
                onClick={previewSpin}
                disabled={spinning}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/40 bg-cyan-400/10 px-4 py-3 text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-50"
              >
                <FlaskConical className="h-4 w-4" />
                TEST TOČENÍ
              </button>
            )}
          </div>

          {previewHost && (
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-300/80">
              <FlaskConical className="h-3 w-3" />
              Preview test mode · test točení nic nepřipisuje
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
