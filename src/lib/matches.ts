export type SportId = "tennis" | "volleyball" | "nohejball" | "football" | "padel";

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
  tennis:     { id: "tennis",     name: "Tennis",     emoji: "🎾", hasSets: true,  setLabel: "Set",  quickPoints: [1], defaultTeams: ["Player 1", "Player 2"] },
  volleyball: { id: "volleyball", name: "Volleyball", emoji: "🏐", hasSets: true,  setLabel: "Set",  quickPoints: [1], defaultTeams: ["Home", "Away"] },
  nohejball:  { id: "nohejball",  name: "Nohejball",  emoji: "🦶", hasSets: true,  setLabel: "Set",  quickPoints: [1], defaultTeams: ["Home", "Away"] },
  football:   { id: "football",   name: "Football",   emoji: "⚽", hasSets: false, setLabel: "Half", quickPoints: [1], defaultTeams: ["Home", "Away"] },
  padel:      { id: "padel",      name: "Padel",      emoji: "🎾", hasSets: true,  setLabel: "Set",  quickPoints: [1], defaultTeams: ["Team A", "Team B"] },
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
}

export const MAX_BET = 50;
export const MIN_BET = 1;
export const STARTING_BALANCE = 1000;
export function betsPool(bets: Bet[]): number {
  return bets.reduce((s, b) => s + (b.amount ?? 0), 0);
}
export function uniqueBettors(bets: Bet[]): number {
  return new Set(bets.map((b) => b.userId ?? b.bettor)).size;
}
export function isLocked(m: Pick<Match, "betsLockedAt" | "bets">): boolean {
  return !!m.betsLockedAt || uniqueBettors(m.bets ?? []) >= 2;
}

