import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, CircleDollarSign, Filter, LockKeyhole, RefreshCw, ShieldCheck, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fetchAllMatches } from "@/lib/matches-db";
import { useAuth } from "@/lib/auth";
import { SPORTS, type Bet, type Match } from "@/lib/matches";
import { UltraArenaShell, UltraLinkButton, UltraMetric, UltraSection } from "@/components/UltraArenaShell";

export const Route = createFileRoute("/my-bets")({
  head: () => ({
    meta: [
      { title: "My Bets — SportChmeláci" },
      { name: "description", content: "Osobní betting ticket center, payouty, výsledky a otevřené sázky." },
    ],
  }),
  component: MyBetsPage,
});

type BetRowData = Bet & { match: Match };
type FilterMode = "all" | "open" | "won" | "lost";

function MyBetsPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await fetchAllMatches();
      setMatches(rows);
      setLastSync(Date.now());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    void load().catch(() => undefined);
    const id = window.setInterval(async () => {
      if (!alive) return;
      try {
        const rows = await fetchAllMatches();
        if (alive) {
          setMatches(rows);
          setLastSync(Date.now());
        }
      } catch {
        // keep last known data
      }
    }, 5000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  const bets = useMemo<BetRowData[]>(() => {
    if (!user) return [];
    const rows: BetRowData[] = [];
    for (const match of matches) {
      for (const bet of match.bets ?? []) {
        if (bet.userId === user.id) rows.push({ ...bet, match });
      }
    }
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  }, [matches, user]);

  const filtered = useMemo(() => {
    if (filter === "all") return bets;
    return bets.filter((bet) => (bet.status ?? "open") === filter);
  }, [bets, filter]);

  const openBets = bets.filter((b) => (b.status ?? "open") === "open");
  const wonBets = bets.filter((b) => b.status === "won");
  const lostBets = bets.filter((b) => b.status === "lost");
  const stake = bets.reduce((sum, bet) => sum + Number(bet.amount ?? 0), 0);
  const payout = bets.reduce((sum, bet) => sum + Number(bet.payout ?? 0), 0);
  const net = payout - stake;
  const settled = wonBets.length + lostBets.length;
  const winRate = settled ? Math.round((wonBets.length / settled) * 100) : 0;
  const largest = bets.reduce((max, bet) => Math.max(max, Number(bet.amount ?? 0)), 0);
  const avgStake = bets.length ? Math.round(stake / bets.length) : 0;

  return (
    <UltraArenaShell
      eyebrow="SPORTCHMELÁCI · PERSONAL BETTING"
      title="TICKET CENTER"
      subtitle="Tvůj osobní betting command center. Sleduj otevřené tikety, vypořádání, payouty a historii bez míchání cizích sázek."
      actions={<><UltraLinkButton href="/betting">BETTING HUB</UltraLinkButton><UltraLinkButton href="/bets" primary>LIVE BOARD</UltraLinkButton></>}
    >
      {!user ? (
        <div className="mt-6 grid min-h-64 place-items-center rounded-[28px] border border-dashed border-white/10 bg-white/[.015] text-center">
          <div className="max-w-md px-6">
            <LockKeyhole className="mx-auto h-8 w-8 text-amber-200/60" />
            <div className="mt-3 font-mono text-[10px] font-black uppercase tracking-[.3em] text-white/35">SIGN IN REQUIRED</div>
            <p className="mt-2 text-sm leading-6 text-white/25">Přihlas se pro zobrazení osobních tiketů, payoutů a betting statistik.</p>
            <div className="mt-4"><UltraLinkButton href="/auth" primary>PŘIHLÁSIT</UltraLinkButton></div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <UltraMetric label="TICKETS" value={String(bets.length)} hint={`${openBets.length} open · ${settled} settled`} icon={<TrendingUp className="h-4 w-4 text-cyan-200" />} />
            <UltraMetric label="TOTAL STAKE" value={`$${stake.toLocaleString("en-US")}`} hint={`avg $${avgStake.toLocaleString("en-US")}`} icon={<CircleDollarSign className="h-4 w-4 text-amber-200" />} />
            <UltraMetric label="NET RESULT" value={`${net >= 0 ? "+" : "-"}$${Math.abs(net).toLocaleString("en-US")}`} hint={`payout $${payout.toLocaleString("en-US")}`} icon={<ShieldCheck className={`h-4 w-4 ${net >= 0 ? "text-emerald-300" : "text-rose-300"}`} />} />
            <UltraMetric label="WIN RATE" value={`${winRate}%`} hint={`${wonBets.length}W · ${lostBets.length}L`} icon={<TrendingUp className="h-4 w-4 text-violet-200" />} />
          </div>

          <section className="mt-5 overflow-hidden rounded-[28px] border border-amber-300/15 bg-[radial-gradient(circle_at_15%_0%,rgba(250,204,21,.11),transparent_27%),radial-gradient(circle_at_85%_100%,rgba(34,211,238,.08),transparent_30%),rgba(0,0,0,.23)]">
            <div className="grid gap-0 lg:grid-cols-[1.15fr_.85fr]">
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-2 font-mono text-[8px] font-black uppercase tracking-[.26em] text-amber-200/70"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" /> TICKET STATUS // LIVE</div>
                <h2 className="mt-3 font-display text-4xl font-black tracking-[.06em] text-white sm:text-6xl">MY <span className="gold-text">BETS</span></h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/40">Osobní ticket book s jasným stavem OPEN / WON / LOST, payoutem a přímou cestou do Match Center.</p>
                <div className="mt-5 flex flex-wrap gap-2"><UltraLinkButton href="/betting" primary>OPEN MARKET</UltraLinkButton><UltraLinkButton href="/bets">LIVE BOARD</UltraLinkButton></div>
              </div>
              <div className="grid grid-cols-2 border-t border-white/8 lg:border-l lg:border-t-0">
                <Signal label="OPEN" value={String(openBets.length)} />
                <Signal label="LARGEST STAKE" value={`$${largest.toLocaleString("en-US")}`} />
                <Signal label="WIN RATE" value={`${winRate}%`} />
                <Signal label="SYNCHRONIZOVAT" value={lastSync ? "LIVE" : "—"} />
              </div>
            </div>
          </section>

          <UltraSection title="TICKET BOOK" kicker="PERSONAL FEED" icon={<Filter className="h-4 w-4 text-cyan-200" />} action={<button onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.02] px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.18em] text-white/45 hover:text-white"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> SYNC</button>}>
            <div className="mb-4 flex flex-wrap gap-2">
              {(["all", "open", "won", "lost"] as FilterMode[]).map((mode) => (
                <button key={mode} onClick={() => setFilter(mode)} className={`rounded-full border px-3 py-2 font-mono text-[8px] font-black uppercase tracking-[.18em] transition ${filter === mode ? "border-amber-300/45 bg-amber-300/10 text-amber-100" : "border-white/8 bg-white/[.02] text-white/30 hover:text-white"}`}>
                  {mode === "all" ? `ALL · ${bets.length}` : mode === "open" ? `OPEN · ${openBets.length}` : mode === "won" ? `WON · ${wonBets.length}` : `LOST · ${lostBets.length}`}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filtered.length === 0 ? <div className="grid min-h-36 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[.015] p-6 text-center text-sm text-white/25">{filter === "all" ? "Zatím nemáš žádné dohledatelné tikety." : "V tomto filtru nejsou žádné tikety."}</div> : filtered.map((bet) => <BetRow key={`${bet.id}-${bet.match.id}`} bet={bet} />)}
            </div>
          </UltraSection>

          <div className="grid gap-4 lg:grid-cols-3">
            <StatPanel title="PAYOUT PROFILE" value={`$${payout.toLocaleString("en-US")}`} text="Celková evidovaná výplata ze zobrazených tiketů." />
            <StatPanel title="AVERAGE STAKE" value={`$${avgStake.toLocaleString("en-US")}`} text="Průměrná velikost jednotlivé sázky v ticket booku." />
            <StatPanel title="SETTLEMENT" value="SERVER" text="Výsledek a payout zůstávají autoritativní na straně serveru." />
          </div>
        </>
      )}
    </UltraArenaShell>
  );
}

function BetRow({ bet }: { bet: BetRowData }) {
  const sport = SPORTS[bet.match.sport];
  const status = bet.status ?? "open";
  const statusClass = status === "won" ? "text-emerald-300 border-emerald-300/20 bg-emerald-300/5" : status === "lost" ? "text-rose-300 border-rose-300/20 bg-rose-300/5" : "text-amber-200 border-amber-300/20 bg-amber-300/5";
  return <Link to="/match" search={{ id: bet.match.id }} className="group flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[.025] p-4 transition hover:-translate-y-0.5 hover:border-amber-300/25">
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-lg">{sport.emoji}</span><span className="font-mono text-[8px] uppercase tracking-[.2em] text-white/35">{sport.name}</span><span className={`rounded-full border px-2 py-0.5 font-mono text-[8px] uppercase ${statusClass}`}>{status}</span>{bet.lockedOdds ? <span className="rounded-full border border-cyan-300/15 bg-cyan-300/5 px-2 py-0.5 font-mono text-[8px] text-cyan-200">ODDS {bet.lockedOdds.toFixed(2)}</span> : null}</div><div className="mt-2 truncate font-display text-lg font-black text-white">{bet.match.teamA} <span className="text-amber-200/40">vs</span> {bet.match.teamB}</div><div className="mt-1 font-mono text-[8px] uppercase tracking-[.16em] text-white/20">{new Date(bet.createdAt).toLocaleString("cs-CZ")} · pick {bet.pick.toUpperCase()}</div></div>
    <div className="shrink-0 text-right"><div className="font-mono text-[8px] uppercase tracking-[.18em] text-white/25">STAKE</div><div className="mt-1 font-mono text-sm font-black text-amber-100">${Number(bet.amount ?? 0).toLocaleString("en-US")}</div><div className="mt-1 text-[10px] text-white/30">{bet.payout ? `Payout $${Number(bet.payout).toLocaleString("en-US")}` : "Pending settlement"} <ArrowUpRight className="ml-1 inline h-3 w-3" /></div></div>
  </Link>;
}

function Signal({ label, value }: { label: string; value: string }) { return <div className="border-white/8 p-5"><div className="font-mono text-[8px] uppercase tracking-[.22em] text-white/30">{label}</div><div className="mt-2 font-display text-2xl font-black text-white">{value}</div></div>; }
function StatPanel({ title, value, text }: { title: string; value: string; text: string }) { return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5"><div className="font-mono text-[8px] font-black uppercase tracking-[.22em] text-white/30">{title}</div><div className="mt-2 font-display text-2xl font-black text-amber-100">{value}</div><p className="mt-2 text-sm leading-6 text-white/30">{text}</p></div>; }
