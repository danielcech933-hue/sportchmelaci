import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Crown, Flame, Medal, Radio, Shield, Sparkles, Trophy, Users, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAllMatches } from "@/lib/matches-db";
import { SPORT_LIST, SPORTS, type Match, type SportId } from "@/lib/matches";
import { buildLeaderboard, splitPlayers, type LeaderRow } from "@/lib/stats";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/lib/avatars";
import { NickLink } from "@/lib/profile-links";
import { playerEmoji, rankEmoji } from "@/lib/emoji";
import heroImg from "@/assets/scoreboard-hero.jpg";
import goldImg from "@/assets/rank-gold.jpg";
import silverImg from "@/assets/rank-silver.jpg";
import bronzeImg from "@/assets/rank-bronze.jpg";

export const Route = createFileRoute("/rankings")({
  head: () => ({
    meta: [
      { title: "Scoreboard 2.0 — SportChmeláci" },
      { name: "description", content: "Ultra S+ competitive ranking hub s ELO, formou, streaky a sportovními žebříčky." },
    ],
  }),
  component: RankingsPage,
});

type Mode = "solo" | "team";
const PODIUM = [
  { img: goldImg, label: "CHAMPION", ring: "rank-gold" },
  { img: silverImg, label: "RUNNER-UP", ring: "rank-silver" },
  { img: bronzeImg, label: "THIRD", ring: "rank-bronze" },
];

function RankingsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [profiles, setProfiles] = useState<{ nickname: string; avatar_path: string | null; elo: number | null }[]>([]);
  const [mode, setMode] = useState<Mode>("solo");
  const [sport, setSport] = useState<SportId | "all">("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [m, p] = await Promise.all([
          fetchAllMatches(),
          supabase.from("profile_public").select("nickname, avatar_path, elo").then((r) => (r.data ?? []) as { nickname: string; avatar_path: string | null; elo: number | null }[]),
        ]);
        if (!active) return;
        setMatches(m);
        setProfiles(p);
      } catch (e) {
        if (active) setErr((e as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const eloByNick = useMemo(() => new Map(profiles.filter((p) => p.nickname).map((p) => [p.nickname.trim().toLowerCase(), Number(p.elo ?? 1000)])), [profiles]);
  const avatarByNick = useMemo(() => new Map(profiles.filter((p) => p.nickname).map((p) => [p.nickname.trim().toLowerCase(), p.avatar_path])), [profiles]);
  const filtered = useMemo(() => matches.filter((m) => sport === "all" || m.sport === sport), [matches, sport]);
  const seedNames = useMemo(() => profiles.map((p) => p.nickname).filter(Boolean), [profiles]);
  const rows = useMemo<LeaderRow[]>(() => buildLeaderboard(filtered, mode, mode === "solo" ? seedNames : [], eloByNick), [filtered, mode, seedNames, eloByNick]);
  const completed = useMemo(() => filtered.filter((m) => !!m.endedAt), [filtered]);
  const live = useMemo(() => filtered.filter((m) => !m.endedAt), [filtered]);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  const globalStats = useMemo(() => {
    const wins = rows.reduce((n, r) => n + r.wins, 0);
    const played = rows.reduce((n, r) => n + r.played, 0);
    const twoVtwo = completed.filter((m) => m.matchFormat === "2v2").length;
    return {
      players: rows.length,
      matches: completed.length,
      live: live.length,
      twoVtwo,
      avgElo: rows.length ? Math.round(rows.reduce((n, r) => n + r.elo, 0) / rows.length) : 0,
      avgWinRate: played ? Math.round((wins / played) * 100) : 0,
    };
  }, [rows, completed, live]);

  const streakLeader = useMemo(() => rows.map((r) => ({ row: r, streak: currentStreak(r, filtered) })).sort((a, b) => b.streak - a.streak)[0], [rows, filtered]);
  const formLeader = useMemo(() => rows.slice().sort((a, b) => winRate(b) - winRate(a))[0], [rows]);
  const sportLeaders = useMemo(() => SPORT_LIST.map((s) => {
    const sportMatches = matches.filter((m) => m.sport === s.id && m.endedAt);
    const sportRows = buildLeaderboard(sportMatches, mode, mode === "solo" ? seedNames : [], eloByNick);
    return { ...s, row: sportRows[0] };
  }), [matches, mode, seedNames, eloByNick]);

  return (
    <main className="relative mx-auto max-w-[1450px] px-3 pb-32 pt-4 sm:px-5 lg:px-7">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/3 top-0 h-[650px] w-[900px] rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.12),transparent_65%)] blur-3xl" />
        <div className="absolute right-0 top-1/3 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,.06),transparent_64%)] blur-3xl" />
      </div>

      <section className="relative overflow-hidden rounded-[32px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(12,15,19,.98),rgba(1,4,7,.99))] shadow-[0_35px_120px_-55px_rgba(250,204,21,.55)]">
        <img src={heroImg} alt="" width={1600} height={720} className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_25%,rgba(250,204,21,.14),transparent_26%),linear-gradient(90deg,rgba(4,7,10,.97),rgba(4,7,10,.82),rgba(4,7,10,.96))]" />
        <div className="relative grid lg:grid-cols-[1.15fr_.85fr]">
          <div className="p-6 sm:p-9 lg:p-12">
            <div className="flex flex-wrap items-center gap-2"><span className="aaa-meta text-amber-200/80">SPORTCHMELÁCI · COMPETITIVE SYSTEM</span><span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[.2em] text-emerald-200">LIVE RANKING</span></div>
            <h1 className="mt-5 font-display text-6xl font-black tracking-[.08em] text-white sm:text-7xl lg:text-8xl">SCORE <span className="gold-text">BOARD</span></h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/45 sm:text-base">Oficiální ELO, W/L forma, streaky, 1v1 a 2v2 pořadí. Jeden competitive hub pro celý SportChmeláci systém.</p>
            <div className="mt-7 flex flex-wrap gap-2"><Link to="/sport-center" className="aaa-ghost inline-flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-[.16em]"><Radio className="h-4 w-4" /> Sport Hub</Link><Link to="/trophy-room" className="aaa-cta inline-flex items-center gap-2 px-5 py-3 text-[10px] font-black uppercase tracking-[.16em]"><Trophy className="h-4 w-4" /> Trophy Room</Link></div>
          </div>
          <div className="grid grid-cols-2 border-t border-white/8 bg-black/25 sm:grid-cols-4 lg:grid-cols-2 lg:border-l lg:border-t-0">
            <Metric label="PLAYERS" value={loading ? "—" : globalStats.players} sub="v tabulce" icon={<Users className="h-4 w-4" />} />
            <Metric label="MATCHES" value={loading ? "—" : globalStats.matches} sub="rozhodnuté" icon={<BarChart3 className="h-4 w-4" />} />
            <Metric label="LIVE" value={globalStats.live} sub="otevřené" icon={<Zap className="h-4 w-4" />} />
            <Metric label="AVG ELO" value={globalStats.avgElo || "—"} sub={`${globalStats.avgWinRate}% avg win`} icon={<Crown className="h-4 w-4" />} />
          </div>
        </div>
      </section>

      <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
        <div className="flex flex-wrap gap-1.5">
          {(["solo", "team"] as Mode[]).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded-xl px-4 py-2.5 text-[9px] font-black uppercase tracking-[.18em] transition ${mode === m ? "bg-amber-300 text-black shadow-[0_0_25px_-12px_rgba(250,204,21,.9)]" : "text-white/35 hover:bg-white/[.03] hover:text-white"}`}>{m === "solo" ? "SOLO RANKING" : "2V2 TEAM"}</button>)}
        </div>
        <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1">
          <button onClick={() => setSport("all")} className={`shrink-0 rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-[.16em] ${sport === "all" ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-200" : "border-white/8 text-white/30 hover:text-white/60"}`}>VŠE</button>
          {SPORT_LIST.map((s) => <button key={s.id} onClick={() => setSport(s.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-[.16em] ${sport === s.id ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-200" : "border-white/8 text-white/30 hover:text-white/60"}`}>{s.emoji} {s.name}</button>)}
        </div>
      </section>

      {err && <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-300/5 p-3 text-xs text-rose-200">Ranking feed error: {err}</div>}

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SignalCard label="STREAK KING" value={streakLeader?.row.label ?? "—"} hint={streakLeader?.streak ? `${streakLeader.streak} match win streak` : "No current streak"} icon={<Flame className="h-4 w-4" />} />
        <SignalCard label="FORM LEADER" value={formLeader?.label ?? "—"} hint={formLeader ? `${Math.round(winRate(formLeader) * 100)}% win rate` : "Waiting"} icon={<Sparkles className="h-4 w-4" />} />
        <SignalCard label="TEAM SIGNAL" value={globalStats.twoVtwo ? `${globalStats.twoVtwo}` : "READY"} hint={globalStats.twoVtwo ? "2v2 matches" : "No team matches yet"} icon={<Shield className="h-4 w-4" />} />
        <SignalCard label="RANKING STATUS" value={loading ? "SYNC" : "LIVE"} hint="updates every 5 seconds" icon={<Radio className="h-4 w-4" />} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-[26px] border border-white/8 bg-black/20 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><div className="aaa-meta">PODIUM</div><h2 className="mt-1 font-display text-2xl tracking-wider text-white">TOP 3</h2></div><div className="font-mono text-[9px] uppercase tracking-[.2em] text-white/25">{mode === "solo" ? "SOLO" : "TEAM"} · {sport === "all" ? "ALL SPORTS" : SPORTS[sport].name}</div></div>
          {podium.length ? <div className="mt-5 grid gap-3 md:grid-cols-3">{podium.map((r, i) => <PodiumCard key={r.key} row={r} index={i} avatarPath={avatarByNick.get(r.key)} />)}</div> : <EmptyState />}
        </div>
        <div className="rounded-[26px] border border-white/8 bg-black/20 p-5 sm:p-6">
          <div className="aaa-meta">SPORT LEADERS</div><h2 className="mt-1 font-display text-2xl tracking-wider text-white">ARENA KINGS</h2>
          <div className="mt-4 space-y-2">{sportLeaders.slice(0, 6).map((s) => <button key={s.id} onClick={() => setSport(s.id)} className="flex w-full items-center justify-between rounded-2xl border border-white/7 bg-white/[.02] p-3 text-left hover:border-cyan-300/20"><div className="flex min-w-0 items-center gap-3"><span className="text-xl">{s.emoji}</span><div className="min-w-0"><div className="truncate font-display text-sm text-white">{s.name}</div><div className="aaa-meta mt-1">{s.row?.label ?? "NO SIGNAL"}</div></div></div><div className="font-mono text-[9px] text-amber-200">{s.row?.wins ?? 0}W</div></button>)}</div>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-[26px] border border-white/8 bg-black/20">
        <div className="flex items-center justify-between gap-4 border-b border-white/8 p-5 sm:p-6"><div><div className="aaa-meta">OFFICIAL TABLE</div><h2 className="mt-1 font-display text-2xl tracking-wider text-white">COMPETITIVE RANKING</h2></div><div className="font-mono text-[9px] uppercase tracking-[.18em] text-white/25">ELO · W · L · WIN %</div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b border-white/8 text-[9px] uppercase tracking-[.18em] text-white/25"><th className="px-5 py-3 text-left">#</th><th className="px-5 py-3 text-left">PLAYER / TEAM</th><th className="px-5 py-3 text-right">ELO</th><th className="px-5 py-3 text-right">W</th><th className="px-5 py-3 text-right">L</th><th className="px-5 py-3 text-right">FORM</th><th className="px-5 py-3 text-right">WIN %</th></tr></thead><tbody>{rest.map((r, i) => <RankingRow key={r.key} row={r} rank={i + 4} avatarPath={avatarByNick.get(r.key)} />)}{rows.length === 0 && <tr><td colSpan={7}><EmptyState /></td></tr>}</tbody></table></div>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-3"><Link to="/leagues" className="rounded-2xl border border-amber-300/15 bg-amber-300/[.03] p-5 hover:border-amber-300/30"><div className="aaa-meta">SEASON</div><div className="mt-2 font-display text-xl text-white">CHMEL LEAGUE</div><div className="mt-1 text-sm text-white/30">Body, matchday a dlouhodobá forma.</div></Link><Link to="/records" className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.03] p-5 hover:border-cyan-300/30"><div className="aaa-meta">HALL OF FAME</div><div className="mt-2 font-display text-xl text-white">RECORD RADAR</div><div className="mt-1 text-sm text-white/30">Největší série a historické výkony.</div></Link><Link to="/activity" className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[.03] p-5 hover:border-emerald-300/30"><div className="aaa-meta">LIVE SIGNAL</div><div className="mt-2 font-display text-xl text-white">LIVE PULSE</div><div className="mt-1 text-sm text-white/30">Co se právě děje ve SportChmelácích.</div></Link></div>
    </main>
  );
}

function winRate(r: LeaderRow) { return r.played ? r.wins / r.played : 0; }
function currentStreak(row: LeaderRow, matches: Match[]) {
  const name = row.key.toLowerCase();
  const relevant = matches.filter((m) => m.endedAt && (splitPlayers(m.teamA).some((n) => n.toLowerCase() === name) || splitPlayers(m.teamB).some((n) => n.toLowerCase() === name))).sort((a, b) => Number(b.endedAt ?? 0) - Number(a.endedAt ?? 0));
  let streak = 0;
  for (const m of relevant) {
    const a = splitPlayers(m.teamA).some((n) => n.toLowerCase() === name);
    const b = splitPlayers(m.teamB).some((n) => n.toLowerCase() === name);
    if (m.scoreA === m.scoreB) break;
    const won = (a && m.scoreA > m.scoreB) || (b && m.scoreB > m.scoreA);
    if (!won) break;
    streak++;
  }
  return streak;
}
function Metric({ label, value, sub, icon }: { label: string; value: string | number; sub: string; icon: React.ReactNode }) { return <div className="border-b border-r border-white/8 p-5 last:border-r-0"><div className="flex items-center gap-2 text-white/30"><span className="text-amber-200/80">{icon}</span><span className="font-mono text-[8px] font-black uppercase tracking-[.22em]">{label}</span></div><div className="mt-3 font-display text-3xl text-white">{value}</div><div className="mt-1 text-[10px] text-white/25">{sub}</div></div>; }
function SignalCard({ label, value, hint, icon }: { label: string; value: string; hint: string; icon: React.ReactNode }) { return <div className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="flex items-center gap-2 text-amber-200/70">{icon}<span className="aaa-meta">{label}</span></div><div className="mt-3 truncate font-display text-xl text-white">{value}</div><div className="mt-1 truncate text-[10px] text-white/25">{hint}</div></div>; }
function PodiumCard({ row, index, avatarPath }: { row: LeaderRow; index: number; avatarPath?: string | null }) { const p = PODIUM[index]; return <div className={`group relative overflow-hidden rounded-2xl border bg-black/20 p-4 transition hover:-translate-y-1 ${p.ring}`}><div className="absolute inset-0 grid-bg opacity-15" /><div className="relative flex items-center gap-3"><div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl"><img src={p.img} alt="" width={800} height={800} className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" /><div className="absolute bottom-1 left-0 right-0 text-center font-display text-xl text-amber-100">#{index + 1}</div></div>{avatarPath && <Avatar path={avatarPath} nickname={row.label} size={42} />}<div className="min-w-0"><div className="aaa-meta">{rankEmoji(index + 1)} {p.label}</div><div className="truncate font-display text-lg text-white"><span className="mr-1">{playerEmoji(row.label)}</span><NickLink nickname={row.label} /></div><div className="mt-1 flex gap-2 font-mono text-[9px] text-white/35"><span className="text-amber-200">{row.elo} ELO</span><span>{row.wins}W</span><span>{row.losses}L</span></div></div></div></div>; }
function RankingRow({ row, rank, avatarPath }: { row: LeaderRow; rank: number; avatarPath?: string | null }) { const pct = Math.round(winRate(row) * 100); return <tr className="border-t border-white/5 hover:bg-white/[.02]"><td className="px-5 py-4 font-mono text-white/25">{String(rank).padStart(2, "0")}</td><td className="px-5 py-4"><div className="flex items-center gap-3">{avatarPath && <Avatar path={avatarPath} nickname={row.label} size={34} />}<div className="min-w-0"><div className="truncate font-display text-base text-white"><span className="mr-1">{playerEmoji(row.label)}</span><NickLink nickname={row.label} /></div><div className="aaa-meta mt-1">{row.played} MATCHES</div></div></div></td><td className="px-5 py-4 text-right font-display text-xl text-amber-200">{row.elo}</td><td className="px-5 py-4 text-right font-mono text-emerald-200">{row.wins}</td><td className="px-5 py-4 text-right font-mono text-rose-200">{row.losses}</td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-1"><span className="h-2 w-2 rounded-full bg-emerald-300" /><span className="h-2 w-2 rounded-full bg-emerald-300/50" /><span className="h-2 w-2 rounded-full bg-white/15" /><span className="h-2 w-2 rounded-full bg-rose-300/40" /></div></td><td className="px-5 py-4 text-right"><div className="inline-flex items-center gap-2"><div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-amber-200 to-amber-300" style={{ width: `${pct}%` }} /></div><span className="font-mono text-xs text-white/55">{pct}%</span></div></td></tr>; }
function EmptyState() { return <div className="grid min-h-28 place-items-center p-6 text-center"><div><Medal className="mx-auto h-6 w-6 text-amber-200/50" /><div className="mt-2 font-mono text-[10px] font-black uppercase tracking-[.25em] text-white/30">NO SIGNAL</div><div className="mt-1 text-sm text-white/20">Jakmile budou výsledky, ranking se automaticky naplní.</div></div></div>; }
