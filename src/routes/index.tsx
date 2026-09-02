import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, ArrowRight, CalendarDays, ChevronRight, CircleDollarSign, Crown, Flame, Medal, Radio, ShieldCheck, Sparkles, Trophy, Users, WalletCards, Zap } from "lucide-react";
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

  return (
    <main className="relative z-10 mx-auto w-full max-w-[1540px] px-3 pb-32 pt-3 sm:px-5 sm:pt-5 lg:px-7">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.62fr)_350px]">
        <article className="group relative min-h-[520px] overflow-hidden rounded-[28px] border border-amber-200/20 bg-[#080c12] shadow-[0_40px_120px_-70px_rgba(225,184,77,.42)] sm:min-h-[580px]">
          <img src={matchdayHero} alt="Sportovní arena" width={1400} height={1800} className="absolute inset-0 h-full w-full object-cover object-center opacity-75 transition duration-700 group-hover:scale-[1.015]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,7,11,.18)_0%,rgba(4,7,11,.34)_32%,rgba(4,7,11,.97)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,rgba(225,184,77,.18),transparent_24%),radial-gradient(circle_at_18%_35%,rgba(37,216,234,.08),transparent_25%)]" />
          <div className="relative flex h-full min-h-[520px] flex-col justify-between p-5 sm:min-h-[580px] sm:p-8 lg:p-10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-black/35 px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[.18em] text-amber-100 backdrop-blur-md"><Flame className="h-3.5 w-3.5" /> Sportovní centrum</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/5 px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[.18em] text-cyan-100/80 backdrop-blur-md"><Radio className="h-3.5 w-3.5" /> Realtime</span>
              </div>
              <span className="hidden rounded-full border border-white/10 bg-black/30 px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[.2em] text-white/55 backdrop-blur-md sm:inline-flex">DNES</span>
            </div>
            <div className="max-w-3xl">
              <div className="font-mono text-[9px] font-black uppercase tracking-[.3em] text-amber-100/65">CHMELOVÍ SPORTOVCI</div>
              <h1 className="mt-3 font-display text-[4.6rem] leading-[.78] tracking-[.055em] text-white sm:text-[7.2rem] lg:text-[8.4rem]">SPORT,<br /><span className="gold-text">KTERÝ ŽIJE</span></h1>
              <p className="mt-5 max-w-2xl text-sm font-semibold leading-6 text-white/58 sm:text-base">Sleduj zápasy živě, najdi další výzvu, prohlédni výsledky a zůstaň součástí komunity sportovců.</p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link to="/activity" className="aaa-cta inline-flex items-center gap-2 px-5 py-3 text-[9px] font-black uppercase tracking-[.18em]"><Activity className="h-4 w-4" /> Živé dění <ArrowRight className="h-3.5 w-3.5" /></Link>
                <Link to="/schedule" className="aaa-ghost inline-flex items-center gap-2 px-5 py-3 text-[9px] font-black uppercase tracking-[.18em]"><CalendarDays className="h-4 w-4" /> Program</Link>
              </div>
            </div>
          </div>
        </article>

        <aside className="relative overflow-hidden rounded-[28px] border border-amber-200/16 bg-[linear-gradient(150deg,rgba(26,25,23,.96),rgba(9,13,18,.98))] p-5 shadow-[0_30px_100px_-65px_rgba(225,184,77,.35)] sm:p-6">
          <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 rounded-full bg-amber-200/8 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between"><div className="font-mono text-[8px] font-black uppercase tracking-[.25em] text-amber-100/55">TVŮJ PŘEHLED</div><Crown className="h-5 w-5 text-amber-200/80" /></div>
            <div className="mt-7 flex items-center gap-3">
              <div className="grid h-16 w-16 place-items-center rounded-2xl border border-amber-200/20 bg-amber-200/8 font-display text-2xl text-amber-100">{nickname?.slice(0, 2).toUpperCase() ?? "CH"}</div>
              <div className="min-w-0"><div className="truncate font-display text-2xl tracking-[.1em] text-white">{nickname ?? "HOST"}</div><div className="mt-1 font-mono text-[8px] uppercase tracking-[.2em] text-white/38">{user ? "AKTIVNÍ HRÁČ" : "VEŘEJNÁ LOBBY"}</div></div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2"><StatTile label="SPORTOVNÍ DOLARY" value={`$${userDollars.toFixed(0)}`} icon={<WalletCards className="h-3.5 w-3.5" />} /><StatTile label="HERNÍ KREDIT" value={slotCZK.toLocaleString("cs-CZ")} icon={<CircleDollarSign className="h-3.5 w-3.5" />} /></div>
            <div className="mt-2 grid grid-cols-3 gap-2"><MiniStat label="ŽIVĚ" value={live.length} /><MiniStat label="DALŠÍ" value={upcoming.length} /><MiniStat label="SPORTY" value={activeSports} /></div>
            <div className="mt-6 rounded-2xl border border-white/8 bg-black/20 p-3.5"><div className="flex items-center justify-between"><span className="font-mono text-[8px] font-black uppercase tracking-[.22em] text-white/38">DALŠÍ KROK</span><Zap className="h-4 w-4 text-cyan-200/70" /></div><div className="mt-2 font-display text-xl tracking-[.08em] text-white">PŘIPRAV SE NA DALŠÍ VÝZVU</div><p className="mt-1.5 text-xs leading-5 text-white/36">Prohlédni plán, najdi spoluhráče nebo zkontroluj formu soupeřů.</p></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><Link to={user ? "/profile" : "/auth"} className="aaa-ghost flex items-center justify-center gap-1.5 px-3 py-2.5 text-[8px] font-black uppercase tracking-[.15em]">Profil <ChevronRight className="h-3.5 w-3.5" /></Link><Link to="/community" className="aaa-ghost flex items-center justify-center gap-1.5 px-3 py-2.5 text-[8px] font-black uppercase tracking-[.15em]">Komunita <ChevronRight className="h-3.5 w-3.5" /></Link></div>
          </div>
        </aside>
      </section>

      <section className="mt-4 grid gap-2 sm:grid-cols-4">
        <MetricCard icon={<Radio className="h-4 w-4" />} label="ŽIVÁ DATA" value={live.length} detail="zápasů právě probíhá" tone="cyan" />
        <MetricCard icon={<CalendarDays className="h-4 w-4" />} label="PROGRAM" value={upcoming.length} detail="dalších zápasů" />
        <MetricCard icon={<Trophy className="h-4 w-4" />} label="SPORTOVNÍ SVĚT" value={activeSports} detail="aktivních sportů" />
        <MetricCard icon={<Users className="h-4 w-4" />} label="KOMUNITA" value="ONLINE" detail="hráči · feed · stories" tone="green" />
      </section>

      <section className="mt-5 overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,25,33,.74),rgba(8,12,17,.92))] shadow-[0_30px_100px_-80px_rgba(37,216,234,.2)]">
        <div className="border-b border-white/7 px-4 py-4 sm:px-5"><div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><div className="font-mono text-[8px] font-black uppercase tracking-[.26em] text-cyan-100/55">CENTRÁLNÍ PANEL</div><div className="mt-1 font-display text-3xl tracking-[.1em] text-white">ZÁPASY</div></div><div className="flex max-w-full gap-1 overflow-x-auto [scrollbar-width:none]">{(["vše", "živě", "nadcházející", "výsledky"] as FeedFilter[]).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`shrink-0 rounded-full border px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.15em] transition ${filter === item ? "border-amber-200/35 bg-amber-200/10 text-amber-100" : "border-white/7 bg-black/15 text-white/34 hover:text-white/70"}`}>{item}</button>)}</div></div></div>
        <div className="grid gap-2 p-3 sm:p-4 lg:grid-cols-2">{filtered.length ? filtered.map((match) => <MatchRow key={`${match.id}-${match.startedAt}-${match.endedAt ?? ""}`} match={match} live={live.some((item) => item.id === match.id)} />) : <EmptyState text="Teď tu není žádný zápas." />}</div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,.6fr)]">
        <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(145deg,rgba(19,25,33,.82),rgba(7,11,16,.94))] p-4 sm:p-5"><div className="flex items-end justify-between gap-3"><div><div className="font-mono text-[8px] font-black uppercase tracking-[.26em] text-amber-100/55">HLAVNÍ ZÁPAS</div><div className="mt-1 font-display text-3xl tracking-[.1em] text-white">V CENTRU POZORNOSTI</div></div>{featured && <Link to="/match" search={{ id: featured.id }} className="font-mono text-[8px] font-black uppercase tracking-[.16em] text-amber-100/55 hover:text-amber-100">Otevřít zápas →</Link>}</div>{featured ? <Link to="/match" search={{ id: featured.id }} className="mt-4 block rounded-2xl border border-amber-200/12 bg-black/25 p-4 transition hover:-translate-y-0.5 hover:border-amber-200/28 sm:p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className={`rounded-full border px-2.5 py-1 font-mono text-[7px] font-black uppercase tracking-[.16em] ${live.some((item) => item.id === featured.id) ? "border-cyan-200/25 bg-cyan-200/8 text-cyan-100" : "border-white/8 bg-white/[.03] text-white/38"}`}>{live.some((item) => item.id === featured.id) ? "ŽIVĚ" : "HLAVNÍ ZÁPAS"}</span><SportBadge sport={featured.sport} /></div><ChevronRight className="h-4 w-4 text-white/20" /></div><div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div><div className="font-mono text-[7px] uppercase tracking-[.2em] text-white/28">DOMÁCÍ</div><div className="mt-1 truncate font-display text-2xl tracking-[.06em] text-white sm:text-3xl">{featured.teamA}</div></div><div className="text-center"><div className="font-mono text-3xl font-black tracking-tight text-amber-100">{featured.scoreA}:{featured.scoreB}</div><div className="mt-1 font-mono text-[7px] uppercase tracking-[.18em] text-white/30">{SPORTS[featured.sport]?.name ?? featured.sport}</div></div><div className="text-right"><div className="font-mono text-[7px] uppercase tracking-[.2em] text-white/28">HOSTÉ</div><div className="mt-1 truncate font-display text-2xl tracking-[.06em] text-white sm:text-3xl">{featured.teamB}</div></div></div></Link> : <div className="mt-4"><EmptyState text="Až začne další zápas, objeví se tady." /></div>}</div>
        <div className="rounded-[24px] border border-white/8 bg-[radial-gradient(circle_at_85%_12%,rgba(225,184,77,.11),transparent_30%),linear-gradient(145deg,rgba(21,23,27,.86),rgba(8,12,17,.96))] p-4 sm:p-5"><div className="font-mono text-[8px] font-black uppercase tracking-[.26em] text-amber-100/55">RYCHLÉ CESTY</div><div className="mt-1 font-display text-3xl tracking-[.1em] text-white">PODLE CHUTI</div><div className="mt-4 grid gap-2"><QuickLink to="/rankings" title="Žebříček" description="Pořadí a forma hráčů" icon={<Medal className="h-4 w-4" />} /><QuickLink to="/tournaments" title="Turnaje" description="Akce, pavouky a finále" icon={<Trophy className="h-4 w-4" />} /><QuickLink to="/teams" title="Týmy" description="Sestavy a 2v2 výzvy" icon={<Users className="h-4 w-4" />} /><QuickLink to="/bets" title="Sázky" description="Kurzy a sportovní přehled" icon={<CircleDollarSign className="h-4 w-4" />} /></div></div>
      </section>

      <section className="mt-6"><div className="mb-3 flex items-end justify-between gap-3 px-1"><div><div className="font-mono text-[8px] font-black uppercase tracking-[.26em] text-cyan-100/55">KOMUNITA</div><h2 className="mt-1 font-display text-3xl tracking-[.1em] text-white">PŘÍBĚHY & FEED</h2></div><Link to="/community" className="aaa-ghost inline-flex items-center gap-1.5 px-3 py-2 text-[8px] font-black uppercase tracking-[.16em]">Otevřít komunitu <ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="rounded-[24px] border border-cyan-200/10 bg-[linear-gradient(145deg,rgba(12,20,26,.76),rgba(7,11,16,.95))] p-2 shadow-[0_30px_100px_-85px_rgba(37,216,234,.25)] sm:p-3"><SocialHub compact /></div></section>

      <section className="mt-6 rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(18,25,33,.68),rgba(7,11,16,.92))] p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="font-mono text-[8px] font-black uppercase tracking-[.26em] text-amber-100/55">SPORTOVNÍ MATRIX</div><h2 className="mt-1 font-display text-3xl tracking-[.1em] text-white">VYBER SI SPORT</h2><p className="mt-1.5 text-xs leading-5 text-white/35">Klasické sporty i esporty v jednom přehledu.</p></div><Link to="/sport-center" className="aaa-ghost inline-flex w-fit items-center gap-2 px-3 py-2.5 text-[8px] font-black uppercase tracking-[.15em]">Celý sportovní přehled <ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="mt-5 space-y-5"><SportCluster label="Klasické sporty" sports={CLASSIC_SPORTS} onPick={setSelectedSport} /><SportCluster label="Esporty" sports={ESPORT_SPORTS} onPick={setSelectedSport} /></div></section>

      <footer className="mt-5 grid gap-2 sm:grid-cols-3"><TrustCard icon={<Activity className="h-4 w-4" />} title="ŽIVÁ DATA" text="Zápasy se průběžně aktualizují." /><TrustCard icon={<ShieldCheck className="h-4 w-4" />} title="OVĚŘENÁ HRA" text="Důležité herní akce kontroluje server." /><TrustCard icon={<Sparkles className="h-4 w-4" />} title="PRÉMIOVÉ UI" text="Jeden vizuální systém napříč celou aplikací." /></footer>

      {selectedSport && <SportActionModal sport={selectedSport} onClose={() => setSelectedSport(null)} />}
    </main>
  );
}

function MatchRow({ match, live }: { match: Match; live: boolean }) {
  const when = match.scheduledAt ? new Date(match.scheduledAt) : null;
  return <Link to="/match" search={{ id: match.id }} className="group flex items-center gap-3 rounded-2xl border border-white/7 bg-black/18 p-3 transition hover:-translate-y-0.5 hover:border-amber-200/25 hover:bg-white/[.02] sm:p-3.5"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-200/12 bg-amber-200/4"><SportBadge sport={match.sport} /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate font-display text-base tracking-[.04em] text-white sm:text-lg">{match.teamA} <span className="text-white/15">vs</span> {match.teamB}</span>{live && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(37,216,234,.8)]" />}</div><div className="mt-1 truncate font-mono text-[7px] uppercase tracking-[.18em] text-white/28">{SPORTS[match.sport]?.name ?? match.sport} · {match.matchFormat === "2v2" ? "2V2" : "1V1"}</div></div><div className="shrink-0 text-right"><div className="font-mono text-[11px] font-black text-amber-100 sm:text-xs">{match.endedAt ? `${match.scoreA}:${match.scoreB}` : when ? when.toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : `${match.scoreA}:${match.scoreB}`}</div><div className="mt-1 font-mono text-[7px] uppercase tracking-[.18em] text-white/28">{live ? "ŽIVĚ" : match.endedAt ? "KONEC" : "DALŠÍ"}</div></div><ChevronRight className="h-4 w-4 shrink-0 text-white/15 transition group-hover:text-amber-100" /></Link>;
}

function StatTile({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-white/8 bg-black/20 p-3"><div className="flex items-center gap-1.5 text-amber-100/55">{icon}<span className="font-mono text-[7px] font-black uppercase tracking-[.18em]">{label}</span></div><div className="mt-1 font-display text-xl tracking-[.05em] text-white">{value}</div></div>;
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/7 bg-black/18 p-2.5 text-center"><div className="font-display text-xl tracking-[.04em] text-white">{value}</div><div className="mt-1 font-mono text-[7px] font-black uppercase tracking-[.16em] text-white/28">{label}</div></div>;
}

function MetricCard({ icon, label, value, detail, tone = "gold" }: { icon: ReactNode; label: string; value: string | number; detail: string; tone?: "gold" | "cyan" | "green" }) {
  const toneClass = tone === "cyan" ? "text-cyan-200" : tone === "green" ? "text-emerald-200" : "text-amber-100";
  return <div className="rounded-2xl border border-white/7 bg-black/18 p-3.5"><div className="flex items-center gap-2 text-white/35">{icon}<span className="font-mono text-[7px] font-black uppercase tracking-[.2em]">{label}</span></div><div className={`mt-2 font-display text-2xl tracking-[.06em] ${toneClass}`}>{value}</div><div className="mt-0.5 text-[10px] text-white/28">{detail}</div></div>;
}

function QuickLink({ to, title, description, icon }: { to: string; title: string; description: string; icon: ReactNode }) {
  return <Link to={to} className="group flex items-center gap-3 rounded-2xl border border-white/7 bg-black/18 p-3 transition hover:-translate-y-0.5 hover:border-amber-200/24"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-200/14 bg-amber-200/5 text-amber-100/80">{icon}</div><div className="min-w-0 flex-1"><div className="font-display text-base tracking-[.05em] text-white">{title}</div><div className="mt-0.5 truncate text-[10px] text-white/28">{description}</div></div><ChevronRight className="h-4 w-4 text-white/15 group-hover:text-amber-100" /></Link>;
}

function SportCluster({ label, sports, onPick }: { label: string; sports: SportConfig[]; onPick: (id: SportId) => void }) {
  return <div><div className="mb-2 font-mono text-[8px] font-black uppercase tracking-[.24em] text-white/35">{label} · {sports.length}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{sports.map((sport) => <button key={sport.id} type="button" onClick={() => onPick(sport.id)} className="group min-h-24 rounded-2xl border border-white/7 bg-black/16 p-3 text-left transition hover:-translate-y-1 hover:border-amber-200/22 hover:bg-white/[.015]"><div className="flex items-center justify-between"><span className="text-2xl transition group-hover:scale-110">{sport.emoji}</span><span className="font-mono text-[6px] font-black uppercase tracking-[.16em] text-white/22">{sport.esport ? "ESPORT" : "SPORT"}</span></div><div className="mt-3 truncate font-display text-base tracking-[.06em] text-white">{sport.name}</div><div className="mt-1 font-mono text-[7px] uppercase tracking-[.16em] text-white/25">1V1 · 2V2</div></button>)}</div></div>;
}

function TrustCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="flex items-start gap-2.5 rounded-2xl border border-white/7 bg-black/12 p-3.5"><div className="mt-0.5 text-amber-100/55">{icon}</div><div><div className="font-mono text-[7px] font-black uppercase tracking-[.2em] text-white/35">{title}</div><div className="mt-1 text-[10px] leading-5 text-white/27">{text}</div></div></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/9 bg-black/14 px-4 py-10 text-center font-mono text-[8px] uppercase tracking-[.2em] text-white/24">{text}</div>;
}
