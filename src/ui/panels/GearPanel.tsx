import type { CharacterProfile } from '../../profiles';
import type { CombatStyleId } from '../../game/character';
import { resolveCombatStyle } from '../../game/character';
import type { Equipment, EquipmentSlot } from '../../game/items/Item';
import { enchantsForSlot, itemsForSlot } from '../../game/items/itemData';
import { unmodelledEffects } from '../../game/items/equipment';
import { Panel } from '../components/Panel';

/** A gear slot, as the panel lists it. */
interface SlotRow {
  readonly id: EquipmentSlot;
  readonly name: string;
}

/** The armour and jewellery, which every style fills the same way. */
const COMMON_SLOTS: readonly SlotRow[] = [

  { id: 'head', name: 'Head' },
  { id: 'neck', name: 'Neck' },
  { id: 'shoulders', name: 'Shoulders' },
  { id: 'cloak', name: 'Cloak' },
  { id: 'chest', name: 'Chest' },
  { id: 'wrists', name: 'Wrists' },
  { id: 'gloves', name: 'Gloves' },
  { id: 'waist', name: 'Waist' },
  { id: 'legs', name: 'Legs' },
  { id: 'feet', name: 'Feet' },

  { id: 'ring1', name: 'Ring 1' },
  { id: 'ring2', name: 'Ring 2' },
  { id: 'trinket1', name: 'Trinket 1' },
  { id: 'trinket2', name: 'Trinket 2' },
];

/**
 * The weapon slots a style can actually fill.
 *
 * A dual-wielder has no use for a two-hander and a two-hander has no off hand,
 * so showing those dropdowns invites equipping something that will be ignored.
 * The 1H & Shield style holds a SHIELD rather than a second weapon, which is a
 * different slot with a different list.
 *
 * The ranged slot is offered to every melee style. A bow does not swing while
 * meleeing, but it is equipped and its stats count.
 */
function weaponSlotsFor(style: CombatStyleId): readonly SlotRow[] {
  const ranged: SlotRow = { id: 'ranged', name: 'Ranged' };

  switch (style) {
    case 'two_hander':
      return [{ id: 'twoHand', name: 'Two-Hander' }, ranged];
    case 'one_hand_shield':
      return [
        { id: 'mainHand', name: 'Main Hand' },
        { id: 'shield', name: 'Shield' },
        ranged,
      ];
    case 'dual_wield':
      return [
        { id: 'mainHand', name: 'Main Hand' },
        { id: 'offHand', name: 'Off Hand' },
        ranged,
      ];
    case 'ranged':
      return [ranged, { id: 'mainHand', name: 'Main Hand' }];
    default:
      // Forms and caster styles: no considered list yet, so offer everything
      // rather than guessing which hands a Moonkin uses.
      return [
        { id: 'mainHand', name: 'Main Hand' },
        { id: 'offHand', name: 'Off Hand' },
        { id: 'twoHand', name: 'Two-Hander' },
        ranged,
      ];
  }
}

interface GearPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
}

/**
 * Gear selection.
 *
 * Real items now, not a mock-up: what is chosen here changes the character
 * sheet and the fight. Equipping a weapon replaces the invented placeholder
 * that every character used to swing, which was the single largest source of
 * wrong numbers in the whole simulator.
 *
 * What an item does NOT do is listed under the slots. A chance-on-hit proc, an
 * extra attack, a resistance: all recorded from the item's own words and none
 * of them applied. A geared character here is weaker than the same character in
 * the game, and by exactly the listed amount.
 */
export function GearPanel({ profile, onChange }: GearPanelProps) {
  const style = resolveCombatStyle(
    profile.character.characterClass,
    profile.character.combatStyle,
  );

  const setSlot = (slot: EquipmentSlot, next: Equipment[EquipmentSlot]) => {
    const equipment: Record<string, unknown> = { ...profile.equipment };
    if (next) equipment[slot] = next;
    else delete equipment[slot];
    onChange({ ...profile, equipment: equipment as Equipment });
  };

  const missing = unmodelledEffects(profile.equipment, style);
  const slots = [...weaponSlotsFor(style), ...COMMON_SLOTS];

  return (
    <Panel title="Gear">
      <div className="gear-grid">
        {slots.map((slot) => (
          <GearSlotRow
            key={slot.id}
            slot={slot}
            equipped={profile.equipment[slot.id]}
            onChange={(next) => setSlot(slot.id, next)}
          />
        ))}
      </div>

      {missing.length > 0 ? (
        <>
          <h3>Equipped but not simulated</h3>
          <p className="muted warn">
            These are on the character and do nothing. The results are lower than the real
            game by whatever they are worth.
          </p>
          <ul className="issues">
            {missing.map((effect, index) => (
              <li key={`${effect.itemName}-${index}`}>
                <strong>{effect.itemName}</strong> — {effect.text}
                <span className="muted"> {effect.reason}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Panel>
  );
}

function GearSlotRow({
  slot,
  equipped,
  onChange,
}: {
  readonly slot: SlotRow;
  readonly equipped: Equipment[EquipmentSlot];
  readonly onChange: (next: Equipment[EquipmentSlot]) => void;
}) {
  const items = itemsForSlot(slot.id);
  const enchants = enchantsForSlot(slot.id);

  return (
    <div className="gear-slot">
      <span className="gear-slot-name">{slot.name}</span>

      <select
        className="gear-select"
        value={equipped ? String(equipped.itemId) : ''}
        aria-label={`${slot.name} item`}
        disabled={items.length === 0}
        onChange={(event) => {
          const value = event.target.value;
          if (!value) {
            onChange(undefined);
            return;
          }
          // Changing the item drops the enchant: an enchant belongs to the
          // thing it was applied to, not to the slot.
          onChange({ itemId: Number(value) });
        }}
      >
        <option value="">
          {items.length === 0 ? `No ${slot.name.toLowerCase()} items yet` : 'Empty'}
        </option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>

      {enchants.length > 0 ? (
        <select
          className="gear-select gear-enchant"
          value={equipped?.enchantId !== undefined ? String(equipped.enchantId) : ''}
          aria-label={`${slot.name} enchant`}
          title="Enchant"
          disabled={!equipped}
          onChange={(event) => {
            if (!equipped) return;
            const value = event.target.value;
            onChange(
              value ? { itemId: equipped.itemId, enchantId: Number(value) } : { itemId: equipped.itemId },
            );
          }}
        >
          <option value="">None</option>
          {enchants.map((enchant) => (
            <option key={enchant.id} value={enchant.id}>
              {enchant.name.replace(/^Enchant Weapon - /, '')}
            </option>
          ))}
        </select>
      ) : (
        <span className="gear-no-enchant">—</span>
      )}
    </div>
  );
}
