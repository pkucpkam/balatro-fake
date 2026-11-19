import { motion } from "motion/react";
import { useState } from "react";
import { useGameStore } from "../game/gameStore";
import { useAccountLabel } from "../account/AccountModal";

function randomSeed(): string {
  // UI-side only: picking a seed is not game logic.
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

const TITLE = "BALATRO";

export function MainMenu({ onOptions, onAccount }: { onOptions: () => void; onAccount: () => void }) {
  const accountLabel = useAccountLabel();
  const dispatch = useGameStore((s) => s.dispatch);
  const hasSave = useGameStore((s) => s.hasSave);
  const continueRun = useGameStore((s) => s.continueRun);
  const [seed, setSeed] = useState(randomSeed);

  return (
    <div className="menu">
      <h1 className="title" aria-label="Balatro Fake">
        {TITLE.split("").map((ch, i) => (
          <motion.span
            key={i}
            className="title-letter"
            initial={{ y: -120, opacity: 0, rotate: -30 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.08 * i }}
            style={{ "--i": i } as React.CSSProperties}
          >
            {ch}
          </motion.span>
        ))}
        <motion.span className="title-sub" initial={{ scale: 0, rotate: 20 }} animate={{ scale: 1, rotate: -8 }} transition={{ delay: 0.8, type: "spring" }}>
          fake
        </motion.span>
      </h1>

      <motion.div className="menu-panel" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.6 }}>
        {hasSave && (
          <button type="button" className="btn btn-select" onClick={continueRun}>
            Continue run
          </button>
        )}
        <button type="button" className="btn btn-play big" onClick={() => dispatch({ type: "START_RUN", seed: seed || randomSeed() })} autoFocus>
          New run
        </button>
        <label className="seed-field">
          <span className="label">Seed</span>
          <input value={seed} maxLength={16} onChange={(e) => setSeed(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} />
          <button type="button" className="btn btn-ghost" onClick={() => setSeed(randomSeed())} aria-label="Random seed">
            ⟳
          </button>
        </label>
        <button type="button" className="btn btn-ghost" onClick={onOptions}>
          Options
        </button>
        {accountLabel && (
          <button type="button" className="btn btn-ghost" onClick={onAccount}>
            {accountLabel === "Sign in" ? "Sign in · cloud save" : `Account · ${accountLabel}`}
          </button>
        )}
      </motion.div>
      <p className="menu-foot">Click cards to select · drag to reorder · Enter plays · D discards</p>
    </div>
  );
}

export { randomSeed };
