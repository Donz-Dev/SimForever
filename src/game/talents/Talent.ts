/** The three Warrior talent trees. */
export type WarriorTreeId = 'arms' | 'fury' | 'protection';

/**
 * One talent, as the tree draws it.
 *
 * Position is `row` and `col` on a four-wide grid, exactly as the source
 * calculator lays it out. Empty cells are simply absent rather than being
 * represented as blanks, so the grid is drawn from the positions rather than
 * from a dense array with holes in it.
 */
export interface Talent {
  readonly id: string;
  readonly name: string;
  readonly tree: WarriorTreeId;
  readonly row: number;
  readonly col: number;
  /** Maximum points that can be spent in it. */
  readonly ranks: number;
  /** Points needed in this tree before it unlocks. Row 0 talents need none. */
  readonly tier: number;
  /** A talent that must be maxed first, by id. */
  readonly requires?: string;
  /** Points needed in `requires`, when there is one. */
  readonly requiresRanks?: number;
  /** Icon name on the shared WoW icon CDN. */
  readonly icon: string;
  /** Rank one text, as the source states it. */
  readonly description: string;
}

/** Total talent points a level 60 character has to spend. */
export const TOTAL_TALENT_POINTS = 51;

/** Points needed in a tree before each row unlocks: row index times five. */
export const POINTS_PER_TIER = 5;

/** How many points a talent currently has, by talent id. */
export type TalentAllocation = Readonly<Record<string, number>>;
