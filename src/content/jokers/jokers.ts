import { cardHasSuit, isFace, type PlayingCard, type Rank, type Suit } from "@/engine/cards/Card";
import { allCards } from "@/engine/deck/Deck";
import type { JokerDefinition, Rarity, ScoringContext } from "@/engine/effects/types";
import type { PokerHandType } from "@/engine/poker/HandRank";

const COST: Record<Rarity, number> = { COMMON: 4, UNCOMMON: 6, RARE: 8 };

type Def = Omit<JokerDefinition, "cost"> & { cost?: number };
const def = (d: Def): JokerDefinition => ({ cost: COST[d.rarity], ...d });

const contains = (ctx: ScoringContext, hand: PokerHandType) => ctx.result.containedHands.includes(hand);
const suitOf = (ctx: ScoringContext, card: PlayingCard, suit: Suit) =>
  cardHasSuit(card, suit, ctx.state.rules.smearedSuits);
const rankIn = (card: PlayingCard, ranks: readonly Rank[]) => card.enhancement !== "STONE" && ranks.includes(card.rank);

function suitJoker(id: string, name: string, suit: Suit, symbol: string, hue: number): JokerDefinition {
  return def({
    id,
    name,
    rarity: "COMMON",
    cost: 5,
    description: `Played ${symbol} cards give +3 Mult when scored`,
    art: { glyph: symbol, hue },
    onCardScored: (ctx, card) => (suitOf(ctx, card, suit) ? { mult: 3 } : null),
  });
}

function handMultJoker(id: string, name: string, hand: PokerHandType, mult: number, label: string, hue: number) {
  return def({
    id,
    name,
    rarity: "COMMON",
    description: `+${mult} Mult if played hand contains a ${label}`,
    art: { glyph: "☺", hue },
    main: (ctx) => (contains(ctx, hand) ? { mult } : null),
  });
}

function handChipJoker(id: string, name: string, hand: PokerHandType, chips: number, label: string, hue: number) {
  return def({
    id,
    name,
    rarity: "COMMON",
    description: `+${chips} Chips if played hand contains a ${label}`,
    art: { glyph: "◉", hue },
    main: (ctx) => (contains(ctx, hand) ? { chips } : null),
  });
}

function handXJoker(id: string, name: string, hand: PokerHandType, x: number, label: string, hue: number) {
  return def({
    id,
    name,
    rarity: "RARE",
    description: `X${x} Mult if played hand contains a ${label}`,
    art: { glyph: "✦", hue },
    main: (ctx) => (contains(ctx, hand) ? { xMult: x } : null),
  });
}

export const JOKERS: readonly JokerDefinition[] = [
  def({
    id: "joker",
    name: "Joker",
    rarity: "COMMON",
    cost: 2,
    description: "+4 Mult",
    art: { glyph: "🃏", hue: 0 },
    main: () => ({ mult: 4 }),
  }),
  suitJoker("greedy", "Greedy Joker", "DIAMONDS", "♦", 30),
  suitJoker("lusty", "Lusty Joker", "HEARTS", "♥", 350),
  suitJoker("wrathful", "Wrathful Joker", "SPADES", "♠", 260),
  suitJoker("gluttonous", "Gluttonous Joker", "CLUBS", "♣", 140),

  handMultJoker("jolly", "Jolly Joker", "PAIR", 8, "Pair", 50),
  handMultJoker("zany", "Zany Joker", "THREE_OF_A_KIND", 12, "Three of a Kind", 300),
  handMultJoker("mad", "Mad Joker", "TWO_PAIR", 10, "Two Pair", 10),
  handMultJoker("crazy", "Crazy Joker", "STRAIGHT", 12, "Straight", 190),
  handMultJoker("droll", "Droll Joker", "FLUSH", 10, "Flush", 280),
  handChipJoker("sly", "Sly Joker", "PAIR", 50, "Pair", 50),
  handChipJoker("wily", "Wily Joker", "THREE_OF_A_KIND", 100, "Three of a Kind", 300),
  handChipJoker("clever", "Clever Joker", "TWO_PAIR", 80, "Two Pair", 10),
  handChipJoker("devious", "Devious Joker", "STRAIGHT", 100, "Straight", 190),
  handChipJoker("crafty", "Crafty Joker", "FLUSH", 80, "Flush", 280),
  handXJoker("duo", "The Duo", "PAIR", 2, "Pair", 45),
  handXJoker("trio", "The Trio", "THREE_OF_A_KIND", 3, "Three of a Kind", 305),
  handXJoker("family", "The Family", "FOUR_OF_A_KIND", 4, "Four of a Kind", 15),
  handXJoker("order", "The Order", "STRAIGHT", 3, "Straight", 195),
  handXJoker("tribe", "The Tribe", "FLUSH", 2, "Flush", 275),

  def({
    id: "half",
    name: "Half Joker",
    rarity: "COMMON",
    cost: 5,
    description: "+20 Mult if played hand contains 3 or fewer cards",
    art: { glyph: "◐", hue: 330 },
    main: (ctx) => (ctx.played.length <= 3 ? { mult: 20 } : null),
  }),
  def({
    id: "banner",
    name: "Banner",
    rarity: "COMMON",
    cost: 5,
    description: "+30 Chips for each remaining discard",
    art: { glyph: "⚑", hue: 210 },
    status: (_s, st) => `+${30 * st.player.discardsRemaining} Chips`,
    main: (ctx) => (ctx.state.player.discardsRemaining > 0 ? { chips: 30 * ctx.state.player.discardsRemaining } : null),
  }),
  def({
    id: "mystic_summit",
    name: "Mystic Summit",
    rarity: "COMMON",
    cost: 5,
    description: "+15 Mult when 0 discards remaining",
    art: { glyph: "▲", hue: 200 },
    main: (ctx) => (ctx.state.player.discardsRemaining === 0 ? { mult: 15 } : null),
  }),
  def({
    id: "fibonacci",
    name: "Fibonacci",
    rarity: "UNCOMMON",
    cost: 8,
    description: "Each played Ace, 2, 3, 5 or 8 gives +8 Mult when scored",
    art: { glyph: "φ", hue: 40 },
    onCardScored: (_c, card) => (rankIn(card, ["A", "2", "3", "5", "8"]) ? { mult: 8 } : null),
  }),
  def({
    id: "scary_face",
    name: "Scary Face",
    rarity: "COMMON",
    description: "Played face cards give +30 Chips when scored",
    art: { glyph: "☠", hue: 220 },
    onCardScored: (_c, card) => (isFace(card) ? { chips: 30 } : null),
  }),
  def({
    id: "smiley",
    name: "Smiley Face",
    rarity: "COMMON",
    description: "Played face cards give +5 Mult when scored",
    art: { glyph: "☻", hue: 55 },
    onCardScored: (_c, card) => (isFace(card) ? { mult: 5 } : null),
  }),
  def({
    id: "even_steven",
    name: "Even Steven",
    rarity: "COMMON",
    description: "Played 10, 8, 6, 4 or 2 give +4 Mult when scored",
    art: { glyph: "⧉", hue: 0 },
    onCardScored: (_c, card) => (rankIn(card, ["10", "8", "6", "4", "2"]) ? { mult: 4 } : null),
  }),
  def({
    id: "odd_todd",
    name: "Odd Todd",
    rarity: "COMMON",
    description: "Played A, 9, 7, 5 or 3 give +31 Chips when scored",
    art: { glyph: "⧈", hue: 220 },
    onCardScored: (_c, card) => (rankIn(card, ["A", "9", "7", "5", "3"]) ? { chips: 31 } : null),
  }),
  def({
    id: "scholar",
    name: "Scholar",
    rarity: "COMMON",
    description: "Played Aces give +20 Chips and +4 Mult when scored",
    art: { glyph: "✎", hue: 35 },
    onCardScored: (_c, card) => (rankIn(card, ["A"]) ? { chips: 20, mult: 4 } : null),
  }),
  def({
    id: "walkie_talkie",
    name: "Walkie Talkie",
    rarity: "COMMON",
    description: "Played 10 or 4 give +10 Chips and +4 Mult when scored",
    art: { glyph: "☏", hue: 180 },
    onCardScored: (_c, card) => (rankIn(card, ["10", "4"]) ? { chips: 10, mult: 4 } : null),
  }),
  def({
    id: "arrowhead",
    name: "Arrowhead",
    rarity: "UNCOMMON",
    description: "Played ♠ cards give +50 Chips when scored",
    art: { glyph: "➹", hue: 250 },
    onCardScored: (ctx, card) => (suitOf(ctx, card, "SPADES") ? { chips: 50 } : null),
  }),
  def({
    id: "onyx_agate",
    name: "Onyx Agate",
    rarity: "UNCOMMON",
    description: "Played ♣ cards give +7 Mult when scored",
    art: { glyph: "⬢", hue: 150 },
    onCardScored: (ctx, card) => (suitOf(ctx, card, "CLUBS") ? { mult: 7 } : null),
  }),
  def({
    id: "bloodstone",
    name: "Bloodstone",
    rarity: "UNCOMMON",
    description: "1 in 2 chance for played ♥ cards to give X1.5 Mult when scored",
    art: { glyph: "◆", hue: 355 },
    onCardScored: (ctx, card) => (suitOf(ctx, card, "HEARTS") && ctx.rng.chance(0.5) ? { xMult: 1.5 } : null),
  }),
  def({
    id: "rough_gem",
    name: "Rough Gem",
    rarity: "UNCOMMON",
    description: "Played ♦ cards earn $1 when scored",
    art: { glyph: "◇", hue: 25 },
    onCardScored: (ctx, card) => (suitOf(ctx, card, "DIAMONDS") ? { money: 1 } : null),
  }),
  def({
    id: "golden_ticket",
    name: "Golden Ticket",
    rarity: "COMMON",
    cost: 5,
    description: "Played Gold cards earn $4 when scored",
    art: { glyph: "🎫", hue: 45 },
    onCardScored: (_c, card) => (card.enhancement === "GOLD" ? { money: 4 } : null),
  }),
  def({
    id: "photograph",
    name: "Photograph",
    rarity: "COMMON",
    cost: 5,
    description: "First played face card gives X2 Mult when scored",
    art: { glyph: "📷", hue: 200 },
    onCardScored: (ctx, card) => (isFace(card) && ctx.scoring.find(isFace) === card ? { xMult: 2 } : null),
  }),
  def({
    id: "ride_the_bus",
    name: "Ride the Bus",
    rarity: "COMMON",
    cost: 6,
    description: "+1 Mult per consecutive hand played without a scoring face card",
    art: { glyph: "🚌", hue: 15 },
    status: (s) => `+${s.counter} Mult`,
    beforeScoring: (ctx, self) => {
      if (ctx.scoring.some(isFace)) {
        const had = self.counter > 0;
        self.counter = 0;
        return had ? { text: "Reset" } : null;
      }
      self.counter += 1;
      return { text: "Upgrade!" };
    },
    main: (_c, self) => (self.counter > 0 ? { mult: self.counter } : null),
  }),
  def({
    id: "green_joker",
    name: "Green Joker",
    rarity: "COMMON",
    description: "+1 Mult per hand played, -1 Mult per discard",
    art: { glyph: "♧", hue: 120 },
    status: (s) => `+${s.counter} Mult`,
    beforeScoring: (_c, self) => {
      self.counter += 1;
      return { text: "+1" };
    },
    onDiscard: (_s, _cards, self) => {
      if (self.counter === 0) return null;
      self.counter -= 1;
      return { text: "-1" };
    },
    main: (_c, self) => (self.counter > 0 ? { mult: self.counter } : null),
  }),
  def({
    id: "ice_cream",
    name: "Ice Cream",
    rarity: "COMMON",
    cost: 5,
    description: "+100 Chips, -5 Chips for every hand played",
    art: { glyph: "🍦", hue: 320 },
    status: (s) => `+${Math.max(0, 100 - 5 * s.counter)} Chips`,
    main: (_c, self) => {
      const chips = Math.max(0, 100 - 5 * self.counter);
      return chips > 0 ? { chips } : null;
    },
    afterScoring: (_c, self) => {
      self.counter += 1;
    },
  }),
  def({
    id: "supernova",
    name: "Supernova",
    rarity: "COMMON",
    cost: 5,
    description: "Adds the number of times this poker hand has been played this run to Mult",
    art: { glyph: "✺", hue: 270 },
    main: (ctx) => ({ mult: ctx.state.handLevels[ctx.handType].timesPlayed }),
  }),
  def({
    id: "abstract",
    name: "Abstract Joker",
    rarity: "COMMON",
    description: "+3 Mult for each Joker card",
    art: { glyph: "▦", hue: 290 },
    status: (_s, st) => `+${3 * st.jokers.length} Mult`,
    main: (ctx) => ({ mult: 3 * ctx.state.jokers.length }),
  }),
  def({
    id: "bull",
    name: "Bull",
    rarity: "UNCOMMON",
    description: "+2 Chips for each $1 you have",
    art: { glyph: "♉", hue: 10 },
    status: (_s, st) => `+${2 * Math.max(0, st.player.money)} Chips`,
    main: (ctx) => (ctx.state.player.money > 0 ? { chips: 2 * ctx.state.player.money } : null),
  }),
  def({
    id: "blackboard",
    name: "Blackboard",
    rarity: "UNCOMMON",
    description: "X3 Mult if all cards held in hand are ♠ or ♣",
    art: { glyph: "▤", hue: 230 },
    main: (ctx) =>
      ctx.held.every((c) => suitOf(ctx, c, "SPADES") || suitOf(ctx, c, "CLUBS")) ? { xMult: 3 } : null,
  }),
  def({
    id: "baron",
    name: "Baron",
    rarity: "RARE",
    description: "Each King held in hand gives X1.5 Mult",
    art: { glyph: "♔", hue: 45 },
    onHeld: (_c, card) => (rankIn(card, ["K"]) ? { xMult: 1.5 } : null),
  }),
  def({
    id: "shoot_the_moon",
    name: "Shoot the Moon",
    rarity: "COMMON",
    cost: 5,
    description: "Each Queen held in hand gives +13 Mult",
    art: { glyph: "☾", hue: 240 },
    onHeld: (_c, card) => (rankIn(card, ["Q"]) ? { mult: 13 } : null),
  }),
  def({
    id: "steel_joker",
    name: "Steel Joker",
    rarity: "UNCOMMON",
    cost: 7,
    description: "Gives X0.2 Mult for each Steel Card in your full deck",
    art: { glyph: "⛓", hue: 210 },
    status: (_s, st) => `X${(1 + 0.2 * allCards(st.deck).filter((c) => c.enhancement === "STEEL").length).toFixed(1)} Mult`,
    main: (ctx) => {
      const n = allCards(ctx.state.deck).filter((c) => c.enhancement === "STEEL").length;
      return n > 0 ? { xMult: 1 + 0.2 * n } : null;
    },
  }),
  def({
    id: "stone_joker",
    name: "Stone Joker",
    rarity: "UNCOMMON",
    description: "+25 Chips for each Stone Card in your full deck",
    art: { glyph: "⬣", hue: 30 },
    main: (ctx) => {
      const n = allCards(ctx.state.deck).filter((c) => c.enhancement === "STONE").length;
      return n > 0 ? { chips: 25 * n } : null;
    },
  }),
  def({
    id: "cavendish",
    name: "Cavendish",
    rarity: "UNCOMMON",
    cost: 5,
    description: "X3 Mult",
    art: { glyph: "🍌", hue: 55 },
    main: () => ({ xMult: 3 }),
  }),
  def({
    id: "gros_michel",
    name: "Gros Michel",
    rarity: "COMMON",
    cost: 5,
    description: "+15 Mult. 1 in 6 chance this is destroyed at end of round",
    art: { glyph: "🍌", hue: 80 },
    main: () => ({ mult: 15 }),
  }),

  // --- Retriggers -----------------------------------------------------------
  def({
    id: "hanging_chad",
    name: "Hanging Chad",
    rarity: "COMMON",
    description: "Retrigger the first played card used in scoring",
    art: { glyph: "⎘", hue: 100 },
    retrigger: (ctx, card, zone) => (zone === "PLAYED" && ctx.scoring[0] === card ? 1 : 0),
  }),
  def({
    id: "sock_and_buskin",
    name: "Sock and Buskin",
    rarity: "UNCOMMON",
    description: "Retrigger all played face cards",
    art: { glyph: "🎭", hue: 280 },
    retrigger: (_c, card, zone) => (zone === "PLAYED" && isFace(card) ? 1 : 0),
  }),
  def({
    id: "dusk",
    name: "Dusk",
    rarity: "UNCOMMON",
    cost: 5,
    description: "Retrigger all played cards in the final hand of the round",
    art: { glyph: "◒", hue: 260 },
    retrigger: (ctx, _card, zone) => (zone === "PLAYED" && ctx.state.player.handsRemaining === 0 ? 1 : 0),
  }),
  def({
    id: "mime",
    name: "Mime",
    rarity: "UNCOMMON",
    cost: 5,
    description: "Retrigger all card held-in-hand abilities",
    art: { glyph: "☖", hue: 0 },
    retrigger: (_c, _card, zone) => (zone === "HELD" ? 1 : 0),
  }),

  // --- Rule changers --------------------------------------------------------
  def({
    id: "four_fingers",
    name: "Four Fingers",
    rarity: "UNCOMMON",
    cost: 7,
    description: "All Flushes and Straights can be made with 4 cards",
    art: { glyph: "✋", hue: 30 },
    rules: { flushStraightSize: 4 },
  }),
  def({
    id: "shortcut",
    name: "Shortcut",
    rarity: "UNCOMMON",
    cost: 7,
    description: "Allows Straights to be made with gaps of 1 rank",
    art: { glyph: "⤳", hue: 160 },
    rules: { straightMaxGap: 2 },
  }),
  def({
    id: "splash",
    name: "Splash",
    rarity: "COMMON",
    cost: 3,
    description: "Every played card counts in scoring",
    art: { glyph: "💧", hue: 200 },
    rules: { allPlayedCardsScore: true },
  }),
  def({
    id: "smeared",
    name: "Smeared Joker",
    rarity: "UNCOMMON",
    cost: 7,
    description: "♥ and ♦ count as the same suit, ♠ and ♣ count as the same suit",
    art: { glyph: "≋", hue: 330 },
    rules: { smearedSuits: true },
  }),

  // --- Passive / economy ----------------------------------------------------
  def({
    id: "juggler",
    name: "Juggler",
    rarity: "COMMON",
    description: "+1 hand size",
    art: { glyph: "◎", hue: 180 },
    passive: { handSize: 1 },
  }),
  def({
    id: "drunkard",
    name: "Drunkard",
    rarity: "COMMON",
    description: "+1 discard each round",
    art: { glyph: "🍺", hue: 40 },
    passive: { discards: 1 },
  }),
  def({
    id: "troubadour",
    name: "Troubadour",
    rarity: "UNCOMMON",
    description: "+2 hand size, -1 hand each round",
    art: { glyph: "♫", hue: 300 },
    passive: { handSize: 2, hands: -1 },
  }),
  def({
    id: "golden",
    name: "Golden Joker",
    rarity: "COMMON",
    cost: 6,
    description: "Earn $4 at end of round",
    art: { glyph: "$", hue: 48 },
    onRoundEnd: () => 4,
  }),
  def({
    id: "delayed_gratification",
    name: "Delayed Gratification",
    rarity: "COMMON",
    description: "Earn $2 per discard if no discards are used by end of round",
    art: { glyph: "⌛", hue: 35 },
    onRoundEnd: (st) => (st.round.discardsUsed === 0 ? 2 * st.player.discardsRemaining : 0),
  }),
  def({
    id: "faceless",
    name: "Faceless Joker",
    rarity: "COMMON",
    description: "Earn $5 if 3 or more face cards are discarded at the same time",
    art: { glyph: "◌", hue: 0 },
    onDiscard: (_s, cards) => (cards.filter(isFace).length >= 3 ? { money: 5 } : null),
  }),
];

export const JOKER_REGISTRY: Readonly<Record<string, JokerDefinition>> = Object.fromEntries(
  JOKERS.map((j) => [j.id, j]),
);

export function jokerDef(id: string): JokerDefinition {
  const d = JOKER_REGISTRY[id];
  if (!d) throw new Error(`unknown joker ${id}`);
  return d;
}

