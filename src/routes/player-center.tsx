import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ArrowLeft, BarChart3, ChevronRight, Flame, Gauge, Medal, ShieldCheck, Swords, Trophy, Users, Zap } from "lucide-react";
import { fetchAllMatches } from "@/lib/matches-db";
import { buildLeaderboard, type LeaderRow } from "@/lib/stats";
import { supabase } from "@/integrations/supabase/client";
import { SPORTS, SPORT_LIST, type Match } from "@/lib/matches";

const searchSchema = z.object({ nickname: z.string().optional() });
export const Route = createFileRoute("/player-center")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Player Center — SportChmeláci" }, { name: "description", content: "Ultra S+ hráčské centrum SportChmeláci." }] }),
  component: PlayerCenter,
});

type Profile = { nickname: string; avatar_path: string | null; elo: number | null };

function PlayerCenter() {
  const { nickname: requested } = Route.useSearch();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState(requested ?? "");

  useEffect(() => {
    Promise.all([
      supabase.from("profile_public").select("nickname, avatar_path, elo"),
      fetchAllMatches(),
    ]).then(([profileResult, all]) => {
      setProfiles((profileResult.data ?? []).filter((p) => !!p.nickname) as Profile[]);
      setMatches(all);
      if (!requested && profileResult.data?.[0]?.nickname) setSelected(profileResult.data[0].nickname);
    }).catch(() => undefined);
  }, [requested]);

  const names = useMemo(() => profiles.map((p) => p.nickname).filter(Boolean), [profiles]);
  const player = useMemo(() => profiles.find((p) => p.nickname.trim().toLowerCase() === selected.trim().toLowerCase()) ?? null, [profiles, selected]);
  const row: LeaderRow | undefined = useMemo(() => {
    if (!player) return undefined;
    const rows = buildLeaderboard(matches, "solo", [player.nickname], new Map([[player.nickname.trim().toLowerCase(), Number(player.elo ?? 1000)]]));
    return rows.find((r) => r.label.trim().toLowerCase() === player.nickname.trim().toLowerCase());
  }, [matches, player]);
  const playerMatches = useMemo(() => matches.filter((m) => m.endedAt && (m.teamA.toLowerCase().includes(selected.toLowerCase()) || m.teamB.toLowerCase().includes(selected.toLowerCase()))).slice(0, 8), [matches, selected]);
  const sportBreakdown = useMemo(() => SPORT_LIST.map((sport) => {
    const list = playerMatches.filter((m) => m.sport === sport.id);
    return { sport, count: list.length, wins: list.filter((m) => (m.teamA.toLowerCase().includes(selected.toLowerCase()) ? m.scoreA > m.scoreB : m.scoreB > m.scoreA)).length };
  }).filter((x) => x.count > 0), [playerMatches, selected]);
  const total = row?.played ?? 0;
  const winRate = total ? Math.round(((row?.wins ?? 0) / total) * 100) : 0;

  return <main className="relative mx-auto max-w-[1450px] px-3 pb-28 pt-5 sm:px-5 lg:px-7">
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"><div className="absolute left-1/4 top-0 h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.12),transparent_66%)] blur-3xl" /><div className="absolute right-0 top-[30%] h-[550px] w-[550px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,.06),transparent_64%)] blur-3xl" /></div>
    <div className="mb-4 flex items-center justify-between gap-3"><Link to="/" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[9px] font-black uppercase tracking-[.2em] text-white/45 hover:border-amber-300/25 hover:text-amber-200"><ArrowLeft className="h-3.5 w-3.5" /> Lobby</Link><span className="rounded-full border border-amber-300/15 bg-amber-300/5 px-3 py-1 font-mono text-[8px] uppercase tracking-[.24em] text-amber-200/55">PLAYER CENTER · ULTRA S+</span></div>

    <section className="relative overflow-hidden rounded-[30px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(15,18,22,.98),rgba(3,6,9,.99))] shadow-[0_35px_120px_-55px_rgba(250,204,21,.55)]">
      <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.025)_1px,transparent_1px)] [background-size:44px_44px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_20%,rgba(250,204,21,.16),transparent_26%)]" />
      <div className="relative grid gap-5 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-10">
        <div><div className="aaa-meta text-amber-200/75">SPORTCHMELÁCI ORIGINAL · PLAYER ARCHIVE</div><div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center"><div className="grid h-24 w-24 shrink-0 place-items-center rounded-[26px] border border-amber-300/35 bg-gradient-to-br from-amber-300/20 to-black text-4xl text-amber-100 shadow-[0_0_55px_-18px_rgba(250,204,21,.9)]">♛</div><div><h1 className="font-display text-5xl font-black tracking-[.05em] text-white sm:text-7xl">{player?.nickname ?? "HRÁČ"}</h1><div className="mt-2 flex flex-wrap items-center gap-2"><span className="rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 font-mono text-[8px] font-black uppercase tracking-[.2em] text-amber-200">{player ? `${player.elo ?? 1000} ELO` : "NO PROFILE"}</span><span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1 font-mono text-[8px] font-black uppercase tracking-[.2em] text-emerald-200">ACTIVE ARCHIVE</span></div></div></div>
          <div className="mt-7 flex flex-wrap gap-2">{names.slice(0, 18).map((name) => <Link key={name} to="/player-center" search={{ nickname: name }} className={`rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-[.16em] ${name.toLowerCase() === selected.toLowerCase() ? "border-amber-300/45 bg-amber-300/10 text-amber-200" : "border-white/10 bg-white/[.02] text-white/35 hover:text-white"}`}>{name}</Link>)}</div>
        </div>
        <aside className="rounded-[24px] border border-cyan-300/10 bg-cyan-300/[.025] p-5"><div className="aaa-meta text-cyan-200/70">PLAYER SIGNAL</div><div className="mt-5 grid grid-cols-2 gap-2"><Metric label="WINS" value={String(row?.wins ?? 0)} icon={<Trophy className="h-4 w-4" />} /><Metric label="LOSSES" value={String(row?.losses ?? 0)} icon={<Swords className="h-4 w-4" />} /><Metric label="WIN RATE" value={`${winRate}%`} icon={<Gauge className="h-4 w-4" />} /><Metric label="PLAYED" value={String(total)} icon={<BarChart3 className="h-4 w-4" />} /></div><div className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-4"><div className="aaa-meta">FORM</div><div className="mt-3 flex gap-1.5">{playerMatches.slice(0, 6).map((m) => { const a = m.teamA.toLowerCase().includes(selected.toLowerCase()); const win = a ? m.scoreA > m.scoreB : m.scoreB > m.scoreA; return <span key={m.id} className={`grid h-8 w-8 place-items-center rounded-lg border text-[9px] font-black ${win ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-rose-300/25 bg-rose-300/10 text-rose-200"}`}>{win ? "W" : "L"}</span>; })}</div></div></aside>
      </div>
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]"><div className="rounded-[24px] border border-white/8 bg-black/20 p-4 sm:p-5"><Head icon={<Flame className="h-4 w-4" />} kicker="PERFORMANCE" title="FORM ENGINE" />{playerMatches.length ? <div className="mt-5 space-y-3">{playerMatches.map((m) => { const a = m.teamA.toLowerCase().includes(selected.toLowerCase()); const win = a ? m.scoreA > m.scoreB : m.scoreB > m.scoreA; return <Link key={m.id} to="/match" search={{ id: m.id }} className="group flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[.02] p-3 transition hover:border-amber-300/30"><div className={`grid h-10 w-10 place-items-center rounded-xl border ${win ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" : "border-rose-300/25 bg-rose-300/10 text-rose-200"}`}>{win ? "W" : "L"}</div><div className="min-w-0 flex-1"><div className="truncate font-display text-base text-white">{m.teamA} <span className="text-white/20">VS</span> {m.teamB}</div><div className="aaa-meta mt-1">{SPORTS[m.sport].name} · {new Date(m.endedAt!).toLocaleDateString("cs-CZ")}</div></div><div className="font-display text-xl font-black text-white">{m.scoreA}:{m.scoreB}</div><ChevronRight className="h-4 w-4 text-white/20 group-hover:text-amber-200" /></Link>; })}</div> : <Empty text="Žádné dokončené zápasy" />}</div><div className="rounded-[24px] border border-white/8 bg-black/20 p-4 sm:p-5"><Head icon={<Medal className="h-4 w-4" />} kicker="SPORT PROFILE" title="DISCIPLINES" />{sportBreakdown.length ? <div className="mt-5 space-y-3">{sportBreakdown.map(({ sport, count, wins }) => <div key={sport.id} className="rounded-2xl border border-white/8 bg-white/[.02] p-4"><div className="flex items-center justify-between"><span className="font-display text-lg text-white">{sport.emoji} {sport.name}</span><span className="font-mono text-[9px] text-amber-200">{wins}W / {count}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-700" style={{ width: `${count ? Math.round((wins/count)*100) : 0}%` }} /></div></div>)}</div> : <Empty text="Sportovní historie zatím není" />}</div></section>

    <section className="mt-4 rounded-[24px] border border-white/8 bg-black/20 p-4 sm:p-5"><Head icon={<Users className="h-4 w-4" />} kicker="SYSTEM STATUS" title="PLAYER PROTOCOL" /><div className="mt-4 grid gap-3 md:grid-cols-3"><Protocol icon={<ShieldCheck className="h-4 w-4" />} title="OFFICIAL ELO" text="Pořadí je odvozené z oficiální leaderboard vrstvy." /><Protocol icon={<Zap className="h-4 w-4" />} title="LIVE READY" text="Odkazy z Match Center fungují pro live i dokončené zápasy." /><Protocol icon={<Trophy className="h-4 w-4" />} title="2V2 AWARE" text="Team-ready metadata je zachována pro týmové zápasy." /></div></section>
  </main>;
}

function Metric({ label, value, icon }: { label:string; value:string; icon:React.ReactNode }) { return <div className="rounded-2xl border border-white/8 bg-black/20 p-3"><div className="flex items-center justify-between text-amber-200/70"><span className="aaa-meta">{label}</span>{icon}</div><div className="mt-2 font-display text-2xl font-black text-white">{value}</div></div>; }
function Head({ kicker, title, icon }: { kicker:string; title:string; icon:React.ReactNode }) { return <div className="flex items-end justify-between gap-3"><div><div className="aaa-meta text-amber-200/65">{kicker}</div><h2 className="mt-1 flex items-center gap-2 font-display text-3xl tracking-[.1em] text-white">{icon}{title}</h2></div></div>; }
function Protocol({ icon, title, text }: { icon:React.ReactNode; title:string; text:string }) { return <div className="rounded-2xl border border-white/8 bg-white/[.02] p-4"><div className="flex items-center gap-2 text-amber-200"><span className="grid h-8 w-8 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10">{icon}</span><span className="font-display text-lg">{title}</span></div><p className="mt-2 text-sm leading-6 text-white/30">{text}</p></div>; }
function Empty({ text }: { text:string }) { return <div className="mt-5 rounded-2xl border border-dashed border-white/10 bg-white/[.015] p-10 text-center font-mono text-[9px] uppercase tracking-[.2em] text-white/25">{text}</div>; }