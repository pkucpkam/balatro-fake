import { SeededRng, seedFromString } from "@/engine/rng/SeededRng";

describe("SeededRng", () => {
  it("produces the same sequence for the same seed", () => {
    const a = SeededRng.fromSeed("ABC123");
    const b = SeededRng.fromSeed("ABC123");
    for (let i = 0; i < 1000; i++) expect(a.nextUint32()).toBe(b.nextUint32());
  });

  it("produces different sequences for different seeds", () => {
    const a = SeededRng.fromSeed("seed-1");
    const b = SeededRng.fromSeed("seed-2");
    const seqA = Array.from({ length: 10 }, () => a.nextUint32());
    const seqB = Array.from({ length: 10 }, () => b.nextUint32());
    expect(seqA).not.toEqual(seqB);
  });

  it("can be resumed exactly from a saved state", () => {
    const a = SeededRng.fromSeed("resume");
    for (let i = 0; i < 37; i++) a.next();
    const saved = JSON.parse(JSON.stringify(a.state));
    const b = new SeededRng(saved);
    for (let i = 0; i < 100; i++) expect(b.next()).toBe(a.next());
  });

  it("next() stays in [0, 1) and int() stays in bounds", () => {
    const rng = SeededRng.fromSeed("bounds");
    for (let i = 0; i < 10000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it("int() is roughly uniform", () => {
    const rng = SeededRng.fromSeed("uniform");
    const counts = [0, 0, 0, 0, 0, 0];
    const N = 60000;
    for (let i = 0; i < N; i++) counts[rng.int(0, 5)]! += 1;
    for (const c of counts) expect(Math.abs(c - N / 6)).toBeLessThan(N * 0.01);
  });

  it("shuffle returns a permutation and does not mutate input", () => {
    const input = Array.from({ length: 52 }, (_, i) => i);
    const copy = input.slice();
    const out = SeededRng.fromSeed("perm").shuffle(input);
    expect(input).toEqual(copy);
    expect(out).not.toEqual(input);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
  });

  it("seedFromString is stable", () => {
    expect(seedFromString("balatro")).toEqual(seedFromString("balatro"));
  });
});
