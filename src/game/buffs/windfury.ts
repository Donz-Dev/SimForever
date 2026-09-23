import type { AuraDefinition, Reaction } from '../../engine';
import { flat, seconds } from '../../engine';

/**
 * Windfury Totem.
 *
 * ----------------------------------------------------------------------------
 * THE RULE, from the ruleset owner:
 *
 *   Each main hand swing has a 20% chance to trigger an extra attack. It
 *   follows the same rules as the extra attacks already implemented (Sword
 *   Specialization, Hand of Justice) with one exception: a 1.5 second internal
 *   cooldown after it triggers, and a 1.5 second buff of +246 attack power
 *   when it triggers -- so attack power + 246 has to be known before the
 *   extra attack goes out.
 *
 * WHAT THE +246 REACHES, which the owner settled: the extra attack, and
 * anything else that swings inside the 1.5 seconds. NOT the swing that procced
 * it -- that one has already dealt its damage and been reported by the time a
 * reaction runs, and crediting it would mean rolling the proc before the swing
 * resolves, which is a different code path from the two extra attacks this is
 * meant to match.
 *
 * SO THE ORDER INSIDE `onTrigger` IS THE MECHANIC. The aura goes up FIRST and
 * the extra attack is requested second. `extraAttack` schedules the swing at
 * the current timestamp rather than running it inline, so it resolves after
 * the reaction has finished -- by which time the attack power is already
 * raised. Swapping those two lines would produce an extra attack at base
 * attack power and nothing would fail.
 *
 * WHY AN INTERNAL COOLDOWN AT ALL. Without one the effect chains off itself:
 * the extra swing is a main-hand attack, so it rolls again. Hand of Justice
 * carries an internal cooldown of the same length for the same reason, and
 * the two are now the only things in the project that do.
 * ----------------------------------------------------------------------------
 */
export const WINDFURY_PROC_CHANCE = 0.2;
export const WINDFURY_ATTACK_POWER = 246;
export const WINDFURY_DURATION_MS = seconds(1.5);
export const WINDFURY_INTERNAL_COOLDOWN_MS = seconds(1.5);

export const WINDFURY_TOTEM_AURA: AuraDefinition = {
  id: 'windfury_totem',
  name: 'Windfury Totem',
  durationMs: WINDFURY_DURATION_MS,
  // A second proc inside the window restarts it rather than stacking: the
  // internal cooldown makes that possible only at the very edge, and the
  // effect is one buff however often it is applied.
  refreshBehaviour: 'reset',
  statModifiers: [flat('attackPower', WINDFURY_ATTACK_POWER)],
};

/**
 * Built per character rather than shared, because the internal cooldown is
 * per-character state and a module-level one would let two combatants in the
 * same batch share a timer. Hand of Justice is built the same way.
 */
export function windfuryTotemReaction(): Reaction {
  let lastProcAt: number | null = null;

  return {
    id: 'windfury_totem',
    on: 'dealt',
    // Landed main-hand swings. An avoided attack is not a swing that
    // connected, and the slot check below is what keeps it off the off hand.
    outcomes: ['hit', 'crit', 'glance', 'crush'],
    canTrigger: (context, _actor, attack) => {
      // MAIN HAND ONLY, and only an auto attack: "each main hand swing".
      // An ability carries an `abilityId`, so this refuses Mortal Strike
      // while accepting the swing it replaced.
      if (attack.weaponSlot !== 'mainHand') return false;
      if (attack.abilityId !== undefined) return false;

      const now = context.clock.now();
      if (lastProcAt !== null && now - lastProcAt < WINDFURY_INTERNAL_COOLDOWN_MS) {
        return false;
      }

      return context.rng.rollChance(WINDFURY_PROC_CHANCE);
    },
    onTrigger: (context, actor) => {
      lastProcAt = context.clock.now();

      /*
       * THE BUFF FIRST. `extraAttack` schedules its swing at this timestamp
       * and it resolves after this reaction returns, so the attack power is
       * already up when it lands. This ordering is the ruleset owner's rule
       * about the +246 reaching the extra attack, and it is one line.
       */
      context.applyAura(actor, WINDFURY_TOTEM_AURA, actor.id);
      context.extraAttack(actor, 'mainHand');
    },
  };
}
