/**
 * Deterministic, serializable PRNG.
 *
 * - Seed string -> 128-bit state via cyrb128.
 * - Generator: sfc32 (fast, good statistical quality, 4×uint32 state).
 *
 * The state is a plain tuple so it can live inside GameState, be saved,
 * and be restored exactly. Engine code never touches Math.random().
 */

export type RngState = readonly [number, number, number, number];

/** Hash an arbitrary string into a 128-bit seed. */
export function seedFromString(seed: string): RngState {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * Mutable cursor over an RngState. Create one per engine step,
 * use it, then write `rng.state` back into GameState.
 */
export class SeededRng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    [this.a, this.b, this.c, this.d] = state;
  }

  static fromSeed(seed: string): SeededRng {
    const rng = new SeededRng(seedFromString(seed));
    // Warm up: discard the first outputs to decorrelate similar seeds.
    for (let i = 0; i < 15; i++) rng.nextUint32();
    return rng;
  }

  get state(): RngState {
    return [this.a, this.b, this.c, this.d];
  }

  /** Raw 32-bit unsigned integer (sfc32). */
  nextUint32(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`rng.int: max (${max}) < min (${min})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Uniformly pick one element. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("rng.pick: empty array");
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Returns true with probability p. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Fisher–Yates shuffle, returns a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }
}
