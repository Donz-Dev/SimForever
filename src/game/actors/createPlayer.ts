import type {
  PartialStats,
  ResourceType as ResourceTypeName,
  WeaponProfile,
  WeaponSlot,
} from '../../engine';
import { Combatant, addStats, bindModifiers, makeStats } from '../../engine';
import { abilitiesForBuild } from '../abilities/abilitiesForClass';
import type {
  ClassId,
  CombatStyleId,
  RaceId,
  ResourceMaximumOverrides,
} from '../character';
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
import { MAX_CHARACTER_LEVEL } from '../character';
import { fixedMaximumFor } from '../character';
import { RAGE_FROM_DAMAGE_TAKEN, regenerationFor } from '../combat/resourceRules';
import { reactionsForClass } from '../reactions/reactionsForClass';
import { rotationFor } from '../rotations/rotationFor';
import type { Equipment } from '../items/Item';
import type { TalentAllocation } from '../talents/Talent';
import { talentBuild } from '../talents/talentBuild';
import { liveEquipment, statsForStyle, weaponsForEquipment } from '../items/equipment';
import { reactionsForEquipment } from '../items/procs';
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
  /**
   * Overrides the dual-wield off-hand damage penalty. Defaults to
   * OFF_HAND_DAMAGE_MULTIPLIER; talents that change it pass a value here.
   */
  readonly offHandDamageMultiplier?: number;
  /**
   * Raises a resource cap, for talents that do so. Rage and energy are both
   * normally 100 and both can be increased.
   */
  readonly resourceMaximums?: ResourceMaximumOverrides;
  /**
   * What the character has equipped.
   *
   * Its stats are added on top of `bonusStats`, and its weapons REPLACE the
   * placeholder ones. An empty set falls back to the placeholders, which is
   * what every character did before items existed.
   */
  readonly equipment?: Equipment;
  /**
   * Points spent per talent, which decide the talent-granted abilities the
   * character knows.
   *
   * Omitted means none spent, so a warrior built without one knows no Mortal
   * Strike, Bloodthirst or Shield Slam — the trees make those mutually
   * exclusive capstones, and nobody reaches more than one.
   */
  readonly talents?: TalentAllocation;
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

  // Talents are settled before the fight and never change during it, so they
  // resolve once, here, into plain data. Nothing below this line knows that
  // talents exist.
  const build = talentBuild(characterClass, options.talents);

  // Layers 1 and 2: the stats a character has before any conversion. Gear
  // first, then the profile's own bonuses, then the flat part of the talents.
  const equipment = options.equipment ?? {};
  const startingStats = addStats(
    addStats(
      addStats(makeStats(baseStatsToEngineStats(base)), statsForStyle(equipment, style)),
      options.bonusStats ?? {},
    ),
    build.stats,
  );

  // Layer 3, for the resource maximums only. The stat block handles the rest.
  const conversions = conversionsFor(characterClass, style);
  const derived = deriveFromPrimaries(startingStats, conversions);

  const resources = resourceSpecsFor(
    characterClass,
    baseManaFor(race, characterClass) + derived.mana,
    // Explicit overrides win over talents, so a caller testing a specific cap
    // is not quietly overruled by a build.
    { ...talentResourceMaximums(build.resourceMaximums), ...options.resourceMaximums },
  );

  const abilities = abilitiesForBuild(characterClass, style, build);
  const rotation = rotationFor(characterClass, style);

  const player = new Combatant({
    id: options.id ?? 'player_1',
    name: options.name ?? 'Player',
    kind: 'player',
    faction: 'friendly',
    level: MAX_CHARACTER_LEVEL,
    maxHealth: baseHitPointsFor(race, characterClass, style) + derived.hitPoints,
    stats: startingStats,
    statDerivation: statDerivationFor(characterClass, style),
    resources,
    regeneration: regenerationFor(resources.map((spec) => spec.type)),
    // Only classes with a rage pool build rage from being hit; for everyone
    // else `grantResource` finds no pool and ignores it.
    resourceOnDamageTaken: resources.some((spec) => spec.type === 'rage')
      ? RAGE_FROM_DAMAGE_TAKEN
      : undefined,
    abilities,
    // Per-ability crit and damage scaling, from talents today and from gear or
    // set bonuses later. Held on the combatant so `dealDamage` can consult it
    // without every ability's `onCast` having to remember to.
    abilityModifiers: build.abilityModifiers,
    // Reactive procs, from two sources: the class (a Warrior's Overpower opening
    // because the target dodged) and the gear (Vis'kag, Crusader, Hand of
    // Justice). Gear procs are built per character rather than shared, because
    // Hand of Justice carries its own internal cooldown.
    reactions: [
      ...reactionsForClass(characterClass, style),
      ...reactionsForEquipment(liveEquipment(equipment, style)),
      // Talent procs: Deep Wounds, Flurry and the rest. Built per character
      // from the rank taken, so they carry that character's numbers.
      ...build.reactions,
    ],
    // No abilities means nothing for a rotation to choose, so it is left off
    // rather than scheduling decision events that can never do anything.
    rotation: abilities.length > 0 ? rotation : undefined,
    // Real weapons when something is equipped, placeholders otherwise. The
    // placeholders are invented and the items are not, so anything equipped
    // wins outright rather than being merged.
    weapons: weaponsFor(equipment, style, options.offHandDamageMultiplier),
    autoAttack: autoAttackModeForStyle(style),
  });

  /*
   * Percentage talents stay MODIFIERS rather than being folded into the base.
   *
   * "+2% Stamina" applied as a flat number would be computed once against the
   * unbuffed stat and then be wrong for the rest of the fight. As a modifier it
   * re-derives with everything else, which is the whole reason derived stats
   * are a function over the block rather than a value computed at creation.
   *
   * They share one source id so they are removable together, though nothing
   * removes them: a talent lasts as long as the character does.
   */
  if (build.statModifiers.length > 0) {
    player.stats.addModifiers(bindModifiers(build.statModifiers, TALENT_MODIFIER_SOURCE));
  }

  return player;
}

/** Source id for every stat modifier a talent contributes. */
export const TALENT_MODIFIER_SOURCE = 'talents';

/**
 * Turn a talent's "+10 maximum rage" into the absolute cap the spec wants.
 *
 * A talent states a DELTA and `resourceSpecsFor` takes an absolute, so the two
 * meet here rather than in the talent table -- a talent should say what it adds
 * without having to know what it is adding to.
 *
 * A resource with no fixed maximum (mana, which is derived from stats) is
 * skipped rather than guessed at: adding a delta to a number this function does
 * not have would mean inventing the base.
 */
function talentResourceMaximums(
  deltas: Partial<Record<ResourceTypeName, number>>,
): ResourceMaximumOverrides {
  const overrides: Partial<Record<ResourceTypeName, number>> = {};
  for (const [resource, delta] of Object.entries(deltas) as [ResourceTypeName, number][]) {
    const base = fixedMaximumFor(resource);
    if (base === undefined) continue;
    overrides[resource] = base + delta;
  }
  return overrides;
}

/**
 * The weapons a character swings.
 *
 * Equipped items win outright over the placeholders. A partly equipped
 * character -- a main hand but no off hand -- gets the placeholder for the
 * empty slot rather than nothing, so a half-built character still swings and
 * the missing piece is obvious in the results rather than silent.
 */
function weaponsFor(
  equipment: Equipment,
  style: CombatStyleId,
  offHandDamageMultiplier?: number,
): Partial<Record<WeaponSlot, WeaponProfile>> {
  const placeholders = weaponsForStyle(style, { offHandDamageMultiplier });
  const equipped = weaponsForEquipment(equipment, style, { offHandDamageMultiplier });
  return { ...placeholders, ...equipped };
}
