import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, BarChart3, CalendarDays, Flame, Radio, Trophy, Users, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SPORTS, SPORT_LIST, type Match, type SportId } from "@/lib/matches";
import { fetchAllMatches } from "@/lib/matches-db";
import { UltraArenaShell, UltraLinkButton, UltraMetric, UltraSection, LiveBadge, TimeBadge, PowerMark } from "@/components/UltraArenaShell";

export const Route = createFileRoute("/sport-center")({ component: SportCenterPage });

function SportCenterPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [sport, setSport] = useState<SportId | "all">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try { const rows = await fetchAllMatches(); if (alive) setMatches(rows); }
      finally { if (alive) setLoading(false); }
    };
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const filtered = useMemo(() => sport === "all" ? matches : matches.filter((m) => m.sport === sport), [matches, sport]);
  const live = filtered.filter((m) => !m.endedAt).slice(0, 6);
  const recent = [...filtered].filter((m) => !!m.endedAt).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)).slice(0, 6);
  const sportCounts = SPORT_LIST.map((item) => ({ ...item, count: matches.filter((m) => m.sport === item.id).length }));

  return <UltraArenaShell eyebrow="SPORTCHMELÁCI · SPORT OPERATING SYSTEM" title="SPORT CENTER" subtitle="Jedno prémiové centrum pro live zápasy, plán, výsledky, formu hráčů a sportovní disciplíny. Všechny karty jsou napojené na skutečný match feed." actions={<><UltraLinkButton href="/schedule">PLÁN ZÁPASŮ</UltraLinkButton><UltraLinkButton href="/rankings" primary>ŽEBŘÍČKY</UltraLinkButton></>}>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><UltraMetric label="MATCH FEED" value={loading ? "—" : String(matches.length)} hint="záznamů v systému" icon={<Radio className="h-4 w-4 text-emerald-300" />} /><UltraMetric label="LIVE / UPCOMING" value={String(live.length)} hint="otevřených sportovních momentů" icon={<Flame className="h-4 w-4 text-amber-200" />} /><UltraMetric label="SPORTS" value={String(SPORT_LIST.length)} hint="aktivních disciplín" icon={<Trophy className="h-4 w-4 text-amber-200" />} /><UltraMetric label="2V2 READY" value="TEAM" hint="týmové zápasy jsou součástí feedu" icon={<Users className="h-4 w-4 text-cyan-200" />} /></div>

    <UltraSection title="SPORT UNIVERSE" kicker="DISCOVERY" icon={<PowerMark />}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{sportCounts.slice(0, 8).map((s) => <button key={s.id} onClick={() => setSport(s.id)} className={`group relative min-h-36 overflow-hidden rounded-2xl border p-4 text-left transition duration-300 hover:-translate-y-1 ${sport === s.id ? "border-amber-300/50 bg-amber-300/[.08] shadow-[0_0_45px_rgba(245,190,60,.12)]" : "border-white/10 bg-white/[.025] hover:border-white/20"}`}><div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-300/10 blur-2xl transition group-hover:bg-amber-300/20" /><div className="relative flex h-full flex-col justify-between"><div className="flex items-start justify-between"><span className="text-3xl">{s.emoji}</span><span className="font-mono text-[8px] uppercase tracking-[.2em] text-white/30">{s.count} MATCH</span></div><div><div className="font-display text-xl font-black tracking-wider text-white">{s.name}</div><div className="mt-1 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.18em] text-white/35">OPEN SPORT <ArrowUpRight className="h-3.5 w-3.5" /></div></div></div></button>)}</div></UltraSection>

    <UltraSection title="LIVE ARENA" kicker="NOW" icon={<Radio className="h-4 w-4 text-emerald-300" />} action={<UltraLinkButton href="/live">VSTOUPIT DO LIVE</UltraLinkButton>}>
      {live.length === 0 ? <EmptyState title="ŽÁDNÝ LIVE SIGNAL" text="Jakmile bude otevřený zápas, objeví se zde v reálném čase." /> : <div className="grid gap-3 lg:grid-cols-2">{live.map((m) => <MatchCard key={m.id} match={m} live />)}</div>}
    </UltraSection>

    <UltraSection title="RECENT RESULTS" kicker="FORM" icon={<BarChart3 className="h-4 w-4 text-cyan-200" />} action={<UltraLinkButton href="/rankings">SCOREBOARD</UltraLinkButton>}>
      {recent.length === 0 ? <EmptyState title="NO RESULTS" text="Dokončené zápasy se objeví po potvrzení výsledku." /> : <div className="grid gap-3 lg:grid-cols-2">{recent.map((m) => <MatchCard key={m.id} match={m} />)}</div>}
    </UltraSection>

    <UltraSection title="PLAN YOUR NEXT MATCH" kicker="SCHEDULE" icon={<CalendarDays className="h-4 w-4 text-amber-200" />}><div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]"><div className="relative overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[.08] to-transparent p-5"><div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-amber-200/10 blur-3xl" /><div className="relative"><div className="font-mono text-[8px] uppercase tracking-[.3em] text-amber-200/60">MATCH BUILDER</div><div className="mt-2 font-display text-2xl font-black tracking-wider">VYTVOŘ 1V1 / 2V2</div><p className="mt-2 max-w-md text-sm leading-6 text-white/40">Vyber sport, hráče a formát. Týmové 2v2 se automaticky propíše do týmových statistik.</p><div className="mt-4"><UltraLinkButton href="/schedule" primary>NAPLÁNOVAT ZÁPAS</UltraLinkButton></div></div></div><MiniPanel title="FORM" value="W / L" text="Sleduj aktuální sérii v scoreboardu." /><MiniPanel title="H2H" value="VS" text="Porovnej soupeře před dalším zápasem." /></div></UltraSection>
  </UltraArenaShell>;
}

function MatchCard({ match, live = false }: { match: Match; live?: boolean }) {
  const sport = SPORTS[match.sport];
  return <Link to="/match" search={{ id: match.id }} className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4 transition hover:-translate-y-0.5 hover:border-amber-300/25"><div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-300 via-amber-200/20 to-transparent" /><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="text-xl">{sport.emoji}</span><span className="font-mono text-[8px] uppercase tracking-[.22em] text-white/35">{sport.name}</span>{live ? <LiveBadge /> : <TimeBadge>RESULT</TimeBadge>}</div><span className="font-mono text-[8px] uppercase tracking-[.18em] text-white/25">{match.sets?.length ? `${match.sets.length} SETS` : "MATCH"}</span></div><div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><span className="truncate font-display text-lg font-black tracking-wide text-white">{match.teamA}</span><span className="rounded-xl border border-amber-300/20 bg-amber-300/[.06] px-3 py-2 font-mono text-lg font-black text-amber-100">{match.scoreA}:{match.scoreB}</span><span className="truncate text-right font-display text-lg font-black tracking-wide text-white">{match.teamB}</span></div><div className="mt-3 flex items-center justify-between text-[9px] uppercase tracking-[.18em] text-white/30"><span>{match.scheduledAt ? new Date(match.scheduledAt).toLocaleString("cs-CZ") : live ? "LIVE FEED" : "FINAL"}</span><ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></div></Link>;
}

function MiniPanel({ title, value, text }: { title: string; value: string; text: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="font-mono text-[8px] uppercase tracking-[.28em] text-white/30">{title}</div><div className="mt-2 font-display text-2xl font-black text-amber-100">{value}</div><div className="mt-2 text-sm leading-6 text-white/35">{text}</div></div>; }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="grid min-h-32 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[.015] p-6 text-center"><div><Zap className="mx-auto h-6 w-6 text-amber-200/60" /><div className="mt-2 font-mono text-[10px] font-black uppercase tracking-[.26em] text-white/35">{title}</div><div className="mt-1 max-w-md text-sm text-white/25">{text}</div></div></div>; }
