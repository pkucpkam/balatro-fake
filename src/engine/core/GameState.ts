import type { DeckState } from "../deck/Deck";
import type { HandLevels } from "../poker/HandLevels";
import type { EvaluationRules } from "../poker/HandEvaluator";
import type { RngState } from "../rng/SeededRng";

export type GameStatus = "MENU" | "PLAYING" | "ROUND_WON" | "GAME_OVER" | "VICTORY";

export type BlindType = "SMALL" | "BIG" | "BOSS";

export interface RunState {
  seed: string;
  ante: number;
  /** Rounds completed + 1. */
  round: number;
  winningAnte: number;
}

export interface RoundState {
  blindType: BlindType;
  targetScore: number;
  currentScore: number;
}

export interface PlayerState {
  money: number;
  handSize: number;
  maxHands: number;
  maxDiscards: number;
  handsRemaining: number;
  discardsRemaining: number;
}

/**
 * The entire game is this plain, serialisable object.
 * Save = JSON.stringify(state). Replay = seed + action list.
 */
export interface GameState {
  schemaVersion: 1;
  status: GameStatus;

  rng: RngState;
  nextCardId: number;

  run: RunState;
  round: RoundState;
  player: PlayerState;
  deck: DeckState;

  handLevels: HandLevels;
  /** Hand-recognition rules derived from active modifiers (Jokers etc.). */
  rules: EvaluationRules;
}
