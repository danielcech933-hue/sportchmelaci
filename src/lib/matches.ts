export type SportId =
  | "tennis"
  | "volleyball"
  | "nohejball"
  | "football"
  | "padel"
  | "foosball"
  | "pingpong"
  | "basketball"
  | "darts"
  | "beerpong"
  | "beerrace";

export interface SportConfig {
  id: SportId;
  name: string;
  emoji: string;
  hasSets: boolean;
  setLabel: string;
  quickPoints: number[];
  defaultTeams: [string, string];
}

export const SPORTS: Record<SportId, SportConfig> = {
  tennis:     { id: "tennis",     name: "Tennis",           emoji: "🎾", hasSets: true,  setLabel: "Set",   quickPoints: [1],    defaultTeams: ["Player 1", "Player 2"] },
  volleyball: { id: "volleyball", name: "Volleyball",       emoji: "🏐", hasSets: true,  setLabel: "Set",   quickPoints: [1],    defaultTeams: ["Home", "Away"] },
  nohejball:  { id: "nohejball",  name: "Nohejball",        emoji: "🦶", hasSets: true,  setLabel: "Set",   quickPoints: [1],    defaultTeams: ["Home", "Away"] },
  football:   { id: "football",   name: "Football",         emoji: "⚽", hasSets: false, setLabel: "Half",  quickPoints: [1],    defaultTeams: ["Home", "Away"] },
  padel:      { id: "padel",      name: "Padel",            emoji: "🎾", hasSets: true,  setLabel: "Set",   quickPoints: [1],    defaultTeams: ["Team A", "Team B"] },
  foosball:   { id: "foosball",   name: "Stolní fotbálek",  emoji: "⚽", hasSets: false, setLabel: "Game",  quickPoints: [1],    defaultTeams: ["Red", "Blue"] },
  pingpong:   { id: "pingpong",   name: "Ping Pong",        emoji: "🏓", hasSets: true,  setLabel: "Set",   quickPoints: [1],    defaultTeams: ["Player 1", "Player 2"] },
  basketball: { id: "basketball", name: "Basketball",       emoji: "🏀", hasSets: false, setLabel: "Q",     quickPoints: [1, 2, 3], defaultTeams: ["Home", "Away"] },
  darts:      { id: "darts",      name: "Šipky",            emoji: "🎯", hasSets: true,  setLabel: "Leg",   quickPoints: [1, 25, 50], defaultTeams: ["Player 1", "Player 2"] },
  beerpong:   { id: "beerpong",   name: "Bear Pong",        emoji: "🍺", hasSets: false, setLabel: "Cup",   quickPoints: [1],    defaultTeams: ["Team A", "Team B"] },
  beerrace:   { id: "beerrace",   name: "Kdo vypije víc piv", emoji: "🍻", hasSets: false, setLabel: "Beer", quickPoints: [1],   defaultTeams: ["Drinker 1", "Drinker 2"] },
};

export const SPORT_LIST = Object.values(SPORTS);

export interface SetScore { a: number; b: number }
export interface Bet {
  id: string;
  userId?: string;
  bettor: string;
  pick: "a" | "b";
  amount?: number;
  note?: string;
  status?: "open" | "won" | "lost" | "refunded";
  payout?: number;
  createdAt: number;
}

export interface Match {
  id: string;
  ownerId: string;
  ownerNickname: string;
  sport: SportId;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  sets: SetScore[];
  bets: Bet[];
  betsLockedAt?: number;
  startedAt: number;
  endedAt?: number;
  scheduledAt?: number;
  confirmedAt?: number;
  confirmedBy?: string | null;
  tournamentId?: string | null;
  round?: number | null;
  slot?: number | null;
  teamARef?: string | null;
  teamBRef?: string | null;
}

export const MAX_BET = 250;
export const MIN_BET = 1;
export const STARTING_BALANCE = 1000;
export function betsPool(bets: Bet[]): number {
  return bets.reduce((s, b) => s + (b.amount ?? 0), 0);
}
export function uniqueBettors(bets: Bet[]): number {
  return new Set(bets.map((b) => b.userId ?? b.bettor)).size;
}

