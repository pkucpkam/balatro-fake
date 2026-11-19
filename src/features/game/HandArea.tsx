import { AnimatePresence, Reorder, motion, type Variants } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { PlayingCardView } from "@/ui/components/PlayingCardView";
import { useGameStore } from "./gameStore";

export function HandArea() {
  const view = useGameStore((s) => s.view);
  const seq = useGameStore((s) => s.seq);
  const selected = useGameStore((s) => s.selectedCardIds);
  const toggle = useGameStore((s) => s.toggleCard);
  const dispatch = useGameStore((s) => s.dispatch);
  const busy = useGameStore((s) => s.busy);

  const hand = view.deck.hand;
  const [order, setOrder] = useState(hand.map((c) => c.id));
  useEffect(() => setOrder(hand.map((c) => c.id)), [hand]);
  const dragged = useRef(new Set<string>());
  const byId = new Map(hand.map((c) => [c.id, c]));
  const playedIds = new Set(seq?.played.map((c) => c.id) ?? []);

  const commit = () => {
    const now = hand.map((c) => c.id);
    if (order.length === now.length && order.some((id, i) => id !== now[i])) {
      dispatch({ type: "REORDER_HAND", cardIds: order });
    }
  };

  const n = order.length;
  return (
    <Reorder.Group axis="x" values={order} onReorder={setOrder} className="hand" aria-label="Your hand">
      <AnimatePresence custom={playedIds} initial={false}>
        {order.map((id, i) => {
          const card = byId.get(id);
          if (!card) return null;
          const off = i - (n - 1) / 2;
          const variants = {
            enter: { opacity: 0, x: 420, y: 60, rotate: 25 },
            idle: { opacity: 1, x: 0, y: 0, rotate: 0, transition: { type: "spring", stiffness: 260, damping: 24, delay: 0.035 * i } },
            exit: (played: Set<string>) =>
              played.has(id)
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, x: 380, y: -80, rotate: 30, transition: { duration: 0.35, ease: "easeIn" as const } },
          } satisfies Variants;
          return (
            <Reorder.Item
              key={id}
              value={id}
              layoutId={`card-${id}`}
              className="hand-slot"
              variants={variants}
              initial="enter"
              animate="idle"
              exit="exit"
              dragListener={!busy}
              whileDrag={{ scale: 1.08, zIndex: 30 }}
              onDragStart={() => dragged.current.add(id)}
              onDragEnd={() => {
                commit();
                setTimeout(() => dragged.current.delete(id), 0);
              }}
            >
              <motion.div
                className="fan"
                style={{ rotate: off * 2.4, y: off * off * 1.6, "--i": i } as unknown as Record<string, number>}
              >
                <PlayingCardView
                  card={card}
                  popupTarget={`held:${id}`}
                  selected={selected.includes(id)}
                  onClick={() => {
                    if (!dragged.current.has(id)) toggle(id);
                  }}
                  className="float"
                />
              </motion.div>
            </Reorder.Item>
          );
        })}
      </AnimatePresence>
    </Reorder.Group>
  );
}

export function ActionBar() {
  const view = useGameStore((s) => s.view);
  const selected = useGameStore((s) => s.selectedCardIds);
  const busy = useGameStore((s) => s.busy);
  const dispatch = useGameStore((s) => s.dispatch);
  const clear = useGameStore((s) => s.clearSelection);
  const ids = view.deck.hand.filter((c) => selected.includes(c.id)).map((c) => c.id);
  const canPlay = !busy && view.status === "PLAYING" && ids.length > 0;
  const canDiscard = canPlay && view.player.discardsRemaining > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Enter" && canPlay) dispatch({ type: "PLAY_HAND", cardIds: ids });
      else if ((e.key === "d" || e.key === "D") && canDiscard) dispatch({ type: "DISCARD", cardIds: ids });
      else if (e.key === "Escape") clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPlay, canDiscard, ids, dispatch, clear]);

  return (
    <div className="actions">
      <button type="button" className="btn btn-play" disabled={!canPlay} onClick={() => dispatch({ type: "PLAY_HAND", cardIds: ids })}>
        Play hand
        <kbd>Enter</kbd>
      </button>
      <div className="sort-group" role="group" aria-label="Sort hand">
        <span className="label">Sort hand</span>
        <div>
          <button type="button" className="btn btn-sort" disabled={busy} onClick={() => dispatch({ type: "SORT_HAND", by: "RANK" })}>
            Rank
          </button>
          <button type="button" className="btn btn-sort" disabled={busy} onClick={() => dispatch({ type: "SORT_HAND", by: "SUIT" })}>
            Suit
          </button>
        </div>
      </div>
      <button type="button" className="btn btn-discard" disabled={!canDiscard} onClick={() => dispatch({ type: "DISCARD", cardIds: ids })}>
        Discard
        <kbd>D</kbd>
      </button>
    </div>
  );
}
