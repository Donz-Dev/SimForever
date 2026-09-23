import type { AuraDefinition, Reaction, StatModifierSpec, Stats } from '../../engine';
import { flat, percentMultiplicative, seconds } from '../../engine';
import {
  BATTLE_SHOUT,
  SUNDER_ARMOR,
  SUNDER_ARMOR_MAX_STACKS,
  THUNDER_CLAP_SLOW,
} from '../auras/warrior';
import { windfuryTotemReaction } from './windfury';

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
   * A FACTORY and not a reaction, for the reason Hand of Justice is built the
   * same way: an internal cooldown is per-character state, and one shared
   * closure is shared by every combatant in every iteration of a batch. Built
   * once, Windfury's cooldown carried the last iteration's timestamp into the
   * next fight -- where the clock had restarted at zero, so the check read
   * negative and the proc never fired again for the life of the process.
   */
  readonly buildReaction?: () => Reaction;
  /**
   * Another entry this one cannot be selected alongside.
   *
   * ----------------------------------------------------------------------------
   * THE RULESET OWNER'S RULING, and their choice of where to enforce it:
   * "Leader of the Pack and Moonkin Form don't stack, but that can be handled
   * on the GUI."
   *
   * So it is a SELECTION rule rather than a combat one. The engine will happily
   * carry two auras granting +3% crit and add them to +6%, which is correct
   * behaviour for two different auras; what is wrong is choosing both, and the
   * panel refuses that by turning one off when the other goes on.
   *
   * Declared in ONE direction and read in both, so the two entries cannot
   * disagree about whether they exclude each other.
   * ----------------------------------------------------------------------------
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

/**
 * Crit in this engine is percentage POINTS, and melee and spells are separate
 * stats. "+3% crit chance for melee, spells and ranged" is therefore two
 * modifiers, not one -- ranged reads `critChance`, the same stat melee does.
 */
function critChanceEverywhere(points: number): readonly StatModifierSpec[] {
  return [flat('critChance', points), flat('spellCritChance', points)];
}

// ---------------------------------------------------------------------------
// Player buffs
// ---------------------------------------------------------------------------

/*
 * REUSED, not redeclared. The Warrior's own Battle Shout is this same aura, so
 * a warrior who casts it and a raid that supplied it cannot stack or disagree
 * -- one refreshes the other.
 *
 * The ruleset owner's raid figure is +139 attack power and the ability
 * spreadsheet says +140. Asked which wins, the owner chose the spreadsheet, so
 * this is 140 and the one-point difference is recorded here rather than
 * silently averaged.
 */
const battleShout: RaidBuff = {
  id: 'battle_shout',
  name: 'Battle Shout',
  detail: '+140 attack power for 3 minutes',
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
  detail: '20% chance on each main-hand swing of an extra attack at +246 attack power',
  source: 'Shaman',
  appliesTo: 'player',
  /*
   * NO `aura`. The +246 window belongs to the proc and is applied by it -- see
   * `windfury.ts`, where the order of applying it and requesting the extra
   * attack is the mechanic. Listing it here would put it up at the pull for
   * free, and count it toward the health pool snapshot as well.
   */
  buildReaction: windfuryTotemReaction,
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
  detail: '+3% critical strike chance, melee and ranged and spell',
  source: 'Druid',
  appliesTo: 'player',
  aura: {
    id: 'leader_of_the_pack',
    name: 'Leader of the Pack',
    durationMs: 0,
    statModifiers: critChanceEverywhere(3),
  },
  exclusiveWith: 'moonkin_form',
};

const moonkinForm: RaidBuff = {
  id: 'moonkin_form',
  name: 'Moonkin Form',
  detail: '+3% critical strike chance, melee and ranged and spell',
  source: 'Druid',
  appliesTo: 'player',
  aura: {
    id: 'moonkin_form',
    name: 'Moonkin Form',
    durationMs: 0,
    statModifiers: critChanceEverywhere(3),
  },
  exclusiveWith: 'leader_of_the_pack',
};

// ---------------------------------------------------------------------------
// Target debuffs
// ---------------------------------------------------------------------------

/*
 * REUSED, not redeclared -- the same debuff the Warrior's own Thunder Clap now
 * applies, so a raid that already put it on the target and a warrior keeping
 * it up refresh one aura rather than stacking two.
 *
 * The three sources disagree about what "20% slower" means and the ruleset
 * owner settled it at attack speed minus twenty. `THUNDER_CLAP_SLOW` in
 * `auras/warrior.ts` has the whole of it.
 */
const thunderClapSlow: RaidBuff = {
  id: 'thunder_clap',
  name: 'Thunder Clap',
  detail: 'Target attacks 20% slower for 30 seconds',
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
 * Note also that the owner's raid figure here is 196 and the ability
 * spreadsheet says 210. The spreadsheet wins, by the same ruling that settled
 * Battle Shout, so this entry would reuse `DEMORALIZING_SHOUT` rather than
 * declaring a second magnitude.
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
 * Curse of the Elements: every magic school takes 8% more.
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
export const CURSE_OF_THE_ELEMENTS_MULTIPLIER = 1.08;

const curseOfTheElements: RaidBuff = {
  id: 'curse_of_the_elements',
  name: 'Curse of the Elements',
  detail: 'Target takes 8% more fire, frost, nature, holy, shadow and arcane damage',
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
  },
  unmodelled:
    'Magic schools only, and every Warrior ability is physical -- Shield Slam ' +
    'included -- so it changes nothing until a class that deals magic damage ' +
    'exists. Expected rather than a gap: the ruleset owner is content that it ' +
    'will work for other classes. Also a curse, like Curse of Recklessness.',
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
  blessingOfWisdom,
  blessingOfKings,
  blessingOfMight,
  faerieFire,
  markOfTheWild,
  strengthOfEarthTotem,
  graceOfAirTotem,
  manaSpringTotem,
  windfuryTotem,
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
