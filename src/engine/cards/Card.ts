export const SUITS = ["SPADES", "HEARTS", "CLUBS", "DIAMONDS"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;
export type Rank = (typeof RANKS)[number];

export type EnhancementType =
  | "BONUS"
  | "MULT"
  | "WILD"
  | "GLASS"
  | "STEEL"
  | "STONE"
  | "GOLD"
  | "LUCKY";

export type EditionType = "FOIL" | "HOLOGRAPHIC" | "POLYCHROME" | "NEGATIVE";

export type SealType = "GOLD" | "RED" | "BLUE" | "PURPLE";

export interface PlayingCard {
  /** Unique per physical card in this run. Never reused. */
  readonly id: string;
  suit: Suit;
  rank: Rank;

  enhancement?: EnhancementType;
  edition?: EditionType;
  seal?: SealType;

  /** Extra chips permanently added (e.g. by Hiker-style effects). */
  bonusChips: number;
  debuffed: boolean;
}

/** Numeric value used for ordering and straights. Ace high = 14. */
export const RANK_VALUE: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

/** Base chip value of a card when it scores. */
export const RANK_CHIPS: Record<Rank, number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 10,
  Q: 10,
  K: 10,
  A: 11,
};

export const STONE_CARD_CHIPS = 50;

export const FACE_RANKS: ReadonlySet<Rank> = new Set<Rank>(["J", "Q", "K"]);

export function isStone(card: PlayingCard): boolean {
  return card.enhancement === "STONE";
}

export function isWild(card: PlayingCard): boolean {
  return card.enhancement === "WILD";
}

/** Stone cards have no rank for hand purposes. */
export function hasRank(card: PlayingCard): boolean {
  return !isStone(card);
}

export function createCard(
  id: string,
  rank: Rank,
  suit: Suit,
  extra: Partial<Omit<PlayingCard, "id" | "rank" | "suit">> = {},
): PlayingCard {
  return { id, rank, suit, bonusChips: 0, debuffed: false, ...extra };
}

const SUIT_SYMBOL: Record<Suit, string> = {
  SPADES: "♠",
  HEARTS: "♥",
  CLUBS: "♣",
  DIAMONDS: "♦",
};

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOL[suit];
}

export function cardLabel(card: PlayingCard): string {
  if (isStone(card)) return "Stone";
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}
