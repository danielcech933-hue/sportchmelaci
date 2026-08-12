import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Coins, Ticket, Sparkles, Layers, Shield } from "lucide-react";
import { CardSpinPanel } from "@/components/ut/CardSpinPanel";
import { CollectionBrowser } from "@/components/ut/CollectionBrowser";
import { fetchCollection, getClub, utErrorMessage } from "@/lib/ut";
import type { UtClub, UtOwnedCard } from "@/types/ut";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ultimate-team")({
  head: () => ({
    meta: [
      { title: "Ultimate Team — SportChmeláci fotbalové karty" },
      {
        name: "description",
        content:
          "Sbírej fotbalové karty, roztáčej Card Spin, spravuj svůj klub a buduj sestavu v Ultimate Teamu Chmelových Sportovců.",
      },
      { property: "og:title", content: "Ultimate Team — SportChmeláci fotbalové karty" },
      {
        property: "og:description",
        content: "Card Spin, 200+ karet, luck meter a vlastní klub — kompletní Ultimate Team zážitek.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UltimateTeamPage,
});

type Tab = "club" | "spin" | "collection";

function UltimateTeamPage() {
  const { user, loading } = useAuth();
  const [club, setClub] = useState<UtClub | null>(null);
  const [cards, setCards] = useState<UtOwnedCard[]>([]);
  const [tab, setTab] = useState<Tab>("club");
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const c = await getClub();
      setClub(c);
      setCards(await fetchCollection(user.id));
    } catch (e) {
      setError(utErrorMessage(e));
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) return null;

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl uppercase tracking-[0.14em] text-primary">Ultimate Team</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Přihlas se, ať si můžeš založit klub, roztočit Card Spin a sbírat karty.
        </p>
      </main>
    );
  }

  const tabs: Array<{ key: Tab; label: string; icon: typeof Shield }> = [
    { key: "club", label: "Můj klub", icon: Shield },
    { key: "spin", label: "Card Spin", icon: Sparkles },
    { key: "collection", label: "Sbírka", icon: Layers },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary/70">Ultimate Team</p>
          <h1 className="font-display text-3xl uppercase tracking-[0.12em] text-primary">
            {club?.clubName ?? "Můj klub"}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 font-mono text-amber-200">
            <Coins className="h-3.5 w-3.5" /> {club?.coins ?? 0}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-3 py-1.5 font-mono text-cyan-200">
            <Ticket className="h-3.5 w-3.5" /> {club?.spinTokens ?? 0}
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-primary">
            XP {club?.xp ?? 0}
          </span>
        </div>
      </header>

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      <nav className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em]",
              tab === t.key
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border/60 bg-background/50 text-muted-foreground",
            )}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </nav>

      <section className="mt-5">
        {tab === "club" && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Karty ve sbírce" value={cards.length} />
            <Stat label="Nejlepší rating" value={cards.reduce((a, c) => Math.max(a, c.card.rating), 0)} />
            <Stat label="Luck meter" value={club?.luckMeter ?? 0} />
            <div className="sm:col-span-3 rounded-2xl border border-primary/20 bg-background/50 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">Nejlepší hráči</p>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                {!cards.length && (
                  <p className="text-sm text-muted-foreground">Zatím prázdno — začni Card Spinem.</p>
                )}
                {cards.length > 0 && (
                  <ul className="flex gap-2">
                    {[...cards]
                      .sort((a, b) => b.card.rating - a.card.rating)
                      .slice(0, 12)
                      .map((c) => (
                        <li
                          key={c.id}
                          className="shrink-0 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs"
                        >
                          <span className="font-display text-base text-primary">{c.card.rating}</span>{" "}
                          <span className="font-mono uppercase text-muted-foreground">{c.card.position}</span>
                          <p className="max-w-[120px] truncate">{c.card.name}</p>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "spin" && club && (
          <CardSpinPanel
            club={club}
            onClubChange={(patch) => setClub((c) => (c ? { ...c, ...patch } : c))}
            onCardWon={() => void reload()}
          />
        )}

        {tab === "collection" && (
          <CollectionBrowser
            cards={cards}
            onChanged={() => void reload()}
            onCoins={(coins) => setClub((c) => (c ? { ...c, coins } : c))}
          />
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-background/50 p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">{label}</p>
      <p className="mt-1 font-display text-2xl text-primary">{value}</p>
    </div>
  );
}
