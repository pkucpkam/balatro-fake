export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "naneinf";
  if (Math.abs(n) >= 1e11) return n.toExponential(3).replace("+", "");
  return Math.floor(n).toLocaleString("en-US");
}

/** Mult may be fractional after XMult; show at most 2 decimals. */
export function fmtMult(n: number): string {
  if (Math.abs(n) >= 1e11) return n.toExponential(3).replace("+", "");
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? r.toLocaleString("en-US") : r.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
