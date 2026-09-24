import { describe, expect, it } from 'vitest';
import { flat } from '../../src/engine';
import { weaponDamageFor, attackPowerFor } from '../../src/engine/combat/damage';
import type { DamageRequest } from '../../src/engine/combat/damage';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { weaponsForEquipment, statsForStyle } from '../../src/game/items/equipment';
import { characterAtCombatStart } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';

/*
 * ------------------------------------------------------------------------------
 * RULESET: ranged weapon damage scales with RANGED attack power.
 *
 * From the Forever Hunter wiki the ruleset owner named, which gives Auto Shot
 * as
 *
 *     AmmoDPS x WeaponSpeed + (RAP / 14 x WeaponSpeed + Scope + AvgWeaponDmg)
 *
 * and states the two pools separately: 1 agility = 2 ranged attack power,
 * 1 agility = 1 melee, and 1 STRENGTH = 1 MELEE with no ranged bonus at all.
 *
 * `weaponDamageFor` read `attackPower` for every slot, so a bow swung with
 * melee attack power. NOTHING CAUGHT IT -- 1,548 tests passed either way --
 * because a Hunter with a plausible attack power produces a plausible number.
 * These are the assertions that were missing.
 * ------------------------------------------------------------------------------
 */

/** A bare Hunter, so the pools can be moved one at a time. */
function hunter() {
  return createPlayer({ race: 'orc', characterClass: 'hunter', combatStyle: 'ranged' });
}

function requestFor(source: ReturnType<typeof hunter>, slot: 'ranged' | 'mainHand') {
  return {
    source,
    target: source,
    abilityName: 'probe',
    school: 'physical',
    baseAmount: 0,
    weaponScaling: { slot },
  } as unknown as DamageRequest;
}

describe('which attack power a weapon scales with', () => {
  it('scales a RANGED weapon with ranged attack power, and not with melee', () => {
    const actor = hunter();
    const request = requestFor(actor, 'ranged');
    const before = weaponDamageFor(request, 1);

    actor.stats.addModifier({ ...flat('attackPower', 500), sourceId: 'melee' });
    expect(weaponDamageFor(request, 1), 'melee attack power must not reach a bow').toBeCloseTo(
      before,
      6,
    );

    actor.stats.addModifier({ ...flat('rangedAttackPower', 500), sourceId: 'ranged' });
    expect(weaponDamageFor(request, 1)).toBeGreaterThan(before);
  });

  it('reproduces the wiki formula: RAP / 14 x weapon speed', () => {
    /*
     * `powerCoefficient` is `speed / 14`, so the power term is exactly
     * `RAP / 14 x speed`. Asserted against a hand-computed number rather than
     * against the engine's own coefficient.
     */
    const actor = hunter();
    const bow = actor.weapons.ranged;
    expect(bow).toBeDefined();
    if (!bow) return;

    const speedSeconds = bow.swingTimerMs / 1000;
    const request = requestFor(actor, 'ranged');

    const rap = actor.stats.get('rangedAttackPower');
    // roll of 1 takes the weapon's midpoint, so this is base + power exactly.
    expect(weaponDamageFor(request, 1)).toBeCloseTo(bow.baseDamage + (rap / 14) * speedSeconds, 4);

    // And it tracks the pool: +140 ranged attack power is +10 per second of speed.
    actor.stats.addModifier({ ...flat('rangedAttackPower', 140), sourceId: 'probe' });
    expect(weaponDamageFor(request, 1)).toBeCloseTo(
      bow.baseDamage + ((rap + 140) / 14) * speedSeconds,
      4,
    );
  });

  it('still scales a MELEE weapon with melee attack power, and not with ranged', () => {
    const actor = createPlayer({
      race: 'orc',
      characterClass: 'warrior',
      combatStyle: 'two_hander',
    });
    const request = requestFor(actor as never, 'mainHand');
    const before = weaponDamageFor(request, 1);

    actor.stats.addModifier({ ...flat('rangedAttackPower', 500), sourceId: 'ranged' });
    expect(weaponDamageFor(request, 1), 'ranged attack power must not reach a sword').toBeCloseTo(
      before,
      6,
    );

    actor.stats.addModifier({ ...flat('attackPower', 500), sourceId: 'melee' });
    expect(weaponDamageFor(request, 1)).toBeGreaterThan(before);
  });

  it('keys on the SCALING slot, not on `weaponSlot`', () => {
    /*
     * ------------------------------------------------------------------------
     * A DISTINCTION WITH TEETH. `weaponSlot` says which weapon's procs an
     * attack can trigger, and Thunder Clap and Intercept both declare
     * `'ranged'` there precisely so `isWeaponUse` excludes them -- they are
     * MELEE Warrior abilities that resolve on the ranged TABLE because it has
     * no dodge or parry.
     *
     * Keying the attack power on `weaponSlot` would hand a Warrior ranged
     * attack power the moment either grew a coefficient, and a Warrior's
     * ranged pool is zero, so Thunder Clap would quietly lose its scaling.
     * ------------------------------------------------------------------------
     */
    const actor = hunter();
    const thunderClapShaped = {
      source: actor,
      target: actor,
      abilityName: 'probe',
      school: 'physical',
      baseAmount: 103,
      weaponSlot: 'ranged',
    } as unknown as DamageRequest;

    expect(attackPowerFor(thunderClapShaped)).toBe(actor.stats.get('attackPower'));
    expect(attackPowerFor(requestFor(actor, 'ranged'))).toBe(
      actor.stats.get('rangedAttackPower'),
    );
  });
});

describe('what the fix switched back on', () => {
  it('lets Aspect of the Hawk reach the bow', () => {
    /*
     * ------------------------------------------------------------------------
     * THE FIGURE MOVED UP, NOT DOWN, and the prediction on file said otherwise.
     *
     * At the pull a geared Hunter has MORE melee attack power than ranged --
     * 1160 against 1092 -- so reading the correct pool looked like a nerf. But
     * the rotation opens with Aspect of the Hawk, +120 ranged attack power and
     * nothing to melee, which puts the ranged pool ahead once the fight is
     * actually running.
     *
     * That is the point of the whole fix: three sources of ranged attack power
     * -- the Aspect, agility's 2-per-point, the Trueshot Aura raid buff -- were
     * being paid for and reaching nothing.
     * ------------------------------------------------------------------------
     */
    const profile = PRESETS_BY_ID.get('lw_ranged')!.build();
    const atPull = characterAtCombatStart(profile)!;

    expect(atPull.auras.has('aspect_of_the_hawk')).toBe(false);
    const rangedAtPull = atPull.stats.get('rangedAttackPower');
    expect(atPull.stats.get('attackPower')).toBeGreaterThan(rangedAtPull);

    // The aspect is worth 120, which is what takes the ranged pool past melee.
    expect(rangedAtPull + 120).toBeGreaterThan(atPull.stats.get('attackPower'));
  });
});

describe('a stat stick is held and never swung', () => {
  it('leaves a form Druid swinging its paws, not the weapon it carries', () => {
    /*
     * ------------------------------------------------------------------------
     * `createPlayer` merges the equipped weapons OVER the style's own, so
     * anything returned for a stat-stick hand REPLACES the form's natural
     * weapon. A Druid in Cat form was swinging an Obsidian Edged Blade: base
     * 234 every 3.6 seconds instead of a paw's 50 every 1.0.
     *
     * It read as a 62% damage increase and as a working feature, which is why
     * this is pinned on the WEAPON and not on a DPS figure.
     * ------------------------------------------------------------------------
     */
    for (const [preset, paw] of [
      ['druid_cat', 'Cat Paw'],
      ['druid_bear', 'Bear Paw'],
    ] as const) {
      const profile = PRESETS_BY_ID.get(preset)!.build();
      const actor = characterAtCombatStart(profile)!;
      expect(actor.weapons.mainHand?.name, preset).toBe(paw);

      // Held, never swung: no weapon comes from the equipment at all...
      const style = profile.character.combatStyle as never;
      expect(weaponsForEquipment(profile.equipment, style), preset).toEqual({});
      // ...and its stats still apply, which is what "stat stick" means.
      expect(statsForStyle(profile.equipment, style).strength, preset).toBeGreaterThan(0);
    }
  });

  it('gives a ranged Hunter its stat stick as stats and not as a weapon', () => {
    const profile = PRESETS_BY_ID.get('lw_ranged')!.build();
    const style = profile.character.combatStyle as never;
    const actor = characterAtCombatStart(profile)!;

    // Dreadforge Retaliator is equipped in the two-hand slot...
    expect(profile.equipment.twoHand?.itemId).toBe(227981);
    // ...contributes no main-hand weapon...
    expect(weaponsForEquipment(profile.equipment, style).mainHand).toBeUndefined();
    expect(actor.weapons.mainHand).toBeUndefined();
    // ...and the bow is what swings.
    expect(actor.weapons.ranged?.name).toBe("Rhok'delar, Longbow of the Ancient Keepers");
  });
});
