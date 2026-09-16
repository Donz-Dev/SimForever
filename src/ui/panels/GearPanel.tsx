import type { CharacterProfile } from '../../profiles';
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

/**
 * The slots, in the order a character sheet lists them: the hands first,
 * because for a simulator they are what matters, then head to feet, then the
 * jewellery.
 *
 * `twoHand` sits beside the one-hand slots rather than replacing them, so a
 * character can keep both sets and switch between them by changing combat
 * style. Only the ones the style uses are applied.
 */
const SLOTS: readonly SlotRow[] = [
  { id: 'mainHand', name: 'Main Hand' },
  { id: 'offHand', name: 'Off Hand' },
  { id: 'twoHand', name: 'Two-Hander' },
  { id: 'ranged', name: 'Ranged' },

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

  return (
    <Panel title="Gear">
      <div className="gear-grid">
        {SLOTS.map((slot) => (
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
        <option value="">{items.length === 0 ? 'No items' : 'Empty'}</option>
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
