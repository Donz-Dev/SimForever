import type { PartialStats } from '../../engine';
import { Combatant, addStats, makeStats } from '../../engine';
import { abilitiesForClass } from '../abilities/exampleAbilities';
import type { ClassId, CombatStyleId, RaceId } from '../character';
import {
  baseHitPointsFor,
  baseManaFor,
  baseStatsFor,
  baseStatsToEngineStats,
  conversionsFor,
  deriveFromPrimaries,
  resolveCombatStyle,
  resourceSpecsFor,
  statDerivationFor,
} from '../character';
import { rotationFor } from '../rotations/basicMeleeRotation';
import { autoAttackModeForStyle, weaponsForStyle } from './weapons';

export interface PlayerOptions {
  readonly id?: string;
  readonly name?: string;
  readonly race: RaceId;
  readonly characterClass: ClassId;
  /**
   * How the character fights. Defaults to the class default, and a style the
   * class cannot use falls back to it too.
   */
  readonly combatStyle?: CombatStyleId;
  /**
   * Stats from gear, buffs and anything else on top of the race/class base.
   * Added to the base rather than replacing it.
   */
  readonly bonusStats?: PartialStats;
}

/**
 * Build a player combatant for a race, class and combat style.
 *
 * Three layers, in order:
 *
 *   1. **Base stats** for the race, class and style, from the spreadsheet.
 *   2. **Gear and other bonuses** from the profile, added on top.
 *   3. **Conversions**, which turn the resulting primary stats into attack
 *      power, armor, crit, dodge, mana regen, hit points and mana.
 *
 * Steps 1 and 2 happen here. Step 3 is handed to the stat block as a function,
 * so it re-runs whenever a buff changes a primary stat.
 *
 * The combat style also decides which weapons swing and which rotation runs.
 * For a Druid it is the form, so it feeds into the stat lookup and conversions
 * as well.
 *
 * Hit points and mana are the exception. They are resource maximums rather than
 * stats, so they are computed once here from the starting stats. A buff that
 * changes stamina mid-fight will not currently resize the health pool.
 */
export function createPlayer(options: PlayerOptions): Combatant {
  const { race, characterClass } = options;
  const style = resolveCombatStyle(characterClass, options.combatStyle);

  const base = baseStatsFor(race, characterClass, style);
  if (!base) {
    throw new Error(
      `No base stats for ${race} ${characterClass} (${style} style). ` +
        'Is that a legal combination?',
    );
  }

  // Layers 1 and 2: the stats a character has before any conversion.
  const startingStats = addStats(
    makeStats(baseStatsToEngineStats(base)),
    options.bonusStats ?? {},
  );

  // Layer 3, for the resource maximums only. The stat block handles the rest.
  const conversions = conversionsFor(characterClass, style);
  const derived = deriveFromPrimaries(startingStats, conversions);

  const abilities = abilitiesForClass(characterClass, style);
  const rotation = rotationFor(characterClass, style);

  return new Combatant({
    id: options.id ?? 'player_1',
    name: options.name ?? 'Player',
    kind: 'player',
    faction: 'friendly',
    maxHealth: baseHitPointsFor(race, characterClass, style) + derived.hitPoints,
    stats: startingStats,
    statDerivation: statDerivationFor(characterClass, style),
    resources: resourceSpecsFor(
      characterClass,
      baseManaFor(race, characterClass) + derived.mana,
    ),
    abilities,
    // No abilities means nothing for a rotation to choose, so it is left off
    // rather than scheduling decision events that can never do anything.
    rotation: abilities.length > 0 ? rotation : undefined,
    weapons: weaponsForStyle(style),
    autoAttack: autoAttackModeForStyle(style),
  });
}
