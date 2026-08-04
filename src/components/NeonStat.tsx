import { useEffect, useRef, useState } from "react";

export type NeonTone = "cyan" | "gold" | "rose" | "violet";

const TONES: Record<NeonTone, { text: string; ring: string }> = {
  cyan: { text: "text-[oklch(0.85_0.15_215)]", ring: "neon-box-cyan" },
  gold: { text: "text-primary", ring: "neon-box-gold" },
  rose: { text: "text-danger", ring: "neon-box-rose" },
  violet: { text: "text-[oklch(0.8_0.16_305)]", ring: "neon-box-violet" },
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
      className={`group relative overflow-hidden rounded-xl border border-primary/20 bg-background/60 p-2.5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5 sm:p-3 ${t.ring}`}
    >
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" />
      <div className="relative flex items-center gap-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {emoji && <span className="text-[11px] leading-none">{emoji}</span>}
        <span className="truncate">{label}</span>
      </div>
      <div
        className={`relative mt-0.5 font-display text-xl tabular-nums neon-text transition-transform duration-300 group-hover:scale-105 sm:text-2xl ${t.text}`}
      >
        {numeric ? animated : value}
      </div>
    </div>
  );
}
