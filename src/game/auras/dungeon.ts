import type { AuraDefinition, Milliseconds, SimulationContext } from '../../engine';
import { seconds } from '../../engine';
import { DRINK_MANA_PER_SECOND, RAGE_DECAY_PER_SECOND } from '../encounters/dungeonRoute';

/**
 * WHAT A DUNGEON ROUTE'S GAPS DO TO THE CHARACTER, as auras on the player for
 * the length of the gap -- so the Timeline draws them and the uptime table
 * says how long the route spent drinking.
 *
 * Everything else about being out of combat needs no aura: cooldowns, mana,
 * energy and focus regeneration, and auras running out all carry on by
 * themselves. These two are the ruleset's additions on top.
 */

const TICK_MS = seconds(1);

function holder(context: SimulationContext, id: string) {
  return context.combatants.find((actor) => actor.id === id);
}

/**
 * "1 Rage decays per second when out of combat" -- the owner's rate --
 * starting after `delayMs` (Lingering Rage) and at `rate` of it (Anger
 * Management's "reduces Rage loss while out of combat by 30%").
 */
export function outOfCombatAura(durationMs: Milliseconds, rate: number, delayMs: Milliseconds): AuraDefinition {
  return {
    id: 'out_of_combat',
    name: 'Out of Combat',
    durationMs,
    periodic: {
      intervalMs: TICK_MS,
      firstTickDelay: () => delayMs + TICK_MS,
      onTick: (context, aura) => {
        const actor = holder(context, aura.targetId);
        const rage = actor?.resources.get('rage');
        if (!actor || !rage || rage.current <= 0) return;
        context.spendResource(actor, 'rage', Math.min(rage.current, RAGE_DECAY_PER_SECOND * rate), {
          id: 'out_of_combat_decay',
          name: 'Out-of-combat decay',
        });
      },
    },
  };
}

/** The owner's "Drink for mana": 165 mana a second for the gap. */
export function drinkingAura(durationMs: Milliseconds): AuraDefinition {
  return {
    id: 'drinking',
    name: 'Drink',
    durationMs,
    periodic: {
      intervalMs: TICK_MS,
      onTick: (context, aura) => {
        const actor = holder(context, aura.targetId);
        if (!actor?.resources.get('mana')) return;
        context.grantResource(actor, 'mana', DRINK_MANA_PER_SECOND, { id: 'drinking', name: 'Drink' });
      },
    },
  };
}
