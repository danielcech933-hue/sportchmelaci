import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, CircleDollarSign, LockKeyhole, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAllMatches } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { SPORTS, type Bet, type Match } from "@/lib/matches";
import { UltraArenaShell, UltraLinkButton, UltraMetric, UltraSection } from "@/components/UltraArenaShell";

export const Route = createFileRoute("/my-bets")({ component: MyBetsPage });

function MyBetsPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  useEffect(() => { let alive = true; fetchAllMatches().then((rows) => { if (alive) setMatches(rows); }).catch(() => undefined); return () => { alive = false; }; }, []);
  const bets = useMemo(() => { if (!user) return []; const rows: Array<Bet & { match: Match }> = []; for (const match of matches) for (const bet of match.bets ?? []) if (bet.userId === user.id) rows.push({ ...bet, match }); return rows.sort((a, b) => b.createdAt - a.createdAt); }, [matches, user]);
  const stake = bets.reduce((s, b) => s + (b.amount ?? 0), 0); const payout = bets.reduce((s, b) => s + (b.payout ?? 0), 0); const wins = bets.filter((b) => b.status === "won").length;
  return <UltraArenaShell eyebrow="SPORTCHMELÁCI · PERSONAL BETTING" title="MY BETS" subtitle="Osobní přehled tiketů přihlášeného hráče. Pokud backend tiket nemá přiřazené userId, zůstává záznam záměrně mimo tento osobní pohled." actions={<UltraLinkButton href="/bets" primary>LIVE BET BOARD</UltraLinkButton>}>
    {!user ? <div className="mt-6 grid min-h-56 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[.015] text-center"><div><LockKeyhole className="mx-auto h-7 w-7 text-amber-200/60" /><div className="mt-2 font-mono text-[10px] font-black uppercase tracking-[.3em] text-white/35">SIGN IN REQUIRED</div><div className="mt-1 text-sm text-white/25">Přihlas se pro zobrazení osobního betting feedu.</div></div></div> : <><div className="mt-6 grid gap-3 sm:grid-cols-3"><UltraMetric label="TICKETS" value={String(bets.length)} hint="osobních tiketů" icon={<TrendingUp className="h-4 w-4 text-cyan-200" />} /><UltraMetric label="STAKE" value={`$${stake.toLocaleString("en-US")}`} hint="celkový objem sázek" icon={<CircleDollarSign className="h-4 w-4 text-amber-200" />} /><UltraMetric label="WINS" value={String(wins)} hint={`payout $${payout.toLocaleString("en-US")}`} icon={<TrendingUp className="h-4 w-4 text-emerald-300" />} /></div><UltraSection title="BET HISTORY" kicker="PERSONAL FEED"><div className="space-y-2">{bets.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/25">Zatím nemáš žádné dohledatelné tikety.</div> : bets.map((bet) => <BetRow key={bet.id} bet={bet} />)}</div></UltraSection></>}
  </UltraArenaShell>;
}

function BetRow({ bet }: { bet: Bet & { match: Match } }) { const sport = SPORTS[bet.match.sport]; const status = bet.status ?? "open"; return <Link to="/match" search={{ id: bet.match.id }} className="group flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-4 transition hover:border-amber-300/25"><div className="min-w-0"><div className="flex items-center gap-2"><span>{sport.emoji}</span><span className="font-mono text-[8px] uppercase tracking-[.2em] text-white/35">{sport.name}</span><span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[8px] uppercase text-white/30">{status}</span></div><div className="mt-2 truncate font-display text-lg font-black">{bet.match.teamA} <span className="text-amber-200/40">vs</span> {bet.match.teamB}</div></div><div className="text-right"><div className="font-mono text-[8px] uppercase tracking-[.18em] text-white/25">STAKE</div><div className="mt-1 font-mono text-sm font-black text-amber-100">${(bet.amount ?? 0).toLocaleString("en-US")}</div><div className="mt-1 text-[10px] text-white/30">{bet.payout ? `Payout $${bet.payout.toLocaleString("en-US")}` : bet.lockedOdds ? `Odds ${bet.lockedOdds.toFixed(2)}` : "—"} <ArrowUpRight className="ml-1 inline h-3 w-3" /></div></div></Link>; }
