import { supabase } from "@/integrations/supabase/client";

export type AuditEntry = {
  id: string;
  actor_id: string | null;
  actor_nickname: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  match_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export async function fetchAuditLog(limit = 200): Promise<AuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}

const LABELS: Record<string, string> = {
  "match.created": "Vytvořen zápas",
  "match.deleted": "Smazán zápas",
  "match.finished": "Zápas ukončen",
  "match.reopened": "Zápas znovu otevřen",
  "match.confirmed": "✅ Potvrzen adminem",
  "match.unconfirmed": "↩️ Zrušeno potvrzení",
  "match.score_changed": "Změna skóre",
  "match.bets_locked": "🔒 Sázky uzamčeny",
  "match.settled": "💰 Sázky vyplaceny",
  "match.settled_refund": "↩️ Sázky refundovány",
  "bet.placed": "🎲 Vsazeno",
  "bet.withdrawn": "↩️ Stažena sázka",
};

export function actionLabel(a: string): string {
  return LABELS[a] ?? a;
}
