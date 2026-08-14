import { useCallback, useEffect, useState } from "react";
import { Coins, Ticket, Sparkles, Layers, Shield, Users, RefreshCw, Trophy } from "lucide-react";
import { CardSpinPanel } from "@/components/ut/CardSpinPanel";
import { CollectionBrowser } from "@/components/ut/CollectionBrowser";
import { SquadBuilder } from "@/components/ut/SquadBuilder";
import { FutSquadReadiness } from "@/components/ut/FutSquadReadiness";
import { FutMatchPanel } from "@/components/ut/FutMatchPanel";
import { FutMatchHistory } from "@/components/ut/FutMatchHistory";
import { FutProgressionPanel } from "@/components/ut/FutProgressionPanel";
import { fetchCollection, getClub, utErrorMessage } from "@/lib/ut";
import type { UtClub, UtOwnedCard } from "@/types/ut";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ultimate-team")({
  head: () => ({
    meta: [
      { title: "Ultimate Team — SportChmeláci fotbalové karty" },
      { name: "description", content: "Sbírej fotbalové karty, roztáčej Card Spin, spravuj svůj klub a buduj sestavu v Ultimate Teamu Chmelových Sportovců." },
      { property: "og:title", content: "Ultimate Team — SportChmeláci fotbalové karty" },
      { property: "og:description", content: "Card Spin, 200+ karet, luck meter a vlastní klub — kompletní Ultimate Team zážitek." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UltimateTeamPage,
});

type Tab = "club" | "squad" | "match" | "spin" | "collection";

function UltimateTeamPage() {
  const { user, loading } = useAuth();
  const [club, setClub] = useState<UtClub | null>(null);
  const [cards, setCards] = useState<UtOwnedCard[]>([]);
  const [tab, setTab] = useState<Tab>("club");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      setRefreshing(true);
      const [c, collection] = await Promise.all([getClub(), fetchCollection(user.id)]);
      setClub(c);
      setCards(collection);
      setError(null);
    } catch (e) {
      setError(utErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { void reload(); }, [reload]);

  if (loading) return null;
  if (!user) return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl uppercase tracking-[0.14em] text-primary">Ultimate Team</h1>
      <p className="mt-3 text-sm text-muted-foreground">Přihlas se, ať si můžeš založit klub, roztočit Card Spin a sbírat karty.</p>
    </main>
  );

  const tabs: Array<{ key: Tab; label: string; icon: typeof Shield }> = [
    { key: "club", label: "Můj klub", icon: Shield },
    { key: "squad", label: "Sestava", icon: Users },
    { key: "match", label: "FUT Match", icon: Trophy },
    { key: "spin", label: "Card Spin", icon: Sparkles },
    { key: "collection", label: "Sbírka", icon: Layers },
  ];
  const topCards = [...cards].sort((a, b) => b.card.rating - a.card.rating).slice(0, 12);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-6">
      <header className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-background/70 to-background/40 p-4 shadow-[0_18px_60px_-35px_hsl(var(--primary)/0.55)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-primary/70">Ultimate Team · Club Hub</p>
            <h1 className="mt-1 font-display text-3xl uppercase tracking-[0.12em] text-primary sm:text-4xl">{club?.clubName ?? "Můj klub"}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">Tvoje karty, mince, Card Spin a serverově uložená sestava na jednom místě.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-lg border border-amber-300/40 bg-amber-400/10 px-3 py-1.5 font-mono text-amber-200"><Coins className="h-3.5 w-3.5" /> {club?.coins ?? 0}</span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-cyan-300/40 bg-cyan-400/10 px-3 py-1.5 font-mono text-cyan-200"><Ticket className="h-3.5 w-3.5" /> {club?.spinTokens ?? 0}</span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-primary">XP {club?.xp ?? 0}</span>
            <button type="button" onClick={() => void reload()} disabled={refreshing} title="Obnovit klub a sbírku ze serveru" className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-50"><RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />{refreshing ? "Obnovuji" : "Synchronizovat"}</button>
          </div>
        </div>
      </header>

      {error && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger"><span>{error}</span><button type="button" onClick={() => void reload()} className="font-mono uppercase tracking-widest underline underline-offset-4">Zkusit znovu</button></div>}

      <nav className="mt-5 flex flex-wrap gap-2">
        {tabs.map((t) => <button key={t.key} onClick={() => setTab(t.key)} className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em]", tab === t.key ? "border-primary/60 bg-primary/15 text-primary" : "border-border/60 bg-background/50 text-muted-foreground")}><t.icon className="h-3.5 w-3.5" /> {t.label}</button>)}
      </nav>

      <section className="mt-5">
        {tab === "club" && <div className="space-y-4"><FutProgressionPanel /><div className="grid gap-3 sm:grid-cols-3"><Stat label="Karty ve sbírce" value={cards.length} /><Stat label="Nejlepší rating" value={cards.reduce((a, c) => Math.max(a, c.card.rating), 0)} /><Stat label="Luck meter" value={club?.luckMeter ?? 0} /></div><div className="rounded-3xl border border-primary/20 bg-background/50 p-4 sm:p-5"><div className="flex items-end justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/80">Klubová sbírka</p><h2 className="mt-1 font-display text-xl uppercase tracking-[0.08em]">Nejlepší hráči</h2></div><button type="button" onClick={() => setTab("collection")} className="font-mono text-[10px] uppercase tracking-widest text-primary hover:underline">Otevřít sbírku</button></div><div className="mt-4 flex gap-3 overflow-x-auto pb-2">{!topCards.length && <p className="text-sm text-muted-foreground">Zatím prázdno — začni Card Spinem.</p>}{topCards.map((c) => <button key={c.id} type="button" onClick={() => setTab("collection")} className="shrink-0 rounded-2xl border border-border/60 bg-background/60 p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40"><span className="font-display text-2xl text-primary">{c.card.rating}</span><span className="ml-2 font-mono text-[10px] uppercase text-muted-foreground">{c.card.position}</span><p className="mt-1 max-w-[120px] truncate text-sm font-medium">{c.card.name}</p><p className="mt-0.5 max-w-[120px] truncate text-[10px] text-muted-foreground">{c.card.club}</p></button>)}</div></div></div>}
        {tab === "squad" && <><FutSquadReadiness /><SquadBuilder cards={cards} /></>}
        {tab === "match" && <div className="space-y-4"><FutMatchPanel /><FutMatchHistory /></div>}
        {tab === "spin" && club && <CardSpinPanel club={club} onClubChange={(patch) => setClub((c) => (c ? { ...c, ...patch } : c))} onCardWon={() => void reload()} />}
        {tab === "collection" && <CollectionBrowser cards={cards} onChanged={() => void reload()} onCoins={(coins) => setClub((c) => (c ? { ...c, coins } : c))} />}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-primary/20 bg-background/50 p-4"><p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary/70">{label}</p><p className="mt-1 font-display text-2xl text-primary">{value}</p></div>;
}
