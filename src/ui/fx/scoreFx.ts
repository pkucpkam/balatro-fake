import type { ScoreStepKind } from "@/engine/core/GameEvent";

/**
 * Per-trigger effects for the scoring sequence: a glow class on the element
 * and a burst of sparks. Pure DOM (no React state) so dozens of triggers per
 * hand cost no re-renders.
 */

export type FxKind = ScoreStepKind | "INFO";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const SPARK_COLORS: Partial<Record<FxKind, string[]>> = {
  CHIPS: ["#7fb8ff", "#2f8cff", "#ffffff"],
  MULT: ["#ff8a8a", "#ff4d5a", "#ffffff"],
  XMULT: ["#ff4d5a", "#ffd97a", "#fff3c4", "#ff7b1a"],
  MONEY: ["#ffd97a", "#e9b949", "#fff3c4"],
  RETRIGGER: ["#7ff0e0", "#2bb3a3", "#ffffff"],
  DESTROY: ["#ffffff", "#d8f0ff", "#b9a9c9"],
};

const SPARK_COUNT: Partial<Record<FxKind, number>> = { CHIPS: 9, MULT: 10, XMULT: 18, MONEY: 10, RETRIGGER: 10, DESTROY: 14 };

/** Motion keyframes applied to the element's shell, per kind. */
export const FX_MOTION: Record<FxKind, { keyframes: Record<string, number[]>; duration: number }> = {
  BASE: { keyframes: { scale: [1, 1.06, 1] }, duration: 0.2 },
  CHIPS: { keyframes: { y: [0, -16, 0], scale: [1, 1.12, 1] }, duration: 0.32 },
  MULT: { keyframes: { scale: [1, 1.18, 1], rotate: [0, -7, 6, 0] }, duration: 0.34 },
  XMULT: { keyframes: { scale: [1, 1.34, 1.1, 1], rotate: [0, -11, 9, -4, 0] }, duration: 0.5 },
  MONEY: { keyframes: { y: [0, -12, 0], rotate: [0, 5, -5, 0] }, duration: 0.34 },
  RETRIGGER: { keyframes: { rotateY: [0, 360], scale: [1, 1.12, 1] }, duration: 0.42 },
  MESSAGE: { keyframes: { scale: [1, 1.1, 1], rotate: [0, -3, 3, 0] }, duration: 0.3 },
  DEBUFFED: { keyframes: { x: [0, -7, 7, -5, 5, 0] }, duration: 0.34 },
  DESTROY: { keyframes: { scale: [1, 1.15, 1] }, duration: 0.3 },
  INFO: { keyframes: { scale: [1, 1.1, 1] }, duration: 0.28 },
};

/** Restartable glow: `fx-<kind>` on the shell for the duration of the effect. */
export function glow(el: HTMLElement, kind: FxKind, ms: number) {
  const cls = `fx-${kind.toLowerCase()}`;
  el.classList.remove(...[...el.classList].filter((c) => c.startsWith("fx-")));
  void el.offsetWidth; // restart the CSS animation
  el.classList.add("fx-active", cls);
  el.style.setProperty("--fx-ms", `${Math.round(ms)}ms`);
  window.setTimeout(() => el.classList.remove("fx-active", cls), ms);
}

/** Sparks flying out of the element's centre. */
export function sparks(el: HTMLElement, kind: FxKind, speed = 1) {
  const colors = SPARK_COLORS[kind];
  if (!colors || reducedMotion()) return;
  const count = SPARK_COUNT[kind] ?? 8;
  const host = document.createElement("div");
  host.className = "fx-burst";
  host.setAttribute("aria-hidden", "true");
  const ms = Math.round(620 / speed);
  host.style.setProperty("--fx-ms", `${ms}ms`);
  const r = el.getBoundingClientRect();
  const reach = Math.max(r.width, r.height) * (kind === "XMULT" ? 0.95 : 0.7);
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const d = reach * (0.6 + Math.random() * 0.5);
    const s = document.createElement("span");
    s.className = kind === "MONEY" ? "fx-spark coin" : "fx-spark";
    s.style.setProperty("--dx", `${Math.cos(a) * d}px`);
    s.style.setProperty("--dy", `${Math.sin(a) * d}px`);
    s.style.setProperty("--c", colors[i % colors.length]!);
    s.style.setProperty("--sz", `${(kind === "XMULT" ? 9 : 7) + Math.random() * 5}px`);
    host.appendChild(s);
  }
  // Shockwave ring
  const ring = document.createElement("span");
  ring.className = "fx-ring";
  ring.style.setProperty("--c", colors[0]!);
  ring.style.setProperty("--r", `${Math.round(reach * 1.1)}px`);
  host.appendChild(ring);
  el.appendChild(host);
  window.setTimeout(() => host.remove(), ms + 50);
}
