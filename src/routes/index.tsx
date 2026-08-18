import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowRight, CalendarClock, ChevronRight, Crown, Flame, Plus, ShieldCheck, Sparkles, Trophy, Users, Zap } from "lucide-react";
import { SPORT_LIST, SPORTS, type Match, type SportId } from "@/lib/matches";
import { SportBadge } from "@/components/SportBadge";
import { fetchAllMatches } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { SportActionModal } from "@/components/SportActionModal";
import heroImg from "@/assets/lobby-hero.jpg";
import nohejbalLegendsAsset from "@/assets/nohejbal-legends.png.asset.json";
import tennisLegendsAsset from "@/assets/tennis-legends.png.asset.json";
import volleyballLegendsAsset from "@/assets/volleyball-legends.png.asset.json";
import footballLegendsAsset from "@/assets/football-legends.png.asset.json";
import padelLegendsAsset from "@/assets/padel-legends.png.asset.json";
import foosballLegendsAsset from "@/assets/foosball-legends.png.asset.json";
import pingpongLegendsAsset from "@/assets/pingpong-legends.png.asset.json";
import basketballLegendsAsset from "@/assets/basketball-legends.png.asset.json";
import dartsLegendsAsset from "@/assets/darts-legends.png.asset.json";
import beerpongLegendsAsset from "@/assets/beerpong-legends.png.asset.json";
import beerraceLegendsAsset from "@/assets/beerrace-legends.png.asset.json";

const SPORT_BG: Record<string, string> = {
  tennis: tennisLegendsAsset.url,
  volleyball: volleyballLegendsAsset.url,
  nohejball: nohejbalLegendsAsset.url,
  football: footballLegendsAsset.url,
  padel: padelLegendsAsset.url,
  foosball: foosballLegendsAsset.url,
  pingpong: pingpongLegendsAsset.url,
  basketball: basketballLegendsAsset.url,
  darts: dartsLegendsAsset.url,
  beerpong: beerpongLegendsAsset.url,
  beerrace: beerraceLegendsAsset.url,
};

const FILTERS = [
  { id: "all" as const, label: "Vše" },
  { id: "classic" as const, label: "Klasika" },
  { id: "esport" as const, label: "Esport" },
  { id: "mine" as const, label: "Moje zápasy" },
];
type FilterId = (typeof FILTERS)[number]["id"];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SportChmeláci — Lobby" },
      { name: "description", content: "SportChmeláci lobby — zápasy, živé sporty, plánování a hráčská komunita." },
      { property: "og:title", content: "SportChmeláci — Lobby" },
      { property: "og:description", content: "Premium sports lobby pro živé zápasy a komunitní výzvy." },
    ],
  }),
  component: Lobby,
});

function Lobby() {
  const { user, nickname, loading } = useAuth();
  const [recent, setRecent] = useState<Match[]>([]);
  const [upcoming, setUpcoming] = useState<Match[]>([]);
  const [hoveredSport, setHoveredSport] = useState<string | null>(null);
  const [modalSport, setModalSport] = useState<SportId | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");

  useEffect(() => {
    if (!user) {
      setRecent([]);
      setUpcoming([]);
      return;
    }
    fetchAllMatches()
      .then((all) => {
        const up = all
          .filter((m) => m.scheduledAt && !m.endedAt && m.sets.length === 0 && m.scoreA === 0 && m.scoreB === 0)
          .sort((a, b) => (a.scheduledAt! - b.scheduledAt!));
        setUpcoming(up.slice(0, 6));
        setRecent(all.filter((m) => !!m.endedAt).slice(0, 6));
      })
      .catch(() => {
        setRecent([]);
        setUpcoming([]);
      });
  }, [user]);

  const visibleSports = useMemo(
    () => SPORT_LIST.filter((sport) => {
      if (filter === "classic") return !sport.esport;
      if (filter === "esport") return !!sport.esport;
      if (filter === "mine") return [...recent, ...upcoming].some((m) => m.ownerId === user?.id && m.sport === sport.id);
      return true;
    }),
    [filter, recent, upcoming, user?.id],
  );

  const listFilter = (m: Match) => {
    if (filter === "classic") return !SPORTS[m.sport].esport;
    if (filter === "esport") return !!SPORTS[m.sport].esport;
    if (filter === "mine") return m.ownerId === user?.id;
    return true;
  };
  const upcomingShown = upcoming.filter(listFilter);
  const recentShown = recent.filter(listFilter);
  const statMatches = recent.length + upcoming.length;
  const statUpcoming = upcoming.length;
  const statSports = new Set([...recent, ...upcoming].map((m) => m.sport)).size;

  return (
    <>
      {hoveredSport && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          {Object.entries(SPORT_BG).map(([id, url]) => (
            <img key={id} src={url} alt="" className={`absolute inset-0 h-full w-full object-cover saturate-125 contrast-110 transition-all duration-700 ${hoveredSport === id ? "scale-105 opacity-35" : "scale-110 opacity-0"}`} />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/92 to-background/75" />
        </div>
      )}

      <main className="relative z-10 mx-auto max-w-[1450px] px-3 pb-32 pt-5 sm:px-5 sm:pt-7 lg:px-7">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(300px,.65fr)]">
          <div className="aaa-card relative min-h-[390px] overflow-hidden p-5 sm:p-7 lg:p-9">
            <img src={heroImg} alt="" width={1600} height={720} className="absolute inset-0 h-full w-full object-cover opacity-70" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,7,12,.96)_0%,rgba(3,7,12,.82)_38%,rgba(3,7,12,.25)_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_35%,rgba(255,202,70,.18),transparent_32%)]" />
            <div className="relative flex h-full min-h-[355px] flex-col justify-between">
              <div className="max-w-2xl">
                <div className="aaa-meta flex items-center gap-2 text-amber-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-300 shadow-[0_0_14px_rgba(250,204,21,.9)]" /> SPORTCHMELÁCI ORIGINAL · LIVE LOBBY</div>
                <h1 className="mt-4 font-display text-5xl leading-[.88] tracking-[.08em] text-white sm:text-7xl lg:text-8xl">VÍTEJ ZPĚT,<br /><span className="gold-text">{nickname ?? "HRÁČI"}</span></h1>
                <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/55 sm:text-base">Centrální lobby pro všechny zápasy, výzvy a komunitní akci. Naplánuj zápas, připoj se k živému skóre nebo otevři sportovní hub.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                {user ? <button type="button" onClick={() => setModalSport("nohejball")} className="aaa-cta inline-flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-[.16em]"><Plus className="h-4 w-4" /> Vytvořit zápas</button> : <Link to="/auth" className="aaa-cta inline-flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-[.16em]">Přihlásit se <ArrowRight className="h-4 w-4" /></Link>}
                <Link to="/schedule" className="aaa-ghost inline-flex items-center gap-2 px-5 py-3 text-xs font-black uppercase tracking-[.16em]"><CalendarClock className="h-4 w-4" /> Plán zápasů</Link>
              </div>
            </div>
          </div>

          <aside className="aaa-card aaa-metal p-5 sm:p-6">
            <div className="flex items-center justify-between"><div className="aaa-meta">PLAYER STATUS</div><Crown className="h-5 w-5 text-amber-200" /></div>
            <div className="mt-5 flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/35 bg-amber-300/10 text-2xl text-amber-200 shadow-[0_0_40px_-12px_rgba(250,204,21,.8)]">♛</div><div><p className="font-display text-2xl tracking-[.12em] text-white">{nickname ?? "GUEST"}</p><p className="aaa-meta mt-1">{user ? "ACTIVE PLAYER" : "PUBLIC LOBBY"}</p></div></div>
            <div className="mt-6 rounded-2xl border border-white/8 bg-black/25 p-4"><div className="aaa-meta">CURRENT FOCUS</div><p className="mt-2 font-display text-lg tracking-[.08em] text-amber-100">MULTISPORT · LIVE</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full w-[68%] rounded-full bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-600 shadow-[0_0_18px_rgba(250,204,21,.45)]" /></div><p className="mt-2 text-[10px] text-white/35">Premium lobby design · realtime fixtures · team-ready sports</p></div>
            <div className="mt-4 grid grid-cols-3 gap-2"><MiniStat label="MATCHES" value={statMatches} icon={<Trophy className="h-3.5 w-3.5" />} /><MiniStat label="UPCOMING" value={statUpcoming} icon={<CalendarClock className="h-3.5 w-3.5" />} /><MiniStat label="SPORTS" value={statSports} icon={<Zap className="h-3.5 w-3.5" />} /></div>
          </aside>
        </section>

        <section className="mt-4 grid gap-3 sm:grid-cols-5">
          <Kpi title="ODEHRANÉ ZÁPASY" value={String(statMatches)} icon={<Trophy className="h-4 w-4" />} />
          <Kpi title="UPCOMING" value={String(statUpcoming)} icon={<CalendarClock className="h-4 w-4" />} />
          <Kpi title="SPORTY" value={String(statSports)} icon={<Sparkles className="h-4 w-4" />} />
          <Kpi title="2V2 READY" value="TÝMY" icon={<Users className="h-4 w-4" />} />
          <Kpi title="SERVER" value="ONLINE" icon={<ShieldCheck className="h-4 w-4" />} tone="green" />
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
          <div className="aaa-card p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="aaa-meta text-amber-200/80">LIVE PROGRAM</div><h2 className="mt-1 font-display text-3xl tracking-[.12em] text-white">PLÁN ZÁPASŮ</h2></div><Link to="/schedule" className="aaa-ghost inline-flex items-center px-3 py-2 text-[9px] font-black uppercase tracking-[.16em]">Celý plán <ChevronRight className="ml-1 h-3.5 w-3.5" /></Link></div>
            {upcomingShown.length ? <div className="mt-4 space-y-2">{upcomingShown.map((m) => { const cfg = SPORTS[m.sport]; const when = m.scheduledAt ? new Date(m.scheduledAt) : null; return <Link key={m.id} to="/match" search={{ id: m.id }} className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3 transition hover:-translate-y-0.5 hover:border-amber-300/35 hover:bg-amber-300/[.03]"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/5"><SportBadge sport={m.sport} /></div><div className="min-w-0 flex-1"><div className="truncate font-display text-base tracking-[.06em] text-white">{m.teamA} <span className="text-white/25">VS</span> {m.teamB}</div><div className="aaa-meta mt-1">{cfg.name} · by {m.ownerNickname}</div></div><div className="shrink-0 text-right"><div className="font-mono text-[10px] font-black text-amber-200">{when ? when.toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</div><div className="mt-1 text-[8px] uppercase tracking-[.14em] text-white/25">{m.matchFormat === "2v2" ? "2V2 · TÝMOVÝ" : "1V1"}</div></div><ChevronRight className="h-4 w-4 shrink-0 text-white/20 transition group-hover:text-amber-200" /></Link>; })}</div> : <EmptyState text="Žádný naplánovaný zápas" />}
          </div>

          <div className="aaa-card p-4 sm:p-5">
            <div className="aaa-meta text-cyan-200/80">QUICK ACCESS</div><h2 className="mt-1 font-display text-3xl tracking-[.12em]">SPORT HUB</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">{SPORT_LIST.slice(0, 6).map((sport) => <button key={sport.id} type="button" onClick={() => setModalSport(sport.id)} onMouseEnter={() => setHoveredSport(sport.id)} onMouseLeave={() => setHoveredSport(null)} className="group rounded-2xl border border-white/8 bg-black/20 p-3 text-left transition hover:-translate-y-1 hover:border-amber-300/35"><div className="flex items-center justify-between"><span className="text-2xl transition group-hover:scale-110">{sport.emoji}</span><ArrowRight className="h-3.5 w-3.5 text-white/15 group-hover:text-amber-200" /></div><p className="mt-3 font-display text-sm tracking-[.08em] text-white/85">{sport.name}</p><p className="aaa-meta mt-1">1V1 · 2V2</p></button>)}</div>
          </div>
        </section>

        <section className="mt-5 aaa-card overflow-hidden p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><div className="aaa-meta text-amber-200/80">DISCOVER</div><h2 className="mt-1 font-display text-3xl tracking-[.12em]">VYBER SPORT</h2></div><div className="flex flex-wrap gap-2">{FILTERS.map((f) => <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`aaa-chip transition ${filter === f.id ? "border-amber-300/55 bg-amber-300/10 text-amber-100" : "text-white/45 hover:text-white"}`}>{f.label}</button>)}</div></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">{visibleSports.map((s) => { const active = hoveredSport === s.id; return <button data-sport-tile key={s.id} type="button" onClick={() => { setHoveredSport(s.id); setModalSport(s.id); }} onMouseEnter={() => setHoveredSport(s.id)} onMouseLeave={() => setHoveredSport(null)} className={`group relative min-h-[150px] overflow-hidden rounded-2xl border p-4 text-left transition ${active ? "border-amber-300/60 bg-amber-300/10 shadow-[0_0_40px_-18px_rgba(250,204,21,.8)]" : "border-white/8 bg-black/20 hover:-translate-y-1 hover:border-amber-300/35"}`}><div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,204,68,.10),transparent_42%)] opacity-0 transition group-hover:opacity-100" /><div className="relative flex items-start justify-between"><span className="text-4xl transition group-hover:scale-110">{s.emoji}</span><span className="aaa-meta">{s.esport ? "ESPORT" : "SPORT"}</span></div><p className="relative mt-7 font-display text-xl tracking-[.08em] text-white">{s.name}</p><p className="relative mt-2 text-[9px] font-mono uppercase tracking-[.15em] text-white/30">NAPLÁNOVAT ZÁPAS →</p></button>; })}</div>
        </section>

        {recentShown.length > 0 && <section className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_.6fr]"><div className="aaa-card p-4 sm:p-5"><div className="flex items-end justify-between"><div><div className="aaa-meta">RECENT FORM</div><h2 className="mt-1 font-display text-3xl tracking-[.12em]">POSLEDNÍ ZÁPASY</h2></div><Link to="/history" className="aaa-ghost px-3 py-2 text-[9px] font-black uppercase tracking-[.16em]">Historie</Link></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{recentShown.map((m) => { const cfg = SPORTS[m.sport]; const setsA = m.sets.filter((s) => s.a > s.b).length; const setsB = m.sets.filter((s) => s.b > s.a).length; const showSets = cfg.hasSets && m.sets.length > 0; const a = showSets ? setsA : m.scoreA; const b = showSets ? setsB : m.scoreB; return <Link key={m.id} to="/match" search={{ id: m.id }} className="rounded-2xl border border-white/8 bg-black/20 p-3 transition hover:border-amber-300/30"><div className="flex items-center justify-between"><SportBadge sport={m.sport} /><span className="aaa-meta">{m.ownerNickname}</span></div><div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><span className="truncate font-display text-sm tracking-[.05em]">{m.teamA}</span><span className="font-mono text-sm font-black text-amber-100">{a}:{b}</span><span className="truncate text-right font-display text-sm tracking-[.05em]">{m.teamB}</span></div></Link>; })}</div></div><div className="aaa-card aaa-metal p-5"><div className="flex items-center gap-2 text-amber-200"><Flame className="h-5 w-5" /><span className="aaa-meta text-amber-100/70">COMMUNITY PULSE</span></div><h3 className="mt-3 font-display text-3xl tracking-[.1em]">DALŠÍ VÝZVA</h3><p className="mt-2 text-sm leading-relaxed text-white/45">2v2 týmové zápasy jsou aktivní. Slož dvojici, vytvoř zápas a pusť se do live skóre.</p><Link to="/teams" className="aaa-cta mt-5 inline-flex items-center gap-2 px-4 py-2.5 text-[9px] font-black uppercase tracking-[.16em]">Týmy <ArrowRight className="h-3.5 w-3.5" /></Link></div></section>}

        <footer className="mt-6 grid gap-2 rounded-2xl border border-white/8 bg-black/20 p-4 sm:grid-cols-4"><FooterItem icon={<Sparkles className="h-4 w-4" />} title="AAA DESIGN" text="Premium black / gold system" /><FooterItem icon={<ShieldCheck className="h-4 w-4" />} title="SERVER AUTH" text="Důležité akce validuje server" /><FooterItem icon={<Zap className="h-4 w-4" />} title="FAST & FLUID" text="Reakce, animace a realtime" /><FooterItem icon={<Users className="h-4 w-4" />} title="COMMUNITY" text="1V1 · 2V2 · turnaje" /></footer>
      </main>

      {modalSport && <SportActionModal sport={modalSport} image={SPORT_BG[modalSport]} onClose={() => { setModalSport(null); setHoveredSport(null); }} />}
    </>
  );
}

function Kpi({ title, value, icon, tone = "gold" }: { title: string; value: string; icon: ReactNode; tone?: "gold" | "green" }) {
  return <div className={`aaa-card p-3 ${tone === "green" ? "border-emerald-300/20" : ""}`}><div className="flex items-center gap-2 text-white/35">{icon}<span className="aaa-meta">{title}</span></div><p className={`mt-2 font-display text-xl tracking-[.08em] ${tone === "green" ? "text-emerald-200" : "gold-text"}`}>{value}</p></div>;
}

function MiniStat({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return <div className="rounded-xl border border-white/8 bg-black/20 p-2.5 text-center"><div className="flex justify-center text-amber-200/70">{icon}</div><div className="mt-1 font-display text-base text-white">{value}</div><div className="aaa-meta mt-1">{label}</div></div>;
}

function FooterItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-white/6 bg-white/[.02] p-3"><div className="text-amber-200/70">{icon}</div><div><div className="aaa-meta text-amber-100/55">{title}</div><div className="mt-1 text-[10px] text-white/35">{text}</div></div></div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/15 p-10 text-center"><div className="font-display text-xl tracking-[.15em] text-white/25">NO FIXTURES</div><p className="aaa-meta mt-2">{text}</p></div>;
}
