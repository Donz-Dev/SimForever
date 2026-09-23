import { describe, expect, it } from 'vitest';
import { toSeconds } from '../../src/engine';
import { createDefaultProfile } from '../../src/profiles';
import { FIGHT_DURATION_VARIANCE, runProfile, runProfileBatch } from '../../src/simulator';

/**
 * End-to-end tests for the first-milestone prototype: one player, one training
 * dummy, a real fight running through the real engine.
 */
describe('player versus training dummy', () => {
  /*
   * BATTLE STANCE, stated rather than defaulted.
   *
   * The default profile is a dual-wield Warrior, and dual-wield in Berserker
   * Stance now has its own priority list -- one with no Rend in it. A test
   * that asserts Rend ticks has to run a rotation that casts Rend, and the
   * only honest way to do that is to say which rotation it means.
   *
   * CLAUDE.md warns about exactly this: naming an ability in a training-dummy
   * assertion pins a rotation decision rather than the behaviour under test.
   * These assertions are about the engine end to end, so they pick the list
   * that exercises it rather than following whatever the default happens to be.
   */
  const profile = {
    ...createDefaultProfile(),
    character: { ...createDefaultProfile().character, stance: 'battle' as const },
  };

  /** The band a fight of `asked` seconds is allowed to land in. */
  function withinVariance(actualSeconds: number, asked: number) {
    expect(actualSeconds).toBeGreaterThanOrEqual(asked * (1 - FIGHT_DURATION_VARIANCE));
    expect(actualSeconds).toBeLessThanOrEqual(asked * (1 + FIGHT_DURATION_VARIANCE));
  }

  it('completes, and runs for the configured duration give or take the variance', () => {
    /*
     * NOT an exact equality any more. Fight length varies by a fixed fraction
     * the simulator applies to every run, so the assertion is a band. It was
     * exact only because the shipped default was variance zero -- every
     * iteration the same length, which is the one thing a real fight never is.
     */
    const result = runProfile(profile);

    expect(result.endReason).toBe('duration_expired');
    withinVariance(toSeconds(result.durationMs), profile.simulation.durationSeconds);
  });

  it('deals damage and produces a positive DPS', () => {
    const result = runProfile(profile);

    expect(result.damage.total).toBeGreaterThan(0);
    expect(result.damage.dps).toBeGreaterThan(0);
    // Against the duration the fight ACTUALLY ran, not the one asked for.
    expect(result.damage.dps).toBeCloseTo(
      result.damage.total / toSeconds(result.durationMs),
      6,
    );
  });

  it('reduces the dummy health by exactly the damage dealt', () => {
    const result = runProfile(profile);
    const dummy = result.actors.find((actor) => actor.faction === 'hostile');

    expect(dummy).toBeDefined();
    if (!dummy) return;
    expect(dummy.maxHealth - dummy.finalHealth).toBeCloseTo(result.damage.total, 6);
    expect(dummy.isAlive).toBe(true);
  });

  it('uses auto attacks and real warrior abilities', () => {
    const result = runProfile(profile);
    const used = result.damage.byActor[0].abilities.map((entry) => entry.abilityName);

    expect(used).toContain('Main Hand Auto-Attack');
    expect(used).toContain('Rend');

    // Which spenders get used depends on the rage economy, and the rage economy
    // depends on placeholder weapon damage. Asserting on a particular one
    // pinned a rotation decision rather than the thing under test, and broke as
    // soon as Overpower started out-competing Mortal Strike for rage. What
    // matters here is that the warrior fights with abilities at all.
    const autoAttacks = ['Main Hand Auto-Attack', 'Off Hand Auto-Attack'];
    const abilities = used.filter((name) => !autoAttacks.includes(name));
    expect(abilities.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps Rend ticking on the target', () => {
    const result = runProfile(profile);
    const ticks = result.timeline.filter(
      (event) => event.type === 'damage' && event.abilityId === 'rend' && event.periodic,
    );
    expect(ticks.length).toBeGreaterThan(0);
  });

  it('produces a combat log that starts and ends with the fight', () => {
    const result = runProfile(profile);

    expect(result.combatLog.length).toBeGreaterThan(10);
    expect(result.combatLog[0]).toMatch(/^00:00\.000\s+Combat begins/);
    expect(result.combatLog[result.combatLog.length - 1]).toMatch(/Combat ends/);

    const attackPattern = new RegExp(`${profile.character.name} .*hits Training Dummy for`);
    expect(result.combatLog.some((line) => attackPattern.test(line))).toBe(true);
    // Any real ability cast, for the same reason as above.
    expect(result.combatLog.some((line) => /casts \w[\w ]* at Training Dummy/.test(line))).toBe(
      true,
    );
  });

  it('derives the combat log from the same events as the damage totals', () => {
    // The log is a formatter over telemetry, not a second bookkeeping path.
    const result = runProfile(profile);
    const damageEvents = result.timeline.filter((event) => event.type === 'damage');
    const summedFromTimeline = damageEvents.reduce(
      (sum, event) => sum + (event.type === 'damage' ? event.amount : 0),
      0,
    );

    expect(summedFromTimeline).toBeCloseTo(result.damage.total, 6);
  });

  it('is reproducible for a given seed', () => {
    const first = runProfile(profile);
    const second = runProfile(profile);

    expect(second.damage.total).toBe(first.damage.total);
    expect(second.combatLog).toEqual(first.combatLog);
  });

  it('produces different results for different seeds', () => {
    const a = runProfile(profile, 1);
    const b = runProfile(profile, 2);
    expect(a.damage.total).not.toBe(b.damage.total);
  });

  it('scales damage with attack power', () => {
    const weak = runProfile({ ...profile, stats: { ...profile.stats, attackPower: 100 } });
    const strong = runProfile({ ...profile, stats: { ...profile.stats, attackPower: 1000 } });

    expect(strong.damage.total).toBeGreaterThan(weak.damage.total);
  });

  it('reduces damage when the target has armor', () => {
    const unarmored = runProfile(profile);
    const armored = runProfile({
      ...profile,
      encounter: { ...profile.encounter, targetArmor: 7390 },
    });

    expect(armored.damage.total).toBeLessThan(unarmored.damage.total);
  });

  it('runs the full duration even when the target is dealt lethal damage', () => {
    /*
     * THE TARGET DOES NOT DIE. This asserted the opposite until the ruleset
     * owner settled what the encounter is: a damage sink running for a
     * predetermined duration, not something with a health bar to get through.
     *
     * Two thousand health against a geared warrior is gone in seconds, and
     * ending there would cut the iteration short -- which silently changes the
     * denominator of every per-second figure in it. At 2500 iterations a
     * handful of short ones is a quiet bias rather than an obvious failure.
     */
    const result = runProfile({
      ...profile,
      encounter: { ...profile.encounter, targetHealth: 2000 },
    });

    expect(result.endReason).toBe('duration_expired');
    withinVariance(toSeconds(result.durationMs), profile.simulation.durationSeconds);
    expect(result.actors.find((actor) => actor.faction === 'hostile')?.isAlive).toBe(true);
    // And it kept taking damage the whole time, well past its nominal pool.
    expect(result.damage.total).toBeGreaterThan(2000);
  });

  it('runs a caster that does nothing at all without stalling', () => {
    // A Mage uses the Caster style, which never auto-attacks, and has no
    // implemented abilities. It therefore deals literally no damage. The fight
    // must still complete cleanly rather than hanging or throwing.
    const result = runProfile({
      ...profile,
      character: { ...profile.character, race: 'gnome', characterClass: 'mage' },
    });

    expect(result.endReason).toBe('duration_expired');
    expect(result.damage.total).toBe(0);
    expect(result.damage.byActor).toHaveLength(0);
  });

  it('gives a melee class damage where a caster has none', () => {
    const asWarrior = runProfile(profile);
    const asMage = runProfile({
      ...profile,
      character: { ...profile.character, race: 'gnome', characterClass: 'mage' },
    });

    expect(asWarrior.damage.total).toBeGreaterThan(0);
    expect(asMage.damage.total).toBe(0);
  });

  it('swings both weapons for a dual-wielding warrior', () => {
    // Dual-Wield is the Warrior default, so the stock profile should show two
    // separate auto-attack sources on independent timers.
    const result = runProfile(profile);
    const used = result.damage.byActor[0].abilities.map((entry) => entry.abilityName);

    expect(used).toContain('Main Hand Auto-Attack');
    expect(used).toContain('Off Hand Auto-Attack');
  });

  it('swings only the main hand with a two-hander', () => {
    const result = runProfile({
      ...profile,
      character: { ...profile.character, combatStyle: 'two_hander' },
    });
    const used = result.damage.byActor[0].abilities.map((entry) => entry.abilityName);

    expect(used).toContain('Main Hand Auto-Attack');
    expect(used).not.toContain('Off Hand Auto-Attack');
  });

  it('uses a ranged weapon for a hunter', () => {
    const result = runProfile({
      ...profile,
      character: { ...profile.character, race: 'dwarf', characterClass: 'hunter' },
    });
    const used = result.damage.byActor[0].abilities.map((entry) => entry.abilityName);

    expect(used).toEqual(['Ranged Auto-Attack']);
  });

  it('uses paws rather than weapons for a druid in cat form', () => {
    const result = runProfile({
      ...profile,
      character: {
        ...profile.character,
        race: 'night_elf',
        characterClass: 'druid',
        combatStyle: 'cat',
      },
    });
    const used = result.damage.byActor[0].abilities.map((entry) => entry.abilityName);

    /*
     * THE AUTO-ATTACK IS THE POINT, not that it is alone. This asserted an
     * exact list of one while the Druid had no abilities at all; it now runs a
     * Cat rotation, so the check is that the swing comes from a paw rather
     * than from the two-hander in the stat-stick slot.
     */
    expect(used).toContain('Main Hand Auto-Attack');
    expect(used).not.toContain('Off Hand Auto-Attack');

    const swing = result.damage.byActor[0].abilities.find(
      (entry) => entry.abilityName === 'Main Hand Auto-Attack',
    );
    expect(swing?.attempts ?? 0).toBeGreaterThan(0);
  });

  it('runs a short fight without error', () => {
    const result = runProfile({
      ...profile,
      simulation: { ...profile.simulation, durationSeconds: 10 },
    });
    withinVariance(toSeconds(result.durationMs), 10);
    expect(result.damage.total).toBeGreaterThan(0);
  });
});

describe('Monte Carlo batch', () => {
  const profile = {
    ...createDefaultProfile(),
    simulation: {
      durationSeconds: 60,
      iterations: 25,
      seed: 12345,
    },
  };

  it('runs the requested number of iterations', () => {
    const batch = runProfileBatch(profile);
    expect(batch.iterations).toBe(25);
    expect(batch.dps.count).toBe(25);
  });

  it('produces a spread with a sensible mean', () => {
    const batch = runProfileBatch(profile);

    expect(batch.dps.mean).toBeGreaterThan(0);
    expect(batch.dps.min).toBeLessThanOrEqual(batch.dps.mean);
    expect(batch.dps.max).toBeGreaterThanOrEqual(batch.dps.mean);
    expect(batch.dps.standardDeviation).toBeGreaterThan(0);
  });

  it('returns a representative run with a full combat log', () => {
    const batch = runProfileBatch(profile);

    expect(batch.representative.combatLog.length).toBeGreaterThan(10);
    expect(batch.representative.damage.dps).toBeGreaterThan(0);
    // The representative fight should sit near the middle of the distribution.
    expect(batch.representative.damage.dps).toBeGreaterThan(batch.dps.min * 0.9);
    expect(batch.representative.damage.dps).toBeLessThan(batch.dps.max * 1.1);
  });

  it('is reproducible for a given base seed', () => {
    expect(runProfileBatch(profile).dps.mean).toBe(runProfileBatch(profile).dps.mean);
  });

  it('reports progress from start to finish', () => {
    const fractions: number[] = [];
    runProfileBatch({ ...profile, simulation: { ...profile.simulation, iterations: 5 } }, (f) =>
      fractions.push(f),
    );

    expect(fractions).toHaveLength(5);
    expect(fractions[fractions.length - 1]).toBe(1);
  });
});
