import { describe, expect, it } from 'vitest';
import { toSeconds } from '../../src/engine';
import { createDefaultProfile } from '../../src/profiles';
import { runProfile, runProfileBatch } from '../../src/simulator';

/**
 * End-to-end tests for the first-milestone prototype: one player, one training
 * dummy, a real fight running through the real engine.
 */
describe('player versus training dummy', () => {
  const profile = createDefaultProfile();

  it('completes and reports the configured duration', () => {
    const result = runProfile(profile);

    expect(result.endReason).toBe('duration_expired');
    expect(toSeconds(result.durationMs)).toBe(100);
  });

  it('deals damage and produces a positive DPS', () => {
    const result = runProfile(profile);

    expect(result.damage.total).toBeGreaterThan(0);
    expect(result.damage.dps).toBeGreaterThan(0);
    expect(result.damage.dps).toBeCloseTo(result.damage.total / 100, 6);
  });

  it('reduces the dummy health by exactly the damage dealt', () => {
    const result = runProfile(profile);
    const dummy = result.actors.find((actor) => actor.faction === 'hostile');

    expect(dummy).toBeDefined();
    if (!dummy) return;
    expect(dummy.maxHealth - dummy.finalHealth).toBeCloseTo(result.damage.total, 6);
    expect(dummy.isAlive).toBe(true);
  });

  it('uses auto attacks and both abilities', () => {
    const result = runProfile(profile);
    const used = result.damage.byActor[0].abilities.map((entry) => entry.abilityName);

    expect(used).toContain('Melee');
    expect(used).toContain('Strike');
    expect(used).toContain('Rending Wound');
  });

  it('keeps the bleed stacked on the target', () => {
    const result = runProfile(profile);
    const stackEvents = result.timeline.filter(
      (event) => event.type === 'aura_stacks_changed' && event.auraId === 'rending_wound',
    );
    expect(stackEvents.length).toBeGreaterThan(0);
  });

  it('produces a combat log that starts and ends with the fight', () => {
    const result = runProfile(profile);

    expect(result.combatLog.length).toBeGreaterThan(10);
    expect(result.combatLog[0]).toMatch(/^00:00\.000\s+Combat begins/);
    expect(result.combatLog[result.combatLog.length - 1]).toMatch(/Combat ends/);

    const attackPattern = new RegExp(`${profile.character.name} .*hits Training Dummy for`);
    expect(result.combatLog.some((line) => attackPattern.test(line))).toBe(true);
    expect(result.combatLog.some((line) => /casts Strike at Training Dummy/.test(line))).toBe(
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

  it('ends early when the target dies', () => {
    const result = runProfile({
      ...profile,
      encounter: { ...profile.encounter, targetHealth: 2000 },
    });

    expect(result.endReason).toBe('all_enemies_dead');
    expect(result.durationMs).toBeLessThan(100_000);
    expect(result.actors.find((actor) => actor.faction === 'hostile')?.isAlive).toBe(false);
  });

  it('runs a short fight without error', () => {
    const result = runProfile({
      ...profile,
      simulation: { ...profile.simulation, durationSeconds: 10 },
    });
    expect(toSeconds(result.durationMs)).toBe(10);
    expect(result.damage.total).toBeGreaterThan(0);
  });
});

describe('Monte Carlo batch', () => {
  const profile = {
    ...createDefaultProfile(),
    simulation: {
      durationSeconds: 60,
      durationVariance: 0.1,
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
