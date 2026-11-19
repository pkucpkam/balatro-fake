import { AnimatePresence, Reorder, motion } from "motion/react";
import { useEffect, useState } from "react";
import { JokerCard } from "@/ui/components/JokerCard";
import { ConsumableCard } from "@/ui/components/ConsumableCard";
import { TAROT_REGISTRY } from "@/content/tarots/tarots";
import { useGameStore } from "./gameStore";

export function JokerRow() {
  const view = useGameStore((s) => s.view);
  const selectedJokerId = useGameStore((s) => s.selectedJokerId);
  const selectJoker = useGameStore((s) => s.selectJoker);
  const dispatch = useGameStore((s) => s.dispatch);
  const busy = useGameStore((s) => s.busy);
  const [order, setOrder] = useState(view.jokers.map((j) => j.id));
  useEffect(() => setOrder(view.jokers.map((j) => j.id)), [view.jokers]);
  const byId = new Map(view.jokers.map((j) => [j.id, j]));

  const commitOrder = (id: string) => {
    const to = order.indexOf(id);
    const from = view.jokers.findIndex((j) => j.id === id);
    if (to >= 0 && to !== from) dispatch({ type: "MOVE_JOKER", jokerId: id, toIndex: to });
  };

  return (
    <section className="tray joker-tray" aria-label="Jokers">
      <Reorder.Group axis="x" values={order} onReorder={setOrder} className="tray-cards">
        <AnimatePresence initial={false}>
          {order.map((id) => {
            const j = byId.get(id);
            if (!j) return null;
            return (
              <Reorder.Item
                key={id}
                value={id}
                className="tray-item"
                dragListener={!busy}
                onDragEnd={() => commitOrder(id)}
                initial={{ opacity: 0, y: -40, rotate: -10 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.4, rotate: 20 }}
                whileDrag={{ scale: 1.1, zIndex: 20 }}
              >
                <JokerCard
                  defId={j.defId}
                  instance={j}
                  state={view}
                  tipBelow
                  selected={selectedJokerId === id}
                  onClick={() => selectJoker(selectedJokerId === id ? null : id)}
                />
                <AnimatePresence>
                  {selectedJokerId === id && (
                    <motion.button
                      type="button"
                      className="btn btn-sell"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      onClick={() => dispatch({ type: "SELL_JOKER", jokerId: id })}
                    >
                      Sell ${j.sellValue}
                    </motion.button>
                  )}
                </AnimatePresence>
              </Reorder.Item>
            );
          })}
        </AnimatePresence>
      </Reorder.Group>
      <div className="tray-count">
        {view.jokers.length}/{view.player.jokerSlots}
      </div>
    </section>
  );
}

export function ConsumableRow() {
  const view = useGameStore((s) => s.view);
  const selectedId = useGameStore((s) => s.selectedConsumableId);
  const selectConsumable = useGameStore((s) => s.selectConsumable);
  const selectedCards = useGameStore((s) => s.selectedCardIds);
  const dispatch = useGameStore((s) => s.dispatch);

  return (
    <section className="tray consumable-tray" aria-label="Consumables">
      <div className="tray-cards">
        <AnimatePresence initial={false}>
          {view.consumables.map((c) => {
            const t = c.kind === "TAROT" ? TAROT_REGISTRY[c.defId] : undefined;
            const needs = t ? t.maxTargets : 0;
            const ready = !t || needs === 0 || (selectedCards.length >= t.minTargets && selectedCards.length <= t.maxTargets);
            return (
              <motion.div
                key={c.id}
                className="tray-item"
                layout
                initial={{ opacity: 0, y: -40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.4, filter: "brightness(3)" }}
              >
                <ConsumableCard
                  kind={c.kind}
                  defId={c.defId}
                  state={view}
                  tipBelow
                  selected={selectedId === c.id}
                  onClick={() => selectConsumable(selectedId === c.id ? null : c.id)}
                />
                {selectedId === c.id && (
                  <div className="consumable-actions">
                    <button
                      type="button"
                      className="btn btn-use"
                      disabled={!ready}
                      title={ready ? undefined : `Select ${t?.minTargets === t?.maxTargets ? t?.minTargets : `1–${t?.maxTargets}`} card(s) in hand`}
                      onClick={() =>
                        dispatch({ type: "USE_CONSUMABLE", consumableId: c.id, targetCardIds: needs > 0 ? selectedCards : [] })
                      }
                    >
                      Use
                    </button>
                    <button type="button" className="btn btn-sell" onClick={() => dispatch({ type: "SELL_CONSUMABLE", consumableId: c.id })}>
                      $1
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="tray-count">
        {view.consumables.length}/{view.player.consumableSlots}
      </div>
    </section>
  );
}
