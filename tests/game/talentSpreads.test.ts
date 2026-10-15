import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PROFILE_PRESETS, PRESETS_BY_ID } from '../../src/profiles/presets';
import { talentsForClass } from '../../src/game/talents/talentData';

/**
 * ==============================================================================
 * A TALENT SPREAD WRITTEN IN A DOC MUST MATCH THE PRESET IT NAMES.
 *
 * A spread is a BUILD, which is a FACT rather than a measurement -- HANDOVER's
 * own rule for why the talent columns of its baseline table are corrected in
 * place while the DPS column is only flagged. So unlike a DPS figure, a stated
 * spread has a single right answer and nothing to argue about.
 *
 * WHY THIS TEST EXISTS: TWELVE OF THEM WERE WRONG AT ONCE. Every per-class
 * handoff document carried a profiles table, `druid.md`'s saying "THESE ARE
 * CURRENT" in capitals, and six of the nine were stale -- Arcane 47/4/0 against
 * a real 35/11/5, Ele Shaman 38/13/0 against 32/6/13, 2H Arms 38/13/0 against
 * 39/10/2. They went stale one respecification at a time, each one correct the
 * day it was typed.
 *
 * AND THE SAME FIGURE WAS WRONG IN THREE PLACES FOR ONE BUILD. LW Ranged read
 * `7/39/5` in `hunter.md`, `7/39/5` in a `presets.ts` header, `5/39/7` in a
 * HANDOVER correction that had itself gone stale, and `5/41/5` in the preset --
 * with a correct `presets.ts` comment seventy lines below the wrong header.
 * **A figure written twice is a figure that drifts once.**
 *
 * SO THE TEST READS THE DOCS AND ASKS `PRESETS_BY_ID`, which is the only source
 * that cannot be stale: it is the thing the fight is built from. That is the
 * same structural argument `classRegistration.test.ts` and
 * `auraCatalog.test.ts` make -- a check derived from what the project already
 * SAYS cannot find what it has stopped saying correctly.
 *
 * IT DELIBERATELY DOES NOT CHECK DPS. The per-class tables' figures are badly
 * stale too -- `druid.md` has the Moonkin at 513.4 against roughly 785.9 -- and
 * that is a MEASUREMENT, which the owner keeps. Correcting one here would
 * publish a difference between two baselines, which is this project's own rule.
 * ==============================================================================
 */

/** The spread a preset actually has, summed per tree in the tree's own order. */
function spreadOf(presetId: string): string {
  const profile = PRESETS_BY_ID.get(presetId)!.build();
  const trees = talentsForClass(profile.character.characterClass);
  // Every preset's class has a tree table; a class without one cannot be built.
  if (!trees) throw new Error(`No talent trees for ${profile.character.characterClass}`);
  const order: string[] = [];
  for (const talent of trees.byId.values()) {
    if (!order.includes(talent.tree)) order.push(talent.tree);
  }
  const perTree = new Map<string, number>();
  for (const [id, rank] of Object.entries(profile.talents ?? {})) {
    const talent = trees.byId.get(id);
    if (talent) perTree.set(talent.tree, (perTree.get(talent.tree) ?? 0) + rank);
  }
  return order.map((tree) => perTree.get(tree) ?? 0).join('/');
}

/**
 * A doc table row that names a profile and states a spread.
 *
 * TWO SHAPES, because the two tables differ: HANDOVER's baseline carries a
 * CLASS column between the label and the spread (`| Moonkin | Druid | 41/0/10 |`)
 * and a handoff table does not (`| Moonkin | 41/0/10 | **785.9** |`).
 */
const ROW =
  /\|\s*([A-Za-z0-9/ '’*]+?)\s*\|\s*(?:(?:Warrior|Rogue|Mage|Druid|Shaman|Paladin|Hunter|Warlock|Priest)\s*\|\s*)?(\d+\/\d+\/\d+)\s*\|/g;

/*
 * A doc may write "Moonkin" or "Moonkin Druid" for the preset labelled
 * "Moonkin". Matched by suffix rather than by a hand-written alias map, so a
 * new profile needs no entry here.
 */
const SUFFIXES = ['', ' Druid', ' Mage', ' Rogue', ' Hunter', ' Priest', ' Shaman'];

describe('every talent spread stated in a doc matches its preset', () => {
  const real = new Map(PROFILE_PRESETS.map((preset) => [preset.label, spreadOf(preset.id)]));
  const files = ['HANDOVER.md', ...readdirSync('docs/handoff').map((f) => `docs/handoff/${f}`)];

  const stale: string[] = [];
  let checked = 0;

  for (const file of files) {
    readFileSync(file, 'utf-8')
      .split('\n')
      .forEach((line, index) => {
        ROW.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = ROW.exec(line)) !== null) {
          const label = match[1].replace(/\*/g, '').trim();
          const key = [...real.keys()].find((name) =>
            SUFFIXES.some((suffix) => `${name}${suffix}` === label),
          );
          if (!key) continue;
          checked += 1;
          if (real.get(key) !== match[2]) {
            stale.push(`${file}:${index + 1}  ${label}: doc ${match[2]}, preset ${real.get(key)}`);
          }
        }
      });
  }

  it('finds no doc stating a spread the preset disagrees with', () => {
    expect(stale).toEqual([]);
  });

  it('actually examined the tables, rather than matching nothing', () => {
    /*
     * THE GUARD AGAINST A VACUOUS PASS, which this test needs more than most:
     * it is driven by a REGEX over prose, and a doc reformatted into a
     * different table shape would silently match zero rows and pass. That is
     * `isWeaponUseOf(attack, 'ranged')` in a test -- a predicate that is
     * always false reads exactly like one that is sometimes true.
     *
     * Thirty-odd rows across HANDOVER's baseline table and the nine handoff
     * documents, so twenty is a floor with room for a doc to be rewritten.
     */
    expect(checked).toBeGreaterThan(20);
  });
});
