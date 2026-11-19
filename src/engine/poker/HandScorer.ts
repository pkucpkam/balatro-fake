import { RANK_CHIPS, STONE_CARD_CHIPS, isStone, type PlayingCard } from "../cards/Card";
import { getHandValues, type HandLevels } from "./HandLevels";
import type { PokerHandResult } from "./HandEvaluator";

/**
 * Chip value a single card contributes when it scores.
 * Enhancements beyond Stone, editions and seals are handled by the
 * Scoring Pipeline in Phase 3 — this is only the card's intrinsic value.
 */
export function cardBaseChips(card: PlayingCard): number {
  if (card.debuffed) return 0;
  const base = isStone(card) ? STONE_CARD_CHIPS : RANK_CHIPS[card.rank];
  return base + card.bonusChips;
}

export interface BasicScoreBreakdown {
  handChips: number;
  handMult: number;
  cardChips: { cardId: string; chips: number }[];
  chips: number;
  mult: number;
  score: number;
}

/**
 * Phase 2 scorer: hand level + scoring cards, no Jokers.
 * Will be superseded by engine/scoring/ScoringPipeline in Phase 3,
 * which starts from exactly this breakdown.
 */
export function scoreBasic(
  result: PokerHandResult,
  played: readonly PlayingCard[],
  levels: HandLevels,
): BasicScoreBreakdown {
  const { chips: handChips, mult: handMult } = getHandValues(levels, result.handType);
  const byId = new Map(played.map((c) => [c.id, c]));

  const cardChips = result.scoringCardIds.map((id) => {
    const card = byId.get(id);
    if (!card) throw new Error(`scoreBasic: scoring card ${id} not in played cards`);
    return { cardId: id, chips: cardBaseChips(card) };
  });

  const chips = handChips + cardChips.reduce((sum, c) => sum + c.chips, 0);
  const mult = handMult;
  return { handChips, handMult, cardChips, chips, mult, score: Math.floor(chips * mult) };
}
