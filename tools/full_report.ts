/*
 * ==============================================================================
 * THE FULL REPORT (round 78): every preset in the encounters the owner reports
 * it in, by its role's own figure.
 *
 *   DPS profiles   DPS at  1 target 120s | 3 targets 60s | 5 targets 60s | 8 targets 30s
 *   tanks          TPS at  the same four
 *   healers        HPS in  the tank healer fight 120s | the raid healer fight 60s
 *
 *   OUT=report.json npx vite-node tools/full_report.ts          # 300 fights a cell
 *   ITER=100 PROFILES=dw_fury,prot_warr npx vite-node tools/full_report.ts
 *   BEFORE=old.json OUT=new.json npx vite-node tools/full_report.ts   # and the change
 *   HTML=report.html IN=new.json npx vite-node tools/full_report_page.ts
 *
 * Every preset at its own gear (E65), raid buffs and consumables. More than one
 * target runs the preset's Multi Target section, as the app does; a tank's adds
 * swing for 500 every 2 seconds. Each cell is a mean over ITER fights on the
 * ITER seeds `deriveSeed(SEED, i)` gives, with a 95% interval.
 * ==============================================================================
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { PROFILE_PRESETS } from '../src/profiles';
import type { CharacterProfile } from '../src/profiles';
import { presetRole } from '../src/profiles/presetRoles';
import type { PresetRole } from '../src/profiles/presetRoles';
import { healerSamples, profileSamples } from '../src/simulator/iterationSamples';
import type { HealerFight } from '../src/simulator/healerEncounter';

const ITER = Number(process.env.ITER ?? 300);
const SEED = Number(process.env.SEED ?? 20261025);
const WANTED = process.env.PROFILES?.split(',').map((s) => s.trim());
const OUT = process.env.OUT;
const BEFORE = process.env.BEFORE;

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

function cellOf(values: readonly number[], deaths: readonly number[]): ReportCell {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1);
  return {
    mean,
    interval: (1.96 * Math.sqrt(variance)) / Math.sqrt(n),
    deaths: deaths.reduce((a, b) => a + b, 0) / n,
  };
}

function withEncounter(profile: CharacterProfile, column: ReportColumn): CharacterProfile {
  return {
    ...profile,
    simulation: { ...profile.simulation, durationSeconds: column.seconds },
    encounter: { ...profile.encounter, ...(column.targets ? { numberOfTargets: column.targets } : {}) },
  };
}

// The run. `full_report_page.ts` imports only this file's types, which erase.
{
  const before: Report | undefined = BEFORE ? JSON.parse(readFileSync(BEFORE, 'utf8')) : undefined;
  const slice = { from: 0, to: ITER };
  const rows: ReportRow[] = [];

  for (const preset of PROFILE_PRESETS) {
    if (WANTED && !WANTED.includes(preset.id)) continue;
    const base = preset.build();
    const role = presetRole(preset.id);
    const metric = role === 'healer' ? 'hps' : role === 'tank' ? 'tps' : 'dps';
    const columns = role === 'healer' ? HEALER_COLUMNS : COMBAT_COLUMNS;
    const prior = before?.rows.find((row) => row.id === preset.id);
    const cells: Record<string, ReportCell> = {};
    const line: string[] = [];
    for (const column of columns) {
      const profile = withEncounter(base, column);
      const samples = column.fight
        ? healerSamples(profile, column.fight, SEED, slice)
        : profileSamples(profile, SEED, slice);
      const cell = cellOf(samples[metric], samples.deaths);
      const was = prior?.cells[column.id]?.mean;
      cells[column.id] = was === undefined ? cell : { ...cell, before: was };
      line.push(
        `${column.id} ${cell.mean.toFixed(1)}` + (was === undefined ? '' : ` (${cell.mean - was >= 0 ? '+' : ''}${(cell.mean - was).toFixed(1)})`),
      );
    }
    rows.push({ id: preset.id, name: base.character.name, characterClass: preset.characterClass, role, metric, cells });
    console.log(`${base.character.name.padEnd(16)} ${metric.toUpperCase()}  ${line.join('  ')}`);
  }

  if (OUT) {
    const report: Report = { iterations: ITER, seed: SEED, generated: new Date().toISOString(), rows };
    writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(`\nWrote ${rows.length} profiles to ${OUT}`);
  }
}
