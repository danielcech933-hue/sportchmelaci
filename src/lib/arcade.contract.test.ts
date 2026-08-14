import { describe, expect, test } from "bun:test";
import { arcadeRank, RARITY_META } from "./arcade";

describe("arcade contracts", () => {
  test("rank thresholds are monotonic", () => {
    expect(arcadeRank(0).label).toBe("Rookie");
    expect(arcadeRank(299).label).toBe("Rookie");
    expect(arcadeRank(300).label).toBe("Bronze Bot");
    expect(arcadeRank(700).label).toBe("Silver Sprinter");
    expect(arcadeRank(1200).label).toBe("Gold Glitch");
    expect(arcadeRank(2000).label).toBe("Neon Legend");
  });

  test("rarity probabilities are exposed for every supported rarity", () => {
    expect(Object.keys(RARITY_META)).toEqual(["common", "rare", "epic", "legendary"]);
    expect(RARITY_META.common.chance).toBe("60 %");
    expect(RARITY_META.legendary.chance).toBe("3 %");
  });
});
