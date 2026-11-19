import type { BlindType } from "../core/GameState";

/**
 * Minimal blind table (White Stake). Phase 4 replaces this with a Blind
 * Manager + content registry (boss effects, stakes, skip tags).
 */
export const ANTE_BASE_CHIPS: readonly number[] = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];

export const BLIND_MULTIPLIER: Record<BlindType, number> = { SMALL: 1, BIG: 1.5, BOSS: 2 };

export const BLIND_REWARD: Record<BlindType, number> = { SMALL: 3, BIG: 4, BOSS: 5 };

export const BLIND_ORDER: readonly BlindType[] = ["SMALL", "BIG", "BOSS"];

export function blindTarget(ante: number, blind: BlindType): number {
  const base = ANTE_BASE_CHIPS[Math.min(ante, ANTE_BASE_CHIPS.length) - 1];
  if (base === undefined) throw new Error(`blindTarget: invalid ante ${ante}`);
  return Math.floor(base * BLIND_MULTIPLIER[blind]);
}
