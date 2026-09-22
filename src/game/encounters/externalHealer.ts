import type { AuraDefinition } from '../../engine';
import { applyHealing, seconds } from '../../engine';

/**
 * A healer keeping the character up, assumed by the encounter and not modelled
 * as a combatant.
 *
 * ----------------------------------------------------------------------------
 * THE RULE, from the ruleset owner:
 *
 *   While the target attacks back, the character is healed for a random amount
 *   between 500 and 1500 every second. Healing raises current hit points, to a
 *   maximum of maximum hit points.
 *
 * WHY AN ASSUMED HEALER AND NOT A REAL ONE
 *
 * A raid healer is another character with a spell book, a mana pool and a
 * rotation, and none of that exists. What this needs from a healer is only its
 * output, so the output is what it models: a flat random amount on a timer,
 * with no caster behind it.
 *
 * It is therefore NOT a second combatant. Adding one would put a third actor
 * in every breakdown, give the target something else to swing at, and change
 * what "everyone on this side is dead" means -- all so that a number could be
 * produced that this produces directly.
 *
 * WHAT IT REPLACED
 *
 * An outright immunity. The character used to carry `survivesLethalDamage`,
 * which stopped health at one and made death impossible, and the Encounter
 * panel said so. That let the fight run its length but meant nothing about
 * being hurt could be measured -- a tank at 1 health and a tank at full looked
 * identical, and "how close was that" had no answer. A healer who can be
 * out-damaged has one.
 *
 * NONE OF THESE ARE FOREVER NUMBERS. Nothing in the source states a healer's
 * output. They are the ruleset owner's figures for how this encounter is set
 * up, in the same category as fight length, and they are why a run with the
 * target attacking is a statement about this configuration rather than about
 * the character.
 * ----------------------------------------------------------------------------
 */
export const EXTERNAL_HEAL_MINIMUM = 500;
export const EXTERNAL_HEAL_MAXIMUM = 1500;
export const EXTERNAL_HEAL_INTERVAL_MS = seconds(1);

/**
 * The healer, as a permanent aura on the character being healed.
 *
 * An aura because the engine already has exactly one way to make something
 * happen on a repeating timer, and a second one would be a second set of bugs.
 * It is applied as an opening aura when the encounter says the target attacks
 * back, and never otherwise: a character nothing is hitting has nothing to
 * heal, and a stream of pure overhealing in the log would be noise.
 *
 * `external` on the request is what keeps the heal at the size it says it is.
 * The character is named as the source because telemetry needs one, and
 * without that flag being named the source would also mean being the one whose
 * healing done and versatility scaled it.
 */
export const EXTERNAL_HEALER: AuraDefinition = {
  id: 'external_healer',
  name: 'Healer',
  durationMs: 0,
  periodic: {
    intervalMs: EXTERNAL_HEAL_INTERVAL_MS,
    onTick: (context, aura) => {
      const healed = context.combatants.find((actor) => actor.id === aura.targetId);
      if (!healed) return;

      applyHealing(context, {
        source: healed,
        target: healed,
        abilityId: 'external_healer',
        abilityName: 'Healer',
        baseAmount: context.rng.nextInt(EXTERNAL_HEAL_MINIMUM, EXTERNAL_HEAL_MAXIMUM),
        // Whole numbers, no spell power, no crit and no scaling of any kind.
        // "A random number between 500 and 1500" is the entire specification,
        // and a crit would quietly make it 2250.
        canCrit: false,
        external: true,
        periodic: true,
      });
    },
  },
};
