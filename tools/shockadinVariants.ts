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

/* --------------------------------------------------------------- the trees */

/**
 * THE HOLY SIDE IS FORCED AT TWENTY POINTS AND THE COMPOSITION IS NOT.
 *
 * Holy Shock and Divine Precision are tier 20, and a tier counts every point in
 * the tree -- so this build needs exactly 20 in Holy and may choose which 20.
 * `healing_light` is `scope: 'healing'` and no Paladin profile heals, so the
 * three points it carries are the only ones here that are provably worth
 * nothing; what replaces them is the question.
 */
const HOLY_20 = {
  divine_strength: 5,
  divine_intellect: 5,
  improved_seals: 3,
  reverence: 3,
  divine_favor: 1,
  divine_precision: 2,
  holy_shock: 1,
};

/** The same twenty with Consecrated Ground in place of Reverence. */
const HOLY_20_CONSECRATED = {
  divine_strength: 5,
  divine_intellect: 5,
  improved_seals: 3,
  spiritual_focus: 1,
  divine_favor: 1,
  divine_precision: 2,
  holy_shock: 1,
  consecrated_ground: 2,
};

/** Retribution to 31, with the two-hand specialization. Needs Holy at 20. */
const RET_31_TWO_HAND = {
  benediction: 5,
  improved_judgement: 2,
  holy_conduit: 2,
  conviction: 5,
  vindication: 2,
  sanctified_judgement: 3,
  pursuit_of_justice: 2,
  sacred_arbiter: 1,
  two_handed_weapon_specialization: 3,
  vengeance: 3,
  champion_of_the_light: 3,
};

/** Retribution to 31 with nothing two-handed in it, for the shield build. */
const RET_31_SHIELD = {
  benediction: 5,
  improved_judgement: 2,
  holy_conduit: 2,
  conviction: 5,
  vindication: 3,
  sanctified_judgement: 3,
  pursuit_of_justice: 2,
  sacred_arbiter: 1,
  instrument_of_law: 2,
  vengeance: 3,
  champion_of_the_light: 3,
};

const RET_28 = {
  benediction: 5,
  improved_judgement: 2,
  holy_conduit: 2,
  conviction: 5,
  vindication: 2,
  sanctified_judgement: 3,
  pursuit_of_justice: 2,
  sacred_arbiter: 1,
  vengeance: 3,
  champion_of_the_light: 3,
};


/* --------------------------------------------------------- the champions */

/**
 * THE HOLY TWENTY, BEST COMPOSITION FOUND.
 *
 * Reverence's three points are mana regeneration while casting, and this build
 * finishes a fight with about 3,200 mana unspent -- `Benediction 5 ->
 * Deflection 5` measured BIT-IDENTICAL FIGHTS, which is the strongest possible
 * statement that mana is not what binds here. So the mana talents are filler
 * and Consecrated Ground is what the points buy instead.
 */
const HOLY_20_BEST = {
  divine_strength: 5,
  divine_intellect: 5,
  improved_seals: 3,
  divine_favor: 1,
  divine_precision: 2,
  holy_shock: 1,
  consecrated_ground: 2,
  spiritual_focus: 1,
};

/** Retribution 31 with every talent that does something, plus six of filler. */
const RET_31_BEST_TWO_HAND = {
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
  seal_of_command: 1,
};

const RET_31_BEST_SHIELD = {
  improved_judgement: 2,
  conviction: 5,
  vindication: 3,
  sanctified_judgement: 3,
  sacred_arbiter: 1,
  instrument_of_law: 2,
  vengeance: 3,
  champion_of_the_light: 3,
  benediction: 5,
  holy_conduit: 2,
  pursuit_of_justice: 2,
};

const BEST_ENCHANTS = chain(
  enchant('head', 900002),
  enchant('legs', 900002),
  enchant('neck', 900009),
);

const BEST_CONSUMABLES = consumable('blasted_lands', 'blasted_intellect');

const CONSECRATION_UP = moveAbove('consecration', 'holy_shock');

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

  talents: [
    {
      label: 'Healing Light 3 -> 2H Weapon Spec 3  [20/0/31]',
      apply: tree({ ...HOLY_20, ...RET_31_TWO_HAND }),
    },
    {
      label: 'Healing Light 3 -> Instr of Law 2 + Vindication  [20/0/31]',
      apply: tree({ ...HOLY_20, ...RET_31_SHIELD }),
    },
    {
      label: 'Reverence 3 -> Consecrated Ground 2  [20/0/31] 2H',
      apply: tree({ ...HOLY_20_CONSECRATED, ...RET_31_TWO_HAND }),
    },
    {
      label: 'Reverence 3 -> Consecrated Ground 2  [20/0/31] shield',
      apply: tree({ ...HOLY_20_CONSECRATED, ...RET_31_SHIELD }),
    },
    {
      label: 'Consecrated Ground 2 only  [22/0/29]',
      apply: tree({
        ...HOLY_20,
        consecrated_ground: 2,
        ...RET_28,
        vindication: 3,
      }),
    },
    {
      label: 'HOLY POWER 5/5, no Champion of the Light  [30/0/21]',
      apply: tree({
        divine_strength: 5,
        divine_intellect: 5,
        improved_seals: 3,
        reverence: 3,
        divine_favor: 1,
        divine_precision: 2,
        holy_shock: 1,
        consecrated_ground: 2,
        spiritual_focus: 2,
        illumination: 1,
        holy_power: 5,
        benediction: 5,
        improved_judgement: 2,
        holy_conduit: 2,
        conviction: 5,
        vindication: 3,
        sanctified_judgement: 3,
        pursuit_of_justice: 1,
      }),
    },
    {
      label: 'Benediction 5 -> Deflection 5 (is mana binding?)',
      apply: tree({ ...HOLY_20, healing_light: 3, ...RET_28, benediction: 0, deflection: 5 }),
    },
    {
      /*
       * SANCTIFIED JUDGEMENT CANNOT BE PRICED ON ITS OWN: Vengeance requires it
       * at 3/3, so the two are one package and removing the mana return takes
       * the stacking damage buff with it. The guard caught that rather than
       * measuring a tree quietly short of its capstone.
       */
      label: 'Vengeance 3 + Sanctified Judgement 3 out  [20/0/31]',
      apply: tree({
        ...HOLY_20,
        healing_light: 3,
        ...RET_28,
        sanctified_judgement: 0,
        vengeance: 0,
        deflection: 5,
        seal_of_command: 1,
      }),
    },
    {
      label: 'Conviction 5 -> Deflection 5 (what is melee crit worth?)',
      apply: tree({ ...HOLY_20, healing_light: 3, ...RET_28, conviction: 0, deflection: 5 }),
    },
    {
      label: 'Divine Strength 5 -> 0, filler instead',
      apply: tree({
        ...HOLY_20,
        divine_strength: 0,
        spiritual_focus: 2,
        unyielding_faith: 2,
        voice_of_truth: 1,
        healing_light: 3,
        ...RET_28,
        pursuit_of_justice: 0,
        deflection: 2,
      }),
    },
  ],

  /* The stack, one layer at a time, so the parts can be checked against the sum. */
  champion2H: [
    { label: '1. talents [20/0/31]', apply: tree({ ...HOLY_20_BEST, ...RET_31_BEST_TWO_HAND }) },
    {
      label: '2. + enchants (head/legs Haste, neck SP)',
      apply: chain(tree({ ...HOLY_20_BEST, ...RET_31_BEST_TWO_HAND }), BEST_ENCHANTS),
    },
    {
      label: '3. + Blasted Lands Intellect',
      apply: chain(tree({ ...HOLY_20_BEST, ...RET_31_BEST_TWO_HAND }), BEST_ENCHANTS, BEST_CONSUMABLES),
    },
    {
      label: '4. + Consecration above Holy Shock',
      apply: chain(
        tree({ ...HOLY_20_BEST, ...RET_31_BEST_TWO_HAND }),
        BEST_ENCHANTS,
        BEST_CONSUMABLES,
        CONSECRATION_UP,
      ),
    },
    {
      label: '4b. as 4, but Instrument of Law 2 -> filler',
      apply: chain(
        tree({
          ...HOLY_20_BEST,
          ...RET_31_BEST_TWO_HAND,
          instrument_of_law: 0,
          holy_conduit: 2,
        }),
        BEST_ENCHANTS,
        BEST_CONSUMABLES,
        CONSECRATION_UP,
      ),
    },
    {
      label: '4c. as 4, but Divine Strength 5 -> Divine Favor out + filler',
      apply: chain(
        tree({
          ...HOLY_20_BEST,
          divine_favor: 0,
          unyielding_faith: 1,
          ...RET_31_BEST_TWO_HAND,
        }),
        BEST_ENCHANTS,
        BEST_CONSUMABLES,
        CONSECRATION_UP,
      ),
    },
  ],

  championShield: [
    { label: '1. talents [20/0/31]', apply: tree({ ...HOLY_20_BEST, ...RET_31_BEST_SHIELD }) },
    {
      label: '2. + enchants (head/legs Haste, neck SP)',
      apply: chain(tree({ ...HOLY_20_BEST, ...RET_31_BEST_SHIELD }), BEST_ENCHANTS),
    },
    {
      label: '3. + Blasted Lands Intellect',
      apply: chain(tree({ ...HOLY_20_BEST, ...RET_31_BEST_SHIELD }), BEST_ENCHANTS, BEST_CONSUMABLES),
    },
    {
      label: '4. + Consecration above Holy Shock',
      apply: chain(
        tree({ ...HOLY_20_BEST, ...RET_31_BEST_SHIELD }),
        BEST_ENCHANTS,
        BEST_CONSUMABLES,
        CONSECRATION_UP,
      ),
    },
  ],

  /* ROUND TWO: single changes against the OPTIMISED preset. */
  r2enchants: [
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'head +8 Intellect (was +1% Haste)', apply: enchant('head', 900006) },
    { label: 'legs +8 Intellect (was +1% Haste)', apply: enchant('legs', 900006) },
    { label: 'chest +4 Defense Skill (was +4 Stats)', apply: enchant('chest', 900016) },
    { label: 'cloak +1% Dodge (was +5 Agility)', apply: enchant('cloak', 900001) },
    { label: 'wrists +9 Agility (was +16 Spell Power)', apply: enchant('wrists', 900019) },
  ],

  r2consumables: [
    { label: 'weapon effect +2% melee crit (was spell)', apply: consumable('weapon_effect', 'weapon_melee_crit') },
    { label: 'potion Frenzy (was Spellblasting)', apply: consumable('potion', 'major_frenzy_potion') },
    { label: 'blasted lands +25 Strength (was Intellect)', apply: consumable('blasted_lands', 'blasted_strength') },
    { label: 'blasted lands +25 Spirit', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'food +20 Intellect? (not offered) -> +20 Agility', apply: consumable('food', 'food_agility') },
  ],

  r2talents: [
    {
      label: '2H: Instrument of Law 2 -> Holy Conduit (control)',
      apply: tree({
        ...HOLY_20_BEST,
        improved_judgement: 2,
        conviction: 5,
        vindication: 3,
        sanctified_judgement: 3,
        sacred_arbiter: 1,
        two_handed_weapon_specialization: 3,
        vengeance: 3,
        champion_of_the_light: 3,
        benediction: 5,
        holy_conduit: 2,
        pursuit_of_justice: 1,
      }),
    },
    {
      label: '2H: Vindication 3 -> 2, 1 into filler',
      apply: tree({
        ...HOLY_20_BEST,
        improved_judgement: 2,
        conviction: 5,
        vindication: 2,
        sanctified_judgement: 3,
        sacred_arbiter: 1,
        instrument_of_law: 2,
        two_handed_weapon_specialization: 3,
        vengeance: 3,
        champion_of_the_light: 3,
        benediction: 5,
        holy_conduit: 2,
      }),
    },
    {
      label: '2H: Improved Judgement 2 -> filler',
      apply: tree({
        ...HOLY_20_BEST,
        improved_judgement: 0,
        conviction: 5,
        vindication: 3,
        sanctified_judgement: 3,
        sacred_arbiter: 1,
        instrument_of_law: 2,
        two_handed_weapon_specialization: 3,
        vengeance: 3,
        champion_of_the_light: 3,
        benediction: 5,
        holy_conduit: 2,
        pursuit_of_justice: 1,
      }),
    },
    {
      label: '2H: Sacred Arbiter 1 -> filler',
      apply: tree({
        ...HOLY_20_BEST,
        improved_judgement: 2,
        conviction: 5,
        vindication: 3,
        sanctified_judgement: 3,
        sacred_arbiter: 0,
        instrument_of_law: 2,
        two_handed_weapon_specialization: 3,
        vengeance: 3,
        champion_of_the_light: 3,
        benediction: 5,
        holy_conduit: 2,
      }),
    },
    {
      label: '2H: Improved Seals 3 -> filler (what is it worth?)',
      apply: tree({
        ...HOLY_20_BEST,
        improved_seals: 0,
        unyielding_faith: 2,
        voice_of_truth: 1,
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
    },
    {
      label: '2H: Consecrated Ground 2 -> filler (control)',
      apply: tree({
        ...HOLY_20_BEST,
        consecrated_ground: 0,
        unyielding_faith: 2,
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
