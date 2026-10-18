import type { MeleeWeaponSlot, Reaction } from '../../engine';
import { dealDamage, isWeaponUseOf } from '../../engine';

/**
 * Frost Oil: "procs a Frostbolt that deals 28 to 32 Frost Damage +27% of Spell
 * Power. Has a 10% chance to proc and has no internal cooldown."
 *
 * ----------------------------------------------------------------------------
 * A WEAPON EFFECT, coated onto ONE weapon like the stones and the wizard oil,
 * so it is offered per hand and a dual-wielder coating both hands rolls twice.
 * A use of THAT weapon rolls it -- a swing or an ability needing the weapon,
 * the project's standing rule for a weapon proc.
 *
 * A FLAT 10% PER HIT, NOT PROCS PER MINUTE. The owner gave a chance and no
 * rate, and a poison is the precedent for "each strike has a N% chance".
 *
 * THE MIDPOINT OF 28 TO 32, which is how every other ranged figure here is
 * read. The 27% is the coefficient on the caster's FROST spell power, which
 * `scaleByPower` applies because the school is Frost.
 *
 * IT ROLLS THE SPELL TABLE, because it is a Frostbolt: it can miss on the 17%
 * spell miss and crits at spell crit for 1.5x. The owner stated neither; a
 * proc that "procs a Frostbolt" being that spell is the reading that adds
 * nothing. It carries no `weaponSlot`, so it procs nothing in turn.
 * ----------------------------------------------------------------------------
 */
export const FROST_OIL_DAMAGE = (28 + 32) / 2;
export const FROST_OIL_SP_COEFFICIENT = 0.27;
export const FROST_OIL_PROC_CHANCE = 0.1;

export function frostOilReaction(hand: MeleeWeaponSlot): Reaction {
  return {
    id: `frost_oil_${hand}`,
    on: 'dealt',
    outcomes: ['hit', 'crit', 'glance', 'crush'],
    canTrigger: (context, _actor, attack) =>
      isWeaponUseOf(attack, hand) && context.rng.rollChance(FROST_OIL_PROC_CHANCE),
    onTrigger: (context, actor, attack) => {
      dealDamage(context, {
        source: actor,
        target: attack.defender,
        abilityId: 'frost_oil',
        abilityName: 'Frost Oil',
        school: 'frost',
        baseAmount: FROST_OIL_DAMAGE,
        powerCoefficient: FROST_OIL_SP_COEFFICIENT,
        attackTable: 'spell',
      });
    },
  };
}
