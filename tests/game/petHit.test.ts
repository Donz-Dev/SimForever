import { describe, expect, it } from 'vitest';
import { createPet } from '../../src/game/actors/createPet';
import { createDemon } from '../../src/game/actors/createDemon';
import { hunterPetHit, warlockDemonHit } from '../../src/game/actors/petHit';
import { createForeverAttackChances } from '../../src/game/combat/attackChances';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { characterAtCombatStart } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';

/*
 * ==============================================================================
 * A PET'S HIT, BY THE OWNER'S ROUND 51 RULE: "Hunter's give their pets melee
 * hit equal to their ranged hit, and ... spell hit equal to 17/8ths of their
 * ranged hit. Warlocks give their pets spell hit equal to their spell hit, and
 * ... melee hit equal to 8/17ths of their spell hit."
 *
 * The ratios are written out by hand here, and the join is asserted on the
 * built pets' ROLLS -- the chance provider the fight uses -- because a hit
 * figure that sits on the stat block and never reaches a table is the
 * `armorPenetration` failure.
 * ==============================================================================
 */

const BOSS = createTrainingDummy({ armor: 3731, level: 63 });
const chances = createForeverAttackChances({ targetAttacks: false });

describe('the arithmetic', () => {
  it('gives a Hunter pet the ranged hit on melee and 17/8 of it on spells', () => {
    const hit = hunterPetHit(8);
    expect(hit.hitChance).toBe(8);
    expect(hit.attackTableModifiers.for('spell').hitBonus).toBeCloseTo(17 - 8, 10);
  });

  it('gives a demon the spell hit on spells and 8/17 of it on melee', () => {
    const hit = warlockDemonHit(17);
    expect(hit.hitChance).toBeCloseTo(8, 10);
    expect(hit.attackTableModifiers.for('spell').hitBonus).toBeCloseTo(17 - 8, 10);
    // And a partial owner scales the same way: 8.5 spell is 4 melee.
    expect(warlockDemonHit(8.5).hitChance).toBeCloseTo(4, 10);
  });
});

describe('on the built pets', () => {
  it('reaches a BM Hunter pet, which inherited no hit at all before', () => {
    const owner = characterAtCombatStart(PRESETS_BY_ID.get('bm_hunter')!.build())!;
    const ranged = owner.stats.effective.hitChance + owner.hitBonusFor('ranged');
    expect(ranged).toBeGreaterThan(0);
    const pet = createPet({ owner, family: 'cat' });
    expect(pet.stats.effective.hitChance).toBeCloseTo(ranged, 10);
    expect(pet.attackTableModifiers.for('spell').hitBonus).toBeCloseTo((ranged * 17) / 8 - ranged, 10);
    // The melee table it rolls on sees the inherited hit.
    const bare = createPet({ owner: characterAtCombatStart({
      ...PRESETS_BY_ID.get('bm_hunter')!.build(),
      equipment: {},
    })!, family: 'cat' });
    expect(chances('melee-special', pet, BOSS, { slot: 'mainHand' }).miss).toBeLessThan(
      chances('melee-special', bare, BOSS, { slot: 'mainHand' }).miss,
    );
  });

  it('puts a Warlock demon at 8/17 of its owner on melee', () => {
    const owner = characterAtCombatStart(PRESETS_BY_ID.get('warlock_firelock')!.build())!;
    const spell = owner.stats.effective.hitChance;
    expect(spell).toBeGreaterThan(0);
    const succubus = createDemon({ owner, demon: 'succubus' });
    expect(succubus.stats.effective.hitChance).toBeCloseTo((spell * 8) / 17, 10);
    expect(succubus.stats.effective.hitChance + (succubus.attackTableModifiers.for('spell').hitBonus ?? 0))
      .toBeCloseTo(spell, 10);
  });
});
