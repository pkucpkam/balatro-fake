import type { EditionType } from "../cards/Card";
import type { Rarity } from "../effects/types";
import type { GameState, ShopItem } from "../core/GameState";
import type { SeededRng } from "../rng/SeededRng";
import { JOKERS, JOKER_REGISTRY } from "@/content/jokers/jokers";
import { TAROTS } from "@/content/tarots/tarots";
import { PLANETS } from "@/content/planets/planets";

export const SHOP_SLOTS = 2;
export const BASE_REROLL_COST = 5;
export const TAROT_COST = 3;
export const PLANET_COST = 3;

const RARITY_WEIGHT: [Rarity, number][] = [
  ["COMMON", 70],
  ["UNCOMMON", 25],
  ["RARE", 5],
];

const EDITION_COST: Record<EditionType, number> = { FOIL: 2, HOLOGRAPHIC: 3, POLYCHROME: 5, NEGATIVE: 5 };

function weighted<T>(rng: SeededRng, entries: readonly [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r < 0) return v;
  }
  return (entries[entries.length - 1] as [T, number])[0];
}

export function nextId(state: GameState, prefix: string): string {
  const id = `${prefix}-${state.nextId}`;
  state.nextId += 1;
  return id;
}

/** Random joker id not already owned (and not in `exclude`). */
export function rollJokerId(state: GameState, rng: SeededRng, exclude: readonly string[] = []): string {
  const owned = new Set([...state.jokers.map((j) => j.defId), ...exclude]);
  const rarity = weighted(rng, RARITY_WEIGHT);
  let pool = JOKERS.filter((j) => j.rarity === rarity && !owned.has(j.id));
  if (pool.length === 0) pool = JOKERS.filter((j) => !owned.has(j.id));
  if (pool.length === 0) pool = [...JOKERS];
  return rng.pick(pool).id;
}

export function rollEdition(rng: SeededRng): EditionType | undefined {
  const r = rng.next();
  if (r < 0.003) return "POLYCHROME";
  if (r < 0.017) return "HOLOGRAPHIC";
  if (r < 0.04) return "FOIL";
  return undefined;
}

export function rollTarotId(rng: SeededRng, exclude: readonly string[] = []): string {
  const pool = TAROTS.filter((t) => !exclude.includes(t.id));
  return rng.pick(pool.length ? pool : TAROTS).id;
}

export function rollPlanetId(state: GameState, rng: SeededRng, exclude: readonly string[] = []): string {
  const pool = PLANETS.filter(
    (p) => (!p.requiresHandPlayed || state.handLevels[p.hand].timesPlayed > 0) && !exclude.includes(p.id),
  );
  return rng.pick(pool.length ? pool : PLANETS.filter((p) => !p.requiresHandPlayed)).id;
}

export function jokerCost(defId: string, edition?: EditionType): number {
  const base = JOKER_REGISTRY[defId]?.cost ?? 4;
  return base + (edition ? EDITION_COST[edition] : 0);
}

export function sellValueOf(cost: number): number {
  return Math.max(1, Math.floor(cost / 2));
}

export function generateShopItems(state: GameState, rng: SeededRng, n = SHOP_SLOTS): ShopItem[] {
  const items: ShopItem[] = [];
  for (let i = 0; i < n; i++) {
    const kind = weighted<ShopItem["kind"]>(rng, [
      ["JOKER", 20],
      ["TAROT", 4],
      ["PLANET", 4],
    ]);
    const taken = items.map((it) => it.defId);
    if (kind === "JOKER") {
      const defId = rollJokerId(state, rng, taken);
      const edition = rollEdition(rng);
      items.push({ id: nextId(state, "s"), kind, defId, edition, cost: jokerCost(defId, edition) });
    } else if (kind === "TAROT") {
      items.push({ id: nextId(state, "s"), kind, defId: rollTarotId(rng, taken), cost: TAROT_COST });
    } else {
      items.push({ id: nextId(state, "s"), kind, defId: rollPlanetId(state, rng, taken), cost: PLANET_COST });
    }
  }
  return items;
}
