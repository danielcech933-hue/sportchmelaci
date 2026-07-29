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
  bettor: string;
  pick: "a" | "b";
  amount?: number;
  note?: string;
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
  startedAt: number;
  endedAt?: number;
  scheduledAt?: number;
  confirmedAt?: number;
  confirmedBy?: string | null;
}

