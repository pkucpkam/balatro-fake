import clsx from "clsx";
import { useEffect, useMemo } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { evaluateHand } from "@/engine/poker/HandEvaluator";
import { getHandValues } from "@/engine/poker/HandLevels";
import { HAND_BASE } from "@/engine/poker/HandRank";
import { blindLabel, activeBoss } from "@/engine/core/GameReducer";
import { BLIND_REWARD } from "@/engine/blind/BlindTable";
import { BOSS_REGISTRY } from "@/content/blinds/bosses";
import { fmt, fmtMult } from "@/ui/format";
import { Popups } from "@/ui/components/Popups";
import { usePulse } from "@/ui/components/usePulse";
import { useGameStore } from "./gameStore";

function RollingNumber({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => fmt(v));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, ease: [0.2, 0.8, 0.2, 1] });
    return () => c.stop();
  }, [value, mv]);
  return <motion.span className={className}>{text}</motion.span>;
}

function ScoreBox({ kind, value }: { kind: "chips" | "mult"; value: string }) {
  const scope = usePulse<HTMLDivElement>(`hud-${kind}`);
  return (
    <motion.div className={clsx("score-chip", kind)} ref={scope} key={kind}>
      <motion.span key={value} initial={{ scale: 1.35 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 700, damping: 18 }}>
        {value}
      </motion.span>
    </motion.div>
  );
}

export function Hud({ onRunInfo, onOptions }: { onRunInfo: () => void; onOptions: () => void }) {
  const view = useGameStore((s) => s.view);
  const seq = useGameStore((s) => s.seq);
  const selectedIds = useGameStore((s) => s.selectedCardIds);
  const { round, player, run } = view;
  const boss = view.round.blindType === "BOSS" ? BOSS_REGISTRY[run.bossId] : undefined;
  const live = activeBoss(view);

  const preview = useMemo(() => {
    if (seq || view.status !== "PLAYING") return null;
    const sel = view.deck.hand.filter((c) => selectedIds.includes(c.id));
    if (sel.length === 0) return null;
    const r = evaluateHand(sel, view.rules);
    return { name: HAND_BASE[r.handType].name, level: view.handLevels[r.handType].level, ...getHandValues(view.handLevels, r.handType) };
  }, [seq, view, selectedIds]);

  const handName = seq ? seq.handName : preview?.name;
  const level = seq ? seq.level : preview?.level;
  const chips = seq ? seq.chips : (preview?.chips ?? 0);
  const mult = seq ? seq.mult : (preview?.mult ?? 0);
  const showBlind = view.status !== "SHOP";

  return (
    <aside className="hud" style={{ "--boss-hue": boss?.hue ?? 42 } as React.CSSProperties}>
      {showBlind ? (
        <section className={clsx("hud-blind", boss && "is-boss")}>
          <div className="hud-blind-name">{blindLabel(view)}</div>
          <div className="hud-blind-body">
            <div className={clsx("blind-token", `token-${round.blindType.toLowerCase()}`)} aria-hidden>
              {boss ? boss.name.replace("The ", "").slice(0, 1) : round.blindType === "SMALL" ? "S" : "B"}
            </div>
            <div>
              <div className="label">Score at least</div>
              <div className="hud-target">{fmt(round.targetScore)}</div>
              <div className="label">
                Reward <span className="money">{"$".repeat(BLIND_REWARD[round.blindType])}</span>
              </div>
            </div>
          </div>
          {live && <div className="hud-boss-rule">{live.description}</div>}
          <Popups target="boss" placement="bottom" />
        </section>
      ) : (
        <section className="hud-blind shop-sign">
          <div className="hud-blind-name">Shop</div>
          <div className="label">Improve your run</div>
        </section>
      )}

      <section className="hud-round">
        <span className="label">Round score</span>
        <RollingNumber value={round.currentScore} className="hud-round-score" />
      </section>

      <section className={clsx("hud-hand", seq?.onFire && "on-fire")}>
        <div className="hud-hand-name">
          {handName ? (
            <>
              {handName} <span className="lvl">lvl.{level}</span>
            </>
          ) : (
            <span className="muted">Select cards</span>
          )}
        </div>
        <div className="hud-calc">
          <ScoreBox kind="chips" value={fmt(chips)} />
          <span className="times">×</span>
          <ScoreBox kind="mult" value={fmtMult(mult)} />
        </div>
        {seq?.onFire && <div className="flames" aria-hidden />}
        <Popups target="hud" placement="bottom" />
      </section>

      <section className="hud-stats">
        <div className="stat">
          <span className="label">Hands</span>
          <b className="hands">{player.handsRemaining}</b>
        </div>
        <div className="stat">
          <span className="label">Discards</span>
          <b className="discards">{player.discardsRemaining}</b>
        </div>
        <div className="stat wide">
          <span className="label">Money</span>
          <b className="money big">${player.money}</b>
        </div>
        <div className="stat">
          <span className="label">Ante</span>
          <b>
            {run.ante}
            <small>/{run.winningAnte}</small>
          </b>
        </div>
        <div className="stat">
          <span className="label">Round</span>
          <b>{run.round}</b>
        </div>
      </section>

      <div className="hud-buttons">
        <button type="button" className="btn btn-ghost" onClick={onRunInfo}>
          Run info
        </button>
        <button type="button" className="btn btn-ghost" onClick={onOptions}>
          Options
        </button>
      </div>
    </aside>
  );
}
