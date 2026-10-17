import { describe, expect, it } from 'vitest';
import type { Ability, Combatant, TelemetryEvent } from '../../src/engine';
import { EventPriority, createEvent, seconds } from '../../src/engine';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { AIMED_SHOT, MULTI_SHOT, SNIPER_SHOT } from '../../src/game/abilities/hunter';
import { swingingSlots } from '../../src/engine/combat/autoAttack';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * AUTO SHOT IS NOT SUSPENDED BY A HUNTER'S CAST SHOTS -- the ruleset owner's
 * ruling, reversing the one all three Hunter lists were written against.
 *
 * THEIR WORDS: "a previous ruling where ranged auto-attack on hunters is paused
 * while casting sniper shot, aimed shot, and multi-shot. This is no longer the
 * case. The ranged auto-attack is not paused or suspended. It will trigger
 * DURING the cast of the named skills above."
 *
 * THE SUSPENSION HAD TWO HALVES AND A FIX TO EITHER ALONE LOOKS LIKE A FIX.
 * Starting a cast RESET the ranged timer, and a shot that then came due inside
 * the cast was HELD to its end. Removing only the reset leaves a four-second
 * Sniper Shot deferring a shot by over a second on a 2.4-second bow -- most of
 * the loss, kept, and nothing on the results page to show it. So what is
 * asserted here is the end-to-end timing and not the declaration alone.
 *
 * TWO FIXTURES, BECAUSE NEITHER ANSWERS BOTH QUESTIONS.
 *
 * | | answers | cannot answer |
 * | --- | --- | --- |
 * | a SCRIPTED archer | the exact timings, deterministically | whether a real build reaches it |
 * | the LW RANGED preset | that the real character does it | the exact timings |
 *
 * THE PRESET CANNOT BE COMPARED SHOT FOR SHOT AGAINST A FIGHT WITH NO CAST,
 * which is what this test did first. Deadly Aspects is a 10% haste proc on Auto
 * Shot, so the bow's cadence is RNG-driven -- and the engine draws from ONE
 * stream, so Sniper Shot's own attack roll reorders every later draw and the
 * two fights decorrelate. The arms matched on one harness and differed by a
 * shot on another. Against the preset the claim has to be LOCAL: a shot landed
 * inside the cast window.
 * ==============================================================================
 */

const BOW_MS = seconds(2.4);

/**
 * When to start a cast so that the shot due at `BOW_MS` lands in the MIDDLE of
 * it, whatever the cast is long.
 *
 * ------------------------------------------------------------------------------
 * ONE FIXED MOMENT WILL NOT DO, which a failing guard is how this was found. At
 * a flat one-second start Multi-Shot's half-second cast runs 1000 to 1500 and
 * contains no shot at all -- so "the bow was untouched" was true because there
 * was nothing to suspend, on the one of the three where the window is shorter
 * than a bow cycle.
 * ------------------------------------------------------------------------------
 */
const castStartFor = (ability: Ability): number => BOW_MS - ability.castTimeMs! / 2;

/** A scripted archer: a bow, no haste, no rotation, and real shot abilities. */
function archer(abilities: readonly Ability[]): Combatant {
  return makeAttacker({
    autoAttack: 'ranged',
    abilities,
    resources: [{ type: 'mana', maximum: 5000 }],
    weapons: {
      ranged: {
        name: 'Test Bow',
        swingTimerMs: BOW_MS,
        baseDamage: 10,
        damageVariance: 0,
      },
    },
  });
}

/** When the bow fired, and what was cast, over a scripted twelve seconds. */
function scriptedShots(ability: Ability | null): { shots: number[]; casts: number[] } {
  const shooter = archer(ability ? [ability] : []);
  const simulation = buildSimulation([shooter, makeTarget()], { durationMs: seconds(12) });

  if (ability) {
    simulation.events.schedule(
      castStartFor(ability),
      createEvent('cast', EventPriority.Decision, (ctx) => {
        ctx.cast(shooter, ability, ctx.defaultTargetFor(shooter));
      }),
    );
  }

  const run = simulation.run();
  const at = (predicate: (event: TelemetryEvent) => boolean): number[] =>
    run.telemetry.filter(predicate).map((event: TelemetryEvent) => event.timestamp);

  return {
    shots: at((event) => event.type === 'damage' && event.abilityName === 'Ranged Auto-Attack'),
    casts: at((event) => event.type === 'cast' && event.abilityId === ability?.id),
  };
}

describe("a Hunter's cast shots and the bow", () => {
  it('declares the ruling on all three, as `continue` rather than `hold`', () => {
    /*
     * `hold` IS THE NEAR MISS AND IS WHAT A READER WOULD REACH FOR. It leaves
     * the timer running and then DEFERS the swing to the end of the cast,
     * which is the second half of the suspension the owner has ruled away.
     */
    for (const ability of [AIMED_SHOT, MULTI_SHOT, SNIPER_SHOT]) {
      expect(ability.swingTimer, ability.name).toBe('continue');
      // A mode on an instant would be ignored; all three really do cast.
      expect(ability.castTimeMs, ability.name).toBeGreaterThan(0);
    }
  });

  it('keeps the mode on the character built from the preset', () => {
    /*
     * ASKED OF THE BUILT CHARACTER AND NOT ONLY OF THE CONSTANT, because
     * `abilitiesForClass` hands the character a COPY with its talent
     * reductions folded in -- a copy that dropped the field would leave three
     * correct declarations and a suspended bow.
     */
    const hunter = characterAtCombatStart(PRESETS_BY_ID.get('lw_ranged')!.build())!;
    for (const id of ['aimed_shot', 'sniper_shot']) {
      expect(hunter.abilities.get(id)?.swingTimer, id).toBe('continue');
    }
  });

  /*
   * ==========================================================================
   * THE TIMINGS, EXACTLY. A 2.4-second bow fires at 0, 2400, 4800 ... and each
   * cast is started so that the 2400 shot sits in the middle of it. Asserted
   * against the NO-CAST row, because "identical to never having cast" is the
   * whole of "not paused or suspended".
   * ==========================================================================
   */
  it.each([
    ['Sniper Shot', SNIPER_SHOT],
    ['Aimed Shot', AIMED_SHOT],
    ['Multi-Shot', MULTI_SHOT],
  ] as const)('leaves the bow untouched through %s', (_name, ability) => {
    const during = scriptedShots(ability);
    // The cast HAPPENED. Without this the comparison passes on a refused cast,
    // which is how the preset version of this test came to be vacuous.
    expect(during.casts).toEqual([castStartFor(ability)]);
    expect(during.shots).toEqual(scriptedShots(null).shots);
  });

  it('puts a shot inside the window in all three cases', () => {
    /*
     * THE CASE THE FIXTURE HAS TO EXPRESS. A cast that fits between two shots
     * has nothing to suspend, so the row above would pass whatever the engine
     * did -- and at a flat one-second start, Multi-Shot was exactly that.
     */
    for (const ability of [SNIPER_SHOT, AIMED_SHOT, MULTI_SHOT]) {
      const start = castStartFor(ability);
      const inside = scriptedShots(ability).shots.filter(
        (at) => at > start && at < start + ability.castTimeMs!,
      );
      expect(inside, ability.name).toEqual([BOW_MS]);
    }
  });

  it('fires the bow inside a real LW Ranged Sniper Shot cast', () => {
    /*
     * THE REAL BUILD, WITH A LOCAL CLAIM. Cast after the ability's own
     * cooldown: the owner's opener pre-casts Sniper Shot at a four-second lead,
     * which is exactly its cast time, so it LANDS at the pull and the full
     * fifteen seconds run from there. Derived from the built ability rather
     * than written as 16s, so a cooldown change moves the moment instead of
     * silently refusing the cast.
     */
    const hunter = characterAtCombatStart(PRESETS_BY_ID.get('lw_ranged')!.build())!;
    // NO ROTATION: a built combatant carries its list, and both casts under
    // test are IN it, gated on the weave window.
    (hunter as { rotation?: unknown }).rotation = undefined;

    const sniper = hunter.abilities.get('sniper_shot')!;
    const castAt = sniper.cooldownMs! + seconds(1);
    const simulation = buildSimulation([hunter, makeTarget()], {
      durationMs: castAt + seconds(8),
    });
    simulation.events.schedule(
      castAt,
      createEvent('cast', EventPriority.Decision, (ctx) => {
        ctx.cast(hunter, sniper, ctx.defaultTargetFor(hunter));
      }),
    );

    const run = simulation.run();
    const casts = run.telemetry
      .filter((event: TelemetryEvent) => event.type === 'cast' && event.abilityId === 'sniper_shot')
      .map((event: TelemetryEvent) => event.timestamp);
    const shotsInside = run.telemetry.filter(
      (event: TelemetryEvent) =>
        event.type === 'damage' &&
        event.abilityName === 'Ranged Auto-Attack' &&
        event.timestamp > castAt &&
        event.timestamp < castAt + sniper.castTimeMs!,
    );

    expect(casts).toEqual([castAt]);
    expect(shotsInside.length).toBeGreaterThan(0);
  });

  /*
   * THE RULING NAMES THE *RANGED* AUTO-ATTACK AND NOTHING HERE SCOPES TO THE
   * SLOT, which is safe for one structural reason: no combatant in this project
   * swings a melee weapon and a bow at once. `swingingSlots` returns the ranged
   * slot alone for a ranged style and never includes it for any other, so "the
   * ranged auto-attack continues" and "the auto-attack continues" are the same
   * set -- and a per-slot gate would be unreachable code.
   *
   * ASSERTED RATHER THAN BUILT, which is the arrangement `positioning.test.ts`
   * uses for the behind-the-target exception: the day a style swings both, this
   * fails and the gate becomes worth writing.
   */
  it('has no combatant that swings a melee weapon and the bow at once', () => {
    const styles = ['none', 'main-hand', 'dual-wield', 'ranged'] as const;
    for (const autoAttack of styles) {
      const slots = swingingSlots({ autoAttack } as Combatant);
      const ranged = slots.includes('ranged');
      const melee = slots.some((slot) => slot === 'mainHand' || slot === 'offHand');
      expect(ranged && melee, autoAttack).toBe(false);
    }
  });
});
