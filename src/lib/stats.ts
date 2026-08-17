import { SPORTS, type Match } from "@/lib/matches";

export function splitPlayers(name: string): string[] {
  return name
    .split(/\s*(?:&|\/|\+|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function winnerSideOf(m: Match): "a" | "b" | null {
  if (!m.endedAt) return null;
  const cfg = SPORTS[m.sport];

  // Prefer the decisive set/leg count when it is available. Some older
  // recorded matches have a non-decisive or incomplete `sets` payload even
  // though the final score is already saved, so fall back to the final score
  // instead of silently dropping that result from the scoreboard.
  if (cfg.hasSets && m.sets.length > 0) {
    const a = m.sets.filter((s) => s.a > s.b).length;
    const b = m.sets.filter((s) => s.b > s.a).length;
    if (a > b) return "a";
    if (b > a) return "b";
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
  t.total = t.wins + t.losses;
}

export function isSoloMatch(m: Match): boolean {
  return splitPlayers(m.teamA).length === 1 && splitPlayers(m.teamB).length === 1;
}

/**
 * Returns the side a player belongs to. Team matches are intentionally
 * resolved from the individual player tokens, so every member of a team
 * receives the same W/L result exactly once.
 */
export function sideOf(nickname: string, m: Match): "a" | "b" | null {
  const nick = normalizeName(nickname);
  const a = splitPlayers(m.teamA).map(normalizeName);
  const b = splitPlayers(m.teamB).map(normalizeName);
  if (a.includes(nick)) return "a";
  if (b.includes(nick)) return "b";
  return null;
}

/**
 * Canonical per-player statistics. A team match is counted once for the
 * requested player, regardless of how many teammates are on their side.
 */
export function playerSplitStats(matches: Match[], nickname: string | null): SplitStats {
  const out: SplitStats = { solo: empty(), team: empty(), overall: empty() };
  if (!nickname) return out;

  const seen = new Set<string>();
  for (const m of matches) {
    const side = sideOf(nickname, m);
    if (!side) continue;
    const winner = winnerSideOf(m);
    if (!winner) continue;

    // Protect against the same match being supplied twice by a caller.
    if (seen.has(m.id)) continue;
    seen.add(m.id);

    credit(isSoloMatch(m) ? out.solo : out.team, side === winner);
    credit(out.overall, side === winner);
  }
  return out;
}

export type LeaderRow = { key: string; label: string; wins: number; losses: number; played: number; elo: number };

/** One canonical ranking model: ELO is the primary rank, W/L are context. */
export function buildLeaderboard(matches: Match[], category: "solo" | "team", seedNames: string[] = [], eloByNick: Map<string, number> = new Map()): LeaderRow[] {
  const map = new Map<string, LeaderRow>();
  const row = (name: string) => {
    const key = normalizeName(name);
    let r = map.get(key);
    if (!r) {
      r = { key, label: name.trim(), wins: 0, losses: 0, played: 0, elo: eloByNick.get(key) ?? 1000 };
      map.set(key, r);
    }
    return r;
  };
  for (const n of seedNames) if (n?.trim()) row(n);
  const seen = new Set<string>();
  for (const m of matches) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const w = winnerSideOf(m); if (!w) continue;
    const solo = isSoloMatch(m); if ((category === "solo") !== solo) continue;
    for (const side of ["a", "b"] as const) for (const p of splitPlayers(side === "a" ? m.teamA : m.teamB)) {
      const r = row(p);
      if (side === w) r.wins++; else r.losses++;
      r.played = r.wins + r.losses;
    }
  }
  return [...map.values()].sort((x, y) => y.elo - x.elo || y.wins - x.wins || y.played - x.played || x.label.localeCompare(y.label));
}
