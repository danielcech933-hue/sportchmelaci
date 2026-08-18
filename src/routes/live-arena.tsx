import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, BarChart3, CalendarClock, ChevronRight, Gauge, Radio, ShieldCheck, Swords, Users, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { SPORTS, type Match } from "@/lib/matches";
import { fetchAllMatches } from "@/lib/matches-db";
import { useMatchesRealtime, LiveBadge } from "@/lib/live";
import { UltraArenaShell, UltraLinkButton, UltraMetric, UltraSection, PowerMark } from "@/components/UltraArenaShell";

export const Route = createFileRoute("/live-arena")({ component: LiveArenaPage });

function LiveArenaPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState(Date.now());

  const load = async () => {
    try {
      const rows = await fetchAllMatches();
      const live = rows.filter((m) => !m.endedAt).slice(0, 20);
      setMatches(live);
      setSelectedId((current) => current && live.some((m) => m.id === current) ? current : (live[0]?.id ?? null));
      setSyncedAt(Date.now());
    } catch {
      setMatches([]);
    }
  };

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 2500); return () => window.clearInterval(timer); }, []);
  useMatchesRealtime(() => { void load(); }, { enabled: true });

  const selected = useMemo(() => matches.find((m) => m.id === selectedId) ?? matches[0] ?? null, [matches, selectedId]);
  const cfg = selected ? SPORTS[selected.sport] : null;
  const setsA = selected ? selected.sets.filter((s) => s.a > s.b).length : 0;
  const setsB = selected ? selected.sets.filter((s) => s.b > s.a).length : 0;
  const total = selected ? selected.scoreA + selected.scoreB : 0;
  const pressure = selected ? Math.min(100, 28 + selected.scoreA * 8 + selected.scoreB * 7 + (setsA + setsB) * 10) : 0;

  return <UltraArenaShell eyebrow="SPORTCHMELÁCI · REALTIME" title="LIVE ARENA" accent="cyan" subtitle="Cinematic televizní feed otevřených zápasů. Vyber duel vlevo a sleduj score, sety, sestavy, momentum a server sync v jednom prostoru." actions={<><UltraLinkButton href="/activity">LIVE PULSE</UltraLinkButton><UltraLinkButton href="/bets" primary>SLEDOVAT SÁZKY</UltraLinkButton></>}>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><UltraMetric label="LIVE NOW" value={String(matches.length)} hint="otevřených match feedů" icon={<Radio className="h-4 w-4 text-emerald-300" />} /><UltraMetric label="FORMAT" value="1V1 / 2V2" hint="individuální i týmové zápasy" icon={<Users className="h-4 w-4 text-cyan-200" />} /><UltraMetric label="REFRESH" value="2.5 SEC" hint="rychlý realtime přehled" icon={<Activity className="h-4 w-4 text-cyan-200" />} /><UltraMetric label="SYNC" value={`${Math.max(0, Math.round((Date.now() - syncedAt) / 1000))}s`} hint="od posledního server refresh" icon={<ShieldCheck className="h-4 w-4 text-amber-200" />} /></div>

    <div className="mt-5 grid gap-4 xl:grid-cols-[.72fr_1.28fr]">
      <aside className="rounded-[26px] border border-white/8 bg-black/25 p-4 sm:p-5">
        <div className="flex items-center justify-between"><div><div className="aaa-meta text-cyan-200/70">LIVE CHANNELS</div><h2 className="mt-1 font-display text-2xl tracking-[.12em]">ARENA FEED</h2></div><PowerMark /></div>
        <div className="mt-4 space-y-2">{matches.map((match) => <button key={match.id} onClick={() => setSelectedId(match.id)} className={`w-full rounded-2xl border p-3 text-left transition ${selected?.id === match.id ? "border-amber-300/35 bg-amber-300/[.06]" : "border-white/8 bg-white/[.02] hover:border-cyan-300/20"}`}><div className="flex items-center justify-between gap-2"><span className="aaa-meta">{SPORTS[match.sport].emoji} {SPORTS[match.sport].name}</span><LiveBadge /></div><div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><span className="truncate font-display text-sm text-white">{match.teamA}</span><span className="font-mono text-xs font-black text-amber-100">{match.scoreA}:{match.scoreB}</span><span className="truncate text-right font-display text-sm text-white">{match.teamB}</span></div><div className="mt-2 flex justify-between font-mono text-[8px] uppercase tracking-[.16em] text-white/20"><span>{match.matchFormat === "2v2" ? "2V2 TEAM" : "1V1"}</span><span>LIVE SIGNAL</span></div></button>)}{matches.length === 0 && <Empty />}</div>
      </aside>

      <section className="relative overflow-hidden rounded-[30px] border border-amber-300/20 bg-[linear-gradient(135deg,rgba(15,18,22,.98),rgba(3,6,9,.99))] shadow-[0_35px_120px_-60px_rgba(250,204,21,.55)]"><div className="absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] [background-size:40px_40px]" /><div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(250,204,21,.16),transparent_28%),radial-gradient(circle_at_85%_75%,rgba(34,211,238,.08),transparent_25%)]" /><div className="relative p-5 sm:p-8 lg:p-10">{selected && cfg ? <>
        <div className="flex flex-wrap items-center gap-2"><span className="aaa-meta text-amber-200/75">{cfg.emoji} {cfg.name}</span><LiveBadge />{selected.matchFormat === "2v2" && <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-2.5 py-1 font-mono text-[8px] font-black uppercase tracking-[.2em] text-cyan-200">2V2 · TEAM BATTLE</span>}</div>
        <div className="mt-7 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-8"><Team title={selected.teamA} players={selected.teamAPlayers ?? split(selected.teamA)} tone="gold" align="right" /><div className="text-center"><div className="aaa-meta">LIVE SCORE</div><div className="mt-2 font-display text-6xl font-black tracking-[.06em] text-white sm:text-8xl">{selected.scoreA}<span className="mx-2 text-white/12">:</span>{selected.scoreB}</div>{cfg.hasSets && <div className="mt-2 font-mono text-[9px] uppercase tracking-[.25em] text-amber-200/55">SETS {setsA}:{setsB}</div>}</div><Team title={selected.teamB} players={selected.teamBPlayers ?? split(selected.teamB)} tone="cyan" /></div>
        <div className="mt-7 grid gap-3 lg:grid-cols-[1fr_.8fr]"><div className="rounded-2xl border border-white/8 bg-black/25 p-4"><div className="flex items-center justify-between"><div><div className="aaa-meta">MOMENTUM CORE</div><div className="mt-1 font-display text-xl text-white">LIVE PRESSURE</div></div><Gauge className="h-5 w-5 text-amber-200" /></div><div className="mt-5 h-4 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-amber-200 via-amber-400 to-cyan-300 shadow-[0_0_24px_rgba(250,204,21,.35)] transition-all" style={{ width: `${pressure}%` }} /></div><div className="mt-2 flex justify-between font-mono text-[8px] uppercase tracking-[.18em] text-white/20"><span>STABLE</span><span>PRESSURE {pressure}%</span><span>PEAK</span></div></div><div className="grid grid-cols-2 gap-2"><Stat label="TOTAL SCORE" value={String(total)} icon={<Swords className="h-4 w-4" />} /><Stat label="PLAYERS" value={String((selected.teamAPlayers ?? split(selected.teamA)).length + (selected.teamBPlayers ?? split(selected.teamB)).length)} icon={<Users className="h-4 w-4" />} /><Stat label="FORMAT" value={selected.matchFormat === "2v2" ? "2V2" : "1V1"} icon={<Zap className="h-4 w-4" />} /><Stat label="SPORT" value={cfg.name.toUpperCase()} icon={<Radio className="h-4 w-4" />} /></div></div>
        <div className="mt-5 flex flex-wrap gap-2"><Link to="/match" search={{ id: selected.id }} className="aaa-cta inline-flex items-center gap-2 px-4 py-2.5 text-[9px] font-black uppercase tracking-[.16em]">Open Match Center <ChevronRight className="h-3.5 w-3.5" /></Link><Link to="/betting" className="aaa-ghost inline-flex items-center gap-2 px-4 py-2.5 text-[9px] font-black uppercase tracking-[.16em]">Betting Desk <ChevronRight className="h-3.5 w-3.5" /></Link></div>
      </> : <div className="grid min-h-[420px] place-items-center text-center"><Radio className="mx-auto h-9 w-9 text-cyan-200/40" /><h2 className="mt-4 font-display text-3xl text-amber-100">ARENA STANDBY</h2><p className="mt-2 max-w-md text-sm text-white/30">Jakmile začne další zápas, live feed se objeví automaticky.</p></div>}</div></section>
    </div>

    <UltraSection title="ARENA INTELLIGENCE" kicker="LIVE TELEMETRY" icon={<BarChart3 className="h-4 w-4 text-amber-200" />}><div className="grid gap-3 md:grid-cols-3"><Info title="SERVER AUTHORITATIVE" text="Live Arena pouze zobrazuje validovaný match state; skóre se nemění lokálně." /><Info title="CINEMATIC MOMENTUM" text="Pressure meter vychází pouze z aktuálního skóre a dokončených setů." /><Info title="2V2 READY" text="Týmové sestavy, formát a live score jsou zobrazené společně pro rychlou orientaci." /></div></UltraSection>
    <div className="mt-4 flex flex-wrap justify-center gap-2"><UltraLinkButton href="/sport-center">SPORT CENTER</UltraLinkButton><UltraLinkButton href="/rankings">SCOREBOARD</UltraLinkButton><UltraLinkButton href="/records">RECORDS</UltraLinkButton><UltraLinkButton href="/schedule">MATCHDAY</UltraLinkButton></div>
  </UltraArenaShell>;
}

function Team({ title, players, tone, align }: { title: string; players: string[]; tone: "gold" | "cyan"; align?: "left" | "right" }) { return <div className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}><div className={`aaa-meta ${tone === "gold" ? "text-amber-200/60" : "text-cyan-200/60"}`}>{tone === "gold" ? "TEAM A" : "TEAM B"}</div><div className="mt-2 truncate font-display text-xl tracking-[.08em] text-white sm:text-3xl">{title}</div><div className="mt-2 flex flex-wrap gap-1.5" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>{players.map((p, i) => <span key={`${p}-${i}`} className="rounded-lg border border-white/8 bg-white/[.03] px-2 py-1 text-[9px] text-white/35">{p}</span>)}</div></div>; }
function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="rounded-2xl border border-white/8 bg-white/[.025] p-3"><div className="flex items-center gap-2 text-white/25"><span className="text-cyan-200/65">{icon}</span><span className="aaa-meta">{label}</span></div><div className="mt-2 truncate font-display text-lg text-white">{value}</div></div>; }
function Info({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-white/8 bg-white/[.02] p-5"><div className="font-display text-lg text-white">{title}</div><p className="mt-2 text-sm leading-6 text-white/30">{text}</p></div>; }
function Empty() { return <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[.015] text-center"><div><Zap className="mx-auto h-7 w-7 text-cyan-200/60" /><div className="mt-2 font-mono text-[10px] font-black uppercase tracking-[.3em] text-white/35">NO ACTIVE SIGNAL</div><div className="mt-1 max-w-sm text-sm text-white/25">Jakmile začne další zápas, jeho live feed se objeví tady.</div></div></div>; }
function split(name: string) { return name.split(/\s*(?:&|\/|,|\+| vs\.? | and )\s*/i).map((s) => s.trim()).filter(Boolean); }
