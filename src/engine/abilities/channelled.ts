import type { Ability } from './Ability';

/**
 * Does this ability's EFFECT occupy its cast, rather than landing at the end?
 *
 * ------------------------------------------------------------------------------
 * ONE SHARED ANSWER, because "is this a channel" is asked in two places and the
 * two had different answers. `runPrecombat` refuses one, and
 * `CastModifier.excludesChannel` refuses one -- and anything that ZEROES a cast
 * time has to ask, because zeroing the cast of such an ability destroys the
 * effect while leaving the cooldown spent and the cast reported as successful.
 *
 * TWO SHAPES, AND `channelTicks` ONLY SEES THE FIRST.
 *
 * | | the shape | the example |
 * | --- | --- | --- |
 * | a series of ticks | `channelTicks > 1` | Arcane Missiles, five missiles |
 * | a WINDOW that must last the cast | `onCastStart` | Evocation |
 *
 * EVOCATION IS THE ONE THAT CAUGHT THIS. It declares NO `channelTicks` and is
 * still a channel -- its own comment says so: "ticks exist for an ability whose
 * EFFECT repeats, and this one's effect is a RATE rather than a series of
 * events." So the obvious test, `(channelTicks ?? 1) > 1`, calls Evocation an
 * ordinary eight-second cast. Presence of Mind over that reading would make it
 * INSTANT: `onCastStart` opens the regeneration window and `onCast` closes it in
 * the same millisecond, so the Mage spends an eight-minute cooldown for nothing
 * and the combat log shows a successful Evocation.
 *
 * `onCastStart` IS THE RIGHT SECOND SIGNAL BY THAT FIELD'S OWN CONTRACT, which
 * is "an effect that has to be in place FOR the cast rather than after it". An
 * effect that has to be in place for the cast is an effect that a zero-length
 * cast cannot deliver -- so this is a reading of the declaration rather than a
 * proxy for one, and a new ability of either shape is covered the day it lands.
 *
 * NOT A DECLARED FLAG, which was the alternative. `Ability.channelled` would be
 * silent on the one that forgot, and what it would buy is the ability to say
 * "my effect lasts the cast and may still be zeroed", which nothing wants.
 * ------------------------------------------------------------------------------
 */
export function spreadsEffectAcrossCast(ability: Ability): boolean {
  return (ability.channelTicks ?? 1) > 1 || ability.onCastStart !== undefined;
}
