import { SPORTS, type Match } from "./matches";
import type { MatchOdds } from "./odds";

export interface MarketOption {
  id: string;
  label: string;
  odds: number;
  side?: "a" | "b" | "draw";
  modelProbability?: number;
}

export interface MarketTab {
  id: string;
  label: string;
  hint?: string;
  margin: number;
  options: MarketOption[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo = 0.02, hi = 0.96) => Math.min(hi, Math.max(lo, n));

/** Simulated sportsbook overround. These are model margins, not live bookmaker feeds. */
export function bettingMargin(match: Match): number {
  if (match.sport === "football" || match.sport === "eafc" || match.sport === "rocketleague") return 0.06;
  if (match.sport === "tennis" || match.sport === "topspin" || match.sport === "volleyball" || match.sport === "nohejball" || match.sport === "padel" || match.sport === "pingpong") return 0.05;
  if (match.sport === "basketball" || match.sport === "nba2k") return 0.06;
  if (match.sport === "nhl") return 0.06;
  return 0.07;
}

function price(probs: number[], margin: number): number[] {
  const total = probs.reduce((s, p) => s + Math.max(0.001, p), 0);
  const overround = 1 + margin;
  return probs.map((p) => r2(1 / clamp((p / total) * overround, 0.02, 0.98)));
}

function makeOptions(input: Array<Omit<MarketOption, "odds"> & { p: number }>, margin: number): MarketOption[] {
  const odds = price(input.map((x) => x.p), margin);
  return input.map((x, i) => ({ ...x, odds: Math.max(1.05, Math.min(50, odds[i])), modelProbability: x.p }));
}

function winnerOptions(match: Match, o: MatchOdds, margin: number): MarketOption[] {
  const a = o.probA;
  const b = o.probB;
  if (match.sport === "football" || match.sport === "eafc" || match.sport === "rocketleague" || match.sport === "foosball") {
    const draw = clamp(0.24 + (1 - Math.abs(a - b)) * 0.02, 0.18, 0.30);
    const winMass = 1 - draw;
    return makeOptions([
      { id: "win-a", label: match.teamA || "A", side: "a", p: a * winMass },
      { id: "draw", label: "Remíza", side: "draw", p: draw },
      { id: "win-b", label: match.teamB || "B", side: "b", p: b * winMass },
    ], margin);
  }
  return makeOptions([
    { id: "win-a", label: match.teamA || "A", side: "a", p: a },
    { id: "win-b", label: match.teamB || "B", side: "b", p: b },
  ], margin);
}

function market(match: Match, id: string, label: string, options: MarketOption[], margin: number, hint?: string): MarketTab {
  return { id, label, options, margin, hint };
}

export function marketsFor(match: Match, o: MatchOdds): MarketTab[] {
  const cfg = SPORTS[match.sport];
  const A = match.teamA || "A";
  const B = match.teamB || "B";
  const margin = bettingMargin(match);
  const edge = Math.abs(o.probA - 0.5);

  const tabs: MarketTab[] = [market(match, "winner", cfg.market === "race" ? "Head-to-head" : (cfg.market === "goals" ? "1X2 / vítěz" : "Vítěz zápasu"), winnerOptions(match, o, margin), margin, "Kurz se uzamkne při vsazení")];

  if (["football","eafc","rocketleague","foosball"].includes(match.sport)) {
    const totals = makeOptions([
      { id: "o15", label: "Over 1.5", p: 0.70 }, { id: "u15", label: "Under 1.5", p: 0.30 },
      { id: "o25", label: "Over 2.5", p: 0.54 }, { id: "u25", label: "Under 2.5", p: 0.46 },
      { id: "o35", label: "Over 3.5", p: 0.36 }, { id: "u35", label: "Under 3.5", p: 0.64 },
    ], margin);
    tabs.push(market(match, "totals", "Góly · Over / Under", totals, margin, "Modelový total"));
    tabs.push(market(match, "btts", "Oba dají gól", makeOptions([
      { id: "btts-yes", label: "Ano", side: "a", p: clamp(0.52 + edge * 0.12) },
      { id: "btts-no", label: "Ne", side: "b", p: clamp(0.48 - edge * 0.12) },
    ], margin), margin));
    tabs.push(market(match, "cs", "Přesné skóre", makeOptions([
      { id: "cs-1-0", label: `${A} 1:0`, side: "a", p: 0.11 }, { id: "cs-2-0", label: `${A} 2:0`, side: "a", p: 0.08 },
      { id: "cs-2-1", label: `${A} 2:1`, side: "a", p: 0.10 }, { id: "cs-0-0", label: "0:0", side: "draw", p: 0.07 },
      { id: "cs-0-1", label: `${B} 0:1`, side: "b", p: 0.11 }, { id: "cs-0-2", label: `${B} 0:2`, side: "b", p: 0.08 }, { id: "cs-1-2", label: `${B} 1:2`, side: "b", p: 0.10 },
    ], margin), margin, "Zobrazuje jen nejčastější modelované skóre"));
    tabs.push(market(match, "handicap", "Asijský handicap", makeOptions([
      { id: "spread-a--1.5", label: `${A} −1.5`, side: "a", p: clamp(0.30 + edge * 0.30) },
      { id: "spread-a-+1.5", label: `${A} +1.5`, side: "a", p: clamp(0.65 - edge * 0.10) },
      { id: "spread-b--1.5", label: `${B} −1.5`, side: "b", p: clamp(0.30 - edge * 0.30) },
      { id: "spread-b-+1.5", label: `${B} +1.5`, side: "b", p: clamp(0.65 + edge * 0.10) },
    ], margin), margin));
  }

  if (match.sport === "nhl") {
    tabs.push(market(match, "totals", "Góly · Over / Under", makeOptions([
      { id: "o45", label: "Over 4.5", p: 0.52 }, { id: "u45", label: "Under 4.5", p: 0.48 },
      { id: "o55", label: "Over 5.5", p: 0.43 }, { id: "u55", label: "Under 5.5", p: 0.57 },
    ], margin), margin));
    tabs.push(market(match, "puckline", "Puck line", makeOptions([
      { id: "pl-a-1.5", label: `${A} −1.5`, side: "a", p: clamp(0.34 + edge * 0.25) },
      { id: "pl-a-+1.5", label: `${A} +1.5`, side: "a", p: clamp(0.66 - edge * 0.10) },
      { id: "pl-b-1.5", label: `${B} −1.5`, side: "b", p: clamp(0.34 - edge * 0.25) },
      { id: "pl-b-+1.5", label: `${B} +1.5`, side: "b", p: clamp(0.66 + edge * 0.10) },
    ], margin), margin));
  }

  if (match.sport === "basketball" || match.sport === "nba2k") {
    tabs.push(market(match, "totals", "Celkem bodů", makeOptions([
      { id: "pts-o155.5", label: "Over 155.5", p: 0.52 }, { id: "pts-u155.5", label: "Under 155.5", p: 0.48 },
      { id: "pts-o175.5", label: "Over 175.5", p: 0.40 }, { id: "pts-u175.5", label: "Under 175.5", p: 0.60 },
    ], margin), margin));
    tabs.push(market(match, "handicap", "Spread", makeOptions([
      { id: "hc-a--5.5", label: `${A} −5.5`, side: "a", p: clamp(0.44 + edge * 0.30) },
      { id: "hc-a-+5.5", label: `${A} +5.5`, side: "a", p: clamp(0.56 - edge * 0.20) },
      { id: "hc-b--5.5", label: `${B} −5.5`, side: "b", p: clamp(0.44 - edge * 0.30) },
      { id: "hc-b-+5.5", label: `${B} +5.5`, side: "b", p: clamp(0.56 + edge * 0.20) },
    ], margin), margin));
  }

  if (["tennis","topspin","volleyball","nohejball","padel","pingpong","darts"].includes(match.sport)) {
    const bestOf = ["volleyball","nohejball","darts"].includes(match.sport) ? 3 : 2;
    const exact = bestOf === 2 ? [
      { id: "s-2-0", label: `${A} 2:0`, side: "a" as const, p: clamp(0.34 + edge * 0.28) },
      { id: "s-2-1", label: `${A} 2:1`, side: "a" as const, p: 0.22 },
      { id: "s-1-2", label: `${B} 1:2`, side: "b" as const, p: 0.22 },
      { id: "s-0-2", label: `${B} 0:2`, side: "b" as const, p: clamp(0.34 - edge * 0.28) },
    ] : [
      { id: "s-3-0", label: `${A} 3:0`, side: "a" as const, p: clamp(0.20 + edge * 0.16) },
      { id: "s-3-1", label: `${A} 3:1`, side: "a" as const, p: 0.20 },
      { id: "s-3-2", label: `${A} 3:2`, side: "a" as const, p: 0.14 },
      { id: "s-2-3", label: `${B} 2:3`, side: "b" as const, p: 0.14 },
      { id: "s-1-3", label: `${B} 1:3`, side: "b" as const, p: 0.16 },
      { id: "s-0-3", label: `${B} 0:3`, side: "b" as const, p: clamp(0.16 - edge * 0.16) },
    ];
    tabs.push(market(match, "exact-sets", `Přesný počet ${cfg.setLabel.toLowerCase()}ů`, makeOptions(exact, margin), margin));
    tabs.push(market(match, "set-handicap", "Set handicap", makeOptions([
      { id: "gh-a--1.5", label: `${A} −1.5 ${cfg.setLabel.toLowerCase()}`, side: "a", p: clamp(0.38 + edge * 0.22) },
      { id: "gh-a-+1.5", label: `${A} +1.5 ${cfg.setLabel.toLowerCase()}`, side: "a", p: clamp(0.62 - edge * 0.12) },
      { id: "gh-b--1.5", label: `${B} −1.5 ${cfg.setLabel.toLowerCase()}`, side: "b", p: clamp(0.38 - edge * 0.22) },
      { id: "gh-b-+1.5", label: `${B} +1.5 ${cfg.setLabel.toLowerCase()}`, side: "b", p: clamp(0.62 + edge * 0.12) },
    ], margin), margin));
  }

  return tabs;
}
