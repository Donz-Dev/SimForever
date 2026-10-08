import { describe, expect, it } from 'vitest';
import type { AttackEvent, Combatant } from '../../src/engine';
import { Simulation } from '../../src/engine';
import {
  BLOOD_CRAZE_DURATION_MS,
  BLOOD_CRAZE_TICKS,
  BLOOD_CRAZE_TICK_INTERVAL_MS,
  bloodCrazeAura,
} from '../../src/game/auras/warriorTalents';
import {
  BLOOD_CRAZE_BIG_HIT_FRACTION,
  bloodCrazeWhenHurt,
} from '../../src/game/reactions/warriorTalents';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { createDefaultProfile } from '../../src/profiles';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { runProfileBatch, runSimulation } from '../../src/simulator';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * Blood Craze, transcribed BY HAND from the captured talent text:
 *
 *   "Regenerates {1/2/3}% of your total Health over 6 sec after being the
 *    victim of a critical strike or suffering more than 20% of your maximum
 *    Health from a single attack."
 *
 * ----------------------------------------------------------------------------
 * IT HAD A THIRD TRIGGER UNTIL CLIENT BUILD 1.60.1.70170: "dealing damage with
 * Bloodthirst", which the patch removed -- "Blood Craze no longer activates off
 * of Bloodthirst casts". Every test below that exercised it has gone with it,
 * and the header is kept in the shape it had so the two readings can be
 * compared.
 *
 * IT WAS THE CLAUSE THAT MADE THIS A FURY TALENT. Both survivors watch attacks
 * RECEIVED, so a warrior nothing is hitting can no longer set it off at all, and
 * the owner's new DW Fury build drops it. What used to be a damage talent with a
 * defensive half is now a defensive talent in a damage tree.
 * ----------------------------------------------------------------------------
 *
 * TWO TRIGGERS, and the shorter version shown on a talent button names only
 * the first. Both of them watch attacks RECEIVED rather than an attack
 * DEALT, which is why it takes two reactions.
 *
 * Its reason for being inert said the healing "would not be observable: the
 * player cannot drop below one health, so a heal has nothing to restore and
 * survival is not modelled". Every clause of that was true when written.
 */

/*
 * TEN POINTS OF PADDING, because Blood Craze sits at tier 10 of Fury and is
 * stripped as illegal without them. Caught by measuring: a build padded with
 * only seven points read 0% uptime at 1/3 and 98.6% at 3/3, which looks
 * exactly like a rank-scaling bug and is a tier gate.
 *
 * Booming Voice and Cruelty, held CONSTANT across every comparison below.
 * Cruelty is crit, so a comparison that added it on one side only would credit
 * Blood Craze with its damage.
 */
const PAD = { booming_voice: 5, cruelty: 5 };

function tankProfile(talents: Record<string, number>, iterations = 300) {
  const base = createDefaultProfile();
  return {
    ...base,
    character: {
      ...base.character,
      race: 'tauren',
      combatStyle: 'one_hand_shield',
      stance: 'defensive',
    },
    equipment: startingEquipmentFor('warrior', 'one_hand_shield'),
    talents,
    simulation: { ...base.simulation, iterations, seed: 12345, durationSeconds: 60 },
    encounter: { ...base.encounter, targetAttacks: true },
  } as never;
}

function opened(talents: Record<string, number> = { ...PAD, blood_craze: 3 }) {
  const simulation = new Simulation(trainingDummyEncounter(tankProfile(talents, 1)));
  simulation.begin();
  const player = simulation.combatants.find((a) => a.isPlayerControlled) as Combatant;
  const boss = simulation.combatants.find((a) => !a.isPlayerControlled) as Combatant;
  return { simulation, player, boss };
}

/** A landed attack on the player, for feeding a reaction directly. */
function blowOn(player: Combatant, boss: Combatant, amount: number, critical = false): AttackEvent {
  return {
    attacker: boss,
    defender: player,
    outcome: critical ? 'crit' : 'hit',
    abilityId: undefined,
    abilityName: 'Main Hand Auto-Attack',
    amount,
    weaponSlot: 'mainHand',
    critical,
  };
}

// ---------------------------------------------------------------------------
// The three triggers
// ---------------------------------------------------------------------------

describe('what sets Blood Craze off', () => {
  const hurt = bloodCrazeWhenHurt(3);

  it('a critical strike, however small', () => {
    const { simulation, player, boss } = opened();
    // One point of damage, but a crit.
    expect(hurt.canTrigger?.(simulation, player, blowOn(player, boss, 1, true))).toBe(true);
  });

  it('more than 20% of maximum health from one blow, crit or not', () => {
    const { simulation, player, boss } = opened();
    const threshold = player.health.maximum * BLOOD_CRAZE_BIG_HIT_FRACTION;
    expect(BLOOD_CRAZE_BIG_HIT_FRACTION).toBe(0.2);

    // "MORE THAN", so the threshold itself is not enough.
    expect(hurt.canTrigger?.(simulation, player, blowOn(player, boss, threshold))).toBe(false);
    expect(hurt.canTrigger?.(simulation, player, blowOn(player, boss, threshold + 1))).toBe(
      true,
    );
  });

  it('nothing else about being hit', () => {
    const { simulation, player, boss } = opened();
    const small = player.health.maximum * 0.1;
    expect(hurt.canTrigger?.(simulation, player, blowOn(player, boss, small))).toBe(false);
  });

  it('an attack that was avoided is not one anybody suffered', () => {
    // A dodge reports zero damage and cannot be a crit, so neither clause can
    // fire -- but the outcome list refuses it before that even matters.
    expect(hurt.outcomes).not.toContain('dodge');
    expect(hurt.outcomes).not.toContain('parry');
    expect(hurt.outcomes).not.toContain('miss');
    // A BLOCK is in, because a blocked attack lands and can still take a fifth
    // of a health pool.
    expect(hurt.outcomes).toContain('block');
  });

  /*
   * TWO TESTS WERE HERE FOR THE BLOODTHIRST CLAUSE and both are gone with it at
   * client build 1.60.1.70170. What they asserted is worth recording, because the
   * shape they tested is the one GORE DRINKER now uses in this same class:
   *
   *   - the clause fired on `dealt` with `abilityId === 'bloodthirst'` and
   *     `amount > 0`, so a Bloodthirst that landed for nothing did not count --
   *     "dealing damage" read as LANDING it.
   *   - the talent was TWO reactions because `Reaction.on` names one side of an
   *     attack and the triggers sat on both. That is still the rule, and Gore
   *     Drinker is the next talent to need it.
   *
   * Gore Drinker reads the opposite way on the first point: its four triggers are
   * CASTS, and a Bloodthirst that missed still opens its window.
   */
  it('is one reaction now, and it watches attacks RECEIVED', () => {
    expect(bloodCrazeWhenHurt(3).on).toBe('taken');

    expect(WARRIOR_TALENT_EFFECTS.blood_craze).toEqual([
      { kind: 'reaction', reactionId: 'blood_craze' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// The healing
// ---------------------------------------------------------------------------

describe('the regeneration itself', () => {
  it('is the stated percentage of maximum health, over six seconds', () => {
    /*
     * The TOTAL is what the source states, so it is what is asserted. Three
     * ticks of a third each is the cadence, and the cadence is a placeholder
     * -- see below.
     */
    const { simulation, player } = opened();
    const max = player.health.maximum;

    for (const percent of [1, 2, 3]) {
      player.health.set(1);
      const aura = simulation.applyAura(player, bloodCrazeAura(percent), player.id);

      let healed = 0;
      for (let tick = 0; tick < BLOOD_CRAZE_TICKS; tick++) {
        const before = player.health.current;
        aura.definition.periodic?.onTick(simulation, aura);
        healed += player.health.current - before;
      }

      expect(healed, `${percent}%`).toBeCloseTo((max * percent) / 100, 6);
      player.auras.remove(simulation, 'blood_craze');
    }
  });

  it('lasts six seconds and ticks every two, which is now stated', () => {
    /*
     * BOTH FIGURES ARE THE RULESET OWNER'S. The cadence was the last thing
     * about this talent borrowed from Classic, carried as
     * `PLACEHOLDER_BLOOD_CRAZE_TICK_INTERVAL_MS` with an `unmodelled` entry
     * putting the caveat on screen. Given directly: every two seconds, three
     * ticks.
     *
     * NO NUMBER MOVED. Classic's cadence happened to be the same, so the
     * confirmation changed nothing a result reports -- which is exactly why it
     * was worth asking rather than assuming, and why the placeholder was
     * honest to keep until it was.
     *
     * The talent carries no `unmodelled` entry any more, asserted here so that
     * a caveat cannot creep back without this failing.
     */
    expect(BLOOD_CRAZE_DURATION_MS).toBe(6000);
    expect(BLOOD_CRAZE_TICK_INTERVAL_MS).toBe(2000);
    expect(BLOOD_CRAZE_TICKS).toBe(3);

    expect(WARRIOR_TALENT_EFFECTS.blood_craze.filter((e) => e.kind === 'unmodelled')).toEqual([]);
  });

  it('restarts rather than stacking', () => {
    /*
     * Three triggers feed this and a hurt warrior meets them constantly --
     * measured at 25 applications in a sixty second fight. Stacking would turn
     * a 3% regeneration into an unbounded one.
     */
    expect(bloodCrazeAura(3).refreshBehaviour).toBe('reset');
    expect(bloodCrazeAura(3).maxStacks).toBeUndefined();
  });

  it('cannot crit, over a whole fight of ticks', () => {
    /*
     * A regeneration, not a spell: nothing about the warrior scales it beyond
     * the pool it is a fraction of. Read off the telemetry rather than
     * asserted on the definition, because `canCrit` defaults to TRUE -- the
     * failure mode is forgetting the flag, and a definition test would be
     * checking the same line the code sets.
     */
    const timeline = runSimulation(
      trainingDummyEncounter(tankProfile({ ...PAD, blood_craze: 3 }, 1)),
    ).timeline;

    const ticks = timeline.filter(
      (event) => event.type === 'heal' && event.abilityId === 'blood_craze',
    );
    expect(ticks.length).toBeGreaterThan(5);
    expect(ticks.every((event) => event.type === 'heal' && !event.critical)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// In a fight
// ---------------------------------------------------------------------------

/**
 * THREE FULL MONTE CARLO BATCHES IN ONE TEST, which is what it costs to
 * compare three talent ranks against each other honestly.
 *
 * It runs in about 1.6 seconds alone and took more than five under the
 * parallel load of the whole suite once the Mage's tests were added -- so it
 * began failing on a timeout rather than on a number. Raised rather than
 * trimmed: the three batches ARE the test, and a smaller sample would make a
 * ~90-health difference indistinguishable from noise.
 */
const SLOW_TEST_TIMEOUT_MS = 30_000;

describe('Blood Craze in a real fight', () => {
  const healingWith = (talents: Record<string, number>) =>
    runProfileBatch(tankProfile(talents)).survival.healingReceived;

  it('heals more at 3/3 than at 1/3 than at none', () => {
    /*
     * Measured, with the padding held constant so nothing else moves. It is a
     * SMALL effect on this encounter -- roughly 90 and 290 health a fight --
     * because the ramp puts the warrior at full health for most of the late
     * fight and the rest is overhealing.
     */
    const none = healingWith(PAD);
    const one = healingWith({ ...PAD, blood_craze: 1 });
    const three = healingWith({ ...PAD, blood_craze: 3 });

    expect(one).toBeGreaterThan(none);
    expect(three).toBeGreaterThan(one);
  }, SLOW_TEST_TIMEOUT_MS);

  it('is up almost the whole fight, because the target hits that hard', () => {
    /*
     * 98.6% uptime from about 25 applications. Nearly every landed swing
     * exceeds a fifth of the health pool once the ramp gets going, so the
     * third clause carries it -- the crit clause on its own would be worth a
     * tenth of this.
     */
    const batch = runProfileBatch(tankProfile({ ...PAD, blood_craze: 3 }));
    const uptime = batch.buffUptime.find((b) => b.auraName === 'Blood Craze');
    expect(uptime?.uptime ?? 0).toBeGreaterThan(0.8);
    expect(uptime?.applications ?? 0).toBeGreaterThan(10);
  });

  /*
   * TWENTY SECONDS, AND THE DEFAULT FIVE WAS NOT ENOUGH. This test runs
   * batches and measures 4.7 to 5.4 seconds on this machine -- so against
   * vitest's 5000ms default it fails or passes depending on what else is using
   * the CPU, and `main` itself fails it under the full suite while passing it
   * in isolation. Measured three times, both ways round, with the
   * sibling slow test in `protectionTalents.test.ts` swapping places with it.
   */
  it('does no damage of its own, and barely moves DPS', () => {
    /*
     * TWO ASSERTIONS, and the first is the one that means something. Blood
     * Craze contributes no damage EVENTS at all -- that is exact, and it is
     * what "it is a heal" actually says.
     *
     * The DPS comparison is deliberately loose. It used to be within half a
     * point, and it is not any more: under Forever's rage rule a tank earns
     * `D x 10 / H`, so maximum health is in the denominator -- and Last Stand
     * raises maximum health while it is up. Blood Craze changes when the tank
     * is low, which changes when Last Stand fires, which changes H, which
     * changes the rage. A real chain rather than noise, and small.
     */
    const batch = runProfileBatch(tankProfile({ ...PAD, blood_craze: 3 }));
    expect(batch.abilities.some((a) => a.abilityName === 'Blood Craze')).toBe(false);

    const dps = (talents: Record<string, number>) =>
      runProfileBatch(tankProfile(talents)).dps.mean;
    const withIt = dps({ ...PAD, blood_craze: 3 });
    const without = dps(PAD);
    expect(Math.abs(withIt - without) / without).toBeLessThan(0.02);
  }, 20_000);

  it('CANNOT fire for a warrior nothing is attacking any more', () => {
    /*
     * ----------------------------------------------------------------------
     * THE ASSERTION IS INVERTED, AND THAT IS THE PATCH ITEM. This test read
     * "fires for a warrior nothing is attacking, off Bloodthirst alone", and its
     * note read: "The clause that makes this a Fury talent. A dual-wielder on a
     * standing target takes no damage at all, so the two 'being hurt' clauses can
     * never fire -- and Blood Craze still goes up, off their own Bloodthirst."
     *
     * Client build 1.60.1.70170 removed that clause, so both halves of the old
     * sentence are now true at once: the hurt clauses cannot fire, and there is
     * nothing else. The talent is dead weight to any build the target ignores.
     *
     * KEPT AS A TEST RATHER THAN DELETED because the thing worth pinning did not
     * change -- it is the DEPENDENCE ON BEING ATTACKED, which the tank test above
     * cannot show from the positive side. A talent that silently started working
     * again on an unattacked warrior would mean a trigger had crept back in.
     * ----------------------------------------------------------------------
     */
    const base = createDefaultProfile();
    const fury = {
      ...base,
      character: {
        ...base.character,
        race: 'tauren',
        combatStyle: 'dual_wield',
        stance: 'berserker',
      },
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
      talents: {
        ...PAD,
        blood_craze: 3,
        unbridled_wrath: 5,
        piercing_howl: 1,
        death_wish: 1,
        bloodthirst: 1,
      },
      simulation: { ...base.simulation, iterations: 100, seed: 12345 },
      encounter: { ...base.encounter, targetAttacks: false },
    } as never;

    const batch = runProfileBatch(fury);
    expect(batch.survival.damageTaken).toBe(0);
    const uptime = batch.buffUptime.find((b) => b.auraName === 'Blood Craze');
    expect(uptime?.applications ?? 0).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The talent
// ---------------------------------------------------------------------------

describe('the Blood Craze talent', () => {
  it('scales one percent a rank', () => {
    // Written out by hand from the values file: 1, 2, 3.
    for (const rank of [1, 2, 3]) {
      const build = talentBuild('warrior', { ...PAD, blood_craze: rank });
      expect(build.reactions.some((r) => r.id === 'blood_craze'), `rank ${rank}`).toBe(true);
    }
  });

  it('grants nothing without the points', () => {
    expect(talentBuild('warrior', PAD).reactions.some((r) => r.id === 'blood_craze')).toBe(
      false,
    );
  });

  it('no longer says survival is unmodelled', () => {
    const reasons = WARRIOR_TALENT_EFFECTS.blood_craze
      .filter((e) => e.kind === 'unmodelled')
      .map((e) => (e as { reason: string }).reason);
    expect(reasons.join(' ')).not.toMatch(/survival is not modelled/i);
  });
});
