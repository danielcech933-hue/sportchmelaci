import { supabase } from "@/integrations/supabase/client";

export type BettingLedgerRow = {
  id: string;
  user_id: string;
  match_id: string | null;
  amount: number;
  kind: "bet_payout" | "bet_refund";
  created_at: string;
};

export async function fetchMyBettingLedger(limit = 50): Promise<BettingLedgerRow[]> {
  const { data, error } = await supabase.rpc("get_my_betting_ledger", { _limit: limit });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    user_id: String(row.user_id),
    match_id: row.match_id ? String(row.match_id) : null,
    amount: Number(row.amount ?? 0),
    kind: row.kind === "bet_refund" ? "bet_refund" : "bet_payout",
    created_at: String(row.created_at),
  }));
}
