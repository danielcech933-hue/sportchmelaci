import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Coins, Gamepad2, Sparkles, Swords, Tag, ShoppingCart, PackageOpen } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  RARITY_META,
  arcadeErrorMessage,
  arcadeRank,
  buyListing,
  cancelListing,
  equipItem,
  fetchArcadeMatches,
  fetchArcadeProfile,
  fetchInventory,
  fetchListings,
  listItem,
  openCrate,
  type ArcadeItem,
  type ArcadeMatchRow,
  type InventoryEntry,
  type Listing,
} from "@/lib/arcade";

export function useArcadeData(userId: string | null) {
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [matches, setMatches] = useState<ArcadeMatchRow[]>([]);
  const [points, setPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) { setInventory([]); setListings([]); setMatches([]); setPoints(0); setLoading(false); return; }
    setLoading(true);
    try {
      const [inv, lst, mts, prof] = await Promise.all([
        fetchInventory(userId),
        fetchListings().catch(() => [] as Listing[]),
        fetchArcadeMatches(userId).catch(() => [] as ArcadeMatchRow[]),
        fetchArcadeProfile(userId),
      ]);
      setInventory(inv);
      setListings(lst);
      setMatches(mts);
      setPoints(prof.arcadePoints);
      setError(null);
    } catch (e) {
      setError(arcadeErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  return { inventory, listings, matches, points, loading, error, reload, setError };
}

export function RarityBadge({ item }: { item: ArcadeItem }) {
  const meta = RARITY_META[item.rarity] ?? RARITY_META.common;
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest ${meta.ring} ${meta.text}`}>
      {meta.label}
    </span>
  );
}

export function ItemCard({
  item,
  equipped,
  children,
}: {
  item: ArcadeItem;
  equipped?: boolean;
  children?: React.ReactNode;
}) {
  const meta = RARITY_META[item.rarity] ?? RARITY_META.common;
  return (
    <div className={`relative overflow-hidden rounded-xl border p-3 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_0_28px_-12px_var(--color-primary)] ${meta.ring}`}>
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-10" />
      <div className="relative flex items-start justify-between gap-2">
        <span className="text-3xl leading-none">{item.icon}</span>
        <RarityBadge item={item} />
      </div>
      <p className="relative mt-2 truncate font-display text-sm tracking-wider">{item.name}</p>
      <p className="relative text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {item.slot} · {item.valuePoints} pts
      </p>
      {equipped && (
        <p className="relative mt-1 inline-flex rounded border border-accent/50 bg-accent/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-accent">
          Nasazeno
        </p>
      )}
      {children && <div className="relative mt-2 flex flex-wrap gap-1.5">{children}</div>}
    </div>
  );
}

/** Arcade side of the dual profile — isolated from real sports stats. */
export function ArcadeProfile({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const { user } = useAuth();
  const data = useArcadeData(userId);
  const [busy, setBusy] = useState<string | null>(null);
  const [loot, setLoot] = useState<ArcadeItem | null>(null);
  const [priceDraft, setPriceDraft] = useState<Record<string, string>>({});

  const rank = arcadeRank(data.points);
  const wins = data.matches.filter((m) => m.winnerId === userId).length;
  const losses = data.matches.filter((m) => m.winnerId && m.winnerId !== userId).length;
  const equipped = useMemo(() => data.inventory.filter((i) => i.equipped), [data.inventory]);
  const pendingCrates = data.matches.filter((m) => m.winnerId === userId && !m.crateOpened);
  const myListings = data.listings.filter((l) => l.sellerId === userId);

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    try {
      await fn();
      await data.reload();
      data.setError(null);
    } catch (e) {
      data.setError(arcadeErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6">
      <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-background/60 p-4 backdrop-blur sm:p-5">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-15" />
        <div className="relative flex flex-wrap items-center gap-4">
          <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-primary/40 bg-primary/10 text-4xl">
            {equipped.find((e) => e.item.slot === "head")?.item.icon ?? "🙂"}
            <span className="absolute -bottom-1 -right-1 text-xl">
              {equipped.find((e) => e.item.slot === "aura" || e.item.slot === "back")?.item.icon ?? ""}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">// Arcade profil</p>
            <p className="font-display text-2xl tracking-wider text-primary neon-text sm:text-3xl">
              {rank.icon} {rank.label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">2D avatar podle nasazené kosmetiky</p>
          </div>
          <div className="ml-auto grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Arcade pts" value={data.points} icon={Coins} />
            <MiniStat label="Výhry" value={wins} icon={Swords} />
            <MiniStat label="Prohry" value={losses} icon={Gamepad2} />
          </div>
        </div>
        {data.error && <p className="relative mt-3 text-xs text-danger">{data.error}</p>}
      </section>

      {isSelf && pendingCrates.length > 0 && (
        <section className="mt-4 rounded-2xl border border-primary/40 bg-primary/[0.06] p-4">
          <p className="font-display text-lg tracking-wider text-primary">
            <PackageOpen className="mr-2 inline h-5 w-5" /> {pendingCrates.length}× nevybalená bedna
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pendingCrates.map((m) => (
              <button
                key={m.id}
                disabled={busy === m.id}
                onClick={() =>
                  run(m.id, async () => {
                    const item = await openCrate(m.id);
                    setLoot(item);
                  })
                }
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground shadow-[0_0_24px_-8px_var(--color-primary)] transition hover:scale-105 disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" /> Otevřít bednu ({m.scoreA}:{m.scoreB})
              </button>
            ))}
          </div>
          {loot && (
            <div className="loot-reveal mt-3 max-w-xs">
              <ItemCard item={loot} />
            </div>
          )}
        </section>
      )}

      <section className="mt-6">
        <h3 className="font-display text-lg tracking-[0.25em] text-primary/80 neon-text">
          <Boxes className="mr-2 inline h-5 w-5" /> INVENTÁŘ
        </h3>
        {data.loading ? (
          <p className="mt-3 text-sm text-muted-foreground">Načítám…</p>
        ) : data.inventory.length === 0 ? (
          <p className="mt-3 rounded-xl border border-primary/20 bg-background/50 p-4 text-sm text-muted-foreground">
            Žádné předměty. Vyhraj arcade zápas a otevři bednu.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.inventory.map((entry) => {
              const listed = data.listings.some((l) => l.inventoryId === entry.id);
              return (
                <ItemCard key={entry.id} item={entry.item} equipped={entry.equipped}>
                  {isSelf && !listed && (
                    <>
                      <button
                        disabled={busy === entry.id}
                        onClick={() => run(entry.id, () => equipItem(entry.id, !entry.equipped))}
                        className="rounded-md border border-primary/40 px-2 py-1 text-[10px] font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
                      >
                        {entry.equipped ? "Sundat" : "Nasadit"}
                      </button>
                      <span className="inline-flex items-center gap-1">
                        <input
                          value={priceDraft[entry.id] ?? ""}
                          onChange={(e) => setPriceDraft((p) => ({ ...p, [entry.id]: e.target.value.replace(/\D/g, "") }))}
                          placeholder={String(entry.item.valuePoints)}
                          inputMode="numeric"
                          className="w-14 rounded-md border border-border/60 bg-background/70 px-1.5 py-1 text-[10px] outline-none focus:border-primary/60"
                        />
                        <button
                          disabled={busy === entry.id}
                          onClick={() =>
                            run(entry.id, () =>
                              listItem(entry.id, Number(priceDraft[entry.id] || entry.item.valuePoints)),
                            )
                          }
                          className="rounded-md border border-accent/40 px-2 py-1 text-[10px] font-semibold text-accent transition hover:bg-accent/10 disabled:opacity-50"
                        >
                          <Tag className="inline h-3 w-3" /> Prodat
                        </button>
                      </span>
                    </>
                  )}
                  {isSelf && listed && (
                    <span className="rounded-md border border-primary/30 px-2 py-1 text-[10px] text-muted-foreground">V nabídce</span>
                  )}
                </ItemCard>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h3 className="font-display text-lg tracking-[0.25em] text-primary/80 neon-text">
          <ShoppingCart className="mr-2 inline h-5 w-5" /> MARKETPLACE
        </h3>
        {data.listings.length === 0 ? (
          <p className="mt-3 rounded-xl border border-primary/20 bg-background/50 p-4 text-sm text-muted-foreground">
            Žádné aktivní nabídky.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.listings.map((l) =>
              l.item ? (
                <ItemCard key={l.id} item={l.item}>
                  <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[10px] text-primary">
                    {l.price} pts
                  </span>
                  {user && l.sellerId === user.id ? (
                    <button
                      disabled={busy === l.id}
                      onClick={() => run(l.id, () => cancelListing(l.id))}
                      className="rounded-md border border-danger/40 px-2 py-1 text-[10px] text-danger transition hover:bg-danger/10 disabled:opacity-50"
                    >
                      Zrušit
                    </button>
                  ) : (
                    user && (
                      <button
                        disabled={busy === l.id}
                        onClick={() => run(l.id, () => buyListing(l.id))}
                        className="rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground transition hover:scale-105 disabled:opacity-50"
                      >
                        Koupit
                      </button>
                    )
                  )}
                </ItemCard>
              ) : null,
            )}
          </div>
        )}
        {isSelf && myListings.length > 0 && (
          <p className="mt-2 text-[11px] text-muted-foreground">Máš {myListings.length} aktivních nabídek.</p>
        )}
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-primary/25 bg-background/60 px-2 py-1.5">
      <Icon className="mx-auto h-3.5 w-3.5 text-primary/80" />
      <div className="font-display text-lg text-primary neon-text">{value}</div>
      <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
    </div>
  );
}
