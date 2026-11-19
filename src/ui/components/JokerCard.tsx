import clsx from "clsx";
import { EDITION_INFO } from "@/engine/cards/Card";
import type { GameState, JokerInstance } from "@/engine/core/GameState";
import type { EditionType } from "@/engine/cards/Card";
import { JOKER_REGISTRY } from "@/content/jokers/jokers";
import { Popups } from "./Popups";
import { tiltHandlers, usePulse } from "./usePulse";

interface Props {
  defId: string;
  instance?: JokerInstance;
  edition?: EditionType;
  state?: GameState;
  selected?: boolean;
  onClick?: () => void;
  tipBelow?: boolean;
}

export function JokerCard({ defId, instance, edition, state, selected, onClick, tipBelow }: Props) {
  const def = JOKER_REGISTRY[defId];
  const target = instance ? `joker:${instance.id}` : `shop:${defId}`;
  const scope = usePulse<HTMLDivElement>(target);
  if (!def) return null;
  const ed = instance?.edition ?? edition;
  const status = instance && state ? def.status?.(instance, state) : null;
  return (
    <div className="card-shell joker-shell" ref={scope}>
      <button
        type="button"
        className={clsx("joker", `rarity-${def.rarity.toLowerCase()}`, ed && `ed-${ed.toLowerCase()}`, selected && "selected")}
        style={{ "--hue": def.art.hue } as React.CSSProperties}
        onClick={onClick}
        aria-pressed={selected}
        aria-label={`${def.name}: ${def.description}`}
        {...tiltHandlers}
      >
        <span className="joker-frame" />
        <span className="joker-glyph">{def.art.glyph}</span>
        <span className="joker-name">{def.name}</span>
        {ed && <span className="edition-sheen" />}
        <span className="gloss" />
      </button>
      <div className={clsx("tip", tipBelow && "below")} role="tooltip">
        <div className="tip-title">{def.name}</div>
        <div className="tip-body">{def.description}</div>
        {status && <div className="tip-status">{status}</div>}
        {ed && (
          <div className="tip-edition">
            {EDITION_INFO[ed].name}: {EDITION_INFO[ed].text}
          </div>
        )}
        <div className={clsx("tip-rarity", `rarity-${def.rarity.toLowerCase()}`)}>{def.rarity.toLowerCase()}</div>
      </div>
      <Popups target={target} placement="bottom" />
    </div>
  );
}
