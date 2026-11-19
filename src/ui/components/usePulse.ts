import { useEffect } from "react";
import { useAnimate } from "motion/react";
import { useGameStore } from "@/features/game/gameStore";

/** Bounce the element whenever the scoring sequence triggers `target`. */
export function usePulse<T extends Element>(target: string) {
  const [scope, animate] = useAnimate<T>();
  const pulse = useGameStore((s) => (s.seq?.active === target ? s.seq.pulse : 0));
  useEffect(() => {
    if (pulse && scope.current) {
      void animate(scope.current, { scale: [1, 1.16, 1], rotate: [0, -4, 3, 0] }, { duration: 0.32 });
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
