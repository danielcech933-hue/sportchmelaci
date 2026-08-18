import { describe, expect, test } from "bun:test";
import { getSlotMaxBet, isPrivilegedSlotPlayer, normalizeSlotPlayerName } from "./slot-limits";

describe("slot bet limit policy", () => {
  test("normalizes Czech casing and whitespace consistently", () => {
    expect(normalizeSlotPlayerName("  ChLaďAr ")).toBe("chlaďar");
    expect(normalizeSlotPlayerName(" MESI ")).toBe("mesi");
  });

  test("privileged players get the extended one-million limit", () => {
    for (const name of ["Danko", "Chlaďar", "Chladar", "Midas", "M1das", "Messi", "Mesi"]) {
      expect(isPrivilegedSlotPlayer(name)).toBe(true);
      expect(getSlotMaxBet(name)).toBe(1_000_000);
    }
  });

  test("standard players stay on the classic 500 limit", () => {
    for (const name of ["Boro", "Kratos", "RandomPlayer", ""]) {
      expect(isPrivilegedSlotPlayer(name)).toBe(false);
      expect(getSlotMaxBet(name)).toBe(500);
    }
  });
});
