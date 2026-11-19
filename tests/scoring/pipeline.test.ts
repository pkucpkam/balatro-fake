import { produce } from "immer";
import { GameEngine } from "@/engine/core/GameEngine";
import { deriveRules } from "@/engine/core/GameReducer";
import type { GameEvent } from "@/engine/core/GameEvent";
import type { GameState, JokerInstance } from "@/engine/core/GameState";
import type { PlayingCard } from "@/engine/cards/Card";
import { cards } from "../helpers";

let jid = 0;
const joker = (defId: string, extra: Partial<JokerInstance> = {}): JokerInstance => ({
  id: `jt-${++jid}`,
  defId,
  counter: 0,
  sellValue: 2,
  ...extra,
});

/** A started run whose hand is exactly `hand` (played ones first) with the given jokers. */
function setup(hand: PlayingCard[], jokers: JokerInstance[] = [], patch?: (s: GameState) => void) {
  const e = new GameEngine();
  e.dispatch({ type: "START_RUN", seed: "PIPE" });
  e.dispatch({ type: "SELECT_BLIND" });
  const state = produce(e.state, (d) => {
    d.deck.hand = hand;
    d.jokers = jokers;
    d.rules = deriveRules(jokers);
    d.round.targetScore = 1e9;
    patch?.(d as GameState);
  });
  return new GameEngine(state);
}

function play(engine: GameEngine, n: number) {
  const ids = engine.state.deck.hand.slice(0, n).map((c) => c.id);
  const events = engine.dispatch({ type: "PLAY_HAND", cardIds: ids });
  const fin = events.find((x): x is Extract<GameEvent, { type: "SCORE_FINALIZED" }> => x.type === "SCORE_FINALIZED")!;
  return { events, fin };
}

describe("Scoring pipeline", () => {
  it("plain Pair of Kings = (10 + 10 + 10) × 2", () => {
    expect(play(setup(cards("KS KH 2C")), 2).fin.score).toBe(60);
  });

  it("Joker adds +4 Mult", () => {
    expect(play(setup(cards("KS KH 2C"), [joker("joker")]), 2).fin.score).toBe(30 * 6);
  });

  it("joker order matters: +Mult before XMult is better", () => {
    const a = play(setup(cards("KS KH"), [joker("joker"), joker("duo")]), 2).fin.score;
    const b = play(setup(cards("KS KH"), [joker("duo"), joker("joker")]), 2).fin.score;
    expect(a).toBe(30 * (2 + 4) * 2);
    expect(b).toBe(30 * (2 * 2 + 4));
  });

  it("Red Seal retriggers the card", () => {
    const hand = cards("KS KH");
    hand[0]!.seal = "RED";
    const { fin, events } = play(setup(hand), 2);
    expect(fin.chips).toBe(10 + 10 + 10 + 10);
    expect(events.some((e) => e.type === "SCORE_STEP" && e.kind === "RETRIGGER")).toBe(true);
  });

  it("Hanging Chad retriggers only the first scoring card, along with joker on-score effects", () => {
    const { fin } = play(setup(cards("KS KH"), [joker("hanging_chad"), joker("scary_face")]), 2);
    // base 10 + K(10+30) ×2 triggers + K(10+30)
    expect(fin.chips).toBe(10 + 40 * 2 + 40);
  });

  it("Steel card held gives X1.5 and Mime retriggers it", () => {
    const hand = cards("KS KH 2C");
    hand[2]!.enhancement = "STEEL";
    expect(play(setup(hand), 2).fin.score).toBe(Math.floor(30 * 2 * 1.5));
    const hand2 = cards("KS KH 2C");
    hand2[2]!.enhancement = "STEEL";
    expect(play(setup(hand2, [joker("mime")]), 2).fin.score).toBe(Math.floor(30 * 2 * 1.5 * 1.5));
  });

  it("Baron: each held King X1.5", () => {
    expect(play(setup(cards("2S 2H KC KD"), [joker("baron")]), 2).fin.mult).toBeCloseTo(2 * 1.5 * 1.5);
  });

  it("enhancements and editions on played cards", () => {
    const hand = cards("KS KH");
    hand[0]!.enhancement = "BONUS";
    hand[1]!.enhancement = "MULT";
    hand[1]!.edition = "POLYCHROME";
    const { fin } = play(setup(hand), 2);
    expect(fin.chips).toBe(10 + 10 + 30 + 10);
    expect(fin.mult).toBeCloseTo((2 + 4) * 1.5);
  });

  it("Gold Seal pays money when scored", () => {
    const hand = cards("AS");
    hand[0]!.seal = "GOLD";
    const e = setup(hand);
    const before = e.state.player.money;
    play(e, 1);
    expect(e.state.player.money).toBe(before + 3);
  });

  it("debuffed cards score nothing but still form the hand", () => {
    const { fin, events } = play(setup(cards("KS! KH")), 2);
    expect(fin.chips).toBe(10 + 10);
    expect(events.some((e) => e.type === "SCORE_STEP" && e.kind === "DEBUFFED")).toBe(true);
  });

  it("Green Joker grows per hand and shrinks per discard", () => {
    const e = setup(cards("2S 3H 4C 5D 7S 8H 9C 10D"), [joker("green_joker")]);
    play(e, 1);
    expect(e.state.jokers[0]!.counter).toBe(1);
    e.dispatch({ type: "DISCARD", cardIds: [e.state.deck.hand[0]!.id] });
    expect(e.state.jokers[0]!.counter).toBe(0);
  });

  it("Four Fingers allows a 4-card flush", () => {
    const { events } = play(setup(cards("2H 5H 9H KH 3S"), [joker("four_fingers")]), 4);
    const ev = events.find((x) => x.type === "HAND_EVALUATED");
    expect(ev && ev.type === "HAND_EVALUATED" && ev.handType).toBe("FLUSH");
  });

  it("running totals in SCORE_STEP end at the final chips/mult", () => {
    const { events, fin } = play(setup(cards("KS KH"), [joker("joker"), joker("duo")]), 2);
    const steps = events.filter((x) => x.type === "SCORE_STEP");
    const last = steps[steps.length - 1]!;
    expect(last.type === "SCORE_STEP" && [last.chips, last.mult]).toEqual([fin.chips, fin.mult]);
  });
});

describe("Boss blinds", () => {
  it("The Flint halves base chips and mult", () => {
    const e = setup(cards("KS KH"), [], (s) => {
      s.round.bossId = "the_flint";
    });
    expect(play(e, 2).fin.score).toBe((5 + 20) * 1);
  });

  it("The Psychic blocks hands with fewer than 5 cards", () => {
    const e = setup(cards("KS KH 2C 3D 4S 9H"), [], (s) => {
      s.round.bossId = "the_psychic";
    });
    expect(play(e, 2).fin.score).toBe(0);
  });

  it("The Eye blocks a repeated hand type", () => {
    const e = setup(cards("KS KH QS QH 2C 3D 4S 9H"), [], (s) => {
      s.round.bossId = "the_eye";
    });
    expect(play(e, 2).fin.score).toBeGreaterThan(0);
    const ids = e.state.deck.hand.filter((c) => c.rank === "Q").slice(0, 2).map((c) => c.id);
    const ev = e.dispatch({ type: "PLAY_HAND", cardIds: ids });
    expect(ev.find((x) => x.type === "SCORE_FINALIZED")).toMatchObject({ score: 0 });
  });
});
