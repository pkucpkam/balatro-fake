import { useEffect } from "react";
import { useAnimate } from "motion/react";
import { useGameStore } from "@/features/game/gameStore";
import { FX_MOTION, glow, sparks, type FxKind } from "@/ui/fx/scoreFx";

/**
 * Plays the trigger effect (motion + glow + sparks, styled by step kind)
 * whenever the scoring sequence fires `target`.
 */
export function usePulse<T extends HTMLElement>(target: string) {
  const [scope, animate] = useAnimate<T>();
  const pulse = useGameStore((s) => (s.seq?.active === target ? s.seq.pulse : 0));
  useEffect(() => {
    const el = scope.current;
    if (!pulse || !el) return;
    const { seq, settings } = useGameStore.getState();
    const kind: FxKind = seq?.activeKind ?? "BASE";
    const fx = FX_MOTION[kind];
    // Jokers sit small in the tray: give their trigger a longer, stronger beat.
    const isJoker = target.startsWith("joker:");
    const duration = (fx.duration * (isJoker ? 1.35 : 1)) / settings.speed;
    glow(el, kind, duration * 1000 + (isJoker ? 260 : 120));
    sparks(el, kind, settings.speed);
    if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      void animate(el, fx.keyframes, { duration, ease: "easeOut" });
    }
  }, [pulse, animate, scope]);
  return scope;
}

/** Pointer-follow 3D tilt via CSS variables (no React re-render). */
export const tiltHandlers = {
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${x * 18}deg`);
    el.style.setProperty("--rx", `${-y * 18}deg`);
    el.style.setProperty("--mx", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--my", `${(y + 0.5) * 100}%`);
  },
  onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget;
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--rx", "0deg");
  },
};
