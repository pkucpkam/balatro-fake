import { RANK_VALUE, hasRank, isStone, isWild, type PlayingCard, type Rank, type Suit } from "../cards/Card";
import { POKER_HANDS, type PokerHandType } from "./HandRank";

/**
 * Rule switches that change how hands are recognised.
 * Jokers (Four Fingers, Shortcut, Splash, Smeared…) never touch the evaluator
 * directly: the engine derives an EvaluationRules object from the active
 * modifiers and passes it in. This keeps the evaluator independent of Jokers.
 */
export interface EvaluationRules {
  /** Cards needed for Flush / Straight. 5 normally, 4 with "Four Fingers". */
  flushStraightSize: number;
  /** Max rank gap between consecutive straight cards. 1 normally, 2 with "Shortcut". */
  straightMaxGap: number;
  /** Every played card scores ("Splash"). */
  allPlayedCardsScore: boolean;
  /** Hearts≡Diamonds, Spades≡Clubs ("Smeared"). */
  smearedSuits: boolean;
}

export const DEFAULT_RULES: EvaluationRules = {
  flushStraightSize: 5,
  straightMaxGap: 1,
  allPlayedCardsScore: false,
  smearedSuits: false,
};

export interface PokerHandResult {
  handType: PokerHandType;
  /** Ids of cards that score, in played (left-to-right) order. */
  scoringCardIds: string[];
  /** Played cards that do not score, in played order. */
  unscoredCardIds: string[];
  /**
   * Every hand type contained in the played cards, strongest first.
   * Jokers like "if played hand contains a Pair" read this, not handType.
   */
  containedHands: PokerHandType[];
}

export const MAX_PLAYED_CARDS = 5;

// ---------------------------------------------------------------------------
// Detectors
// ---------------------------------------------------------------------------

interface RankGroup {
  rank: Rank;
  cards: PlayingCard[];
}

/** Rank Counter: groups by rank, largest group first, ties by higher rank. Stone cards excluded. */
export function groupByRank(cards: readonly PlayingCard[]): RankGroup[] {
  const map = new Map<Rank, PlayingCard[]>();
  for (const card of cards) {
    if (!hasRank(card)) continue;
    const list = map.get(card.rank);
    if (list) list.push(card);
    else map.set(card.rank, [card]);
  }
  return [...map.entries()]
    .map(([rank, list]) => ({ rank, cards: list }))
    .sort((a, b) => b.cards.length - a.cards.length || RANK_VALUE[b.rank] - RANK_VALUE[a.rank]);
}

type SuitKey = Suit | "RED" | "BLACK";

function suitKey(suit: Suit, rules: EvaluationRules): SuitKey {
  if (!rules.smearedSuits) return suit;
  return suit === "HEARTS" || suit === "DIAMONDS" ? "RED" : "BLACK";
}

/**
 * Flush Detector. Wild cards count toward every suit; Stone cards toward none.
 * Returns the cards forming the largest qualifying flush, or null.
 */
export function findFlush(cards: readonly PlayingCard[], rules: EvaluationRules): PlayingCard[] | null {
  const candidates = cards.filter((c) => !isStone(c));
  if (candidates.length < rules.flushStraightSize) return null;

  const keys = new Set<SuitKey>();
  for (const c of candidates) if (!isWild(c)) keys.add(suitKey(c.suit, rules));
  // All wild: any suit works.
  if (keys.size === 0) keys.add(suitKey("SPADES", rules));

  let best: PlayingCard[] | null = null;
  for (const key of keys) {
    const members = candidates.filter((c) => isWild(c) || suitKey(c.suit, rules) === key);
    if (members.length >= rules.flushStraightSize && (!best || members.length > best.length)) {
      best = members;
    }
  }
  return best;
}

/**
 * Straight Detector. Ace may be low (A-2-3-4-5) or high (10-J-Q-K-A), no wrap-around.
 * With straightMaxGap = 2 ("Shortcut") ranks may skip one value.
 * Returns all played cards whose rank belongs to the best straight, or null.
 */
export function findStraight(cards: readonly PlayingCard[], rules: EvaluationRules): PlayingCard[] | null {
  const ranked = cards.filter(hasRank);
  if (ranked.length < rules.flushStraightSize) return null;

  // value -> cards with that value. Ace occupies both 1 and 14.
  const byValue = new Map<number, PlayingCard[]>();
  const add = (v: number, c: PlayingCard) => {
    const list = byValue.get(v);
    if (list) list.push(c);
    else byValue.set(v, [c]);
  };
  for (const c of ranked) {
    const v = RANK_VALUE[c.rank];
    add(v, c);
    if (c.rank === "A") add(1, c);
  }

  const values = [...byValue.keys()].sort((a, b) => a - b);

  // Longest chain; ties resolved toward the higher top value (scan order guarantees it).
  let bestChain: number[] = [];
  let chain: number[] = [];
  for (const v of values) {
    const prev = chain[chain.length - 1];
    if (prev !== undefined && v - prev <= rules.straightMaxGap) chain.push(v);
    else chain = [v];
    if (chain.length >= bestChain.length) bestChain = chain.slice();
  }

  if (bestChain.length < rules.flushStraightSize) return null;

  const inChain = new Set<PlayingCard>();
  for (const v of bestChain) for (const c of byValue.get(v) ?? []) inChain.add(c);
  return ranked.filter((c) => inChain.has(c));
}

// ---------------------------------------------------------------------------
// Hand Resolver
// ---------------------------------------------------------------------------

interface Analysis {
  groups: RankGroup[];
  flush: PlayingCard[] | null;
  straight: PlayingCard[] | null;
}

function analyse(cards: readonly PlayingCard[], rules: EvaluationRules): Analysis {
  return {
    groups: groupByRank(cards),
    flush: findFlush(cards, rules),
    straight: findStraight(cards, rules),
  };
}

function fullHouseCards(groups: RankGroup[]): PlayingCard[] | null {
  const three = groups.find((g) => g.cards.length >= 3);
  if (!three) return null;
  const pair = groups.find((g) => g !== three && g.cards.length >= 2);
  if (!pair) return null;
  return [...three.cards, ...pair.cards];
}

function twoPairCards(groups: RankGroup[]): PlayingCard[] | null {
  const pairs = groups.filter((g) => g.cards.length >= 2);
  if (pairs.length < 2) return null;
  return [...(pairs[0] as RankGroup).cards, ...(pairs[1] as RankGroup).cards];
}

function groupOfSize(groups: RankGroup[], n: number): PlayingCard[] | null {
  const g = groups.find((x) => x.cards.length >= n);
  return g ? g.cards : null;
}

function isSubset(sub: readonly PlayingCard[], sup: readonly PlayingCard[]): boolean {
  const s = new Set(sup);
  return sub.every((c) => s.has(c));
}

function union(a: readonly PlayingCard[], b: readonly PlayingCard[]): PlayingCard[] {
  return [...new Set([...a, ...b])];
}

/**
 * For each hand type: the cards that would score if it were the hand,
 * or null if the played cards do not contain it.
 */
function resolveAll(cards: readonly PlayingCard[], a: Analysis): Record<PokerHandType, PlayingCard[] | null> {
  const five = groupOfSize(a.groups, 5);
  const four = groupOfSize(a.groups, 4);
  const three = groupOfSize(a.groups, 3);
  const pair = groupOfSize(a.groups, 2);
  const fullHouse = fullHouseCards(a.groups);
  const twoPair = twoPairCards(a.groups);
  const { flush, straight } = a;

  const highest = cards
    .filter(hasRank)
    .reduce<PlayingCard | null>((best, c) => (!best || RANK_VALUE[c.rank] > RANK_VALUE[best.rank] ? c : best), null);

  return {
    FLUSH_FIVE: five && flush && isSubset(five, flush) ? union(five, flush) : null,
    FLUSH_HOUSE: fullHouse && flush && isSubset(fullHouse, flush) ? union(fullHouse, flush) : null,
    FIVE_OF_A_KIND: five,
    STRAIGHT_FLUSH: straight && flush ? union(straight, flush) : null,
    FOUR_OF_A_KIND: four,
    FULL_HOUSE: fullHouse,
    FLUSH: flush,
    STRAIGHT: straight,
    THREE_OF_A_KIND: three,
    TWO_PAIR: twoPair,
    PAIR: pair,
    // High Card is always "contained"; with only Stone cards nothing scores from it.
    HIGH_CARD: highest ? [highest] : [],
  };
}

/**
 * Evaluate up to 5 played cards.
 * Pure function: same input -> same output, no Joker knowledge.
 */
export function evaluateHand(
  played: readonly PlayingCard[],
  rules: EvaluationRules = DEFAULT_RULES,
): PokerHandResult {
  if (played.length === 0) throw new Error("evaluateHand: no cards played");
  if (played.length > MAX_PLAYED_CARDS) {
    throw new Error(`evaluateHand: at most ${MAX_PLAYED_CARDS} cards, got ${played.length}`);
  }

  const resolved = resolveAll(played, analyse(played, rules));
  const containedHands = POKER_HANDS.filter((h) => resolved[h] !== null);
  const handType = containedHands[0] as PokerHandType; // HIGH_CARD is always present

  // Scoring Card Resolver
  let scoring: Set<PlayingCard>;
  if (rules.allPlayedCardsScore) {
    scoring = new Set(played);
  } else {
    scoring = new Set(resolved[handType] ?? []);
    for (const c of played) if (isStone(c)) scoring.add(c); // Stone cards always score
  }

  return {
    handType,
    scoringCardIds: played.filter((c) => scoring.has(c)).map((c) => c.id),
    unscoredCardIds: played.filter((c) => !scoring.has(c)).map((c) => c.id),
    containedHands,
  };
}
