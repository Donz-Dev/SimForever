import { describe, expect, it } from 'vitest';
import type { Combatant } from '../../src/engine';
import { Simulation } from '../../src/engine';
import {
  LAST_STAND,
  LAST_STAND_DURATION_MS,
  LAST_STAND_HEALTH_FRACTION,
  SHIELD_WALL,
  SHIELD_WALL_DURATION_MS,
  lastStandGrant,
} from '../../src/game/auras/warrior';
import {
  LAST_STAND_ABILITY,
  SHIELD_WALL_ABILITY,
} from '../../src/game/abilities/warrior';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { createDefaultProfile } from '../../src/profiles';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { runProfileBatch } from '../../src/simulator';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * Last Stand, and what a death does to a survival cooldown.
 *
 * Spell 12975, transcribed by hand from Forever's captured tooltip:
 *
 *   "When activated, this ability temporarily grants you 30% of your maximum
 *    health for 20 sec. After the effect expires, the health is lost."
 *   Instant, 3 min cooldown, no rage, no stance requirement.
 *
 * And the ruleset owner's rule on top of it: Last Stand and Shield Wall are
 * removed as active buffs if the character dies.
 */

const PROTECTION_31 = {
  shield_specialization: 5,
  anticipation: 5,
  // Last Stand's own prerequisite. Without it the talent is stripped as
  // illegal and the ability is never granted -- silently.
  improved_bloodrage: 2,
  toughness: 3,
  improved_thunder_clap: 3,
  last_stand: 1,
  improved_revenge: 3,
  defiance: 3,
  improved_sunder_armor: 3,
  concussion_blow: 1,
  bastion: 1,
  shield_slam: 1,
};

function tankProfile(talents: Record<string, number> = PROTECTION_31, iterations = 200) {
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

/** A live simulation with combat set up and no events processed. */
function opened(talents: Record<string, number> = PROTECTION_31) {
  const simulation = new Simulation(trainingDummyEncounter(tankProfile(talents)));
  simulation.begin();
  const player = simulation.combatants.find((a) => a.isPlayerControlled) as Combatant;
  return { simulation, player };
}

// ---------------------------------------------------------------------------
// The numbers
// ---------------------------------------------------------------------------

describe('Last Stand, as the tooltip states it', () => {
  it('is 30% for 20 seconds, free, on a three minute cooldown, in any stance', () => {
    // Every figure written out by hand from the captured tooltip.
    expect(LAST_STAND_HEALTH_FRACTION).toBe(0.3);
    expect(LAST_STAND_DURATION_MS).toBe(20_000);
    expect(LAST_STAND_ABILITY.cooldownMs).toBe(180_000);
    expect(LAST_STAND_ABILITY.cost).toBeUndefined();
    // Its captured entry has an EMPTY stance list, unlike Shield Wall's.
    expect(LAST_STAND_ABILITY.stances).toBeUndefined();
    expect(LAST_STAND_ABILITY.requiresTarget).toBe(false);
  });

  it('is granted by the talent and by nothing else', () => {
    expect(WARRIOR_TALENT_EFFECTS.last_stand).toEqual([
      { kind: 'grantAbility', abilityId: 'last_stand' },
    ]);

    const without = abilitiesForClass('warrior', 'one_hand_shield', {});
    expect(without.some((a) => a.id === 'last_stand')).toBe(false);

    const with_ = abilitiesForClass('warrior', 'one_hand_shield', PROTECTION_31);
    expect(with_.some((a) => a.id === 'last_stand')).toBe(true);
  });

  it('no longer claims to be unmeasurable', () => {
    /*
     * Its reason read "it changes no outcome, because the player cannot drop
     * below one health and survival is not modelled". True when written, and
     * false from the day the encounter started killing people.
     */
    expect(WARRIOR_TALENT_EFFECTS.last_stand.some((e) => e.kind === 'unmodelled')).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// What it does to the health pool
// ---------------------------------------------------------------------------

describe('borrowing the health', () => {
  it('raises the maximum by 30% and grants the same amount', () => {
    const { simulation, player } = opened();
    const base = player.health.maximum;
    const granted = lastStandGrant(base);

    // Hurt first, so the grant is visible rather than capped away.
    // A WHOLE number, so the assertions below are exact. Health is a float
    // pool and 20% of 4,069 is not.
    player.health.set(Math.floor(base * 0.2));
    const before = player.health.current;

    simulation.applyAura(player, LAST_STAND, player.id);

    expect(player.health.maximum).toBe(base + granted);
    expect(player.health.current).toBe(before + granted);
  });

  it('TAKES IT BACK on expiry, which is the whole ability', () => {
    /*
     * "After the effect expires, the health is lost."
     *
     * This is what was missing. Expiry used to drop the maximum and merely
     * clamp current into it, so a warrior who cast Last Stand while hurt kept
     * every borrowed point -- a 1,200 health heal on a three minute cooldown,
     * which is the opposite of what the tooltip says.
     */
    const { simulation, player } = opened();
    const base = player.health.maximum;
    const granted = lastStandGrant(base);

    player.health.set(Math.floor(base * 0.2));
    const before = player.health.current;

    simulation.applyAura(player, LAST_STAND, player.id);
    player.auras.remove(simulation, LAST_STAND.id);

    expect(player.health.maximum).toBe(base);
    expect(player.health.current).toBe(before);
    expect(granted).toBeGreaterThan(0);
  });

  it('round-trips the maximum exactly, so repeated casts cannot ratchet it', () => {
    /*
     * Expiry recovers the grant from the inflated maximum rather than
     * remembering it. That is exact -- floor(0.3b) both ways -- and a drift of
     * one point a cast would compound over a long fight into a health pool
     * nobody chose.
     */
    const { simulation, player } = opened();
    const base = player.health.maximum;

    for (let i = 0; i < 5; i++) {
      simulation.applyAura(player, LAST_STAND, player.id);
      player.auras.remove(simulation, LAST_STAND.id);
      expect(player.health.maximum, `cast ${i + 1}`).toBe(base);
    }
  });

  it('cannot itself be the killing blow', () => {
    /*
     * INTERPRETATION, flagged in the aura: the source says what is lost and
     * not what happens when there is not enough of it. Floored at one health,
     * because an ability that saves you and then kills you is the more
     * extraordinary claim and nothing states it.
     */
    const { simulation, player } = opened();

    player.health.set(1);
    simulation.applyAura(player, LAST_STAND, player.id);
    player.auras.remove(simulation, LAST_STAND.id);

    expect(player.health.current).toBe(1);
    expect(player.isAlive).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Dying with it up
// ---------------------------------------------------------------------------

describe('a death takes the survival cooldowns with it', () => {
  it('drops Last Stand and Shield Wall, and keeps everything else', () => {
    /*
     * The ruleset owner's rule. A cooldown spent to prevent this exact death
     * does not survive it -- and Last Stand in particular would otherwise
     * carry its borrowed maximum into a pool that was just refilled.
     *
     * Everything else stays, which is the whole point of `revivesOnDeath`:
     * the run is measuring a fight through a death, not a rebuffing exercise.
     * The assumed healer above all -- dropping that would switch off the
     * healing at the moment it is needed most.
     */
    expect(LAST_STAND.removedOnDeath).toBe(true);
    expect(SHIELD_WALL.removedOnDeath).toBe(true);

    const { simulation, player } = opened();
    // BEFORE the buff, or the "base" is read off an already-inflated pool.
    const base = player.health.maximum;

    simulation.applyAura(player, LAST_STAND, player.id);
    simulation.applyAura(player, SHIELD_WALL, player.id);
    expect(player.health.maximum).toBe(base + lastStandGrant(base));

    expect(player.auras.stacksOf('last_stand')).toBe(1);
    expect(player.auras.stacksOf('shield_wall')).toBe(1);
    expect(player.auras.stacksOf('external_healer')).toBe(1);
    expect(player.auras.stacksOf('defensive_stance')).toBe(1);

    player.health.drain(player.health.maximum);
    simulation.killCombatant(player);

    expect(player.auras.stacksOf('last_stand')).toBe(0);
    expect(player.auras.stacksOf('shield_wall')).toBe(0);
    // Untouched: neither is a survival cooldown spent on this death.
    expect(player.auras.stacksOf('external_healer')).toBe(1);
    expect(player.auras.stacksOf('defensive_stance')).toBe(1);

    // Back at their OWN full health, not an inflated one.
    expect(player.health.maximum).toBe(base);
    expect(player.health.current).toBe(base);
  });

  it('does it in a real fight, and says so in the log', () => {
    const { simulation } = opened();
    void simulation;

    const batch = runProfileBatch(tankProfile());
    const log = batch.representative.combatLog;

    const died = log.findIndex((line) => /dies/.test(line));
    expect(died).toBeGreaterThan(0);

    // Somewhere in a fight with twenty deaths, a Last Stand ends on one.
    const fadesOnDeath = log.some(
      (line, index) =>
        /Last Stand fades/.test(line) && index > 0 && /dies/.test(log[index - 1]),
    );
    expect(fadesOnDeath).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// In the rotation
// ---------------------------------------------------------------------------

describe('Last Stand in the Protection list', () => {
  it('is cast about once a fight, and rarely lives out its twenty seconds', () => {
    /*
     * Measured: 0.93 casts and 9% uptime on a sixty second fight. Twenty
     * seconds of buff at 0.93 casts would be 31% if it ran its course, so
     * most of the time the ramp kills the warrior through it -- which is the
     * removal rule showing up in an aggregate number.
     */
    const batch = runProfileBatch(tankProfile());
    const uses = batch.abilities.find((r) => r.abilityName === 'Last Stand')?.uses ?? 0;
    const uptime = batch.buffUptime.find((b) => b.auraName === 'Last Stand')?.uptime ?? 0;

    expect(uses).toBeGreaterThan(0.5);
    expect(uptime).toBeGreaterThan(0);
    const ifItRanOut = (uses * LAST_STAND_DURATION_MS) / batch.meanDurationMs;
    expect(uptime).toBeLessThan(ifItRanOut);
  });

  it('is never cast by a warrior without the talent', () => {
    const batch = runProfileBatch(tankProfile({}));
    expect(batch.abilities.some((r) => r.abilityName === 'Last Stand')).toBe(false);
  });

  it('leaves Shield Wall its own 12 second window', () => {
    // Different cooldowns, different durations: they are not two copies of
    // one button, and the list reaches for the cheap one first.
    expect(SHIELD_WALL_DURATION_MS).toBe(12_000);
    expect(SHIELD_WALL_ABILITY.cooldownMs).toBe(1_800_000);
    expect(LAST_STAND_ABILITY.cooldownMs).toBe(180_000);
  });
});
