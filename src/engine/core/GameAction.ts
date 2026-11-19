/**
 * Every player intent that can change GameState.
 * Actions are plain data so a run can be replayed from (seed, actions[]).
 * UI-only state (hover, current selection) is NOT an action.
 */
export type GameAction =
  | { type: "START_RUN"; seed: string }
  | { type: "PLAY_HAND"; cardIds: string[] }
  | { type: "DISCARD"; cardIds: string[] }
  | { type: "SORT_HAND"; by: "RANK" | "SUIT" }
  /** Temporary until consumables (Phase 6): directly apply a planet. */
  | { type: "USE_PLANET"; planetId: string }
  /** Temporary until Shop/Blind select (Phase 4): advance to next blind. */
  | { type: "NEXT_ROUND" };

export type GameActionType = GameAction["type"];
