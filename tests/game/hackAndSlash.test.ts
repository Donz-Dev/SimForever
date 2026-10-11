import { describe, expect, it } from 'vitest';
import type { WeaponProfile } from '../../src/engine';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { penetratedArmor } from '../../src/engine/combat/damage';
import {
  HACK_AND_SLASH_WEAPONS,
  ROGUE_TALENT_REACTIONS,
} from '../../src/game/reactions/rogueTalents';

/*
 * ============================================================================
 * HACK AND SLASH, AND THE OWNER'S RULING THAT ITS EFFECTS ARE GLOBAL.
 *
 * "As in if you have a MH mace, and an off hand Dagger/Fist the off hand gives
 * a global 5% crit chance to everything, and the mace gives a global 15% armor
 * pen to everything."
 *
 * SO TWO OF THE THREE CLAUSES ARE A PROPERTY OF WHAT IS HELD rather than of
 * what swings, and the third -- the extra attack -- is the stated exception:
 * "it can only proc when you use that weapon and it always triggers a MH swing
 * regardless of weapon type".
 *
 * WHY THIS FILE EXISTS RATHER THAN MORE CASES IN `rogueTalents.test.ts`: that
 * file drove the talent with a ONE-HANDED context -- `holding('dagger')` sets a
 * main hand and no off hand -- so every assertion in it was about a hand
 * combination that cannot distinguish the two readings. **A fixture that cannot
 * express the mistake proves nothing about it**, and all of those tests passed
 * while 5/5 contributed 0.00 crit to the only profile that takes the talent.
 * ============================================================================
 */

const weapon = (weaponType: WeaponProfile['weaponType'], name = `Test ${weaponType}`) =>
  ({
    name,
    weaponType,
    baseDamage: 100,
    swingTimerMs: 2000,
    skill: 300,
  }) as WeaponProfile;

/** A pair of hands, which is what every case here turns on. */
const holding = (mainHand: WeaponProfile['weaponType'], offHand?: WeaponProfile['weaponType']) => ({
  mainHand: weapon(mainHand),
  ...(offHand ? { offHand: weapon(offHand) } : {}),
});

const built = (mainHand: WeaponProfile['weaponType'], offHand?: WeaponProfile['weaponType']) =>
  talentBuild('rogue', { hack_and_slash: 5 }, holding(mainHand, offHand));

// ---------------------------------------------------------------------------
// 1. The crit and the armor penetration are GLOBAL, from EITHER hand
// ---------------------------------------------------------------------------

describe('the crit and armor clauses read both hands', () => {
  it("pays the owner's own example: a mace main hand and a dagger off hand", () => {
    /*
     * THE RULING, WORD FOR WORD. Both clauses pay out at once, each earned by
     * a different hand -- which is the case no single-handed fixture can show
     * and which the main-hand-only reading got half right by accident.
     */
    const build = built('mace', 'dagger');
    expect(build.stats.critChance).toBe(5);
    expect(build.stats.armorPenetration).toBe(15);
  });

  it('pays the crit from an OFF-HAND dagger with a sword in the main hand', () => {
    /*
     * ==========================================================================
     * THIS IS THE COMBAT ROGUE, AND IT IS WHAT WAS BROKEN. The preset holds a
     * sword and a dagger: the sword earns the extra attack and the dagger's 5%
     * crit was being dropped, because the only hand the clause asked about was
     * the sword's. Five points of a five-point talent contributed 0.00 crit.
     * ==========================================================================
     */
    expect(built('sword', 'dagger').stats.critChance).toBe(5);
    expect(built('fist', 'sword').stats.critChance).toBe(5);
  });

  it('pays the armor penetration from either hand', () => {
    expect(built('mace', 'sword').stats.armorPenetration).toBe(15);
    expect(built('sword', 'mace').stats.armorPenetration).toBe(15);
  });

  it('pays each clause ONCE however many hands match', () => {
    /*
     * --------------------------------------------------------------------------
     * THE READING THAT WAS CHOSEN, AND IT IS A CHOICE. The owner said "global",
     * and a global effect that DOUBLES when both hands match is a different
     * claim from the one they made -- it is also the generous one, which is
     * this project's commonest shape of wrong.
     *
     * NOTHING TURNS ON IT TODAY: no preset holds two maces or two fists, and
     * the two-dagger Rogues take no points in the talent. Pinned so that if the
     * owner rules the other way the change is deliberate rather than a drift.
     * --------------------------------------------------------------------------
     */
    expect(built('dagger', 'dagger').stats.critChance).toBe(5);
    expect(built('mace', 'mace').stats.armorPenetration).toBe(15);
  });

  it('still pays neither for two weapons that earn neither', () => {
    const build = built('sword', 'axe');
    expect(build.stats.critChance ?? 0).toBe(0);
    expect(build.stats.armorPenetration ?? 0).toBe(0);
    // And it SAYS so, rather than being silently absent.
    expect(build.unmodelled.filter((e) => e.talentId === 'hack_and_slash')).toHaveLength(2);
  });

  it('reaches the Combat Rogue preset, which is the point of all of it', () => {
    const profile = PRESETS_BY_ID.get('rogue_combat')!.build();
    const on = characterAtCombatStart(profile)!;
    const off = characterAtCombatStart({
      ...profile,
      talents: { ...profile.talents, hack_and_slash: 0 },
    } as never)!;
    // THE DELTA, not the absolute: other talents and the gear put crit on this
    // character too, so an absolute figure would be testing the build.
    expect(on.stats.get('critChance') - off.stats.get('critChance')).toBeCloseTo(5, 6);
    // It holds no mace, so the other clause correctly pays nothing.
    expect(on.stats.get('armorPenetration')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. The extra attack is weapon-bound, and always swings the MAIN hand
// ---------------------------------------------------------------------------

describe('the extra attack is the stated exception', () => {
  /*
   * ============================================================================
   * "Sword/Axe extra attacks are the edge case in that it can only proc when
   * you use that weapon and it always triggers a MH swing regardless of weapon
   * type."
   *
   * THIS CLAUSE WAS ALREADY RIGHT and is pinned rather than changed -- which is
   * worth a test precisely because it is the half that looks most likely to be
   * wrong. The two halves of the owner's worked example are the two directions.
   * ============================================================================
   */
  /*
   * THE REACTION ITSELF, built from `ROGUE_TALENT_REACTIONS` and handed an
   * actor that is only a pair of hands.
   *
   * --------------------------------------------------------------------------
   * NOT THROUGH `createPlayer`, which was tried first and is the reason this
   * comment exists: a hand-written talent allocation has to clear the TIER
   * GATES or `legalAllocation` strips it SILENTLY, and the character then
   * carries no reaction at all -- a zero that reads exactly like a proc that
   * cannot fire. `canTrigger` reads nothing but `actor.weapons[slot]`, so the
   * smallest honest actor is the one that cannot have that failure mode.
   *
   * THAT THE TALENT REACHES A REAL CHARACTER is asserted on the PRESET above,
   * which is the right place for it: the preset's allocation is the owner's
   * and is legal by construction.
   * --------------------------------------------------------------------------
   */
  const handsOf = (
    mainHand: WeaponProfile['weaponType'],
    offHand: WeaponProfile['weaponType'],
  ) => ({ weapons: holding(mainHand, offHand) }) as never;

  /*
   * THE ROLL IS FORCED rather than sampled, so ONE use is decisive. A 5% chance
   * over a sample answers "how often", and the question here is "can it at
   * all" -- a sweep that samples reports a real gate as a small number, which
   * is the shape `racials.test.ts` records about Touch of the Grave.
   */
  const alwaysRolls = { rng: { rollChance: () => true } } as never;
  const reaction = ROGUE_TALENT_REACTIONS.hack_and_slash(5);

  /** Whether the proc would fire for a use of this slot. */
  function procsFrom(
    mainHand: WeaponProfile['weaponType'],
    offHand: WeaponProfile['weaponType'],
    slot: 'mainHand' | 'offHand',
    abilityId?: string,
  ): boolean {
    return (
      reaction.canTrigger?.(alwaysRolls, handsOf(mainHand, offHand), {
        weaponSlot: slot,
        abilityId,
        attackTable: abilityId ? 'melee-special' : 'melee-auto',
      } as never) === true
    );
  }

  it('fires only on an attack that connected', () => {
    // A miss, a dodge and a parry are not "successful melee attacks", and
    // `outcomes` is how that is said -- it also means no random number is
    // drawn on an avoided swing, so this cannot shift a seeded run.
    expect(reaction.outcomes).toEqual(['hit', 'crit', 'glance']);
    expect(reaction.id).toBe('hack_and_slash');
  });

  it('procs from a SWORD main hand and not from a dagger off hand', () => {
    expect(procsFrom('sword', 'dagger', 'mainHand')).toBe(true);
    expect(procsFrom('sword', 'dagger', 'offHand')).toBe(false);
    // "special abilities and MH swings can proc" -- a main-hand special is a
    // use of the main-hand weapon, so it earns the same roll the swing does.
    expect(procsFrom('sword', 'dagger', 'mainHand', 'sinister_strike')).toBe(true);
  });

  it('procs from a SWORD off hand and not from a dagger main hand', () => {
    // The owner's second worked example, and the one a main-hand reading
    // would get backwards: "offhand swings CAN proc an extra attack which
    // swings the main hand weapon".
    expect(procsFrom('dagger', 'sword', 'offHand')).toBe(true);
    expect(procsFrom('dagger', 'sword', 'mainHand')).toBe(false);
    // And the main-hand special cannot either, which is the half of the
    // sentence that names the abilities.
    expect(procsFrom('dagger', 'sword', 'mainHand', 'sinister_strike')).toBe(false);
  });

  it('treats an axe exactly as a sword, and nothing else as either', () => {
    expect([...HACK_AND_SLASH_WEAPONS].sort()).toEqual(['axe', 'sword']);
    expect(procsFrom('axe', 'mace', 'mainHand')).toBe(true);
    expect(procsFrom('mace', 'fist', 'mainHand')).toBe(false);
    expect(procsFrom('dagger', 'axe', 'offHand')).toBe(true);
  });

  it('always swings the MAIN hand, whichever hand procced it', () => {
    /*
     * ASSERTED ON WHAT THE REACTION ASKS FOR, by handing it a context whose
     * `extraAttack` records the slot. "It always triggers a MH swing
     * regardless of weapon type" is a statement about the SLOT, and driving a
     * whole fight to read it back would measure the swing timer as well.
     */
    for (const [mainHand, offHand, from] of [
      ['sword', 'dagger', 'mainHand'],
      ['dagger', 'sword', 'offHand'],
    ] as const) {
      const asked: string[] = [];
      const context = {
        rng: { rollChance: () => true },
        extraAttack: (_actor: unknown, slot: string) => asked.push(slot),
      } as never;
      reaction.onTrigger?.(context, handsOf(mainHand, offHand), {
        weaponSlot: from,
      } as never);
      expect(asked, `${mainHand}/${offHand} procced from the ${from}`).toEqual(['mainHand']);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. The armor penetration is a percentage of what is LEFT after the debuffs
// ---------------------------------------------------------------------------

describe('armor penetration is applied after the debuffs', () => {
  /*
   * ============================================================================
   * THE OWNER'S WORKED EXAMPLE, TRANSCRIBED: "If a boss has 3500 armor, which
   * is then reduced to 1000 by debuffs. The Hack and Slash: Mace effect would
   * take the remaining 1000 armor down to 850."
   *
   * IT WAS ALREADY TRUE, AND THAT IS THE RESULT RATHER THAN A DISAPPOINTMENT.
   * `penetratedArmor` reads `defender.stats.get('armor')`, and every armor
   * debuff in the game layer -- Sunder Armor, Faerie Fire, Curse of
   * Recklessness -- is a `flat('armor', -n)` STAT MODIFIER on the defender. So
   * the stat read is already post-debuff by construction and the multiply
   * lands where the owner says it should.
   *
   * PINNED ANYWAY, because "it already works" is a claim about the code that
   * nothing was checking: the ordering is implicit in where a modifier lives,
   * and a future change that applied penetration to a BASE armor figure would
   * reproduce every existing test and quietly inflate every armor debuff.
   * ============================================================================
   */
  function bossAt(armor: number, debuff: number, penetration: number) {
    const target = createTrainingDummy({ name: 'Boss', health: 1e9, armor, level: 63 });
    // The debuffs, as the game layer applies them: a flat modifier on the
    // DEFENDER's armor stat, which is what Sunder Armor is.
    target.stats.addModifier({
      sourceId: 'debuffs',
      stat: 'armor',
      operation: 'flat',
      value: -debuff,
    });
    const attacker = createPlayer({
      race: 'human',
      characterClass: 'rogue',
      combatStyle: 'dual_wield',
    });
    attacker.stats.addModifier({
      sourceId: 'hack_and_slash',
      stat: 'armorPenetration',
      operation: 'flat',
      value: penetration,
    });
    return { attacker, target };
  }

  it("reproduces the owner's 3500 -> 1000 -> 850 exactly", () => {
    const { attacker, target } = bossAt(3500, 2500, 15);
    expect(target.stats.get('armor')).toBe(1000);
    expect(penetratedArmor(attacker, target)).toBeCloseTo(850, 6);
  });

  it('takes the percentage of what is LEFT, not of the base', () => {
    /*
     * THE TWO READINGS DIFFER BY THE SIZE OF THE DEBUFF and both produce a
     * plausible number. Off the BASE, 15% of 3500 is 525 and the answer would
     * be 475 -- a smaller armor figure, which is to say a bigger hit and no
     * error anywhere on the page.
     */
    const { attacker, target } = bossAt(3500, 2500, 15);
    expect(penetratedArmor(attacker, target)).not.toBeCloseTo(3500 - 2500 - 0.15 * 3500, 6);
  });

  it('is a percentage rather than a flat subtraction', () => {
    // Doubling the armor left doubles what is removed, which a flat value
    // would not do.
    const small = bossAt(3500, 2500, 15);
    const large = bossAt(3500, 1500, 15);
    expect(small.target.stats.get('armor') - penetratedArmor(small.attacker, small.target)).toBeCloseTo(150, 6);
    expect(large.target.stats.get('armor') - penetratedArmor(large.attacker, large.target)).toBeCloseTo(300, 6);
  });

  it('leaves the armor alone when the character has no penetration', () => {
    const { attacker, target } = bossAt(3500, 2500, 0);
    expect(penetratedArmor(attacker, target)).toBe(1000);
  });

  it('never drives the armor below nothing', () => {
    const { attacker, target } = bossAt(3500, 2500, 400);
    expect(penetratedArmor(attacker, target)).toBe(0);
  });
});
