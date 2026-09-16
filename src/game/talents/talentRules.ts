import type { TalentAllocation, WarriorTreeId } from './Talent';
import { POINTS_PER_TIER, TOTAL_TALENT_POINTS } from './Talent';
import { WARRIOR_TALENTS_BY_ID, WARRIOR_TREES } from './warriorTalents';

/**
 * The rules for spending talent points.
 *
 * Pure functions over an allocation, with no React and no DOM, so the tree's
 * behaviour can be checked without rendering anything. The panel calls these
 * and draws the answer.
 *
 * Three rules, and they compose:
 *
 *   1. 51 points, total, across all three trees.
 *   2. A talent's row does not open until `tier` points sit in ITS OWN tree.
 *   3. A talent with a prerequisite needs that prerequisite at full rank.
 *
 * Removal is the interesting case. A point cannot be taken back if doing so
 * would leave some other talent standing on a requirement that no longer holds
 * -- pulling a point out of tier 1 must not strand a tier 6 capstone. Rather
 * than reasoning about which talents depend on which, `canUnspend` simply
 * applies the removal and asks whether the result is still legal. That is
 * slower and completely reliable, and the allocation is 54 entries.
 */

/** Points spent in one tree. */
export function pointsInTree(allocation: TalentAllocation, tree: WarriorTreeId): number {
  let total = 0;
  for (const [id, points] of Object.entries(allocation)) {
    if (WARRIOR_TALENTS_BY_ID.get(id)?.tree === tree) total += points;
  }
  return total;
}

/** Points spent across every tree. */
export function pointsSpent(allocation: TalentAllocation): number {
  return Object.values(allocation).reduce((sum, points) => sum + points, 0);
}

/** Points still available. */
export function pointsRemaining(allocation: TalentAllocation): number {
  return TOTAL_TALENT_POINTS - pointsSpent(allocation);
}

/**
 * Whether a single talent's own requirements are met by an allocation.
 *
 * Only meaningful when the talent has points in it; a talent at zero has
 * nothing to justify.
 */
function requirementsMet(allocation: TalentAllocation, talentId: string): boolean {
  const talent = WARRIOR_TALENTS_BY_ID.get(talentId);
  if (!talent) return false;

  if (pointsInTree(allocation, talent.tree) < talent.tier) return false;

  if (talent.requires) {
    const have = allocation[talent.requires] ?? 0;
    if (have < (talent.requiresRanks ?? 1)) return false;
  }
  return true;
}

/**
 * Whether an allocation is legal in its entirety.
 *
 * A tier check counts every point in the tree INCLUDING the talent's own, which
 * is how the source calculator behaves: five points in row 0 open row 1, and a
 * talent never blocks itself.
 */
export function isLegal(allocation: TalentAllocation): boolean {
  if (pointsSpent(allocation) > TOTAL_TALENT_POINTS) return false;

  for (const [id, points] of Object.entries(allocation)) {
    if (points === 0) continue;

    const talent = WARRIOR_TALENTS_BY_ID.get(id);
    if (!talent) return false;
    if (points > talent.ranks || points < 0) return false;
    if (!requirementsMet(allocation, id)) return false;
  }
  return true;
}

/** Whether one more point can go into a talent. */
export function canSpend(allocation: TalentAllocation, talentId: string): boolean {
  const talent = WARRIOR_TALENTS_BY_ID.get(talentId);
  if (!talent) return false;
  if (pointsRemaining(allocation) <= 0) return false;
  if ((allocation[talentId] ?? 0) >= talent.ranks) return false;

  return requirementsMet(allocation, talentId);
}

/** One more point in a talent, or the allocation unchanged if it cannot go in. */
export function spend(allocation: TalentAllocation, talentId: string): TalentAllocation {
  if (!canSpend(allocation, talentId)) return allocation;
  return { ...allocation, [talentId]: (allocation[talentId] ?? 0) + 1 };
}

/** Whether a point can come back out without stranding something else. */
export function canUnspend(allocation: TalentAllocation, talentId: string): boolean {
  if ((allocation[talentId] ?? 0) <= 0) return false;
  return isLegal(withoutOnePoint(allocation, talentId));
}

/** One point back out, or the allocation unchanged if that would strand a talent. */
export function unspend(allocation: TalentAllocation, talentId: string): TalentAllocation {
  if (!canUnspend(allocation, talentId)) return allocation;
  return withoutOnePoint(allocation, talentId);
}

function withoutOnePoint(allocation: TalentAllocation, talentId: string): TalentAllocation {
  const next = { ...allocation, [talentId]: (allocation[talentId] ?? 0) - 1 };
  if (next[talentId] === 0) delete next[talentId];
  return next;
}

/** Clear one tree, leaving the other two alone. */
export function resetTree(
  allocation: TalentAllocation,
  tree: WarriorTreeId,
): TalentAllocation {
  const next: Record<string, number> = {};
  for (const [id, points] of Object.entries(allocation)) {
    if (WARRIOR_TALENTS_BY_ID.get(id)?.tree !== tree) next[id] = points;
  }
  return next;
}

/**
 * The tree distribution, as the calculator prints it: "0/0/0".
 *
 * Always in Arms / Fury / Protection order, whatever order points went in.
 */
export function distribution(allocation: TalentAllocation): string {
  return WARRIOR_TREES.map((tree) => pointsInTree(allocation, tree.id)).join('/');
}

/** Points needed in a tree before a row opens. */
export function tierForRow(row: number): number {
  return row * POINTS_PER_TIER;
}
