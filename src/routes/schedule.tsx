import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, Clock, Crown, Filter, Pencil, Plus, Radio, Shield, Trash2, Trophy, Users, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SPORTS, SPORT_LIST, type Match, type SportId } from "@/lib/matches";
import { fetchAllMatches, removeMatch, updateMatchFixture } from "@/lib/matches-db";
import { fetchTournaments, type Tournament } from "@/lib/tournaments-db";
import { useMatchHistory } from "@/lib/odds";
import { OddsPill } from "@/components/OddsBoard";
import { useMatchesRealtime } from "@/lib/live";
import { UltraArenaShell, UltraLinkButton, UltraMetric, UltraSection, LiveBadge, TimeBadge, PowerMark } from "@/components/UltraArenaShell";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [
      { title: "Match Planner — SportChmeláci" },
      { name: "description", content: "Ultra S+ plánování 1v1 a 2v2 zápasů, matchday, sportovní filtry a turnaje." },
    ],
  }),
  component: SchedulePage,
});

type PlannerFilter = "all" | SportId;
type PlannerMode = "all" | "1v1" | "2v2" | "tournaments";

function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function dayKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDay(ms: number) {
  return new Intl.DateTimeFormat("cs-CZ", { weekday: "long", day: "numeric", month: "long" }).format(new Date(ms));
}

function SchedulePage() {
  const { user, isAdmin, loading } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sport, setSport] = useState<PlannerFilter>("all");
  const [mode, setMode] = useState<PlannerMode>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("all");
  const { history } = useMatchHistory();

  const load = useCallback(() => {
    fetchAllMatches().then(setMatches).catch(() => setMatches([]));
    fetchTournaments().then(setTournaments).catch(() => setTournaments([]));
  }, []);

  useEffect(() => { load(); }, [load]);
  useMatchesRealtime(load);

  const now = Date.now();
  const upcoming = useMemo(() => matches.filter((m) => m.scheduledAt && !m.endedAt && m.scheduledAt >= now - 30 * 60_000), [matches, now]);
  const filteredMatches = useMemo(() => upcoming
    .filter((m) => sport === "all" || m.sport === sport)
    .filter((m) => mode === "all" || (mode === "2v2" ? m.matchFormat === "2v2" : mode === "1v1" ? m.matchFormat !== "2v2" : false))
    .filter((m) => selectedDay === "all" || dayKey(m.scheduledAt ?? 0) === selectedDay)
    .sort((a, b) => (a.scheduledAt ?? 0) - (b.scheduledAt ?? 0)), [upcoming, sport, mode, selectedDay]);

  const dayOptions = useMemo(() => {
    const seen = new Map<string, number>();
    for (const m of upcoming) {
      if (!m.scheduledAt) continue;
      const key = dayKey(m.scheduledAt);
      if (!seen.has(key)) seen.set(key, m.scheduledAt);
    }
    return [...seen.entries()].sort((a, b) => a[1] - b[1]);
  }, [upcoming]);

  const nextMatch = filteredMatches[0] ?? upcoming.find((m) => m.scheduledAt && m.scheduledAt >= now);
  const liveCount = matches.filter((m) => !m.endedAt).length;
  const teamCount = upcoming.filter((m) => m.matchFormat === "2v2").length;
  const dayGroups = useMemo(() => {
    const map = new Map<string, Match[]>();
    filteredMatches.forEach((m) => {
      if (!m.scheduledAt) return;
      const key = dayKey(m.scheduledAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return [...map.entries()].sort((a, b) => (a[1][0].scheduledAt ?? 0) - (b[1][0].scheduledAt ?? 0));
  }, [filteredMatches]);

  if (loading) return null;

  return (
    <main className="relative mx-auto max-w-[1450px] px-3 pb-32 pt-4 sm:px-5 lg:px-7">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[700px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(250,204,21,.12),transparent_64%)] blur-3xl" />
        <div className="absolute right-0 top-[45%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,.07),transparent_64%)] blur-3xl" />
      </div>

      <UltraArenaShell
        eyebrow="SPORTCHMELÁCI · MATCHMAKING OPERATIONS"
        title="MATCH PLANNER"
        subtitle="Naplánuj další souboj. Vyber sport, formát 1v1 nebo 2v2 a otevři konkrétní matchday. Týmové zápasy se automaticky berou jako týmová historie."
        actions={
          <div className="flex flex-wrap gap-2">
            <UltraLinkButton href="/" primary><Plus className="mr-2 h-4 w-4" />VYTVOŘIT ZÁPAS</UltraLinkButton>
            <UltraLinkButton href="/leagues">CHMEL LEAGUE</UltraLinkButton>
          </div>
        }
      >
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <UltraMetric label="UPCOMING" value={String(upcoming.length)} hint="naplánovaných duelů" icon={<CalendarDays className="h-4 w-4 text-amber-200" />} />
          <UltraMetric label="LIVE SIGNAL" value={String(liveCount)} hint="otevřených sportovních momentů" icon={<Radio className="h-4 w-4 text-emerald-300" />} />
          <UltraMetric label="2V2 READY" value={String(teamCount)} hint="týmových zápasů" icon={<Users className="h-4 w-4 text-cyan-200" />} />
          <UltraMetric label="SPORTS" value={String(SPORT_LIST.length)} hint="dostupných disciplín" icon={<Trophy className="h-4 w-4 text-violet-200" />} />
        </div>

        {nextMatch && (
          <section className="mt-4 overflow-hidden rounded-[28px] border border-amber-300/20 bg-[radial-gradient(circle_at_20%_0%,rgba(250,204,21,.12),transparent_28%),radial-gradient(circle_at_90%_100%,rgba(34,211,238,.08),transparent_25%),rgba(0,0,0,.24)] shadow-[0_30px_90px_-55px_rgba(250,204,21,.55)]">
            <div className="grid gap-0 lg:grid-cols-[1fr_330px]">
              <div className="p-6 sm:p-8 lg:p-10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="aaa-meta text-amber-200/70">NEXT MATCHDAY</span>
                  {nextMatch.endedAt ? <TimeBadge>FINAL</TimeBadge> : <LiveBadge />}
                  {nextMatch.matchFormat === "2v2" && <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[.18em] text-cyan-200">2V2 · TEAM</span>}
                </div>
                <div className="mt-5 flex items-center gap-3 text-sm text-white/35"><span className="text-2xl">{SPORTS[nextMatch.sport].emoji}</span><span>{SPORTS[nextMatch.sport].name}</span><span>·</span><span>{nextMatch.ownerNickname}</span></div>
                <div className="mt-3 grid max-w-4xl grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <div className="truncate font-display text-3xl font-black tracking-wide text-white sm:text-5xl">{nextMatch.teamA}</div>
                  <div className="rounded-2xl border border-amber-300/30 bg-amber-300/[.06] px-4 py-3 text-center"><div className="font-mono text-[8px] uppercase tracking-[.26em] text-amber-200/50">VS</div><div className="mt-1 font-display text-xl text-amber-100">{nextMatch.matchFormat === "2v2" ? "TEAM" : "DUEL"}</div></div>
                  <div className="truncate text-right font-display text-3xl font-black tracking-wide text-white sm:text-5xl">{nextMatch.teamB}</div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[.18em] text-white/35"><span className="inline-flex items-center gap-2"><Clock className="h-3.5 w-3.5 text-amber-200" />{new Date(nextMatch.scheduledAt ?? now).toLocaleString("cs-CZ", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span><OddsPill match={nextMatch} history={history} /></div>
                <div className="mt-5 flex flex-wrap gap-2"><UltraLinkButton href={`/match?id=${encodeURIComponent(nextMatch.id)}`} primary>OTEVŘÍT MATCH CENTER <ArrowUpRight className="ml-2 h-3.5 w-3.5" /></UltraLinkButton><UltraLinkButton href="/bets">SÁZKY</UltraLinkButton></div>
              </div>
              <aside className="border-t border-white/8 bg-black/20 p-6 sm:p-8 lg:border-l lg:border-t-0">
                <div className="aaa-meta text-cyan-200/60">MATCH SIGNAL</div>
                <div className="mt-5 space-y-3">
                  <SignalRow icon={<CalendarDays className="h-4 w-4" />} label="FORMAT" value={nextMatch.matchFormat === "2v2" ? "2V2 TEAM" : "1V1 SOLO"} />
                  <SignalRow icon={<Shield className="h-4 w-4" />} label="SPORT" value={SPORTS[nextMatch.sport].name} />
                  <SignalRow icon={<Zap className="h-4 w-4" />} label="STATUS" value={nextMatch.endedAt ? "FINAL" : "SCHEDULED"} accent />
                </div>
                <div className="mt-5 rounded-2xl border border-white/8 bg-white/[.02] p-4"><div className="font-mono text-[8px] uppercase tracking-[.24em] text-white/25">MATCHDAY ROUTE</div><div className="mt-2 font-display text-xl tracking-wide text-white">PLAN → PLAY → RESULT</div><p className="mt-2 text-[10px] leading-5 text-white/30">Po dokončení se výsledek propíše do Scoreboardu, Leagues a týmového systému.</p></div>
              </aside>
            </div>
          </section>
        )}

        <UltraSection title="MATCHDAY CONTROL" kicker="FILTERS" icon={<Filter className="h-4 w-4 text-amber-200" />}>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_.8fr]">
            <div>
              <div className="mb-2 font-mono text-[8px] uppercase tracking-[.25em] text-white/25">SPORT UNIVERSE</div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button onClick={() => { setSport("all"); setSelectedDay("all"); }} className={`shrink-0 rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-[.16em] ${sport === "all" ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : "border-white/8 text-white/30 hover:text-white"}`}>ALL SPORTS</button>
                {SPORT_LIST.map((s) => <button key={s.id} onClick={() => setSport(s.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-[.16em] ${sport === s.id ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/8 text-white/30 hover:text-white"}`}>{s.emoji} {s.name}</button>)}
              </div>
            </div>
            <div>
              <div className="mb-2 font-mono text-[8px] uppercase tracking-[.25em] text-white/25">FORMAT</div>
              <div className="grid grid-cols-3 gap-1.5">
                {(["all", "1v1", "2v2"] as PlannerMode[]).map((item) => <button key={item} onClick={() => setMode(item)} className={`rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-[.16em] ${mode === item ? "border-amber-300/40 bg-amber-300/10 text-amber-100" : "border-white/8 text-white/30 hover:text-white"}`}>{item === "all" ? "VŠE" : item === "1v1" ? "1V1 SOLO" : "2V2 TEAM"}</button>)}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-1.5 overflow-x-auto border-t border-white/8 pt-4">
            <button onClick={() => setSelectedDay("all")} className={`shrink-0 rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-[.16em] ${selectedDay === "all" ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/8 text-white/30"}`}>VŠECHNY DNY</button>
            {dayOptions.map(([key, ms]) => <button key={key} onClick={() => setSelectedDay(key)} className={`shrink-0 rounded-xl border px-3 py-2 text-[9px] font-black uppercase tracking-[.12em] ${selectedDay === key ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/8 text-white/30"}`}>{formatDay(ms)}</button>)}
          </div>
        </UltraSection>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <UltraSection title="UPCOMING MATCHDAY" kicker="FIXTURE BOARD" icon={<CalendarDays className="h-4 w-4 text-amber-200" />}>
            {dayGroups.length === 0 ? <EmptyState /> : <div className="space-y-5">{dayGroups.map(([key, dayMatches]) => <div key={key}><div className="mb-2 flex items-center gap-2"><div className="h-px flex-1 bg-gradient-to-r from-amber-300/30 to-transparent" /><span className="font-display text-lg tracking-wide text-white/70">{formatDay(dayMatches[0].scheduledAt ?? now)}</span><span className="font-mono text-[8px] uppercase tracking-[.18em] text-white/20">{dayMatches.length} FIXTURE</span></div><div className="space-y-2">{dayMatches.map((m) => <FixtureCard key={m.id} match={m} history={history} isAdmin={isAdmin} editing={editing === m.id} onEdit={() => setEditing(editing === m.id ? null : m.id)} onDelete={async () => { if (!confirm("Smazat naplánovaný zápas?")) return; await removeMatch(m.id); load(); }} onSaved={() => { setEditing(null); load(); }} />)}</div></div>)}</div>}
          </UltraSection>

          <div className="space-y-4">
            <UltraSection title="TEAM RADAR" kicker="2V2" icon={<Users className="h-4 w-4 text-cyan-200" />}>
              <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[.03] p-4"><div className="font-mono text-[8px] uppercase tracking-[.25em] text-cyan-200/50">2V2 QUEUE</div><div className="mt-2 font-display text-3xl text-cyan-100">{teamCount}</div><div className="mt-1 text-[10px] text-white/30">týmových zápasů čeká na start</div><div className="mt-4 flex flex-wrap gap-2"><UltraLinkButton href="/teams">TEAM HQ</UltraLinkButton><UltraLinkButton href="/rankings" primary>SCOREBOARD</UltraLinkButton></div></div>
            </UltraSection>

            <UltraSection title="TOURNAMENT RADAR" kicker="EVENTS" icon={<Trophy className="h-4 w-4 text-violet-200" />}>
              <div className="space-y-2">{tournaments.filter((t) => t.scheduledAt && t.scheduledAt > now - 6 * 3600_000).slice(0, 4).map((t) => <Link key={t.id} to="/tournament" search={{ id: t.id }} className="group block rounded-2xl border border-white/8 bg-white/[.02] p-3 hover:border-violet-300/25"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="truncate font-display text-base text-white">{t.name}</div><div className="aaa-meta mt-1">{SPORTS[t.sport]?.name ?? t.sport} · {t.format === "round_robin" ? "KAŽDÝ S KAŽDÝM" : "PLAYOFF"}</div></div><ArrowUpRight className="h-4 w-4 text-white/20 transition group-hover:text-violet-200" /></div></Link>)}{tournaments.length === 0 && <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-sm text-white/25">Žádné naplánované turnaje.</div>}</div>
            </UltraSection>

            <UltraSection title="PLANNER ROUTES" kicker="FAST ACCESS" icon={<PowerMark />}>
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1"><UltraLinkButton href="/sport-center">SPORT HUB</UltraLinkButton><UltraLinkButton href="/activity">LIVE PULSE</UltraLinkButton><UltraLinkButton href="/trophy-room">TROPHY ROOM</UltraLinkButton></div>
            </UltraSection>
          </div>
        </div>
      </UltraArenaShell>
    </main>
  );
}

function FixtureCard({ match, history, isAdmin, editing, onEdit, onDelete, onSaved }: { match: Match; history: unknown[]; isAdmin: boolean; editing: boolean; onEdit: () => void; onDelete: () => void; onSaved: () => void }) {
  const cfg = SPORTS[match.sport];
  return <article className="relative overflow-hidden rounded-2xl border border-white/8 bg-black/20 transition hover:border-amber-300/25"><div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-300/90 via-cyan-300/40 to-transparent" /><div className="p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="text-xl">{cfg.emoji}</span><span className="font-mono text-[8px] uppercase tracking-[.22em] text-white/35">{cfg.name}</span>{match.matchFormat === "2v2" && <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2 py-1 font-mono text-[7px] font-black uppercase tracking-[.16em] text-cyan-200">2V2 TEAM</span>}</div><TimeBadge>{new Date(match.scheduledAt ?? Date.now()).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</TimeBadge></div><Link to="/match" search={{ id: match.id }} className="mt-4 block"><div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><span className="truncate font-display text-xl font-black tracking-wide text-white sm:text-2xl">{match.teamA}</span><span className="rounded-xl border border-amber-300/20 bg-amber-300/[.05] px-3 py-2 font-mono text-sm text-amber-100">VS</span><span className="truncate text-right font-display text-xl font-black tracking-wide text-white sm:text-2xl">{match.teamB}</span></div><div className="mt-3 flex flex-wrap items-center gap-3 text-[9px] uppercase tracking-[.18em] text-white/25"><span>{match.ownerNickname}</span><OddsPill match={match} history={history as any} /></div></Link>{isAdmin && <div className="mt-4 flex items-center justify-end gap-1 border-t border-white/8 pt-3"><button onClick={onEdit} className="rounded-xl border border-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-[.16em] text-white/40 hover:border-amber-300/30 hover:text-amber-100"><Pencil className="mr-2 inline h-3.5 w-3.5" />UPRAVIT</button><button onClick={onDelete} className="rounded-xl border border-rose-300/10 px-3 py-2 text-[9px] font-black uppercase tracking-[.16em] text-rose-200/60 hover:border-rose-300/30 hover:text-rose-200"><Trash2 className="mr-2 inline h-3.5 w-3.5" />SMAZAT</button></div>}{editing && <EditFixture match={match} onClose={onEdit} onSaved={onSaved} />}</div></article>;
}

function SignalRow({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) { return <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[.02] p-3"><div className="flex items-center gap-2 text-white/25"><span className="text-amber-200/80">{icon}</span><span className="font-mono text-[8px] uppercase tracking-[.22em]">{label}</span></div><span className={`font-mono text-[10px] font-black uppercase tracking-[.12em] ${accent ? "text-emerald-200" : "text-white/70"}`}>{value}</span></div>; }
function EmptyState() { return <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[.015] p-6 text-center"><div><Zap className="mx-auto h-7 w-7 text-amber-200/50" /><div className="mt-2 font-mono text-[10px] font-black uppercase tracking-[.26em] text-white/30">NO MATCHDAY SIGNAL</div><div className="mt-1 max-w-sm text-sm text-white/20">Změň filtr nebo vytvoř nový zápas v Lobby.</div></div></div>; }

function EditFixture({ match, onClose, onSaved }: { match: Match; onClose: () => void; onSaved: () => void }) {
  const [teamA, setTeamA] = useState(match.teamA);
  const [teamB, setTeamB] = useState(match.teamB);
  const [when, setWhen] = useState(toLocalInput(match.scheduledAt ?? Date.now()));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async () => { setBusy(true); setErr(null); try { const ts = new Date(when).getTime(); if (!ts || Number.isNaN(ts)) throw new Error("Neplatné datum"); await updateMatchFixture(match.id, { teamA: teamA.trim(), teamB: teamB.trim(), scheduledAt: ts }); onSaved(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); } };
  const field = "w-full rounded-xl border border-primary/20 bg-background/40 px-3 py-2 text-sm focus:border-primary focus:outline-none";
  return <div className="mt-4 border-t border-white/8 pt-4"><div className="font-mono text-[8px] uppercase tracking-[.28em] text-amber-200/60">ADMIN FIXTURE CONTROL</div><div className="mt-3 grid gap-2 sm:grid-cols-2"><input value={teamA} onChange={(e) => setTeamA(e.target.value)} className={field} maxLength={80} aria-label="Tým A" /><input value={teamB} onChange={(e) => setTeamB(e.target.value)} className={field} maxLength={80} aria-label="Tým B" /></div><label className="mt-2 flex items-center gap-2"><Clock className="h-4 w-4 text-amber-200" /><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${field} font-mono text-amber-100`} aria-label="Nový čas" /></label>{err && <p className="mt-2 text-xs text-rose-200">{err}</p>}<div className="mt-3 flex gap-2"><button onClick={save} disabled={busy} className="rounded-xl bg-primary px-4 py-2 text-xs font-black text-primary-foreground disabled:opacity-50">{busy ? "UKLÁDÁM…" : "ULOŽIT"}</button><button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-xs text-white/40">ZRUŠIT</button></div></div>;
}
