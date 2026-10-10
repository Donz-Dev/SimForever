/*
 * ============================================================================
 * THE PER-CLASS AUDIT: everything one class's deep dive starts from.
 *
 *     npx vite-node tools/class_audit.ts               # all nine
 *     npx vite-node tools/class_audit.ts warrior       # one
 *     npx vite-node tools/class_audit.ts --json
 *
 * ----------------------------------------------------------------------------
 * WHY A TOOL AND NOT NINE HAND-WRITTEN LISTS. The per-class handoff documents in
 * `docs/handoff/` quote these figures, and a figure written by hand into a
 * document is a claim with a date on it -- this project has been caught six
 * times by a caveat that stopped being true while nobody touched it. Each
 * document names this command so its numbers can be re-derived rather than
 * trusted.
 *
 * IT READS THE EFFECT TABLES, NOT THE TALENT JSON. Whether a talent is a live
 * gap or a permanent ruling is decided by whether its `unmodelled` entry carries
 * a `scope`, which is data and mechanical. Counting "unmodelled" alone inflates
 * the queue by the 89 that are never coming.
 * ============================================================================
 */
import { WARRIOR_TALENT_EFFECTS } from '../src/game/talents/warriorEffects';
import { ROGUE_TALENT_EFFECTS } from '../src/game/talents/rogueEffects';
import { DRUID_TALENT_EFFECTS } from '../src/game/talents/druidEffects';
import { SHAMAN_TALENT_EFFECTS } from '../src/game/talents/shamanEffects';
import { MAGE_TALENT_EFFECTS } from '../src/game/talents/mageEffects';
import { PALADIN_TALENT_EFFECTS } from '../src/game/talents/paladinEffects';
import { HUNTER_TALENT_EFFECTS } from '../src/game/talents/hunterEffects';
import { WARLOCK_TALENT_EFFECTS } from '../src/game/talents/warlockEffects';
import { PRIEST_TALENT_EFFECTS } from '../src/game/talents/priestEffects';
import type { TalentEffects } from '../src/game/talents/TalentEffect';
import { PROFILE_PRESETS } from '../src/profiles/presets';
import { ALL_PRIORITY_LISTS } from '../src/game/rotations/allLists';
import { characterAtCombatStart, runProfileBatch } from '../src/simulator';
import { classifyTalent } from '../src/game/talents/talentCensus';

const TABLES: Readonly<Record<string, Readonly<Record<string, TalentEffects>>>> = {
  warrior: WARRIOR_TALENT_EFFECTS,
  rogue: ROGUE_TALENT_EFFECTS,
  druid: DRUID_TALENT_EFFECTS,
  shaman: SHAMAN_TALENT_EFFECTS,
  mage: MAGE_TALENT_EFFECTS,
  paladin: PALADIN_TALENT_EFFECTS,
  hunter: HUNTER_TALENT_EFFECTS,
  warlock: WARLOCK_TALENT_EFFECTS,
  priest: PRIEST_TALENT_EFFECTS,
};

const AS_JSON = process.argv.includes('--json');
const ITERATIONS = Number(process.env.ITERATIONS ?? 10);
const WANTED = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));

interface TalentRow {
  readonly id: string;
  /** No `unmodelled` entry at all: every clause is expressed. */
  readonly fully: boolean;
  /** Some clauses expressed and some not. */
  readonly partly: boolean;
  /** The owner's permanent ruling, by `scope`. */
  readonly ruledOut: boolean;
  /** A real remaining gap. */
  readonly liveGap: boolean;
  readonly reasons: readonly string[];
  readonly scopes: readonly string[];
}

function talentsOf(className: string): TalentRow[] {
  const table = TABLES[className]!;
  /*
   * THE CLASSIFICATION IS SHARED WITH `tools/census.ts` NOW, in
   * `game/talents/talentCensus.ts`. It used to live here and census.ts carried
   * its own copy, which left out `appliedElsewhere` -- so a scoped clause on a
   * working Rogue poison talent made the two tools disagree, and the published
   * figure would have been whichever was run last. One rule, one place.
   */
  return Object.entries(table).map(([id, effects]) => {
    const { bucket, reasons, scopes } = classifyTalent(id, effects);
    return {
      id,
      fully: bucket === 'fully',
      partly: bucket === 'partly',
      ruledOut: bucket === 'ruledOut',
      liveGap: bucket === 'liveGap',
      reasons,
      scopes,
    };
  });
}

interface ProfileRow {
  readonly presetId: string;
  readonly label: string;
  readonly rotation: string;
  readonly listName: string;
  readonly dps: number;
  readonly entriesNeverFired: readonly string[];
  readonly inBookNeverCast: readonly string[];
  readonly topSources: readonly { name: string; share: number }[];
  readonly shareTotal: number;
}

function profilesOf(className: string): ProfileRow[] {
  const rows: ProfileRow[] = [];
  for (const preset of PROFILE_PRESETS) {
    const profile = preset.build();
    if (profile.character.characterClass !== className) continue;
    const batch = runProfileBatch({
      ...profile,
      simulation: { ...profile.simulation, seed: 12345, iterations: ITERATIONS },
    });
    const record = ALL_PRIORITY_LISTS.find((row) => row.profiles.includes(preset.id));
    const book = characterAtCombatStart(profile)?.abilities.all ?? [];
    const byName = new Map(batch.abilities.map((row) => [row.abilityName, row]));

    const neverFired: string[] = [];
    for (const entry of record?.list.entries ?? []) {
      const ability = book.find((candidate) => candidate.id === entry.abilityId);
      const row = ability ? byName.get(ability.name) : undefined;
      if ((row?.uses ?? 0) === 0 && !neverFired.includes(entry.abilityId)) {
        neverFired.push(entry.abilityId);
      }
    }
    const listedIds = new Set(record?.list.entries.map((entry) => entry.abilityId) ?? []);
    const inBookOnly = book
      .filter((ability) => {
        const row = byName.get(ability.name);
        return !listedIds.has(ability.id) && (row?.uses ?? 0) === 0 && (row?.damage ?? 0) === 0;
      })
      .map((ability) => ability.id);

    rows.push({
      presetId: preset.id,
      label: preset.label,
      rotation: batch.rotationName ?? 'NO ROTATION',
      listName: record?.name ?? 'unregistered',
      dps: batch.dps.mean,
      entriesNeverFired: neverFired,
      inBookNeverCast: inBookOnly,
      topSources: [...batch.abilities]
        .filter((row) => row.damage > 0)
        .sort((a, b) => b.share - a.share)
        .slice(0, 6)
        .map((row) => ({ name: row.abilityName, share: row.share })),
      shareTotal: batch.abilities.reduce((sum, row) => sum + row.share, 0),
    });
  }
  return rows;
}

const classes = WANTED.length > 0 ? WANTED : Object.keys(TABLES);
const report = classes.map((className) => {
  const talents = talentsOf(className);
  const counted =
    talents.filter((t) => t.fully).length +
    talents.filter((t) => t.partly).length +
    talents.filter((t) => t.ruledOut).length +
    talents.filter((t) => t.liveGap).length;
  if (counted !== talents.length) {
    throw new Error(
      `${className}: classified ${counted} of ${talents.length} talents -- the four ` +
        `buckets must be exhaustive and disjoint, and a talent falling through ` +
        `reads as a smaller queue than there is.`,
    );
  }
  return {
    className,
    talentCount: talents.length,
    fully: talents.filter((t) => t.fully).length,
    partly: talents.filter((t) => t.partly).length,
    ruledOut: talents.filter((t) => t.ruledOut).length,
    liveGap: talents.filter((t) => t.liveGap).length,
    liveGaps: talents.filter((t) => t.liveGap).map((t) => ({ id: t.id, reason: t.reasons[0] ?? '' })),
    partlyModelled: talents.filter((t) => t.partly).map((t) => ({ id: t.id, reason: t.reasons[0] ?? '' })),
    profiles: profilesOf(className),
  };
});

if (AS_JSON) {
  console.log(JSON.stringify({ report }, null, 1));
} else {
  for (const entry of report) {
    console.log(`\n${'='.repeat(74)}`);
    console.log(`${entry.className.toUpperCase()}  --  ${entry.talentCount} talents`);
    console.log('='.repeat(74));
    console.log(
      `  fully ${entry.fully}   partly ${entry.partly}   ruled out ${entry.ruledOut}   LIVE GAP ${entry.liveGap}`,
    );

    for (const profile of entry.profiles) {
      const bad = Math.abs(profile.shareTotal - 1) > 0.005 ? `  SHARES ${(profile.shareTotal * 100).toFixed(1)}%` : '';
      console.log(`\n  ${profile.label}  ${profile.dps.toFixed(1)} DPS  (${profile.listName})${bad}`);
      console.log(
        `    top sources: ` +
          profile.topSources.map((s) => `${s.name} ${(s.share * 100).toFixed(1)}%`).join(', '),
      );
      if (profile.entriesNeverFired.length > 0) {
        console.log(`    LIST ENTRIES NEVER FIRED: ${profile.entriesNeverFired.join(', ')}`);
      }
      if (profile.inBookNeverCast.length > 0) {
        console.log(`    in book, never cast: ${profile.inBookNeverCast.join(', ')}`);
      }
    }

    if (entry.liveGaps.length > 0) {
      console.log(`\n  LIVE GAPS (${entry.liveGaps.length}):`);
      for (const gap of entry.liveGaps) {
        console.log(`    ${gap.id.padEnd(28)} ${gap.reason.slice(0, 90)}`);
      }
    }
    if (entry.partlyModelled.length > 0) {
      console.log(`\n  PARTLY MODELLED (${entry.partlyModelled.length}):`);
      for (const gap of entry.partlyModelled) {
        console.log(`    ${gap.id.padEnd(28)} ${gap.reason.slice(0, 90)}`);
      }
    }
  }
}
