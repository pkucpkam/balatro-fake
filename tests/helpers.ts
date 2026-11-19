import { createCard, type PlayingCard, type Rank, type Suit, type EnhancementType } from "@/engine/cards/Card";

const SUIT_CODE: Record<string, Suit> = { S: "SPADES", H: "HEARTS", C: "CLUBS", D: "DIAMONDS" };

let uid = 0;

/**
 * Build cards from a compact string: "AS KH 10D 2C".
 * Suffixes: "*" = Wild, "#" = Stone (rank/suit ignored for hands), "!" = debuffed.
 */
export function cards(spec: string): PlayingCard[] {
  return spec
    .trim()
    .split(/\s+/)
    .map((token) => {
      const m = /^(10|[2-9JQKA])([SHCD])([*#!]*)$/.exec(token);
      if (!m) throw new Error(`bad card token: ${token}`);
      const [, rank, suit, flags = ""] = m;
      let enhancement: EnhancementType | undefined;
      if (flags.includes("*")) enhancement = "WILD";
      if (flags.includes("#")) enhancement = "STONE";
      uid += 1;
      return createCard(`t${uid}-${token}`, rank as Rank, SUIT_CODE[suit as string] as Suit, {
        enhancement,
        debuffed: flags.includes("!"),
      });
    });
}

/** Map card ids back to their spec tokens for readable assertions. */
export function tokens(all: PlayingCard[], ids: string[]): string[] {
  const byId = new Map(all.map((c) => [c.id, c.id.split("-").slice(1).join("-")]));
  return ids.map((id) => byId.get(id) ?? id);
}
