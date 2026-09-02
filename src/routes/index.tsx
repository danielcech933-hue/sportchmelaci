import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, ArrowRight, Bookmark, CalendarClock, ChevronRight, CircleDollarSign, Crown, Flame, Gamepad2, Heart, MessageCircle, Plus, Share2, ShieldCheck, Sparkles, Trophy, Users, WalletCards, Zap } from "lucide-react";
import { CLASSIC_SPORTS, ESPORT_SPORTS, SPORTS, type SportConfig, type Match, type SportId } from "@/lib/matches";
import { fetchAllMatches } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";
import { SportBadge } from "@/components/SportBadge";
import { SportActionModal } from "@/components/SportActionModal";
import matchdayHero from "@/assets/matchday-hero.jpg";

type FeedFilter = "all" | "upcoming" | "recent";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SportChmeláci — Matchday" },
      { name: "description", content: "SportChmeláci: dnešní hlavní event, živé zápasy, sportovní hub, týmy, sázky a komunita." },
    ],
  }),
  component: Lobby,
});

function Lobby() {
  const { user, nickname } = useAuth();
  const { userDollars, slotCZK } = useWallet();
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<FeedFilter>("all");
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
    const timer = window.setInterval(load, 10_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  const now = Date.now();
  const live = useMemo(() => matches.filter((m) => !m.endedAt && (m.scoreA > 0 || m.scoreB > 0 || m.sets.length > 0)).slice(0, 5), [matches]);
  const upcoming = useMemo(() => matches.filter((m) => !!m.scheduledAt && !m.endedAt && (m.scheduledAt ?? 0) >= now).sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0)).slice(0, 6), [matches, now]);
  const recent = useMemo(() => matches.filter((m) => !!m.endedAt).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)).slice(0, 6), [matches]);
  const sportsActive = useMemo(() => new Set([...upcoming, ...recent].map((m) => m.sport)).size, [upcoming, recent]);
  const openFeed = filter === "upcoming" ? upcoming : filter === "recent" ? recent : [...live, ...upcoming];

  const featured = live[0] ?? upcoming[0] ?? recent[0] ?? null;

  return (
    <main className="relative z-10 mx-auto max-w-[1500px] px-3 pb-32 pt-4 sm:px-5 sm:pt-6 lg:px-7">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.6fr)]">
        <article className="aaa-card overflow-hidden">
          <div className="relative aspect-[4/3] min-h-[430px] sm:aspect-[16/10] lg:aspect-[2/1]">
            <img src={matchdayHero} alt="Zápas století — SportChmeláci" width={1400} height={1800} className="absolute inset-0 h-full w-full object-cover object-center" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,12,.10)_0%,rgba(3,7,12,.22)_38%,rgba(3,7,12,.95)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_24%,rgba(255,208,75,.22),transparent_28%),linear-gradient(90deg,rgba(3,7,12,.58)_0%,transparent_58%)]" />
            <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-2 sm:left-6 sm:right-6 sm:top-6">
              <div className="flex flex-wrap gap-2">
                <span className="aaa-chip border-amber-300/45 bg-black/35 text-amber-100"><Flame className="h-3 w-3" /> ZÁPAS DNEŠKA</span>
                <span className="aaa-chip border-white/15 bg-black/35 text-white/75">FEATURED</span>
              </div>
              <span className="hidden rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 font-mono text-[8px] font-black tracking-[.18em] text-emerald-200 sm:inline-flex">MATCHDAY 01</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7 lg:p-9">
              <div className="aaa-meta text-amber-200/75">SPORTCHMELÁCI PRESENTS</div>
              <h1 className="mt-2 max-w-3xl font-display text-5xl leading-[.82] tracking-[.06em] text-white sm:text-7xl lg:text-8xl">ZÁPAS<br /><span className="gold-text">STOLETÍ</span></h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold uppercase tracking-[.15em] text-white/70 sm:text-base">Daniel Čech · The Main Event · Clay Court · 2026</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/live-arena" className="aaa-cta inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-[.16em]"><Activity className="h-4 w-4" /> Sledovat Matchday</Link>
                <Link to="/schedule" className="aaa-ghost inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-[.16em]"><CalendarClock className="h-4 w-4" /> Program</Link>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-white/8 bg-black/25 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-amber-300/30 bg-amber-300/10 font-display text-sm text-amber-100">SC</div>
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-white">SportChmeláci</div>
                <div className="aaa-meta mt-0.5">HLAVNÍ PŘÍSPĚVEK · DNES</div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 text-white/45">
              <button type="button" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/5 hover:text-white" aria-label="To se mi líbí"><Heart className="h-4 w-4" /></button>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/5 hover:text-white" aria-label="Komentáře"><MessageCircle className="h-4 w-4" /></button>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/5 hover:text-white" aria-label="Sdílet"><Share2 className="h-4 w-4" /></button>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/5 hover:text-white" aria-label="Uložit"><Bookmark className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="px-4 pb-4 pt-1 sm:px-6 sm:pb-5">
            <p className="text-sm leading-6 text-white/65"><strong className="text-white">ZÁPAS STOLETÍ.</strong> Jeden kurt, jeden event, jeden výsledek. Tohle je dnešní hlavní dění na SportChmelácích.</p>
          </div>
        </article>

        <aside className="aaa-card aaa-metal p-5 sm:p-6">
          <div className="flex items-center justify-between"><span className="aaa-meta">PERSONAL SIGNAL</span><Crown className="h-5 w-5 text-amber-200" /></div>
          <div className="mt-5 flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-xl text-amber-200"><Crown className="h-6 w-6" /></div><div><div className="font-display text-2xl tracking-[.12em] text-white">{nickname ?? "GUEST"}</div><div className="aaa-meta mt-1">{user ? "ACTIVE PLAYER" : "PUBLIC LOBBY"}</div></div></div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <WalletBox label="SPORT DOLLARS" value={`$${userDollars.toFixed(0)}`} icon={<WalletCards className="h-3.5 w-3.5" />} />
            <WalletBox label="SLOT CZK" value={slotCZK.toLocaleString("cs-CZ")} icon={<CircleDollarSign className="h-3.5 w-3.5" />} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2"><Mini label="LIVE" value={live.length} /><Mini label="NEXT" value={upcoming.length} /><Mini label="SPORTY" value={sportsActive} /></div>
          <Link to={user ? "/profile" : "/auth"} className="aaa-ghost mt-4 flex w-full items-center justify-between px-3 py-2.5 text-[9px] font-black uppercase tracking-[.18em]">Osobní dashboard <ChevronRight className="h-4 w-4" /></Link>
        </aside>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="LIVE NOW" value={String(live.length)} icon={<Activity className="h-4 w-4" />} tone="live" />
        <Kpi title="NEXT MATCHES" value={String(upcoming.length)} icon={<CalendarClock className="h-4 w-4" />} />
        <Kpi title="SPORT HUB" value={String(sportsActive)} icon={<Zap className="h-4 w-4" />} />
        <Kpi title="COMMUNITY" value="ONLINE" icon={<Users className="h-4 w-4" />} tone="green" />
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
        <div className="aaa-card p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="aaa-meta text-amber-200/80">MATCH CONTROL</div><h2 className="mt-1 font-display text-3xl tracking-[.12em] text-white">LIVE & NEXT</h2></div><div className="flex gap-1.5">{(["all","upcoming","recent"] as FeedFilter[]).map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={`aaa-chip transition ${filter === f ? "border-amber-300/55 bg-amber-300/10 text-amber-100" : "text-white/40"}`}>{f === "all" ? "Vše" : f === "upcoming" ? "Další" : "Poslední"}</button>)}</div></div>
          <div className="mt-4 space-y-2">
            {openFeed.length ? openFeed.slice(0, 7).map((m) => <MatchRow key={`${m.id}-${m.startedAt}`} match={m} live={live.some((x) => x.id === m.id)} />) : <Empty text="Žádný aktuální zápas" />}
          </div>
        </div>

        <div className="aaa-card p-4 sm:p-5">
          <div className="aaa-meta text-cyan-200/80">PLAYER ROUTES</div><h2 className="mt-1 font-display text-3xl tracking-[.12em]">QUICK ACTIONS</h2>
          <div className="mt-4 grid gap-2">
            <RouteCard to="/schedule" title="Plán zápasů" desc="1v1 · 2v2 · Matchday" icon={<CalendarClock className="h-4 w-4" />} />
            <RouteCard to="/teams" title="Team HQ" desc="Roster · 2v2 · squads" icon={<Users className="h-4 w-4" />} />
            <RouteCard to="/betting" title="Betting Desk" desc="Markets · odds · risk" icon={<CircleDollarSign className="h-4 w-4" />} />
            <RouteCard to="/trophy-room" title="Trophy Room" desc="Achievements · prestige" icon={<Trophy className="h-4 w-4" />} />
            <RouteCard to="/slots" title="Casino" desc="Slots · roulette · play money" icon={<Gamepad2 className="h-4 w-4" />} />
          </div>
        </div>
      </section>

      {featured && <section className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <Link to="/match" search={{ id: featured.id }} className="aaa-card group overflow-hidden p-5 sm:p-6">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className={`aaa-chip ${live.includes(featured) ? "border-rose-300/40 text-rose-200" : ""}`}>{live.includes(featured) ? "LIVE MATCH" : "FEATURED MATCH"}</span><SportBadge sport={featured.sport} /></div><ChevronRight className="h-5 w-5 text-white/20 group-hover:text-amber-200" /></div>
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><div><div className="aaa-meta">HOME</div><div className="mt-1 truncate font-display text-2xl tracking-[.06em] text-white sm:text-3xl">{featured.teamA}</div></div><div className="text-center"><div className="font-mono text-2xl font-black text-amber-200">{featured.scoreA}:{featured.scoreB}</div><div className="aaa-meta mt-1">{SPORTS[featured.sport]?.name ?? featured.sport}</div></div><div className="text-right"><div className="aaa-meta">AWAY</div><div className="mt-1 truncate font-display text-2xl tracking-[.06em] text-white sm:text-3xl">{featured.teamB}</div></div></div>
          <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-3 font-mono text-[8px] uppercase tracking-[.2em] text-white/30"><span>{featured.matchFormat === "2v2" ? "2V2 TEAM MATCH" : "1V1 MATCH"}</span><span>{featured.ownerNickname}</span></div>
        </Link>
        <div className="aaa-card aaa-metal p-5 sm:p-6"><div className="flex items-center gap-2"><Flame className="h-5 w-5 text-amber-200" /><span className="aaa-meta text-amber-100/70">COMPETITIVE PULSE</span></div><h2 className="mt-2 font-display text-3xl tracking-[.1em] text-white">BUILD YOUR NEXT RUN</h2><p className="mt-3 text-sm leading-relaxed text-white/45">Vytvoř nový zápas, slož 2v2 tým, sleduj live skóre nebo zkontroluj formu soupeře před další výzvou.</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><Link to="/rankings" className="aaa-ghost inline-flex items-center justify-center gap-2 px-3 py-2.5 text-[9px] font-black uppercase tracking-[.16em]"><Trophy className="h-3.5 w-3.5" /> Scoreboard</Link><Link to="/community" className="aaa-ghost inline-flex items-center justify-center gap-2 px-3 py-2.5 text-[9px] font-black uppercase tracking-[.16em]"><Users className="h-3.5 w-3.5" /> Community</Link></div></div>
      </section>}

      <section className="mt-5 aaa-card p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="aaa-meta">SPORT MATRIX</div><h2 className="mt-1 font-display text-3xl tracking-[.12em]">SPORT HUB</h2></div><Link to="/sport-center" className="aaa-ghost inline-flex items-center gap-1 px-3 py-2 text-[9px] font-black uppercase tracking-[.16em]">Full Hub <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        <div className="mt-4 space-y-4">
          <SportGroup label="Klasické sporty" sports={CLASSIC_SPORTS} onPick={setSelectedSport} />
          <SportGroup label="Esporty" sports={ESPORT_SPORTS} onPick={setSelectedSport} />
        </div>
      </section>

      <footer className="mt-5 grid gap-2 rounded-2xl border border-white/8 bg-black/20 p-4 sm:grid-cols-4"><FooterItem title="LIVE SYNC" text="Fixtures obnovovány průběžně" icon={<Activity className="h-4 w-4" />} /><FooterItem title="SERVER AUTH" text="Důležité herní akce validuje server" icon={<ShieldCheck className="h-4 w-4" />} /><FooterItem title="2V2 READY" text="Týmové zápasy jsou první třída" icon={<Users className="h-4 w-4" />} /><FooterItem title="AAA UI" text="Mac · Windows · iPhone · Android" icon={<Sparkles className="h-4 w-4" />} /></footer>

      {selectedSport && <SportActionModal sport={selectedSport} onClose={() => setSelectedSport(null)} />}
    </main>
  );
}

function SportGroup({ label, sports, onPick }: { label: string; sports: SportConfig[]; onPick: (id: SportId) => void }) {
  return (
    <div>
      <div className="aaa-meta mb-2">{label} · {sports.length}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {sports.map((sport) => (
          <button key={sport.id} type="button" onClick={() => onPick(sport.id)} className="group min-h-24 rounded-[var(--aaa-radius-sm)] border border-border/50 bg-surface/40 p-3 text-left transition hover:-translate-y-1 hover:border-primary/40">
            <div className="flex items-center justify-between">
              <span aria-hidden className="text-2xl transition group-hover:scale-110">{sport.emoji}</span>
              <span className={`aaa-meta ${sport.esport ? "text-accent/80" : ""}`}>{sport.esport ? "ESPORT" : "SPORT"}</span>
            </div>
            <div className="mt-3 truncate font-display text-base tracking-[.07em] text-foreground">{sport.name}</div>
            <div className="aaa-meta mt-1">1V1 · 2V2</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function MatchRow({ match, live }: { match: Match; live: boolean }) {
  const when = match.scheduledAt ? new Date(match.scheduledAt) : null;
  return <Link to="/match" search={{ id: match.id }} className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 transition hover:-translate-y-0.5 hover:border-amber-300/35"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/5"><SportBadge sport={match.sport} /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate font-display text-sm tracking-[.04em] text-white sm:text-base">{match.teamA} <span className="text-white/20">VS</span> {match.teamB}</span>{live && <span className="live-dot h-2 w-2 rounded-full bg-red-400 shrink-0" />}</div><div className="aaa-meta mt-1">{SPORTS[match.sport]?.name ?? match.sport} · {match.matchFormat === "2v2" ? "2V2 TEAM" : "1V1"}</div></div><div className="text-right"><div className="font-mono text-[11px] font-black text-amber-200">{match.endedAt ? `${match.scoreA}:${match.scoreB}` : when ? when.toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "LIVE"}</div><div className="aaa-meta mt-1">{live ? "LIVE" : match.endedAt ? "FINAL" : "NEXT"}</div></div><ChevronRight className="h-4 w-4 shrink-0 text-white/15 group-hover:text-amber-200" /></Link>;
}

function WalletBox({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return <div className="rounded-2xl border border-white/8 bg-black/25 p-3"><div className="flex items-center gap-1.5 text-white/35">{icon}<span className="aaa-meta">{label}</span></div><div className="mt-1 font-display text-xl text-amber-100">{value}</div></div>;
}

function Mini({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/8 bg-black/20 p-2 text-center"><div className="font-display text-lg text-white">{value}</div><div className="aaa-meta mt-1">{label}</div></div>;
}

function Kpi({ title, value, icon, tone = "gold" }: { title: string; value: string; icon: ReactNode; tone?: "gold" | "green" | "live" }) {
  const cls = tone === "green" ? "text-emerald-200" : tone === "live" ? "text-rose-200" : "gold-text";
  return <div className="aaa-card p-3"><div className="flex items-center gap-2 text-white/35">{icon}<span className="aaa-meta">{title}</span></div><div className={`mt-2 font-display text-2xl tracking-[.08em] ${cls}`}>{value}</div></div>;
}

function RouteCard({ to, title, desc, icon }: { to: string; title: string; desc: string; icon: ReactNode }) {
  return <Link to={to} className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 transition hover:-translate-y-0.5 hover:border-amber-300/35"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/5 text-amber-200">{icon}</div><div className="min-w-0 flex-1"><div className="font-display text-base tracking-[.05em] text-white">{title}</div><div className="aaa-meta mt-1">{desc}</div></div><ChevronRight className="h-4 w-4 text-white/15 group-hover:text-amber-200" /></Link>;
}

function Empty({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 px-4 py-8 text-center font-mono text-[9px] uppercase tracking-[.18em] text-white/25">{text}</div>; }
function FooterItem({ title, text, icon }: { title: string; text: string; icon: ReactNode }) { return <div className="flex items-start gap-2 rounded-xl border border-white/7 bg-black/10 p-3"><div className="text-amber-200/70">{icon}</div><div><div className="aaa-meta text-white/45">{title}</div><div className="mt-1 text-[10px] text-white/30">{text}</div></div></div>; }
