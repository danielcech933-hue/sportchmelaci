import { useState } from "react";
import { CLASSIC_SPORTS, ESPORT_SPORTS, SPORT_LIST, type SportConfig, type SportId } from "@/lib/matches";

export type SportCategory = "all" | "classic" | "esport";

const CATEGORIES: { id: SportCategory; label: string }[] = [
  { id: "all", label: "Vše" },
  { id: "classic", label: "Klasické sporty" },
  { id: "esport", label: "Esporty" },
];

export function sportsInCategory(category: SportCategory): SportConfig[] {
  if (category === "classic") return CLASSIC_SPORTS;
  if (category === "esport") return ESPORT_SPORTS;
  return SPORT_LIST;
}

const CHIP_BASE = "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-[var(--aaa-radius-sm)] border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition";

/**
 * The single sport selector used across the app: one visual language,
 * classic sports and esports clearly separated, all existing SportIds kept.
 */
export function SportFilterBar({
  value,
  onChange,
  includeAll = true,
  allLabel = "Všechny sporty",
  className = "",
}: {
  value: SportId | "all";
  onChange: (v: SportId | "all") => void;
  includeAll?: boolean;
  allLabel?: string;
  className?: string;
}) {
  const activeCfg = value === "all" ? null : SPORT_LIST.find((s) => s.id === value) ?? null;
  const [category, setCategory] = useState<SportCategory>(activeCfg?.esport ? "esport" : "all");
  const list = sportsInCategory(category);

  return (
    <div className={`min-w-0 space-y-2 ${className}`}>
      <div role="tablist" aria-label="Kategorie sportů" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-[var(--aaa-radius-sm)] border border-border/60 bg-surface/50 p-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={`min-h-8 shrink-0 rounded-[calc(var(--aaa-radius-sm)-.2rem)] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] transition ${category === c.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex max-w-full flex-nowrap gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible" role="group" aria-label="Sport">
        {includeAll && (
          <button
            type="button"
            aria-pressed={value === "all"}
            onClick={() => onChange("all")}
            className={`${CHIP_BASE} ${value === "all" ? "border-primary/55 bg-primary/12 text-primary" : "border-border/50 bg-surface/40 text-muted-foreground hover:border-primary/35 hover:text-foreground"}`}
          >
            {allLabel}
          </button>
        )}
        {list.map((s) => {
          const active = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(s.id)}
              title={s.esport ? `${s.name} · esport` : s.name}
              className={`${CHIP_BASE} ${active ? (s.esport ? "border-accent/55 bg-accent/12 text-accent" : "border-primary/55 bg-primary/12 text-primary") : "border-border/50 bg-surface/40 text-muted-foreground hover:border-primary/35 hover:text-foreground"}`}
            >
              <span aria-hidden className="text-sm leading-none">{s.emoji}</span>
              <span className="truncate">{s.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Grouped <option> list for native selects, same classic/esport split. */
export function SportOptions({ allLabel }: { allLabel?: string }) {
  return (
    <>
      {allLabel && <option value="all">{allLabel}</option>}
      <optgroup label="Klasické sporty">
        {CLASSIC_SPORTS.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
      </optgroup>
      <optgroup label="Esporty">
        {ESPORT_SPORTS.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}
      </optgroup>
    </>
  );
}
