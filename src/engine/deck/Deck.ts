import { RANKS, SUITS, createCard, type PlayingCard } from "../cards/Card";
import type { SeededRng } from "../rng/SeededRng";

/**
 * Card zones during a round. Every card in the run lives in exactly one zone,
 * which makes invariants (no duplicates, no lost cards) easy to test.
 */
export interface DeckState {
  /** Top of the draw pile is the END of the array (pop is O(1)). */
  drawPile: PlayingCard[];
  hand: PlayingCard[];
  /** Cards played this round (after scoring). */
  played: PlayingCard[];
  discardPile: PlayingCard[];
}

export interface IdCounter {
  next: number;
}

export function nextCardId(counter: IdCounter): string {
  const id = `card-${counter.next}`;
  counter.next += 1;
  return id;
}

/** 52-card standard deck in canonical order (unshuffled). */
export function createStandardDeck(counter: IdCounter): PlayingCard[] {
  const cards: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push(createCard(nextCardId(counter), rank, suit));
    }
  }
  return cards;
}

export function emptyDeckState(): DeckState {
  return { drawPile: [], hand: [], played: [], discardPile: [] };
}

/** Collect every card from every zone (the full deck the player owns). */
export function allCards(deck: DeckState): PlayingCard[] {
  return [...deck.drawPile, ...deck.hand, ...deck.played, ...deck.discardPile];
}

/** Start of a round: gather all cards back and shuffle into the draw pile. */
export function resetAndShuffle(deck: DeckState, rng: SeededRng): void {
  const cards = allCards(deck);
  deck.hand = [];
  deck.played = [];
  deck.discardPile = [];
  deck.drawPile = rng.shuffle(cards);
}

/**
 * Draw until hand has `handSize` cards or the draw pile is empty.
 * Returns the drawn cards in draw order.
 */
export function drawToHandSize(deck: DeckState, handSize: number): PlayingCard[] {
  const drawn: PlayingCard[] = [];
  while (deck.hand.length < handSize && deck.drawPile.length > 0) {
    const card = deck.drawPile.pop() as PlayingCard;
    deck.hand.push(card);
    drawn.push(card);
  }
  return drawn;
}

/**
 * Remove the given cards from hand, preserving the order of `cardIds`.
 * Throws if any id is not in hand — callers validate first.
 */
export function takeFromHand(deck: DeckState, cardIds: readonly string[]): PlayingCard[] {
  const taken: PlayingCard[] = [];
  for (const id of cardIds) {
    const idx = deck.hand.findIndex((c) => c.id === id);
    if (idx < 0) throw new Error(`Card ${id} is not in hand`);
    taken.push(deck.hand[idx] as PlayingCard);
    deck.hand.splice(idx, 1);
  }
  return taken;
}

export function discardFromHand(deck: DeckState, cardIds: readonly string[]): PlayingCard[] {
  const cards = takeFromHand(deck, cardIds);
  deck.discardPile.push(...cards);
  return cards;
}
