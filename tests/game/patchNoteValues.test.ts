import { describe, expect, it } from 'vitest';
import type { ClassId } from '../../src/game/character';
import {
  PATCH_NOTE_TALENT_VALUES,
  patchNoteValue,
} from '../../src/game/talents/patchNoteValues';
import { talentNumber, talentValue } from '../../src/game/talents/talentValues';
import { talentsForClass } from '../../src/game/talents/talentData';
import warriorValues from '../../src/data/talents/values/warrior.json';
import rogueValues from '../../src/data/talents/values/rogue.json';
import druidValues from '../../src/data/talents/values/druid.json';
import shamanValues from '../../src/data/talents/values/shaman.json';
import mageValues from '../../src/data/talents/values/mage.json';
import paladinValues from '../../src/data/talents/values/paladin.json';
import hunterValues from '../../src/data/talents/values/hunter.json';
import warlockValues from '../../src/data/talents/values/warlock.json';
import priestValues from '../../src/data/talents/values/priest.json';

/*
 * ============================================================================
 * THE LAYER THAT CARRIES A PATCH NOTE AHEAD OF THE CLIENT, AND THE CHECKS THAT
 * MAKE IT SAFE TO HAVE ONE.
 *
 * `PATCH_NOTE_TALENT_VALUES` exists because the notes for this patch describe
 * changes that are in NEITHER data source, and a
 * multi-rank value has nowhere safe to go in `values/<class>.json` -- the
 * importer merges a previous entry only where this run produced `null`.
 *
 * AN OVERRIDE LAYER IS DANGEROUS IN THE WAY A `scope` TAG IS DANGEROUS: its
 * whole purpose is to stop the generated file being read, so an entry that has
 * become redundant, or that names a talent the client has since renamed, is
 * invisible. Every test here is aimed at that rather than at the arithmetic.
 * ============================================================================
 */

const RAW: Record<ClassId, { talents: Record<string, { values: unknown; ranks: number }> }> = {
  warrior: warriorValues as never,
  rogue: rogueValues as never,
  druid: druidValues as never,
  shaman: shamanValues as never,
  mage: mageValues as never,
  paladin: paladinValues as never,
  hunter: hunterValues as never,
  warlock: warlockValues as never,
  priest: priestValues as never,
};

const ENTRIES = Object.entries(PATCH_NOTE_TALENT_VALUES).flatMap(([characterClass, byId]) =>
  Object.entries(byId ?? {}).map(
    ([talentId, entry]) => [characterClass as ClassId, talentId, entry] as const,
  ),
);

describe('the patch-note value override', () => {
  it('has at least one entry, or the layer should be deleted rather than empty', () => {
    /*
     * AN EMPTY OVERRIDE TABLE IS A MECHANISM WITH NO CALLER, which reads
     * exactly like one that is sometimes used -- the `EFFECT_RULES` lesson and
     * the `isWeaponUseOf(attack, 'ranged')` one. The day the client catches up
     * on all of these, this file and `patchNoteValues.ts` go together.
     */
    expect(ENTRIES.length).toBeGreaterThan(0);
  });

  it('names a talent that exists in that class tree, at a rank the talent has', () => {
    /*
     * ========================================================================
     * THE FAILURE THIS CATCHES IS A RENAME, AND IT HAS ALREADY COST THIS
     * PROJECT A HAND-FILLED VALUE ONCE.
     *
     * A talent id is slugified from the client's name, so a renamed talent IS
     * a new key -- Hot Streak became Heating Up at 1.60.1.70170 and its
     * hand-filled 25 was left behind under the old key, silently, because an
     * effect that reads no value is DROPPED rather than reported. An override
     * keyed by a stale id is the same failure with the opposite sign: the
     * talent quietly goes back to the client's number.
     *
     * AND THE RANK COUNT IS CHECKED TOO, because a note that changes how many
     * points a talent takes is a TREE change this layer deliberately cannot
     * express. An override with five rows against a three-rank talent is that
     * mistake made visible.
     * ========================================================================
     */
    for (const [characterClass, talentId, entry] of ENTRIES) {
      const talent = talentsForClass(characterClass)?.byId.get(talentId);
      expect(talent, `${characterClass}/${talentId} is in the tree`).toBeDefined();
      expect(entry.values.length, `${characterClass}/${talentId} rank count`).toBe(talent!.ranks);
    }
  });

  it('differs from what the client says, so no entry is a silent no-op', () => {
    /*
     * ========================================================================
     * AN OVERRIDE THAT AGREES WITH THE GENERATED FILE IS WORSE THAN NO
     * OVERRIDE, because it claims a patch note is being applied when nothing
     * is being changed -- and it will still claim that after the client moves
     * the number somewhere else.
     *
     * THIS IS THE TEST THAT EXPIRES THE LAYER. When the client ships these
     * figures, `clientSaid` stops matching the generated file, the next test
     * fails, and this one tells you the entry has become redundant. That is
     * the intended end of each row: deleted, not left to agree quietly.
     * ========================================================================
     */
    for (const [characterClass, talentId, entry] of ENTRIES) {
      expect(entry.values, `${characterClass}/${talentId}`).not.toEqual(entry.clientSaid);
    }
  });

  it('records what the client said, and the client still says it', () => {
    /*
     * ========================================================================
     * THE REFRESH DETECTOR, AND IT IS THE REASON `clientSaid` IS ON THE ENTRY
     * AT ALL.
     *
     * A capture goes stale and a correct number becomes a wrong one with
     * nobody touching it -- this project's own rule. When somebody re-runs
     * `import_forever_talents.mjs --write` and the client has shipped these
     * changes, the generated row moves and THIS test fails, naming the talent.
     * That is the moment to re-read the note and delete the row.
     *
     * Without it an override would sit on top of the real value forever, and
     * the one thing worse than a note ahead of the client is a note left in
     * front of the client after it caught up.
     * ========================================================================
     */
    for (const [characterClass, talentId, entry] of ENTRIES) {
      const raw = RAW[characterClass].talents[talentId];
      expect(raw, `${characterClass}/${talentId} in the values file`).toBeDefined();
      expect(raw.values, `${characterClass}/${talentId}: the client's row moved`).toEqual(
        entry.clientSaid,
      );
    }
  });

  it('carries the note it came from, in the note\'s own words', () => {
    // A figure whose source is not written down is a figure nobody can check,
    // which is this project's rule about a borrowed number looking sourced.
    for (const [characterClass, talentId, entry] of ENTRIES) {
      expect(entry.note.length, `${characterClass}/${talentId}`).toBeGreaterThan(20);
      expect(entry.source.length, `${characterClass}/${talentId}`).toBeGreaterThan(5);
    }
  });

  it('is what talentValue returns, so the panel and the fight agree', () => {
    /*
     * THE JOIN, AND IT IS THE HALF THAT WAS WRONG FIRST. This was wired into
     * `talentBuild` alone, which would have left the Talent panel printing the
     * client's 1/2/3/4/5 for a Shadow Mastery the engine ran at 2/4/6/8/10 --
     * the character sheet's crit bug exactly, invisible because every
     * neighbouring number is right.
     *
     * `talentValue` is the root both come through, so this asserts the
     * override arrives there rather than at either reader.
     */
    for (const [characterClass, talentId, entry] of ENTRIES) {
      for (let rank = 1; rank <= entry.values.length; rank += 1) {
        expect(talentValue(characterClass, talentId, rank), `${talentId} rank ${rank}`).toEqual(
          entry.values[rank - 1],
        );
      }
    }
  });

  it('returns nothing for a rank the override does not carry, rather than clamping', () => {
    for (const [characterClass, talentId, entry] of ENTRIES) {
      expect(patchNoteValue(characterClass, talentId, 0)).toBeUndefined();
      expect(patchNoteValue(characterClass, talentId, entry.values.length + 1)).toBeUndefined();
    }
  });

  it('leaves every other talent reading the generated file', () => {
    /*
     * CONTAINMENT. The override is keyed by class AND id because a talent id is
     * unique only within a class -- without `talentsForClass`, every class was
     * once offered the Warrior's Anger Management. So a Warlock's
     * `shadow_mastery` override must not reach a Priest, and no class may
     * acquire a number it did not have.
     */
    for (const [characterClass, byId] of Object.entries(PATCH_NOTE_TALENT_VALUES)) {
      for (const talentId of Object.keys(byId ?? {})) {
        for (const other of Object.keys(RAW) as ClassId[]) {
          if (other === characterClass) continue;
          expect(patchNoteValue(other, talentId, 1), `${other}/${talentId}`).toBeUndefined();
        }
      }
    }
  });
});

describe('the figure the layer moves', () => {
  it('doubles Champion of the Light back to 20/40/60, ahead of the client', () => {
    expect(talentNumber('paladin', 'champion_of_the_light', 3)).toBe(60);
    expect(talentNumber('paladin', 'champion_of_the_light', 2)).toBe(40);
    expect(talentNumber('paladin', 'champion_of_the_light', 1)).toBe(20);
  });
});
