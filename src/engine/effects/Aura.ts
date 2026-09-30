import type { AbilityModifier } from '../combat/abilityModifiers';
import type { AttackTableKind } from '../combat/attackTable';
import type { Combatant } from '../actors/Combatant';
import type { DamageSchool } from '../combat/DamageSchool';
import type { Milliseconds } from '../time';
import type { StatModifierSpec } from '../stats';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { ScheduledEvent } from '../events';

/**
 * What happens when an aura is applied to a target that already has it.
 *
 * - `reset`  restart the full duration (the WoW default)
 * - `extend` add the duration to whatever remains, up to a cap
 * - `ignore` leave the existing timer alone
 */
export type AuraRefreshBehaviour = 'reset' | 'extend' | 'ignore';

/** The periodic half of an aura: DoT ticks, HoT ticks, resource ticks. */
export interface PeriodicEffect {
  readonly intervalMs: Milliseconds;
  /** Runs on every tick, including one at the moment the aura expires. */
  onTick(context: SimulationContext, aura: AuraInstance): void;
  /**
   * When the FIRST tick lands, if not one whole interval from now.
   *
   * Takes the context so it can roll, which is the reason it exists: a
   * passive that ticks on its own timer did not start that timer when the
   * pull did. Anger Management generates a rage every three seconds whether
   * or not anyone is fighting, so a character entering combat is somewhere
   * random inside the current three seconds -- and every fight in a batch
   * starting its first tick at exactly 3000ms is a fiction that would show
   * up as an artificially tight distribution.
   *
   * Only the first tick. The rest chain at the plain interval.
   */
  firstTickDelay?(context: SimulationContext): Milliseconds;
}

/**
 * How an aura changes the NEXT cast of an ability it names.
 *
 * ------------------------------------------------------------------------------
 * THE SHAPE FOUR CLASSES ASKED FOR, and the reason none of the existing
 * declarations fitted.
 *
 *   `abilityCastTime`    a STANDING talent reduction, resolved once when the
 *                        character is built. Improved Starfire's half second
 *                        is always there; Eclipse's is there twice and then
 *                        gone.
 *   an ordinary aura     reaches every ability or none. Nothing on
 *                        `AuraDefinition` selects one.
 *   content, in `onCast` too late. Cast time is resolved by the engine BEFORE
 *                        `onCast` runs, which is exactly why Stormstrike's
 *                        +20% could be done in content and this cannot.
 *
 * WHO WANTS IT: Eclipse on the Druid, Maelstrom Weapon on the Shaman -- the
 * Enhancement capstone -- and, when those classes arrive, Presence of Mind,
 * Hot Streak and Arcane Concentration on the Mage and Inner Focus on the
 * Priest. Nature's Swiftness wants it too and wants to select by SCHOOL, which
 * is deliberately not here yet: see the note on `abilityIds`.
 * ------------------------------------------------------------------------------
 */
export interface CastModifier {
  /**
   * The abilities this changes. An ability not named here is untouched, and an
   * empty list matches nothing.
   *
   * BY ID, AND ONLY BY ID FOR NOW. Nature's Swiftness and Presence of Mind
   * select by school ("your next Nature spell") and by class, which would mean
   * a `school` on every `Ability` -- a field that is silent when forgotten,
   * which is the failure mode this project keeps meeting. It is worth adding
   * when a whole class can be filled in at once rather than one talent at a
   * time; until then those two stay `unmodelled` and say so.
   */
  readonly abilityIds: readonly string[];
  /** Milliseconds taken off the cast, before haste. */
  readonly castTimeReductionMs?: Milliseconds;
  /**
   * Fraction of the cast removed: 0.2 is a fifth faster, 1 is instant.
   *
   * Applied to the BASE cast time rather than the hasted one, so haste and
   * this compose the same way round however they are ordered.
   */
  readonly castTimeFraction?: number;
  /** Fraction of the resource cost removed. 1 makes the cast free. */
  readonly costFraction?: number;
  /**
   * Multiply both fractions and the flat reduction by the current stacks.
   *
   * Maelstrom Weapon is 20% a stack to five; Eclipse is a flat half second a
   * charge and takes one charge per Starfire rather than scaling, so it leaves
   * this off.
   */
  readonly scalesWithStacks?: boolean;
  /**
   * What a cast spends, and the two answers are genuinely different effects.
   *
   * ----------------------------------------------------------------------
   *   `stack`  one charge, dropping the aura at zero. Eclipse: "your next 2
   *            Starfire spells", which is two casts each getting the full
   *            half second.
   *   `all`    the whole aura, however many stacks it held. Maelstrom
   *            Weapon: "your NEXT Lightning Bolt", which is ONE cast that
   *            every stack paid for together.
   *
   * Spending a stack where the effect spends all of them leaves four stacks
   * behind for the next cast, which reads as a working talent and is worth
   * several times what it should be. That is the whole reason this is not a
   * boolean.
   *
   * The sibling of `consumedBySwing` and `consumedByBlock`, for the same
   * reason all three exist: a charge limit is not a duration, and an aura
   * that expires on time alone cannot express one.
   *
   * SPENT AT CAST START, on the cast that benefits. `durationMs` still
   * applies as a backstop for a caster who casts something else instead.
   * ----------------------------------------------------------------------
   */
  readonly consumedByCast?: 'stack' | 'all';
  /**
   * Only match an ability that HAS a cast time.
   *
   * "Your next Nature spell with a casting time less than 10 sec." An instant
   * must not eat a charge meant for a cast, which would otherwise happen the
   * moment a priority list reached Moonfire.
   */
  readonly requiresCastTime?: boolean;
}

/**
 * The static description of a buff or debuff. One definition, many instances:
 * this object is shared by every character carrying the effect, so it holds no
 * per-target state.
 *
 * Definitions are game content and live under `src/game`, never in the engine.
 */
export interface AuraDefinition {
  readonly id: string;
  readonly name: string;
  /** Lifetime in milliseconds. 0 means it lasts until explicitly removed. */
  readonly durationMs: Milliseconds;
  /** Defaults to 1. */
  readonly maxStacks?: number;
  /** Debuffs are shown and analysed separately from buffs. */
  readonly isDebuff?: boolean;
  /** Stat changes applied while active and removed on expiry. */
  readonly statModifiers?: readonly StatModifierSpec[];
  /** When true, stat modifiers are multiplied by the current stack count. */
  readonly modifiersScaleWithStacks?: boolean;
  /** Multiplies damage the carrier deals. 1.1 is +10%. */
  readonly damageDoneMultiplier?: number;
  /**
   * Multiplies damage the carrier deals OF PARTICULAR SCHOOLS.
   *
   * ----------------------------------------------------------------------------
   * THE ATTACKER'S MIRROR OF `damageTakenBySchool`, and the two sit beside each
   * other for the reason Fire Power and Curse of the Elements do: one raises the
   * fire damage a caster DEALS and the other the fire damage a target TAKES.
   * They are different effects and both apply.
   *
   * WHY IT IS ON THE AURA RATHER THAN ON `SchoolModifiers`. That collection is
   * built once, when the character is, so it can hold a talent's standing
   * "+10% Fire" and cannot hold an effect that comes and goes. Two Warlock
   * effects do exactly that and both were applied WHOLE-CHARACTER with a
   * written caveat admitting it -- `game/auras/warrior.ts` predicted this field
   * by name for Death Wish's "Physical" qualifier, which for a Warrior costs
   * nothing because every point of its damage is physical.
   *
   * THE CAVEAT WAS NOT A ROUNDING ERROR FOR A HYBRID. Demonic Sacrifice names
   * ONE school out of four demons; Shadow and Flame's two halves name OPPOSITE
   * schools on purpose, so Firelock carried x1.10 on every school twice where
   * it should carry x1.10 once per school.
   *
   * Schools not listed are untouched, exactly as on the target side.
   * ----------------------------------------------------------------------------
   */
  readonly damageDoneBySchool?: Partial<Record<DamageSchool, number>>;
  /** Multiplies damage the carrier takes, whatever school it is. */
  readonly damageTakenMultiplier?: number;
  /**
   * Multiplies damage the carrier takes FROM PARTICULAR SCHOOLS.
   *
   * Separate from `damageTakenMultiplier` because the two answer different
   * questions and a debuff often names only some schools: Curse of the
   * Elements raises every magic school by 8% and leaves physical alone, which
   * one number cannot express.
   *
   * Schools not listed are unaffected. Both multipliers apply when both are
   * present, which is correct -- "takes 20% more damage" and "takes 8% more
   * fire damage" are different effects on the same target.
   */
  readonly damageTakenBySchool?: Partial<Record<DamageSchool, number>>;
  /**
   * The same again, but reaching PERIODIC damage only.
   *
   * ----------------------------------------------------------------------------
   * "INCREASING THE DAMAGE THEY TAKE FROM YOUR OTHER SHADOW DAMAGE OVER TIME
   * EFFECTS BY 10%" -- Wrack, and that clause is the whole reason to cast it.
   *
   * A SEPARATE FIELD AND NOT A FLAG ON THE ONE ABOVE, because an aura may want
   * both and a flag would force a choice. It is not folded into
   * `damageTakenBySchool` for the reason the clause went unmodelled for as long
   * as it did: a plain Shadow vulnerability would also raise Shadow Bolt, which
   * is over half of the SM/DS profile's damage. That is a much bigger number
   * wearing the right label rather than an approximation.
   *
   * "OVER TIME" IS `DamageRequest.periodic`, which every damage-over-time tick
   * here sets and no cast does -- INCLUDING A CHANNEL'S TICKS, which are casts.
   * So Wrack's own ticks are correctly not amplified by Wrack's own debuff,
   * which is what the word "other" asks for and what nothing else would give.
   * ----------------------------------------------------------------------------
   */
  readonly periodicDamageTakenBySchool?: Partial<Record<DamageSchool, number>>;
  /**
   * Per-ability modifiers that hold only while this aura is up, keyed by
   * ability id.
   *
   * ----------------------------------------------------------------------------
   * `AbilityModifiers` ON THE COMBATANT IS BUILT ONCE AND SAYS SO: "an effect
   * that comes and goes during combat belongs in an aura, which has the
   * lifecycle for it." This is that field, and it carries the same shape --
   * crit chance in percentage POINTS, a crit multiplier bonus on the bonus
   * half, and a damage multiplier.
   *
   * COMBINED WITH THE STATIC ONE RATHER THAN REPLACING IT, by the same rule
   * two static modifiers follow: chances add and damage multiplies. A talent
   * granting +5% crit to Shred and an aura granting +100 are two effects on
   * one cast and both apply.
   *
   * Read at the two points `abilityModifiers` already is, so an ability
   * respects it without knowing it exists -- which is the guard the three
   * modifier scopes were built around.
   * ----------------------------------------------------------------------------
   */
  readonly abilityModifiers?: Readonly<Record<string, AbilityModifier>>;
  /**
   * SPELL POWER THAT WHOEVER ATTACKS THIS COMBATANT READS, per school.
   *
   * ----------------------------------------------------------------------------
   * THE OTHER SIDE OF `SchoolModifier.spellPower`, AND THE DIFFERENCE IS WHOSE
   * GEAR IT IS. That one is "+161 to damage done by YOUR Holy spells" and lives
   * on the attacker; this is "Holy damage TAKEN increased by up to 161" and lives
   * on the target, so every attacker reads it and none of them owns it.
   *
   * `damageTakenBySchool` IS NOT IT, which is the mistake this field exists to
   * stop being made again. That one MULTIPLIES, and the Paladin's Judgement of
   * the Crusader was left inert for a year with a comment saying a flat
   * per-school bonus had no declaration -- reading its 161 as a multiplier would
   * have been absurd, so nothing was applied at all.
   *
   * "UP TO" IS THE WORD THAT DECIDES THE ARITHMETIC, on the ruleset owner's
   * ruling. It is spell POWER, not flat damage: each ability scales it by its own
   * coefficient, so a seal at 20% gains a fifth of it and Consecration gains 9.5%
   * of it a tick. A flat 161 added to every Holy hit would roughly treble a
   * seal, and "increasing Holy damage taken by 161" is how the source would have
   * had to word that.
   *
   * ADDED, NEVER MULTIPLIED, across auras -- two debuffs granting Holy power are
   * one pool, the same rule `SchoolModifier.spellPower` combines by.
   * ----------------------------------------------------------------------------
   */
  readonly spellPowerTakenBySchool?: Partial<Record<DamageSchool, number>>;
  /**
   * Multiplies the damage this combatant DEALS through one attack table.
   *
   * ----------------------------------------------------------------------------
   * THE AURA-SHAPED SIBLING OF `AttackTableModifiers`, which is built once when
   * the character is and cannot come and go. Seal of the Crusader is the first
   * caller: it "attacks 40% faster, but deals less damage with each attack", and
   * the penalty has to arrive and leave with the seal.
   *
   * WHY NOT `damageDoneMultiplier`, which an aura already carries. That one is
   * whole-character, and would take the penalty to Judgement, Holy Shock and
   * Consecration as well -- none of which the haste it compensates for
   * accelerates. Keying it on the table lets the seal reduce exactly what it sped
   * up, which is the reading that leaves the clause doing its stated work.
   * ----------------------------------------------------------------------------
   */
  readonly damageDoneByTable?: Partial<Record<AttackTableKind, number>>;

  /**
   * Per-ability modifiers that apply to attacks made AGAINST the carrier.
   *
   * ----------------------------------------------------------------------------
   * THE MIRROR OF `abilityModifiers`, on the other side of the attack, and it
   * sits beside it for the same reason `damageTakenBySchool` sits beside
   * `damageDoneBySchool`: "your Ice Lance crits more" and "Ice Lance crits this
   * target more" are different effects and a debuff says the second.
   *
   * WINTER'S CHILL IS WHY. "Increases the chance your Ice Lance and Frostbolt
   * spells will critically hit the target by 2%, stacking up to 5 times" is a
   * crit bonus for two NAMED abilities carried by the TARGET, and neither
   * existing field could say it: `abilityCrit` is registered on the caster, and
   * an ordinary aura's `damageTakenBySchool` reaches a whole school with no way
   * to name an ability. It was the Mage's last talent with no declaration at
   * all.
   *
   * `critWhileAura` IS THE CASTER-SIDE ANSWER TO THE SAME SHAPE, built for
   * Shatter one PR earlier: a crit bonus that only counts inside a window. The
   * difference is whose window it is, and that is exactly the difference a
   * reader gets wrong -- Shatter reads a buff on the Mage, this reads a debuff
   * on the boss.
   *
   * READ AT THE TWO POINTS THE ATTACKER'S OWN MODIFIERS ARE, through
   * `Combatant.abilityModifierAgainst`, so an ability respects it without
   * knowing it exists. Reading it in only one of the two is how an effect
   * becomes quietly half of itself.
   *
   * `modifiersScaleWithStacks` REACHES IT, the way it reaches everything else.
   */
  readonly attackerAbilityModifiers?: Readonly<Record<string, AbilityModifier>>;
  /**
   * Ability ids whose COOLDOWN does not apply while this aura is up.
   *
   * ----------------------------------------------------------------------------
   * "Removes its cooldown", which Berserk says of Primal Bite and which
   * nothing else in the engine could express: `CastModifier` carries cast time
   * and cost, and an ability's cooldown lives in the `AbilityBook` where no
   * aura reaches.
   *
   * IT SUPPRESSES THE CHECK, IT DOES NOT CLEAR THE TIMER. The cooldown keeps
   * running underneath, so when the aura drops the ability is on whatever
   * remains of the cooldown from its last use -- which is what "removes its
   * cooldown FOR THE DURATION" means. Clearing it instead would hand back a
   * free cast at the moment the buff ended.
   * ----------------------------------------------------------------------------
   */
  readonly suppressesCooldownOf?: readonly string[];
  /**
   * A FRACTION off the carrier's global cooldown while this aura is up.
   *
   * ----------------------------------------------------------------------------
   * `0.1` is "reducing your global cooldown by 10%", which is Nature's Grace
   * and which nothing else could say: `baseGcdMs` is a property of the CLASS
   * carried on the combatant, and no aura reached it.
   *
   * SEPARATE FROM HASTE ON PURPOSE. Haste shortens a CAST and deliberately
   * does not touch the global cooldown in this engine -- a rule with its own
   * long comment in `casting.ts`. Nature's Grace grants both in one sentence
   * and they are two different effects, so folding the second into a haste
   * rating would make every other haste source shorten the global cooldown
   * too, which is a much bigger change wearing this talent's name.
   *
   * Floored by `MINIMUM_GCD_MS` at the point of use, which is the floor that
   * already existed for the talent path.
   * ----------------------------------------------------------------------------
   */
  readonly gcdFraction?: number;
  /**
   * An ABSORB SHIELD: how much damage this aura soaks before health is touched.
   *
   * ----------------------------------------------------------------------------
   * A FUNCTION OF THE TARGET, EVALUATED ONCE WHEN THE AURA IS APPLIED, because
   * every absorb in this ruleset is a share of something -- Templar's Bulwark
   * is "100% of your maximum health". Evaluating it per hit would let the
   * shield grow with a buff that landed after it, which is the same failure
   * pattern as a maximum health computed from live stats instead of a snapshot.
   *
   * The remaining pool lives on the INSTANCE, not here: two characters can
   * carry the same shield with different amounts left.
   *
   * `DamageResolution.absorbed` has existed and been hard-coded to zero since
   * the pipeline was written, with a comment saying the field was there so
   * adding absorbs later would not change its shape. This is that.
   * ----------------------------------------------------------------------------
   */
  readonly absorb?: (target: Combatant) => number;
  /** Multiplies healing the carrier does. */
  readonly healingDoneMultiplier?: number;
  readonly periodic?: PeriodicEffect;
  /**
   * The ruleset counts this aura as a BLEED.
   *
   * ----------------------------------------------------------------------------
   * A TAG, NOT A MECHANIC. The engine attaches no behaviour to it at all: a
   * bleed already says what it DOES through `periodic`, `appliesArmor: false`
   * and its school. What this adds is the ability for something else to SELECT
   * on it, which is what "on Bleeding targets" wants and what nothing could ask.
   *
   * WHY IT IS A FLAG ON THE AURA AND NOT A LIST SOMEWHERE ELSE. The alternative
   * is a talent naming Rip, Rake and Lacerate by id, and this codebase has
   * written down twice what happens then: a fourth bleed is added, nobody
   * remembers the list, and the talent goes quietly weaker with nothing to
   * notice. Declared here, a new bleed is covered on the day it lands.
   *
   * IT IS NOT DERIVED FROM "physical, periodic and ignoring armor", which is a
   * true description of every bleed here, because the school and the armor rule
   * are decided inside `onTick` and are not visible on the definition. A
   * derivation that has to run the effect to answer is not a derivation.
   * ----------------------------------------------------------------------------
   */
  readonly isBleed?: boolean;
  /** Defaults to `reset`. */
  readonly refreshBehaviour?: AuraRefreshBehaviour;
  /**
   * Each auto-attack swing by the carrier consumes one stack, and the aura
   * falls off when the last one goes.
   *
   * WoW has a whole family of "for your next N swings" effects — Flurry,
   * Heroic Strike's queue, Sweeping Strikes — and an aura that expires on TIME
   * cannot express any of them. The charge is spent at the START of a swing, so
   * the swing that benefits is the swing that pays: an effect applied by a crit
   * mid-swing is not eaten by the swing that applied it.
   *
   * `durationMs` still applies as a backstop for a carrier who stops swinging.
   */
  readonly consumedBySwing?: boolean;
  /**
   * Each attack the carrier BLOCKS consumes one stack.
   *
   * The mirror of `consumedBySwing`, and needed for the same reason: "will
   * only block 2 attacks" is a charge limit, not a duration, and an aura that
   * expires on time alone cannot express it. Shield Block grants a large
   * block chance for seven seconds OR two blocks, whichever ends first.
   *
   * Keyed on the BLOCK rather than on being attacked, because that is what
   * the effect says. A swing that misses the carrier costs it nothing.
   *
   * `durationMs` still applies as a backstop for a carrier nothing hits.
   */
  readonly consumedByBlock?: boolean;
  /**
   * Stacks the aura begins with, when that is not one.
   *
   * A charge effect starts FULL -- Shield Block is two blocks from the moment
   * it is cast, not one that builds. Without this the only way to reach two
   * was to cast it twice, which is neither what the tooltip says nor possible
   * inside its own cooldown.
   */
  readonly chargesOnApply?: number;
  /**
   * Lost when the carrier dies, rather than surviving the revive.
   *
   * ----------------------------------------------------------------------------
   * A REVIVE KEEPS AURAS BY DEFAULT, and that default is right for most of
   * them: `revivesOnDeath` exists so a fight can be measured through a death,
   * not so a death becomes a rebuffing exercise, and dropping everything would
   * switch off the assumed healer at the moment it is needed most.
   *
   * It is wrong for a SURVIVAL COOLDOWN. Last Stand and Shield Wall are spent
   * to prevent the death that just happened; carrying them through it would
   * mean a warrior gets the benefit of a cooldown that visibly failed, and
   * Last Stand in particular would carry its borrowed maximum health into a
   * pool that was just refilled.
   *
   * The flag is on the aura and not on the character, because which effects
   * survive dying is a property of the effect.
   * ----------------------------------------------------------------------------
   */
  readonly removedOnDeath?: boolean;
  /**
   * Changes the next cast of the abilities it names. See `CastModifier`.
   *
   * Read by `castAbility` and by `checkCast`, which BOTH have to see the same
   * numbers: a rotation that checked the full mana cost would refuse a spell
   * the character can actually afford, and would do it silently.
   */
  readonly castModifier?: CastModifier;
  readonly onApply?: (context: SimulationContext, aura: AuraInstance) => void;
  readonly onExpire?: (context: SimulationContext, aura: AuraInstance) => void;
}

/**
 * One live copy of an aura on one target.
 *
 * Holds the mutable state a definition cannot: when it was applied, how many
 * stacks it has, and the queue handles for its pending expiry and next tick.
 * Those handles are how an aura removed early cleans up after itself instead of
 * leaving a ghost tick in the queue.
 */
export class AuraInstance {
  stacks: number;
  appliedAt: Milliseconds;
  expiresAt: Milliseconds;

  /**
   * Damage this aura will still soak, for an absorb shield.
   *
   * Set from `definition.absorb` when the aura is applied and drawn down by
   * the damage pipeline. Zero for every aura that is not a shield, so the
   * common case costs one number comparison.
   */
  absorbRemaining = 0;

  /** Queue handle for the expiry event, so early removal can cancel it. */
  expirationHandle: ScheduledEvent | null = null;
  /** Queue handle for the next periodic tick. */
  tickHandle: ScheduledEvent | null = null;

  constructor(
    readonly definition: AuraDefinition,
    /** Id of the combatant that applied it. */
    readonly sourceId: string,
    /** Id of the combatant carrying it. */
    readonly targetId: string,
    appliedAt: Milliseconds,
    stacks: number = 1,
  ) {
    this.stacks = stacks;
    this.appliedAt = appliedAt;
    this.expiresAt = definition.durationMs > 0 ? appliedAt + definition.durationMs : Infinity;
  }

  get id(): string {
    return this.definition.id;
  }

  get name(): string {
    return this.definition.name;
  }

  get isDebuff(): boolean {
    return this.definition.isDebuff ?? false;
  }

  get maxStacks(): number {
    return this.definition.maxStacks ?? 1;
  }

  get isPermanent(): boolean {
    return this.expiresAt === Infinity;
  }

  /**
   * A key unique to this aura on this target, used as the `sourceId` of the
   * stat modifiers it owns so they can all be removed together.
   */
  get modifierSourceId(): string {
    return `aura:${this.targetId}:${this.definition.id}`;
  }

  remainingMs(now: Milliseconds): Milliseconds {
    return this.isPermanent ? Infinity : Math.max(0, this.expiresAt - now);
  }
}
