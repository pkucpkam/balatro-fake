import clsx from "clsx";
import { motion } from "motion/react";
import { BLIND_ORDER, BLIND_REWARD, blindTarget } from "@/engine/blind/BlindTable";
import { BOSS_REGISTRY } from "@/content/blinds/bosses";
import { fmt } from "@/ui/format";
import { useGameStore } from "../game/gameStore";

export function BlindSelect() {
  const view = useGameStore((s) => s.view);
  const dispatch = useGameStore((s) => s.dispatch);
  const current = BLIND_ORDER.indexOf(view.round.blindType);
  const boss = BOSS_REGISTRY[view.run.bossId];

  return (
    <div className="blind-select">
      {BLIND_ORDER.map((b, i) => {
        const isBoss = b === "BOSS";
        const name = isBoss ? (boss?.name ?? "Boss") : b === "SMALL" ? "Small Blind" : "Big Blind";
        const state = i < current ? "defeated" : i === current ? "current" : "upcoming";
        return (
          <motion.article
            key={b}
            className={clsx("blind-card", state, isBoss && "boss")}
            style={{ "--boss-hue": isBoss ? (boss?.hue ?? 0) : b === "SMALL" ? 210 : 35 } as React.CSSProperties}
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: state === "current" ? -12 : 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 22, delay: i * 0.07 }}
          >
            <header className="blind-card-head">{name}</header>
            <div className={clsx("blind-token big", `token-${b.toLowerCase()}`)} aria-hidden>
              {isBoss ? (boss?.name.replace("The ", "").slice(0, 1) ?? "B") : b === "SMALL" ? "S" : "B"}
            </div>
            {isBoss && <p className="blind-rule">{boss?.description}</p>}
            <div className="blind-target">
              <span className="label">Score at least</span>
              <b>{fmt(blindTarget(view.run.ante, b, isBoss ? boss?.scoreMult : undefined))}</b>
              <span className="label">
                Reward <span className="money">{"$".repeat(BLIND_REWARD[b])}+</span>
              </span>
            </div>
            {state === "current" ? (
              <button type="button" className="btn btn-select" onClick={() => dispatch({ type: "SELECT_BLIND" })} autoFocus>
                Select
              </button>
            ) : (
              <div className="blind-state">{state === "defeated" ? "Defeated" : "Upcoming"}</div>
            )}
          </motion.article>
        );
      })}
    </div>
  );
}
