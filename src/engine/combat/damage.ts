import type { Combatant, ResourceGeneration, WeaponSlot } from '../actors/Combatant';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { DamageSchool } from './DamageSchool';
import { isPhysical } from './DamageSchool';
import type {
  AttackChances,
  AttackOutcome,
  AttackResolution,
  AttackTableKind,
} from './attackTable';
import { ROLL_MAX, resolveAttackTable, toRollUnits } from './attackTable';
import type { AbilityModifier, SchoolModifier } from './abilityModifiers';
import { combineAbilityModifiers } from './abilityModifiers';
import { armorConstantForLevel, versatilityMultiplierFrom } from './ratings';
import { applyParryHaste } from './parryHaste';
import type { AttackEvent } from './reactions';
import { runReactions } from './reactions';
import type { ResourceSource } from '../resources';

/** Damage varies this much either side of a weapon's base, unless overridden. */
export const DEFAULT_DAMAGE_VARIANCE = 0.15;

/**
 * An ability's scaling with the weapon actually equipped.
 *
 * A great many melee abilities are "a swing, plus something". Rather than every
 * one of them reaching for the weapon and reimplementing the roll, they declare
 * the slot and the pipeline supplies
 *
 *     weapon base damage (rolled) + weapon's power coefficient * attack power
 *
 * The coefficient lives on the weapon because it is derived from the weapon's
 * speed, and how it is derived is a ruleset number that belongs in `game`.
 *
 * The hand's damage multiplier — the dual-wield off-hand penalty — is applied
 * ONCE to the finished total, after the ability's own flat damage has been
 * added. Applying it to the weapon portion alone would leave an off-hand
 * Mortal Strike dealing full value for its 160, which is not how the ruleset
 * reads.
 */
export interface WeaponScaling {
  readonly slot: WeaponSlot;
  /**
   * Fraction of the weapon's damage this ability deals. Defaults to 1.
   *
   * Forever's Spearing Strike is 0.4.
   */
  readonly fraction?: number;
  /**
   * Attack power added to THIS HIT ONLY, on top of the character's own.
   *
   * ----------------------------------------------------------------------------
   * WINDFURY WEAPON IS WHY, and it is a genuinely different shape from every
   * other attack power source here. "Each hit has a 20% chance of granting you
   * 2 extra attacks with 333 extra melee attack power" -- the 333 belongs to
   * the two extra attacks and to nothing else.
   *
   * THE ALTERNATIVE WAS A 1.5-SECOND BUFF AURA AND IT WAS A DIFFERENT EFFECT.
   * That is how Windfury TOTEM works, by the ruleset owner's own statement, and
   * it was borrowed for the imbue: apply +246 attack power for 1.5 seconds,
   * then swing. The owner has since separated them -- the imbue "doesn't grant
   * a temporary attack power buff but instead adds the rank's attack power into
   * the hits themselves" -- and the two are not interchangeable. A window pays
   * every attack that lands inside it, including a Stormstrike that happened to
   * be cast in the same moment; this pays exactly the hits it belongs to.
   *
   * ADDED TO THE POOL AND SCALED BY `powerCoefficient` LIKE THE REST, so it
   * goes through `speed / 14` exactly as the character's own attack power does.
   * Anything else would make the bonus worth a different amount on a slow
   * weapon than the attack power beside it, which is not what "extra attack
   * power" says.
   * ----------------------------------------------------------------------------
   */
  readonly bonusAttackPower?: number;
  /**
   * Whether this ability's ATTACK POWER term uses a normalised weapon speed
   * instead of the weapon's own.
   *
   * ----------------------------------------------------------------------------
   * IT REPLACES THE SPEED, NOT THE WEAPON DAMAGE. A normalised ability still
   * rolls the weapon's real damage; what changes is that the attack power it
   * adds is `normalisedSpeed / 14` rather than `actualSpeed / 14`. That is the
   * whole point of normalisation -- it stops a slow weapon being worth more on
   * an instant strike than a fast one, WITHOUT flattening the weapon itself.
   *
   * THE SPEEDS ARE RULESET CONTENT AND ARE NOT HERE. The weapon arrives
   * carrying `normalizedPowerCoefficient`, computed by `game` from the ruleset
   * table, so the engine applies the rule and knows none of the numbers --
   * the same split `attackChances` and the stat derivation already use.
   *
   * SEVENTEEN ABILITIES SET IT AND FIVE DELIBERATELY DO NOT. Slam, Heroic
   * Strike, Cleave, Raptor Strike and Ghostly Strike keep the weapon's own
   * speed, by the ruleset owner's list. It is opt-in for that reason: a new
   * ability that forgets is un-normalised, which is the commoner case and the
   * one the owner listed as the exception.
   * ----------------------------------------------------------------------------
   */
  readonly normalized?: boolean;
}

/**
 * A request to deal damage, as an ability describes it.
 *
 * The ability says what it is trying to do; the pipeline below decides what
 * actually lands. Abilities never compute final numbers themselves, which is
 * what keeps crit, armor and buff handling from being copy-pasted per spell.
 */
export interface DamageRequest {
  readonly source: Combatant;
  readonly target: Combatant;
  readonly abilityId?: string;
  readonly abilityName: string;
  readonly school: DamageSchool;
  /** Flat damage before any scaling. */
  readonly baseAmount: number;
  /**
   * Multiplied by the source's attack power (physical) or spell power
   * (magical) and added to `baseAmount`.
   */
  readonly powerCoefficient?: number;
  /**
   * Scaling with the equipped weapon, for abilities that deal weapon damage.
   *
   * Added on top of `baseAmount`, so Mortal Strike is `baseAmount: 160` plus
   * full weapon scaling, exactly as the ruleset states it.
   */
  readonly weaponScaling?: WeaponScaling;
  /**
   * Which combat table resolves this attack.
   *
   * Omitted means the damage lands unconditionally with no roll: a
   * damage-over-time tick, whose landing was already decided when the effect
   * was applied.
   */
  readonly attackTable?: AttackTableKind;
  /** True for damage-over-time ticks. Recorded in telemetry. */
  readonly periodic?: boolean;
  /**
   * This damage is not raised by the ATTACKER'S own damage bonuses.
   *
   * ----------------------------------------------------------------------------
   * TOUCH OF THE GRAVE IS THE ONLY CALLER, and the ruling is the owner's own
   * sentence: it "only scales off your Hit Points - not attack power or spell
   * power or shadow damage talents - BUT it does scale if the target is
   * vulnerable to shadow/magic damage from a debuff like Curse of the Elements
   * or Improved Shadow Bolt."
   *
   * ATTACK POWER AND SPELL POWER NEED NO FLAG and do not get one: they arrive
   * only through `powerCoefficient` and `weaponScaling`, so an ability that
   * declares neither cannot read either. That half of the ruling is structural.
   *
   * WHAT THIS FLAG IS FOR IS THE THIRD CLAUSE. "Shadow damage talents" reach
   * damage along two routes that have nothing to do with a coefficient: the
   * build-time `SchoolModifiers` a talent writes -- Shadow Mastery, and Forever's
   * Shadow Weaving, which is on the CASTER here where Classic puts it on the
   * target -- and an aura's `damageDoneBySchool`, which is Demonic Sacrifice.
   * Both Undead Warlock presets carry the first and one carries the second, so a
   * drain fixed by the Undead's health would otherwise have been scaled by a
   * tenth and more of somebody else's Shadow talent.
   *
   * WHAT IT DELIBERATELY DOES NOT TOUCH, because the owner's exception names it:
   * the TARGET's side. `damageTakenBySchool`, `periodicDamageTakenBySchool` and
   * the target's per-ability modifiers all still apply, which is what makes
   * Curse of the Elements raise it exactly as asked.
   *
   * NOR DOES IT TOUCH HIT OR CRIT. A school-scoped `hitBonus` -- Shadow Focus --
   * is about whether the drain LANDS on the spell table, not how big it is, and
   * the owner's sentence is about scaling. Crit does not arise: Touch of the
   * Grave declares no `critFrom` and no table whose crit it borrows, because it
   * cannot crit.
   * ----------------------------------------------------------------------------
   */
  readonly ignoresAttackerDamageScaling?: boolean;
  /**
   * This attack CANNOT critically strike, whatever table resolves it.
   *
   * ----------------------------------------------------------------------------
   * OMITTING `critFrom` IS NOT ENOUGH, AND THAT IS THE WHOLE REASON THIS EXISTS.
   * `critFrom` governs an attack with NO table -- a periodic tick, which rolls
   * for a crit and nothing else. An attack that DOES declare a table takes its
   * crit from that table: the spell table's crit slice is the caster's
   * `spellCritChance`, so a request declaring `attackTable: 'spell'` and no
   * `critFrom` crits at the caster's full spell crit.
   *
   * Touch of the Grave is the first thing in the ruleset that has to do both at
   * once: the owner's statement is that it "uses the Spell Cast Combat Table"
   * AND "cannot crit". It was built by omitting `critFrom`, which reads exactly
   * like the right thing and is about the other case -- a test giving the caster
   * a hundred points of crit found 200 crits in 200 drains.
   *
   * ZEROED AFTER EVERY MODIFIER, not before, which is the ordering `NO_CHANCES`
   * already taught: `applyAbilityModifiers` ADDS a talent's `abilityCrit` to
   * whatever the provider returned, so a table handed zero crit still crits if
   * anything adds to it. Conflagrate read 0.7071 against a declared 0.4286 for
   * exactly that reason -- 1.5x of a coefficient, not a coefficient error.
   *
   * THE SLICE GOES TO THE REMAINDER, which is `hit`. A table's walk falls past
   * every slice it is given and what is left over is a hit, so removing crit
   * turns those rolls into ordinary landed hits rather than into misses.
   * ----------------------------------------------------------------------------
   */
  readonly cannotCrit?: boolean;
  /**
   * Roll for a critical strike even though there is no attack table.
   *
   * RULESET: in Forever, every damage-over-time effect can crit. A tick does
   * not re-roll the combat table — whether the effect landed was settled when
   * it was applied — but it does roll crit, at the crit chance of the KIND OF
   * EVENT THAT APPLIED IT. A Rend tick uses melee crit because Rend is applied
   * by a melee attack; a warlock's Corruption would use spell crit.
   *
   * So this names the table to take the crit chance and crit multiplier from,
   * without resolving against it. Omitted means a tick cannot crit, which is
   * the WoW Classic behaviour and NOT the Forever one -- every DoT in this
   * ruleset should set it.
   */
  readonly critFrom?: AttackTableKind;
  /**
   * Take the CRIT CHANCE AND MULTIPLIER from a different table than the one this
   * attack resolves on.
   *
   * ----------------------------------------------------------------------------
   * THUNDER CLAP IS WHY, and the ruleset owner's wording is the specification:
   * "Thunder Clap uses the spell crit table, so global sources of critical strike
   * chance apply, but not crit from agility, or the Cruelty talent or
   * Weaponmaster talent."
   *
   * EVERY CLAUSE OF THAT IS ABOUT CRIT, which is why this exists rather than the
   * ability declaring `attackTable: 'spell'`. Moving the whole table works and
   * brings something nobody asked for: spell MISS is a flat figure where
   * `missFromSkill` gave Thunder Clap almost none, and it measured at 0.9%
   * avoided becoming 9.4% -- a melee ability missing ten times as often, off a
   * sentence about critical strikes.
   *
   * THE CRIT MULTIPLIER COMES ACROSS TOO, deliberately: a crit TABLE is a chance
   * and a multiplier together, so the spell 1.5x applies rather than the ranged
   * 2x. That is the one part of this that is an interpretation, and it is what
   * makes "uses the spell crit table" mean more than "uses the spell crit
   * chance".
   *
   * THE SIBLING OF `critFrom`, NOT THE SAME FIELD. `critFrom` is for an attack
   * with NO table of its own -- a periodic tick, whose landing was settled when
   * the aura went on, borrowing a whole table to roll one crit against. This is
   * for an attack that HAS a table and takes one slice of another.
   * ----------------------------------------------------------------------------
   */
  readonly critTable?: AttackTableKind;
  /**
   * Which weapon produced this, when it matters.
   *
   * A dual-wielder's hands are not equivalent: the off-hand has its own
   * miss chance and weapon skill, so the combat table needs to know which
   * one swung.
   */
  readonly weaponSlot?: WeaponSlot;
  /**
   * FURTHER schools whose caster-side modifiers also apply to this damage.
   *
   * ----------------------------------------------------------------------------
   * "THIS SPELL COUNTS AS BOTH FROST AND FIRE DAMAGE", which is Frostfire
   * Bolt's own spellbook entry and the only wording of its kind in the ruleset.
   * `school` stays single because every other step needs ONE answer -- which
   * resistance, which vulnerability, what the log says -- and this adds the one
   * question that genuinely has two: **which of the caster's own school talents
   * select it.**
   *
   * TEN MAGE TALENTS NAME IT, and the dual membership only ever mattered to
   * three. Ignite, Improved Scorch, Master of Elements and Combustion select by
   * ABILITY ID and already listed it; Critical Mass, Fire Power and Elemental
   * Precision are Fire-scoped and reached it because it is dealt as Fire. The
   * three that did not were the Frost-scoped ones -- **Piercing Ice, Ice Shards
   * and Frost Channeling** -- and the ruleset owner spotted the first by eye.
   * Frost Channeling is a cast modifier and was fixed by adding an id to a
   * list; the other two are school-scoped and are why this field exists.
   *
   * THE CASTER'S SIDE ONLY, AND SPELL POWER IS DELIBERATELY NOT INCLUDED.
   * `spellPowerFor` still reads `school` alone, because a school-scoped spell
   * power is a POOL -- "damage done by Frost spells by up to 39" -- and adding
   * two pools to one cast is a bigger number than any talent asked for. The
   * four fields that do apply are the ones the three talents use: crit chance,
   * crit damage, the damage multiplier and hit. The target's own
   * vulnerabilities are untouched for the same reason, and resistance has no
   * effect on an enemy target by ruling, so the "lower of the two resists"
   * clause has nothing to do either way.
   * ----------------------------------------------------------------------------
   */
  readonly countsAsSchools?: readonly DamageSchool[];
  /**
   * Whether armor reduces this damage.
   *
   * Defaults to true for physical damage and false otherwise. Set it
   * explicitly for physical damage that ignores armor, such as a bleed:
   * armor applies to hit-based physical damage, and that is decided per
   * event rather than inferred from the school alone.
   */
  readonly appliesArmor?: boolean;
}

/** The fully resolved outcome of a damage request. */
export interface DamageResolution {
  /** What the combat table produced. `hit` when no table was consulted. */
  readonly outcome: AttackOutcome;
  /** True when the attack was missed, dodged or parried. */
  readonly avoided: boolean;
  /** Damage before mitigation and absorbs, after power scaling and crit. */
  readonly raw: number;
  /** Removed by armor or resistance, AND by a block. */
  readonly mitigated: number;
  /**
   * The block's share of `mitigated`, on its own.
   *
   * Separated because armor and a block are the same step in the pipeline and
   * different things to Forever's rage rule: a blocked hit generates rage on
   * the UNBLOCKED amount, while armor does not reduce the rage at all. Nothing
   * can tell them apart from `mitigated`, which is their sum.
   */
  readonly blocked: number;
  /** Removed by shields. */
  readonly absorbed: number;
  /** What reached the target's health, including the overkill portion. */
  readonly amount: number;
  readonly critical: boolean;
}

/*
 * The pipeline, in order:
 *
 *   base + power scaling  ->  critical strike  ->  attacker modifiers
 *   ->  target modifiers  ->  armor / resistance  ->  absorbs  ->  final
 *
 * Each step below is a pure function of its inputs. They are exported
 * individually so a formula change can be unit-tested in isolation, without
 * standing up a whole simulation.
 */

/**
 * The weapon's contribution to an ability that scales with it, before the
 * hand's damage multiplier.
 *
 * `roll` is the already-drawn damage variance multiplier, kept as a parameter
 * so this stays a pure function and can be checked against a hand-computed
 * number without an RNG.
 *
 * A slot holding no weapon contributes nothing rather than throwing: a style
 * whose ranged slot is empty can still cast an ability that would have used
 * it, and the missing damage is visible in the results.
 */
export function weaponDamageFor(request: DamageRequest, roll: number): number {
  const scaling = request.weaponScaling;
  if (!scaling) return 0;

  const weapon = request.source.weapons[scaling.slot];
  if (!weapon) return 0;

  const base = weapon.baseDamage * roll;
  /*
   * THE WEAPON'S OWN SPEED, OR THE NORMALISED ONE, and only for the ATTACK
   * POWER half -- `base` above is the weapon's real damage either way.
   *
   * Falling back to the un-normalised coefficient rather than to zero matters:
   * a weapon built without a normalised figure (a paw, a placeholder) would
   * otherwise contribute NO attack power at all to a normalised ability, which
   * reads as a very bad weapon rather than as a missing field.
   */
  const coefficient = scaling.normalized
    ? (weapon.normalizedPowerCoefficient ?? weapon.powerCoefficient ?? 0)
    : (weapon.powerCoefficient ?? 0);
  const power = coefficient * attackPowerFor(request);

  return (base + power) * (scaling.fraction ?? 1);
}

/**
 * Which attack power pool a request draws on: RANGED for a ranged weapon,
 * melee for everything else.
 *
 * ----------------------------------------------------------------------------
 * RULESET: ranged weapon damage scales with RANGED attack power, and the two
 * pools are genuinely separate -- a Hunter gets 2 ranged attack power per
 * agility, 1 melee per agility, and 1 MELEE per strength with no ranged
 * bonus at all. Stated by the Forever Hunter wiki the ruleset owner named,
 * which gives Auto Shot as
 *
 *     AmmoDPS x WeaponSpeed + (RAP / 14 x WeaponSpeed + Scope + AvgWeaponDmg)
 *
 * and `powerCoefficient` is `speed / 14`, so this reproduces that term
 * exactly.
 *
 * This read `attackPower` for EVERY slot, so a bow swung with melee attack
 * power. Nothing looked wrong: the Hunters were in a Warrior's gear at the
 * time, so 370 strength was quietly powering a bow that should get nothing
 * from strength, and `rangedAttackPower` -- agility's conversion, Aspect of
 * the Hawk, the Trueshot Aura raid buff, the +48 on the Hunter's own trinket
 * -- reached only the two abilities that read the stat by hand.
 *
 * IT KEYS ON `weaponScaling.slot` AND NOT ON `weaponSlot`, which is a
 * distinction with teeth. `weaponSlot` marks which weapon's PROCS an attack
 * can trigger, and Thunder Clap and Intercept both declare `'ranged'` there
 * precisely so that `isWeaponUse` excludes them -- they are melee Warrior
 * abilities that resolve on the ranged TABLE because it has no dodge or
 * parry. Keying on that would hand a Warrior ranged attack power the moment
 * either grew a coefficient. `weaponScaling.slot` names the weapon actually
 * contributing damage, which is the question being asked.
 * ----------------------------------------------------------------------------
 */
export function attackPowerFor(request: DamageRequest): number {
  const stats = request.source.stats.effective;
  const own =
    request.weaponScaling?.slot === 'ranged' ? stats.rangedAttackPower : stats.attackPower;
  // Attack power this HIT carries, which no stat block holds. See
  // `WeaponScaling.bonusAttackPower`.
  return own + (request.weaponScaling?.bonusAttackPower ?? 0);
}

/**
 * The spell power that reaches ONE school: the character's school-blind pool,
 * plus whatever is scoped to that school alone.
 *
 * ----------------------------------------------------------------------------
 * "Increases damage done by SHADOW spells and effects by up to 39" is most of
 * a Shadow Priest's spell power and every word of it is school-scoped, so a
 * single number on the stat block cannot hold it -- adding it there would make
 * the same character's Holy and Arcane spells hit harder. `STAT_NAMES` is a
 * closed flat set and cannot key by school, so the scoped half lives on
 * `SchoolModifiers` beside the crit and damage already keyed the same way.
 *
 * A FUNCTION RATHER THAN A FIELD, for the reason every derived stat here is
 * one: it re-reads `stats.effective`, so a buff that moves spell power moves
 * this too. And it is exported because `scaleByPower` is not the only caller
 * -- the Paladin's seal formula reads spell power by hand, and the two must
 * not disagree about what a Holy point is worth. That is the `isWeaponUse`
 * lesson: a rule living privately in one file while another re-derives it.
 * ----------------------------------------------------------------------------
 */
/**
 * The caster's school modifier for a request, folding in any further school it
 * counts as.
 *
 * ------------------------------------------------------------------------------
 * ONE FUNCTION AND TWO CALLERS, because the crit half is read in `rollTable`
 * and the damage half in `resolveDamage` -- the rule this file already states
 * for `abilityModifierFor`: every reader comes through the same funnel, or an
 * effect applies in one half of the pipeline and not the other.
 *
 * IT DOES NOT USE `combineAbilityModifiers`, AND THAT IS THE WHOLE POINT.
 * Combining two schools by the ordinary rule -- chances add, damage multiplies
 * -- DOUBLE-PAYS ANY TALENT THAT NAMES BOTH OF THEM, and the first thing this
 * field reached was exactly one of those: Elemental Precision is "+5% chance
 * to hit with Frost AND Fire spells", so a Frostfire Bolt collected +10% and
 * its miss rate measured 5.26% against an expected 10%. That is one source
 * paid twice, which is the same failure `pick` carries a guard against for the
 * `ALL_ABILITIES` key.
 *
 * SO THE TWO KINDS OF FIELD ARE COMBINED DIFFERENTLY, and the split follows
 * what the effects mean rather than what is convenient:
 *
 *   damage multiplier   MULTIPLIED. Fire Power's +8% and Piercing Ice's +6%
 *                       are different talents and a spell that is both schools
 *                       takes both -- x1.1448, which is the behaviour that
 *                       makes a dual-school spell worth building around.
 *   crit, crit damage   THE LARGER, not the sum. An additive bonus that names
 *   and hit             both schools is ONE source, and this collection cannot
 *                       tell it from two sources naming one school each: a
 *                       `SchoolModifiers` entry is already summed per school
 *                       by the time it gets here.
 *
 * THE LIMITATION IS STATED AND IT UNDERSTATES. Two SEPARATE single-school
 * talents granting additive crit -- a Fire crit talent and a Frost crit talent
 * on one tree -- would be worth only the larger here. **No class has such a
 * pair**: four talents in the project name more than one school (Elemental
 * Precision, the Druid's Moonfury and Vengeance, the Shaman's Elemental Fury)
 * and a test pins that, so the day a pair appears it fails rather than
 * quietly paying once. Understating is the direction to be wrong in while the
 * case does not exist.
 *
 * `spellPower` IS STRIPPED, not merely unused, because it is a POOL rather
 * than a rate -- "damage done by Frost spells by up to 39". `spellPowerFor`
 * reads the primary school on purpose, and a combined object carrying either
 * the sum or the max of two pools would be a loaded gun for the day somebody
 * routes it through here instead.
 * ------------------------------------------------------------------------------
 */
function casterSchoolModifier(request: DamageRequest): SchoolModifier {
  const primary = request.source.schoolModifiers.for(request.school);
  if (!request.countsAsSchools?.length) return primary;

  let critBonus = primary.critBonus ?? 0;
  let critMultiplierBonus = primary.critMultiplierBonus ?? 0;
  let hitBonus = primary.hitBonus ?? 0;
  let damageMultiplier = primary.damageMultiplier ?? 1;

  for (const extra of request.countsAsSchools) {
    if (extra === request.school) continue;
    const other = request.source.schoolModifiers.for(extra);
    critBonus = Math.max(critBonus, other.critBonus ?? 0);
    critMultiplierBonus = Math.max(critMultiplierBonus, other.critMultiplierBonus ?? 0);
    hitBonus = Math.max(hitBonus, other.hitBonus ?? 0);
    damageMultiplier *= other.damageMultiplier ?? 1;
  }

  return { critBonus, critMultiplierBonus, hitBonus, damageMultiplier };
}

export function spellPowerFor(source: Combatant, school: DamageSchool): number {
  return source.stats.effective.spellPower + (source.schoolModifiers.for(school).spellPower ?? 0);
}

/**
 * The same pool, PLUS whatever a debuff on the target adds to it.
 *
 * ----------------------------------------------------------------------------
 * ONE FUNCTION FOR BOTH SIDES, because the two are one number by the time an
 * ability scales by its coefficient and nothing should have to remember to add
 * the second. "Increases damage done by your Holy spells by up to 161" is the
 * attacker's gear; "increasing Holy damage taken by up to 161" is Judgement of
 * the Crusader on the target. Same school, same arithmetic, different owner.
 *
 * WHY IT IS EXPORTED. `scaleByPower` reaches it for every request with a
 * coefficient, but a Paladin's seals compute their own damage in `game` and pass
 * it as a `baseAmount` with `powerCoefficient: 0` -- so a seal has to ask for
 * this explicitly or the debuff its own Judgement applied would not reach the
 * half of the class that carries it.
 * ----------------------------------------------------------------------------
 */
export function spellPowerAgainst(
  source: Combatant,
  target: Combatant | undefined,
  school: DamageSchool,
): number {
  return spellPowerFor(source, school) + (target?.spellPowerTakenFor(school) ?? 0);
}

/**
 * The multiplier for the hand this ability swings with, or 1 when it does not
 * use a weapon at all.
 *
 * Read from the weapon rather than the request so that the off-hand penalty
 * cannot be forgotten at a call site.
 */
export function handMultiplier(request: DamageRequest): number {
  const scaling = request.weaponScaling;
  if (!scaling) return 1;
  return request.source.weapons[scaling.slot]?.damageMultiplier ?? 1;
}

/**
 * Flat damage, the attacker's power contribution, and the weapon's damage.
 *
 * The hand's multiplier applies to the finished sum, not to the weapon portion
 * alone. See `WeaponScaling`.
 */
export function scaleByPower(request: DamageRequest, weaponDamage = 0): number {
  const coefficient = request.powerCoefficient ?? 0;

  /*
   * ============================================================================
   * AN ABILITY'S FLAT DAMAGE IS ADDED OUTSIDE ITS WEAPON PERCENTAGE.
   *
   * "75% weapon damage plus an additional 50 with each weapon" is
   * `weapon x 0.75 + 50`, and `weaponDamage` arrives with the percentage already
   * applied to the weapon half by `weaponDamageFor` -- so the flat amount is
   * simply added, which is what this line does and has always done.
   *
   * THE OTHER READING WAS BUILT AND THEN CORRECTED BY THE OWNER, so this is here
   * to stop it being built a third time. `(weapon + 50) x 0.75` was given as the
   * owner's own reading of their tooltips, applied as a rule across seventeen
   * abilities with an opt-out, measured, shipped -- and withdrawn. The rule, its
   * `WeaponScaling.flatInsideFraction` field and the two Paladin opt-outs it
   * needed are all gone.
   *
   * WHAT IS WORTH KEEPING IS HOW LITTLE IT SHOWED. Twelve of the seventeen
   * abilities of this shape are 100% weapon damage, so the two readings are the
   * same arithmetic for all twelve and only five move at all:
   *
   *     Mutilate 0.75   Claw 1.10   Backstab 1.50   Shred 1.55   Ambush 2.50
   *
   * Three profiles of twenty-three are affected, and the whole suite passed in
   * BOTH directions -- nothing pinned the damage of any ability whose fraction
   * is not 1. `tests/engine/flatOutsideWeaponFraction.test.ts` is that gap
   * closed: it pins this line, both directions either side of a fraction of 1,
   * the no-op at exactly 1, and that the off-hand penalty stays outside.
   * ============================================================================
   */
  let total = request.baseAmount + weaponDamage;
  if (coefficient !== 0) {
    /*
     * THE SAME POOL `weaponDamageFor` USES, through the same function, so the
     * two halves of one request cannot disagree about which attack power a
     * bow scales with. Today nothing declares both a ranged weapon and a
     * coefficient, so this changes no number -- it is here because the rule
     * living privately in one file while another re-derived it is exactly how
     * `isWeaponUse` went wrong.
     *
     * AND THE SPELL SIDE PICKS ITS POOL BY SCHOOL for the same reason: a
     * Shadow-only 293 is the Priest's, a Holy-only 161 is the Shockadin's,
     * and neither is the other's.
     */
    const power = isPhysical(request.school)
      ? attackPowerFor(request)
      : // AND THE TARGET'S OWN CONTRIBUTION, which is what makes Judgement of
        // the Crusader do anything. See `spellPowerAgainst`.
        spellPowerAgainst(request.source, request.target, request.school);
    total += coefficient * power;
  }

  return total * handMultiplier(request);
}

/**
 * The fraction of damage that gets THROUGH armor:
 *
 *     multiplier = 1 - armor / (400 + 85 * level + armor)
 *
 * A 3731-armor level 63 target lets 60.67% through, which is the familiar
 * "just under 40% reduction" against a raid boss.
 *
 * Note the naming carefully. The source calls this expression
 * `Armor_Reduction`, but what it computes is the multiplier, not the amount
 * removed. Reading it as the reduction would turn a 39% reduction into a 61%
 * one, which is exactly the sort of error that produces plausible numbers.
 */
export function armorDamageMultiplier(armor: number, targetLevel: number): number {
  if (armor <= 0) return 1;
  return 1 - armor / (armorConstantForLevel(targetLevel) + armor);
}

/** The fraction of damage armor removes. The complement of the multiplier. */
export function armorReduction(armor: number, targetLevel: number): number {
  return 1 - armorDamageMultiplier(armor, targetLevel);
}

/**
 * The defender's armor as the attacker sees it, after armor penetration.
 *
 * Percentage POINTS off the armor, clamped at nothing and at everything. An
 * attacker with none sees the full figure and pays one stat read, which is the
 * overwhelmingly common case.
 */
export function penetratedArmor(attacker: Combatant, defender: Combatant): number {
  const armor = defender.stats.get('armor');
  const penetration = attacker.stats.get('armorPenetration');
  if (penetration <= 0) return armor;
  return armor * Math.max(0, 1 - Math.min(100, penetration) / 100);
}

/** Whether armor applies to a request, defaulting to "yes if physical". */
export function appliesArmor(request: DamageRequest): boolean {
  return request.appliesArmor ?? isPhysical(request.school);
}

/**
 * What fraction of the fight's PLANNED duration is still to come.
 *
 * 1 at the pull, 0 at the planned end, and it can go NEGATIVE -- a fight runs
 * on past `plannedDurationMs` until the simulation stops it, and a window that
 * has opened must stay open. Comparing `remaining <= fraction` handles that;
 * clamping at zero here would too, and would hide the fact that it happens.
 *
 * PLANNED rather than actual, because the actual length is only known once the
 * fight is over. `FIGHT_DURATION_VARIANCE` moves it per iteration, so anything
 * read off a fixed number of seconds would open its window at a different
 * fraction in every fight of a batch.
 */
function remainingFractionOf(context: SimulationContext): number {
  if (context.plannedDurationMs <= 0) return 0;
  return (context.plannedDurationMs - context.clock.now()) / context.plannedDurationMs;
}

/**
 * The attack table result for a request, or a guaranteed hit when it has no
 * table.
 */
function rollTable(
  request: DamageRequest,
  context: SimulationContext,
): AttackResolution {
  /*
   * THE ABILITY'S MODIFIER AND ITS SCHOOL'S, COMBINED. Improved Scorch and
   * Critical Mass are different effects on the same cast and both apply, the
   * same way a per-ability multiplier already sits alongside the
   * whole-character one.
   */
  const modifier = combineModifiers(
    request.source.abilityModifierFor(request.abilityId, remainingFractionOf(context)),
    casterSchoolModifier(request),
    /*
     * AND THE TABLE'S. `attackTable` for anything that rolls; `critFrom` for
     * a damage-over-time tick, which is the same table the tick already takes
     * its crit chance from -- so Mortal Shots reaching a Serpent Sting tick
     * follows the rule that already decided whether the tick could crit.
     */
    request.source.attackTableModifiers.for(request.attackTable ?? request.critFrom),
    /*
     * AND THE TARGET'S OWN, WHICH IS TWO EFFECTS SHARING ONE SLOT. Both belong
     * to the other side of the attack and they arrived from different dives, so
     * they are combined here rather than widening this call to five arguments.
     *
     * Winter's Chill is "increases the chance your Ice Lance and Frostbolt
     * spells will critically hit THE TARGET" -- a per-ability crit the boss
     * carries, not the Mage. Rend and Tear is "on Bleeding targets", read fresh
     * per hit rather than settled when the character was built.
     *
     * `?? critFrom` ON BOTH, exactly as the line above: a tick borrows the crit
     * of whatever applied it.
     */
    combineAbilityModifiers(
      request.target.abilityModifierAgainst(request.abilityId),
      bleedingTargetModifier(request, request.attackTable ?? request.critFrom),
    ),
  );

  if (!request.attackTable) {
    // No table. Either it lands flatly, or -- for a damage-over-time tick in
    // this ruleset -- it lands and rolls only for a crit.
    if (!request.critFrom) {
      return { outcome: 'hit', avoided: false, damageMultiplier: 1, rolls: [] };
    }
    return rollPeriodicCrit(request, context, modifier);
  }

  const chances = context.attackChances(
    request.attackTable,
    request.source,
    request.target,
    { slot: request.weaponSlot },
  );
  return resolveAttackTable(
    request.attackTable,
    /*
     * AND `cannotCrit` LAST, after the table, the crit-table swap and every
     * modifier -- because each of those can ADD crit and a zero handed in
     * earlier would be added to. See `DamageRequest.cannotCrit`.
     */
    withoutCrit(
      withModifier(withCritTable(chances, request, context), modifier),
      request.cannotCrit === true,
    ),
    context.rng,
  );
}

/**
 * Remove the crit slice entirely, for an attack that cannot critically strike.
 *
 * The chance goes to zero and the multiplier to one: the chance is what the
 * roll walks past, and the multiplier is belt and braces -- nothing should read
 * it once the outcome can never be `crit`, and a stray 1.5 sitting in the
 * resolution is the kind of thing a later reader uses.
 */
function withoutCrit(chances: AttackChances, cannotCrit: boolean): AttackChances {
  if (!cannotCrit) return chances;
  return { ...chances, crit: 0, critMultiplier: 1 };
}

/**
 * Swap in another table's crit chance and multiplier, leaving the rest alone.
 *
 * ----------------------------------------------------------------------------
 * TWO SLICES AND NOTHING ELSE -- see `DamageRequest.critTable`. Thunder Clap
 * resolves on the ranged table, where it cannot be dodged or parried and barely
 * misses, and takes its crit from the spell table because the ruleset owner
 * says so.
 *
 * APPLIED BEFORE `withModifier`, which is the ordering that matters: an
 * ability's own crit bonus is an ADDITION to whatever the table gave, so the
 * table has to be settled first. Reversed, a talent's bonus would be added to
 * the melee chance and then thrown away.
 * ----------------------------------------------------------------------------
 */
function withCritTable(
  chances: AttackChances,
  request: DamageRequest,
  context: SimulationContext,
): AttackChances {
  if (!request.critTable || request.critTable === request.attackTable) return chances;

  const from = context.attackChances(request.critTable, request.source, request.target, {
    slot: request.weaponSlot,
  });
  return { ...chances, crit: from.crit, critMultiplier: from.critMultiplier };
}

/**
 * Apply an ability's own crit bonus and crit damage bonus to the chances.
 *
 * The bonus is truncated into roll units the same way every other percentage
 * is, so an ability-specific crit lands on the same integer die as the rest of
 * the table rather than on a slightly different one.
 */
/**
 * Merge an ability's modifier with its school's.
 *
 * ONLY THE FIELDS THE TABLE READS -- the two crit ones and `hitBonus`. All three
 * add, which is the rule `AbilityModifiers` already combines entries by.
 *
 * `hitBonus` JOINED THEM LAST, and it is the reason five talents stopped being
 * inert. Their `unmodelled` reasons all said the table decided hit before a
 * per-school modifier could be consulted; this function is the proof it does not,
 * because the school's modifier is one of its three arguments.
 *
 * THE DAMAGE MULTIPLIER IS DELIBERATELY NOT MERGED. The ability's is passed
 * through untouched and the school's is applied on its own line further down,
 * MULTIPLIED rather than added -- two independent +10% effects are +21%. Doing
 * it here as well would apply the school's twice, so the school's is left out
 * of this function entirely rather than being combined and then skipped.
 */
function combineModifiers(
  ability: AbilityModifier,
  school: AbilityModifier,
  table: AbilityModifier,
  onTarget: AbilityModifier,
): AbilityModifier {
  return {
    critBonus:
      (ability.critBonus ?? 0) +
      (school.critBonus ?? 0) +
      (table.critBonus ?? 0) +
      (onTarget.critBonus ?? 0),
    critMultiplierBonus:
      (ability.critMultiplierBonus ?? 0) +
      (school.critMultiplierBonus ?? 0) +
      (table.critMultiplierBonus ?? 0) +
      (onTarget.critMultiplierBonus ?? 0),
    /*
     * ALL FOUR SOURCES, INCLUDING THE TARGET'S, and the fourth arrived from a
     * different dive than the `hitBonus` line below it. Every field here sums
     * every source on purpose: leaving one out does not fail, it makes that
     * source silently worth nothing, which is the failure mode this project
     * keeps meeting. A debuff that makes the target easier to hit is as real as
     * one that makes it crit more.
     */
    hitBonus:
      (ability.hitBonus ?? 0) +
      (school.hitBonus ?? 0) +
      (table.hitBonus ?? 0) +
      (onTarget.hitBonus ?? 0),
    // Applied separately, by `schoolMultiplier`, `tableMultiplier` and
    // `targetAbilityMultiplier` in `resolveDamage`, for the same reason the
    // school's is.
    damageMultiplier: ability.damageMultiplier,
  };
}

/**
 * The table-scoped modifier that counts only while the TARGET is bleeding.
 *
 * ----------------------------------------------------------------------------
 * ONE FUNCTION, TWO READERS, which is the point. The crit chance is read in
 * `rollTable` and the damage multiplier in `resolveDamage`, and a conditional
 * that reached one and not the other would be half an effect with nothing to
 * say so -- the same trap `Combatant.abilityModifierFor` exists to close.
 *
 * `table` IS PASSED IN, BECAUSE THE TWO READERS WANT DIFFERENT ONES, and that is
 * the rule `attackTableModifiers` already follows: the crit fields read
 * `attackTable ?? critFrom` so a tick can borrow the crit of whatever applied
 * it, and the damage multiplier reads `attackTable` ALONE so a tick is not
 * treated as an attack on that table. Hard-coding either one here would break
 * half of a convention that is written down in CLAUDE.md.
 *
 * THE EMPTY CHECK IS NOT AN OPTIMISATION, IT IS THE COMMON CASE. Almost no
 * character carries one of these, and walking the target's auras on every tick
 * of every fight for all of them would be work done for nobody.
 * ----------------------------------------------------------------------------
 */
function bleedingTargetModifier(
  request: DamageRequest,
  table: AttackTableKind | undefined,
): AbilityModifier {
  const modifiers = request.source.bleedingTargetModifiers;
  if (modifiers.isEmpty || !request.target.auras.isBleeding) return NO_MODIFIER;
  return modifiers.for(table);
}

const NO_MODIFIER: AbilityModifier = {};

function withModifier(chances: AttackChances, modifier: AbilityModifier): AttackChances {
  if (!modifier.critBonus && !modifier.critMultiplierBonus && !modifier.hitBonus) return chances;
  return {
    ...chances,
    /*
     * FLOORED AT THE TABLE'S OWN FLOOR, and at zero where it states none. Every
     * other band is read as an offset from this one, so a negative miss would
     * push dodge and parry into the space below the die and hand out avoidance
     * that was never rolled for -- that is why there was always a floor here.
     *
     * WHAT CHANGED IS WHOSE FLOOR IT IS. The spell table states 1%, which makes
     * 16 points of spell hit the most a caster can use, and this is one of the
     * TWO places spell miss is reduced: `attackChances` folds in the
     * character-wide `hitChance` stat and this folds in a SCHOOL-scoped
     * `hitBonus`. A floor in only one of them is a floor a build can walk
     * around by stacking the other.
     */
    miss: Math.max(
      chances.missFloor ?? 0,
      chances.miss - toRollUnits(modifier.hitBonus ?? 0),
    ),
    crit: chances.crit + toRollUnits(modifier.critBonus ?? 0),
    critMultiplier: chances.critMultiplier + (modifier.critMultiplierBonus ?? 0),
  };
}

/**
 * Roll a crit for a damage-over-time tick.
 *
 * One roll on the same 1-10000 integer die as every other chance, against the
 * crit of the table that applied the effect. Nothing else on that table is
 * consulted: a tick cannot miss, be dodged, be parried or glance, because its
 * landing was decided when the aura went on.
 */
function rollPeriodicCrit(
  request: DamageRequest,
  context: SimulationContext,
  modifier: AbilityModifier,
): AttackResolution {
  const chances = withModifier(
    context.attackChances(request.critFrom!, request.source, request.target, {
      slot: request.weaponSlot,
    }),
    modifier,
  );
  const roll = context.rng.nextInt(1, ROLL_MAX);
  if (roll <= chances.crit) {
    return {
      outcome: 'crit',
      avoided: false,
      damageMultiplier: chances.critMultiplier,
      rolls: [roll],
    };
  }
  return { outcome: 'hit', avoided: false, damageMultiplier: 1, rolls: [roll] };
}

/** Draw the weapon's damage variance and resolve its contribution. */
function rollWeaponDamage(
  request: DamageRequest,
  context: SimulationContext,
): number {
  const scaling = request.weaponScaling;
  if (!scaling) return 0;

  const weapon = request.source.weapons[scaling.slot];
  if (!weapon) return 0;

  const variance = weapon.damageVariance ?? DEFAULT_DAMAGE_VARIANCE;
  const roll = context.rng.nextFloat(1 - variance, 1 + variance);
  return weaponDamageFor(request, roll);
}

/**
 * Run a damage request through the whole pipeline without applying it.
 *
 * `attack` is the already-rolled combat table result, so the roll and the
 * damage calculation stay separable: an ability can roll the table once and use
 * the outcome for something other than damage.
 */
export function resolveDamage(
  request: DamageRequest,
  attack: AttackResolution,
  weaponDamage = 0,
  /**
   * The fight, for the per-ability modifiers conditional on its clock.
   *
   * Omitted by tests that hand an outcome in directly rather than rolling for
   * one. That is safe and is not a silent skip: a character actually carrying
   * one of those modifiers makes this a throw rather than a zero, which is what
   * `AbilityModifiers.forWhileFinalFraction` is for.
   */
  context?: SimulationContext,
): DamageResolution {
  const { source, target } = request;

  // A missed, dodged or parried attack does no damage and skips the rest of
  // the pipeline entirely.
  if (attack.avoided) {
    return {
      outcome: attack.outcome,
      avoided: true,
      raw: 0,
      mitigated: 0,
      blocked: 0,
      absorbed: 0,
      amount: 0,
      critical: false,
    };
  }

  const scaled = scaleByPower(request, weaponDamage);
  const critical = attack.outcome === 'crit';
  const afterCrit = scaled * attack.damageMultiplier;

  /*
   * PER SCHOOL ON THE AURA SIDE, and `damageDoneMultiplierFor` folds the
   * blanket multiplier in. Demonic Sacrifice names one school out of four
   * demons and Shadow and Flame's two halves name opposite ones; both reached
   * every school before this line read the request's.
   */
  const attackerMultiplier =
    (request.ignoresAttackerDamageScaling ? 1 : source.damageDoneMultiplierFor(request.school)) *
    versatilityMultiplierFrom(source.stats.effective);
  // Per-ability scaling sits alongside the whole-character multipliers rather
  // than replacing them: "+20% Revenge damage" and "+10% damage done" are
  // different effects and both apply.
  const abilityMultiplier =
    source.abilityModifierFor(
      request.abilityId,
      context ? remainingFractionOf(context) : undefined,
    ).damageMultiplier ?? 1;
  /*
   * PER SCHOOL, on the ATTACKER'S side. The mirror of
   * `damageTakenMultiplierFor` below: Fire Power raises the fire damage a Mage
   * deals, Curse of the Elements raises the fire damage a target takes, and
   * the two are different effects that both apply.
   */
  const schoolMultiplier = request.ignoresAttackerDamageScaling
    ? 1
    : casterSchoolModifier(request).damageMultiplier ?? 1;
  /*
   * PER TABLE, alongside the other three. Ranged Weapon Specialization is
   * "the damage you deal with ranged weapons", which is neither one ability
   * nor one school nor the whole character.
   *
   * `attackTable` ONLY, and deliberately not `critFrom` the way the crit
   * fields above do. `critFrom` declares one thing -- which table's CRIT a
   * tick borrows -- and reading a damage multiplier off it would stretch it
   * past what it claims. Serpent Sting is the case: it ticks NATURE damage
   * with `critFrom: 'ranged-special'`, so Mortal Shots' crit damage reaches
   * it correctly while "damage you deal with ranged WEAPONS" must not. A
   * sting's poison is not weapon damage.
   */
  const tableMultiplier =
    (source.attackTableModifiers.for(request.attackTable).damageMultiplier ?? 1) *
    /*
     * AND THE AURA-SHAPED HALF OF THE SAME THING. `attackTableModifiers` is built
     * once with the character; Seal of the Crusader's damage penalty arrives and
     * leaves with the seal, so it cannot live there. Both apply.
     */
    source.damageDoneMultiplierForTable(request.attackTable);
  /*
   * THE SAME TABLE SCOPE AGAIN, conditional on the target bleeding -- AND THE
   * ONE MULTIPLIER HERE WHOSE DAMAGE FOLD READS `critFrom`.
   *
   * ----------------------------------------------------------------------------
   * EVERY OTHER TABLE-KEYED MULTIPLIER READS `attackTable` ALONE, for the reason
   * spelled out on `tableMultiplier` above: a tick has no table, so it is not
   * damage on one. This one deviates, and it is the RULESET OWNER'S FIGURE that
   * decided it rather than a reading of the words.
   *
   * Rend and Tear shipped scoped to `melee-special` and non-periodic, which is
   * the reading "melee ABILITIES" invites. The owner reported expecting "around
   * 1.09x" and seeing "more like 1.025x", and measured over 30 batches with the
   * target bleeding 89.3% of the fight the three readings are:
   *
   *     melee-special, non-periodic     29.6% of damage     x1.0296
   *     plus the bleed TICKS            61.2%               x1.0612
   *     plus the AUTO-ATTACKS           94.8%               x1.0948
   *
   * Only the last gives 1.09, and the first gives 1.025 to the decimal. So the
   * talent reaches every point of melee damage, and `melee-auto` is in its
   * table list.
   *
   * RIP THEREFORE RAISES RIP. A bleed's own ticks are amplified by the bleed
   * being up, which is self-referential and was the second reason the narrow
   * reading was chosen first. The owner's figure includes it.
   * ----------------------------------------------------------------------------
   */
  const bleedingMultiplier =
    bleedingTargetModifier(request, request.attackTable ?? request.critFrom)
      .damageMultiplier ?? 1;
  /*
   * PERIODIC ONLY, and it is the one multiplier that selects on the KIND of
   * damage rather than on who deals it, what school it is or which table it
   * rolled. Genesis is the only caller; a character without it carries 1.
   */
  const periodicMultiplier = request.periodic ? source.periodicDamageMultiplier : 1;
  /*
   * AND THE SAME AXIS POINTING THE OTHER WAY, which is Eureka!.
   *
   * "Your next 3 non-periodic damaging abilities ... deal 10% more damage.
   * Periodic effects get nothing from it; a channeled spell is not periodic."
   * Every other multiplier above selects on who deals the damage, its school,
   * its table or its ability; none of them can say "not a tick". An aura field
   * rather than a combatant scalar because Eureka! arrives and goes, where
   * Genesis lasts as long as the character.
   */
  const nonPeriodicMultiplier = request.periodic ? 1 : source.nonPeriodicDamageMultiplier;
  const afterAttacker =
    afterCrit *
    attackerMultiplier *
    abilityMultiplier *
    schoolMultiplier *
    tableMultiplier *
    bleedingMultiplier *
    periodicMultiplier *
    nonPeriodicMultiplier;

  // Per SCHOOL, which folds in the blanket multiplier as well. Curse of the
  // Elements raises magic and leaves physical alone, so the school has to
  // reach this line rather than being decided before it.
  /*
   * AND PER ABILITY, ON THE TARGET. A debuff naming ONE ability the target
   * takes more from -- the mirror of `abilityMultiplier` above. Read here as
   * well as in `rollTable` because every reader of a modifier has to come
   * through the same funnel: a debuff whose crit chance applied and whose
   * damage did not would be quietly half an effect, which is the rule
   * `abilityModifierFor` already states for the attacker's side.
   */
  const targetAbilityMultiplier =
    target.abilityModifierAgainst(request.abilityId).damageMultiplier ?? 1;
  /*
   * THE `periodic` FLAG AND THE PER-ABILITY MULTIPLIER ARRIVED FROM TWO
   * DIFFERENT DIVES and both belong on this line. The flag is what lets a
   * school vulnerability apply to TICKS only; dropping it would silently widen
   * every such debuff to direct damage as well.
   */
  const afterTarget =
    afterAttacker *
    targetAbilityMultiplier *
    target.damageTakenMultiplierFor(request.school, request.periodic === true);

  /*
   * ARMOR PENETRATION SHRINKS THE ARMOR, NOT THE REDUCTION, and the two differ
   * by a factor of four.
   *
   * "Your attacks ignore 9% of your target's Armor" is 9% off the 3731 a raid
   * boss carries, leaving 3395 -- which the curve turns into 37.11% mitigation
   * instead of 39.33%, so the talent is worth 2.23 points. Applying the 9% to
   * the REDUCTION instead would take mitigation to 35.79% and make it worth
   * 3.54, over half as much again. Both readings are plausible and only one is
   * what the tooltip says, so it goes through `armorReduction` on a reduced
   * armor figure rather than being subtracted afterwards.
   *
   * ON THE ATTACKER, read from the attacker's stats although it is the
   * defender's armor being reduced. That is where every tooltip puts it.
   *
   * ----------------------------------------------------------------------------
   * THIS LINE WAS MISSING AND THE STAT WAS INERT FOR A RELEASE.
   * `armorPenetration` was declared in `STAT_NAMES`, granted by Serrated
   * Blades, Hack and Slash and Weaponmaster, counted as fully modelled by the
   * census, described by a comment as "read by `resolveDamage` off the
   * ATTACKER" -- and read by nothing, so nine points of it were worth exactly
   * nothing.
   *
   * `armorPenetration.test.ts` PASSED THROUGHOUT, and that is the part worth
   * remembering. It asserted the ARITHMETIC (`armorReduction` on an
   * already-reduced figure) and the REGISTRATION (`talentBuild` putting the
   * number on the stat) and never the WIRING BETWEEN THEM. Two correct halves
   * with nothing joining them is a shape neither half's test can fail on, so
   * the test beside those two now resolves real damage twice and compares.
   * ----------------------------------------------------------------------------
   */
  const reduction = appliesArmor(request)
    ? armorReduction(penetratedArmor(source, target), target.level)
    : 0;
  /*
   * A BLOCK removes a flat amount, not a fraction, and it is removed after
   * armor rather than before. Armor scales with the size of the hit and a block
   * does not, so a block is worth proportionally more against a small blow --
   * which is the behaviour that makes block value good against fast attackers
   * and poor against big ones.
   */
  const blocked = attack.outcome === 'block' ? target.stats.get('blockValue') : 0;
  const mitigated = afterTarget * reduction + blocked;
  const afterMitigation = Math.max(0, afterTarget - mitigated);

  /*
   * ABSORBS COME LAST, after armor and after a block, which is the order the
   * pipeline comment at the top of this file has always stated.
   *
   * READ, NOT SPENT. This function applies nothing -- an ability can resolve a
   * hit without the hit happening -- so it asks how much WOULD be soaked and
   * `dealDamage` spends it afterwards. Exactly the arrangement a block charge
   * has, and said twice because getting it wrong here would drain a shield for
   * damage that never landed.
   */
  const absorbed = Math.min(afterMitigation, target.auras.absorbAvailable());

  const amount = Math.max(0, afterMitigation - absorbed);

  return {
    outcome: attack.outcome,
    avoided: false,
    raw: afterTarget,
    mitigated,
    blocked,
    absorbed,
    amount,
    critical,
  };
}

/**
 * Resolve a damage request, apply it to the target, and emit telemetry.
 *
 * This is the only function that reduces health from damage. Everything about
 * a hit, including the death that may follow, flows through here.
 */

/**
 * Hand most of an ability's cost back when its attack did not connect.
 *
 * ----------------------------------------------------------------------------
 * THE RULE IS THE ENGINE'S AND THE NUMBERS ARE THE RULESET'S, which is why
 * both the fraction and the resources it covers arrive on the combatant. A
 * miss, a dodge and a parry all refund; nothing else does, and for an ABILITY
 * nothing else can -- `melee-special` offers no block at all, so Forever's
 * "doesn't connect through a block" has no case to cover here. A block on an
 * auto-attack is not affected either, because an auto-attack costs nothing.
 *
 * CLEARED WHETHER OR NOT IT PAID OUT, so each cast refunds at most once and a
 * multi-hit ability is judged on its first hit. Leaving it armed would let a
 * later avoided hit refund a cast that had already connected.
 * ----------------------------------------------------------------------------
 */
function refundCostIfAvoided(
  context: SimulationContext,
  request: DamageRequest,
  resolution: DamageResolution,
): void {
  const source = request.source;
  const pending = source.pendingCostRefund;
  if (!pending || pending.abilityId !== request.abilityId) return;

  source.pendingCostRefund = undefined;
  if (!resolution.avoided || pending.amount <= 0) return;

  const pool = source.resources.get(pending.resource);
  if (!pool) return;

  const before = pool.current;
  pool.gain(pending.amount);
  const gained = pool.current - before;

  context.telemetry.emit({
    type: 'resource_gained',
    timestamp: context.clock.now(),
    actorId: source.id,
    resource: pending.resource,
    amount: gained,
    // What the cap threw away, so a refund into a full pool is visible rather
    // than silently absent from the totals.
    wasted: pending.amount - gained,
    current: pool.current,
    source: `${request.abilityId}_refund`,
    sourceName: `${request.abilityName} (refund)`,
  });
}

export function dealDamage(
  context: SimulationContext,
  request: DamageRequest,
): DamageResolution {
  // Drawn BEFORE the table roll, and not drawn at all for an ability with no
  // weapon scaling. Both matter: the order fixes the RNG sequence for a seeded
  // run, and an ability that never touches the weapon must not consume a
  // number and shift every roll after it.
  const weaponDamage = rollWeaponDamage(request, context);
  const attack = rollTable(request, context);
  const resolution = resolveDamage(request, attack, weaponDamage, context);
  const { target, source } = request;

  refundCostIfAvoided(context, request, resolution);

  /*
   * A PARRY HURRIES THE PARRIER'S OWN NEXT SWING -- the TARGET parried, so it
   * is the TARGET's timer that moves, not the source's.
   *
   * THE SOURCE IS WHAT THIS READ FIRST, and it was backwards. The owner's
   * original wording is "reduces the attacker's remaining swing timer", which
   * reads as the unit whose blow was turned aside; their clarification is
   * unambiguous the other way -- "if I parry an attack MY NEXT ATTACK COMES
   * SOONER. If a boss parries an attack THEIR NEXT ATTACK COMES SOONER." A
   * parry is a counter, and a counter is the parrier acting.
   *
   * ANY PARRIED ATTACK, not only a swing: the owner's wording is "successfully
   * parrying an attack", and a special is an attack. The slot is the PARRIER'S
   * main hand and has nothing to do with the weapon that was parried -- see
   * `parryHaste.ts`.
   */
  if (resolution.outcome === 'parry') {
    applyParryHaste(context, target);
  }

  /*
   * AND THE ABSORB IS SPENT HERE for the same reason the block charge is:
   * `resolveDamage` worked out how much would be soaked and applied nothing.
   * A shield drawn down inside that function would lose the amount every time
   * an ability resolved a hit it did not deal.
   */
  if (resolution.absorbed > 0) {
    target.auras.consumeAbsorb(context, resolution.absorbed);
  }

  const healthBefore = target.health.current;
  /*
   * A combatant an assumed healer keeps up never drops below one health. The
   * damage is NOT reduced -- the full amount is reported and still generates
   * rage -- it simply does not finish them. See `survivesLethalDamage`.
   */
  const drained = target.survivesLethalDamage
    ? Math.min(resolution.amount, Math.max(0, healthBefore - 1))
    : resolution.amount;
  target.health.drain(drained);

  /*
   * Computed from the health that was there, not from the difference the drain
   * reported. Subtracting two large floats leaves residue, which showed up as a
   * fraction of a point of "overkill" on a target at full health.
   *
   * A target an assumed healer keeps up has NO overkill, whatever the size of
   * the hit: overkill is damage spent past a death, and nothing died. Reporting
   * it anyway produced combat log lines like "hits Example for 6,374 (3,765
   * overkill)" against a character who was still standing.
   */
  const overkill = target.survivesLethalDamage
    ? 0
    : Math.max(0, resolution.amount - healthBefore);

  context.telemetry.emit({
    type: 'damage',
    timestamp: context.clock.now(),
    sourceId: source.id,
    targetId: target.id,
    abilityId: request.abilityId,
    abilityName: request.abilityName,
    school: request.school,
    amount: resolution.amount,
    outcome: resolution.outcome,
    critical: resolution.critical,
    mitigated: resolution.mitigated,
    absorbed: resolution.absorbed,
    overkill,
    periodic: request.periodic ?? false,
  });

  // Taking damage can generate resource: this is how a warrior builds rage
  // from being hit. Proportional to damage actually taken, so an avoided
  // attack generates nothing.
  /*
   * Rage from damage comes from two directions and they are worth telling
   * apart: a warrior generates it by HITTING and, when something hits back, by
   * BEING HIT. The second is enormous -- it is most of the gap between the
   * standing and attacking baselines -- so folding both into one "damage" row
   * would hide the single biggest term in a tank's rage economy.
   */
  /*
   * "D = PRE-ARMOR DAMAGE TO BE DEALT", AND A BLOCKED HIT GIVES THE RAGE OF
   * THE UNBLOCKED AMOUNT -- both the ruleset owner's words, and they pull in
   * opposite directions on the same pipeline step.
   *
   * `raw` is the figure after both sides' damage multipliers and before armor,
   * block and absorbs. Armor is meant to leave the rage alone, so `raw` is the
   * right starting point; a block is not, so its share comes back off.
   *
   *   Defensive Stance -10%   DOES reduce the rage. It reduces the damage to
   *                           be dealt, before any of this.
   *   Armor                   does NOT. That is what "pre-armor" means.
   *   A block                 DOES, by its flat value.
   *
   * It used to pass `amount`, which was right for the old formula -- rage in
   * proportion to damage actually taken -- and would now understate a tank by
   * whatever their armor removed, which is most of it.
   */
  const rageableDamage = Math.max(0, resolution.raw - resolution.blocked);
  grantGeneratedResource(context, target, target.resourceOnDamageTaken, rageableDamage, {
    id: 'damage_taken',
    name: 'Damage taken',
  });

  if (healthBefore > 0 && target.health.isEmpty) {
    context.killCombatant(target, source);
  }

  // Reactions run last, after the damage has landed, the telemetry has been
  // emitted and any death has been processed. A reaction therefore sees a
  // settled world rather than a half-applied one.
  //
  // Only attacks that consulted a combat table qualify: an outcome is what a
  // reaction keys off, and damage with no table has no meaningful outcome.
  // Periodic ticks are excluded too — a bleed ticking is not an attack anyone
  // parries.
  if (request.attackTable && !request.periodic) {
    const event: AttackEvent = {
      attacker: source,
      defender: target,
      outcome: resolution.outcome,
      abilityId: request.abilityId,
      abilityName: request.abilityName,
      amount: resolution.amount,
      weaponSlot: request.weaponSlot,
      critical: resolution.critical,
    };
    runReactions(context, source, 'dealt', event);
    runReactions(context, target, 'taken', event);
  } else if (request.periodic) {
    /*
     * A TICK GETS ITS OWN TRIGGER, which nothing existing declares.
     *
     * The `dealt` exclusion above stands: every reaction in the project is
     * written against a table-rolled attack, and a bleed ticking is not one.
     * `periodicDealt` is opted into rather than inherited, so this branch is
     * dead for every character that does not carry such a reaction -- see
     * `ReactionTrigger`.
     *
     * NO `taken` COUNTERPART, because nothing asked for one. Adding it would be
     * a second dead branch with no caller to say what its outcome should mean.
     *
     * THE OUTCOME IS SYNTHESISED from the crit, because a tick rolled no table.
     */
    const event: AttackEvent = {
      attacker: source,
      defender: target,
      outcome: resolution.critical ? 'crit' : 'hit',
      abilityId: request.abilityId,
      abilityName: request.abilityName,
      amount: resolution.amount,
      weaponSlot: request.weaponSlot,
      critical: resolution.critical,
    };
    runReactions(context, source, 'periodicDealt', event);
  }

  /*
   * A BLOCK SPENDS A CHARGE, and it is spent LAST -- after the damage was worked
   * out, and after the reactions have seen the block.
   *
   * ----------------------------------------------------------------------------
   * NOT INSIDE `resolveDamage`, because that function deliberately applies
   * nothing: an ability can resolve a hit without the hit happening. And after
   * the damage, so the block that pays is the block that benefits -- Shield Block
   * is "two blocks", and consuming the charge first would make the second land
   * unblocked.
   *
   * AND AFTER THE REACTIONS, which is the half that was wrong. Holy Shield
   * "deals 221 Holy damage for each attack blocked while active" with four
   * charges, and its reaction asks whether the aura is up: spending the charge
   * first drops the aura on the FOURTH block, so the last of the four dealt
   * nothing and the ability was quietly worth three quarters of itself. The same
   * reasoning `runCast` runs `onCast` before the cast reactions by -- the effect
   * that spends the final charge has already resolved while the aura was still
   * there.
   * ----------------------------------------------------------------------------
   */
  if (attack.outcome === 'block') {
    target.auras.consumeBlockCharges(context);
  }

  return resolution;
}

/**
 * Grant a resource generation award, flat and damage-proportional parts alike.
 *
 * Shared by damage dealt and damage taken. A zero or negative award is skipped
 * rather than emitting a telemetry event for nothing.
 *
 * ----------------------------------------------------------------------------
 * A CRIT MULTIPLIES THE FLAT HALF, by `Combatant.critResourceMultiplier`, which
 * is 1 unless the ruleset says otherwise. `crit` is the outcome of the event the
 * award belongs to; callers that have no outcome to offer pass nothing and the
 * multiplier never applies.
 *
 * THE FLAT HALF ONLY, AND THAT IS THE WHOLE CARE THIS NEEDS. A `perDamage` award
 * is proportional to damage and a crit has already doubled the damage, so
 * multiplying it here as well would pay the bonus twice -- a bigger number and
 * no error. Forever's two rage rules split exactly along that line: rage from
 * dealing damage is `flat`, rage from taking it is `perDamage`.
 * ----------------------------------------------------------------------------
 */
export function grantGeneratedResource(
  context: SimulationContext,
  actor: Combatant,
  generation: ResourceGeneration | undefined,
  damage: number,
  source?: ResourceSource,
  crit = false,
): void {
  if (!generation) return;
  // A flat award that says it needs damage is skipped entirely when none
  // landed. See `ResourceGeneration.requiresDamage`.
  if (generation.requiresDamage && damage <= 0) return;

  const flat = (generation.flat ?? 0) * (crit ? actor.critResourceMultiplier : 1);
  const amount = flat + (generation.perDamage ?? 0) * Math.max(0, damage);
  if (amount <= 0) return;

  context.grantResource(actor, generation.resource, amount, source);
}
