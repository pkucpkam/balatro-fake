import type { GameAction } from "@/engine/core/GameAction";
import type { GameState } from "@/engine/core/GameState";

/**
 * Bump when engine rules/content change in a way that makes old action logs
 * replay differently. Saves with another version are not resumed.
 */
export const SAVE_VERSION = 1;

/** A resumable run: the action log replays it exactly (engine is deterministic). */
export interface RunSave {
  version: number;
  seed: string;
  actions: GameAction[];
  /** Client epoch ms of the last change; used to pick the newer of local/cloud. */
  updatedAt: number;
}

/** Accepts the current object format and the legacy v2 format (bare action array). */
export function parseRunSave(raw: unknown): RunSave | null {
  if (Array.isArray(raw)) {
    const first = raw[0] as GameAction | undefined;
    if (first?.type !== "START_RUN") return null;
    return { version: SAVE_VERSION, seed: first.seed, actions: raw as GameAction[], updatedAt: 0 };
  }
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<RunSave>;
  if (!Array.isArray(r.actions) || r.actions[0]?.type !== "START_RUN") return null;
  if (r.version !== SAVE_VERSION) return null;
  return {
    version: r.version,
    seed: typeof r.seed === "string" ? r.seed : r.actions[0].seed,
    actions: r.actions,
    updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : 0,
  };
}

export type SaveChoice = "local" | "cloud" | "none";

/** Newest wins; on a tie prefer local (it is what this device just played). */
export function pickNewerSave(local: RunSave | null, cloud: RunSave | null): SaveChoice {
  if (!local && !cloud) return "none";
  if (!cloud) return "local";
  if (!local) return "cloud";
  return cloud.updatedAt > local.updatedAt ? "cloud" : "local";
}

export interface PlayerStats {
  runsPlayed: number;
  runsWon: number;
  handsPlayed: number;
  bestHandScore: number;
  highestAnte: number;
}

export const EMPTY_STATS: PlayerStats = { runsPlayed: 0, runsWon: 0, handsPlayed: 0, bestHandScore: 0, highestAnte: 0 };

export interface RunSummary {
  version: number;
  seed: string;
  result: "WIN" | "LOSE";
  ante: number;
  round: number;
  bestHandScore: number;
  handsPlayed: number;
  money: number;
  jokers: string[];
  actionCount: number;
  endedAt: number;
}

export function summarizeRun(state: GameState, actionCount: number, now: number): RunSummary {
  return {
    version: SAVE_VERSION,
    seed: state.run.seed,
    result: state.status === "VICTORY" ? "WIN" : "LOSE",
    ante: state.run.ante,
    round: state.run.round,
    bestHandScore: state.run.bestHandScore,
    handsPlayed: state.run.handsPlayedTotal,
    money: state.player.money,
    jokers: state.jokers.map((j) => j.defId),
    actionCount,
    endedAt: now,
  };
}

export function applyRunToStats(stats: PlayerStats, run: RunSummary): PlayerStats {
  return {
    runsPlayed: stats.runsPlayed + 1,
    runsWon: stats.runsWon + (run.result === "WIN" ? 1 : 0),
    handsPlayed: stats.handsPlayed + run.handsPlayed,
    bestHandScore: Math.max(stats.bestHandScore, run.bestHandScore),
    highestAnte: Math.max(stats.highestAnte, run.ante),
  };
}
