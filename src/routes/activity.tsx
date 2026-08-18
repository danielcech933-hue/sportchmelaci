import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, ArrowUpRight, BellRing, CalendarClock, Coins, Radio, RefreshCw, Trophy, Users, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface MatchRow {
  id: string;
  sport: string;
  team_a: string;
  team_b: string;
  score_a: number | null;
  score_b: number | null;
  started_at: string | null;
  scheduled_at: string | null;
  ended_at: string | null;
  confirmed_at: string | null;
  bets: unknown[] | null;
}

interface ActivityItem {
  id: string;
  type: "live" | "result" | "bet" | "schedule" | "achievement";
  title: string;
  detail: string;
  meta: string;
  tone: "cyan" | "gold" | "violet" | "emerald";
  href?: string;
}

const SPORT_LABELS: Record<string, string> = {
  nohejball: "NOHEJBAL",
  football: "FOTBAL",
  tennis: "TENIS",
  volleyball: "VOLEJBAL",
  basketball: "BASKET",
  padel: "PADEL",
  pingpong: "PING PONG",
  darts: "ŠIPKY",
  beerpong: "BEER PONG",
  foosball: "STOLNÍ FOTBÁLEK",
  eafc: "EA SPORTS FC",
  nhl: "NHL",
  nba2k: "NBA 2K",
  rocketleague: "ROCKET LEAGUE",
  f1: "F1",
  topspin: "TOPSPIN",
};

function sportLabel(sport: string) {
  return SPORT_LABELS[sport] ?? sport.replaceAll("_", " ").toUpperCase();
}

function timeAgo(input: string | null) {
  if (!input) return "--";
  const diff = Math.max(0, Date.now() - new Date(input).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "PRÁVĚ TEĎ";
  if (min < 60) return `PŘED ${min} MIN`;
  const h = Math.floor(min / 60);
  if (h < 24) return `PŘED ${h} H`; 
  return `PŘED ${Math.floor(h / 24)} D`;
}

function toneClass(tone: ActivityItem["tone"]) {
  return tone === "cyan"
    ? "border-cyan-300/20 bg-cyan-300/[0.05] text-cyan-200"
    : tone === "gold"
      ? "border-amber-300/20 bg-amber-300/[0.05] text-amber-200"
      : tone === "violet"
        ? "border-violet-300/20 bg-violet-300/[0.05] text-violet-200"
        : "border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-200";
}

export function ActivityPage() {
  const { user, nickname } = useAuth();
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(Date.now());
  const [filter, setFilter] = useState<"all" | ActivityItem["type"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("matches")
      .select("id,sport,team_a,team_b,score_a,score_b,started_at,scheduled_at,ended_at,confirmed_at,bets")
      .order("scheduled_at", { ascending: false })
      .limit(50);
    setMatches((data ?? []) as MatchRow[]);
    setUpdatedAt(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 12000);
    const channel = supabase.channel("sport-activity-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => void load())
      .subscribe();
    return () => { window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, [load]);

  const liveMatches = useMemo(() => matches.filter((m) => !!m.started_at && !m.ended_at), [matches]);
  const upcoming = useMemo(() => matches.filter((m) => !m.started_at && !m.ended_at).slice(0, 6), [matches]);
  const finished = useMemo(() => matches.filter((m) => !!m.ended_at).slice(0, 8), [matches]);

  const items = useMemo<ActivityItem[]>(() => {
    const next: ActivityItem[] = [];
    liveMatches.slice(0, 6).forEach((m) => next.push({ id: `live-${m.id}`, type: "live", title: `${m.team_a} vs ${m.team_b}`, detail: `${sportLabel(m.sport)} · ${m.score_a ?? 0}:${m.score_b ?? 0}`, meta: "LIVE NOW", tone: "cyan", href: `/match?id=${m.id}` }));
    finished.slice(0, 5).forEach((m) => next.push({ id: `result-${m.id}`, type: "result", title: `${m.team_a} vs ${m.team_b}`, detail: `${sportLabel(m.sport)} · ${m.score_a ?? 0}:${m.score_b ?? 0}`, meta: timeAgo(m.ended_at), tone: "gold", href: `/match?id=${m.id}` }));
    upcoming.slice(0, 5).forEach((m) => next.push({ id: `schedule-${m.id}`, type: "schedule", title: `${m.team_a} vs ${m.team_b}`, detail: `${sportLabel(m.sport)} · plánovaný zápas`, meta: m.scheduled_at ? new Date(m.scheduled_at).toLocaleString("cs-CZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "SCHEDULED", tone: "violet", href: `/match?id=${m.id}` }));
    matches.slice(0, 12).forEach((m) => {
      const bets = Array.isArray(m.bets) ? m.bets : [];
      bets.slice(-2).forEach((b: any, idx) => {
        const amount = Number(b?.amount ?? 0);
        if (!amount) return;
        const bettor = b?.bettor ?? "Hráč";
        next.push({ id: `bet-${m.id}-${b?.id ?? idx}`, type: "bet", title: `${bettor} vsadil $${amount.toLocaleString("en-US")}`, detail: `${m.team_a} vs ${m.team_b} · @ ${(Number(b?.lockedOdds ?? 0)).toFixed(2)}`, meta: "BETTING ACTIVITY", tone: "emerald", href: `/match?id=${m.id}` });
      });
    });
    return next.sort((a, b) => a.id.localeCompare(b.id)).reverse();
  }, [finished, liveMatches, matches, upcoming]);

  const visibleItems = filter === "all" ? items : items.filter((item) => item.type === filter);
  const stats = [
    { label: "LIVE", value: liveMatches.length, icon: Radio, tone: "text-cyan-300" },
    { label: "UPCOMING", value: upcoming.length, icon: CalendarClock, tone: "text-violet-300" },
    { label: "RESULTS", value: finished.length, icon: Trophy, tone: "text-amber-300" },
    { label: "BET TICKETS", value: matches.reduce((sum, m) => sum + (Array.isArray(m.bets) ? m.bets.length : 0), 0), icon: Coins, tone: "text-emerald-300" },
  ];

  return (
    <main className="min-h-screen px-3 pb-28 pt-5 sm:px-5 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-[30px] border border-primary/20 bg-[radial-gradient(circle_at_12%_0%,rgba(255,208,75,.16),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(45,213,255,.12),transparent_26%),linear-gradient(135deg,#05070c,#0b1019_55%,#070a11)] p-5 shadow-[0_40px_120px_-55px_rgba(255,208,75,.38)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.3)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.3)_1px,transparent_1px)] [background-size:36px_36px]" />
          <div className="relative grid gap-7 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[.34em] text-primary"><Activity className="h-4 w-4" /> COMMAND CENTER // LIVE ACTIVITY</div>
              <h1 className="font-display text-5xl leading-[.88] tracking-[.04em] text-white sm:text-7xl">SPORTCHMELÁCI<br /><span className="text-primary [text-shadow:0_0_35px_rgba(255,208,75,.25)]">LIVE PULSE</span></h1>
              <p className="mt-5 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Jedna obrazovka pro to, co se právě děje: živé zápasy, nové výsledky, naplánované souboje a aktivitu kolem sázek. Aktualizace běží automaticky.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link to="/live-arena" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_0_30px_-12px_var(--color-primary)]"><Radio className="h-4 w-4" /> Otevřít LIVE ARENU</Link>
                <Link to="/betting" className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-white/[.03] px-4 py-2.5 text-sm font-semibold text-foreground hover:border-primary/40"><Coins className="h-4 w-4" /> Betting Hub</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              {stats.map((stat) => { const Icon = stat.icon; return <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur-xl"><div className="flex items-center gap-2 text-muted-foreground"><Icon className={`h-4 w-4 ${stat.tone}`} /><span className="font-mono text-[9px] font-bold tracking-[.2em]">{stat.label}</span></div><div className="mt-3 font-mono text-3xl font-black text-white">{stat.value}</div></div>; })}
            </div>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-3xl border border-cyan-300/15 bg-black/30 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3"><div><p className="font-mono text-[9px] font-bold tracking-[.3em] text-cyan-300">REALTIME FEED</p><h2 className="mt-1 font-display text-2xl tracking-wide text-white">CO TO SE DĚJE</h2></div><button onClick={() => void load()} className="rounded-xl border border-border/60 bg-white/[.03] p-2 text-muted-foreground hover:text-white" aria-label="Obnovit"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
            <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {[ ["all", "VŠE"], ["live", "LIVE"], ["result", "VÝSLEDKY"], ["schedule", "PLÁN"], ["bet", "SÁZKY"] ].map(([value, label]) => <button key={value} onClick={() => setFilter(value as typeof filter)} className={`shrink-0 rounded-full border px-3 py-1.5 font-mono text-[9px] font-bold tracking-[.16em] transition ${filter === value ? "border-primary bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
            </div>
            <div className="space-y-2.5">
              {loading && visibleItems.length === 0 ? <div className="rounded-2xl border border-border/50 bg-white/[.02] p-5 text-sm text-muted-foreground">Načítám živý feed…</div> : null}
              <AnimatePresence initial={false}>
                {visibleItems.slice(0, 14).map((item) => <motion.div key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`group flex items-center gap-3 rounded-2xl border p-3 ${toneClass(item.tone)}`}>
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25"><Zap className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-white">{item.title}</div><div className="truncate text-xs text-muted-foreground">{item.detail}</div></div>
                  <div className="hidden shrink-0 text-right sm:block"><div className="font-mono text-[8px] font-bold tracking-[.14em] text-muted-foreground">{item.meta}</div><div className="mt-1 font-mono text-[9px] text-white/60">{nickname && item.type === "bet" && item.title.includes(nickname) ? "TVŮJ TIKET" : ""}</div></div>
                  {item.href ? <Link to={item.href as any} className="rounded-xl border border-white/10 bg-black/20 p-2 opacity-70 transition group-hover:opacity-100" aria-label="Otevřít"><ArrowUpRight className="h-4 w-4" /></Link> : null}
                </motion.div>)}
              </AnimatePresence>
              {visibleItems.length === 0 && !loading ? <div className="rounded-2xl border border-border/50 bg-white/[.02] p-8 text-center"><BellRing className="mx-auto h-7 w-7 text-primary/70" /><p className="mt-3 text-sm text-muted-foreground">Zatím tu není žádná aktivita.</p></div> : null}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-3xl border border-emerald-300/15 bg-black/30 p-5">
              <div className="flex items-center justify-between"><div><p className="font-mono text-[9px] font-bold tracking-[.3em] text-emerald-300">LIVE SIGNAL</p><h2 className="mt-1 font-display text-2xl tracking-wide text-white">LIVE NOW</h2></div><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 font-mono text-[8px] font-bold text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> ONLINE</span></div>
              <div className="mt-4 space-y-2.5">{liveMatches.slice(0, 4).map((m) => <Link key={m.id} to="/match" search={{ id: m.id }} className="group block rounded-2xl border border-white/10 bg-white/[.03] p-3 hover:-translate-y-0.5 hover:border-emerald-300/30"><div className="flex items-center justify-between gap-2"><span className="font-mono text-[8px] font-bold tracking-[.15em] text-emerald-300">{sportLabel(m.sport)}</span><span className="font-mono text-[8px] text-white/40">LIVE</span></div><div className="mt-2 grid grid-cols-[1fr_auto] items-center gap-3"><div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{m.team_a}</div><div className="truncate text-sm font-semibold text-white/80">{m.team_b}</div></div><div className="font-mono text-xl font-black text-primary">{m.score_a ?? 0}:{m.score_b ?? 0}</div></div></Link>)}{liveMatches.length === 0 ? <p className="py-5 text-sm text-muted-foreground">Momentálně není aktivní žádný live zápas.</p> : null}</div>
            </div>

            <div className="rounded-3xl border border-violet-300/15 bg-black/30 p-5"><div className="flex items-center justify-between"><div><p className="font-mono text-[9px] font-bold tracking-[.3em] text-violet-300">NEXT UP</p><h2 className="mt-1 font-display text-2xl tracking-wide text-white">DALŠÍ ZÁPASY</h2></div><Users className="h-5 w-5 text-violet-300" /></div><div className="mt-4 space-y-2">{upcoming.slice(0, 4).map((m) => <Link key={m.id} to="/match" search={{ id: m.id }} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-3 hover:border-violet-300/30"><div className="min-w-0"><div className="truncate text-sm font-semibold text-white">{m.team_a} vs {m.team_b}</div><div className="font-mono text-[8px] tracking-[.15em] text-white/40">{sportLabel(m.sport)}</div></div><span className="shrink-0 font-mono text-[9px] text-violet-200">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }) : "—"}</span></Link>)}{upcoming.length === 0 ? <p className="py-5 text-sm text-muted-foreground">Žádný další zápas v plánu.</p> : null}</div></div>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-primary/[.03] px-4 py-3"><div className="flex items-center gap-2 text-muted-foreground"><BellRing className="h-4 w-4 text-primary" /><span className="font-mono text-[9px] font-bold tracking-[.2em]">AUTO REFRESH · {Math.max(0, Math.floor((Date.now() - updatedAt) / 1000))}s</span></div><Link to="/trophy-room" className="inline-flex items-center gap-2 font-mono text-[9px] font-bold tracking-[.2em] text-primary hover:underline"><Trophy className="h-4 w-4" /> TROPHY ROOM</Link></footer>
      </div>
    </main>
  );
}

export const Route = { component: ActivityPage };
