import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Coins,
  Crown,
  Database,
  Layers,
  RefreshCw,
  Shield,
  Sparkles,
  Swords,
  Target,
  Ticket,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import { CardSpinPanel } from "@/components/ut/CardSpinPanel";
import { CollectionBrowser } from "@/components/ut/CollectionBrowser";
import { CardCatalog } from "@/components/ut/CardCatalog";
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
      { title: "Ultimate Team — SportChmeláci" },
      { name: "description", content: "Spravuj klub, buduj sestavu, sbírej fotbalové karty, používej Card Spin a hraj FUT zápasy v prémiovém Ultimate Team hubu." },
      { property: "og:title", content: "Ultimate Team — SportChmeláci" },
      { property: "og:description", content: "Klub, sestava, karty, Card Spin, progres a online zápasy na jednom místě." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UltimateTeamPage,
});

type Tab = "club" | "squad" | "match" | "spin" | "collection" | "catalog";
type TabDef = { key: Tab; label: string; icon: typeof Shield; eyebrow: string };

const TABS: TabDef[] = [
  { key: "club", label: "Klub", icon: Shield, eyebrow: "CLUB HQ" },
  { key: "squad", label: "Sestava", icon: Users, eyebrow: "SQUAD" },
  { key: "match", label: "FUT Match", icon: Trophy, eyebrow: "MATCH" },
  { key: "spin", label: "Card Spin", icon: Sparkles, eyebrow: "SPIN" },
  { key: "collection", label: "Sbírka", icon: Layers, eyebrow: "COLLECTION" },
  { key: "catalog", label: "Katalog", icon: Database, eyebrow: "CATALOG" },
];

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
      const [nextClub, collection] = await Promise.all([getClub(), fetchCollection(user.id)]);
      setClub(nextClub);
      setCards(collection);
      setError(null);
    } catch (e) {
      setError(utErrorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (loading) return <UltimateSkeleton />;

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 pb-28">
        <section className="relative overflow-hidden rounded-[30px] border border-primary/20 bg-gradient-to-br from-primary/15 via-background/80 to-background p-7 shadow-[0_30px_100px_-55px_hsl(var(--primary)/0.5)] sm:p-10">
          <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative">
            <span className="font-mono text-[9px] font-black uppercase tracking-[0.34em] text-primary/80">ULTIMATE TEAM · CLUB HQ</span>
            <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.12em] text-foreground sm:text-6xl">POSTAV SVŮJ KLUB</h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Přihlas se a spravuj sestavu, sbírej karty, otáčej Card Spin a vstupuj do online FUT zápasů.</p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-4 py-2.5 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-primary"><Shield className="h-4 w-4" /> Vyžaduje přihlášení</div>
          </div>
        </section>
      </main>
    );
  }

  const topCards = useMemo(() => [...cards].sort((a, b) => b.card.rating - a.card.rating).slice(0, 8), [cards]);
  const bestRating = cards.reduce((best, owned) => Math.max(best, owned.card.rating), 0);
  const collectionPower = cards.reduce((sum, owned) => sum + owned.card.rating, 0);
  const level = Math.max(1, Math.floor((club?.xp ?? 0) / 1000) + 1);
  const currentTab = TABS.find((item) => item.key === tab) ?? TABS[0];
  const CurrentIcon = currentTab.icon;

  return (
    <main className="mx-auto max-w-7xl px-3 pb-28 pt-4 sm:px-5 sm:pt-6">
      <div className="relative overflow-hidden rounded-[34px] border border-primary/20 bg-[#060a10] shadow-[0_38px_120px_-60px_hsl(var(--primary)/0.55)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_84%_15%,hsl(var(--primary)/0.20),transparent_22%),radial-gradient(circle_at_10%_100%,rgba(45,197,255,.08),transparent_24%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:28px_28px]" />
        <section className="relative z-10 p-4 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[0.2em] text-primary"><Crown className="h-3.5 w-3.5" /> ULTIMATE TEAM</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/8 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[0.2em] text-emerald-300"><Zap className="h-3.5 w-3.5" /> SERVER SAVED</span>
              </div>
              <h1 className="mt-3 font-display text-4xl uppercase tracking-[0.11em] text-white sm:text-6xl">{club?.clubName ?? "MŮJ KLUB"}</h1>
              <p className="mt-2 text-sm leading-relaxed text-white/45 sm:text-base">Jeden přehled pro klub, XI, karty, progres, Card Spin a online zápasy.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[460px]">
              <HudStat icon={<Coins />} label="Coins" value={club?.coins ?? 0} tone="gold" />
              <HudStat icon={<Ticket />} label="Spin" value={club?.spinTokens ?? 0} tone="cyan" />
              <HudStat icon={<Target />} label="Level" value={level} tone="primary" />
              <HudStat icon={<Shield />} label="Best OVR" value={bestRating || "—"} tone="green" />
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><p className="font-mono text-[8px] font-black uppercase tracking-[0.3em] text-white/35">AKTUÁLNÍ SEKCE</p><div className="mt-1 flex items-center gap-2"><CurrentIcon className="h-4 w-4 text-primary" /><span className="font-display text-xl uppercase tracking-[0.09em] text-white">{currentTab.label}</span><span className="rounded-md border border-white/8 bg-white/[0.03] px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[0.16em] text-white/35">{currentTab.eyebrow}</span></div></div>
                <button type="button" onClick={() => void reload()} disabled={refreshing} title="Synchronizovat klub se serverem" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-[9px] font-black uppercase tracking-[0.18em] text-white/50 transition hover:border-primary/30 hover:text-primary disabled:opacity-50"><RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />{refreshing ? "Synchronizuji" : "Sync"}</button>
              </div>
            </div>
            <div className="rounded-2xl border border-primary/15 bg-primary/[0.035] p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[8px] font-black uppercase tracking-[0.28em] text-primary/65">TEAM POWER</p><p className="mt-1 font-display text-2xl tracking-[0.08em] text-white">{collectionPower.toLocaleString("cs-CZ")}</p></div><Swords className="h-6 w-6 text-primary/60" /></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/6"><div className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-300 to-primary" style={{ width: `${Math.min(100, cards.length ? Math.max(8, (collectionPower / Math.max(1, cards.length * 100)) * 100) : 8)}%` }} /></div>
              <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.15em] text-white/30">Síla sbírky · {cards.length} karet</p>
            </div>
          </div>
        </section>

        <nav className="relative z-20 border-t border-white/8 bg-black/25 px-3 py-3 backdrop-blur-xl sm:px-5">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.key;
              return <button key={item.key} type="button" onClick={() => setTab(item.key)} aria-current={active ? "page" : undefined} className={cn("group inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-left transition sm:px-4", active ? "border-primary/45 bg-primary/12 text-primary shadow-[0_12px_30px_-18px_hsl(var(--primary)/0.9)]" : "border-white/8 bg-white/[0.02] text-white/45 hover:border-white/15 hover:bg-white/[0.04] hover:text-white")}><Icon className={cn("h-4 w-4", active ? "text-primary" : "text-white/30")} /><span><span className="block font-mono text-[7px] font-black uppercase tracking-[0.16em] opacity-55">{item.eyebrow}</span><span className="block font-display text-sm uppercase tracking-[0.06em]">{item.label}</span></span></button>;
            })}
          </div>
        </nav>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.section key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="mt-5">
          {error && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-xs text-red-200"><span>{error}</span><button type="button" onClick={() => void reload()} className="font-mono text-[9px] font-black uppercase tracking-[0.16em] underline underline-offset-4">Zkusit znovu</button></div>}
          {tab === "club" && <div className="space-y-4"><FutProgressionPanel /><div className="grid gap-3 sm:grid-cols-3"><StatCard icon={<Layers />} label="Karty ve sbírce" value={cards.length} hint="Vlastněné položky" /><StatCard icon={<Trophy />} label="Nejlepší rating" value={bestRating || "—"} hint="Top OVR karty" /><StatCard icon={<Sparkles />} label="Luck meter" value={club?.luckMeter ?? 0} hint="Spin bonus" /></div><section className="rounded-[28px] border border-white/8 bg-[#070b11] p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[8px] font-black uppercase tracking-[0.28em] text-primary/65">CURATED XI</p><h2 className="mt-1 font-display text-2xl uppercase tracking-[0.08em] text-white">Nejlepší karty</h2></div><button type="button" onClick={() => setTab("collection")} className="inline-flex items-center gap-1 font-mono text-[9px] font-black uppercase tracking-[0.16em] text-primary hover:text-white">Otevřít sbírku <ArrowUpRight className="h-3.5 w-3.5" /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{topCards.length === 0 ? <EmptyCard onGo={() => setTab("spin")} /> : topCards.map((owned) => <FeaturedCard key={owned.id} card={owned.card} onOpen={() => setTab("collection")} />)}</div></section></div>}
          {tab === "squad" && <div className="space-y-4"><FutSquadReadiness /><SquadBuilder cards={cards} /></div>}
          {tab === "match" && <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]"><FutMatchPanel /><FutMatchHistory /></div>}
          {tab === "spin" && club && <CardSpinPanel club={club} onClubChange={(patch) => setClub((current) => (current ? { ...current, ...patch } : current))} onCardWon={() => void reload()} />}
          {tab === "collection" && <CollectionBrowser cards={cards} onChanged={() => void reload()} onCoins={(coins) => setClub((current) => (current ? { ...current, coins } : current))} />}
          {tab === "catalog" && <CardCatalog />}
        </motion.section>
      </AnimatePresence>
    </main>
  );
}

function HudStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone: "gold" | "cyan" | "primary" | "green" }) {
  const toneClass = { gold: "text-amber-200 border-amber-300/15 bg-amber-300/[0.04]", cyan: "text-cyan-200 border-cyan-300/15 bg-cyan-300/[0.04]", primary: "text-primary border-primary/15 bg-primary/[0.04]", green: "text-emerald-200 border-emerald-300/15 bg-emerald-300/[0.04]" }[tone];
  return <div className={cn("rounded-2xl border p-3", toneClass)}><div className="flex items-center gap-1.5 font-mono text-[7px] font-black uppercase tracking-[0.18em] opacity-55"><span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>{label}</div><div className="mt-1 font-display text-lg tracking-[0.06em]">{typeof value === "number" ? value.toLocaleString("cs-CZ") : value}</div></div>;
}

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string | number; hint: string }) {
  return <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025] p-4"><div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-primary/10 blur-2xl" /><div className="relative flex items-center gap-2"><span className="text-primary/70 [&>svg]:h-4 [&>svg]:w-4">{icon}</span><span className="font-mono text-[8px] font-black uppercase tracking-[0.22em] text-white/40">{label}</span></div><p className="relative mt-2 font-display text-3xl tracking-[0.04em] text-white">{typeof value === "number" ? value.toLocaleString("cs-CZ") : value}</p><p className="relative mt-1 text-[10px] text-white/25">{hint}</p></div>;
}

function FeaturedCard({ card, onOpen }: { card: UtOwnedCard["card"]; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="group relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.055] to-white/[0.015] p-3 text-left transition hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_25px_60px_-35px_hsl(var(--primary)/0.75)]"><div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,hsl(var(--primary)/0.16),transparent_30%)] opacity-70" /><div className="relative flex items-start justify-between gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-black/30 font-display text-xl text-primary">{card.rating}</div><span className="rounded-full border border-white/10 bg-black/25 px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[0.14em] text-white/40">{card.position}</span></div><div className="relative mt-3"><p className="truncate font-display text-lg uppercase tracking-[0.05em] text-white">{card.name}</p><p className="mt-1 truncate text-[10px] text-white/35">{card.club}</p></div><div className="relative mt-3 grid grid-cols-3 gap-1.5 text-center">{[["PAC", card.pac], ["SHO", card.sho], ["PAS", card.pas]].map(([name, value]) => <div key={String(name)} className="rounded-lg border border-white/8 bg-black/20 px-2 py-1.5"><div className="font-mono text-[6px] font-black tracking-[0.14em] text-white/25">{name}</div><div className="font-mono text-[10px] font-black text-white/70">{value}</div></div>)}</div></button>;
}

function EmptyCard({ onGo }: { onGo: () => void }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.015] p-10 text-center sm:col-span-2 lg:col-span-4"><Sparkles className="h-8 w-8 text-primary/45" /><p className="mt-3 font-display text-lg uppercase tracking-[0.08em] text-white/80">Sbírka je zatím prázdná</p><p className="mt-1 max-w-sm text-xs text-white/30">Začni Card Spinem a vybuduj si první tým.</p><button type="button" onClick={onGo} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-mono text-[9px] font-black uppercase tracking-[0.17em] text-primary-foreground">Otevřít Card Spin <ArrowUpRight className="h-3.5 w-3.5" /></button></div>;
}

function UltimateSkeleton() {
  return <main className="mx-auto max-w-7xl px-3 pb-28 pt-4 sm:px-5 sm:pt-6"><div className="animate-pulse rounded-[34px] border border-white/8 bg-[#070b11] p-5 sm:p-7"><div className="h-4 w-32 rounded bg-white/10" /><div className="mt-4 h-12 w-72 max-w-full rounded bg-white/10" /><div className="mt-3 h-4 w-full max-w-xl rounded bg-white/8" /><div className="mt-6 grid gap-3 sm:grid-cols-4"><div className="h-20 rounded-2xl bg-white/6" /><div className="h-20 rounded-2xl bg-white/6" /><div className="h-20 rounded-2xl bg-white/6" /><div className="h-20 rounded-2xl bg-white/6" /></div><div className="mt-6 h-14 rounded-2xl bg-white/6" /></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="h-32 rounded-2xl bg-white/5" /><div className="h-32 rounded-2xl bg-white/5" /><div className="h-32 rounded-2xl bg-white/5" /></div></main>;
}
