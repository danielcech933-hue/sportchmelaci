import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { ArrowLeft, BarChart3, CalendarClock, ChevronRight, CircleDot, Crown, Flame, Gauge, Radio, Shield, Sparkles, Swords, Trophy, Users, Zap } from "lucide-react";
import { SPORTS, type Match } from "@/lib/matches";
import { fetchMatch, fetchAllMatches, saveMatch, removeMatch } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { useNicknames, NicknamesDatalist, NICKNAMES_DATALIST_ID } from "@/lib/nicknames";
import { useMatchesRealtime, LiveBadge } from "@/lib/live";
import { NickLink } from "@/lib/profile-links";
import { BettingModule } from "@/components/BettingModule";

const searchSchema = z.object({ id: z.string() });
export const Route = createFileRoute("/match")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Match Center — SportChmeláci" }, { name: "description", content: "Ultra S+ live match center SportChmeláci." }, { name: "robots", content: "noindex" }] }),
  component: MatchPage,
});

function MatchPage() {
  const { id } = Route.useSearch();
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const nicknames = useNicknames();
  const [match, setMatch] = useState<Match | null>(null);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    fetchMatch(id).then((m) => m ? setMatch(m) : setNotFound(true)).catch((e) => setActionError(e instanceof Error ? e.message : "Zápas se nepodařilo načíst."));
    fetchAllMatches().then(setAllMatches).catch(() => setAllMatches([]));
  }, [id]);

  useMatchesRealtime(() => { if (!dirty.current) fetchMatch(id).then((m) => m && setMatch(m)).catch(() => undefined); }, { matchId: id });
  useEffect(() => { if (!match || !dirty.current) return; const t = setTimeout(() => { dirty.current = false; saveMatch(match).catch((e) => console.error("save failed", e)); }, 400); return () => clearTimeout(t); }, [match]);

  if (notFound) return <main className="mx-auto max-w-6xl px-4 py-16 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/5 text-amber-200"><Shield className="h-7 w-7" /></div><h1 className="mt-5 font-display text-4xl tracking-wider text-amber-100">MATCH NOT FOUND</h1><p className="mt-2 text-white/35">Tento zápas už není dostupný.</p><Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-xl border border-amber-300/20 px-4 py-2 text-xs font-black uppercase tracking-[.18em] text-amber-200 hover:bg-amber-300/10"><ArrowLeft className="h-4 w-4" /> Lobby</Link></main>;
  if (!match || authLoading) return null;

  const cfg = SPORTS[match.sport];
  const isOwner = !!user && user.id === match.ownerId;
  const ended = !!match.endedAt;
  const live = !ended;
  const setsA = match.sets.filter((s) => s.a > s.b).length;
  const setsB = match.sets.filter((s) => s.b > s.a).length;
  const currentTotal = match.scoreA + match.scoreB;
  const teamAPlayers = match.teamAPlayers ?? splitPlayers(match.teamA);
  const teamBPlayers = match.teamBPlayers ?? splitPlayers(match.teamB);

  const h2h = useMemo(() => {
    const keyA = match.teamA.trim().toLowerCase();
    const keyB = match.teamB.trim().toLowerCase();
    return allMatches.filter((m) => m.id !== match.id && m.endedAt && m.sport === match.sport && ((m.teamA.trim().toLowerCase() === keyA && m.teamB.trim().toLowerCase() === keyB) || (m.teamA.trim().toLowerCase() === keyB && m.teamB.trim().toLowerCase() === keyA))).slice(0, 8);
  }, [allMatches, match]);

  const form = useMemo(() => {
    const items = allMatches.filter((m) => m.endedAt && m.sport === match.sport && (m.teamA === match.teamA || m.teamB === match.teamA || m.teamA === match.teamB || m.teamB === match.teamB)).slice(0, 6);
    return items.map((m) => { const isA = m.teamA === match.teamA || m.teamA === match.teamB; const scoreFor = isA ? m.scoreA : m.scoreB; const scoreAgainst = isA ? m.scoreB : m.scoreA; return scoreFor > scoreAgainst ? "W" : scoreFor < scoreAgainst ? "L" : "D"; });
  }, [allMatches, match]);

  function update(next: Match) { dirty.current = true; setActionError(null); setMatch(next); }
  const bump = (side: "a" | "b", delta: number) => { if (!isOwner || ended) return; const key = side === "a" ? "scoreA" : "scoreB"; update({ ...match, [key]: Math.max(0, match[key] + delta) }); };
  const finishSet = () => { if (!isOwner || ended) return; update({ ...match, sets: [...match.sets, { a: match.scoreA, b: match.scoreB }], scoreA: 0, scoreB: 0 }); };
  const resetScore = () => isOwner && !ended && update({ ...match, scoreA: 0, scoreB: 0 });
  const finishMatch = async () => {
    if (!isOwner || finishBusy || ended) return;
    setActionError(null); setFinishBusy(true); const next = { ...match, endedAt: Date.now() }; setMatch(next); dirty.current = false;
    try { await saveMatch(next); const persisted = await fetchMatch(match.id); if (!persisted?.endedAt) throw new Error("Zápas se nepodařilo v databázi označit jako ukončený. Zkus to znovu."); setMatch(persisted); navigate({ to: "/admin", hash: "pending-approvals" }); }
    catch (e) { setActionError(e instanceof Error ? e.message : "Ukončení zápasu se nepodařilo."); const persisted = await fetchMatch(match.id).catch(() => null); if (persisted) setMatch(persisted); }
    finally { setFinishBusy(false); }
  };
  const remove = async () => { if (!isOwner || !confirm("Delete this match? Any open bets will be refunded.")) return; await removeMatch(match.id); navigate({ to: "/" }); };

  return <main className="relative mx-auto max-w-[1450px] px-3 pb-28 pt-4 sm:px-5 lg:px-7">
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"><div className="absolute left-1/2 top-0 h-[650px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.12),transparent_64%)] blur-3xl" /><div className="absolute right-0 top-[35%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,.05),transparent_62%)] blur-3xl" /></div>

    <div className="mb-3 flex items-center justify-between gap-3"><Link to="/" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[9px] font-black uppercase tracking-[.2em] text-white/45 hover:border-amber-300/25 hover:text-amber-200"><ArrowLeft className="h-3.5 w-3.5" /> Lobby</Link><div className="flex items-center gap-2"><span className="rounded-full border border-amber-300/15 bg-amber-300/5 px-3 py-1 font-mono text-[8px] uppercase tracking-[.24em] text-amber-200/55">MATCH CENTER · {match.matchFormat === "2v2" ? "2V2" : "1V1"}</span>{live && <LiveBadge />}</div></div>

    <section className="relative overflow-hidden rounded-[30px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(15,18,22,.98),rgba(3,6,9,.99))] shadow-[0_35px_120px_-55px_rgba(250,204,21,.55)]">
      <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(250,204,21,.15),transparent_28%)]" />
      <div className="relative grid gap-0 xl:grid-cols-[1fr_320px]">
        <div className="p-5 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2"><span className="aaa-meta text-amber-200/75">{cfg.emoji} {cfg.name}</span>{match.matchFormat === "2v2" && <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[.2em] text-cyan-200">2V2 · TÝMOVÝ ZÁPAS</span>}<span className="rounded-full border border-white/10 bg-white/[.03] px-2.5 py-1 font-mono text-[8px] uppercase tracking-[.2em] text-white/30">BY {match.ownerNickname}</span></div>
          <div className="mt-5 flex flex-col items-center gap-6 sm:mt-8 sm:gap-8">
            <div className="grid w-full max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8">
              <TeamHero align="right" title={match.teamA} players={teamAPlayers} accent="gold" />
              <div className="text-center"><div className="font-mono text-[9px] font-black uppercase tracking-[.35em] text-white/25">{ended ? "FINAL" : "LIVE"}</div><div className="mt-2 font-display text-4xl font-black tracking-[.08em] text-white sm:text-6xl md:text-7xl">{match.scoreA}<span className="mx-2 text-white/15 sm:mx-4">:</span>{match.scoreB}</div>{cfg.hasSets && <div className="mt-2 font-mono text-[9px] uppercase tracking-[.25em] text-amber-200/55">{cfg.setLabel.toUpperCase()} {setsA}:{setsB}</div>}</div>
              <TeamHero title={match.teamB} players={teamBPlayers} accent="cyan" />
            </div>
            {cfg.hasSets && <div className="flex flex-wrap items-center justify-center gap-2"><span className="aaa-meta">SET HISTORY</span>{match.sets.map((s,i)=><span key={i} className="rounded-lg border border-white/10 bg-white/[.03] px-3 py-1.5 font-mono text-[10px] text-white/55">{s.a}–{s.b}</span>)}{match.sets.length===0&&<span className="text-[10px] text-white/20">No completed sets</span>}</div>}
          </div>
        </div>

        <aside className="border-t border-white/8 bg-black/20 p-5 sm:p-7 xl:border-l xl:border-t-0">
          <div className="aaa-meta text-cyan-200/70">LIVE CONTROL DECK</div>
          <div className="mt-5 grid grid-cols-2 gap-2"><DeckStat label="STATUS" value={ended?"ENDED":"LIVE"} icon={<Radio className="h-3.5 w-3.5" />} live={!ended}/><DeckStat label="TOTAL SCORE" value={String(currentTotal)} icon={<Gauge className="h-3.5 w-3.5" />} /></div>
          <div className="mt-3 rounded-2xl border border-amber-300/12 bg-amber-300/[.03] p-4"><div className="aaa-meta">FORM SIGNAL</div><div className="mt-3 flex gap-1.5">{form.length?form.map((x,i)=><span key={i} className={`grid h-7 w-7 place-items-center rounded-lg border text-[9px] font-black ${x==="W"?"border-emerald-300/25 bg-emerald-300/10 text-emerald-200":x==="L"?"border-rose-300/25 bg-rose-300/10 text-rose-200":"border-white/10 bg-white/[.03] text-white/35"}`}>{x}</span>):<span className="text-[9px] text-white/20">NO FORM DATA</span>}</div></div>
          <div className="mt-3 rounded-2xl border border-white/8 bg-white/[.02] p-4"><div className="aaa-meta">MATCH SIGNAL</div><div className="mt-3 space-y-2"><Signal icon={<Swords className="h-3.5 w-3.5" />} label="FORMAT" value={match.matchFormat === "2v2" ? "TEAM BATTLE" : "SOLO DUEL"} /><Signal icon={<Sparkles className="h-3.5 w-3.5" />} label="SPORT" value={cfg.name.toUpperCase()} /><Signal icon={<CalendarClock className="h-3.5 w-3.5" />} label="STARTED" value={new Date(match.startedAt).toLocaleString("cs-CZ", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })} /></div></div>
          {isOwner && <div className="mt-4 grid gap-2"><Link to="/live" search={{ id: match.id }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-[10px] font-black uppercase tracking-[.16em] text-black shadow-[0_0_28px_-12px_rgba(250,204,21,.9)]"><Radio className="h-4 w-4" /> Live rozhodčí</Link></div>}
        </aside>
      </div>
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
      <div className="rounded-[24px] border border-white/8 bg-black/20 p-4 sm:p-5">
        <SectionHead icon={<Users className="h-4 w-4" />} kicker="LINEUPS" title="TÝMY & HRÁČI" />
        {match.matchFormat === "2v2" ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><LineupCard label="TEAM A" players={teamAPlayers} accent="gold" /><LineupCard label="TEAM B" players={teamBPlayers} accent="cyan" /></div> : <div className="mt-4 grid gap-3 sm:grid-cols-2"><LineupCard label="PLAYER A" players={teamAPlayers} accent="gold" /><LineupCard label="PLAYER B" players={teamBPlayers} accent="cyan" /></div>}
      </div>
      <div className="rounded-[24px] border border-white/8 bg-black/20 p-4 sm:p-5">
        <SectionHead icon={<Swords className="h-4 w-4" />} kicker="HEAD TO HEAD" title="H2H ARCHIVE" />
        {h2h.length ? <div className="mt-4 space-y-2">{h2h.map((m)=><Link key={m.id} to="/match" search={{id:m.id}} className="group flex items-center justify-between rounded-xl border border-white/8 bg-white/[.02] px-3 py-2.5 hover:border-amber-300/20"><div className="min-w-0"><div className="truncate font-display text-sm text-white/75">{m.teamA} <span className="text-white/20">vs</span> {m.teamB}</div><div className="aaa-meta mt-1">{new Date(m.endedAt!).toLocaleDateString("cs-CZ")}</div></div><span className="font-mono text-sm font-black text-amber-200">{m.scoreA}:{m.scoreB}</span><ChevronRight className="h-3.5 w-3.5 text-white/20 transition group-hover:text-amber-200" /></Link>)}</div> : <Empty text="Žádné předchozí přímé střety v této disciplíně." />}
      </div>
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-[24px] border border-white/8 bg-black/20 p-4 sm:p-5">
        <SectionHead icon={<BarChart3 className="h-4 w-4" />} kicker="MATCH TELEMETRY" title="MOMENTUM" />
        <div className="mt-5 h-44 rounded-2xl border border-white/8 bg-black/30 p-4"><div className="flex h-full items-end gap-2">{buildMomentum(match, 18).map((h,i)=><div key={i} className="group relative flex-1"><div className={`${i%2===0?"bg-amber-300/75":"bg-cyan-300/60"} mx-auto rounded-t-md shadow-[0_0_16px_-8px_rgba(250,204,21,.9)] transition-all duration-300 group-hover:brightness-125`} style={{height:`${h}%`}} /></div>)}</div></div>
        <div className="mt-3 flex justify-between font-mono text-[8px] uppercase tracking-[.2em] text-white/20"><span>START</span><span>LIVE FLOW</span><span>{ended?"FINAL":"NOW"}</span></div>
      </div>
      <div className="rounded-[24px] border border-white/8 bg-black/20 p-4 sm:p-5">
        <SectionHead icon={<Trophy className="h-4 w-4" />} kicker="MATCH TELEMETRY" title="KEY NUMBERS" />
        <div className="mt-4 grid grid-cols-2 gap-2"><NumberCard label="A SCORE" value={match.scoreA} tone="gold" /><NumberCard label="B SCORE" value={match.scoreB} tone="cyan" /><NumberCard label="A SETS" value={setsA} tone="gold" /><NumberCard label="B SETS" value={setsB} tone="cyan" /></div>
      </div>
    </section>

    {actionError && <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/5 p-4 text-sm text-rose-200">{actionError}</div>}
    {!isOwner && <div className="mt-4 rounded-2xl border border-white/8 bg-white/[.02] p-3 text-center text-[10px] font-mono uppercase tracking-[.2em] text-white/30">Spectator mode · score controls are available to the match owner.</div>}

    <section className="mt-4 rounded-[24px] border border-amber-300/12 bg-[linear-gradient(180deg,rgba(250,204,21,.025),rgba(0,0,0,.15))] p-4 sm:p-5">
      <SectionHead icon={<Zap className="h-4 w-4" />} kicker="LIVE BETTING" title="BETTING DESK" />
      <div className="mt-4"><BettingModule match={match} onRefresh={async()=>{const m=await fetchMatch(match.id);if(m)setMatch(m)}} /></div>
    </section>

    {isOwner && <section className="mt-4 rounded-[24px] border border-white/8 bg-black/20 p-4 sm:p-5"><SectionHead icon={<Shield className="h-4 w-4" />} kicker="CONTROL" title="MATCH COMMAND" /><div className="mt-4 flex flex-wrap gap-2">{cfg.hasSets&&!ended&&<button onClick={finishSet} className="rounded-xl border border-cyan-300/20 bg-cyan-300/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-[.15em] text-cyan-200">Ukončit {cfg.setLabel}</button>}{!ended&&<button onClick={resetScore} className="rounded-xl border border-white/10 bg-white/[.03] px-4 py-2.5 text-[10px] font-black uppercase tracking-[.15em] text-white/55">Reset score</button>}{!ended&&<button onClick={finishMatch} disabled={finishBusy} className="rounded-xl bg-amber-300 px-4 py-2.5 text-[10px] font-black uppercase tracking-[.15em] text-black disabled:opacity-50">{finishBusy?"Ukončuji…":"Finish match"}</button>}<button onClick={remove} className="rounded-xl border border-rose-300/15 bg-rose-300/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-[.15em] text-rose-200/70">Delete</button></div></section>}
    <div className="mt-5 text-center"><span className="font-mono text-[8px] uppercase tracking-[.3em] text-white/15">SPORTCHMELÁCI ULTRA S+ · MATCH CENTER · SERVER DATA</span></div>
  </main>;
}

function TeamHero({ title, players, align = "left", accent }: { title: string; players: string[]; align?: "left"|"right"; accent: "gold"|"cyan" }) { return <div className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}><div className={`font-mono text-[9px] font-black uppercase tracking-[.28em] ${accent === "gold" ? "text-amber-200/55" : "text-cyan-200/55"}`}>{accent === "gold" ? "TEAM A" : "TEAM B"}</div><div className="mt-2 truncate font-display text-xl tracking-[.08em] text-white sm:text-3xl md:text-4xl">{title}</div><div className="mt-2 flex flex-wrap gap-1.5" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>{players.map((p,i)=><span key={`${p}-${i}`} className="rounded-lg border border-white/8 bg-white/[.03] px-2 py-1 text-[9px] text-white/35">{p}</span>)}</div></div>; }
function LineupCard({ label, players, accent }: { label: string; players: string[]; accent: "gold"|"cyan" }) { return <div className="rounded-2xl border border-white/8 bg-white/[.02] p-4"><div className={`font-mono text-[8px] font-black uppercase tracking-[.24em] ${accent === "gold" ? "text-amber-200/60" : "text-cyan-200/60"}`}>{label}</div><div className="mt-3 space-y-2">{players.filter(Boolean).map((p,i)=><div key={`${p}-${i}`} className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2"><div className={`h-2 w-2 rounded-full ${accent === "gold" ? "bg-amber-300" : "bg-cyan-300"} shadow-[0_0_10px] ${accent === "gold" ? "shadow-amber-300/60" : "shadow-cyan-300/60"}`} /><span className="truncate font-display text-sm text-white/70"><NickLink nickname={p} /></span></div>)}</div></div>; }
function DeckStat({ label, value, icon, live }: { label:string; value:string; icon:React.ReactNode; live?:boolean }) { return <div className="rounded-2xl border border-white/8 bg-white/[.025] p-3"><div className="flex items-center justify-between"><span className="aaa-meta">{label}</span><span className={live?"text-emerald-300":"text-amber-200/70"}>{icon}</span></div><div className={`mt-2 font-display text-lg tracking-[.1em] ${live?"text-emerald-200":"text-white"}`}>{value}</div></div>; }
function Signal({ icon, label, value }: { icon:React.ReactNode; label:string; value:string }) { return <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2"><div className="text-amber-200/60">{icon}</div><div className="min-w-0 flex-1"><div className="aaa-meta">{label}</div><div className="truncate text-[11px] font-semibold text-white/60">{value}</div></div></div>; }
function NumberCard({ label, value, tone }: { label:string; value:number; tone:"gold"|"cyan" }) { return <div className={`rounded-2xl border p-4 ${tone === "gold" ? "border-amber-300/15 bg-amber-300/[.03]" : "border-cyan-300/15 bg-cyan-300/[.03]"}`}><div className="aaa-meta">{label}</div><div className={`mt-2 font-display text-3xl font-black ${tone === "gold" ? "text-amber-100" : "text-cyan-100"}`}>{value}</div></div>; }
function SectionHead({ icon, kicker, title }: { icon:React.ReactNode; kicker:string; title:string }) { return <div className="flex items-end justify-between gap-3"><div><div className="flex items-center gap-2 text-white/20"><span>{icon}</span><span className="aaa-meta">{kicker}</span></div><h2 className="mt-1 font-display text-2xl tracking-[.12em] text-white">{title}</h2></div><span className="font-mono text-[8px] uppercase tracking-[.22em] text-white/15">ULTRA S+</span></div>; }
function Empty({ text }: { text:string }) { return <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-6 text-center font-mono text-[9px] uppercase tracking-[.2em] text-white/20">{text}</div>; }
function buildMomentum(match: Match, points: number) { const total = Math.max(1, match.scoreA + match.scoreB + match.sets.reduce((s,x)=>s+x.a+x.b,0)); const bias = (match.scoreA + setsWon(match,"a")*2) / Math.max(1, match.scoreA+match.scoreB+setsWon(match,"a")*2+setsWon(match,"b")*2); return Array.from({length:points},(_,i)=>Math.max(18,Math.min(95,Math.round(26 + bias*54 + Math.sin(i*1.45)*12 + ((match.scoreA-match.scoreB)/Math.max(1,total))*20))); }
function setsWon(match: Match, side: "a"|"b"){return match.sets.filter(s=>side==="a"?s.a>s.b:s.b>s.a).length;}
function splitPlayers(name: string) { return name.split(/\s*(?:&|\/|,|\+| vs\.? | and )\s*/i).map((s) => s.trim()).filter(Boolean); }

function NicknamesDatalistWrapper({ options }: { options: string[] }) { return <NicknamesDatalist options={options} />; }
function Lineup({ teamA, teamB, canEdit, onChange }: { teamA:string; teamB:string; canEdit:boolean; onChange:(a:string,b:string)=>void }) { const a=splitPlayers(teamA),b=splitPlayers(teamB),join=(arr:string[])=>arr.filter(s=>s.trim()).join(" & "); const setSide=(side:"a"|"b",players:string[])=>{const joined=join(players);if(side==="a")onChange(joined||teamA,teamB);else onChange(teamA,joined||teamB)}; const updatePlayer=(side:"a"|"b",i:number,val:string)=>{const src=side==="a"?[...a]:[...b];src[i]=val;setSide(side,src)}; const removePlayer=(side:"a"|"b",i:number)=>{const src=side==="a"?[...a]:[...b];src.splice(i,1);setSide(side,src.length?src:[""])}; const addPlayer=(side:"a"|"b")=>{const src=side==="a"?[...a,""]:[...b,""];setSide(side,src)}; if(a.length+b.length<=2&&!canEdit)return null; return <div className="mt-6 grid grid-cols-2 gap-3 md:gap-8">{[{players:a,key:"a" as const},{players:b,key:"b" as const}].map((side,idx)=><div key={idx} className="rounded-2xl border border-white/8 bg-white/[.02] p-3 md:p-4"><div className="flex items-center justify-between"><span className={`font-mono text-[9px] uppercase tracking-[.28em] ${idx===0?"text-amber-200":"text-cyan-200"}`}>{idx===0?"TEAM A":"TEAM B"}</span><span className="text-[9px] text-white/20">{side.players.length} PLAYERS</span></div><ul className="mt-2 space-y-1">{side.players.map((p,i)=><li key={i} className="flex items-center gap-2 text-sm"><span className={`inline-block h-2 w-2 rounded-full ${idx===0?"bg-amber-300":"bg-cyan-300"}`}/>{canEdit?<><input value={p} list={NICKNAMES_DATALIST_ID} onChange={e=>updatePlayer(side.key,i,e.target.value)} className="flex-1 rounded-xl border border-white/10 bg-black/30 px-2 py-1 text-sm"/><button onClick={()=>removePlayer(side.key,i)} className="text-white/25 hover:text-rose-200">×</button></>:<span className="truncate"><NickLink nickname={p}/></span>}</li>)}</ul>{canEdit&&<button onClick={()=>addPlayer(side.key)} className="mt-2 text-xs text-amber-200">+ Add player</button>}</div>)}</div>; }
