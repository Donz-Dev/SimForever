import type {
  AuraDefinition,
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
  StanceId,
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
  resolveStance,
} from '../character';
import { MAX_CHARACTER_LEVEL } from '../character';
import { fixedMaximumFor } from '../character';
import { RAGE_FROM_DAMAGE_TAKEN, regenerationFor } from '../combat/resourceRules';
import { reactionsForClass } from '../reactions/reactionsForClass';
import { rotationFor } from '../rotations/rotationFor';
import type { Equipment } from '../items/Item';
import type { TalentAllocation } from '../talents/Talent';
import { TALENT_AURAS, WARRIOR_STANCES } from '../auras/warrior';
import { talentBuild } from '../talents/talentBuild';
import { legalAllocation } from '../talents/talentRules';
import { talentsForClass } from '../talents/talentData';
import {
  armorFromItems,
  liveEquipment,
  statsForStyle,
  weaponsForEquipment,
} from '../items/equipment';
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
   * Which stance a Warrior opens in. Ignored by every other class.
   *
   * Omitted takes the combat style's default: Battle for a two-hander,
   * Berserker for dual-wield, Defensive for a shield.
   */
  readonly stance?: StanceId;
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
  /**
   * Damage cannot take this character below one health.
   *
   * For an encounter where the target hits back and a healer is ASSUMED but not
   * modelled. Survival is not what such a run measures; see the engine field of
   * the same name.
   */
  readonly survivesLethalDamage?: boolean;
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

  // Weapons first, because talents can be conditional on what is held: "+3%
  // damage with two-handed weapons" cannot be resolved without knowing the
  // weapon. Nothing about the weapons depends on the talents in turn, so the
  // order is settled rather than circular.
  const equipmentForWeapons = options.equipment ?? {};
  const weapons = weaponsFor(equipmentForWeapons, style, options.offHandDamageMultiplier);

  /*
   * Talents are settled before the fight and never change during it, so they
   * resolve once, here, into plain data. Nothing below this line knows that
   * talents exist.
   *
   * ILLEGAL TALENTS ARE STRIPPED FIRST, and this is the only place that
   * happens. The UI refuses an illegal click, so a build made by hand is always
   * legal -- but a profile loaded from JSON goes nowhere near the UI, and until
   * this line existed such a profile could put one point in Mortal Strike, a
   * 31-point capstone requiring Sweeping Strikes, and be handed the ability.
   * Every rule was known and none was applied.
   *
   * Stripping here rather than inside `talentBuild` is deliberate: that
   * function's job is to turn an allocation into effects, and a unit test that
   * puts five points in Flurry to check what Flurry does should not have to
   * spend twenty-five more to make the point legal.
   */
  const declaredTalents = options.talents ?? {};
  const classTalents = talentsForClass(characterClass);
  const legal = classTalents
    ? legalAllocation(classTalents, declaredTalents)
    : { allocation: declaredTalents, dropped: [] as readonly string[] };
  const build = talentBuild(characterClass, legal.allocation, {
    mainHand: weapons.mainHand,
    offHand: weapons.offHand,
    // A shield is not a weapon and does not appear in `weapons`, so it is
    // asked about separately. Bastion needs it and swings with nothing.
    hasShield: liveEquipment(equipmentForWeapons, style).shield !== undefined,
    // Armor from items ALONE, which is what Toughness scales. The character's
    // armor is this plus the class base, and a percentage of the total would
    // overstate the talent.
    itemArmor: armorFromItems(equipmentForWeapons, style),
  });

  /*
   * THE OFF HAND, AFTER TALENTS. Dual Wield Specialization changes what the
   * off hand does, and it has to be applied here rather than when the weapon
   * was built, because the weapons had to exist first for weapon-conditional
   * talents to be resolvable at all.
   *
   * Not circular: the talent cares only that a one-hander is held, which the
   * weapon already said. Nothing it changes feeds back into which talents
   * apply.
   *
   * Damage and rage generation are properties OF THE WEAPON -- the engine
   * reads both off the profile when a swing lands -- so they are multiplied
   * into it here. Hit is not: it belongs to the combat table, and goes to the
   * combatant as a per-slot bonus below.
   */
  if (weapons.offHand && (build.offHandDamageMultiplier !== 1 || build.offHandResourceMultiplier !== 1)) {
    const offHand = weapons.offHand;
    const generates = offHand.generates;
    weapons.offHand = {
      ...offHand,
      damageMultiplier: (offHand.damageMultiplier ?? 1) * build.offHandDamageMultiplier,
      ...(generates
        ? {
            generates: {
              ...generates,
              ...(generates.flat === undefined
                ? {}
                : { flat: generates.flat * build.offHandResourceMultiplier }),
              ...(generates.perDamage === undefined
                ? {}
                : { perDamage: generates.perDamage * build.offHandResourceMultiplier }),
            },
          }
        : {}),
    };
  }

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
  const rotation = rotationFor(characterClass, style, resolveStance(style, options.stance));

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
    // A talent conditional on the weapon held -- Two-Handed Weapon
    // Specialization -- multiplies everything including auto attacks, so it
    // cannot ride on `abilityModifiers`, which deliberately skips swings.
    damageMultiplier: build.damageMultiplier,
    survivesLethalDamage: options.survivesLethalDamage,
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
    /*
     * A Warrior is ALWAYS IN A STANCE, and opens in the one that was chosen.
     *
     * Starting stanceless was never right: Overpower, Rend, Execute, Thunder
     * Clap, Hamstring and Charge all require a stance, and a warrior in none
     * could cast none of them.
     *
     * It used to open in Battle Stance whatever it was holding, which is why
     * the rotation danced so much -- a dual-wielder had to swap to reach
     * Whirlwind and Recklessness, and a shield warrior to reach Revenge and
     * Shield Slam, paying ten rage above the floor every time. Opening in the
     * build's own stance removes most of those swaps, which is the cheapest
     * fix available for a problem that otherwise needs a rotation smart enough
     * to price a stance change.
     *
     * The player picks it; the style only supplies the default.
     */
    openingAuras: [
      ...(characterClass === 'warrior'
        ? [stanceAuraFor(resolveStance(style, options.stance))]
        : []),
      /*
       * Auras a TALENT grants, for passives that do something on a timer
       * rather than adding a number. Anger Management ticks a rage every
       * three seconds, which no stat modifier can express.
       *
       * An id with no definition is dropped rather than throwing: the talent
       * tables and the aura tables are separate files, and a typo should show
       * up as a talent that visibly does nothing, not as a character that
       * cannot be built.
       */
      ...[...build.grantedAuras]
        .map((id) => TALENT_AURAS[id])
        .filter((aura): aura is AuraDefinition => aura !== undefined),
    ],
    // Real weapons when something is equipped, placeholders otherwise. The
    // placeholders are invented and the items are not, so anything equipped
    // wins outright rather than being merged.
    weapons,
    // Off-hand-only hit, which no character-wide stat can express.
    hitBonusBySlot: build.offHandHitBonus > 0 ? { offHand: build.offHandHitBonus } : {},
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

/**
 * The aura for a stance id.
 *
 * Looked up by id rather than kept as a map so the two lists cannot drift:
 * `STANCES` describes them for a person choosing, `WARRIOR_STANCES` is what
 * the engine applies, and this is the single place they meet. A miss falls
 * back to Battle Stance, because a Warrior in no stance can cast almost
 * nothing.
 */
function stanceAuraFor(stance: StanceId): (typeof WARRIOR_STANCES)[number] {
  const auraId = `${stance}_stance`;
  return WARRIOR_STANCES.find((aura) => aura.id === auraId) ?? WARRIOR_STANCES[0];
}
