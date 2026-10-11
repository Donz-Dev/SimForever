import type { Enchant, Item } from '../../game/items/Item';
import { qualityColour, tooltipLines } from '../panels/gear/tooltipLines';

/**
 * A WoW item card.
 *
 * ==============================================================================
 * THE ITEM'S OWN TOOLTIP, drawn. Nothing here is assembled from `item.stats`,
 * which would be a second item parser living beside the real one -- and the
 * second implementation is always the one that drifts. What the card shows is
 * what the capture says, which is also why it shows the lines the simulator
 * does not apply: a proc is on the item in the game and is on the card here.
 *
 * THE HEADER IS THE ONE THING ADDED. "Item Level N" is a field on the item
 * rather than a tooltip line -- most captures do not write it out -- and it is
 * the figure a person comparing two pieces reads first.
 * ==============================================================================
 */
export function ItemCard({
  item,
  /** What it is worth under the current valuation, where there is one. */
  score,
}: {
  readonly item: Item;
  readonly score?: number;
}) {
  const lines = tooltipLines(item.tooltip, item.name);

  return (
    <div className="item-card">
      <div className="item-card-name" style={{ color: qualityColour(item.quality) }}>
        {item.name}
      </div>
      <div className="item-card-meta">
        Item Level {item.itemLevel}
        {item.subclass ? ` · ${item.subclass}` : ''}
      </div>
      {lines.map((line, index) => (
        <div key={index} className={`item-card-line is-${line.kind}`}>
          <span>{line.left}</span>
          {line.right !== undefined ? <span className="item-card-right">{line.right}</span> : null}
        </div>
      ))}
      {score !== undefined ? (
        /*
         * THE SCORE IS SEPARATED FROM THE TOOLTIP BY A RULE, because it is the
         * one line on this card that is NOT the item speaking. Everything
         * above comes from the capture; this is what this tool thinks the
         * item is worth to this build, and mixing the two would make a
         * placeholder weight look like a sourced number.
         */
        <div className="item-card-score">{score.toFixed(1)} value to this build</div>
      ) : null}
    </div>
  );
}

/**
 * The same for an enchant.
 *
 * ONE COMPONENT WOULD HAVE BEEN WRONG. An enchant has no item level, no
 * quality and no slot line, so a shared component would spend most of itself
 * deciding which halves to leave out -- and would print "Item Level 0" the
 * first time somebody forgot one of those branches.
 */
export function EnchantCard({
  enchant,
  score,
}: {
  readonly enchant: Enchant;
  readonly score?: number;
}) {
  const lines = tooltipLines(enchant.tooltip, enchant.name);

  return (
    <div className="item-card">
      <div className="item-card-name is-enchant">{enchant.name}</div>
      {lines.map((line, index) => (
        <div key={index} className={`item-card-line is-${line.kind}`}>
          <span>{line.left}</span>
          {line.right !== undefined ? <span className="item-card-right">{line.right}</span> : null}
        </div>
      ))}
      {score !== undefined ? (
        <div className="item-card-score">{score.toFixed(1)} value to this build</div>
      ) : null}
    </div>
  );
}
