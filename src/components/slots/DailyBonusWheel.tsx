import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";

/** Segmenty kola — výhra pouze $1000. */
const SEGMENTS = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000] as const;
const SEG_ANGLE = 360 / SEGMENTS.length;
const SPIN_MS = 3400;
const COOLDOWN_MS = 10000; // Interval točení: 10 sekund

const KEY = (scope: string) => `chmelovci-daily-wheel-v1:${scope}`;

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function DailyBonusWheel() {
  const { user } = useAuth();
  const { addDollars } = useWallet();
  const scope = user?.id ?? "guest";

  const [lastSpin, setLastSpin] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [angle, setAngle] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY(scope));
      setLastSpin(raw ? Number(raw) || null : null);
    } catch {
      setLastSpin(null);
    }
    setResult(null);
    setNow(Date.now());
    setHydrated(true);
  }, [scope]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  /* Vyčištění časovačů při odchodu ze stránky během točení. */
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  /* Kontrola, zda uplynulo 10 sekund od posledního točení */
  const canSpin = useMemo(
    () => hydrated && !spinning && (lastSpin === null || now - lastSpin >= COOLDOWN_MS),
    [hydrated, spinning, lastSpin, now],
  );

  const remainingMs = useMemo(() => {
    if (!lastSpin) return 0;
    return Math.max(0, lastSpin + COOLDOWN_MS - now);
  }, [lastSpin, now]);

  const countdown = hydrated ? fmt(remainingMs) : "--:--:--";

  const spin = useCallback(() => {
    if (!canSpin) return;
    const idx = Math.floor(Math.random() * SEGMENTS.length);
    const prize = SEGMENTS[idx];
    setSpinning(true);
    setResult(null);

    // 6 celých otáček + dojezd na střed vylosovaného segmentu
    setAngle((a) => a + 360 * 6 + ((360 - (idx * SEG_ANGLE + SEG_ANGLE / 2) - (a % 360) + 720) % 360));

    timers.current.push(
      window.setTimeout(() => {
        setSpinning(false);
        setResult(prize);
        const ts = Date.now();
        setLastSpin(ts);
        try {
          window.localStorage.setItem(KEY(scope), String(ts));
        } catch {
          /* ignore */
        }

        addDollars(prize);
        confetti({ particleCount: 120, spread: 90, origin: { y: 0.7 }, colors: ["#ffcc44", "#4dffa6", "#fff3bf"] });
        toast.success(`Jackpot — +$${prize}`);
      }, SPIN_MS),
    );
  }, [canSpin, scope, addDollars]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-hop-gold/35 bg-black/60 p-5 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_0%,rgba(77,255,166,0.18),transparent_60%)]" />
      <div className="relative grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <div className="mx-auto">
          <div className="relative h-44 w-44">
            <span
              aria-hidden
              className="absolute left-1/2 top-0 z-10 -translate-x-1/2 text-2xl drop-shadow-[0_0_8px_rgba(255,204,68,0.9)]"
            >
              ▼
            </span>
            <motion.div
              className="h-full w-full rounded-full border-4 border-hop-gold/70 shadow-[0_0_40px_-8px_rgba(255,204,68,0.9)]"
              style={{
                background: `conic-gradient(${SEGMENTS.map((_, i) => {
                  const color = i % 2 === 0 ? "#b8860b" : "#ffcc44";
                  return `${color} ${i * SEG_ANGLE}deg ${(i + 1) * SEG_ANGLE}deg`;
                }).join(",")})`,
              }}
              animate={{ rotate: angle }}
              transition={{ duration: SPIN_MS / 1000, ease: [0.12, 0.72, 0.12, 1] }}
            >
              {SEGMENTS.map((v, i) => (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 font-mono text-[10px] font-black text-black"
                  style={{
                    transform: `rotate(${i * SEG_ANGLE + SEG_ANGLE / 2}deg) translateY(-60px) translateX(-50%)`,
                    transformOrigin: "top left",
                  }}
                >
                  ${v}
                </span>
              ))}
            </motion.div>
            <div className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hop-gold/70 bg-black/80" />
          </div>
        </div>

        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-hop-neon/80">
            <Gift className="h-4 w-4" /> Kolo štěstí
          </p>
          <h2 className="mt-1 font-display text-2xl tracking-[0.1em] slot-gold-text">FAST $1000 SPIN</h2>
          <p className="mt-2 text-sm text-foreground/75">Garantovaná výhra $1000 každých 10 sekund!</p>

          {result !== null && !spinning && (
            <p className="mt-3 font-display text-lg tracking-[0.12em] slot-gold-text">VÝHRA +${result}</p>
          )}

          <button
            onClick={spin}
            disabled={!canSpin}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-hop-gold/50 bg-hop-gold/15 px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-hop-gold transition hover:bg-hop-gold/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {spinning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />}
            {spinning ? "Točím…" : canSpin ? "Točit ($1000)" : `Další pokus za ${countdown}`}
          </button>
        </div>
      </div>
    </section>
  );
}
