import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Crown, Flame, Medal, Radio, ShieldCheck, Sparkles, Swords, Target, Trophy, Users, Zap, WalletCards, Coins, ChevronRight, Gamepad2, BarChart3 } from "lucide-react";
import { Avatar } from "@/lib/avatars";
import { useAuth } from "@/lib/auth";
import { useWallet } from "@/lib/wallet";
import { fetchAllMatches } from "@/lib/matches-db";
import { playerSplitStats, sideOf, winnerSideOf } from "@/lib/stats";
import type { Match } from "@/lib/matches";
import { fetchAllTeams, type Team } from "@/lib/teams-db";
import { SPORTS } from "@/lib/matches";
import { supabase } from "@/integrations/supabase/client";

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
  const { userDollars, slotCZK } = useWallet();
  const [profile, setProfile] = useState<{ nickname: string; avatar_path: string | null } | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [betStats, setBetStats] = useState({ open: 0, settled: 0, net: 0 });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchAllMatches(),
      fetchAllTeams(),
      supabase.from("profiles").select("nickname,avatar_path").eq("id", userId).maybeSingle(),
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

  useEffect(() => {
    if (user?.id !== userId) {
      setBetStats({ open: 0, settled: 0, net: 0 });
      return;
    }
    let active = true;
    supabase.rpc("get_my_betting_ledger", { _limit: 200 }).then(({ data }) => {
      if (!active) return;
      const rows = (data ?? []) as Array<{ kind?: string; amount?: number | string }>;
      const settled = rows.filter((r) => r.kind === "bet_payout" || r.kind === "bet_refund");
      setBetStats({
        open: Math.max(0, rows.filter((r) => r.kind === "bet_stake").length - settled.length),
        settled: settled.length,
        net: Math.round(settled.reduce((sum, r) => sum + Number(r.amount ?? 0), 0) * 100) / 100,
      });
    });
    return () => { active = false; };
  }, [userId, user?.id]);

  const playerName = nickname ?? profile?.nickname ?? null;
  const playerAvatar = user?.id === userId ? avatarPath : profile?.avatar_path ?? null;
  const myMatches = useMemo(() => {
    if (!playerName) return [];
    return matches.filter((m) => sideOf(playerName, m) !== null).sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
  }, [matches, playerName]);
  const stats = useMemo(() => playerSplitStats(matches, playerName), [matches, playerName]);
  const form = useMemo(() => myMatches.filter((m) => m.endedAt).slice(0, 8).map((m) => outcomeFor(playerName, m)).filter(Boolean) as string[], [myMatches, playerName]);
  const winRate = stats.overall.total ? Math.round((stats.overall.wins / stats.overall.total) * 100) : 0;
  const sports = useMemo(() => [...new Set(myMatches.map((m) => m.sport))].slice(0, 6), [myMatches]);
  const myTeams = useMemo(() => teams.filter((team) => team.ownerNickname?.toLowerCase() === playerName?.toLowerCase() || team.members.some((m) => m.nickname.toLowerCase() === playerName?.toLowerCase())).slice(0, 4), [teams, playerName]);
  const level = Math.max(1, Math.floor((stats.overall.wins * 120 + stats.overall.total * 25) / 500) + 1);
  const xp = stats.overall.wins * 120 + stats.overall.total * 25;
  const nextXp = Math.max(500, Math.ceil((xp + 1) / 500) * 500);
  const progress = Math.min(100, Math.round(((xp % 500) / 500) * 100));
  const streak = useMemo(() => {
    let total = 0;
    for (const result of form) { if (result !== "W") break; total += 1; }
    return total;
  }, [form]);
  const competitiveRating = Math.max(1000, 1000 + stats.overall.wins * 24 - stats.overall.losses * 16);
  const status = myMatches[0]?.endedAt ? "ACTIVE COMPETITOR" : "READY FOR MATCH";
  const isSelf = user?.id === userId;

  return (
    <section className="relative mt-6 overflow-hidden rounded-[30px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(6,9,14,.98),rgba(2,5,9,.99))] shadow-[0_35px_120px_-55px_rgba(250,204,21,.5)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(250,204,21,.14),transparent_28%),radial-gradient(circle_at_88%_15%,rgba(34,211,238,.10),transparent_25%),radial-gradient(circle_at_50%_100%,rgba(139,92,246,.08),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,.4)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.4)_1px,transparent_1px)] [background-size:34px_34px]" />

      <div className="relative grid gap-0 xl:grid-cols-[1.18fr_.82fr]">
        <div className="p-5 sm:p-7 lg:p-9">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1.5 font-mono text-[8px] font-black uppercase tracking-[.25em] text-emerald-200"><Radio className="h-3 w-3" /> PERSONAL COMMAND CENTER</span>
            <span className="font-mono text-[8px] font-black uppercase tracking-[.25em] text-white/25">PLAYER IDENTITY 3.0</span>
          </div>

          <div className="mt-6 flex items-end gap-4 sm:gap-5">
            <div className="relative shrink-0 rounded-[24px] border border-amber-300/30 bg-black/30 p-1.5 shadow-[0_0_45px_-20px_rgba(250,204,21,.8)]">
              <Avatar path={playerAvatar} nickname={playerName} size={92} />
              <span className="absolute -right-2 -top-2 grid h-8 w-8 place-items-center rounded-xl border border-amber-300/30 bg-[#0c1016] text-amber-200 shadow-lg"><Crown className="h-4 w-4" /></span>
            </div>
            <div className="min-w-0">
              <div className="font-mono text-[9px] font-bold uppercase tracking-[.28em] text-amber-200/65">{status}</div>
              <h2 className="mt-1 truncate font-display text-4xl font-black tracking-[.06em] text-white sm:text-6xl">{playerName ?? initials(playerName)} <span className="gold-text">// {String(level).padStart(2, "0")}</span></h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[.16em] text-white/30"><span>{stats.overall.wins} W</span><span>•</span><span>{stats.overall.losses} L</span><span>•</span><span>{winRate}% WIN RATE</span><span>•</span><span>{competitiveRating} RATING</span></div>
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="MATCHES" value={stats.overall.total} icon={<Trophy className="h-4 w-4" />} />
            <Stat label="WINS" value={stats.overall.wins} icon={<Medal className="h-4 w-4" />} />
            <Stat label="2V2" value={stats.team.total} icon={<Users className="h-4 w-4" />} />
            <Stat label="STREAK" value={streak} icon={<Flame className="h-4 w-4" />} />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/8 bg-white/[.025] p-4">
              <div className="flex items-center justify-between gap-3"><div><div className="font-mono text-[8px] font-black uppercase tracking-[.25em] text-cyan-200/60">PLAYER XP</div><div className="mt-1 font-display text-xl tracking-wide text-white">LEVEL {level} <span className="text-white/25">/ {nextXp} XP</span></div></div><Sparkles className="h-5 w-5 text-amber-200" /></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-violet-400" style={{ width: `${progress}%` }} /></div>
              <div className="mt-2 flex justify-between font-mono text-[8px] font-bold uppercase tracking-[.18em] text-white/25"><span>{xp.toLocaleString("cs-CZ")} XP</span><span>{progress}%</span></div>
            </div>
            <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[.03] p-4">
              <div className="flex items-center justify-between"><div><div className="font-mono text-[8px] font-black uppercase tracking-[.25em] text-amber-200/60">COMPETITIVE SIGNAL</div><div className="mt-1 font-display text-xl text-white">{competitiveRating} <span className="text-white/25">RATING</span></div></div><Target className="h-5 w-5 text-amber-200" /></div>
              <div className="mt-3 flex items-center gap-1.5">{form.slice(0, 8).map((r, i) => <span key={`${r}-${i}`} className={`grid h-6 w-6 place-items-center rounded-md border text-[8px] font-black ${r === "W" ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200" : "border-rose-300/30 bg-rose-300/10 text-rose-200"}`}>{r}</span>)}{!form.length && <span className="font-mono text-[8px] text-white/25">NO FORM DATA</span>}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <WalletTile label="SPORT DOLLARS" value={isSelf ? `$${userDollars.toFixed(0)}` : "—"} icon={<WalletCards className="h-4 w-4" />} tone="cyan" />
            <WalletTile label="SLOT CZK" value={isSelf ? `${Math.round(slotCZK).toLocaleString("cs-CZ")}` : "—"} icon={<Gamepad2 className="h-4 w-4" />} tone="gold" />
          </div>
        </div>

        <aside className="border-t border-white/8 bg-black/20 p-5 sm:p-7 xl:border-l xl:border-t-0">
          <div className="font-mono text-[9px] font-black uppercase tracking-[.28em] text-cyan-200/65">OPERATIONS DECK</div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Mini label="SOLO" value={`${stats.solo.wins}-${stats.solo.losses}`} />
            <Mini label="2V2" value={`${stats.team.wins}-${stats.team.losses}`} />
            <Mini label="SPORTS" value={sports.length} />
            <Mini label="TEAMS" value={myTeams.length} />
            <Mini label="BETS" value={betStats.settled} />
            <Mini label="BET NET" value={isSelf ? `${betStats.net >= 0 ? "+" : ""}${betStats.net.toFixed(0)} $` : "—"} />
          </div>

          <div className="mt-4">
            <div className="mb-2 font-mono text-[8px] font-black uppercase tracking-[.25em] text-white/25">QUICK ROUTES</div>
            <div className="grid grid-cols-2 gap-1.5">
              <QuickRoute to="/schedule" label="PLAY NEXT" icon={<Swords className="h-3.5 w-3.5" />} tone="gold" />
              <QuickRoute to="/rankings" label="SCOREBOARD" icon={<BarChart3 className="h-3.5 w-3.5" />} tone="cyan" />
              <QuickRoute to="/trophy-room" label="TROPHIES" icon={<Crown className="h-3.5 w-3.5" />} tone="violet" />
              <QuickRoute to="/teams" label="TEAM HQ" icon={<ShieldCheck className="h-3.5 w-3.5" />} tone="cyan" />
              <QuickRoute to="/my-bets" label="MY BETS" icon={<Coins className="h-3.5 w-3.5" />} tone="gold" />
              <QuickRoute to="/records" label="RECORDS" icon={<Trophy className="h-3.5 w-3.5" />} tone="violet" />
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 font-mono text-[8px] font-black uppercase tracking-[.25em] text-white/25">TEAMS</div>
            <div className="space-y-1.5">{myTeams.length ? myTeams.map((team) => <Link key={team.id} to="/teams" className="group flex items-center justify-between rounded-xl border border-white/8 bg-white/[.02] px-3 py-2.5 hover:border-cyan-300/25"><span className="min-w-0 truncate text-[10px] font-bold text-white/80">{team.name}</span><ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-cyan-200" /></Link>) : <div className="rounded-xl border border-white/8 bg-white/[.02] px-3 py-2.5 font-mono text-[8px] uppercase tracking-[.16em] text-white/25">NO ACTIVE TEAM</div>}</div>
          </div>

          <Link to="/trophy-room" className="mt-4 flex items-center justify-between rounded-2xl border border-violet-300/15 bg-violet-300/[.04] px-3 py-3 hover:border-violet-300/30"><div className="flex items-center gap-2"><Medal className="h-4 w-4 text-violet-200" /><div><div className="font-display text-base text-white">ACHIEVEMENTS & TROPHIES</div><div className="font-mono text-[7px] uppercase tracking-[.18em] text-white/30">Open Trophy Room</div></div></div><ChevronRight className="h-4 w-4 text-white/30" /></Link>
        </aside>
      </div>

      <div className="relative border-t border-white/8 bg-black/25 px-5 py-4 sm:px-7">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2 font-mono text-[8px] font-black uppercase tracking-[.22em] text-white/25"><Flame className="h-3.5 w-3.5 text-amber-200" /> RECENT FORM</div><Link to="/activity" className="font-mono text-[8px] font-black uppercase tracking-[.2em] text-amber-200 hover:text-white">OPEN LIVE PULSE →</Link></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{myMatches.slice(0, 4).map((m) => { const out = outcomeFor(playerName, m); const sport = SPORTS[m.sport as keyof typeof SPORTS]; return <Link key={m.id} to="/match" search={{ id: m.id }} className="group rounded-xl border border-white/8 bg-white/[.02] p-3 hover:border-amber-300/25"><div className="flex items-center justify-between gap-2"><span className="font-mono text-[7px] font-black uppercase tracking-[.16em] text-white/25">{sport?.emoji ?? "◆"} {sport?.name ?? m.sport}</span><span className={`rounded-md px-1.5 py-1 text-[8px] font-black ${out === "W" ? "bg-emerald-300/10 text-emerald-200" : out === "L" ? "bg-rose-300/10 text-rose-200" : "bg-white/5 text-white/30"}`}>{out ?? "—"}</span></div><div className="mt-2 truncate text-[10px] font-semibold text-white/75">{m.title ?? `${m.home} vs ${m.away}`}</div><div className="mt-1 font-mono text-[8px] text-white/25">{m.homeScore ?? 0} : {m.awayScore ?? 0}</div></Link> })}{!myMatches.length && <div className="col-span-full rounded-xl border border-white/8 bg-white/[.02] p-4 font-mono text-[8px] uppercase tracking-[.18em] text-white/25">NO MATCH HISTORY YET</div>}</div>
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

function WalletTile({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "cyan" | "gold" }) {
  const cls = tone === "cyan" ? "border-cyan-300/20 bg-cyan-300/[.04] text-cyan-100" : "border-amber-300/20 bg-amber-300/[.04] text-amber-100";
  return <div className={`rounded-2xl border p-3 ${cls}`}><div className="flex items-center gap-2 font-mono text-[8px] font-black uppercase tracking-[.18em] opacity-60">{icon}{label}</div><div className="mt-1 font-display text-xl">{value}</div></div>;
}

function QuickRoute({ to, label, icon, tone }: { to: string; label: string; icon: React.ReactNode; tone: "gold" | "cyan" | "violet" }) {
  const cls = tone === "gold" ? "border-amber-300/15 bg-amber-300/[.03] hover:border-amber-300/35" : tone === "cyan" ? "border-cyan-300/15 bg-cyan-300/[.03] hover:border-cyan-300/35" : "border-violet-300/15 bg-violet-300/[.03] hover:border-violet-300/35";
  return <Link to={to} className={`group flex items-center gap-2 rounded-xl border px-2.5 py-2.5 transition ${cls}`}><span className="text-white/75">{icon}</span><span className="min-w-0 flex-1 truncate font-mono text-[7px] font-black uppercase tracking-[.12em] text-white/65">{label}</span><ChevronRight className="h-3 w-3 text-white/15 transition group-hover:translate-x-0.5 group-hover:text-white/60" /></Link>;
}
