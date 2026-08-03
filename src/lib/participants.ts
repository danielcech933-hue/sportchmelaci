import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Match } from "@/lib/matches";

/** Split a stored side label ("Danko & Boro") into individual participant names. */
export function splitSide(label: string): string[] {
  return label
    .split(/[&,+/]|\bvs\b/i)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

type Membership = { teamIds: string[]; teamNames: string[] };

/** Team ids + names the signed-in user belongs to (as owner or member). */
export function useMyTeams(): Membership {
  const { user } = useAuth();
  const [state, setState] = useState<Membership>({ teamIds: [], teamNames: [] });

  useEffect(() => {
    if (!user) {
      setState({ teamIds: [], teamNames: [] });
      return;
    }
    let alive = true;
    (async () => {
      const [{ data: owned }, { data: memberOf }] = await Promise.all([
        supabase.from("teams").select("id,name").eq("owner_id", user.id),
        supabase.from("team_members").select("team_id").eq("user_id", user.id),
      ]);
      const memberIds = (memberOf ?? []).map((m) => m.team_id);
      let memberTeams: { id: string; name: string }[] = [];
      if (memberIds.length) {
        const { data } = await supabase.from("teams").select("id,name").in("id", memberIds);
        memberTeams = data ?? [];
      }
      const all = [...(owned ?? []), ...memberTeams];
      if (!alive) return;
      setState({
        teamIds: Array.from(new Set(all.map((t) => t.id))),
        teamNames: Array.from(new Set(all.map((t) => t.name.trim().toLowerCase()))),
      });
    })();
    return () => {
      alive = false;
    };
  }, [user?.id]);

  return state;
}

/**
 * True when the signed-in user is an active participant of the match:
 * the match owner, a named player on either side (1v1 / 2v2), or a member of
 * a referenced team (tournament fixtures included).
 */
export function useIsParticipant(match: Match | null): boolean {
  const { user, nickname } = useAuth();
  const { teamIds, teamNames } = useMyTeams();

  return useMemo(() => {
    if (!user || !match) return false;
    if (match.ownerId === user.id) return true;
    if (match.teamARef && teamIds.includes(match.teamARef)) return true;
    if (match.teamBRef && teamIds.includes(match.teamBRef)) return true;
    const names = [...splitSide(match.teamA), ...splitSide(match.teamB)];
    const nick = nickname?.trim().toLowerCase();
    if (nick && names.includes(nick)) return true;
    return names.some((n) => teamNames.includes(n));
  }, [user?.id, nickname, match, teamIds, teamNames]);
}
