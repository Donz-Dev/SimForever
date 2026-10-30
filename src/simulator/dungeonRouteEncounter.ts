import type { Combatant, CombatSegment, Rotation, SimulationConfig, SimulationContext } from '../engine';
import { seconds } from '../engine';
import type { CharacterProfile } from '../profiles';
import { createTrainingDummy } from '../game/actors/createTrainingDummy';
import { EXTRA_TARGET_SWING_DAMAGE, EXTRA_TARGET_SWING_SECONDS } from '../game/encounters/raidBoss';
import type { RouteStep } from '../game/encounters/dungeonRoute';
import {
  DUNGEON_ROUTE,
  DUNGEON_ROUTE_MAX_ENEMIES,
  isHeldMajorCooldown,
  routeTimeMs,
} from '../game/encounters/dungeonRoute';
import { drinkingAura, outOfCombatAura } from '../game/auras/dungeon';
import { talentBuild } from '../game/talents/talentBuild';

/**
 * THE DUNGEON ROUTE AS AN ENCOUNTER: the owner's timeline of pulls and gaps
 * turned into the engine's segments, the enemies they need, and what happens
 * at each boundary. `trainingDummyEncounter` calls these when a profile's
 * `encounter.route` is set; everything else about the fight -- raid buffs, the
 * pet, the opener, threat -- is the ordinary encounter's.
 *
 * ============================================================================
 * FOURTEEN ENEMIES, MADE ONCE, standing in for every pull: the engine cannot
 * add a combatant mid-fight, so a pull of five is the first five present and
 * the rest absent. The first is the PRIMARY target, present in every pull,
 * which is what keeps the raid's debuffs and the rotation's target in one
 * place -- and why the raid's debuffs are put back on it at each pull, since
 * every pull is fresh mobs.
 *
 * EACH PULL SETS ITS ENEMIES' LEVEL, which reaches the combat tables through
 * defense skill, glancing, crit suppression and the armor constant. Their
 * armor is the panel's, which the route does not state.
 *
 * ON A TANK RUN THEY ALL SWING: the primary for the panel's swing damage and
 * ramping from the start of each pull, the rest as the ordinary adds.
 * ============================================================================
 */

export function isDungeonRoute(profile: CharacterProfile): boolean {
  return profile.encounter.route === 'dungeon';
}

const enemyId = (index: number) => `dummy_${index + 1}`;

/** The route's pulls, in order. */
const PULLS = DUNGEON_ROUTE.filter((step): step is Extract<RouteStep, { kind: 'pull' }> => step.kind === 'pull');

/** How many enemies the first pull has -- which APL section the opener belongs to. */
export const FIRST_PULL_TARGETS = PULLS[0]!.count;

/** The route as engine segments. */
export const DUNGEON_ROUTE_SEGMENTS: readonly CombatSegment[] = DUNGEON_ROUTE.map((step) => ({
  startMs: routeTimeMs(step.start),
  endMs: routeTimeMs(step.end),
  enemyIds: step.kind === 'pull' ? Array.from({ length: step.count }, (_, i) => enemyId(i)) : [],
}));

/** Every enemy the route needs, at the first pull's level. */
export function dungeonRouteTargets(profile: CharacterProfile): Combatant[] {
  const { encounter } = profile;
  return Array.from({ length: DUNGEON_ROUTE_MAX_ENEMIES }, (_, index) =>
    createTrainingDummy({
      id: enemyId(index),
      name: `Dungeon enemy ${index + 1}`,
      health: encounter.targetHealth,
      armor: encounter.targetArmor,
      level: PULLS[0]!.level,
      attacks: encounter.targetAttacks,
      ...(index === 0
        ? { swingDamage: encounter.targetSwingDamage, swingSeconds: encounter.targetSwingSeconds }
        : {
            swingDamage: EXTRA_TARGET_SWING_DAMAGE,
            swingSeconds: EXTRA_TARGET_SWING_SECONDS,
            ramps: false,
            namesOwnSwings: true,
          }),
    }),
  );
}

export interface DungeonRouteHooks {
  readonly onSegmentStart: (context: SimulationContext, segment: CombatSegment, index: number) => void;
  readonly holdsAbility: NonNullable<SimulationConfig['holdsAbility']>;
}

/**
 * What happens at each boundary, and which abilities wait.
 *
 * @param rotations the character's two compiled lists, swapped as the pulls
 *        change size; absent when its lists are empty and it runs a stock one
 * @param reapplyTargetDebuffs puts the raid's debuffs back on the primary
 */
export function dungeonRouteHooks(
  profile: CharacterProfile,
  rotations: { readonly single: Rotation; readonly multi: Rotation } | undefined,
  reapplyTargetDebuffs: (context: SimulationContext, target: Combatant) => void,
): DungeonRouteHooks {
  const build = talentBuild(profile.character.characterClass, profile.talents ?? {});
  const decayRate = Math.max(0, 1 - build.rageDecayReductionPercent / 100);
  const decayDelayMs = seconds(build.rageDecayDelaySeconds);
  const pullStartingAt = new Map(PULLS.map((step) => [routeTimeMs(step.start), step]));

  return {
    onSegmentStart: (context, segment, index) => {
      const step = DUNGEON_ROUTE[index]!;
      const players = context.combatants.filter((actor) => actor.kind === 'player');
      if (step.kind === 'pull') {
        for (const id of segment.enemyIds) {
          const enemy = context.combatant(id);
          if (enemy) enemy.level = step.level;
        }
        /*
         * THE GAP'S AURAS ARE LEFT TO EXPIRE, not removed: their last tick lands
         * at the moment they expire, which is this instant, so a forty-five
         * second drink is forty-five ticks. Removing them here would cost every
         * gap its final second.
         */
        for (const player of players) {
          if (rotations) player.rotation = step.count > 1 ? rotations.multi : rotations.single;
        }
        const primary = context.combatant(enemyId(0));
        if (primary && index > 0) {
          // FRESH MOBS: the last pull's ramp does not carry into this one.
          primary.auras.remove(context, 'boss_damage_ramp');
          reapplyTargetDebuffs(context, primary);
        }
        return;
      }
      const length = segment.endMs - segment.startMs;
      for (const player of players) {
        if (player.resources.get('rage')) {
          context.applyAura(player, outOfCombatAura(length, decayRate, decayDelayMs), player.id);
        }
        if (step.drink && player.resources.get('mana')) {
          context.applyAura(player, drinkingAura(length), player.id);
        }
      }
    },

    /*
     * A MAJOR COOLDOWN WAITS FOR A PULL THAT CALLS FOR ONE -- the owner's "Use
     * all available offensive cooldowns". Read off the pull the clock is in,
     * so nothing here holds state between iterations. Out of combat nothing
     * casts anyway.
     */
    holdsAbility: (context, actor, ability) => {
      if (actor.faction !== 'friendly' || !isHeldMajorCooldown(ability)) return false;
      return !(pullStartingAt.get(context.combatStartedAt)?.cooldowns ?? false);
    },
  };
}
