import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { JokerCard } from "@/ui/components/JokerCard";
import { ConsumableCard } from "@/ui/components/ConsumableCard";
import { useGameStore } from "../game/gameStore";

export function Shop() {
  const view = useGameStore((s) => s.view);
  const dispatch = useGameStore((s) => s.dispatch);
  const shop = view.shop;
  if (!shop) return null;
  const money = view.player.money;

  return (
    <motion.div className="shop" initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 24 }}>
      <div className="shop-controls">
        <button type="button" className="btn btn-next" onClick={() => dispatch({ type: "LEAVE_SHOP" })}>
          Next round
        </button>
        <button type="button" className="btn btn-reroll" disabled={money < shop.rerollCost} onClick={() => dispatch({ type: "REROLL" })}>
          Reroll <span className="price">${shop.rerollCost}</span>
        </button>
      </div>
      <div className="shop-shelf">
        <AnimatePresence mode="popLayout">
          {shop.items.length === 0 && (
            <motion.p key="empty" className="shop-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              Sold out. Reroll for new cards or head to the next round.
            </motion.p>
          )}
          {shop.items.map((item, i) => {
            const full =
              item.kind === "JOKER"
                ? view.jokers.length >= view.player.jokerSlots
                : view.consumables.length >= view.player.consumableSlots;
            const poor = money < item.cost;
            return (
              <motion.div
                key={item.id}
                className="shop-item"
                layout
                initial={{ y: -60, opacity: 0, rotateY: 90 }}
                animate={{ y: 0, opacity: 1, rotateY: 0 }}
                exit={{ y: -140, opacity: 0, scale: 0.6 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: i * 0.08 }}
              >
                <div className={clsx("price-tag", poor && "poor")}>${item.cost}</div>
                {item.kind === "JOKER" ? (
                  <JokerCard defId={item.defId} edition={item.edition} />
                ) : (
                  <ConsumableCard kind={item.kind} defId={item.defId} state={view} />
                )}
                <button
                  type="button"
                  className="btn btn-buy"
                  disabled={poor || full}
                  title={full ? "No free slot" : poor ? "Not enough money" : undefined}
                  onClick={() => dispatch({ type: "BUY", itemId: item.id })}
                >
                  {full ? "Full" : "Buy"}
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
