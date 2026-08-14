import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Save, Users } from "lucide-react";
import { UltimateCard } from "@/components/ut/UltimateCard";
import { supabase } from "@/integrations/supabase/client";
import type { UtOwnedCard } from "@/types/ut";
import { cn } from "@/lib/utils";

type SlotKey = "GK" | "LB" | "CB1" | "CB2" | "RB" | "CM1" | "CM2" | "CAM" | "LW" | "ST" | "RW";
type Squad = Record<SlotKey, string | null>;
type SquadRow = { id: string; name: string; formation: string; version: number; players: Array<{ user_card_id: string; slot_key: string; position: string; squad_role: string }> };
type Metrics = { starting_xi: number; team_ovr: number; chemistry: number };

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

const EMPTY_SQUAD: Squad = { GK: null, LB: null, CB1: null, CB2: null, RB: null, CM1: null, CM2: null, CAM: null, LW: null, ST: null, RW: null };

function mapRpcError(error: unknown): string {
  const raw = String((error as { message?: string })?.message ?? error ?? "");
  if (raw.includes("card_not_owned")) return "Tuto kartu nevlastníš.";
  if (raw.includes("invalid_player_position")) return "Tahle karta nemůže hrát na zvolené pozici.";
  if (raw.includes("squad_version_conflict")) return "Sestava se mezitím změnila. Obnov ji a zkus to znovu.";
  if (raw.includes("INVALID_STARTING_XI")) return "Sestava musí mít přesně 11 hráčů.";
  if (raw.includes("squad_not_found")) return "Sestava už neexistuje. Obnov FUT a vytvoř ji znovu.";
  if (raw.includes("not_authenticated")) return "Přihlas se.";
  return raw || "Uložení sestavy se nepovedlo.";
}

export function SquadBuilder({ cards }: { cards: UtOwnedCard[] }) {
  const [squadId, setSquadId] = useState<string | null>(null);
  const [version, setVersion] = useState(1);
  const [squad, setSquad] = useState<Squad>(EMPTY_SQUAD);
  const [savedSquad, setSavedSquad] = useState<Squad>(EMPTY_SQUAD);
  const [activeSlot, setActiveSlot] = useState<SlotKey | null>(null);
  const [metrics, setMetrics] = useState<Metrics>({ starting_xi: 0, team_ovr: 0, chemistry: 0 });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hydrate = (row: SquadRow) => {
    const next = { ...EMPTY_SQUAD };
    for (const player of row.players ?? []) {
      const key = player.slot_key as SlotKey;
      if (key in next) next[key] = player.user_card_id;
    }
    setSquadId(row.id);
    setVersion(row.version);
    setSquad(next);
    setSavedSquad(next);
    setMetrics((current) => ({ ...current, starting_xi: Object.values(next).filter(Boolean).length }));
    setSaved(true);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: getError } = await supabase.rpc("fc_squad_get_active" as never, {} as never);
      if (cancelled) return;
      if (getError) {
        setError(mapRpcError(getError));
        setLoading(false);
        return;
      }
      if (!data) {
        const { data: created, error: createError } = await supabase.rpc("fc_squad_create" as never, { _name: "Main Squad", _formation: "4-3-3" } as never);
        if (cancelled) return;
        if (createError) setError(mapRpcError(createError));
        else hydrate(created as unknown as SquadRow);
      } else {
        hydrate(data as unknown as SquadRow);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!squadId || !saved) return;
    let cancelled = false;
    supabase.rpc("fc_squad_metrics" as never, { _squad_id: squadId } as never).then(({ data, error: metricError }) => {
      if (cancelled) return;
      if (metricError) setError(mapRpcError(metricError));
      else setMetrics(data as unknown as Metrics);
    });
    return () => { cancelled = true; };
  }, [squadId, saved]);

  const usedIds = useMemo(() => new Set(Object.values(squad).filter(Boolean)), [squad]);
  const localStartingXi = useMemo(() => Object.values(squad).filter(Boolean).length, [squad]);
  const dirty = useMemo(() => (Object.keys(EMPTY_SQUAD) as SlotKey[]).some((key) => squad[key] !== savedSquad[key]), [squad, savedSquad]);
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
      for (const key of Object.keys(next) as SlotKey[]) if (next[key] === cardId) next[key] = null;
      next[activeSlot] = cardId;
      return next;
    });
    setSaved(false);
    setActiveSlot(null);
    setError(null);
  }

  function clearSlot(slot: SlotKey) {
    setSquad((current) => ({ ...current, [slot]: null }));
    setSaved(false);
    setError(null);
  }

  function reset() {
    setSquad(savedSquad);
    setActiveSlot(null);
    setSaved(true);
    setError(null);
  }

  async function save() {
    if (!squadId || saving) return;
    if (localStartingXi !== 11) {
      setError("Sestava musí mít přesně 11 hráčů.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const players = SLOTS.map((slot) => ({
        user_card_id: squad[slot.key],
        slot_key: slot.key,
        position: slot.label,
        squad_role: "STARTER",
        is_captain: slot.key === "ST",
      })).filter((p) => p.user_card_id);

      const { data, error: saveError } = await supabase.rpc("fc_squad_save" as never, {
        _squad_id: squadId,
        _expected_version: version,
        _name: "Main Squad",
        _formation: "4-3-3",
        _players: players,
      } as never);
      if (saveError) throw saveError;
      hydrate(data as unknown as SquadRow);
      setSaved(true);
    } catch (e) {
      setError(mapRpcError(e));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="rounded-3xl border border-primary/20 bg-background/50 p-8 text-sm text-muted-foreground">Načítám serverovou sestavu…</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-3xl border border-primary/25 bg-background/60 p-3 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">Server Authoritative Squad</p><h2 className="font-display text-2xl uppercase tracking-[0.08em] text-primary">4-3-3 · Základní sestava</h2></div>
          <div className="flex items-center gap-3 font-mono text-xs"><span><b className="text-primary">{metrics.team_ovr}</b> OVR</span><span><b className="text-primary">{metrics.chemistry}</b>/33 CHEM</span><span className={cn("text-muted-foreground", localStartingXi === 11 && "text-emerald-300")}>{localStartingXi}/11</span></div>
        </div>
        {dirty && <div className="mb-3 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-amber-200">Neuložené změny · OVR/CHEM se přepočítají po uložení</div>}

        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-emerald-300/25 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.12),transparent_60%),linear-gradient(180deg,rgba(5,46,22,0.8),rgba(2,15,9,0.95))]">
          <div className="absolute inset-[6%] rounded-[48%] border border-emerald-200/20" /><div className="absolute left-[25%] right-[25%] top-0 h-[17%] rounded-b-[50%] border-x border-b border-emerald-200/20" /><div className="absolute left-1/2 top-1/2 h-px w-[88%] -translate-x-1/2 bg-emerald-200/15" /><div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-200/15" />
          {SLOTS.map((slot) => {
            const owned = cards.find((card) => card.id === squad[slot.key]);
            return <button key={slot.key} type="button" onClick={() => setActiveSlot(slot.key)} onContextMenu={(event) => { event.preventDefault(); clearSlot(slot.key); }} className={cn("absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-xl border p-1 transition hover:scale-105", owned ? "border-primary/50 bg-black/30" : "border-dashed border-emerald-200/30 bg-black/20")} style={{ left: `${slot.x}%`, top: `${slot.y}%` }} title={owned ? `${owned.card.name} · pravým tlačítkem odebrat` : `Přidat ${slot.label}`}>
              {owned ? <UltimateCard card={owned.card} size="sm" badge={slot.key === "ST" ? "C" : slot.label} /> : <span className="flex h-[118px] w-[104px] flex-col items-center justify-center gap-1 text-emerald-100/60"><span className="text-2xl">+</span><span className="font-mono text-[9px] uppercase tracking-widest">{slot.label}</span></span>}
            </button>;
          })}
        </div>
      </section>

      <aside className="rounded-3xl border border-border/60 bg-background/60 p-4">
        <div className="flex items-center justify-between gap-2"><div><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">Sestava</p><h3 className="font-display text-xl uppercase">Výběr hráče</h3></div><Users className="h-5 w-5 text-primary" /></div>
        {active ? <><div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="font-mono text-[10px] uppercase tracking-widest text-primary/70">Pozice</p><p className="mt-1 font-display text-lg text-primary">{active.label}</p><p className="mt-1 text-xs text-muted-foreground">Vhodné: {active.positions.join(" · ")}</p></div><div className="mt-3 max-h-[560px] space-y-2 overflow-y-auto pr-1">{!candidates.length && <p className="text-xs text-muted-foreground">Nemáš vhodnou kartu pro tuto pozici.</p>}{candidates.map((card) => <button key={card.id} type="button" onClick={() => assign(card.id)} className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-background/60 p-2 text-left hover:border-primary/40"><UltimateCard card={card.card} size="sm" /><span className="min-w-0"><span className="block truncate font-display text-sm uppercase">{card.card.name}</span><span className="font-mono text-[10px] text-muted-foreground">{card.card.rating} OVR · {card.card.position}</span></span></button>)}</div></> : <p className="mt-5 rounded-xl border border-primary/15 bg-primary/5 p-3 text-xs text-muted-foreground">Klikni na pozici na hřišti a vyber hráče ze své sbírky. Pravým klikem kartu z pozice odebereš.</p>}
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => void save()} disabled={saving || localStartingXi !== 11 || !dirty} className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-primary disabled:opacity-40"><Save className="h-3.5 w-3.5" /> {saving ? "Ukládám…" : saved ? "Uloženo" : "Uložit sestavu"}</button><button type="button" onClick={reset} disabled={!dirty || saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground disabled:opacity-40"><RotateCcw className="h-3.5 w-3.5" /> Zrušit změny</button></div>
        {error && <p className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs text-red-300">{error}</p>}
      </aside>
    </div>
  );
}
