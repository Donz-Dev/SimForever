import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation, castAbility, seconds } from '../../src/engine';
import {
  PROWL_ABILITY,
  RAVAGE,
  RAVAGE_BASE_DAMAGE,
  RAVAGE_WEAPON_FRACTION,
  SHRED,
  SHRED_BASE_DAMAGE,
  SHRED_WEAPON_FRACTION,
} from '../../src/game/abilities/druid';
import { PROWL } from '../../src/game/auras/druid';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { buildSimulation } from '../helpers/buildSimulation';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { characterAtCombatStart } from '../../src/simulator';

/*
 * ==============================================================================
 * THE CAT'S STEALTH OPENER: PROWL, THEN RAVAGE.
 *
 * The ruleset owner specified both in one message -- "the precombat should be 2s
 * before cat form, 1s before prowl, 0s Ravage" -- and stated the ability
 * outright: "60 energy, Instant cast, Ravage the target, causing 350% damage
 * plus 343 to the target. Must be prowling and behind the target. Awards 1
 * combo points."
 *
 * EVERY FIGURE AGREES WITH `forever-druid-spellbook.json` AT RANK 4, which is
 * the rare case of a stated figure and a capture matching word for word. So the
 * numbers are not what can be wrong here. What can be wrong is the SHAPE, and
 * it has three parts:
 *
 *   the 350% is a WEAPON FRACTION and the 343 is outside it
 *   the gate is the PROWL AURA, which is Ambush's arrangement
 *   Ravage SPENDS the window, which is the one clause neither source states
 *
 * THE THIRD IS A READING AND IS LABELLED ONE. Ambush is the precedent: a
 * stealth opener that removes the aura gating it. Without it a Cat holding Prowl
 * could Ravage again whenever the energy allowed -- a repeatable 350% weapon
 * damage instant, which is a very large invented number.
 * ==============================================================================
 */

function cat() {
  const profile = PRESETS_BY_ID.get('druid_cat')!.build();
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(trainingDummyEncounter(profile, 4242), {
    emit: (event) => events.push(event),
  });
  simulation.begin();
  return {
    simulation,
    events,
    player: simulation.combatants.find((actor) => actor.kind === 'player')!,
    target: simulation.combatants.find((actor) => actor.kind === 'enemy')!,
  };
}

describe('Prowl', () => {
  it('is a permanent aura whose only job is to gate Ravage', () => {
    /*
     * THE SAME SHAPE STEALTH ALREADY HAS, and the reason to assert it is that
     * the tempting alternative -- a duration -- would make the opener depend on
     * how long before the pull the Druid prowled. "Lasts until cancelled."
     */
    expect(PROWL.durationMs).toBe(0);
    expect(PROWL.statModifiers ?? []).toEqual([]);
    expect(PROWL.periodic).toBeUndefined();
  });

  it('refuses to re-prowl, on a character the opener has not already moved', () => {
    /*
     * ON A BARE COMBATANT RATHER THAN THE PRESET, which the first draft of this
     * test got wrong: the Cat's opener prowls at a one-second lead, so at the
     * pull the ability is on a NINE SECOND cooldown and this read as "refuses to
     * prowl" for a reason that has nothing to do with the aura. A fixture that
     * has already taken the action cannot test whether the action is allowed.
     */
    const player = makeAttacker({ abilities: [PROWL_ABILITY] });
    const simulation = buildSimulation([player, makeTarget()]);

    expect(castAbility(simulation, player, PROWL_ABILITY, undefined).ok).toBe(true);
    expect(player.auras.has('prowl')).toBe(true);
    // Already prowling is not a reason to prowl again.
    expect(castAbility(simulation, player, PROWL_ABILITY, undefined).ok).toBe(false);
  });

  it('is on a nine second cooldown at the pull, which is the lead rewound', () => {
    /*
     * THE SECOND OBSERVABLE CONSEQUENCE OF A LEAD TIME, on an ability that has
     * one: ten seconds of cooldown, pressed one second before the pull, so nine
     * are left when the clock starts. Asserted because it is the half of
     * `runPrecombat` a reader is least likely to expect from the panel.
     */
    expect(PROWL_ABILITY.cooldownMs).toBe(10_000);
    const { simulation, player } = cat();
    expect(player.abilities.cooldownRemaining('prowl', simulation.clock.now())).toBe(9_000);
  });

  it('says what it does not do, rather than quietly not doing it', () => {
    // "Reduces your movement speed by 30%" is the only clause with a number in
    // it and there is no position for it to touch.
    expect(PROWL_ABILITY.unmodelled).toContain('movement speed');
  });
});

describe('Ravage', () => {
  it('is 350% of weapon damage plus 343, outside the fraction', () => {
    /*
     * THE OWNER'S RULING ABOUT FLAT DAMAGE, which is what makes the two halves
     * checkable separately: "75% weapon damage plus an additional 50" is
     * `weapon x 0.75 + 50`, never `(weapon + 50) x 0.75`. Asserted against
     * SHRED, which is the same shape one row up in the same file and is already
     * pinned by `flatOutsideWeaponFraction.test.ts` -- so this is a claim about
     * Ravage being built like its neighbour rather than a second copy of the
     * rule.
     */
    expect(RAVAGE_WEAPON_FRACTION).toBe(3.5);
    expect(RAVAGE_BASE_DAMAGE).toBe(343);
    expect(RAVAGE.cost).toEqual({ resource: 'energy', amount: 60 });
    expect(RAVAGE.castTimeMs ?? 0).toBe(0);
    expect(RAVAGE.comboPointsAwarded).toBe(1);
    expect(RAVAGE.attackTable).toBe('melee-special');

    // And it is more than twice Shred, which is the cheap sanity check on a
    // transcribed fraction: 350% against 155%.
    expect(RAVAGE_WEAPON_FRACTION / SHRED_WEAPON_FRACTION).toBeCloseTo(3.5 / 1.55, 6);
    expect(RAVAGE_BASE_DAMAGE).toBeGreaterThan(SHRED_BASE_DAMAGE);
    expect(SHRED.cost).toEqual(RAVAGE.cost);
  });

  it('cannot be cast without the window, and SPENDS it when it is', () => {
    /*
     * ========================================================================
     * BOTH HALVES, because the gate and the spend are different claims and
     * only one of them is stated anywhere.
     *
     * The gate is the owner's and the capture's: "must be prowling". The SPEND
     * is a reading of an unstated clause, following Ambush -- and it is the one
     * that matters most, because without it this is a repeatable 350% instant.
     * ========================================================================
     */
    /*
     * A BARE COMBATANT, for the reason above: the preset's own opener has
     * already prowled, ravaged and spent 60 of its energy, so none of the three
     * states this test needs is the state it starts in.
     */
    const player = makeAttacker({
      abilities: [PROWL_ABILITY, RAVAGE],
      resources: [{ type: 'energy', maximum: 100, initial: 100 }],
      weapons: { mainHand: { baseDamage: 100, speed: 1, powerCoefficient: 1 / 14 } },
    } as never);
    const target = makeTarget();
    const simulation = buildSimulation([player, target]);

    expect(castAbility(simulation, player, RAVAGE, target).ok, 'no window').toBe(false);

    castAbility(simulation, player, PROWL_ABILITY, undefined);
    expect(player.auras.has('prowl')).toBe(true);
    /*
     * PAST PROWL'S OWN GLOBAL COOLDOWN, which the first draft of this test did
     * not do and which read as "Ravage is refused with the window up": the
     * rejection was `on_gcd`, not the gate. **A pre-combat cast skips the GCD it
     * would start and an ordinary one does not**, so the opener works without
     * this and a hand-driven pair of casts does not. Nothing in the project
     * casts Prowl in combat, so its GCD is inert there -- the capture says
     * nothing about it either way and no off-GCD claim is invented here.
     */
    simulation.advanceTo(seconds(2));
    expect(castAbility(simulation, player, RAVAGE, target).ok, 'with the window').toBe(true);
    expect(player.auras.has('prowl'), 'and the window is gone').toBe(false);

    // So a second one is refused, which is the whole point of the spend --
    // and refused for the WINDOW rather than for the energy, which is why the
    // pool is topped up first.
    simulation.grantResource(player, 'energy', 100, { id: 'test', name: 'Test' });
    expect(castAbility(simulation, player, RAVAGE, target).ok, 'twice').toBe(false);
  });

  it('opens the Cat and lands at the pull, awarding its combo point', () => {
    /*
     * DRIVEN THROUGH THE REAL OPENER rather than by hand, because the thing
     * that can be wrong is the SEQUENCE: Prowl at 1s has to come before Ravage
     * at 0s, and `runPrecombat` sorting by lead time is what makes that true.
     * A Ravage that ran first would be refused and skipped in silence.
     */
    const { events, player } = cat();
    const damage = events.filter(
      (event) =>
        event.type === 'damage' && (event as { abilityId?: string }).abilityId === 'ravage',
    );

    expect(damage.length, 'it landed').toBeGreaterThan(0);
    expect(damage[0].timestamp, 'at the pull').toBe(0);
    expect(player.resources.get('comboPoints')?.current ?? 0).toBeGreaterThan(0);
  });

  it('is in no priority list, which follows from the spend', () => {
    /*
     * NOT A SEPARATE DECISION: once Prowl is spent nothing re-applies it, so an
     * entry could never fire. The owner asked for Ravage as an OPENER, and
     * `measure_profiles.ts` would report a list entry for it as NEVER FIRED --
     * which is the loudest flag that tool has, pointed at something correct.
     */
    const profile = PRESETS_BY_ID.get('druid_cat')!.build();
    expect(profile.rotation.entries.map((entry) => entry.abilityId)).not.toContain('ravage');
    expect(profile.rotation.entries.map((entry) => entry.abilityId)).not.toContain('prowl');

    // And both are in the book, so the absence is the list's choice.
    const built = characterAtCombatStart(profile)!;
    expect(built.abilities.get('ravage')).toBeDefined();
    expect(built.abilities.get('prowl')).toBeDefined();
  });
});
