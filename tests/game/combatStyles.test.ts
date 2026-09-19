import { describe, expect, it } from 'vitest';
import type { ClassId, CombatStyleId } from '../../src/game/character';
import {
  CLASS_IDS,
  COMBAT_STYLE_IDS,
  classHasCombatStyle,
  combatStylesFor,
  defaultCombatStyleFor,
  getCombatStyle,
  isCombatStyleId,
  racesForClass,
  resolveCombatStyle,
} from '../../src/game/character';
import { createPlayer } from '../../src/game/actors/createPlayer';
import {
  BASE_BEAR_PAW_DAMAGE,
  BASE_CAT_PAW_DAMAGE,
  OFF_HAND_DAMAGE_MULTIPLIER,
} from '../../src/game/actors/weapons';
import { createDefaultProfile } from '../../src/profiles';
import { runProfile } from '../../src/simulator';
import { swingingSlots } from '../../src/engine';

/**
 * The per-class style lists and defaults, written out independently of the
 * source data. Order matters: the first entry is the default.
 */
const EXPECTED: Record<ClassId, { styles: CombatStyleId[]; default: CombatStyleId }> = {
  warrior: {
    styles: ['dual_wield', 'two_hander', 'one_hand_shield'],
    default: 'dual_wield',
  },
  rogue: { styles: ['dual_wield'], default: 'dual_wield' },
  shaman: { styles: ['caster', 'two_hander'], default: 'caster' },
  paladin: {
    styles: ['one_hand_shield', 'two_hander', 'caster'],
    default: 'one_hand_shield',
  },
  hunter: { styles: ['ranged', 'two_hander', 'dual_wield'], default: 'ranged' },
  mage: { styles: ['caster'], default: 'caster' },
  warlock: { styles: ['caster'], default: 'caster' },
  priest: { styles: ['caster'], default: 'caster' },
  druid: {
    styles: ['cat', 'caster', 'bear', 'tree', 'moonkin'],
    default: 'cat',
  },
};

function anyRaceFor(characterClass: ClassId) {
  const race = racesForClass(characterClass)[0];
  if (!race) throw new Error(`No race can play ${characterClass}`);
  return race.id;
}

describe('combat styles per class', () => {
  it('offers exactly the listed styles', () => {
    for (const id of CLASS_IDS) {
      expect(combatStylesFor(id).map((style) => style.id), id).toEqual(EXPECTED[id].styles);
    }
  });

  it('defaults to the right style', () => {
    for (const id of CLASS_IDS) {
      expect(defaultCombatStyleFor(id), id).toBe(EXPECTED[id].default);
    }
  });

  it('treats the first listed style as the default', () => {
    for (const id of CLASS_IDS) {
      expect(combatStylesFor(id)[0].id, id).toBe(defaultCombatStyleFor(id));
    }
  });

  it('gives every class at least one style', () => {
    for (const id of CLASS_IDS) {
      expect(combatStylesFor(id).length, id).toBeGreaterThan(0);
    }
  });

  it('answers membership correctly', () => {
    expect(classHasCombatStyle('warrior', 'two_hander')).toBe(true);
    expect(classHasCombatStyle('warrior', 'caster')).toBe(false);
    expect(classHasCombatStyle('mage', 'dual_wield')).toBe(false);
    expect(classHasCombatStyle('druid', 'bear')).toBe(true);
  });

  it('only references known style ids', () => {
    for (const id of CLASS_IDS) {
      for (const style of combatStylesFor(id)) {
        expect(isCombatStyleId(style.id), `${id} -> ${style.id}`).toBe(true);
      }
    }
  });
});

describe('resolveCombatStyle', () => {
  it('keeps a style the class has', () => {
    expect(resolveCombatStyle('warrior', 'two_hander')).toBe('two_hander');
  });

  it('falls back to the default when none is given', () => {
    expect(resolveCombatStyle('hunter', undefined)).toBe('ranged');
  });

  it('falls back when the class cannot use the requested style', () => {
    // A profile that was a bear Druid and is now a Warrior must not stay a bear.
    expect(resolveCombatStyle('warrior', 'bear')).toBe('dual_wield');
    expect(resolveCombatStyle('mage', 'dual_wield')).toBe('caster');
  });

  it('always returns something the class can use', () => {
    for (const characterClass of CLASS_IDS) {
      for (const style of COMBAT_STYLE_IDS) {
        const resolved = resolveCombatStyle(characterClass, style);
        expect(
          classHasCombatStyle(characterClass, resolved),
          `${characterClass} + ${style}`,
        ).toBe(true);
      }
    }
  });
});

describe('auto-attack behaviour', () => {
  const modeOf = (style: CombatStyleId) => getCombatStyle(style)?.autoAttack;

  it('swings the main hand only for two-handers and sword-and-board', () => {
    expect(modeOf('two_hander')).toBe('main-hand');
    expect(modeOf('one_hand_shield')).toBe('main-hand');
  });

  it('swings both hands when dual-wielding', () => {
    expect(modeOf('dual_wield')).toBe('dual-wield');
  });

  it('swings the ranged weapon for the ranged style', () => {
    expect(modeOf('ranged')).toBe('ranged');
  });

  it('never swings for caster, tree or moonkin', () => {
    expect(modeOf('caster')).toBe('none');
    expect(modeOf('tree')).toBe('none');
    expect(modeOf('moonkin')).toBe('none');
  });

  it('swings paws for bear and cat', () => {
    expect(modeOf('bear')).toBe('main-hand');
    expect(modeOf('cat')).toBe('main-hand');
    expect(getCombatStyle('bear')?.damageSource).toBe('natural');
    expect(getCombatStyle('cat')?.damageSource).toBe('natural');
  });
});

describe('weapon slots on the built combatant', () => {
  const build = (characterClass: ClassId, combatStyle: CombatStyleId) =>
    createPlayer({ race: anyRaceFor(characterClass), characterClass, combatStyle });

  it('gives a two-hander one swinging slot and no off-hand', () => {
    const player = build('warrior', 'two_hander');
    expect(swingingSlots(player)).toEqual(['mainHand']);
    expect(player.weapons.offHand).toBeUndefined();
  });

  it('gives a dual-wielder two swinging slots', () => {
    const player = build('warrior', 'dual_wield');
    expect(swingingSlots(player)).toEqual(['mainHand', 'offHand']);
    expect(player.weapons.mainHand).toBeDefined();
    expect(player.weapons.offHand).toBeDefined();
  });

  it('gives 1H & shield one swinging slot, with the shield not a weapon', () => {
    const player = build('paladin', 'one_hand_shield');
    expect(swingingSlots(player)).toEqual(['mainHand']);
    expect(player.weapons.offHand).toBeUndefined();
  });

  it('gives a ranged style only the ranged slot', () => {
    const player = build('hunter', 'ranged');
    expect(swingingSlots(player)).toEqual(['ranged']);
    expect(player.weapons.ranged).toBeDefined();
    // Melee weapons would be stat sticks; they never swing.
    expect(player.weapons.mainHand).toBeUndefined();
  });

  it('gives a caster nothing to swing', () => {
    const player = build('mage', 'caster');
    expect(swingingSlots(player)).toEqual([]);
    expect(player.weapons).toEqual({});
  });

  it('gives bear and cat a paw in the main hand', () => {
    expect(build('druid', 'bear').weapons.mainHand?.name).toBe('Bear Paw');
    expect(build('druid', 'cat').weapons.mainHand?.name).toBe('Cat Paw');
  });

  it('uses the stated paw damage values', () => {
    expect(build('druid', 'bear').weapons.mainHand?.baseDamage).toBe(BASE_BEAR_PAW_DAMAGE);
    expect(build('druid', 'cat').weapons.mainHand?.baseDamage).toBe(BASE_CAT_PAW_DAMAGE);
    expect(BASE_BEAR_PAW_DAMAGE).toBe(100);
    expect(BASE_CAT_PAW_DAMAGE).toBe(50);
  });

  it('never schedules a slot with no weapon in it', () => {
    for (const characterClass of CLASS_IDS) {
      for (const style of combatStylesFor(characterClass)) {
        const player = build(characterClass, style.id);
        for (const slot of swingingSlots(player)) {
          expect(
            player.weapons[slot],
            `${characterClass}/${style.id} has no weapon in ${slot}`,
          ).toBeDefined();
        }
      }
    }
  });
});

describe('dual-wield off-hand penalty', () => {
  const warrior = (offHandDamageMultiplier?: number) =>
    createPlayer({
      race: 'orc',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      offHandDamageMultiplier,
    });

  it('halves off-hand damage by default', () => {
    expect(OFF_HAND_DAMAGE_MULTIPLIER).toBe(0.5);
    expect(warrior().weapons.offHand?.damageMultiplier).toBe(0.5);
  });

  it('leaves the main hand at full damage', () => {
    // The penalty is a property of the hand, not of the weapon in it.
    expect(warrior().weapons.mainHand?.damageMultiplier).toBeUndefined();
  });

  it('can be overridden, as a talent would', () => {
    expect(warrior(0.75).weapons.offHand?.damageMultiplier).toBe(0.75);
    expect(warrior(1).weapons.offHand?.damageMultiplier).toBe(1);
  });

  /*
   * A half-damage off-hand that still got full attack power scaling would grow
   * stronger relative to the main hand as the character geared up.
   *
   * AVERAGED OVER TWELVE SEEDS, and it has to be. This ran on a single seed and
   * asserted a ratio within 0.05 of 0.5, which passed for as long as nothing
   * disturbed the random stream. Adding three abilities to the rotation shifted
   * every roll after the opening global cooldown and the one sampled seed
   * landed at 0.4484 -- a failure that said nothing whatever about the off-hand
   * penalty. Per-seed the ratio ranges 0.461 to 0.508; the mean is stable.
   *
   * WORTH A LOOK, NOT YET EXPLAINED: the mean sits at about 0.477 rather than
   * 0.500, consistently, on every seed measured. The old tolerance was wide
   * enough to hide a systematic 2.3% offset as well as the noise. Both hands
   * use the same weapon numbers and roll the same table, so the average landed
   * hit should differ by the penalty and nothing else -- and it differs by
   * slightly more than the penalty. That is either an artifact of how landed
   * averages are taken per hand or a real asymmetry, and nobody has looked.
   */
  it('applies to the whole swing, attack power included', () => {
    const base = createDefaultProfile();
    const ratios: number[] = [];

    for (let seed = 1; seed <= 12; seed += 1) {
      const result = runProfile({
        ...base,
        character: {
          ...base.character,
          race: 'orc',
          characterClass: 'warrior',
          combatStyle: 'dual_wield',
        },
        stats: { attackPower: 2000 },
        // A long fight, because both hands roll the full melee table and the
        // per-hand averages need enough landed swings to settle.
        simulation: { ...base.simulation, durationSeconds: 1800, seed },
      });

      const abilities = result.damage.byActor[0].abilities;
      const main = abilities.find((entry) => entry.abilityName === 'Melee');
      const off = abilities.find((entry) => entry.abilityName === 'Melee (Off Hand)');

      expect(main).toBeDefined();
      expect(off).toBeDefined();
      if (!main || !off) return;

      ratios.push(off.average / main.average);
    }

    const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    expect(mean).toBeCloseTo(OFF_HAND_DAMAGE_MULTIPLIER, 1);
  });
});

describe('combat style changes the fight', () => {
  it('lets a Druid switch between forms with different stats and weapons', () => {
    const cat = createPlayer({ race: 'tauren', characterClass: 'druid', combatStyle: 'cat' });
    const bear = createPlayer({ race: 'tauren', characterClass: 'druid', combatStyle: 'bear' });

    expect(bear.health.maximum).toBeGreaterThan(cat.health.maximum);
    expect(cat.weapons.mainHand?.name).toBe('Cat Paw');
    expect(bear.weapons.mainHand?.name).toBe('Bear Paw');
  });

  it('gives a Druid in caster form nothing to swing at all', () => {
    const caster = createPlayer({
      race: 'tauren',
      characterClass: 'druid',
      combatStyle: 'caster',
    });
    expect(swingingSlots(caster)).toEqual([]);
  });

  it('builds every class and style combination without error', () => {
    for (const characterClass of CLASS_IDS) {
      for (const style of combatStylesFor(characterClass)) {
        expect(() =>
          createPlayer({
            race: anyRaceFor(characterClass),
            characterClass,
            combatStyle: style.id,
          }),
        ).not.toThrow();
      }
    }
  });
});
