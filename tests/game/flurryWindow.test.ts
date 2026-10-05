import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation, dealDamage, seconds } from '../../src/engine';
import { NO_CHANCES } from '../../src/engine/combat/attackTable';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { FLURRY_SWINGS, flurryAura } from '../../src/game/auras/warriorTalents';
import { HOLY_SHIELD, redoubtAura } from '../../src/game/auras/paladin';
import { SHIELD_BLOCK } from '../../src/game/auras/warrior';
import { flurry } from '../../src/game/reactions/warriorTalents';
import { WARRIOR_TALENT_REACTIONS } from '../../src/game/reactions/warriorTalents';
import { SHAMAN_TALENT_REACTIONS } from '../../src/game/reactions/shamanTalents';
import { legalise } from '../helpers/legalTalents';

/*
 * ==============================================================================
 * FLURRY, AGAINST THE RULESET OWNER'S THREE CLAUSES.
 *
 *   1. ANY non-DoT critical strike restores it to three swings
 *   2. BOTH main-hand and off-hand auto-attacks spend a charge
 *   3. an EXTRA ATTACK spends one too, because it finishes the main hand's
 *      swing timer and so IS a main-hand swing
 *
 * TWO THINGS WERE WRONG AND NEITHER MOVED A DPS FIGURE, which is why the suite
 * was green with both in. The trigger gated on `isWeaponUse`, so Thunder Clap,
 * Intercept and Charge crits refused to proc it; and the reaction set
 * `instance.stacks` by hand AFTER `applyAura` had emitted a smaller count, so
 * every event reported a number the engine did not hold.
 * ==============================================================================
 */

const ALWAYS_CRIT = { ...NO_CHANCES, crit: 10_000, critMultiplier: 2 };
const NEVER_CRIT = { ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1 };

function fight(chances: typeof NO_CHANCES = NEVER_CRIT) {
  const player = createPlayer({
    race: 'orc',
    characterClass: 'warrior',
    combatStyle: 'dual_wield',
    talents: legalise({ flurry: 5 }),
    equipment: startingEquipmentFor('warrior', 'dual_wield'),
  });
  const dummy = createTrainingDummy({ name: 'D', health: 1e9, armor: 0, level: 63 });
  const events: TelemetryEvent[] = [];
  const sim = new Simulation(
    {
      durationMs: seconds(60),
      seed: 11,
      createCombatants: () => [player, dummy],
      attackChances: () => chances,
    },
    { emit: (e) => events.push(e) },
  );
  sim.begin();
  return { player, dummy, sim, events };
}

/** The stack count the LAST Flurry event reported, which is what a reader sees. */
function emittedStacks(events: readonly TelemetryEvent[]): number | undefined {
  const last = [...events]
    .reverse()
    .find(
      (e) =>
        (e as { auraId?: string }).auraId === 'flurry' &&
        (e.type === 'aura_applied' ||
          e.type === 'aura_refreshed' ||
          e.type === 'aura_stacks_changed'),
    ) as unknown as { stacks: number } | undefined;
  return last?.stacks;
}

describe('any non-DoT critical strike refreshes Flurry', () => {
  /*
   * Driven through `dealDamage` rather than by calling the reaction, because
   * the "non-DoT" half of the rule is enforced by `dealDamage`'s own dispatch
   * guard and not by the reaction at all. Calling the reaction directly would
   * test a condition that is no longer there.
   */
  function critWith(over: Record<string, unknown>) {
    const { player, dummy, sim, events } = fight(ALWAYS_CRIT);
    dealDamage(sim, {
      source: player,
      target: dummy,
      abilityName: 'probe',
      school: 'physical',
      baseAmount: 100,
      ...over,
    } as never);
    return { stacks: player.auras.stacksOf('flurry'), events };
  }

  it('fires on a crit that carries NO weapon slot -- Thunder Clap', () => {
    /*
     * THE BUG THIS FILE EXISTS FOR. Thunder Clap is a melee ability that
     * declares `ranged-special`, because that table has no dodge or parry --
     * the overloaded table in CLAUDE.md. `isWeaponUse` excludes it by design,
     * which is right for a weapon-bound enchant and wrong for Flurry.
     */
    expect(critWith({ abilityId: 'thunder_clap', attackTable: 'ranged-special' }).stacks).toBe(
      FLURRY_SWINGS,
    );
  });

  it('fires on a main-hand weapon crit, as it always did', () => {
    expect(
      critWith({ abilityId: 'bloodthirst', attackTable: 'melee-special', weaponSlot: 'mainHand' })
        .stacks,
    ).toBe(FLURRY_SWINGS);
  });

  it('does NOT fire on a periodic tick, however it rolls', () => {
    /*
     * Enforced one layer down: `dealDamage` dispatches reactions only when
     * `attackTable && !periodic`. Asserted here anyway, because that guard is
     * now the ONLY thing implementing the "non-DoT" half of the rule -- the
     * reaction no longer restates it, so nothing else would catch its loss.
     */
    expect(
      critWith({
        abilityId: 'deep_wounds',
        attackTable: 'melee-special',
        weaponSlot: 'mainHand',
        periodic: true,
        critFrom: 'melee-special',
      }).stacks,
    ).toBe(0);
  });
});

describe('the emitted stack count is the count the engine holds', () => {
  it('reports THREE on the first application, not one', () => {
    const { events, stacks } = (() => {
      const f = fight(ALWAYS_CRIT);
      dealDamage(f.sim, {
        source: f.player,
        target: f.dummy,
        abilityId: 'bloodthirst',
        abilityName: 'Bloodthirst',
        school: 'physical',
        baseAmount: 100,
        attackTable: 'melee-special',
        weaponSlot: 'mainHand',
      } as never);
      return { events: f.events, stacks: f.player.auras.stacksOf('flurry') };
    })();

    expect(stacks).toBe(FLURRY_SWINGS);
    // Before the fix this emitted 1 while the engine held 3.
    expect(emittedStacks(events)).toBe(FLURRY_SWINGS);
  });

  it('reports THREE on a refresh of a partly-spent window, not two', () => {
    const f = fight(ALWAYS_CRIT);
    const crit = () =>
      dealDamage(f.sim, {
        source: f.player,
        target: f.dummy,
        abilityId: 'bloodthirst',
        abilityName: 'Bloodthirst',
        school: 'physical',
        baseAmount: 100,
        attackTable: 'melee-special',
        weaponSlot: 'mainHand',
      } as never);

    crit();
    f.player.auras.consumeSwingCharges(f.sim);
    f.player.auras.consumeSwingCharges(f.sim);
    expect(f.player.auras.stacksOf('flurry')).toBe(1);

    crit();
    // RESTORED, not topped up: "your next 3 swings" is a window re-opened.
    expect(f.player.auras.stacksOf('flurry')).toBe(FLURRY_SWINGS);
    // Before the fix this emitted 2 while the engine held 3.
    expect(emittedStacks(f.events)).toBe(FLURRY_SWINGS);
  });
});

describe('what spends a charge', () => {
  it('declares that both hands and an extra attack all swing', () => {
    // The aura says "consumed by a swing"; the engine's per-slot swing handler
    // and `extraAttack` are what call it, so the declaration is the contract.
    expect(flurryAura(25).consumedBySwing).toBe(true);
    expect(flurryAura(25).chargesOnApply).toBe(FLURRY_SWINGS);
    expect(flurryAura(25).refreshRestoresCharges).toBe(true);
  });

  it('walks 3 to 0 over three swings, from either hand', () => {
    const f = fight();
    f.sim.applyAura(f.player, flurryAura(25), f.player.id);
    expect(f.player.auras.stacksOf('flurry')).toBe(FLURRY_SWINGS);

    for (const expected of [2, 1, 0]) {
      f.player.auras.consumeSwingCharges(f.sim);
      expect(f.player.auras.stacksOf('flurry')).toBe(expected);
    }
  });
});

describe('the other charge auras are untouched', () => {
  /*
   * THE CONTAINMENT CHECK FOR THE ENGINE CHANGE. `refreshRestoresCharges` is a
   * new branch in `refresh`, and four auras already declare `chargesOnApply` --
   * Shield Block, Holy Shield, Redoubt and the Mage's. Overloading that field to
   * govern refreshes as well would have changed all four silently, and whether
   * Holy Shield restores to full or climbs by one is a ruleset question nobody
   * has asked.
   *
   * SO WHAT IS ASSERTED IS THAT A REFRESH DOES NOT RESTORE THEM TO FULL. That
   * is the behaviour the new branch could have leaked into, and it is the one
   * worth pinning -- not the exact climb, which for Holy Shield and Redoubt is
   * currently nothing at all, because both declare `chargesOnApply` without a
   * `maxStacks` and `maxStacks` defaults to one. That is its own oddity and it
   * is deliberately left alone here.
   */
  it('none of them declares the new field', () => {
    for (const aura of [SHIELD_BLOCK, HOLY_SHIELD, redoubtAura(10)]) {
      expect(aura.refreshRestoresCharges, aura.id).toBeUndefined();
      expect(aura.chargesOnApply, aura.id).toBeGreaterThan(0);
    }
  });

  it('a refresh does NOT restore a spent Holy Shield to full', () => {
    const f = fight();
    const paladin = createPlayer({
      race: 'human',
      characterClass: 'paladin',
      combatStyle: 'one_hand_shield',
    });

    f.sim.applyAura(paladin, HOLY_SHIELD, paladin.id);
    const full = HOLY_SHIELD.chargesOnApply!;
    expect(paladin.auras.stacksOf(HOLY_SHIELD.id)).toBe(full);

    paladin.auras.consumeBlockCharges(f.sim);
    paladin.auras.consumeBlockCharges(f.sim);
    const spent = paladin.auras.stacksOf(HOLY_SHIELD.id);
    expect(spent).toBe(full - 2);

    // The point: re-applying must NOT snap it back to `full`, which is what
    // Flurry now does and what this aura has never done.
    f.sim.applyAura(paladin, HOLY_SHIELD, paladin.id);
    expect(paladin.auras.stacksOf(HOLY_SHIELD.id)).toBe(spent);
    expect(paladin.auras.stacksOf(HOLY_SHIELD.id)).not.toBe(full);
  });
});

describe('the Shaman shares the aura AND the widened trigger', () => {
  /*
   * ----------------------------------------------------------------------------
   * THIS TEST USED TO ASSERT THE OPPOSITE, AND GIVING WAY IS CORRECT.
   *
   * It read "keeps a weapon-use gate on the Shaman, and none on the Warrior",
   * because the owner's "any non-DoT critical strike" ruling had been given while
   * reading a WARRIOR profile and extending it to another class was an inference.
   * The owner has now ruled the Shaman too, so the builder is shared again and
   * the narrow variant is gone.
   *
   * A TEST THAT PINS A DECISION HAS TO GIVE WAY WHEN THE DECISION CHANGES OWNER;
   * a test that pins an invariant does not. What stays is the MEASUREMENT, which
   * is the price of the choice rather than an argument against it:
   *
   *     Enh Shaman 593.5 -> 604.0, +10.5 DPS, 30 batches of 10
   *
   * It is +10.5 here and nothing on the Warrior because a Shaman crits with
   * Lightning Bolt, Flame Shock and Earth Shock, where DW Fury's list casts
   * nothing that resolves off a weapon.
   *
   * BOTH TOOLTIPS STILL SAY "MELEE", so this is a deliberate override in two
   * places at once -- which is exactly the thing a reader needs told.
   * ----------------------------------------------------------------------------
   */
  it('hands both classes the same builder, with no weapon gate', () => {
    expect(SHAMAN_TALENT_REACTIONS.flurry).toBe(flurry);
    expect(WARRIOR_TALENT_REACTIONS.flurry).toBe(flurry);
    expect(flurry(25).canTrigger).toBeUndefined();
  });

  it('lets a Shaman SPELL crit refresh it, which is what the ruling bought', () => {
    /*
     * Through `dealDamage`, because a spell crit carrying no weapon slot is
     * precisely the case the old gate refused. A Shaman is built here rather
     * than a Warrior: the registry is per class, and the bug would be the
     * Shaman's key pointing somewhere else.
     */
    const shaman = createPlayer({
      race: 'orc',
      characterClass: 'shaman',
      combatStyle: 'two_hander',
      // THE CLASS ARGUMENT IS NOT OPTIONAL HERE: `legalise` defaults to the
      // WARRIOR tree, so padding a Shaman allocation against it produces a
      // build `createPlayer` strips silently -- which reads as "the talent does
      // nothing" rather than as a broken test.
      talents: legalise({ flurry: 5 }, 'shaman'),
    });
    const dummy = createTrainingDummy({ name: 'D', health: 1e9, armor: 0, level: 63 });
    const sim = new Simulation({
      durationMs: seconds(60),
      seed: 3,
      createCombatants: () => [shaman, dummy],
      attackChances: () => ALWAYS_CRIT,
    });
    sim.begin();

    dealDamage(sim, {
      source: shaman,
      target: dummy,
      abilityId: 'lightning_bolt',
      abilityName: 'Lightning Bolt',
      school: 'nature',
      baseAmount: 100,
      attackTable: 'spell',
    } as never);

    expect(shaman.auras.stacksOf('flurry')).toBe(FLURRY_SWINGS);
  });

  it('still refuses a periodic tick for the Shaman too', () => {
    // The one half of the rule that is NOT overridden, and it is enforced by
    // `dealDamage`'s dispatch rather than by either class's reaction.
    const shaman = createPlayer({
      race: 'orc',
      characterClass: 'shaman',
      combatStyle: 'two_hander',
      // THE CLASS ARGUMENT IS NOT OPTIONAL HERE: `legalise` defaults to the
      // WARRIOR tree, so padding a Shaman allocation against it produces a
      // build `createPlayer` strips silently -- which reads as "the talent does
      // nothing" rather than as a broken test.
      talents: legalise({ flurry: 5 }, 'shaman'),
    });
    const dummy = createTrainingDummy({ name: 'D', health: 1e9, armor: 0, level: 63 });
    const sim = new Simulation({
      durationMs: seconds(60),
      seed: 3,
      createCombatants: () => [shaman, dummy],
      attackChances: () => ALWAYS_CRIT,
    });
    sim.begin();

    dealDamage(sim, {
      source: shaman,
      target: dummy,
      abilityId: 'flame_shock',
      abilityName: 'Flame Shock',
      school: 'fire',
      baseAmount: 100,
      attackTable: 'spell',
      periodic: true,
      critFrom: 'spell',
    } as never);

    expect(shaman.auras.stacksOf('flurry')).toBe(0);
  });
});
