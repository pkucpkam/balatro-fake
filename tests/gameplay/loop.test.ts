import { produce } from "immer";
import { GameEngine } from "@/engine/core/GameEngine";
import { interestFor } from "@/engine/core/GameReducer";
import type { GameState } from "@/engine/core/GameState";
import { cards } from "../helpers";

function winnable(seed = "LOOP", patch?: (s: GameState) => void) {
  const e = new GameEngine();
  e.dispatch({ type: "START_RUN", seed });
  e.dispatch({ type: "SELECT_BLIND" });
  return new GameEngine(
    produce(e.state, (d) => {
      d.round.targetScore = 1;
      patch?.(d as GameState);
    }),
  );
}

describe("Gameplay loop", () => {
  it("blind select → play → cash out → shop → next blind", () => {
    const e = winnable();
    e.dispatch({ type: "PLAY_HAND", cardIds: [e.state.deck.hand[0]!.id] });
    expect(e.state.status).toBe("ROUND_WON");
    const co = e.state.cashOut!;
    expect(co.lines[0]).toMatchObject({ label: "Small Blind", amount: 3 });
    expect(co.total).toBe(3 + 3 + interestFor(4));

    const money = e.state.player.money;
    e.dispatch({ type: "CASH_OUT" });
    expect(e.state.player.money).toBe(money + co.total);
    expect(e.state.status).toBe("SHOP");
    expect(e.state.shop!.items).toHaveLength(2);

    e.dispatch({ type: "LEAVE_SHOP" });
    expect(e.state.status).toBe("BLIND_SELECT");
    expect(e.state.round.blindType).toBe("BIG");
    expect(e.state.round.targetScore).toBe(450);
  });

  it("buying and selling a joker", () => {
    const e = winnable("BUY", (s) => {
      s.player.money = 100;
    });
    e.dispatch({ type: "PLAY_HAND", cardIds: [e.state.deck.hand[0]!.id] });
    e.dispatch({ type: "CASH_OUT" });
    const shop = e.state.shop!;
    const item = shop.items[0]!;
    const before = e.state.player.money;
    e.dispatch({ type: "BUY", itemId: item.id });
    expect(e.state.player.money).toBe(before - item.cost);
    expect(e.state.shop!.items).toHaveLength(1);
    if (item.kind === "JOKER") {
      const j = e.state.jokers[0]!;
      e.dispatch({ type: "SELL_JOKER", jokerId: j.id });
      expect(e.state.jokers).toHaveLength(0);
    }
    e.dispatch({ type: "REROLL" });
    expect(e.state.shop!.rerollCost).toBe(6);
    expect(() => e.dispatch({ type: "BUY", itemId: "nope" })).toThrow();
  });

  it("boss ante: third blind uses the revealed boss and advances the ante", () => {
    const e = new GameEngine();
    e.dispatch({ type: "START_RUN", seed: "ANTE" });
    const boss = e.state.run.bossId;
    for (let i = 0; i < 3; i++) {
      e.dispatch({ type: "SELECT_BLIND" });
      if (i === 2) expect(e.state.round.bossId).toBe(boss);
      const forced = new GameEngine(produce(e.state, (d) => void (d.round.targetScore = 1)));
      forced.dispatch({ type: "PLAY_HAND", cardIds: forced.state.deck.hand.slice(0, 5).map((c) => c.id) });
      forced.dispatch({ type: "CASH_OUT" });
      forced.dispatch({ type: "LEAVE_SHOP" });
      Object.assign(e, { _state: forced.state });
    }
    expect(e.state.run.ante).toBe(2);
    expect(e.state.round.blindType).toBe("SMALL");
  });

  it("Tarot: The Empress turns 2 selected cards into Mult cards", () => {
    const e = winnable("TAROT", (s) => {
      s.round.targetScore = 1e9;
      s.consumables = [{ id: "c-t", kind: "TAROT", defId: "empress" }];
    });
    const ids = e.state.deck.hand.slice(0, 2).map((c) => c.id);
    e.dispatch({ type: "USE_CONSUMABLE", consumableId: "c-t", targetCardIds: ids });
    expect(e.state.deck.hand.filter((c) => ids.includes(c.id)).every((c) => c.enhancement === "MULT")).toBe(true);
    expect(() =>
      new GameEngine({ ...e.state, consumables: [{ id: "c-u", kind: "TAROT", defId: "lovers" }] }).dispatch({
        type: "USE_CONSUMABLE",
        consumableId: "c-u",
        targetCardIds: ids,
      }),
    ).toThrow(/at most 1/);
  });

  it("Tarot: The Hanged Man destroys cards", () => {
    const e = winnable("HANG", (s) => {
      s.round.targetScore = 1e9;
      s.consumables = [{ id: "c-h", kind: "TAROT", defId: "hanged_man" }];
    });
    const id = e.state.deck.hand[0]!.id;
    e.dispatch({ type: "USE_CONSUMABLE", consumableId: "c-h", targetCardIds: [id] });
    expect(e.state.deck.hand.some((c) => c.id === id)).toBe(false);
  });

  it("Glass cards can shatter and leave the deck", () => {
    let shattered = 0;
    for (let i = 0; i < 30; i++) {
      const hand = cards("AS");
      hand[0]!.enhancement = "GLASS";
      const e = winnable(`GLASS${i}`, (s) => {
        s.round.targetScore = 1e9;
        s.deck.hand = hand;
      });
      const ev = e.dispatch({ type: "PLAY_HAND", cardIds: [hand[0]!.id] });
      if (ev.some((x) => x.type === "CARDS_DESTROYED")) {
        shattered++;
        expect(e.state.deck.played.some((c) => c.id === hand[0]!.id)).toBe(false);
      }
    }
    expect(shattered).toBeGreaterThan(0);
    expect(shattered).toBeLessThan(30);
  });
});
