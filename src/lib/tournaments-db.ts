import { supabase } from "@/integrations/supabase/client";
import type { Match, SportId } from "./matches";
import { fetchAllMatches } from "./matches-db";

export type TournamentFormat = "round_robin" | "single_elimination";

export interface Tournament {
  id: string;
  name: string;
  sport: SportId;
  format: TournamentFormat;
  status: string;
  createdBy: string;
  createdAt: number;
  scheduledAt?: number | null;
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  name: string;
  seed: number;
  players: string[];
}

type TRow = {
  id: string;
  name: string;
  sport: string;
  format: string;
  status: string;
  created_by: string;
  created_at: string;
  scheduled_at?: string | null;
};

type TeamRow = { id: string; tournament_id: string; name: string; seed: number; players: string[] | null };

function toTournament(r: TRow): Tournament {
  return {
    id: r.id,
    name: r.name,
    sport: r.sport as SportId,
    format: r.format as TournamentFormat,
    status: r.status,
    createdBy: r.created_by,
    createdAt: new Date(r.created_at).getTime(),
    scheduledAt: r.scheduled_at ? new Date(r.scheduled_at).getTime() : null,
  };
}


export async function fetchTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from("tournaments" as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as TRow[]).map(toTournament);
}

export async function fetchTournament(id: string): Promise<{
  tournament: Tournament | null;
  teams: TournamentTeam[];
  matches: Match[];
}> {
  const { data, error } = await supabase
    .from("tournaments" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { tournament: null, teams: [], matches: [] };

  const { data: teamRows } = await supabase
    .from("tournament_teams" as never)
    .select("*")
    .eq("tournament_id", id)
    .order("seed", { ascending: true });

  const all = await fetchAllMatches();
  const matches = all
    .filter((m) => m.tournamentId === id)
    .sort((a, b) => (a.round ?? 0) - (b.round ?? 0) || (a.slot ?? 0) - (b.slot ?? 0));

  return {
    tournament: toTournament(data as unknown as TRow),
    teams: ((teamRows ?? []) as unknown as TeamRow[]).map((t) => ({
      id: t.id,
      tournamentId: t.tournament_id,
      name: t.name,
      seed: t.seed,
      players: t.players ?? [],
    })),
    matches,
  };
}

export async function createTournament(input: {
  name: string;
  sport: SportId;
  format: TournamentFormat;
  teams: string[];
  players?: string[][];
  scheduledAt?: number | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_tournament" as never, {
    _name: input.name,
    _sport: input.sport,
    _format: input.format,
    _teams: input.teams,
    _players: input.players ?? input.teams.map(() => []),
    _scheduled_at: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null,
  } as never);
  if (error) throw error;
  return data as unknown as string;
}

export async function setTournamentSchedule(id: string, scheduledAt: number | null): Promise<void> {
  const { error } = await supabase.rpc("set_tournament_schedule" as never, {
    _tournament_id: id,
    _scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
  } as never);
  if (error) throw error;
}


export async function deleteTournament(id: string): Promise<void> {
  const { error } = await supabase.from("tournaments" as never).delete().eq("id", id);
  if (error) throw error;
}

export interface StandingRow {
  name: string;
  played: number;
  won: number;
  lost: number;
  scoreFor: number;
  scoreAgainst: number;
  points: number;
}

export function computeStandings(teams: TournamentTeam[], matches: Match[]): StandingRow[] {
  const map = new Map<string, StandingRow>();
  teams.forEach((t) =>
    map.set(t.name, { name: t.name, played: 0, won: 0, lost: 0, scoreFor: 0, scoreAgainst: 0, points: 0 }),
  );
  for (const m of matches) {
    if (!m.endedAt) continue;
    const a = map.get(m.teamA);
    const b = map.get(m.teamB);
    if (!a || !b) continue;
    a.played++; b.played++;
    a.scoreFor += m.scoreA; a.scoreAgainst += m.scoreB;
    b.scoreFor += m.scoreB; b.scoreAgainst += m.scoreA;

    let winner: "a" | "b" | null = null;
    if (m.scoreA > m.scoreB) winner = "a";
    else if (m.scoreB > m.scoreA) winner = "b";
    else {
      const sa = m.sets.filter((s) => s.a > s.b).length;
      const sb = m.sets.filter((s) => s.b > s.a).length;
      if (sa > sb) winner = "a";
      else if (sb > sa) winner = "b";
    }
    if (winner === "a") { a.won++; a.points += 3; b.lost++; }
    else if (winner === "b") { b.won++; b.points += 3; a.lost++; }
    else { a.points += 1; b.points += 1; }
  }
  return Array.from(map.values()).sort(
    (x, y) =>
      y.points - x.points ||
      (y.scoreFor - y.scoreAgainst) - (x.scoreFor - x.scoreAgainst) ||
      y.scoreFor - x.scoreFor ||
      x.name.localeCompare(y.name),
  );
}

export async function updateTeamPlayers(teamId: string, players: string[]): Promise<void> {
  const { error } = await supabase
    .from("tournament_teams" as never)
    .update({ players } as never)
    .eq("id", teamId);
  if (error) throw error;
}

export function playerErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? "";
  if (msg.includes("player_in_other_team")) {
    const who = msg.split("player_in_other_team:")[1]?.trim();
    return `Hráč ${who ? `"${who}" ` : ""}už je v jiném týmu tohoto turnaje.`;
  }
  if (msg.includes("duplicate_player")) return "Tento hráč už v týmu je.";
  return msg || "Nepodařilo se uložit soupisku.";
}
