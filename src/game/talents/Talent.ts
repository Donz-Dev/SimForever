/**
 * A talent tree's id, slugified from its display name: `feral_combat`.
 *
 * A plain string rather than a union, because there are twenty-seven of them
 * across nine classes and they come from data rather than from code. The class
 * they belong to is what makes one unambiguous.
 */
export type TalentTreeId = string;

/**
 * One talent, as the tree draws it.
 *
 * Position is `row` and `col` on a four-wide grid, exactly as the source
 * calculator lays it out. Empty cells are simply absent rather than being
 * represented as blanks, so the grid is drawn from the positions rather than
 * from a dense array with holes in it.
 */
export interface Talent {
  /** Slugified name. UNIQUE WITHIN A CLASS, not across classes. */
  readonly id: string;
  readonly name: string;
  readonly tree: TalentTreeId;
  readonly row: number;
  readonly col: number;
  /** Maximum points that can be spent in it. */
  readonly ranks: number;
  /** Points needed in this tree before it unlocks. Row 0 talents need none. */
  readonly tier: number;
  /**
   * A talent that must be at full rank first, by id.
   *
   * Usually directly above; sometimes BESIDE, on the same row. The Paladin's
   * Divine Precision and the Priest's Improved Mind Flay both point sideways at
   * their neighbour, which is the arrow the calculator draws.
   */
  readonly requires?: string;
  /** Points needed in `requires`, which is always that talent's full rank. */
  readonly requiresRanks?: number;
  /** Icon name on the shared WoW icon CDN. */
  readonly icon: string;
  /** Rank one text, as the source states it. */
  readonly description: string;
}

export interface TalentTree {
  readonly id: TalentTreeId;
  readonly name: string;
  readonly talents: readonly Talent[];
}

/**
 * Everything one class's talents amount to.
 *
 * Carries its own `byId` index because TALENT IDS ARE NOT UNIQUE ACROSS
 * CLASSES -- `deflection` belongs to the Hunter, Paladin, Rogue and Warrior,
 * and `toughness` to three more. A single global map would silently answer with
 * whichever class happened to load last.
 */
export interface ClassTalents {
  readonly classId: string;
  /** Where the data came from, for anyone checking a number. */
  readonly source: string;
  readonly trees: readonly TalentTree[];
  readonly byId: ReadonlyMap<string, Talent>;
}

/** Total talent points a level 60 character has to spend. */
export const TOTAL_TALENT_POINTS = 51;

/** Points needed in a tree before each row unlocks: row index times five. */
export const POINTS_PER_TIER = 5;

/** How many points a talent currently has, by talent id. */
export type TalentAllocation = Readonly<Record<string, number>>;
