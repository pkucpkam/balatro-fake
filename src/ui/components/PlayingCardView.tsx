import clsx from "clsx";
import {
  EDITION_INFO,
  ENHANCEMENT_INFO,
  SEAL_INFO,
  RANK_CHIPS,
  isRed,
  isStone,
  suitSymbol,
  type PlayingCard,
} from "@/engine/cards/Card";
import { Popups } from "./Popups";
import { tiltHandlers, usePulse } from "./usePulse";

const FACE_GLYPH: Record<string, string> = { J: "♞", Q: "♛", K: "♚" };

/** Pip grid positions (percent) for number cards — a compact, original layout. */
const PIPS: Record<string, [number, number][]> = {
  "2": [[50, 22], [50, 78]],
  "3": [[50, 20], [50, 50], [50, 80]],
  "4": [[32, 22], [68, 22], [32, 78], [68, 78]],
  "5": [[32, 22], [68, 22], [50, 50], [32, 78], [68, 78]],
  "6": [[32, 22], [68, 22], [32, 50], [68, 50], [32, 78], [68, 78]],
  "7": [[32, 20], [68, 20], [50, 35], [32, 50], [68, 50], [32, 80], [68, 80]],
  "8": [[32, 20], [68, 20], [50, 35], [32, 50], [68, 50], [50, 65], [32, 80], [68, 80]],
  "9": [[32, 18], [68, 18], [32, 39], [68, 39], [50, 50], [32, 61], [68, 61], [32, 82], [68, 82]],
  "10": [[32, 18], [68, 18], [50, 30], [32, 41], [68, 41], [32, 59], [68, 59], [50, 70], [32, 82], [68, 82]],
};

function CardFace({ card }: { card: PlayingCard }) {
  if (isStone(card)) {
    return (
      <div className="face stone-face">
        <span className="stone-mark">◆</span>
      </div>
    );
  }
  const sym = suitSymbol(card.suit);
  const pips = PIPS[card.rank];
  return (
    <div className="face">
      <span className="corner tl">
        <b>{card.rank}</b>
        <i>{sym}</i>
      </span>
      <span className="corner br">
        <b>{card.rank}</b>
        <i>{sym}</i>
      </span>
      {pips ? (
        <div className="pips">
          {pips.map(([x, y], i) => (
            <span key={i} className={clsx("pip", y > 55 && "flip")} style={{ left: `${x}%`, top: `${y}%` }}>
              {sym}
            </span>
          ))}
        </div>
      ) : card.rank === "A" ? (
        <span className="ace">{sym}</span>
      ) : (
        <div className="portrait">
          <span className="portrait-glyph">{FACE_GLYPH[card.rank]}</span>
          <span className="portrait-suit">{sym}</span>
        </div>
      )}
    </div>
  );
}

export function cardTooltip(card: PlayingCard): string[] {
  const lines: string[] = [];
  if (isStone(card)) lines.push("+50 Chips");
  else lines.push(`${card.rank}${suitSymbol(card.suit)} · +${RANK_CHIPS[card.rank] + card.bonusChips} Chips`);
  if (card.enhancement) lines.push(`${ENHANCEMENT_INFO[card.enhancement].name}: ${ENHANCEMENT_INFO[card.enhancement].text}`);
  if (card.edition) lines.push(`${EDITION_INFO[card.edition].name}: ${EDITION_INFO[card.edition].text}`);
  if (card.seal) lines.push(`${SEAL_INFO[card.seal].name}: ${SEAL_INFO[card.seal].text}`);
  if (card.debuffed) lines.push("Debuffed by the boss");
  return lines;
}

interface Props {
  card: PlayingCard;
  selected?: boolean;
  scoring?: boolean;
  dim?: boolean;
  popupTarget?: string;
  tooltip?: boolean;
  onClick?: () => void;
  className?: string;
}

export function PlayingCardView({ card, selected, scoring, dim, popupTarget, tooltip = true, onClick, className }: Props) {
  const target = popupTarget ?? `card:${card.id}`;
  const scope = usePulse<HTMLDivElement>(target);
  const red = isRed(card.suit);
  return (
    <div className={clsx("card-shell", className)} ref={scope}>
      <button
        type="button"
        className={clsx(
          "card",
          red ? "red" : "black",
          card.enhancement && `enh-${card.enhancement.toLowerCase()}`,
          card.edition && `ed-${card.edition.toLowerCase()}`,
          selected && "selected",
          scoring && "scoring",
          dim && "dim",
          card.debuffed && "debuffed",
        )}
        onClick={onClick}
        aria-pressed={selected}
        aria-label={cardTooltip(card).join(". ")}
        {...tiltHandlers}
      >
        <CardFace card={card} />
        {card.edition && <span className="edition-sheen" />}
        {card.seal && <span className={clsx("seal", `seal-${card.seal.toLowerCase()}`)} />}
        {card.debuffed && <span className="debuff-x">✕</span>}
        <span className="gloss" />
      </button>
      {tooltip && (
        <div className="tip" role="tooltip">
          {cardTooltip(card).map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
      <Popups target={target} />
    </div>
  );
}

export function CardBack({ count }: { count?: number }) {
  return (
    <div className="card-back">
      <span className="back-pattern" />
      {count !== undefined && <span className="back-count">{count}</span>}
    </div>
  );
}
