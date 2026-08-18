import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Crown, Flame, Medal, ShieldCheck, Sparkles, Trophy, Users, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAllMatches } from "@/lib/matches-db";
import { SPORT_LIST, SPORTS, type Match } from "@/lib/matches";

export const Route = createFileRoute("/leagues")({
  head: () => ({ meta: [{ title: "Leagues — SportChmeláci" }, { name: "description", content: "Ultra S+ sezóny, ligy, matchday a šampionát." }] }),
  component: LeaguesPage,
});

type Tab = "overview" | "table" | "matchday" | "form";

type Row = { key: string; label: string; played: number; wins: number; losses: number; points: number; form: string[] };

function LeaguesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [sport, setSport] = useState<string>("all");
  useEffect(() => { fetchAllMatches().then(setMatches).catch(() => setMatches([])); }, []);

  const completed = useMemo(() => matches.filter((m) => m.endedAt && (sport === "all" || m.sport === sport)), [matches, sport]);
  const upcoming = useMemo(() => matches.filter((m) => !m.endedAt && m.scheduledAt && (sport === "all" || m.sport === sport)).sort((a, b) => (a.scheduledAt! - b.scheduledAt!)).slice(0, 8), [matches, sport]);

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, Row>();
    const ensure = (name: string) => {
      const key = name.trim().toLowerCase();
      if (!map.has(key)) map.set(key, { key, label: name.trim(), played: 0, wins: 0, losses: 0, points: 0, form: [] });
      return map.get(key)!;
    };
    for (const m of completed) {
      const a = ensure(m.teamA), b = ensure(m.teamB);
      a.played++; b.played++;
      if (m.scoreA > m.scoreB) { a.wins++; a.points += 3; b.losses++; a.form.unshift("W"); b.form.unshift("L"); }
      else if (m.scoreB > m.scoreA) { b.wins++; b.points += 3; a.losses++; b.form.unshift("W"); a.form.unshift("L"); }
      else { a.points++; b.points++; a.form.unshift("D"); b.form.unshift("D"); }
    }
    return [...map.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || b.played - a.played);
  }, [completed]);

  const currentLeader = rows[0];
  const liveCount = matches.filter((m) => !m.endedAt).length;
  const teamMatches = matches.filter((m) => m.matchFormat === "2v2").length;

  return <main className="relative mx-auto max-w-[1450px] px-3 pb-28 pt-4 sm:px-5 lg:px-7">
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"><div className="absolute left-1/2 top-0 h-[620px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.14),transparent_65%)] blur-3xl" /><div className="absolute right-0 top-[35%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,.07),transparent_64%)] blur-3xl" /></div>
    <section className="relative overflow-hidden rounded-[32px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(14,17,21,.98),rgba(2,5,8,.99))] shadow-[0_35px_120px_-55px_rgba(250,204,21,.55)]">
      <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_30%,rgba(250,204,21,.12),transparent_24%),radial-gradient(circle_at_25%_80%,rgba(34,211,238,.06),transparent_28%)]" />
      <div className="relative grid gap-0 xl:grid-cols-[1fr_340px]">
        <div className="p-6 sm:p-9 lg:p-11"><div className="flex flex-wrap items-center gap-2"><span className="aaa-meta text-amber-200/80">SPORTCHMELÁCI · CHAMPIONSHIP HUB</span><span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[.2em] text-emerald-200">SEASON 01 · ACTIVE</span></div><h1 className="mt-5 font-display text-6xl font-black tracking-[.08em] text-white sm:text-7xl lg:text-8xl">CHMEL <span className="gold-text">LEAGUE</span></h1><p className="mt-4 max-w-2xl text-sm leading-7 text-white/40 sm:text-base">Dlouhodobé pořadí, matchday, forma a týmové 2v2 zápasy v jednom soutěžním centru.</p><div className="mt-7 flex flex-wrap gap-2"><Link to="/rankings" className="aaa-cta inline-flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-[.16em]"><Trophy className="h-4 w-4" /> Scoreboard</Link><Link to="/schedule" className="aaa-ghost inline-flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-[.16em]"><CalendarDays className="h-4 w-4" /> Matchday</Link></div></div>
        <aside className="border-t border-white/8 bg-black/20 p-6 sm:p-8 xl:border-l xl:border-t-0"><div className="aaa-meta text-cyan-200/70">SEASON SIGNAL</div><div className="mt-5 grid grid-cols-2 gap-2"><Metric label="PLAYERS" value={String(rows.length)} icon={<Users className="h-4 w-4" />} /><Metric label="LIVE" value={String(liveCount)} icon={<Zap className="h-4 w-4" />} /><Metric label="2V2" value={String(teamMatches)} icon={<ShieldCheck className="h-4 w-4" />} /><Metric label="LEADER" value={currentLeader?.label ?? "—"} icon={<Crown className="h-4 w-4" />} /></div><div className="mt-4 rounded-2xl border border-amber-300/12 bg-amber-300/[.03] p-4"><div className="aaa-meta">CURRENT CHAMPION SIGNAL</div><p className="mt-2 font-display text-2xl tracking-wide text-amber-100">{currentLeader?.label ?? "NO LEADER"}</p><p className="mt-1 text-[10px] text-white/25">{currentLeader ? `${currentLeader.points} league points · ${currentLeader.wins} wins` : "Waiting for completed matches"}</p></div></aside>
      </div>
    </section>

    <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 p-3"><div className="flex flex-wrap gap-1.5">{(["overview","table","matchday","form"] as Tab[]).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-[.18em] transition ${tab === t ? "bg-amber-300 text-black shadow-[0_0_25px_-12px_rgba(250,204,21,.9)]" : "text-white/35 hover:bg-white/[.03] hover:text-white"}`}>{t === "overview" ? "OVERVIEW" : t === "table" ? "TABLE" : t === "matchday" ? "MATCHDAY" : "FORM"}</button>)}</div><div className="flex flex-wrap gap-1.5">{[{id:"all",name:"Vše"},...SPORT_LIST].map((s) => <button key={s.id} onClick={() => setSport(s.id)} className={`rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-[.16em] ${sport === s.id ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-200" : "border-white/8 text-white/25 hover:text-white/60"}`}>{s.name}</button>)}</div></section>

    {tab === "overview" && <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
      <div className="rounded-[24px] border border-white/8 bg-black/20 p-5"><Section title="CHAMPIONSHIP TABLE" icon={<Trophy className="h-4 w-4" />}><div className="mt-4 space-y-2">{rows.slice(0, 8).map((r, i) => <TableRow key={r.key} rank={i+1} row={r} />)}{rows.length===0&&<Empty text="No standings yet."/>}</div></Section></div>
      <div className="rounded-[24px] border border-white/8 bg-black/20 p-5"><Section title="NEXT MATCHDAY" icon={<CalendarDays className="h-4 w-4" />}><div className="mt-4 space-y-2">{upcoming.slice(0,6).map((m) => <Link key={m.id} to="/match" search={{id:m.id}} className="group block rounded-2xl border border-white/8 bg-white/[.02] p-3 hover:border-amber-300/25"><div className="flex items-center justify-between gap-3"><div><div className="font-display text-base tracking-wide text-white">{m.teamA} <span className="text-white/20">VS</span> {m.teamB}</div><div className="aaa-meta mt-1">{SPORTS[m.sport].name} · {m.matchFormat === "2v2" ? "2V2 · TEAM" : "1V1"}</div></div><div className="font-mono text-[9px] text-amber-200">{new Date(m.scheduledAt!).toLocaleString("cs-CZ", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div></div></Link>)}{upcoming.length===0&&<Empty text="No upcoming matches."/>}</div></Section></div>
    </div>}

    {tab === "table" && <section className="mt-4 rounded-[24px] border border-white/8 bg-black/20 p-5"><Section title="OFFICIAL TABLE" icon={<Medal className="h-4 w-4" />}><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b border-white/8 text-[9px] uppercase tracking-[.2em] text-white/25"><th className="px-3 py-3 text-left">#</th><th className="px-3 py-3 text-left">PLAYER / TEAM</th><th className="px-3 py-3 text-right">P</th><th className="px-3 py-3 text-right">W</th><th className="px-3 py-3 text-right">L</th><th className="px-3 py-3 text-right">PTS</th><th className="px-3 py-3 text-right">FORM</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.key} className="border-b border-white/5 hover:bg-white/[.02]"><td className="px-3 py-3 font-mono text-white/25">{String(i+1).padStart(2,"0")}</td><td className="px-3 py-3 font-display text-base text-white">{r.label}</td><td className="px-3 py-3 text-right font-mono text-white/45">{r.played}</td><td className="px-3 py-3 text-right font-mono text-emerald-200">{r.wins}</td><td className="px-3 py-3 text-right font-mono text-rose-200">{r.losses}</td><td className="px-3 py-3 text-right font-display text-xl text-amber-200">{r.points}</td><td className="px-3 py-3 text-right"> <div className="flex justify-end gap-1">{r.form.slice(0,6).map((f,j)=><span key={j} className={`grid h-6 w-6 place-items-center rounded-md border text-[8px] font-black ${f === "W" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-rose-300/20 bg-rose-300/10 text-rose-200"}`}>{f}</span>)}</div></td></tr>)}</tbody></table></div></Section></section>}

    {tab === "matchday" && <section className="mt-4 rounded-[24px] border border-white/8 bg-black/20 p-5"><Section title="MATCHDAY 01 → CURRENT" icon={<Flame className="h-4 w-4" />}><div className="mt-4 grid gap-2 md:grid-cols-2">{[...completed.slice(-6).reverse(), ...upcoming].slice(0,12).map((m)=><Link key={m.id} to="/match" search={{id:m.id}} className="group rounded-2xl border border-white/8 bg-white/[.02] p-4 hover:-translate-y-0.5 hover:border-amber-300/25"><div className="flex items-center justify-between"><span className="aaa-meta">{SPORTS[m.sport].emoji} {SPORTS[m.sport].name}</span><span className={`font-mono text-[8px] uppercase tracking-[.16em] ${m.endedAt ? "text-white/25" : "text-emerald-200"}`}>{m.endedAt ? "FINAL" : "UPCOMING"}</span></div><div className="mt-3 font-display text-lg tracking-wide text-white">{m.teamA} <span className="text-white/20">VS</span> {m.teamB}</div><div className="mt-2 flex items-center justify-between text-[10px] text-white/25"><span>{m.matchFormat === "2v2" ? "2V2 · TEAM" : "1V1"}</span><span>{m.endedAt ? `${m.scoreA}:${m.scoreB}` : new Date(m.scheduledAt!).toLocaleString("cs-CZ", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span></div></Link>)}</div></Section></section>}

    {tab === "form" && <section className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.slice(0,9).map((r)=><div key={r.key} className="rounded-[24px] border border-white/8 bg-black/20 p-5"><div className="aaa-meta">FORM ENGINE</div><div className="mt-2 font-display text-2xl tracking-wide text-white">{r.label}</div><div className="mt-4 flex gap-1.5">{r.form.slice(0,8).map((f,i)=><span key={i} className={`grid h-9 w-9 place-items-center rounded-lg border text-[10px] font-black ${f === "W" ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200" : "border-rose-300/20 bg-rose-300/10 text-rose-200"}`}>{f}</span>)}</div><div className="mt-4 flex items-center justify-between text-[10px] text-white/25"><span>{r.wins}W / {r.losses}L</span><span>{r.points} PTS</span></div></div>)}{rows.length===0&&<Empty text="Form engine is waiting for results."/>}</section>}
  </main>;
}
function Metric({label,value,icon}:{label:string;value:string;icon:React.ReactNode}){return <div className="rounded-xl border border-white/8 bg-black/20 p-3"><div className="flex items-center gap-2 text-white/20">{icon}<span className="font-mono text-[8px] tracking-[.18em]">{label}</span></div><div className="mt-2 truncate font-display text-lg tracking-wide text-white">{value}</div></div>}
function Section({title,icon,children}:{title:string;icon:React.ReactNode;children:React.ReactNode}){return <><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl border border-amber-300/15 bg-amber-300/5 text-amber-200">{icon}</span><h2 className="font-display text-xl tracking-[.12em] text-white">{title}</h2></div>{children}</>}
function TableRow({rank,row}:{rank:number;row:Row}){return <div className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[.02] p-3 hover:border-amber-300/25"><div className="grid h-9 w-9 place-items-center rounded-xl border border-white/8 bg-black/20 font-mono text-[9px] text-white/30">{String(rank).padStart(2,"0")}</div><div className="min-w-0 flex-1"><div className="truncate font-display text-lg text-white">{row.label}</div><div className="aaa-meta">{row.played} played · {row.wins} wins</div></div><div className="text-right"><div className="font-display text-xl text-amber-200">{row.points}</div><div className="aaa-meta">PTS</div></div></div>}
function Empty({text}:{text:string}){return <div className="rounded-2xl border border-dashed border-white/8 p-8 text-center text-xs text-white/20">{text}</div>}
