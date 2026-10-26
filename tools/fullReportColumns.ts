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
}

export const COMBAT_COLUMNS: readonly ReportColumn[] = [
  { id: 't1', label: 'Single Target (2 min)', seconds: 120, targets: 1 },
  { id: 't3', label: '3 Targets (1 min)', seconds: 60, targets: 3 },
  { id: 't5', label: '5 Targets (1 min)', seconds: 60, targets: 5 },
  { id: 't8', label: '8 Targets (30 sec)', seconds: 30, targets: 8 },
];
export const HEALER_COLUMNS: readonly ReportColumn[] = [
  { id: 'tank', label: 'Tank Healer (2 min)', seconds: 120, fight: 'tank' },
  { id: 'raid', label: 'Raid Healer (1 min)', seconds: 60, fight: 'raid' },
];

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

