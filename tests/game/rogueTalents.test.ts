import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { talentNumber } from '../../src/game/talents/talentValues';
import { ROGUE_TALENT_EFFECTS } from '../../src/game/talents/rogueEffects';
import { hackAndSlash, puncturingWounds } from '../../src/game/reactions/rogueTalents';
import {
  HEMORRHAGE_DEBUFF,
  HEMORRHAGE_RUPTURE_BONUS,
  MUTILATE_POISONED_BONUS,
  THOUSAND_CUTS_BONUS,
  THOUSAND_CUTS_MAX_STACKS,
  deadlyPoisonAura,
  ruptureAura,
  thousandCutsAura,
} from '../../src/game/auras/rogue';
import { HEMORRHAGE, RUPTURE } from '../../src/game/abilities/rogue';
import {
  EXECUTE_PHASE_FRACTION,
  QUIETUS_HEALTH_FRACTION,
} from '../../src/game/combat/executePhase';
import {
  COMBAT_CONSTANTS,
  createForeverAttackChances,
} from '../../src/game/combat/attackChances';
import { armorReduction, resolveCast, seconds, toRollUnits } from '../../src/engine';
import type { AttackEvent, WeaponProfile } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { comboPointsOn } from '../../src/game/combat/comboPoints';
import { legalise } from '../helpers/legalTalents';

/*
 * ==============================================================================
 * THE NINE ROGUE TALENTS THAT CAME OFF THE GAP LIST, tested on their MECHANISM.
 *
 * Every expectation below is written out by hand from the talent's own Forever
 * tooltip rather than read back out of the code, and the tooltips are quoted
 * beside each block. A test that derived its number from the file under test
 * would pass whatever that file said.
 *
 * AND NOT ONE OF THEM ASSERTS A DPS DELTA, which is the standing rule here: a
 * correct talent can be worth nothing, and a talent that moves a profile can be
 * moving it for the wrong reason. What each change was worth is recorded in
 * docs/handoff/rogue.md, measured 30 batches of 10 at a time.
 * ==============================================================================
 */

/** A Rogue holding one named weapon type, for the clauses that gate on it. */
const holding = (weaponType: WeaponProfile['weaponType']) =>
  ({
    mainHand: {
      name: `Test ${weaponType}`,
      baseDamage: 100,
      swingTimerMs: 2000,
      weaponType,
      skill: 300,
    } as WeaponProfile,
  });

/*
 * A Rogue holding a LEGAL allocation.
 *
 * `createPlayer` strips a talent whose tier gate or prerequisite is unmet, and
 * strips it SILENTLY -- so Quietus and Thousand Cuts, which sit deep in
 * Subtlety, are simply absent from a character asked for them on their own,
 * and a test would read that as "the talent is worth nothing". `legalise` pads
 * the tree until the gate opens, which is also a build a player could have.
 */
const rogueWith = (talents: Record<string, number>) =>
  createPlayer({
    race: 'orc',
    characterClass: 'rogue',
    talents: legalise(talents, 'rogue'),
  });

// ---------------------------------------------------------------------------
// Lethality
// ---------------------------------------------------------------------------

/*
 * "Increases the critical strike damage bonus of your Sinister Strike, Gouge,
 * Backstab, Mutilate, Ghostly Strike, and Hemorrhage abilities by 20%." 5 ranks,
 * 4/8/12/16/20.
 */
describe('Lethality raises crit DAMAGE for a list of named abilities', () => {
  it('states 20% at five points', () => {
    expect(talentNumber('rogue', 'lethality', 5)).toBe(20);
    expect(talentNumber('rogue', 'lethality', 2)).toBe(8);
  });

  it('adds the BONUS half, so a x2 melee crit becomes x2.2 and never x2.4', () => {
    const build = talentBuild('rogue', { malice: 5, lethality: 5 });
    /*
     * 20% OF THE BONUS, and the bonus of a x2 crit is 1.0 -- so +0.2, giving
     * 2.2. Reading it as "multiply the whole thing by 1.2" gives 2.4 and
     * overstates every crit the build lands; both numbers are plausible, which
     * is why this is written out rather than derived.
     */
    expect(COMBAT_CONSTANTS.meleeCritMultiplier).toBe(2);
    expect(build.abilityModifiers.for('backstab').critMultiplierBonus).toBeCloseTo(0.2, 10);
  });

  it('reaches every ability it names and nothing it does not', () => {
    const rogue = createPlayer({
      race: 'orc',
      characterClass: 'rogue',
      talents: { malice: 5, lethality: 5 },
    });
    for (const id of [
      'sinister_strike',
      'backstab',
      'mutilate',
      'ghostly_strike',
      'hemorrhage',
    ]) {
      expect(rogue.abilityModifierFor(id).critMultiplierBonus).toBeCloseTo(0.2, 10);
    }
    // Eviscerate is a finisher and is not on the talent's list.
    expect(rogue.abilityModifierFor('eviscerate').critMultiplierBonus ?? 0).toBe(0);
    // An auto attack carries no ability id and is never selected.
    expect(rogue.abilityModifierFor(undefined).critMultiplierBonus ?? 0).toBe(0);
  });

  it('scales with rank rather than being on or off', () => {
    const two = talentBuild('rogue', { malice: 5, lethality: 2 });
    expect(two.abilityModifiers.for('backstab').critMultiplierBonus).toBeCloseTo(0.08, 10);
  });

  it('leaves Gouge out and says so, because Gouge is ruled out of scope', () => {
    const gouge = ROGUE_TALENT_EFFECTS.lethality.find((e) => e.kind === 'unmodelled');
    expect(gouge && gouge.kind === 'unmodelled' && gouge.scope).toBe('crowdControl');
  });
});

// ---------------------------------------------------------------------------
// Puncturing Wounds
// ---------------------------------------------------------------------------

/*
 * "Increases the critical strike chance of your Backstab by 30% and your
 * Mutilate by 15%, and gives Backstab a 45% chance to add an additional Combo
 * Point." 3 ranks: [10,5,15] / [20,10,30] / [30,15,45].
 */
describe('Puncturing Wounds, all three of its clauses', () => {
  it('reads a DIFFERENT number for each of its two abilities', () => {
    const build = talentBuild('rogue', { malice: 5, puncturing_wounds: 3 });
    expect(build.abilityModifiers.for('backstab').critBonus).toBe(30);
    expect(build.abilityModifiers.for('mutilate').critBonus).toBe(15);
  });

  it('does not give Mutilate the Backstab figure, which is what it used to do', () => {
    const build = talentBuild('rogue', { malice: 5, puncturing_wounds: 3 });
    expect(build.abilityModifiers.for('mutilate').critBonus).not.toBe(30);
  });

  it('grants the combo point proc at the talent’s THIRD value', () => {
    const ids = talentBuild('rogue', { malice: 5, puncturing_wounds: 3 }).reactions.map(
      (r) => r.id,
    );
    expect(ids).toContain('puncturing_wounds');
    expect(talentNumber('rogue', 'puncturing_wounds', 3, 2)).toBe(45);
  });

  it('awards the point ON THE TARGET, so a finisher can still spend it', () => {
    const rogue = makeAttacker({ resources: [{ type: 'comboPoints', maximum: 5, initial: 0 }] });
    const target = makeTarget();
    const simulation = buildSimulation([rogue, target]);
    const attack: AttackEvent = {
      attacker: rogue,
      defender: target,
      outcome: 'hit',
      abilityId: 'backstab',
      abilityName: 'Backstab',
      amount: 100,
      weaponSlot: undefined,
      critical: false,
    };

    // A certain proc, so the test is about the award and not about the roll.
    const reaction = puncturingWounds(100);
    expect(reaction.canTrigger!(simulation, rogue, attack)).toBe(true);
    reaction.onTrigger(simulation, rogue, attack);

    /*
     * `comboPointsOn` returns zero for points banked against a DIFFERENT
     * target, which is exactly the failure a point written straight into the
     * pool produces -- the finisher then refuses to spend and reads as an
     * ability that lost its flat damage.
     */
    expect(comboPointsOn(rogue, target)).toBe(1);
  });

  it('does not fire off another ability', () => {
    const rogue = makeAttacker();
    const target = makeTarget();
    const simulation = buildSimulation([rogue, target]);
    const sinister: AttackEvent = {
      attacker: rogue,
      defender: target,
      outcome: 'hit',
      abilityId: 'sinister_strike',
      abilityName: 'Sinister Strike',
      amount: 100,
      weaponSlot: undefined,
      critical: false,
    };
    expect(puncturingWounds(100).canTrigger!(simulation, rogue, sinister)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Hack and Slash
// ---------------------------------------------------------------------------

/*
 * "Axe/Sword: your successful melee attacks have a 5% chance to trigger an
 * extra attack. Dagger/Fist: increases your critical strike chance by 5%.
 * Mace: your attacks ignore 15% of your target's armor." 5 ranks, and the
 * fifth is [5,5,15].
 */
describe('Hack and Slash pays out three different ways by weapon', () => {
  it('states the three values at five points', () => {
    expect(talentNumber('rogue', 'hack_and_slash', 5, 0)).toBe(5);
    expect(talentNumber('rogue', 'hack_and_slash', 5, 1)).toBe(5);
    expect(talentNumber('rogue', 'hack_and_slash', 5, 2)).toBe(15);
  });

  it('gives a DAGGER the crit and neither of the other two', () => {
    const build = talentBuild('rogue', { hack_and_slash: 5 }, holding('dagger'));
    expect(build.stats.critChance).toBe(5);
    expect(build.stats.armorPenetration ?? 0).toBe(0);
  });

  it('gives a MACE the armor penetration and neither of the other two', () => {
    const build = talentBuild('rogue', { hack_and_slash: 5 }, holding('mace'));
    expect(build.stats.armorPenetration).toBe(15);
    expect(build.stats.critChance ?? 0).toBe(0);
  });

  it('gives a SWORD neither, and reports both clauses as unmet', () => {
    const build = talentBuild('rogue', { hack_and_slash: 5 }, holding('sword'));
    expect(build.stats.critChance ?? 0).toBe(0);
    expect(build.stats.armorPenetration ?? 0).toBe(0);
    const unmet = build.unmodelled.filter((entry) => entry.talentId === 'hack_and_slash');
    expect(unmet).toHaveLength(2);
    for (const entry of unmet) expect(entry.reason).toMatch(/particular weapon/i);
  });

  it('procs its extra attack off the weapon that SWUNG, not the main hand', () => {
    /*
     * A Rogue with a dagger in the main hand and a sword in the off hand still
     * gets the extra attack from the SWORD, and gets none from the dagger.
     * Reading `mainHand` instead -- which the effect's own `requires` gate
     * does, correctly, for the two stat clauses -- would get this exactly
     * backwards.
     */
    const rogue = makeAttacker({
      weapons: {
        mainHand: { name: 'Dagger', baseDamage: 100, swingTimerMs: 2000, weaponType: 'dagger', skill: 300 },
        offHand: { name: 'Sword', baseDamage: 80, swingTimerMs: 1800, weaponType: 'sword', skill: 300 },
      },
    });
    const target = makeTarget();
    const simulation = buildSimulation([rogue, target]);
    const swing = (weaponSlot: 'mainHand' | 'offHand'): AttackEvent => ({
      attacker: rogue,
      defender: target,
      outcome: 'hit',
      abilityId: undefined,
      abilityName: 'Auto Attack',
      amount: 100,
      weaponSlot,
      critical: false,
    });

    const reaction = hackAndSlash(100);
    expect(reaction.canTrigger!(simulation, rogue, swing('offHand'))).toBe(true);
    expect(reaction.canTrigger!(simulation, rogue, swing('mainHand'))).toBe(false);
  });

  it('does not proc off something that is not a weapon use', () => {
    const rogue = makeAttacker({
      weapons: {
        mainHand: { name: 'Sword', baseDamage: 100, swingTimerMs: 2000, weaponType: 'sword', skill: 300 },
      },
    });
    const target = makeTarget();
    const simulation = buildSimulation([rogue, target]);
    // A poison hit carries no `weaponSlot`, which is the whole of `isWeaponUse`.
    const poison: AttackEvent = {
      attacker: rogue,
      defender: target,
      outcome: 'hit',
      abilityId: 'instant_poison',
      abilityName: 'Instant Poison',
      amount: 90,
      weaponSlot: undefined,
      critical: false,
    };
    expect(hackAndSlash(100).canTrigger!(simulation, rogue, poison)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Weapon Expertise
// ---------------------------------------------------------------------------

/*
 * "Reduces the chance for your attacks to be Dodged or Parried by 2%." 2 ranks,
 * 1/2.
 */
describe('Weapon Expertise takes the DEFENDER’s dodge and parry down', () => {
  it('states two percentage points at two ranks', () => {
    expect(talentNumber('rogue', 'weapon_expertise', 2)).toBe(2);
  });

  it('is its own stat rather than hit, which comes off a different slice', () => {
    const build = talentBuild('rogue', { weapon_expertise: 2 });
    expect(build.stats.dodgeParryReduction).toBe(2);
    expect(build.stats.hitChance ?? 0).toBe(0);
  });

  it('lowers dodge on the melee tables by exactly two points', () => {
    const chances = createForeverAttackChances();
    const plain = makeAttacker({ weapons: { mainHand: { name: 'Blade', baseDamage: 100, swingTimerMs: 2000, skill: 300 } } });
    const expert = makeAttacker({
      id: 'expert',
      stats: { attackPower: 100, dodgeParryReduction: 2 },
      weapons: { mainHand: { name: 'Blade', baseDamage: 100, swingTimerMs: 2000, skill: 300 } },
    });
    const target = makeTarget({ level: 63 });

    for (const table of ['melee-auto', 'melee-special'] as const) {
      const before = chances(table, plain, target, { slot: 'mainHand' });
      const after = chances(table, expert, target, { slot: 'mainHand' });
      expect(before.dodge - after.dodge).toBe(toRollUnits(2));
    }
  });

  it('leaves the RANGED and SPELL tables alone, which have no dodge at all', () => {
    const chances = createForeverAttackChances();
    const expert = makeAttacker({ stats: { dodgeParryReduction: 2 } });
    const target = makeTarget({ level: 63 });
    expect(chances('ranged-special', expert, target, {}).dodge).toBe(0);
    expect(chances('spell', expert, target, {}).dodge).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Armor penetration, and Serrated Blades
// ---------------------------------------------------------------------------

/*
 * "Causes your attacks to ignore 9% of your target's Armor and increases the
 * damage dealt by your Rupture ability by 30%." 3 ranks: [3,10]/[6,20]/[9,30].
 */
describe('Serrated Blades, both clauses', () => {
  it('states nine percent of armor and thirty percent of Rupture at 3/3', () => {
    expect(talentNumber('rogue', 'serrated_blades', 3, 0)).toBe(9);
    expect(talentNumber('rogue', 'serrated_blades', 3, 1)).toBe(30);
  });

  it('grants both, from the two value slots', () => {
    const build = talentBuild('rogue', { serrated_blades: 3 });
    expect(build.stats.armorPenetration).toBe(9);
    expect(build.abilityModifiers.for('rupture').damageMultiplier).toBeCloseTo(1.3, 10);
  });

  it('reaches a Rupture TICK, which carries the aura’s id', () => {
    // The tick's `abilityId` is the aura's, so the multiplier keyed to
    // `rupture` covers the bleed and not only the cast.
    expect(ruptureAura(5).id).toBe('rupture');
  });

  /*
   * 9% OF THE ARMOR, NOT 9% OF THE REDUCTION, and the two differ by a factor of
   * five. Written out here from the documented raid-boss figure rather than
   * read back out of the pipeline.
   *
 *   armor constant at 63     = 400 + 85 x 63 = 5755
 *   3731 / (5755 + 3731)     = 39.33% removed
 *   3731 x 0.91 = 3394.21
 *   3394.21 / (5755 + 3394.21) = 37.10% removed
   *
   * So nine points of penetration is worth 2.23 points of damage. The other
   * reading -- nine percent off the 39.33 -- gives 35.79% and makes the talent
   * worth 3.54, over half as much again, which is the sort of number nothing
   * downstream would question.
   *
   * THIS TEST ALREADY EARNED ITS PLACE: the first version of these comments
   * asserted 37.63% and "worth 1.7 points", both of which were plausible and
   * neither of which was computed. The figures below are, and three comments
   * carrying the invented pair were corrected from them.
   */
  it('shrinks the ARMOR and not the mitigation', () => {
    const BOSS_ARMOR = 3731;
    const CONSTANT_AT_63 = 400 + 85 * 63;
    const full = armorReduction(BOSS_ARMOR, 63);
    const penetrated = armorReduction(BOSS_ARMOR * 0.91, 63);

    // Written out from the formula rather than read back out of the pipeline.
    expect(full).toBeCloseTo(BOSS_ARMOR / (CONSTANT_AT_63 + BOSS_ARMOR), 10);
    expect(full).toBeCloseTo(0.3933, 4);
    expect(penetrated).toBeCloseTo(0.3711, 4);
    // Worth a couple of points, and emphatically not nine.
    expect((full - penetrated) * 100).toBeCloseTo(2.23, 2);
  });
});

// ---------------------------------------------------------------------------
// Thousand Cuts
// ---------------------------------------------------------------------------

/*
 * "When your Rupture ability deals periodic damage, the Energy cost of your
 * next Hemorrhage or Backstab ability within 10 sec is reduced by 3, stacking
 * up to 5 times." One rank.
 */
describe('Thousand Cuts, applied by a Rupture tick', () => {
  it('has a hand-filled value, because a single-rank talent has none', () => {
    expect(talentNumber('rogue', 'thousand_cuts', 1)).toBe(3);
  });

  it('travels to the bleed as a named bonus on Rupture', () => {
    const rogue = rogueWith({ thousand_cuts: 1 });
    expect(rogue.abilities.get('rupture')?.bonuses?.[THOUSAND_CUTS_BONUS]).toBe(3);
    // And a Rogue without the talent carries nothing, so the tick applies none.
    const plain = createPlayer({ race: 'orc', characterClass: 'rogue' });
    expect(plain.abilities.get('rupture')?.bonuses?.[THOUSAND_CUTS_BONUS] ?? 0).toBe(0);
  });

  it('is a FLAT reduction on two named abilities, stacking to five', () => {
    const aura = thousandCutsAura(3);
    expect(aura.maxStacks).toBe(THOUSAND_CUTS_MAX_STACKS);
    expect(aura.maxStacks).toBe(5);
    expect(aura.durationMs).toBe(seconds(10));
    expect(aura.castModifier?.abilityIds).toEqual(['hemorrhage', 'backstab']);
    expect(aura.castModifier?.costReduction).toBe(3);
    expect(aura.castModifier?.scalesWithStacks).toBe(true);
    // A fraction would be wrong for energy: three is three at any cost.
    expect(aura.castModifier?.costFraction).toBeUndefined();
  });

  it('is spent by ONE cast however many stacks it holds', () => {
    /*
     * "Your NEXT Hemorrhage or Backstab" is one cast that every stack paid
     * for. Spending a single stack would leave four behind and make the talent
     * worth several times what it is -- a bigger number and no error.
     */
    expect(thousandCutsAura(3).castModifier?.consumedByCast).toBe('all');
  });

  it('takes 3 an application off Hemorrhage’s 35 energy', () => {
    const rogue = makeAttacker();
    const simulation = buildSimulation([rogue, makeTarget()]);
    expect(HEMORRHAGE.cost?.amount).toBe(35);

    simulation.applyAura(rogue, thousandCutsAura(3), rogue.id);
    expect(resolveCast(rogue, HEMORRHAGE).costAmount).toBe(32);

    for (let i = 0; i < 4; i += 1) simulation.applyAura(rogue, thousandCutsAura(3), rogue.id);
    expect(rogue.auras.stacksOf('thousand_cuts')).toBe(5);
    expect(resolveCast(rogue, HEMORRHAGE).costAmount).toBe(20);
  });

  it('does not make any other ability cheaper', () => {
    const rogue = makeAttacker();
    const simulation = buildSimulation([rogue, makeTarget()]);
    simulation.applyAura(rogue, thousandCutsAura(3), rogue.id);
    expect(resolveCast(rogue, RUPTURE).costAmount).toBe(RUPTURE.cost!.amount);
  });
});

// ---------------------------------------------------------------------------
// Quietus, and the clock
// ---------------------------------------------------------------------------

/*
 * "Your Sinister Strike, Ghostly Strike, and Hemorrhage abilities cause 10%
 * more damage against targets below 35% health." 5 ranks, 2/4/6/8/10, and the
 * owner has ruled the 35% is 35% of the FIGHT.
 */
describe('Quietus is a clock, not a health bar', () => {
  it('keeps its own fraction rather than borrowing the execute one', () => {
    expect(QUIETUS_HEALTH_FRACTION).toBe(0.35);
    expect(EXECUTE_PHASE_FRACTION).toBe(0.2);
    expect(QUIETUS_HEALTH_FRACTION).not.toBe(EXECUTE_PHASE_FRACTION);
    // The values file states the same 35 beside the percentage at every rank.
    expect(talentNumber('rogue', 'quietus', 5, 1)).toBe(35);
    expect(talentNumber('rogue', 'quietus', 5, 0)).toBe(10);
  });

  it('is worth nothing before the window and +10% inside it', () => {
    const rogue = rogueWith({ quietus: 5 });
    /*

     * THE REMAINING FRACTION, which is the shape main's `abilityModifierFor`

     * takes. This dive passed a `{ plannedDurationMs, clock }` object and main

     * computes the fraction in `Combatant` instead -- same clock, one number.

     */

    const clock = (nowMs: number) => (seconds(100) - nowMs) / seconds(100);

    // 64 seconds in, 36% of the fight is left: outside the window.
    expect(
      rogue.abilityModifierFor('hemorrhage', clock(seconds(64))).damageMultiplier ?? 1,
    ).toBeCloseTo(1, 10);
    // 66 seconds in, 34% is left: inside it.
    expect(
      rogue.abilityModifierFor('hemorrhage', clock(seconds(66))).damageMultiplier ?? 1,
    ).toBeCloseTo(1.1, 10);
  });

  it('reaches only the three abilities it names', () => {
    const rogue = rogueWith({ quietus: 5 });
    const early = 1.0;
    const late = 0.1;
    for (const id of ['sinister_strike', 'ghostly_strike', 'hemorrhage']) {
      expect(rogue.abilityModifierFor(id, late).damageMultiplier).toBeCloseTo(1.1, 10);
    }
    /*
     * BACKSTAB IS COMPARED EARLY AGAINST LATE rather than against 1, because
     * the filler `legalise` spends to open the Subtlety tier includes
     * Opportunity, which is a real +10% on Backstab all fight. Asserting a
     * flat 1 would fail on a talent that is working correctly -- so the claim
     * under test is the one that is actually Quietus': that the window does
     * not change it.
     */
    const backstabEarly = rogue.abilityModifierFor('backstab', early).damageMultiplier ?? 1;
    const backstabLate = rogue.abilityModifierFor('backstab', late).damageMultiplier ?? 1;
    expect(backstabLate).toBeCloseTo(backstabEarly, 10);
  });

  /*
   * THE SILENT CASE, MADE ASSERTABLE. A caller with no clock cannot evaluate a
   * clock condition and gets nothing -- which is correct, and is exactly the
   * shape of failure this project keeps meeting, so it is asked about rather
   * than hoped about. `dealDamage` passes the clock on both legs of the
   * pipeline; only a test calling `resolveDamage` directly omits it.
   */
  it('THROWS when a caller cannot evaluate its condition', () => {
    /*
     * ------------------------------------------------------------------------
     * THIS DIVE MADE IT A PREDICATE AND MAIN MAKES IT A THROW, which is the
     * stronger of the two and is what the merged project keeps: a caller that
     * forgets to pass the clock finds out at the call rather than by asking.
     * The hazard is the same either way -- a character carrying a modifier
     * conditional on the fight clock, asked for its modifiers without one, must
     * not silently answer "nothing".
     *
     * A CHARACTER WITHOUT ANY SUCH MODIFIER IS STILL FINE WITHOUT A CLOCK,
     * which is the second half and the reason the check cannot just be
     * mandatory: almost every character in the project has none.
     * ------------------------------------------------------------------------
     */
    const rogue = rogueWith({ quietus: 5 });
    expect(() => rogue.abilityModifierFor('hemorrhage')).toThrow(/fight clock/i);
    expect(() => rogue.abilityModifierFor('hemorrhage', 1)).not.toThrow();

    const plain = createPlayer({ race: 'orc', characterClass: 'rogue' });
    expect(() => plain.abilityModifierFor('hemorrhage')).not.toThrow();
  });

  it('is taken by no Rogue profile, so it moves none of the three figures', () => {
    for (const id of ['rogue_venom', 'rogue_combat', 'rogue_rupture']) {
      const built = PRESETS_BY_ID.get(id)!.build();
      expect(built.talents?.quietus ?? 0).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Murder
// ---------------------------------------------------------------------------

describe('Murder applies on the owner’s ruling about the target', () => {
  it('is +4% to ALL damage, auto attacks included', () => {
    expect(talentNumber('rogue', 'murder', 2)).toBe(4);
    const build = talentBuild('rogue', { murder: 2 });
    expect(build.damageMultiplier).toBeCloseTo(1.04, 10);
  });

  it('keeps the assumption visible rather than silently met', () => {
    const stated = ROGUE_TALENT_EFFECTS.murder.find((e) => e.kind === 'unmodelled');
    expect(stated && stated.kind === 'unmodelled' && stated.reason).toMatch(
      /Humanoid or a Giant/,
    );
    // A ruling, not a scope: the encounter could change and this would too.
    expect(stated && stated.kind === 'unmodelled' && stated.scope).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Mutilate against a poisoned target
// ---------------------------------------------------------------------------

describe('Mutilate’s "+20% against Poisoned targets"', () => {
  it('rides on the poison DEBUFF, which is what makes a target poisoned', () => {
    expect(MUTILATE_POISONED_BONUS).toBe(0.2);
    expect(deadlyPoisonAura().attackerAbilityModifiers?.mutilate?.damageMultiplier).toBeCloseTo(1.2, 10);
  });

  it('is read off the TARGET and only for Mutilate', () => {
    const target = makeTarget();
    const simulation = buildSimulation([makeAttacker(), target]);
    expect((target.abilityModifierAgainst('mutilate').damageMultiplier ?? 1)).toBe(1);

    simulation.applyAura(target, deadlyPoisonAura(), 'attacker');
    expect((target.abilityModifierAgainst('mutilate').damageMultiplier ?? 1)).toBeCloseTo(1.2, 10);
    expect((target.abilityModifierAgainst('backstab').damageMultiplier ?? 1)).toBe(1);
    // An auto attack carries no ability id and is never selected.
    expect((target.abilityModifierAgainst(undefined).damageMultiplier ?? 1)).toBe(1);
  });

  it('is flat across stacks: a poisoned target is poisoned', () => {
    const target = makeTarget();
    const simulation = buildSimulation([makeAttacker(), target]);
    for (let i = 0; i < 5; i += 1) simulation.applyAura(target, deadlyPoisonAura(), 'attacker');
    expect(target.auras.stacksOf('deadly_poison')).toBe(5);
    expect((target.abilityModifierAgainst('mutilate').damageMultiplier ?? 1)).toBeCloseTo(1.2, 10);
  });
});

// ---------------------------------------------------------------------------
// Hemorrhage's Rupture clause
// ---------------------------------------------------------------------------

describe('Hemorrhage makes Rupture hit harder, and nothing else', () => {
  it('is +15% on the target, keyed to the one ability', () => {
    expect(HEMORRHAGE_RUPTURE_BONUS).toBe(15);
    expect(HEMORRHAGE_DEBUFF.attackerAbilityModifiers?.rupture?.damageMultiplier).toBeCloseTo(1.15, 10);
  });

  it('is NOT a school multiplier, which would raise every swing too', () => {
    const target = makeTarget();
    const simulation = buildSimulation([makeAttacker(), target]);
    simulation.applyAura(target, HEMORRHAGE_DEBUFF, 'attacker');

    expect((target.abilityModifierAgainst('rupture').damageMultiplier ?? 1)).toBeCloseTo(1.15, 10);
    // Rupture is PHYSICAL, so a school-wide reading would catch all of these.
    expect(target.damageTakenMultiplierFor('physical')).toBe(1);
    expect((target.abilityModifierAgainst('backstab').damageMultiplier ?? 1)).toBe(1);
    expect((target.abilityModifierAgainst(undefined).damageMultiplier ?? 1)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The reasons that expired
// ---------------------------------------------------------------------------

/*
 * A REASON MATCHED BY WORDING IS A TEST, which is the idiom
 * `grantCastModifier.test.ts` established: a family of claims expires together
 * and is then findable by the sentence rather than by the ids.
 */
describe('the claims these changes retired', () => {
  it('leaves Rupture and Hemorrhage declaring nothing unmodelled', () => {
    /*
     * BOTH WERE PRINTED ON THE RESULTS PAGE WHILE BEING FALSE. Rupture said its
     * attack power coefficient did not apply, and it had applied since the
     * owner's sheet arrived; Hemorrhage said its Rupture clause had no form,
     * and it has one now.
     */
    expect(RUPTURE.unmodelled).toBeUndefined();
    expect(HEMORRHAGE.unmodelled).toBeUndefined();
  });

  it('has no Rogue talent still claiming armor penetration cannot be expressed', () => {
    const stale = Object.entries(ROGUE_TALENT_EFFECTS)
      .flatMap(([id, effects]) =>
        effects
          .filter((effect) => effect.kind === 'unmodelled')
          .map((effect) => [id, (effect as { reason: string }).reason] as const),
      )
      .filter(([, reason]) => /ignores? a percentage of the target|damage pipeline cannot express|no form in the damage/i.test(reason));
    expect(stale).toEqual([]);
  });

  it('has no Rogue talent still claiming an attacker cannot lower dodge or parry', () => {
    const stale = Object.entries(ROGUE_TALENT_EFFECTS)
      .flatMap(([id, effects]) =>
        effects
          .filter((effect) => effect.kind === 'unmodelled')
          .map((effect) => [id, (effect as { reason: string }).reason] as const),
      )
      .filter(([, reason]) => /nothing lets an attacker lower them/i.test(reason));
    expect(stale).toEqual([]);
  });

  it('marks the two poison talents as applied elsewhere, and names a real module', () => {
    /*
     * THEY WORK IN FULL AND EVERY CENSUS CALLED THEM LIVE GAPS, because their
     * effect arrives from `poisonReactions` rather than from the effect table
     * and `class_audit` counts effects. `appliedElsewhere` is the fix, and it
     * names the module so the claim can be checked rather than believed.
     */
    for (const id of ['vile_poisons', 'improved_poisons']) {
      const entry = ROGUE_TALENT_EFFECTS[id].find((e) => e.kind === 'unmodelled');
      expect(entry && entry.kind === 'unmodelled' && entry.appliedElsewhere).toBe(
        'game/reactions/poisons.ts',
      );
    }
  });

  it('reaches a person, so the panel can stop calling them unsimulated', () => {
    // The Venom build spends eleven of its fifty-one points on poisons.
    const build = talentBuild('rogue', PRESETS_BY_ID.get('rogue_venom')!.build().talents);
    const elsewhere = build.unmodelled.filter((entry) => entry.appliedElsewhere !== undefined);
    expect(elsewhere.map((entry) => entry.talentId).sort()).toEqual([
      'improved_poisons',
      'vile_poisons',
    ]);
    // And they are NOT in the list a person is told is unsimulated.
    const gaps = build.unmodelled.filter(
      (entry) => entry.scope === undefined && entry.appliedElsewhere === undefined,
    );
    expect(gaps.map((entry) => entry.talentId)).not.toContain('vile_poisons');
  });
});
