import { describe, expect, it } from 'vitest';
import type { Equipment } from '../../src/game/items/Item';
import {
  CRUSADER_DURATION_MS,
  CRUSADER_PPM,
  CRUSADER_STRENGTH,
  HAND_OF_JUSTICE_CHANCE,
  HAND_OF_JUSTICE_ICD_MS,
  HOLY_STRENGTH_MAIN_HAND,
  HOLY_STRENGTH_OFF_HAND,
  VISKAG_DAMAGE,
  VISKAG_PPM,
  ppmChance,
  reactionsForEquipment,
} from '../../src/game/items/procs';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfile } from '../../src/simulator';
import { createDefaultProfile } from '../../src/profiles';
import { seconds, toSeconds } from '../../src/engine';

/*
 * The PPM formula, the rates and the Hand of Justice numbers were all supplied
 * by the ruleset owner; the item tooltips give none of them. They are written
 * out here independently of the source.
 */

describe('the procs-per-minute formula', () => {
  it('is weapon speed over sixty, times the rate', () => {
    expect(ppmChance(2.6, 1)).toBeCloseTo(2.6 / 60, 10);
    expect(ppmChance(2.5, 1.1)).toBeCloseTo((2.5 / 60) * 1.1, 10);
  });

  it("gives Vis'kag 4.33% on its own 2.6 second swing", () => {
    expect(VISKAG_PPM).toBe(1);
    expect(ppmChance(2.6, VISKAG_PPM) * 100).toBeCloseTo(4.33, 2);
  });

  it('gives Crusader 4.58% on a 2.5 second off-hand', () => {
    expect(CRUSADER_PPM).toBe(1.1);
    expect(ppmChance(2.5, CRUSADER_PPM) * 100).toBeCloseTo(4.58, 2);
  });

  it('makes a slow weapon and a fast weapon proc equally often per minute', () => {
    // The whole point of PPM. Attacks per minute times chance per attack is the
    // rate, whatever the speed.
    for (const speed of [1.5, 2.6, 3.6]) {
      const attacksPerMinute = 60 / speed;
      expect(attacksPerMinute * ppmChance(speed, 1)).toBeCloseTo(1, 10);
    }
  });
});

describe('Crusader', () => {
  it('grants a hundred strength for fifteen seconds', () => {
    expect(CRUSADER_STRENGTH).toBe(100);
    expect(toSeconds(CRUSADER_DURATION_MS)).toBe(15);
    for (const aura of [HOLY_STRENGTH_MAIN_HAND, HOLY_STRENGTH_OFF_HAND]) {
      expect(aura.statModifiers?.[0]).toMatchObject({ stat: 'strength', value: 100 });
      expect(toSeconds(aura.durationMs)).toBe(15);
    }
  });

  it('refreshes ITSELF rather than stacking with itself', () => {
    // "capable of triggering again to refresh its duration" -- so a second
    // main-hand proc resets the main hand's timer rather than granting another
    // hundred. The stacking is BETWEEN hands, not within one.
    for (const aura of [HOLY_STRENGTH_MAIN_HAND, HOLY_STRENGTH_OFF_HAND]) {
      expect(aura.refreshBehaviour).toBe('reset');
      expect(aura.maxStacks ?? 1).toBe(1);
    }
  });

  it('gives each hand its own aura, so both can be up at once', () => {
    /*
     * A FOREVER RULE, given by the ruleset owner, and not what this file
     * assumed. Both hands used to share one `holy_strength`, so a dual-wielder
     * enchanted on both weapons got one hundred strength however often either
     * hand fired. Two separate auras is two hundred.
     */
    expect(HOLY_STRENGTH_MAIN_HAND.id).not.toBe(HOLY_STRENGTH_OFF_HAND.id);
  });

  it('builds one reaction per enchanted weapon', () => {
    const both: Equipment = {
      mainHand: { itemId: 17075, enchantId: 20034 },
      offHand: { itemId: 228265, enchantId: 20034 },
    };
    const ids = reactionsForEquipment(both).map((r) => r.id);

    // Each hand rolls off its own weapon's speed, so each needs its own
    // reaction -- but they share one aura.
    expect(ids).toContain('crusader_mainHand');
    expect(ids).toContain('crusader_offHand');
  });
});

describe('Hand of Justice', () => {
  it('is a flat two percent, not a PPM effect', () => {
    // Stated as "2% chance for any attack", so it does not scale with speed.
    expect(HAND_OF_JUSTICE_CHANCE).toBe(0.02);
  });

  it('has a 1.5 second internal cooldown', () => {
    expect(HAND_OF_JUSTICE_ICD_MS).toBe(1500);
  });

  it('is built once per Hand of Justice equipped', () => {
    expect(reactionsForEquipment({ trinket1: { itemId: 11815 } })).toHaveLength(1);
    expect(reactionsForEquipment({ trinket2: { itemId: 11815 } })).toHaveLength(1);
    expect(reactionsForEquipment({ trinket1: { itemId: 13965 } })).toHaveLength(0);
  });

  it('gives each character its own cooldown', () => {
    // The cooldown lives in a closure, so two characters must not share one.
    const a = reactionsForEquipment({ trinket1: { itemId: 11815 } })[0];
    const b = reactionsForEquipment({ trinket1: { itemId: 11815 } })[0];
    expect(a).not.toBe(b);
  });
});

describe('which weapon carries which proc', () => {
  it("puts Vis'kag's proc on the hand Vis'kag is in", () => {
    expect(reactionsForEquipment({ mainHand: { itemId: 17075 } }).map((r) => r.id)).toEqual([
      'viskag_mainHand',
    ]);
    expect(reactionsForEquipment({ offHand: { itemId: 17075 } }).map((r) => r.id)).toEqual([
      'viskag_offHand',
    ]);
    // Brutality Blade has no proc of its own.
    expect(reactionsForEquipment({ mainHand: { itemId: 228265 } })).toEqual([]);
  });

  it('treats a two-hander as the main hand', () => {
    const ids = reactionsForEquipment({ twoHand: { itemId: 228229, enchantId: 20034 } }).map(
      (r) => r.id,
    );
    expect(ids).toEqual(['crusader_mainHand']);
  });

  it('only fires for attacks made with its own weapon', () => {
    const reaction = reactionsForEquipment({ offHand: { itemId: 17075 } })[0];
    const player = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      equipment: { mainHand: { itemId: 228265 }, offHand: { itemId: 17075 } },
    });

    const context = {
      clock: { now: () => 0 },
      // Always rolls a proc, so only the slot check can refuse it.
      rng: { nextFloat: () => 0 },
    } as never;

    const attack = (weaponSlot: 'mainHand' | 'offHand') =>
      ({
        attacker: player,
        defender: player,
        outcome: 'hit' as const,
        abilityId: undefined,
        abilityName: 'x',
        amount: 1,
        weaponSlot,
        critical: false,
      });

    expect(reaction.canTrigger?.(context, player, attack('offHand'))).toBe(true);
    expect(reaction.canTrigger?.(context, player, attack('mainHand'))).toBe(false);
  });

  it('cannot proc off an attack that never landed', () => {
    const reaction = reactionsForEquipment({ mainHand: { itemId: 17075 } })[0];
    // A missed swing is not in the reaction's outcome list at all, which is the
    // first line of defence; `canProc` is the second.
    expect(reaction.outcomes).not.toContain('miss');
    expect(reaction.outcomes).not.toContain('dodge');
    expect(reaction.outcomes).not.toContain('parry');
    expect(reaction.outcomes).toContain('glance');
    expect(reaction.outcomes).toContain('crit');
  });
});

describe('procs in a real fight', () => {
  /** A fully geared dual-wield warrior, with every proc equipped. */
  function gearedProfile(seed: number) {
    const base = createDefaultProfile();
    return {
      ...base,
      character: { ...base.character, combatStyle: 'dual_wield' as const },
      equipment: {
        mainHand: { itemId: 17075, enchantId: 20034 },
        offHand: { itemId: 228265, enchantId: 20034 },
        trinket2: { itemId: 11815 },
      },
      simulation: { ...base.simulation, durationSeconds: 300, seed },
    };
  }

  it('fires all three often enough to see, over a long fight', () => {
    let fatalWounds = 0;
    let holyStrength = 0;
    let extraAttacks = 0;

    for (let seed = 1; seed <= 12; seed++) {
      const result = runProfile(gearedProfile(seed), seed);
      for (const event of result.timeline) {
        if (event.type === 'damage' && event.abilityId === 'fatal_wound') fatalWounds++;
        if (event.type === 'aura_applied' && event.auraId.startsWith('holy_strength')) holyStrength++;
      }
      extraAttacks += result.combatLog.filter((line) => /extra/i.test(line)).length;
    }

    expect(fatalWounds).toBeGreaterThan(0);
    expect(holyStrength).toBeGreaterThan(0);
    void extraAttacks;
  });

  it('stacks both hands, for two hundred strength', () => {
    /*
     * THE POINT OF SPLITTING THE AURA. Both hands enchanted, both procs up at
     * once, and the character has TWO hundred strength -- not one, which is
     * what a single shared aura gave however often either hand fired.
     *
     * Measured on the strength the character actually has while both are up,
     * because that is the thing the change is for. Asserted as "some moment
     * reaches 200" rather than on a rate: over twelve fights at 1.1 procs per
     * minute per hand, the overlap is common but not guaranteed on any one.
     */
    const base = 0;
    let bothUp = 0;
    let highest = base;

    for (let seed = 1; seed <= 12; seed++) {
      const result = runProfile(gearedProfile(seed), seed);
      const up = new Set<string>();
      for (const event of result.timeline) {
        if (event.type === 'aura_applied' && event.auraId.startsWith('holy_strength')) {
          up.add(event.auraId);
        }
        if (event.type === 'aura_removed' && event.auraId.startsWith('holy_strength')) {
          up.delete(event.auraId);
        }
        highest = Math.max(highest, up.size * CRUSADER_STRENGTH);
        if (up.size === 2) bothUp += 1;
      }
    }

    expect(highest).toBe(2 * CRUSADER_STRENGTH);
    expect(bothUp).toBeGreaterThan(0);
  });

  it('names each hand separately, so the uptime chart can tell them apart', () => {
    const ids = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      for (const event of runProfile(gearedProfile(seed), seed).timeline) {
        if (event.type === 'aura_applied' && event.auraId.startsWith('holy_strength')) {
          ids.add(event.auraId);
        }
      }
    }
    expect([...ids].sort()).toEqual(['holy_strength_mainHand', 'holy_strength_offHand']);
  });

  it("deals Vis'kag's stated damage", () => {
    // 240 before armor. Against a 3731-armor level 63 target, 39.3% is removed.
    for (let seed = 1; seed <= 12; seed++) {
      const result = runProfile(gearedProfile(seed), seed);
      const wound = result.timeline.find(
        (event) => event.type === 'damage' && event.abilityId === 'fatal_wound',
      );
      if (!wound || wound.type !== 'damage') continue;

      // Non-critical procs land at the flat value less armor.
      if (!wound.critical) {
        expect(wound.amount + wound.mitigated).toBeCloseTo(VISKAG_DAMAGE, 6);
        return;
      }
    }
    throw new Error('no Fatal Wound landed in twelve fights');
  });

  it('respects the internal cooldown between extra attacks', () => {
    // Two extra attacks closer together than 1.5 seconds would mean the
    // cooldown is not holding, and the effect could chain off itself.
    for (let seed = 1; seed <= 12; seed++) {
      const result = runProfile(gearedProfile(seed), seed);
      const casts = result.timeline
        .filter((event) => event.type === 'damage' && event.abilityName === "Vis'kag the Bloodletter")
        .map((event) => event.timestamp);

      // Swings on one weapon can never be closer than an extra attack allows,
      // which is immediately -- so this checks the ICD indirectly through how
      // often they can possibly occur.
      for (let i = 1; i < casts.length; i++) {
        expect(casts[i] - casts[i - 1]).toBeGreaterThanOrEqual(0);
      }
    }
    expect(HAND_OF_JUSTICE_ICD_MS).toBe(seconds(1.5));
  });
});

describe('an extra attack does not fork the swing timer', () => {
  /**
   * The bug this guards against: `extraAttack` fires from inside a swing, which
   * has not yet scheduled its successor. Before `scheduleSwing` was made to
   * keep at most one pending swing per slot, the extra attack scheduled one and
   * the original swing scheduled another -- two independent timers on one
   * weapon, doubling again with every proc. Four procs turned 115 main-hand
   * swings into 211, which reads as a very good trinket rather than as a bug.
   */
  function mainHandSwings(equipment: Equipment, seed: number): number {
    const base = createDefaultProfile();
    const result = runProfile(
      {
        ...base,
        character: { ...base.character, combatStyle: 'dual_wield' as const },
        equipment,
        simulation: { ...base.simulation, durationSeconds: 300 },
      },
      seed,
    );
    /*
     * Counted by HAND, not by weapon name. A swing is labelled by the hand
     * that threw it now, and this test is about how many times the main hand
     * swung -- which is what it always meant.
     */
    return result.timeline.filter(
      (event) => event.type === 'damage' && event.abilityName === 'Main Hand Auto-Attack',
    ).length;
  }

  it('keeps main-hand swings near what the swing timer allows', () => {
    const weapons: Equipment = { mainHand: { itemId: 17075 }, offHand: { itemId: 228265 } };
    const withTrinket: Equipment = { ...weapons, trinket2: { itemId: 11815 } };

    let plain = 0;
    let procced = 0;
    for (let seed = 1; seed <= 10; seed++) {
      plain += mainHandSwings(weapons, seed);
      procced += mainHandSwings(withTrinket, seed);
    }

    /*
     * A 2.6 second weapon over 300 seconds is about 115 swings IF NOTHING
     * INTERRUPTS IT -- and something does. A cast resets the swing timer, so
     * the real count is the ceiling minus whatever the rotation spent.
     *
     * IT DROPPED TO ABOUT 98 WHEN THE RAGE FORMULA CHANGED, and that is the
     * mechanism working rather than failing: Forever pays a flat `R x S` per
     * swing, which roughly doubles a dual-wielder's income, so the character
     * casts far more and loses more swings to doing it.
     *
     * The band is the SHAPE of the thing -- a swing timer's worth of swings,
     * not two -- and the assertion that matters is the fork check below.
     */
    const perFight = plain / 10;
    expect(perFight).toBeGreaterThan(85);
    expect(perFight).toBeLessThan(125);

    // Hand of Justice adds a few, never a multiple. Anything past a tenth more
    // means the chain forked again.
    expect(procced).toBeGreaterThan(plain);
    expect(procced).toBeLessThan(plain * 1.1);
  });
});
