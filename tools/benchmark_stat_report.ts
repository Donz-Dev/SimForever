import { BENCHMARK_TEMPLATES, benchmarkEquipmentFor } from '../src/game/items/benchmarkSets';
import { ITEMS_BY_ID } from '../src/game/items/itemData';
import { PRESETS_BY_ID } from '../src/profiles/presets';
import { characterAtCombatStart } from '../src/simulator';
import { RATING_PER_PERCENT } from '../src/engine';
import type { BenchStat, BenchmarkSetId } from '../src/game/items/benchmarkGear';
import { STAT_FOR_BENCH_STAT } from '../src/game/items/defaultValuation';

/**
 * WHAT EACH BENCHMARK SET ACTUALLY GRANTS.
 *
 * ==============================================================================
 * THE REPORT THE OWNER READ THREE PROBLEMS OFF, and every one of them is about
 * the SHAPE of a set rather than its total -- which is exactly what the
 * budget's own arithmetic cannot see. `item_budget.ts` asks whether an item is
 * inside its budget and every one of these was.
 *
 *   CRIT      how much a set carries, and how much of it is the two trinkets.
 *             Both trinkets are single-stat `onePrimary` slots and four of the
 *             five preference lists open with Crit, so both bought crit and
 *             the trinket multiplier made them the two largest sources.
 *   SPELL     what a caster ends up with ON THE CHARACTER. Gear is one of four
 *   POWER     layers and the owner's 750 target is the total after raid buffs,
 *             enchants and consumables, so the item figures cannot answer it.
 *   ZEROES    which of a template's own preferred stats come out at ZERO
 *             across the whole set. The owner: stats like stamina and spirit
 *             going to nothing "is unrealistic to how items are actually
 *             designed".
 *
 * SO IT PRINTS THE BUILT CHARACTER BESIDE THE ITEMS. `characterAtCombatStart`
 * is the path the character sheet reads, so a figure here is a figure the app
 * shows -- which is what makes "I was expecting 750 and I see 550" checkable
 * rather than an impression.
 *
 *   npx vite-node tools/benchmark_stat_report.ts
 *   SETS=B55,E65,E75,E85 npx vite-node tools/benchmark_stat_report.ts
 *   PROFILES=mage_fire,druid_moonkin npx vite-node tools/benchmark_stat_report.ts
 * ==============================================================================
 */

const WANTED = (process.env.SETS ?? 'E65').split(',') as BenchmarkSetId[];
const ONLY = process.env.PROFILES?.split(',');

/** The damage casters, which is what the owner's 750 target is about. */
const CASTER_PRESETS: ReadonlySet<string> = new Set([
  'druid_moonkin',
  'shaman_elemental',
  'mage_frostfire',
  'mage_arcane',
  'mage_fire',
  'warlock_smds',
  'warlock_firelock',
  'shadow_priest',
]);

interface Row {
  readonly presetId: string;
  readonly label: string;
  readonly set: string;
  readonly critRating: number;
  readonly trinketCrit: number;
  readonly gearSpellPower: number;
  readonly spellPower: number;
  readonly attackPower: number;
  readonly hitRating: number;
  readonly stamina: number;
  readonly spirit: number;
  readonly primaries: number;
  /** Preferred stats the whole set grants NOTHING of. */
  readonly zeroes: readonly BenchStat[];
}

const rows: Row[] = [];

for (const template of BENCHMARK_TEMPLATES) {
  if (ONLY && !ONLY.includes(template.presetId)) continue;
  const preset = PRESETS_BY_ID.get(template.presetId);
  if (!preset) continue;

  for (const setId of WANTED) {
    const profile = preset.build();
    const equipment = benchmarkEquipmentFor(template.presetId, setId, profile.equipment);
    if (!equipment) continue;

    // ---- off the ITEMS, which is what the generator controls ----
    let critRating = 0;
    let trinketCrit = 0;
    let gearSpellPower = 0;
    let stamina = 0;
    let spirit = 0;
    let primaries = 0;
    const totals = new Map<string, number>();
    for (const [slot, equipped] of Object.entries(equipment)) {
      const item = ITEMS_BY_ID.get(equipped!.itemId);
      if (!item) continue;
      for (const [name, value] of Object.entries(item.stats)) {
        if (typeof value === 'number') totals.set(name, (totals.get(name) ?? 0) + value);
      }
      const crit = item.stats.critRating ?? 0;
      critRating += crit;
      if (slot.startsWith('trinket')) trinketCrit += crit;
      gearSpellPower += item.stats.spellPower ?? 0;
      stamina += item.stats.stamina ?? 0;
      spirit += item.stats.spirit ?? 0;
      primaries +=
        (item.stats.strength ?? 0) +
        (item.stats.agility ?? 0) +
        (item.stats.stamina ?? 0) +
        (item.stats.intellect ?? 0) +
        (item.stats.spirit ?? 0);
    }

    /*
     * A PREFERRED STAT THE SET GRANTS NOTHING OF. `Bonus Armor` is excluded:
     * it is written as an `+N Armor` line and lands in the same `armor` stat
     * the slot's own base armour does, so it cannot be told apart here.
     */
    const zeroes = template.preferred.filter(
      (stat) => stat !== 'Bonus Armor' && (totals.get(STAT_FOR_BENCH_STAT[stat]) ?? 0) === 0,
    );

    // ---- off the CHARACTER, which is what the owner is reading ----
    const built = characterAtCombatStart({ ...profile, equipment });
    if (!built) continue;
    const stats = built.stats.effective;

    rows.push({
      presetId: template.presetId,
      label: template.label,
      set: setId,
      critRating,
      trinketCrit,
      gearSpellPower,
      spellPower: stats.spellPower,
      attackPower: stats.attackPower,
      hitRating: (stats.hitChance ?? 0) * RATING_PER_PERCENT.hit,
      stamina,
      spirit,
      primaries,
      zeroes,
    });
  }
}

const COLUMNS = [
  ['profile', 16],
  ['set', 4],
  ['crit', 6],
  ['trink', 6],
  ['crit%', 6],
  ['gearSP', 7],
  ['charSP', 7],
  ['charAP', 7],
  ['hit', 5],
  ['sta', 5],
  ['spi', 5],
  ['prim', 6],
] as const;

const head = COLUMNS.map(([name, width], i) =>
  i < 2 ? name.padEnd(width) : name.padStart(width),
).join(' ');
console.log(head);
console.log('-'.repeat(head.length));

for (const row of rows) {
  console.log(
    [
      row.label.padEnd(16),
      row.set.padEnd(4),
      row.critRating.toFixed(0).padStart(6),
      row.trinketCrit.toFixed(0).padStart(6),
      (row.critRating / RATING_PER_PERCENT.crit).toFixed(2).padStart(6),
      row.gearSpellPower.toFixed(0).padStart(7),
      row.spellPower.toFixed(0).padStart(7),
      row.attackPower.toFixed(0).padStart(7),
      row.hitRating.toFixed(0).padStart(5),
      row.stamina.toFixed(0).padStart(5),
      row.spirit.toFixed(0).padStart(5),
      row.primaries.toFixed(0).padStart(6),
    ].join(' '),
  );
}

/* -------------------------------------------------------------------------- */
/* The three questions, answered                                              */
/* -------------------------------------------------------------------------- */

const casters = rows.filter((row) => CASTER_PRESETS.has(row.presetId));
if (casters.length > 0) {
  const mean = casters.reduce((sum, row) => sum + row.spellPower, 0) / casters.length;
  const low = Math.min(...casters.map((row) => row.spellPower));
  const high = Math.max(...casters.map((row) => row.spellPower));
  console.log(
    `\nCASTER SPELL POWER on the character: mean ${mean.toFixed(0)}, ` +
      `range ${low.toFixed(0)}-${high.toFixed(0)}   (owner's target 750)`,
  );
}

const withCrit = rows.filter((row) => row.critRating > 0);
if (withCrit.length > 0) {
  const meanCrit = withCrit.reduce((sum, row) => sum + row.critRating, 0) / withCrit.length;
  const meanTrinket = withCrit.reduce((sum, row) => sum + row.trinketCrit, 0) / withCrit.length;
  console.log(
    `CRIT RATING from gear, over the ${withCrit.length} sets that buy any: ` +
      `mean ${meanCrit.toFixed(0)} (${(meanCrit / RATING_PER_PERCENT.crit).toFixed(2)}%), ` +
      `of which trinkets ${meanTrinket.toFixed(0)} ` +
      `(${(meanTrinket / RATING_PER_PERCENT.crit).toFixed(2)}%)   (owner's trinket cap 28)`,
  );
}

const zeroed = rows.filter((row) => row.zeroes.length > 0);
console.log(
  `\nPREFERRED STATS A WHOLE SET GRANTS NOTHING OF: ${zeroed.length} of ${rows.length} sets`,
);
for (const row of zeroed) {
  console.log(`  ${row.label.padEnd(16)} ${row.set.padEnd(4)} ${row.zeroes.join(', ')}`);
}
