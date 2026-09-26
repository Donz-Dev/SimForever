import type { AttackTableKind, DamageSchool } from '../../engine';
import type { PrimaryStatName, StatModifierOperation, StatName } from '../../engine';
import type { ResourceType, WeaponType } from '../../engine';

/**
 * What a talent does.
 *
 * DECISION: a closed union of declared effects, not a function per talent.
 *
 * This is the third time the codebase makes this choice. `AuraDefinition` is
 * data — `statModifiers`, `damageDoneMultiplier`, `periodic` — with hooks for
 * what data cannot say. `Ability` is declared `cost`, `cooldownMs` and
 * `attackTable`, plus `onCast`. A talent is the same shape: what it does is
 * data, and a talent whose effect does not fit is `unmodelled` rather than a
 * bespoke function nothing else can read.
 *
 * Declared effects buy three things a function would not:
 *
 *   1. The UI can say what a build changes without running a fight.
 *   2. A test can check an effect without executing it.
 *   3. An effect that CANNOT be expressed is visible as such, instead of being
 *      a function that quietly does nothing.
 *
 * WHERE THE NUMBERS COME FROM
 *
 * Not from here. An effect says what a talent does with its number; the number
 * itself lives in `src/data/talents/values/<class>.json`, per rank, and is
 * hand-editable for balance changes. That is the same split as "rules go in
 * `engine`, numbers go in `game`", one level further down — and it is why
 * changing what Flurry grants never means touching TypeScript.
 *
 * A talent with no value for its rank contributes NOTHING and says so. It is
 * never extrapolated from a lower rank: three of the Warrior's own talents
 * break the linear assumption, so a guess would be wrong about 7% of the time
 * in a way no result could reveal.
 */
export type TalentEffect =
  /**
   * Adds to a stat, exactly as a buff or an item does.
   *
   * `scale` converts the talent's stated number into what the stat expects.
   * Crit and hit are held in percentage POINTS, so Cruelty's "+1%" is a flat
   * +1 and needs no scaling; a `percentAdd` modifier wants a FRACTION, so a
   * talent reading "+2%" passes 0.02 and scales by 0.01.
   */
  | {
      readonly kind: 'stat';
      readonly stat: StatName;
      readonly operation: StatModifierOperation;
      readonly scale?: number;
      readonly valueIndex?: number;
    }

  /**
   * A stat worth a PERCENTAGE OF ANOTHER STAT, re-derived as that stat moves.
   *
   * ----------------------------------------------------------------------
   * "Increases your Attack Power by 100% of your Intellect." Six talents
   * across five classes say this, in four directions, and none of them could
   * be expressed: `stat` adds a flat amount or a percentage OF THE SAME
   * STAT, and nothing crossed from one to another.
   *
   * A NEW DECLARATION RATHER THAN A NEW RULE, like `grantCastModifier` before
   * it. `StatBlock` already resolves in two passes so that DERIVED stats see
   * fully-buffed PRIMARY ones -- that is why a strength blessing raises
   * attack power -- and it takes the derivation as an injected function
   * precisely because which stat makes which is game content. This is one
   * more term in that function, so Careful Aim follows a buffed intellect
   * exactly the way attack power already follows a buffed strength. Folding
   * it in as a flat number at build time would freeze it at the unbuffed
   * value, which is the mistake the two-pass design exists to prevent.
   *
   * `from` must be a PRIMARY stat: the derivation is handed resolved
   * primaries, and all six talents read one. Reading a derived stat would
   * need a third pass and nothing asks for it.
   *
   * The value is a PERCENTAGE, so 100 means all of it.
   * ----------------------------------------------------------------------
   */
  | {
      readonly kind: 'statFromStat';
      readonly from: PrimaryStatName;
      readonly to: StatName;
      readonly valueIndex?: number;
    }

  /** Reduces an ability's resource cost by the talent's value. */
  | { readonly kind: 'abilityCost'; readonly abilityId: string }
  /**
   * Resource cost to SUBTRACT from every ability that rolls a combat table.
   *
   * Focused Rage reduces the cost of "your offensive abilities", and the
   * source never says which those are. The ruleset owner has: an ability is
   * offensive if it is PROCESSED THROUGH A COMBAT TABLE. Heroic Strike,
   * Thunder Clap and Sunder Armor are; Battle Shout is not.
   *
   * That is a property the abilities already carry -- `attackTable` -- so the
   * set is derived rather than listed. A list would need editing every time
   * an ability was added, and the edit that was forgotten would silently make
   * the talent weaker.
   */
  | { readonly kind: 'attackAbilityCost' }

  /**
   * Reduces an ability's cooldown by the talent's value.
   *
   * The unit is declared because the source states some in seconds and some in
   * minutes, and the values file keeps the source's own number rather than
   * silently normalising it.
   */
  | {
      readonly kind: 'abilityCooldown';
      readonly abilityId: string;
      readonly unit: 'seconds' | 'minutes';
    }

  /**
   * Grants an ability the character does not otherwise have.
   *
   * Takes no value: a talent either gives you Mortal Strike or it does not.
   */
  | { readonly kind: 'grantAbility'; readonly abilityId: string }
  /**
   * An aura the character is simply always under, applied when combat begins.
   *
   * For a passive that DOES something on a timer rather than adding a number.
   * Anger Management is the first: a stat modifier cannot express "a rage
   * every three seconds", and an ability cannot either because nothing casts
   * it. The aura already has a periodic; this is the wiring that puts one on
   * a character because a talent point was spent.
   */
  | { readonly kind: 'grantAura'; readonly auraId: string }
  /**
   * A PERCENTAGE of the armor equipped items supply, added on top.
   *
   * Toughness raises "your Armor value from items", and armor as the engine
   * holds it is items plus the class base. A plain percentage modifier on the
   * `armor` stat would scale the base as well and overstate the talent, which
   * is exactly why it went unmodelled -- so this reads the item contribution
   * on its own and contributes a flat amount.
   */
  | { readonly kind: 'itemArmorPercent' }
  /**
   * A PERCENTAGE added to what the off hand already does.
   *
   * Three separate kinds rather than one, because the three land in three
   * different places: damage is a property of the weapon, rage generation is
   * a property of the weapon's resource rule, and hit is read by the combat
   * table when a swing resolves. Dual Wield Specialization moves all three at
   * once, which is exactly why it went unmodelled for so long -- a single
   * effect kind could only ever have done a third of it.
   *
   * Each reads its own slot out of the talent's rank values, hence
   * `valueIndex`.
   */
  | {
      readonly kind: 'offHandDamage';
      readonly valueIndex?: number;
    }
  | {
      readonly kind: 'offHandResourceGeneration';
      readonly valueIndex?: number;
    }
  /** Percentage POINTS of hit, on off-hand attacks only. */
  | {
      readonly kind: 'offHandHit';
      readonly valueIndex?: number;
    }

  /** Raises a resource cap by the talent's value. */
  | { readonly kind: 'resourceMax'; readonly resource: ResourceType }

  /**
   * Adds to ONE ability's crit chance, in percentage points.
   *
   * Improved Overpower's "+25% critical strike chance of your Overpower".
   * Distinct from a `stat` effect on `critChance`, which would raise crit for
   * everything the character does.
   */
  | { readonly kind: 'abilityCrit'; readonly abilityId: string }

  /**
   * Multiplies ONE ability's damage. The talent's value is a PERCENTAGE, so 12
   * becomes x1.12.
   *
   * The ability id can be an aura's, because a periodic tick carries the aura's
   * id -- which is how Improved Rend scales a bleed rather than a cast.
   */
  | {
      readonly kind: 'abilityDamage';
      readonly abilityId: string;
      /**
       * Which of the talent's numbers to read, for one that varies several.
       *
       * Improved Corruption is "-2 sec cast time AND +10% damage" -- two
       * values in one row, and taking the first for the damage would give
       * Corruption a 2% bonus instead of 10%.
       */
      readonly valueIndex?: number;
    }

  /**
   * Raises the critical strike damage BONUS for every ability, as a percentage
   * of the bonus rather than of the total.
   *
   * Impale's "+10% critical strike damage bonus" on a x2 melee crit gives
   * 1 + (2 - 1) x 1.1 = x2.1, not x2.2. Auto attacks are not abilities and are
   * untouched.
   */
  | { readonly kind: 'critDamageBonus' }

  /**
   * Damage, crit chance or crit damage for a SCHOOL rather than an ability.
   *
   * ----------------------------------------------------------------------
   * "Increases the damage done by your Fire spells by 10%." Before this the
   * only choices were `abilityDamage`, which names one ability and would have
   * to list every fire spell a Mage owns, and `damageMultiplier`, which is
   * every school at once.
   *
   * Both alternatives were TAKEN, and both were wrong in a way that was
   * written down at the time. The Druid's Moonfury and Vengeance were left
   * `unmodelled` because listing abilities was unmaintainable; the Shaman's
   * Elemental Fury was applied whole-character with a caveat saying it also
   * raised physical crits it should not.
   *
   * `schools` lists what the tooltip lists, so a talent naming three schools
   * is one entry rather than three.
   * ----------------------------------------------------------------------
   */
  | {
      readonly kind: 'schoolDamage' | 'schoolCrit' | 'schoolCritDamage';
      readonly schools: readonly DamageSchool[];
      readonly valueIndex?: number;
    }

  /**
   * Damage, crit chance or crit damage for an ATTACK TABLE.
   *
   * ----------------------------------------------------------------------
   * THE OTHER AXIS FROM `schoolDamage`. A school separates fire from frost;
   * this separates MELEE from RANGED, and a swing from a special.
   *
   * Four Hunter talents wanted it and each wanted a different subset --
   * "all your melee ABILITIES", "the damage you deal with ranged WEAPONS",
   * "all ranged ABILITIES", "your MELEE critical strike damage". Two were
   * left inert and two were applied whole-character with a written caveat,
   * which is the same pair of bad options the Druid's Moonfury had before
   * schools existed.
   *
   * `tables` lists what the tooltip covers, so an effect says on its own
   * face whether auto-attacks are included rather than leaving it to a
   * comment. That distinction is the point: Savage Strikes is specials only
   * and Ranged Weapon Specialization is the weapon, swings and all.
   * ----------------------------------------------------------------------
   */
  | {
      readonly kind: 'attackTableDamage' | 'attackTableCrit' | 'attackTableCritDamage';
      readonly tables: readonly AttackTableKind[];
      readonly valueIndex?: number;
    }

  /**
   * Grants a reaction: something that happens in response to an attack result.
   *
   * The reaction itself is built by a per-class registry, from the talent's
   * value at the character's rank, because a proc is genuinely code — a chance
   * roll, a condition on the attack, an aura to apply. This is the escape hatch
   * the design allows for, kept narrow: the TABLE stays declarative and says
   * WHICH reaction, while the registry says what it does.
   */
  | {
      readonly kind: 'reaction';
      readonly reactionId: string;
      readonly valueIndex?: number;
      /**
       * Gear the character must have for the proc to be registered at all.
       *
       * ----------------------------------------------------------------------
       * WHY THE GATE IS HERE AND NOT INSIDE THE REACTION. A reaction receives
       * the attack and the actor, and a `WeaponProfile` says nothing about
       * what is in the off hand -- so "while a shield is equipped" cannot be
       * checked at the moment it fires. It is knowable exactly once, when the
       * build is assembled, which is where the character's equipment is in
       * scope.
       *
       * Master of Defense is why this exists: its rage proc fired for a
       * Protection warrior holding two weapons, and the talent carried an
       * `unmodelled` note saying so rather than a fix. Equipping a shield is a
       * choice the player makes on the GUI, so the engine is entitled to know
       * about it -- the ruleset owner's point, and the reason the note was not
       * the right answer.
       *
       * The same shape `conditionalDamage` and `conditionalCrit` already use,
       * so a reader meets one rule rather than three.
       * ----------------------------------------------------------------------
       */
      readonly requires?: BuildRequirement;
    }

  /**
   * A named number handed to ONE ability, read by that ability's own `onCast`.
   *
   * For a value that lives inside an ability's body rather than in a declared
   * field: the rage Charge generates, say. The ability names the key it reads,
   * and the talent names the same key here.
   *
   * `valueIndex` picks which number, for a talent that varies several --
   * Eclipse's row is "next 2 Starfires" then the half second, and taking the
   * first would hand Wrath a two-SECOND reduction off a 3.5-second Starfire.
   */
  | {
      readonly kind: 'abilityBonus';
      readonly abilityId: string;
      readonly key: string;
      readonly valueIndex?: number;
    }
  /**
   * A named bonus on an ability that is ON or OFF, with no magnitude.
   *
   * `abilityBonus` reads a per-rank number, and a single-rank talent whose
   * effect is "also do this" has no number to read -- Raging Blows gives
   * Whirlwind an off-hand strike, and there is no quantity involved. Routed
   * past the value lookup for the same reason `grantAbility` is, rather than
   * inventing a 1 for the values file to carry.
   */
  | { readonly kind: 'abilityFlag'; readonly abilityId: string; readonly key: string }

  /** Reduces an ability's cast time by the talent's value, in SECONDS. */
  | { readonly kind: 'abilityCastTime'; readonly abilityId: string }

  /** Reduces an ability's global cooldown by the talent's value, in SECONDS. */
  | { readonly kind: 'abilityGcd'; readonly abilityId: string }

  /**
   * Stops an ability's cast from resetting the melee swing timer.
   *
   * Takes no value: Improved Slam either lets the swing run behind the cast or
   * it does not. Both ranks grant it, which is why it is separate from the cast
   * time reduction that does scale.
   */
  | { readonly kind: 'abilityHoldsSwing'; readonly abilityId: string }

  /**
   * Makes an ability usable in a stance it otherwise is not.
   *
   * Takes no value, like `abilityHoldsSwing`: Vanguard either lets Charge be
   * used in Defensive Stance or it does not.
   *
   * ADDS to the ability's own list rather than replacing it, so a warrior with
   * Vanguard can still Charge from Battle Stance. The stance gate in
   * `casting.ts` reads that list, so nothing else has to know this talent
   * exists -- which is the point of expressing it as data rather than as a
   * special case inside Charge.
   */
  | { readonly kind: 'abilityStance'; readonly abilityId: string; readonly stance: string }

  /**
   * A proc that fires when an ABILITY IS USED rather than when one lands.
   *
   * ----------------------------------------------------------------------------
   * THE SECOND ESCAPE HATCH, and it is narrow for the same reason `reaction`
   * is: the table stays declarative and says WHICH proc, while a per-class
   * registry says what it does.
   *
   * It exists because four Rogue talents key off a CAST and not a hit:
   * Relentless Strikes and Ruthlessness both pay out when a finisher is used,
   * Improved Expose Armor refunds when one is used at five combo points. A
   * `reaction` fires on damage dealt or taken and can see neither.
   *
   * The event carries what the cast SPENT, measured by snapshotting the pools
   * around it -- so "per combo point spent" is answerable without any ability
   * having to announce anything. See `engine/combat/reactions.ts`.
   * ----------------------------------------------------------------------------
   */
  | {
      readonly kind: 'castReaction';
      readonly reactionId: string;
      readonly valueIndex?: number;
    }

  /**
   * Multiplies ALL damage, but only while the character is holding the right
   * weapon. The talent's value is a PERCENTAGE, so 3 becomes x1.03.
   *
   * Unlike `abilityDamage` this covers auto attacks too, which is what "damage
   * you deal with two-handed weapons" means. The condition is evaluated when
   * the character is built, because that is when the weapons are known — a
   * character does not swap weapons mid-fight here.
   */
  | {
      readonly kind: 'conditionalDamage';
      readonly requires: BuildRequirement;
    }

  /**
   * Adds crit chance to every ability, but only with the right weapon.
   *
   * Weaponmaster's axe and polearm clause.
   */
  | {
      readonly kind: 'conditionalCrit';
      readonly requires: BuildRequirement;
    }

  /**
   * The talent's effect cannot be modelled, and this says why.
   *
   * NOT a gap in this list waiting to be filled in — a first-class outcome, and
   * the most important variant here. Items already work this way: each carries
   * the source's exact wording plus one line on why it does nothing, and the
   * Gear panel prints every one under "Equipped but not simulated". That is
   * what kept Crusader granting nothing until its real proc rate arrived,
   * rather than quietly inheriting a plausible one.
   *
   * A talent listed here is visibly inert. A talent given a guessed effect
   * would be invisibly wrong, and this project would rather be the first.
   */
  /**
   * A `CastModifier` the character carries from the pull, built from the
   * talent's value.
   *
   * ----------------------------------------------------------------------
   * THIS RETIRES THE MOST COMMON `unmodelled` REASON IN THE PROJECT.
   *
   * "Reduces the mana cost of your Shock spells by 45%" is a FRACTION OF THE
   * COST, and `CastModifier.costFraction` has been exactly that since it was
   * built for Maelstrom Weapon. What was missing was a way for a TALENT to
   * hand one over: `abilityCost` subtracts a FLAT amount, which is right for
   * a 20-rage Mortal Strike and wrong for a 450-mana Earth Shock, and eleven
   * talents across seven classes said so in almost identical words.
   *
   * The Priest's Shadowform was the first thing to express one, and only
   * because it arrives on an AURA rather than from a talent. This is the
   * missing half, and it is a new EFFECT rather than a new rule -- the
   * modifier, its resolution and its consumption all already existed.
   *
   * GRANTED AS A PERMANENT AURA, one per talent, so it goes through the same
   * `resolveCast` path every other cast modifier does. Two of them on the
   * same ability stack ADDITIVELY -- Shadowform's 50% and Mental Agility's
   * 10% make 60% -- which is how percentage cost reductions behave and falls
   * out of `resolveCast` subtracting each from the base.
   * ----------------------------------------------------------------------
   */
  | {
      readonly kind: 'grantCastModifier';
      readonly abilityIds: readonly string[];
      /** Which field of the modifier the talent's value feeds. */
      readonly property: 'costFraction' | 'castTimeFraction';
      readonly valueIndex?: number;
    }

  /**
   * Something the talent does to the owner's PET rather than to the owner.
   *
   * ----------------------------------------------------------------------
   * A PET IS A SEPARATE COMBATANT, which is why this needs a kind of its
   * own. Every other effect here lands on the character carrying the talent;
   * these land on a creature built afterwards, from that character.
   *
   * SIX HUNTER TALENTS WERE INERT FOR WANT OF THIS -- Endurance Training,
   * Focused Fire's pet half, Unleashed Fury, Ferocity, Frenzy and Bestial
   * Discipline -- and every one of them said so in its `unmodelled` reason.
   * They are most of what Beast Mastery spends its points on.
   *
   * The values are collected into `TalentBuild.pet` and handed to
   * `createPet`, which is the only thing that builds one.
   * ----------------------------------------------------------------------
   */
  | {
      readonly kind: 'petStat';
      readonly property: 'damage' | 'crit' | 'health' | 'armor' | 'focusRegen';
      readonly valueIndex?: number;
    }

  /**
   * A reaction the PET carries, built from the owner's talent rank.
   *
   * Frenzy is the one: "gives your pet a {0}% chance to gain a 30% attack
   * speed increase for 8 sec after dealing a critical strike". It fires on
   * the PET's crit and buffs the PET, so it belongs to the pet's own
   * reaction list and not the Hunter's.
   */
  | {
      readonly kind: 'petReaction';
      readonly reactionId: string;
      readonly valueIndex?: number;
    }

  /**
   * The talent, or a clause of it, does nothing. `reason` says why, in terms
   * specific enough to re-read.
   *
   * ----------------------------------------------------------------------
   * `scope` IS THE PERMANENCE, AND IT IS THE DIFFERENCE BETWEEN A GAP AND A
   * DECISION.
   *
   * ABSENT means a live gap. It is a claim about the engine on the day it was
   * written, it expires when something is built, and clearing a blocker is not
   * finished until every reason naming it has been re-read.
   *
   * PRESENT means the project owner has RULED the effect out. It is not a gap,
   * it does not expire, and it must not be counted against the milestone. Six
   * such reasons once read as pending work and inflated the queue by a third.
   *
   * Recording it as DATA rather than only in prose is what lets the milestone
   * be measured: "every talent resolves to an effect or to a permanent ruling"
   * is a question a test can answer, and `outOfScope.test.ts` asks it. Prose
   * alone could not, because "the engine has no positions" and "nothing
   * attacks the player" read identically and only one of them expires.
   * ----------------------------------------------------------------------
   */
  | {
      readonly kind: 'unmodelled';
      readonly reason: string;
      readonly scope?: OutOfScope;
    };

/**
 * The things this simulator deliberately does not model, by the project
 * owner's ruling. See CLAUDE.md, "Scope".
 *
 * Adding a member here is a scope DECISION and needs the owner, not a
 * judgement call while writing a class.
 */
export type OutOfScope =
  /** Positions, range, facing, movement. There is no position model. */
  | 'positioning'
  /** Stuns, fears, roots, snares, silences, incapacitates, disorients. */
  | 'crowdControl'
  /** Threat, which is not tracked anywhere. */
  | 'threat'
  /**
   * Healing THROUGHPUT. Mana RETURN is NOT out of scope — it changes a damage
   * profile's sustain, so a talent returning mana is a live gap and gets no
   * `scope`.
   */
  | 'healing';

/**
 * What a character must BE or be HOLDING for a conditional effect to apply.
 *
 * ----------------------------------------------------------------------------
 * IT WAS `WeaponRequirement` AND THE NAME HAD STOPPED BEING TRUE. `shield`
 * was already not a weapon -- Bastion asks what is in the off hand rather than
 * what is being swung with -- and `hasPet` is not even equipment. Two clauses
 * out of four about something other than a weapon is a renamed interface, not
 * a third exception.
 *
 * The weapon clauses are checked against the MAIN HAND, which is what "the
 * weapon you are using" means for a talent; an off-hand of a different type is
 * a case no Warrior talent here distinguishes.
 * ----------------------------------------------------------------------------
 */
export interface BuildRequirement {
  /** Any one of these types satisfies it. */
  readonly weaponTypes?: readonly WeaponType[];
  /** Whether the weapon must be two-handed. */
  readonly twoHanded?: boolean;
  /**
   * Whether a SHIELD must be equipped.
   *
   * Not a weapon, which is why it sits beside the weapon clauses rather than
   * inside them: Bastion asks what is in the off hand, not what is being swung
   * with. A build can satisfy this and the weapon clauses independently.
   */
  readonly shield?: boolean;
  /**
   * Whether the character must have a PET in the fight.
   *
   * --------------------------------------------------------------------------
   * FOCUSED FIRE IS WHY THIS EXISTS, and it was wrong rather than merely
   * missing: "+2% to all damage you and your pet deal WHILE YOUR PET IS
   * ACTIVE", declared with no requirement at all -- so both Lone Wolf builds,
   * which take it as a cheap route to Careful Aim and then take the talent
   * for having no pet, collected 2% for a pet that is never built.
   *
   * Answered by `bringsPet`, the same function the encounter uses to decide
   * whether to build one, so the talent and the fight cannot disagree.
   * --------------------------------------------------------------------------
   */
  readonly hasPet?: boolean;
}

/**
 * Which of a talent's values an effect reads, when the talent varies several.
 *
 * Defaults to the first. Shield Specialization's block chance is value 0 and
 * its rage proc chance is value 1, and an effect that took the wrong one would
 * be quietly wrong rather than visibly broken.
 */

/** Every effect a talent has. Most have one; some have several. */
export type TalentEffects = readonly TalentEffect[];

/** A talent that is doing nothing, and the reason, for showing to a person. */
export interface UnmodelledTalent {
  readonly talentId: string;
  readonly name: string;
  readonly rank: number;
  /** The source's own words for what it should do. */
  readonly text: string;
  readonly reason: string;
  /**
   * Set when the effect is out of scope by ruling rather than missing.
   *
   * Carried through from the effect so a caller can tell a DECISION from a
   * GAP without parsing prose — which is what makes the milestone countable.
   */
  readonly scope?: OutOfScope;
}

/**
 * A talent that was allocated points but whose own requirements are not met.
 *
 * DISTINCT FROM `UnmodelledTalent`, and the difference matters to a reader: an
 * unmodelled talent is one the simulator cannot express, while an illegal one
 * is not really the character's at all. Showing them in the same list would
 * tell someone their build is missing features when it is actually invalid.
 */
export interface IllegalTalent {
  readonly talentId: string;
  readonly name: string;
  readonly rank: number;
  readonly reason: string;
}
