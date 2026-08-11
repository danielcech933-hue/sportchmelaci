import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { cn } from "@/lib/utils";

/* ============ CountUp — plynulá animace měnících se čísel ============ */
export function CountUp({
  value,
  decimals = 0,
  duration = 700,
  className,
  prefix = "",
  suffix = "",
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return (
    <span className={cn("tabular", className)}>
      {prefix}
      {shown.toLocaleString("cs-CZ", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

/* ============ FxText — neon glow + laser shimmer + glitch jitter ============ */
export function FxText({
  children,
  className,
  glitch = false,
  as: Tag = "span",
}: {
  children: ReactNode;
  className?: string;
  glitch?: boolean;
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
}) {
  return (
    <Tag className={cn("fx-text", glitch && "fx-glitch", className)} data-fx-text>
      {children}
    </Tag>
  );
}

/* ============ MagneticText — písmena rostou podle vzdálenosti kurzoru ============ */
export function MagneticText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  const onMove = (e: ReactMouseEvent<HTMLSpanElement>) => {
    const host = ref.current;
    if (!host) return;
    const letters = host.querySelectorAll<HTMLElement>("[data-letter]");
    letters.forEach((el) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(e.clientX - (r.left + r.width / 2));
      const k = Math.max(0, 1 - d / 110);
      el.style.transform = `translateY(${-10 * k}px) scale(${1 + 0.5 * k})`;
      el.style.filter = k > 0.05 ? `drop-shadow(0 0 ${10 * k}px var(--color-primary))` : "none";
    });
  };

  const reset = () => {
    ref.current?.querySelectorAll<HTMLElement>("[data-letter]").forEach((el) => {
      el.style.transform = "";
      el.style.filter = "";
    });
  };

  return (
    <span ref={ref} onMouseMove={onMove} onMouseLeave={reset} className={cn("inline-flex", className)}>
      {Array.from(text).map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          data-letter
          className="inline-block transition-[transform,filter] duration-150 ease-out will-change-transform"
        >
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

/* ============ TiltCard — 3D naklánění + radiální světlo pod kurzorem ============ */
export function TiltCard({
  children,
  className,
  intensity = 10,
  style,
}: {
  children: ReactNode;
  className?: string;
  intensity?: number;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);
    el.style.transform = `perspective(900px) rotateY(${(px - 0.5) * intensity * 2}deg) rotateX(${(0.5 - py) * intensity * 2}deg) translateZ(0)`;
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg)";
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={style}
      className={cn("fx-tilt fx-spotlight", className)}
    >
      {children}
    </div>
  );
}

/* ============ CursorSpotlight — neonová stopa kurzoru ============ */
export function CursorSpotlight() {
  const dot = useRef<HTMLDivElement>(null);
  const halo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let hx = x;
    let hy = y;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
    };
    const loop = () => {
      hx += (x - hx) * 0.12;
      hy += (y - hy) * 0.12;
      if (dot.current) dot.current.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (halo.current) halo.current.style.transform = `translate3d(${hx}px, ${hy}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60] hidden md:block">
      <div ref={halo} className="cursor-halo" />
      <div ref={dot} className="cursor-dot" />
    </div>
  );
}

/* ============ NeonSkeleton ============ */
export function NeonSkeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl", className)} />;
}
