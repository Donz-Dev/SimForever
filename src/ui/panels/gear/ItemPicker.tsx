import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClassId, CombatStyleId } from '../../../game/character';
import type { Enchant, EquipmentSlot } from '../../../game/items/Item';
import { enchantsForSlot } from '../../../game/items/itemData';
import { scoreEnchant, type StatValuation } from '../../../game/items/itemValue';
import { EnchantCard, ItemCard } from '../../components/ItemCard';
import { HoverCard } from '../../components/HoverCard';
import { ItemIcon } from './ItemIcon';
import { pickerItems } from './slots';
import { qualityColour } from './tooltipLines';

/**
 * The list that opens when a slot is clicked.
 *
 * ==============================================================================
 * IT REPLACES A `<select>`, AND IT HAD TO. A native dropdown can show a string
 * and nothing else: no icon, no quality colour, no second column for what the
 * item is worth, and -- the thing that decided it -- no hover card, because an
 * `<option>` renders in the operating system's own widget where React cannot
 * reach. Three of the four things asked for here are impossible in a select.
 *
 * THE SEARCH BOX IS NOT A LUXURY. The waist slot has 201 items in it. A list
 * that can only be scrolled is a list where the thing you want is found by
 * luck.
 * ==============================================================================
 */
export function ItemPicker({
  slot,
  slotName,
  characterClass,
  style,
  valuation,
  equippedId,
  benchmarkIds,
  onPick,
  onClose,
}: {
  readonly slot: EquipmentSlot;
  readonly slotName: string;
  readonly characterClass: ClassId;
  readonly style: CombatStyleId;
  readonly valuation: StatValuation;
  readonly equippedId?: number;
  /** The profile's benchmark template items. See `pickerItems`. */
  readonly benchmarkIds?: ReadonlySet<number>;
  readonly onPick: (itemId: number | undefined) => void;
  readonly onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const [showUnusable, setShowUnusable] = useState(false);
  const scoring = Object.keys(valuation).length > 0;

  const rows = useMemo(
    () =>
      pickerItems({
        slot,
        characterClass,
        style,
        valuation,
        search,
        showUnusable,
        ...(equippedId !== undefined ? { equippedId } : {}),
        ...(benchmarkIds ? { benchmarkIds } : {}),
      }),
    [slot, characterClass, style, valuation, search, showUnusable, equippedId, benchmarkIds],
  );

  return (
    <PickerShell title={`${slotName} — ${rows.length} item${rows.length === 1 ? '' : 's'}`} onClose={onClose}>
      <div className="picker-controls">
        <input
          type="search"
          className="picker-search"
          placeholder="Search by name"
          aria-label={`Search ${slotName} items`}
          value={search}
          autoFocus
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="picker-toggle">
          <input
            type="checkbox"
            checked={showUnusable}
            onChange={(event) => setShowUnusable(event.target.checked)}
          />
          {/*
            THE ESCAPE HATCH, AND IT IS LABELLED AS ONE. The proficiency table
            is one transcription of one spreadsheet, and a filter is the one
            kind of bug that leaves nothing behind to notice: an item this
            table wrongly excludes looks exactly like an item that is not in
            the database. The checkbox is how a wrong row becomes visible.
          */}
          Show items this class cannot use
        </label>
      </div>

      <button type="button" className="picker-row is-empty" onClick={() => onPick(undefined)}>
        <ItemIcon size={28} />
        <span className="picker-name">Empty</span>
      </button>

      <ul className="picker-list">
        {rows.map(({ item, score, illegal }) => (
          <li key={item.id}>
            <HoverCard card={() => <ItemCard item={item} score={scoring ? score : undefined} />}>
              <button
                type="button"
                className={`picker-row${illegal ? ' is-illegal' : ''}${item.id === equippedId ? ' is-equipped' : ''}`}
                onClick={() => onPick(item.id)}
                /*
                 * NOT `disabled` FOR AN ILLEGAL ITEM. A disabled button takes
                 * no focus and fires no hover, so the card -- the thing that
                 * would tell somebody WHY the row is greyed -- would be
                 * unreachable on exactly the rows that need explaining. It is
                 * clickable and says what it is; equipping one is a deliberate
                 * act against a table this project may have wrong.
                 */
                title={illegal ? `A ${characterClass} cannot normally equip this.` : undefined}
              >
                <ItemIcon icon={item.icon} quality={item.quality} size={28} />
                <span className="picker-name" style={{ color: qualityColour(item.quality) }}>
                  {item.name}
                </span>
                <span className="picker-ilvl">{item.itemLevel}</span>
                <span className="picker-score">{scoring ? score.toFixed(1) : '—'}</span>
              </button>
            </HoverCard>
          </li>
        ))}
      </ul>

      {rows.length === 0 ? (
        <p className="picker-empty">
          {search.trim().length > 0
            ? 'Nothing in this slot matches that name.'
            : `No ${slotName.toLowerCase()} items this class can equip.`}
        </p>
      ) : null}
    </PickerShell>
  );
}

/** The same list for enchants, which are a much smaller and simpler set. */
export function EnchantPicker({
  slot,
  slotName,
  valuation,
  equippedEnchantId,
  onPick,
  onClose,
}: {
  readonly slot: EquipmentSlot;
  readonly slotName: string;
  readonly valuation: StatValuation;
  readonly equippedEnchantId?: number;
  readonly onPick: (enchantId: number | undefined) => void;
  readonly onClose: () => void;
}) {
  const scoring = Object.keys(valuation).length > 0;
  const enchants: readonly Enchant[] = useMemo(() => {
    const all = [...enchantsForSlot(slot)];
    return all.sort((a, b) => {
      const delta = scoreEnchant(b, valuation) - scoreEnchant(a, valuation);
      return delta !== 0 ? delta : a.name.localeCompare(b.name);
    });
  }, [slot, valuation]);

  return (
    <PickerShell title={`${slotName} enchant`} onClose={onClose}>
      <button type="button" className="picker-row is-empty" onClick={() => onPick(undefined)}>
        <span className="picker-name">No enchant</span>
      </button>
      <ul className="picker-list">
        {enchants.map((enchant) => {
          const score = scoreEnchant(enchant, valuation);
          return (
            <li key={enchant.id}>
              <HoverCard card={() => <EnchantCard enchant={enchant} score={scoring ? score : undefined} />}>
                <button
                  type="button"
                  className={`picker-row${enchant.id === equippedEnchantId ? ' is-equipped' : ''}`}
                  onClick={() => onPick(enchant.id)}
                >
                  <span className="picker-name">
                    {enchant.name.replace(/^Enchant Weapon - /, '')}
                  </span>
                  <span className="picker-score">{scoring ? score.toFixed(1) : '—'}</span>
                </button>
              </HoverCard>
            </li>
          );
        })}
      </ul>
    </PickerShell>
  );
}

/**
 * The popup itself: a dismissable overlay.
 *
 * CLOSED BY ESCAPE AND BY A CLICK OUTSIDE, both of which somebody will reach
 * for before they find the × -- and a popup that can only be closed by its own
 * button is a popup that feels stuck.
 */
function PickerShell({
  title,
  onClose,
  children,
}: {
  readonly title: string;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onDown = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    // `mousedown` rather than `click`: a click that STARTS inside the popup and
    // ends outside it -- dragging to select the search text, say -- would close
    // the thing being typed into.
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  return (
    <div className="picker" ref={box} role="dialog" aria-label={title}>
      <header className="picker-header">
        <h3>{title}</h3>
        <button type="button" className="picker-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      {children}
    </div>
  );
}
