import { DEFAULT_RULES, evaluateHand, type EvaluationRules } from "@/engine/poker/HandEvaluator";
import { cards, tokens } from "../helpers";

function evalSpec(spec: string, rules: Partial<EvaluationRules> = {}) {
  const played = cards(spec);
  const result = evaluateHand(played, { ...DEFAULT_RULES, ...rules });
  return {
    ...result,
    scoring: tokens(played, result.scoringCardIds),
    unscored: tokens(played, result.unscoredCardIds),
  };
}

describe("HandEvaluator – the 12 poker hands", () => {
  it.each([
    ["AS AS AS AS AS", "FLUSH_FIVE"],
    ["KH KH KH 4H 4H", "FLUSH_HOUSE"],
    ["7S 7H 7C 7D 7S", "FIVE_OF_A_KIND"],
    ["9C 10C JC QC KC", "STRAIGHT_FLUSH"],
    ["10H JH QH KH AH", "STRAIGHT_FLUSH"], // "Royal Flush" is a Straight Flush
    ["QS QH QC QD 3S", "FOUR_OF_A_KIND"],
    ["5S 5H 5C 9D 9S", "FULL_HOUSE"],
    ["2D 7D 9D JD KD", "FLUSH"],
    ["4S 5H 6C 7D 8S", "STRAIGHT"],
    ["8S 8H 8C 2D KS", "THREE_OF_A_KIND"],
    ["3S 3H JC JD AS", "TWO_PAIR"],
    ["10S 10H 2C 5D 7S", "PAIR"],
    ["2S 5H 9C JD KS", "HIGH_CARD"],
  ])("%s → %s", (spec, expected) => {
    expect(evalSpec(spec).handType).toBe(expected);
  });
});

describe("HandEvaluator – Ace handling", () => {
  it("A-2-3-4-5 is a straight (ace low)", () => {
    expect(evalSpec("AS 2H 3C 4D 5S").handType).toBe("STRAIGHT");
  });
  it("10-J-Q-K-A is a straight (ace high)", () => {
    expect(evalSpec("10S JH QC KD AS").handType).toBe("STRAIGHT");
  });
  it("does not wrap around: Q-K-A-2-3 is not a straight", () => {
    expect(evalSpec("QS KH AC 2D 3S").handType).toBe("HIGH_CARD");
  });
  it("High Card picks the Ace as the scoring card", () => {
    expect(evalSpec("2S 5H AC JD KS").scoring).toEqual(["AC"]);
  });
});

describe("HandEvaluator – scoring cards", () => {
  it("Pair: only the pair scores, kickers don't", () => {
    const r = evalSpec("10S 10H 2C 5D 7S");
    expect(r.scoring).toEqual(["10S", "10H"]);
    expect(r.unscored).toEqual(["2C", "5D", "7S"]);
  });

  it("Two Pair: the four paired cards score, in played order", () => {
    expect(evalSpec("JC 3S AS 3H JD").scoring).toEqual(["JC", "3S", "3H", "JD"]);
  });

  it("Four of a Kind: kicker does not score", () => {
    expect(evalSpec("QS QH 3S QC QD").unscored).toEqual(["3S"]);
  });

  it("Straight / Flush / Full House: all five score", () => {
    for (const spec of ["4S 5H 6C 7D 8S", "2D 7D 9D JD KD", "5S 5H 5C 9D 9S"]) {
      expect(evalSpec(spec).unscored).toEqual([]);
    }
  });

  it("works with fewer than 5 cards", () => {
    expect(evalSpec("KS").handType).toBe("HIGH_CARD");
    expect(evalSpec("KS KH").handType).toBe("PAIR");
    expect(evalSpec("KS KH KD").handType).toBe("THREE_OF_A_KIND");
    expect(evalSpec("KS KH 2D 2C").handType).toBe("TWO_PAIR");
    expect(evalSpec("KS KH KD KC").handType).toBe("FOUR_OF_A_KIND");
  });

  it("4 suited cards are not a flush without Four Fingers", () => {
    expect(evalSpec("2H 5H 9H KH").handType).toBe("HIGH_CARD");
  });

  it("rejects 0 or more than 5 cards", () => {
    expect(() => evaluateHand([])).toThrow();
    expect(() => evaluateHand(cards("2S 3S 4S 5S 6S 7S"))).toThrow();
  });
});

describe("HandEvaluator – overlapping combinations", () => {
  it("Straight Flush beats Flush and Straight", () => {
    const r = evalSpec("5H 6H 7H 8H 9H");
    expect(r.handType).toBe("STRAIGHT_FLUSH");
    expect(r.containedHands).toEqual(expect.arrayContaining(["FLUSH", "STRAIGHT", "HIGH_CARD"]));
  });

  it("Full House contains Three of a Kind, Two Pair and Pair", () => {
    const r = evalSpec("5S 5H 5C 9D 9S");
    expect(r.containedHands).toEqual(["FULL_HOUSE", "THREE_OF_A_KIND", "TWO_PAIR", "PAIR", "HIGH_CARD"]);
  });

  it("Full House in mixed suits is not a Flush House", () => {
    expect(evalSpec("KH KH KH 4H 4S").handType).toBe("FULL_HOUSE");
  });

  it("Five of a Kind not all suited is not a Flush Five", () => {
    expect(evalSpec("7S 7S 7S 7S 7H").handType).toBe("FIVE_OF_A_KIND");
  });

  it("Pair does not contain Two Pair", () => {
    expect(evalSpec("10S 10H 2C 5D 7S").containedHands).not.toContain("TWO_PAIR");
  });
});

describe("HandEvaluator – special cards", () => {
  it("Wild cards count as every suit for a Flush", () => {
    expect(evalSpec("2H 5H 9S* JH KH").handType).toBe("FLUSH");
  });

  it("all-Wild hand is a Flush", () => {
    expect(evalSpec("2S* 5H* 9C* JD* KS*").handType).toBe("FLUSH");
  });

  it("Stone cards have no rank/suit but always score", () => {
    const r = evalSpec("KS KH 2D# 2C#");
    expect(r.handType).toBe("PAIR");
    expect(r.scoring).toEqual(["KS", "KH", "2D#", "2C#"]);
  });

  it("Stone cards break a flush", () => {
    expect(evalSpec("2H 5H 9H JH KH#").handType).toBe("HIGH_CARD");
  });

  it("a hand of only Stone cards is High Card with stones scoring", () => {
    const r = evalSpec("2S# 3S#");
    expect(r.handType).toBe("HIGH_CARD");
    expect(r.scoring).toEqual(["2S#", "3S#"]);
  });

  it("debuffed cards still form hands", () => {
    expect(evalSpec("10S! 10H 2C 5D 7S").handType).toBe("PAIR");
  });
});

describe("HandEvaluator – rule modifiers (Joker hooks)", () => {
  const fourFingers = { flushStraightSize: 4 };

  it("Four Fingers: 4-card flush", () => {
    const r = evalSpec("2H 5H 9H KH 3S", fourFingers);
    expect(r.handType).toBe("FLUSH");
    expect(r.scoring).toEqual(["2H", "5H", "9H", "KH"]);
  });

  it("Four Fingers: 4-card straight", () => {
    const r = evalSpec("5S 6H 7C 8D KS", fourFingers);
    expect(r.handType).toBe("STRAIGHT");
    expect(r.unscored).toEqual(["KS"]);
  });

  it("Four Fingers: straight + flush overlap is a Straight Flush", () => {
    expect(evalSpec("5H 6H 7H 8H KS", fourFingers).handType).toBe("STRAIGHT_FLUSH");
  });

  it("Shortcut: straights may skip one rank", () => {
    expect(evalSpec("2S 4H 6C 8D 10S", { straightMaxGap: 2 }).handType).toBe("STRAIGHT");
    expect(evalSpec("2S 4H 6C 8D 10S").handType).toBe("HIGH_CARD");
    expect(evalSpec("2S 5H 6C 8D 10S", { straightMaxGap: 2 }).handType).toBe("HIGH_CARD");
  });

  it("Splash: every played card scores", () => {
    expect(evalSpec("10S 10H 2C 5D 7S", { allPlayedCardsScore: true }).unscored).toEqual([]);
  });

  it("Smeared: Hearts and Diamonds form a flush together", () => {
    expect(evalSpec("2H 5D 9H JD KH", { smearedSuits: true }).handType).toBe("FLUSH");
    expect(evalSpec("2H 5D 9H JD KH").handType).toBe("HIGH_CARD");
  });
});
