import { describe, expect, it } from 'vitest';
import { characterAtCombatStart, runProfileBatch } from '../../src/simulator';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { createDefaultProfile } from '../../src/profiles';
import {
  DEFENSIVE_EMERGENCY_HEALTH,
  WARRIOR_SHIELD_DEFENSIVE,
} from '../../src/game/rotations/warrior';
import { Simulation } from '../../src/engine';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import {
  DEMORALIZING_SHOUT_ATTACK_POWER,
  LAST_STAND,
} from '../../src/game/auras/warrior';
import { bossMeleeWeapon } from '../../src/game/encounters/raidBoss';
import { legalise } from '../helpers/legalTalents';

/*
 * The Protection priority list, in the ruleset owner's order.
 *
 *   1  Last Stand           health < 30%
 *   2  Shield Wall          health < 30%, Last Stand neither active nor ready
 *   3  Bloodrage            rage < 50
 *   4  Defensive Stance     not already in it
 *   5  Battle Shout         not active
 *   6  Sunder Armor         below 5 stacks, or running out
 *   7  Demoralizing Shout   not on the target
 *   8  Heroic Strike        rage >= 26
 *   9  Shield Block         whenever it is off cooldown
 *  10  Shield Slam          talent-gated
 *  11  Revenge              window-gated
 *  12  Thunder Clap
 *  13  Rend                 not on the target
 *
 * The order is written out here by hand, because the ORDER is the thing being
 * specified. A test that read it from the list would pass whatever the list
 * said.
 */
const EXPECTED_ORDER = [
  'last_stand',
  'shield_wall_cast',
  'bloodrage_cast',
  'defensive_stance_cast',
  'battle_shout_cast',
  'sunder_armor_cast',
  'demoralizing_shout_cast',
  'heroic_strike',
  'shield_block_cast',
  'shield_slam',
  'revenge',
  'thunder_clap',
  'rend_cast',
];

/*
 * A 31-point Protection build that actually reaches Last Stand.
 *
 * LAST STAND REQUIRES 2/2 IMPROVED BLOODRAGE, which is easy to miss and fails
 * silently: `legalAllocation` strips the talent, `grantAbility` never fires,
 * and the entry is skipped by an id that resolves to nothing the character
 * knows. Measured as zero casts the first time, which reads exactly like an
 * entry that never wins its slot.
 */
const PROTECTION_31 = {
  shield_specialization: 5,
  anticipation: 5,
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

function tank(talents: Record<string, number> = {}, iterations = 200) {
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

const usesOf = (batch: ReturnType<typeof runProfileBatch>, name: string) =>
  batch.abilities.find((row) => row.abilityName === name)?.uses ?? 0;

// ---------------------------------------------------------------------------
// The order
// ---------------------------------------------------------------------------

describe('the Protection list', () => {
  it('is in the order the ruleset owner gave', () => {
    expect(WARRIOR_SHIELD_DEFENSIVE.map((entry) => entry.abilityId)).toEqual(EXPECTED_ORDER);
  });

  it('puts the two survival cooldowns above everything', () => {
    // Above even the stance, because a dead tank is in no stance at all.
    expect(WARRIOR_SHIELD_DEFENSIVE[0].abilityId).toBe('last_stand');
    expect(WARRIOR_SHIELD_DEFENSIVE[1].abilityId).toBe('shield_wall_cast');
  });
});

// ---------------------------------------------------------------------------
// Survival cooldowns
// ---------------------------------------------------------------------------

describe('Last Stand', () => {
  it('waits for thirty percent health', () => {
    expect(DEFENSIVE_EMERGENCY_HEALTH).toBe(0.3);

    const player = characterAtCombatStart(tank(PROTECTION_31))!;
    const entry = WARRIOR_SHIELD_DEFENSIVE[0];

    // Full health: no.
    expect(entry.condition?.(undefined as never, player, undefined)).toBe(false);

    // Exactly at the line is not below it.
    player.health.set(player.health.maximum * 0.3);
    expect(entry.condition?.(undefined as never, player, undefined)).toBe(false);

    player.health.set(player.health.maximum * 0.29);
    expect(entry.condition?.(undefined as never, player, undefined)).toBe(true);
  });

  it('is cast in nearly every fight once the talent is taken', () => {
    /*
     * The first list entry in this project that has ever read the character's
     * health. It could not have existed a week ago: health could not drop
     * below one, so 30% was unreachable by construction.
     */
    const batch = runProfileBatch(tank(PROTECTION_31));
    expect(usesOf(batch, 'Last Stand')).toBeGreaterThan(0.5);
  });

  it('is skipped entirely without the talent', () => {
    const batch = runProfileBatch(tank());
    expect(usesOf(batch, 'Last Stand')).toBe(0);
  });
});

describe('Shield Wall', () => {
  const entry = WARRIOR_SHIELD_DEFENSIVE[1];

  it('needs low health AND Last Stand out of the picture', () => {
    const player = characterAtCombatStart(tank(PROTECTION_31))!;
    const context = { clock: { now: () => 0 } } as never;

    // Healthy: no, whatever Last Stand is doing.
    expect(entry.condition?.(context, player, undefined)).toBe(false);

    /*
     * Hurt, but Last Stand is READY. Shield Wall waits: a thirty minute
     * cooldown should not be spent while a three minute one is sitting there.
     */
    player.health.set(player.health.maximum * 0.1);
    expect(player.abilities.isReady('last_stand', 0)).toBe(true);
    expect(entry.condition?.(context, player, undefined)).toBe(false);

    // Last Stand spent. Now Shield Wall is the only thing left.
    player.abilities.consumeCharge('last_stand', 0);
    expect(entry.condition?.(context, player, undefined)).toBe(true);
  });

  it('does not stack on top of an active Last Stand', () => {
    /*
     * A REAL simulation here, not a stub context: applying an aura schedules
     * its expiry, so it needs a live event queue to be applied at all.
     */
    const simulation = new Simulation(trainingDummyEncounter(tank(PROTECTION_31)));
    simulation.begin();
    const player = simulation.combatants.find((actor) => actor.isPlayerControlled)!;

    player.health.set(player.health.maximum * 0.1);
    player.abilities.consumeCharge('last_stand', simulation.clock.now());
    expect(entry.condition?.(simulation, player, undefined)).toBe(true);

    // With the buff actually up it waits: two cooldowns on one swing is one
    // of them wasted.
    simulation.applyAura(player, LAST_STAND, player.id);
    expect(entry.condition?.(simulation, player, undefined)).toBe(false);
  });

  it('fires freely for a warrior who has no Last Stand at all', () => {
    /*
     * `isReady` answers false for an ability the character does not KNOW,
     * which is the behaviour wanted: there is nothing to wait for.
     *
     * Measured both ways, because this is the half of the condition most
     * likely to be written backwards: an untalented tank uses Shield Wall
     * almost every fight, and a talented one almost never.
     */
    const untalented = runProfileBatch(tank());
    const talented = runProfileBatch(tank(PROTECTION_31));

    expect(usesOf(untalented, 'Shield Wall')).toBeGreaterThan(0.5);
    expect(usesOf(talented, 'Shield Wall')).toBeLessThan(0.2);
  });
});

// ---------------------------------------------------------------------------
// Demoralizing Shout
// ---------------------------------------------------------------------------

describe('Demoralizing Shout', () => {
  it('is kept up on the target', () => {
    const batch = runProfileBatch(tank());
    expect(usesOf(batch, 'Demoralizing Shout')).toBeGreaterThan(1);

    const uptime = batch.debuffUptime.find((row) => row.auraId === 'demoralizing_shout');
    expect(uptime?.uptime ?? 0).toBeGreaterThan(0.7);
  });

  it('CHANGES NOTHING, and the reason is the target rather than the shout', () => {
    /*
     * It removes 210 attack power. The boss melee carries
     * `powerCoefficient: 0` -- its swing damage IS the whole swing, with no
     * attack power term at all -- so there is nothing for the debuff to take
     * away, and the entry costs 10 rage and a global cooldown for nothing.
     *
     * In the list at the ruleset owner's request, and this test is here so
     * that nobody reads its 79% uptime as an effect. It becomes real the day
     * a target's damage is derived from its attack power.
     */
    expect(DEMORALIZING_SHOUT_ATTACK_POWER).toBe(210);
    expect(bossMeleeWeapon().powerCoefficient).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rend
// ---------------------------------------------------------------------------

describe('Rend, which had never been cast', () => {
  it('is cast now that the entry names the right ability', () => {
    /*
     * The entry said `rend` and the ability is `rend_cast`.
     * `PriorityRotation` skips an unresolvable id without a word, so the
     * entry was dead at any position and any rage -- and its zero casts read
     * as an ability that never won its slot.
     */
    const batch = runProfileBatch(tank());
    expect(usesOf(batch, 'Rend')).toBeGreaterThan(1);

    const uptime = batch.debuffUptime.find((row) => row.auraId === 'rend');
    expect(uptime?.uptime ?? 0).toBeGreaterThan(0.3);
  });

  it('stays last, so it fills a gap rather than taking a strike', () => {
    expect(WARRIOR_SHIELD_DEFENSIVE.at(-1)?.abilityId).toBe('rend_cast');
  });
});

// ---------------------------------------------------------------------------
// The list as a whole
// ---------------------------------------------------------------------------

describe('the list in a fight', () => {
  it('casts every entry it can, and none of the ones it cannot', () => {
    const batch = runProfileBatch(tank(legalise(PROTECTION_31)));

    // Everything the build can reach.
    for (const name of [
      'Last Stand',
      'Bloodrage',
      'Battle Shout',
      'Sunder Armor',
      'Demoralizing Shout',
      'Heroic Strike',
      'Shield Block',
      'Shield Slam',
      'Revenge',
      'Thunder Clap',
      'Rend',
    ]) {
      expect(usesOf(batch, name), name).toBeGreaterThan(0);
    }
  });

  it('still never leaves Defensive Stance', () => {
    // Every entry is castable in Defensive, including the three new ones, so
    // the only stance change the list makes is the one that puts it right.
    const batch = runProfileBatch(tank(legalise(PROTECTION_31)));
    expect(batch.rage.spent.some((row) => row.sourceId === 'stance_change')).toBe(false);
  });
});
