/*
 * The full report's columns and its JSON shape (round 78), apart from the tool
 * that measures them so the page renderer can import them without running it.
 */
import type { PresetRole } from '../src/profiles/presetRoles';
import type { HealerFight } from '../src/simulator/healerEncounter';

/** A column of the report: an encounter and the figure read off it. */
export interface ReportColumn {
  readonly id: string;
  readonly label: string;
  readonly seconds: number;
  readonly targets?: number;
  readonly fight?: HealerFight;
  /**
   * The column's share of the WEIGHTED SCORE (round 79), the owner's: single
   * target 49% and 3, 5 and 8 targets 17% each for a DPS or tank profile, and
   * the two healer fights half each. The score is what a talent build is chosen
   * on, because talents cannot change between fights and a list can.
   */
  readonly weight: number;
}

export const COMBAT_COLUMNS: readonly ReportColumn[] = [
  { id: 't1', label: 'Single Target (2 min)', seconds: 120, targets: 1, weight: 0.49 },
  { id: 't3', label: '3 Targets (1 min)', seconds: 60, targets: 3, weight: 0.17 },
  { id: 't5', label: '5 Targets (1 min)', seconds: 60, targets: 5, weight: 0.17 },
  { id: 't8', label: '8 Targets (30 sec)', seconds: 30, targets: 8, weight: 0.17 },
];
export const HEALER_COLUMNS: readonly ReportColumn[] = [
  { id: 'tank', label: 'Tank Healer (2 min)', seconds: 120, fight: 'tank', weight: 0.5 },
  { id: 'raid', label: 'Raid Healer (1 min)', seconds: 60, fight: 'raid', weight: 0.5 },
];

/** The id the weighted score is stored under, beside the encounter cells. */
export const WEIGHTED_CELL_ID = 'weighted';

/**
 * A weighted score from per-column means and intervals. The interval treats
 * the columns as independent, which they are: each is its own set of fights.
 */
export function weightedOf(
  columns: readonly ReportColumn[],
  cells: Readonly<Record<string, { readonly mean: number; readonly interval: number; readonly before?: number }>>,
): { mean: number; interval: number; before?: number } {
  let mean = 0;
  let variance = 0;
  let before = 0;
  let hasBefore = true;
  for (const column of columns) {
    const cell = cells[column.id];
    mean += column.weight * cell.mean;
    variance += (column.weight * cell.interval) ** 2;
    if (cell.before === undefined) hasBefore = false;
    else before += column.weight * cell.before;
  }
  return { mean, interval: Math.sqrt(variance), ...(hasBefore ? { before } : {}) };
}

export interface ReportCell {
  readonly mean: number;
  /** Half-width of the 95% interval on the mean. */
  readonly interval: number;
  /** Mean deaths of the player -- a tank's secondary figure. */
  readonly deaths: number;
  /** The figure before this round's optimisation, when BEFORE= was given. */
  readonly before?: number;
}

export interface ReportRow {
  readonly id: string;
  readonly name: string;
  readonly characterClass: string;
  readonly role: PresetRole;
  readonly metric: 'dps' | 'tps' | 'hps';
  readonly cells: Readonly<Record<string, ReportCell>>;
}

export interface Report {
  readonly iterations: number;
  readonly seed: number;
  readonly generated: string;
  readonly rows: readonly ReportRow[];
}

