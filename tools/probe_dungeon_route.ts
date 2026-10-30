/**
 * Does the dungeon route do what it says, read off the event stream: one
 * fight per preset, with per-pull damage, the casts that landed in a gap
 * (should be none), every major cooldown cast and whether its pull called for
 * cooldowns, rage at each pull's start, and mana drunk.
 *
 *   PRESETS=dw_fury,mage_arcane npx vite-node tools/probe_dungeon_route.ts
 *   TANK=1 PRESETS=prot_warr npx vite-node tools/probe_dungeon_route.ts
 */
import { PRESETS_BY_ID, PROFILE_PRESETS } from '../src/profiles/presets';
import { Simulation } from '../src/engine';
import { trainingDummyEncounter } from '../src/simulator/trainingDummyEncounter';
import { DUNGEON_ROUTE, isHeldMajorCooldown, routeTimeMs } from '../src/game/encounters/dungeonRoute';
import { characterAtCombatStart } from '../src/simulator';
import { buildSimulationResult } from '../src/analysis/SimulationResult';

const ids = process.env.PRESETS?.split(',') ?? PROFILE_PRESETS.slice(0, 3).map((preset) => preset.id);
for (const id of ids) {
  const preset = PRESETS_BY_ID.get(id);
  if (!preset) throw new Error(`No preset ${id}`);
  const built = preset.build();
  const profile = {
    ...built,
    encounter: { ...built.encounter, route: 'dungeon' as const, targetAttacks: Boolean(process.env.TANK) },
  };
  const book = characterAtCombatStart(profile)!;
  const held = new Set(book.abilities.all.filter(isHeldMajorCooldown).map((ability) => ability.id));

  const run = new Simulation(trainingDummyEncounter(profile, 777)).run();
  const result = buildSimulationResult(run);
  const playerId = run.actors.find((actor) => actor.kind === 'player')!.id;
  const friendly = new Set(run.actors.filter((actor) => actor.faction === 'friendly').map((actor) => actor.id));

  const steps = DUNGEON_ROUTE.map((step) => ({ step, start: routeTimeMs(step.start), end: routeTimeMs(step.end) }));
  const stepAt = (t: number) => steps.find((s) => t >= s.start && t < s.end) ?? steps[steps.length - 1]!;

  const damage = new Map<number, number>();
  let gapCasts = 0;
  let gapDamage = 0;
  const gapSources = new Map<string, number>();
  let drunk = 0;
  let decayed = 0;
  const cooldownCasts: string[] = [];
  const rageAtPull: number[] = [];
  for (const event of run.telemetry) {
    if (event.type === 'damage' && friendly.has(event.sourceId)) {
      const s = stepAt(event.timestamp);
      if (s.step.kind === 'gap') {
        gapDamage += event.amount;
        gapSources.set(`${event.abilityName}@${event.timestamp}`, event.amount);
      }
      damage.set(s.start, (damage.get(s.start) ?? 0) + event.amount);
    }
    if (event.type === 'cast' && event.sourceId === playerId) {
      const s = stepAt(event.timestamp);
      if (s.step.kind === 'gap') gapCasts++;
      if (held.has(event.abilityId)) {
        const ok = s.step.kind === 'pull' && s.step.cooldowns;
        cooldownCasts.push(`${ok ? '' : '!!'}${event.abilityId}@${s.step.start}`);
      }
    }
    if ((event.type === 'resource_gained' || event.type === 'resource_spent') && event.actorId === playerId) {
      if (event.type === 'resource_gained' && event.source === 'drinking') drunk += event.amount;
      if (event.type === 'resource_spent' && event.source === 'out_of_combat_decay') decayed += event.amount;
    }
  }
  for (const s of steps) {
    if (s.step.kind !== 'pull') continue;
    const lastRage = [...run.telemetry]
      .filter((e) => e.timestamp < s.start && e.type.startsWith('resource') && 'actorId' in e && e.actorId === playerId && 'resource' in e && e.resource === 'rage')
      .pop() as { current: number } | undefined;
    rageAtPull.push(Math.round(lastRage?.current ?? 0));
  }

  console.log(`\n== ${id} ==  DPS ${result.damage.dps.toFixed(1)}  in combat ${(run.inCombatMs / 1000).toFixed(0)}s of ${(run.elapsedMs / 1000).toFixed(0)}s  events ${run.eventsProcessed}`);
  console.log(`  casts in gaps: ${gapCasts}   damage in gaps: ${gapDamage.toFixed(0)}   mana drunk: ${drunk.toFixed(0)}   rage decayed: ${decayed.toFixed(1)}`);
  if (gapSources.size) console.log('  gap damage: ' + [...gapSources].slice(0, 12).map(([k, v]) => `${k}=${v.toFixed(0)}`).join(' '));
  console.log(`  major cooldowns (!! = outside a cooldown pull): ${cooldownCasts.join(' ') || 'none'}`);
  if (book.resources.get('rage')) console.log(`  rage at each pull start: ${rageAtPull.join(' ')}`);
  console.log(
    '  per pull: ' +
      steps
        .filter((s) => s.step.kind === 'pull')
        .map((s) => `${s.step.start} ${((damage.get(s.start) ?? 0) / ((s.end - s.start) / 1000)).toFixed(0)}`)
        .join('  '),
  );
}
