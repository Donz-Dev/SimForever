import { describe, expect, it } from 'vitest';
import { AbilityModifiers, dealDamage, seconds } from '../../src/engine';
import { EXECUTE_PHASE_FRACTION, inExecutePhase } from '../../src/game/combat/executePhase';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { PRIEST_TALENT_EFFECTS } from '../../src/game/talents/priestEffects';
import { ROGUE_TALENT_EFFECTS } from '../../src/game/talents/rogueEffects';
import { talentNumber } from '../../src/game/talents/talentValues';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ============================================================================
 * A PER-ABILITY MODIFIER CONDITIONAL ON THE FIGHT CLOCK.
 *
 * Two callers and they are in different classes: the Priest's Early Demise
 * ("+30% critical strike chance on targets at or below 20% health") and the
 * Rogue's Quietus ("+10% damage against targets below 35% health"). Neither is
 * a statement about the target. This project rules a low-health threshold to
 * be the last fraction of the PLANNED duration -- the ruling made for Execute
 * and deliberately shared -- and three entries had explained a silence as "the
 * target never drops" before this was built.
 *
 * NEITHER TALENT IS TAKEN BY ANY PROFILE, so nothing here can be tested by a
 * DPS delta and nothing here should move one. What is asserted is the
 * MECHANISM: the modifier is registered, it is absent before the window and
 * present inside it, and it is the talent's own threshold that decides where
 * the window starts.
 * ============================================================================
 */

describe('the shared ruling', () => {
  it('reads the last fifth of the fight for Execute', () => {
    expect(EXECUTE_PHASE_FRACTION).toBe(0.2);
  });

  /*
   * THE FRACTION IS AN ARGUMENT NOW, because 0.2 is Execute's number and not
   * the ruling's. Quietus is 35% by the ruleset owner's own word.
   */
  it('takes a fraction, so 20% is a default rather than the rule', () => {
    const simulation = buildSimulation([], { durationMs: seconds(100) });
    const at = (ms: number) => ({ ...simulation, clock: { now: () => ms } }) as never;

    expect(inExecutePhase(at(seconds(50)))).toBe(false);
    expect(inExecutePhase(at(seconds(50)), 0.35)).toBe(false);
    expect(inExecutePhase(at(seconds(70)))).toBe(false);
    expect(inExecutePhase(at(seconds(70)), 0.35)).toBe(true);
    expect(inExecutePhase(at(seconds(85)))).toBe(true);
  });
});

/*
 * ----------------------------------------------------------------------------
 * THE REGISTRY, ON ITS OWN. `remainingFraction` is what the reader is handed,
 * because a combatant holds no clock.
 * ----------------------------------------------------------------------------
 */
describe('AbilityModifiers.addWhileFinalFraction', () => {
  const withEarlyDemise = () => {
    const modifiers = new AbilityModifiers();
    modifiers.addWhileFinalFraction(0.2, 'shadow_word_death', { critBonus: 30 });
    return modifiers;
  };

  it('is nothing at the pull', () => {
    expect(withEarlyDemise().forWhileFinalFraction('shadow_word_death', 1)).toBeUndefined();
  });

  it('is nothing one instant before the window opens', () => {
    expect(withEarlyDemise().forWhileFinalFraction('shadow_word_death', 0.2001)).toBeUndefined();
  });

  it('applies exactly AT the threshold, which is what "or below" means', () => {
    expect(withEarlyDemise().forWhileFinalFraction('shadow_word_death', 0.2)?.critBonus).toBe(30);
  });

  /*
   * A FIGHT CAN RUN PAST ITS PLANNED END -- `plannedDurationMs` is a plan, not
   * a stop -- so the fraction goes negative and the window must stay open. It
   * is not clamped, which is how that stays visible.
   */
  it('stays open past the planned end of the fight', () => {
    expect(withEarlyDemise().forWhileFinalFraction('shadow_word_death', -0.1)?.critBonus).toBe(30);
  });

  it('does not reach another ability', () => {
    expect(withEarlyDemise().forWhileFinalFraction('mind_blast', 0.1)).toBeUndefined();
  });

  /*
   * TWO WINDOWS ON ONE CHARACTER, keyed apart. Nothing takes both today; the
   * registry is keyed by fraction so that neither talent ever has to know the
   * other's number.
   */
  it('keeps two different windows apart', () => {
    const modifiers = new AbilityModifiers();
    modifiers.addWhileFinalFraction(0.2, 'a', { critBonus: 30 });
    modifiers.addWhileFinalFraction(0.35, 'a', { damageMultiplier: 1.1 });

    expect(modifiers.forWhileFinalFraction('a', 0.3)?.critBonus ?? 0).toBe(0);
    expect(modifiers.forWhileFinalFraction('a', 0.3)?.damageMultiplier).toBeCloseTo(1.1);
    expect(modifiers.forWhileFinalFraction('a', 0.1)?.critBonus).toBe(30);
    expect(modifiers.forWhileFinalFraction('a', 0.1)?.damageMultiplier).toBeCloseTo(1.1);
  });

  /*
   * THE THROW IS THE POINT. A reader with no clock and a character carrying
   * one of these is a mistake, and the alternative -- treating it as "not in
   * the window" -- is a talent that is declared, reports itself modelled and
   * contributes nothing.
   */
  it('throws rather than silently dropping the modifier', () => {
    expect(() => withEarlyDemise().forWhileFinalFraction('shadow_word_death', undefined)).toThrow(
      /without being given one/,
    );
  });

  it('costs nothing for a character with none registered', () => {
    const empty = new AbilityModifiers();
    expect(empty.forWhileFinalFraction('anything', undefined)).toBeUndefined();
    expect(empty.isEmpty).toBe(true);
  });
});

/*
 * ----------------------------------------------------------------------------
 * AND THROUGH THE TALENTS, whose own data supplies both numbers.
 * ----------------------------------------------------------------------------
 */
describe('Early Demise', () => {
  it('is no longer unmodelled', () => {
    expect(PRIEST_TALENT_EFFECTS.early_demise.some((e) => e.kind === 'unmodelled')).toBe(false);
  });

  /*
   * Written out by hand from the tooltip: "Increases Shadow Word: Death's
   * critical strike chance on targets at or below 20% health by 15%/30%." Then
   * checked against the capture, which is the second of the two independent
   * checks a captured number gets here.
   */
  it('states the threshold and the bonus in the same row', () => {
    expect(talentNumber('priest', 'early_demise', 1, 0)).toBe(20);
    expect(talentNumber('priest', 'early_demise', 1, 1)).toBe(15);
    expect(talentNumber('priest', 'early_demise', 2, 0)).toBe(20);
    expect(talentNumber('priest', 'early_demise', 2, 1)).toBe(30);
  });

  it('registers 30% crit on Shadow Word: Death inside the last fifth', () => {
    const build = talentBuild('priest', { early_demise: 2 });
    expect(build.abilityModifiers.forWhileFinalFraction('shadow_word_death', 0.1)?.critBonus).toBe(
      30,
    );
    expect(build.abilityModifiers.forWhileFinalFraction('shadow_word_death', 0.9)).toBeUndefined();
  });

  it('is worth half as much at one rank', () => {
    const build = talentBuild('priest', { early_demise: 1 });
    expect(build.abilityModifiers.forWhileFinalFraction('shadow_word_death', 0)?.critBonus).toBe(15);
  });

  /*
   * ITS 20 AND EXECUTE'S 0.2 AGREE TODAY AND ARE DIFFERENT FACTS. The talent
   * reads its own row rather than importing the constant, so if Forever moves
   * either one this fails instead of the two silently going on agreeing.
   */
  it('happens to open at the same moment Execute does', () => {
    expect(talentNumber('priest', 'early_demise', 2, 0)! / 100).toBe(EXECUTE_PHASE_FRACTION);
  });
});

describe('Quietus', () => {
  it('is no longer unmodelled', () => {
    expect(ROGUE_TALENT_EFFECTS.quietus.some((e) => e.kind === 'unmodelled')).toBe(false);
  });

  it('names all three of its abilities', () => {
    const build = talentBuild('rogue', { quietus: 5 });
    for (const id of ['sinister_strike', 'ghostly_strike', 'hemorrhage']) {
      expect(build.abilityModifiers.forWhileFinalFraction(id, 0.1)?.damageMultiplier).toBeCloseTo(
        1.1,
      );
    }
  });

  /*
   * THE OWNER SAID 35% AND THE CAPTURE SAYS 35, which is corroboration rather
   * than one of them being transcribed from the other -- so the effect reads
   * the data and this pins that the two still agree.
   */
  it('opens at the 35% the owner ruled, which its own data also states', () => {
    expect(talentNumber('rogue', 'quietus', 5, 1)).toBe(35);

    const build = talentBuild('rogue', { quietus: 5 });
    expect(build.abilityModifiers.forWhileFinalFraction('hemorrhage', 0.36)).toBeUndefined();
    expect(build.abilityModifiers.forWhileFinalFraction('hemorrhage', 0.35)).toBeDefined();
  });

  it('leaves an ability the tooltip does not name alone', () => {
    const build = talentBuild('rogue', { quietus: 5 });
    expect(build.abilityModifiers.forWhileFinalFraction('eviscerate', 0)).toBeUndefined();
  });
});

/*
 * ----------------------------------------------------------------------------
 * AND THAT THE CLOCK ACTUALLY REACHES THE DAMAGE PIPELINE, which is the half
 * the registry cannot show: `Combatant.abilityModifierFor` is handed the
 * fraction by `dealDamage`, and both the crit read and the damage read must
 * come through it or a talent applies in one half and not the other.
 * ----------------------------------------------------------------------------
 */
describe('through dealDamage', () => {
  const FIGHT_MS = seconds(100);

  const damageAt = (now: number, withTalent: boolean): number => {
    const caster = makeAttacker();
    if (withTalent) {
      caster.abilityModifiers.addWhileFinalFraction(0.35, 'hemorrhage', { damageMultiplier: 1.1 });
    }
    const target = makeTarget();
    const simulation = buildSimulation([caster, target], {
      durationMs: FIGHT_MS,
      // No variance, so `plannedDurationMs` is the hundred seconds the
      // fractions below are worked out against.
      durationVariance: 0,
    });
    simulation.clock.advanceTo(now);
    return dealDamage(simulation, {
      source: caster,
      target,
      abilityId: 'hemorrhage',
      abilityName: 'Hemorrhage',
      school: 'physical',
      baseAmount: 1000,
      appliesArmor: false,
    }).amount;
  };

  it('pays nothing before the window and 10% inside it', () => {
    const plain = damageAt(seconds(10), false);
    expect(damageAt(seconds(10), true)).toBeCloseTo(plain);
    expect(damageAt(seconds(70), true)).toBeCloseTo(plain * 1.1);
  });
});
