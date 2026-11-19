import { produce, type Draft } from "immer";
import { RANK_VALUE, SUITS, type PlayingCard } from "../cards/Card";
import {
  createStandardDeck,
  discardFromHand,
  drawToHandSize,
  emptyDeckState,
  resetAndShuffle,
  takeFromHand,
  type IdCounter,
} from "../deck/Deck";
import { createInitialHandLevels, levelUpHand } from "../poker/HandLevels";
import { DEFAULT_RULES, MAX_PLAYED_CARDS, evaluateHand } from "../poker/HandEvaluator";
import { scoreBasic } from "../poker/HandScorer";
import { SeededRng } from "../rng/SeededRng";
import { BLIND_ORDER, BLIND_REWARD, blindTarget } from "../blind/BlindTable";
import { PLANET_REGISTRY } from "@/content/planets/planets";
import type { GameAction } from "./GameAction";
import type { GameEvent } from "./GameEvent";
import type { GameState } from "./GameState";

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
} as const;

/** State before any run has started. */
export function createMenuState(): GameState {
  return {
    schemaVersion: 1,
    status: "MENU",
    rng: [0, 0, 0, 0],
    nextCardId: 0,
    run: { seed: "", ante: 0, round: 0, winningAnte: STARTING_CONFIG.winningAnte },
    round: { blindType: "SMALL", targetScore: 0, currentScore: 0 },
    player: {
      money: 0,
      handSize: STARTING_CONFIG.handSize,
      maxHands: STARTING_CONFIG.hands,
      maxDiscards: STARTING_CONFIG.discards,
      handsRemaining: 0,
      discardsRemaining: 0,
    },
    deck: emptyDeckState(),
    handLevels: createInitialHandLevels(),
    rules: { ...DEFAULT_RULES },
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function assertStatus(state: GameState, action: GameAction, ...allowed: GameState["status"][]): void {
  if (!allowed.includes(state.status)) {
    throw new InvalidActionError(action, `not allowed in status ${state.status}`);
  }
}

function assertCardSelection(state: GameState, action: GameAction, cardIds: readonly string[]): void {
  if (cardIds.length === 0) throw new InvalidActionError(action, "select at least one card");
  if (cardIds.length > MAX_PLAYED_CARDS) {
    throw new InvalidActionError(action, `select at most ${MAX_PLAYED_CARDS} cards`);
  }
  if (new Set(cardIds).size !== cardIds.length) throw new InvalidActionError(action, "duplicate card ids");
  const inHand = new Set(state.deck.hand.map((c) => c.id));
  for (const id of cardIds) {
    if (!inHand.has(id)) throw new InvalidActionError(action, `card ${id} is not in hand`);
  }
}

// ---------------------------------------------------------------------------
// Round helpers (operate on drafts)
// ---------------------------------------------------------------------------

function startRound(draft: Draft<GameState>, rng: SeededRng, events: GameEvent[]): void {
  const { ante } = draft.run;
  const blindType = draft.round.blindType;
  draft.round.targetScore = blindTarget(ante, blindType);
  draft.round.currentScore = 0;
  draft.player.handsRemaining = draft.player.maxHands;
  draft.player.discardsRemaining = draft.player.maxDiscards;
  draft.status = "PLAYING";

  resetAndShuffle(draft.deck as GameState["deck"], rng);
  events.push({ type: "ROUND_STARTED", ante, blindType, targetScore: draft.round.targetScore });
  drawCards(draft, events);
}

function drawCards(draft: Draft<GameState>, events: GameEvent[]): void {
  const drawn = drawToHandSize(draft.deck as GameState["deck"], draft.player.handSize);
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
  switch (action.type) {
    case "START_RUN":
      if (!action.seed) throw new InvalidActionError(action, "seed is required");
      break;
    case "PLAY_HAND":
      assertStatus(state, action, "PLAYING");
      assertCardSelection(state, action, action.cardIds);
      if (state.player.handsRemaining <= 0) throw new InvalidActionError(action, "no hands remaining");
      break;
    case "DISCARD":
      assertStatus(state, action, "PLAYING");
      assertCardSelection(state, action, action.cardIds);
      if (state.player.discardsRemaining <= 0) throw new InvalidActionError(action, "no discards remaining");
      break;
    case "SORT_HAND":
      assertStatus(state, action, "PLAYING");
      break;
    case "USE_PLANET":
      assertStatus(state, action, "PLAYING", "ROUND_WON");
      if (!PLANET_REGISTRY[action.planetId]) throw new InvalidActionError(action, `unknown planet ${action.planetId}`);
      break;
    case "NEXT_ROUND":
      assertStatus(state, action, "ROUND_WON");
      break;
  }

  const next = produce(action.type === "START_RUN" ? createMenuState() : state, (draft) => {
    const rng = action.type === "START_RUN" ? SeededRng.fromSeed(action.seed) : new SeededRng(draft.rng);

    switch (action.type) {
      case "START_RUN": {
        const counter: IdCounter = { next: 0 };
        draft.run = { seed: action.seed, ante: 1, round: 1, winningAnte: STARTING_CONFIG.winningAnte };
        draft.round.blindType = "SMALL";
        draft.player.money = STARTING_CONFIG.money;
        draft.deck.drawPile = createStandardDeck(counter);
        draft.nextCardId = counter.next;
        events.push({ type: "RUN_STARTED", seed: action.seed });
        startRound(draft, rng, events);
        break;
      }

      case "PLAY_HAND": {
        const deck = draft.deck as GameState["deck"];
        const played = takeFromHand(deck, action.cardIds);
        draft.player.handsRemaining -= 1;
        events.push({ type: "HAND_PLAYED", cardIds: [...action.cardIds] });

        const result = evaluateHand(played, draft.rules);
        const breakdown = scoreBasic(result, played, draft.handLevels);
        draft.handLevels[result.handType].timesPlayed += 1;

        events.push({
          type: "HAND_EVALUATED",
          handType: result.handType,
          level: draft.handLevels[result.handType].level,
          chips: breakdown.handChips,
          mult: breakdown.handMult,
          scoringCardIds: result.scoringCardIds,
        });
        for (const c of breakdown.cardChips) events.push({ type: "CARD_SCORED", cardId: c.cardId, chips: c.chips });

        draft.round.currentScore += breakdown.score;
        events.push({
          type: "SCORE_FINALIZED",
          chips: breakdown.chips,
          mult: breakdown.mult,
          score: breakdown.score,
          roundScore: draft.round.currentScore,
        });

        deck.played.push(...played);

        if (draft.round.currentScore >= draft.round.targetScore) {
          const reward = BLIND_REWARD[draft.round.blindType] + draft.player.handsRemaining;
          draft.player.money += reward;
          events.push({
            type: "ROUND_WON",
            score: draft.round.currentScore,
            targetScore: draft.round.targetScore,
            reward,
          });
          if (draft.round.blindType === "BOSS" && draft.run.ante >= draft.run.winningAnte) {
            draft.status = "VICTORY";
            events.push({ type: "VICTORY" });
          } else {
            draft.status = "ROUND_WON";
          }
        } else if (draft.player.handsRemaining <= 0) {
          draft.status = "GAME_OVER";
          events.push({ type: "GAME_OVER", score: draft.round.currentScore, targetScore: draft.round.targetScore });
        } else {
          drawCards(draft, events);
        }
        break;
      }

      case "DISCARD": {
        discardFromHand(draft.deck as GameState["deck"], action.cardIds);
        draft.player.discardsRemaining -= 1;
        events.push({ type: "CARDS_DISCARDED", cardIds: [...action.cardIds] });
        drawCards(draft, events);
        break;
      }

      case "SORT_HAND": {
        sortCards(draft.deck.hand as PlayingCard[], action.by);
        events.push({ type: "HAND_SORTED", by: action.by });
        break;
      }

      case "USE_PLANET": {
        const planet = PLANET_REGISTRY[action.planetId];
        if (!planet) break; // validated above
        levelUpHand(draft.handLevels, planet.hand);
        events.push({ type: "HAND_LEVELED_UP", handType: planet.hand, level: draft.handLevels[planet.hand].level });
        break;
      }

      case "NEXT_ROUND": {
        const idx = BLIND_ORDER.indexOf(draft.round.blindType);
        if (idx === BLIND_ORDER.length - 1) {
          draft.run.ante += 1;
          draft.round.blindType = "SMALL";
        } else {
          draft.round.blindType = BLIND_ORDER[idx + 1] as GameState["round"]["blindType"];
        }
        draft.run.round += 1;
        startRound(draft, rng, events);
        break;
      }
    }

    draft.rng = rng.state as Draft<GameState>["rng"];
  });

  return { state: next, events };
}
