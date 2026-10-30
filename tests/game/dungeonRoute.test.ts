import { describe, expect, it } from 'vitest';
import type { CharacterProfile } from '../../src/profiles';
import { validateProfile } from '../../src/profiles';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { Simulation, seconds } from '../../src/engine';
import type { SimulationRun, TelemetryEvent } from '../../src/engine';
import type { ResourceTelemetryEvent } from '../../src/engine/logging/TelemetryEvent';
import { buildSimulationResult } from '../../src/analysis/SimulationResult';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { characterAtCombatStart } from '../../src/simulator';
import {
  DRINK_MANA_PER_SECOND,
  DUNGEON_ROUTE,
  DUNGEON_ROUTE_DURATION_MS,
  DUNGEON_ROUTE_MAX_ENEMIES,
  isHeldMajorCooldown,
  routeTimeMs,
} from '../../src/game/encounters/dungeonRoute';
import { talentBuild } from '../../src/game/talents/talentBuild';

/*
 * ============================================================================
 * THE DUNGEON ROUTE (the owner's timeline): 27 pulls and 26 gaps over 28
 * minutes. The data is checked against itself, and the fight against the
 * event stream -- what landed in a gap, which pull a major cooldown went out
 * in, what the drink and the rage decay came to.
 * ============================================================================
 */

const routed = (id: string, tank = false): CharacterProfile => {
  const built = PRESETS_BY_ID.get(id)!.build();
  return { ...built, encounter: { ...built.encounter, route: 'dungeon', targetAttacks: tank } };
};

const steps = DUNGEON_ROUTE.map((step) => ({ step, start: routeTimeMs(step.start), end: routeTimeMs(step.end) }));
const stepAt = (t: number) => steps.find((s) => t >= s.start && t < s.end) ?? steps[steps.length - 1]!;
const inGap = (t: number) => stepAt(t).step.kind === 'gap';

const runs = new Map<string, SimulationRun>();
function runOf(profile: CharacterProfile, key: string): SimulationRun {
  if (!runs.has(key)) runs.set(key, new Simulation(trainingDummyEncounter(profile, 4242)).run());
  return runs.get(key)!;
}
const playerOf = (run: SimulationRun) => run.actors.find((actor) => actor.kind === 'player')!.id;
const of = <T extends TelemetryEvent['type']>(run: SimulationRun, type: T) =>
  run.telemetry.filter((event): event is Extract<TelemetryEvent, { type: T }> => event.type === type);
const resources = (run: SimulationRun, type: ResourceTelemetryEvent['type']) =>
  run.telemetry.filter((event): event is ResourceTelemetryEvent => event.type === type);

describe('the route as transcribed', () => {
  it('tiles 28 minutes from zero, alternating pull and gap', () => {
    let at = 0;
    for (const [index, { step, start, end }] of steps.entries()) {
      expect(start).toBe(at);
      expect(end).toBeGreaterThan(start);
      expect(step.kind).toBe(index % 2 === 0 ? 'pull' : 'gap');
      at = end;
    }
    expect(DUNGEON_ROUTE_DURATION_MS).toBe(seconds(28 * 60));
    expect(steps).toHaveLength(53);
  });

  it('has the owner’s pulls: 14 at most, ten calling for cooldowns, 1145 seconds in combat', () => {
    const pulls = DUNGEON_ROUTE.filter((step) => step.kind === 'pull');
    expect(DUNGEON_ROUTE_MAX_ENEMIES).toBe(14);
    expect(pulls.filter((step) => step.kind === 'pull' && step.cooldowns)).toHaveLength(10);
    const inCombat = steps.filter((s) => s.step.kind === 'pull').reduce((sum, s) => sum + s.end - s.start, 0);
    expect(inCombat).toBe(seconds(1145));
    // The last pull is the level 63 boss.
    expect(pulls[pulls.length - 1]).toMatchObject({ count: 1, level: 63, cooldowns: true });
  });

  it('drinks in thirteen gaps, 375 seconds in all', () => {
    const drinking = steps.filter((s) => s.step.kind === 'gap' && s.step.drink);
    expect(drinking).toHaveLength(13);
    expect(drinking.reduce((sum, s) => sum + s.end - s.start, 0)).toBe(seconds(375));
  });
});

describe('a fight on the route', () => {
  it('casts nothing and deals nothing in a gap', () => {
    for (const id of ['dw_fury', 'mage_arcane', 'bm_hunter']) {
      const run = runOf(routed(id), id);
      expect(of(run, 'cast').filter((event) => inGap(event.timestamp))).toEqual([]);
      expect(of(run, 'damage').filter((event) => event.amount > 0 && inGap(event.timestamp))).toEqual([]);
    }
  });

  it('spends a major damage cooldown only in a pull that calls for cooldowns, and does spend them', () => {
    for (const id of ['dw_fury', 'mage_arcane', 'bm_hunter']) {
      const profile = routed(id);
      const book = characterAtCombatStart(profile)!;
      const held = new Set(book.abilities.all.filter(isHeldMajorCooldown).map((ability) => ability.id));
      expect(held.size).toBeGreaterThan(0);
      const casts = of(runOf(profile, id), 'cast').filter((event) => held.has(event.abilityId));
      expect(casts.length).toBeGreaterThan(0);
      for (const cast of casts) {
        const { step } = stepAt(cast.timestamp);
        expect(step.kind === 'pull' && step.cooldowns, `${id} ${cast.abilityId} at ${cast.timestamp}`).toBe(true);
      }
    }
  });

  it('holds damage cooldowns and leaves mana, health and mitigation ones free', () => {
    const book = characterAtCombatStart(routed('mage_arcane'))!;
    expect(isHeldMajorCooldown(book.abilities.get('arcane_power')!)).toBe(true);
    expect(isHeldMajorCooldown(book.abilities.get('evocation')!)).toBe(false);
    expect(isHeldMajorCooldown(book.abilities.get('major_mana_potion')!)).toBe(false);
  });

  it('strikes only the enemies in the pull', () => {
    const run = runOf(routed('mage_arcane'), 'mage_arcane');
    for (const event of of(run, 'damage')) {
      const { step } = stepAt(event.timestamp);
      if (step.kind !== 'pull') continue;
      const index = Number(event.targetId.replace('dummy_', ''));
      expect(index, `${event.abilityName} at ${event.timestamp}`).toBeLessThanOrEqual(step.count);
    }
  });

  it('drinks 165 mana a second through every drinking gap', () => {
    const run = runOf(routed('mage_arcane'), 'mage_arcane');
    const player = playerOf(run);
    const drunk = resources(run, 'resource_gained')
      .filter((event) => event.actorId === player && event.source === 'drinking')
      .reduce((sum, event) => sum + event.amount + event.wasted, 0);
    expect(drunk).toBe(DRINK_MANA_PER_SECOND * 375);
  });

  it('decays a warrior’s rage out of combat, after Lingering Rage’s delay and at Anger Management’s 70%', () => {
    const profile = routed('dw_fury');
    const build = talentBuild('warrior', profile.talents);
    expect(build.rageDecayDelaySeconds).toBe(4);
    expect(build.rageDecayReductionPercent).toBe(30);

    const run = runOf(profile, 'dw_fury');
    const decay = resources(run, 'resource_spent').filter((event) => event.source === 'out_of_combat_decay');
    expect(decay.length).toBeGreaterThan(0);
    for (const event of decay) {
      expect(event.amount).toBeLessThanOrEqual(0.7 + 1e-9);
      const gap = stepAt(event.timestamp - 1);
      expect(gap.step.kind).toBe('gap');
      expect(event.timestamp - gap.start).toBeGreaterThanOrEqual(seconds(5));
    }
    // Anger Management grants nothing out of combat.
    const gapGains = resources(run, 'resource_gained').filter(
      (event) => event.source === 'anger_management' && inGap(event.timestamp),
    );
    expect(gapGains).toEqual([]);
  });

  it('divides DPS by the time in combat', () => {
    const run = runOf(routed('dw_fury'), 'dw_fury');
    const result = buildSimulationResult(run);
    expect(run.inCombatMs).toBe(seconds(1145));
    expect(result.inCombatMs).toBe(seconds(1145));
    expect(result.damage.dps).toBeCloseTo(result.damage.total / 1145, 6);
  });

  it('runs a tank on it, and an absent enemy swings at nobody', () => {
    const run = runOf(routed('prot_warr', true), 'prot_warr_tank');
    const swings = of(run, 'damage').filter((event) => event.sourceId.startsWith('dummy_'));
    expect(swings.length).toBeGreaterThan(0);
    for (const event of swings) {
      const { step } = stepAt(event.timestamp);
      expect(step.kind, `swing at ${event.timestamp}`).toBe('pull');
      if (step.kind === 'pull') expect(Number(event.sourceId.replace('dummy_', ''))).toBeLessThanOrEqual(step.count);
    }
  });

  it('survives a save and a load', () => {
    const result = validateProfile(routed('dw_fury'));
    expect(result.ok && result.profile.encounter.route).toBe('dungeon');
  });
});
