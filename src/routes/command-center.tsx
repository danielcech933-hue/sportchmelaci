import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Bell, CalendarClock, ChevronRight, CircleDollarSign, Flame, Radio, ShieldCheck, Trophy, Users, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAllMatches } from "@/lib/matches-db";
import type { Match } from "@/lib/matches";
import { SPORTS } from "@/lib/matches";

export const Route = createFileRoute("/command-center")({
  head: () => ({ meta: [{ title: "Command Center — SportChmeláci" }, { name: "description", content: "Živé centrum zápasů, plánů, sázek, týmů a trofejí." }] }),
  component: CommandCenter,
});

function CommandCenter() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [updated, setUpdated] = useState(Date.now());
  useEffect(() => {
    let alive = true;
    const load = async () => { try { const rows = await fetchAllMatches(); if (alive) { setMatches(rows); setUpdated(Date.now()); } } catch {} };
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const live = useMemo(() => matches.filter((m) => !m.endedAt && (m.sets.length > 0 || m.scoreA !== 0 || m.scoreB !== 0)).slice(0, 6), [matches]);
  const upcoming = useMemo(() => matches.filter((m) => !m.endedAt && m.scheduledAt).sort((a,b) => (a.scheduledAt! - b.scheduledAt!)).slice(0, 6), [matches]);
  const recent = useMemo(() => matches.filter((m) => !!m.endedAt).slice(0, 6), [matches]);
  const teamMatches = matches.filter((m) => m.matchFormat === "2v2").length;
  const pool = matches.reduce((sum, m) => sum + (m.bets ?? []).reduce((s, b) => s + (b.amount ?? 0), 0), 0);

  return <main className="relative mx-auto max-w-[1450px] px-3 pb-32 pt-4 sm:px-5 lg:px-7">
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"><div className="absolute left-1/2 top-0 h-[650px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.12),transparent_64%)] blur-3xl"/><div className="absolute right-0 top-[45%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,.08),transparent_64%)] blur-3xl"/></div>
    <section className="overflow-hidden rounded-[32px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(10,14,18,.98),rgba(2,5,8,.99))] shadow-[0_35px_120px_-55px_rgba(250,204,21,.5)]">
      <div className="grid gap-0 xl:grid-cols-[1fr_360px]">
        <div className="p-6 sm:p-9 lg:p-11"><div className="font-mono text-[9px] font-black uppercase tracking-[.3em] text-amber-200/70">SPORTCHMELÁCI · COMMAND DECK</div><h1 className="mt-4 font-display text-6xl font-black tracking-[.08em] text-white sm:text-7xl lg:text-8xl">CONTROL <span className="gold-text">CENTER</span></h1><p className="mt-4 max-w-2xl text-sm leading-7 text-white/40 sm:text-base">Jeden živý dashboard pro zápasy, plán, betting, týmy, ligu a prestiž. Všechno důležité na jednom místě.</p><div className="mt-7 flex flex-wrap gap-2"><Link to="/activity" className="aaa-cta inline-flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-[.16em]"><Radio className="h-4 w-4"/> Live Pulse</Link><Link to="/schedule" className="aaa-ghost inline-flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-[.16em]"><CalendarClock className="h-4 w-4"/> Matchday</Link><Link to="/betting" className="aaa-ghost inline-flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-[.16em]"><CircleDollarSign className="h-4 w-4"/> Betting</Link></div></div>
        <aside className="border-t border-white/8 bg-black/20 p-6 sm:p-8 xl:border-l xl:border-t-0"><div className="flex items-center justify-between"><span className="font-mono text-[8px] font-black uppercase tracking-[.25em] text-cyan-200/70">SYSTEM STATUS</span><ShieldCheck className="h-5 w-5 text-emerald-300"/></div><div className="mt-4 grid grid-cols-2 gap-2"><Metric label="LIVE" value={String(live.length)} icon={<Radio className="h-4 w-4"/>}/><Metric label="UPCOMING" value={String(upcoming.length)} icon={<CalendarClock className="h-4 w-4"/>}/><Metric label="2V2" value={String(teamMatches)} icon={<Users className="h-4 w-4"/>}/><Metric label="POOL" value={`$${pool.toLocaleString("en-US")}`} icon={<CircleDollarSign className="h-4 w-4"/>}/></div><div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[.03] p-4"><div className="font-mono text-[8px] uppercase tracking-[.22em] text-emerald-200/60">ALL SYSTEMS</div><div className="mt-2 font-display text-2xl text-emerald-100">ONLINE</div><div className="mt-1 text-[9px] text-white/25">SYNC {new Date(updated).toLocaleTimeString("cs-CZ")}</div></div></aside>
      </div>
    </section>

    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Action href="/rankings" title="SCOREBOARD" text="ELO, W/L, form a 2v2 ranking." icon={<Trophy className="h-5 w-5"/>}/><Action href="/trophy-room" title="TROPHY ROOM" text="Prestiž, odznaky a progres." icon={<Flame className="h-5 w-5"/>}/><Action href="/teams" title="TEAM HQ" text="Roster, kapitán a 2v2 setup." icon={<Users className="h-5 w-5"/>}/><Action href="/leagues" title="CHMEL LEAGUE" text="Sezóna, tabulka a matchday." icon={<Activity className="h-5 w-5"/>}/></section>

    <section className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><Panel title="LIVE NOW" kicker="SIGNAL FEED" icon={<Radio className="h-4 w-4 text-emerald-300"/>}>{live.length ? live.map((m)=><MatchRow key={m.id} match={m} live/>) : <Empty text="Žádný aktivní live zápas."/>}</Panel><Panel title="NEXT UP" kicker="FIXTURE FEED" icon={<CalendarClock className="h-4 w-4 text-amber-200"/>}>{upcoming.length ? upcoming.map((m)=><MatchRow key={m.id} match={m}/>) : <Empty text="Žádný další zápas."/>}</Panel></section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_1fr]"><Panel title="RECENT RESULTS" kicker="FORM SIGNAL" icon={<Zap className="h-4 w-4 text-cyan-200"/>}>{recent.length ? recent.map((m)=><MatchRow key={m.id} match={m}/>) : <Empty text="Zatím žádné výsledky."/>}</Panel><Panel title="ALERTS" kicker="PLAYER SIGNAL" icon={<Bell className="h-4 w-4 text-amber-200"/>}><Alert title="Trophy Room" text="Sleduj další badge a prestige milestone." href="/trophy-room"/><Alert title="Community" text="Najdi soupeře nebo 2v2 partnera." href="/community"/><Alert title="Records" text="Porovnej aktuální rekordní výkony." href="/records"/></Panel><Panel title="QUICK ROUTES" kicker="NAVIGATION" icon={<ChevronRight className="h-4 w-4 text-white/50"/>}><div className="grid gap-2"><LinkBox href="/sport-center" text="Sport Center"/><LinkBox href="/player-center" text="Player Center"/><LinkBox href="/my-bets" text="My Bets"/><LinkBox href="/records" text="Hall of Records"/></div></Panel></section>
  </main>;
}

function MatchRow({ match, live=false }: { match: Match; live?: boolean }) { const sport = SPORTS[match.sport]; return <Link to="/match" search={{id: match.id}} className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[.02] p-3 transition hover:border-amber-300/25"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/15 bg-amber-300/[.04] text-xl">{sport.emoji}</div><div className="min-w-0 flex-1"><div className="truncate font-display text-base text-white">{match.teamA} <span className="text-white/20">VS</span> {match.teamB}</div><div className="mt-1 font-mono text-[8px] uppercase tracking-[.18em] text-white/30">{sport.name} · {match.matchFormat === "2v2" ? "2V2 · TEAM" : "1V1"}</div></div><div className="text-right">{live ? <div className="font-mono text-[8px] font-black uppercase tracking-[.18em] text-emerald-300">LIVE</div> : <div className="font-mono text-[9px] text-amber-200">{match.endedAt ? `${match.scoreA}:${match.scoreB}` : new Date(match.scheduledAt!).toLocaleString("cs-CZ", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>}<ChevronRight className="ml-auto mt-1 h-3.5 w-3.5 text-white/20 group-hover:text-amber-200"/></div></Link>; }
function Metric({label,value,icon}:{label:string;value:string;icon:React.ReactNode}){return <div className="rounded-xl border border-white/8 bg-black/20 p-3"><div className="flex items-center gap-2 text-white/25">{icon}<span className="font-mono text-[8px] uppercase tracking-[.18em]">{label}</span></div><div className="mt-2 truncate font-display text-lg text-white">{value}</div></div>}
function Action({href,title,text,icon}:{href:string;title:string;text:string;icon:React.ReactNode}){return <Link to={href} className="group rounded-2xl border border-white/8 bg-black/20 p-5 transition hover:-translate-y-1 hover:border-amber-300/25"><div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300/15 bg-amber-300/[.04] text-amber-200">{icon}</div><div className="mt-4 font-display text-lg font-black text-white">{title}</div><p className="mt-2 text-sm text-white/30">{text}</p><div className="mt-4 font-mono text-[8px] uppercase tracking-[.2em] text-amber-200">OPEN →</div></Link>}
function Panel({title,kicker,icon,children}:{title:string;kicker:string;icon:React.ReactNode;children:React.ReactNode}){return <section className="rounded-[24px] border border-white/8 bg-black/20 p-5"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl border border-white/8 bg-white/[.03]">{icon}</span><div><div className="font-mono text-[8px] uppercase tracking-[.2em] text-white/25">{kicker}</div><h2 className="font-display text-xl tracking-[.1em] text-white">{title}</h2></div></div><div className="mt-4 grid gap-2">{children}</div></section>}
function Alert({title,text,href}:{title:string;text:string;href:string}){return <Link to={href} className="rounded-2xl border border-white/8 bg-white/[.02] p-4 hover:border-cyan-300/20"><div className="font-display text-base text-white">{title}</div><div className="mt-1 text-xs text-white/30">{text}</div></Link>}
function LinkBox({href,text}:{href:string;text:string}){return <Link to={href} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[.02] px-4 py-3 text-sm text-white/60 hover:border-amber-300/20 hover:text-white"><span>{text}</span><ChevronRight className="h-4 w-4 text-white/20"/></Link>}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-white/8 p-8 text-center font-mono text-[9px] uppercase tracking-[.2em] text-white/20">{text}</div>}
