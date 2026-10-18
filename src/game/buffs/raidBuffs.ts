import type { AuraDefinition, CastReaction, Reaction, Stats } from '../../engine';
import { flat, percentMultiplicative, seconds } from '../../engine';
import {
  BATTLE_SHOUT,
  SUNDER_ARMOR,
  SUNDER_ARMOR_MAX_STACKS,
  THUNDER_CLAP_SLOW,
} from '../auras/warrior';
/*
 * REUSED, NOT REDECLARED, for the same reason Thunder Clap's debuff below is:
 * the Cat, Bear and Moonkin profiles PROVIDE these two themselves, through the
 * talents that grant them, so the raid buff and the talent have to be the same
 * aura or they will eventually disagree about the number.
 */
import {
  LEADER_OF_THE_PACK_AURA,
  MOONKIN_AURA,
  PARTY_CRIT_AURA_PERCENT,
} from '../auras/druid';
/*
 * REUSED, NOT REDECLARED, for the reason the Warrior's two above are: the
 * Paladin PROVIDES this debuff itself, so the raid buff and the ability have
 * to be the same aura id or they will eventually disagree -- and worse, would
 * both apply, because `spellPowerTakenFor` ADDS across auras.
 */
import {
  JUDGEMENT_OF_THE_CRUSADER,
  JUDGEMENT_OF_THE_CRUSADER_BONUS,
} from '../auras/paladin';
import {
  JUDGEMENT_OF_WISDOM_CHANCE,
  JUDGEMENT_OF_WISDOM_MANA,
  judgementOfWisdomReactions,
} from './judgementOfWisdom';
import { windfuryTotemReaction } from './windfury';
import { flametongueTotemReaction } from './flametongue';
import {
  DEFAULT_SUPPLIER_SPELL_POWER,
  RETRIBUTION_AURA_DAMAGE,
  THORNS_DAMAGE,
  retaliationReaction,
} from './retaliation';

/**
 * Raid buffs, debuffs and consumables a character can be assumed to have.
 *
 * ----------------------------------------------------------------------------
 * ONE LIST, USED BY EVERY SETUP. This is the ruleset owner's raid, written down
 * once: what a character walks in with, and what the raid has already put on
 * the target. A run without it is a character fighting alone, which is not a
 * scenario anyone is trying to measure.
 *
 * Every entry is SELECTED, never assumed. The profile stores the chosen ids and
 * nothing is on by default -- a buff that quietly applied itself would move
 * every number ever recorded, which is exactly why `BATTLE_FURY` was deleted.
 *
 * THE NUMBERS ARE THE RULESET OWNER'S, given directly. They are not scraped and
 * not Classic: where one of them meets a value the ability spreadsheet already
 * carries, the spreadsheet wins and the entry reuses that aura rather than
 * declaring a second copy. See `battle_shout` and `sunder_armor` below.
 * ----------------------------------------------------------------------------
 */

/** Who an entry lands on. */
export type RaidBuffTarget = 'player' | 'enemy';

/**
 * The procs one entry contributes, from a single build.
 *
 * Both are optional and most entries have neither. Windfury Totem has a damage
 * reaction; Judgement of Wisdom is the only entry with both, and the only
 * reason this is a record rather than a reaction.
 */
export interface RaidBuffReactions {
  readonly damage?: Reaction;
  readonly cast?: CastReaction;
}

export interface RaidBuff {
  /** Stable id. Stored on the profile, so renaming one breaks saved profiles. */
  readonly id: string;
  readonly name: string;
  /** What it does, in the ruleset owner's own words. Shown beside the switch. */
  readonly detail: string;
  /** Who provides it, for grouping the list. */
  readonly source: string;
  readonly appliesTo: RaidBuffTarget;
  /**
   * The aura applied before the first swing, for an entry that is a STATE.
   *
   * Absent for one that is a PROC: Windfury Totem's attack power window is
   * applied by its own reaction when it fires, and applying it here as well
   * would hand the character a free 1.5 seconds of +246 at the pull. It did,
   * until a character sheet read 246 attack power too high.
   */
  readonly aura?: AuraDefinition;
  /** Stacks to apply it at. Only Sunder Armor needs it. */
  readonly stacks?: number;
  /**
   * Builds the proc, once per character.
   *
   * ONE CALL RETURNS BOTH HALVES, and that is load-bearing rather than tidy.
   * Judgement of Wisdom's damage and cast reactions share a closure so that a
   * damaging spell takes ONE roll rather than two, and two separate factory
   * fields would have been called separately -- two closures, two independent
   * rolls, and the exact reading the owner rejected, arrived at by accident.
   *
   * A FACTORY and not a reaction, for the reason Hand of Justice is built the
   * same way: an internal cooldown is per-character state, and one shared
   * closure is shared by every combatant in every iteration of a batch. Built
   * once, Windfury's cooldown carried the last iteration's timestamp into the
   * next fight -- where the clock had restarted at zero, so the check read
   * negative and the proc never fired again for the life of the process.
   */
  readonly buildReactions?: (value?: number) => RaidBuffReactions;
  /**
   * A NUMBER THE SELECTION CARRIES, for an entry somebody ELSE supplies at a
   * strength of their own.
   *
   * Thorns and Retribution Aura are the callers: each scales with the
   * SUPPLIER'S spell power, so "is it up" is not the whole question and the
   * panel shows a box beside the switch. The figure is stored per entry in
   * `CharacterProfile.raidBuffValues` and handed to `buildReactions`; absent,
   * the default here applies.
   */
  readonly value?: { readonly label: string; readonly defaultValue: number };
  /**
   * Another entry this one cannot be selected alongside.
   *
   * ==========================================================================
   * **NOTHING DECLARES THIS TODAY, AND `raidBuffs.test.ts` PINS THAT.**
   *
   * Its one pair was Leader of the Pack and Moonkin Form, under the owner's
   * ruling that the two "don't stack, but that can be handled on the GUI" --
   * so it is a SELECTION rule rather than a combat one: the engine will happily
   * carry two auras granting +3% crit and add them to +6%, which is correct for
   * two different auras, and what was wrong was choosing both.
   *
   * A patch then split the two by attack type and the owner ruled them no
   * longer exclusive, which leaves `areExclusive` answering false for every
   * pair in the catalogue. **A selection rule with no declaration reads exactly
   * like one that sometimes fires**, which is why that is asserted rather than
   * left to be noticed -- the same guard `RacialRequirement.weaponTypes` got
   * when a patch removed its last caller.
   *
   * KEPT RATHER THAN DELETED, for two reasons. The next exclusive pair is then
   * one field on one entry instead of a re-implementation; and the lesson this
   * pair taught is that enforcing exclusivity HERE was never the thing that
   * worked -- the no-double-dip rule lives in the shared aura id, and a chooser
   * knows nothing about a talent or a profile loaded from JSON. See
   * `MOONKIN_AURA_ID` in `auras/druid.ts`.
   *
   * Declared in ONE direction and read in both, so two entries cannot disagree
   * about whether they exclude each other.
   * ==========================================================================
   */
  readonly exclusiveWith?: string;
  /**
   * What this entry does NOT do, in one line.
   *
   * The same discipline items and abilities follow. The panel prints it beside
   * the switch, so a buff that is selected and inert says so where it is
   * chosen rather than in a comment nobody reads.
   */
  readonly unmodelled?: string;
}

/** An hour, which is longer than any fight anyone will run. */
const HOUR = seconds(3600);
const FIVE_MINUTES = seconds(300);

/** The five primary stats Blessing of Kings and Mark of the Wild both cover. */
const PRIMARIES = ['strength', 'agility', 'stamina', 'intellect', 'spirit'] as const;

// ---------------------------------------------------------------------------
// Player buffs
// ---------------------------------------------------------------------------

/*
 * REUSED, not redeclared. The Warrior's own Battle Shout is this same aura, so
 * a warrior who casts it and a raid that supplied it cannot stack or disagree
 * -- one refreshes the other.
 *
 * +139, AND IT TOOK THREE ANSWERS TO GET THERE. The owner's raid figure was
 * 139, the ability spreadsheet said 140, and asked which won the owner chose
 * the spreadsheet. The client-derived spellbook then agreed with the raid
 * figure, and the owner asked for the spellbook to be matched -- so it is 139
 * and the question is closed. `forever-warrior-tooltips.json` still says 140 and is
 * now the only source that does.
 *
 * Because it is one aura, that one point moved the warrior's own cast too.
 */
const battleShout: RaidBuff = {
  id: 'battle_shout',
  name: 'Battle Shout',
  detail: '+139 attack power for 3 minutes',
  source: 'Warrior',
  appliesTo: 'player',
  aura: BATTLE_SHOUT,
};

const arcaneIntellect: RaidBuff = {
  id: 'arcane_intellect',
  name: 'Arcane Intellect',
  detail: '+31 intellect for 60 minutes',
  source: 'Mage',
  appliesTo: 'player',
  aura: {
    id: 'arcane_intellect',
    name: 'Arcane Intellect',
    durationMs: HOUR,
    statModifiers: [flat('intellect', 31)],
  },
};

const powerWordFortitude: RaidBuff = {
  id: 'power_word_fortitude',
  name: 'Power Word: Fortitude',
  detail: '+70 stamina for 60 minutes',
  source: 'Priest',
  appliesTo: 'player',
  aura: {
    id: 'power_word_fortitude',
    name: 'Power Word: Fortitude',
    durationMs: HOUR,
    statModifiers: [flat('stamina', 70)],
  },
};

const divineSpirit: RaidBuff = {
  id: 'divine_spirit',
  name: 'Divine Spirit',
  detail: '+40 spirit for 60 minutes',
  source: 'Priest',
  appliesTo: 'player',
  aura: {
    id: 'divine_spirit',
    name: 'Divine Spirit',
    durationMs: HOUR,
    statModifiers: [flat('spirit', 40)],
  },
};

const blessingOfWisdom: RaidBuff = {
  id: 'blessing_of_wisdom',
  name: 'Blessing of Wisdom',
  detail: '+40 mana per 5 seconds for 60 minutes',
  source: 'Paladin',
  appliesTo: 'player',
  aura: {
    id: 'blessing_of_wisdom',
    name: 'Blessing of Wisdom',
    durationMs: HOUR,
    // `manaPer5` is exactly this quantity, and the regeneration system already
    // reads it -- including the five-second rule, which this is subject to.
    statModifiers: [flat('manaPer5', 40)],
  },
};

/*
 * MULTIPLICATIVE, not additive. "+10% (1.1x)" is the ruleset owner's own
 * notation and `percentMul` is the operation that means it: two independent
 * +10% effects give 1.21, where an additive pair would give 1.20.
 */
const blessingOfKings: RaidBuff = {
  id: 'blessing_of_kings',
  name: 'Blessing of Kings',
  detail: '+10% to all five primary stats for 60 minutes',
  source: 'Paladin',
  appliesTo: 'player',
  aura: {
    id: 'blessing_of_kings',
    name: 'Blessing of Kings',
    durationMs: HOUR,
    statModifiers: PRIMARIES.map((stat) => percentMultiplicative(stat, 0.1)),
  },
};

const blessingOfMight: RaidBuff = {
  id: 'blessing_of_might',
  name: 'Blessing of Might',
  detail: '+133 attack power for 60 minutes',
  source: 'Paladin',
  appliesTo: 'player',
  aura: {
    id: 'blessing_of_might',
    name: 'Blessing of Might',
    durationMs: HOUR,
    statModifiers: [flat('attackPower', 133)],
  },
};

const markOfTheWild: RaidBuff = {
  id: 'mark_of_the_wild',
  name: 'Mark of the Wild',
  detail: '+385 armor and +16 to all five primary stats for 60 minutes',
  source: 'Druid',
  appliesTo: 'player',
  aura: {
    id: 'mark_of_the_wild',
    name: 'Mark of the Wild',
    durationMs: HOUR,
    statModifiers: [flat('armor', 385), ...PRIMARIES.map((stat) => flat(stat, 16))],
  },
};

const strengthOfEarthTotem: RaidBuff = {
  id: 'strength_of_earth_totem',
  name: 'Strength of Earth Totem',
  detail: '+53 strength for 5 minutes',
  source: 'Shaman',
  appliesTo: 'player',
  aura: {
    id: 'strength_of_earth_totem',
    name: 'Strength of Earth Totem',
    durationMs: FIVE_MINUTES,
    statModifiers: [flat('strength', 53)],
  },
};

const graceOfAirTotem: RaidBuff = {
  id: 'grace_of_air_totem',
  name: 'Grace of Air Totem',
  detail: '+89 agility for 5 minutes',
  source: 'Shaman',
  appliesTo: 'player',
  aura: {
    id: 'grace_of_air_totem',
    name: 'Grace of Air Totem',
    durationMs: FIVE_MINUTES,
    statModifiers: [flat('agility', 89)],
  },
};

/*
 * A PERIODIC GRANT rather than `manaPer5`, because the ruleset owner states it
 * as "10 mana every 2 seconds" and that is not the same cadence. Converting it
 * to 25 per five would give the same rate and the wrong arrival times, and it
 * would also hand it to the five-second rule, which a totem is not subject to.
 */
export const MANA_SPRING_MANA_PER_TICK = 10;
export const MANA_SPRING_INTERVAL_MS = seconds(2);

const manaSpringTotem: RaidBuff = {
  id: 'mana_spring_totem',
  name: 'Mana Spring Totem',
  detail: '+10 mana every 2 seconds for 5 minutes',
  source: 'Shaman',
  appliesTo: 'player',
  aura: {
    id: 'mana_spring_totem',
    name: 'Mana Spring Totem',
    durationMs: FIVE_MINUTES,
    periodic: {
      intervalMs: MANA_SPRING_INTERVAL_MS,
      onTick: (context, aura) => {
        const actor = context.combatant(aura.targetId);
        if (!actor) return;
        context.grantResource(actor, 'mana', MANA_SPRING_MANA_PER_TICK, {
          id: 'mana_spring_totem',
          name: 'Mana Spring Totem',
        });
      },
    },
  },
};

const windfuryTotem: RaidBuff = {
  id: 'windfury_totem',
  name: 'Windfury Totem',
  detail:
    '20% chance on each main-hand use -- swing or ability -- of an extra attack ' +
    'at +246 attack power',
  source: 'Shaman',
  appliesTo: 'player',
  /*
   * NO `aura`. The +246 window belongs to the proc and is applied by it -- see
   * `windfury.ts`, where the order of applying it and requesting the extra
   * attack is the mechanic. Listing it here would put it up at the pull for
   * free, and count it toward the health pool snapshot as well.
   */
  buildReactions: () => ({ damage: windfuryTotemReaction() }),
};

/**
 * Flametongue Totem: "Each main hand hit causes 17 to 55 additional Fire
 * damage, based on the speed of the weapon."
 *
 * ----------------------------------------------------------------------------
 * EXCLUSIVE WITH WINDFURY TOTEM, by the owner's ruling -- both are Air/Fire
 * totems one Shaman drops in the same slot -- and DEFAULT OFF, so it is the one
 * entry besides Curse of Recklessness that no preset carries. It is offered so a
 * user can try "Windfury Weapon + Flametongue Totem" against the default.
 *
 * THE FIRST `exclusiveWith` SINCE THE DRUID AURAS STOPPED EXCLUDING EACH OTHER,
 * which is the field doing what it was kept for: the next exclusive pair being
 * one line rather than a re-implementation.
 *
 * Flametongue WEAPON disables it for its own carrier; see `flametongue.ts`.
 * ----------------------------------------------------------------------------
 */
const flametongueTotem: RaidBuff = {
  id: 'flametongue_totem',
  name: 'Flametongue Totem',
  detail:
    'Each main-hand hit deals 17 to 55 additional Fire damage, by weapon speed ' +
    '(1.3 to 4.0). Cannot be taken with Windfury Totem',
  source: 'Shaman',
  appliesTo: 'player',
  exclusiveWith: 'windfury_totem',
  buildReactions: () => ({ damage: flametongueTotemReaction() }),
};

const trueshotAura: RaidBuff = {
  id: 'trueshot_aura',
  name: 'Trueshot Aura',
  detail: '+50 ranged attack power',
  source: 'Hunter',
  appliesTo: 'player',
  aura: {
    id: 'trueshot_aura',
    name: 'Trueshot Aura',
    // An aura the hunter simply has up. No duration is stated and none would
    // mean anything: it lasts as long as the hunter is there.
    durationMs: 0,
    statModifiers: [flat('rangedAttackPower', 50)],
  },
};

const leaderOfThePack: RaidBuff = {
  id: 'leader_of_the_pack',
  name: 'Leader of the Pack',
  detail: `+${PARTY_CRIT_AURA_PERCENT}% critical strike chance, melee and ranged`,
  source: 'Druid',
  appliesTo: 'player',
  /*
   * MELEE AND RANGED ONLY SINCE THE PATCH: "Leader of the Pack now only
   * increases Melee and Ranged Critical Strike chance." It and Moonkin Aura
   * used to share ONE aura id because the owner ruled them the same 3% -- they
   * are different buffs now, so they are two ids and they stack with each
   * other.
   *
   * THE SHARED ID SURVIVES WITHIN EACH, which is the half of that ruling that
   * was about double-dipping: this entry applies the same aura the Druid's own
   * `leader_of_the_pack` TALENT grants, so a feral Druid in a raid that ticks
   * the box reads 3% and not 6%. Enforcing that at the chooser instead is what
   * produced the +6% bug.
   *
   * AND IT NO LONGER CARRIES `exclusiveWith`, on the owner's ruling: "Moonkin
   * and Leader of the Pack are no longer exclusive. And all profiles should
   * have both enabled by default in the raid buffs." The declaration was made
   * when the two were the same 3%; the split made them different buffs, so the
   * raid simply has a feral druid AND a moonkin. See `MOONKIN_AURA_ID` in
   * `auras/druid.ts`.
   */
  aura: LEADER_OF_THE_PACK_AURA,
};

const moonkinForm: RaidBuff = {
  id: 'moonkin_form',
  name: 'Moonkin Form',
  detail: `+${PARTY_CRIT_AURA_PERCENT}% SPELL critical strike chance`,
  source: 'Druid',
  appliesTo: 'player',
  // Spell crit only since the patch, and the same aura the Moonkin Form talent
  // grants -- one id per buff, so a Moonkin with both sources reads 3%. Not
  // exclusive with Leader of the Pack any more; see that entry.
  aura: MOONKIN_AURA,
};

// ---------------------------------------------------------------------------
// Target debuffs
// ---------------------------------------------------------------------------

/*
 * REUSED, not redeclared -- the same debuff the Warrior's own Thunder Clap now
 * applies, so a raid that already put it on the target and a warrior keeping
 * it up refresh one aura rather than stacking two.
 *
 * "20% slower" is the swing time getting a fifth LONGER -- 2.00 seconds
 * becomes 2.40 -- which is the ruleset owner's ruling and agrees with
 * Forever's own description. `THUNDER_CLAP_SLOW` in `auras/warrior.ts` has the
 * whole of it, including the earlier ruling it replaced.
 */
const thunderClapSlow: RaidBuff = {
  id: 'thunder_clap',
  name: 'Thunder Clap',
  detail: "Target's attacks take 20% longer for 30 seconds",
  source: 'Warrior',
  appliesTo: 'enemy',
  aura: THUNDER_CLAP_SLOW,
};

/*
 * DEMORALIZING SHOUT IS DELIBERATELY ABSENT, at the ruleset owner's request:
 * "make it a comment, keep it inert for now".
 *
 *   Demoralizing Shout: Enemy Target loses 196 Attack Power
 *
 * It would change nothing if it were here. The boss melee in
 * `encounters/raidBoss.ts` carries `powerCoefficient: 0` -- its swing damage
 * is stated outright rather than derived from attack power -- so there is no
 * term for the debuff to reduce. The Warrior's own Demoralizing Shout is in
 * the Protection list for the same reason and says so on the results page.
 *
 * The owner's raid figure of 196 is now the implemented one. The capture's
 * description said 210 above an effect row saying -195, which is 196 -- so
 * this entry would reuse `DEMORALIZING_SHOUT` rather than declaring a second
 * magnitude, and the two would agree.
 */

/*
 * REUSED at full stacks, not redeclared. The Warrior's own Sunder Armor is 450
 * armor a stack to five stacks, which is exactly the 2,250 the ruleset owner
 * states -- so a raid that already applied it and a warrior who keeps it up
 * are the same debuff, and the warrior's casts refresh what the raid supplied
 * rather than stacking on top of it.
 */
const sunderArmor: RaidBuff = {
  id: 'sunder_armor',
  name: 'Sunder Armor',
  detail: 'Target armor reduced by 2,250 (5 stacks)',
  source: 'Warrior',
  appliesTo: 'enemy',
  aura: SUNDER_ARMOR,
  stacks: SUNDER_ARMOR_MAX_STACKS,
};

export const ARMOR_CURSE_REDUCTION = 505;

const curseOfRecklessness: RaidBuff = {
  id: 'curse_of_recklessness',
  name: 'Curse of Recklessness',
  detail: 'Target armor reduced by 505',
  source: 'Warlock',
  appliesTo: 'enemy',
  aura: {
    id: 'curse_of_recklessness',
    name: 'Curse of Recklessness',
    durationMs: HOUR,
    isDebuff: true,
    statModifiers: [flat('armor', -ARMOR_CURSE_REDUCTION)],
  },
  unmodelled:
    'A curse, and so is Curse of the Elements. Only one curse holds on a ' +
    'target in WoW; nothing in the source says so, so both are allowed here ' +
    'and selecting both applies both.',
};

const faerieFire: RaidBuff = {
  id: 'faerie_fire',
  name: 'Faerie Fire',
  detail: 'Target armor reduced by 505',
  source: 'Druid',
  appliesTo: 'enemy',
  aura: {
    id: 'faerie_fire',
    name: 'Faerie Fire',
    durationMs: HOUR,
    isDebuff: true,
    statModifiers: [flat('armor', -ARMOR_CURSE_REDUCTION)],
  },
};

/**
 * Curse of the Elements: every magic school takes 10% more, and loses 75
 * resistance.
 *
 * ----------------------------------------------------------------------------
 * 10% AND -75, FROM FOREVER'S OWN PAGE (round 46): "Curses the target for 5
 * min, reducing Magic resistances by 75 and increasing Magic damage taken by
 * 10%." (Wowhead's Forever spell 1311680, whose effect rows read -74 and 11:
 * the client's base points, one off the figure as everywhere else.) This was
 * 8% with no resistance half, so every caster under the preset raid debuffs
 * was a little short.
 *
 * ALL SIX MAGIC SCHOOLS, HOLY INCLUDED, by the owner's ruling on "Magic".
 *
 * THE -75 IS FLOORED AT ZERO, also the owner's: it cancels resistance a target
 * has and does not become bonus damage. A raid boss resists nothing, so the
 * half is live and worth nothing here -- it is what a resistant target would
 * need. `Combatant.resistanceFor` applies the floor.
 * ----------------------------------------------------------------------------
 *
 * PHYSICAL IS ABSENT, which is the whole point of it and also why it currently
 * changes nothing: every Warrior ability is physical, Shield Slam included, so
 * nothing this project can cast is affected. The panel says so beside the
 * switch rather than leaving a selected buff to look as though it worked.
 *
 * It is implemented rather than left out because the mechanism is small and
 * the alternative is a buff that silently does nothing for the first caster
 * who arrives. `damageTakenBySchool` is checked by a test that fires real fire
 * damage at a target carrying this.
 */
export const CURSE_OF_THE_ELEMENTS_MULTIPLIER = 1.1;
export const CURSE_OF_THE_ELEMENTS_RESISTANCE = 75;

const curseOfTheElements: RaidBuff = {
  id: 'curse_of_the_elements',
  name: 'Curse of the Elements',
  detail: 'Target takes 10% more fire, frost, nature, holy, shadow and arcane damage, and loses 75 of each resistance',
  source: 'Warlock',
  appliesTo: 'enemy',
  aura: {
    id: 'curse_of_the_elements',
    name: 'Curse of the Elements',
    durationMs: HOUR,
    isDebuff: true,
    damageTakenBySchool: {
      arcane: CURSE_OF_THE_ELEMENTS_MULTIPLIER,
      fire: CURSE_OF_THE_ELEMENTS_MULTIPLIER,
      frost: CURSE_OF_THE_ELEMENTS_MULTIPLIER,
      holy: CURSE_OF_THE_ELEMENTS_MULTIPLIER,
      nature: CURSE_OF_THE_ELEMENTS_MULTIPLIER,
      shadow: CURSE_OF_THE_ELEMENTS_MULTIPLIER,
    },
    resistanceBySchool: {
      arcane: -CURSE_OF_THE_ELEMENTS_RESISTANCE,
      fire: -CURSE_OF_THE_ELEMENTS_RESISTANCE,
      frost: -CURSE_OF_THE_ELEMENTS_RESISTANCE,
      holy: -CURSE_OF_THE_ELEMENTS_RESISTANCE,
      nature: -CURSE_OF_THE_ELEMENTS_RESISTANCE,
      shadow: -CURSE_OF_THE_ELEMENTS_RESISTANCE,
    },
  },
  unmodelled:
    'Magic schools only, and every Warrior ability is physical -- Shield Slam ' +
    'included -- so it changes nothing until a class that deals magic damage ' +
    'exists. Expected rather than a gap: the ruleset owner is content that it ' +
    'will work for other classes. Also a curse, like Curse of Recklessness.',
};

/*
 * JUDGEMENT OF WISDOM. The owner's mechanic, and the one roll per action it
 * resolves to, are written up in `buffs/judgementOfWisdom.ts`.
 *
 * ON THE ENEMY, because it is a judgement placed on the target -- but the
 * reaction it builds belongs to the ATTACKER, who is the one gaining the mana.
 * That split is why the encounter collects reactions from every selected
 * entry rather than only from the ones that land on the player.
 *
 * NO AURA, so it is a PROC entry like Windfury Totem rather than a STATE one.
 */
const judgementOfWisdom: RaidBuff = {
  id: 'judgement_of_wisdom',
  name: 'Judgement of Wisdom',
  detail: `Attacks and spells against the target have a ${
    JUDGEMENT_OF_WISDOM_CHANCE * 100
  }% chance to restore ${JUDGEMENT_OF_WISDOM_MANA} mana to the attacker`,
  source: 'Paladin',
  appliesTo: 'enemy',
  buildReactions: judgementOfWisdomReactions,
  unmodelled:
    'Its 40-second duration, the melee-strike refresh and the one-Judgement-' +
    'per-Paladin limit are not modelled: a raid buff here is an assumption ' +
    'that holds for the whole fight.',
};

/**
 * Gift of Arthas: "+8 damage to any direct damage (non-damage over time)
 * source", the ruleset owner's own wording.
 *
 * ----------------------------------------------------------------------------
 * SCHOOL-BLIND AND FLAT, which is why it needed a field of its own rather than
 * either of the two neighbours it sits between. `damageTakenBySchool`
 * multiplies and `spellPowerTakenBySchool` is power scaled by each ability's
 * coefficient -- see `AuraDefinition.flatDamageTaken`, where the whole argument
 * is written out.
 *
 * IT IS THE SMALLEST RAID DEBUFF HERE AND THE WIDEST. Eight damage is nothing
 * next to Curse of the Elements' 8%, and it reaches EVERY direct hit a
 * character lands -- so it is worth most to whoever hits most often, which is
 * the opposite of how a percentage debuff distributes. A Rogue making forty
 * strikes a fight collects more than a Mage casting twenty spells.
 * ----------------------------------------------------------------------------
 */
export const GIFT_OF_ARTHAS_DAMAGE = 8;

/**
 * Devotion Aura: "+735 armor", on every profile by the owner's instruction.
 *
 * NOT ARMOR FROM ITEMS, also the owner's, which needs no exclusion: Toughness,
 * Thick Hide and Dire Bear Form scale `armorFromItems`, and that sums ITEM
 * stats directly -- an aura's flat armor is outside it by construction, the
 * same answer the cloak enchant and the armor potion already get.
 */
export const DEVOTION_AURA_ARMOR = 735;

const devotionAura: RaidBuff = {
  id: 'devotion_aura',
  name: 'Devotion Aura',
  detail: `+${DEVOTION_AURA_ARMOR} armor (not armor from items)`,
  source: 'Paladin',
  appliesTo: 'player',
  aura: {
    id: 'devotion_aura',
    name: 'Devotion Aura',
    durationMs: 0,
    statModifiers: [flat('armor', DEVOTION_AURA_ARMOR)],
  },
};

/**
 * Thorns and Retribution Aura: damage back to whatever attacks the character,
 * at the SUPPLIER'S spell power -- the one value box in this catalogue. On by
 * default for the three tanks only, by the owner's instruction: nothing
 * attacks anybody else, so they are worth exactly nothing there.
 * See `retaliation.ts`.
 */
const SUPPLIER_SPELL_POWER = {
  label: "Supplier's spell power",
  defaultValue: DEFAULT_SUPPLIER_SPELL_POWER,
} as const;

const thorns: RaidBuff = {
  id: 'thorns',
  name: 'Thorns',
  detail: `${THORNS_DAMAGE} Nature damage + 6% of the supplier's spell power to each attacker`,
  source: 'Druid',
  appliesTo: 'player',
  value: SUPPLIER_SPELL_POWER,
  buildReactions: (value = DEFAULT_SUPPLIER_SPELL_POWER) => ({
    damage: retaliationReaction('thorns', 'Thorns', 'nature', THORNS_DAMAGE, value),
  }),
};

const retributionAura: RaidBuff = {
  id: 'retribution_aura',
  name: 'Retribution Aura',
  detail: `${RETRIBUTION_AURA_DAMAGE} Holy damage + 6% of the supplier's spell power to each attacker`,
  source: 'Paladin',
  appliesTo: 'player',
  value: SUPPLIER_SPELL_POWER,
  buildReactions: (value = DEFAULT_SUPPLIER_SPELL_POWER) => ({
    damage: retaliationReaction(
      'retribution_aura',
      'Retribution Aura',
      'holy',
      RETRIBUTION_AURA_DAMAGE,
      value,
    ),
  }),
};

const giftOfArthas: RaidBuff = {
  id: 'gift_of_arthas',
  name: 'Gift of Arthas',
  detail: `Direct attacks against the target deal ${GIFT_OF_ARTHAS_DAMAGE} extra damage`,
  source: 'Consumable',
  appliesTo: 'enemy',
  aura: {
    id: 'gift_of_arthas',
    name: 'Gift of Arthas',
    durationMs: HOUR,
    isDebuff: true,
    flatDamageTaken: GIFT_OF_ARTHAS_DAMAGE,
  },
};

/**
 * Judgement of the Crusader, as something ANOTHER Paladin has already put up.
 *
 * ============================================================================
 * THE SAME AURA ID AS THE PALADIN'S OWN, WHICH IS THE WHOLE DESIGN.
 *
 * `spellPowerTakenFor` ADDS across auras -- two debuffs granting Holy power are
 * one pool -- so a second id would hand a Retribution Paladin 322 Holy spell
 * power the moment somebody ticked this box: its own judgement plus the raid's.
 * Sharing the id makes that unrepresentable, because `AuraCollection.apply`
 * refreshes a matching id instead of stacking. One judgement sits on a target,
 * which is what the game says too.
 *
 * THAT IS THE ARRANGEMENT `MOONKIN_AURA` ALREADY USES for Moonkin Aura and
 * Leader of the Pack, and it is there because the alternative -- enforcing
 * exclusivity at the CHOOSER -- failed: `withRaidBuff` governs two raid buff
 * entries and knows nothing about a talent, so a Moonkin carrying its own form
 * read +6% crit. A shape that cannot express the mistake needs no chooser.
 *
 * ----------------------------------------------------------------------------
 * ONLY THE DURATION DIFFERS, AND IT IS SPREAD RATHER THAN RETYPED. The
 * Paladin's own lasts 40 seconds and is refreshed by its melee strikes; a raid
 * buff here is an assumption that holds for the whole fight, which is what
 * "handled like other debuffs as far as auto-application and duration" asks
 * for and what every other enemy entry in this file does.
 *
 * SPREADING `JUDGEMENT_OF_THE_CRUSADER` IS WHAT STOPS THE 161 DRIFTING. The
 * bonus, the name, the id and `isDebuff` all come from the one declaration, so
 * a Forever change to the figure moves both at once. Retyping it is how the
 * owner's own Battle Shout and Sunder Armor entries would have drifted, which
 * is why those reuse their auras too.
 *
 * A PALADIN RE-JUDGING SHORTENS IT TO FORTY SECONDS, which is correct rather
 * than tolerated: at that point the debuff genuinely is that Paladin's, and
 * their melee strikes refresh it exactly as they always did.
 * ----------------------------------------------------------------------------
 */
const judgementOfTheCrusader: RaidBuff = {
  id: 'judgement_of_the_crusader',
  name: 'Judgement of the Crusader',
  detail: `Target takes up to ${JUDGEMENT_OF_THE_CRUSADER_BONUS} more Holy spell damage`,
  source: 'Paladin',
  appliesTo: 'enemy',
  aura: { ...JUDGEMENT_OF_THE_CRUSADER, durationMs: HOUR },
  unmodelled:
    'Its 40-second duration and the melee-strike refresh are the PALADIN’s ' +
    'version of this debuff and are modelled there. As a raid buff it is an ' +
    'assumption that holds for the whole fight, which is what every other ' +
    'entry here is.',
};

// ---------------------------------------------------------------------------

/** Every entry, in the order the ruleset owner gave them. */
export const RAID_BUFFS: readonly RaidBuff[] = [
  battleShout,
  thunderClapSlow,
  sunderArmor,
  arcaneIntellect,
  powerWordFortitude,
  divineSpirit,
  curseOfRecklessness,
  curseOfTheElements,
  judgementOfWisdom,
  judgementOfTheCrusader,
  giftOfArthas,
  blessingOfWisdom,
  blessingOfKings,
  blessingOfMight,
  devotionAura,
  retributionAura,
  faerieFire,
  markOfTheWild,
  thorns,
  strengthOfEarthTotem,
  graceOfAirTotem,
  manaSpringTotem,
  windfuryTotem,
  flametongueTotem,
  trueshotAura,
  leaderOfThePack,
  moonkinForm,
];

export const RAID_BUFFS_BY_ID: ReadonlyMap<string, RaidBuff> = new Map(
  RAID_BUFFS.map((buff) => [buff.id, buff]),
);

/**
 * The selected entries, in catalogue order, ignoring ids nobody recognises.
 *
 * An unknown id is DROPPED rather than throwing: a profile saved when an entry
 * existed should still load after it is renamed, and losing one buff is a
 * better failure than losing the character.
 */
export function selectedRaidBuffs(ids: readonly string[]): readonly RaidBuff[] {
  const chosen = new Set(ids);
  return RAID_BUFFS.filter((buff) => chosen.has(buff.id));
}

/** Whether two entries are declared mutually exclusive, in either direction. */
export function areExclusive(a: RaidBuff, b: RaidBuff): boolean {
  return a.exclusiveWith === b.id || b.exclusiveWith === a.id;
}

/**
 * Turn one entry on, switching off anything it cannot sit beside.
 *
 * Returns ids in CATALOGUE order, so two profiles with the same selection are
 * the same file -- a list whose order depended on which switch was flipped
 * first would make every export a diff.
 */
export function withRaidBuff(ids: readonly string[], id: string): readonly string[] {
  const buff = RAID_BUFFS_BY_ID.get(id);
  if (!buff) return ids;

  const chosen = new Set(ids);
  chosen.add(id);
  for (const other of RAID_BUFFS) {
    if (other.id !== id && areExclusive(buff, other)) chosen.delete(other.id);
  }
  return RAID_BUFFS.filter((entry) => chosen.has(entry.id)).map((entry) => entry.id);
}

/**
 * The STAT contribution of the selected player buffs, for computing the health
 * and mana pools.
 *
 * ----------------------------------------------------------------------------
 * WHY THE POOLS NEED THIS AND NOTHING ELSE DOES.
 *
 * Health and mana are computed ONCE, in `createPlayer`, from the character's
 * starting stats -- they are resource maximums rather than derived stats, so
 * they do not re-derive when a buff moves stamina. Every other stat does.
 *
 * So Power Word: Fortitude's +70 stamina would have granted NO HEALTH, which
 * is the entire point of it, and Blessing of Kings' +10% stamina none either.
 * The buffs are still applied as auras; this is only the snapshot the pools are
 * sized from, so nothing is counted twice.
 *
 * The underlying limitation is unchanged and still real: a buff that lands
 * MID-fight does not resize the pool. Everything here is up before the first
 * swing, which is what makes the snapshot correct.
 * ----------------------------------------------------------------------------
 */
export function raidBuffPoolStats(
  ids: readonly string[],
): (own: Readonly<Stats>) => Readonly<Stats> {
  const buffs = selectedRaidBuffs(ids).filter((buff) => buff.appliesTo === 'player');
  const specs = buffs.flatMap((buff) => buff.aura?.statModifiers ?? []);

  return (own) => {
    const result: Record<string, number> = { ...own };

    // Flats first, then the multiplicative percentages -- the same order
    // `StatBlock` combines them in, so Blessing of Kings multiplies a total
    // that already includes Mark of the Wild rather than the other way round.
    for (const spec of specs) {
      if (spec.operation === 'flat') {
        result[spec.stat] = (result[spec.stat] ?? 0) + spec.value;
      }
    }
    for (const spec of specs) {
      if (spec.operation === 'percentMul') {
        result[spec.stat] = (result[spec.stat] ?? 0) * (1 + spec.value);
      }
    }

    return result as Readonly<Stats>;
  };
}
