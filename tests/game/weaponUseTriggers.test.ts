import { describe, expect, it } from 'vitest';
import type { AttackEvent, Combatant, SimulationContext, WeaponSlot } from '../../src/engine';
import { isWeaponUse, isWeaponUseOf } from '../../src/engine';
import { handOfJusticeReaction } from '../../src/game/items/procs';
import { windfuryTotemReaction } from '../../src/game/buffs/windfury';
import { WARRIOR_TALENT_REACTIONS } from '../../src/game/reactions/warriorTalents';
import { WARRIOR_ABILITIES } from '../../src/game/abilities/warrior';

/*
 * ----------------------------------------------------------------------------
 * WHAT TRIGGERS AN EXTRA ATTACK, AND WHAT DOES NOT.
 *
 * Extra attacks are a headline feature of Forever and of Classic, and four
 * separate effects in this project decide independently whether they fire.
 * Before this file existed they disagreed, because each one re-derived the
 * rule in its own file and two got it wrong.
 *
 * THE RULESET, from the ruleset owner:
 *
 *   A "use" of a weapon is a SWING OR AN ABILITY -- anything that goes through
 *   a combat table and needs that weapon. Bloodthirst, Mortal Strike, Rend and
 *   Heroic Strike are all main-hand uses. Thunder Clap is not, because it
 *   needs no melee weapon.
 *
 *   A WEAPON-BOUND effect fires only from a use of ITS OWN weapon: a main-hand
 *   Crusader from main-hand uses, an off-hand Crusader from off-hand uses.
 *   Windfury is bound to the main hand.
 *
 *   A GLOBAL effect -- Hand of Justice -- fires from any melee use, either
 *   hand.
 *
 * EVERY ROLL IS SCRIPTED TO SUCCEED. `canTrigger` ends by rolling a chance, so
 * a `false` from a live RNG can mean "refused" or "rolled badly". That
 * ambiguity is not theoretical: the old Windfury test asserted that Mortal
 * Strike does not proc, and went on passing after the gate was fixed, because
 * the roll happened to fail. With the roll forced, a false can only be a
 * refusal.
 * ----------------------------------------------------------------------------
 */

/** A context whose every random roll succeeds, so only the gate can refuse. */
const alwaysRolls = {
  rng: { rollChance: () => true, nextFloat: () => 0, nextInt: () => 0 },
  clock: { now: () => 10_000 },
} as unknown as SimulationContext;

/** Sword in each hand and a bow, so no gate refuses on weapon TYPE. */
const warrior = {
  weapons: {
    mainHand: { weaponType: 'sword', swingTimerMs: 2600 },
    offHand: { weaponType: 'sword', swingTimerMs: 2600 },
    ranged: { weaponType: 'bow', swingTimerMs: 3000 },
  },
} as unknown as Combatant;

const use = (weaponSlot: WeaponSlot | undefined, abilityId?: string): AttackEvent =>
  ({
    outcome: 'hit',
    weaponSlot,
    abilityId,
    abilityName: abilityId ?? 'Auto-Attack',
    amount: 100,
    critical: false,
  }) as AttackEvent;

/** The four effects, each asked the same question. */
const effects = {
  'main-hand Crusader': (attack: AttackEvent) => isWeaponUseOf(attack, 'mainHand'),
  'off-hand Crusader': (attack: AttackEvent) => isWeaponUseOf(attack, 'offHand'),
  Windfury: (attack: AttackEvent) =>
    windfuryTotemReaction().canTrigger?.(alwaysRolls, warrior, attack) ?? false,
  'Hand of Justice': (attack: AttackEvent) =>
    handOfJusticeReaction().canTrigger?.(alwaysRolls, warrior, attack) ?? false,
  Weaponmaster: (attack: AttackEvent) =>
    WARRIOR_TALENT_REACTIONS.weaponmaster(5).canTrigger?.(alwaysRolls, warrior, attack) ?? false,
};

describe('a weapon "use" is a swing OR an ability', () => {
  it.each([
    { what: 'a main-hand auto swing', slot: 'mainHand' as const, ability: undefined },
    { what: 'Bloodthirst', slot: 'mainHand' as const, ability: 'bloodthirst' },
    { what: 'Mortal Strike', slot: 'mainHand' as const, ability: 'mortal_strike' },
    { what: 'the Rend cast', slot: 'mainHand' as const, ability: 'rend_cast' },
    { what: 'Heroic Strike', slot: 'mainHand' as const, ability: 'heroic_strike' },
    { what: 'Sunder Armor', slot: 'mainHand' as const, ability: 'sunder_armor_cast' },
    { what: 'an off-hand auto swing', slot: 'offHand' as const, ability: undefined },
  ])('$what is a weapon use', ({ slot, ability }) => {
    expect(isWeaponUse(use(slot, ability))).toBe(true);
  });

  it.each([
    { what: 'Thunder Clap', ability: 'thunder_clap' },
    { what: 'Intercept', ability: 'intercept' },
    { what: 'Charge', ability: 'charge' },
  ])('$what is NOT, because it needs no melee weapon', ({ ability }) => {
    // All three resolve on the ranged table, which is how the engine can tell.
    expect(isWeaponUse(use('ranged', ability))).toBe(false);
  });

  it('an ability with no weapon at all is not a use', () => {
    expect(isWeaponUse(use(undefined, 'battle_shout_cast'))).toBe(false);
  });
});

describe('the four effects agree about what a use is', () => {
  /*
   * The table the ruleset owner described, asserted in one place. A row here
   * is the whole specification for that kind of action.
   */
  const expected: ReadonlyArray<{
    readonly what: string;
    readonly slot: WeaponSlot;
    readonly ability?: string;
    readonly mainHandCrusader: boolean;
    readonly offHandCrusader: boolean;
    readonly windfury: boolean;
    readonly handOfJustice: boolean;
  }> = [
    {
      what: 'main-hand auto swing',
      slot: 'mainHand',
      mainHandCrusader: true,
      offHandCrusader: false,
      windfury: true,
      handOfJustice: true,
    },
    {
      what: 'off-hand auto swing',
      slot: 'offHand',
      mainHandCrusader: false,
      offHandCrusader: true,
      windfury: false,
      handOfJustice: true,
    },
    {
      what: 'Bloodthirst',
      slot: 'mainHand',
      ability: 'bloodthirst',
      mainHandCrusader: true,
      offHandCrusader: false,
      windfury: true,
      handOfJustice: true,
    },
    // The ruleset owner's own worked example: Whirlwind with Raging Blows
    // strikes with both hands, as two attacks.
    {
      what: 'Whirlwind, main-hand half',
      slot: 'mainHand',
      ability: 'whirlwind',
      mainHandCrusader: true,
      offHandCrusader: false,
      windfury: true,
      handOfJustice: true,
    },
    {
      what: 'Whirlwind, off-hand half',
      slot: 'offHand',
      ability: 'whirlwind',
      mainHandCrusader: false,
      offHandCrusader: true,
      windfury: false,
      handOfJustice: true,
    },
    {
      what: 'Thunder Clap',
      slot: 'ranged',
      ability: 'thunder_clap',
      mainHandCrusader: false,
      offHandCrusader: false,
      windfury: false,
      handOfJustice: false,
    },
  ];

  it.each(expected)(
    '$what: MH Crusader $mainHandCrusader, OH Crusader $offHandCrusader, Windfury $windfury, HoJ $handOfJustice',
    (row) => {
      const attack = use(row.slot, row.ability);
      expect(effects['main-hand Crusader'](attack)).toBe(row.mainHandCrusader);
      expect(effects['off-hand Crusader'](attack)).toBe(row.offHandCrusader);
      expect(effects.Windfury(attack)).toBe(row.windfury);
      expect(effects['Hand of Justice'](attack)).toBe(row.handOfJustice);
    },
  );

  it('Weaponmaster follows the same rule, with a sword in the swinging hand', () => {
    expect(effects.Weaponmaster(use('mainHand', 'bloodthirst'))).toBe(true);
    expect(effects.Weaponmaster(use('offHand', 'whirlwind'))).toBe(true);
    expect(effects.Weaponmaster(use('ranged', 'thunder_clap'))).toBe(false);
  });
});

describe('which abilities the rule actually covers', () => {
  /*
   * Written out by hand from the spellbook rather than read off the ability
   * definitions, so this fails if an ability's table is ever changed without
   * the consequence for procs being thought about.
   *
   * The test is the ATTACK TABLE, because that is all a reaction can see: a
   * melee table means a melee weapon was used, a ranged one means it was not.
   */
  const needsAMeleeWeapon = [
    'mortal_strike',
    'bloodthirst',
    'slam',
    'whirlwind',
    'spearing_strike',
    'overpower',
    'revenge',
    'shield_slam',
    'hamstring',
    'execute',
    'heroic_strike',
    'cleave',
    'rend_cast',
    'sunder_armor_cast',
  ];
  const doesNot = ['thunder_clap', 'intercept', 'charge'];

  it.each(needsAMeleeWeapon)('%s resolves on a melee table, so it is a use', (id) => {
    const ability = WARRIOR_ABILITIES.find((a) => a.id === id);
    expect(ability?.attackTable).toBe('melee-special');
  });

  it.each(doesNot)('%s resolves on the ranged table, so it is not', (id) => {
    const ability = WARRIOR_ABILITIES.find((a) => a.id === id);
    expect(ability?.attackTable).toBe('ranged-special');
  });

  it('SHIELD SLAM TRIGGERS MAIN HAND EFFECTS, by the ruleset owner', () => {
    /*
     * "Shield slam can trigger main hand effects" -- asked directly, because
     * it was the one ability the rule could not settle by itself.
     *
     * It is declared main-hand and resolves on the melee table, so it READS
     * as a main-hand use -- but its tooltip says "Requires Shields", not
     * "Requires Melee Weapon", and it strikes with the shield, which is an
     * OFF-HAND item. Every other ability in the list above either states a
     * melee weapon requirement or was named by the owner directly.
     *
     * The answer matched what the code already did, so nothing changed. The
     * reason is written down now, which is the point: the next person to
     * notice the "Requires Shields" line finds the ruling instead of
     * re-opening it.
     */
    const shieldSlam = WARRIOR_ABILITIES.find((a) => a.id === 'shield_slam');
    expect(shieldSlam?.attackTable).toBe('melee-special');
    expect(effects.Windfury(use('mainHand', 'shield_slam'))).toBe(true);
    expect(effects['main-hand Crusader'](use('mainHand', 'shield_slam'))).toBe(true);
    expect(effects['Hand of Justice'](use('mainHand', 'shield_slam'))).toBe(true);
    // It is the shield that swings, but the effects it feeds are the main
    // hand's -- so the off-hand enchant is NOT triggered.
    expect(effects['off-hand Crusader'](use('mainHand', 'shield_slam'))).toBe(false);
  });
});
