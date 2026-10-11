/**
 * A captured tooltip, turned into the rows a WoW item card draws.
 *
 * ==============================================================================
 * THE SOURCE'S OWN WORDS, RE-COLOURED AND NOTHING ELSE. Every item on file
 * carries its full tooltip text, so the card is a RENDERING of data this
 * project already has rather than a second description assembled from
 * `item.stats` -- which would be a second item parser, and the one that drifts
 * is the one nobody measures.
 *
 * It also means the card shows what the item SAYS, including the lines the
 * simulator does not apply. That is the honest card: a proc the engine cannot
 * express is on the item in the game and is on the card here.
 *
 * ------------------------------------------------------------------------------
 * THE TAB IS A COLUMN BREAK, which is the one piece of structure in the text.
 * `Chest\tPlate` and `127 - 191 Damage\tSpeed 3.10` are the two halves of a
 * tooltip row, left and right; splitting on it is what makes the card read as
 * a card instead of as a paragraph.
 * ------------------------------------------------------------------------------
 */
export type TooltipLineKind = 'plain' | 'stat' | 'muted';

export interface TooltipLine {
  readonly kind: TooltipLineKind;
  readonly left: string;
  /** The half after the tab, where there is one. */
  readonly right?: string;
}

/**
 * Lines coloured as a stat.
 *
 * GREEN FOR STATS AS WELL AS FOR `Equip:`, which is what the owner's own
 * screenshots show and is NOT what Blizzard's client does -- Classic draws
 * `+29 Intellect` white and reserves green for `Equip:`. The two examples
 * attached to the request draw both green, and the request was to reproduce
 * THOSE cards.
 */
const STAT_PATTERNS: readonly RegExp[] = [
  // "+29 Intellect", "-15 Agility". The sign is matched both ways because
  // Lapidis Tankard carries a penalty and a `+`-only pattern would draw it as
  // ordinary text -- the same trap the item parser's own rule fell into.
  /^[+-]\d+ /,
  // A shield's inherent block value and an armour line, which have no sign.
  /^\d+ (Armor|Block)$/,
  /^(Equip|Use|Chance on hit|Chance on being hit):/,
];

/** Lines the client draws dimmed: the derived dps, and a set's roster. */
const MUTED_PATTERNS: readonly RegExp[] = [
  /^\(.*\)$/,
  /^\(\d+\) Set/,
  /^Set: /,
];

function kindOf(text: string): TooltipLineKind {
  if (MUTED_PATTERNS.some((pattern) => pattern.test(text))) return 'muted';
  if (STAT_PATTERNS.some((pattern) => pattern.test(text))) return 'stat';
  return 'plain';
}

/**
 * The card's body rows.
 *
 * ------------------------------------------------------------------------------
 * TWO LEADING LINES ARE DROPPED WHEN THEY ARE THE HEADER THE CARD ALREADY
 * DRAWS: the name, and an `Item Level N` line.
 *
 * ONLY WHEN THEY MATCH, which is the whole care taken here. A capture whose
 * shape changes keeps every line rather than silently losing one -- the name
 * is compared to the item's own name, and the item level is matched by SHAPE
 * and not by position, because the two populations differ: a captured Forever
 * item writes no item-level line at all and a generated benchmark item writes
 * one. Neither was wrong; the card simply printed "Item Level 65" twice for
 * half the database.
 * ------------------------------------------------------------------------------
 */
const ITEM_LEVEL_LINE = /^Item Level \d+$/;

export function tooltipLines(tooltip: string, name: string): readonly TooltipLine[] {
  const rows = tooltip.split('\n');
  let start = 0;
  if (rows.length > start && rows[start].trim() === name.trim()) start += 1;
  if (rows.length > start && ITEM_LEVEL_LINE.test(rows[start].trim())) start += 1;
  const body = rows.slice(start);

  return body
    .filter((row) => row.trim().length > 0)
    .map((row) => {
      const tab = row.indexOf('\t');
      if (tab >= 0) {
        const left = row.slice(0, tab).trim();
        return { kind: kindOf(left), left, right: row.slice(tab + 1).trim() };
      }
      const text = row.trim();
      return { kind: kindOf(text), left: text };
    });
}

/**
 * The colour an item's name is drawn in, by quality.
 *
 * ----------------------------------------------------------------------------
 * A TOKEN REFERENCE, NOT A HEX LITERAL. The six values are Blizzard's and they
 * live in `styles.css` beside the nine class colours, for the reason the stylesheet
 * gives there: a rule never names a shade, and an inline `style` is a rule.
 * Returning `var(--quality-4)` is what lets the palette have ONE copy while
 * still being applied per item, which a CSS class alone could not do without a
 * second table of class names keyed by the same number.
 *
 * QUALITY 1 IS THE FALLBACK, deliberately -- a capture with a quality this
 * build does not know draws as an ordinary white item rather than as nothing.
 * ----------------------------------------------------------------------------
 */
export const QUALITY_COUNT = 6;

export function qualityColour(quality: number): string {
  const index = Number.isInteger(quality) && quality >= 0 && quality < QUALITY_COUNT ? quality : 1;
  return `var(--quality-${index})`;
}

/** The dimmer set, for the border around a 36px icon. See `styles.css`. */
export function qualityEdge(quality: number): string {
  const index = Number.isInteger(quality) && quality >= 0 && quality < QUALITY_COUNT ? quality : 1;
  return `var(--quality-edge-${index})`;
}
