import type { Ability, Combatant, SimulationContext, Subroutine } from '../../engine';
import { castAbility, startAutoAttackMode } from '../../engine';

/**
 * THE HUNTER'S MELEE WEAVE (round 65, revised in round 68), the owner's
 * packaged sub-routine.
 *
 * ============================================================================
 * THE PROCESS, in the owner's round 68 words: "End of a Ranged Attack -> Move
 * in Event (~1 second) -> Use any 1 of the following GCD abilities (Immolation
 * Trap, Strider Kick, Mongoose Bite) + Raptor Strike if ready -> Move out
 * Event (~1 second) -> Ranged Restart (0.5 sec before Ranged Auto-Attack
 * Resolves)".
 *
 * ONE LIST ENTRY RUNS THE WHOLE THING:
 *
 *   0. THE GATE: the bow fired in the last half second, and ANY ONE of the
 *      entry's options can be cast -- "not every melee event needs to be ready
 *      to go in a melee weave. You just need one of the listed abilities".
 *      Round 65 asked for all of them, which is what the owner revised.
 *   1. RUN IN: `melee_weave` is a cast that lasts the run. Ranged auto-attack
 *      stops and melee starts as it begins.
 *   2. IN MELEE: a sub-routine owns the character's decisions. Raptor Strike
 *      is queued the moment the run ends if it is ready, so it rides the
 *      arrival swing; the FIRST castable option is cast; and the character
 *      stays until both are done.
 *   3. RUN OUT: `return_to_range` lasts the run too. Melee stops as it begins;
 *      as it ends ranged starts again.
 *
 * BOTH SWING TIMERS COOL DOWN WHILE THE OTHER RUNS, the owner's: each kind's
 * next swing is due a full (hasted) swing after ITS OWN last one, whatever the
 * other kind did meanwhile. So the melee swing lands on arrival once the melee
 * timer has run out at range, and the bow fires half a second after the run
 * back -- "0.5 sec before Ranged Auto-Attack Resolves" -- or when its own timer
 * runs out, if that is later. `startAutoAttackMode` keeps that rule for both.
 * (Round 65 restarted the bow from zero: a full swing plus half a second.)
 *
 * THE RUN IS A KNOWN TIME, not a position -- the simulator has none: 7 yards
 * at 7 yards a second is one second, and Minor Speed on the boots makes it
 * 1 / 1.08 of that. Neither run is hasted.
 * ============================================================================
 */

export const MELEE_WEAVE_ID = 'melee_weave';
export const RETURN_TO_RANGE_ID = 'return_to_range';

/**
 * The owner's three global-cooldown options, the entry's default: a weave
 * casts the first that is ready.
 */
export const DEFAULT_MELEE_WEAVE_ACTIONS: readonly string[] = ['immolation_trap', 'strider_kick', 'mongoose_bite'];

/** Raptor Strike rides the arrival swing "if ready", whatever the options. */
export const MELEE_WEAVE_RAPTOR_STRIKE = 'raptor_strike';

/** 10 yards to 3, at 7 yards a second. */
export const MELEE_WEAVE_YARDS = 7;
export const RUN_SPEED_YARDS_PER_SECOND = 7;
/** Minor Speed on the boots: "Run speed increased slightly", which the owner states as 8%. */
export const MINOR_SPEED_RUN_MULTIPLIER = 1.08;
/** The half second between the run back and the first ranged shot, at the soonest. */
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
 * THE GATE: the bow just fired, and any one of the weave's options can be cast
 * -- ignoring the global cooldown and a cast in progress, which pass.
 */
export function meleeWeaveReady(
  context: SimulationContext,
  actor: Combatant,
  actions: readonly string[],
): boolean {
  if (actor.activeAutoAttack !== 'ranged' || actor.subroutine) return false;
  if (!actor.swungWithin('ranged', context.clock.now(), MELEE_WEAVE_SHOT_WINDOW_MS)) return false;
  const target = context.defaultTargetFor(actor);
  // Raptor Strike is never one of the options: it comes "if ready" anyway.
  const known = actions.filter(
    (id) => id !== MELEE_WEAVE_RAPTOR_STRIKE && actor.abilities.get(id) !== undefined,
  );
  if (known.length === 0) return false;
  const ready = known.some(
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
    // The bow's own timer has been cooling down all along; the restart adds
    // half a second at most.
    onCast: ({ simulation, caster }) => {
      startAutoAttackMode(simulation, caster, 'ranged', {
        notBeforeMs: simulation.clock.now() + RANGED_RESTART_DELAY_MS,
      });
    },
  };
}

/** The weave once the character is in melee. See the file comment. */
export class MeleeWeaveRoutine implements Subroutine {
  readonly name = 'Melee Weave';
  /** Whether the one option is settled: cast, or none could be. */
  private optionSettled = false;
  private issuedAt: number | undefined;
  private returning = false;

  constructor(
    private readonly options: readonly string[],
    private readonly arrivedAt: number,
  ) {}

  /*
   * RAPTOR STRIKE IS QUEUED THE MOMENT THE RUN ENDS, before the melee swing
   * that was waiting for the arrival lands -- so it rides that first swing,
   * the owner's "minimum amount of time to melee attack is equal to movement
   * time". Queued by the next decision, it missed that swing and waited a whole
   * melee interval for the one after.
   */
  armOnArrival(context: SimulationContext, actor: Combatant): void {
    this.armRaptorStrike(context, actor);
  }

  private armRaptorStrike(context: SimulationContext, actor: Combatant): void {
    const raptor = actor.abilities.get(MELEE_WEAVE_RAPTOR_STRIKE);
    if (!raptor?.onNextSwing || actor.queuedSwing(raptor.onNextSwing) === raptor.id) return;
    const target = context.defaultTargetFor(actor);
    if (context.castRejection(actor, raptor, target) === undefined) castAbility(context, actor, raptor, target);
  }

  private raptorArmed(actor: Combatant): boolean {
    const raptor = actor.abilities.get(MELEE_WEAVE_RAPTOR_STRIKE);
    return raptor?.onNextSwing !== undefined && actor.queuedSwing(raptor.onNextSwing) === raptor.id;
  }

  next(context: SimulationContext, actor: Combatant) {
    if (this.returning) return actor.isCasting(context.clock.now()) ? ('wait' as const) : ('done' as const);
    const target = context.defaultTargetFor(actor);
    const stalled = context.clock.now() - this.arrivedAt > MELEE_WEAVE_STALL_MS;

    // The last call cast an option if a new cast was recorded since.
    if (!this.optionSettled && this.issuedAt !== undefined) {
      if (actor.castSequence > this.issuedAt) this.optionSettled = true;
      this.issuedAt = undefined;
    }

    // ONE OPTION: the first that is castable, waiting out a GCD or a resource.
    if (!this.optionSettled && !stalled) {
      let wait = false;
      for (const id of this.options) {
        if (id === MELEE_WEAVE_RAPTOR_STRIKE) continue;
        const ability = actor.abilities.get(id);
        if (!ability) continue;
        const rejection = context.castRejection(actor, ability, target);
        if (rejection === undefined) {
          this.issuedAt = actor.castSequence;
          return { ability, target };
        }
        if (rejection === 'on_gcd' || rejection === 'already_casting' || rejection === 'not_enough_resource') {
          wait = true;
        }
      }
      if (wait) return 'wait' as const;
      // None can be cast now -- a window that closed. The weave goes on without one.
      this.optionSettled = true;
    }

    // "+ Raptor Strike if ready": queued if it came ready since, and delivered
    // before the character leaves.
    if (!stalled) {
      this.armRaptorStrike(context, actor);
      if (this.raptorArmed(actor)) return 'wait' as const;
    }

    const back = actor.abilities.get(RETURN_TO_RANGE_ID);
    if (!back) return 'done' as const;
    this.returning = true;
    return { ability: back, target: undefined };
  }
}
