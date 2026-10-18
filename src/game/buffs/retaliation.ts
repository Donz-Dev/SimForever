import type { DamageSchool, Reaction } from '../../engine';
import { dealDamage } from '../../engine';

/**
 * Thorns and Retribution Aura: damage dealt back to whatever attacks the
 * character, supplied by ANOTHER raid member.
 *
 * ----------------------------------------------------------------------------
 * THE OWNER'S FIGURES:
 *
 *   Thorns              18 Nature + 6% of the supplier's spell power
 *   Retribution Aura    20 Holy   + 6% of the supplier's spell power
 *
 * "every time a target attacks you". THE SUPPLIER'S SPELL POWER, NOT THE
 * CARRIER'S, because the buff is somebody else's -- so it arrives as a number
 * on the profile (`raidBuffValues`, defaulting to 700) and is folded into the
 * flat figure here, with no coefficient for `scaleByPower` to read the
 * carrier's pool against.
 *
 * EVERY ATTACK, INCLUDING ONE THE CHARACTER AVOIDS, which is the owner's word
 * "attacks" read literally. Classic's two say "when hit", which would exclude a
 * miss, a dodge and a parry -- a question, recorded where the round is.
 *
 * DEALT AS THE CARRIER'S DAMAGE, so it is on the carrier's damage table and
 * the carrier's own multipliers reach it -- which is why One-Handed Weapon
 * Specialization has to name both as exceptions. No table and no `critFrom`:
 * it cannot miss and cannot crit, neither of which the owner gave.
 * ----------------------------------------------------------------------------
 */
export const THORNS_DAMAGE = 18;
export const RETRIBUTION_AURA_DAMAGE = 20;
export const RETALIATION_SP_COEFFICIENT = 0.06;
export const DEFAULT_SUPPLIER_SPELL_POWER = 700;

const EVERY_OUTCOME = [
  'miss',
  'dodge',
  'parry',
  'block',
  'glance',
  'crush',
  'crit',
  'hit',
] as const;

export function retaliationReaction(
  id: 'thorns' | 'retribution_aura',
  name: string,
  school: DamageSchool,
  flat: number,
  supplierSpellPower: number,
): Reaction {
  const amount = flat + RETALIATION_SP_COEFFICIENT * supplierSpellPower;
  return {
    id,
    on: 'taken',
    outcomes: [...EVERY_OUTCOME],
    canTrigger: (_context, actor, attack) => attack.attacker.id !== actor.id,
    onTrigger: (context, actor, attack) => {
      dealDamage(context, {
        source: actor,
        target: attack.attacker,
        abilityId: id,
        abilityName: name,
        school,
        baseAmount: amount,
        appliesArmor: false,
      });
    },
  };
}
