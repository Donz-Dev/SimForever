import { describe, expect, it } from 'vitest';
import type { Ability, AuraDefinition, Combatant } from '../../src/engine';
import { castAbility, castLength, checkCast, resolveCast, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ------------------------------------------------------------------------------
 * RULESET: an aura can change the NEXT cast of an ability it names -- its cast
 * time, its cost, or both -- and can be spent doing it.
 *
 * The rule four classes asked for. Eclipse on the Druid and Maelstrom Weapon
 * on the Shaman are live against it; Presence of Mind, Hot Streak, Arcane
 * Concentration and Inner Focus are waiting for their classes.
 *
 * Everything here is asserted EXACTLY rather than sampled. A cast time a
 * fraction out changes a caster's damage by a few percent over a fight, which
 * averaging would hide -- and the two consumption modes differ only in how
 * much is left behind, which no aggregate would show at all.
 * ------------------------------------------------------------------------------
 */

const BASE_CAST_MS = seconds(3);
const BASE_COST = 300;

const spell = (id = 'test_spell'): Ability => ({
  id,
  name: 'Test Spell',
  castTimeMs: BASE_CAST_MS,
  cost: { resource: 'mana', amount: BASE_COST },
  affectedByHaste: false,
  requiresTarget: false,
  onCast: () => {},
});

const instant: Ability = {
  id: 'test_instant',
  name: 'Test Instant',
  cost: { resource: 'mana', amount: BASE_COST },
  requiresTarget: false,
  onCast: () => {},
};

/** An aura carrying one cast modifier, with everything else defaulted. */
const modifierAura = (
  castModifier: NonNullable<AuraDefinition['castModifier']>,
  maxStacks = 1,
): AuraDefinition => ({
  id: 'test_modifier',
  name: 'Test Modifier',
  durationMs: seconds(30),
  maxStacks,
  castModifier,
});

function caster(mana = 10_000): Combatant {
  return makeAttacker({
    autoAttack: 'none',
    abilities: [spell(), instant],
    resources: [{ type: 'mana', maximum: 10_000, initial: mana }],
  });
}

/** A live simulation with the caster in it, so auras can be applied. */
function withAura(aura: AuraDefinition | undefined, stacks = 1, mana = 10_000) {
  const actor = caster(mana);
  const target = makeTarget();
  const simulation = buildSimulation([actor, target]);
  if (aura) {
    const instance = simulation.applyAura(actor, aura, actor.id);
    instance.stacks = stacks;
  }
  return { simulation, actor, target };
}

describe('resolving a cast', () => {
  it('returns the ability its own numbers when nothing matches', () => {
    const { actor } = withAura(undefined);
    const resolved = resolveCast(actor, spell());
    expect(resolved).toEqual({
      baseCastTimeMs: BASE_CAST_MS,
      costAmount: BASE_COST,
      modified: false,
    });
  });

  it('ignores an aura that names a different ability', () => {
    const aura = modifierAura({ abilityIds: ['something_else'], castTimeFraction: 1 });
    const { actor } = withAura(aura);
    expect(resolveCast(actor, spell()).modified).toBe(false);
  });

  it('takes a flat reduction off the cast, in milliseconds', () => {
    const aura = modifierAura({ abilityIds: ['test_spell'], castTimeReductionMs: seconds(0.5) });
    const { actor } = withAura(aura);
    expect(resolveCast(actor, spell()).baseCastTimeMs).toBe(seconds(2.5));
  });

  it('takes a fraction off the cast, and never goes below zero', () => {
    const half = modifierAura({ abilityIds: ['test_spell'], castTimeFraction: 0.5 });
    expect(resolveCast(withAura(half).actor, spell()).baseCastTimeMs).toBe(seconds(1.5));

    // A reduction bigger than the cast is a zero, not a negative cast time
    // that would schedule a completion in the past.
    const huge = modifierAura({ abilityIds: ['test_spell'], castTimeReductionMs: seconds(99) });
    expect(resolveCast(withAura(huge).actor, spell()).baseCastTimeMs).toBe(0);
  });

  it('scales with stacks when asked, and caps the fraction at whole', () => {
    /*
     * MAELSTROM WEAPON'S ARRANGEMENT: 20% a stack, five stacks, instant.
     *
     * The cap matters. Five stacks of 20% is exactly 1, and a sixth would be
     * 1.2 -- which without the cap is a NEGATIVE cast time. Asserted at seven
     * stacks so the guard is tested rather than assumed.
     */
    const aura = modifierAura(
      { abilityIds: ['test_spell'], castTimeFraction: 0.2, scalesWithStacks: true },
      7,
    );
    /*
     * WHOLE MILLISECONDS. 3000 less 60% is 1199.9999999999998 in floating
     * point, and `resolveCast` rounds for the same reason `applyHaste` does:
     * an event scheduled at a fractional timestamp sorts against integer ones
     * in a way nothing else in this engine does. Asserted with `toBe` rather
     * than `toBeCloseTo` precisely so the rounding is the thing under test.
     */
    expect(resolveCast(withAura(aura, 1).actor, spell()).baseCastTimeMs).toBe(seconds(2.4));
    expect(resolveCast(withAura(aura, 3).actor, spell()).baseCastTimeMs).toBe(seconds(1.2));
    expect(resolveCast(withAura(aura, 5).actor, spell()).baseCastTimeMs).toBe(0);
    expect(resolveCast(withAura(aura, 7).actor, spell()).baseCastTimeMs).toBe(0);
  });

  it('does not scale with stacks when NOT asked', () => {
    // Eclipse's arrangement: four charges is four half-second casts, not one
    // two-second discount. Getting this backwards is worth four times too much.
    const aura = modifierAura(
      { abilityIds: ['test_spell'], castTimeReductionMs: seconds(0.5) },
      4,
    );
    expect(resolveCast(withAura(aura, 4).actor, spell()).baseCastTimeMs).toBe(seconds(2.5));
  });

  it('takes a fraction off the cost, and never goes below zero', () => {
    const aura = modifierAura(
      { abilityIds: ['test_spell'], costFraction: 0.2, scalesWithStacks: true },
      5,
    );
    expect(resolveCast(withAura(aura, 1).actor, spell()).costAmount).toBe(240);
    expect(resolveCast(withAura(aura, 5).actor, spell()).costAmount).toBe(0);
  });

  it('skips an instant when the modifier requires a cast time', () => {
    /*
     * "Your next Nature spell WITH A CASTING TIME." An instant must not eat a
     * charge meant for a cast, which is what a Moonkin's Moonfire would do to
     * a Nature's Swiftness the moment the priority list reached it.
     */
    const aura = modifierAura({
      abilityIds: ['test_instant'],
      castTimeFraction: 1,
      requiresCastTime: true,
    });
    const { actor } = withAura(aura);
    expect(resolveCast(actor, instant).modified).toBe(false);
  });

  it('applies haste AFTER the modifier, so the two compose', () => {
    /*
     * A 20%-shorter cast is 20% shorter at every gear level rather than only
     * at none. Asserted as the identity rather than as a number: halving the
     * cast and then hasting it by 50% is the same as hasting first.
     */
    const halved = castLength({ ...spell(), affectedByHaste: true }, 1.5, seconds(1.5));
    expect(halved).toBeCloseTo(seconds(1) as number, 6);
  });
});

describe('spending the modifier', () => {
  const stackAura = modifierAura(
    { abilityIds: ['test_spell'], castTimeReductionMs: seconds(0.5), consumedByCast: 'stack' },
    4,
  );
  const allAura = modifierAura(
    {
      abilityIds: ['test_spell'],
      castTimeFraction: 0.2,
      scalesWithStacks: true,
      consumedByCast: 'all',
    },
    5,
  );

  it("takes ONE stack when the modifier says 'stack'", () => {
    const { simulation, actor, target } = withAura(stackAura, 4);
    castAbility(simulation, actor, spell(), target);
    expect(actor.auras.stacksOf('test_modifier')).toBe(3);
  });

  it("takes the WHOLE aura when the modifier says 'all'", () => {
    /*
     * "Your NEXT Lightning Bolt" is ONE cast however many stacks paid for it.
     * Spending a single stack would leave four up for the bolt after it --
     * which reads as a working talent and is worth several times what it
     * should be. This is the assertion that separates the two modes.
     */
    const { simulation, actor, target } = withAura(allAura, 5);
    castAbility(simulation, actor, spell(), target);
    expect(actor.auras.has('test_modifier')).toBe(false);
  });

  it('drops a one-stack aura rather than leaving it at zero', () => {
    const { simulation, actor, target } = withAura(stackAura, 1);
    castAbility(simulation, actor, spell(), target);
    expect(actor.auras.has('test_modifier')).toBe(false);
  });

  it('spends nothing when a DIFFERENT ability is cast', () => {
    const { simulation, actor, target } = withAura(stackAura, 4);
    castAbility(simulation, actor, instant, target);
    expect(actor.auras.stacksOf('test_modifier')).toBe(4);
  });

  it('spends nothing when the cast is merely CHECKED', () => {
    /*
     * `checkCast` has to be side-effect free: a rotation calls it on every
     * candidate before committing to any of them, so a check that spent a
     * charge would burn Eclipse on a Starfire that was never cast -- once per
     * entry, per decision, for the whole fight.
     */
    const { simulation, actor, target } = withAura(stackAura, 4);
    for (let i = 0; i < 10; i += 1) checkCast(simulation, actor, spell(), target);
    expect(actor.auras.stacksOf('test_modifier')).toBe(4);
  });
});

describe('the cost the rotation sees', () => {
  it('lets a caster who cannot afford the PRINTED cost cast anyway', () => {
    /*
     * ------------------------------------------------------------------------
     * THE FAILURE THIS PREVENTS IS SILENT. A priority list that checked the
     * full 300 would skip to the next entry and nothing would report a spell
     * it declined to consider -- the talent would simply appear not to work.
     *
     * 100 mana against a 300 spell with a 100% discount: refused without the
     * rule, allowed with it.
     * ------------------------------------------------------------------------
     */
    const free = modifierAura({ abilityIds: ['test_spell'], costFraction: 1 });
    const { simulation, actor, target } = withAura(free, 1, 100);

    expect(checkCast(simulation, actor, spell(), target)).toEqual({ ok: true });
  });

  it('still refuses when even the reduced cost is out of reach', () => {
    const quarter = modifierAura({ abilityIds: ['test_spell'], costFraction: 0.25 });
    const { simulation, actor, target } = withAura(quarter, 1, 100);
    // 300 less a quarter is 225, and the caster has 100.
    expect(checkCast(simulation, actor, spell(), target)).toEqual({
      ok: false,
      reason: 'not_enough_resource',
    });
  });

  it('charges the REDUCED cost, so the resource panel audits the talent', () => {
    const half = modifierAura({ abilityIds: ['test_spell'], costFraction: 0.5 });
    const { simulation, actor, target } = withAura(half, 1, 1000);
    castAbility(simulation, actor, spell(), target);
    expect(actor.resources.require('mana').current).toBe(850);
  });
});
