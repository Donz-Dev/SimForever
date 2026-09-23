import warriorValues from '../../data/talents/values/warrior.json';
import rogueValues from '../../data/talents/values/rogue.json';
import druidValues from '../../data/talents/values/druid.json';
import shamanValues from '../../data/talents/values/shaman.json';
import mageValues from '../../data/talents/values/mage.json';
import paladinValues from '../../data/talents/values/paladin.json';
import hunterValues from '../../data/talents/values/hunter.json';
import warlockValues from '../../data/talents/values/warlock.json';
import priestValues from '../../data/talents/values/priest.json';
import type { ClassId } from '../character';

/**
 * The per-rank numbers behind talent effects.
 *
 * Loaded from `src/data/talents/values/<class>.json`, which is hand-editable:
 * a balance change is an edit to that file and nothing else. See its README for
 * the format and where the values came from.
 *
 * Only the Warrior is captured. Every other class loads nothing, so every one
 * of its talents reports "no value" and contributes nothing — the same visible
 * gap as an unmodelled effect, rather than a silent zero.
 */

/** One rank's value: a single number, or several when a talent varies several. */
export type TalentValue = number | readonly number[];

interface ValuesEntry {
  readonly name: string;
  readonly tree: string;
  readonly ranks: number;
  readonly text: string;
  readonly values: readonly TalentValue[] | null;
  readonly note?: string;
  readonly irregular?: string;
}

interface ValuesFile {
  readonly class: string;
  readonly talents: Record<string, ValuesEntry>;
}

/*
 * A CLASS ABSENT HERE HAS NO VALUES AT ALL, and every one of its talents is
 * reported unmodelled -- which is honest and completely silent. The Rogue
 * shipped with its whole tree inert for exactly that reason: Malice, Aggression
 * and the rest all resolved to no number, so the build reported twenty
 * unmodelled talents and nobody noticed, because "unmodelled" is what an
 * unfinished class is supposed to say.
 *
 * Add the class here in the same commit as its effects table.
 */
const FILES: Partial<Record<ClassId, ValuesFile>> = {
  warrior: warriorValues as ValuesFile,
  rogue: rogueValues as ValuesFile,
  druid: druidValues as ValuesFile,
  shaman: shamanValues as ValuesFile,
  mage: mageValues as ValuesFile,
  paladin: paladinValues as ValuesFile,
  hunter: hunterValues as ValuesFile,
  warlock: warlockValues as ValuesFile,
  priest: priestValues as ValuesFile,
};

/*
 * Validated on load and thrown on, in the same spirit as `talentData.ts`.
 *
 * A values file is edited by hand, which is the whole point of it, and a hand
 * edit is exactly where a rank array ends up one element short. Silently
 * reading a missing rank as zero would make a talent quietly weaker than the
 * file says; failing here makes the typo obvious.
 */
for (const [classId, file] of Object.entries(FILES)) {
  if (!file) continue;
  for (const [id, entry] of Object.entries(file.talents)) {
    if (entry.values === null) continue;
    if (entry.values.length !== entry.ranks) {
      throw new Error(
        `Talent values for ${classId}/${id} have ${entry.values.length} entries ` +
          `but the talent has ${entry.ranks} ranks.`,
      );
    }
    for (const value of entry.values) {
      const numbers = typeof value === 'number' ? [value] : value;
      if (numbers.some((n) => typeof n !== 'number' || !Number.isFinite(n))) {
        throw new Error(`Talent values for ${classId}/${id} contain a non-number.`);
      }
    }
  }
}

/**
 * The value a talent has at a given rank, or undefined when nobody knows it.
 *
 * Rank is 1-based. Undefined is returned for a talent with no captured values,
 * a rank outside its range, and a class with no values file — all of which mean
 * the same thing to a caller: there is no number here, so do nothing.
 *
 * It is NEVER extrapolated from another rank. Three of the Warrior's own
 * talents break the linear assumption (`improved_rend` is 12, 23, 35), so a
 * guess would be wrong roughly seven percent of the time and nothing
 * downstream could tell.
 */
export function talentValue(
  characterClass: ClassId,
  talentId: string,
  rank: number,
): TalentValue | undefined {
  const entry = FILES[characterClass]?.talents[talentId];
  if (!entry?.values) return undefined;
  if (rank < 1 || rank > entry.values.length) return undefined;
  return entry.values[rank - 1];
}

/**
 * One number from a talent's value at a rank.
 *
 * `index` picks which, for a talent that varies several. Shield Specialization
 * varies block chance AND a rage proc chance, and an effect that silently took
 * the first would give the rage proc a 1% chance instead of 20%.
 *
 * An index past the end is undefined rather than a fallback to the first:
 * reading the wrong number is worse than reading none, because none is
 * reported as unmodelled and the wrong one is not reported at all.
 */
export function talentNumber(
  characterClass: ClassId,
  talentId: string,
  rank: number,
  index = 0,
): number | undefined {
  const value = talentValue(characterClass, talentId, rank);
  if (value === undefined) return undefined;
  if (typeof value === 'number') return index === 0 ? value : undefined;
  return value[index];
}

/** The source's own wording, with `{0}` where the per-rank number goes. */
export function talentText(characterClass: ClassId, talentId: string): string | undefined {
  return FILES[characterClass]?.talents[talentId]?.text;
}

/**
 * The source's wording with the numbers for a rank filled in.
 *
 * `{0}` is how the values file separates the variable from the sentence around
 * it, which is right for storage and wrong for reading: "Increases your Parry
 * chance by {0}%" shown to a person looks like a bug. A talent with no captured
 * value keeps its placeholders rather than being given a made-up number.
 */
export function talentDescription(
  characterClass: ClassId,
  talentId: string,
  rank: number,
): string | undefined {
  const text = talentText(characterClass, talentId);
  if (text === undefined) return undefined;
  const value = talentValue(characterClass, talentId, rank);
  if (value === undefined) return text;
  const numbers = typeof value === 'number' ? [value] : value;
  return text.replace(/\{(\d+)\}/g, (match, index) => {
    const n = numbers[Number(index)];
    return n === undefined ? match : String(n);
  });
}

/** Whether a class has any captured values at all. */
export function hasValues(characterClass: ClassId): boolean {
  return FILES[characterClass] !== undefined;
}
