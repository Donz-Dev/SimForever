import { describe, expect, it } from 'vitest';
import type { Combatant } from '../../src/engine';
import {
  AttackTableModifiers,
  Simulation,
  castAbility,
  dealDamage,
  resolveCast,
  seconds,
} from '../../src/engine';
import { flat } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  AURA_DURATION_BONUS,
  INSECT_SWARM_ABILITY,
  MOONFIRE,
  NATURES_SWIFTNESS_ABILITY,
  SHIFTING_POWER_ENERGY,
  WRATH,
} from '../../src/game/abilities/druid';
import {
  INSECT_SWARM,
  INSECT_SWARM_DURATION_MS,
  LACERATE,
  MOONFIRE_DOT,
  MOONFIRE_DOT_DURATION_MS,
  NATURES_SWIFTNESS,
  NATURE_SPELLS,
  PARTY_CRIT_AURA,
  PARTY_CRIT_AURA_ID,
  PARTY_CRIT_AURA_PERCENT,
  RAKE_DOT,
  lengthened,
  ripAura,
} from '../../src/game/auras/druid';
import { TALENT_AURAS } from '../../src/game/auras/talentAuras';
import { RAID_BUFFS_BY_ID } from '../../src/game/buffs/raidBuffs';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { DRUID_CAT, SHIFTING_POWER_ENERGY_CEILING } from '../../src/game/rotations/druid';
import {
  RAKE_AP_COEFFICIENT,
  RAKE_TICK_AP_COEFFICIENT,
  SWIPE_AP_COEFFICIENT,
} from '../../src/game/combat/coefficients';
import { NATURAL_REACTION_RAGE } from '../../src/game/reactions/druidTalents';
import { talentBuild, talentContextFor } from '../../src/game/talents/talentBuild';
import { talentNumber } from '../../src/game/talents/talentValues';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { armorFromItems, statsForStyle } from '../../src/game/items/equipment';
import { MAX_CHARACTER_LEVEL } from '../../src/game/character';
import { weaponsFor } from '../../src/game/actors/createPlayer';
import type { AplCondition } from '../../src/game/rotations/apl';
import { compileCondition } from '../../src/game/rotations/apl';

/*
 * A condition is DATA now. `compileCondition` turns one back into the closure
 * the engine runs, which is what these assertions have always been calling --
 * the step used to be implicit because a list held closures directly.
 */
const compiled = (condition: AplCondition | undefined) =>
  condition ? compileCondition(condition) : undefined;

/*
 * ============================================================================
 * THE DRUID'S TALENTS, AND THE NINE THAT CAME OFF THE QUEUE.
 *
 * The census went from twelve live gaps to three, and the three that are left
 * are the two shapeshifting talents -- one engine gap wearing two hats -- and
 * spell pushback, which nothing in this engine models.
 *
 * EVERY TEST HERE ASSERTS A MECHANISM. A cost, a stat arriving, a stack count,
 * an aura present, a multiplier applied. None asserts a DPS delta, because a
 * correct talent can be worth zero -- Shredding Attacks' Lacerate clause is
 * worth exactly nothing to all three profiles and is still the difference
 * between a talent that is expressed and one that is not.
 * ============================================================================
 */

/**
 * Twenty-one Restoration points, which is what Nature's Swiftness costs to
 * reach: tier 20, requiring Naturalist.
 *
 * SPELLED OUT AT THE RANKS THAT EXIST. Subtlety and Natural Shapeshifter have
 * THREE ranks, and an over-allocation is dropped SILENTLY -- which takes the
 * tree total under twenty and drops the capstone with it, so the test reads
 * "the talent grants nothing". `tests/helpers/legalise` exists for exactly this
 * on the Warrior.
 */
const RESTO_20: Record<string, number> = {
  nature_s_focus: 5,
  furor: 5,
  naturalist: 5,
  subtlety: 3,
  natural_shapeshifter: 3,
  nature_s_swiftness: 1,
};

/** A Druid built from a preset's own allocation and gear, in a given form. */
function druid(preset: string, style: 'cat' | 'bear' | 'moonkin'): Combatant {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return createPlayer({
    race: 'tauren',
    characterClass: 'druid',
    combatStyle: style,
    talents: built.talents,
    equipment: built.equipment,
  });
}

/** The same, with no talents at all, so a difference is the talents'. */
function untalented(preset: string, style: 'cat' | 'bear' | 'moonkin'): Combatant {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return createPlayer({
    race: 'tauren',
    characterClass: 'druid',
    combatStyle: style,
    equipment: built.equipment,
  });
}

/** What a preset's talents resolve to, in a named form. */
function buildIn(preset: string, style: 'cat' | 'bear' | 'moonkin') {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return talentBuild(
    'druid',
    built.talents,
    talentContextFor(built.equipment, style, weaponsFor(built.equipment, style), {
      characterClass: 'druid',
      talents: built.talents,
      level: MAX_CHARACTER_LEVEL,
    }),
  );
}

describe('a form is a combat style, so three talents can read it', () => {
  /*
   * --------------------------------------------------------------------------
   * THE COUNT WAS WRONG AND THAT IS WHY IT MATTERED. `docs/handoff/druid.md`
   * wrote five talents up as ONE engine gap -- mid-fight form shifting -- and
   * only two of them ask about the shift. The other three ask WHICH FORM IS
   * HELD, which is a field the preset sets.
   * --------------------------------------------------------------------------
   */
  it('gives Predatory Strikes 150% of the level as attack power, in cat and bear only', () => {
    const rank = 3;
    const percent = talentNumber('druid', 'predatory_strikes', rank, 0);
    expect(percent).toBe(150);
    const expected = (MAX_CHARACTER_LEVEL * percent!) / 100;
    expect(expected).toBe(90);

    // Both feral profiles take it at rank 3 and both get it.
    for (const [preset, style] of [
      ['druid_cat', 'cat'],
      ['druid_bear', 'bear'],
    ] as const) {
      expect(buildIn(preset, style).stats.attackPower, preset).toBe(expected);
    }

    /*
     * AND A MOONKIN ALLOCATION DOES NOT, which is the half that has to be
     * checked separately: an effect with a requirement nothing enforces is a
     * bonus being paid, and reads as a working talent.
     */
    const moonkin = buildIn('druid_cat', 'moonkin');
    expect(moonkin.stats.attackPower ?? 0).toBe(0);
    expect(moonkin.unmodelled.map((entry) => entry.talentId)).toContain('predatory_strikes');
  });

  it('gives Heart of the Wild stamina to a bear and strength to a cat, never both', () => {
    /*
     * "Increases your Intellect by 10%. In addition, while in Bear Form or Dire
     * Bear Form your Stamina is increased by 20% and while in Cat Form your
     * Strength is increased by 10%."
     *
     * FOREVER'S CAT CLAUSE IS STRENGTH, where Classic gives attack power. Both
     * raise attack power in the end, and only one of them follows a buff.
     */
    const [intellect, stamina, strength] = [0, 1, 2].map((index) =>
      talentNumber('druid', 'heart_of_the_wild', 5, index),
    );
    expect([intellect, stamina, strength]).toEqual([10, 20, 10]);

    const cat = buildIn('druid_cat', 'cat').statModifiers;
    expect(cat).toContainEqual({ stat: 'intellect', operation: 'percentAdd', value: 0.1 });
    expect(cat).toContainEqual({ stat: 'strength', operation: 'percentAdd', value: 0.1 });
    expect(cat.map((m) => m.stat)).not.toContain('stamina');

    const bear = buildIn('druid_bear', 'bear').statModifiers;
    expect(bear).toContainEqual({ stat: 'stamina', operation: 'percentAdd', value: 0.2 });
    expect(bear.filter((m) => m.stat === 'strength')).toEqual([]);

    // And the intellect half is unconditional, so it lands in every form.
    expect(buildIn('druid_cat', 'moonkin').statModifiers).toContainEqual({
      stat: 'intellect',
      operation: 'percentAdd',
      value: 0.1,
    });
  });

  it('grants the party crit aura in the right form and not in the wrong one', () => {
    /*
     * THE SAME AURA FROM BOTH TALENTS, by the owner's ruling that Moonkin Aura
     * and Leader of the Pack are one exclusive 3% -- so what the form gates is
     * WHETHER the character has it, not which of two it gets.
     */
    expect(buildIn('druid_moonkin', 'moonkin').grantedAuras.has(PARTY_CRIT_AURA_ID)).toBe(true);
    expect(buildIn('druid_cat', 'cat').grantedAuras.has(PARTY_CRIT_AURA_ID)).toBe(true);
    expect(buildIn('druid_bear', 'bear').grantedAuras.has(PARTY_CRIT_AURA_ID)).toBe(true);

    // A feral allocation read in Moonkin form grants nothing and says why.
    const wrongForm = buildIn('druid_cat', 'moonkin');
    expect(wrongForm.grantedAuras.has(PARTY_CRIT_AURA_ID)).toBe(false);
    expect(wrongForm.unmodelled.map((e) => e.talentId)).toContain('leader_of_the_pack');
  });

  it('leaves exactly two talents on the shapeshifting gap, with the same wording', () => {
    /*
     * A whole family expires at once and is then findable by its wording,
     * which is why both say the same sentence. This test is what makes the
     * wording load-bearing rather than tidy -- the same shape
     * `grantCastModifier.test.ts` uses for its own retired reason.
     */
    const SHIFTING = 'a form is fixed at creation like a stance';
    const shifting = Object.entries(DRUID_TALENT_EFFECTS)
      .filter(([, effects]) =>
        effects.some((e) => e.kind === 'unmodelled' && e.reason.includes(SHIFTING)),
      )
      .map(([id]) => id)
      .sort();
    expect(shifting).toEqual(['furor', 'natural_shapeshifter']);
  });
});

describe('the Glaive of Obsidian Fury finally pays its 172', () => {
  const GLAIVE = 227833;
  const FORM_ATTACK_POWER = 172;

  it('reads the form clause off the tooltip instead of listing it as unmodelled', () => {
    const glaive = ITEMS_BY_ID.get(GLAIVE)!;
    expect(glaive.name).toBe('Glaive of Obsidian Fury');
    // The line itself, from the capture, so a re-scrape that reworded it fails.
    expect(glaive.tooltip).toContain(
      '+172 Attack Power in Cat, Bear, and Dire Bear forms only.',
    );
    // Cat and Bear, and Dire Bear folds into Bear because there is one bear style.
    expect(glaive.styleStats).toEqual({
      cat: { attackPower: FORM_ATTACK_POWER },
      bear: { attackPower: FORM_ATTACK_POWER },
    });
    // It is NOT in the unconditional stats, which would pay every style.
    expect(glaive.stats.attackPower ?? 0).toBe(0);
    // And it is no longer reported as something the simulator cannot do.
    expect(glaive.unmodelled.map((u) => u.text)).not.toContain(
      '+172 Attack Power in Cat, Bear, and Dire Bear forms only.',
    );
  });

  it('pays it in cat and bear form and nowhere else', () => {
    const equipment = { twoHand: { itemId: GLAIVE } };
    const ap = (style: 'cat' | 'bear' | 'moonkin' | 'caster') =>
      statsForStyle(equipment, style).attackPower ?? 0;
    expect(ap('cat')).toBe(FORM_ATTACK_POWER);
    expect(ap('bear')).toBe(FORM_ATTACK_POWER);
    expect(ap('moonkin')).toBe(0);
    expect(ap('caster')).toBe(0);
  });
});

describe('Genesis, which is periodic damage and nothing else', () => {
  /** An attacker whose ticks are worth 50% more and whose strikes are not. */
  function withGenesis(percent: number): { source: Combatant; target: Combatant } {
    return {
      source: makeAttacker({ periodicDamageMultiplier: 1 + percent / 100, stats: {} }),
      target: makeTarget({ stats: { armor: 0 } }),
    };
  }

  it('multiplies a tick and leaves a direct hit alone', () => {
    const { source, target } = withGenesis(50);
    const simulation = buildSimulation([source, target]);

    const tick = dealDamage(simulation, {
      source,
      target,
      abilityName: 'Tick',
      school: 'physical',
      baseAmount: 100,
      periodic: true,
      appliesArmor: false,
    });
    const direct = dealDamage(simulation, {
      source,
      target,
      abilityName: 'Direct',
      school: 'physical',
      baseAmount: 100,
      appliesArmor: false,
    });

    expect(tick.amount).toBeCloseTo(150, 6);
    expect(direct.amount).toBeCloseTo(100, 6);
  });

  it('is 1 for a character without it, so every other profile is untouched', () => {
    expect(makeAttacker().periodicDamageMultiplier).toBe(1);
    // All three Druid profiles take it; the five ranks are 1% to 5%.
    expect([1, 2, 3, 4, 5].map((r) => talentNumber('druid', 'genesis', r, 0))).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(buildIn('druid_cat', 'cat').periodicDamageMultiplier).toBeCloseTo(1.05, 10);
    expect(buildIn('druid_bear', 'bear').periodicDamageMultiplier).toBeCloseTo(1.05, 10);
    // The Moonkin spends two points, not five.
    expect(buildIn('druid_moonkin', 'moonkin').periodicDamageMultiplier).toBeCloseTo(1.02, 10);
  });
});

describe('Rend and Tear, which asks about the TARGET', () => {
  /** An attacker with +10% melee-ability damage against a bleeding target. */
  function feral(): { source: Combatant; target: Combatant } {
    const bleeding = new AttackTableModifiers();
    // BOTH MELEE TABLES, as the talent registers them -- see the note below on
    // which reading the owner's figure settled.
    bleeding.add('melee-special', { damageMultiplier: 1.1 });
    bleeding.add('melee-auto', { damageMultiplier: 1.1 });
    return {
      source: makeAttacker({ bleedingTargetModifiers: bleeding }),
      target: makeTarget({ stats: { armor: 0 } }),
    };
  }

  /**
   * One `melee-special` strike, reported as the RAW figure.
   *
   * `raw` rather than `amount` because the table can miss, and it is computed
   * whether or not the roll landed -- so the multiplier is observable without
   * scripting a roll or sampling a hundred of them.
   */
  const shred = (
    simulation: ReturnType<typeof buildSimulation>,
    source: Combatant,
    target: Combatant,
  ) =>
    dealDamage(simulation, {
      source,
      target,
      abilityName: 'Shred',
      school: 'physical',
      baseAmount: 100,
      attackTable: 'melee-special',
      appliesArmor: false,
    });

  it('pays only while a bleed is on the target', () => {
    const { source, target } = feral();
    const simulation = buildSimulation([source, target]);

    /*
     * NOT BLEEDING: the raw figure is the base, or twice it on a crit. What it
     * can never be is 110 or 220, which is the whole assertion -- and checking
     * the SET of legal values rather than one of them is what lets this be
     * exact instead of sampled.
     */
    const dry = shred(simulation, source, target);
    if (!dry.avoided) expect([100, 200]).toContain(Math.round(dry.raw));

    simulation.applyAura(target, RAKE_DOT, source.id);
    expect(target.auras.isBleeding).toBe(true);

    const wet = shred(simulation, source, target);
    if (!wet.avoided) expect([110, 220]).toContain(Math.round(wet.raw));
  });

  it('stops paying when the bleed falls off', () => {
    const { source, target } = feral();
    const simulation = buildSimulation([source, target], { durationMs: seconds(60) });
    simulation.begin();
    simulation.applyAura(target, RAKE_DOT, source.id);

    // Rake is nine seconds. Read fresh per hit, so this is not settled at build
    // time -- which is the difference between this scope and `conditionalDamage`.
    simulation.advanceTo(seconds(20));
    expect(target.auras.isBleeding).toBe(false);
    const after = shred(simulation, source, target);
    if (!after.avoided) expect([100, 200]).toContain(Math.round(after.raw));
  });

  it('reaches a strike AND a bleed tick, on the owner\'s figure', () => {
    /*
     * ----------------------------------------------------------------------
     * THIS TEST PINNED THE NARROW READING AND THE OWNER'S FIGURE OVERTURNED IT.
     *
     * It asserted that a tick is NOT reached, on two arguments: that a
     * table-keyed damage multiplier reads `attackTable` and never `critFrom`
     * everywhere else in this pipeline, and that a bleed's own ticks would
     * otherwise be amplified by the bleed being up -- Rip raising Rip.
     *
     * Both arguments are still true and neither is decisive. The owner reported
     * expecting "around 1.09x" from Rend and Tear and seeing "more like
     * 1.025x", and measured over 30 batches with the target bleeding 89.3% of
     * the fight the readings are:
     *
     *     melee-special, non-periodic     29.6% of damage     x1.0296
     *     plus the bleed TICKS            61.2%               x1.0612
     *     plus the AUTO-ATTACKS           94.8%               x1.0948
     *
     * Only the last produces 1.09 and the first produces 1.025 to the decimal.
     * So the talent reaches every point of melee damage, and Rip does raise Rip.
     *
     * AND THE OLD COMMENT OVERSTATED ITS OWN EVIDENCE: it said the looser
     * reading "measured the Cat a third higher", and the figures behind that
     * were 651.7 against 632.2 -- about 3%, not a third. A measurement in a
     * comment is worth checking even when it is arguing for the right thing.
     * ----------------------------------------------------------------------
     */
    const { source, target } = feral();
    const simulation = buildSimulation([source, target]);
    simulation.applyAura(target, RAKE_DOT, source.id);

    const hit = dealDamage(simulation, {
      source,
      target,
      abilityName: 'Shred',
      school: 'physical',
      baseAmount: 100,
      attackTable: 'melee-special',
      appliesArmor: false,
    });
    // The table can miss, so the bonus is read off the RAW figure, which is
    // computed whether or not the roll landed.
    if (!hit.avoided) expect([110, 220]).toContain(Math.round(hit.raw));

    const tick = dealDamage(simulation, {
      source,
      target,
      abilityName: 'Rip',
      school: 'physical',
      baseAmount: 100,
      periodic: true,
      critFrom: 'melee-special',
      appliesArmor: false,
    });
    // Ticks crit, so `raw` is 110 or twice it -- and never the bare 100.
    expect([110, 220]).toContain(Math.round(tick.raw));

    // And the swing, which is the clause the owner's figure turned on.
    const swing = dealDamage(simulation, {
      source,
      target,
      abilityName: 'Main Hand',
      school: 'physical',
      baseAmount: 100,
      attackTable: 'melee-auto',
      appliesArmor: false,
    });
    if (!swing.avoided) expect(Math.round(swing.raw)).toBeGreaterThan(100);
  });

  it('tags exactly the three Druid bleeds, so a fourth is covered when it lands', () => {
    expect(RAKE_DOT.isBleed).toBe(true);
    expect(LACERATE.isBleed).toBe(true);
    expect(ripAura(5).isBleed).toBe(true);
    // And the Moonkin's arcane burn is not a bleed, whatever else it is.
    expect(MOONFIRE_DOT.isBleed).toBeUndefined();
    expect(INSECT_SWARM.isBleed).toBeUndefined();
  });

  it('is empty for a character without the talent', () => {
    expect(makeAttacker().bleedingTargetModifiers.isEmpty).toBe(true);
    expect(buildIn('druid_moonkin', 'moonkin').bleedingTargetModifiers.isEmpty).toBe(true);
    expect(buildIn('druid_cat', 'cat').bleedingTargetModifiers.isEmpty).toBe(false);
  });
});

/*
 * ----------------------------------------------------------------------------
 * KING OF THE JUNGLE AND TIGER'S FURY ARE BOTH GONE at client build
 * 1.60.1.70170, and SHIFTING POWER took their place in the tree.
 *
 * WHAT USED TO BE TESTED HERE: Tiger's Fury cast on an empty energy bar filled
 * it to sixty, and the talent's CAST REACTION named `tigers_fury` on the
 * reaction rather than checking for it in the body, "so nothing else runs it".
 * That second point is still a live rule -- `runCastReactions` skips a reaction
 * whose `abilityId` does not match -- and the Mage and the Rogue still rely on
 * it. The Warrior's new Gore Drinker is the first cast reaction here that CANNOT
 * use it, because it names four abilities rather than one.
 *
 * SHIFTING POWER NEEDS NO REACTION AT ALL, which is the structural change: the
 * energy is its own `onCast` rather than a talent's addition to somebody else's
 * ability. A talent that ADDS to an existing ability is a cast reaction; a
 * talent that GRANTS an ability is a grant.
 * ----------------------------------------------------------------------------
 */
describe('Shifting Power, which replaced Tiger\'s Fury and King of the Jungle', () => {
  it('converts mana into forty energy, and is the Cat build\'s own ability', () => {
    const cat = druid('druid_cat', 'cat');
    const target = makeTarget();
    const simulation = buildSimulation([cat, target]);
    simulation.begin();

    const energy = cat.resources.require('energy');
    energy.spend(energy.current);
    expect(energy.current).toBe(0);

    const mana = cat.resources.require('mana');
    const manaBefore = mana.current;

    const shifting = cat.abilities.get('shifting_power')!;
    castAbility(simulation, cat, shifting, target);

    // "Instantly convert 55% of base Mana into 40 Energy." 55% of a Druid's
    // 964 base mana is 530, written out rather than read off the constant.
    expect(energy.current).toBe(40);
    expect(manaBefore - mana.current).toBe(530);
  });

  it('is a plain granted ability with no cast reaction behind it', () => {
    const build = buildIn('druid_cat', 'cat');
    expect(build.grantedAbilities.has('shifting_power')).toBe(true);
    // The Druid now has no cast reactions at all; the empty table is kept
    // because a class missing from that registry fails in silence.
    expect(build.castReactions).toEqual([]);
  });

  it('halves its cooldown at 2/2 of Improved Shifting Power, which the Cat takes', () => {
    /*
     * SIXTEEN SECONDS FROM THE SPELLBOOK CAPTURE, eight off from the talent --
     * both written out by hand here rather than read from the constants. The
     * talent tooltip states no cooldown for the ability at all, so the base
     * figure has only one source.
     */
    expect(talentNumber('druid', 'improved_shifting_power', 2, 0)).toBe(8);
    const cat = druid('druid_cat', 'cat');
    expect(cat.abilities.get('shifting_power')!.cooldownMs).toBe(8_000);
  });
});

describe('Natural Reaction, on the one Druid profile that is hit back', () => {
  it('grants rage on a dodge, at the rank the talent states', () => {
    const bear = druid('druid_bear', 'bear');
    const enemy = makeTarget({ faction: 'hostile' });
    const simulation = buildSimulation([bear, enemy]);
    simulation.begin();

    const rage = bear.resources.require('rage');
    rage.spend(rage.current);

    // A dodged attack, forced rather than sampled: at rank 5 the chance is 100%.
    expect(talentNumber('druid', 'natural_reaction', 5, 1)).toBe(100);
    dealDamage(simulation, {
      source: enemy,
      target: bear,
      abilityName: 'Boss Swing',
      school: 'physical',
      baseAmount: 500,
      attackTable: 'melee-received',
    });

    // Whether that roll dodged is chance, so the reaction is driven directly:
    // what is under test is that the proc EXISTS and pays the stated amount.
    const build = buildIn('druid_bear', 'bear');
    const reaction = build.reactions.find((r) => r.id === 'natural_reaction');
    expect(reaction).toBeDefined();
    expect(reaction!.on).toBe('taken');
    expect(reaction!.outcomes).toEqual(['dodge']);

    const before = rage.current;
    reaction!.onTrigger(simulation, bear, {
      attacker: enemy,
      defender: bear,
      outcome: 'dodge',
      abilityId: undefined,
      abilityName: 'Boss Swing',
      amount: 0,
      weaponSlot: undefined,
      critical: false,
    });
    expect(rage.current - before).toBe(NATURAL_REACTION_RAGE);
  });

  it('is not registered for a Cat, which has no rage to earn', () => {
    // The dodge half still applies to every form; only the proc is feral-rage.
    const cat = buildIn('druid_cat', 'cat');
    expect(cat.reactions.map((r) => r.id)).not.toContain('natural_reaction');
  });
});

describe("Shredding Attacks' second clause", () => {
  it('takes 18 energy off Shred and 3 rage off Lacerate, not 18 off both', () => {
    /*
     * THE TRAP THIS CLAUSE WAS UNMODELLED TO AVOID: 18 rage off a 15-rage
     * Lacerate makes the ability FREE, which is a plausible-looking number and
     * a big one. `abilityCost` gained a `valueIndex` rather than a second
     * entry reading the first number.
     */
    expect([0, 1].map((i) => talentNumber('druid', 'shredding_attacks', 3, i))).toEqual([18, 3]);

    const reduction = buildIn('druid_cat', 'cat').abilityCostReduction;
    expect(reduction.get('shred')).toBe(18);
    expect(reduction.get('lacerate')).toBe(3);

    // And the built book carries the reduced figures, which is what a rotation
    // reads -- Ferocity takes Claw to 42 and Improved Shred takes Shred there too.
    const book = abilitiesForClass('druid', 'cat', PRESETS_BY_ID.get('druid_cat')!.build().talents);
    expect(book.find((a) => a.id === 'shred')!.cost!.amount).toBe(60 - 18);
    expect(book.find((a) => a.id === 'lacerate')!.cost!.amount).toBe(15 - 3);
  });
});

describe("Nature's Splendor, which lengthens a DoT rather than thickening it", () => {
  it('adds the stated seconds to Moonfire and Insect Swarm, and nothing else', () => {
    const [moonfire, rejuvenation, regrowth, insectSwarm] = [0, 1, 2, 3].map((i) =>
      talentNumber('druid', 'nature_s_splendor', 1, i),
    );
    // The sentence's own order. The two healing figures are carried so the two
    // that are read keep their indices.
    expect([moonfire, rejuvenation, regrowth, insectSwarm]).toEqual([3, 3, 6, 2]);

    const bonuses = buildIn('druid_moonkin', 'moonkin').abilityBonuses;
    expect(bonuses.get('moonfire')?.[AURA_DURATION_BONUS]).toBe(3);
    expect(bonuses.get('insect_swarm')?.[AURA_DURATION_BONUS]).toBe(2);
  });

  it('names the same bonus key the abilities read', () => {
    // A key only one side spells correctly is silently zero. Eclipse's is
    // pinned the same way, and for the same reason.
    const keys = Object.values(DRUID_TALENT_EFFECTS)
      .flat()
      .filter((effect) => effect.kind === 'abilityBonus')
      .map((effect) => (effect as { key: string }).key);
    expect(keys).toContain(AURA_DURATION_BONUS);
  });

  it('adds a TICK rather than spreading the same total thinner', () => {
    /*
     * Moonfire is 240 over 12 seconds at 3, so four ticks; at 15 seconds it is
     * five ticks of the same size. The other reading -- same total, longer --
     * would make the talent worth exactly nothing, and both are plausible.
     */
    const longer = lengthened(MOONFIRE_DOT, 3);
    expect(longer.durationMs).toBe(MOONFIRE_DOT_DURATION_MS + seconds(3));
    expect(longer.id).toBe(MOONFIRE_DOT.id);
    expect(lengthened(INSECT_SWARM, 2).durationMs).toBe(INSECT_SWARM_DURATION_MS + seconds(2));

    // A NEW definition, not a mutation: the constant is shared by every Druid
    // in a batch, and editing it would lengthen the next character's Moonfire.
    expect(MOONFIRE_DOT.durationMs).toBe(MOONFIRE_DOT_DURATION_MS);
    expect(lengthened(MOONFIRE_DOT, 0)).toBe(MOONFIRE_DOT);
  });

  it('lengthens the aura a Moonkin actually applies', () => {
    const moonkin = druid('druid_moonkin', 'moonkin');
    const target = makeTarget({ stats: { armor: 0 } });
    const simulation = buildSimulation([moonkin, target]);
    simulation.begin();

    const cast = (ability: typeof MOONFIRE) => {
      const own = moonkin.abilities.get(ability.id)!;
      castAbility(simulation, moonkin, own, target);
    };

    cast(MOONFIRE);
    cast(INSECT_SWARM_ABILITY);
    const now = simulation.clock.now();

    /*
     * A spell can MISS, so the assertion is "either absent or lengthened" --
     * never "the base duration", which is the outcome a broken bonus produces.
     */
    for (const [id, base, extra] of [
      ['moonfire', MOONFIRE_DOT_DURATION_MS, seconds(3)],
      ['insect_swarm', INSECT_SWARM_DURATION_MS, seconds(2)],
    ] as const) {
      const remaining = target.auras.remainingMs(id, now);
      if (remaining > 0) expect(remaining, id).toBeGreaterThan(base);
      if (remaining > 0) expect(remaining, id).toBeLessThanOrEqual(base + extra);
    }
  });
});

describe('Berserk is a talent, and was in every Druid book', () => {
  it('reaches a feral build and no other', () => {
    /*
     * IT SAT IN THE BASE ABILITY LIST, so the Moonkin carried it: its own audit
     * line read "in book, never cast: ... berserk", which is exactly what an
     * ability nobody should have looks like. The capture's "Learned at level 40"
     * is what misled it -- and Insect Swarm, Swiftmend, Feral Charge, Moonkin
     * Form and Nature's Swiftness all carry the same line and are all talents.
     */
    const bookFor = (preset: string, style: 'cat' | 'bear' | 'moonkin') =>
      abilitiesForClass('druid', style, PRESETS_BY_ID.get(preset)!.build().talents).map((a) => a.id);

    expect(bookFor('druid_cat', 'cat')).toContain('berserk');
    expect(bookFor('druid_bear', 'bear')).toContain('berserk');
    expect(bookFor('druid_moonkin', 'moonkin')).not.toContain('berserk');
    // And an untalented Druid has neither talent-granted ability.
    expect(abilitiesForClass('druid', 'cat', {}).map((a) => a.id)).not.toContain('berserk');
  });

  it('keeps its two unreachable clauses on the ability, where they are printed', () => {
    expect(DRUID_TALENT_EFFECTS.berserk).toEqual([
      { kind: 'grantAbility', abilityId: 'berserk' },
    ]);
  });
});

describe("Nature's Swiftness, the second caller of the one-shot cast rule", () => {
  it('is granted by the talent and taken by no Druid profile', () => {
    expect(DRUID_TALENT_EFFECTS.nature_s_swiftness).toEqual([
      { kind: 'grantAbility', abilityId: 'natures_swiftness' },
    ]);
    for (const [preset, style] of [
      ['druid_cat', 'cat'],
      ['druid_bear', 'bear'],
      ['druid_moonkin', 'moonkin'],
    ] as const) {
      const book = abilitiesForClass(
        'druid',
        style,
        PRESETS_BY_ID.get(preset)!.build().talents,
      ).map((a) => a.id);
      expect(book, preset).not.toContain('natures_swiftness');
    }
    /*
     * So it is tested on its MECHANISM, below, and on nothing else. The
     * allocation is PADDED, because `createPlayer` strips a talent whose tier
     * gate is not met -- silently -- and an unpadded point would read as a
     * talent that grants nothing. See `tests/helpers/legalise` for the Warrior
     * version of the same trap.
     */
    expect(abilitiesForClass('druid', 'moonkin', RESTO_20).map((a) => a.id)).toContain(
      'natures_swiftness',
    );
  });

  it('makes the next Nature spell instant', () => {
    const moonkin = druid('druid_moonkin', 'moonkin');
    const target = makeTarget();
    const simulation = buildSimulation([moonkin, target]);
    simulation.begin();

    const wrath = moonkin.abilities.get('wrath')!;
    expect(resolveCast(moonkin, wrath).baseCastTimeMs).toBeGreaterThan(0);

    simulation.applyAura(moonkin, NATURES_SWIFTNESS, moonkin.id);
    expect(resolveCast(moonkin, wrath).baseCastTimeMs).toBe(0);
    expect(resolveCast(moonkin, wrath).modified).toBe(true);
  });

  it('names Nature spells only, so Starfire and Moonfire are untouched', () => {
    // Both are ARCANE. Reaching them would shorten the Moonkin's main nuke,
    // which is a much bigger talent than this one.
    expect(NATURE_SPELLS).toEqual(['wrath', 'insect_swarm']);
    expect(WRATH.id).toBe('wrath');
    const moonkin = druid('druid_moonkin', 'moonkin');
    const simulation = buildSimulation([moonkin, makeTarget()]);
    simulation.begin();
    const starfire = moonkin.abilities.get('starfire')!;
    const before = resolveCast(moonkin, starfire).baseCastTimeMs;
    simulation.applyAura(moonkin, NATURES_SWIFTNESS, moonkin.id);
    /*
     * THE CAST TIME AND NOT `modified`. A Moonkin already carries Moonglow's
     * cost modifier on Starfire, so `modified` is true whatever this aura does
     * -- asserting it would pass with the talent reaching every spell.
     */
    expect(resolveCast(moonkin, starfire).baseCastTimeMs).toBe(before);
    expect(before).toBeGreaterThan(0);
  });

  it('is spent by a CAST and not by an instant', () => {
    /*
     * `requiresCastTime`. Without it the charge is eaten by the next Insect
     * Swarm, which is instant already -- an aura spent for nothing, which looks
     * exactly like one that worked.
     *
     * NO ROTATION ON THIS ACTOR, deliberately. A preset Moonkin acts on its own
     * during `advanceTo`, so it would spend the charge on whatever its list
     * reached and the test would pass or fail for a reason it is not about.
     */
    const caster = makeAttacker({
      autoAttack: 'none',
      abilities: [WRATH, INSECT_SWARM_ABILITY, NATURES_SWIFTNESS_ABILITY],
      resources: [{ type: 'mana', maximum: 10_000, initial: 10_000 }],
      stats: { hitChance: 100 },
    });
    const target = makeTarget({ stats: { armor: 0 } });
    const simulation = buildSimulation([caster, target]);
    simulation.begin();

    simulation.applyAura(caster, NATURES_SWIFTNESS, caster.id);
    const first = castAbility(simulation, caster, INSECT_SWARM_ABILITY, target);
    expect(first.ok, JSON.stringify(first)).toBe(true);
    expect(caster.auras.has('natures_swiftness')).toBe(true);

    // PAST THE GLOBAL COOLDOWN the instant just started, or the second cast is
    // refused and the aura survives for the wrong reason.
    simulation.advanceTo(simulation.clock.now() + seconds(2));
    const second = castAbility(simulation, caster, WRATH, target);
    expect(second.ok, JSON.stringify(second)).toBe(true);
    expect(caster.auras.has('natures_swiftness')).toBe(false);
  });

  it('applies the aura when the ability is used', () => {
    const caster = makeAttacker({
      autoAttack: 'none',
      abilities: [NATURES_SWIFTNESS_ABILITY],
    });
    const simulation = buildSimulation([caster, makeTarget()]);
    simulation.begin();
    expect(NATURES_SWIFTNESS_ABILITY.cost).toBeUndefined();
    expect(NATURES_SWIFTNESS_ABILITY.cooldownMs).toBe(seconds(180));
    const cast = castAbility(simulation, caster, NATURES_SWIFTNESS_ABILITY, undefined);
    expect(cast.ok, JSON.stringify(cast)).toBe(true);
    expect(caster.auras.has('natures_swiftness')).toBe(true);
  });
});

describe('Moonkin Aura and Leader of the Pack are ONE aura, by ruling', () => {
  /*
   * --------------------------------------------------------------------------
   * THE RULESET OWNER: "These are all the same exclusive 3% global critical
   * strike chance and do not stack." Three sources -- the Moonkin Form talent,
   * the Leader of the Pack talent, and either of the two raid buff entries --
   * and ONE `AuraDefinition` with one id, so `AuraCollection.apply` refreshes
   * rather than stacking and any combination is worth 3%.
   *
   * IT WAS TWO AURAS AND IT DOUBLE-DIPPED. Each talent used to share an id with
   * the raid buff OF THE SAME NAME, which closed two of the three combinations
   * and left the third open: a Moonkin carrying its own `moonkin_form` aura in a
   * raid that selected `leader_of_the_pack` held two ids and read +6% crit --
   * 24.243% spell crit against 21.243%. The older ruling was "handle it on the
   * GUI", and `withRaidBuff` does switch one off when the other goes on; but
   * that governs two raid buff entries and knows nothing about a TALENT, nor
   * about a profile loaded from JSON with both ids already in its list.
   * --------------------------------------------------------------------------
   */
  it('is one definition that every source applies', () => {
    expect(PARTY_CRIT_AURA.id).toBe(PARTY_CRIT_AURA_ID);
    expect(PARTY_CRIT_AURA_PERCENT).toBe(3);
    // The talent registry resolves the one id, and the old two are gone.
    expect(TALENT_AURAS[PARTY_CRIT_AURA_ID]).toBe(PARTY_CRIT_AURA);
    expect(TALENT_AURAS.leader_of_the_pack).toBeUndefined();
    expect(TALENT_AURAS.moonkin_form).toBeUndefined();
    // And both RAID BUFF entries hand over that same definition.
    for (const id of ['leader_of_the_pack', 'moonkin_form']) {
      expect(RAID_BUFFS_BY_ID.get(id)?.aura, id).toBe(PARTY_CRIT_AURA);
    }
  });

  it('is 3% however many times it is applied', () => {
    const cat = druid('druid_cat', 'cat');
    const simulation = buildSimulation([cat, makeTarget()]);
    const before = cat.stats.get('critChance');
    // The talent's, plus both raid buffs' -- three applications, one aura.
    simulation.applyAura(cat, PARTY_CRIT_AURA, cat.id);
    simulation.applyAura(cat, PARTY_CRIT_AURA, cat.id);
    simulation.applyAura(cat, PARTY_CRIT_AURA, cat.id);
    expect(cat.stats.get('critChance') - before).toBeCloseTo(PARTY_CRIT_AURA_PERCENT, 6);
    expect(cat.auras.active.filter((aura) => aura.id === PARTY_CRIT_AURA_ID)).toHaveLength(1);
  });

  it('is 3% on a Moonkin whose raid runs the OTHER half, which used to be 6%', () => {
    /*
     * THE COMBINATION THAT WAS BROKEN, measured end to end through the real
     * encounter rather than by applying auras by hand -- the talent arrives from
     * `createPlayer` and the raid buff from `trainingDummyEncounter`, and the
     * bug was precisely that those two paths produced different ids.
     */
    const base = PRESETS_BY_ID.get('druid_moonkin')!.build();
    const critWith = (raidBuffs: readonly string[]) => {
      const simulation = new Simulation(
        trainingDummyEncounter({ ...base, raidBuffs: [...raidBuffs] }),
      );
      simulation.begin();
      const player = simulation.combatants.find((actor) => actor.kind === 'player')!;
      return player.stats.get('spellCritChance');
    };

    const own = critWith(['moonkin_form']);
    expect(critWith([])).toBeCloseTo(own, 6);
    expect(critWith(['leader_of_the_pack'])).toBeCloseTo(own, 6);
    expect(critWith(['leader_of_the_pack', 'moonkin_form'])).toBeCloseTo(own, 6);
  });

  it('selects Moonkin Aura by default on the Moonkin, and on nobody else', () => {
    // The owner's instruction: it is the half of the pair this profile brings.
    const built = PRESETS_BY_ID.get('druid_moonkin')!.build();
    expect(built.raidBuffs).toContain('moonkin_form');
    expect(built.raidBuffs).not.toContain('leader_of_the_pack');
    expect(buildIn('druid_moonkin', 'moonkin').grantedAuras.has(PARTY_CRIT_AURA_ID)).toBe(true);
  });

  it('gives Moonkin Form its 360% of item armor', () => {
    expect(talentNumber('druid', 'moonkin_form', 1, 0)).toBe(360);
    const built = PRESETS_BY_ID.get('druid_moonkin')!.build();
    const talented = druid('druid_moonkin', 'moonkin');
    const bare = untalented('druid_moonkin', 'moonkin');
    /*
     * 360% OF THE ITEM CONTRIBUTION, ADDED ON TOP -- not 460% of the total.
     * That distinction is the whole reason `itemArmorPercent` exists rather
     * than a percentage modifier on `armor`: the character's armor is items
     * PLUS the class base, and scaling the total would overstate the talent.
     * The Moonkin spends no other point on armor, so this is the difference.
     */
    const fromItems = armorFromItems(built.equipment, 'moonkin');
    expect(fromItems).toBeGreaterThan(0);
    expect(talented.stats.get('armor') - bare.stats.get('armor')).toBeCloseTo(
      fromItems * 3.6,
      6,
    );
  });
});

describe('Feral Swiftness grants four dodge, not thirty', () => {
  /*
   * --------------------------------------------------------------------------
   * The index evidence is in `talentValueIndex.test.ts` beside the other four.
   * This is what the built characters carry, which is the half that matters to
   * a fight: both feral presets take it at rank 2, so both were carrying +30
   * dodge instead of +4 for as long as the talent has existed.
   *
   * FIXING IT MAKES THE BEAR TAKE MORE DAMAGE, and rage is a share of the
   * PRE-ARMOR damage taken, so its DPS goes UP while it dies more often:
   * measured 514.4 -> 524.8 with deaths 8.6 -> 13.9. The Cat is never
   * attacked, so for the Cat this is worth exactly nothing -- the ordinary
   * case for a defensive talent and not a reason to doubt the fix.
   * --------------------------------------------------------------------------
   */
  const FERAL_SWIFTNESS_DODGE = 4;

  it('contributes four dodge to the Cat, whose only dodge talent it is', () => {
    expect(PRESETS_BY_ID.get('druid_cat')!.build().talents.feral_swiftness).toBe(2);
    expect(PRESETS_BY_ID.get('druid_cat')!.build().talents.natural_reaction).toBeUndefined();

    expect(buildIn('druid_cat', 'cat').stats.dodgeChance).toBeCloseTo(
      FERAL_SWIFTNESS_DODGE,
      6,
    );
    expect(
      druid('druid_cat', 'cat').stats.get('dodgeChance') -
        untalented('druid_cat', 'cat').stats.get('dodgeChance'),
    ).toBeCloseTo(FERAL_SWIFTNESS_DODGE, 6);
  });

  it('contributes four to the Bear, on top of Natural Reaction', () => {
    /*
     * THE BEAR HAS A SECOND DODGE TALENT, so the total is asserted as the SUM
     * of two stated numbers rather than by removing one of them -- removing a
     * talent to price it can strip a deeper one silently, and Natural Reaction
     * is five points this build spends on purpose.
     */
    const built = PRESETS_BY_ID.get('druid_bear')!.build();
    expect(built.talents.feral_swiftness).toBe(2);
    expect(built.talents.natural_reaction).toBe(5);

    const naturalReaction = talentNumber('druid', 'natural_reaction', 5, 0)!;
    expect(buildIn('druid_bear', 'bear').stats.dodgeChance).toBeCloseTo(
      FERAL_SWIFTNESS_DODGE + naturalReaction,
      6,
    );
  });
});

describe('Thick Hide is armor per level and per excess defense point', () => {
  /*
   * --------------------------------------------------------------------------
   * "While in Bear Form, Cat Form, Dire Bear Form, or Moonkin Form, you gain
   * {0} additional base Armor per level and another {1} base Armor for each
   * point of defense skill beyond five times your level."
   *
   * IT WAS `itemArmorPercent`, which computes `itemArmor x value / 100` --
   * exactly right for Toughness, whose text says "your Armor value FROM
   * ITEMS", and an expression of NEITHER clause here. At rank 3 it paid 3% of
   * the Bear's 1793 item armor, about 54.
   *
   * NOT THE WRONG INDEX BUT THE WRONG RULE, which is why the sweep that found
   * the four value-index bugs did not find this: both indices were ignored
   * equally, so no index was readable as the wrong one.
   *
   * AND IT IS WORTH ALMOST NOTHING TO THE BEAR'S DAMAGE. The prediction before
   * it was measured was "more armor means less damage taken means less rage,
   * so the DPS falls", and **ARMOR DOES NOT REDUCE RAGE** -- the rage from a
   * blow is taken off the PRE-ARMOR figure, which `resourceRules.ts` says in
   * those words. 220 armor is -2.6% damage taken, 751 rage against 750, and
   * -1.7 DPS inside a +/-5 interval. Asserted as armor arriving, which is the
   * mechanism, rather than as a damage figure it does not move.
   * --------------------------------------------------------------------------
   */
  it('gives the Bear 3 armor a level and 2 an excess defense point', () => {
    const perLevel = talentNumber('druid', 'thick_hide', 3, 0)!;
    const perDefense = talentNumber('druid', 'thick_hide', 3, 1)!;
    expect(perLevel).toBe(3);
    expect(perDefense).toBe(2);
    expect(PRESETS_BY_ID.get('druid_bear')!.build().talents.thick_hide).toBe(3);

    const bear = druid('druid_bear', 'bear');

    /*
     * THE STAT HOLDS THE SURPLUS AND THAT IS WHAT THE CLAUSE ASKS FOR. Every
     * character has five defense skill a level for free; `defenseSkill` carries
     * only what gear and talents added, which is exactly "beyond five times
     * your level". `Combatant.defenseSkill` adds the baseline back, so reading
     * that one instead would pay for all 300 points -- 600 armor too much.
     */
    const surplus = bear.stats.get('defenseSkill');
    expect(surplus).toBeGreaterThan(0);
    expect(bear.defenseSkill).toBe(MAX_CHARACTER_LEVEL * 5 + surplus);

    const expected = perLevel * MAX_CHARACTER_LEVEL + perDefense * surplus;
    expect(expected).toBe(274);

    /*
     * ASSERTED WHERE EACH CLAUSE LANDS, not only on the total: the level clause
     * resolves to a flat stat at build time and the defense clause is a
     * CONVERSION folded into the derivation, so a total alone could be right
     * with one of the two in the wrong place.
     */
    const build = buildIn('druid_bear', 'bear');
    expect(build.stats.armor).toBeCloseTo(perLevel * MAX_CHARACTER_LEVEL, 6);
    expect(build.statConversions).toContainEqual({
      from: 'defenseSkill',
      to: 'armor',
      fraction: perDefense,
    });

    expect(
      bear.stats.get('armor') - untalented('druid_bear', 'bear').stats.get('armor'),
    ).toBeCloseTo(expected, 6);
  });

  it('is not the 3% of item armor it used to be', () => {
    /*
     * THE OLD BEHAVIOUR WRITTEN OUT, because 54 and 274 are both plausible
     * armor figures and a reader needs to see that the old one was WRONG
     * rather than merely small. A fifth of the correct value.
     */
    const built = PRESETS_BY_ID.get('druid_bear')!.build();
    const asItemPercent = (armorFromItems(built.equipment, 'bear') * 3) / 100;
    expect(asItemPercent).toBeGreaterThan(40);
    expect(asItemPercent).toBeLessThan(60);
  });

  it('FOLLOWS a buffed defense skill, which a build-time number would not', () => {
    /*
     * ------------------------------------------------------------------------
     * WHY THE DEFENSE CLAUSE GOES THROUGH THE DERIVATION. `StatBlock` resolves
     * in two passes so a derived stat sees fully-buffed sources; a flat amount
     * computed once at build time would freeze at the unbuffed figure while
     * reading as entirely plausible, which is the mistake `statFromStat`
     * exists to prevent and says so in its own comment.
     *
     * Nothing in Forever buffs defense skill mid-fight today, so this asserts
     * a mechanism rather than an observed number. The Warrior's and the
     * Paladin's Anticipation grant it from a TALENT, though, so the hazard is
     * one content change away rather than hypothetical.
     * ------------------------------------------------------------------------
     */
    const bear = druid('druid_bear', 'bear');
    const before = bear.stats.get('armor');
    bear.stats.addModifier({ ...flat('defenseSkill', 10), sourceId: 'probe' });
    expect(bear.stats.get('armor') - before).toBeCloseTo(
      talentNumber('druid', 'thick_hide', 3, 1)! * 10,
      6,
    );
  });

  it('applies in the four forms the text names and in no other', () => {
    /*
     * Bear, Cat, Dire Bear and Moonkin. Dire Bear is not a separate style
     * here, so `bear` covers both -- and `caster` is the one form a Druid can
     * be in that gets nothing, which is what makes the gate worth asserting.
     */
    for (const effect of DRUID_TALENT_EFFECTS.thick_hide) {
      expect('requires' in effect && effect.requires).toEqual({
        styles: ['bear', 'cat', 'moonkin'],
      });
    }

    const built = PRESETS_BY_ID.get('druid_bear')!.build();
    const inCaster = talentBuild(
      'druid',
      built.talents,
      talentContextFor(built.equipment, 'caster', weaponsFor(built.equipment, 'caster'), {
        characterClass: 'druid',
        talents: built.talents,
        level: MAX_CHARACTER_LEVEL,
      }),
    );
    expect(inCaster.statConversions).not.toContainEqual(
      expect.objectContaining({ from: 'defenseSkill' }),
    );
    expect(inCaster.stats.armor ?? 0).toBe(0);

    // And it SAYS it is inert there, rather than being silently dropped.
    expect(inCaster.unmodelled.some((u) => u.talentId === 'thick_hide')).toBe(true);
  });
});

describe('what is left, and it is two talents', () => {
  it('counts two live gaps and names them', () => {
    /*
     * Derived from the DATA, the same way `class_audit.ts` does it: a reason
     * with no `scope` is a gap, and one with a scope is the owner's decision.
     * Twelve before this work and TWO after, both on the same engine gap --
     * mid-fight form shifting.
     *
     * IT WAS THREE WHEN THIS DIVE WROTE IT. Spell pushback was the third, and
     * the Shaman dive's `castPushback` ruling absorbed it between the two
     * branches: a scope added for one class reclassifies every class that
     * shares the reason. `class_audit.ts` derives the same 2 independently.
     */
    const live = Object.entries(DRUID_TALENT_EFFECTS)
      .filter(([, effects]) => {
        const working = effects.some((e) => e.kind !== 'unmodelled');
        const gap = effects.some((e) => e.kind === 'unmodelled' && e.scope === undefined);
        return !working && gap;
      })
      .map(([id]) => id)
      .sort();
    expect(live).toEqual(['furor', 'natural_shapeshifter']);
  });

  it('declares an effect for all 52 and reaches every aura it names', () => {
    // 52 since client build 1.60.1.70170: King of the Jungle out, Shifting
    // Power and Improved Shifting Power in.
    expect(Object.keys(DRUID_TALENT_EFFECTS)).toHaveLength(52);
    /*
     * A granted aura with no entry in `TALENT_AURAS` is DROPPED rather than
     * throwing, which is right for a typo and wrong to leave untested -- the
     * talent would report itself modelled and do nothing.
     */
    for (const [id, effects] of Object.entries(DRUID_TALENT_EFFECTS)) {
      for (const effect of effects) {
        if (effect.kind !== 'grantAura') continue;
        expect(TALENT_AURAS[effect.auraId], id).toBeDefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Swipe, and the Cat's new opener
// ---------------------------------------------------------------------------

describe("Swipe's attack power coefficient is 3%, not the sheet's 10%", () => {
  /*
   * ----------------------------------------------------------------------------
   * "Fixed a bug causing Swipe to not scale with Attack Power. It will now
   * correctly gain 3% of the Druid's attack power", from the 1.60.1.70170 notes.
   *
   * `WoWSimWorksheet.xlsx` SAYS 10% AND THE NOTES ARE LATER, which is the rule
   * Rake's tick already runs on: a later statement from the owner outranks the
   * sheet. The sheet records what the figure was meant to be before the fix
   * landed; three is what Forever has shipped.
   *
   * WORTH NOTHING TO EVERY PROFILE and still worth fixing. Swipe is in no
   * priority list -- it is a three-target rage ability and every encounter here
   * has one target -- so this moves no figure in the baseline table. What changes
   * is what the number MEANS the day a multi-target encounter exists.
   * ----------------------------------------------------------------------------
   */
  it('is three percent, and Rake\'s two halves are untouched beside it', () => {
    expect(SWIPE_AP_COEFFICIENT).toBe(0.03);
    // The neighbouring owner-over-sheet correction, so the two cannot be
    // confused for one change.
    expect(RAKE_AP_COEFFICIENT).toBe(0.01);
    expect(RAKE_TICK_AP_COEFFICIENT).toBe(0.055);
  });

  it('scales a real cast by attack power at that rate', () => {
    /*
     * MEASURED FROM DAMAGE THAT LANDED rather than read off the constant, because
     * `powerCoefficient` is passed per `dealDamage` call -- a coefficient written
     * in the wrong place is silent, which is why `coefficient_probe.ts` exists.
     *
     * Two bears, identical but for attack power, with the table forced to a plain
     * hit so the comparison is not a crit against a glance.
     */
    const damageAt = (attackPower: number) => {
      const bear = createPlayer({
        race: 'tauren',
        characterClass: 'druid',
        combatStyle: 'bear',
      });
      bear.stats.addModifier({ sourceId: 'test', stat: 'attackPower', operation: 'flat', value: attackPower });
      const target = makeTarget({ maxHealth: 10_000_000 });
      let dealt = 0;
      const simulation = buildSimulation([bear, target], { seed: 4242 }, {
        emit: (event) => {
          if (event.type === 'damage' && event.abilityId === 'swipe') dealt += event.amount;
        },
      });
      simulation.begin();
      bear.resources.require('rage').gain(100);
      castAbility(simulation, bear, bear.abilities.get('swipe')!, target);
      return dealt;
    };

    /*
     * EXACTLY THIRTY: a thousand attack power at 3%, with the same seed on both
     * sides so the damage roll cancels and `makeTarget` carrying no armor so
     * nothing scales it afterwards. At the sheet's 10% this would read 100, which
     * is why the figure is asserted rather than a direction.
     */
    const low = damageAt(0);
    const high = damageAt(1000);
    expect(high).toBeGreaterThan(low);
    expect(high - low).toBeCloseTo(1000 * SWIPE_AP_COEFFICIENT, 6);
  });
});

describe('the Cat list opens with Shifting Power rather than Tiger\'s Fury', () => {
  it('is first, and gated on an energy bar with room for the 40 it grants', () => {
    /*
     * ----------------------------------------------------------------------
     * THE OWNER'S CONDITION, GIVEN AFTER THE FIRST INSTRUCTION. It was "on
     * cooldown as long as you have the mana to cast it", which this test
     * asserted as UNCONDITIONAL -- and the mana half of that is still not a
     * condition, because `checkCast` refuses what the character cannot afford
     * and a clause would be the list restating an engine rule.
     *
     * WHAT WAS MISSING WAS THE OTHER RESOURCE: "only uses Shifting Power if
     * current energy is <= 50". The ability GRANTS 40 energy against a cap of
     * 100, so a cast on a high bar throws part of the grant away -- ungated it
     * wastes 40.0 energy a fight, 12.5% of everything it grants, and the gate is
     * worth +13.2 DPS.
     * ----------------------------------------------------------------------
     */
    expect(DRUID_CAT.entries[0].abilityId).toBe('shifting_power');
    expect(DRUID_CAT.entries[0].condition).toBeDefined();
    expect(DRUID_CAT.entries.map((entry) => entry.abilityId)).not.toContain('tigers_fury');
  });

  it('refuses the cast above fifty energy and allows it at or below', () => {
    /*
     * DRIVEN ON BOTH SIDES OF THE BOUNDARY AND ON THE BOUNDARY ITSELF, because
     * the owner stated `<= 50` and an off-by-one here is a condition that looks
     * right: at 51 the cast wastes nothing visible, and at 50 exactly it is the
     * difference between the gate firing and not.
     *
     * A resource level is not a probability, so this is scripted rather than
     * sampled -- the same reason a combat table boundary uses a scripted roll.
     */
    const cat = druid('druid_cat', 'cat');
    const target = makeTarget();
    const simulation = buildSimulation([cat, target]);
    simulation.begin();

    const entry = DRUID_CAT.entries[0];
    const energy = cat.resources.require('energy');

    for (const [current, expected] of [
      [100, false],
      [51, false],
      [50, true],
      [49, true],
      [0, true],
    ] as const) {
      energy.set(current);
      expect(compiled(entry.condition)!(simulation, cat, target), `at ${current} energy`).toBe(
        expected,
      );
    }
  });

  it('grants exactly the forty the gate leaves room for', () => {
    /*
     * THE THREE FIGURES THAT DECIDE WHETHER THE GATE WASTES ANYTHING, asserted
     * together because nothing else makes them agree: a change to the grant or
     * the cap would start wasting energy under an unchanged gate, silently.
     *
     * AND THE GATE IS THE OWNER'S FIGURE RATHER THAN THIS ARITHMETIC'S. 40 into
     * a cap of 100 overflows above **60**, so `<= 50` is ten energy inside the
     * no-waste region and not on its edge -- which is why this asserts the
     * boundary is SAFE rather than asserting it is tight. Deriving the gate from
     * the grant would quietly move the owner's 50 to 60.
     */
    expect(SHIFTING_POWER_ENERGY).toBe(40);
    const cat = druid('druid_cat', 'cat');
    expect(cat.resources.require('energy').maximum).toBe(100);
    expect(SHIFTING_POWER_ENERGY_CEILING + SHIFTING_POWER_ENERGY).toBeLessThanOrEqual(
      cat.resources.require('energy').maximum,
    );
  });

  it('is not a floor under the list, because it has a cooldown', () => {
    /*
     * An unconditional entry at the top blocks everything below it ONLY when it
     * is always castable. Sixteen seconds -- eight with Improved Shifting Power,
     * which the Cat build takes 2/2 of -- so the list falls straight past it the
     * rest of the time. That is the half of the rule the Hunter's Sniper Shot
     * measurement settled.
     */
    const cat = druid('druid_cat', 'cat');
    expect(cat.abilities.get('shifting_power')!.cooldownMs).toBeGreaterThan(0);
  });

  it('fires in a real fight, and the list still reaches its finisher', () => {
    /*
     * THE CHECK THAT THE NEW TOP ENTRY DID NOT STARVE THE LIST. An entry that
     * never fires is a row that is not there, and an entry that fires too often
     * is a list whose lower half is unreachable -- neither shows in a DPS figure.
     */
    let shifting = 0;
    let rips = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const simulation = new Simulation(
        trainingDummyEncounter({ ...PRESETS_BY_ID.get('druid_cat')!.build() }, seed * 7919),
        {
          emit: (event) => {
            if (event.type !== 'cast') return;
            if (event.abilityId === 'shifting_power') shifting += 1;
            if (event.abilityId === 'rip') rips += 1;
          },
        },
      );
      simulation.begin();
      simulation.run();
    }
    expect(shifting / 20).toBeGreaterThan(1);
    expect(rips / 20).toBeGreaterThan(2);
  }, 20_000);
});
