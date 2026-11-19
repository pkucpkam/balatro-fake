import type { PokerHandType } from "@/engine/poker/HandRank";

export interface PlanetDefinition {
  id: string;
  name: string;
  hand: PokerHandType;
  cost: number;
  /** Secret-hand planets only appear after that hand has been played. */
  requiresHandPlayed: boolean;
}

const planet = (id: string, name: string, hand: PokerHandType, requiresHandPlayed = false): PlanetDefinition => ({
  id,
  name,
  hand,
  cost: 3,
  requiresHandPlayed,
});

export const PLANETS: readonly PlanetDefinition[] = [
  planet("pluto", "Pluto", "HIGH_CARD"),
  planet("mercury", "Mercury", "PAIR"),
  planet("uranus", "Uranus", "TWO_PAIR"),
  planet("venus", "Venus", "THREE_OF_A_KIND"),
  planet("saturn", "Saturn", "STRAIGHT"),
  planet("jupiter", "Jupiter", "FLUSH"),
  planet("earth", "Earth", "FULL_HOUSE"),
  planet("mars", "Mars", "FOUR_OF_A_KIND"),
  planet("neptune", "Neptune", "STRAIGHT_FLUSH"),
  planet("planet_x", "Planet X", "FIVE_OF_A_KIND", true),
  planet("ceres", "Ceres", "FLUSH_HOUSE", true),
  planet("eris", "Eris", "FLUSH_FIVE", true),
];

export const PLANET_REGISTRY: Readonly<Record<string, PlanetDefinition>> = Object.fromEntries(
  PLANETS.map((p) => [p.id, p]),
);
