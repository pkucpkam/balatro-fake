import type { BlindType, CashOutState, ConsumableKind } from "./GameState";
import type { PokerHandType } from "../poker/HandRank";

export type ScoreStepSource = "HAND" | "CARD" | "HELD" | "JOKER" | "BOSS";
export type ScoreStepKind =
  | "BASE"
  | "CHIPS"
  | "MULT"
  | "XMULT"
  | "MONEY"
  | "RETRIGGER"
  | "MESSAGE"
  | "DEBUFFED"
  | "DESTROY";

/**
 * Facts the engine reports after applying an action, in the order they happened.
 * The Animation layer only reads events; it never recomputes game logic.
 */
export type GameEvent =
  | { type: "RUN_STARTED"; seed: string }
  | { type: "BOSS_REVEALED"; ante: number; bossId: string }
  | { type: "ROUND_STARTED"; ante: number; blindType: BlindType; targetScore: number; bossId: string | null }
  | { type: "CARDS_DRAWN"; cardIds: string[] }
  | { type: "CARDS_DISCARDED"; cardIds: string[]; forced?: boolean }
  | { type: "HAND_SORTED"; by: "RANK" | "SUIT" }
  | { type: "HAND_PLAYED"; cardIds: string[] }
  | {
      type: "HAND_EVALUATED";
      handType: PokerHandType;
      level: number;
      chips: number;
      mult: number;
      scoringCardIds: string[];
    }
  | {
      type: "SCORE_STEP";
      source: ScoreStepSource;
      sourceId: string | null;
      kind: ScoreStepKind;
      amount: number;
      text: string;
      /** Running totals after this step. */
      chips: number;
      mult: number;
    }
  | { type: "SCORE_FINALIZED"; chips: number; mult: number; score: number; roundScore: number }
  | { type: "CARDS_DESTROYED"; cardIds: string[] }
  | { type: "JOKER_MESSAGE"; jokerId: string; text: string }
  | { type: "MONEY_EARNED"; amount: number; source: string }
  | { type: "HAND_LEVELED_UP"; handType: PokerHandType; level: number }
  | { type: "ROUND_WON"; score: number; targetScore: number; cashOut: CashOutState }
  | { type: "JOKER_DESTROYED"; jokerId: string; defId: string; reason: string }
  | { type: "CASHED_OUT"; amount: number }
  | { type: "SHOP_OPENED" }
  | { type: "SHOP_REROLLED"; cost: number }
  | { type: "ITEM_BOUGHT"; itemId: string; kind: string; defId: string; cost: number }
  | { type: "JOKER_SOLD"; jokerId: string; amount: number }
  | { type: "JOKERS_REORDERED"; order: string[] }
  | { type: "CONSUMABLE_ADDED"; consumableId: string; kind: ConsumableKind; defId: string }
  | { type: "CONSUMABLE_USED"; consumableId: string; kind: ConsumableKind; defId: string; text: string }
  | { type: "CONSUMABLE_SOLD"; consumableId: string; amount: number }
  | { type: "BLIND_SELECTED"; blindType: BlindType }
  | { type: "GAME_OVER"; score: number; targetScore: number }
  | { type: "VICTORY" };

export type GameEventType = GameEvent["type"];
