import type { BlindType } from "../core/GameState";

/** White Stake score table. */
export const ANTE_BASE_CHIPS: readonly number[] = [300, 800, 2000, 5000, 11000, 20000, 35000, 50000];

export const BLIND_MULTIPLIER: Record<BlindType, number> = { SMALL: 1, BIG: 1.5, BOSS: 2 };

export const BLIND_REWARD: Record<BlindType, number> = { SMALL: 3, BIG: 4, BOSS: 5 };

export const BLIND_ORDER: readonly BlindType[] = ["SMALL", "BIG", "BOSS"];

export const INTEREST_STEP = 5;
export const INTEREST_CAP = 5;

/** Base for antes beyond the table grows ~1.6x per ante (endless-ish safety). */
export function anteBase(ante: number): number {
  if (ante < 1) throw new Error(`blindTarget: invalid ante ${ante}`);
  const last = ANTE_BASE_CHIPS[ANTE_BASE_CHIPS.length - 1] as number;
  return ANTE_BASE_CHIPS[ante - 1] ?? Math.floor(last * 1.6 ** (ante - ANTE_BASE_CHIPS.length));
}

export function blindTarget(ante: number, blind: BlindType, bossScoreMult?: number): number {
  const mult = blind === "BOSS" ? (bossScoreMult ?? BLIND_MULTIPLIER.BOSS) : BLIND_MULTIPLIER[blind];
  return Math.floor(anteBase(ante) * mult);
}
