import { Panel } from '../components/Panel';

/**
 * A gear slot, and whether anything can be enchanted into it.
 *
 * Which slots take an enchant is a ruleset question with a real answer, and
 * this is NOT it -- the flags below follow the usual Classic pattern and are a
 * placeholder like everything else here. They decide only whether a second
 * dropdown is drawn.
 */
interface GearSlot {
  readonly id: string;
  readonly name: string;
  readonly enchantable: boolean;
}

/**
 * The slots, in the order a character sheet lists them: the two hands first,
 * because for a simulator they are the ones that matter, then head to feet,
 * then the jewellery.
 */
const GEAR_SLOTS: readonly GearSlot[] = [
  { id: 'mainHand', name: 'Main Hand', enchantable: true },
  { id: 'offHand', name: 'Off Hand', enchantable: true },
  { id: 'ranged', name: 'Ranged', enchantable: true },

  { id: 'head', name: 'Head', enchantable: true },
  { id: 'neck', name: 'Neck', enchantable: false },
  { id: 'shoulders', name: 'Shoulders', enchantable: true },
  { id: 'cloak', name: 'Cloak', enchantable: true },
  { id: 'chest', name: 'Chest', enchantable: true },
  { id: 'wrists', name: 'Wrists', enchantable: true },
  { id: 'gloves', name: 'Gloves', enchantable: true },
  { id: 'waist', name: 'Waist', enchantable: false },
  { id: 'legs', name: 'Legs', enchantable: true },
  { id: 'feet', name: 'Feet', enchantable: true },

  { id: 'ring1', name: 'Ring', enchantable: false },
  { id: 'ring2', name: 'Ring', enchantable: false },
  { id: 'trinket1', name: 'Trinket', enchantable: false },
  { id: 'trinket2', name: 'Trinket', enchantable: false },
];

/**
 * Gear selection.
 *
 * A MOCK-UP. There is no item data in this project -- `src/data/items` is still
 * an empty promise, and every character currently swings the same placeholder
 * weapon. So every dropdown below is empty except for its "Empty" entry, and
 * choosing something is not possible because there is nothing to choose.
 *
 * It is here to settle the SHAPE of the thing: seventeen slots, an item per
 * slot, an enchant on the slots that take one. When real item data arrives it
 * fills these lists and nothing about this layout has to change.
 *
 * Deliberately not wired to the profile. A control that appeared to equip
 * something while changing no number in the results would be worse than a
 * control that plainly does nothing.
 */
export function GearPanel() {
  return (
    <Panel title="Gear">
      <p className="muted warn">
        A mock-up. No item data exists yet, so every slot is empty and nothing here
        changes a simulation.
      </p>

      <div className="gear-grid">
        {GEAR_SLOTS.map((slot) => (
          <GearSlotRow key={slot.id} slot={slot} />
        ))}
      </div>
    </Panel>
  );
}

function GearSlotRow({ slot }: { readonly slot: GearSlot }) {
  return (
    <div className="gear-slot">
      <span className="gear-slot-name">{slot.name}</span>
      <select className="gear-select" defaultValue="" disabled aria-label={`${slot.name} item`}>
        <option value="">Empty</option>
      </select>
      {slot.enchantable ? (
        <select
          className="gear-select gear-enchant"
          defaultValue=""
          disabled
          aria-label={`${slot.name} enchant`}
          title="Enchant"
        >
          <option value="">None</option>
        </select>
      ) : (
        <span className="gear-no-enchant">—</span>
      )}
    </div>
  );
}
