import { SPORTS, type Match } from "@/lib/matches";

/** Split an ad-hoc side name ("A & B") into individual player nicknames. */
export function splitPlayers(name: string): string[] {
  return name
    .split(/\s*(?:&|\/|\+|,|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Decided winner of a finished match, or null when unfinished / drawn. */
export function winnerSideOf(m: Match): "a" | "b" | null {
  if (!m.endedAt) return null;
  const cfg = SPORTS[m.sport];
  if (cfg.hasSets && m.sets.length > 0) {
    const a = m.sets.filter((s) => s.a > s.b).length;
    const b = m.sets.filter((s) => s.b > s.a).length;
    if (a === b) return null;
    return a > b ? "a" : "b";
  }
  if (m.scoreA === m.scoreB) return null;
  return m.scoreA > m.scoreB ? "a" : "b";
}

export type Tally = { wins: number; losses: number; total: number };
export type SplitStats = { solo: Tally; team: Tally; overall: Tally };

const empty = (): Tally => ({ wins: 0, losses: 0, total: 0 });

function credit(t: Tally, won: boolean) {
  if (won) t.wins++;
  else t.losses++;
  t.total = t.wins + t.losses; // strict math: total === wins + losses, always
}

/** Is this match a 1v1 (solo) fixture? Anything else counts as an ad-hoc team game. */
export function isSoloMatch(m: Match): boolean {
  return splitPlayers(m.teamA).length === 1 && splitPlayers(m.teamB).length === 1;
}

export function sideOf(nickname: string, m: Match): "a" | "b" | null {
  const nick = nickname.trim().toLowerCase();
  if (splitPlayers(m.teamA).some((p) => p.toLowerCase() === nick)) return "a";
  if (splitPlayers(m.teamB).some((p) => p.toLowerCase() === nick)) return "b";
  return null;
}

/**
 * Per-player stats split into Solo and Team categories.
 * Ad-hoc teams award the win/loss to every individual player on that side —
 * no permanent team entity is credited.
 */
export function playerSplitStats(matches: Match[], nickname: string | null): SplitStats {
  const out: SplitStats = { solo: empty(), team: empty(), overall: empty() };
  if (!nickname) return out;
  for (const m of matches) {
    const w = winnerSideOf(m);
    if (!w) continue; // only decided, finished matches are counted
    const side = sideOf(nickname, m);
    if (!side) continue;
    const won = side === w;
    credit(isSoloMatch(m) ? out.solo : out.team, won);
    credit(out.overall, won);
  }
  return out;
}

export type LeaderRow = {
  key: string;
  label: string;
  wins: number;
  losses: number;
  played: number;
};

/**
 * Individual leaderboard for a category. Ad-hoc team results are attributed to
 * each player on the winning/losing side.
 */
export function buildLeaderboard(
  matches: Match[],
  category: "solo" | "team",
  seedNames: string[] = [],
): LeaderRow[] {
  const map = new Map<string, LeaderRow>();
  const row = (name: string) => {
    const key = name.trim().toLowerCase();
    let r = map.get(key);
    if (!r) {
      r = { key, label: name.trim(), wins: 0, losses: 0, played: 0 };
      map.set(key, r);
    }
    return r;
  };
  for (const n of seedNames) if (n?.trim()) row(n);

  for (const m of matches) {
    const w = winnerSideOf(m);
    if (!w) continue;
    const solo = isSoloMatch(m);
    if ((category === "solo") !== solo) continue;
    for (const side of ["a", "b"] as const) {
      const players = splitPlayers(side === "a" ? m.teamA : m.teamB);
      for (const p of players) {
        const r = row(p);
        if (side === w) r.wins++;
        else r.losses++;
        r.played = r.wins + r.losses;
      }
    }
  }
  return [...map.values()].sort(
    (x, y) => y.wins - x.wins || y.played - x.played || x.label.localeCompare(y.label),
  );
}
