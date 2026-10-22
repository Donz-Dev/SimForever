import { describe, expect, it } from 'vitest';
import { bloodthrill } from '../../src/game/reactions/warriorTalents';

/*
 * ==============================================================================
 * BLOODTHRILL ROLLS ON THE MAIN-HAND SWING, HEROIC STRIKE AND CLEAVE, AND ON
 * NOTHING ELSE -- the owner, round 51: "now only triggers on main hand
 * auto-attacks, extra attacks, heroic strikes, and cleave."
 *
 * The list of what does NOT roll is written out by hand, because the old rule
 * ("any main-hand weapon use") passes every positive case below and only the
 * negatives can tell the two apart. The rng always says yes and Rend is always
 * up, so the only thing deciding the answer is the attack.
 * ==============================================================================
 */

const reaction = bloodthrill(100);
const context = { rng: { rollChance: () => true } } as never;
const rendUp = { auras: { has: (id: string) => id === 'rend' } };

function attack(fields: { abilityId?: string; attackTable: string; weaponSlot?: string }) {
  return { defender: rendUp, outcome: 'hit', ...fields } as never;
}

function rolls(fields: Parameters<typeof attack>[0]): boolean {
  return reaction.canTrigger!(context, {} as never, attack(fields));
}

describe('Bloodthrill', () => {
  it('rolls on a main-hand swing, which is also what an extra attack is', () => {
    expect(rolls({ attackTable: 'melee-auto', weaponSlot: 'mainHand' })).toBe(true);
  });

  it('rolls on Heroic Strike and Cleave', () => {
    for (const abilityId of ['heroic_strike', 'cleave']) {
      expect(rolls({ abilityId, attackTable: 'melee-special', weaponSlot: 'mainHand' }), abilityId).toBe(true);
    }
  });

  it('no longer rolls on the other main-hand strikes', () => {
    for (const abilityId of ['mortal_strike', 'slam', 'overpower', 'whirlwind', 'execute', 'bloodthirst', 'spearing_strike']) {
      expect(rolls({ abilityId, attackTable: 'melee-special', weaponSlot: 'mainHand' }), abilityId).toBe(false);
    }
  });

  it('does not roll on an off-hand swing, nor without Rend', () => {
    expect(rolls({ attackTable: 'melee-auto', weaponSlot: 'offHand' })).toBe(false);
    const noRend = { defender: { auras: { has: () => false } }, attackTable: 'melee-auto', weaponSlot: 'mainHand' };
    expect(reaction.canTrigger!(context, {} as never, noRend as never)).toBe(false);
  });
});
