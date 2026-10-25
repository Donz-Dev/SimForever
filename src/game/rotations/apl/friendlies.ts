import type { Combatant, SimulationContext } from '../../../engine';

/**
 * Who a healer can see, for the priority list (round 52).
 *
 * ============================================================================
 * A RAID MEMBER IS A FRIENDLY COMBATANT WITH A PARTY. The healer encounters
 * place each target to heal in a party of five and mark one as the tank;
 * nothing else in the project sets either field, so an ordinary fight has no
 * raid members and every one of these answers "nobody". The healer is not one
 * of them -- it is not being hit, and a heal aimed at itself would be the
 * wrong thing to optimise.
 * ============================================================================
 */
export function raidMembers(context: SimulationContext, actor: Combatant): readonly Combatant[] {
  return context.combatants.filter(
    (other) =>
      other !== actor && other.party !== undefined && other.isAlive && !other.isHostileTo(actor),
  );
}

/** The tank, when the encounter has one. */
export function tankOf(context: SimulationContext, actor: Combatant): Combatant | undefined {
  return raidMembers(context, actor).find((member) => member.raidRole === 'tank');
}

/** Current health as a fraction of maximum. A combatant with no pool is full. */
export function healthFraction(combatant: Combatant): number {
  const max = combatant.health.maximum;
  return max > 0 ? combatant.health.current / max : 1;
}

/**
 * The raid member with the least health, as a fraction.
 *
 * TIES GO TO THE EARLIER MEMBER, which is party order, so the choice is the
 * same every time for the same state -- a decision that depended on an
 * unordered collection would make two runs of one seed diverge.
 */
export function lowestHealth(
  context: SimulationContext,
  actor: Combatant,
  options: { readonly excludeTank?: boolean } = {},
): Combatant | undefined {
  let best: Combatant | undefined;
  let bestFraction = Infinity;
  for (const member of raidMembers(context, actor)) {
    if (options.excludeTank && member.raidRole === 'tank') continue;
    const fraction = healthFraction(member);
    if (fraction < bestFraction) {
      best = member;
      bestFraction = fraction;
    }
  }
  return best;
}

/** The mean health fraction of some members, or 1 when there are none. */
export function averageHealth(members: readonly Combatant[]): number {
  if (members.length === 0) return 1;
  return members.reduce((sum, member) => sum + healthFraction(member), 0) / members.length;
}

/** The members of one party. */
export function partyMembers(
  context: SimulationContext,
  actor: Combatant,
  party: number,
): readonly Combatant[] {
  return raidMembers(context, actor).filter((member) => member.party === party);
}

/**
 * The raid member carrying this actor's aura, the lowest health of them when
 * several do (round 60). Ties go to party order, like `lowestHealth`.
 */
export function withAuraFrom(
  context: SimulationContext,
  actor: Combatant,
  auraId: string,
): Combatant | undefined {
  let best: Combatant | undefined;
  let bestFraction = Infinity;
  for (const member of raidMembers(context, actor)) {
    if (member.auras.get(auraId)?.sourceId !== actor.id) continue;
    const fraction = healthFraction(member);
    if (fraction < bestFraction) {
      best = member;
      bestFraction = fraction;
    }
  }
  return best;
}

/** How many of these members are below a share of their health (round 60). */
export function injuredCount(members: readonly Combatant[], below: number): number {
  return members.filter((member) => healthFraction(member) < below).length;
}
