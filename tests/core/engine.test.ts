import { GameEngine } from "@/engine/core/GameEngine";
import { InvalidActionError, reduce, createMenuState } from "@/engine/core/GameReducer";
import type { GameAction } from "@/engine/core/GameAction";
import type { GameState } from "@/engine/core/GameState";
import { allCards } from "@/engine/deck/Deck";
import { SeededRng } from "@/engine/rng/SeededRng";
import { PLANETS } from "@/content/planets/planets";

function started(seed = "TEST") {
  const engine = new GameEngine();
  engine.dispatch({ type: "START_RUN", seed });
  return engine;
}

function assertInvariants(state: GameState) {
  const everything = allCards(state.deck);
  expect(everything).toHaveLength(52);
  expect(new Set(everything.map((c) => c.id)).size).toBe(52);
  expect(state.player.handsRemaining).toBeGreaterThanOrEqual(0);
  expect(state.player.discardsRemaining).toBeGreaterThanOrEqual(0);
  expect(state.player.money).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(state.round.currentScore)).toBe(true);
  if (state.status === "PLAYING") {
    expect(state.deck.hand.length).toBeLessThanOrEqual(state.player.handSize);
  }
}

describe("GameEngine – run lifecycle", () => {
  it("START_RUN deals 8 cards at Ante 1 Small Blind (300)", () => {
    const engine = started();
    const s = engine.state;
    expect(s.status).toBe("PLAYING");
    expect(s.deck.hand).toHaveLength(8);
    expect(s.deck.drawPile).toHaveLength(44);
    expect(s.round.targetScore).toBe(300);
    expect(s.player).toMatchObject({ money: 4, handsRemaining: 4, discardsRemaining: 3 });
    assertInvariants(s);
  });

  it("PLAY_HAND scores, uses a hand and refills to hand size", () => {
    const engine = started();
    const ids = engine.state.deck.hand.slice(0, 2).map((c) => c.id);
    const events = engine.dispatch({ type: "PLAY_HAND", cardIds: ids });
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("HAND_PLAYED");
    expect(types).toContain("HAND_EVALUATED");
    expect(types).toContain("SCORE_FINALIZED");
    expect(engine.state.round.currentScore).toBeGreaterThan(0);
    expect(engine.state.player.handsRemaining).toBe(3);
    expect(engine.state.deck.hand).toHaveLength(8);
    assertInvariants(engine.state);
  });

  it("DISCARD uses a discard and refills", () => {
    const engine = started();
    const ids = engine.state.deck.hand.slice(0, 5).map((c) => c.id);
    engine.dispatch({ type: "DISCARD", cardIds: ids });
    expect(engine.state.player.discardsRemaining).toBe(2);
    expect(engine.state.deck.discardPile.map((c) => c.id)).toEqual(ids);
    expect(engine.state.deck.hand).toHaveLength(8);
  });

  it("rejects invalid actions without changing state", () => {
    const engine = started();
    const before = engine.state;
    expect(() => engine.dispatch({ type: "PLAY_HAND", cardIds: [] })).toThrow(InvalidActionError);
    expect(() => engine.dispatch({ type: "PLAY_HAND", cardIds: ["ghost"] })).toThrow(InvalidActionError);
    const six = engine.state.deck.hand.slice(0, 6).map((c) => c.id);
    expect(() => engine.dispatch({ type: "DISCARD", cardIds: six })).toThrow(InvalidActionError);
    expect(() => engine.dispatch({ type: "NEXT_ROUND" })).toThrow(InvalidActionError);
    expect(engine.state).toBe(before);
  });

  it("runs out of discards", () => {
    const engine = started();
    for (let i = 0; i < 3; i++) {
      engine.dispatch({ type: "DISCARD", cardIds: [engine.state.deck.hand[0]!.id] });
    }
    expect(() => engine.dispatch({ type: "DISCARD", cardIds: [engine.state.deck.hand[0]!.id] })).toThrow(
      /no discards/,
    );
  });

  it("game over after the last hand if target not reached", () => {
    const engine = started();
    // Play single low cards: never reaches 300.
    for (let i = 0; i < 4; i++) {
      const lowest = [...engine.state.deck.hand].sort((a, b) => a.rank.localeCompare(b.rank))[0]!;
      engine.dispatch({ type: "PLAY_HAND", cardIds: [lowest.id] });
    }
    expect(engine.state.status).toBe("GAME_OVER");
  });

  it("does not mutate the previous state (immutability)", () => {
    const s0 = started().state;
    const snapshot = JSON.stringify(s0);
    reduce(s0, { type: "PLAY_HAND", cardIds: [s0.deck.hand[0]!.id] });
    expect(JSON.stringify(s0)).toBe(snapshot);
  });

  it("USE_PLANET levels up the matching hand", () => {
    const engine = started();
    const events = engine.dispatch({ type: "USE_PLANET", planetId: "mercury" });
    expect(engine.state.handLevels.PAIR.level).toBe(2);
    expect(events).toEqual([{ type: "HAND_LEVELED_UP", handType: "PAIR", level: 2 }]);
  });

  it("SORT_HAND by rank orders high to low", () => {
    const engine = started();
    engine.dispatch({ type: "SORT_HAND", by: "RANK" });
    const order = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
    const idx = engine.state.deck.hand.map((c) => order.indexOf(c.rank));
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
});

describe("Determinism & replay", () => {
  /** Random-but-seeded bot: produces a legal action for the current state. */
  function botAction(state: GameState, bot: SeededRng): GameAction | null {
    if (state.status === "ROUND_WON") {
      return bot.chance(0.3) ? { type: "USE_PLANET", planetId: bot.pick(PLANETS).id } : { type: "NEXT_ROUND" };
    }
    if (state.status !== "PLAYING") return null;
    const hand = bot.shuffle(state.deck.hand);
    const n = bot.int(1, Math.min(5, hand.length));
    const cardIds = hand.slice(0, n).map((c) => c.id);
    if (state.player.discardsRemaining > 0 && bot.chance(0.4)) return { type: "DISCARD", cardIds };
    if (bot.chance(0.05)) return { type: "SORT_HAND", by: bot.chance(0.5) ? "RANK" : "SUIT" };
    return { type: "PLAY_HAND", cardIds };
  }

  function simulate(seed: string, maxSteps = 500) {
    const engine = new GameEngine();
    engine.dispatch({ type: "START_RUN", seed });
    const bot = SeededRng.fromSeed(`bot:${seed}`);
    for (let i = 0; i < maxSteps; i++) {
      const action = botAction(engine.state, bot);
      if (!action) break;
      engine.dispatch(action);
      assertInvariants(engine.state);
    }
    return engine;
  }

  it("same seed + same actions → identical state", () => {
    const a = simulate("REPLAY-1");
    const b = GameEngine.replay(a.actionLog);
    expect(b.state).toEqual(a.state);
  });

  it("state survives a JSON save/load round trip and continues identically", () => {
    const a = started("SAVE");
    a.dispatch({ type: "DISCARD", cardIds: [a.state.deck.hand[0]!.id] });
    const loaded = new GameEngine(JSON.parse(JSON.stringify(a.state)));
    const action: GameAction = { type: "PLAY_HAND", cardIds: a.state.deck.hand.slice(0, 3).map((c) => c.id) };
    expect(loaded.dispatch(action)).toEqual(a.dispatch(action));
    expect(loaded.state).toEqual(a.state);
  });

  it("different seeds deal different opening hands", () => {
    const hand = (seed: string) => started(seed).state.deck.hand.map((c) => `${c.rank}${c.suit}`);
    expect(hand("A")).not.toEqual(hand("B"));
  });

  it("simulates 300 seeded runs without breaking invariants", () => {
    let finished = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const engine = simulate(String(seed));
      if (engine.state.status !== "PLAYING") finished++;
    }
    expect(finished).toBe(300);
  });

  it("menu state is a valid starting point", () => {
    expect(createMenuState().status).toBe("MENU");
  });
});
