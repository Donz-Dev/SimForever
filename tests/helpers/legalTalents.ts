import { talentsForClass } from '../../src/game/talents/talentData';

/*
 * Pads an allocation with filler until it is LEGAL, and returns it.
 *
 * `createPlayer` strips talents whose tier gate or prerequisite is not met --
 * a profile loaded from JSON is the only thing that can produce an illegal
 * allocation, and it used to be handed 31-point capstones for one point. That
 * is correct, and it means a test putting three points in Precision, which sits
 * at tier 20 of Fury, gets a character with no Precision unless it also spends
 * twenty points getting there.
 *
 * Rather than write those twenty points into every test, this fills the tree's
 * first row until the gate opens and adds any named prerequisite at its
 * required rank. Each test therefore measures a build a player could actually
 * have, which is a better test than the one it replaces.
 */
export function legalise(talents: Record<string, number>): Record<string, number> {
  const tree = talentsForClass('warrior');
  if (!tree) return talents;
  const out: Record<string, number> = { ...talents };

  for (const [id, points] of Object.entries(talents)) {
    if (points <= 0) continue;
    const talent = tree.byId.get(id);
    if (!talent) continue;

    // Any prerequisite first: it may itself be what opens the tier.
    if (talent.requires && !(out[talent.requires] > 0)) {
      const pre = tree.byId.get(talent.requires);
      if (pre) out[talent.requires] = talent.requiresRanks ?? pre.ranks;
    }

    // Then filler in the same tree's lowest rows until the gate is met.
    const inTree = () =>
      Object.entries(out).reduce(
        (n, [k, v]) => n + (tree.byId.get(k)?.tree === talent.tree ? v : 0),
        0,
      );
    const filler = tree.trees
      .find((t) => t.id === talent.tree)!
      .talents.filter((t) => t.tier < talent.tier && t.id !== id)
      .sort((a, b) => a.tier - b.tier);
    for (const f of filler) {
      while (inTree() < talent.tier && (out[f.id] ?? 0) < f.ranks) {
        out[f.id] = (out[f.id] ?? 0) + 1;
      }
    }
  }
  return out;
}
