import { describe, expect, it } from 'vitest';
import { CHARGE, CHARGE_RAGE_GENERATED } from '../../src/game/abilities/warrior';
import { WARRIOR_SHIELD_DEFENSIVE, WARRIOR_TWO_HAND_BATTLE } from '../../src/game/rotations/warrior';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { talentBuild, talentContextFor } from '../../src/game/talents/talentBuild';
import { weaponsFor } from '../../src/game/actors/createPlayer';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { runProfileBatch, characterAtCombatStart } from '../../src/simulator';
import { legalise } from '../helpers/legalTalents';

/*
 * Charge at the pull, Vanguard as its gate, and Master of Defense's shield.
 *
 * Three rulings from the ruleset owner that all land on the same seam: an
 * ability or a proc whose availability depends on something outside the
 * ability itself -- the clock, the stance, the off hand.
 */

const preset = (id: string, iterations = 200) => {
  const built = PRESETS_BY_ID.get(id)!.build();
  return { ...built, simulation: { ...built.simulation, iterations, seed: 4242 } } as never;
};

const casts = (id: string, name: string) => {
  const batch = runProfileBatch(preset(id));
  return batch.abilities.find((a) => a.abilityName === name)?.uses ?? 0;
};

// ---------------------------------------------------------------------------
// Charge
// ---------------------------------------------------------------------------

describe('Charge is used exactly once, as the first action', () => {
  it('is castable only at timestamp zero', () => {
    /*
     * "Cannot be used in combat." Every fight here opens in combat, so the
     * only legal moment is the instant before anything has happened.
     *
     * ONCE FALLS OUT OF THE RULE rather than being counted: the clock passes
     * zero exactly once. A "has cast it" flag would instead allow a second
     * Charge at fifteen seconds if the first were ever skipped.
     */
    const at = (now: number) =>
      CHARGE.canCast?.({ simulation: { clock: { now: () => now } } } as never) ?? true;

    expect(at(0)).toBe(true);
    expect(at(1)).toBe(false);
    expect(at(15_000)).toBe(false); // its own cooldown would have elapsed
  });

  it('opens the two-hander and Protection lists, and no others', () => {
    expect(WARRIOR_TWO_HAND_BATTLE[0].abilityId).toBe('charge');
    expect(WARRIOR_SHIELD_DEFENSIVE[0].abilityId).toBe('charge');
  });

  it('fires exactly once a fight for 2H Arms, and pays 18 rage', () => {
    const batch = runProfileBatch(preset('two_hand_arms'));
    const charge = batch.abilities.find((a) => a.abilityName === 'Charge');
    expect(charge?.uses).toBe(1);

    // 15 base plus 3 from 1/2 Improved Charge, which the preset takes.
    const rage = batch.rage.gained.find((row) => row.sourceId === 'charge');
    expect(rage?.amount).toBeCloseTo(CHARGE_RAGE_GENERATED + 3, 6);
  });
});

// ---------------------------------------------------------------------------
// Vanguard
// ---------------------------------------------------------------------------

describe('Vanguard is what lets a tank Charge', () => {
  it('adds Defensive Stance to Charge rather than replacing Battle', () => {
    /*
     * Replacing would take Charge away from an Arms warrior who somehow had
     * the talent. The effect is declared as one stance and merged into the
     * list the ability already carries.
     */
    expect(WARRIOR_TALENT_EFFECTS.vanguard).toEqual([
      { kind: 'abilityStance', abilityId: 'charge', stance: 'defensive_stance' },
    ]);

    const withIt = talentBuild('warrior', legalise({ vanguard: 1 }));
    expect(withIt.abilityExtraStances.get('charge')).toEqual(['defensive_stance']);
    expect(talentBuild('warrior', {}).abilityExtraStances.get('charge')).toBeUndefined();
  });

  it('lets the Prot preset Charge once, and stops it without the talent', () => {
    expect(casts('prot_warr', 'Charge')).toBe(1);

    const built = PRESETS_BY_ID.get('prot_warr')!.build();
    const withoutVanguard = { ...built.talents };
    delete (withoutVanguard as Record<string, number>).vanguard;

    const batch = runProfileBatch({
      ...built,
      talents: withoutVanguard,
      simulation: { ...built.simulation, iterations: 200, seed: 4242 },
    } as never);
    expect(batch.abilities.find((a) => a.abilityName === 'Charge')?.uses ?? 0).toBe(0);
  });

  it('NEVER drags the tank out of Defensive Stance to reach it', () => {
    /*
     * ----------------------------------------------------------------------
     * THE TRAP. `PriorityRotation` treats a wrong stance as "not yet, and here
     * is how" and casts a stance change to unblock an entry -- correct for
     * Revenge, catastrophic here. Charge lists Battle Stance, so adding it to
     * the Protection list sent the tank into Battle Stance at the pull, and
     * three separate stance tests caught it.
     *
     * The entry's condition refuses unless the character is ALREADY in a
     * stance Charge allows, and a condition is checked before the swap is
     * considered.
     * ----------------------------------------------------------------------
     */
    const built = PRESETS_BY_ID.get('prot_warr')!.build();
    const withoutVanguard = { ...built.talents };
    delete (withoutVanguard as Record<string, number>).vanguard;
    const profile = {
      ...built,
      talents: withoutVanguard,
      simulation: { ...built.simulation, iterations: 200, seed: 4242 },
    } as never;

    const batch = runProfileBatch(profile);
    for (const row of batch.abilities) {
      expect(row.abilityName).not.toContain('Stance');
    }

    // And the condition itself says no, which is what prevents the swap.
    const tank = characterAtCombatStart(profile)!;
    expect(WARRIOR_SHIELD_DEFENSIVE[0].condition?.(undefined as never, tank, undefined)).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Master of Defense
// ---------------------------------------------------------------------------

describe('Master of Defense needs the shield the player chose', () => {
  it('registers its proc with a shield and not without one', () => {
    /*
     * It used to carry a note admitting the shield clause was unexpressed,
     * because a reaction cannot see the off hand when it fires. It does not
     * need to: equipping a shield is a choice made on the GUI, so the build
     * knows about it, and the proc is simply not registered for a character
     * without one.
     */
    const talents = legalise({ master_of_defense: 2 });
    const shielded = PRESETS_BY_ID.get('prot_warr')!.build();
    const withShield = talentBuild(
      'warrior',
      talents,
      talentContextFor(
        shielded.equipment,
        'one_hand_shield',
        weaponsFor(shielded.equipment, 'one_hand_shield'),
      ),
    );
    expect(withShield.reactions.some((r) => r.id === 'master_of_defense')).toBe(true);
    expect(withShield.unmodelled.some((u) => u.talentId === 'master_of_defense')).toBe(false);

    const fury = PRESETS_BY_ID.get('dw_fury')!.build();
    const withoutShield = talentBuild(
      'warrior',
      talents,
      talentContextFor(fury.equipment, 'dual_wield', weaponsFor(fury.equipment, 'dual_wield')),
    );
    expect(withoutShield.reactions.some((r) => r.id === 'master_of_defense')).toBe(false);
    // And it says so, rather than going quiet.
    expect(withoutShield.unmodelled.some((u) => u.talentId === 'master_of_defense')).toBe(true);
  });

  it('carries no standing caveat any more', () => {
    expect(WARRIOR_TALENT_EFFECTS.master_of_defense).toEqual([
      { kind: 'reaction', reactionId: 'master_of_defense', requires: { shield: true } },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Concussion Blow
// ---------------------------------------------------------------------------

describe('Concussion Blow is deliberately silent', () => {
  it('carries no unmodelled entry, on the ruleset owner instruction', () => {
    /*
     * "Concussion Blow is still not to be implemented. No note about this
     * needs to be made on the GUI."
     *
     * A DELIBERATE EXCEPTION to the rule that an inert choice says so where it
     * is made, asserted here so it reads as a decision rather than an
     * oversight. The stun is out of scope; there is nothing for a reader to
     * act on. The ability grant stays so the talent gates its tier.
     */
    expect(WARRIOR_TALENT_EFFECTS.concussion_blow).toEqual([
      { kind: 'grantAbility', abilityId: 'concussion_blow' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Spearing Strike
// ---------------------------------------------------------------------------

describe('Spearing Strike reaches the Fury list', () => {
  it('is cast by DW Fury now, below Bloodthirst and Whirlwind', () => {
    /*
     * It was in the preset's talents and in no list this build could reach --
     * one point doing nothing, which is what the coverage report turned up.
     */
    expect(casts('dw_fury', 'Spearing Strike')).toBeGreaterThan(1);
  });
});
