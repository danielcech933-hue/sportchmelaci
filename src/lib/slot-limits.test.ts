import { describe, expect, test } from "bun:test";
import { getSlotMaxBet, isPrivilegedSlotPlayer } from "./slot-limits";

describe("slot bet limit policy", () => {
  test("high rollers and admins get the extended one-million limit", () => {
    for (const roles of [["high_roller"], ["admin"], ["user", "high_roller"]] as const) {
      expect(isPrivilegedSlotPlayer(roles)).toBe(true);
      expect(getSlotMaxBet(roles)).toBe(1_000_000);
    }
  });

  test("everyone else stays on the classic 500 limit", () => {
    for (const roles of [[], ["user"], ["restricted"], ["case_opener"], null, undefined] as const) {
      expect(isPrivilegedSlotPlayer(roles)).toBe(false);
      expect(getSlotMaxBet(roles)).toBe(500);
    }
  });
});
