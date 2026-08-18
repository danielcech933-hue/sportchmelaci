import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, Flame, Gamepad2, Medal, Radio, Search, Shield, Sparkles, Trophy, Users, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAllMatches } from "@/lib/matches-db";
import { SPORTS, SPORT_LIST, type Match } from "@/lib/matches";
import { splitPlayers, winnerSideOf } from "@/lib/stats";
import { UltraArenaShell, UltraLinkButton, UltraMetric, UltraSection } from "@/components/UltraArenaShell";

export const Route = createFileRoute("/community")({
  head: () => ({ meta: [{ title: "Community — SportChmeláci" }, { name: "description", content: "Player network, form radar, active arenas and team-ready community hub." }] }),
  component: CommunityPage,
});

type Player = { key: string; name: string; played: number; wins: number; losses: number; winRate: number; streak: number; sports: Set<string>; teamMatches: number };

function CommunityPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try { const rows = await fetchAllMatches(); if (alive) setMatches(rows); } catch { if (alive) setMatches([]); }
    };
    void load();
    const id = window.setInterval(() => void load(), 5000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  const players = useMemo(() => buildPlayers(matches.filter((m) => !!m.endedAt)), [matches]);
  const activePlayers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return players
      .filter((p) => !needle || p.name.toLowerCase().includes(needle))
      .filter((p) => sport === "all" || p.sports.has(sport))
      .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.played - a.played)
      .slice(0, 12);
  }, [players, query, sport]);

  const live = matches.filter((m) => !m.endedAt).slice(0, 6);
  const teamReady = matches.filter((m) => m.matchFormat === "2v2").length;
  const totalSports = new Set(matches.map((m) => m.sport)).size;
  const mostActive = [...players].sort((a, b) => b.played - a.played)[0];
  const hotStreak = [...players].sort((a, b) => b.streak - a.streak)[0];

  return <UltraArenaShell eyebrow="SPORTCHMELÁCI · PLAYER NETWORK" title="COMMUNITY HUB" subtitle="Živá síť hráčů, týmů, forem a sportovních arén. Najdi soupeře, sleduj formu a skoč rovnou do zápasu." actions={<><UltraLinkButton href="/teams">TEAM HQ</UltraLinkButton><UltraLinkButton href="/activity" primary>LIVE PULSE</UltraLinkButton></>}>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <UltraMetric label="PLAYERS" value={String(players.length)} hint="unikátních hráčů v historii" icon={<Users className="h-4 w-4 text-cyan-200" />} />
      <UltraMetric label="ACTIVE ARENAS" value={String(totalSports)} hint="sporty v match feedu" icon={<Gamepad2 className="h-4 w-4 text-amber-200" />} />
      <UltraMetric label="2V2 SIGNAL" value={String(teamReady)} hint="týmových zápasů v systému" icon={<Shield className="h-4 w-4 text-violet-200" />} />
      <UltraMetric label="LIVE SIGNAL" value={String(live.length)} hint="otevřených zápasů právě teď" icon={<Radio className="h-4 w-4 text-emerald-300" />} />
    </div>

    <section className="mt-5 relative overflow-hidden rounded-[30px] border border-cyan-300/15 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,.11),transparent_28%),radial-gradient(circle_at_85%_90%,rgba(250,204,21,.09),transparent_26%),rgba(0,0,0,.25)]">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
        <div className="p-6 sm:p-9">
          <div className="aaa-meta text-cyan-200/70">PLAYER NETWORK // ONLINE</div>
          <h2 className="mt-3 font-display text-5xl font-black tracking-[.08em] text-white sm:text-7xl">FIND YOUR <span className="gold-text">ARENA</span></h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-white/38">Prohledej hráče podle jména, sportu a výkonové formy. Každý profil je připravený na přímý vstup do H2H, zápasu a týmových soubojů.</p>
          <div className="mt-6 flex flex-wrap gap-2"><Link to="/rankings" className="aaa-cta inline-flex items-center gap-2 px-4 py-3 text-[9px] font-black uppercase tracking-[.18em]"><Trophy className="h-4 w-4" /> SCOREBOARD</Link><Link to="/schedule" className="aaa-ghost inline-flex items-center gap-2 px-4 py-3 text-[9px] font-black uppercase tracking-[.18em]"><Gamepad2 className="h-4 w-4" /> MATCHMAKER</Link></div>
        </div>
        <div className="border-t border-white/8 p-6 sm:p-8 lg:border-l lg:border-t-0">
          <div className="aaa-meta">COMMUNITY SIGNALS</div>
          <div className="mt-4 grid grid-cols-2 gap-2"><Signal label="MOST ACTIVE" value={mostActive?.name ?? "—"} icon={<Sparkles className="h-4 w-4" />} /><Signal label="HOT STREAK" value={hotStreak ? `${hotStreak.name} · ${hotStreak.streak}W` : "—"} icon={<Flame className="h-4 w-4" />} /><Signal label="2V2 READY" value={`${teamReady} MATCHES`} icon={<Users className="h-4 w-4" />} /><Signal label="ARENAS" value={`${totalSports} SPORTS`} icon={<Gamepad2 className="h-4 w-4" />} /></div>
        </div>
      </div>
    </section>

    <section className="mt-5 rounded-[26px] border border-white/8 bg-black/20 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div><div className="aaa-meta text-amber-200/70">PLAYER EXPLORER</div><h3 className="mt-1 font-display text-3xl tracking-[.12em] text-white">COMMUNITY ROSTER</h3></div>
        <div className="flex flex-wrap gap-2"><div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3"><Search className="h-4 w-4 text-white/25" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Hledat hráče…" className="w-44 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-white/20" /></div><select value={sport} onChange={(e) => setSport(e.target.value)} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs uppercase tracking-[.12em] text-white/60 outline-none"><option value="all">Všechny sporty</option>{SPORT_LIST.map((s) => <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>)}</select></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{activePlayers.map((p, i) => <PlayerCard key={p.key} player={p} rank={i + 1} />)}{activePlayers.length === 0 && <Empty text="Žádný hráč neodpovídá filtru." />}</div>
    </section>

    <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <UltraSection title="LIVE COMMUNITY" kicker="NOW" icon={<Radio className="h-4 w-4 text-emerald-300" />} action={<UltraLinkButton href="/activity">LIVE PULSE</UltraLinkButton>}>
        {live.length === 0 ? <Empty text="Žádný live zápas." /> : <div className="space-y-2">{live.map((m) => <Link key={m.id} to="/match" search={{ id: m.id }} className="group flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[.02] p-3 hover:border-emerald-300/25"><div className="min-w-0"><div className="flex items-center gap-2"><span className="text-xl">{SPORTS[m.sport].emoji}</span><span className="aaa-meta">{SPORTS[m.sport].name}</span></div><div className="mt-1 truncate font-display text-lg text-white">{m.teamA} <span className="text-white/20">VS</span> {m.teamB}</div></div><div className="font-mono text-[8px] font-black uppercase tracking-[.16em] text-emerald-200">OPEN →</div></Link>)}</div>}
      </UltraSection>

      <UltraSection title="TEAM RADAR" kicker="2V2" icon={<Shield className="h-4 w-4 text-violet-200" />} action={<UltraLinkButton href="/teams">TEAM HQ</UltraLinkButton>}>
        <div className="grid gap-3"><Radar title="BUILD A SQUAD" text="Slož si tým a otevři 2v2 zápasy. Týmové výsledky se propisují do competitive vrstvy." href="/teams" icon={<Users className="h-5 w-5" />} /><Radar title="CHMEL LEAGUE" text="Sezónní tabulka, matchday a cesta do play-off v jednom hubu." href="/leagues" icon={<Crown className="h-5 w-5" />} /><Radar title="TROPHY ROOM" text="Odemkni prestižní odznaky a vystav svou kariérní identitu." href="/trophy-room" icon={<Medal className="h-5 w-5" />} /></div>
      </UltraSection>
    </div>

    <div className="mt-6 flex flex-wrap justify-center gap-2"><UltraLinkButton href="/sport-center">SPORT CENTER</UltraLinkButton><UltraLinkButton href="/rankings" primary>SCOREBOARD</UltraLinkButton><UltraLinkButton href="/records">RECORDS</UltraLinkButton><UltraLinkButton href="/trophy-room">TROPHY ROOM</UltraLinkButton></div>
  </UltraArenaShell>;
}

function buildPlayers(matches: Match[]): Player[] {
  const map = new Map<string, Player>();
  const seen = new Set<string>();
  for (const m of matches) {
    const winner = winnerSideOf(m); if (!winner || seen.has(m.id)) continue; seen.add(m.id);
    for (const side of ["a", "b"] as const) {
      for (const name of splitPlayers(side === "a" ? m.teamA : m.teamB)) {
        const key = name.trim().toLowerCase(); if (!key) continue;
        const row = map.get(key) ?? { key, name: name.trim(), played: 0, wins: 0, losses: 0, winRate: 0, streak: 0, sports: new Set<string>(), teamMatches: 0 };
        row.played++; row.sports.add(m.sport); if (m.matchFormat === "2v2") row.teamMatches++;
        if (side === winner) { row.wins++; row.streak++; } else { row.losses++; row.streak = 0; }
        row.winRate = row.played ? row.wins / row.played : 0; map.set(key, row);
      }
    }
  }
  return [...map.values()];
}

function PlayerCard({ player, rank }: { player: Player; rank: number }) {
  return <div className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[.02] p-4 transition hover:-translate-y-1 hover:border-amber-300/25"><div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-300/5 blur-3xl transition group-hover:bg-amber-300/10" /><div className="relative flex items-start justify-between"><div className="grid h-11 w-11 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/5 font-display text-lg text-amber-100">{rank <= 3 ? ["♛","✦","◆"][rank - 1] : `#${rank}`}</div><div className="font-mono text-[8px] uppercase tracking-[.18em] text-white/25">{player.teamMatches} × 2V2</div></div><div className="relative mt-4 font-display text-xl font-black tracking-wide text-white">{player.name}</div><div className="mt-2 flex flex-wrap gap-1.5">{[...player.sports].slice(0,4).map((id) => <span key={id} className="rounded-full border border-white/8 px-2 py-1 text-[8px] uppercase tracking-[.14em] text-white/35">{SPORTS[id].emoji} {SPORTS[id].name}</span>)}</div><div className="mt-4 grid grid-cols-3 gap-2"><Stat label="W" value={player.wins} /><Stat label="WR" value={`${Math.round(player.winRate * 100)}%`} /><Stat label="STREAK" value={`${player.streak}W`} /></div><div className="mt-4 flex gap-2"><Link to="/rankings" className="flex-1 rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-center font-mono text-[8px] uppercase tracking-[.18em] text-white/35 hover:text-white">SCOREBOARD</Link><Link to="/schedule" className="flex-1 rounded-xl border border-cyan-300/15 bg-cyan-300/[.04] px-3 py-2 text-center font-mono text-[8px] uppercase tracking-[.18em] text-cyan-200">MATCH UP</Link></div></div>;
}
function Signal({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="rounded-2xl border border-white/8 bg-black/20 p-3"><div className="flex items-center gap-2 text-white/25">{icon}<span className="font-mono text-[8px] uppercase tracking-[.18em]">{label}</span></div><div className="mt-2 truncate font-display text-sm font-black text-white">{value}</div></div>; }
function Stat({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl border border-white/8 bg-black/20 p-2 text-center"><div className="font-mono text-[8px] text-white/20">{label}</div><div className="mt-1 font-display text-lg text-amber-100">{value}</div></div>; }
function Radar({ title, text, href, icon }: { title: string; text: string; href: string; icon: React.ReactNode }) { return <Link to={href} className="group rounded-2xl border border-white/8 bg-white/[.02] p-4 transition hover:-translate-y-0.5 hover:border-violet-300/20"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-violet-300/15 bg-violet-300/[.04] text-violet-200">{icon}</div><div className="font-display text-lg font-black tracking-wide text-white">{title}</div></div><p className="mt-3 text-sm leading-6 text-white/30">{text}</p><div className="mt-3 font-mono text-[8px] uppercase tracking-[.2em] text-violet-200">OPEN →</div></Link>; }
function Empty({ text }: { text: string }) { return <div className="col-span-full grid min-h-32 place-items-center rounded-2xl border border-dashed border-white/10 p-6 text-center font-mono text-[9px] uppercase tracking-[.18em] text-white/25">{text}</div>; }
