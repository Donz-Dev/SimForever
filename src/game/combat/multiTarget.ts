import type { Ability, Combatant, Reaction, SimulationContext } from '../../engine';
import { SINGLE_TARGET, dealDamage, selectTargets } from '../../engine';

const PHYSICAL = 'physical' as const;

/**
 * Multi-target content, round 57: the owner's "Number of Targets" encounter.
 *
 * ----------------------------------------------------------------------------
 * EVERY AREA ABILITY ASKS ONE QUESTION, AND IT IS `selectTargets`. The engine's
 * skeleton in `engine/combat/targeting.ts` was written for exactly this day --
 * "the day an encounter gains a second enemy, this function is the only thing
 * that has to change" -- and it turned out nothing in it had to: what was
 * missing was the second enemy and the callers.
 *
 * AT ONE TARGET EVERY CALLER GETS `[primary]` AND NOTHING ELSE, which is what
 * keeps every combat log byte-identical to the encounter before this existed.
 * The primary is struck FIRST, so the events it produces are emitted in the same
 * order as before and the extra targets' events follow them.
 * ----------------------------------------------------------------------------
 */

/** The enemies an area ability strikes, the primary target first. */
export function areaTargets(
  simulation: SimulationContext,
  caster: Combatant,
  primary: Combatant,
  ability: Ability,
): readonly Combatant[] {
  return selectTargets(simulation, caster, primary, ability.targets ?? SINGLE_TARGET);
}

/**
 * How many targets the fight holds, for the APL's `targetCount` condition.
 *
 * LIVING ENEMIES, which is the encounter's count: every dummy survives lethal
 * damage, so this is `numberOfTargets` for the whole fight.
 */
export function targetCount(simulation: SimulationContext, actor: Combatant): number {
  return simulation.enemiesOf(actor).length;
}

/**
 * "Your melee attacks strike an additional nearby opponent" -- Blade Flurry, and
 * Sweeping Strikes' "your next 5 melee attacks", which is the same clause with
 * charges.
 *
 * ----------------------------------------------------------------------------
 * A COPY OF THE HIT THAT LANDED, ON THE FIRST OTHER ENEMY -- the owner's
 * ruling: both "are meant to copy the hit or hits that landed". Not a second
 * full roll on the second target.
 *
 * SO IT CARRIES NONE OF THE ATTACKER'S SCALING A SECOND TIME AND NO ARMOR:
 * `attack.amount` is already after both. The add's OWN modifiers still apply,
 * which today is nothing -- the raid's debuffs are on the boss.
 *
 * NO TABLE AND NO WEAPON SLOT, so it rolls nothing, crits nothing, procs nothing
 * and triggers no reaction -- including this one, so it cannot chain. At one
 * target there is no other enemy, `canTrigger` refuses, and nothing at all is
 * emitted: the containment check.
 *
 * MELEE ONLY: a swing or a melee special that LANDED -- a block lands and is a
 * copy of what got through. Periodic damage never reaches a `dealt` reaction.
 * ----------------------------------------------------------------------------
 */
export function extraOpponentReaction(options: {
  readonly auraId: string;
  readonly name: string;
  /** Sweeping Strikes spends one of its five; Blade Flurry is a window. */
  readonly consumesCharge: boolean;
}): Reaction {
  const secondTarget = (
    simulation: SimulationContext,
    actor: Combatant,
    defender: Combatant,
  ): Combatant | undefined =>
    simulation.enemiesOf(actor).find((enemy) => enemy.id !== defender.id);

  return {
    id: `${options.auraId}_extra_opponent`,
    on: 'dealt',
    outcomes: ['hit', 'crit', 'glance', 'block', 'crush'],
    canTrigger: (simulation, actor, attack) =>
      actor.auras.has(options.auraId) &&
      (attack.attackTable === 'melee-auto' || attack.attackTable === 'melee-special') &&
      attack.amount > 0 &&
      secondTarget(simulation, actor, attack.defender) !== undefined,
    onTrigger: (simulation, actor, attack) => {
      const target = secondTarget(simulation, actor, attack.defender);
      if (!target) return;
      if (options.consumesCharge) actor.auras.consumeStack(simulation, options.auraId);
      dealDamage(simulation, {
        source: actor,
        target,
        abilityId: options.auraId,
        abilityName: options.name,
        school: PHYSICAL,
        baseAmount: attack.amount,
        ignoresAttackerDamageScaling: true,
        appliesArmor: false,
      });
    },
  };
}

/**
 * Bane of Havoc's copy: "15% of all damage done by the Warlock to OTHER targets
 * to also be dealt to the cursed target" (round 57).
 *
 * ----------------------------------------------------------------------------
 * TWO REACTIONS, `dealt` AND `periodicDealt`, because "all damage" includes a
 * DoT tick and a `dealt` reaction never sees one -- the trigger has to be ASKED
 * for, which is why `periodicDealt` exists. Each is a pure function of the
 * fight, so one pair per Warlock is safe as a module constant.
 *
 * A COPY, NOT A SECOND HIT: `attack.amount` is what landed, so the copy carries
 * none of the Warlock's scaling a second time, none of the cursed target's
 * school vulnerabilities, no armor and no partial resist -- and no table, so it
 * rolls nothing and cannot itself be copied. Its school is SHADOW, which is a
 * READING: an `AttackEvent` does not carry the school of the hit, and nothing
 * reads it once the other modifiers are off.
 *
 * ONLY THE CURSE THIS WARLOCK PLACED, and never onto the target that was hit.
 * At one target there is no other target, so nothing is emitted.
 * ----------------------------------------------------------------------------
 */
export function damageCopyReactions(options: {
  readonly auraId: string;
  readonly name: string;
  readonly share: number;
}): readonly Reaction[] {
  const cursed = (
    simulation: SimulationContext,
    actor: Combatant,
    defender: Combatant,
  ): Combatant | undefined =>
    simulation
      .enemiesOf(actor)
      .find(
        (enemy) =>
          enemy.id !== defender.id && enemy.auras.get(options.auraId)?.sourceId === actor.id,
      );

  const reaction = (on: 'dealt' | 'periodicDealt'): Reaction => ({
    id: `${options.auraId}_copy_${on}`,
    on,
    outcomes: ['hit', 'crit', 'glance', 'block', 'crush'],
    canTrigger: (simulation, actor, attack) =>
      attack.amount > 0 && cursed(simulation, actor, attack.defender) !== undefined,
    onTrigger: (simulation, actor, attack) => {
      const target = cursed(simulation, actor, attack.defender);
      if (!target) return;
      dealDamage(simulation, {
        source: actor,
        target,
        abilityId: options.auraId,
        abilityName: options.name,
        school: 'shadow',
        baseAmount: attack.amount * options.share,
        ignoresAttackerDamageScaling: true,
        ignoresTargetSchoolScaling: true,
        noPartialResist: true,
        appliesArmor: false,
      });
    },
  });

  return [reaction('dealt'), reaction('periodicDealt')];
}
