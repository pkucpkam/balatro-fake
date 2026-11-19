import clsx from "clsx";
import { AnimatePresence, motion, useAnimate } from "motion/react";
import { useEffect, useState } from "react";
import { allCards } from "@/engine/deck/Deck";
import { BOSS_REGISTRY } from "@/content/blinds/bosses";
import { ShaderBackground, type ShaderPalette } from "@/ui/fx/ShaderBackground";
import { CardBack } from "@/ui/components/PlayingCardView";
import { fmt } from "@/ui/format";
import { MainMenu, randomSeed } from "../menu/MainMenu";
import { BlindSelect } from "../blind/BlindSelect";
import { Shop } from "../shop/Shop";
import { Hud } from "./Hud";
import { ConsumableRow, JokerRow } from "./JokerRow";
import { ActionBar, HandArea } from "./HandArea";
import { PlayArea } from "./PlayArea";
import { CashOut } from "./CashOut";
import { DeckModal, OptionsModal, RunInfoModal } from "./Modals";
import { useGameStore } from "./gameStore";

function hsl(h: number, s: number, l: number): string {
  // HSL → hex for the shader uniforms.
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
}

const PALETTE_DEFAULT: ShaderPalette = { a: "#1d0f2e", b: "#0f3a3c", c: "#6b2f6f" };
const PALETTE_SHOP: ShaderPalette = { a: "#14231a", b: "#1f4a3a", c: "#b08a2e" };
const PALETTE_LOSE: ShaderPalette = { a: "#1a0608", b: "#3d0c14", c: "#7a1e1e" };
const PALETTE_WIN: ShaderPalette = { a: "#2a1a05", b: "#5c3b0a", c: "#e9b949" };

function DeckPile({ onOpen }: { onOpen: () => void }) {
  const view = useGameStore((s) => s.view);
  // During a scoring sequence `view` hides the played cards, so take the total from engine truth.
  const total = useGameStore((s) => allCards(s.game.deck).length);
  // Between rounds every card is shuffled back in on the next SELECT_BLIND.
  const inRound = view.status === "PLAYING" || view.status === "GAME_OVER";
  return (
    <button type="button" className="deck-pile" onClick={onOpen} aria-label="View deck">
      <CardBack />
      <span className="deck-pile-count">
        {inRound ? view.deck.drawPile.length : total}/{total}
      </span>
    </button>
  );
}

function EndScreen() {
  const view = useGameStore((s) => s.view);
  const dispatch = useGameStore((s) => s.dispatch);
  const win = view.status === "VICTORY";
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div className={clsx("end-card", win ? "win" : "lose")} initial={{ scale: 0.6, rotate: -4 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}>
        <h2>{win ? "You won the run" : "Game over"}</h2>
        <dl className="end-stats">
          <div>
            <dt>Best hand</dt>
            <dd>{fmt(view.run.bestHandScore)}</dd>
          </div>
          <div>
            <dt>Reached</dt>
            <dd>
              Ante {view.run.ante} · Round {view.run.round}
            </dd>
          </div>
          <div>
            <dt>Hands played</dt>
            <dd>{view.run.handsPlayedTotal}</dd>
          </div>
          {!win && (
            <div>
              <dt>Last blind</dt>
              <dd>
                {fmt(view.round.currentScore)} / {fmt(view.round.targetScore)}
              </dd>
            </div>
          )}
          <div>
            <dt>Seed</dt>
            <dd className="seed">{view.run.seed}</dd>
          </div>
        </dl>
        <div className="end-actions">
          <button type="button" className="btn btn-play" onClick={() => dispatch({ type: "START_RUN", seed: randomSeed() })} autoFocus>
            New run
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => dispatch({ type: "START_RUN", seed: view.run.seed })}>
            Retry seed
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function GameScreen() {
  const view = useGameStore((s) => s.view);
  const seq = useGameStore((s) => s.seq);
  const shake = useGameStore((s) => s.shake);
  const settings = useGameStore((s) => s.settings);
  const error = useGameStore((s) => s.error);
  const [modal, setModal] = useState<null | "info" | "deck" | "options">(null);
  const [scope, animate] = useAnimate<HTMLDivElement>();

  useEffect(() => {
    if (shake && scope.current && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      void animate(scope.current, { x: [0, -7, 6, -4, 3, 0], y: [0, 4, -3, 2, 0] }, { duration: 0.35 });
    }
  }, [shake, animate, scope]);

  const boss = view.round.bossId ? BOSS_REGISTRY[view.round.bossId] : undefined;
  const palette =
    view.status === "GAME_OVER"
      ? PALETTE_LOSE
      : view.status === "VICTORY"
        ? PALETTE_WIN
        : view.status === "SHOP"
          ? PALETTE_SHOP
          : boss && view.status === "PLAYING"
            ? { a: hsl(boss.hue, 45, 8), b: hsl(boss.hue, 50, 20), c: hsl((boss.hue + 40) % 360, 55, 38) }
            : PALETTE_DEFAULT;
  const intensity = seq ? (seq.onFire ? 1 : 0.55) : 0;

  return (
    <div className={clsx("app", settings.crt && "crt-on")}>
      <ShaderBackground palette={palette} intensity={intensity} />
      <div className="stage" ref={scope}>
        {view.status === "MENU" ? (
          <MainMenu onOptions={() => setModal("options")} />
        ) : (
          <div className="layout">
            <Hud onRunInfo={() => setModal("info")} onOptions={() => setModal("options")} />
            <main className="board">
              <div className="top-row">
                <JokerRow />
                <ConsumableRow />
              </div>
              <div className="center">
                <AnimatePresence mode="wait">
                  {view.status === "BLIND_SELECT" && (
                    <motion.div key="blind" className="center-fill" exit={{ y: 200, opacity: 0 }}>
                      <BlindSelect />
                    </motion.div>
                  )}
                  {view.status === "SHOP" && (
                    <motion.div key="shop" className="center-fill" exit={{ y: 200, opacity: 0 }}>
                      <Shop />
                    </motion.div>
                  )}
                  {view.status === "ROUND_WON" && (
                    <motion.div key="cash" className="center-fill" exit={{ y: 200, opacity: 0 }}>
                      <CashOut />
                    </motion.div>
                  )}
                  {(view.status === "PLAYING" || view.status === "GAME_OVER") && (
                    <motion.div key="play" className="center-fill play-col" exit={{ opacity: 0 }}>
                      <PlayArea />
                      <HandArea />
                      <ActionBar />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <DeckPile onOpen={() => setModal("deck")} />
            </main>
          </div>
        )}
      </div>

      <AnimatePresence>{(view.status === "GAME_OVER" || view.status === "VICTORY") && !seq && <EndScreen key="end" />}</AnimatePresence>
      <AnimatePresence>
        {modal === "info" && <RunInfoModal key="i" onClose={() => setModal(null)} />}
        {modal === "deck" && <DeckModal key="d" onClose={() => setModal(null)} />}
        {modal === "options" && <OptionsModal key="o" onClose={() => setModal(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {error && (
          <motion.div key="err" className="toast" role="alert" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}>
            {error}
          </motion.div>
        )}
      </AnimatePresence>
      {settings.crt && <div className="crt" aria-hidden />}
    </div>
  );
}
