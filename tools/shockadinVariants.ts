/*
 * The variants `probe_shockadin.ts` measures, grouped by what they change.
 *
 * A TALENT VARIANT IS A WHOLE 51-POINT TREE, not a delta, and it is checked by
 * `legalAllocation` before a fight is run -- a figure whose allocation silently
 * lost a deeper talent is a rumour, which this project has paid for once on the
 * Druid. The helper THROWS rather than measuring one.
 */
import type { CharacterProfile } from '../src/profiles';
import type { TalentAllocation } from '../src/game/talents/Talent';
import { legalAllocation } from '../src/game/talents/talentRules';
import { talentsForClass } from '../src/game/talents/talentData';
import type { EquipmentSlot } from '../src/game/items/Item';
import type { AplEntry } from '../src/game/rotations/apl';

type Apply = (profile: CharacterProfile) => CharacterProfile;

export interface Variant {
  readonly label: string;
  readonly apply: Apply;
}

/* ---------------------------------------------------------------- helpers */

const enchant = (slot: EquipmentSlot, enchantId: number): Apply => (profile) => {
  const equipped = profile.equipment[slot];
  if (!equipped) throw new Error(`no item in ${slot}`);
  return {
    ...profile,
    equipment: { ...profile.equipment, [slot]: { ...equipped, enchantId } },
  };
};

const consumable = (category: string, id: string): Apply => (profile) => ({
  ...profile,
  consumables: { ...profile.consumables, [category]: id },
});

const PALADIN = talentsForClass('paladin')!;

/** A WHOLE tree, checked before it is measured. */
const tree = (allocation: TalentAllocation): Apply => (profile) => {
  const { allocation: legal, dropped } = legalAllocation(PALADIN, allocation);
  const total = Object.values(legal).reduce((a, b) => a + b, 0);
  const wanted = Object.values(allocation).reduce((a, b) => a + b, 0);
  if (dropped.length > 0 || total !== 51 || wanted !== 51) {
    throw new Error(
      `illegal tree: wanted ${wanted} legal ${total} dropped [${dropped.join(', ')}]`,
    );
  }
  return { ...profile, talents: legal };
};

/*
 * AN APL EDIT MARKS THE LIST `custom`, which is not cosmetic: the probe runs
 * `syncDefaultRotation` after every variant -- because a talent change moves
 * which stock list applies -- and that would re-derive a `default` list and
 * silently throw the edit away.
 */
const apl = (edit: (entries: AplEntry[]) => AplEntry[]): Apply => (profile) => ({
  ...profile,
  rotation: {
    ...profile.rotation,
    source: 'custom',
    entries: edit([...profile.rotation.entries]),
  },
});

const indexOf = (entries: readonly AplEntry[], id: string) => {
  const at = entries.findIndex((entry) => entry.abilityId === id);
  if (at < 0) throw new Error(`no entry for ${id}`);
  return at;
};

/** Move `id` so it sits immediately above `beforeId`. */
const moveAbove = (id: string, beforeId: string): Apply =>
  apl((entries) => {
    const [entry] = entries.splice(indexOf(entries, id), 1);
    entries.splice(indexOf(entries, beforeId), 0, entry);
    return entries;
  });

const moveToBottom = (id: string): Apply =>
  apl((entries) => {
    const [entry] = entries.splice(indexOf(entries, id), 1);
    entries.push(entry);
    return entries;
  });

const removeEntry = (id: string): Apply =>
  apl((entries) => entries.filter((entry) => entry.abilityId !== id));

const chain = (...applies: readonly Apply[]): Apply => (profile) =>
  applies.reduce((p, f) => f(p), profile);







/*
 * The two trees as the presets hold them, by TIER, so a variant can move the
 * free points without disturbing the forced forty-nine.
 */
const HOLY_BELOW_20 = {
  divine_strength: 5,
  divine_intellect: 5,
  improved_seals: 3,
  reverence: 3,
  healing_light: 3,
  divine_favor: 1,
};

const RET_BELOW_20 = {
  improved_judgement: 2,
  conviction: 5,
  vindication: 3,
  sanctified_judgement: 3,
  sacred_arbiter: 1,
  benediction: 5,
  holy_conduit: 1,
};

const RET_SHIELD = {
  ...RET_BELOW_20,
  holy_conduit: 2,
  pursuit_of_justice: 1,
  vengeance: 3,
  champion_of_the_light: 3,
};

const RET_2H = {
  ...RET_BELOW_20,
  vengeance: 3,
  two_handed_weapon_specialization: 3,
  champion_of_the_light: 3,
};

/* ------------------------------------------------------------- the groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  enchants: [
    { label: 'head +8 Intellect (was +8 Strength)', apply: enchant('head', 900006) },
    { label: 'head +1% Haste', apply: enchant('head', 900002) },
    { label: 'legs +1% Haste', apply: enchant('legs', 900002) },
    { label: 'neck +6 Spell Power (was +5 Strength)', apply: enchant('neck', 900009) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'wrists +9 Strength (was +16 Spell Power)', apply: enchant('wrists', 900017) },
    { label: 'cloak +60 Armor (was +5 Agility)', apply: enchant('cloak', 900013) },
    { label: 'feet +7 Stamina (was +7 Agility)', apply: enchant('feet', 900027) },
  ],

  /* The three candidates together, so the sum can be checked against the parts. */
  enchantsCombined: [
    {
      label: 'head Haste + neck Spell Power',
      apply: chain(enchant('head', 900002), enchant('neck', 900009)),
    },
    {
      label: 'head + legs Haste',
      apply: chain(enchant('head', 900002), enchant('legs', 900002)),
    },
    {
      label: 'head + legs Haste, neck +6 Spell Power',
      apply: chain(enchant('head', 900002), enchant('legs', 900002), enchant('neck', 900009)),
    },
    {
      label: 'head + legs + gloves Haste, neck +6 SP',
      apply: chain(
        enchant('head', 900002),
        enchant('legs', 900002),
        enchant('gloves', 900002),
        enchant('neck', 900009),
      ),
    },
  ],

  weaponEnchant: [
    { label: '2H: Crusader (was +65 Spell Power)', apply: enchant('twoHand', 20034) },
    { label: '2H: +30 Spell Power', apply: enchant('twoHand', 22749) },
    { label: '2H: +25 Agility', apply: enchant('twoHand', 900031) },
    { label: '1H: Crusader (was +30 Spell Power)', apply: enchant('mainHand', 20034) },
    { label: '1H: +25 Agility', apply: enchant('mainHand', 900031) },
  ],

  consumables: [
    { label: 'blasted lands +25 Intellect (was Strength)', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'blasted lands +25 Agility', apply: consumable('blasted_lands', 'blasted_agility') },
    { label: 'weapon effect +2% melee crit (was spell)', apply: consumable('weapon_effect', 'weapon_melee_crit') },
    { label: 'flask +1200 Hit Points (was +150 SP)', apply: consumable('flask', 'flask_hit_points') },
    { label: 'food +20 Strength (was +33 SP)', apply: consumable('food', 'food_strength') },
    { label: 'food +40 Attack Power (was +33 SP)', apply: consumable('food', 'food_attack_power') },
    { label: 'potion Frenzy (was Spellblasting)', apply: consumable('potion', 'major_frenzy_potion') },
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
  ],

  /*
   * THE FREE POINTS, AND THERE ARE ONLY TWO OF THEM (one on the two-hander).
   * Everything else in both trees is forced by the tier rule -- see
   * `presets.ts`. These are the Holy tier-20 slots, and the only other place
   * they can go is Instrument of Law, which costs the lot.
   */
  /*
   * TWO-HANDED WEAPON SPECIALIZATION, PRICED AS THE WHOLE TREE SWAP IT IS.
   * It cannot simply be removed: it and Vengeance fill Retribution's tier 20,
   * and dropping it takes the tree back under the twenty-five Champion of the
   * Light needs. So the comparison is the two-hander running the SHIELD's
   * legal tree -- which is also the honest question, since that is the only
   * other legal shape.
   */
  twoHandSpec: [
    {
      label: '2H profile on the SHIELD tree (no 2H Spec, CG 2/2)',
      apply: tree({
        ...HOLY_BELOW_20,
        holy_shock: 1,
        consecrated_ground: 2,
        ...RET_SHIELD,
      }),
    },
  ],

  freePoints: [
    {
      label: 'shield: Divine Precision 2 (was Consecrated Ground 2)',
      apply: tree({ ...HOLY_BELOW_20, holy_shock: 1, divine_precision: 2, ...RET_SHIELD }),
    },
    {
      label: 'shield: Consecrated Ground 1 + Divine Precision 1',
      apply: tree({
        ...HOLY_BELOW_20,
        holy_shock: 1,
        consecrated_ground: 1,
        divine_precision: 1,
        ...RET_SHIELD,
      }),
    },
    {
      label: 'shield: Instrument of Law 2, nothing in Holy tier 20',
      apply: tree({
        ...HOLY_BELOW_20,
        holy_shock: 1,
        ...RET_SHIELD,
        instrument_of_law: 2,
      }),
    },
    {
      label: '2H: Divine Precision 1 (was Consecrated Ground 1)',
      apply: tree({ ...HOLY_BELOW_20, holy_shock: 1, divine_precision: 1, ...RET_2H }),
    },
  ],

  /*
   * HASTE AGAINST INTELLECT ON THE HEAD AND LEGS, measured as the PAIR rather
   * than a slot at a time: one slot is 1% haste, which moves the swing timer
   * and therefore decorrelates the two fights -- a spread of 42 against an
   * interval of 3 is not a measurement, it is two coin flips that agreed.
   */
  headLegs: [
    {
      label: 'head + legs +8 Intellect (was 1% Haste each)',
      apply: chain(enchant('head', 900006), enchant('legs', 900006)),
    },
    {
      label: 'head + legs +8 Strength',
      apply: chain(enchant('head', 900005), enchant('legs', 900005)),
    },
    {
      label: 'head + legs +8 Agility',
      apply: chain(enchant('head', 900003), enchant('legs', 900003)),
    },
    {
      label: 'head Haste + legs Intellect',
      apply: enchant('legs', 900006),
    },
  ],

  divineFavor: [
    { label: 'Divine Favor entry removed (talent kept)', apply: removeEntry('divine_favor') },
    { label: 'Divine Favor back ABOVE Holy Shock (its old place)', apply: moveAbove('divine_favor', 'holy_shock') },
    { label: 'Divine Favor above Consecration', apply: moveAbove('divine_favor', 'consecration') },
    { label: 'Divine Favor first, above Judgement', apply: moveAbove('divine_favor', 'judgement') },
    {
      label: 'Divine Favor entry AND talent removed',
      apply: chain(
        removeEntry('divine_favor'),
        tree({
          divine_strength: 5,
          divine_intellect: 5,
          improved_seals: 3,
          spiritual_focus: 2,
          divine_precision: 2,
          holy_shock: 1,
          consecrated_ground: 2,
          improved_judgement: 2,
          conviction: 5,
          vindication: 3,
          sanctified_judgement: 3,
          sacred_arbiter: 1,
          instrument_of_law: 2,
          two_handed_weapon_specialization: 3,
          vengeance: 3,
          champion_of_the_light: 3,
          benediction: 5,
          holy_conduit: 1,
        }),
      ),
    },
  ],

  apl: [
    { label: 'Consecration above Judgement', apply: moveAbove('consecration', 'judgement') },
    { label: 'Consecration below Holy Shock', apply: moveAbove('consecration', 'holy_strike') },
    { label: 'Consecration to the bottom', apply: moveToBottom('consecration') },
    { label: 'Holy Shock above Seal of Righteousness', apply: moveAbove('holy_shock', 'seal_of_righteousness') },
    { label: 'Holy Strike above Holy Shock', apply: moveAbove('holy_strike', 'holy_shock') },
    { label: 'Judgement below Consecration', apply: moveAbove('judgement', 'holy_shock') },
    { label: 'Hammer of Wrath above Consecration', apply: moveAbove('hammer_of_wrath', 'consecration') },
    { label: 'Hammer of Wrath removed', apply: removeEntry('hammer_of_wrath') },
    { label: 'Divine Favor below Consecration', apply: moveAbove('divine_favor', 'holy_shock') },
    { label: 'Divine Favor removed', apply: removeEntry('divine_favor') },
    { label: 'Seal of the Crusader opener removed', apply: removeEntry('seal_of_the_crusader') },
    { label: 'Holy Strike removed', apply: removeEntry('holy_strike') },
  ],
};
