import type { AuraDefinition, Combatant, SimulationContext, WeaponSlot } from '../../engine';
import { RATING_PER_PERCENT, dealDamage, seconds } from '../../engine';

/**
 * Auras a Warrior talent applies.
 *
 * Kept apart from `auras/warrior.ts`, which holds the auras the ABILITY
 * spreadsheet describes. These exist only because a talent was taken, and their
 * numbers come from `src/data/talents/values/warrior.json` rather than from the
 * ability sheet — so a definition here is built per character, from the rank
 * that character actually has.
 */

/** Deep Wounds bleeds for this long, in every rank. */
export const DEEP_WOUNDS_DURATION_MS = seconds(12);
/** And ticks on the usual three-second bleed cadence. */
export const DEEP_WOUNDS_TICK_INTERVAL_MS = seconds(3);
const DEEP_WOUNDS_TICKS = DEEP_WOUNDS_DURATION_MS / DEEP_WOUNDS_TICK_INTERVAL_MS;

/**
 * A weapon's AVERAGE damage, by the universal Forever formula.
 *
 *     base damage + (speed in seconds / 14) x attack power
 *
 * Average, so the variance roll is not taken: `baseDamage` is already the
 * middle of the weapon's range and `powerCoefficient` is the speed term the
 * formula produces. This is the same quantity a swing computes, without the
 * roll — which is what "your melee weapon's average damage" means.
 */
export function weaponAverageDamage(actor: Combatant, slot: WeaponSlot = 'mainHand'): number {
  const weapon = actor.weapons[slot];
  if (!weapon) return 0;
  const power = (weapon.powerCoefficient ?? 0) * actor.stats.effective.attackPower;
  return weapon.baseDamage + power;
}

/**
 * Deep Wounds: a bleed for a percentage of the weapon's average damage, spread
 * over 12 seconds.
 *
 * Built per character because the total depends on the rank taken AND on the
 * weapon held at the moment it is applied. The damage is fixed when the aura
 * is created rather than recomputed per tick: the source's wording keys it to
 * the strike that caused it, and a weapon swap mid-bleed should not retune the
 * ticks already scheduled.
 *
 * INTERPRETATION: the tick interval is not stated. Three seconds is the cadence
 * every other bleed in the ruleset uses, including Rend, and 12 divides evenly
 * by it. If the ruleset owner states otherwise this is one constant to change.
 */
export function deepWoundsAura(percentOfWeaponDamage: number): AuraDefinition {
  return {
    id: 'deep_wounds',
    name: 'Deep Wounds',
    durationMs: DEEP_WOUNDS_DURATION_MS,
    isDebuff: true,
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: DEEP_WOUNDS_TICK_INTERVAL_MS,
      onTick: (context: SimulationContext, aura) => {
        const source = context.combatant(aura.sourceId);
        const target = context.combatant(aura.targetId);
        if (!source || !target || !target.isAlive) return;

        const total = weaponAverageDamage(source) * (percentOfWeaponDamage / 100);

        dealDamage(context, {
          source,
          target,
          abilityId: aura.id,
          abilityName: aura.name,
          school: 'physical',
          baseAmount: total / DEEP_WOUNDS_TICKS,
          // The percentage IS the scaling. Attack power is already inside the
          // weapon's average damage, so scaling again would count it twice.
          powerCoefficient: 0,
          periodic: true,
          // Every damage-over-time effect in Forever can crit, at the crit
          // chance of the event that applied it. Deep Wounds is applied by a
          // melee critical strike, so it crits at melee crit chance.
          critFrom: 'melee-special',
          // A bleed is physical and ignores armor.
          appliesArmor: false,
        });
      },
    },
  };
}

/**
 * Flurry: melee haste for the next three swings after a melee crit.
 *
 * `consumedBySwing` is what makes "three swings" rather than "N seconds" work.
 * The duration is a long backstop so that a warrior who stops swinging does not
 * carry the buff forever; in practice the charges run out first.
 *
 * INTERPRETATION: the swing count (3) is stated by the source, the 12 second
 * backstop is not. Classic's Flurry lasts 15 seconds; 12 is used here only
 * because no fight state should ever reach it, and it is flagged rather than
 * presented as ruleset data.
 */
export const FLURRY_SWINGS = 3;
export const PLACEHOLDER_FLURRY_DURATION_MS = seconds(12);

export function flurryAura(hastePercent: number): AuraDefinition {
  return {
    id: 'flurry',
    name: 'Flurry',
    durationMs: PLACEHOLDER_FLURRY_DURATION_MS,
    maxStacks: FLURRY_SWINGS,
    // Each swing eats one charge, and the aura falls off at zero.
    consumedBySwing: true,
    /*
     * The talent states a flat percentage; the engine derives its haste
     * multiplier from `hasteRating`. Converting with the SAME constant the
     * engine divides by makes the round trip exact:
     *
     *     rating   = p x RATING_PER_PERCENT.haste
     *     multiplier = 1 + rating / RATING_PER_PERCENT.haste / 100 = 1 + p/100
     *
     * so the result is p% more attack speed whatever that constant is set to.
     */
    statModifiers: [
      {
        stat: 'hasteRating',
        operation: 'flat',
        value: hastePercent * RATING_PER_PERCENT.haste,
      },
    ],
  };
}
