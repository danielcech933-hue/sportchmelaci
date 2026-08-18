import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Crown, Flame, Medal, Radio, ShieldCheck, Sparkles, Swords, Target, Trophy, Users, Zap } from "lucide-react";
import { Avatar } from "@/lib/avatars";
import { useAuth } from "@/lib/auth";
import { fetchAllMatches } from "@/lib/matches-db";
import { playerSplitStats, sideOf, winnerSideOf } from "@/lib/stats";
import type { Match } from "@/lib/matches";
import { fetchAllTeams, type Team } from "@/lib/teams-db";
import { SPORTS } from "@/lib/matches";

function outcomeFor(nickname: string | null, match: Match) {
  if (!nickname) return null;
  const side = sideOf(nickname, match);
  const winner = winnerSideOf(match);
  if (!side || !winner) return null;
  return side === winner ? "W" : "L";
}

function initials(name: string | null) {
  if (!name) return "P";
  return name.trim().slice(0, 2).toUpperCase();
}

export function ProfileIdentity2({ userId }: { userId: string }) {
  const { user, nickname, avatarPath } = useAuth();
  const [profile, setProfile] = useState<{ nickname: string; avatar_path: string | null } | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAllMatches(),
      fetchAllTeams(),
      import("@/integrations/supabase/client").then(({ supabase }) =>
        supabase.from("profiles").select("nickname,avatar_path").eq("id", userId).maybeSingle()
      ),
    ]).then(([matchRows, teamRows, profileRow]) => {
      if (cancelled) return;
      setMatches(matchRows as Match[]);
      setTeams(teamRows as Team[]);
      if (profileRow.data) setProfile(profileRow.data as { nickname: string; avatar_path: string | null });
    }).catch(() => {
      if (cancelled) return;
      setMatches([]);
      setTeams([]);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const playerName = nickname ?? profile?.nickname ?? null;
  const playerAvatar = user?.id === userId ? avatarPath : profile?.avatar_path ?? null;
  const myMatches = useMemo(() => {
    if (!playerName) return [];
    return matches.filter((m) => sideOf(playerName, m) !== null).sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
  }, [matches, playerName]);
  const stats = useMemo(() => playerSplitStats(matches, playerName), [matches, playerName]);
  const form = useMemo(() => myMatches.filter((m) => m.endedAt).slice(0, 8).map((m) => outcomeFor(playerName, m)).filter(Boolean) as string[], [myMatches, playerName]);
  const winRate = stats.overall.total ? Math.round((stats.overall.wins / stats.overall.total) * 100) : 0;
  const sports = useMemo(() => {
    const unique = [...new Set(myMatches.map((m) => m.sport))];
    return unique.slice(0, 6);
  }, [myMatches]);
  const myTeams = useMemo(() => teams.filter((team) => team.ownerNickname?.toLowerCase() === playerName?.toLowerCase() || team.members.some((m) => m.nickname.toLowerCase() === playerName?.toLowerCase())).slice(0, 3), [teams, playerName]);
  const level = Math.max(1, Math.floor((stats.overall.wins * 120 + stats.overall.total * 25) / 500) + 1);
  const xp = stats.overall.wins * 120 + stats.overall.total * 25;
  const nextXp = Math.ceil((xp + 1) / 500) * 500;
  const progress = nextXp ? Math.min(100, Math.round(((xp % 500) / 500) * 100)) : 0;
  const status = myMatches[0]?.endedAt ? "ACTIVE COMPETITOR" : "READY FOR MATCH";

  return (
    <section className="relative mt-6 overflow-hidden rounded-[30px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(6,9,14,.98),rgba(2,5,9,.99))] shadow-[0_35px_120px_-55px_rgba(250,204,21,.5)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(250,204,21,.14),transparent_28%),radial-gradient(circle_at_88%_15%,rgba(34,211,238,.10),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(139,92,246,.08),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.4)_1px,transparent_1px)] [background-size:34px_34px]" />

      <div className="relative grid gap-0 xl:grid-cols-[1.25fr_.75fr]">
        <div className="p-5 sm:p-7 lg:p-9">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[.25em] text-emerald-200"><Radio className="h-3 w-3" /> PLAYER IDENTITY</span>
            <span className="font-mono text-[8px] font-black uppercase tracking-[.25em] text-white/25">ULTRA S+</span>
          </div>

          <div className="mt-6 flex items-end gap-4 sm:gap-5">
            <div className="relative shrink-0 rounded-[24px] border border-amber-300/30 bg-black/30 p-1.5 shadow-[0_0_45px_-20px_rgba(250,204,21,.8)]">
              <Avatar path={playerAvatar} nickname={playerName} size={92} />
              <span className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-xl border border-amber-300/30 bg-[#0c1016] text-amber-200 shadow-lg"><Crown className="h-4 w-4" /></span>
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[9px] font-bold uppercase tracking-[.28em] text-amber-200/65">{status}</div>
              <h2 className="mt-1 truncate font-display text-4xl font-black tracking-[.06em] text-white sm:text-6xl">{playerName ?? initials(playerName)} <span className="gold-text">// {String(level).padStart(2, "0")}</span></h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[.16em] text-white/30"><span>{stats.overall.wins} W</span><span>•</span><span>{stats.overall.losses} L</span><span>•</span><span>{winRate}% WIN RATE</span></div>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="MATCHES" value={stats.overall.total} icon={<Trophy className="h-4 w-4" />} />
            <Stat label="WINS" value={stats.overall.wins} icon={<Medal className="h-4 w-4" />} />
            <Stat label="TEAM" value={stats.team.total} icon={<Users className="h-4 w-4" />} />
            <Stat label="SPORTS" value={sports.length} icon={<Zap className="h-4 w-4" />} />
          </div>

          <div className="mt-4 rounded-2xl border border-white/8 bg-white/[.025] p-4">
            <div className="flex items-center justify-between gap-3"><div><div className="font-mono text-[8px] font-black uppercase tracking-[.25em] text-cyan-200/60">PLAYER XP</div><div className="mt-1 font-display text-xl tracking-wide text-white">LEVEL {level} <span className="text-white/25">/ {nextXp} XP</span></div></div><Sparkles className="h-5 w-5 text-amber-200" /></div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-violet-400 shadow-[0_0_18px_-6px_rgba(250,204,21,.9)]" style={{ width: `${progress}%` }} /></div>
            <div className="mt-2 flex justify-between font-mono text-[8px] font-bold uppercase tracking-[.18em] text-white/25"><span>{xp.toLocaleString("cs-CZ")} XP</span><span>{progress}% TO NEXT LEVEL</span></div>
          </div>
        </div>

        <aside className="border-t border-white/8 bg-black/20 p-5 sm:p-7 xl:border-l xl:border-t-0">
          <div className="font-mono text-[9px] font-black uppercase tracking-[.28em] text-cyan-200/65">COMPETITOR SIGNAL</div>
          <div className="mt-4 rounded-2xl border border-amber-300/15 bg-amber-300/[.03] p-4">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10"><Target className="h-4 w-4 text-amber-200" /></div><div><div className="font-display text-xl tracking-wide text-white">{winRate}% <span className="text-white/25">WIN</span></div><div className="font-mono text-[8px] uppercase tracking-[.2em] text-white/25">overall performance</div></div></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2"><Mini label="SOLO" value={`${stats.solo.wins}-${stats.solo.losses}`} /><Mini label="2V2" value={`${stats.team.wins}-${stats.team.losses}`} /><Mini label="FORM" value={form.slice(0, 5).join(" ") || "—"} /><Mini label="TEAMS" value={myTeams.length} /></div>

          <div className="mt-4">
            <div className="mb-2 font-mono text-[8px] font-black uppercase tracking-[.25em] text-white/25">SPORT MASTERY</div>
            <div className="flex flex-wrap gap-1.5">{sports.map((sport) => <span key={sport} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/15 bg-cyan-300/[.04] px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[.12em] text-cyan-100/75">{SPORTS[sport as keyof typeof SPORTS]?.emoji ?? "◆"} {SPORTS[sport as keyof typeof SPORTS]?.name ?? sport}</span>)}{sports.length === 0 && <span className="font-mono text-[9px] text-white/25">NO DATA YET</span>}</div>
          </div>

          <div className="mt-4 space-y-2">
            <Link to="/rankings" className="flex items-center justify-between rounded-xl border border-amber-300/15 bg-white/[.02] px-3 py-2.5 hover:border-amber-300/30"><span className="flex items-center gap-2 text-[10px] font-bold text-white"><Trophy className="h-3.5 w-3.5 text-amber-200" /> Scoreboard</span><span className="text-white/25">→</span></Link>
            <Link to="/trophy-room" className="flex items-center justify-between rounded-xl border border-violet-300/15 bg-white/[.02] px-3 py-2.5 hover:border-violet-300/30"><span className="flex items-center gap-2 text-[10px] font-bold text-white"><Crown className="h-3.5 w-3.5 text-violet-200" /> Trophy Room</span><span className="text-white/25">→</span></Link>
            <Link to="/teams" className="flex items-center justify-between rounded-xl border border-cyan-300/15 bg-white/[.02] px-3 py-2.5 hover:border-cyan-300/30"><span className="flex items-center gap-2 text-[10px] font-bold text-white"><ShieldCheck className="h-3.5 w-3.5 text-cyan-200" /> Team HQ</span><span className="text-white/25">→</span></Link>
          </div>
        </aside>
      </div>

      <div className="relative border-t border-white/8 bg-black/25 px-5 py-3 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 font-mono text-[8px] font-black uppercase tracking-[.22em] text-white/25"><Flame className="h-3.5 w-3.5 text-amber-200" /> FORM // {form.length ? form.join(" · ") : "WAITING FOR MATCHES"}</div><Link to="/schedule" className="inline-flex items-center gap-1.5 font-mono text-[8px] font-black uppercase tracking-[.22em] text-amber-200 hover:text-white"><Swords className="h-3.5 w-3.5" /> PLAY NEXT</Link></div>
      </div>
    </section>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/8 bg-black/25 p-3"><div className="flex items-center gap-2 text-white/35">{icon}<span className="font-mono text-[8px] font-bold uppercase tracking-[.18em]">{label}</span></div><div className="mt-2 font-display text-2xl text-white">{value}</div></div>;
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl border border-white/8 bg-white/[.02] p-3"><div className="font-mono text-[7px] font-black uppercase tracking-[.18em] text-white/25">{label}</div><div className="mt-1 truncate font-mono text-[10px] font-bold text-white/70">{value}</div></div>;
}
