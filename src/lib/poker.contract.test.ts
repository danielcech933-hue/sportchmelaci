import { describe, expect, test } from "bun:test";
import { evaluate7, startHand, type Card } from "./poker";

const c = (r: number, s: Card["s"]): Card => ({ r, s });

describe("poker contract", () => {
  test("evaluates a straight flush above four of a kind", () => {
    const straightFlush = evaluate7([
      c(10, "h"), c(11, "h"), c(12, "h"), c(13, "h"), c(14, "h"), c(2, "c"), c(2, "d"),
    ]);
    const quads = evaluate7([
      c(9, "h"), c(9, "d"), c(9, "c"), c(9, "s"), c(14, "h"), c(2, "c"), c(3, "d"),
    ]);

    expect(straightFlush.label).toBe("Straight flush");
    expect(quads.label).toBe("Čtyřice");
    expect(straightFlush.score).toBeGreaterThan(quads.score);
  });

  test("evaluates wheel straight correctly", () => {
    const wheel = evaluate7([
      c(14, "s"), c(2, "h"), c(3, "d"), c(4, "c"), c(5, "s"), c(13, "h"), c(9, "d"),
    ]);

    expect(wheel.label).toBe("Straight");
  });

  test("starts a bounded hold'em hand with blinds and a turn", () => {
    const hand = startHand(
      [
        { userId: "u1", nickname: "A", chips: 1000 },
        { userId: "u2", nickname: "B", chips: 1000 },
        { userId: "u3", nickname: "C", chips: 1000 },
      ],
      0,
      10,
    );

    expect(hand.players).toHaveLength(3);
    expect(hand.stage).toBe("preflop");
    expect(hand.currentBet).toBe(20);
    expect(hand.pot).toBe(0);
    expect(hand.deck).toHaveLength(52);
    expect(hand.players.filter((p) => p.bet > 0)).toHaveLength(2);
  });
});
