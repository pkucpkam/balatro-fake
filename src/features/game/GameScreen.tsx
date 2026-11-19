import { useMemo, useState } from "react";
import { cardLabel, isStone, type PlayingCard } from "@/engine/cards/Card";
import { evaluateHand } from "@/engine/poker/HandEvaluator";
import { getHandValues } from "@/engine/poker/HandLevels";
import { HAND_BASE } from "@/engine/poker/HandRank";
import type { GameEvent } from "@/engine/core/GameEvent";
import { PLANETS } from "@/content/planets/planets";
import { useGameStore } from "./gameStore";

function randomSeed(): string {
  // UI-side only: picking a seed is not game logic.
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

function CardView({ card, selected, onClick }: { card: PlayingCard; selected: boolean; onClick: () => void }) {
  const red = card.suit === "HEARTS" || card.suit === "DIAMONDS";
  return (
    <button
      type="button"
      className={`card ${red ? "red" : "black"} ${selected ? "selected" : ""} ${isStone(card) ? "stone" : ""}`}
      onClick={onClick}
    >
      <span className="card-corner">{cardLabel(card)}</span>
      <span className="card-center">{cardLabel(card).slice(-1)}</span>
    </button>
  );
}

function describeEvent(e: GameEvent): string {
  switch (e.type) {
    case "RUN_STARTED":
      return `Run started · seed ${e.seed}`;
    case "ROUND_STARTED":
      return `Ante ${e.ante} · ${e.blindType} blind · target ${e.targetScore}`;
    case "CARDS_DRAWN":
      return `Drew ${e.cardIds.length}`;
    case "CARDS_DISCARDED":
      return `Discarded ${e.cardIds.length}`;
    case "HAND_SORTED":
      return `Sorted by ${e.by.toLowerCase()}`;
    case "HAND_PLAYED":
      return `Played ${e.cardIds.length} card(s)`;
    case "HAND_EVALUATED":
      return `${HAND_BASE[e.handType].name} lvl.${e.level} → ${e.chips} × ${e.mult}`;
    case "CARD_SCORED":
      return `  +${e.chips} chips`;
    case "SCORE_FINALIZED":
      return `= ${e.chips} × ${e.mult} = ${e.score} (round ${e.roundScore})`;
    case "HAND_LEVELED_UP":
      return `${HAND_BASE[e.handType].name} → lvl.${e.level}`;
    case "ROUND_WON":
      return `Blind defeated! +$${e.reward}`;
    case "GAME_OVER":
      return `Game over (${e.score}/${e.targetScore})`;
    case "VICTORY":
      return "Victory!";
  }
}

export function GameScreen() {
  const { game, selectedCardIds, eventLog, error, dispatch, toggleCard, exportReplay } = useGameStore();
  const [seed, setSeed] = useState(randomSeed);

  const hand = game.deck.hand;
  // Keep played order = left-to-right order in hand.
  const selectedInOrder = hand.filter((c) => selectedCardIds.includes(c.id));

  const preview = useMemo(() => {
    if (selectedInOrder.length === 0) return null;
    const result = evaluateHand(selectedInOrder, game.rules);
    return { result, ...getHandValues(game.handLevels, result.handType), level: game.handLevels[result.handType].level };
  }, [selectedInOrder, game.rules, game.handLevels]);

  if (game.status === "MENU") {
    return (
      <div className="menu">
        <h1>BALATRO FAKE</h1>
        <p className="muted">Phase 1–2 · Engine prototype</p>
        <label>
          Seed <input value={seed} onChange={(e) => setSeed(e.target.value.toUpperCase())} />
        </label>
        <button className="btn play" onClick={() => dispatch({ type: "START_RUN", seed })}>
          New Run
        </button>
      </div>
    );
  }

  const { round, player, run } = game;
  const ids = selectedInOrder.map((c) => c.id);

  return (
    <div className="layout">
      <aside className="hud">
        <div className="blind-box">
          <div className="muted">
            Ante {run.ante}/{run.winningAnte} · Round {run.round}
          </div>
          <div className="blind-name">{round.blindType} BLIND</div>
          <div className="muted">Score at least</div>
          <div className="target">{round.targetScore.toLocaleString()}</div>
        </div>
        <div className="score-box">
          <div className="muted">Round score</div>
          <div className="score">{round.currentScore.toLocaleString()}</div>
        </div>
        <div className="hand-preview">
          <div className="hand-name">
            {preview ? `${HAND_BASE[preview.result.handType].name} lvl.${preview.level}` : " "}
          </div>
          <div className="chips-mult">
            <span className="chips">{preview ? preview.chips : 0}</span>
            <span className="x">×</span>
            <span className="mult">{preview ? preview.mult : 0}</span>
          </div>
        </div>
        <div className="stats">
          <div>
            <span className="muted">Hands</span> <b className="blue">{player.handsRemaining}</b>
          </div>
          <div>
            <span className="muted">Discards</span> <b className="red-text">{player.discardsRemaining}</b>
          </div>
          <div>
            <span className="muted">Money</span> <b className="gold">${player.money}</b>
          </div>
          <div>
            <span className="muted">Deck</span> <b>{game.deck.drawPile.length}/52</b>
          </div>
        </div>
        <div className="muted small">Seed {run.seed}</div>
      </aside>

      <main className="table">
        <div className="joker-row">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="slot">
              Joker
            </div>
          ))}
        </div>

        <div className="hand">
          {hand.map((card) => (
            <CardView
              key={card.id}
              card={card}
              selected={selectedCardIds.includes(card.id)}
              onClick={() => toggleCard(card.id)}
            />
          ))}
        </div>

        <div className="actions">
          <button
            className="btn play"
            disabled={game.status !== "PLAYING" || ids.length === 0}
            onClick={() => dispatch({ type: "PLAY_HAND", cardIds: ids })}
          >
            Play Hand
          </button>
          <div className="sort">
            <button className="btn small" onClick={() => dispatch({ type: "SORT_HAND", by: "RANK" })}>
              Rank
            </button>
            <button className="btn small" onClick={() => dispatch({ type: "SORT_HAND", by: "SUIT" })}>
              Suit
            </button>
          </div>
          <button
            className="btn discard"
            disabled={game.status !== "PLAYING" || ids.length === 0 || player.discardsRemaining === 0}
            onClick={() => dispatch({ type: "DISCARD", cardIds: ids })}
          >
            Discard
          </button>
        </div>
        {error && <div className="error">{error}</div>}

        {game.status === "ROUND_WON" && (
          <div className="overlay">
            <h2>Blind defeated</h2>
            <p className="muted">Shop comes in Phase 4. For now: level up a hand (debug) or continue.</p>
            <div className="planets">
              {PLANETS.map((p) => (
                <button key={p.id} className="btn small" onClick={() => dispatch({ type: "USE_PLANET", planetId: p.id })}>
                  {p.name} · {HAND_BASE[p.hand].name} (lvl.{game.handLevels[p.hand].level})
                </button>
              ))}
            </div>
            <button className="btn play" onClick={() => dispatch({ type: "NEXT_ROUND" })}>
              Next Blind
            </button>
          </div>
        )}

        {(game.status === "GAME_OVER" || game.status === "VICTORY") && (
          <div className="overlay">
            <h2>{game.status === "VICTORY" ? "You win!" : "Game Over"}</h2>
            <button className="btn play" onClick={() => dispatch({ type: "START_RUN", seed: randomSeed() })}>
              New Run
            </button>
            <button className="btn small" onClick={() => navigator.clipboard?.writeText(exportReplay())}>
              Copy replay JSON
            </button>
          </div>
        )}
      </main>

      <aside className="log">
        <div className="muted">Event log</div>
        <ol>
          {eventLog
            .filter((e) => e.type !== "CARDS_DRAWN")
            .slice(-40)
            .map((e, i) => (
              <li key={i}>{describeEvent(e)}</li>
            ))}
        </ol>
      </aside>
    </div>
  );
}
