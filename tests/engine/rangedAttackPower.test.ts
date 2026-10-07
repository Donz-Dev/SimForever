import { describe, expect, it } from 'vitest';
import { ITEMS_BY_ID } from '../../src/game/items/itemData';
import { flat } from '../../src/engine';
import { weaponDamageFor, attackPowerFor } from '../../src/engine/combat/damage';
import type { DamageRequest } from '../../src/engine/combat/damage';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { weaponsForEquipment, statsForStyle } from '../../src/game/items/equipment';
import { characterAtCombatStart } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { ASPECT_OF_THE_HAWK } from '../../src/game/auras/hunter';

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

    /*
     * ------------------------------------------------------------------------
     * THE SPEED HERE IS THE WEAPON'S BASE SPEED, NOT ITS SWING TIMER, AND THOSE
     * STOPPED BEING THE SAME NUMBER WHEN THE QUIVER LANDED.
     *
     * This test read `bow.swingTimerMs / 1000` and was right to for as long as
     * nothing shortened it. A Hunter's quiver divides the swing timer by 1.15
     * and deliberately leaves `powerCoefficient` alone -- the universal weapon
     * formula is `base + BASE SPEED / 14 x attack power`, so a faster bow fires
     * more often for the same attack power per shot.
     *
     * Reading the shortened timer here made the expected figure 9.56 too low
     * and would have been "fixed" by recomputing the coefficient, which is the
     * wrong half: that would cut every Hunter's attack power scaling by 13%.
     * ------------------------------------------------------------------------
     */
    const baseSpeedSeconds = (bow.powerCoefficient ?? 0) * 14;
    // This is a BARE Hunter, so the bow is the placeholder rather than a real
    // one -- the figure is read rather than written out, and what is asserted
    // by hand is the RELATIONSHIP the quiver creates between the two.
    /*
     * TO THE MILLISECOND AND NOT BEYOND IT. Time is integer milliseconds below
     * the UI, so the quiver's divisor is rounded when it lands on the timer --
     * 2.9 / 1.15 is 2.5217391 and the weapon carries 2522. That is the owner's
     * own worked example, to the resolution the engine keeps.
     */
    expect(bow.swingTimerMs).toBe(Math.round((baseSpeedSeconds * 1000) / 1.15));
    expect(bow.swingTimerMs / 1000).toBeCloseTo(baseSpeedSeconds / 1.15, 3);

    const request = requestFor(actor, 'ranged');

    const rap = actor.stats.get('rangedAttackPower');
    // roll of 1 takes the weapon's midpoint, so this is base + power exactly.
    expect(weaponDamageFor(request, 1)).toBeCloseTo(
      bow.baseDamage + (rap / 14) * baseSpeedSeconds,
      4,
    );

    // And it tracks the pool: +140 ranged attack power is +10 per second of speed.
    actor.stats.addModifier({ ...flat('rangedAttackPower', 140), sourceId: 'probe' });
    expect(weaponDamageFor(request, 1)).toBeCloseTo(
      bow.baseDamage + ((rap + 140) / 14) * baseSpeedSeconds,
      4,
    );
  });

  it('carries the quiver and the ammunition, neither of which is a slot', () => {
    /*
     * ------------------------------------------------------------------------
     * THE RULESET OWNER'S TWO FIGURES, 2026-10-07:
     *
     *   "whatever the attack time is for a ranged weapon on a hunter, it can be
     *    reduced by 15% (ex: 2.9 / 1.15 = 2.5217)"
     *   "the damage formula for ranged attacks need 16.5 * baserangedattackspeed
     *    added to the base hit damage of the weapon, before it's modified by
     *    attack power or ability effects"
     *
     * A DIVISOR AND NOT A SUBTRACTION. 3.2 / 1.15 is 2.783; 3.2 x 0.85 is 2.72,
     * which is a 2% faster bow and a plausible wrong number. The owner's own
     * worked example is what settles it.
     * ------------------------------------------------------------------------
     */
    // A REAL profile's bow, so the figures below are the ones a reader sees.
    const bow = characterAtCombatStart(PRESETS_BY_ID.get('lw_ranged')!.build())!.weapons.ranged!;
    const item = ITEMS_BY_ID.get(228334)!;

    // Rhok'delar is a 3.2-second bow before the quiver.
    expect(item.weapon!.speed).toBeCloseTo(3.2, 6);
    expect(bow.swingTimerMs).toBe(Math.round(3200 / 1.15));
    expect(bow.swingTimerMs).toBe(2783);

    /*
     * AMMO IS A DPS, so it becomes per-shot damage by multiplying a speed -- and
     * the speed is the weapon's BASE one, before the quiver. 16.5 x 3.2 = 52.8.
     * The other reading, the quiver-shortened 2.783, would pin ammo at exactly
     * 16.5 DPS forever instead of letting the quiver multiply it.
     */
    const itemAverage = (item.weapon!.minDamage + item.weapon!.maxDamage) / 2;
    expect(bow.baseDamage).toBeCloseTo(itemAverage + 16.5 * 3.2, 6);
    expect(bow.baseDamage - itemAverage).toBeCloseTo(52.8, 6);

    /*
     * AND NOT THE QUIVER-SHORTENED SPEED, which is the rejected reading and the
     * tidier-looking one: it would pin ammo at exactly 16.5 DPS forever and stop
     * the quiver and Rapid Fire multiplying it. RATIFIED by the ruleset owner on
     * 2026-10-07 -- "base speed is correct" -- so this is a ruling rather than
     * an interpretation, and the assertion is written to FAIL the alternative
     * rather than merely to pass the choice.
     */
    expect(bow.baseDamage - itemAverage).not.toBeCloseTo(16.5 * (3.2 / 1.15), 1);

    // And the coefficient is untouched: base speed over fourteen.
    expect(bow.powerCoefficient).toBeCloseTo(3.2 / 14, 10);
  });

  it('gives a MELEE Hunter neither, because its bow has no weapon profile', () => {
    /*
     * Falls out rather than being checked: `weaponsForEquipment` skips the
     * ranged slot unless the style marks it `required`. Asserted because "the
     * quiver hastened a dual-wielder's daggers" is the obvious way to get this
     * wrong, and the engine has only ONE haste rating.
     */
    const melee = characterAtCombatStart(PRESETS_BY_ID.get('lw_melee')!.build())!;
    expect(melee.weapons.ranged).toBeUndefined();
    expect(melee.weapons.mainHand!.swingTimerMs).toBe(
      ITEMS_BY_ID.get(17075)!.weapon!.speed * 1000,
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
     * THE POINT OF THE FIX: three sources of ranged attack power -- the Aspect,
     * agility's 2-per-point, and the Trueshot Aura raid buff -- were being paid
     * for and reaching nothing.
     *
     * THIS USED TO ASSERT A CROSSOVER AND THE CROSSOVER IS GONE. The original
     * reading was that a geared Hunter has MORE melee attack power than ranged
     * at the pull -- 1160 against 1092 -- so reading the correct pool looked
     * like a nerf until the Aspect's +120 put ranged ahead. **The raid buff
     * defaults changed and the ordering flipped**: Grace of Air Totem gives this
     * profile 89 agility, which is 2 ranged attack power a point against 1
     * melee, and Trueshot Aura adds 50 more. Ranged now LEADS at the pull,
     * 1372.3 against 1292.1, before the Aspect is cast at all.
     *
     * SO THE CROSSOVER WAS NEVER THE SUBJECT, and pinning it was pinning
     * something that happened to be true. What the fix is actually about is that
     * the Aspect reaches the RANGED pool and not the melee one, which is the
     * same claim at any raid composition.
     * ------------------------------------------------------------------------
     */
    const profile = PRESETS_BY_ID.get('lw_ranged')!.build();
    const atPull = characterAtCombatStart(profile)!;

    expect(atPull.auras.has('aspect_of_the_hawk')).toBe(false);
    const rangedAtPull = atPull.stats.get('rangedAttackPower');
    const meleeAtPull = atPull.stats.get('attackPower');

    // Both pools are real and neither is zero -- the state before the fix was
    // that the ranged one was computed and never read.
    expect(rangedAtPull).toBeGreaterThan(0);
    expect(meleeAtPull).toBeGreaterThan(0);

    /*
     * THE ASPECT IS WORTH 120 TO RANGED AND NOTHING TO MELEE, which is the
     * invariant. Asserted by applying it rather than by arithmetic on a
     * threshold, so no raid composition can make it stop being a test.
     */
    const withAspect = characterAtCombatStart(profile)!;
    withAspect.auras.apply(
      { clock: { now: () => 0 }, telemetry: { emit: () => {} } } as never,
      ASPECT_OF_THE_HAWK,
      withAspect.id,
    );
    expect(withAspect.stats.get('rangedAttackPower') - rangedAtPull).toBe(120);
    expect(withAspect.stats.get('attackPower')).toBe(meleeAtPull);
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
