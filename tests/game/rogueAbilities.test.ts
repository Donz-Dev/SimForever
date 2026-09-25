import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  EVISCERATE_BY_COMBO_POINT,
  SINISTER_STRIKE_BASE_DAMAGE,
} from '../../src/game/abilities/rogue';
import {
  EXPOSE_ARMOR_PER_COMBO_POINT,
  RUPTURE_BY_COMBO_POINT,
  SLICE_AND_DICE_DURATIONS_MS,
  exposeArmorAura,
  ruptureAura,
  sliceAndDiceAura,
} from '../../src/game/auras/rogue';
import { ROGUE_TALENT_EFFECTS } from '../../src/game/talents/rogueEffects';

/*
 * The Rogue's numbers, written out by hand from the beta client's spellbook
 * rather than read back out of the capture. A test that derived its
 * expectations from the file under test would pass whatever the file said.
 */

const rogue = () => createPlayer({ race: 'orc', characterClass: 'rogue' });

const batchOf = (preset: string, iterations: number, seed: number) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed },
  } as never);
};

describe('finishers scale with what they spend', () => {
  it('Eviscerate steps by 170 a point, from 278 to 958', () => {
    /*
     * The source gives ranges -- 224-332 at one point, 904-1,012 at five --
     * and every step is exactly 170 apart with every range exactly 108 wide.
     * The midpoints are taken and the spread dropped, because the combat table
     * supplies the variance a real cast shows.
     */
    expect(EVISCERATE_BY_COMBO_POINT).toEqual([278, 448, 618, 788, 958]);
    for (let i = 1; i < EVISCERATE_BY_COMBO_POINT.length; i += 1) {
      expect(EVISCERATE_BY_COMBO_POINT[i] - EVISCERATE_BY_COMBO_POINT[i - 1]).toBe(170);
    }
  });

  it('Rupture lengthens AND hardens, which Slice and Dice does not', () => {
    // Both halves scale for Rupture; only the duration does for Slice and Dice.
    expect(RUPTURE_BY_COMBO_POINT.map((e) => e.damage)).toEqual([159, 222, 295, 377, 469]);
    expect(RUPTURE_BY_COMBO_POINT.map((e) => e.durationMs / 1000)).toEqual([8, 10, 12, 14, 16]);
    expect(SLICE_AND_DICE_DURATIONS_MS.map((ms) => ms / 1000)).toEqual([9, 12, 15, 18, 21]);
  });

  it('Rupture ticks every two seconds, which every duration divides by', () => {
    /*
     * Eight, ten, twelve, fourteen and sixteen are all even. A three-second
     * cadence would leave a partial final tick on four of the five, and the
     * stated totals would not come out.
     */
    for (const entry of RUPTURE_BY_COMBO_POINT) {
      expect(entry.durationMs % 2000).toBe(0);
    }
    const five = ruptureAura(5);
    expect(five.durationMs).toBe(16_000);
    expect(five.periodic?.intervalMs).toBe(2000);
  });

  it('Expose Armor reaches exactly the Warrior five-stack Sunder figure', () => {
    // 450 a point, and 2,250 at five -- the same armor five Sunders produce.
    expect(EXPOSE_ARMOR_PER_COMBO_POINT).toBe(450);
    expect(exposeArmorAura(5).statModifiers?.[0].value).toBe(-2250);
    expect(exposeArmorAura(1).statModifiers?.[0].value).toBe(-450);
  });

  it('clamps out of range rather than reading past the table', () => {
    // Nothing should ever ask for six, but asking must not return undefined.
    expect(sliceAndDiceAura(9).durationMs).toBe(SLICE_AND_DICE_DURATIONS_MS[4]);
    expect(sliceAndDiceAura(0).durationMs).toBe(SLICE_AND_DICE_DURATIONS_MS[0]);
  });

  it('Improved Slice and Dice lengthens it, and rounds to a whole millisecond', () => {
    // 45% on nine seconds is 13.05 seconds, and time is integer milliseconds.
    const base = sliceAndDiceAura(1).durationMs;
    const improved = sliceAndDiceAura(1, 1.45).durationMs;
    expect(improved).toBe(Math.round(base * 1.45));
    expect(Number.isInteger(improved)).toBe(true);
  });
});

describe('the class is wired up', () => {
  it('gives a Rogue abilities, a rotation, energy and combo points', () => {
    const player = rogue();
    expect(player.abilities.all.length).toBeGreaterThan(0);
    expect(player.rotation).toBeDefined();
    expect(player.resources.has('energy')).toBe(true);
    expect(player.resources.has('comboPoints')).toBe(true);
  });

  it('declares an effect for every one of the 53 talents', () => {
    // A talent with no entry is indistinguishable from one that silently does
    // nothing, which is the whole reason this table is exhaustive.
    expect(Object.keys(ROGUE_TALENT_EFFECTS)).toHaveLength(53);
  });

  it('picks each build list from its capstone, not from a tree total', () => {
    /*
     * A Rogue is dual-wield in every spec and has no stance, so style and
     * stance cannot tell the three apart. A tree total is a number anyone can
     * hit by accident; a capstone is a deliberate choice.
     */
    expect(batchOf('rogue_venom', 1, 1).rotationName).toContain('Venom');
    expect(batchOf('rogue_combat', 1, 1).rotationName).toContain('Combat');
    expect(batchOf('rogue_rupture', 1, 1).rotationName).toContain('Rupture');
  });

  it('Sinister Strike is 68 on top of the weapon, and is what the list runs on', () => {
    expect(SINISTER_STRIKE_BASE_DAMAGE).toBe(68);
    const strikes = batchOf('rogue_combat', 40, 7).abilities.find(
      (a) => a.abilityName === 'Sinister Strike',
    );
    expect(strikes?.uses ?? 0).toBeGreaterThan(5);
  });

  it('casts the dagger abilities now that it holds daggers', () => {
    /*
     * ------------------------------------------------------------------------
     * THIS TEST USED TO ASSERT ZERO, AND IT WAS RIGHT AT THE TIME.
     *
     * The Rogues wore a Warrior's gear with a sword in each hand, so Backstab
     * and Mutilate were uncastable and the Venom list fell back to Sinister
     * Strike for its whole life. Their own `canCast` refused, which was the
     * honest behaviour -- and it meant the build the owner asked for was never
     * the build that ran.
     *
     * Perdition's Blade and Core Hound Tooth are both daggers, so it runs now.
     * The two are checked TOGETHER rather than individually, because which of
     * the two a priority list reaches is a rotation decision and not the thing
     * under test.
     * ------------------------------------------------------------------------
     */
    const venom = batchOf('rogue_venom', 20, 5);
    const uses = (name: string) =>
      venom.abilities.find((ability) => ability.abilityName === name)?.uses ?? 0;

    expect(uses('Mutilate') + uses('Backstab')).toBeGreaterThan(0);

    // Combat still swings swords, so it still cannot.
    const combat = batchOf('rogue_combat', 20, 5);
    const combatUses = (name: string) =>
      combat.abilities.find((ability) => ability.abilityName === name)?.uses ?? 0;
    expect(combatUses('Mutilate') + combatUses('Backstab')).toBe(0);
    expect(combatUses('Sinister Strike')).toBeGreaterThan(5);
  });
});

describe('the finishers it can now afford', () => {
  it('reaches Eviscerate, which it could not before the on-cast hook', () => {
    /*
     * --------------------------------------------------------------------------
     * THIS TEST USED TO ASSERT ZERO, and the assertion was right about the
     * behaviour and wrong about the cause.
     *
     * It recorded that Eviscerate never fired, measured at every Slice and Dice
     * threshold, and blamed RELENTLESS STRIKES being unmodelled. That was one
     * of two causes and the smaller one.
     *
     * THE OTHER WAS A BUG I SHIPPED. `talentValues.ts` maps a class to its
     * values file and the Rogue was not in it, so every rank value resolved to
     * nothing and EVERY ROGUE TALENT WAS SILENTLY INERT -- Malice, Aggression,
     * Improved Sinister Strike, all twenty of them. It was invisible because a
     * talent with no value reports itself `unmodelled`, which is exactly what
     * an unfinished class is supposed to say. Twenty unmodelled talents on a
     * class shipped yesterday looks like progress, not a defect.
     *
     * Both fixed, and the class works: Eviscerate fires about once a fight on
     * the Combat build and the three profiles gained 21, 55 and 88 DPS.
     * --------------------------------------------------------------------------
     */
    const batch = batchOf('rogue_combat', 60, 11);
    expect(batch.abilities.find((a) => a.abilityName === 'Eviscerate')?.uses ?? 0).toBeGreaterThan(
      0.5,
    );
  });

  it('returns energy on a finisher, per combo point spent', () => {
    /*
     * Relentless Strikes, which is what makes the finisher affordable at all.
     * Asserted through the ENERGY LEDGER rather than by counting procs, so it
     * measures the thing the rotation actually feels.
     */
    const batch = batchOf('rogue_combat', 60, 11);
    const returned = batch.rage.gained.find((row) => row.sourceId === 'relentless_strikes');
    expect(returned?.amount ?? 0).toBeGreaterThan(0);
  });

  it('measures the spend by snapshot, so a finisher needs to declare nothing', () => {
    /*
     * The engine snapshots every pool around a cast and reports the
     * difference, which covers the declared cost AND anything the ability
     * drained itself. Ruthlessness keys off that, and it fires only on a cast
     * that spent combo points -- so a builder must never set it off.
     */
    const batch = batchOf('rogue_combat', 60, 11);
    const refunded = batch.rage.gained.find((row) => row.sourceId === 'ruthlessness');
    expect(refunded?.amount ?? 0).toBeGreaterThan(0);
  });

  it('says on the results page what it cannot do', () => {
    // Adrenaline Rush doubles energy regeneration and the engine has no
    // multiplier on it; Blade Flurry's second target does not exist here.
    const named = batchOf('rogue_combat', 20, 3).castButNotSimulated.map(
      (entry) => entry.abilityName,
    );
    expect(named).toContain('Adrenaline Rush');
    expect(named).toContain('Blade Flurry');
  });
});
