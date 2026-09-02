import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";

/**
 * Shared UI primitives so every screen uses the same spacing, radius,
 * typography and state presentation. Prefer these over ad-hoc markup.
 */

export function PageHeader({ eyebrow, title, subtitle, actions, className = "" }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={`grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow && <div className="aaa-meta text-primary/80">{eyebrow}</div>}
        <h1 className="mt-1 truncate font-display text-3xl tracking-[0.1em] text-foreground sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="col-span-2 flex flex-wrap gap-2 sm:col-auto">{actions}</div>}
    </header>
  );
}

export function Panel({ children, className = "", padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <section className={`aaa-card ${padded ? "p-4 sm:p-5" : ""} ${className}`}>{children}</section>;
}

export function SectionTitle({ eyebrow, title, actions }: { eyebrow?: string; title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 sm:flex sm:flex-wrap sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="aaa-meta">{eyebrow}</div>}
        <h2 className="mt-1 truncate font-display text-2xl tracking-[0.1em] text-foreground sm:text-3xl">{title}</h2>
      </div>
      {actions && <div className="flex flex-wrap gap-1.5">{actions}</div>}
    </div>
  );
}

/** Consistent segmented tab control (replaces the ad-hoc pill rows). */
export function SegmentedTabs<T extends string>({ value, onChange, options, ariaLabel, className = "" }: { value: T; onChange: (v: T) => void; options: { id: T; label: string }[]; ariaLabel?: string; className?: string }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`inline-flex max-w-full gap-1 overflow-x-auto rounded-[var(--aaa-radius-sm)] border border-border/60 bg-surface/50 p-1 ${className}`}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={`min-h-9 shrink-0 rounded-[calc(var(--aaa-radius-sm)-.2rem)] px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Uniform loading / empty / error presentation — never a blank area. */
export function StateBlock({ state, title, hint, action, className = "" }: { state: "loading" | "empty" | "error"; title?: string; hint?: string; action?: ReactNode; className?: string }) {
  const preset = state === "loading"
    ? { icon: <Loader2 className="h-5 w-5 animate-spin" />, title: title ?? "Načítám…", tone: "text-muted-foreground" }
    : state === "error"
      ? { icon: <AlertTriangle className="h-5 w-5" />, title: title ?? "Něco se nepovedlo", tone: "text-[color:var(--color-danger)]" }
      : { icon: <Inbox className="h-5 w-5" />, title: title ?? "Zatím nic tady není", tone: "text-muted-foreground" };
  return (
    <div role={state === "error" ? "alert" : "status"} className={`flex flex-col items-center justify-center gap-2 rounded-[var(--aaa-radius-sm)] border border-dashed border-border/60 bg-surface/30 px-4 py-8 text-center ${className}`}>
      <span className={preset.tone}>{preset.icon}</span>
      <p className="text-sm font-semibold text-foreground">{preset.title}</p>
      {hint && <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 4, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-[var(--aaa-radius-sm)] border border-border/40 bg-surface/40" />
      ))}
    </div>
  );
}
