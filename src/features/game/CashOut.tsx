import { motion } from "motion/react";
import { useGameStore } from "./gameStore";

export function CashOut() {
  const view = useGameStore((s) => s.view);
  const dispatch = useGameStore((s) => s.dispatch);
  const co = view.cashOut;
  if (!co) return null;
  return (
    <motion.div
      className="cashout"
      initial={{ y: 200, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 24 }}
    >
      <button type="button" className="btn btn-cashout" onClick={() => dispatch({ type: "CASH_OUT" })} autoFocus>
        Cash out: <span className="money">${co.total}</span>
      </button>
      <ul className="cashout-lines">
        {co.lines.map((l, i) => (
          <motion.li
            key={l.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.18 }}
          >
            <span>{l.label}</span>
            <span className="money">{l.amount <= 8 ? "$".repeat(l.amount) : `$${l.amount}`}</span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
