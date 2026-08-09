import { useEffect, useMemo, useState } from "react";
import { Save, Users } from "lucide-react";
import { FootballCard } from "@/components/FootballCard";
import {
  FORMATIONS,
  cardsErrorMessage,
  chibiFor,
  fetchSquad,
  saveSquad,
  teamChemistry,
  teamOvr,
} from "@/lib/cards";
import type { Formation, OwnedCard } from "@/types/cards";
import { cn } from "@/lib/utils";

interface Props {
  userId: string;
  cards: OwnedCard[];
  onSaved?: () => void;
}

/** Vizuální squad builder s výpočtem Team OVR a chemie. */
export function SquadBuilder({ userId, cards, onSaved }: Props) {
  const [formation, setFormation] = useState<Formation>("4-3-3");
  const [slots, setSlots] = useState<Record<string, string>>({});
  const [active, setActive] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSquad(userId)
      .then((s) => {
        if (!s) return;
        setFormation(s.formation);
        setSlots(s.slots ?? {});
      })
      .catch(() => undefined);
  }, [userId]);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const placed = useMemo(
    () => Object.values(slots).map((id) => byId.get(id)?.card).filter(Boolean) as NonNullable<OwnedCard["card"]>[],
    [slots, byId],
  );
  const ovr = teamOvr(placed);
  const chem = teamChemistry(placed);
  const usedIds = new Set(Object.values(slots));

  function assign(ownedId: string) {
    if (!active) return;
    setSlots((prev) => {
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(prev)) if (v !== ownedId) next[k] = v;
      next[active] = ownedId;
      return next;
    });
    setActive(null);
  }

  function clearSlot(slotId: string) {
    setSlots((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  }

  async function save() {
    setError(null);
    setStatus(null);
    try {
      await saveSquad(formation, slots, ovr, chem);
      setStatus("Sestava uložena.");
      onSaved?.();
    } catch (e) {
      setError(cardsErrorMessage(e));
    }
  }

  const defs = FORMATIONS[formation];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(FORMATIONS) as Formation[]).map((f) => (
          <button
            key={f}
            onClick={() => setFormation(f)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em]",
              formation === f
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border/60 bg-background/50 text-muted-foreground",
            )}
          >
            {f}
          </button>
        ))}
        <span className="ml-auto rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-xs text-primary">
          OVR {ovr}
        </span>
        <span className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-200">
          CHEM {chem}
        </span>
        <button
          onClick={save}
          className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-primary"
        >
          <Save className="h-3.5 w-3.5" /> Uložit
        </button>
      </div>

      {status && <p className="text-xs text-accent">{status}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}

      {/* hřiště */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl border border-emerald-400/30 bg-[linear-gradient(180deg,#08301d,#04160e)] sm:aspect-[4/3]">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background:repeating-linear-gradient(0deg,rgba(255,255,255,0.06)_0_28px,transparent_28px_56px)]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
        <div className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-white/20" />
        {defs.map((d) => {
          const owned = slots[d.id] ? byId.get(slots[d.id]) : undefined;
          return (
            <div
              key={d.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${d.x}%`, top: `${d.y}%` }}
            >
              {owned ? (
                <button
                  onClick={() => clearSlot(d.id)}
                  className="flex flex-col items-center"
                  title="Odebrat z pozice"
                >
                  <img
                    src={chibiFor(owned.card)}
                    alt={owned.card.name}
                    loading="lazy"
                    width={768}
                    height={768}
                    className="h-11 w-11 object-contain drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
                  />
                  <span className="mt-0.5 max-w-[70px] truncate rounded bg-black/70 px-1 font-mono text-[9px] text-primary">
                    {owned.card.rating} {owned.card.name}
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setActive(d.id)}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full border border-dashed font-mono text-[10px]",
                    active === d.id
                      ? "border-primary bg-primary/25 text-primary"
                      : "border-white/40 bg-black/40 text-white/70",
                  )}
                >
                  {d.pos}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">
          <Users className="h-3.5 w-3.5" /> Sbírka {active ? `— vyber kartu na ${active.toUpperCase()}` : ""}
        </p>
        {!cards.length ? (
          <p className="mt-2 text-xs text-muted-foreground">Zatím žádné karty — otevři si balíček.</p>
        ) : (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
            {cards.map((c) => (
              <FootballCard
                key={c.id}
                card={c.card}
                size="sm"
                selected={usedIds.has(c.id)}
                onClick={active ? () => assign(c.id) : undefined}
                className={cn(!active && "opacity-90")}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SquadBuilder;
