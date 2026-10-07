import type { AttackTableKind, DamageSchool } from '../../engine';
import type { PrimaryStatName, StatModifierOperation, StatName } from '../../engine';
import type { ResourceType, WeaponType } from '../../engine';
import type { CombatStyleId } from '../character/ids';

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
      /**
       * What the character must BE for this stat to apply at all.
       *
       * Heart of the Wild is "+10% Intellect, and while in Bear Form your
       * Stamina is increased by 20%, and while in Cat Form your Strength is
       * increased by 10%" -- one talent, three stats, and two of them gated on
       * the form. Without a requirement here the clauses could only be listed
       * as `unmodelled`, which is what they were.
       */
      readonly requires?: BuildRequirement;
    }

  /**
   * A stat worth a PERCENTAGE OF THE CHARACTER'S LEVEL.
   *
   * ----------------------------------------------------------------------
   * NOT `statFromStat`, WHICH READS A PRIMARY AND RE-DERIVES. Level is not a
   * stat, cannot be buffed and never moves during a fight, so this resolves
   * to a flat number once at build time -- and resolving it once is CORRECT
   * here for the same reason it is wrong there. Routing it through the
   * derivation would add a term that can never change.
   *
   * Predatory Strikes is the only caller: "increases your melee Attack Power
   * in Cat Form, Bear Form, and Dire Bear Form by 150% of your level", which
   * is 90 attack power at 60. Its `requires` is what carries the form clause.
   *
   * The value is a PERCENTAGE, so 150 means one and a half times the level.
   * ----------------------------------------------------------------------
   */
  | {
      readonly kind: 'statFromLevel';
      readonly to: StatName;
      readonly valueIndex?: number;
      readonly requires?: BuildRequirement;
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

  /**
   * Reduces an ability's resource cost by the talent's value.
   *
   * `valueIndex` because ONE TALENT CAN CUT TWO ABILITIES BY DIFFERENT
   * AMOUNTS. Shredding Attacks is "reduces the Energy cost of your Shred
   * ability by 18 and reduces the Rage cost of your Lacerate ability by 3",
   * and its Lacerate clause was carried as `unmodelled` for exactly this --
   * the effect could reach the second ability and not the second NUMBER, so a
   * second entry would have taken 18 rage off a 15-rage ability.
   */
  | { readonly kind: 'abilityCost'; readonly abilityId: string; readonly valueIndex?: number }
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
   *
   * `valueIndex` FOR A TALENT THAT VARIES SEVERAL NUMBERS, the same field
   * `abilityDamage` has carried since Improved Corruption. Improved Fire Nova is
   * "+20% damage AND -4 sec cooldown", one row with two numbers, and taking the
   * first for the cooldown would remove TWENTY seconds from a ten-second
   * cooldown -- which does not error, does not read as wrong, and makes the
   * ability free to cast.
   */
  | {
      readonly kind: 'abilityCooldown';
      readonly abilityId: string;
      readonly unit: 'seconds' | 'minutes';
      /**
       * Which of the talent's numbers is the cooldown.
       *
       * Sacred Duty is why: its row is "+4% Stamina and 60 sec off Divine Shield,
       * Divine Protection and Templar's Bulwark", so index 0 is a percentage of
       * stamina and taking it would shorten a five minute cooldown by four
       * SECONDS -- a plausible-looking number and the wrong one.
       */
      readonly valueIndex?: number;
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
  | {
      readonly kind: 'grantAura';
      readonly auraId: string;
      /**
       * What the character must BE for the aura to be granted at all.
       *
       * Leader of the Pack is "while in Cat Form, Bear Form, or Dire Bear
       * Form" and Moonkin Form is the Moonkin's own, so both are form-gated.
       * Without this a Moonkin who spent a point in the feral capstone would
       * carry the feral aura as well, which is the one combination the
       * exclusivity ruling forbids.
       */
      readonly requires?: BuildRequirement;
    }
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
  /*
   * `valueIndex` ADDED BY THE ROGUE DIVE, and it fixes a real misreading.
   * Puncturing Wounds is "+15% Backstab crit and +30% Mutilate crit" -- two
   * numbers for two abilities in one talent -- and without an index both
   * entries read value 0, so Mutilate silently got Backstab's 15%. A smaller
   * number and no error.
   */
  | { readonly kind: 'abilityCrit'; readonly abilityId: string; readonly valueIndex?: number }

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
   * The same, for a NAMED LIST OF ABILITIES rather than for everything.
   *
   * ----------------------------------------------------------------------
   * THE FOURTH SCOPE, AND THE ONE THE OTHER THREE COULD NOT REACH.
   * `critDamageBonus` is whole-character, `schoolCritDamage` is per school and
   * `attackTableCritDamage` is per table; `abilityCrit` names one ability and
   * sets crit CHANCE. A tooltip that lists six or seven spells by name matched
   * none of them.
   *
   * IT WAS A MISSING DECLARATION AND NOT A MISSING RULE.
   * `AbilityModifiers.critMultiplierBonus` has existed since Impale, and no
   * talent effect reached it -- so two talents in two classes said so in almost
   * identical words and both were counted as live gaps:
   *
   *   Warlock  Pandemic, "the critical strike damage bonus of your Corruption,
   *            Bane of Agony, Bane of Doom, Drain Soul, Drain Life, Siphon Life
   *            and Wrack spells", +100% at 3/3. SM/DS spends three points on it
   *            and 48% of its damage is those effects.
   *   Rogue    Lethality, the same sentence over Sinister Strike, Gouge,
   *            Backstab, Mutilate, Ghostly Strike and Hemorrhage, +20% at 5/5.
   *            All three Rogue profiles take it.
   *
   * AN ABILITY ID MAY BE AN AURA'S, which is what makes Pandemic expressible at
   * all: a periodic tick carries its AURA's id, and `rollPeriodicCrit` applies
   * the same modifier a cast gets. That is the route Malediction and Improved
   * Rend already take for periodic DAMAGE.
   *
   * `table` NAMES WHICH CRIT MULTIPLIER THE BONUS IS A FRACTION OF, and it has
   * to be declared rather than derived. A spell crit multiplies by 1.5 and a
   * melee one by 2, so the bonus half is 0.5 or 1.0 -- "+100%" takes a spell
   * crit to 2.0x and a melee crit to 3.0x. `AbilityModifiers` is keyed by
   * ability and nothing in it knows which table an ability rolls on, which is
   * exactly why `schoolCritDamage` and `attackTableCritDamage` can derive the
   * half and this cannot.
   * ----------------------------------------------------------------------
   */
  | {
      readonly kind: 'abilityCritDamage';
      readonly abilityIds: readonly string[];
      /** Which table's crit multiplier the bonus is a fraction of. */
      readonly table: AttackTableKind;
      readonly valueIndex?: number;
    }

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
  /**
   * ...AND `schoolHit`, which joined the three above last and closed the largest
   * shared gap in the census.
   *
   * ----------------------------------------------------------------------------
   * FIVE TALENTS ACROSS THREE CLASSES were inert on one sentence: that the attack
   * table decides hit before any per-school modifier is consulted. It does not.
   * `rollTable` folds the ability's modifier, the SCHOOL'S and the table's into
   * one and hands the result to the roll -- so the school was in hand the whole
   * time and what was missing was a field on `AbilityModifier`.
   *
   * Arcane Focus and Elemental Precision (Mage), Shadow Focus and Holy Precision
   * (Priest), Divine Precision (Paladin). Every one of them reads "improves your
   * chance to hit with <school> spells".
   * ----------------------------------------------------------------------------
   */
  | {
      readonly kind: 'schoolDamage' | 'schoolCrit' | 'schoolCritDamage' | 'schoolHit';
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
   * Multiplies PERIODIC damage only -- every tick and nothing else.
   *
   * ----------------------------------------------------------------------
   * A FOURTH AXIS, AND IT CROSSES ALL THREE OF THE OTHERS. Genesis is
   * "increases the periodic damage and healing done by your spells AND
   * abilities", which is every school, every table and every ability at once
   * -- so it is not `schoolDamage`, not `attackTableDamage` and not a list of
   * ids. What separates it is the one thing none of those can see: whether
   * the damage is a TICK.
   *
   * `DamageRequest.periodic` has carried that distinction since the first DoT
   * -- it is how telemetry tells a bleed from a strike -- so this is a new
   * READER of an existing fact rather than a new fact. The alternative taken
   * before it was `unmodelled`, on the honest grounds that `abilityDamage` is
   * per ability and `damageMultiplier` is everything.
   *
   * THE HEALING HALF IS OUT OF SCOPE like every healing clause, and the
   * talent says so alongside rather than pretending the multiplier covers it.
   * ----------------------------------------------------------------------
   */
  | { readonly kind: 'periodicDamage'; readonly valueIndex?: number }

  /**
   * Damage scoped to an attack TABLE, but only while the target is BLEEDING.
   *
   * ----------------------------------------------------------------------
   * TWO CONDITIONS AT ONCE, and neither existing declaration carries both.
   * Rend and Tear is "increases damage done by your melee ABILITIES on
   * BLEEDING targets" -- the first half is `attackTableDamage` with
   * `melee-special`, and the second half is a property of somebody else,
   * read fresh on every hit.
   *
   * IT ASKS THE AURAS, NOT A LIST OF IDS. `AuraDefinition.isBleed` is a
   * ruleset tag the engine attaches no behaviour to, so a new bleed is
   * covered on the day it lands -- the same argument `comboPointsAwarded`
   * makes for Berserk's generators. A hand-kept list of three ids is how a
   * fourth goes missing, and a missed one looks exactly like an ability that
   * happened not to crit.
   *
   * `critWhileAura` IS THE CASTER-SIDE TWIN and deliberately not reused:
   * that one names an aura on the character CARRYING the talent, and this
   * one is about the victim.
   * ----------------------------------------------------------------------
   */
  | {
      readonly kind: 'bleedingTargetDamage';
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
       * The proc needs NO rank value, so the value lookup is skipped for it.
       *
       * ----------------------------------------------------------------------
       * A SINGLE-RANK TALENT HAS NOTHING TO LOOK UP. `values/<class>.json` is
       * generated by matching `{0}` placeholders against each rank's text, and a
       * talent with one rank has no variable to identify -- so its entry is
       * `null` and `talentBuild` DROPS every effect that asks for a number.
       *
       * Holy Shield is why this exists, and it failed exactly the way this
       * project's worst bugs fail: the talent granted its ability, reported
       * itself fully modelled, and its 221-Holy-damage-per-block reaction was
       * never registered at all. The census reads the effect TABLE, so it said
       * the talent was complete; the profile simply had one damage source fewer
       * than its own audit claimed.
       *
       * DECLARED RATHER THAN INFERRED. Passing 0 to any builder whose value
       * happened to be missing would hide a real data gap behind a working-
       * looking proc -- a builder handed a silent 0 is the Redoubt mistake with
       * the numbers swapped. Saying so on the effect means the author has
       * asserted that the magnitude lives somewhere else: on the ability, on the
       * aura, or in a named constant.
       * ----------------------------------------------------------------------
       */
      readonly valueless?: true;

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
      /**
       * The proc needs NO rank value, so the value lookup is skipped for it.
       *
       * ----------------------------------------------------------------------
       * A SINGLE-RANK TALENT HAS NOTHING TO LOOK UP. `values/<class>.json` is
       * generated by matching `{0}` placeholders against each rank's text, and a
       * talent with one rank has no variable to identify -- so its entry is
       * `null` and `talentBuild` DROPS every effect that asks for a number.
       *
       * Holy Shield is why this exists, and it failed exactly the way this
       * project's worst bugs fail: the talent granted its ability, reported
       * itself fully modelled, and its 221-Holy-damage-per-block reaction was
       * never registered at all. The census reads the effect TABLE, so it said
       * the talent was complete; the profile simply had one damage source fewer
       * than its own audit claimed.
       *
       * DECLARED RATHER THAN INFERRED. Passing 0 to any builder whose value
       * happened to be missing would hide a real data gap behind a working-
       * looking proc -- a builder handed a silent 0 is the Redoubt mistake with
       * the numbers swapped. Saying so on the effect means the author has
       * asserted that the magnitude lives somewhere else: on the ability, on the
       * aura, or in a named constant.
       * ----------------------------------------------------------------------
       */
      readonly valueless?: true;
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
      /**
       * Which of the talent's numbers is the damage percentage.
       *
       * ------------------------------------------------------------------
       * NATURALIST IS WHY, AND IT WAS WRONG BY A FACTOR OF TEN. "Reduces the
       * cast time of your Healing Touch spell by 0.5 sec and increases all
       * damage you deal by 5%" is one row of two numbers, `[0.5, 5]`, and
       * without this field the effect read index 0 -- so a rank-5 Moonkin
       * carried x1.005 instead of x1.05, and the figure it was reading was a
       * number of SECONDS.
       *
       * The same trap `abilityDamage.valueIndex` already documents on
       * Improved Corruption, on an effect kind that never got the field. It
       * was invisible because half a percent is a plausible multiplier: every
       * profile ran, nothing errored, and the talent reported itself modelled.
       * ------------------------------------------------------------------
       */
      readonly valueIndex?: number;
    }

  /**
   * Adds crit chance to every ability, but only with the right weapon.
   *
   * Weaponmaster's axe and polearm clause, whose row is `[crit, armor
   * ignored, extra attack chance]` -- so index 0 is the one it wants, and it
   * says so rather than relying on the default.
   */
  | {
      readonly kind: 'conditionalCrit';
      readonly requires: BuildRequirement;
      readonly valueIndex?: number;
    }

  /**
   * Adds crit chance to an ability, but only while a named aura is on the
   * character. The talent's value is the chance in percentage POINTS.
   *
   * ----------------------------------------------------------------------------
   * `conditionalCrit` ABOVE IS THE BUILD-TIME TWIN, gated on the weapon in hand,
   * which cannot change during a fight and so is settled when the character is
   * built. This one is gated on something that comes and goes, and the condition
   * is therefore read on every cast.
   *
   * SHATTER IS WHY IT EXISTS. "Increases the critical strike chance of all your
   * spells against Frozen targets" was unmodelled on the grounds that nothing
   * freezes a raid boss -- a claim about the TARGET, and it stopped being the
   * whole story when Fingers of Frost landed, because that treats the caster's
   * next spells as though the target were frozen. The Frostfire build takes
   * BOTH, so the window is real and reachable.
   *
   * IT NAMES THE AURA AND NOT THE TALENT. Shatter does not need to know
   * Fingers of Frost's rank, which is what keeps the two talents independent --
   * the alternative was writing Shatter's number onto the aura that Fingers of
   * Frost builds, which is only correct while the two are visited in the right
   * order during the build.
   * ----------------------------------------------------------------------------
   */
  | {
      readonly kind: 'critWhileAura';
      readonly auraId: string;
      /** `ALL_ABILITIES` for a talent that names no single ability. */
      readonly abilityId: string;
    }

  /**
   * Crit chance or damage for ONE ability, but only in the fight's final
   * fraction -- which is how this project reads "against targets at or below
   * N% health".
   *
   * ----------------------------------------------------------------------------
   * THE THIRD CONDITION SHAPE, after `conditionalCrit` (the weapon in hand,
   * settled when the character is built) and `critWhileAura` (an aura, read on
   * every cast). This one is read on every cast too, and what it reads is the
   * CLOCK.
   *
   * WHY A CLOCK AND NOT A HEALTH BAR. The target here is a damage sink running
   * for a fixed duration, so a health gate could never fire against it -- a
   * hundred thousand health taking fifteen thousand damage never reaches 20%.
   * The ruleset owner ruled the threshold to be TIME, for Execute, and the
   * ruling is deliberately shared. `game/combat/executePhase.ts` is where it is
   * written down, and it has now been got wrong three times by somebody
   * recording such a talent as "the target never drops".
   *
   * IT TAKES THE FRACTION FROM THE TALENT'S OWN NUMBERS, which is why there are
   * two indices rather than one. Both callers state the threshold and the
   * bonus in the same row:
   *
   *   Early Demise (Priest)  [[20, 15], [20, 30]]   fraction 0, value 1
   *   Quietus      (Rogue)   [[2, 35], [4, 35], ..] value 0,    fraction 1
   *
   * Hardcoding 0.2 and 0.35 here would work today and would stop being true the
   * first time Forever moved one, silently -- the same class of expiry an
   * `unmodelled` reason has.
   * ----------------------------------------------------------------------------
   */
  | {
      readonly kind: 'abilityCritInFinalFraction' | 'abilityDamageInFinalFraction';
      readonly abilityId: string;
      /**
       * Which of the talent's numbers is the stated health PERCENTAGE, read as
       * the fraction of the fight. 20 becomes 0.2.
       */
      readonly fractionIndex: number;
      /** Which is the bonus itself. Percentage points of crit, or of damage. */
      readonly valueIndex: number;
    }

  /**
   * The talent's effect cannot be modelled, and this says why.
   *
   * NOT a gap in this list waiting to be filled in — a first-class outcome, and
   * the most important variant here. Items already work this way: each carries
   * the source's exact wording plus one line on why it does nothing. That is
   * what kept Crusader granting nothing until its real proc rate arrived,
   * rather than quietly inheriting a plausible one.
   *
   * NOTHING PRINTS THESE IN THE APP ANY MORE. The Talent panel's two lists and
   * the Gear panel's "Equipped but not simulated" were removed in the GUI pass,
   * on the owner's instruction that the reporting is for this repository rather
   * than for someone running a sim. KEEP WRITING THEM: `class_audit.ts` derives
   * the entire census from this field and throws if its four buckets do not
   * account for every talent.
   *
   * A talent listed here is RECORDED as inert. A talent given a guessed effect
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
      /**
       * Names the module that DOES apply this effect, for a talent whose work is
       * done somewhere the effect table cannot express.
       *
       * --------------------------------------------------------------------------
       * ADDED BY THE ROGUE DIVE, and it fixes a real miscount. Vile Poisons and
       * Improved Poisons are both applied -- by the poison reactions, reading the
       * rank directly -- so neither has a non-unmodelled entry here, and every
       * census in the project counted both as LIVE GAPS. Two of the Rogue's
       * fourteen were talents that already worked.
       *
       * PROSE COULD NOT FIX IT. Their reasons said "APPLIES in full" in capitals
       * and `class_audit.ts` counts effects, not adjectives. So it is DATA, exactly
       * as `scope` is: a talent carrying this counts PARTLY modelled.
       *
       * IT NAMES A FILE ON PURPOSE, which is what keeps it honest -- a claim naming
       * a module can be checked and "it works somewhere" cannot.
       * --------------------------------------------------------------------------
       */
      readonly appliedElsewhere?: string;
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
  | 'healing'
  /**
   * STEALTH AND OPENERS. The owner's ruling, and the newest member.
   *
   * ------------------------------------------------------------------------
   * IT WAS THE LARGEST OPEN QUESTION IN THE PROJECT RATHER THAN A GAP. Every
   * fight here opens in combat, so nothing is ever stealthed — and until the
   * owner ruled, that was an ENCOUNTER property and not one of the rulings,
   * which left six Rogue talents counted as remaining work that nothing was
   * ever going to reach. The census read 20 live gaps for the Rogue and the
   * honest figure was 14.
   *
   * WHAT IT COVERS: being stealthed, detecting stealth, and the openers that
   * require it — Ambush, Garrote, Cheap Shot, and the talents keyed to them.
   *
   * WHAT IT DOES NOT COVER: an in-combat proc that REMOVES a stealth
   * requirement. Cutthroat is exactly that and is modelled; Premeditation's
   * Forever tooltip has no stealth clause at all. Both were once counted among
   * the stealth casualties and neither belongs there — which is why this scope
   * is about the REQUIREMENT and not about the word appearing in a tooltip.
   * ------------------------------------------------------------------------
   */
  | 'stealth'
  /**
   * CAST PUSHBACK. The owner's ruling, 2026-09-30.
   *
   * ------------------------------------------------------------------------
   * "Reduces the pushback suffered from damaging attacks while casting." Seven
   * talents across five classes say a version of it, and every one is blocked
   * TWICE: the engine resolves a cast time once, before `onCast` runs, and
   * nothing can lengthen it afterwards -- and no caster profile in this project
   * is attacked, so there would be nothing to suffer pushback from even if it
   * could.
   *
   * BLOCKED TWICE IS WHY IT IS A RULING RATHER THAN A GAP. Clearing either half
   * alone leaves every one of them inert, so neither "build pushback" nor "make
   * the target swing back" expires it -- which is exactly the shape the stealth
   * ruling had, and stealth was the largest open question in the project until
   * it was asked.
   *
   * WHAT IT COVERS: avoiding, resisting or reducing interruption and delay of a
   * cast or channel from damage taken. It does NOT cover an interrupt the target
   * suffers (Earth Shock's school lockout), which is about the ENEMY casting and
   * is inert for a different reason.
   * ------------------------------------------------------------------------
   */
  | 'castPushback'
  /**
   * A TOTEM AS AN ENTITY. The owner's ruling, 2026-09-30, and it closes the last
   * open scope question in the project.
   *
   * ------------------------------------------------------------------------
   * Four Shaman talents scale a totem that BUFFS or HEALS on its own -- Earth's
   * Grasp, Guardian Totems, Restorative Totems, Mana Tide Totem. They need a
   * totem to exist as something that acts, and `Simulation` exposes
   * `combatants` read-only, so the engine cannot add one mid-fight.
   *
   * THE SEARING TOTEM PRECEDENT DOES NOT REACH THEM, and that is the whole
   * reason this needed a ruling of its own. A totem that deals DAMAGE can be
   * modelled as a debuff that ticks -- the owner ruled exactly that for Searing
   * Totem, and against one stationary enemy it deals identical damage. A totem
   * that reduces damage taken, restores mana to the group or shortens another
   * totem's cooldown has no such reading: there is nothing to attach it to.
   *
   * IT IS NOT THE MID-FIGHT-SUMMONING GAP. That one stays open, for the
   * Warlock's Infernal and the Mage's elemental, and nothing in any profile
   * needs it. This ruling is narrower: a TOTEM is out of scope as an entity, so
   * four talents stop being counted and the engine gap stops being quoted as
   * though it were what blocks them.
   * ------------------------------------------------------------------------
   */
  | 'totemEntities';

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
  /**
   * Which COMBAT STYLES the effect applies in. Any one of them satisfies it.
   *
   * --------------------------------------------------------------------------
   * A DRUID'S FORM IS ITS COMBAT STYLE, and a style is a field the preset sets
   * and the character is built with -- exactly as fixed at build time as the
   * weapon in its hand. So "in Cat Form, Bear Form, and Dire Bear Form" is the
   * same KIND of condition the three clauses above are, and it belongs here
   * rather than needing anything read during the fight.
   *
   * THAT IS NOT THE SAME AS MODELLING SHAPESHIFTING, and the difference is
   * worth stating because four Druid talents sit on the other side of it.
   * Predatory Strikes and Heart of the Wild ask WHICH FORM IS HELD, which is
   * knowable; Furor and Natural Shapeshifter pay out ON THE SHIFT, which needs
   * a form to be something a fight can change. The first pair are expressible
   * today and the second pair are not.
   *
   * `styles` names forms and every other style alike, because the selector is
   * the same field -- a talent reading "while dual-wielding" would use it too.
   * --------------------------------------------------------------------------
   */
  readonly styles?: readonly CombatStyleId[];
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
  /**
   * Set when the effect IS applied, just not by an entry in this table.
   *
   * Carried through from the effect for the same reason `scope` is: a caller has
   * to tell "nothing does this" from "something else does this" without parsing
   * prose. `class_audit.ts` counts a talent carrying it as PARTLY modelled.
   */
  readonly appliedElsewhere?: string;
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
