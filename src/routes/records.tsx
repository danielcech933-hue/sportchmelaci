import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, Flame, Medal, Star, Trophy, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAllMatches } from "@/lib/matches-db";
import { buildLeaderboard, type LeaderRow } from "@/lib/stats";
import type { Match } from "@/lib/matches";
import { UltraArenaShell, UltraLinkButton, UltraMetric, UltraSection } from "@/components/UltraArenaShell";

export const Route = createFileRoute("/records")({ component: RecordsPage });

function RecordsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  useEffect(() => { fetchAllMatches().then(setMatches).catch(() => setMatches([])); }, []);
  const rows: LeaderRow[] = useMemo(() => buildLeaderboard(matches, "solo", [], new Map()), [matches]);
  const topWins = [...rows].sort((a, b) => b.wins - a.wins)[0]; const topElo = [...rows].sort((a, b) => b.elo - a.elo)[0]; const topRate = [...rows].filter((r) => r.played >= 2).sort((a, b) => (b.wins / b.played) - (a.wins / a.played))[0];
  return <UltraArenaShell eyebrow="SPORTCHMELÁCI · RECORD ARCHIVE" title="RECORDS" subtitle="Historické rekordy, špičkové výkony a nejvýraznější formy. Základní hodnoty jsou odvozené z existujících dokončených zápasů." actions={<><UltraLinkButton href="/rankings">SCOREBOARD</UltraLinkButton><UltraLinkButton href="/sport-center" primary>SPORT CENTER</UltraLinkButton></>}>
    <div className="mt-6 grid gap-3 sm:grid-cols-3"><UltraMetric label="MOST WINS" value={topWins?.label ?? "—"} hint={topWins ? `${topWins.wins} wins` : "čeká na data"} icon={<Trophy className="h-4 w-4 text-amber-200" />} /><UltraMetric label="BEST ELO" value={topElo?.label ?? "—"} hint={topElo ? `${topElo.elo} ELO` : "čeká na data"} icon={<Crown className="h-4 w-4 text-amber-200" />} /><UltraMetric label="TOP WIN RATE" value={topRate?.label ?? "—"} hint={topRate ? `${Math.round((topRate.wins / topRate.played) * 100)}%` : "min. 2 matches"} icon={<Star className="h-4 w-4 text-cyan-200" />} /></div>
    <UltraSection title="HALL OF RECORDS" kicker="ALL TIME" icon={<Medal className="h-4 w-4 text-amber-200" />}><div className="grid gap-3 lg:grid-cols-3"><RecordCard icon={<Trophy className="h-5 w-5" />} title="WIN MACHINE" name={topWins?.label ?? "NO DATA"} value={topWins ? `${topWins.wins} W` : "—"} text="Nejvíce vítězných zápasů podle oficiálních výsledků." /><RecordCard icon={<Zap className="h-5 w-5" />} title="ELO TITAN" name={topElo?.label ?? "NO DATA"} value={topElo ? `${topElo.elo} ELO` : "—"} text="Nejvyšší aktuální ELO z profilu / leaderboard vrstvy." /><RecordCard icon={<Flame className="h-5 w-5" />} title="FORM KING" name={topRate?.label ?? "NO DATA"} value={topRate ? `${Math.round((topRate.wins / topRate.played) * 100)}%` : "—"} text="Nejvyšší win rate při minimálně dvou odehraných zápasech." /></div></UltraSection>
    <UltraSection title="RECORD PROTOCOL" kicker="NEXT LEVEL" icon={<Star className="h-4 w-4 text-cyan-200" />}><div className="grid gap-3 md:grid-cols-3"><Protocol title="WIN STREAK" text="Připraveno pro přesný rekord nejdelší vítězné série, až bude série uložena v match history." /><Protocol title="BIGGEST MATCH" text="Připraveno pro největší týmový / 2v2 zápas podle validovaných dat." /><Protocol title="SPORT RECORDS" text="Per-sport rekordy pro nohejbal, tenis, basketbal, fotbal a další disciplíny." /></div></UltraSection>
    <div className="mt-6 text-center"><Link to="/rankings" className="font-mono text-[9px] uppercase tracking-[.25em] text-amber-200 hover:text-white">Otevřít kompletní scoreboard →</Link></div>
  </UltraArenaShell>;
}
function RecordCard({ icon, title, name, value, text }: { icon: React.ReactNode; title: string; name: string; value: string; text: string }) { return <div className="relative overflow-hidden rounded-2xl border border-amber-300/15 bg-gradient-to-br from-amber-300/[.06] to-transparent p-5"><div className="grid h-10 w-10 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200">{icon}</div><div className="mt-5 font-mono text-[8px] uppercase tracking-[.25em] text-amber-200/50">{title}</div><div className="mt-1 font-display text-xl font-black tracking-wide text-white">{name}</div><div className="mt-2 font-display text-3xl font-black text-amber-100">{value}</div><p className="mt-2 text-sm leading-6 text-white/30">{text}</p></div>; }
function Protocol({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="font-display text-lg font-black tracking-wide">{title}</div><p className="mt-2 text-sm leading-6 text-white/30">{text}</p></div>; }
