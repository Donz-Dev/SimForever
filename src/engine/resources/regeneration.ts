import type { Combatant } from '../actors/Combatant';
import { EventPriority, createEvent } from '../events';
import type { SimulationContext } from '../simulation/SimulationContext';
import type { Milliseconds } from '../time';
import type { ResourceType } from './Resource';

/**
 * A resource that refills on a timer.
 *
 * `amountPerTick` is a function rather than a number because how much arrives
 * can depend on state that changes during the fight: a caster's mana
 * regeneration stops while it is spending, and scales with a stat that a buff
 * can move. Evaluating it per tick means neither needs special handling.
 *
 * Returning 0 is normal and cheap. The tick still happens, so regeneration
 * resumes on its own the moment the condition clears; it does not need to be
 * restarted.
 */
export interface ResourceRegen {
  readonly resource: ResourceType;
  readonly intervalMs: Milliseconds;
  /**
   * What one tick grants, evaluated now.
   *
   * ==========================================================================
   * `at` IS THE MOMENT THE TICK BELONGS TO, AND IT IS NEGATIVE BEFORE THE PULL.
   *
   * Every live tick is evaluated at `context.clock.now()` and passes nothing,
   * which is why this is optional and why every existing rule is unchanged.
   * **`runPrecombat` is the one caller that needs it**: the owner has ruled
   * that regeneration is credited across a pre-combat lead, and the clock
   * cannot go there -- `SimulationClock` only moves forward, which is the
   * reason the whole pre-combat feature resolves at timestamp zero.
   *
   * SO THE TIME IS PASSED RATHER THAN THE CLOCK MOVED, and only a rule that
   * reads a clock has to care. Mana does, for the five second rule; energy and
   * focus are flat per tick and ignore it, which is not the "general field read
   * by only some of its rules" failure this project keeps meeting -- those two
   * do not depend on WHEN they are asked, so there is nothing for them to get
   * wrong.
   * ==========================================================================
   */
  readonly amountPerTick: (
    actor: Combatant,
    context: SimulationContext,
    at?: Milliseconds,
  ) => number;
}

/**
 * Start every regeneration timer a combatant has.
 *
 * Each resource ticks on its own independent schedule, exactly like swing
 * timers: a rogue's energy and a druid's mana do not share a clock.
 *
 * The first tick lands one full interval into the fight, not at time zero.
 * Resources that start full would otherwise waste their opening tick, and one
 * that starts empty should not be handed free resource before any time passes.
 */
export function startResourceRegeneration(
  context: SimulationContext,
  actor: Combatant,
): void {
  for (const regen of actor.regeneration) {
    scheduleTick(context, actor, regen);
  }
}

function scheduleTick(
  context: SimulationContext,
  actor: Combatant,
  regen: ResourceRegen,
): void {
  if (regen.intervalMs <= 0) return;

  context.events.schedule(
    context.clock.now() + regen.intervalMs,
    createEvent(
      `regen:${actor.id}:${regen.resource}`,
      EventPriority.Regeneration,
      (ctx) => {
        if (ctx.hasEnded) return;

        // A dead combatant stops regenerating, and stops rescheduling, so the
        // queue does not carry timers for corpses.
        if (!actor.isAlive) return;

        const amount = regen.amountPerTick(actor, ctx);
        if (amount > 0) {
          ctx.grantResource(actor, regen.resource, amount, {
            id: 'regeneration',
            name: 'Regeneration',
          });
        }

        scheduleTick(ctx, actor, regen);
      },
    ),
  );
}
