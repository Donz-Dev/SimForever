import type { Combatant, WeaponSlot } from '../actors/Combatant';
import type { TargetSelection } from '../combat/targeting';
import type { AttackTableKind } from '../combat/attackTable';
import type { ResourceType } from '../resources';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { Milliseconds } from '../time';

/** The default global cooldown before haste. */
export const DEFAULT_GCD_MS = 1500;

/** The floor a hasted global cooldown cannot go below. */
export const MINIMUM_GCD_MS = 750;

/** What an ability costs to use. */
export interface AbilityCost {
  readonly resource: ResourceType;
  readonly amount: number;
}

/** Everything an ability needs in order to decide and to act. */
export interface AbilityContext {
  readonly simulation: SimulationContext;
  readonly caster: Combatant;
  readonly target: Combatant | undefined;
  /** The ability being cast, so `onCast` can read its own declared values. */
  readonly ability: Ability;
}

/**
 * A spell or ability.
 *
 * The engine owns the parts that are the same for every ability in the game:
 * cooldowns, charges, the global cooldown, cast time, resource costs, and
 * target validity. An ability definition only supplies what is unique to it,
 * in `onCast`.
 *
 * That split is what keeps a spell from turning into a copy-pasted block of
 * cooldown bookkeeping. Definitions are content and live under `src/game`.
 */
export interface Ability {
  readonly id: string;
  readonly name: string;

  /** Time to cast. 0 (the default) means instant. */
  readonly castTimeMs?: Milliseconds;
  /** Time before it can be used again. 0 (the default) means no cooldown. */
  readonly cooldownMs?: Milliseconds;
  /** Number of independent charges. Defaults to 1. */
  readonly charges?: number;
  /** Whether using it starts the global cooldown. Defaults to true. */
  readonly triggersGcd?: boolean;
  /** Override the global cooldown length. Defaults to DEFAULT_GCD_MS. */
  readonly gcdMs?: Milliseconds;
  /** Whether haste shortens the cast time and GCD. Defaults to true. */
  readonly affectedByHaste?: boolean;
  readonly cost?: AbilityCost;
  /** Whether a living hostile target is required. Defaults to true. */
  readonly requiresTarget?: boolean;

  /**
   * Which combat table this ability resolves against.
   *
   * Mortal Strike and Rend are `melee-special`; Multi-Shot is
   * `ranged-special`; Fireball and Shadow Word: Pain are `spell`. Even an
   * ability that deals no direct damage declares one, because its table decides
   * whether it lands at all.
   *
   * Read inside `onCast` through `context.ability`, so the table is declared
   * once rather than repeated in every damage call.
   */
  readonly attackTable?: AttackTableKind;

  /**
   * How many enemies this ability strikes.
   *
   * Omitted means one, which is what nearly everything does. Declaring it is
   * how an ability states that it hits more WITHOUT that claim depending on an
   * encounter that can supply more -- see `engine/combat/targeting.ts`, which
   * resolves every selection to the single target an encounter actually has.
   *
   * So this is documentation that the engine will honour later, rather than
   * behaviour today. It is on the ability rather than in `onCast` so that the
   * combat log and any analyzer can ask without running the cast.
   */
  readonly targets?: TargetSelection;

  /**
   * Queue this ability onto the next auto-attack with the given weapon instead
   * of firing it immediately.
   *
   * The "on next swing" abilities: Heroic Strike and Cleave. Casting one pays
   * its cost and arms it; the next swing of that weapon runs its `onCast` in
   * place of the normal auto-attack, and the swing timer is unaffected.
   *
   * Only one can be armed at a time. Arming a second replaces the first, and
   * the replaced ability's cost is NOT refunded — a detail no source states
   * either way, so it is the simple reading rather than a researched one.
   */
  readonly onNextSwing?: WeaponSlot;

  /**
   * Named numbers a talent or effect has added to THIS ability, read by its own
   * `onCast`.
   *
   * The declared fields above cover what every ability has -- cost, cooldown,
   * cast time. They cannot cover "the rage Charge generates", because that is a
   * number inside one ability's body and means nothing to any other. Rather
   * than give every such number a field, an ability that has one names it here
   * and reads `context.ability.bonuses?.<key>`.
   *
   * Abilities are shared constants, so a bonus arrives on a COPY built for the
   * character that earned it.
   */
  readonly bonuses?: Readonly<Record<string, number>>;

  /**
   * What starting a cast does to an auto attack already in progress.
   *
   * RULESET: casting anything with a cast time interrupts the swing in
   * progress, and the swing timer RESETS -- the swing that was coming is lost.
   * That is the default, and it is why a cast ability is a real cost to a melee
   * character rather than free damage between swings.
   *
   * `hold` is the exception some effects grant: the swing timer keeps running
   * behind the cast, and a swing that comes due DURING it is held until the
   * cast finishes. Both then resolve and the timer restarts. The Warrior's
   * Improved Slam is exactly this -- "Slam no longer interrupts your melee
   * swing time" -- and it is worth far more than the quarter second of cast
   * time the same talent removes.
   *
   * Ignored by an instant ability, which never interrupts anything.
   */
  readonly swingTimer?: 'reset' | 'hold';

  /**
   * Extra conditions beyond cooldown, cost and target, which the engine
   * already checks. Use for things like "only below 20% health".
   */
  readonly canCast?: (context: AbilityContext) => boolean;

  /**
   * What the ability actually does: deal damage, apply an aura, generate a
   * resource. Runs when the cast completes, which is immediately for an
   * instant ability.
   */
  readonly onCast: (context: AbilityContext) => void;
}
