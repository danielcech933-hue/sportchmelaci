import { supabase } from "@/integrations/supabase/client";
import type { Match, SportId, SetScore, Bet } from "./matches";

type Row = {
  id: string;
  owner_id: string;
  sport: string;
  team_a: string;
  team_b: string;
  score_a: number;
  score_b: number;
  sets: unknown;
  bets: unknown;
  started_at: string;
  ended_at: string | null;
  scheduled_at?: string | null;
  confirmed_at?: string | null;
  confirmed_by?: string | null;
  bets_locked_at?: string | null;
  tournament_id?: string | null;
  round?: number | null;
  slot?: number | null;
  team_a_ref?: string | null;
  team_b_ref?: string | null;
};

function toMatch(r: Row, nickname: string): Match {
  return {
    id: r.id,
    ownerId: r.owner_id,
    ownerNickname: nickname,
    sport: r.sport as SportId,
    teamA: r.team_a,
    teamB: r.team_b,
    scoreA: r.score_a,
    scoreB: r.score_b,
    sets: (r.sets as SetScore[]) ?? [],
    bets: (r.bets as Bet[]) ?? [],
    betsLockedAt: r.bets_locked_at ? new Date(r.bets_locked_at).getTime() : undefined,
    startedAt: new Date(r.started_at).getTime(),
    endedAt: r.ended_at ? new Date(r.ended_at).getTime() : undefined,
    scheduledAt: r.scheduled_at ? new Date(r.scheduled_at).getTime() : undefined,
    confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).getTime() : undefined,
    confirmedBy: r.confirmed_by ?? null,
    tournamentId: r.tournament_id ?? null,
    round: r.round ?? null,
    slot: r.slot ?? null,
    teamARef: r.team_a_ref ?? null,
    teamBRef: r.team_b_ref ?? null,
  };
}

async function attachNicknames(rows: Row[]): Promise<Match[]> {
  const ids = Array.from(new Set(rows.map((r) => r.owner_id)));
  if (ids.length === 0) return [];
  const { data: profs } = await supabase.from("profiles").select("id,nickname").in("id", ids);
  const map = new Map<string, string>((profs ?? []).map((p) => [p.id, p.nickname]));
  return rows.map((r) => toMatch(r, map.get(r.owner_id) ?? "player"));
}

export async function fetchAllMatches(): Promise<Match[]> {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return attachNicknames((data ?? []) as Row[]);
}

export async function fetchMatch(id: string): Promise<Match | null> {
  const { data, error } = await supabase.from("matches").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [m] = await attachNicknames([data as Row]);
  return m;
}

export async function createMatch(input: {
  ownerId: string;
  sport: SportId;
  teamA: string;
  teamB: string;
  scheduledAt?: number | null;
}): Promise<string> {
  const payload: Record<string, unknown> = {
    owner_id: input.ownerId,
    sport: input.sport,
    team_a: input.teamA,
    team_b: input.teamB,
  };
  if (input.scheduledAt) payload.scheduled_at = new Date(input.scheduledAt).toISOString();
  const { data, error } = await supabase
    .from("matches")
    .insert(payload as never)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function saveMatch(m: Match): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .update({
      team_a: m.teamA,
      team_b: m.teamB,
      score_a: m.scoreA,
      score_b: m.scoreB,
      sets: m.sets as unknown as never,
      ended_at: m.endedAt ? new Date(m.endedAt).toISOString() : null,
    })
    .eq("id", m.id);
  if (error) throw error;
}

export async function placeBet(matchId: string, pick: "a" | "b", amount: number, note: string): Promise<{ balance: number }> {
  const { data, error } = await supabase.rpc("place_bet" as never, {
    _match_id: matchId, _pick: pick, _amount: amount, _note: note,
  } as never);
  if (error) throw error;
  return data as { balance: number };
}

export async function withdrawBet(matchId: string): Promise<{ refunded: number }> {
  const { data, error } = await supabase.rpc("withdraw_bet" as never, { _match_id: matchId } as never);
  if (error) throw error;
  return data as { refunded: number };
}

export async function removeMatch(id: string): Promise<void> {
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) throw error;
}

export async function setMatchConfirmed(id: string, userId: string | null): Promise<void> {
  const { error } = await supabase.rpc("confirm_match" as never, {
    _match_id: id,
    _confirm: userId !== null,
  } as never);
  if (error) throw error;
}

export async function removeBetFromMatch(matchId: string, betId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_remove_bet" as never, {
    _match_id: matchId,
    _bet_id: betId,
  } as never);
  if (error) throw error;
}


export async function updateMatchFixture(
  id: string,
  input: { teamA?: string; teamB?: string; scheduledAt?: number | null },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (input.teamA !== undefined) payload.team_a = input.teamA;
  if (input.teamB !== undefined) payload.team_b = input.teamB;
  if (input.scheduledAt !== undefined)
    payload.scheduled_at = input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null;
  const { error } = await supabase.from("matches").update(payload as never).eq("id", id);
  if (error) throw error;
}

export async function reopenMatch(id: string): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .update({ ended_at: null, score_a: 0, score_b: 0, sets: [] as unknown as never })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Admin score override. Writes the final score/sets, then asks the database to
 * recalculate the affected players' ELO (settlement + bracket triggers run
 * server-side on update).
 */
export async function adminOverrideScore(
  id: string,
  input: { scoreA: number; scoreB: number; sets?: SetScore[] },
): Promise<void> {
  const payload: Record<string, unknown> = { score_a: input.scoreA, score_b: input.scoreB };
  if (input.sets) payload.sets = input.sets;
  const { error } = await supabase.from("matches").update(payload as never).eq("id", id);
  if (error) throw error;
  const { error: rpcErr } = await supabase.rpc("sync_match_elo" as never, { _match_id: id } as never);
  if (rpcErr) throw rpcErr;
}
