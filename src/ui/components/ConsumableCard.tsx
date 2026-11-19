import clsx from "clsx";
import type { ConsumableKind, GameState } from "@/engine/core/GameState";
import { HAND_BASE } from "@/engine/poker/HandRank";
import { PLANET_REGISTRY, PLANETS } from "@/content/planets/planets";
import { TAROT_REGISTRY } from "@/content/tarots/tarots";
import { tiltHandlers } from "./usePulse";

interface Props {
  kind: ConsumableKind;
  defId: string;
  state: GameState;
  selected?: boolean;
  onClick?: () => void;
  tipBelow?: boolean;
}

export function consumableInfo(kind: ConsumableKind, defId: string, state: GameState) {
  if (kind === "PLANET") {
    const p = PLANET_REGISTRY[defId];
    if (!p) return { name: defId, text: "" };
    const lvl = state.handLevels[p.hand].level;
    const base = HAND_BASE[p.hand];
    return {
      name: p.name,
      text: `Level up ${base.name} (Lv.${lvl} → ${lvl + 1}): +${base.multPerLevel} Mult, +${base.chipsPerLevel} Chips`,
    };
  }
  const t = TAROT_REGISTRY[defId];
  return { name: t?.name ?? defId, text: t?.description ?? "" };
}

export function ConsumableCard({ kind, defId, state, selected, onClick, tipBelow }: Props) {
  const info = consumableInfo(kind, defId, state);
  const planetIdx = PLANETS.findIndex((p) => p.id === defId);
  const tarot = TAROT_REGISTRY[defId];
  return (
    <div className="card-shell consumable-shell">
      <button
        type="button"
        className={clsx("consumable", kind === "PLANET" ? "planet" : "tarot", selected && "selected")}
        style={{ "--hue": planetIdx >= 0 ? (planetIdx * 37) % 360 : 280 } as React.CSSProperties}
        onClick={onClick}
        aria-pressed={selected}
        aria-label={`${info.name}: ${info.text}`}
        {...tiltHandlers}
      >
        {kind === "PLANET" ? (
          <>
            <span className="stars" />
            <span className="planet-orb" />
            {planetIdx % 3 === 1 && <span className="planet-ring" />}
          </>
        ) : (
          <>
            <span className="tarot-numeral">{tarot?.glyph}</span>
            <span className="tarot-eye">✶</span>
          </>
        )}
        <span className="consumable-name">{info.name}</span>
        <span className="gloss" />
      </button>
      <div className={clsx("tip", tipBelow && "below")} role="tooltip">
        <div className="tip-title">{info.name}</div>
        <div className="tip-body">{info.text}</div>
        <div className="tip-rarity">{kind === "PLANET" ? "planet" : "tarot"}</div>
      </div>
    </div>
  );
}
