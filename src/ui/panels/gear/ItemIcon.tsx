import { qualityEdge } from './tooltipLines';

/**
 * An item's icon, from the same CDN the talent trees already use.
 *
 * ----------------------------------------------------------------------------
 * `TalentPanel` has pulled its 466 icons from `wow.zamimg.com` since the trees
 * were built, so this adds no new dependency and no new failure mode -- an
 * offline page draws a slot-shaped hole here exactly as it draws a tree of
 * holes there.
 *
 * THE EMPTY SLOT IS THE SAME TILE, deliberately. A slot with nothing in it is
 * a bordered square of the same size, so the two columns do not jump a row
 * taller the moment something is equipped.
 * ----------------------------------------------------------------------------
 */
const ICON_BASE = 'https://wow.zamimg.com/images/wow/icons/medium';

export function ItemIcon({
  icon,
  quality,
  size = 36,
}: {
  readonly icon?: string;
  /** Draws the border in the quality colour, as a character pane does. */
  readonly quality?: number;
  readonly size?: number;
}) {
  const style = {
    width: size,
    height: size,
    ...(quality !== undefined ? { borderColor: qualityEdge(quality) } : {}),
  };

  if (!icon) return <span className="item-icon is-empty" style={style} aria-hidden="true" />;

  return (
    <img
      className="item-icon"
      style={style}
      src={`${ICON_BASE}/${icon}.jpg`}
      alt=""
      loading="lazy"
      draggable={false}
    />
  );
}
