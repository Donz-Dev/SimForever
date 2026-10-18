import type { Ability } from '../../engine';
import { dealDamage, seconds } from '../../engine';

/*
 * ==============================================================================
 * THE WARLOCK'S TWO FIGHTING DEMONS' ABILITIES.
 *
 * WHERE EACH NUMBER COMES FROM, because two sources were used and they rank
 * differently:
 *
 *   the ruleset owner     Firebolt's 2 second cast and 45 to 50 Fire damage;
 *                         Lash of Pain's 12 second cooldown.
 *   mythicsim-forever-    everything the owner did not give -- the two spell
 *   engine                power coefficients and Lash of Pain's base damage --
 *                         from `src/classes/warlock/prepare/pets.rs` and
 *                         `prepare/export.rs`. The owner pointed at that
 *                         repository for warlock pet scaling; it is a
 *                         community engine reading the beta client, so where it
 *                         and the owner differ the owner wins. Firebolt is the
 *                         one place they do: the repository's 42.4 to 47.6 at
 *                         level 60 against the owner's 45 to 50.
 *
 * NEITHER COSTS ANYTHING HERE. Both demons have a mana pool in the client and
 * the repository charges 115 a Firebolt and 160 a Lash -- an Imp with 576 mana
 * would stop after five casts unless its regeneration is modelled, and the
 * owner's "repeatedly casts Firebolt" is the behaviour asked for. A demon
 * resource is therefore left out rather than half-built; recorded in HANDOVER
 * as a question.
 * ==============================================================================
 */

/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

/** "Deals 45 to 50 Fire Damage" -- the ruleset owner. */
export const IMP_FIREBOLT_DAMAGE = midpoint(45, 50);
/** "2 second cast time" -- the ruleset owner. */
export const IMP_FIREBOLT_CAST_MS = seconds(2);
/** `bonus_coefficient: 0.571` -- mythicsim-forever-engine, rank 7. */
export const IMP_FIREBOLT_SP_COEFFICIENT = 0.571;

export const IMP_FIREBOLT: Ability = {
  id: 'imp_firebolt',
  name: 'Firebolt (Imp)',
  castTimeMs: IMP_FIREBOLT_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'fire',
      baseAmount: IMP_FIREBOLT_DAMAGE,
      powerCoefficient: IMP_FIREBOLT_SP_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

/** "Lash of Pain has a 12 seconds cooldown" -- the ruleset owner. */
export const LASH_OF_PAIN_COOLDOWN_MS = seconds(12);
/** `base_damage: 50.0`, a fixed figure -- mythicsim-forever-engine, rank 6. */
export const LASH_OF_PAIN_DAMAGE = 50;
/** `bonus_coefficient: 0.429` -- mythicsim-forever-engine, rank 6. */
export const LASH_OF_PAIN_SP_COEFFICIENT = 0.429;

export const LASH_OF_PAIN: Ability = {
  id: 'lash_of_pain',
  name: 'Lash of Pain (Succubus)',
  cooldownMs: LASH_OF_PAIN_COOLDOWN_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'shadow',
      baseAmount: LASH_OF_PAIN_DAMAGE,
      powerCoefficient: LASH_OF_PAIN_SP_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

export const DEMON_ABILITIES: readonly Ability[] = [IMP_FIREBOLT, LASH_OF_PAIN];
