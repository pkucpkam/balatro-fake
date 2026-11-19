import type { GameAction } from "./GameAction";
import type { GameEvent } from "./GameEvent";
import type { GameState } from "./GameState";
import { createMenuState, reduce } from "./GameReducer";

/**
 * Thin stateful wrapper around the pure reducer.
 * Keeps the action log so a run can be saved as (actions[]) and replayed exactly.
 * Has no React dependency — the UI store wraps it.
 */
export class GameEngine {
  private _state: GameState;
  private readonly _log: GameAction[] = [];

  constructor(initial: GameState = createMenuState()) {
    this._state = initial;
  }

  get state(): GameState {
    return this._state;
  }

  get actionLog(): readonly GameAction[] {
    return this._log;
  }

  dispatch(action: GameAction): GameEvent[] {
    const { state, events } = reduce(this._state, action);
    this._state = state;
    if (action.type === "START_RUN") this._log.length = 0;
    this._log.push(action);
    return events;
  }

  /** Rebuild a run from its action log. The first action must be START_RUN. */
  static replay(actions: readonly GameAction[]): GameEngine {
    if (actions[0]?.type !== "START_RUN") throw new Error("replay: log must start with START_RUN");
    const engine = new GameEngine();
    for (const a of actions) engine.dispatch(a);
    return engine;
  }
}
