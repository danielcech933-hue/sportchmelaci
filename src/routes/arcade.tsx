import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gamepad2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { FootballSlotGame } from "@/components/FootballSlotGame";
import { ArcadeProfile } from "@/components/ArcadeProfile";
import { RARITY_META, type Rarity } from "@/lib/arcade";

export const Route = createFileRoute("/arcade")({
  head: () => ({
    meta: [
      { title: "Community Arcade — Chmeloví Sportovci" },
      { name: "description", content: "Fotbalový slot, bedny s kosmetikou, inventář a marketplace za arcade body." },
      { property: "og:title", content: "Community Arcade — Chmeloví Sportovci" },
      {
        property: "og:description",
        content: "Fotbalový slot, bedny s kosmetikou, inventář a marketplace za arcade body.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArcadePage,
});

function ArcadePage() {
  const { user, loading } = useAuth();
  const [version] = useState(0);

  return (
    <main className="mx-auto max-w-6xl px-3 py-6 pb-28 sm:px-4 sm:py-10">
      <header className="relative overflow-hidden rounded-2xl border border-primary/30 bg-background/60 p-5 backdrop-blur">
        <div className="pointer-events-none absolute inset-0 grid-bg opacity-20" />
        <p className="relative inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">
          <Gamepad2 className="h-4 w-4" /> Community Arcade
        </p>
        <h1 className="relative mt-1 font-display text-3xl tracking-widest text-primary neon-text sm:text-5xl">
          FOOTBALL SLOT & LOOT
        </h1>
        <p className="relative mt-2 max-w-2xl text-sm text-muted-foreground">
          Zatoč si na fotbalovém automatu, získej body a bedny s kosmetikou a obchoduj na marketplace. Arcade body jsou
          zcela oddělené od reálných sportovních statistik a sázkového zůstatku.
        </p>
      </header>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Načítám…</p>
      ) : !user ? (
        <div className="mt-6 rounded-2xl border border-primary/25 bg-background/60 p-8 text-center backdrop-blur">
          <p className="text-sm text-muted-foreground">
            <Link to="/auth" className="text-primary hover:underline">
              Přihlas se
            </Link>
            , abys mohl hrát a sbírat loot.
          </p>
        </div>
      ) : (
        <>
          <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            {/* Zde je umístěn nový automat */}
            <div className="flex justify-center items-center rounded-2xl border border-primary/25 bg-background/60 p-4 backdrop-blur">
              <FootballSlotGame />
            </div>

            <aside className="space-y-3">
              <div className="rounded-2xl border border-primary/25 bg-background/60 p-4 backdrop-blur">
                <p className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">
                  <Sparkles className="h-3.5 w-3.5" /> Drop rate bedny
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {(Object.keys(RARITY_META) as Rarity[]).map((r) => (
                    <li key={r} className="flex items-center justify-between">
                      <span className={RARITY_META[r].text}>{RARITY_META[r].label}</span>
                      <span className="font-mono text-muted-foreground">{RARITY_META[r].chance}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </section>

          <div key={version} className="mt-6">
            <ArcadeProfile userId={user.id} isSelf />
          </div>
        </>
      )}
    </main>
  );
}
