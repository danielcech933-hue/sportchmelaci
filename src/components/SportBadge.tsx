import { SPORTS, type SportId } from "@/lib/matches";

/** Glowing sport / esport title badge. */
export function SportBadge({ sport, className = "" }: { sport: SportId; className?: string }) {
  const cfg = SPORTS[sport];
  const esport = !!cfg.esport;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] backdrop-blur ${
        esport
          ? "border-accent/60 bg-accent/10 text-accent shadow-[0_0_18px_-8px_var(--color-accent)]"
          : "border-primary/50 bg-primary/10 text-primary shadow-[0_0_18px_-8px_var(--color-primary)]"
      } ${className}`}
    >
      <span className="text-sm leading-none">{cfg.emoji}</span>
      <span className="truncate">{cfg.name}</span>
      {esport && <span className="opacity-70">· esport</span>}
    </span>
  );
}
