import { evaluateHand } from "@/engine/poker/HandEvaluator";
import { createInitialHandLevels, getHandValues, levelUpHand } from "@/engine/poker/HandLevels";
import { HAND_BASE, POKER_HANDS } from "@/engine/poker/HandRank";
import { scoreBasic } from "@/engine/poker/HandScorer";
import { PLANETS } from "@/content/planets/planets";
import { cards } from "../helpers";

function score(spec: string, levels = createInitialHandLevels()) {
  const played = cards(spec);
  return scoreBasic(evaluateHand(played), played, levels);
}

describe("Basic scoring (no Jokers)", () => {
  it("Pair of Aces: (10 + 11 + 11) × 2 = 64", () => {
    const s = score("AS AH 2C 5D 7S");
    expect(s.chips).toBe(32);
    expect(s.mult).toBe(2);
    expect(s.score).toBe(64);
  });

  it("face cards are worth 10 chips", () => {
    // Straight 30×4, cards 9+10+10+10+10 = 49 → 79 × 4
    expect(score("9C 10D JH QS KC").score).toBe(79 * 4);
  });

  it("Flush: 35 + (2+7+9+10+10) = 73, × 4 = 292", () => {
    expect(score("2D 7D 9D JD KD").score).toBe(292);
  });

  it("Stone cards add 50 chips", () => {
    // High card on K? No ranked cards except K: 5 + 10 + 50 = 65 × 1
    expect(score("KS 2D#").score).toBe(65);
  });

  it("debuffed scoring cards contribute 0 chips", () => {
    expect(score("AS! AH").chips).toBe(10 + 0 + 11);
  });
});

describe("Hand levels / Planets", () => {
  it("every hand starts at level 1 with its base values", () => {
    const levels = createInitialHandLevels();
    for (const hand of POKER_HANDS) {
      expect(getHandValues(levels, hand)).toEqual({ chips: HAND_BASE[hand].chips, mult: HAND_BASE[hand].mult });
    }
  });

  it("level up adds per-level chips and mult", () => {
    const levels = createInitialHandLevels();
    levelUpHand(levels, "FLUSH");
    levelUpHand(levels, "FLUSH");
    expect(getHandValues(levels, "FLUSH")).toEqual({ chips: 35 + 30, mult: 4 + 4 });
  });

  it("a leveled Pair scores more", () => {
    const levels = createInitialHandLevels();
    levelUpHand(levels, "PAIR");
    // (25 + 22) × 3
    expect(score("AS AH", levels).score).toBe(47 * 3);
  });

  it("level never drops below 1", () => {
    const levels = createInitialHandLevels();
    levelUpHand(levels, "PAIR", -5);
    expect(levels.PAIR.level).toBe(1);
  });

  it("there is exactly one Planet per poker hand", () => {
    expect(new Set(PLANETS.map((p) => p.hand)).size).toBe(POKER_HANDS.length);
    expect(PLANETS).toHaveLength(12);
  });
});
