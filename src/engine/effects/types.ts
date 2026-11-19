import type { PlayingCard } from "../cards/Card";
import type { GameState, JokerInstance } from "../core/GameState";
import type { EvaluationRules, PokerHandResult } from "../poker/HandEvaluator";
import type { PokerHandType } from "../poker/HandRank";
import type { SeededRng } from "../rng/SeededRng";

/** What a single trigger contributes. Applied in order: chips → mult → xMult → money. */
export interface Effect {
  chips?: number;
  mult?: number;
  xMult?: number;
  money?: number;
  /** Optional text shown instead of the default "+N" popup. */
  text?: string;
}

/**
 * Read-mostly view of the hand being scored.
 * `state` is the live draft: hooks may only touch their own JokerInstance.
 */
export interface ScoringContext {
  readonly state: GameState;
  readonly played: readonly PlayingCard[];
  readonly scoring: readonly PlayingCard[];
  readonly held: readonly PlayingCard[];
  readonly result: PokerHandResult;
  readonly handType: PokerHandType;
  readonly rng: SeededRng;
}

export type Rarity = "COMMON" | "UNCOMMON" | "RARE";

export interface JokerDefinition {
  id: string;
  name: string;
  rarity: Rarity;
  cost: number;
  description: string;
  /** Visual identity for the UI (glyph + hue). Pure data, no rendering code. */
  art: { glyph: string; hue: number };
  /** Live value shown on the card, e.g. "+6 Mult". */
  status?(self: JokerInstance, state: GameState): string | null;

  rules?: Partial<EvaluationRules>;
  passive?: { handSize?: number; hands?: number; discards?: number };

  /** Runs before any scoring (Green Joker upgrade, Ride the Bus reset…). */
  beforeScoring?(ctx: ScoringContext, self: JokerInstance): Effect | null;
  /** Per scoring card, each time it triggers. */
  onCardScored?(ctx: ScoringContext, card: PlayingCard, self: JokerInstance): Effect | null;
  /** Extra triggers for a card. */
  retrigger?(ctx: ScoringContext, card: PlayingCard, zone: "PLAYED" | "HELD", self: JokerInstance): number;
  /** Per card held in hand. */
  onHeld?(ctx: ScoringContext, card: PlayingCard, self: JokerInstance): Effect | null;
  /** The joker's own (independent) trigger, left to right. */
  main?(ctx: ScoringContext, self: JokerInstance): Effect | null;
  afterScoring?(ctx: ScoringContext, self: JokerInstance): void;

  onDiscard?(state: GameState, cards: readonly PlayingCard[], self: JokerInstance): Effect | null;
  /** Money paid at cash out. */
  onRoundEnd?(state: GameState, self: JokerInstance): number;
}

export interface TarotDefinition {
  id: string;
  name: string;
  description: string;
  glyph: string;
  /** Number of selected hand cards required. 0 = usable anytime. */
  minTargets: number;
  maxTargets: number;
}

/** Capabilities a Tarot may use. Provided by the engine. */
export interface TarotApi {
  readonly state: GameState;
  /** Selected cards in hand, left to right (live draft objects). */
  readonly targets: PlayingCard[];
  readonly rng: SeededRng;
  addRandomJoker(): boolean;
  addRandomTarot(): boolean;
  destroyCards(ids: readonly string[]): void;
}

export interface TarotWithApply extends TarotDefinition {
  apply(api: TarotApi): string;
}
