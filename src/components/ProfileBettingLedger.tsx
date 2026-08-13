import { useEffect, useState } from "react";
import { fetchMyBettingLedger, type BettingLedgerRow } from "@/lib/betting-ledger";
import { Coins, RotateCcw, Trophy } from "lucide-react";

export function ProfileBettingLedger({ userId }: { userId: string }) {
  const [rows, setRows] = useState<BettingLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMyBettingLedger(30)
      .then((data) => { if (active) setRows(data); })
      .catch(() => { if (active) setRows([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const payoutTotal = rows.reduce((sum, row) => sum + (row.kind === "bet_payout" ? row.amount : 0), 0);
  const refundTotal = rows.reduce((sum, row) => sum + (row.kind === "bet_refund" ? row.amount : 0), 0);
  const settlementNet = payoutTotal + refundTotal;

  if (loading) return <section className="mt-6 rounded-2xl border border-primary/20 bg-background/50 p-4 text-sm text-muted-foreground">Načítám finanční historii…</section>;

  return (
    <section className="mt-6 rounded-2xl border border-primary/20 bg-background/50 p-4 backdrop-blur">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-display text-lg tracking-wider text-primary">BETTING LEDGER</h2><p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Oficiální vypořádání</p></div>
        <div className="grid grid-cols-3 gap-2 text-right text-[10px] font-mono"><span><b className="block text-accent">${payoutTotal.toFixed(2)}</b>výhry</span><span><b className="block text-primary">${refundTotal.toFixed(2)}</b>refundy</span><span><b className="block text-foreground">${settlementNet.toFixed(2)}</b>vráceno</span></div>
      </div>
      {rows.length === 0 ? <p className="py-5 text-sm text-muted-foreground">Zatím žádné vypořádané sázky.</p> : (
        <div className="space-y-2">{rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3 py-2">
            <div className="flex items-center gap-2">{row.kind === "bet_payout" ? <Trophy className="h-4 w-4 text-accent" /> : <RotateCcw className="h-4 w-4 text-primary" />}<div><p className="text-sm font-medium">{row.kind === "bet_payout" ? "Výhra ze sázky" : "Refund sázky"}</p><p className="text-[10px] text-muted-foreground">{new Date(row.created_at).toLocaleString("cs-CZ")}</p></div></div>
            <span className="font-mono font-semibold text-accent">+${row.amount.toFixed(2)}</span>
          </div>
        ))}</div>
      )}
    </section>
  );
}
