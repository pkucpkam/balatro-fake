import { create } from "zustand";
import { GameEngine } from "@/engine/core/GameEngine";
import { InvalidActionError } from "@/engine/core/GameReducer";
import type { GameAction } from "@/engine/core/GameAction";
import type { GameEvent } from "@/engine/core/GameEvent";
import type { GameState } from "@/engine/core/GameState";
import { MAX_PLAYED_CARDS } from "@/engine/poker/HandEvaluator";

/**
 * Application layer: React <-> Engine bridge.
 * - Game rules live in the engine; this store only dispatches and mirrors state.
 * - `selectedCardIds` is UI state (not part of GameState, not replayed).
 */
interface GameStore {
  game: GameState;
  selectedCardIds: string[];
  /** Events from the last action — consumed by the animation layer in Phase 5. */
  lastEvents: GameEvent[];
  eventLog: GameEvent[];
  error: string | null;

  dispatch: (action: GameAction) => void;
  toggleCard: (cardId: string) => void;
  clearSelection: () => void;
  exportReplay: () => string;
}

const engine = new GameEngine();

export const useGameStore = create<GameStore>((set, get) => ({
  game: engine.state,
  selectedCardIds: [],
  lastEvents: [],
  eventLog: [],
  error: null,

  dispatch: (action) => {
    try {
      const events = engine.dispatch(action);
      set((s) => ({
        game: engine.state,
        lastEvents: events,
        eventLog: action.type === "START_RUN" ? events : [...s.eventLog, ...events].slice(-200),
        selectedCardIds: action.type === "SORT_HAND" ? s.selectedCardIds : [],
        error: null,
      }));
    } catch (err) {
      if (err instanceof InvalidActionError) set({ error: err.message });
      else throw err;
    }
  },

  toggleCard: (cardId) => {
    const { selectedCardIds } = get();
    if (selectedCardIds.includes(cardId)) {
      set({ selectedCardIds: selectedCardIds.filter((id) => id !== cardId) });
    } else if (selectedCardIds.length < MAX_PLAYED_CARDS) {
      set({ selectedCardIds: [...selectedCardIds, cardId] });
    }
  },

  clearSelection: () => set({ selectedCardIds: [] }),

  exportReplay: () => JSON.stringify(engine.actionLog),
}));
