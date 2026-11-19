import {
  allCards,
  createStandardDeck,
  discardFromHand,
  drawToHandSize,
  emptyDeckState,
  resetAndShuffle,
} from "@/engine/deck/Deck";
import { SeededRng } from "@/engine/rng/SeededRng";

function freshDeck(seed = "deck") {
  const deck = emptyDeckState();
  deck.drawPile = createStandardDeck({ next: 0 });
  resetAndShuffle(deck, SeededRng.fromSeed(seed));
  return deck;
}

describe("Deck", () => {
  it("creates 52 unique cards: 13 ranks × 4 suits", () => {
    const cards = createStandardDeck({ next: 0 });
    expect(cards).toHaveLength(52);
    expect(new Set(cards.map((c) => c.id)).size).toBe(52);
    expect(new Set(cards.map((c) => `${c.rank}${c.suit}`)).size).toBe(52);
  });

  it("shuffles deterministically by seed", () => {
    const order = (seed: string) => freshDeck(seed).drawPile.map((c) => `${c.rank}${c.suit}`);
    expect(order("x")).toEqual(order("x"));
    expect(order("x")).not.toEqual(order("y"));
  });

  it("draws up to hand size", () => {
    const deck = freshDeck();
    const drawn = drawToHandSize(deck, 8);
    expect(drawn).toHaveLength(8);
    expect(deck.hand).toHaveLength(8);
    expect(deck.drawPile).toHaveLength(44);
    expect(drawToHandSize(deck, 8)).toHaveLength(0);
  });

  it("stops drawing when the draw pile is empty", () => {
    const deck = freshDeck();
    drawToHandSize(deck, 60);
    expect(deck.hand).toHaveLength(52);
    expect(deck.drawPile).toHaveLength(0);
  });

  it("discards selected cards and keeps every card in exactly one zone", () => {
    const deck = freshDeck();
    drawToHandSize(deck, 8);
    const ids = deck.hand.slice(0, 3).map((c) => c.id);
    discardFromHand(deck, ids);
    expect(deck.hand).toHaveLength(5);
    expect(deck.discardPile.map((c) => c.id)).toEqual(ids);
    drawToHandSize(deck, 8);
    const everything = allCards(deck);
    expect(everything).toHaveLength(52);
    expect(new Set(everything.map((c) => c.id)).size).toBe(52);
  });

  it("throws when discarding a card not in hand", () => {
    const deck = freshDeck();
    drawToHandSize(deck, 8);
    expect(() => discardFromHand(deck, ["nope"])).toThrow();
  });

  it("resetAndShuffle gathers all zones back into the draw pile", () => {
    const deck = freshDeck();
    drawToHandSize(deck, 8);
    discardFromHand(deck, [deck.hand[0]!.id]);
    resetAndShuffle(deck, SeededRng.fromSeed("again"));
    expect(deck.drawPile).toHaveLength(52);
    expect(deck.hand).toHaveLength(0);
    expect(deck.discardPile).toHaveLength(0);
  });
});
