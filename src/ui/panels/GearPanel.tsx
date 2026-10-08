import type { CharacterProfile } from '../../profiles';
import type { CombatStyleId } from '../../game/character';
import { resolveCombatStyle } from '../../game/character';
import type { Equipment, EquipmentSlot } from '../../game/items/Item';
import { enchantsForSlot, itemsForSlot } from '../../game/items/itemData';
import { hasStartingEquipment, startingEquipmentFor } from '../../game/items/startingSets';
import { Panel } from '../components/Panel';
import {
  POISON_NAMES,
  type PoisonId,
  type PoisonLoadout,
} from '../../game/reactions/poisons';
import {
  WARLOCK_STONE_NAMES,
  WARLOCK_STONE_TOOLTIPS,
  type WarlockStoneId,
} from '../../game/buffs/warlockStones';

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

  /*
   * The relic slot: an idol, libram or totem.
   *
   * Offered to every class rather than only the three that have one, the same
   * way the ranged row is offered to every melee style. `itemsForSlot('relic')`
   * is empty for a class with no relic, so the row simply has nothing in it --
   * and a Druid, Paladin or Shaman set that equips one can be SEEN, which is
   * the whole point of the row.
   */
  { id: 'relic', name: 'Relic' },
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
      /*
       * THE TWO-HANDER IS OFFERED HERE, because a ranged style holds melee
       * weapons as STAT STICKS and a two-hander is one of them -- the Hunter
       * gear set uses Dreadforge Retaliator exactly that way, for 12 agility
       * and 30 attack power off a weapon that never swings.
       *
       * Leaving the row out did not stop it being equipped; a preset equips
       * one directly. It only stopped the person SEEING it, which is the same
       * shape of bug as the stats that apply only sometimes: gear on the
       * character, counted in the totals, and absent from the panel that is
       * supposed to list what is worn.
       */
      return [
        ranged,
        { id: 'mainHand', name: 'Main Hand' },
        { id: 'twoHand', name: 'Two-Hander' },
      ];
    default:
      /*
       * Forms and caster styles: offer everything, because all four hands are
       * stat sticks and any of them may be held.
       *
       * THE SHIELD ROW IS ONE OF THEM. A caster shield is a real item -- Earth
       * and Fire carries 26 spell power -- and the Elemental shaman set wears
       * one, so leaving the row out put a piece of the set on the character,
       * counted in its totals, and nowhere on the panel that lists what is
       * worn.
       */
      return [
        { id: 'mainHand', name: 'Main Hand' },
        { id: 'offHand', name: 'Off Hand' },
        { id: 'twoHand', name: 'Two-Hander' },
        { id: 'shield', name: 'Shield' },
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

  const slots = [...weaponSlotsFor(style), ...COMMON_SLOTS];
  const equipped = Object.keys(profile.equipment).length;

  /*
   * The starting set is offered as a button as well as being applied when a
   * character is created, so it is recoverable. Someone who empties a slot to
   * see what it was worth needs a way back that is not nineteen dropdowns.
   */
  const equipStartingSet = () =>
    onChange({
      ...profile,
      equipment: startingEquipmentFor(profile.character.characterClass, style, {
        // Pressed with the encounter already on screen, so unlike character
        // creation this knows whether the target swings back.
        targetAttacks: profile.encounter.targetAttacks,
      }),
    });

  const clearAll = () => onChange({ ...profile, equipment: {} });

  return (
    <Panel
      title="Gear"
      collapsible
      badge={`${equipped} equipped`}
      actions={
        hasStartingEquipment(profile.character.characterClass) ? (
          <>
            <button type="button" onClick={equipStartingSet}>
              Starting set
            </button>
            <button type="button" onClick={clearAll} disabled={equipped === 0}>
              Clear
            </button>
          </>
        ) : undefined
      }
    >
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

      {profile.character.characterClass === 'rogue' ? (
        <PoisonRow
          poisons={profile.poisons}
          onChange={(poisons) => onChange({ ...profile, poisons })}
        />
      ) : null}
      {profile.character.characterClass === 'warlock' ? (
        <StoneRow
          stone={profile.warlockStone}
          onChange={(warlockStone) => onChange({ ...profile, warlockStone })}
        />
      ) : null}
    </Panel>
  );
}

/**
 * Which poison coats which weapon. A Rogue's, and nobody else's.
 *
 * ----------------------------------------------------------------------------
 * UNDER THE WEAPON ENCHANTS, because that is what a poison IS: a coating a
 * player chooses per hand, sitting in the same place in the character sheet
 * and answering the same question. It is rendered as its own row rather than a
 * third dropdown on each weapon, because a poison is not tied to the ITEM the
 * way an enchant is -- swapping the weapon keeps the poison.
 *
 * THE DEFAULT IS INSTANT ON THE MAIN HAND AND DEADLY ON THE OFF HAND, the
 * ruleset owner's stated pairing, and the control exists because the owner
 * asked for it to be swappable rather than fixed.
 * ----------------------------------------------------------------------------
 */
/**
 * Which stone enchants a Warlock's weapon. A Warlock's, and nobody else's.
 *
 * ----------------------------------------------------------------------------
 * BESIDE THE POISON ROW, BECAUSE IT IS THE SAME QUESTION: a consumable the
 * player applies before the pull, sitting under the weapon enchants where a
 * reader already looks for "what is on my weapon". The ruleset owner asked for
 * it in exactly those terms.
 *
 * ONE SELECT, NOT TWO. A poison is per hand because a Rogue coats each weapon;
 * a Warlock has one stone. So this is a single row with one control rather than
 * the two-column grid above, and it does NOT reuse `gear-grid` -- a one-cell
 * grid would leave the label stranded in the first column with the enchant
 * spacer beside it, which looks like a missing value rather than a choice.
 *
 * IT STACKS WITH THE WEAPON'S ENCHANT, by the owner's ruling, which is why this
 * sits apart from the enchant dropdowns instead of replacing one. The hint
 * under the control says so, because "temporary" is the word that makes the
 * stacking obvious and the panel is where somebody would wonder.
 * ----------------------------------------------------------------------------
 */
/*
 * EXPORTED FOR ITS TEST, which is the only reason -- `PoisonRow` beside it is
 * private and untested, and that is the gap this does not copy.
 *
 * THE PANEL CANNOT BE RENDERED INSTEAD: `Panel` is `useState(true)`, so a
 * collapsible panel starts SHUT and never renders its body in a static render.
 * Going through `GearPanel` would therefore assert nothing about the control
 * and would pass just as happily if it were deleted.
 */
export function StoneRow({
  stone,
  onChange,
}: {
  readonly stone: WarlockStoneId;
  readonly onChange: (next: WarlockStoneId) => void;
}) {
  const options = Object.entries(WARLOCK_STONE_NAMES) as Array<[WarlockStoneId, string]>;

  return (
    <div className="gear-stone">
      <h3>Weapon Stone</h3>
      <div className="gear-slot">
        <span className="gear-slot-name">Temporary Enchant</span>
        <select
          className="gear-select"
          value={stone}
          aria-label="Warlock weapon stone"
          onChange={(event) => onChange(event.target.value as WarlockStoneId)}
        >
          {options.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <span className="gear-no-enchant">—</span>
      </div>
      {/* The source's own words, so the panel states what the choice buys
          rather than leaving the player to remember two numbers. */}
      <p className="gear-stone-hint">{WARLOCK_STONE_TOOLTIPS[stone]}</p>
    </div>
  );
}

function PoisonRow({
  poisons,
  onChange,
}: {
  readonly poisons: PoisonLoadout;
  readonly onChange: (next: PoisonLoadout) => void;
}) {
  const options = Object.entries(POISON_NAMES) as Array<[PoisonId, string]>;

  return (
    <div className="gear-poisons">
      <h3>Poisons</h3>
      <div className="gear-grid">
        {(['mainHand', 'offHand'] as const).map((hand) => (
          <div className="gear-slot" key={hand}>
            <span className="gear-slot-name">{hand === 'mainHand' ? 'Main Hand' : 'Off Hand'}</span>
            <select
              className="gear-select"
              value={poisons[hand]}
              aria-label={`${hand === 'mainHand' ? 'Main hand' : 'Off hand'} poison`}
              onChange={(event) =>
                onChange({ ...poisons, [hand]: event.target.value as PoisonId })
              }
            >
              {options.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <span className="gear-no-enchant">—</span>
          </div>
        ))}
      </div>
    </div>
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
