import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { castAbility, seconds } from '../../src/engine';
import {
  HAMMER_OF_WRATH_CAST_MS,
  hammerOfWrathTable,
  isInstantHammerOfWrath,
} from '../../src/game/abilities/paladin';
import {
  IMPROVED_RIGHTEOUS_FURY_FLAG,
  IRON_CREED_DURATION_MS,
  ironCreedAura,
  righteousFury,
} from '../../src/game/auras/paladin';
import {
  PALADIN_PROTECTION,
  PALADIN_RETRIBUTION,
  PALADIN_SHOCKADIN,
} from '../../src/game/rotations/paladin';
import { talentNumber } from '../../src/game/talents/talentValues';
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
 * ==============================================================================
 * SIX THINGS THE RULESET OWNER FOUND BY READING THE RESULTS PAGE, and five of
 * them were the same shape: a talent that reported itself modelled and did
 * nothing. Worth naming the shapes, because neither is visible from the census.
 *
 *   A NULL VALUES ENTRY       `sacred_arbiter` is single-rank, so the importer
 *                             had no `{0}` to match and wrote `null` -- and
 *                             `talentBuild` DROPS every effect that asks for a
 *                             number. Holy Strike was 10% smaller for the build
 *                             that pays a point for it. Second time: Holy Shield
 *                             was the first.
 *   A TWO-CLAUSE REASON       `improved_righteous_fury`, `iron_creed` and
 *                             `instrument_of_law` each carried a reason whose
 *                             FIRST clause was permanently true (threat is out
 *                             of scope) and whose second had expired. The reason
 *                             kept reading as correct because half of it was.
 *
 * Tested on the MECHANISM throughout -- the resolved cast time, the aura's
 * multiplier, the modifier arriving -- because three of these are worth nothing
 * to DPS and one is worth nothing to the two profiles that do not take it.
 * ==============================================================================
 */

const built = (preset: string) => PRESETS_BY_ID.get(preset)!.build();

const bookFor = (preset: string) => {
  const p = built(preset);
  return abilitiesForClass('paladin', p.character.combatStyle as never, p.talents);
};

const abilityOf = (preset: string, id: string) => bookFor(preset).find((a) => a.id === id);

const presetPlayer = (preset: string) => {
  const p = built(preset);
  return createPlayer({
    race: 'human',
    characterClass: 'paladin',
    combatStyle: p.character.combatStyle as never,
    talents: p.talents,
    equipment: p.equipment,
  });
};

/* -------------------------------------------------------------------------- */

describe('Sacred Arbiter, which was dropped for want of a number', () => {
  it('has its 20% hand-filled in the values file', () => {
    /*
     * THE ROOT CAUSE, asserted where it lives. A single-rank talent has no
     * variable the importer can match, so its entry came back `null` -- and the
     * `abilityDamage` effect that reads it was discarded in silence while
     * `class_audit` read the effect TABLE and called the talent fully modelled.
     *
     * TWENTY PERCENT SINCE CLIENT BUILD 1.60.1.70170, up from ten and not
     * mentioned in the patch notes -- and the hand-filled value is the ONLY
     * place that figure lives, so a refresh of the values file cannot carry it.
     * That makes this assertion the whole talent twice over: once for the number
     * existing at all, and once for it being the current one.
     */
    expect(talentNumber('paladin', 'sacred_arbiter', 1, 0)).toBe(20);
  });

  it('actually raises Holy Strike by 20% on the builds that take it', () => {
    for (const preset of ['pally_ret', 'pally_shockadin']) {
      const modifier = presetPlayer(preset).abilityModifierFor('holy_strike');
      expect(modifier.damageMultiplier, preset).toBeCloseTo(1.2, 10);
    }
  });

  it('leaves Holy Strike alone for the build that does not', () => {
    // Protection spends no point here, so its Holy Strike carries no multiplier
    // from this talent -- which is what makes the assertion above about the
    // TALENT rather than about Holy Strike.
    const modifier = presetPlayer('prot_pally').abilityModifierFor('holy_strike');
    expect(modifier.damageMultiplier ?? 1).toBeCloseTo(1, 10);
  });
});

/* -------------------------------------------------------------------------- */

describe('Instrument of Law, and the Hammer of Wrath it makes', () => {
  it('takes the whole second off at 2/2, so the ability is instant', () => {
    expect(talentNumber('paladin', 'instrument_of_law', 2, 0)).toBe(1);
    expect(HAMMER_OF_WRATH_CAST_MS).toBe(seconds(1));

    const ret = abilityOf('pally_ret', 'hammer_of_wrath')!;
    expect(ret.castTimeMs).toBe(0);
    expect(isInstantHammerOfWrath(ret)).toBe(true);
  });

  it('leaves a cast at 1/2, which is why the rank matters', () => {
    /*
     * HALF A SECOND IS STILL A CAST, and a cast on a melee Paladin interrupts
     * the swing in progress. The rank is the whole difference between an ability
     * the Retribution list wants and one it does not.
     */
    expect(talentNumber('paladin', 'instrument_of_law', 1, 0)).toBe(0.5);
  });

  it('is a one-second cast for a build with no points in it', () => {
    const shockadin = abilityOf('pally_shockadin', 'hammer_of_wrath')!;
    expect(shockadin.castTimeMs).toBe(seconds(1));
    expect(isInstantHammerOfWrath(shockadin)).toBe(false);
  });

  it('rolls on the RANGED table once instant, and on the spell table before', () => {
    expect(hammerOfWrathTable(abilityOf('pally_ret', 'hammer_of_wrath')!)).toBe('ranged-special');
    expect(hammerOfWrathTable(abilityOf('pally_shockadin', 'hammer_of_wrath')!)).toBe('spell');
  });

  it('still scales with SPELL power, which the ranged table does not change', () => {
    /*
     * THE ASSERTION MOST LIKELY TO BE GOT WRONG. "A ranged attack" reads as
     * ranged ATTACK POWER, and it is not: `scaleByPower` picks its pool from the
     * SCHOOL, and the school stays Holy. So the damage is measured twice, once
     * with spell power and once with ranged attack power, and only the first
     * moves it.
     */
    const cast = (stats: Record<string, number>) => {
      const p = built('pally_ret');
      const actor = makeAttacker({
        autoAttack: 'none',
        abilities: abilitiesForClass('paladin', p.character.combatStyle as never, p.talents),
        resources: [{ type: 'mana', maximum: 100_000 }],
        stats: { ...stats, critChance: -1000, hitChance: 1000 },
      });
      const target = makeTarget({ maxHealth: 10_000_000 });
      // The execute phase is the last fifth, so the clock has to be there.
      const simulation = buildSimulation([actor, target], { durationMs: seconds(100) });
      simulation.advanceTo(seconds(95));
      const before = target.health.current;
      expect(
        castAbility(simulation, actor, actor.abilities.get('hammer_of_wrath')!, target),
      ).toEqual({ ok: true });
      return before - target.health.current;
    };

    const flat = cast({ spellPower: 0, rangedAttackPower: 0, attackPower: 0 });
    const withSpellPower = cast({ spellPower: 1000, rangedAttackPower: 0, attackPower: 0 });
    const withRangedPower = cast({ spellPower: 0, rangedAttackPower: 1000, attackPower: 1000 });

    expect(withSpellPower).toBeGreaterThan(flat);
    expect(withRangedPower).toBeCloseTo(flat, 6);
  });

  it('is in the Retribution list under that condition, and ungated in the Shockadin', () => {
    const ret = PALADIN_RETRIBUTION.entries.find((e) => e.abilityId === 'hammer_of_wrath');
    expect(ret?.condition).toBeDefined();

    /*
     * THE SHOCKADIN'S IS DELIBERATELY UNGATED. That build takes no Instrument of
     * Law and casts the one-second version about twice a fight; the owner's
     * instruction named the Retribution profile, and widening it would silently
     * delete an entry that fires.
     */
    const shockadin = PALADIN_SHOCKADIN.entries.find((e) => e.abilityId === 'hammer_of_wrath');
    expect(shockadin?.condition).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */

describe('Improved Righteous Fury', () => {
  it('reduces all damage taken by 6% at 3/3, which the Protection build takes', () => {
    expect(talentNumber('paladin', 'improved_righteous_fury', 3, 0)).toBe(6);
    expect(righteousFury(6).damageTakenMultiplier).toBeCloseTo(0.94, 10);
  });

  it('carries its percentage on the ability, so an untalented cast is plain', () => {
    const prot = abilityOf('prot_pally', 'righteous_fury')!;
    expect(prot.bonuses?.[IMPROVED_RIGHTEOUS_FURY_FLAG]).toBe(6);

    const ret = abilityOf('pally_ret', 'righteous_fury')!;
    expect(ret.bonuses?.[IMPROVED_RIGHTEOUS_FURY_FLAG]).toBeUndefined();
    expect(righteousFury().damageTakenMultiplier).toBeUndefined();
  });

  it('is on the buff the Protection list actually casts', () => {
    const p = built('prot_pally');
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: abilitiesForClass('paladin', p.character.combatStyle as never, p.talents),
      resources: [{ type: 'mana', maximum: 100_000 }],
    });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target]);

    expect(actor.damageTakenMultiplierFor('physical')).toBeCloseTo(1, 10);
    expect(
      castAbility(simulation, actor, actor.abilities.get('righteous_fury')!, undefined),
    ).toEqual({ ok: true });
    expect(actor.damageTakenMultiplierFor('physical')).toBeCloseTo(0.94, 10);
  });
});

/* -------------------------------------------------------------------------- */

describe('Iron Creed', () => {
  it('is 10% for 6 seconds at 5/5, from the talent and the aura', () => {
    expect(talentNumber('paladin', 'iron_creed', 5, 1)).toBe(10);
    expect(talentNumber('paladin', 'iron_creed', 5, 2)).toBe(6);
    expect(IRON_CREED_DURATION_MS).toBe(seconds(6));
    expect(ironCreedAura(10).damageTakenMultiplier).toBeCloseTo(0.9, 10);
  });

  it('is registered as a cast reaction on the build that takes it, and nowhere else', () => {
    expect(presetPlayer('prot_pally').castReactions.map((r) => r.id)).toContain('iron_creed');
    for (const preset of ['pally_ret', 'pally_shockadin']) {
      expect(presetPlayer(preset).castReactions.map((r) => r.id), preset).not.toContain(
        'iron_creed',
      );
    }
  });

  it('opens its window on Holy Strike, and only while Righteous Fury is up', () => {
    const p = built('prot_pally');
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: abilitiesForClass('paladin', p.character.combatStyle as never, p.talents),
      castReactions: presetPlayer('prot_pally').castReactions.filter(
        (r) => r.id === 'iron_creed',
      ),
      resources: [{ type: 'mana', maximum: 100_000 }],
      weapons: {
        mainHand: { name: 'Test', swingTimerMs: 2400, baseDamage: 100, damageVariance: 0 },
      },
    });
    const target = makeTarget({ maxHealth: 10_000_000 });
    const simulation = buildSimulation([actor, target], { durationMs: seconds(120) });

    // WITHOUT Righteous Fury, Holy Strike opens nothing.
    expect(castAbility(simulation, actor, actor.abilities.get('holy_strike')!, target)).toEqual({
      ok: true,
    });
    expect(actor.auras.has('iron_creed')).toBe(false);

    // WITH it, the same cast does.
    simulation.advanceTo(seconds(20));
    expect(
      castAbility(simulation, actor, actor.abilities.get('righteous_fury')!, undefined),
    ).toEqual({ ok: true });
    simulation.advanceTo(seconds(22));
    expect(castAbility(simulation, actor, actor.abilities.get('holy_strike')!, target)).toEqual({
      ok: true,
    });
    expect(actor.auras.has('iron_creed')).toBe(true);

    /*
     * AND THE TWO REDUCTIONS MULTIPLY, which is the rule every other
     * damage-taken multiplier here follows: 0.94 x 0.90.
     */
    expect(actor.damageTakenMultiplierFor('physical')).toBeCloseTo(0.94 * 0.9, 10);

    // Six seconds, then back to Righteous Fury's alone.
    simulation.advanceTo(seconds(29));
    expect(actor.auras.has('iron_creed')).toBe(false);
    expect(actor.damageTakenMultiplierFor('physical')).toBeCloseTo(0.94, 10);
  });
});

/* -------------------------------------------------------------------------- */

describe('Swift Judgement, which is meant to double-cast a Judgement', () => {
  it('is gated on ANY seal rather than on Seal of Fury', () => {
    /*
     * THE GATE USED TO NAME SEAL OF FURY and that cost it the back-to-back: the
     * Protection opener judges while Seal of the Crusader is up, so at the first
     * moment Judgement was on cooldown the named seal was not up yet and the
     * entry fell through for a global cooldown.
     *
     * ASSERTED BY BEHAVIOUR rather than by reading the closure: a Paladin
     * carrying the Crusader's seal with Judgement on cooldown must now be
     * allowed to cast it.
     */
    const entry = PALADIN_PROTECTION.entries.find((e) => e.abilityId === 'swift_judgement')!;
    const p = built('prot_pally');
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: abilitiesForClass('paladin', p.character.combatStyle as never, p.talents),
      resources: [{ type: 'mana', maximum: 100_000 }],
    });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target]);

    // Seal of the Crusader up, Judgement spent: the window Swift Judgement is for.
    castAbility(simulation, actor, actor.abilities.get('seal_of_the_crusader')!, undefined);
    simulation.advanceTo(seconds(2));
    castAbility(simulation, actor, actor.abilities.get('judgement')!, target);
    simulation.advanceTo(seconds(4));

    expect(compiled(entry.condition)?.(simulation, actor, target)).toBe(true);
  });
});
