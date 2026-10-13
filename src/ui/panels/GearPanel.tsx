import { useState } from 'react';
import type { CharacterProfile } from '../../profiles';
import type { CombatStyleId } from '../../game/character';
import { resolveCombatStyle } from '../../game/character';
import type { Equipment, EquipmentSlot } from '../../game/items/Item';
import { ENCHANTS_BY_ID, ITEMS_BY_ID } from '../../game/items/itemData';
import { hasStartingEquipment, startingEquipmentFor } from '../../game/items/startingSets';
import { equipExclusive } from '../../game/items/equipRules';
import {
  BENCHMARK_SETS,
  BENCHMARK_TEMPLATES_BY_PRESET,
  benchmarkEquipmentFor,
} from '../../game/items/benchmarkSets';
import { defaultValuationForPreset, templateIdFor } from '../../game/items/defaultValuation';
import { scoreEnchant, scoreItem, type StatValuation } from '../../game/items/itemValue';
import { Panel } from '../components/Panel';
import { HoverCard } from '../components/HoverCard';
import { EnchantCard, ItemCard } from '../components/ItemCard';
import { ItemIcon } from './gear/ItemIcon';
import { EnchantPicker, ItemPicker } from './gear/ItemPicker';
import { LEFT_SLOTS, RIGHT_SLOTS, weaponSlotsFor, type SlotRow } from './gear/slots';
import { qualityColour } from './gear/tooltipLines';
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

/**
 * Gear selection, as a character planner.
 *
 * ==============================================================================
 * WHAT THIS REPLACED AND WHY. It was nineteen rows of two `<select>` elements,
 * which could show a name and nothing else. The owner asked for four things --
 * item cards on hover, a list filtered to what the class can equip, items
 * sorted by what they are worth, and the four benchmark sets exposed -- and a
 * native dropdown can do none of them: an `<option>` renders in the operating
 * system's own widget, where there is no hover, no second column and no icon.
 *
 * SO THE SELECT BECAME A BUTTON THAT OPENS A LIST. Everything else here
 * follows from that one change.
 *
 * ------------------------------------------------------------------------------
 * THE PANEL DECIDES NOTHING THAT COULD BE WRONG. Which items a class may hold
 * is `canEquip`, what an item is worth is `scoreItem`, which slots a style
 * fills is `weaponSlotsFor`, and what a card says is `tooltipLines`. All four
 * are plain modules with their own tests, because `Panel` is `useState(true)`
 * -- a collapsible panel starts SHUT and renders no body at all in a static
 * render, so a test that went through this component would assert nothing
 * about any of them.
 * ==============================================================================
 */
interface GearPanelProps {
  readonly profile: CharacterProfile;
  readonly onChange: (profile: CharacterProfile) => void;
}

export function GearPanel({ profile, onChange }: GearPanelProps) {
  const style = resolveCombatStyle(
    profile.character.characterClass,
    profile.character.combatStyle,
  );

  /** Which slot's picker is open, and whether it is the item or the enchant. */
  const [open, setOpen] = useState<{ slot: EquipmentSlot; kind: 'item' | 'enchant' } | undefined>(
    undefined,
  );

  /*
   * EQUIPPING DISPLACES WHAT IT MAKES IMPOSSIBLE, which is the owner's ruling:
   * "Equipping a 2H weapon REMOVES the 1H+shield from the character planner
   * equipped items." The rule lives in `game/items/equipRules.ts` rather than
   * here, because `benchmarkEquipmentFor` has to obey the same one and two
   * copies is the shape this project documents everywhere else.
   */
  const setSlot = (slot: EquipmentSlot, next: Equipment[EquipmentSlot]) => {
    onChange({ ...profile, equipment: equipExclusive(profile.equipment, slot, next) });
  };

  /*
   * THE VALUATION, WITH THE PROFILE'S OWN BEATING THE DERIVED ONE.
   *
   * Absent on the profile means "derive it", which is the format's own design:
   * a valuation is a tool setting that no result depends on, so freezing one
   * into a saved file would keep a placeholder after the owner supplies a real
   * table. `templateIdFor` is what finds the build -- the stored template id
   * first, the character's name as the fallback for every file written before
   * that id existed.
   */
  const templateId = templateIdFor(profile.benchmarkTemplateId, profile.character.name);
  const valuation: StatValuation = profile.statValuation ?? defaultValuationForPreset(templateId);
  const scoring = Object.keys(valuation).length > 0;

  const weapons = weaponSlotsFor(style);
  const equipped = Object.keys(profile.equipment).length;

  const equipStartingSet = () =>
    onChange({
      ...profile,
      equipment: startingEquipmentFor(profile.character.characterClass, style, {
        targetAttacks: profile.encounter.targetAttacks,
      }),
    });

  const clearAll = () => onChange({ ...profile, equipment: {} });

  /*
   * THE FOUR TESTING SETS.
   *
   * B55, E65, E75, E85 install a full set generated from the itemization
   * budget at one quality and one item level, targeting this build's hit cap
   * and its preferred stats in the owner's own order. They exist so two builds
   * can be compared at the SAME item level.
   *
   * THE CURRENT EQUIPMENT IS PASSED IN, which is the bug fix the owner asked
   * for: `benchmarkEquipmentFor` used to build each slot as `{ itemId }` and
   * nothing else, so swapping from one set to another DROPPED EVERY ENCHANT.
   * The enchants are worth +2.4 to +53.7 DPS a profile, and losing them
   * between two presses made exactly the comparison the buttons exist for
   * wrong -- silently, because an unenchanted slot looks like a slot nobody
   * enchanted.
   */
  const template = templateId ? BENCHMARK_TEMPLATES_BY_PRESET.get(templateId) : undefined;
  const equipBenchmark = (setId: (typeof BENCHMARK_SETS)[number]['id']) => {
    if (!templateId) return;
    const equipment = benchmarkEquipmentFor(templateId, setId, profile.equipment);
    if (equipment) onChange({ ...profile, equipment });
  };

  return (
    <Panel
      title="Gear"
      collapsible
      badge={`${equipped} equipped`}
      actions={
        hasStartingEquipment(profile.character.characterClass) || template ? (
          <>
            {template
              ? BENCHMARK_SETS.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => equipBenchmark(set.id)}
                    title={`${set.description} -- generated to this build's ${template.hit} hit rating and its preferred stats. Your enchants are kept.`}
                  >
                    {set.id}
                  </button>
                ))
              : null}
            {hasStartingEquipment(profile.character.characterClass) ? (
              <button type="button" onClick={equipStartingSet} title="The real items this preset ships with">
                Starting set
              </button>
            ) : null}
            <button type="button" onClick={clearAll} disabled={equipped === 0}>
              Clear
            </button>
          </>
        ) : undefined
      }
    >
      {/*
        WHICH VALUATION IS SORTING THE LISTS, said out loud.

        Three states and they are genuinely different: a measured one from a
        Stat Weights run, this build's placeholder default, and none at all.
        A list sorted by something the reader cannot name is a list they have
        to take on trust, and the three sort orders look alike.

        AND THE WAY BACK IS HERE rather than on the results panel, because a
        results panel is gone the next run and a valuation outlives it.
      */}
      <p className="gear-sort-note">
        {profile.statValuation !== undefined ? (
          <>
            Sorted by your measured stat weights. Hover any row for its card.{' '}
            <button
              type="button"
              className="gear-valuation-reset"
              onClick={() => {
                const { statValuation: _dropped, ...rest } = profile;
                onChange(rest);
              }}
            >
              Use the build default
            </button>
          </>
        ) : scoring ? (
          <>
            Sorted by this build&rsquo;s default stat valuation, which is every preferred stat at
            1.00 until a real one is supplied. Run a stat weights sim to replace it. Hover any row
            for its card.
          </>
        ) : (
          <>
            No stat valuation for this build, so items are listed by item level. Hover any row for
            its card.
          </>
        )}
      </p>

      {/*
        TWO COLUMNS AND NO MODEL BETWEEN THEM, which is the layout the owner
        asked for: a character pane without the dead space a 3D model occupies,
        and without the shirt and tabard rows, which are cosmetic and carry no
        stat this project reads.
      */}
      <div className="gear-pane">
        <div className="gear-column">
          {LEFT_SLOTS.map((slot) => (
            <GearSlot
              key={slot.id}
              slot={slot}
              profile={profile}
              style={style}
              valuation={valuation}
              open={open}
              setOpen={setOpen}
              setSlot={setSlot}
            />
          ))}
        </div>
        <div className="gear-column">
          {RIGHT_SLOTS.map((slot) => (
            <GearSlot
              key={slot.id}
              slot={slot}
              profile={profile}
              style={style}
              valuation={valuation}
              open={open}
              setOpen={setOpen}
              setSlot={setSlot}
            />
          ))}
        </div>
      </div>

      {/* The hands, across the bottom, as a character pane puts them. */}
      <div className="gear-weapons">
        {weapons.map((slot) => (
          <GearSlot
            key={slot.id}
            slot={slot}
            profile={profile}
            style={style}
            valuation={valuation}
            open={open}
            setOpen={setOpen}
            setSlot={setSlot}
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
 * One slot: its icon, what is in it, and what is enchanted onto it.
 *
 * ----------------------------------------------------------------------------
 * THE ENCHANT IS A SECOND LINE UNDER THE ITEM, not a second control beside it.
 * That is the reference planner's arrangement and it is also what makes the
 * two columns fit: a slot used to need 84 + 175 + 168 pixels across, and two
 * of those side by side is wider than the panel.
 *
 * AN EMPTY SLOT STILL SHOWS ITS NAME, which the old dropdown did too. A pane
 * of eight unlabelled empty squares is unreadable, and the name is what says
 * which square is the waist.
 * ----------------------------------------------------------------------------
 */
function GearSlot({
  slot,
  profile,
  style,
  valuation,
  open,
  setOpen,
  setSlot,
}: {
  readonly slot: SlotRow;
  readonly profile: CharacterProfile;
  readonly style: CombatStyleId;
  readonly valuation: StatValuation;
  readonly open: { slot: EquipmentSlot; kind: 'item' | 'enchant' } | undefined;
  readonly setOpen: (next: { slot: EquipmentSlot; kind: 'item' | 'enchant' } | undefined) => void;
  readonly setSlot: (slot: EquipmentSlot, next: Equipment[EquipmentSlot]) => void;
}) {
  const worn = profile.equipment[slot.id];
  const item = worn ? ITEMS_BY_ID.get(worn.itemId) : undefined;
  const enchant = worn?.enchantId !== undefined ? ENCHANTS_BY_ID.get(worn.enchantId) : undefined;
  const scoring = Object.keys(valuation).length > 0;
  const score = item ? scoreItem(item, style, valuation) : 0;

  const openHere = open?.slot === slot.id ? open.kind : undefined;

  return (
    <div className="gear-row">
      <HoverCard
        className="gear-row-icon"
        card={() =>
          item ? <ItemCard item={item} score={scoring ? score : undefined} /> : <EmptyCard name={slot.name} />
        }
      >
        <button
          type="button"
          className="gear-icon-button"
          onClick={() => setOpen(openHere === 'item' ? undefined : { slot: slot.id, kind: 'item' })}
          aria-label={`${slot.name}: ${item ? item.name : 'empty'}`}
        >
          <ItemIcon {...(item ? { icon: item.icon, quality: item.quality } : {})} />
        </button>
      </HoverCard>

      <div className="gear-row-text">
        <button
          type="button"
          className="gear-item-button"
          onClick={() => setOpen(openHere === 'item' ? undefined : { slot: slot.id, kind: 'item' })}
          style={item ? { color: qualityColour(item.quality) } : undefined}
        >
          {item ? item.name : <span className="gear-empty">{slot.name}</span>}
        </button>

        <div className="gear-row-second">
          <button
            type="button"
            className={`gear-enchant-button${enchant ? ' is-set' : ''}`}
            onClick={() =>
              setOpen(openHere === 'enchant' ? undefined : { slot: slot.id, kind: 'enchant' })
            }
          >
            {enchant ? (
              <HoverCard
                card={() => (
                  <EnchantCard
                    enchant={enchant}
                    score={scoring ? scoreEnchant(enchant, valuation) : undefined}
                  />
                )}
              >
                {enchant.name.replace(/^Enchant Weapon - /, '')}
              </HoverCard>
            ) : (
              'No enchant'
            )}
          </button>
          {item && scoring ? <span className="gear-row-score">{score.toFixed(1)}</span> : null}
        </div>
      </div>

      {openHere === 'item' ? (
        <ItemPicker
          slot={slot.id}
          slotName={slot.name}
          characterClass={profile.character.characterClass}
          style={style}
          valuation={valuation}
          {...(worn ? { equippedId: worn.itemId } : {})}
          onClose={() => setOpen(undefined)}
          onPick={(itemId) => {
            setOpen(undefined);
            // Changing the item drops the enchant: an enchant belongs to the
            // thing it was applied to, not to the slot. The benchmark buttons
            // are the documented exception -- those re-gear the whole
            // character and keep them.
            setSlot(slot.id, itemId === undefined ? undefined : { itemId });
          }}
        />
      ) : null}

      {openHere === 'enchant' ? (
        <EnchantPicker
          slot={slot.id}
          slotName={slot.name}
          valuation={valuation}
          {...(worn?.enchantId !== undefined ? { equippedEnchantId: worn.enchantId } : {})}
          onClose={() => setOpen(undefined)}
          onPick={(enchantId) => {
            setOpen(undefined);
            if (!worn) return;
            setSlot(
              slot.id,
              enchantId === undefined
                ? { itemId: worn.itemId }
                : { itemId: worn.itemId, enchantId },
            );
          }}
        />
      ) : null}
    </div>
  );
}

/** What hovering an empty slot shows: which slot it is, and nothing invented. */
function EmptyCard({ name }: { readonly name: string }) {
  return (
    <div className="item-card">
      <div className="item-card-name is-empty">{name}</div>
      <div className="item-card-line is-muted">
        <span>Nothing equipped.</span>
      </div>
    </div>
  );
}

/**
 * Which stone enchants a Warlock's weapon. A Warlock's, and nobody else's.
 *
 * ----------------------------------------------------------------------------
 * UNDER THE WEAPONS, BECAUSE IT IS THE SAME QUESTION: a consumable the player
 * applies before the pull, sitting where a reader already looks for "what is
 * on my weapon". The ruleset owner asked for it in exactly those terms.
 *
 * IT STACKS WITH THE WEAPON'S ENCHANT, by the owner's ruling, which is why it
 * sits apart from the enchant control instead of replacing one. The hint under
 * the control says so, because "temporary" is the word that makes the stacking
 * obvious and the panel is where somebody would wonder.
 *
 * EXPORTED FOR ITS TEST, which is the only reason -- `PoisonRow` beside it is
 * private and untested, and that is the gap this does not copy. The panel
 * cannot be rendered instead: `Panel` is `useState(true)`, so a collapsible
 * panel starts SHUT and never renders its body in a static render.
 * ----------------------------------------------------------------------------
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

/**
 * Which poison coats which weapon. A Rogue's, and nobody else's.
 *
 * Its own row rather than a third control on each weapon, because a poison is
 * not tied to the ITEM the way an enchant is -- swapping the weapon keeps the
 * poison. The default is Instant on the main hand and Deadly on the off hand,
 * the ruleset owner's stated pairing, and the control exists because the owner
 * asked for it to be swappable rather than fixed.
 */
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
