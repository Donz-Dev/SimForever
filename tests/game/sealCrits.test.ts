import { describe, expect, it } from 'vitest';
import type { AttackEvent, Combatant } from '../../src/engine';
import { COMBAT_CONSTANTS } from '../../src/game/combat/attackChances';
import {
  SEAL_OF_COMMAND,
  SEAL_OF_FURY,
  SEAL_OF_RIGHTEOUSNESS,
  echoAura,
} from '../../src/game/auras/paladin';
import {
  echoProc,
  sealOfCommandProc,
  sealOfFuryProc,
  sealOfRighteousnessProc,
} from '../../src/game/reactions/paladin';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * A SEAL CRITS, AND IT CRITS LIKE A SWING RATHER THAN LIKE A SPELL.
 *
 * The ruleset owner's ruling, covering Seal of Righteousness, Seal of Fury and
 * Seal of Command. One field -- `critFrom` -- and two numbers that could each
 * have gone the other way:
 *
 *   WHICH CHANCE       the Paladin's MELEE crit, not its spell crit, even
 *                      though every seal deals HOLY damage. A Paladin's two
 *                      crit stats differ, so this is observable.
 *   WHICH MULTIPLIER   2x, which follows the TABLE. A spell crit here is 1.5x,
 *                      and reading the school instead of the ruling would make
 *                      every seal crit worth half of what it should be -- a
 *                      smaller number, a plausible one, and no error.
 *
 * TESTED ON THE MECHANISM AND NOT ON A DPS DELTA. The multiplier is pinned by
 * the SET of amounts a seal deals rather than by an average: with the flat
 * damage fixed, a seal hit is either X or 2X and nothing else, so `max / min` is
 * the multiplier exactly. An average would be a measurement of the crit RATE
 * wearing the multiplier's name.
 * ==============================================================================
 */

/** Spell power large enough that a seal's flat damage is comfortably nonzero. */
const SPELL_POWER = 1000;

interface Trial {
  readonly critChance: number;
  readonly spellCritChance: number;
}

/**
 * Fire one seal's proc `count` times and return what each hit dealt.
 *
 * `onTrigger` is called directly rather than through a swing, because the
 * subject is the seal's own damage and a real swing would add its own roll to
 * the stream for nothing. The event handed over is an ordinary main-hand use,
 * which is what `canTrigger` would have accepted.
 */
function sealAmounts(
  seal: 'righteousness' | 'fury' | 'command' | 'echo',
  trial: Trial,
  count = 400,
): number[] {
  const actor: Combatant = makeAttacker({
    autoAttack: 'none',
    stats: {
      critChance: trial.critChance,
      spellCritChance: trial.spellCritChance,
      spellPower: SPELL_POWER,
      attackPower: 0,
    },
    weapons: {
      mainHand: { name: 'Test Weapon', swingTimerMs: 2600, baseDamage: 100, damageVariance: 0 },
    },
  });
  const target = makeTarget({ maxHealth: 100_000_000 });
  const simulation = buildSimulation([actor, target], { seed: 4242 });

  const aura =
    seal === 'fury' ? SEAL_OF_FURY : seal === 'command' ? SEAL_OF_COMMAND : SEAL_OF_RIGHTEOUSNESS;
  simulation.applyAura(actor, aura, actor.id);

  const reaction =
    seal === 'fury'
      ? sealOfFuryProc()
      : seal === 'command'
        ? sealOfCommandProc()
        : seal === 'echo'
          ? echoProc()
          : sealOfRighteousnessProc();

  const swing: AttackEvent = {
    attacker: actor,
    defender: target,
    outcome: 'hit',
    abilityId: undefined,
    abilityName: 'Main Hand',
    amount: 500,
    weaponSlot: 'mainHand',
    critical: false,
  };

  const amounts: number[] = [];
  for (let i = 0; i < count; i += 1) {
    /*
     * THE ECHO IS ONE CHARGE, so it is re-applied before every trigger. That is
     * the talent working rather than a workaround: `echoProc` removes the aura
     * as it spends it.
     */
    if (seal === 'echo') simulation.applyAura(actor, echoAura('seal_of_righteousness'), actor.id);

    const before = target.health.current;
    reaction.onTrigger(simulation, actor, swing);
    amounts.push(before - target.health.current);
  }
  return amounts;
}

const distinct = (amounts: number[]) => [...new Set(amounts.map((a) => Number(a.toFixed(6))))];

describe('a seal rolls for a crit', () => {
  it('deals exactly one amount when the Paladin cannot crit at all', () => {
    /*
     * THE CONTROL, and it is what makes every assertion below a statement about
     * crit rather than about variance. A seal states a flat figure plus spell
     * power, so with the crit chance at zero every hit is the same number -- if
     * this ever shows two values, something else has started varying and the
     * "max is twice min" tests underneath it stop meaning what they say.
     */
    const amounts = sealAmounts('righteousness', { critChance: 0, spellCritChance: 0 });
    expect(distinct(amounts)).toHaveLength(1);
    expect(amounts[0]).toBeGreaterThan(0);
  });

  it('deals two amounts once it can, and the larger is exactly twice the smaller', () => {
    const amounts = sealAmounts('righteousness', { critChance: 50, spellCritChance: 0 });
    const values = distinct(amounts).sort((a, b) => a - b);

    expect(values).toHaveLength(2);
    /*
     * 2x, NOT 1.5x. `COMBAT_CONSTANTS.meleeCritMultiplier` is written out rather
     * than read as "whatever the code did", and the spell multiplier is asserted
     * to be a DIFFERENT number -- otherwise this test would keep passing on the
     * day somebody made a seal crit like a spell.
     */
    expect(values[1] / values[0]).toBeCloseTo(COMBAT_CONSTANTS.meleeCritMultiplier, 6);
    expect(COMBAT_CONSTANTS.meleeCritMultiplier).toBe(2);
    expect(COMBAT_CONSTANTS.spellCritMultiplier).not.toBe(
      COMBAT_CONSTANTS.meleeCritMultiplier,
    );
  });

  it('reads MELEE crit chance, and a Paladin with only spell crit never crits', () => {
    /*
     * THE ASSERTION THAT COSTS SOMETHING TO GET WRONG. A seal deals Holy damage,
     * so `spellCritChance` is the plausible answer; the owner named the melee
     * chance. A Paladin's two crit stats are genuinely different numbers -- the
     * Shockadin's gear and talents move them apart -- so this is observable
     * rather than theoretical.
     */
    const flat = sealAmounts('righteousness', { critChance: 0, spellCritChance: 0 }, 20)[0];

    // All the spell crit in the world, and not one seal crit.
    const spellOnly = sealAmounts('righteousness', { critChance: 0, spellCritChance: 100 });
    expect(Math.max(...spellOnly)).toBeCloseTo(flat, 6);

    // And melee crit at 100 crits EVERY hit, which is the same statement from
    // the other side: the smallest hit is already the doubled one.
    const meleeOnly = sealAmounts('righteousness', { critChance: 100, spellCritChance: 0 });
    expect(Math.min(...meleeOnly)).toBeCloseTo(flat * COMBAT_CONSTANTS.meleeCritMultiplier, 6);
  });

  it('covers all three seals the ruling names', () => {
    for (const seal of ['righteousness', 'fury', 'command'] as const) {
      const flat = sealAmounts(seal, { critChance: 0, spellCritChance: 0 }, 60);
      const rolling = sealAmounts(seal, { critChance: 50, spellCritChance: 0 });

      expect(distinct(flat), seal).toHaveLength(1);
      const values = distinct(rolling).sort((a, b) => a - b);
      expect(values.length, seal).toBe(2);
      expect(values[1] / values[0], seal).toBeCloseTo(COMBAT_CONSTANTS.meleeCritMultiplier, 6);
    }
  });

  it('covers the Echo too, because an echoed seal IS the seal', () => {
    /*
     * Twist of Light applies "the replaced Seal's effects", so the Echo crits
     * for the same reason the seal does and by the same route -- it goes through
     * `sealHit`. Worth pinning because the Echo is 12.7% of Seal Twist
     * Retribution's damage and is its own row on the results page, so an Echo
     * that quietly stopped matching its seal would be visible and unexplained.
     */
    const flat = sealAmounts('echo', { critChance: 0, spellCritChance: 0 }, 60);
    expect(distinct(flat)).toHaveLength(1);

    const values = distinct(sealAmounts('echo', { critChance: 50, spellCritChance: 0 })).sort(
      (a, b) => a - b,
    );
    expect(values).toHaveLength(2);
    expect(values[1] / values[0]).toBeCloseTo(COMBAT_CONSTANTS.meleeCritMultiplier, 6);
  });

  it('crits at roughly the rate the melee table gives, not at some other rate', () => {
    /*
     * A PROBABILISTIC MECHANIC IS CHECKED AGAINST ITS RATE, over enough trials
     * that the interval is small. 50% crit less the 1.8 points of crit
     * suppression a level 60 attacker takes against a level 60 defender -- the
     * suppression is why this is a band rather than a number, and why asserting
     * exactly half would fail.
     */
    const amounts = sealAmounts('righteousness', { critChance: 50, spellCritChance: 0 }, 4000);
    const smallest = Math.min(...amounts);
    const crits = amounts.filter((a) => a > smallest * 1.5).length;
    const rate = crits / amounts.length;

    expect(rate).toBeGreaterThan(0.44);
    expect(rate).toBeLessThan(0.54);
  });
});
