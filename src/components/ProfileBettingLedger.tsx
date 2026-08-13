import { useEffect, useState } from "react";
import { fetchMyBettingLedger, type BettingLedgerRow } from "@/lib/betting-ledger";
import { RotateCcw, Trophy, Clock3 } from "lucide-react";

export function ProfileBettingLedger({ userId }: { userId: string }) {
  const [rows, setRows] = useState<BettingLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMyBettingLedger(200).then((data) => { if (active) setRows(data); }).catch(() => { if (active) setRows([]); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const payoutTotal = rows.reduce((sum, row) => sum + (row.kind === "bet_payout" ? row.amount : 0), 0);
  const refundTotal = rows.reduce((sum, row) => sum + (row.kind === "bet_refund" ? row.amount : 0), 0);
  const returnedTotal = payoutTotal + refundTotal;

  if (loading) return <section className="relative mt-7 overflow-hidden rounded-3xl border border-primary/20 bg-background/55 p-5 backdrop-blur-md"><div className="flex items-center gap-3 text-sm text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Načítám finanční historii…</div></section>;

  return <section className="relative mt-7 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-background/90 via-background/70 to-primary/[0.035] p-4 shadow-[0_20px_60px_-45px_var(--color-primary)] backdrop-blur-md sm:p-6">
    <div className="pointer-events-none absolute inset-0 grid-bg opacity-[0.08]" />
    <div className="relative">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.25em] text-primary/90"><Clock3 className="h-3 w-3" /> Finanční historie</div><h2 className="font-display text-2xl tracking-[0.08em] text-foreground sm:text-3xl">BETTING ACTIVITY</h2><p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Oficiální vypořádání · posledních 200 záznamů</p></div>
        <div className="grid grid-cols-3 divide-x divide-border/50 overflow-hidden rounded-2xl border border-border/50 bg-background/45"><div className="px-3 py-2.5 text-right"><b className="block font-mono text-sm text-accent">${payoutTotal.toFixed(2)}</b><span className="text-[9px] uppercase tracking-wider text-muted-foreground">výhry</span></div><div className="px-3 py-2.5 text-right"><b className="block font-mono text-sm text-primary">${refundTotal.toFixed(2)}</b><span className="text-[9px] uppercase tracking-wider text-muted-foreground">refundy</span></div><div className="px-3 py-2.5 text-right"><b className="block font-mono text-sm text-foreground">${returnedTotal.toFixed(2)}</b><span className="text-[9px] uppercase tracking-wider text-muted-foreground">vráceno</span></div></div>
      </div>
      <div className="mt-6 border-t border-border/40 pt-4">
        {rows.length === 0 ? <div className="rounded-2xl border border-dashed border-primary/20 bg-background/35 px-4 py-8 text-center"><Clock3 className="mx-auto h-5 w-5 text-muted-foreground/60" /><p className="mt-2 text-sm font-medium text-muted-foreground">Žádné vypořádání v ledgeru</p><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground/70">Jakmile se sázka vypořádá, objeví se zde oficiální záznam návratu prostředků.</p></div> : <div className="space-y-2">{rows.map((row) => { const isPayout = row.kind === "bet_payout"; return <div key={row.id} className="group flex items-center justify-between gap-4 rounded-2xl border border-border/45 bg-background/45 px-3.5 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:bg-background/65"><div className="flex min-w-0 items-center gap-3"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${isPayout ? "border-accent/25 bg-accent/10 text-accent" : "border-primary/25 bg-primary/10 text-primary"}`}>{isPayout ? <Trophy className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{isPayout ? "Výhra ze sázky" : "Refund sázky"}</p><p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{new Date(row.created_at).toLocaleString("cs-CZ")}</p></div></div><span className={`shrink-0 font-mono text-sm font-semibold ${isPayout ? "text-accent" : "text-primary"}`}>+${row.amount.toFixed(2)}</span></div>; })}</div>}
      </div>
    </div>
  </section>;
}
