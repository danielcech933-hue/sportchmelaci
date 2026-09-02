import { useEffect, useRef, useState } from "react";

export type NeonTone = "cyan" | "gold" | "rose" | "violet";

type ToneConfig = {
  text: string;
  ring: string;
  glow: string;
  wash: string;
  edge: string;
};

const TONES: Record<NeonTone, ToneConfig> = {
  cyan: { text: "text-[oklch(0.85_0.15_215)]", ring: "neon-box-cyan", glow: "shadow-[0_0_34px_-16px_oklch(0.8_0.18_215)]", wash: "from-cyan-300/[0.11]", edge: "via-cyan-200/55" },
  gold: { text: "text-primary", ring: "neon-box-gold", glow: "shadow-[0_0_34px_-16px_var(--color-primary)]", wash: "from-primary/[0.12]", edge: "via-primary/65" },
  rose: { text: "text-danger", ring: "neon-box-rose", glow: "shadow-[0_0_34px_-16px_var(--color-danger)]", wash: "from-rose-300/[0.10]", edge: "via-rose-200/50" },
  violet: { text: "text-[oklch(0.8_0.16_305)]", ring: "neon-box-violet", glow: "shadow-[0_0_34px_-16px_oklch(0.75_0.2_305)]", wash: "from-violet-300/[0.10]", edge: "via-violet-200/50" },
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

export function NeonStat({ label, value, tone = "cyan", emoji, hint }: { label: string; value: number | string; tone?: NeonTone; emoji?: string; hint?: string }) {
  const numeric = typeof value === "number";
  const animated = useAnimatedNumber(numeric ? value : 0);
  const t = TONES[tone];
  const accessibleValue = numeric ? value.toString() : value;

  return (
    <div
      title={hint}
      aria-label={hint ? `${label}: ${accessibleValue}. ${hint}` : `${label}: ${accessibleValue}`}
      className={`group relative min-h-[94px] overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br ${t.wash} via-background/70 to-background/95 p-3.5 backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-white/[0.16] ${t.ring} ${t.glow}`}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/[0.045] blur-2xl transition-all duration-500 group-hover:scale-125 group-hover:bg-primary/[0.09]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-80">
        <div className={`mx-auto h-full w-[62%] bg-gradient-to-r from-transparent ${t.edge} to-transparent`} />
      </div>
      <div className="pointer-events-none absolute inset-x-4 bottom-2 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />

      <div className="relative flex items-center justify-between gap-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-1.5">
          {emoji && <span className="text-[11px] leading-none opacity-95 transition-transform duration-300 group-hover:scale-110">{emoji}</span>}
          <span className="truncate">{label}</span>
        </div>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-35 transition-opacity duration-300 group-hover:opacity-80" aria-hidden />
      </div>

      <div className={`relative mt-2 font-display text-[1.65rem] font-semibold tabular-nums leading-none tracking-[0.02em] neon-text transition-transform duration-300 group-hover:scale-[1.045] sm:text-[1.95rem] ${t.text}`}>
        {numeric ? animated : value}
      </div>
      {hint && <div className="relative mt-2 line-clamp-1 text-[8px] uppercase tracking-[0.16em] text-muted-foreground/45">{hint}</div>}
    </div>
  );
}
