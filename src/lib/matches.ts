export type SportId = "tennis" | "volleyball" | "nohejball" | "football" | "padel";

export interface SportConfig {
  id: SportId;
  name: string;
  emoji: string;
  hasSets: boolean;
  setLabel: string; // "Set", "Half", etc.
  quickPoints: number[]; // typical increments per tap
  defaultTeams: [string, string];
}

export const SPORTS: Record<SportId, SportConfig> = {
  tennis: {
    id: "tennis",
    name: "Tennis",
    emoji: "🎾",
    hasSets: true,
    setLabel: "Set",
    quickPoints: [1],
    defaultTeams: ["Player 1", "Player 2"],
  },
  volleyball: {
    id: "volleyball",
    name: "Volleyball",
    emoji: "🏐",
    hasSets: true,
    setLabel: "Set",
    quickPoints: [1],
    defaultTeams: ["Home", "Away"],
  },
  nohejball: {
    id: "nohejball",
    name: "Nohejball",
    emoji: "🦶",
    hasSets: true,
    setLabel: "Set",
    quickPoints: [1],
    defaultTeams: ["Home", "Away"],
  },
  football: {
    id: "football",
    name: "Football",
    emoji: "⚽",
    hasSets: false,
    setLabel: "Half",
    quickPoints: [1],
    defaultTeams: ["Home", "Away"],
  },
  padel: {
    id: "padel",
    name: "Padel",
    emoji: "🎾",
    hasSets: true,
    setLabel: "Set",
    quickPoints: [1],
    defaultTeams: ["Team A", "Team B"],
  },
};

export const SPORT_LIST = Object.values(SPORTS);

export interface SetScore {
  a: number;
  b: number;
}

export interface Match {
  id: string;
  sport: SportId;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  sets: SetScore[]; // completed sets
  startedAt: number;
  endedAt?: number;
}

const KEY = "scoreboard.matches.v1";

export function loadMatches(): Match[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Match[];
  } catch {
    return [];
  }
}

export function saveMatches(matches: Match[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(matches));
}

export function upsertMatch(match: Match) {
  const all = loadMatches();
  const idx = all.findIndex((m) => m.id === match.id);
  if (idx >= 0) all[idx] = match;
  else all.unshift(match);
  saveMatches(all);
}

export function deleteMatch(id: string) {
  saveMatches(loadMatches().filter((m) => m.id !== id));
}

export function newMatch(sport: SportId): Match {
  const cfg = SPORTS[sport];
  return {
    id: crypto.randomUUID(),
    sport,
    teamA: cfg.defaultTeams[0],
    teamB: cfg.defaultTeams[1],
    scoreA: 0,
    scoreB: 0,
    sets: [],
    startedAt: Date.now(),
  };
}
