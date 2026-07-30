import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SPORTS, type Match, betsPool, uniqueBettors } from "@/lib/matches";
import { fetchAllMatches } from "@/lib/matches-db";

export const Route = createFileRoute("/bets")({
  head: () => ({
    meta: [
      { title: "Live Bets — Courtside" },
      { name: "description", content: "Live betting board: locked pools, open bets, and recent payouts." },
      { property: "og:title", content: "Live Bets — Courtside" },
      { property: "og:description", content: "Follow every locked bet in real time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BetsPage,
});

function BetsPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () => fetchAllMatches().then((m) => { if (alive) { setMatches(m); setLoading(false); } });
    load();
    const iv = setInterval(load, 5000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  const withBets = matches.filter((m) => (m.bets ?? []).length > 0);
  const live = withBets.filter((m) => !m.endedAt).sort((a, b) => betsPool(b.bets) - betsPool(a.bets));
  const settled = withBets.filter((m) => m.endedAt).sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)).slice(0, 10);

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-background/40 p-6 md:p-10">
        <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="scanline pointer-events-none absolute inset-0" />
        <div className="relative">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-accent">// LIVE BET BOARD</p>
          <h1 className="mt-2 font-display text-4xl tracking-widest neon-text md:text-6xl">💸 BETS</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Sázet můžeš, dokud zápas neskončí. Max sázka $250 · jedna sázka na hráče a zápas.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Section title="🔥 Otevřené sázky" empty="Zatím žádné otevřené sázky.">
            {live.map((m) => <LiveCard key={m.id} m={m} />)}
          </Section>
          <Section title="✅ Vypořádané" empty="Zatím nic vypořádaného.">
            {settled.map((m) => <SettledCard key={m.id} m={m} />)}
          </Section>
        </>
      )}
    </main>
  );
}

function Section({ title, children, empty }: { title: string; children: React.ReactNode; empty: string }) {
  const arr = Array.isArray(children) ? children : [children];
  const has = arr.filter(Boolean).length > 0;
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-xl tracking-wider neon-text">{title}</h2>
      {has ? <div className="grid gap-3 md:grid-cols-2">{children}</div> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

function LiveCard({ m }: { m: Match }) {
  const cfg = SPORTS[m.sport];
  const pool = betsPool(m.bets);
  const nB = uniqueBettors(m.bets);
  const totals = {
    a: m.bets.filter((b) => b.pick === "a").reduce((s, b) => s + (b.amount ?? 0), 0),
    b: m.bets.filter((b) => b.pick === "b").reduce((s, b) => s + (b.amount ?? 0), 0),
  };
  const pctA = pool ? (totals.a / pool) * 100 : 50;
  return (
    <Link to="/match" search={{ id: m.id }} className="panel neon-border block p-4 transition hover:brightness-110">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.3em]">
        <span className="text-primary">{cfg.emoji} {cfg.name}</span>
        <span className="text-accent">🔴 OPEN · {nB} sázejících</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="truncate font-display text-lg">{m.teamA}</span>
        <span className="font-mono text-2xl text-primary">{m.scoreA} : {m.scoreB}</span>
        <span className="truncate text-right font-display text-lg">{m.teamB}</span>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-background/60">
        <div className="bg-primary" style={{ width: `${pctA}%` }} />
        <div className="bg-accent" style={{ width: `${100 - pctA}%` }} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>${totals.a}</span>
        <span className="text-accent">Pool ${pool}</span>
        <span>${totals.b}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
        {m.bets.map((b) => (
          <span key={b.id} className={`rounded px-1.5 py-0.5 font-mono ${b.pick === "a" ? "bg-primary/15 text-primary" : "bg-accent/15 text-accent"}`}>
            {b.bettor} ${b.amount}
          </span>
        ))}
      </div>
    </Link>
  );
}

function SettledCard({ m }: { m: Match }) {
  const cfg = SPORTS[m.sport];
  const winners = m.bets.filter((b) => b.status === "won");
  const refunded = m.bets.some((b) => b.status === "refunded");
  return (
    <Link to="/match" search={{ id: m.id }} className="panel block p-4 opacity-90 transition hover:brightness-110">
      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.3em]">
        <span className="text-muted-foreground">{cfg.emoji} {cfg.name}</span>
        <span className="text-accent">{refunded ? "REFUNDED" : "SETTLED"}</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="truncate font-display">{m.teamA}</span>
        <span className="font-mono text-primary">{m.scoreA} : {m.scoreB}</span>
        <span className="truncate text-right font-display">{m.teamB}</span>
      </div>
      {winners.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
          {winners.map((b) => (
            <span key={b.id} className="rounded bg-accent/20 px-1.5 py-0.5 font-mono text-accent">
              {b.bettor} +${b.payout?.toFixed(0) ?? 0}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
