import type { ClassTalents, Talent, TalentTree } from './Talent';
import { POINTS_PER_TIER } from './Talent';
import type { ClassId } from '../character';

import druid from '../../data/talents/druid.json';
import hunter from '../../data/talents/hunter.json';
import mage from '../../data/talents/mage.json';
import paladin from '../../data/talents/paladin.json';
import priest from '../../data/talents/priest.json';
import rogue from '../../data/talents/rogue.json';
import shaman from '../../data/talents/shaman.json';
import warlock from '../../data/talents/warlock.json';
import warrior from '../../data/talents/warrior.json';

/**
 * Talent trees for every class.
 *
 * Source: the World of Warcraft: Forever talent calculators at
 * https://www.wowhead.com/forever/talent-calc/<class>
 *
 * The JSON under `src/data/talents` was read out of each calculator's own
 * rendered grid rather than transcribed, and each file was checked against a
 * SHA-256 of the extracted text before being written, so the rows, columns,
 * rank caps, tier requirements and prerequisites here are the ones those pages
 * draw. 470 talents across 27 trees.
 *
 * NO TALENT HAS ANY EFFECT ON A SIMULATION. These are names, positions and
 * text. Spending a point changes what the interface shows and nothing else.
 * This is the tree, not the talents.
 */

/** Slugify a display name into the id used everywhere else. */
export function talentId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** The shape the JSON files are in, before ids are resolved. */
interface RawTalent {
  readonly row: number;
  readonly col: number;
  readonly ranks: number;
  readonly name: string;
  readonly icon: string;
  readonly tier: number;
  readonly requires: string | null;
  readonly requiresRanks: number | null;
  readonly description: string;
}

interface RawClass {
  readonly class: string;
  readonly source: string;
  readonly trees: readonly { readonly id: string; readonly name: string; readonly talents: readonly RawTalent[] }[];
}

/**
 * Turn one class's raw JSON into resolved talents, checking it on the way.
 *
 * The checks run at module load rather than in a test alone, because this data
 * arrives from a scrape: a page that changes shape should fail loudly here
 * rather than produce a tree with a silently broken arrow. It is 470 entries,
 * so the cost is nothing.
 */
function build(raw: RawClass): ClassTalents {
  const trees: TalentTree[] = raw.trees.map((tree) => {
    const talents: Talent[] = tree.talents.map((t) => {
      if (t.tier !== t.row * POINTS_PER_TIER) {
        throw new Error(`${raw.class}/${t.name}: tier ${t.tier} does not match row ${t.row}`);
      }
      return {
        id: talentId(t.name),
        name: t.name,
        tree: tree.id,
        row: t.row,
        col: t.col,
        ranks: t.ranks,
        tier: t.tier,
        ...(t.requires
          ? { requires: talentId(t.requires), requiresRanks: t.requiresRanks ?? 1 }
          : {}),
        icon: t.icon,
        description: t.description,
      };
    });

    // A prerequisite always sits in the same tree, and never below the talent
    // that needs it -- though it may sit BESIDE it, which two classes do.
    const byId = new Map(talents.map((talent) => [talent.id, talent]));
    for (const talent of talents) {
      if (!talent.requires) continue;
      const prereq = byId.get(talent.requires);
      if (!prereq) {
        throw new Error(`${raw.class}/${talent.name}: requires unknown ${talent.requires}`);
      }
      if (prereq.row > talent.row) {
        throw new Error(`${raw.class}/${talent.name}: requires ${prereq.name} from below it`);
      }
    }

    return { id: tree.id, name: tree.name, talents };
  });

  const byId = new Map<string, Talent>();
  for (const tree of trees) {
    for (const talent of tree.talents) {
      if (byId.has(talent.id)) {
        throw new Error(`${raw.class}: two talents share the id ${talent.id}`);
      }
      byId.set(talent.id, talent);
    }
  }

  return { classId: raw.class, source: raw.source, trees, byId };
}

const BY_CLASS: ReadonlyMap<string, ClassTalents> = new Map(
  ([druid, hunter, mage, paladin, priest, rogue, shaman, warlock, warrior] as RawClass[]).map(
    (raw) => [raw.class, build(raw)] as const,
  ),
);

/** The talents a class has, or undefined if none are loaded for it. */
export function talentsForClass(characterClass: ClassId): ClassTalents | undefined {
  return BY_CLASS.get(characterClass);
}

/** Every class that has talent data. All nine, currently. */
export function classesWithTalents(): readonly string[] {
  return [...BY_CLASS.keys()].sort();
}

/**
 * Accent colour for a tree, by its position in the class.
 *
 * Keyed on position rather than on tree name so that twenty-seven trees do not
 * each need a hand-picked colour. The order matches the calculator's own, which
 * for most classes runs caster, melee, support.
 */
export const TREE_ACCENTS: readonly string[] = ['#b4622a', '#a33b2a', '#3a6f93'];

export function accentFor(index: number): string {
  return TREE_ACCENTS[index % TREE_ACCENTS.length];
}
