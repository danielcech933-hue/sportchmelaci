import { useEffect, useState } from "react";
import type { Bet, Match, SportId } from "./matches";
import { fetchAllMatches } from "./matches-db";

export interface SideStats {
  name: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  sportGames: number;
  sportWins: number;
}

export interface MatchOdds {
  /** model probability of side A winning (0–1) */
  probA: number;
  probB: number;
  /** decimal odds derived from blended probability */
  oddsA: number;
  oddsB: number;
  /** how much of the estimate comes from the live betting pool (0–1) */
  marketWeight: number;
  /** 0–1 confidence in the historical model (sample size based) */
  confidence: number;
  statsA: SideStats;
  statsB: SideStats;
  favourite: "a" | "b" | "even";
}

const norm = (s: string) => s.trim().toLowerCase();

function winnerOf(m: Match): "a" | "b" | null {
  if (!m.endedAt) return null;
  if (m.scoreA !== m.scoreB) return m.scoreA > m.scoreB ? "a" : "b";
  const sets = m.sets ?? [];
  const sa = sets.filter((s) => s.a > s.b).length;
  const sb = sets.filter((s) => s.b > s.a).length;
  if (sa === sb) return null;
  return sa > sb ? "a" : "b";
}

function emptyStats(name: string): SideStats {
  return { name, games: 0, wins: 0, losses: 0, winRate: 0.5, sportGames: 0, sportWins: 0 };
}

export function sideStats(name: string, sport: SportId, history: Match[]): SideStats {
  const key = norm(name);
  const st = emptyStats(name);
  if (!key || key === "tbd" || key === "bye") return st;

  for (const m of history) {
    const w = winnerOf(m);
    if (!w) continue;
    const isA = norm(m.teamA) === key;
    const isB = norm(m.teamB) === key;
    if (!isA && !isB) continue;
    const won = (isA && w === "a") || (isB && w === "b");
    st.games += 1;
    if (won) st.wins += 1;
    else st.losses += 1;
    if (m.sport === sport) {
      st.sportGames += 1;
      if (won) st.sportWins += 1;
    }
  }
  st.winRate = st.games ? st.wins / st.games : 0.5;
  return st;
}

/** Laplace-smoothed strength, with extra weight on same-sport results. */
function strength(s: SideStats): number {
  const overall = (s.wins + 1) / (s.games + 2);
  const inSport = (s.sportWins + 1) / (s.sportGames + 2);
  const sportW = s.sportGames >= 2 ? 0.6 : 0.25;
  return overall * (1 - sportW) + inSport * sportW;
}

export function poolTotals(bets: Bet[]) {
  const a = bets.filter((b) => b.pick === "a").reduce((s, b) => s + (b.amount ?? 0), 0);
  const b = bets.filter((b) => b.pick === "b").reduce((s, b) => s + (b.amount ?? 0), 0);
  return { a, b, pool: a + b };
}

export function computeOdds(match: Match, history: Match[]): MatchOdds {
  const others = history.filter((m) => m.id !== match.id);
  const statsA = sideStats(match.teamA, match.sport, others);
  const statsB = sideStats(match.teamB, match.sport, others);

  const sA = strength(statsA);
  const sB = strength(statsB);
  let modelA = sA / (sA + sB);

  // Shrink toward 50/50 when we barely know the players.
  const samples = Math.min(statsA.games, statsB.games);
  const confidence = Math.min(1, samples / 6);
  modelA = 0.5 + (modelA - 0.5) * (0.35 + 0.65 * confidence);

  // Blend in the crowd (live pool) as it grows.
  const { a, b, pool } = poolTotals(match.bets ?? []);
  const marketWeight = pool > 0 ? Math.min(0.5, pool / 600) : 0;
  const marketA = pool > 0 ? a / pool : 0.5;
  let probA = modelA * (1 - marketWeight) + marketA * marketWeight;
  probA = Math.min(0.9, Math.max(0.1, probA));
  const probB = 1 - probA;

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const favourite = Math.abs(probA - 0.5) < 0.03 ? "even" : probA > 0.5 ? "a" : "b";

  return {
    probA,
    probB,
    oddsA: round2(1 / probA),
    oddsB: round2(1 / probB),
    marketWeight,
    confidence,
    statsA,
    statsB,
    favourite,
  };
}

/** Pari-mutuel projected payout if `pick` wins with `amount` added to the pool. */
export function projectedPayout(bets: Bet[], pick: "a" | "b", amount: number): number {
  const { a, b, pool } = poolTotals(bets);
  const side = (pick === "a" ? a : b) + amount;
  const total = pool + amount;
  if (side <= 0) return amount;
  return Math.round((amount * total) / side * 100) / 100;
}

/** Payout implied by the model odds (indicative only). */
export function oddsPayout(amount: number, odds: number): number {
  return Math.round(amount * odds * 100) / 100;
}

export function formatOdds(o: number): string {
  return o.toFixed(2);
}

export function formatPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

/** Loads finished-match history once for odds calculations. */
export function useMatchHistory(): { history: Match[]; loading: boolean } {
  const [history, setHistory] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchAllMatches()
      .then((all) => {
        if (alive) setHistory(all.filter((m) => !!m.endedAt));
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { history, loading };
}
