/**
 * What one race is worth to one profile, isolated by SWAPPING THE RACE.
 *
 * ============================================================================
 * THE ONLY HONEST ISOLATION FOR A RACIAL, and the gear, talents, enchants,
 * consumables, raid buffs and priority list are all held fixed -- only the race
 * moves. A before-and-after against a pre-racial commit cannot separate one
 * race's contribution from the 100ms poll the list now pays, and removing an
 * item to isolate a weapon specialization removes the item's own stats too.
 *
 * THE COMPARISON RACE IS CHOSEN PER PROFILE and is printed, because there is no
 * race with no racials at all: the delta is "this race minus that one", and
 * what makes it readable is picking a comparison whose own traits are inert for
 * the build. A Human Warlock holds a staff, so Sword Specialization cannot
 * fire and only The Human Spirit's 5% is in the way.
 * ============================================================================
 */
import { PRESETS_BY_ID } from '../src/profiles/presets';
import { runProfileBatch } from '../src/simulator/runBatch';
import type { CharacterProfile } from '../src/profiles/CharacterProfile';
import type { RaceId } from '../src/game/character';

const SEEDS = Number(process.env.SEEDS ?? 30);
const ITERATIONS = Number(process.env.ITERATIONS ?? 10);

function measure(profile: CharacterProfile): { mean: number; interval: number } {
  const samples: number[] = [];
  for (let seed = 1; seed <= SEEDS; seed += 1) {
    samples.push(
      runProfileBatch({
        ...profile,
        simulation: { ...profile.simulation, seed, iterations: ITERATIONS },
      }).dps.mean,
    );
  }
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  if (samples.length < 2) return { mean, interval: NaN };
  const variance =
    samples.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / (samples.length - 1);
  return { mean, interval: 2 * Math.sqrt(variance / samples.length) };
}

const asRace = (profile: CharacterProfile, race: RaceId): CharacterProfile => ({
  ...profile,
  character: { ...profile.character, race },
});

/**
 * Each row is a profile, its own race, and a comparison race whose traits are
 * inert (or nearly) for that build.
 */
const PROBES: readonly {
  readonly preset: string;
  readonly against: RaceId;
  readonly note: string;
}[] = [
  // Touch of the Grave at 10%, against a Human whose sword clause cannot fire
  // on a staff -- so the only thing in the way is +5% spirit.
  { preset: 'warlock_firelock', against: 'human', note: 'Touch of the Grave, 10%' },
  { preset: 'warlock_smds', against: 'human', note: 'Touch of the Grave, 10%' },
  // Touch of the Grave at 5%, against a Troll: Berserking is the only thing in
  // the way and it IS cast, so this understates the drain by Berserking's worth.
  { preset: 'rogue_rupture', against: 'troll', note: 'Touch of the Grave, 5%' },
  // Blood Fury plus Axe Specialization, against a Troll's Berserking.
  { preset: 'lw_ranged', against: 'troll', note: 'Blood Fury + axe spec' },
  { preset: 'bm_hunter', against: 'troll', note: 'Blood Fury + axe spec + pet crit' },
  // Blood Fury alone: these two hold a sword and a dagger, no axe.
  { preset: 'lw_melee', against: 'troll', note: 'Blood Fury alone' },
  { preset: 'dw_fury', against: 'tauren', note: 'Blood Fury alone' },
  // Eureka! plus 5% mana, against a Human's inert sword clause on a staff.
  { preset: 'mage_fire', against: 'human', note: 'Eureka! + 5% mana' },
  { preset: 'mage_arcane', against: 'human', note: 'Eureka! + 5% mana' },
  /*
   * Tauren, against a SKYBORNE whose only live trait is +1% haste.
   *
   * NOT AGAINST A NIGHT ELF, which is what this probe did first and which
   * measured Elune's Light instead: a Night Elf Druid casts +10% crit for
   * fifteen seconds every three minutes, so all three rows came back at about
   * -12 and read as the Tauren traits being WORTH NEGATIVE DPS. A comparison
   * race has to have nothing live for the build, and the only way to know that
   * is to look at its four traits rather than to assume.
   */
  { preset: 'druid_cat', against: 'windshaper_skyborne', note: '5% health + 1% hit, vs 1% haste' },
  {
    preset: 'druid_moonkin',
    against: 'windshaper_skyborne',
    note: '5% health + 1% hit, vs 1% haste',
  },
  {
    preset: 'druid_bear',
    against: 'windshaper_skyborne',
    note: '5% health + 1% hit on a TANK, vs 1% haste',
  },
  /*
   * Human sword spec, against a DWARF -- whose Mace Specialization cannot fire
   * on a sword and whose Stoneform is in no Paladin DPS list.
   *
   * NOT AGAINST AN UNDEAD, which this probe did first: Touch of the Grave is
   * live on a Paladin at 5%, so the rows measured "+2% crit minus the drain".
   */
  { preset: 'pally_ret', against: 'dwarf', note: '+2% crit from a sword' },
  { preset: 'pally_shockadin', against: 'dwarf', note: '+2% crit from a sword' },
  { preset: 'prot_pally', against: 'dwarf', note: '+2% crit from a sword, on a TANK' },
  // Troll Berserking, against a Skyborne's 1% haste (a Druid-legal control is
  // not available to a Shaman or a Priest; a Tauren Shaman's own traits are the
  // health-and-hit pair, so the Priest uses a Night Elf instead).
  { preset: 'shaman_elemental', against: 'windshaper_skyborne', note: 'Berserking vs 1% haste' },
  { preset: 'shadow_priest', against: 'dwarf', note: 'Berserking vs an inert Dwarf' },
  // Tauren again, on the two non-Druid profiles that carry it.
  /*
   * AND NOT AGAINST A DWARF HERE, although a Dwarf is the right control for the
   * Paladins: Stoneform IS in a TANK list, so a Dwarf Prot Warrior casts it and
   * the row would measure Stoneform rather than Endurance. A Skyborne's only
   * live trait is the 1% haste in every list it appears in.
   */
  { preset: 'prot_warr', against: 'windshaper_skyborne', note: '5% health + 1% hit on a TANK' },
  { preset: 'shaman_enhancement', against: 'windshaper_skyborne', note: '5% health + 1% hit' },
];

const filters = (process.env.PROFILES ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`\nSEEDS=${SEEDS} ITERATIONS=${ITERATIONS}  (${SEEDS * ITERATIONS} fights per cell)\n`);

for (const { preset, against, note } of PROBES) {
  if (filters.length > 0 && !filters.includes(preset)) continue;
  const built = PRESETS_BY_ID.get(preset)!.build();
  const own = built.character.race;

  const mine = measure(built);
  const theirs = measure(asRace(built, against));
  const delta = mine.mean - theirs.mean;
  const combined = Math.hypot(mine.interval, theirs.interval);
  const verdict = Math.abs(delta) > combined ? 'REAL ' : 'noise';

  console.log(
    `${preset.padEnd(17)} ${own.padEnd(9)} ${mine.mean.toFixed(1).padStart(7)} ` +
      `vs ${against.padEnd(10)} ${theirs.mean.toFixed(1).padStart(7)}  ` +
      `${delta >= 0 ? '+' : ''}${delta.toFixed(1).padStart(6)} +/- ${combined.toFixed(1)} ` +
      `${verdict}  ${note}`,
  );
}
