import { describe, expect, it } from 'vitest';
import { createDefaultProfile } from '../../src/profiles';
import { runProfileBatch } from '../../src/simulator';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { legalise } from '../helpers/legalTalents';

/*
 * Uptime, averaged across a batch.
 *
 * A cast count cannot answer "was Sunder Armor up", and neither can a damage
 * table. These are the numbers that make a buff or a debuff auditable at all.
 */

function batch(extra: Record<string, unknown> = {}, talents: Record<string, number> = {}) {
  const base = createDefaultProfile();
  return runProfileBatch({
    ...base,
    character: { ...base.character, combatStyle: 'dual_wield', stance: 'berserker' },
    equipment: startingEquipmentFor('warrior', 'dual_wield'),
    talents,
    /*
     * ========================================================================
     * BLOODRAGE *THEN* BATTLE SHOUT, AND THE ORDER IS LOAD-BEARING.
     *
     * The Berserker list no longer casts the shout -- the owner moved it, the
     * stance and Charge into `precombat` on all three Warrior profiles -- so a
     * hand-built warrior like this fixture has to declare it or there is no
     * Battle Shout row at all, which is how this test first failed.
     *
     * AND A SHOUT ALONE IS SILENTLY REFUSED. It costs 10 rage, a warrior opens
     * on an empty bar, and `runPrecombat` SKIPS a cast it cannot pay for --
     * exactly as a priority list would. Bloodrage's instant 10 is what makes
     * the next line affordable, which is why the owner's own openers write the
     * two in this order at the same lead time.
     * ========================================================================
     */
    precombat: [
      { abilityId: 'bloodrage_cast', secondsBefore: 10 },
      { abilityId: 'battle_shout_cast', secondsBefore: 10 },
    ],
    simulation: { ...base.simulation, iterations: 40, seed: 17, durationSeconds: 60 },
    ...extra,
  } as never);
}

describe('buff uptime', () => {
  it('is a fraction between zero and one', () => {
    for (const row of batch().buffUptime) {
      expect(row.uptime).toBeGreaterThan(0);
      expect(row.uptime).toBeLessThanOrEqual(1);
    }
  });

  it('reports Battle Shout as up almost the whole fight', () => {
    /*
     * THE CASE THAT BREAKS A NAIVE IMPLEMENTATION. Battle Shout lasts three
     * minutes and the fight is sixty seconds, so it is applied once and NEVER
     * REMOVED -- there is no expiry event to close the window with. An
     * accounting that only closed on removal would report it at 0%.
     *
     * IT IS EXACTLY 1 NOW, AND IT USED TO BE "not exactly 1: the rotation casts
     * it a moment into the fight". The shout is a PRE-COMBAT action here, so it
     * is already up when the clock starts -- which is the second observable
     * consequence of that feature after the lead time, and is asserted rather
     * than left as a looser bound that would also pass if it were cast late.
     */
    const shout = batch().buffUptime.find((row) => row.auraName === 'Battle Shout');
    expect(shout).toBeDefined();
    expect(shout!.uptime).toBe(1);
  });

  it('counts a refresh as an application without reopening the window', () => {
    /*
     * A refresh extends a window; it does not start a new one. Treating it as
     * a fresh application would reset `openedAt` and silently discard every
     * millisecond the aura had already been up -- an aura refreshed often
     * would report LESS uptime than one refreshed never.
     */
    const stance = batch().buffUptime.find((row) => row.auraName === 'Berserker Stance');
    expect(stance).toBeDefined();
    // Applied at combat start and never replaced, so it is up for all of it.
    expect(stance!.uptime).toBeCloseTo(1, 2);
    expect(stance!.applications).toBeCloseTo(1, 5);
  });

  it('separates the player from the target', () => {
    // A buff is not a debuff, and nothing should appear in both lists.
    const result = batch();
    const buffs = new Set(result.buffUptime.map((row) => row.auraId));
    for (const debuff of result.debuffUptime) {
      expect(buffs.has(debuff.auraId)).toBe(false);
    }
  });
});

describe('debuff uptime on the target', () => {
  it('reports Sunder Armor, which the rotation maintains', () => {
    const sunder = batch().debuffUptime.find((row) => row.auraName === 'Sunder Armor');
    expect(sunder).toBeDefined();
    // The list keeps it to five stacks and refreshes before it drops.
    expect(sunder!.uptime).toBeGreaterThan(0.8);
  });

  it('reports Deep Wounds when the talent is taken, and not when it is not', () => {
    /*
     * The ablation that proves the number is measuring the talent rather than
     * something that was going to happen anyway.
     */
    const without = batch().debuffUptime.find((row) => row.auraName === 'Deep Wounds');
    expect(without).toBeUndefined();

    const withIt = batch({}, legalise({ deep_wounds: 3 })).debuffUptime.find(
      (row) => row.auraName === 'Deep Wounds',
    );
    expect(withIt).toBeDefined();
    expect(withIt!.uptime).toBeGreaterThan(0);
  });

  it('is read off the target, so an empty encounter reports nothing', () => {
    // Every debuff here is applied BY the player TO the dummy. If the lists
    // were keyed on the caster, the player's own list would carry them.
    const result = batch();
    expect(result.buffUptime.some((row) => row.auraName === 'Sunder Armor')).toBe(false);
  });
});

describe('uptime is a batch average, not one iteration', () => {
  it('changes smoothly with more iterations rather than jumping', () => {
    /*
     * A single-iteration read of a 30% proc is either 0% or whatever that one
     * fight happened to give. Two batches at different sizes should agree to
     * within a few points; two single fights need not.
     */
    /*
     * ========================================================================
     * THE SUBJECT IS A PROC NOW, WHICH IS WHAT THE PARAGRAPH ABOVE DESCRIBES.
     *
     * It read Battle Shout, and Battle Shout is a three-minute buff on a
     * sixty-second fight: it was 0.95-to-1 before and is EXACTLY 1 now that it
     * is applied before the pull, so it could not have shown smoothness at any
     * batch size. Two constants agreeing to within five points asserts nothing.
     *
     * Overpower Ready is the real case -- a window opened by the target dodging,
     * which lands near a third of the fight and genuinely varies per iteration.
     * ========================================================================
     */
    const subject = 'Overpower Ready';
    const forty = batch().buffUptime.find((r) => r.auraName === subject)!.uptime;
    const eighty = batch({
      simulation: { ...createDefaultProfile().simulation, iterations: 80, seed: 23, durationSeconds: 60 },
    }).buffUptime.find((r) => r.auraName === subject)!.uptime;

    // It varies at all, or the comparison is between two constants again.
    expect(forty).toBeGreaterThan(0.05);
    expect(forty).toBeLessThan(0.95);
    expect(Math.abs(forty - eighty)).toBeLessThan(0.05);
  });
});
