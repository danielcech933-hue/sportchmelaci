import { supabase } from "@/integrations/supabase/client";

export type MyWallet = { balance: number; slotCZK: number };

function pick(data: unknown): Record<string, unknown> | null {
  if (data == null) return null;
  if (typeof data === "string") { try { return pick(JSON.parse(data)); } catch { return null; } }
  if (Array.isArray(data)) return pick(data[0]);
  if (typeof data === "object") return data as Record<string, unknown>;
  return null;
}

/** Own wallet balances read exclusively through the secure get_my_wallet() RPC. */
export async function fetchMyWallet(): Promise<MyWallet | null> {
  const { data, error } = await supabase.rpc("get_my_wallet");
  if (error) return null;
  const row = pick(data);
  if (!row) return null;
  const balance = Number(row["balance"] ?? 0);
  const slot = Number(row["slot_czk"] ?? row["slotCZK"] ?? 0);
  return { balance: Number.isFinite(balance) ? balance : 0, slotCZK: Number.isFinite(slot) ? slot : 0 };
}
