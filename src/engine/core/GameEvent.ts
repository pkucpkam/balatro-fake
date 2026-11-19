import type { BlindType } from "./GameState";
import type { PokerHandType } from "../poker/HandRank";

/**
 * Facts the engine reports after applying an action, in the order they happened.
 * The Animation layer only reads events; it never recomputes game logic.
 */
export type GameEvent =
  | { type: "RUN_STARTED"; seed: string }
  | { type: "ROUND_STARTED"; ante: number; blindType: BlindType; targetScore: number }
  | { type: "CARDS_DRAWN"; cardIds: string[] }
  | { type: "CARDS_DISCARDED"; cardIds: string[] }
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
  | { type: "CARD_SCORED"; cardId: string; chips: number }
  | { type: "SCORE_FINALIZED"; chips: number; mult: number; score: number; roundScore: number }
  | { type: "HAND_LEVELED_UP"; handType: PokerHandType; level: number }
  | { type: "ROUND_WON"; score: number; targetScore: number; reward: number }
  | { type: "GAME_OVER"; score: number; targetScore: number }
  | { type: "VICTORY" };

export type GameEventType = GameEvent["type"];
