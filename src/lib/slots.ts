/**
 * CHMELOVCI CUP — slot engine
 * 5 válců × 3 řady, 5 výherních linií, výhry zleva doprava (min. 3 symboly).
 */

export type SymKey =
  | "ten" | "j" | "q" | "k" | "a" | "whistle" | "boots" | "silver" | "gold" | "wild" | "scatter";
export type Tier = "low" | "mid" | "high" | "special";
export interface SymbolDef { key: SymKey; label: string; glyph: string; tier: Tier; pays: [number, number, number]; weight: number; wild?: boolean; scatter?: boolean; }

export const SLOT_SYMBOLS: Record<SymKey, SymbolDef> = {
  ten: { key: "ten", label: "10", glyph: "10", tier: "low", pays: [0.4, 1, 2.5], weight: 16 },
  j: { key: "j", label: "J", glyph: "J", tier: "low", pays: [0.5, 1.2, 3], weight: 15 },
  q: { key: "q", label: "Q", glyph: "Q", tier: "low", pays: [0.6, 1.5, 4], weight: 14 },
  k: { key: "k", label: "K", glyph: "K", tier: "low", pays: [0.8, 2, 5], weight: 13 },
  a: { key: "a", label: "A", glyph: "A", tier: "low", pays: [1, 2.5, 6], weight: 12 },
  whistle: { key: "whistle", label: "Píšťalka", glyph: "📣", tier: "mid", pays: [1.5, 4, 10], weight: 10 },
  boots: { key: "boots", label: "Kopačky v chmelu", glyph: "👟", tier: "mid", pays: [2, 6, 15], weight: 9 },
  silver: { key: "silver", label: "Stříbrný pohár", glyph: "🥈", tier: "high", pays: [5, 15, 40], weight: 6 },
  gold: { key: "gold", label: "Chmelovci Cup", glyph: "🏆", tier: "high", pays: [15, 40, 100], weight: 4 },
  wild: { key: "wild", label: "WILD — zlatý míč", glyph: "⚽", tier: "special", pays: [0, 0, 0], weight: 5, wild: true },
  scatter: { key: "scatter", label: "SCATTER — půllitr", glyph: "🍺", tier: "special", pays: [5, 20, 100], weight: 4, scatter: true },
};
export const SYMBOL_ORDER: SymKey[] = ["gold", "silver", "boots", "whistle", "a", "k", "q", "j", "ten", "wild", "scatter"];
export const BETS = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000, 1000000];
export const STANDARD_MAX_BET = 500;
export const PRIVILEGED_MAX_BET = 1000000;
export const MAX_BET = PRIVILEGED_MAX_BET;
export const START_BALANCE = 10000;
export const REELS = 5;
export const ROWS = 3;
export const PAYLINES: number[][] = [[1,1,1,1,1],[0,0,0,0,0],[2,2,2,2,2],[0,1,2,1,0],[2,1,0,1,2]];
export const PAYLINE_NAMES = ["Střed", "Horní", "Spodní", "V (chmel dolů)", "Λ (chmel nahoru)"];
const WEIGHTED: SymKey[] = (Object.keys(SLOT_SYMBOLS) as SymKey[]).flatMap((k) => Array.from({ length: SLOT_SYMBOLS[k].weight }, () => k));
export function randomSymbol(): SymKey { return WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)]; }
export function makeStrip(len = 24): SymKey[] { return Array.from({ length: len }, randomSymbol); }
export type Grid = SymKey[][];
export function spinGrid(): Grid { return Array.from({ length: REELS }, () => Array.from({ length: ROWS }, randomSymbol)); }
export interface LineWin { line: number; symbol: SymKey; count: number; amount: number; cells: [number, number][]; }
export interface SpinResult { lineWins: LineWin[]; scatterCount: number; scatterAmount: number; scatterCells: [number, number][]; total: number; multiplierOfBet: number; freeSpinsTriggered: boolean; }
export function evaluateSpin(grid: Grid, bet: number, globalMultiplier = 1): SpinResult {
  const lineWins: LineWin[] = [];
  PAYLINES.forEach((pattern, lineIdx) => {
    const seq = pattern.map((row, reel) => grid[reel][row]);
    let base: SymKey | null = null;
    for (const s of seq) { if (!SLOT_SYMBOLS[s].wild) { base = s; break; } }
    if (!base || SLOT_SYMBOLS[base].scatter) return;
    let count = 0; const cells: [number, number][] = [];
    for (let reel = 0; reel < REELS; reel++) { const s = seq[reel]; if (s === base || SLOT_SYMBOLS[s].wild) { count++; cells.push([reel, pattern[reel]]); } else break; }
    if (count < 3) return;
    const pay = SLOT_SYMBOLS[base].pays[count - 3];
    if (pay <= 0) return;
    lineWins.push({ line: lineIdx, symbol: base, count, amount: pay * bet * globalMultiplier, cells });
  });
  const scatterCells: [number, number][] = [];
  grid.forEach((col, reel) => col.forEach((s, row) => { if (SLOT_SYMBOLS[s].scatter) scatterCells.push([reel, row]); }));
  const scatterCount = scatterCells.length;
  const scatterAmount = scatterCount >= 3 ? SLOT_SYMBOLS.scatter.pays[Math.min(scatterCount, 5) - 3] * bet * globalMultiplier : 0;
  const total = lineWins.reduce((a, w) => a + w.amount, 0) + scatterAmount;
  return { lineWins, scatterCount, scatterAmount, scatterCells, total, multiplierOfBet: bet > 0 ? total / bet : 0, freeSpinsTriggered: scatterCount >= 3 };
}
export function hasAnticipation(grid: Grid): boolean { const has = (reel: number) => grid[reel].some((s) => SLOT_SYMBOLS[s].scatter); return has(0) && has(1); }

export interface HofEntry { name: string; multiplier: number; spins?: number; bestWin?: number; }
const HOF_KEY = "chmelovci-cup-hof-v1";
export function loadBestMultiplier(): number { if (typeof window === "undefined") return 0; const raw = window.localStorage.getItem(HOF_KEY); const n = raw ? Number(raw) : 0; return Number.isFinite(n) ? n : 0; }
export function saveBestMultiplier(m: number): number { if (typeof window === "undefined") return m; const best = Math.max(loadBestMultiplier(), m); window.localStorage.setItem(HOF_KEY, String(best)); return best; }
export function hofFlame(m: number): string { if (m >= 100) return "🚀"; if (m >= 50) return "🔥"; if (m >= 20) return "⚡"; if (m >= 5) return "🍺"; return "🌱"; }
export function formatKc(n: number): string { return `${Math.round(n).toLocaleString("cs-CZ")} Kč`; }
