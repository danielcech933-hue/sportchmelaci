import { useEffect, useRef, useState } from "react";

export type NeonTone = "cyan" | "gold" | "rose" | "violet";

const TONES: Record<NeonTone, { text: string; ring: string; glow: string }> = {
  cyan: { text: "text-[oklch(0.85_0.15_215)]", ring: "neon-box-cyan", glow: "shadow-[0_0_28px_-14px_oklch(0.8_0.18_215)]" },
  gold: { text: "text-primary", ring: "neon-box-gold", glow: "shadow-[0_0_28px_-14px_var(--color-primary)]" },
  rose: { text: "text-danger", ring: "neon-box-rose", glow: "shadow-[0_0_28px_-14px_var(--color-danger)]" },
  violet: { text: "text-[oklch(0.8_0.16_305)]", ring: "neon-box-violet", glow: "shadow-[0_0_28px_-14px_oklch(0.75_0.2_305)]" },
};

/** Count-up animation for numeric values. */
function useAnimatedNumber(value: number, duration = 550) {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    const b = value;
    if (a === b) return;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(a + (b - a) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = b;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

export function NeonStat({
  label,
  value,
  tone = "cyan",
  emoji,
  hint,
}: {
  label: string;
  value: number | string;
  tone?: NeonTone;
  emoji?: string;
  hint?: string;
}) {
  const numeric = typeof value === "number";
  const animated = useAnimatedNumber(numeric ? value : 0);
  const t = TONES[tone];
  return (
    <div
      title={hint}
      className={`group relative min-h-[86px] overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-background/90 via-background/65 to-primary/[0.04] p-3 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/35 ${t.ring} ${t.glow}`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-primary/5 blur-2xl transition-all duration-500 group-hover:bg-primary/10" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />
      <div className="relative flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {emoji && <span className="text-[11px] leading-none opacity-90">{emoji}</span>}
        <span className="truncate">{label}</span>
      </div>
      <div className={`relative mt-2 font-display text-2xl font-semibold tabular-nums tracking-wide neon-text transition-transform duration-300 group-hover:scale-[1.04] sm:text-3xl ${t.text}`}>
        {numeric ? animated : value}
      </div>
    </div>
  );
}
