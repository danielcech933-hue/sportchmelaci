import { supabase } from "@/integrations/supabase/client";
import type { Match, MatchFormat, SportId, SetScore, Bet } from "./matches";

type Row = {
  id: string; owner_id: string; sport: string; match_format?: MatchFormat | null; team_a: string; team_b: string; score_a: number; score_b: number;
  team_a_players?: unknown; team_b_players?: unknown; sets: unknown; bets: unknown; started_at: string; ended_at: string | null; scheduled_at?: string | null;
  confirmed_at?: string | null; confirmed_by?: string | null; bets_locked_at?: string | null; tournament_id?: string | null;
  round?: number | null; slot?: number | null; team_a_ref?: string | null; team_b_ref?: string | null;
};

function playerArray(value: unknown, fallback: string): string[] {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  return fallback.split(/\s*(?:&|\/|,|\+)\s*/).map((s) => s.trim()).filter(Boolean);
}

function toMatch(r: Row, nickname: string): Match {
  const teamAPlayers = playerArray(r.team_a_players, r.team_a);
  const teamBPlayers = playerArray(r.team_b_players, r.team_b);
  const matchFormat: MatchFormat = r.match_format === "2v2" || teamAPlayers.length === 2 || teamBPlayers.length === 2 ? "2v2" : "1v1";
  return {
    id:r.id, ownerId:r.owner_id, ownerNickname:nickname, sport:r.sport as SportId, matchFormat,
    teamA:r.team_a, teamB:r.team_b, teamAPlayers, teamBPlayers,
    scoreA:r.score_a, scoreB:r.score_b, sets:(r.sets as SetScore[]) ?? [], bets:(r.bets as Bet[]) ?? [],
    betsLockedAt:r.bets_locked_at ? new Date(r.bets_locked_at).getTime() : undefined, startedAt:new Date(r.started_at).getTime(),
    endedAt:r.ended_at ? new Date(r.ended_at).getTime() : undefined, scheduledAt:r.scheduled_at ? new Date(r.scheduled_at).getTime() : undefined,
    confirmedAt:r.confirmed_at ? new Date(r.confirmed_at).getTime() : undefined, confirmedBy:r.confirmed_by ?? null,
    tournamentId:r.tournament_id ?? null, round:r.round ?? null, slot:r.slot ?? null, teamARef:r.team_a_ref ?? null, teamBRef:r.team_b_ref ?? null,
  };
}

async function attachNicknames(rows: Row[]): Promise<Match[]> {
  const ids=Array.from(new Set(rows.map(r=>r.owner_id))); if(!ids.length) return [];
  const {data:profs}=await supabase.from("profiles").select("id,nickname").in("id",ids);
  const map=new Map<string,string>((profs??[]).map(p=>[p.id,p.nickname])); return rows.map(r=>toMatch(r,map.get(r.owner_id)??"player"));
}
export async function fetchAllMatches():Promise<Match[]> { const {data,error}=await supabase.from("matches").select("*").order("started_at",{ascending:false}); if(error) throw error; return attachNicknames((data??[]) as Row[]); }
export async function fetchMatch(id:string):Promise<Match|null>{ const {data,error}=await supabase.from("matches").select("*").eq("id",id).maybeSingle(); if(error) throw error; if(!data) return null; const [m]=await attachNicknames([data as Row]); return m; }
export async function createMatch(input:{ownerId:string;sport:SportId;matchFormat?:MatchFormat;teamA:string;teamB:string;teamAPlayers?:string[];teamBPlayers?:string[];scheduledAt?:number|null}):Promise<string>{
  const matchFormat=input.matchFormat ?? "1v1";
  const aPlayers=(input.teamAPlayers?.length ? input.teamAPlayers : [input.teamA]).map((s)=>s.trim()).filter(Boolean);
  const bPlayers=(input.teamBPlayers?.length ? input.teamBPlayers : [input.teamB]).map((s)=>s.trim()).filter(Boolean);
  if (matchFormat === "1v1" && (aPlayers.length !== 1 || bPlayers.length !== 1)) throw new Error("1v1 vyžaduje jednoho hráče na každé straně.");
  if (matchFormat === "2v2" && (aPlayers.length !== 2 || bPlayers.length !== 2)) throw new Error("2v2 vyžaduje dva hráče na každé straně.");
  const all = [...aPlayers, ...bPlayers].map((s)=>s.toLocaleLowerCase("cs-CZ"));
  if (new Set(all).size !== all.length) throw new Error("Hráč nesmí být ve dvou stranách zároveň.");
  const payload:Record<string,unknown>={owner_id:input.ownerId,sport:input.sport,match_format:matchFormat,team_a:aPlayers.join(" & "),team_b:bPlayers.join(" & "),team_a_players:aPlayers,team_b_players:bPlayers};
  if(input.scheduledAt) payload.scheduled_at=new Date(input.scheduledAt).toISOString();
  const {data,error}=await supabase.from("matches").insert(payload as never).select("id").single(); if(error) throw error; return data.id;
}
export async function saveMatch(m:Match):Promise<void>{ const {error}=await supabase.rpc("save_match_score" as never,{_match_id:m.id,_score_a:m.scoreA,_score_b:m.scoreB,_sets:m.sets as unknown as never,_ended_at:m.endedAt?new Date(m.endedAt).toISOString():null} as never); if(error) throw error; }

export async function placeMarketBet(input:{matchId:string;marketId:string;optionId:string;pick:"a"|"b"|"draw";amount:number;lockedOdds:number;marketLabel?:string;selectionLabel?:string;note?:string}):Promise<{balance:number;lockedOdds:number}>{
  const {data,error}=await supabase.rpc("place_market_bet" as never,{_match_id:input.matchId,_market_id:input.marketId,_option_id:input.optionId,_pick:input.pick,_amount:input.amount,_locked_odds:input.lockedOdds,_note:[input.marketLabel,input.selectionLabel,input.note].filter(Boolean).join(" · ").slice(0,120)} as never);
  if(error) throw error; return data as {balance:number;lockedOdds:number};
}

export async function placeBet(matchId:string,pick:"a"|"b"|"draw",amount:number,note:string):Promise<{balance:number}>{ const {data,error}=await supabase.rpc("place_bet" as never,{_match_id:matchId,_pick:pick,_amount:amount,_note:note} as never); if(error) throw error; return data as {balance:number}; }
export async function withdrawBet(matchId:string):Promise<{refunded:number}>{ const {data,error}=await supabase.rpc("withdraw_bet" as never,{_match_id:matchId} as never); if(error) throw error; return data as {refunded:number}; }
export async function removeMatch(id:string):Promise<void>{ const {error}=await supabase.from("matches").delete().eq("id",id); if(error) throw error; }
export async function setMatchConfirmed(id:string,userId:string|null):Promise<void>{ const {error}=await supabase.rpc("confirm_match" as never,{_match_id:id,_confirm:userId!==null} as never); if(error) throw error; }
export async function removeBetFromMatch(matchId:string,betId:string):Promise<void>{ const {error}=await supabase.rpc("admin_remove_bet" as never,{_match_id:matchId,_bet_id:betId} as never); if(error) throw error; }
export async function updateMatchFixture(id:string,input:{teamA?:string;teamB?:string;scheduledAt?:number|null}):Promise<void>{ const payload:Record<string,unknown>={}; if(input.teamA!==undefined) payload.team_a=input.teamA; if(input.teamB!==undefined) payload.team_b=input.teamB; if(input.scheduledAt!==undefined) payload.scheduled_at=input.scheduledAt?new Date(input.scheduledAt).toISOString():null; const {error}=await supabase.from("matches").update(payload as never).eq("id",id); if(error) throw error; }
export async function reopenMatch(id:string):Promise<void>{ const {error}=await supabase.from("matches").update({ended_at:null,score_a:0,score_b:0,sets:[] as unknown as never}).eq("id",id); if(error) throw error; }
export async function adminOverrideScore(id:string,input:{scoreA:number;scoreB:number;sets?:SetScore[]}):Promise<void>{ const payload:Record<string,unknown>={score_a:input.scoreA,score_b:input.scoreB}; if(input.sets) payload.sets=input.sets; const {error}=await supabase.from("matches").update(payload as never).eq("id",id); if(error) throw error; const {error:rpcErr}=await supabase.rpc("sync_match_elo" as never,{_match_id:id} as never); if(rpcErr) throw rpcErr; }
