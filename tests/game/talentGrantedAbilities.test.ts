import { describe, expect, it } from 'vitest';
import { runProfile } from '../../src/simulator';
import { createDefaultProfile } from '../../src/profiles';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import {
  DEATH_WISH_DAMAGE_DONE,
  DEATH_WISH_DAMAGE_TAKEN,
  DEATH_WISH_DURATION_MS,
  LAST_STAND_DURATION_MS,
  LAST_STAND_HEALTH_FRACTION,
  SWEEPING_STRIKES_CHARGES,
} from '../../src/game/auras/warrior';
import { warriorAbility } from '../../src/game/abilities/warrior';
import { legalise } from '../helpers/legalTalents';

/*
 * The three abilities that talents grant and the ability spreadsheet has no
 * rows for. Their numbers come from Forever's spell data; see
 * docs/warrior.md.
 *
 * Values written out BY HAND from the tooltips, not read back out of the
 * constants under test.
 */

function geared(talents: Record<string, number>) {
  const base = createDefaultProfile();
  return {
    ...base,
    character: { ...base.character, combatStyle: 'dual_wield' as const },
    equipment: startingEquipmentFor('warrior', 'dual_wield'),
    talents: legalise(talents),
    simulation: { ...base.simulation, seed: 99, durationSeconds: 120 },
  };
}

describe('Death Wish', () => {
  // Spell 12328: "+20% Physical damage done ... increases all damage you take
  // by 5%. Lasts 30 sec." 10 rage, 3 minute cooldown.
  it('is +20% damage done and +5% taken for 30 seconds', () => {
    expect(DEATH_WISH_DAMAGE_DONE).toBeCloseTo(1.2);
    expect(DEATH_WISH_DAMAGE_TAKEN).toBeCloseTo(1.05);
    expect(DEATH_WISH_DURATION_MS).toBe(30_000);
  });

  it('costs 10 rage on a 3 minute cooldown', () => {
    const ability = warriorAbility('death_wish');
    expect(ability?.cost).toEqual({ resource: 'rage', amount: 10 });
    expect(ability?.cooldownMs).toBe(180_000);
  });

  it('is actually cast in a fight once the talent is taken', () => {
    const log = runProfile(geared({ death_wish: 1 })).combatLog;
    expect(log.some((line) => line.includes('gains Death Wish'))).toBe(true);
  });

  it('is never cast without the talent', () => {
    const log = runProfile(geared({})).combatLog;
    expect(log.some((line) => line.includes('Death Wish'))).toBe(false);
  });
});

describe('Last Stand', () => {
  // Spell 12975: "temporarily grants you 30% of your maximum health for 20
  // sec. After the effect expires, the health is lost."
  it('is 30% of maximum health for 20 seconds', () => {
    expect(LAST_STAND_HEALTH_FRACTION).toBeCloseTo(0.3);
    expect(LAST_STAND_DURATION_MS).toBe(20_000);
  });

  it('costs nothing, on a 3 minute cooldown', () => {
    const ability = warriorAbility('last_stand');
    expect(ability?.cost).toBeUndefined();
    expect(ability?.cooldownMs).toBe(180_000);
  });

  /*
   * Deliberately NOT asserted: that Last Stand changes a DPS figure. It cannot.
   * The player cannot drop below one health and survival is not modelled, so
   * extra health decides nothing. A test claiming otherwise would be measuring
   * noise and calling it an effect.
   */
});

describe('Sweeping Strikes', () => {
  // Spell 12292: "Your next 5 melee attacks strike an additional nearby
  // opponent." 30 rage, 30 second cooldown, Battle Stance.
  it('carries five charges', () => {
    expect(SWEEPING_STRIKES_CHARGES).toBe(5);
  });

  /*
   * Its whole effect is the ADDITIONAL opponent, and an encounter here has
   * exactly one enemy -- so it is 30 rage for no damage. It is kept out of
   * every rotation for that reason, and this pins it: if it ever appears in a
   * fight, either a second target arrived or something is wasting rage.
   */
  it('is never cast, because it would do nothing against one target', () => {
    const log = runProfile(geared({ sweeping_strikes: 1 })).combatLog;
    expect(log.some((line) => line.includes('Sweeping Strikes'))).toBe(false);
  });
});

describe('multi-target abilities declare what they would hit', () => {
  /*
   * The declarations are documentation the engine will honour when an encounter
   * has more than one enemy. Asserted so that the claim cannot quietly go
   * missing -- which is how Whirlwind and Cleave came to look single-target.
   */
  it('Whirlwind says 4, Cleave says 2, Thunder Clap says everything', () => {
    expect(warriorAbility('whirlwind')?.targets?.maxTargets).toBe(4);
    expect(warriorAbility('cleave')?.targets?.maxTargets).toBe(2);
    expect(warriorAbility('thunder_clap')?.targets?.maxTargets).toBe(Infinity);
  });

  it('single-target abilities declare nothing, which reads as one', () => {
    expect(warriorAbility('mortal_strike')?.targets).toBeUndefined();
    expect(warriorAbility('execute')?.targets).toBeUndefined();
  });
});
