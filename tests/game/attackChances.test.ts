import { describe, expect, it } from 'vitest';
import { toRollUnits } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { BASE_CHANCES, createForeverAttackChances } from '../../src/game/combat/attackChances';
import type { CombatStyleId } from '../../src/game/character';

const dummy = () => createTrainingDummy();

function warrior(combatStyle: CombatStyleId) {
  return createPlayer({ race: 'orc', characterClass: 'warrior', combatStyle });
}

/** Provider that reports one fixed style for the player. */
function providerFor(style: CombatStyleId) {
  return createForeverAttackChances(() => style);
}

describe('Forever base chances', () => {
  it('matches the stated values', () => {
    expect(BASE_CHANCES.meleeMiss).toBe(8);
    expect(BASE_CHANCES.rangedMiss).toBe(8);
    expect(BASE_CHANCES.spellMiss).toBe(17);
    expect(BASE_CHANCES.dualWieldMissPenalty).toBe(19);
    expect(BASE_CHANCES.enemyDodge).toBe(6.5);
    expect(BASE_CHANCES.enemyParry).toBe(14);
    expect(BASE_CHANCES.glance).toBe(40);
    expect(BASE_CHANCES.glanceMultiplier).toBe(0.7);
    expect(BASE_CHANCES.meleeCritMultiplier).toBe(2);
    expect(BASE_CHANCES.spellCritMultiplier).toBe(1.5);
    expect(BASE_CHANCES.bossMiss).toBe(5);
    expect(BASE_CHANCES.bossCrush).toBe(15);
    expect(BASE_CHANCES.bossCrushMultiplier).toBe(1.5);
    expect(BASE_CHANCES.bossCrit).toBe(5);
  });
});

describe('melee auto-attack chances', () => {
  it('uses the base 8% miss when not dual-wielding', () => {
    const chances = providerFor('two_hander')('melee-auto', warrior('two_hander'), dummy());
    expect(chances.miss).toBe(toRollUnits(8));
  });

  it('adds the full 19% penalty to a dual-wielder, not half of it', () => {
    // The penalty applies to BOTH weapons at full strength: 8 + 19 = 27%.
    const chances = providerFor('dual_wield')('melee-auto', warrior('dual_wield'), dummy());
    expect(chances.miss).toBe(toRollUnits(27));
  });

  it('includes dodge and glancing blows', () => {
    const chances = providerFor('two_hander')('melee-auto', warrior('two_hander'), dummy());
    expect(chances.dodge).toBe(toRollUnits(6.5));
    expect(chances.glance).toBe(toRollUnits(40));
    expect(chances.glanceMultiplier).toBe(0.7);
  });

  it('crits for 2x', () => {
    const chances = providerFor('two_hander')('melee-auto', warrior('two_hander'), dummy());
    expect(chances.critMultiplier).toBe(2);
  });
});

describe('enemy parry', () => {
  it('applies only when the character is using 1H & Shield', () => {
    const shielded = providerFor('one_hand_shield')(
      'melee-auto',
      warrior('one_hand_shield'),
      dummy(),
    );
    expect(shielded.parry).toBe(toRollUnits(14));
  });

  it('is zero for every other style', () => {
    for (const style of ['two_hander', 'dual_wield'] as CombatStyleId[]) {
      const chances = providerFor(style)('melee-auto', warrior(style), dummy());
      expect(chances.parry, style).toBe(0);
    }
  });

  it('is zero when the style is unknown', () => {
    // A combatant the provider has no style for, such as an enemy.
    const chances = createForeverAttackChances()('melee-auto', warrior('two_hander'), dummy());
    expect(chances.parry).toBe(0);
  });

  it('applies to melee specials too', () => {
    const chances = providerFor('one_hand_shield')(
      'melee-special',
      warrior('one_hand_shield'),
      dummy(),
    );
    expect(chances.parry).toBe(toRollUnits(14));
  });
});

describe('melee special attack chances', () => {
  it('never carries the dual-wield miss penalty', () => {
    // A special is one strike, not one per hand, so it misses at the base rate
    // even for a dual-wielder.
    const chances = providerFor('dual_wield')('melee-special', warrior('dual_wield'), dummy());
    expect(chances.miss).toBe(toRollUnits(8));
  });

  it('has no glancing blow', () => {
    const chances = providerFor('two_hander')('melee-special', warrior('two_hander'), dummy());
    expect(chances.glance).toBe(0);
  });
});

describe('ranged chances', () => {
  const hunter = createPlayer({
    race: 'dwarf',
    characterClass: 'hunter',
    combatStyle: 'ranged',
  });

  it('misses at 8% with no dodge, parry or glance', () => {
    const chances = providerFor('ranged')('ranged-auto', hunter, dummy());
    expect(chances.miss).toBe(toRollUnits(8));
    expect(chances.dodge).toBe(0);
    expect(chances.parry).toBe(0);
    expect(chances.glance).toBe(0);
  });

  it('never carries the dual-wield penalty, even for a dual-wielding hunter', () => {
    const dwHunter = createPlayer({
      race: 'dwarf',
      characterClass: 'hunter',
      combatStyle: 'dual_wield',
    });
    const chances = providerFor('dual_wield')('ranged-auto', dwHunter, dummy());
    expect(chances.miss).toBe(toRollUnits(8));
  });
});

describe('spell chances', () => {
  const mage = createPlayer({ race: 'gnome', characterClass: 'mage' });

  it('misses at 17%', () => {
    const chances = providerFor('caster')('spell', mage, dummy());
    expect(chances.miss).toBe(toRollUnits(17));
  });

  it('crits for 1.5x using spell crit, not melee crit', () => {
    const chances = providerFor('caster')('spell', mage, dummy());
    expect(chances.critMultiplier).toBe(1.5);
    expect(chances.crit).toBe(toRollUnits(mage.stats.get('spellCritChance')));
    // A Gnome Mage has real spell crit from intellect but no melee crit at all.
    expect(chances.crit).toBeGreaterThan(0);
    expect(mage.stats.get('critChance')).toBe(0);
  });

  it('cannot be dodged or parried', () => {
    const chances = providerFor('caster')('spell', mage, dummy());
    expect(chances.dodge).toBe(0);
    expect(chances.parry).toBe(0);
  });
});

describe('attacks received by the player', () => {
  const player = warrior('one_hand_shield');

  it('uses the boss miss, crush and crit rates', () => {
    const chances = providerFor('one_hand_shield')('melee-received', dummy(), player);
    expect(chances.miss).toBe(toRollUnits(5));
    expect(chances.crush).toBe(toRollUnits(15));
    expect(chances.crushMultiplier).toBe(1.5);
    expect(chances.crit).toBe(toRollUnits(5));
    expect(chances.critMultiplier).toBe(2);
  });

  it('takes dodge from the defender agility conversion', () => {
    const chances = providerFor('one_hand_shield')('melee-received', dummy(), player);
    expect(chances.dodge).toBe(toRollUnits(player.stats.get('dodgeChance')));
  });

  it('leaves player parry at zero rather than guessing', () => {
    // MISSING DATA: player parry depends on a defense stat and on talents,
    // neither of which exists yet.
    const chances = providerFor('one_hand_shield')('melee-received', dummy(), player);
    expect(chances.parry).toBe(0);
  });
});

describe('crit chance comes from the character', () => {
  it('reflects the attacker stats rather than a fixed number', () => {
    const plain = warrior('two_hander');
    const geared = createPlayer({
      race: 'orc',
      characterClass: 'warrior',
      combatStyle: 'two_hander',
      bonusStats: { agility: 400 },
    });

    const provider = providerFor('two_hander');
    const plainChances = provider('melee-auto', plain, dummy());
    const gearedChances = provider('melee-auto', geared, dummy());

    // 400 agility at 20 per 1% is another 20% crit.
    expect(gearedChances.crit).toBeGreaterThan(plainChances.crit);
    expect(gearedChances.crit - plainChances.crit).toBe(toRollUnits(20));
  });
});
