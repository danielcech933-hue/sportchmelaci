import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Beer, Gamepad2, Layers, PackageOpen, Swords, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { FootballCard } from "@/components/FootballCard";
import { PackOpening } from "@/components/PackOpening";
import { SquadBuilder } from "@/components/SquadBuilder";
import { OnlineMatchLobby } from "@/components/OnlineMatchLobby";
import { SlotMachine } from "@/components/slots/SlotMachine";
import { cardsErrorMessage, fetchMyCards, fetchMyPacks, grantPack } from "@/lib/cards";
import type { OwnedCard, PackRow } from "@/types/cards";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/arcade")({
  head: () => ({
    meta: [
      { title: "FC 26 Arkáda — balíčky, sestava a online výzvy" },
      {
        name: "description",
        content:
          "Otevírej chibi FC 26 balíčky, stav sestavu s chemií a vyzvi ostatní na online zápas s fair play stropem ratingu.",
      },
      { property: "og:title", content: "FC 26 Arkáda — balíčky, sestava a online výzvy" },
      {
        property: "og:description",
        content: "Pack opening s walkouty, squad builder a online výzvy — plus slot Chmelovci Cup, ze kterého padají balíčky.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArcadePage,
});

const TABS = [
  { key: "packs", label: "Otevřít balíčky", icon: PackageOpen },
  { key: "squad", label: "Moje sestava", icon: Users },
  { key: "online", label: "Online zápasy", icon: Swords },
  { key: "slot", label: "Slot Chmelovci Cup", icon: Beer },
] as const;

function ArcadePage() {
  const { user, nickname, loading } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("packs");
  const [cards, setCards] = useState<OwnedCard[]>([]);
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reward, setReward] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const [c, p] = await Promise.all([fetchMyCards(user.id), fetchMyPacks(user.id)]);
      setCards(c);
      setPacks(p);
    } catch (e) {
      setError(cardsErrorMessage(e));
    }
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const onSlotWin = useCallback(
    async (multiplier: number) => {
      if (!user || multiplier < 10) return;
      try {
        await grantPack(multiplier >= 30 ? "promo" : "gold", "slot");
        setReward(multiplier >= 30 ? "Promo Pack získán ze slotu!" : "Gold Pack získán ze slotu!");
        await reload();
      } catch {
        /* limit balíčků – ignorovat */
      }
    },
    [user, reload],
  );

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 pb-32 sm:px-4 sm:py-10">
      <header className="relative overflow-hidden rounded-2xl border border-primary/30 bg-background/60 p-5 backdrop-blur">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
        <p className="relative inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">
          <Gamepad2 className="h-4 w-4" /> FC 26 Arkáda
        </p>
        <h1 className="relative mt-1 font-display text-3xl tracking-widest text-primary neon-text sm:text-5xl">
          CHIBI PACK OPENING
        </h1>
        <p className="relative mt-2 max-w-2xl text-sm text-muted-foreground">
          Sbírej chibi karty legend, otevírej balíčky s walkouty, poskládej sestavu s maximální chemií a vyzvi
          ostatní na online zápas s fair play stropem ratingu.
        </p>
      </header>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Načítám…</p>
      ) : !user ? (
        <div className="mt-6 rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur">
          <p className="text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">Přihlas se</Link>, abys mohl sbírat karty a hrát online.
          </p>
        </div>
      ) : (
        <>
          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em]",
                  tab === t.key
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/60 bg-background/50 text-muted-foreground",
                )}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </nav>

          {error && <p className="mt-3 text-xs text-danger">{error}</p>}
          {reward && <p className="mt-3 text-xs text-accent">{reward}</p>}

          <section className="mt-5 rounded-2xl border border-primary/20 bg-background/50 p-4 backdrop-blur">
            {tab === "packs" && (
              <div className="space-y-6">
                <PackOpening packs={packs} onOpened={reload} />
                <div>
                  <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">
                    <Layers className="h-3.5 w-3.5" /> Moje sbírka ({cards.length})
                  </p>
                  {cards.length ? (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {cards.map((c) => (
                        <FootballCard key={c.id} card={c.card} />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">Sbírka je prázdná.</p>
                  )}
                </div>
              </div>
            )}

            {tab === "squad" && <SquadBuilder userId={user.id} cards={cards} />}
            {tab === "online" && <OnlineMatchLobby userId={user.id} />}
            {tab === "slot" && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Výhra 10× a víc = Gold Pack, 30× a víc = Promo Pack. Balíčky najdeš v záložce „Otevřít balíčky“.
                </p>
                <SlotMachine playerName={nickname ?? "Hráč"} onWin={onSlotWin} />
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
