import { RANKS, type EnhancementType, type PlayingCard, type Suit } from "@/engine/cards/Card";
import type { TarotApi, TarotWithApply } from "@/engine/effects/types";

function enhance(id: string, name: string, n: number, e: EnhancementType, label: string, glyph: string): TarotWithApply {
  return {
    id,
    name,
    glyph,
    description: `Enhances ${n === 1 ? "1 selected card" : `up to ${n} selected cards`} into ${label}`,
    minTargets: 1,
    maxTargets: n,
    apply: (api) => {
      for (const c of api.targets) c.enhancement = e;
      return label;
    },
  };
}

function suitTarot(id: string, name: string, suit: Suit, symbol: string, glyph: string): TarotWithApply {
  return {
    id,
    name,
    glyph,
    description: `Converts up to 3 selected cards to ${symbol}`,
    minTargets: 1,
    maxTargets: 3,
    apply: (api) => {
      for (const c of api.targets) c.suit = suit;
      return symbol;
    },
  };
}

function rankUp(card: PlayingCard): void {
  const i = RANKS.indexOf(card.rank);
  card.rank = RANKS[(i + 1) % RANKS.length] ?? card.rank;
}

export const TAROTS: readonly TarotWithApply[] = [
  enhance("magician", "The Magician", 2, "LUCKY", "Lucky Card", "I"),
  enhance("empress", "The Empress", 2, "MULT", "Mult Card", "III"),
  enhance("hierophant", "The Hierophant", 2, "BONUS", "Bonus Card", "V"),
  enhance("lovers", "The Lovers", 1, "WILD", "Wild Card", "VI"),
  enhance("chariot", "The Chariot", 1, "STEEL", "Steel Card", "VII"),
  enhance("justice", "Justice", 1, "GLASS", "Glass Card", "VIII"),
  enhance("devil", "The Devil", 1, "GOLD", "Gold Card", "XV"),
  enhance("tower", "The Tower", 1, "STONE", "Stone Card", "XVI"),
  suitTarot("star", "The Star", "DIAMONDS", "♦", "XVII"),
  suitTarot("moon", "The Moon", "CLUBS", "♣", "XVIII"),
  suitTarot("sun", "The Sun", "HEARTS", "♥", "XIX"),
  suitTarot("world", "The World", "SPADES", "♠", "XXI"),
  {
    id: "strength",
    name: "Strength",
    glyph: "XI",
    description: "Increases rank of up to 2 selected cards by 1",
    minTargets: 1,
    maxTargets: 2,
    apply: (api) => {
      for (const c of api.targets) rankUp(c);
      return "Rank up";
    },
  },
  {
    id: "hanged_man",
    name: "The Hanged Man",
    glyph: "XII",
    description: "Destroys up to 2 selected cards",
    minTargets: 1,
    maxTargets: 2,
    apply: (api) => {
      api.destroyCards(api.targets.map((c) => c.id));
      return "Destroyed";
    },
  },
  {
    id: "death",
    name: "Death",
    glyph: "XIII",
    description: "Select 2 cards: the left card becomes a copy of the right card",
    minTargets: 2,
    maxTargets: 2,
    apply: (api: TarotApi) => {
      const [left, right] = api.targets;
      if (left && right) {
        left.rank = right.rank;
        left.suit = right.suit;
        left.enhancement = right.enhancement;
        left.edition = right.edition;
        left.seal = right.seal;
        left.bonusChips = right.bonusChips;
      }
      return "Copied";
    },
  },
  {
    id: "hermit",
    name: "The Hermit",
    glyph: "IX",
    description: "Doubles money (max of $20)",
    minTargets: 0,
    maxTargets: 0,
    apply: (api) => {
      const gain = Math.min(20, Math.max(0, api.state.player.money));
      api.state.player.money += gain;
      return `+$${gain}`;
    },
  },
  {
    id: "temperance",
    name: "Temperance",
    glyph: "XIV",
    description: "Gives the total sell value of all current Jokers (max of $50)",
    minTargets: 0,
    maxTargets: 0,
    apply: (api) => {
      const gain = Math.min(50, api.state.jokers.reduce((s, j) => s + j.sellValue, 0));
      api.state.player.money += gain;
      return `+$${gain}`;
    },
  },
  {
    id: "judgement",
    name: "Judgement",
    glyph: "XX",
    description: "Creates a random Joker card (must have room)",
    minTargets: 0,
    maxTargets: 0,
    apply: (api) => (api.addRandomJoker() ? "Joker!" : "No room"),
  },
  {
    id: "emperor",
    name: "The Emperor",
    glyph: "IV",
    description: "Creates up to 2 random Tarot cards (must have room)",
    minTargets: 0,
    maxTargets: 0,
    apply: (api) => {
      let n = 0;
      // The Emperor itself is still in the slots while applying; the engine removes it first.
      for (let i = 0; i < 2; i++) if (api.addRandomTarot()) n++;
      return n > 0 ? `+${n} Tarot` : "No room";
    },
  },
  {
    id: "wheel",
    name: "The Wheel of Fortune",
    glyph: "X",
    description: "1 in 4 chance to add Foil, Holographic or Polychrome to a random Joker",
    minTargets: 0,
    maxTargets: 0,
    apply: (api) => {
      const plain = api.state.jokers.filter((j) => !j.edition);
      if (plain.length === 0 || !api.rng.chance(0.25)) return "Nope!";
      const j = api.rng.pick(plain);
      j.edition = api.rng.pick(["FOIL", "HOLOGRAPHIC", "POLYCHROME"] as const);
      return "Lucky!";
    },
  },
];

export const TAROT_REGISTRY: Readonly<Record<string, TarotWithApply>> = Object.fromEntries(
  TAROTS.map((t) => [t.id, t]),
);
