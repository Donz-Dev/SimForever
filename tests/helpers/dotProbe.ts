import type { Ability, Combatant, RNG, TelemetryEvent } from '../../src/engine';
import { Simulation, seconds } from '../../src/engine';
import type { ClassId } from '../../src/game/character';
import { classAbilityCatalog } from '../../src/game/abilities/abilitiesForClass';
import { PROWL } from '../../src/game/auras/druid';
import { STEALTH } from '../../src/game/auras/rogue';
import { WARRIOR_STANCES } from '../../src/game/auras/warrior';
import { MAX_COMBO_POINTS } from '../../src/game/combat/comboPoints';
import type { ProfilePreset } from '../../src/profiles';
import { PROFILE_PRESETS } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * ==============================================================================
 * WHICH ABILITIES APPLY A DAMAGE-OVER-TIME EFFECT, FOUND BY CASTING EACH (round
 * 67). Every ability in every class's catalogue -- base and talent-granted -- is
 * cast once on a preset of that class: resources full, cooldowns reset, rolls
 * forced to land, stealth up, nothing else acting, each Warrior stance tried.
 *
 * IT COUNTS ONLY ITS OWN TICKS, by id or by name. A forced roll procs Deep
 * Wounds, Ignite and the poisons off any hit, and the first version of this
 * read Heroic Strike and Mutilate as DoTs because of them.
 * ==============================================================================
 */

export type DotOutcome = 'dot' | 'none' | `refused: ${string}`;

function alwaysWins(inner: RNG): RNG {
  return {
    next: () => inner.next(),
    nextInt: (min, max) => inner.nextInt(min, max),
    nextFloat: (min, max) => inner.nextFloat(min, max),
    nextDuration: (min, max) => inner.nextDuration(min, max),
    pick: (items) => inner.pick(items),
    rollChance: () => true,
  };
}

function attempt(preset: ProfilePreset, ability: Ability, stanceId: string | undefined): DotOutcome {
  const ticks: TelemetryEvent[] = [];
  const config = trainingDummyEncounter(preset.build(), 7);
  const simulation = new Simulation({ ...config, durationMs: seconds(120) }, { emit: (event) => ticks.push(event) });
  (simulation as { rng: RNG }).rng = alwaysWins(simulation.rng);
  simulation.begin();
  const player = simulation.combatants.find((actor) => actor.kind === 'player') as Combatant;
  const target = simulation.combatants.find((actor) => actor.faction === 'hostile') as Combatant;
  (player as { rotation?: unknown }).rotation = undefined;
  simulation.advanceTo(seconds(5));
  if (!player.abilities.has(ability.id)) player.abilities.add(ability);
  for (const aura of [...target.auras.activeIterable]) target.auras.remove(simulation, aura.definition.id);
  for (const type of ['rage', 'energy', 'mana', 'focus'] as const) {
    const pool = player.resources.get(type);
    if (pool) pool.gain(pool.maximum);
  }
  const combo = player.resources.get('comboPoints');
  if (combo) {
    combo.gain(MAX_COMBO_POINTS);
    (player as { comboPointTargetId?: string }).comboPointTargetId = target.id;
  }
  player.gcdReadyAt = 0;
  player.abilities.resetCooldowns();
  if (preset.characterClass === 'rogue') simulation.applyAura(player, STEALTH, player.id);
  if (preset.characterClass === 'druid') simulation.applyAura(player, PROWL, player.id);
  if (stanceId) {
    for (const stance of WARRIOR_STANCES) if (stance.id !== stanceId) player.auras.remove(simulation, stance.id);
    simulation.applyAura(player, WARRIOR_STANCES.find((stance) => stance.id === stanceId)!, player.id);
  }
  const known = player.abilities.get(ability.id)!;
  const rejection = simulation.castRejection(player, known, target);
  if (rejection !== undefined || !simulation.cast(player, known, target).ok) return `refused: ${rejection}`;
  const from = ticks.length;
  simulation.advanceTo(seconds(70));
  const own = ticks.slice(from).some(
    (event) =>
      event.type === 'damage' &&
      (event as { periodic?: boolean }).periodic === true &&
      (event as { sourceId?: string }).sourceId === player.id &&
      ((event as { abilityId?: string }).abilityId === known.id ||
        (event as { abilityName?: string }).abilityName === known.name),
  );
  return own ? 'dot' : 'none';
}

/** Every class's abilities, `class/id` to what casting it did. */
export function probeDots(): ReadonlyMap<string, DotOutcome> {
  const results = new Map<string, DotOutcome>();
  const classes = [...new Set(PROFILE_PRESETS.map((preset) => preset.characterClass))] as ClassId[];
  for (const characterClass of classes) {
    const presets = PROFILE_PRESETS.filter((preset) => preset.characterClass === characterClass);
    const stances = characterClass === 'warrior' ? ['battle_stance', 'berserker_stance', 'defensive_stance'] : [undefined];
    for (const ability of classAbilityCatalog(characterClass)) {
      let outcome: DotOutcome = 'refused: ?';
      search: for (const preset of presets) {
        for (const stance of stances) {
          outcome = attempt(preset, ability, stance);
          if (!outcome.startsWith('refused')) break search;
        }
      }
      results.set(`${characterClass}/${ability.id}`, outcome);
    }
  }
  return results;
}
