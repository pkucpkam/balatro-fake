import clsx from "clsx";
import { motion } from "motion/react";
import { useEffect } from "react";
import { SUITS, RANKS, suitSymbol, isRed } from "@/engine/cards/Card";
import { allCards } from "@/engine/deck/Deck";
import { getHandValues } from "@/engine/poker/HandLevels";
import { HAND_BASE, POKER_HANDS } from "@/engine/poker/HandRank";
import { BOSS_REGISTRY } from "@/content/blinds/bosses";
import { useGameStore } from "./gameStore";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="modal"
        role="dialog"
        aria-label={title}
        initial={{ y: 40, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} autoFocus>
            Back
          </button>
        </header>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function RunInfoModal({ onClose }: { onClose: () => void }) {
  const view = useGameStore((s) => s.view);
  const boss = BOSS_REGISTRY[view.run.bossId];
  return (
    <Modal title="Run info" onClose={onClose}>
      <table className="hand-table">
        <thead>
          <tr>
            <th>Hand</th>
            <th>Level</th>
            <th>Chips × Mult</th>
            <th>Played</th>
          </tr>
        </thead>
        <tbody>
          {POKER_HANDS.map((h) => {
            const lv = view.handLevels[h];
            if (HAND_BASE[h].secret && lv.timesPlayed === 0) return null;
            const v = getHandValues(view.handLevels, h);
            return (
              <tr key={h} className={clsx(lv.level > 1 && "leveled")}>
                <td>{HAND_BASE[h].name}</td>
                <td>lvl.{lv.level}</td>
                <td>
                  <span className="chip-text">{v.chips}</span> × <span className="mult-text">{v.mult}</span>
                </td>
                <td>{lv.timesPlayed}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {boss && (
        <p className="modal-note">
          Boss this ante: <b>{boss.name}</b> — {boss.description}
        </p>
      )}
      <p className="modal-note">
        Seed <b>{view.run.seed}</b> · Best hand <b>{view.run.bestHandScore.toLocaleString("en-US")}</b>
      </p>
    </Modal>
  );
}

export function DeckModal({ onClose }: { onClose: () => void }) {
  const view = useGameStore((s) => s.view);
  const all = allCards(view.deck);
  const inPile = new Set(view.deck.drawPile.map((c) => c.id));
  return (
    <Modal title={`Full deck · ${all.length} cards`} onClose={onClose}>
      <p className="modal-note">Bright cards are still in the draw pile.</p>
      <div className="deck-grid">
        {SUITS.map((s) => (
          <div key={s} className={clsx("deck-row", isRed(s) ? "red" : "black")}>
            <span className="deck-suit">{suitSymbol(s)}</span>
            {[...RANKS].reverse().map((r) => {
              const cards = all.filter((c) => c.suit === s && c.rank === r && c.enhancement !== "STONE");
              return (
                <span key={r} className={clsx("deck-cell", cards.length === 0 && "none")}>
                  {cards.map((c) => (
                    <span
                      key={c.id}
                      className={clsx("mini", !inPile.has(c.id) && "used", c.enhancement && `enh-${c.enhancement.toLowerCase()}`)}
                      title={c.enhancement ?? undefined}
                    >
                      {r}
                    </span>
                  ))}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function OptionsModal({ onClose }: { onClose: () => void }) {
  const settings = useGameStore((s) => s.settings);
  const setSettings = useGameStore((s) => s.setSettings);
  const abandon = useGameStore((s) => s.abandonRun);
  const status = useGameStore((s) => s.view.status);
  return (
    <Modal title="Options" onClose={onClose}>
      <div className="options">
        <div className="option">
          <span>Game speed</span>
          <div className="seg">
            {([1, 2, 4] as const).map((sp) => (
              <button key={sp} type="button" className={clsx("btn btn-seg", settings.speed === sp && "on")} onClick={() => setSettings({ speed: sp })}>
                {sp}×
              </button>
            ))}
          </div>
        </div>
        <label className="option">
          <span>Sound</span>
          <input type="checkbox" checked={!settings.muted} onChange={(e) => setSettings({ muted: !e.target.checked })} />
        </label>
        <label className="option">
          <span>CRT filter</span>
          <input type="checkbox" checked={settings.crt} onChange={(e) => setSettings({ crt: e.target.checked })} />
        </label>
        {status !== "MENU" && (
          <button
            type="button"
            className="btn btn-discard"
            onClick={() => {
              abandon();
              onClose();
            }}
          >
            Abandon run
          </button>
        )}
      </div>
    </Modal>
  );
}
