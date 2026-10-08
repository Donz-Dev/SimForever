import type {
  AuraDefinition,
  CastReaction,
  DamageSchool,
  PartialStats,
  Reaction,
  Stats,
  ResourceType as ResourceTypeName,
  WeaponProfile,
  WeaponSlot,
} from '../../engine';
import {
  AttackTableModifiers,
  Combatant,
  SchoolModifiers,
  addStats,
  bindModifiers,
  makeStats,
} from '../../engine';
import { abilitiesForBuild } from '../abilities/abilitiesForClass';
import { withQuiverAndAmmo } from '../character/hunterRanged';
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
  withStatConversions,
  resolveStance,
} from '../character';
import { MAX_CHARACTER_LEVEL } from '../character';
import { fixedMaximumFor, globalCooldownFor } from '../character';
import { rageFromDamageTaken, regenerationFor } from '../combat/resourceRules';
import { reactionsForClass } from '../reactions/reactionsForClass';
import { rotationFor } from '../rotations/rotationFor';
import type { Equipment } from '../items/Item';
import type { TalentAllocation } from '../talents/Talent';
import { WARRIOR_STANCES } from '../auras/warrior';
import { TALENT_AURAS } from '../auras/talentAuras';
// The Rogue's opening stealth window. See `openingAuras` below.
import { STEALTH } from '../auras/rogue';
import { EXTERNAL_HEALER } from '../encounters/externalHealer';
import { talentBuild, talentContextFor } from '../talents/talentBuild';
import { legalAllocation } from '../talents/talentRules';
import { talentsForClass } from '../talents/talentData';
import {
  attackTableModifiersForStyle,
  liveEquipment,
  schoolPowerForStyle,
  statsForStyle,
  heldWeaponForForm,
  weaponsForEquipment,
} from '../items/equipment';
import { reactionsForEquipment } from '../items/procs';
import {
  BASE_BLOCK_CHANCE_WITH_SHIELD,
  autoAttackModeForStyle,
  weaponsForStyle,
} from './weapons';
import { poisonReactions, type PoisonLoadout } from '../reactions/poisons';
import {
  warlockStoneEffect,
  type WarlockStoneId,
} from '../buffs/warlockStones';
import { COST_REFUND_ON_MISS } from '../combat/resourceRules';

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
   * The character can die, and is put back on their feet when they do.
   *
   * For an encounter where the target hits back. Deaths are counted rather
   * than prevented, which is the difference between this and the immunity it
   * replaced -- see `revivesOnDeath` on the engine's own options.
   */
  readonly revivesOnDeath?: boolean;
  /**
   * A healer is keeping this character up: a flat random amount every second,
   * from nobody in particular.
   *
   * An ENCOUNTER setting rather than a property of the character, which is why
   * it arrives as a flag instead of the caller handing over an aura. What the
   * healer does is fixed content in `encounters/externalHealer.ts`; all the
   * encounter chooses is whether there is one.
   */
  readonly externalHealing?: boolean;
  /**
   * Procs from outside the character: today, Windfury Totem.
   *
   * Kept apart from class, gear and talent reactions because it is the
   * ENCOUNTER's business who else is in the raid, and the character would have
   * none of these standing alone.
   */
  readonly extraReactions?: readonly Reaction[];
  /**
   * Cast procs the raid supplies, as `extraReactions` does for damage procs.
   *
   * Judgement of Wisdom is the first: a cast against the judged enemy can
   * restore mana, and until this existed the only route to `castReactions` was
   * the talent build -- so a raid buff could proc on damage and had no way to
   * proc on a cast.
   */
  readonly extraCastReactions?: readonly CastReaction[];
  /**
   * Which poison coats which weapon. A Rogue's, and ignored by everyone else.
   *
   * Absent means NO POISONS AT ALL rather than the default pair, so a test or
   * a caller that has not opted in is unaffected -- the encounter passes the
   * profile's loadout, which is where the default lives.
   */
  readonly poisons?: PoisonLoadout;
  /**
   * The temporary weapon enchant a Warlock carries. Ignored by everyone else.
   *
   * Absent means NONE, which is both the profile default and the safe reading
   * for a caller that has not opted in -- the same asymmetry `poisons` has, and
   * for the same reason: the default belongs on the profile, not in here.
   */
  readonly warlockStone?: WarlockStoneId;
  /**
   * Stats to size the HEALTH AND MANA POOLS from, when they are not the
   * character's own starting stats.
   *
   * ----------------------------------------------------------------------------
   * BECAUSE THE POOLS ARE A SNAPSHOT. They are resource maximums rather than
   * derived stats, so unlike attack power or crit they do not re-derive when a
   * buff moves stamina -- and Power Word: Fortitude's +70 stamina would have
   * granted NO HEALTH, which is the entire point of it.
   *
   * So the encounter passes a TRANSFORM -- a function from the character's own
   * stats to the stats they will have once the raid buffs are up -- and the
   * pools are sized from the result. A function rather than a delta because
   * Blessing of Kings is multiplicative: +10% of a total cannot be written
   * down without knowing the total. The buffs are still
   * applied as auras; nothing is counted twice, because the pools are computed
   * once here and never again.
   *
   * The underlying limitation is unchanged: a buff landing MID-fight still
   * does not resize the pool. Everything this covers is up before the first
   * swing, which is what makes the snapshot right.
   * ----------------------------------------------------------------------------
   */
  readonly poolStats?: (own: Readonly<Stats>) => Readonly<Stats>;
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
   * A HUNTER'S QUIVER AND AMMUNITION, neither of which is an equipment slot.
   *
   * The ruleset owner: "Hunters also passively have a quiver equipped -- which
   * is not a normal equipment slot", and ammunition adds a DPS to the bow. Both
   * are a property of the CLASS, so they are applied here rather than carried
   * by a gear set -- there is no slot to put them in and no item id to
   * reference.
   *
   * A MELEE HUNTER IS UNAFFECTED WITHOUT A CHECK: `weaponsForEquipment` gives
   * the ranged slot no weapon profile unless the style marks it `required`, so
   * there is nothing here for a dual-wielder. Its bow still contributes stats.
   */
  if (characterClass === 'hunter' && weapons.ranged) {
    weapons.ranged = withQuiverAndAmmo(weapons.ranged);
  }

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
  const build = talentBuild(
    characterClass,
    legal.allocation,
    talentContextFor(equipmentForWeapons, style, weapons, {
      characterClass,
      talents: declaredTalents,
      /*
       * Predatory Strikes is a percentage OF THE LEVEL, which nothing else
       * about a talent has ever needed. The same constant the Combatant is
       * built with below rather than anything off the profile: this simulator
       * runs at 60, and the talent must read the level the FIGHT uses.
       */
      level: MAX_CHARACTER_LEVEL,
    }),
  );

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
  /*
   * Five percent block for HOLDING A SHIELD, before anything adds to it.
   *
   * Granted here rather than in the class baseline because it belongs to the
   * shield: a warrior dual-wielding blocks nothing at all. Everything else --
   * talents, defense skill, Shield Block -- adds on top of this.
   */
  const shieldBlock = liveEquipment(equipment, style).shield
    ? { blockChance: BASE_BLOCK_CHANCE_WITH_SHIELD }
    : {};
  /*
   * THE STONE, AND IT STACKS WITH THE WEAPON'S ENCHANT BY THE OWNER'S RULING.
   *
   * Layered in as plain stats beside the gear's, which is what makes "stacks"
   * true without any code saying so: nothing here touches `equipment` or the
   * enchant fields, so a Firestone and an Enchant Weapon - Spell Power are two
   * independent contributions.
   *
   * GATED ON THE CLASS, the same way the poison reactions below are. A stone id
   * on a Mage is a profile that should not carry one rather than an effect to
   * apply -- and a profile CAN carry one, because the field is on every profile
   * and only the panel is class-gated.
   */
  const stone = warlockStoneEffect(characterClass === 'warlock' ? options.warlockStone : 'none');
  const startingStats = addStats(
    addStats(
      addStats(
        addStats(
          addStats(makeStats(baseStatsToEngineStats(base)), statsForStyle(equipment, style)),
          stone.stats,
        ),
        shieldBlock,
      ),
      options.bonusStats ?? {},
    ),
    build.stats,
  );

  // Layer 3, for the resource maximums only. The stat block handles the rest.
  const conversions = conversionsFor(characterClass, style);
  /*
   * From `poolStats` when the encounter supplied them -- the character's own
   * stats PLUS whatever raid buffs will be up before the first swing. See the
   * option for why the pools need that and nothing else does.
   */
  const derived = deriveFromPrimaries(
    options.poolStats ? options.poolStats(startingStats) : startingStats,
    conversions,
  );

  /*
   * Named once, because two things read it and they must not disagree: the
   * health pool, and the rage a point of damage taken is worth under Forever's
   * `D x 10 / H`.
   */
  const maximumHealth = baseHitPointsFor(race, characterClass, style) + derived.hitPoints;

  const resources = resourceSpecsFor(
    characterClass,
    baseManaFor(race, characterClass) + derived.mana,
    // Explicit overrides win over talents, so a caller testing a specific cap
    // is not quietly overruled by a build.
    { ...talentResourceMaximums(build.resourceMaximums), ...options.resourceMaximums },
  );

  /*
   * PER-SCHOOL MODIFIERS FROM TWO SOURCES, and gear is the new one.
   *
   * ------------------------------------------------------------------------
   * Talents built this set until now -- Moonfury, Fire Power, Elemental Fury.
   * Seventeen item lines add the fourth field to it: "Increases damage done by
   * Shadow spells and effects by up to 39", which is spell power that only one
   * school may read. `STAT_NAMES` is a closed flat set, so it cannot be a stat
   * and joins the crit and damage already keyed by school.
   *
   * A NEW SET RATHER THAN ADDING TO `build.schoolModifiers`, because a
   * `TalentBuild` is a VALUE and a caller may hold one across several
   * characters. Mutating it would work exactly once and then hand the second
   * character the first one's gear on top of its own -- the same shape of bug
   * as the shared Windfury closure that stopped proccing after one iteration
   * of a batch.
   * ------------------------------------------------------------------------
   */
  const schoolModifiers = new SchoolModifiers();
  schoolModifiers.merge(build.schoolModifiers);
  for (const [school, spellPower] of Object.entries(schoolPowerForStyle(equipment, style))) {
    schoolModifiers.add(school as DamageSchool, { spellPower });
  }
  /*
   * AND THE STONE'S, THROUGH THE SAME DOOR. "The damage done by your Fire
   * spells by up to 21" is the identical wording seventeen item lines carry, so
   * it takes the identical route -- `SchoolModifiers.spellPower`, which
   * `spellPowerFor` adds to the school-blind pool at the point of use. See
   * `WARLOCK_STONE_SCHOOL_POWER`.
   */
  for (const [school, spellPower] of Object.entries(stone.schoolPower)) {
    schoolModifiers.add(school as DamageSchool, { spellPower });
  }

  /*
   * AND THE SAME TWO SOURCES KEYED BY ATTACK TABLE, where gear is again the
   * second one.
   *
   * ------------------------------------------------------------------------
   * The ranged weapon's "+2% Crit Chance" enchant, which the owner ruled
   * reaches RANGED ATTACKS ONLY -- not melee, and not the pet. A stat would
   * reach all three; this is the scope that draws the line.
   *
   * A NEW SET RATHER THAN ADDING TO `build.attackTableModifiers`, for exactly
   * the reason given for the schools above: a `TalentBuild` is a VALUE, and a
   * batch that reused one would hand the second character the first one's gear
   * on top of its own.
   * ------------------------------------------------------------------------
   */
  const attackTableModifiers = new AttackTableModifiers();
  attackTableModifiers.merge(build.attackTableModifiers);
  attackTableModifiers.merge(attackTableModifiersForStyle(equipment, style));

  const abilities = abilitiesForBuild(characterClass, style, build);
  const rotation = rotationFor(
    characterClass,
    style,
    resolveStance(style, options.stance),
    legal.allocation,
  );

  const player = new Combatant({
    id: options.id ?? 'player_1',
    name: options.name ?? 'Player',
    kind: 'player',
    faction: 'friendly',
    level: MAX_CHARACTER_LEVEL,
    maxHealth: maximumHealth,
    stats: startingStats,
    /*
     * The class table, plus any talent that makes one stat out of another.
     *
     * COMPOSED RATHER THAN COMPUTED, because the stat block re-runs this
     * every time a modifier changes. Careful Aim's attack power therefore
     * follows a buffed intellect, exactly as the class table's attack power
     * already follows a buffed strength -- a flat number taken here would be
     * stuck at the unbuffed figure for the whole fight.
     */
    statDerivation: withStatConversions(
      statDerivationFor(characterClass, style),
      build.statConversions,
    ),
    resources,
    regeneration: regenerationFor(resources.map((spec) => spec.type)),
    /*
     * Only classes with a rage pool build rage from being hit; for everyone
     * else `grantResource` finds no pool and ignores it.
     *
     * IT READS MAXIMUM HEALTH NOW, because Forever's rule is `D x 10 / H`. The
     * same number the pool itself is sized from, taken once here -- so a raid
     * that buffed stamina raises the health AND lowers the rage each point of
     * damage is worth, consistently, rather than one of the two.
     */
    resourceOnDamageTaken: resources.some((spec) => spec.type === 'rage')
      ? rageFromDamageTaken(maximumHealth)
      : undefined,
    abilities,
    // Per-ability crit and damage scaling, from talents today and from gear or
    // set bonuses later. Held on the combatant so `dealDamage` can consult it
    // without every ability's `onCast` having to remember to.
    abilityModifiers: build.abilityModifiers,
    /*
     * The same three modifiers keyed by SCHOOL -- "your Fire spells" rather
     * than "your Fireball" -- plus a fourth field the other two scopes do not
     * have: spell power for one school, which is where most of a Shadow
     * Priest's and a Shockadin's gear lands. Talents and gear, combined above.
     */
    schoolModifiers,
    // And the same three scoped to MELEE or RANGED -- "all your melee
    // abilities", which is neither one ability nor one school.
    attackTableModifiers,
    // The same again, counted only while the TARGET bleeds. Rend and Tear is
    // the only caller, and the one modifier here that is about the victim.
    bleedingTargetModifiers: build.bleedingTargetModifiers,
    // Genesis: every tick and nothing else. It is neither a school, a table
    // nor an ability, and `DamageRequest.periodic` is what separates it.
    periodicDamageMultiplier: build.periodicDamageMultiplier,
    // A talent conditional on the weapon held -- Two-Handed Weapon
    // Specialization -- multiplies everything including auto attacks, so it
    // cannot ride on `abilityModifiers`, which deliberately skips swings.
    damageMultiplier: build.damageMultiplier,
    revivesOnDeath: options.revivesOnDeath,
    // Reactive procs, from two sources: the class (a Warrior's Overpower opening
    // because the target dodged) and the gear (Vis'kag, Crusader, Hand of
    // Justice). Gear procs are built per character rather than shared, because
    // Hand of Justice carries its own internal cooldown.
    reactions: [
      // The LEGAL allocation, not the declared one: an unearned Elemental
      // Weapons must not scale Windfury Weapon any more than an unearned
      // capstone grants its ability.
      ...reactionsForClass(characterClass, style, legal.allocation),
      ...reactionsForEquipment(liveEquipment(equipment, style)),
      // Talent procs: Deep Wounds, Flurry and the rest. Built per character
      // from the rank taken, so they carry that character's numbers.
      ...build.reactions,
      // Whoever else is in the raid. Windfury Totem is the only one today.
      /*
       * POISONS, one reaction per hand, built HERE so each character in a
       * batch gets its own -- the same per-character requirement Windfury has,
       * where a shared closure silently stopped it proccing after the first
       * iteration.
       *
       * Only a Rogue is given them, because only a Rogue has them: handing a
       * Warrior a poison reaction would be harmless (it never applies one) but
       * would put a dead entry in every other character's reaction list.
       */
      ...(options.poisons && characterClass === 'rogue'
        ? poisonReactions(options.poisons, legal.allocation)
        : []),
      ...(options.extraReactions ?? []),
    ],
    /*
     * Procs that fire when an ability is USED rather than when one lands.
     * A separate list because a cast event is not an attack event -- see
     * `AbilityCastEvent`. Four Rogue talents are why it exists.
     */
    castReactions: [...build.castReactions, ...(options.extraCastReactions ?? [])],
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
       * A ROGUE OPENS FROM STEALTH, which is the owner's design for the list
       * and the one thing about stealth this project models: it makes Ambush
       * castable and does nothing else.
       *
       * ON THE CLASS AND NOT ON A PROFILE, because opening stealthed is a fact
       * about a Rogue rather than about a build. Only a list with an Ambush
       * entry can spend it -- the Venom and Combat lists have none, so they are
       * unchanged to the decimal, and the containment check says so. A talent
       * cannot gate this: every Rogue has Stealth and Vanish from a trainer.
       *
       * IT IS NOT AN "OPENER ONLY" MECHANISM. Vanish applies the same aura
       * mid-fight, so the opening window and a Vanish window are one code path
       * and cannot drift. See `STEALTH` on why both carry Vanish's ten seconds.
       */
      ...(characterClass === 'rogue' ? [STEALTH] : []),
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
      /*
       * CAST MODIFIERS A TALENT GRANTS, one permanent aura per talent.
       *
       * This is how a percentage mana reduction finally reaches a cast:
       * `resolveCast` reads cast modifiers off the caster's auras, so a
       * talent that wants one has to arrive as an aura. Eleven talents across
       * seven classes were `unmodelled` for exactly this and said so.
       */
      ...build.castModifierAuras,
      /*
       * The assumed healer, when the encounter has one. Nothing is hitting a
       * character in a fight without one, so a healer there would tick pure
       * overhealing into the log for the whole fight.
       */
      ...(options.externalHealing ? [EXTERNAL_HEALER] : []),
    ],
    // Real weapons when something is equipped, placeholders otherwise. The
    // placeholders are invented and the items are not, so anything equipped
    // wins outright rather than being merged.
    weapons,
    // Off-hand-only hit, which no character-wide stat can express.
    hitBonusBySlot: build.offHandHitBonus > 0 ? { offHand: build.offHandHitBonus } : {},
    autoAttack: autoAttackModeForStyle(style),
    // 1.5 seconds for everyone but a Rogue and a Cat-Form Druid, who get 1.0.
    baseGcdMs: globalCooldownFor(characterClass, style),
    // 80% of a rage or energy cost back when the attack does not connect.
    costRefundOnMiss: COST_REFUND_ON_MISS,
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
/**
 * The weapons a character ends up with: equipped where it has something, and
 * placeholders where it does not.
 *
 * Exported so the Talent panel can describe the same character the fight
 * builds. A panel that resolved weapons differently would report talents as
 * inert that the fight applies, which is exactly what it used to do.
 */
export function weaponsFor(
  equipment: Equipment,
  style: CombatStyleId,
  offHandDamageMultiplier?: number,
): Partial<Record<WeaponSlot, WeaponProfile>> {
  /*
   * A DRUID'S PAW IS BUILT FROM WHAT IS HELD, so the equipment has to reach
   * the style's own weapons rather than only being merged over them. For every
   * other style `heldWeaponForForm` returns nothing and this is inert.
   */
  const placeholders = weaponsForStyle(style, {
    offHandDamageMultiplier,
    heldWeapon: heldWeaponForForm(equipment, style),
  });
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
