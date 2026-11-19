/**
 * Every player intent that can change GameState.
 * Actions are plain data so a run can be replayed from (seed, actions[]).
 * UI-only state (hover, current selection) is NOT an action.
 */
export type GameAction =
  | { type: "START_RUN"; seed: string }
  | { type: "SELECT_BLIND" }
  | { type: "PLAY_HAND"; cardIds: string[] }
  | { type: "DISCARD"; cardIds: string[] }
  | { type: "SORT_HAND"; by: "RANK" | "SUIT" }
  /** Reorder hand cards (drag & drop). Must be a permutation of the hand. */
  | { type: "REORDER_HAND"; cardIds: string[] }
  | { type: "USE_CONSUMABLE"; consumableId: string; targetCardIds?: string[] }
  | { type: "SELL_CONSUMABLE"; consumableId: string }
  | { type: "SELL_JOKER"; jokerId: string }
  | { type: "MOVE_JOKER"; jokerId: string; toIndex: number }
  | { type: "CASH_OUT" }
  | { type: "BUY"; itemId: string }
  | { type: "REROLL" }
  | { type: "LEAVE_SHOP" };

export type GameActionType = GameAction["type"];
