import { SPORTS, type Match } from "./matches";
import type { MatchOdds } from "./odds";

export interface MarketOption {
  /** stable id used in the bet note */
  id: string;
  label: string;
  odds: number;
  /** which side of the pari-mutuel pool the bet is settled against */
  side?: "a" | "b";
}

export interface MarketTab {
  id: string;
  label: string;
  hint?: string;
  options: MarketOption[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const inv = (p: number) => r2(1 / Math.min(0.95, Math.max(0.05, p)));

/**
 * Market menu for a match. The winner market settles against the live
 * pari-mutuel pool; the extra markets are recorded on the ticket as a
 * prediction alongside the chosen side.
 */
export function marketsFor(match: Match, o: MatchOdds): MarketTab[] {
  const cfg = SPORTS[match.sport];
  const A = match.teamA || "A";
  const B = match.teamB || "B";
  const edge = Math.abs(o.probA - 0.5);

  const winner: MarketTab = {
    id: "winner",
    label: cfg.market === "race" ? "1. místo" : "Vítěz zápasu",
    hint: "Vyplácí se z poolu",
    options: [
      { id: "win-a", label: A, odds: o.oddsA, side: "a" },
      { id: "win-b", label: B, odds: o.oddsB, side: "b" },
    ],
  };

  const tabs: MarketTab[] = [winner];

  if (cfg.market === "goals") {
    tabs.push(
      {
        id: "totals",
        label: "Počet gólů",
        hint: "Over / Under",
        options: [
          { id: "o25", label: "Over 2.5", odds: inv(0.55), side: o.favourite === "b" ? "b" : "a" },
          { id: "u25", label: "Under 2.5", odds: inv(0.45), side: o.favourite === "b" ? "b" : "a" },
          { id: "o35", label: "Over 3.5", odds: inv(0.38), side: o.favourite === "b" ? "b" : "a" },
          { id: "u35", label: "Under 3.5", odds: inv(0.62), side: o.favourite === "b" ? "b" : "a" },
        ],
      },
      {
        id: "btts",
        label: "Oba dají gól",
        options: [
          { id: "btts-yes", label: "Ano", odds: inv(0.52 - edge * 0.3), side: "a" },
          { id: "btts-no", label: "Ne", odds: inv(0.48 + edge * 0.3), side: "b" },
        ],
      },
      {
        id: "cs",
        label: "Přesné skóre",
        options: [
          { id: "cs-1-0", label: `${A} 1:0`, odds: inv(0.11 + edge * 0.1), side: "a" },
          { id: "cs-2-0", label: `${A} 2:0`, odds: inv(0.09 + edge * 0.1), side: "a" },
          { id: "cs-2-1", label: `${A} 2:1`, odds: inv(0.1), side: "a" },
          { id: "cs-0-1", label: `${B} 0:1`, odds: inv(0.11 - edge * 0.1), side: "b" },
          { id: "cs-0-2", label: `${B} 0:2`, odds: inv(0.09 - edge * 0.1), side: "b" },
          { id: "cs-1-2", label: `${B} 1:2`, odds: inv(0.1), side: "b" },
        ],
      },
    );
  }

  if (cfg.market === "hockey") {
    tabs.push(
      {
        id: "regulation",
        label: "V základní hrací době",
        options: [
          { id: "reg-a", label: A, odds: r2(o.oddsA * 1.25), side: "a" },
          { id: "reg-b", label: B, odds: r2(o.oddsB * 1.25), side: "b" },
        ],
      },
      {
        id: "totals",
        label: "Počet gólů",
        options: [
          { id: "o45", label: "Over 4.5", odds: inv(0.52), side: "a" },
          { id: "u45", label: "Under 4.5", odds: inv(0.48), side: "b" },
          { id: "o55", label: "Over 5.5", odds: inv(0.4), side: "a" },
          { id: "u55", label: "Under 5.5", odds: inv(0.6), side: "b" },
        ],
      },
      {
        id: "puckline",
        label: "Puck line",
        options: [
          { id: "pl-a15", label: `${A} −1.5`, odds: r2(o.oddsA * 1.7), side: "a" },
          { id: "pl-b15", label: `${B} +1.5`, odds: r2(o.oddsB * 0.65), side: "b" },
          { id: "pl-b-15", label: `${B} −1.5`, odds: r2(o.oddsB * 1.7), side: "b" },
          { id: "pl-a+15", label: `${A} +1.5`, odds: r2(o.oddsA * 0.65), side: "a" },
        ],
      },
    );
  }

  if (cfg.market === "points") {
    tabs.push(
      {
        id: "totals",
        label: "Celkem bodů",
        options: [
          { id: "pts-over", label: "Over (nad průměr)", odds: inv(0.5), side: "a" },
          { id: "pts-under", label: "Under (pod průměr)", odds: inv(0.5), side: "b" },
        ],
      },
      {
        id: "handicap",
        label: "Bodový hendikep",
        options: [
          { id: "hc-a5", label: `${A} −5.5`, odds: r2(o.oddsA * 1.45), side: "a" },
          { id: "hc-b5", label: `${B} +5.5`, odds: r2(o.oddsB * 0.72), side: "b" },
          { id: "hc-b-5", label: `${B} −5.5`, odds: r2(o.oddsB * 1.45), side: "b" },
          { id: "hc-a+5", label: `${A} +5.5`, odds: r2(o.oddsA * 0.72), side: "a" },
        ],
      },
    );
  }

  if (cfg.market === "sets") {
    tabs.push(
      {
        id: "exact-sets",
        label: `Přesný počet ${cfg.setLabel.toLowerCase()}ů`,
        options: [
          { id: "s-2-0", label: `${A} 2:0`, odds: inv(0.3 + edge * 0.3), side: "a" },
          { id: "s-2-1", label: `${A} 2:1`, odds: inv(0.22), side: "a" },
          { id: "s-0-2", label: `${B} 0:2`, odds: inv(0.3 - edge * 0.3), side: "b" },
          { id: "s-1-2", label: `${B} 1:2`, odds: inv(0.22), side: "b" },
        ],
      },
      {
        id: "handicap",
        label: "Hendikep",
        options: [
          { id: "gh-a15", label: `${A} −1.5 ${cfg.setLabel.toLowerCase()}`, odds: r2(o.oddsA * 1.6), side: "a" },
          { id: "gh-b15", label: `${B} +1.5 ${cfg.setLabel.toLowerCase()}`, odds: r2(o.oddsB * 0.7), side: "b" },
        ],
      },
    );
  }

  if (cfg.market === "race") {
    tabs.push({
      id: "handicap",
      label: "Hendikep",
      options: [
        { id: "rh-a", label: `${A} −1.5`, odds: r2(o.oddsA * 1.6), side: "a" },
        { id: "rh-b", label: `${B} −1.5`, odds: r2(o.oddsB * 1.6), side: "b" },
      ],
    });
  }

  return tabs;
}
