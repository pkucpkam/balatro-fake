import { produce, type Draft } from "immer";
import { RANK_VALUE, SUITS, type PlayingCard } from "../cards/Card";
import {
  allCards,
  createStandardDeck,
  discardFromHand,
  drawToHandSize,
  emptyDeckState,
  resetAndShuffle,
  takeFromHand,
  type IdCounter,
} from "../deck/Deck";
import { createInitialHandLevels, levelUpHand } from "../poker/HandLevels";
import { DEFAULT_RULES, MAX_PLAYED_CARDS, evaluateHand, type EvaluationRules } from "../poker/HandEvaluator";
import { HAND_BASE } from "../poker/HandRank";
import { SeededRng } from "../rng/SeededRng";
import { BLIND_ORDER, BLIND_REWARD, INTEREST_CAP, INTEREST_STEP, blindTarget } from "../blind/BlindTable";
import { runScoring } from "../scoring/ScoringPipeline";
import type { TarotApi } from "../effects/types";
import {
  BASE_REROLL_COST,
  generateShopItems,
  nextId,
  rollEdition,
  rollJokerId,
  rollTarotId,
  sellValueOf,
  jokerCost,
} from "../shop/Shop";
import { PLANET_REGISTRY, PLANETS } from "@/content/planets/planets";
import { JOKER_REGISTRY } from "@/content/jokers/jokers";
import { TAROT_REGISTRY } from "@/content/tarots/tarots";
import { BOSSES, BOSS_REGISTRY, type BossDefinition } from "@/content/blinds/bosses";
import type { GameAction } from "./GameAction";
import type { GameEvent } from "./GameEvent";
import type { CashOutLine, ConsumableKind, GameState, JokerInstance } from "./GameState";

export class InvalidActionError extends Error {
  constructor(
    readonly action: GameAction,
    reason: string,
  ) {
    super(`${action.type}: ${reason}`);
    this.name = "InvalidActionError";
  }
}

export interface ReduceResult {
  state: GameState;
  events: GameEvent[];
}

export const STARTING_CONFIG = {
  money: 4,
  handSize: 8,
  hands: 4,
  discards: 3,
  winningAnte: 8,
  jokerSlots: 5,
  consumableSlots: 2,
} as const;

/** State before any run has started. */
export function createMenuState(): GameState {
  return {
    schemaVersion: 2,
    status: "MENU",
    rng: [0, 0, 0, 0],
    nextCardId: 0,
    nextId: 0,
    run: {
      seed: "",
      ante: 0,
      round: 0,
      winningAnte: STARTING_CONFIG.winningAnte,
      bossId: "",
      usedBossIds: [],
      bestHandScore: 0,
      handsPlayedTotal: 0,
    },
    round: {
      blindType: "SMALL",
      targetScore: 0,
      currentScore: 0,
      bossId: null,
      handSize: STARTING_CONFIG.handSize,
      handsPlayed: 0,
      discardsUsed: 0,
      playedHandTypes: [],
      lastHandType: null,
    },
    player: {
      money: 0,
      handSize: STARTING_CONFIG.handSize,
      maxHands: STARTING_CONFIG.hands,
      maxDiscards: STARTING_CONFIG.discards,
      handsRemaining: 0,
      discardsRemaining: 0,
      jokerSlots: STARTING_CONFIG.jokerSlots,
      consumableSlots: STARTING_CONFIG.consumableSlots,
    },
    deck: emptyDeckState(),
    jokers: [],
    consumables: [],
    shop: null,
    cashOut: null,
    handLevels: createInitialHandLevels(),
    rules: { ...DEFAULT_RULES },
  };
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export function deriveRules(jokers: readonly JokerInstance[]): EvaluationRules {
  const rules = { ...DEFAULT_RULES };
  for (const j of jokers) {
    const r = JOKER_REGISTRY[j.defId]?.rules;
    if (!r) continue;
    if (r.flushStraightSize !== undefined) rules.flushStraightSize = Math.min(rules.flushStraightSize, r.flushStraightSize);
    if (r.straightMaxGap !== undefined) rules.straightMaxGap = Math.max(rules.straightMaxGap, r.straightMaxGap);
    if (r.allPlayedCardsScore) rules.allPlayedCardsScore = true;
    if (r.smearedSuits) rules.smearedSuits = true;
  }
  return rules;
}

function passiveTotals(jokers: readonly JokerInstance[]) {
  const t = { handSize: 0, hands: 0, discards: 0 };
  for (const j of jokers) {
    const p = JOKER_REGISTRY[j.defId]?.passive;
    t.handSize += p?.handSize ?? 0;
    t.hands += p?.hands ?? 0;
    t.discards += p?.discards ?? 0;
  }
  return t;
}

export function activeBoss(state: GameState): BossDefinition | undefined {
  return state.round.bossId ? BOSS_REGISTRY[state.round.bossId] : undefined;
}

export function blindLabel(state: GameState): string {
  const { blindType } = state.round;
  if (blindType === "BOSS") return BOSS_REGISTRY[state.run.bossId]?.name ?? "Boss Blind";
  return blindType === "SMALL" ? "Small Blind" : "Big Blind";
}

/** Interest that would be paid on `money` at cash out. */
export function interestFor(money: number): number {
  return Math.min(INTEREST_CAP, Math.floor(Math.max(0, money) / INTEREST_STEP));
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function assertStatus(state: GameState, action: GameAction, ...allowed: GameState["status"][]): void {
  if (!allowed.includes(state.status)) {
    throw new InvalidActionError(action, `not allowed in status ${state.status}`);
  }
}

function assertCardsInHand(state: GameState, action: GameAction, cardIds: readonly string[], min: number, max: number) {
  if (cardIds.length < min) throw new InvalidActionError(action, `select at least ${min} card(s)`);
  if (cardIds.length > max) throw new InvalidActionError(action, `select at most ${max} cards`);
  if (new Set(cardIds).size !== cardIds.length) throw new InvalidActionError(action, "duplicate card ids");
  const inHand = new Set(state.deck.hand.map((c) => c.id));
  for (const id of cardIds) {
    if (!inHand.has(id)) throw new InvalidActionError(action, `card ${id} is not in hand`);
  }
}

function validate(state: GameState, action: GameAction): void {
  switch (action.type) {
    case "START_RUN":
      if (!action.seed) throw new InvalidActionError(action, "seed is required");
      return;
    case "SELECT_BLIND":
      assertStatus(state, action, "BLIND_SELECT");
      return;
    case "PLAY_HAND":
      assertStatus(state, action, "PLAYING");
      assertCardsInHand(state, action, action.cardIds, 1, MAX_PLAYED_CARDS);
      if (state.player.handsRemaining <= 0) throw new InvalidActionError(action, "no hands remaining");
      return;
    case "DISCARD":
      assertStatus(state, action, "PLAYING");
      assertCardsInHand(state, action, action.cardIds, 1, MAX_PLAYED_CARDS);
      if (state.player.discardsRemaining <= 0) throw new InvalidActionError(action, "no discards remaining");
      return;
    case "SORT_HAND":
      assertStatus(state, action, "PLAYING");
      return;
    case "REORDER_HAND": {
      assertStatus(state, action, "PLAYING");
      const ids = state.deck.hand.map((c) => c.id).sort();
      if (JSON.stringify([...action.cardIds].sort()) !== JSON.stringify(ids)) {
        throw new InvalidActionError(action, "must be a permutation of the hand");
      }
      return;
    }
    case "USE_CONSUMABLE": {
      assertStatus(state, action, "PLAYING", "SHOP", "BLIND_SELECT");
      const c = state.consumables.find((x) => x.id === action.consumableId);
      if (!c) throw new InvalidActionError(action, "no such consumable");
      if (c.kind === "TAROT") {
        const t = TAROT_REGISTRY[c.defId];
        if (!t) throw new InvalidActionError(action, "unknown tarot");
        const targets = action.targetCardIds ?? [];
        if (t.maxTargets > 0) {
          if (state.status !== "PLAYING") throw new InvalidActionError(action, "needs cards in hand");
          assertCardsInHand(state, action, targets, t.minTargets, t.maxTargets);
        }
      }
      return;
    }
    case "SELL_CONSUMABLE":
      assertStatus(state, action, "PLAYING", "SHOP", "BLIND_SELECT", "ROUND_WON");
      if (!state.consumables.some((x) => x.id === action.consumableId)) {
        throw new InvalidActionError(action, "no such consumable");
      }
      return;
    case "SELL_JOKER":
      assertStatus(state, action, "PLAYING", "SHOP", "BLIND_SELECT", "ROUND_WON");
      if (!state.jokers.some((j) => j.id === action.jokerId)) throw new InvalidActionError(action, "no such joker");
      return;
    case "MOVE_JOKER":
      assertStatus(state, action, "PLAYING", "SHOP", "BLIND_SELECT", "ROUND_WON");
      if (!state.jokers.some((j) => j.id === action.jokerId)) throw new InvalidActionError(action, "no such joker");
      if (action.toIndex < 0 || action.toIndex >= state.jokers.length) throw new InvalidActionError(action, "bad index");
      return;
    case "CASH_OUT":
      assertStatus(state, action, "ROUND_WON");
      return;
    case "BUY": {
      assertStatus(state, action, "SHOP");
      const item = state.shop?.items.find((i) => i.id === action.itemId);
      if (!item) throw new InvalidActionError(action, "no such item");
      if (state.player.money < item.cost) throw new InvalidActionError(action, "not enough money");
      if (item.kind === "JOKER" && state.jokers.length >= state.player.jokerSlots) {
        throw new InvalidActionError(action, "joker slots full");
      }
      if (item.kind !== "JOKER" && state.consumables.length >= state.player.consumableSlots) {
        throw new InvalidActionError(action, "consumable slots full");
      }
      return;
    }
    case "REROLL":
      assertStatus(state, action, "SHOP");
      if (!state.shop || state.player.money < state.shop.rerollCost) {
        throw new InvalidActionError(action, "not enough money");
      }
      return;
    case "LEAVE_SHOP":
      assertStatus(state, action, "SHOP");
      return;
  }
}

// ---------------------------------------------------------------------------
// Draft helpers
// ---------------------------------------------------------------------------

type S = GameState; // drafts are cast to the plain type for helper reuse

function pickBoss(s: S, rng: SeededRng, events: GameEvent[]): void {
  const eligible = BOSSES.filter((b) => b.minAnte <= s.run.ante);
  let pool = eligible.filter((b) => !s.run.usedBossIds.includes(b.id));
  if (pool.length === 0) {
    s.run.usedBossIds = [];
    pool = eligible;
  }
  const boss = rng.pick(pool);
  s.run.bossId = boss.id;
  s.run.usedBossIds.push(boss.id);
  events.push({ type: "BOSS_REVEALED", ante: s.run.ante, bossId: boss.id });
}

/** Set up the upcoming blind so BLIND_SELECT can show its target. */
function prepareBlind(s: S): void {
  const isBoss = s.round.blindType === "BOSS";
  const boss = isBoss ? BOSS_REGISTRY[s.run.bossId] : undefined;
  s.round.bossId = boss ? boss.id : null;
  s.round.targetScore = blindTarget(s.run.ante, s.round.blindType, boss?.scoreMult);
  s.round.currentScore = 0;
  s.status = "BLIND_SELECT";
}

function applyDebuffs(s: S): void {
  const boss = activeBoss(s);
  for (const c of allCards(s.deck)) c.debuffed = boss?.debuff?.(c) ?? false;
}

function startRound(s: S, rng: SeededRng, events: GameEvent[]): void {
  const boss = activeBoss(s);
  const passive = passiveTotals(s.jokers);
  s.round.currentScore = 0;
  s.round.handsPlayed = 0;
  s.round.discardsUsed = 0;
  s.round.playedHandTypes = [];
  s.round.lastHandType = null;
  s.round.handSize = Math.max(1, s.player.handSize + passive.handSize + (boss?.handSizeDelta ?? 0));
  s.player.handsRemaining = boss?.hands ?? Math.max(1, s.player.maxHands + passive.hands);
  s.player.discardsRemaining = boss?.discards ?? Math.max(0, s.player.maxDiscards + passive.discards);
  s.status = "PLAYING";

  resetAndShuffle(s.deck, rng);
  applyDebuffs(s);
  events.push({
    type: "ROUND_STARTED",
    ante: s.run.ante,
    blindType: s.round.blindType,
    targetScore: s.round.targetScore,
    bossId: s.round.bossId,
  });
  drawCards(s, events);
}

function drawCards(s: S, events: GameEvent[]): void {
  const drawn = drawToHandSize(s.deck, s.round.handSize);
  if (drawn.length > 0) events.push({ type: "CARDS_DRAWN", cardIds: drawn.map((c) => c.id) });
}

function sortCards(cards: PlayingCard[], by: "RANK" | "SUIT"): void {
  const suitIdx = (c: PlayingCard) => SUITS.indexOf(c.suit);
  cards.sort((a, b) =>
    by === "RANK"
      ? RANK_VALUE[b.rank] - RANK_VALUE[a.rank] || suitIdx(a) - suitIdx(b)
      : suitIdx(a) - suitIdx(b) || RANK_VALUE[b.rank] - RANK_VALUE[a.rank],
  );
}

function addConsumable(s: S, kind: ConsumableKind, defId: string, events: GameEvent[]): boolean {
  if (s.consumables.length >= s.player.consumableSlots) return false;
  const id = nextId(s, "c");
  s.consumables.push({ id, kind, defId });
  events.push({ type: "CONSUMABLE_ADDED", consumableId: id, kind, defId });
  return true;
}

function addJoker(s: S, defId: string, edition: JokerInstance["edition"], cost: number): JokerInstance {
  const joker: JokerInstance = { id: nextId(s, "j"), defId, edition, counter: 0, sellValue: sellValueOf(cost) };
  s.jokers.push(joker);
  s.rules = deriveRules(s.jokers);
  return joker;
}

function removeCards(s: S, ids: readonly string[]): void {
  const gone = new Set(ids);
  s.deck.hand = s.deck.hand.filter((c) => !gone.has(c.id));
  s.deck.drawPile = s.deck.drawPile.filter((c) => !gone.has(c.id));
  s.deck.played = s.deck.played.filter((c) => !gone.has(c.id));
  s.deck.discardPile = s.deck.discardPile.filter((c) => !gone.has(c.id));
}

function winRound(s: S, rng: SeededRng, events: GameEvent[]): void {
  const lines: CashOutLine[] = [];
  const blindName = blindLabel(s);
  lines.push({ label: blindName, amount: BLIND_REWARD[s.round.blindType] });
  if (s.player.handsRemaining > 0) {
    lines.push({ label: `Remaining Hands ($1 each)`, amount: s.player.handsRemaining });
  }

  const gold = s.deck.hand.filter((c) => c.enhancement === "GOLD" && !c.debuffed).length;
  if (gold > 0) lines.push({ label: `Gold Cards held`, amount: gold * 3 });

  for (const c of s.deck.hand) {
    if (c.seal === "BLUE" && !c.debuffed && s.round.lastHandType) {
      const planet = PLANETS.find((p) => p.hand === s.round.lastHandType);
      if (planet) addConsumable(s, "PLANET", planet.id, events);
    }
  }

  for (const j of s.jokers) {
    const money = JOKER_REGISTRY[j.defId]?.onRoundEnd?.(s, j) ?? 0;
    if (money > 0) lines.push({ label: JOKER_REGISTRY[j.defId]?.name ?? j.defId, amount: money });
  }

  const interest = interestFor(s.player.money);
  if (interest > 0) lines.push({ label: `Interest ($1 per $${INTEREST_STEP}, max $${INTEREST_CAP})`, amount: interest });

  // End-of-round joker destruction (Gros Michel).
  for (const j of [...s.jokers]) {
    if (j.defId === "gros_michel" && rng.chance(1 / 6)) {
      s.jokers = s.jokers.filter((x) => x.id !== j.id);
      events.push({ type: "JOKER_DESTROYED", jokerId: j.id, defId: j.defId, reason: "Extinct!" });
    }
  }
  s.rules = deriveRules(s.jokers);

  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  s.cashOut = { lines, total };
  for (const c of allCards(s.deck)) c.debuffed = false;

  events.push({ type: "ROUND_WON", score: s.round.currentScore, targetScore: s.round.targetScore, cashOut: s.cashOut });

  if (s.round.blindType === "BOSS" && s.run.ante >= s.run.winningAnte) {
    s.player.money += total;
    s.cashOut = null;
    s.status = "VICTORY";
    events.push({ type: "VICTORY" });
  } else {
    s.status = "ROUND_WON";
  }
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Pure transition: (state, action) -> (newState, events).
 * Throws InvalidActionError for illegal actions; the input state is never mutated.
 * All randomness flows through state.rng, so identical inputs give identical outputs.
 */
export function reduce(state: GameState, action: GameAction): ReduceResult {
  const events: GameEvent[] = [];

  // Validate against the immutable input first, so errors never leave half-applied drafts.
  validate(state, action);

  const next = produce(action.type === "START_RUN" ? createMenuState() : state, (draft: Draft<GameState>) => {
    const s = draft as GameState;
    const rng = action.type === "START_RUN" ? SeededRng.fromSeed(action.seed) : new SeededRng(s.rng);

    switch (action.type) {
      case "START_RUN": {
        const counter: IdCounter = { next: 0 };
        s.run = { ...s.run, seed: action.seed, ante: 1, round: 1 };
        s.round.blindType = "SMALL";
        s.player.money = STARTING_CONFIG.money;
        s.deck.drawPile = createStandardDeck(counter);
        s.nextCardId = counter.next;
        events.push({ type: "RUN_STARTED", seed: action.seed });
        pickBoss(s, rng, events);
        prepareBlind(s);
        break;
      }

      case "SELECT_BLIND": {
        events.push({ type: "BLIND_SELECTED", blindType: s.round.blindType });
        startRound(s, rng, events);
        break;
      }

      case "PLAY_HAND": {
        const played = takeFromHand(s.deck, action.cardIds);
        s.player.handsRemaining -= 1;
        s.round.handsPlayed += 1;
        s.run.handsPlayedTotal += 1;
        events.push({ type: "HAND_PLAYED", cardIds: [...action.cardIds] });

        const result = evaluateHand(played, s.rules);
        const outcome = runScoring(s, played, result, rng);

        events.push({
          type: "HAND_EVALUATED",
          handType: result.handType,
          level: outcome.level,
          chips: outcome.baseChips,
          mult: outcome.baseMult,
          scoringCardIds: result.scoringCardIds,
        });
        events.push(...outcome.steps);

        if (!s.round.playedHandTypes.includes(result.handType)) s.round.playedHandTypes.push(result.handType);
        s.round.lastHandType = result.handType;
        s.round.currentScore += outcome.score;
        s.run.bestHandScore = Math.max(s.run.bestHandScore, outcome.score);
        events.push({
          type: "SCORE_FINALIZED",
          chips: outcome.chips,
          mult: outcome.mult,
          score: outcome.score,
          roundScore: s.round.currentScore,
        });

        const destroyed = new Set(outcome.destroyedCardIds);
        s.deck.played.push(...played.filter((c) => !destroyed.has(c.id)));
        if (destroyed.size > 0) events.push({ type: "CARDS_DESTROYED", cardIds: [...destroyed] });

        if (s.round.currentScore >= s.round.targetScore) {
          winRound(s, rng, events);
        } else if (s.player.handsRemaining <= 0) {
          s.status = "GAME_OVER";
          events.push({ type: "GAME_OVER", score: s.round.currentScore, targetScore: s.round.targetScore });
        } else {
          const hook = activeBoss(s)?.hookDiscard ?? 0;
          if (hook > 0 && s.deck.hand.length > 0) {
            const victims = rng.shuffle(s.deck.hand).slice(0, hook).map((c) => c.id);
            discardFromHand(s.deck, victims);
            events.push({ type: "CARDS_DISCARDED", cardIds: victims, forced: true });
          }
          drawCards(s, events);
        }
        break;
      }

      case "DISCARD": {
        const cards = discardFromHand(s.deck, action.cardIds);
        s.player.discardsRemaining -= 1;
        s.round.discardsUsed += 1;
        events.push({ type: "CARDS_DISCARDED", cardIds: [...action.cardIds] });
        for (const c of cards) {
          if (c.seal === "PURPLE" && !c.debuffed) addConsumable(s, "TAROT", rollTarotId(rng), events);
        }
        for (const j of s.jokers) {
          const eff = JOKER_REGISTRY[j.defId]?.onDiscard?.(s, cards, j);
          if (!eff) continue;
          if (eff.money) {
            s.player.money += eff.money;
            events.push({ type: "MONEY_EARNED", amount: eff.money, source: j.id });
          }
          events.push({ type: "JOKER_MESSAGE", jokerId: j.id, text: eff.text ?? (eff.money ? `+$${eff.money}` : "!") });
        }
        drawCards(s, events);
        break;
      }

      case "SORT_HAND": {
        sortCards(s.deck.hand, action.by);
        events.push({ type: "HAND_SORTED", by: action.by });
        break;
      }

      case "REORDER_HAND": {
        const byId = new Map(s.deck.hand.map((c) => [c.id, c]));
        s.deck.hand = action.cardIds.map((id) => byId.get(id) as PlayingCard);
        break;
      }

      case "USE_CONSUMABLE": {
        const idx = s.consumables.findIndex((c) => c.id === action.consumableId);
        const item = s.consumables[idx];
        if (!item) break;
        s.consumables.splice(idx, 1);
        let text = "";
        if (item.kind === "PLANET") {
          const planet = PLANET_REGISTRY[item.defId];
          if (planet) {
            levelUpHand(s.handLevels, planet.hand);
            text = `${HAND_BASE[planet.hand].name} Lv.${s.handLevels[planet.hand].level}`;
            events.push({ type: "HAND_LEVELED_UP", handType: planet.hand, level: s.handLevels[planet.hand].level });
          }
        } else {
          const tarot = TAROT_REGISTRY[item.defId];
          if (tarot) {
            const ids = action.targetCardIds ?? [];
            const targets = ids
              .map((id) => s.deck.hand.find((c) => c.id === id))
              .filter((c): c is PlayingCard => !!c);
            const api: TarotApi = {
              state: s,
              targets,
              rng,
              addRandomJoker: () => {
                if (s.jokers.length >= s.player.jokerSlots) return false;
                const defId = rollJokerId(s, rng);
                addJoker(s, defId, rollEdition(rng), jokerCost(defId));
                return true;
              },
              addRandomTarot: () => addConsumable(s, "TAROT", rollTarotId(rng), events),
              destroyCards: (cardIds) => {
                removeCards(s, cardIds);
                events.push({ type: "CARDS_DESTROYED", cardIds: [...cardIds] });
              },
            };
            text = tarot.apply(api);
            applyDebuffs(s);
          }
        }
        events.push({ type: "CONSUMABLE_USED", consumableId: item.id, kind: item.kind, defId: item.defId, text });
        break;
      }

      case "SELL_CONSUMABLE": {
        s.consumables = s.consumables.filter((c) => c.id !== action.consumableId);
        s.player.money += 1;
        events.push({ type: "CONSUMABLE_SOLD", consumableId: action.consumableId, amount: 1 });
        break;
      }

      case "SELL_JOKER": {
        const j = s.jokers.find((x) => x.id === action.jokerId);
        if (!j) break;
        s.jokers = s.jokers.filter((x) => x.id !== j.id);
        s.player.money += j.sellValue;
        s.rules = deriveRules(s.jokers);
        events.push({ type: "JOKER_SOLD", jokerId: j.id, amount: j.sellValue });
        break;
      }

      case "MOVE_JOKER": {
        const from = s.jokers.findIndex((x) => x.id === action.jokerId);
        const [j] = s.jokers.splice(from, 1);
        if (j) s.jokers.splice(action.toIndex, 0, j);
        events.push({ type: "JOKERS_REORDERED", order: s.jokers.map((x) => x.id) });
        break;
      }

      case "CASH_OUT": {
        const total = s.cashOut?.total ?? 0;
        s.player.money += total;
        s.cashOut = null;
        events.push({ type: "CASHED_OUT", amount: total });
        s.shop = { items: generateShopItems(s, rng), rerollCost: BASE_REROLL_COST };
        s.status = "SHOP";
        events.push({ type: "SHOP_OPENED" });
        break;
      }

      case "BUY": {
        const shop = s.shop;
        const item = shop?.items.find((i) => i.id === action.itemId);
        if (!shop || !item) break;
        shop.items = shop.items.filter((i) => i.id !== item.id);
        s.player.money -= item.cost;
        if (item.kind === "JOKER") addJoker(s, item.defId, item.edition, item.cost);
        else addConsumable(s, item.kind, item.defId, events);
        events.push({ type: "ITEM_BOUGHT", itemId: item.id, kind: item.kind, defId: item.defId, cost: item.cost });
        break;
      }

      case "REROLL": {
        const shop = s.shop;
        if (!shop) break;
        s.player.money -= shop.rerollCost;
        events.push({ type: "SHOP_REROLLED", cost: shop.rerollCost });
        shop.rerollCost += 1;
        shop.items = generateShopItems(s, rng);
        break;
      }

      case "LEAVE_SHOP": {
        s.shop = null;
        const idx = BLIND_ORDER.indexOf(s.round.blindType);
        if (idx === BLIND_ORDER.length - 1) {
          s.run.ante += 1;
          s.round.blindType = "SMALL";
          pickBoss(s, rng, events);
        } else {
          s.round.blindType = BLIND_ORDER[idx + 1] as GameState["round"]["blindType"];
        }
        s.run.round += 1;
        prepareBlind(s);
        break;
      }
    }

    s.rng = rng.state as GameState["rng"];
  });

  return { state: next, events };
}
