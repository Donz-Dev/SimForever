/*
 * ============================================================================
 * THE EDITS A BUILD VARIANT IS MADE OF, shared by every class's variant file.
 *
 * `probe_build.ts` measures a variant as a PAIRED difference against the
 * preset it came from. What goes wrong is not the arithmetic -- it is the edit:
 * an enchant written into a slot with no item, a talent allocation the game
 * would refuse, an APL change `syncDefaultRotation` silently throws away. Each
 * of those produces an ordinary figure and a wrong one.
 *
 * So every helper here FAILS LOUDLY rather than returning something plausible.
 * ============================================================================
 */
import type { CharacterProfile } from '../src/profiles';
import type { ClassId } from '../src/game/character';
import type { TalentAllocation } from '../src/game/talents/Talent';
import { legalAllocation } from '../src/game/talents/talentRules';
import { talentsForClass } from '../src/game/talents/talentData';
import type { EquipmentSlot } from '../src/game/items/Item';
import type { AplEntry } from '../src/game/rotations/apl';

export type Apply = (profile: CharacterProfile) => CharacterProfile;

export interface Variant {
  readonly label: string;
  readonly apply: Apply;
}

export const TOTAL_TALENT_POINTS = 51;

/** Put an enchant in a slot, refusing a slot this build does not fill. */
export const enchant =
  (slot: EquipmentSlot, enchantId: number): Apply =>
  (profile) => {
    const equipped = profile.equipment[slot];
    if (!equipped) throw new Error(`no item in ${slot}`);
    return {
      ...profile,
      equipment: { ...profile.equipment, [slot]: { ...equipped, enchantId } },
    };
  };

export const consumable =
  (category: string, id: string): Apply =>
  (profile) => ({
    ...profile,
    consumables: { ...profile.consumables, [category]: id },
  });

/**
 * A WHOLE tree, checked against the game's rules before a fight is run.
 *
 * ==============================================================================
 * A DELTA WOULD BE EASIER TO WRITE AND IS THE WRONG SHAPE. A tier requirement
 * counts points in STRICTLY LOWER tiers (`pointsBelowTier`), so moving one point
 * can strand a talent five rows down -- and `createPlayer` strips an illegal
 * talent SILENTLY, which means the variant measures a build nobody chose and
 * reports it as a finding.
 *
 * THIS PROJECT HAS PAID FOR BOTH HALVES. The Druid's isolation probe removed
 * three points and took a capstone with them; the Shockadin's optimised tree was
 * illegal in game and nothing here noticed until the build URL was pasted into
 * talentsforever.com. So the allocation is written out in full and this throws
 * on anything the rules would refuse.
 * ==============================================================================
 */
export const treeFor =
  (characterClass: ClassId) =>
  (allocation: TalentAllocation): Apply =>
  (profile) => {
    const talents = talentsForClass(characterClass);
    if (!talents) throw new Error(`no talent data for ${characterClass}`);
    const { allocation: legal, dropped } = legalAllocation(talents, allocation);
    const total = Object.values(legal).reduce((a, b) => a + b, 0);
    const wanted = Object.values(allocation).reduce((a, b) => a + b, 0);
    if (dropped.length > 0 || total !== TOTAL_TALENT_POINTS || wanted !== TOTAL_TALENT_POINTS) {
      throw new Error(
        `illegal tree: wanted ${wanted} legal ${total} dropped [${dropped.join(', ')}]`,
      );
    }
    return { ...profile, talents: legal };
  };

/*
 * AN APL EDIT MARKS THE LIST `custom`, which is not cosmetic: the probe runs
 * `syncDefaultRotation` after every variant -- because a talent change moves
 * which stock list applies -- and that would re-derive a `default` list and
 * silently throw the edit away.
 */
export const apl =
  (edit: (entries: AplEntry[]) => AplEntry[]): Apply =>
  (profile) => ({
    ...profile,
    rotation: {
      ...profile.rotation,
      source: 'custom',
      entries: edit([...profile.rotation.entries]),
    },
  });

const indexOf = (entries: readonly AplEntry[], id: string) => {
  const at = entries.findIndex((entry) => entry.abilityId === id);
  if (at < 0) throw new Error(`no entry for ${id}`);
  return at;
};

/** Move `id` so it sits immediately above `beforeId`. */
export const moveAbove = (id: string, beforeId: string): Apply =>
  apl((entries) => {
    const [entry] = entries.splice(indexOf(entries, id), 1);
    entries.splice(indexOf(entries, beforeId), 0, entry);
    return entries;
  });

export const moveToBottom = (id: string): Apply =>
  apl((entries) => {
    const [entry] = entries.splice(indexOf(entries, id), 1);
    entries.push(entry);
    return entries;
  });

export const removeEntry = (id: string): Apply =>
  apl((entries) => {
    indexOf(entries, id); // throws if it is not there to remove
    return entries.filter((entry) => entry.abilityId !== id);
  });

/** Add an entry at the bottom, which is the only position that changes nothing above it. */
export const addEntry = (entry: AplEntry): Apply =>
  apl((entries) => [...entries, entry]);

/** Add an entry immediately above `beforeId`. */
export const addAbove = (entry: AplEntry, beforeId: string): Apply =>
  apl((entries) => {
    entries.splice(indexOf(entries, beforeId), 0, entry);
    return entries;
  });

export const chain =
  (...applies: readonly Apply[]): Apply =>
  (profile) =>
    applies.reduce((p, f) => f(p), profile);

/*
 * The per-class tree builders, named here so a variant file says `tree({...})`
 * and cannot accidentally check a Hunter allocation against the Paladin's.
 */
export const PALADIN_TREE = treeFor('paladin');
export const HUNTER_TREE = treeFor('hunter');
export const DRUID_TREE = treeFor('druid');
