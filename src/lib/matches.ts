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
  | "beerrace"
  | "eafc"
  | "nhl"
  | "nba2k"
  | "rocketleague"
  | "f1"
  | "topspin";

/** Market family used by the betting module. */
export type MarketKind = "goals" | "hockey" | "points" | "sets" | "race";

export interface SportConfig {
  id: SportId;
  name: string;
  emoji: string;
  hasSets: boolean;
  setLabel: string;
  quickPoints: number[];
  defaultTeams: [string, string];
  /** true = esport simulator title */
  esport?: boolean;
  market: MarketKind;
}

export const SPORTS: Record<SportId, SportConfig> = {
  tennis:     { id: "tennis",     name: "Tennis",           emoji: "🎾", hasSets: true,  setLabel: "Set",   quickPoints: [1],    defaultTeams: ["Player 1", "Player 2"], market: "sets" },
  volleyball: { id: "volleyball", name: "Volleyball",       emoji: "🏐", hasSets: true,  setLabel: "Set",   quickPoints: [1],    defaultTeams: ["Home", "Away"], market: "sets" },
  nohejball:  { id: "nohejball",  name: "Nohejball",        emoji: "🦶", hasSets: true,  setLabel: "Set",   quickPoints: [1],    defaultTeams: ["Home", "Away"], market: "sets" },
  football:   { id: "football",   name: "Football",         emoji: "⚽", hasSets: false, setLabel: "Half",  quickPoints: [1],    defaultTeams: ["Home", "Away"], market: "goals" },
  padel:      { id: "padel",      name: "Padel",            emoji: "🎾", hasSets: true,  setLabel: "Set",   quickPoints: [1],    defaultTeams: ["Team A", "Team B"], market: "sets" },
  foosball:   { id: "foosball",   name: "Stolní fotbálek",  emoji: "⚽", hasSets: false, setLabel: "Game",  quickPoints: [1],    defaultTeams: ["Red", "Blue"], market: "goals" },
  pingpong:   { id: "pingpong",   name: "Ping Pong",        emoji: "🏓", hasSets: true,  setLabel: "Set",   quickPoints: [1],    defaultTeams: ["Player 1", "Player 2"], market: "sets" },
  basketball: { id: "basketball", name: "Basketball",       emoji: "🏀", hasSets: false, setLabel: "Q",     quickPoints: [1, 2, 3], defaultTeams: ["Home", "Away"], market: "points" },
  darts:      { id: "darts",      name: "Šipky",            emoji: "🎯", hasSets: true,  setLabel: "Leg",   quickPoints: [1, 25, 50], defaultTeams: ["Player 1", "Player 2"], market: "sets" },
  beerpong:   { id: "beerpong",   name: "Bear Pong",        emoji: "🍺", hasSets: false, setLabel: "Cup",   quickPoints: [1],    defaultTeams: ["Team A", "Team B"], market: "points" },
  beerrace:   { id: "beerrace",   name: "Kdo vypije víc piv", emoji: "🍻", hasSets: false, setLabel: "Beer", quickPoints: [1],   defaultTeams: ["Drinker 1", "Drinker 2"], market: "race" },

  // ---- Esport simulators ----
  eafc:         { id: "eafc",         name: "EA Sports FC",  emoji: "🎮", hasSets: false, setLabel: "Half", quickPoints: [1],    defaultTeams: ["Hráč 1", "Hráč 2"], esport: true, market: "goals" },
  nhl:          { id: "nhl",          name: "NHL",           emoji: "🏒", hasSets: false, setLabel: "Třetina", quickPoints: [1], defaultTeams: ["Hráč 1", "Hráč 2"], esport: true, market: "hockey" },
  nba2k:        { id: "nba2k",        name: "NBA 2K",        emoji: "🏀", hasSets: false, setLabel: "Q",    quickPoints: [1, 2, 3], defaultTeams: ["Hráč 1", "Hráč 2"], esport: true, market: "points" },
  rocketleague: { id: "rocketleague", name: "Rocket League", emoji: "🚗", hasSets: false, setLabel: "Game", quickPoints: [1],    defaultTeams: ["Hráč 1", "Hráč 2"], esport: true, market: "goals" },
  f1:           { id: "f1",           name: "F1",            emoji: "🏎️", hasSets: false, setLabel: "Kolo", quickPoints: [1],    defaultTeams: ["Jezdec 1", "Jezdec 2"], esport: true, market: "race" },
  topspin:      { id: "topspin",      name: "TopSpin",       emoji: "🎾", hasSets: true,  setLabel: "Set",  quickPoints: [1],    defaultTeams: ["Hráč 1", "Hráč 2"], esport: true, market: "sets" },
};

export const SPORT_LIST = Object.values(SPORTS);
export const CLASSIC_SPORTS = SPORT_LIST.filter((s) => !s.esport);
export const ESPORT_SPORTS = SPORT_LIST.filter((s) => !!s.esport);


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

