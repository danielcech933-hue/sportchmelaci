import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, ArrowRight, CalendarDays, ChevronRight, CircleDollarSign, Crown, Flame, Medal, , Trophy, Users, WalletCards } from "lucide-react";
import { CLASSIC_SPORTS, ESPORT_SPORTS, SPORTS, type Match, type SportConfig, type SportId } from "@/lib/matches";
import { fetchAllMatches } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";
import { SportBadge } from "@/components/SportBadge";
import { SportActionModal } from "@/components/SportActionModal";
import { SocialHub } from "@/components/SocialHub";
import matchdayHero from "@/assets/matchday-hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chmeloví Sportovci — Sportovní centrum" },
      { name: "description", content: "Živé zápasy, výsledky, turnaje, sporty a komunita Chmelových Sportovců." },
    ],
  }),
  component: Lobby,
});

type FeedFilter = "vše" | "živě" | "nadcházející" | "výsledky";

function Lobby() {
  const { user, nickname } = useAuth();
  const { userDollars, slotCZK } = useWallet();
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<FeedFilter>("vše");
  const [selectedSport, setSelectedSport] = useState<SportId | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await fetchAllMatches();
        if (!cancelled) setMatches(rows);
      } catch {
        if (!cancelled) setMatches([]);
      }
    };
    void load();
    const timer = window.setInterval(load, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const now = Date.now();
  const live = useMemo(() => matches.filter((m) => !m.endedAt && (m.scoreA > 0 || m.scoreB > 0 || m.sets.length > 0)).slice(0, 6), [matches]);
  const upcoming = useMemo(() => matches.filter((m) => !!m.scheduledAt && !m.endedAt && (m.scheduledAt ?? 0) >= now).sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0)).slice(0, 6), [matches, now]);
  const recent = useMemo(() => matches.filter((m) => !!m.endedAt).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)).slice(0, 6), [matches]);
  const featured = live[0] ?? upcoming[0] ?? recent[0] ?? null;
  const activeSports = useMemo(() => new Set(matches.map((m) => m.sport)).size, [matches]);
  const filtered = filter === "živě" ? live : filter === "nadcházející" ? upcoming : filter === "výsledky" ? recent : [...live, ...upcoming, ...recent].slice(0, 8);

  const isLive = (id: string) => live.some((item) => item.id === id);

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1400px] px-3 pb-32 pt-3 sm:px-5 sm:pt-5 lg:px-7">
      {/* HERO — compact, one message, two actions */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[#080c12]">
          <img src={matchdayHero} alt="Sportovní aréna" width={1400} height={1800} className="absolute inset-0 h-full w-full object-cover object-center opacity-55" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,7,11,.96)_0%,rgba(4,7,11,.75)_55%,rgba(4,7,11,.35)_100%)]" />
          <div className="relative flex min-h-[300px] flex-col justify-end p-6 sm:min-h-[340px] sm:p-9">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200/25 bg-black/40 px-3 py-1.5 text-xs font-semibold text-amber-100"><Flame className="h-3.5 w-3.5" /> Chmeloví Sportovci</span>
            <h1 className="mt-4 font-display text-5xl leading-[.9] tracking-[.04em] text-white sm:text-7xl">SPORT, <span className="gold-text">KTERÝ ŽIJE</span></h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">Živé zápasy, výsledky, turnaje a komunita na jednom místě.</p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link to="/activity" className="aaa-cta inline-flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-[.14em]"><Activity className="h-4 w-4" /> Živé dění <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/schedule" className="aaa-ghost inline-flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-[.14em]"><CalendarDays className="h-4 w-4" /> Program</Link>
            </div>
          </div>
        </article>

        <aside className="rounded-3xl border border-white/10 bg-[linear-gradient(160deg,rgba(24,24,22,.95),rgba(9,13,18,.98))] p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-amber-200/25 bg-amber-200/10 font-display text-2xl text-amber-100">{nickname?.slice(0, 2).toUpperCase() ?? "CH"}</div>
            <div className="min-w-0 flex-1"><div className="truncate font-display text-2xl tracking-[.06em] text-white">{nickname ?? "Host"}</div><div className="text-xs text-white/55">{user ? "Přihlášený hráč" : "Nepřihlášen"}</div></div>
            <Crown className="h-5 w-5 text-amber-200/80" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2"><StatTile label="Sportovní dolary" value={`$${userDollars.toFixed(0)}`} icon={<WalletCards className="h-4 w-4" />} /><StatTile label="Herní kredit" value={slotCZK.toLocaleString("cs-CZ")} icon={<CircleDollarSign className="h-4 w-4" />} /></div>
          <div className="mt-2 grid grid-cols-3 gap-2"><MiniStat label="Živě" value={live.length} tone="text-cyan-200" /><MiniStat label="Další" value={upcoming.length} tone="text-amber-100" /><MiniStat label="Sporty" value={activeSports} tone="text-emerald-200" /></div>
          <div className="mt-4 grid grid-cols-2 gap-2"><Link to={user ? "/profile" : "/auth"} className="aaa-ghost flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold">{user ? "Můj profil" : "Přihlásit"} <ChevronRight className="h-4 w-4" /></Link><Link to="/community" className="aaa-ghost flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold">Komunita <ChevronRight className="h-4 w-4" /></Link></div>
        </aside>
      </section>

      {/* MATCHES — the main content, directly under the hero */}
      <section className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-3xl border border-white/10 bg-[rgba(12,17,23,.85)]">
          <div className="flex flex-col gap-3 border-b border-white/8 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <SectionHead eyebrow="Přehled" title="Zápasy" />
            <div role="tablist" aria-label="Filtr zápasů" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-white/8 bg-black/25 p-1 [scrollbar-width:none]">
              {(["vše", "živě", "nadcházející", "výsledky"] as FeedFilter[]).map((item) => <button key={item} type="button" role="tab" aria-selected={filter === item} onClick={() => setFilter(item)} className={`shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold capitalize transition ${filter === item ? "bg-amber-200/15 text-amber-100" : "text-white/55 hover:text-white"}`}>{item}{item === "živě" && live.length > 0 ? ` · ${live.length}` : ""}</button>)}
            </div>
          </div>
          <div className="grid gap-2 p-3 sm:p-4 xl:grid-cols-2">{filtered.length ? filtered.map((match) => <MatchRow key={`${match.id}-${match.startedAt}-${match.endedAt ?? ""}`} match={match} live={isLive(match.id)} />) : <div className="xl:col-span-2"><EmptyState text="Teď tu není žádný zápas." action={<Link to="/schedule" className="aaa-ghost inline-flex px-4 py-2 text-xs font-bold">Otevřít program</Link>} /></div>}</div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-3xl border border-white/10 bg-[rgba(12,17,23,.85)] p-4 sm:p-5">
            <SectionHead eyebrow="V centru pozornosti" title="Hlavní zápas" />
            {featured ? <Link to="/match" search={{ id: featured.id }} className="mt-4 block rounded-2xl border border-amber-200/15 bg-black/30 p-4 transition hover:border-amber-200/35">
              <div className="flex items-center justify-between gap-2"><SportBadge sport={featured.sport} /><StatusPill status={isLive(featured.id) ? "live" : featured.endedAt ? "done" : "next"} /></div>
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="min-w-0 truncate font-display text-xl tracking-[.04em] text-white">{featured.teamA}</div>
                <div className="font-mono text-2xl font-black text-amber-100">{featured.scoreA}:{featured.scoreB}</div>
                <div className="min-w-0 truncate text-right font-display text-xl tracking-[.04em] text-white">{featured.teamB}</div>
              </div>
            </Link> : <div className="mt-4"><EmptyState text="Až začne další zápas, objeví se tady." /></div>}
          </div>
          <div className="rounded-3xl border border-white/10 bg-[rgba(12,17,23,.85)] p-4 sm:p-5">
            <SectionHead eyebrow="Rychlé cesty" title="Kam dál" />
            <div className="mt-4 grid gap-2"><QuickLink to="/rankings" title="Žebříček" description="Pořadí a forma hráčů" icon={<Medal className="h-4 w-4" />} /><QuickLink to="/tournaments" title="Turnaje" description="Pavouky a finále" icon={<Trophy className="h-4 w-4" />} /><QuickLink to="/teams" title="Týmy" description="Sestavy a 2v2" icon={<Users className="h-4 w-4" />} /><QuickLink to="/bets" title="Sázky" description="Kurzy a tikety" icon={<CircleDollarSign className="h-4 w-4" />} /></div>
          </div>
        </div>
      </section>

      {/* SPORTS */}
      <section className="mt-6 rounded-3xl border border-white/10 bg-[rgba(12,17,23,.85)] p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><SectionHead eyebrow="Sporty" title="Vyber si sport" /><Link to="/sport-center" className="aaa-ghost inline-flex w-fit items-center gap-2 px-4 py-2.5 text-xs font-bold">Všechny sporty <ArrowRight className="h-4 w-4" /></Link></div>
        <div className="mt-5 space-y-6"><SportCluster label="Klasické sporty" sports={CLASSIC_SPORTS} onPick={setSelectedSport} /><SportCluster label="Esporty" sports={ESPORT_SPORTS} onPick={setSelectedSport} /></div>
      </section>

      {/* COMMUNITY */}
      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3 px-1"><SectionHead eyebrow="Komunita" title="Příběhy a feed" /><Link to="/community" className="aaa-ghost inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold">Otevřít <ArrowRight className="h-4 w-4" /></Link></div>
        <div className="rounded-3xl border border-white/10 bg-[rgba(12,17,23,.85)] p-2 sm:p-3"><SocialHub compact /></div>
      </section>

      {selectedSport && <SportActionModal sport={selectedSport} onClose={() => setSelectedSport(null)} />}
    </main>
  );
}

function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-[.16em] text-amber-100/70">{eyebrow}</div><h2 className="mt-0.5 truncate font-display text-2xl tracking-[.06em] text-white sm:text-3xl">{title}</h2></div>;
}

function StatusPill({ status }: { status: "live" | "next" | "done" }) {
  const map = { live: ["Živě", "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"], next: ["Nadcházející", "border-amber-200/30 bg-amber-200/10 text-amber-100"], done: ["Konec", "border-white/15 bg-white/5 text-white/65"] } as const;
  const [label, cls] = map[status];
  return <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[.1em] ${cls}`}>{status === "live" && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />}{label}</span>;
}

function MatchRow({ match, live }: { match: Match; live: boolean }) {
  const when = match.scheduledAt ? new Date(match.scheduledAt) : null;
  const status = live ? "live" : match.endedAt ? "done" : "next";
  const showScore = live || !!match.endedAt || !when;
  return <Link to="/match" search={{ id: match.id }} className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-black/25 p-3 transition hover:border-amber-200/30 hover:bg-white/[.03] sm:p-3.5">
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04]"><SportBadge sport={match.sport} /></div>
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-bold text-white sm:text-base">{match.teamA} <span className="font-normal text-white/40">vs</span> {match.teamB}</div>
      <div className="mt-0.5 truncate text-xs text-white/55">{SPORTS[match.sport]?.name ?? match.sport} · {match.matchFormat === "2v2" ? "2v2" : "1v1"}</div>
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className={`font-mono font-black ${showScore ? "text-lg text-amber-100" : "text-xs text-white/80"}`}>{showScore ? `${match.scoreA}:${match.scoreB}` : when!.toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
      <StatusPill status={status} />
    </div>
  </Link>;
}

function StatTile({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><div className="flex items-center gap-1.5 text-amber-100/75">{icon}<span className="truncate text-[11px] font-semibold">{label}</span></div><div className="mt-1 font-display text-xl tracking-[.04em] text-white">{value}</div></div>;
}

function MiniStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-xl border border-white/10 bg-black/25 p-2.5 text-center"><div className={`font-display text-2xl ${tone}`}>{value}</div><div className="text-[11px] font-semibold text-white/55">{label}</div></div>;
}

function QuickLink({ to, title, description, icon }: { to: string; title: string; description: string; icon: ReactNode }) {
  return <Link to={to} className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-black/25 p-3 transition hover:border-amber-200/30"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-200/20 bg-amber-200/10 text-amber-100">{icon}</div><div className="min-w-0 flex-1"><div className="text-sm font-bold text-white">{title}</div><div className="truncate text-xs text-white/55">{description}</div></div><ChevronRight className="h-4 w-4 text-white/35 group-hover:text-amber-100" /></Link>;
}

function SportCluster({ label, sports, onPick }: { label: string; sports: SportConfig[]; onPick: (id: SportId) => void }) {
  return <div><div className="mb-2.5 flex items-center gap-2 text-sm font-semibold text-white/80">{label}<span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-white/60">{sports.length}</span></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{sports.map((sport) => <button key={sport.id} type="button" onClick={() => onPick(sport.id)} className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-black/25 p-3 text-left transition hover:border-amber-200/30 hover:bg-white/[.03]"><span className="text-2xl transition group-hover:scale-110">{sport.emoji}</span><span className="min-w-0 truncate text-sm font-bold text-white">{sport.name}</span></button>)}</div></div>;
}

function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/12 bg-black/20 px-4 py-10 text-center text-sm text-white/60">{text}{action}</div>;
}
