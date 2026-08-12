import { useMemo, useState } from "react";
import { Lock, LockOpen, Star, Trash2, Search } from "lucide-react";
import { UltimateCard } from "@/components/ut/UltimateCard";
import { RARITY_ORDER, quickSell, rarityMeta, setCardFlags, utErrorMessage } from "@/lib/ut";
import type { UtOwnedCard } from "@/types/ut";
import { cn } from "@/lib/utils";

interface Props {
  cards: UtOwnedCard[];
  onChanged: () => void;
  onCoins?: (coins: number) => void;
}

/** Sbírka karet s filtry, detailem, uzamčením a rychlým prodejem. */
export function CollectionBrowser({ cards, onChanged, onCoins }: Props) {
  const [search, setSearch] = useState("");
  const [rarity, setRarity] = useState<string>("ALL");
  const [sort, setSort] = useState<"rating" | "newest" | "name">("rating");
  const [selected, setSelected] = useState<UtOwnedCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = cards.filter((c) => {
      if (rarity !== "ALL" && c.card.rarity !== rarity) return false;
      if (!q) return true;
      return (
        c.card.name.toLowerCase().includes(q) ||
        c.card.club.toLowerCase().includes(q) ||
        c.card.nation.toLowerCase().includes(q) ||
        c.card.position.toLowerCase().includes(q)
      );
    });
    out.sort((a, b) => {
      if (sort === "rating") return b.card.rating - a.card.rating;
      if (sort === "name") return a.card.name.localeCompare(b.card.name);
      return b.createdAt.localeCompare(a.createdAt);
    });
    return out;
  }, [cards, search, rarity, sort]);

  async function toggleLock(c: UtOwnedCard) {
    setBusy(true);
    setError(null);
    try {
      await setCardFlags(c.id, !c.locked, c.favorite);
      onChanged();
      setSelected({ ...c, locked: !c.locked });
    } catch (e) {
      setError(utErrorMessage(e));
    }
    setBusy(false);
  }

  async function toggleFav(c: UtOwnedCard) {
    setBusy(true);
    setError(null);
    try {
      await setCardFlags(c.id, c.locked, !c.favorite);
      onChanged();
      setSelected({ ...c, favorite: !c.favorite });
    } catch (e) {
      setError(utErrorMessage(e));
    }
    setBusy(false);
  }

  async function sell(c: UtOwnedCard) {
    setBusy(true);
    setError(null);
    try {
      const res = await quickSell(c.id);
      onCoins?.(res.coins);
      setSelected(null);
      onChanged();
    } catch (e) {
      setError(utErrorMessage(e));
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hledat hráče, klub, národ…"
            className="w-full rounded-xl border border-border/60 bg-background/60 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary/60"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-xl border border-border/60 bg-background/60 px-3 py-2 font-mono text-xs uppercase tracking-widest"
        >
          <option value="rating">Rating</option>
          <option value="newest">Nejnovější</option>
          <option value="name">Jméno</option>
        </select>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {["ALL", ...RARITY_ORDER].map((r) => (
          <button
            key={r}
            onClick={() => setRarity(r)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]",
              rarity === r
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border/60 bg-background/50 text-muted-foreground",
            )}
          >
            {r === "ALL" ? "Vše" : rarityMeta(r).label}
          </button>
        ))}
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">
        {list.length} karet ze {cards.length}
      </p>

      {error && <p className="text-xs text-danger">{error}</p>}

      {!cards.length ? (
        <p className="text-sm text-muted-foreground">Zatím žádné karty — roztoč Card Spin.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {list.map((c) => (
            <UltimateCard
              key={c.id}
              card={c.card}
              size="sm"
              onClick={() => setSelected(c)}
              badge={c.locked ? "🔒" : c.favorite ? "★" : undefined}
            />
          ))}
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur"
          onClick={() => setSelected(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-primary/30 bg-background/95 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center">
              <UltimateCard card={selected.card} size="lg" />
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <p className="font-display text-lg uppercase tracking-[0.14em]">{selected.card.name}</p>
              <p className="text-xs text-muted-foreground">
                {selected.card.club} • {selected.card.league} • {selected.card.nation}
              </p>
              {selected.card.campaign && (
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
                  {selected.card.campaign}
                </p>
              )}
              {selected.card.altPositions.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Alt. pozice: {selected.card.altPositions.join(", ")}
                </p>
              )}
              {selected.card.roles.length > 0 && (
                <p className="text-xs text-muted-foreground">Role: {selected.card.roles.join(", ")}</p>
              )}
              {selected.card.playstyles.length > 0 && (
                <p className="text-xs text-cyan-200">⚡ {selected.card.playstyles.join(" · ")}</p>
              )}
              <p className="font-mono text-xs text-amber-200">Quick sell: {selected.card.quickSell} coinů</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => toggleLock(selected)}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-primary disabled:opacity-40"
              >
                {selected.locked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {selected.locked ? "Odemknout" : "Zamknout"}
              </button>
              <button
                onClick={() => toggleFav(selected)}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-200 disabled:opacity-40"
              >
                <Star className="h-3.5 w-3.5" /> {selected.favorite ? "Odebrat" : "Oblíbená"}
              </button>
              <button
                onClick={() => sell(selected)}
                disabled={busy || selected.locked}
                className="inline-flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-danger disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Rychlý prodej
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CollectionBrowser;
