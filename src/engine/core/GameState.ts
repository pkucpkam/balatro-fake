import type { EditionType } from "../cards/Card";
import type { DeckState } from "../deck/Deck";
import type { HandLevels } from "../poker/HandLevels";
import type { EvaluationRules } from "../poker/HandEvaluator";
import type { PokerHandType } from "../poker/HandRank";
import type { RngState } from "../rng/SeededRng";

export type GameStatus = "MENU" | "BLIND_SELECT" | "PLAYING" | "ROUND_WON" | "SHOP" | "GAME_OVER" | "VICTORY";

export type BlindType = "SMALL" | "BIG" | "BOSS";

export interface RunState {
  seed: string;
  ante: number;
  /** Rounds completed + 1. */
  round: number;
  winningAnte: number;
  /** Boss of the current ante (chosen when the ante starts). */
  bossId: string;
  usedBossIds: string[];
  bestHandScore: number;
  handsPlayedTotal: number;
}

export interface RoundState {
  blindType: BlindType;
  targetScore: number;
  currentScore: number;
  /** Boss active this round (only for BOSS blinds). */
  bossId: string | null;
  handSize: number;
  handsPlayed: number;
  discardsUsed: number;
  playedHandTypes: PokerHandType[];
  lastHandType: PokerHandType | null;
}

export interface PlayerState {
  money: number;
  handSize: number;
  maxHands: number;
  maxDiscards: number;
  handsRemaining: number;
  discardsRemaining: number;
  jokerSlots: number;
  consumableSlots: number;
}

export interface JokerInstance {
  readonly id: string;
  defId: string;
  edition?: EditionType;
  /** Generic per-joker counter (Green Joker mult, Ride the Bus streak…). */
  counter: number;
  sellValue: number;
}

export type ConsumableKind = "PLANET" | "TAROT";

export interface ConsumableInstance {
  readonly id: string;
  kind: ConsumableKind;
  defId: string;
}

export type ShopItem =
  | { id: string; kind: "JOKER"; defId: string; edition?: EditionType; cost: number }
  | { id: string; kind: ConsumableKind; defId: string; cost: number };

export interface ShopState {
  items: ShopItem[];
  rerollCost: number;
}

export interface CashOutLine {
  label: string;
  amount: number;
}

export interface CashOutState {
  lines: CashOutLine[];
  total: number;
}

/**
 * The entire game is this plain, serialisable object.
 * Save = JSON.stringify(state). Replay = seed + action list.
 */
export interface GameState {
  schemaVersion: 2;
  status: GameStatus;

  rng: RngState;
  nextCardId: number;
  /** Counter for joker / consumable / shop item ids. */
  nextId: number;

  run: RunState;
  round: RoundState;
  player: PlayerState;
  deck: DeckState;
  jokers: JokerInstance[];
  consumables: ConsumableInstance[];
  shop: ShopState | null;
  cashOut: CashOutState | null;

  handLevels: HandLevels;
  /** Hand-recognition rules derived from active Jokers. */
  rules: EvaluationRules;
}
