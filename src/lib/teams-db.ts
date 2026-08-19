import { supabase } from "@/integrations/supabase/client";

export interface TeamMember {
  id: string;
  userId: string;
  nickname: string;
}

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  ownerNickname: string;
  createdAt: number;
  members: TeamMember[];
}

type TeamRow = { id: string; name: string; owner_id: string; created_at: string };
type MemberRow = { id: string; team_id: string; user_id: string };

export async function fetchAllTeams(): Promise<Team[]> {
  const { data: teams, error } = await supabase
    .from("teams")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (teams ?? []) as TeamRow[];
  if (rows.length === 0) return [];

  const { data: members } = await supabase
    .from("team_members")
    .select("*")
    .in("team_id", rows.map((t) => t.id));
  const memberRows = (members ?? []) as MemberRow[];

  const userIds = new Set<string>();
  rows.forEach((t) => userIds.add(t.owner_id));
  memberRows.forEach((m) => userIds.add(m.user_id));
  const { data: profs } = await supabase
    .from("profile_public")
    .select("id,nickname")
    .in("id", Array.from(userIds));
  const nickMap = new Map<string, string>((profs ?? []).map((p) => [p.id, p.nickname]));

  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    ownerId: t.owner_id,
    ownerNickname: nickMap.get(t.owner_id) ?? "player",
    createdAt: new Date(t.created_at).getTime(),
    members: memberRows
      .filter((m) => m.team_id === t.id)
      .map((m) => ({ id: m.id, userId: m.user_id, nickname: nickMap.get(m.user_id) ?? "player" })),
  }));
}

export async function createTeam(ownerId: string, name: string): Promise<string> {
  const { data, error } = await supabase
    .from("teams")
    .insert({ owner_id: ownerId, name })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) throw error;
}

export async function addMemberByNickname(teamId: string, nickname: string): Promise<void> {
  const { data: prof, error: pe } = await supabase
    .from("profile_public")
    .select("id")
    .eq("nickname", nickname)
    .maybeSingle();
  if (pe) throw pe;
  if (!prof) throw new Error(`No user with nickname "${nickname}"`);
  const { error } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: prof.id });
  if (error) throw error;
}

export async function removeMember(memberId: string): Promise<void> {
  const { error } = await supabase.from("team_members").delete().eq("id", memberId);
  if (error) throw error;
}
