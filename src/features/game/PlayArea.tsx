import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { PlayingCardView } from "@/ui/components/PlayingCardView";
import { fmt } from "@/ui/format";
import { useGameStore } from "./gameStore";

export function PlayArea() {
  const seq = useGameStore((s) => s.seq);
  return (
    <div className="play-area">
      {seq && (
        <div className="played-row">
          {seq.played.map((c, i) => {
            const scoring = seq.scoringIds.includes(c.id);
            const broken = seq.destroyed.includes(c.id);
            return (
              <motion.div
                key={c.id}
                layoutId={`card-${c.id}`}
                className="played-slot"
                animate={
                  seq.phase === "exit"
                    ? { x: 520, y: -40, rotate: 18, opacity: 0, transition: { delay: i * 0.04, duration: 0.3 } }
                    : broken
                      ? { scale: [1, 1.2, 0], rotate: [0, -15, 40], opacity: [1, 1, 0], transition: { duration: 0.5 } }
                      : { y: scoring && seq.phase !== "enter" ? -26 : 0, opacity: 1 }
                }
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
              >
                <PlayingCardView card={c} scoring={scoring} dim={!scoring && seq.phase !== "enter"} tooltip={false} />
              </motion.div>
            );
          })}
        </div>
      )}
      <AnimatePresence>
        {seq && seq.score !== null && seq.phase === "total" && (
          <motion.div
            className={clsx("total-burst", seq.onFire && "hot")}
            initial={{ scale: 0.2, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ type: "spring", stiffness: 420, damping: 16 }}
          >
            {fmt(seq.score)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
