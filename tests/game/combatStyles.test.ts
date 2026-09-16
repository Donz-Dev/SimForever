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
