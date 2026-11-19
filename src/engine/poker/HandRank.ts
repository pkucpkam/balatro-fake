/**
 * The 12 poker hands, ordered from strongest to weakest.
 * The evaluator picks the FIRST hand in this list that the played cards satisfy.
 */
export const POKER_HANDS = [
  "FLUSH_FIVE",
  "FLUSH_HOUSE",
  "FIVE_OF_A_KIND",
  "STRAIGHT_FLUSH",
  "FOUR_OF_A_KIND",
  "FULL_HOUSE",
  "FLUSH",
  "STRAIGHT",
  "THREE_OF_A_KIND",
  "TWO_PAIR",
  "PAIR",
  "HIGH_CARD",
] as const;

export type PokerHandType = (typeof POKER_HANDS)[number];

export interface HandBaseValues {
  name: string;
  chips: number;
  mult: number;
  /** Added per level above 1 (Planet upgrade). */
  chipsPerLevel: number;
  multPerLevel: number;
  /** Secret hands are hidden in the UI until played once. */
  secret: boolean;
}

export const HAND_BASE: Record<PokerHandType, HandBaseValues> = {
  FLUSH_FIVE: { name: "Flush Five", chips: 160, mult: 16, chipsPerLevel: 50, multPerLevel: 3, secret: true },
  FLUSH_HOUSE: { name: "Flush House", chips: 140, mult: 14, chipsPerLevel: 40, multPerLevel: 4, secret: true },
  FIVE_OF_A_KIND: { name: "Five of a Kind", chips: 120, mult: 12, chipsPerLevel: 35, multPerLevel: 3, secret: true },
  STRAIGHT_FLUSH: { name: "Straight Flush", chips: 100, mult: 8, chipsPerLevel: 40, multPerLevel: 4, secret: false },
  FOUR_OF_A_KIND: { name: "Four of a Kind", chips: 60, mult: 7, chipsPerLevel: 30, multPerLevel: 3, secret: false },
  FULL_HOUSE: { name: "Full House", chips: 40, mult: 4, chipsPerLevel: 25, multPerLevel: 2, secret: false },
  FLUSH: { name: "Flush", chips: 35, mult: 4, chipsPerLevel: 15, multPerLevel: 2, secret: false },
  STRAIGHT: { name: "Straight", chips: 30, mult: 4, chipsPerLevel: 30, multPerLevel: 3, secret: false },
  THREE_OF_A_KIND: { name: "Three of a Kind", chips: 30, mult: 3, chipsPerLevel: 20, multPerLevel: 2, secret: false },
  TWO_PAIR: { name: "Two Pair", chips: 20, mult: 2, chipsPerLevel: 20, multPerLevel: 1, secret: false },
  PAIR: { name: "Pair", chips: 10, mult: 2, chipsPerLevel: 15, multPerLevel: 1, secret: false },
  HIGH_CARD: { name: "High Card", chips: 5, mult: 1, chipsPerLevel: 10, multPerLevel: 1, secret: false },
};

export function handStrength(hand: PokerHandType): number {
  // Higher = stronger.
  return POKER_HANDS.length - POKER_HANDS.indexOf(hand);
}
