import { isFace, type PlayingCard, type Suit } from "@/engine/cards/Card";

export interface BossDefinition {
  id: string;
  name: string;
  description: string;
  /** Colour hue for UI theming. */
  hue: number;
  minAnte: number;
  /** Multiplier on the ante base score (default 2). */
  scoreMult?: number;
  debuff?(card: PlayingCard): boolean;
  hands?: number;
  discards?: number;
  handSizeDelta?: number;
  mustPlayFive?: boolean;
  halveBase?: boolean;
  /** Discard N random cards from hand after every hand played. */
  hookDiscard?: number;
  /** Lower played hand level by 1 before scoring. */
  lowersLevel?: boolean;
  /** No repeat hand types this round. */
  noRepeatHands?: boolean;
  /** Only one hand type allowed this round. */
  singleHandType?: boolean;
}

const suitBoss = (id: string, name: string, suit: Suit, symbol: string, hue: number): BossDefinition => ({
  id,
  name,
  hue,
  minAnte: 1,
  description: `All ${symbol} cards are debuffed`,
  debuff: (c) => c.enhancement !== "STONE" && c.suit === suit,
});

export const BOSSES: readonly BossDefinition[] = [
  suitBoss("the_club", "The Club", "CLUBS", "♣", 140),
  suitBoss("the_goad", "The Goad", "SPADES", "♠", 300),
  suitBoss("the_window", "The Window", "DIAMONDS", "♦", 40),
  suitBoss("the_head", "The Head", "HEARTS", "♥", 340),
  { id: "the_hook", name: "The Hook", hue: 0, minAnte: 1, description: "Discards 2 random cards held in hand after every played hand", hookDiscard: 2 },
  { id: "the_psychic", name: "The Psychic", hue: 50, minAnte: 1, description: "Must play 5 cards", mustPlayFive: true },
  { id: "the_manacle", name: "The Manacle", hue: 220, minAnte: 1, description: "-1 hand size", handSizeDelta: -1 },
  { id: "the_wall", name: "The Wall", hue: 270, minAnte: 2, description: "Extra large blind", scoreMult: 4 },
  { id: "the_needle", name: "The Needle", hue: 100, minAnte: 2, description: "Play only 1 hand", hands: 1, scoreMult: 1 },
  { id: "the_water", name: "The Water", hue: 195, minAnte: 2, description: "Start with 0 discards", discards: 0 },
  { id: "the_flint", name: "The Flint", hue: 20, minAnte: 2, description: "Base Chips and Mult are halved", halveBase: true },
  { id: "the_arm", name: "The Arm", hue: 240, minAnte: 2, description: "Decrease level of played poker hand", lowersLevel: true },
  { id: "the_mouth", name: "The Mouth", hue: 320, minAnte: 2, description: "Play only 1 hand type this round", singleHandType: true },
  { id: "the_eye", name: "The Eye", hue: 210, minAnte: 3, description: "No repeat hand types this round", noRepeatHands: true },
  { id: "the_plant", name: "The Plant", hue: 110, minAnte: 4, description: "All face cards are debuffed", debuff: isFace },
];

export const BOSS_REGISTRY: Readonly<Record<string, BossDefinition>> = Object.fromEntries(BOSSES.map((b) => [b.id, b]));
