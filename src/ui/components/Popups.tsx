import { AnimatePresence, motion } from "motion/react";
import { useShallow } from "zustand/react/shallow";
import { useGameStore } from "@/features/game/gameStore";

/** Floating "+30" / "X2 Mult" texts anchored to a card, joker or HUD box. */
export function Popups({ target, placement = "top" }: { target: string; placement?: "top" | "bottom" }) {
  const popups = useGameStore(useShallow((s) => s.popups.filter((p) => p.target === target)));
  return (
    <div className={`popup-anchor ${placement}`} aria-live="polite">
      <AnimatePresence>
        {popups.slice(-2).map((p) => (
          <motion.div
            key={p.id}
            className={`popup popup-${p.kind.toLowerCase()}`}
            initial={{ opacity: 0, y: 12, scale: 0.5, rotate: -6 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: -16, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 600, damping: 22 }}
          >
            {p.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
