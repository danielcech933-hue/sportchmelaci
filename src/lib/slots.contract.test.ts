import { describe, expect, test } from "bun:test";
import { PAYLINES, REELS, ROWS, SLOT_SYMBOLS, evaluateSpin, type Grid } from "@/lib/slots";

function gridOf(symbol: keyof typeof SLOT_SYMBOLS): Grid {
  return Array.from({ length: REELS }, () => Array.from({ length: ROWS }, () => symbol));
}

function withLine(symbol: keyof typeof SLOT_SYMBOLS, line: number, count: number, filler: keyof typeof SLOT_SYMBOLS = "ten"): Grid {
  const grid = gridOf(filler);
  const pattern = PAYLINES[line];
  for (let reel = 0; reel < count; reel++) grid[reel][pattern[reel]] = symbol;
  return grid;
}

describe("Chmelovci Cup slot contract", () => {
  test("uses a strict 5x3 grid", () => {
    const grid = gridOf("ten");
    expect(grid).toHaveLength(5);
    expect(grid.every((column) => column.length === 3)).toBe(true);
  });

  test("pays three, four and five matching symbols from left to right", () => {
    expect(evaluateSpin(withLine("gold", 0, 3), 10).lineWins.some((win) => win.symbol === "gold" && win.count === 3 && win.amount === 150)).toBe(true);
    expect(evaluateSpin(withLine("gold", 0, 4), 10).lineWins.some((win) => win.symbol === "gold" && win.count === 4 && win.amount === 400)).toBe(true);
    expect(evaluateSpin(withLine("gold", 0, 5), 10).lineWins.some((win) => win.symbol === "gold" && win.count === 5 && win.amount === 1000)).toBe(true);
  });

  test("wild substitutes for a normal symbol but all-wild does not invent a base symbol", () => {
    const grid = withLine("gold", 0, 3);
    grid[1][1] = "wild";
    expect(evaluateSpin(grid, 10).lineWins.some((win) => win.symbol === "gold" && win.count === 3)).toBe(true);

    const allWild = gridOf("wild");
    expect(evaluateSpin(allWild, 10).lineWins).toHaveLength(0);
  });

  test("scatter pays 3/4/5+ symbols", () => {
    const three = gridOf("ten");
    three[0][0] = "scatter";
    three[1][0] = "scatter";
    three[2][0] = "scatter";
    expect(evaluateSpin(three, 10).scatterAmount).toBe(50);

    const four = gridOf("ten");
    for (let i = 0; i < 4; i++) four[i][0] = "scatter";
    expect(evaluateSpin(four, 10).scatterAmount).toBe(200);

    const six = gridOf("ten");
    for (let i = 0; i < 6; i++) six[Math.floor(i / 3)][i % 3] = "scatter";
    expect(evaluateSpin(six, 10).scatterAmount).toBe(1000);
  });

  test("bonus multiplier applies to line and scatter payouts", () => {
    const grid = withLine("gold", 0, 3);
    const result = evaluateSpin(grid, 10, 2);
    expect(result.lineWins[0]?.amount).toBe(300);
    expect(result.multiplierOfBet).toBe(30);
  });

  test("anticipation requires scatters on reels 1 and 2", () => {
    const grid = gridOf("ten");
    grid[0][0] = "scatter";
    grid[1][1] = "scatter";
    expect(evaluateSpin(grid, 10).scatterCount).toBe(2);
  });
});
