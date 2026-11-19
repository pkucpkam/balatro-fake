import type { PlayingCard } from "../cards/Card";
import type { Effect, ScoringContext } from "../effects/types";
import type { GameState, JokerInstance } from "../core/GameState";
import type { ScoreStepKind, ScoreStepSource, GameEvent } from "../core/GameEvent";
import type { PokerHandResult } from "../poker/HandEvaluator";
import { getHandValues, levelUpHand } from "../poker/HandLevels";
import { HAND_BASE } from "../poker/HandRank";
import { cardBaseChips } from "../poker/HandScorer";
import type { SeededRng } from "../rng/SeededRng";
import { JOKER_REGISTRY } from "@/content/jokers/jokers";
import { BOSS_REGISTRY } from "@/content/blinds/bosses";

export type ScoreStepEvent = Extract<GameEvent, { type: "SCORE_STEP" }>;

export interface ScoreOutcome {
  baseChips: number;
  baseMult: number;
  level: number;
  steps: ScoreStepEvent[];
  chips: number;
  mult: number;
  score: number;
  destroyedCardIds: string[];
  blocked: boolean;
}

/** Avoid 1.5 * 1.5 * … drifting into 2.2500000000000004. */
const tidy = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Scoring Pipeline (Balatro order):
 *  1. boss checks + "before" joker hooks
 *  2. base chips/mult of the hand level
 *  3. each scoring card left→right (with retriggers): chips, enhancement, edition, seal, joker on-score
 *  4. each card held in hand: Steel, joker on-held (with retriggers)
 *  5. each joker left→right: edition (+chips/+mult), own effect, Polychrome
 *  6. score = floor(chips × mult); then "after" hooks and Glass breaking
 *
 * Mutates `state` (joker counters, money, hand level for The Arm). Every
 * visible change is recorded as a SCORE_STEP so the UI can replay it.
 */
export function runScoring(
  state: GameState,
  played: readonly PlayingCard[],
  result: PokerHandResult,
  rng: SeededRng,
): ScoreOutcome {
  const steps: ScoreStepEvent[] = [];
  const handType = result.handType;
  const boss = state.round.bossId ? BOSS_REGISTRY[state.round.bossId] : undefined;
  const byId = new Map(played.map((c) => [c.id, c]));
  const scoring = result.scoringCardIds.map((id) => byId.get(id)).filter((c): c is PlayingCard => !!c);
  const held = state.deck.hand.slice();
  const jokers = state.jokers;
  const ctx: ScoringContext = { state, played, scoring, held, result, handType, rng };

  let chips = 0;
  let mult = 0;

  const push = (source: ScoreStepSource, sourceId: string | null, kind: ScoreStepKind, amount: number, text: string) =>
    steps.push({ type: "SCORE_STEP", source, sourceId, kind, amount, text, chips, mult: tidy(mult) });

  const apply = (source: ScoreStepSource, sourceId: string | null, eff: Effect | null | undefined): boolean => {
    if (!eff) return false;
    let any = false;
    if (eff.chips) {
      chips += eff.chips;
      push(source, sourceId, "CHIPS", eff.chips, `+${eff.chips}`);
      any = true;
    }
    if (eff.mult) {
      mult = tidy(mult + eff.mult);
      push(source, sourceId, "MULT", eff.mult, `+${eff.mult} Mult`);
      any = true;
    }
    if (eff.xMult !== undefined && eff.xMult !== 1) {
      mult = tidy(mult * eff.xMult);
      push(source, sourceId, "XMULT", eff.xMult, `X${eff.xMult} Mult`);
      any = true;
    }
    if (eff.money) {
      state.player.money += eff.money;
      push(source, sourceId, "MONEY", eff.money, `+$${eff.money}`);
      any = true;
    }
    if (!any && eff.text) {
      push(source, sourceId, "MESSAGE", 0, eff.text);
      any = true;
    }
    return any;
  };

  // --- 1. Boss rules --------------------------------------------------------
  let blocked = false;
  if (boss?.mustPlayFive && played.length < 5) blocked = true;
  if (boss?.noRepeatHands && state.round.playedHandTypes.includes(handType)) blocked = true;
  const firstType = state.round.playedHandTypes[0];
  if (boss?.singleHandType && firstType !== undefined && firstType !== handType) blocked = true;

  if (boss?.lowersLevel && state.handLevels[handType].level > 1) {
    levelUpHand(state.handLevels, handType, -1);
    push("BOSS", boss.id, "MESSAGE", 0, `${HAND_BASE[handType].name} level down`);
  }

  state.handLevels[handType].timesPlayed += 1;
  const level = state.handLevels[handType].level;
  let { chips: baseChips, mult: baseMult } = getHandValues(state.handLevels, handType);
  if (boss?.halveBase) {
    baseChips = Math.floor(baseChips / 2);
    baseMult = Math.max(1, Math.floor(baseMult / 2));
  }

  if (blocked) {
    push("BOSS", boss?.id ?? null, "MESSAGE", 0, "Not allowed!");
    return { baseChips, baseMult, level, steps, chips: 0, mult: 0, score: 0, destroyedCardIds: [], blocked };
  }

  for (const j of jokers) apply("JOKER", j.id, JOKER_REGISTRY[j.defId]?.beforeScoring?.(ctx, j));

  // --- 2. Base -------------------------------------------------------------
  chips = baseChips;
  mult = baseMult;
  push("HAND", null, "BASE", 0, HAND_BASE[handType].name);

  const retriggers = (card: PlayingCard, zone: "PLAYED" | "HELD") =>
    (card.seal === "RED" ? 1 : 0) +
    jokers.reduce((n, j) => n + (JOKER_REGISTRY[j.defId]?.retrigger?.(ctx, card, zone, j) ?? 0), 0);

  // --- 3. Scoring cards ----------------------------------------------------
  const triggeredGlass: PlayingCard[] = [];
  for (const card of scoring) {
    if (card.debuffed) {
      push("CARD", card.id, "DEBUFFED", 0, "Debuffed");
      continue;
    }
    const times = 1 + retriggers(card, "PLAYED");
    for (let t = 0; t < times; t++) {
      if (t > 0) push("CARD", card.id, "RETRIGGER", 0, "Again!");
      apply("CARD", card.id, { chips: cardBaseChips(card) });
      switch (card.enhancement) {
        case "BONUS":
          apply("CARD", card.id, { chips: 30 });
          break;
        case "MULT":
          apply("CARD", card.id, { mult: 4 });
          break;
        case "GLASS":
          apply("CARD", card.id, { xMult: 2 });
          if (t === 0) triggeredGlass.push(card);
          break;
        case "LUCKY": {
          const m = rng.chance(1 / 5);
          const $ = rng.chance(1 / 15);
          apply("CARD", card.id, { mult: m ? 20 : 0, money: $ ? 20 : 0 });
          break;
        }
        default:
          break;
      }
      if (card.edition === "FOIL") apply("CARD", card.id, { chips: 50 });
      if (card.edition === "HOLOGRAPHIC") apply("CARD", card.id, { mult: 10 });
      if (card.edition === "POLYCHROME") apply("CARD", card.id, { xMult: 1.5 });
      if (card.seal === "GOLD") apply("CARD", card.id, { money: 3 });
      for (const j of jokers) apply("JOKER", j.id, JOKER_REGISTRY[j.defId]?.onCardScored?.(ctx, card, j));
    }
  }

  // --- 4. Held in hand -----------------------------------------------------
  for (const card of held) {
    if (card.debuffed) continue;
    const effectsOnce = (): [string, Effect][] => {
      const list: [string, Effect][] = [];
      if (card.enhancement === "STEEL") list.push([card.id, { xMult: 1.5 }]);
      for (const j of jokers) {
        const e = JOKER_REGISTRY[j.defId]?.onHeld?.(ctx, card, j);
        if (e) list.push([j.id, e]);
      }
      return list;
    };
    if (effectsOnce().length === 0) continue;
    const times = 1 + retriggers(card, "HELD");
    for (let t = 0; t < times; t++) {
      if (t > 0) push("HELD", card.id, "RETRIGGER", 0, "Again!");
      for (const [src, eff] of effectsOnce()) apply(src === card.id ? "HELD" : "JOKER", src, eff);
    }
  }

  // --- 5. Jokers -----------------------------------------------------------
  for (const j of jokers) {
    if (j.edition === "FOIL") apply("JOKER", j.id, { chips: 50 });
    if (j.edition === "HOLOGRAPHIC") apply("JOKER", j.id, { mult: 10 });
    apply("JOKER", j.id, JOKER_REGISTRY[j.defId]?.main?.(ctx, j));
    if (j.edition === "POLYCHROME") apply("JOKER", j.id, { xMult: 1.5 });
  }

  const score = Math.floor(chips * mult);

  // --- 6. After ------------------------------------------------------------
  for (const j of jokers) JOKER_REGISTRY[j.defId]?.afterScoring?.(ctx, j as JokerInstance);
  const destroyedCardIds: string[] = [];
  for (const g of triggeredGlass) {
    if (rng.chance(1 / 4)) {
      destroyedCardIds.push(g.id);
      push("CARD", g.id, "DESTROY", 0, "Shattered!");
    }
  }

  return { baseChips, baseMult, level, steps, chips, mult: tidy(mult), score, destroyedCardIds, blocked };
}
