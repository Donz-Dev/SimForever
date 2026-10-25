import type { Ability, Combatant, SimulationContext, Subroutine } from '../../engine';
import { applyHaste, castAbility, hasteMultiplierFrom, startAutoAttackMode } from '../../engine';

/**
 * THE HUNTER'S MELEE WEAVE (round 65), the owner's packaged sub-routine.
 *
 * ============================================================================
 * "A 'Melee Weave' happens upon completion of a ranged attack (a ranged
 * auto-attack has happened in the last 0.5 seconds or less). The character
 * then cancels Ranged Auto-Attack, and initiates Melee Auto-Attack. Then the
 * user moves in to melee range ... Then once the user is in melee range a set
 * number of actions HAVE to occur ... Then the user moves back to Range (10
 * yards). This takes the full movement time AGAIN and then Ranged Auto-attack
 * is re-initiated taking the full ranged attack time interval PLUS a flat 0.5
 * seconds to trigger the first Ranged Auto-attack."
 *
 * ONE LIST ENTRY RUNS THE WHOLE THING. Its melee actions -- Raptor Strike,
 * Mongoose Bite and Strider Kick unless the entry says otherwise -- are ALSO
 * its gate, by the owner's ruling: "a melee weave occurs when Mongoose Bite is
 * usable, Strider Kick is usable, Raptor Strike is usable". Then:
 *
 *   1. RUN IN: `melee_weave` is a cast that lasts the run. Ranged auto-attack
 *      stops and melee starts as it begins, and a melee swing that comes due
 *      during the run waits for its end -- so the first swing lands no sooner
 *      than the run and no later than a melee swing interval, which is the
 *      owner's minimum and maximum.
 *   2. IN MELEE: a sub-routine owns the character's decisions and casts the
 *      actions in order, waiting on a global cooldown or a resource and skipping
 *      one that has stopped being castable. An on-next-swing action is done
 *      when its swing LANDS, so Raptor Strike keeps the character in melee
 *      until the melee swing delivers it.
 *   3. RUN OUT: `return_to_range` is a second cast that lasts the run. Melee
 *      stops as it begins; as it ends ranged starts, its first shot a full
 *      ranged swing plus half a second later.
 *
 * THE RUN IS A KNOWN TIME, not a position -- the simulator has none: 7 yards
 * at 7 yards a second is one second, and Minor Speed on the boots makes it
 * 1 / 1.08 of that. Neither run is hasted.
 * ============================================================================
 */

export const MELEE_WEAVE_ID = 'melee_weave';
export const RETURN_TO_RANGE_ID = 'return_to_range';

/** The owner's three, the entry's default. */
export const DEFAULT_MELEE_WEAVE_ACTIONS: readonly string[] = ['raptor_strike', 'mongoose_bite', 'strider_kick'];

/** 10 yards to 3, at 7 yards a second. */
export const MELEE_WEAVE_YARDS = 7;
export const RUN_SPEED_YARDS_PER_SECOND = 7;
/** Minor Speed on the boots: "Run speed increased slightly", which the owner states as 8%. */
export const MINOR_SPEED_RUN_MULTIPLIER = 1.08;
/** The flat half second before the first ranged shot after the run out. */
export const RANGED_RESTART_DELAY_MS = 500;
/** How recently a ranged shot must have landed for a weave to begin. */
export const MELEE_WEAVE_SHOT_WINDOW_MS = 500;
/**
 * A SAFETY LIMIT, not ruleset data: if the actions still are not done this
 * long after arriving -- a melee swing that never comes -- the character goes
 * back to range rather than standing in melee for the rest of the fight.
 */
export const MELEE_WEAVE_STALL_MS = 10_000;

/** The run, one way, in milliseconds. */
export function meleeWeaveRunMs(minorSpeed: boolean): number {
  const speed = RUN_SPEED_YARDS_PER_SECOND * (minorSpeed ? MINOR_SPEED_RUN_MULTIPLIER : 1);
  return Math.round((MELEE_WEAVE_YARDS / speed) * 1000);
}

/*
 * WHICH ACTIONS A WEAVE RUNS, set by the entry that chose it. The list lives on
 * the APL entry and the ability cannot see the entry, so the entry's gate
 * records it here as it passes, per character -- the cast that follows reads it.
 */
const pendingActions = new WeakMap<Combatant, readonly string[]>();

/**
 * THE GATE: the bow just fired, and every action the weave would run can be
 * cast -- ignoring the global cooldown and a cast in progress, which pass.
 */
export function meleeWeaveReady(
  context: SimulationContext,
  actor: Combatant,
  actions: readonly string[],
): boolean {
  if (actor.activeAutoAttack !== 'ranged' || actor.subroutine) return false;
  if (!actor.swungWithin('ranged', context.clock.now(), MELEE_WEAVE_SHOT_WINDOW_MS)) return false;
  const target = context.defaultTargetFor(actor);
  const known = actions.filter((id) => actor.abilities.get(id) !== undefined);
  if (known.length === 0) return false;
  const ready = known.every(
    (id) =>
      context.castRejection(actor, actor.abilities.get(id)!, target, {
        ignoreGcd: true,
        ignoreCastLock: true,
      }) === undefined,
  );
  if (ready) pendingActions.set(actor, known);
  return ready;
}

/** The melee hand mode a character can swing: both hands if it holds two. */
function meleeMode(caster: Combatant): 'main-hand' | 'dual-wield' {
  return caster.weapons.offHand ? 'dual-wield' : 'main-hand';
}

export function meleeWeaveAbility(runMs: number): Ability {
  return {
    id: MELEE_WEAVE_ID,
    name: 'Melee Weave',
    castTimeMs: runMs,
    affectedByHaste: false,
    // The melee timer runs during the run, and a swing due inside it waits.
    swingTimer: 'hold',
    triggersGcd: false,
    ignoresGcd: true,
    firesCastReactions: false,
    canCast: ({ caster }) =>
      caster.activeAutoAttack === 'ranged' && caster.subroutine === null && caster.weapons.mainHand !== undefined,
    onCastStart: ({ simulation, caster }) => {
      startAutoAttackMode(simulation, caster, meleeMode(caster), {
        notBeforeMs: simulation.clock.now() + runMs,
      });
    },
    onCast: ({ simulation, caster }) => {
      const routine = new MeleeWeaveRoutine(
        pendingActions.get(caster) ?? DEFAULT_MELEE_WEAVE_ACTIONS,
        simulation.clock.now(),
      );
      caster.subroutine = routine;
      routine.armOnArrival(simulation, caster);
    },
  };
}

export function returnToRangeAbility(runMs: number): Ability {
  return {
    id: RETURN_TO_RANGE_ID,
    name: 'Return to Range',
    castTimeMs: runMs,
    affectedByHaste: false,
    swingTimer: 'continue',
    triggersGcd: false,
    ignoresGcd: true,
    requiresTarget: false,
    firesCastReactions: false,
    canCast: ({ caster }) => caster.activeAutoAttack !== 'ranged' && caster.weapons.ranged !== undefined,
    onCastStart: ({ simulation, caster }) => {
      startAutoAttackMode(simulation, caster, 'none');
    },
    onCast: ({ simulation, caster }) => {
      const bow = caster.weapons.ranged;
      if (!bow) return;
      const full = applyHaste(bow.swingTimerMs, hasteMultiplierFrom(caster.stats.effective));
      startAutoAttackMode(simulation, caster, 'ranged', {
        firstSwingAtMs: simulation.clock.now() + full + RANGED_RESTART_DELAY_MS,
      });
    },
  };
}

/** The weave once the character is in melee. See the file comment. */
export class MeleeWeaveRoutine implements Subroutine {
  readonly name = 'Melee Weave';
  private index = 0;
  private issuedAt: number | undefined;
  private returning = false;

  constructor(
    private readonly actions: readonly string[],
    private readonly arrivedAt: number,
  ) {}

  /*
   * AN ON-NEXT-SWING ACTION IS QUEUED THE MOMENT THE RUN ENDS, before the
   * melee swing that was waiting for the arrival lands -- so Raptor Strike
   * rides that first swing, which is the owner's "minimum amount of time to
   * melee attack is equal to movement time". Queued by the next decision, it
   * missed that swing and waited a whole melee interval for the one after.
   */
  armOnArrival(context: SimulationContext, actor: Combatant): void {
    const target = context.defaultTargetFor(actor);
    for (const id of this.actions) {
      const ability = actor.abilities.get(id);
      if (!ability?.onNextSwing) continue;
      if (context.castRejection(actor, ability, target) === undefined) {
        castAbility(context, actor, ability, target);
      }
    }
  }

  next(context: SimulationContext, actor: Combatant) {
    if (this.returning) return actor.isCasting(context.clock.now()) ? ('wait' as const) : ('done' as const);
    const target = context.defaultTargetFor(actor);
    const stalled = context.clock.now() - this.arrivedAt > MELEE_WEAVE_STALL_MS;

    while (!stalled && this.index < this.actions.length) {
      const ability = actor.abilities.get(this.actions[this.index]);
      if (!ability) {
        this.index += 1;
        continue;
      }
      // The last call cast it: armed for a swing, or a new cast recorded.
      if (this.issuedAt !== undefined) {
        const armed = ability.onNextSwing !== undefined && actor.queuedSwing(ability.onNextSwing) === ability.id;
        if (armed || actor.castSequence > this.issuedAt) {
          this.issuedAt = undefined;
          this.index += 1;
          continue;
        }
        this.issuedAt = undefined;
      }
      const rejection = context.castRejection(actor, ability, target);
      if (rejection === undefined) {
        this.issuedAt = actor.castSequence;
        return { ability, target };
      }
      if (rejection === 'on_gcd' || rejection === 'not_enough_resource' || rejection === 'already_casting') {
        return 'wait' as const;
      }
      // No longer castable -- a window that closed. It cannot happen now.
      this.index += 1;
    }

    // An on-next-swing action is done when its swing has landed.
    const stillArmed = this.actions.some((id) => {
      const ability = actor.abilities.get(id);
      return ability?.onNextSwing !== undefined && actor.queuedSwing(ability.onNextSwing) === id;
    });
    if (stillArmed && !stalled) return 'wait' as const;

    const back = actor.abilities.get(RETURN_TO_RANGE_ID);
    if (!back) return 'done' as const;
    this.returning = true;
    return { ability: back, target: undefined };
  }
}
