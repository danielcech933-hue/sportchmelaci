import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save, Users } from "lucide-react";
import { UltimateCard } from "@/components/ut/UltimateCard";
import type { UtOwnedCard } from "@/types/ut";
import { cn } from "@/lib/utils";

type SlotKey = "GK" | "LB" | "CB1" | "CB2" | "RB" | "CM1" | "CM2" | "CAM" | "LW" | "ST" | "RW";

type Squad = Record<SlotKey, string | null>;

const SLOTS: Array<{ key: SlotKey; label: string; x: number; y: number; positions: string[] }> = [
  { key: "GK", label: "GK", x: 50, y: 88, positions: ["GK"] },
  { key: "LB", label: "LB", x: 16, y: 69, positions: ["LB", "LWB", "LM"] },
  { key: "CB1", label: "CB", x: 38, y: 72, positions: ["CB", "LB", "RB"] },
  { key: "CB2", label: "CB", x: 62, y: 72, positions: ["CB", "LB", "RB"] },
  { key: "RB", label: "RB", x: 84, y: 69, positions: ["RB", "RWB", "RM"] },
  { key: "CM1", label: "CM", x: 31, y: 49, positions: ["CM", "CDM", "CAM", "LM", "RM"] },
  { key: "CM2", label: "CM", x: 69, y: 49, positions: ["CM", "CDM", "CAM", "LM", "RM"] },
  { key: "CAM", label: "CAM", x: 50, y: 40, positions: ["CAM", "CM", "CF"] },
  { key: "LW", label: "LW", x: 16, y: 20, positions: ["LW", "LM", "LF", "ST"] },
  { key: "ST", label: "ST", x: 50, y: 15, positions: ["ST", "CF"] },
  { key: "RW", label: "RW", x: 84, y: 20, positions: ["RW", "RM", "RF", "ST"] },
];

const EMPTY_SQUAD: Squad = {
  GK: null,
  LB: null,
  CB1: null,
  CB2: null,
  RB: null,
  CM1: null,
  CM2: null,
  CAM: null,
  LW: null,
  ST: null,
  RW: null,
};

const STORAGE_KEY = "sportchmelaci-ut-squad-v1";

function chemistryFor(cards: UtOwnedCard[]): number {
  if (!cards.length) return 0;
  let score = 0;
  for (const card of cards) {
    const nation = cards.filter((x) => x.card.nation === card.card.nation).length;
    const club = cards.filter((x) => x.card.club === card.card.club).length;
    const league = cards.filter((x) => x.card.league === card.card.league).length;
    score += Math.min(3, nation - 1) + Math.min(3, club - 1) + Math.min(3, league - 1);
  }
  return Math.min(33, Math.round(score / 2));
}

export function SquadBuilder({ cards }: { cards: UtOwnedCard[] }) {
  const [squad, setSquad] = useState<Squad>(EMPTY_SQUAD);
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSquad({ ...EMPTY_SQUAD, ...JSON.parse(raw) });
    } catch {
      setSquad(EMPTY_SQUAD);
    }
  }, []);

  const selectedCards = useMemo(
    () => SLOTS.map((slot) => cards.find((c) => c.id === squad[slot.key])).filter(Boolean) as UtOwnedCard[],
    [cards, squad],
  );

  const usedIds = new Set(selectedCards.map((c) => c.id));
  const chemistry = chemistryFor(selectedCards);
  const rating = selectedCards.length
    ? Math.round(selectedCards.reduce((sum, c) => sum + c.card.rating, 0) / selectedCards.length)
    : 0;

  const active = SLOTS.find((slot) => slot.key === activeSlot) ?? null;
  const candidates = active
    ? cards
        .filter((card) => !usedIds.has(card.id) || card.id === squad[active.key])
        .filter((card) => active.positions.includes(card.card.position) || active.positions.some((p) => card.card.altPositions.includes(p)))
        .sort((a, b) => b.card.rating - a.card.rating)
    : [];

  function assign(cardId: string) {
    if (!activeSlot) return;
    setSquad((current) => {
      const next = { ...current };
      for (const key of Object.keys(next) as SlotKey[]) {
        if (next[key] === cardId) next[key] = null;
      }
      next[activeSlot] = cardId;
      return next;
    });
    setActiveSlot(null);
  }

  function clearSlot(slot: SlotKey) {
    setSquad((current) => ({ ...current, [slot]: null }));
  }

  function save() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(squad));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-3xl border border-primary/25 bg-background/60 p-3 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">Squad</p>
            <h2 className="font-display text-2xl uppercase tracking-[0.08em] text-primary">4-3-3 · Základní sestava</h2>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span><b className="text-primary">{rating}</b> OVR</span>
            <span><b className="text-primary">{chemistry}</b>/33 CHEM</span>
          </div>
        </div>

        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-emerald-300/25 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_60%),linear-gradient(180deg,rgba(5,46,22,0.8),rgba(2,15,9,0.95))]">
          <div className="absolute inset-[6%] rounded-[48%] border border-emerald-200/20" />
          <div className="absolute left-[25%] right-[25%] top-0 h-[17%] rounded-b-[50%] border-x border-b border-emerald-200/20" />
          <div className="absolute left-1/2 top-1/2 h-px w-[88%] -translate-x-1/2 bg-emerald-200/15" />
          <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/15" />

          {SLOTS.map((slot) => {
            const owned = cards.find((card) => card.id === squad[slot.key]);
            return (
              <button
                key={slot.key}
                type="button"
                onClick={() => setActiveSlot(slot.key)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  clearSlot(slot.key);
                }}
                className={cn(
                  "absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-xl border p-1 transition hover:scale-105",
                  owned ? "border-primary/50 bg-black/30" : "border-dashed border-emerald-200/30 bg-black/20",
                )}
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                title={owned ? `${owned.card.name} · pravým tlačítkem odebrat` : `Přidat ${slot.label}`}
              >
                {owned ? (
                  <UltimateCard card={owned.card} size="sm" badge={slot.label} />
                ) : (
                  <span className="flex h-[118px] w-[104px] flex-col items-center justify-center gap-1 text-emerald-100/60">
                    <span className="text-2xl">+</span>
                    <span className="font-mono text-[9px] uppercase tracking-widest">{slot.label}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="rounded-3xl border border-border/60 bg-background/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">Sestava</p>
            <h3 className="font-display text-xl uppercase">Výběr hráče</h3>
          </div>
          <Users className="h-5 w-5 text-primary" />
        </div>

        {!active && (
          <p className="mt-5 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">
            Klikni na pozici na hřišti a vyber hráče ze své sbírky. Pravým klikem kartu z pozice odebereš.
          </p>
        )}

        {active && (
          <>
            <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-primary/70">Pozice</p>
              <p className="mt-1 font-display text-lg text-primary">{active.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">Vhodné: {active.positions.join(" · ")}</p>
            </div>
            <div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {!candidates.length && <p className="text-xs text-muted-foreground">Nemáš vhodnou kartu pro tuto pozici.</p>}
              {candidates.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => assign(card.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-2 text-left hover:border-primary/40"
                >
                  <UltimateCard card={card.card} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-display text-sm uppercase">{card.card.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{card.card.rating} OVR · {card.card.position}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={save} className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-primary">
            <Save className="h-3.5 w-3.5" /> {saved ? "Uloženo" : "Uložit sestavu"}
          </button>
          <button type="button" onClick={() => setSquad(EMPTY_SQUAD)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        </div>
      </aside>
    </div>
  );
}
