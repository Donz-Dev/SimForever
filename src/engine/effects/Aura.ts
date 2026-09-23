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
  /** Multiplies healing the carrier does. */
  readonly healingDoneMultiplier?: number;
  readonly periodic?: PeriodicEffect;
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
