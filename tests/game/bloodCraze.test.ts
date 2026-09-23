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
  bloodCrazeOnBloodthirst,
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
 *    victim of a critical strike, dealing damage with Bloodthirst, or
 *    suffering more than 20% of your maximum Health from a single attack."
 *
 * THREE TRIGGERS, and the shorter version shown on a talent button names only
 * the first. Two of them watch attacks RECEIVED and one watches an attack
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

  it('landing a Bloodthirst, which is the clause a DPS warrior gets', () => {
    const { simulation, player, boss } = opened();
    const bloodthirst = bloodCrazeOnBloodthirst(3);
    const dealt = (abilityId: string | undefined, amount: number): AttackEvent => ({
      attacker: player,
      defender: boss,
      outcome: 'hit',
      abilityId,
      abilityName: abilityId ?? 'Main Hand Auto-Attack',
      amount,
      weaponSlot: 'mainHand',
      critical: false,
    });

    expect(bloodthirst.canTrigger?.(simulation, player, dealt('bloodthirst', 500))).toBe(true);
    // "DEALING DAMAGE", so one that landed for nothing does not count.
    expect(bloodthirst.canTrigger?.(simulation, player, dealt('bloodthirst', 0))).toBe(false);
    expect(bloodthirst.canTrigger?.(simulation, player, dealt('mortal_strike', 500))).toBe(
      false,
    );
  });

  it('is two reactions, because the triggers sit on both sides of an attack', () => {
    expect(bloodCrazeWhenHurt(3).on).toBe('taken');
    expect(bloodCrazeOnBloodthirst(3).on).toBe('dealt');

    expect(WARRIOR_TALENT_EFFECTS.blood_craze).toContainEqual({
      kind: 'reaction',
      reactionId: 'blood_craze',
    });
    expect(WARRIOR_TALENT_EFFECTS.blood_craze).toContainEqual({
      kind: 'reaction',
      reactionId: 'blood_craze_bloodthirst',
    });
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
  });

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
  });

  it('fires for a warrior nothing is attacking, off Bloodthirst alone', () => {
    /*
     * The clause that makes this a Fury talent. A dual-wielder on a standing
     * target takes no damage at all, so the two "being hurt" clauses can never
     * fire -- and Blood Craze still goes up, off their own Bloodthirst.
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
        improved_cleave: 3,
        boundless_rage: 1,
        piercing_howl: 1,
        iron_will: 5,
        death_wish: 1,
        bloodthirst: 1,
      },
      simulation: { ...base.simulation, iterations: 100, seed: 12345 },
      encounter: { ...base.encounter, targetAttacks: false },
    } as never;

    const batch = runProfileBatch(fury);
    expect(batch.survival.damageTaken).toBe(0);
    const uptime = batch.buffUptime.find((b) => b.auraName === 'Blood Craze');
    expect(uptime?.applications ?? 0).toBeGreaterThan(1);
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
