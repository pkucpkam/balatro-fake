import confetti from "canvas-confetti";

const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const COLORS = ["#e9b949", "#ff4a5a", "#2f8cff", "#f6eedc", "#9b5de5"];

export function celebrate(big = false) {
  if (reduced()) return;
  const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 50 } as const;
  confetti({ ...base, particleCount: big ? 160 : 70, spread: big ? 110 : 70, origin: { y: 0.65 }, scalar: 0.9, shapes: ["square"] });
  if (big) {
    setTimeout(() => confetti({ ...base, particleCount: 90, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } }), 200);
    setTimeout(() => confetti({ ...base, particleCount: 90, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } }), 350);
  }
}

export function coinBurst(x: number, y: number) {
  if (reduced()) return;
  confetti({
    particleCount: 18,
    spread: 50,
    startVelocity: 22,
    gravity: 1.4,
    ticks: 60,
    origin: { x, y },
    colors: ["#e9b949", "#ffd97a"],
    shapes: ["circle"],
    scalar: 0.7,
    disableForReducedMotion: true,
    zIndex: 50,
  });
}
