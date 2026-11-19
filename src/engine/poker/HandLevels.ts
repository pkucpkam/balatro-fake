import { HAND_BASE, POKER_HANDS, type PokerHandType } from "./HandRank";

export interface HandLevelEntry {
  level: number;
  timesPlayed: number;
}

export type HandLevels = Record<PokerHandType, HandLevelEntry>;

export function createInitialHandLevels(): HandLevels {
  const levels = {} as HandLevels;
  for (const hand of POKER_HANDS) levels[hand] = { level: 1, timesPlayed: 0 };
  return levels;
}

/** Base chips & mult for a hand at its current level. Level can drop below 1 (e.g. The Arm boss). */
export function getHandValues(levels: HandLevels, hand: PokerHandType): { chips: number; mult: number } {
  const base = HAND_BASE[hand];
  const extra = levels[hand].level - 1;
  return {
    chips: Math.max(0, base.chips + base.chipsPerLevel * extra),
    mult: Math.max(1, base.mult + base.multPerLevel * extra),
  };
}

export function levelUpHand(levels: HandLevels, hand: PokerHandType, amount = 1): void {
  levels[hand].level = Math.max(1, levels[hand].level + amount);
}
