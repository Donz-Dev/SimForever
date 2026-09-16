import type { AuraDefinition } from '../../engine';
import { dealDamage, percent, seconds } from '../../engine';

/**
 * Example auras.
 *
 * These are NOT real World of Warcraft spells. They exist to exercise every
 * part of the aura system end to end (stat modifiers, stacks, periodic ticks,
 * refresh behaviour) with content that nobody will mistake for game data.
 *
 * Real class content replaces this directory; the engine does not change.
 */

/** A permanent self-buff. Demonstrates stat modifiers surviving a whole fight. */
export const BATTLE_FURY: AuraDefinition = {
  id: 'battle_fury',
  name: 'Battle Fury',
  // A duration of 0 means "until removed", which is how a stance or an aura
  // that lasts the whole encounter is expressed.
  durationMs: 0,
  statModifiers: [percent('attackPower', 0.1)],
};

/** Damage a single stack of Rending Wound deals per tick. */
const REND_TICK_DAMAGE = 18;

/**
 * A stacking damage-over-time debuff.
 *
 * Exercises the interesting half of the aura system at once: it stacks, its
 * ticks scale with the stack count, and refreshing it resets the duration
 * without losing stacks.
 */
export const RENDING_WOUND: AuraDefinition = {
  id: 'rending_wound',
  name: 'Rending Wound',
  durationMs: seconds(12),
  maxStacks: 3,
  isDebuff: true,
  refreshBehaviour: 'reset',
  modifiersScaleWithStacks: true,
  periodic: {
    intervalMs: seconds(3),
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target || !target.isAlive) return;

      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: 'physical',
        baseAmount: REND_TICK_DAMAGE * aura.stacks,
        powerCoefficient: 0.08 * aura.stacks,
        // No attack table: whether this effect landed was decided when it was
        // applied, so its ticks do not roll again.
        periodic: true,
      });
    },
  },
};
