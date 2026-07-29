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
  confirmed_at?: string | null;
  confirmed_by?: string | null;
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
    startedAt: new Date(r.started_at).getTime(),
    endedAt: r.ended_at ? new Date(r.ended_at).getTime() : undefined,
    confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).getTime() : undefined,
    confirmedBy: r.confirmed_by ?? null,
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
}): Promise<string> {
  const { data, error } = await supabase
    .from("matches")
    .insert({
      owner_id: input.ownerId,
      sport: input.sport,
      team_a: input.teamA,
      team_b: input.teamB,
    })
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
      bets: m.bets as unknown as never,
      ended_at: m.endedAt ? new Date(m.endedAt).toISOString() : null,
    })
    .eq("id", m.id);
  if (error) throw error;
}

export async function removeMatch(id: string): Promise<void> {
  const { error } = await supabase.from("matches").delete().eq("id", id);
  if (error) throw error;
}

export async function setMatchConfirmed(id: string, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from("matches")
    .update({
      confirmed_at: userId ? new Date().toISOString() : null,
      confirmed_by: userId,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function removeBetFromMatch(matchId: string, betId: string): Promise<void> {
  const { data, error: fetchErr } = await supabase
    .from("matches")
    .select("bets")
    .eq("id", matchId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!data) return;
  const bets = ((data.bets as Bet[]) ?? []).filter((b) => b.id !== betId);
  const { error } = await supabase.from("matches").update({ bets: bets as unknown as never }).eq("id", matchId);
  if (error) throw error;
}

