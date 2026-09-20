import { describe, expect, it } from 'vitest';
import { runProfile } from '../../src/simulator';
import { createDefaultProfile } from '../../src/profiles';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import type { CombatStyleId } from '../../src/game/character';
import { legalise } from '../helpers/legalTalents';

/*
 * NOTHING GRANTS A TALENT-GATED ABILITY TO A CHARACTER WITHOUT THE TALENT.
 *
 * Three separate things could break this, and each is checked here rather than
 * trusted:
 *
 *   1. `abilitiesForClass` could hand the ability over.
 *   2. The action priority list names every ability in one list, so a build
 *      without the talent could still reach the entry.
 *   3. `createPlayer` strips illegal talents -- so a build that LOOKS like it
 *      has the talent, but has not met its tier or prerequisite, must also be
 *      refused.
 *
 * The first two have tests elsewhere; the third is new, and it is the one that
 * was broken. A priority list is a statement of preference and not a grant, and
 * this pins that.
 */

/** Every ability some talent hands out, taken from the effect table itself. */
const GRANTED: readonly string[] = Object.values(WARRIOR_TALENT_EFFECTS)
  .flatMap((effects) => effects as ReadonlyArray<{ kind: string; abilityId?: string }>)
  .filter((effect) => effect.kind === 'grantAbility')
  .map((effect) => effect.abilityId!)
  .filter((id, index, all) => all.indexOf(id) === index);

const STYLES: readonly CombatStyleId[] = ['dual_wield', 'two_hander', 'one_hand_shield'];

function fight(style: CombatStyleId, talents: Record<string, number>, attacks = false) {
  const base = createDefaultProfile();
  return runProfile({
    ...base,
    character: { ...base.character, combatStyle: style },
    equipment: startingEquipmentFor('warrior', style),
    talents,
    simulation: { ...base.simulation, seed: 4, durationSeconds: 180 },
    encounter: { ...base.encounter, targetAttacks: attacks },
  } as never);
}

describe('the ability book never contains an unearned talent ability', () => {
  it('finds the granted abilities, so this test is not vacuous', () => {
    // Nine talents grant an ability. If this drops, the loops below stop
    // checking anything and would pass in silence.
    expect(GRANTED.length).toBeGreaterThanOrEqual(9);
  });

  for (const style of STYLES) {
    it(`gives a talentless ${style} warrior none of them`, () => {
      const ids = abilitiesForClass('warrior', style, {}).map((a) => a.id);
      for (const granted of GRANTED) expect(ids).not.toContain(granted);
    });
  }

  for (const granted of GRANTED) {
    it(`refuses ${granted} to a build that has not earned its talent`, () => {
      /*
       * One point in the granting talent and nothing else. Every one of these
       * is gated behind a tier the build has not reached, a prerequisite it
       * does not have, or both -- so the allocation is illegal and the ability
       * must not appear.
       */
      const talentId = Object.entries(WARRIOR_TALENT_EFFECTS).find(([, effects]) =>
        (effects as ReadonlyArray<{ kind: string; abilityId?: string }>).some(
          (e) => e.kind === 'grantAbility' && e.abilityId === granted,
        ),
      )![0];

      const ids = abilitiesForClass('warrior', 'one_hand_shield', { [talentId]: 1 }).map(
        (a) => a.id,
      );
      expect(ids).not.toContain(granted);
    });
  }
});

describe('the priority list never casts what the character does not know', () => {
  for (const style of STYLES) {
    it(`a talentless ${style} warrior casts no talent ability in a real fight`, () => {
      const log = fight(style, {}).combatLog;
      const cast = log.filter((line) => line.includes('casts '));
      for (const granted of GRANTED) {
        // Ability ids are snake_case; the log prints names. Matching on the id
        // with underscores turned into spaces catches every one of them.
        const name = granted.replace(/_cast$/, '').replace(/_/g, ' ');
        expect(cast.some((line) => line.toLowerCase().includes(`casts ${name}`))).toBe(false);
      }
    });
  }

  it('casts Mortal Strike once the talent is legally taken', () => {
    // The other side of the same coin: gating that refuses everything would
    // pass every assertion above and be useless.
    const log = fight('dual_wield', legalise({ mortal_strike: 1 })).combatLog;
    expect(log.some((line) => line.includes('casts Mortal Strike'))).toBe(true);
  });

  it('does not cast Mortal Strike when the prerequisite is missing', () => {
    const illegal = { ...legalise({ mortal_strike: 1 }), sweeping_strikes: 0 };
    const log = fight('dual_wield', illegal).combatLog;
    expect(log.some((line) => line.includes('casts Mortal Strike'))).toBe(false);
  });
});
