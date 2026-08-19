import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, Plus, ShieldCheck, Sparkles, Trash2, UserPlus, Users, X, Zap, Trophy, Swords, Gauge, Flame, BarChart3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { fetchAllTeams, createTeam, deleteTeam, addMemberByNickname, removeMember, type Team } from "@/lib/teams-db";
import { fetchAllMatches } from "@/lib/matches-db";
import type { Match } from "@/lib/matches";
import { useNicknames, NicknamesDatalist, NICKNAMES_DATALIST_ID } from "@/lib/nicknames";

export const Route = createFileRoute("/teams")({
  head: () => ({ meta: [{ title: "Team HQ — SportChmeláci" }, { name: "description", content: "Ultra S+ týmové centrum pro 1v1, 2v2 a sportovní ligy." }] }),
  component: TeamsPage,
});

function TeamsPage() {
  const { user, loading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = async () => {
    try {
      const [nextTeams, nextMatches] = await Promise.all([fetchAllTeams(), fetchAllMatches()]);
      setTeams(nextTeams);
      setMatches(nextMatches);
    } catch (e) { setErr((e as Error).message); }
  };
  useEffect(() => { if (user) void reload(); }, [user]);

  const stats = useMemo(() => {
    const teamResults = teams.map((team) => teamPerformance(team, matches));
    return {
      squads: teams.length,
      members: teams.reduce((sum, t) => sum + t.members.length, 0),
      captains: new Set(teams.map((t) => t.ownerId)).size,
      active: teamResults.filter((x) => x.matches > 0).length,
    };
  }, [teams, matches]);

  if (loading) return null;
  if (!user) return <main className="min-h-screen px-4 py-12"><div className="mx-auto max-w-xl rounded-3xl border border-amber-300/15 bg-black/30 p-8 text-center backdrop-blur-xl"><ShieldCheck className="mx-auto h-8 w-8 text-amber-200" /><h1 className="mt-4 font-display text-4xl text-white">TEAM HQ</h1><p className="mt-2 text-sm text-white/35">Přihlas se a vytvoř svůj tým.</p><Link to="/auth" className="mt-6 inline-flex rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-black">PŘIHLÁSIT</Link></div></main>;

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try { await createTeam(user!.id, name.trim()); setName(""); await reload(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return <main className="relative mx-auto max-w-[1450px] px-3 pb-28 pt-4 sm:px-5 lg:px-7">
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"><div className="absolute left-1/2 top-0 h-[620px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.12),transparent_64%)] blur-3xl" /><div className="absolute right-0 top-[35%] h-[600px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,.08),transparent_64%)] blur-3xl" /></div>
    <section className="relative overflow-hidden rounded-[32px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(9,12,17,.98),rgba(2,5,8,.99))] shadow-[0_40px_130px_-65px_rgba(250,204,21,.6)]">
      <div className="absolute inset-0 opacity-[.08] [background-image:linear-gradient(rgba(255,255,255,.3)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.3)_1px,transparent_1px)] [background-size:40px_40px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_20%,rgba(34,211,238,.12),transparent_26%),radial-gradient(circle_at_20%_80%,rgba(250,204,21,.10),transparent_25%)]" />
      <div className="relative grid gap-0 xl:grid-cols-[1fr_420px]">
        <div className="p-6 sm:p-9 lg:p-11"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[9px] font-black tracking-[.35em] text-amber-200/75">SPORTCHMELÁCI · TEAM OPERATIONS</span><span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[.2em] text-emerald-200">2V2 READY</span></div><h1 className="mt-5 font-display text-6xl font-black tracking-[.07em] text-white sm:text-7xl lg:text-8xl">TEAM <span className="text-amber-200 [text-shadow:0_0_35px_rgba(250,204,21,.22)]">HQ</span></h1><p className="mt-4 max-w-2xl text-sm leading-7 text-white/40 sm:text-base">Sestav soupisku, sleduj týmovou formu, ELO signal a historii 2v2 battle. Team HQ je teď skutečný competitive command center.</p><div className="mt-7 flex flex-wrap gap-2"><a href="#roster" className="inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-[10px] font-black uppercase tracking-[.18em] text-black shadow-[0_0_35px_-14px_rgba(250,204,21,.9)]"><Users className="h-4 w-4" /> ROSTER GRID</a><Link to="/rankings" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-5 py-3 text-[10px] font-black uppercase tracking-[.18em] text-white/70 hover:border-cyan-300/30 hover:text-white"><BarChart3 className="h-4 w-4" /> SCOREBOARD</Link><Link to="/leagues" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.03] px-5 py-3 text-[10px] font-black uppercase tracking-[.18em] text-white/70 hover:border-amber-300/30 hover:text-white"><Crown className="h-4 w-4" /> CHMEL LEAGUE</Link></div></div>
        <aside className="border-t border-white/8 bg-black/20 p-6 sm:p-8 xl:border-l xl:border-t-0"><div className="font-mono text-[9px] font-bold tracking-[.3em] text-cyan-200/70">TEAM SIGNAL</div><div className="mt-5 grid grid-cols-2 gap-2"><Stat label="SQUADS" value={String(stats.squads)} /><Stat label="MEMBERS" value={String(stats.members)} /><Stat label="CAPTAINS" value={String(stats.captains)} /><Stat label="ACTIVE" value={String(stats.active)} /></div><div className="mt-4 rounded-2xl border border-cyan-300/12 bg-cyan-300/[.03] p-4"><div className="font-mono text-[8px] font-black tracking-[.2em] text-cyan-200/55">COMPETITIVE GRID</div><div className="mt-2 flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,.9)]" /><span className="font-display text-2xl text-emerald-200">ONLINE</span></div><p className="mt-1 text-[10px] leading-5 text-white/25">Týmové statistiky jsou odvozené pouze z dokončených zápasů v existujícím match feedu.</p></div></aside>
      </div>
    </section>

    <section className="mt-4 rounded-3xl border border-white/8 bg-black/25 p-4 sm:p-5" id="roster"><form onSubmit={submitCreate} className="relative flex flex-col gap-2 sm:flex-row"><div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_10%_50%,rgba(250,204,21,.08),transparent_30%)]" /><div className="relative flex-1"><div className="mb-2 font-mono text-[8px] font-black tracking-[.25em] text-white/30">NEW SQUAD</div><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Název nového týmu" className="w-full rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300/40 focus:bg-amber-300/[.02]" maxLength={60} /></div><button disabled={busy} className="relative mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-black disabled:opacity-50"><Plus className="h-4 w-4" /> VYTVOŘIT TÝM</button></form>{err && <p className="mt-3 rounded-xl border border-rose-300/15 bg-rose-300/[.04] px-3 py-2 text-xs text-rose-200">{err}</p>}</section>

    <NicknamesList />
    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      {teams.map((team, index) => <TeamCard key={team.id} team={team} currentUserId={user.id} onChange={reload} matches={matches} index={index} />)}
      {teams.length === 0 && <div className="lg:col-span-2 rounded-3xl border border-white/8 bg-black/20 p-12 text-center"><Sparkles className="mx-auto h-8 w-8 text-amber-200/60" /><div className="mt-4 font-display text-3xl text-white/60">NO SQUADS</div><p className="mt-2 text-sm text-white/25">Vytvoř první tým a připrav ho na další 2v2 battle.</p></div>}
    </section>
  </main>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/8 bg-black/20 p-3 text-center"><div className="font-mono text-[8px] font-black tracking-[.18em] text-white/25">{label}</div><div className="mt-2 font-display text-2xl text-white">{value}</div></div>; }
function NicknamesList() { const nicknames = useNicknames(); return <NicknamesDatalist options={nicknames} />; }

function TeamCard({ team, currentUserId, onChange, index, matches }: { team: Team; currentUserId: string; onChange: () => void; index: number; matches: Match[] }) {
  const isOwner = team.ownerId === currentUserId;
  const [nick, setNick] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const performance = teamPerformance(team, matches);
  async function add(e: React.FormEvent) { e.preventDefault(); if (!nick.trim()) return; setBusy(true); setErr(null); try { await addMemberByNickname(team.id, nick.trim()); setNick(""); onChange(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } }
  return <article className="group relative overflow-hidden rounded-[28px] border border-white/8 bg-[linear-gradient(135deg,rgba(15,18,24,.98),rgba(3,6,10,.98))] p-5 shadow-[0_30px_90px_-55px_rgba(0,0,0,.9)] transition hover:-translate-y-1 hover:border-amber-300/20">
    <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(circle_at_85%_15%,rgba(250,204,21,.08),transparent_30%)]" />
    <div className="relative flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 font-display text-lg text-amber-200">{String(index + 1).padStart(2,"0")}</span><div><h2 className="font-display text-2xl tracking-wide text-white">{team.name}</h2><p className="font-mono text-[8px] uppercase tracking-[.2em] text-white/25">CAPTAIN · {team.ownerNickname}</p></div></div></div>{isOwner && <button onClick={async()=>{if(confirm(`Smazat tým „${team.name}“?`)){await deleteTeam(team.id);onChange();}}} className="grid h-9 w-9 place-items-center rounded-xl border border-white/8 text-white/25 hover:border-rose-300/30 hover:text-rose-200" title="Smazat tým"><Trash2 className="h-4 w-4" /></button>}</div>
    <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4"><Mini label="ELO" value={String(performance.elo)} icon={<Gauge className="h-3.5 w-3.5" />} tone="gold"/><Mini label="W / L" value={`${performance.wins} / ${performance.losses}`} icon={<Swords className="h-3.5 w-3.5" />} tone="cyan"/><Mini label="WIN %" value={`${performance.winRate}%`} icon={<Trophy className="h-3.5 w-3.5" />} tone="gold"/><Mini label="STREAK" value={`${performance.streak}W`} icon={<Flame className="h-3.5 w-3.5" />} tone="cyan"/></div>
    <div className="relative mt-4 rounded-2xl border border-white/8 bg-white/[.02] p-3"><div className="flex items-center justify-between"><div className="font-mono text-[8px] font-black tracking-[.2em] text-white/25">TEAM FORM</div><div className="flex gap-1">{performance.form.length ? performance.form.map((x,i)=><span key={i} className={`grid h-6 w-6 place-items-center rounded-md border text-[8px] font-black ${x==='W'? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200' : 'border-rose-300/20 bg-rose-300/10 text-rose-200'}`}>{x}</span>) : <span className="text-[9px] text-white/20">NO MATCH DATA</span>}</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-black/60"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300" style={{width:`${performance.winRate}%`}} /></div></div>
    <div className="relative mt-4 flex items-center justify-between"><div className="font-mono text-[8px] font-black tracking-[.22em] text-white/25">ROSTER · {team.members.length}/4</div><div className="flex -space-x-2">{team.members.slice(0,4).map(m=><div key={m.id} className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#06080b] bg-amber-300/10 font-mono text-[9px] text-amber-100" title={m.nickname}>{m.nickname.slice(0,2).toUpperCase()}</div>)}{team.members.length===0&&<div className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-white/10 text-white/20"><Users className="h-4 w-4" /></div>}</div></div>
    {team.members.length>0&&<ul className="relative mt-4 grid gap-2 sm:grid-cols-2">{team.members.map(m=><li key={m.id} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[.02] px-3 py-2"><span className="flex items-center gap-2 text-xs text-white/70"><span className="grid h-6 w-6 place-items-center rounded-lg bg-cyan-300/10 text-[9px] font-black text-cyan-200">{m.nickname.slice(0,1).toUpperCase()}</span>{m.nickname}</span>{isOwner&&<button onClick={async()=>{await removeMember(m.id);onChange();}} className="text-white/20 hover:text-rose-200" title="Odebrat"><X className="h-3.5 w-3.5" /></button>}</li>)}</ul>}
    {isOwner&&team.members.length<4&&<form onSubmit={add} className="relative mt-4 flex gap-2"><input value={nick} onChange={e=>setNick(e.target.value)} list={NICKNAMES_DATALIST_ID} placeholder="Přidat hráče…" className="min-w-0 flex-1 rounded-xl border border-white/8 bg-white/[.03] px-3 py-2 text-xs text-white outline-none focus:border-cyan-300/30" /><button disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-bold text-cyan-200 disabled:opacity-50"><UserPlus className="h-3.5 w-3.5" /> ADD</button></form>}
    {err&&<p className="relative mt-2 text-xs text-rose-200">{err}</p>}
    <div className="relative mt-4 flex items-center justify-between border-t border-white/8 pt-3"><div className="flex items-center gap-1.5 text-[9px] text-white/25"><Zap className="h-3.5 w-3.5 text-amber-200/70" /> {performance.matches ? `${performance.matches} MATCH${performance.matches===1?"":"ES"}` : "2V2 READY"}</div><div className="flex gap-3"><Link to="/rankings" className="font-mono text-[8px] font-black tracking-[.2em] text-cyan-200/70 hover:text-cyan-200">RANKING</Link><Link to="/leagues" className="font-mono text-[8px] font-black tracking-[.2em] text-amber-200/70 hover:text-amber-200">LEAGUE →</Link></div></div>
  </article>;
}

function Mini({ label, value, icon, tone }: { label:string; value:string; icon:React.ReactNode; tone:"gold"|"cyan" }) { return <div className={`rounded-xl border p-2.5 ${tone==='gold'? 'border-amber-300/12 bg-amber-300/[.03]' : 'border-cyan-300/12 bg-cyan-300/[.03]'}`}><div className="flex items-center justify-between"><span className="font-mono text-[7px] font-black tracking-[.15em] text-white/25">{label}</span><span className={tone==='gold'?'text-amber-200/70':'text-cyan-200/70'}>{icon}</span></div><div className="mt-1 font-display text-lg text-white">{value}</div></div>; }

function teamPerformance(team: Team, matches: Match[]) {
  const names = new Set([team.ownerNickname, ...team.members.map((m) => m.nickname)].map((x) => x.trim().toLowerCase()));
  const relevant = matches.filter((m) => !!m.endedAt && m.matchFormat === "2v2" && [m.teamA, m.teamB].some((side) => names.has(side.trim().toLowerCase()) || side.split(/\s*(?:&|\/|,|\+| and )\s*/i).some((part) => names.has(part.trim().toLowerCase()))));
  let wins = 0;
  let losses = 0;
  const form: string[] = [];
  for (const m of relevant.slice(0, 10)) {
    const aNames = m.teamA.split(/\s*(?:&|\/|,|\+| and )\s*/i).map((x)=>x.trim().toLowerCase()).filter(Boolean);
    const bNames = m.teamB.split(/\s*(?:&|\/|,|\+| and )\s*/i).map((x)=>x.trim().toLowerCase()).filter(Boolean);
    const sideA = aNames.some((x) => names.has(x));
    const sideB = bNames.some((x) => names.has(x));
    if (!sideA && !sideB) continue;
    const teamScore = sideA ? m.scoreA : m.scoreB;
    const oppScore = sideA ? m.scoreB : m.scoreA;
    if (teamScore > oppScore) { wins++; form.push("W"); } else if (teamScore < oppScore) { losses++; form.push("L"); }
  }
  let streak = 0;
  for (const x of form) { if (x === "W") streak++; else break; }
  const total = wins + losses;
  const winRate = total ? Math.round((wins / total) * 100) : 0;
  const elo = 1000 + wins * 32 - losses * 22;
  return { wins, losses, matches: total, winRate, streak, elo, form: form.slice(0, 6) };
}
