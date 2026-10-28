import { describe, expect, it } from 'vitest';
import type { Ability, TelemetryEvent } from '../../src/engine';
import { Simulation, seconds } from '../../src/engine';
import { DRUID_ABILITIES } from '../../src/game/abilities/druid';
import { HUNTER_ABILITIES } from '../../src/game/abilities/hunter';
import { MAGE_ABILITIES } from '../../src/game/abilities/mage';
import { PALADIN_ABILITIES } from '../../src/game/abilities/paladin';
import { PRIEST_ABILITIES } from '../../src/game/abilities/priest';
import { ROGUE_ABILITIES } from '../../src/game/abilities/rogue';
import { SHAMAN_ABILITIES } from '../../src/game/abilities/shaman';
import { WARLOCK_ABILITIES } from '../../src/game/abilities/warlock';
import { WARRIOR_ABILITIES } from '../../src/game/abilities/warrior';
import { MID_FIGHT_CONSUMABLE_ABILITIES } from '../../src/game/abilities/consumables';
import { RACIAL_ABILITIES } from '../../src/game/racials/abilities';
import { triggersGcd } from '../../src/engine/abilities/casting';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { ruptureRogueProfile } from '../helpers/ruptureRogue';

/*
 * ==============================================================================
 * A FREE OFF-GCD CAST ACTS AGAIN AT ONCE, RATHER THAN WAITING OUT A POLL.
 *
 * THE RULESET OWNER'S RULING: "Vanish into Ambush should not be interrupted by
 * a swing." Vanish is off the global cooldown, so it left the actor FREE -- and
 * `nextDecisionTime` gave a free actor `now + ROTATION_POLL_MS`, a tenth of a
 * second in which an auto-attack could land and take the stealth window the
 * Vanish had just opened.
 *
 * ------------------------------------------------------------------------------
 * IT IS THE CHARGE PROBLEM, MET FROM THE OTHER SIDE. CLAUDE.md records the
 * first instance: Charge is castable for one instant, the off-GCD cast left the
 * actor free, and the window was gone before the next poll -- one cast a fight
 * to ZERO. **That one was worked around by moving the entry**, and no position
 * can fix this one, because the thing that intervenes is a SWING rather than
 * another entry.
 *
 * ------------------------------------------------------------------------------
 * WHAT THIS FILE IS REALLY FOR IS TERMINATION. A decision scheduled at the
 * timestamp it was taken at can recur forever, and two things stop it:
 *
 *   it is reached only after a cast that SUCCEEDED, so an idle actor polls
 *   every off-GCD ability declares a cooldown, so each wins at most once
 *
 * **THE SECOND IS NOBODY'S RULE AND IS LOAD-BEARING HERE**, which is exactly
 * the shape this project writes a test for: an ability added later with no
 * cooldown and no global cooldown would hang a fight rather than fail one, and
 * nothing else in the suite would have an opinion about it.
 * ==============================================================================
 */

/** Every ability a character in this project can be handed, by any route. */
const EVERY_ABILITY: readonly Ability[] = [
  ...DRUID_ABILITIES,
  ...HUNTER_ABILITIES,
  ...MAGE_ABILITIES,
  ...PALADIN_ABILITIES,
  ...PRIEST_ABILITIES,
  ...ROGUE_ABILITIES,
  ...SHAMAN_ABILITIES,
  ...WARLOCK_ABILITIES,
  ...WARRIOR_ABILITIES,
  ...MID_FIGHT_CONSUMABLE_ABILITIES,
  ...Object.values(RACIAL_ABILITIES),
];

describe('the termination invariant the immediate re-decision rests on', () => {
  it('gives every off-GCD ability a cooldown, or a swing to arm', () => {
    /*
     * ==========================================================================
     * THE WHOLE SAFETY ARGUMENT, ASSERTED RATHER THAN REASONED.
     *
     * `nextDecisionTime` returns `now` after a free cast, so the chain at one
     * timestamp is bounded only by each ability being unable to win twice. A
     * COOLDOWN is what guarantees that: it starts even on a free off-GCD cast,
     * so the second look refuses it.
     *
     * AN ON-NEXT-SWING ABILITY IS THE ONE FAMILY WITH NO COOLDOWN and is
     * excluded at the call site instead. Heroic Strike is refused while already
     * armed -- but Heroic Strike and Cleave share a slot and would overwrite
     * each other's queue forever, draining a warrior's rage bar in one instant.
     *
     * READ THROUGH THE `triggersGcd` FUNCTION AND NOT THE FIELD, because
     * the rule is DERIVED: an on-next-swing ability is off the global cooldown
     * without declaring it, so reading the field would miss the family the
     * exclusion is about.
     * ==========================================================================
     */
    const offending = EVERY_ABILITY.filter(
      (ability) =>
        !triggersGcd(ability) &&
        ability.onNextSwing === undefined &&
        (ability.cooldownMs ?? 0) <= 0,
    ).map((ability) => ability.id);

    expect(offending, 'off the GCD, no cooldown, and not an on-next-swing').toEqual([]);
  });

  it('is asserted over a set big enough to mean something', () => {
    // A guard on the guard: an empty or tiny catalogue would assert nothing,
    // which is how a structural test quietly stops covering its subject.
    expect(EVERY_ABILITY.length).toBeGreaterThan(150);
    expect(EVERY_ABILITY.filter((a) => !triggersGcd(a)).length).toBeGreaterThan(10);
  });
});

/** Every cast in one fight of a preset, as `{ id, timestamp }`. */
function castsIn(presetId: string, seed: number) {
  // `rogue_rupture` is no longer a preset (round 82); its list still is, so the
  // build is rebuilt by hand.
  const profile =
    presetId === 'rogue_rupture' ? ruptureRogueProfile() : PRESETS_BY_ID.get(presetId)!.build();
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(trainingDummyEncounter(profile, seed), {
    emit: (event) => events.push(event),
  });
  simulation.begin();
  simulation.advanceTo(seconds(600));
  return events
    .filter((event) => event.type === 'cast')
    .map((event) => ({
      id: (event as { abilityId: string }).abilityId,
      timestamp: event.timestamp,
    }));
}

describe('Vanish into Ambush', () => {
  it('lands the Ambush in the same instant, on both lists that hold one', () => {
    /*
     * ==========================================================================
     * THE OWNER'S RULING, ASSERTED AS THE THING IT ACTUALLY MEANS: no TIME
     * passes between the two, so there is no moment for a swing to land in.
     *
     * NOT "no swing event between them", which is the tempting assertion and is
     * weaker: it would pass on a 99ms gap that happened to contain no swing in
     * the seed being measured, which is the state this ruling is about.
     *
     * PREMEDITATION IS ALLOWED TO SIT BETWEEN THEM and often does -- it is off
     * the global cooldown, above Ambush in both lists, and is the one thing in
     * the project that does NOT break stealth. It lands at the same timestamp
     * too, so the whole of the owner's Vanish-Premeditation-Ambush cycle is one
     * instant.
     * ==========================================================================
     */
    for (const presetId of ['rogue_rupture', 'rogue_hemo']) {
      let windows = 0;
      let spent = 0;

      for (const seed of [4242, 99, 1234]) {
        const casts = castsIn(presetId, seed);
        for (const [index, cast] of casts.entries()) {
          if (cast.id !== 'vanish') continue;
          windows += 1;
          // An Ambush at the SAME timestamp, with only same-instant casts
          // between -- which is what "no swing can intervene" reduces to.
          const followed = casts
            .slice(index + 1)
            .some((later) => later.timestamp === cast.timestamp && later.id === 'ambush');
          if (followed) spent += 1;
        }
      }

      expect(windows, `${presetId} vanishes at all`).toBeGreaterThan(0);
      expect(spent, `${presetId} spent every Vanish window on an Ambush`).toBe(windows);
    }
  });

  it('still polls when a decision casts nothing, which is the unbounded case', () => {
    /*
     * THE IDLE ACTOR IS WHY THE RULE IS CONDITIONAL ON A CAST HAVING HAPPENED.
     * Returning `now` unconditionally schedules a decision at the timestamp it
     * was taken at, forever, and the symptom is a fight that never finishes --
     * so this is asserted by the fight FINISHING, which the whole suite proves
     * for every preset and which is stated here because the property has no
     * other home.
     *
     * A Rogue is the right subject: its list holds four off-GCD abilities, so
     * it exercises the chain rather than merely surviving it.
     */
    const profile = ruptureRogueProfile();
    const simulation = new Simulation(trainingDummyEncounter(profile, 4242));
    simulation.begin();
    const run = simulation.run();

    expect(run.eventsProcessed).toBeGreaterThan(0);
    expect(simulation.clock.now()).toBeGreaterThan(seconds(10));
  });
});
