import { GameEngine } from "@/engine/core/GameEngine";
import {
  EMPTY_STATS,
  SAVE_VERSION,
  applyRunToStats,
  parseRunSave,
  pickNewerSave,
  summarizeRun,
  type RunSave,
} from "@/services/saveFormat";

const save = (updatedAt: number, seed = "ABC"): RunSave => ({
  version: SAVE_VERSION,
  seed,
  actions: [{ type: "START_RUN", seed }],
  updatedAt,
});

describe("parseRunSave", () => {
  it("reads the legacy bare action array", () => {
    const r = parseRunSave([{ type: "START_RUN", seed: "OLD" }, { type: "SELECT_BLIND" }]);
    expect(r).toMatchObject({ seed: "OLD", updatedAt: 0, version: SAVE_VERSION });
    expect(r?.actions).toHaveLength(2);
  });

  it("reads the object format", () => {
    expect(parseRunSave(save(42))).toEqual(save(42));
  });

  it("rejects garbage, logs without START_RUN and other versions", () => {
    expect(parseRunSave(null)).toBeNull();
    expect(parseRunSave("x")).toBeNull();
    expect(parseRunSave([{ type: "SELECT_BLIND" }])).toBeNull();
    expect(parseRunSave({ ...save(1), version: SAVE_VERSION + 1 })).toBeNull();
  });
});

describe("pickNewerSave", () => {
  it("picks whichever exists, then the newest, local on ties", () => {
    expect(pickNewerSave(null, null)).toBe("none");
    expect(pickNewerSave(save(1), null)).toBe("local");
    expect(pickNewerSave(null, save(1))).toBe("cloud");
    expect(pickNewerSave(save(1), save(2))).toBe("cloud");
    expect(pickNewerSave(save(3), save(2))).toBe("local");
    expect(pickNewerSave(save(2), save(2))).toBe("local");
  });
});

describe("run summary & stats", () => {
  it("summarizes a run and folds it into the totals", () => {
    const engine = new GameEngine();
    engine.dispatch({ type: "START_RUN", seed: "STATS" });
    const summary = summarizeRun(engine.state, engine.actionLog.length, 1000);
    expect(summary).toMatchObject({ seed: "STATS", result: "LOSE", ante: 1, actionCount: 1, endedAt: 1000 });

    const once = applyRunToStats(EMPTY_STATS, { ...summary, bestHandScore: 500, handsPlayed: 4, ante: 2 });
    const twice = applyRunToStats(once, { ...summary, result: "WIN", bestHandScore: 300, handsPlayed: 3, ante: 1 });
    expect(twice).toEqual({ runsPlayed: 2, runsWon: 1, handsPlayed: 7, bestHandScore: 500, highestAnte: 2 });
  });
});
