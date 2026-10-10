/**
 * Does each racial MECHANISM actually do its thing?
 *
 * ============================================================================
 * THIS IS A DIAGNOSTIC, NOT A MEASUREMENT, and it exists because a DPS figure
 * cannot answer the question it asks. Adrenaline Rush was cast, spent its
 * cooldown, applied its aura and reported 24.9% uptime for the whole project
 * while delivering no energy whatsoever -- "an inert buff with visible uptime
 * is the hardest kind to find, because the results page shows it working".
 *
 * So for each racial this prints the MECHANISM'S OWN QUANTITY: the casts, the
 * procs, the charges spent, the stat that arrived, the pet's crit. A racial
 * that is wired up and worth nothing shows a real number here; one that is not
 * wired up shows a zero, and the two are indistinguishable from a mean.
 * ============================================================================
 */
import { PRESETS_BY_ID } from '../src/profiles/presets';
import { characterAtCombatStart } from '../src/simulator';
import { trainingDummyEncounter } from '../src/simulator/trainingDummyEncounter';
import { Simulation, TelemetryRecorder } from '../src/engine';
import { RACIALS } from '../src/game/racials';
import { getRace } from '../src/game/character';

const ITERATIONS = 40;
const SEED = 918_273;

/** Everything a fight emitted, as a count by (type, ability). */
function tally(presetId: string): {
  readonly casts: Map<string, number>;
  readonly damage: Map<string, number>;
  readonly heals: number;
  readonly fights: number;
} {
  const casts = new Map<string, number>();
  const damage = new Map<string, number>();
  let heals = 0;

  for (let i = 0; i < ITERATIONS; i += 1) {
    const built = PRESETS_BY_ID.get(presetId)!.build();
    const recorder = new TelemetryRecorder();
    const simulation = new Simulation(
      { ...trainingDummyEncounter(built), seed: SEED + i },
      recorder,
    );
    simulation.run();
    for (const event of recorder.all) {
      if (event.type === 'cast' && event.abilityId) {
        casts.set(event.abilityId, (casts.get(event.abilityId) ?? 0) + 1);
      }
      if (event.type === 'damage' && event.abilityId) {
        damage.set(event.abilityId, (damage.get(event.abilityId) ?? 0) + 1);
      }
      if (event.type === 'heal' && event.abilityId === 'touch_of_the_grave') heals += 1;
    }
  }
  return { casts, damage, heals, fights: ITERATIONS };
}

const PROBES: readonly { readonly preset: string; readonly note: string }[] = [
  { preset: 'dw_fury', note: 'Orc, two swords -- Blood Fury only, NO axe' },
  { preset: 'lw_melee', note: 'Orc, Dreadforge Retaliator -- axe spec AND Blood Fury' },
  { preset: 'bm_hunter', note: 'Orc, axe as a STAT STICK, and a pet' },
  { preset: 'shaman_elemental', note: 'Troll -- Berserking' },
  { preset: 'shadow_priest', note: 'Troll -- Berserking' },
  { preset: 'mage_arcane', note: 'Gnome -- Eureka!, and a channel' },
  { preset: 'mage_fire', note: 'Gnome -- Eureka!, and periodic damage' },
  { preset: 'rogue_rupture', note: 'Undead, 5% -- Touch of the Grave' },
  { preset: 'warlock_smds', note: 'Undead, 10% -- Touch of the Grave' },
  { preset: 'pally_ret', note: 'Human, Azuresong Mageblade -- sword spec' },
  { preset: 'druid_cat', note: 'Tauren -- health and hit, no active' },
  { preset: 'prot_warr', note: 'Tauren tank -- health changes RAGE too' },
];

console.log(`Racial probe: ${ITERATIONS} fights per profile, seed ${SEED}\n`);

for (const { preset, note } of PROBES) {
  const built = PRESETS_BY_ID.get(preset)!.build();
  const race = built.character.race;
  const snapshot = characterAtCombatStart(built)!;
  const { casts, damage, heals, fights } = tally(preset);

  console.log(`=== ${preset}  [${getRace(race)?.name}]  ${note}`);
  console.log(
    `    crit ${snapshot.stats.effective.critChance.toFixed(3)}  ` +
      `spellCrit ${snapshot.stats.effective.spellCritChance.toFixed(3)}  ` +
      `hit ${snapshot.stats.effective.hitChance.toFixed(2)}  ` +
      `health ${snapshot.health.maximum}  ` +
      `haste ${snapshot.stats.effective.hasteRating.toFixed(0)}  ` +
      `spirit ${snapshot.stats.effective.spirit.toFixed(2)}`,
  );
  for (const resource of snapshot.resources.all) {
    if (resource.type === 'health') continue;
    console.log(`    pool ${resource.type}: max ${resource.maximum}`);
  }

  // Every racial ability the race grants, and whether the list ever cast it.
  for (const trait of RACIALS[race].traits) {
    for (const effect of trait.effects) {
      if (effect.kind !== 'grantAbility') continue;
      const n = casts.get(effect.abilityId) ?? 0;
      console.log(
        `    ${trait.name}: ${(n / fights).toFixed(2)} casts a fight` +
          (n === 0 ? '   <-- NEVER FIRED' : ''),
      );
    }
    for (const effect of trait.effects) {
      if (effect.kind !== 'reaction') continue;
      const n = damage.get('touch_of_the_grave') ?? 0;
      console.log(
        `    ${trait.name}: ${(n / fights).toFixed(2)} procs a fight, ` +
          `${(heals / fights).toFixed(2)} heals` +
          (n === 0 ? '   <-- NEVER FIRED' : ''),
      );
    }
  }
  console.log('');
}

/*
 * AND THE PET'S CRIT, which is the one clause with no event of its own.
 *
 * "This includes +1% for pet crit chance if you're holding an axe" is satisfied
 * by `createPet` inheriting the owner's crit stat, so the only way to see it is
 * to build the pet and read the number -- and the only way to know the racial
 * is what moved it is to compare against the same build without the axe.
 */
const bm = PRESETS_BY_ID.get('bm_hunter')!.build();
const sim = new Simulation(trainingDummyEncounter(bm));
sim.begin();
const owner = sim.combatants.find((c) => c.kind === 'player')!;
const pet = sim.combatants.find((c) => c.kind === 'pet');
console.log('=== pet crit inheritance (bm_hunter, Orc with an axe)');
console.log(`    owner crit ${owner.stats.effective.critChance.toFixed(3)}`);
console.log(`    pet   crit ${pet ? pet.stats.effective.critChance.toFixed(3) : 'NO PET'}`);

/*
 * AND THE WEAPON SPECIALIZATIONS, ISOLATED BY SWAPPING THE RACE.
 *
 * ============================================================================
 * THE FIRST VERSION OF THIS TOOK THE WEAPON OFF INSTEAD, AND IT WAS USELESS.
 * Removing the weapon removes its own stats too, and Obsidian Edged Blade and
 * Azuresong Mageblade both carry "+1% crit with all spells and attacks" -- so
 * the deltas came back 1.000 and 3.269 where the racial is 0 and 2, with the
 * item's own line sitting in both columns. There was no clean column to read.
 *
 * SWAPPING THE RACE ON IDENTICAL GEAR IS THE ISOLATION. Every item, talent,
 * enchant and consumable is held fixed and only the race moves, so the whole
 * delta is the racial -- less whatever the two races differ by in BASE crit,
 * which is why the comparison race is chosen per class and the base difference
 * is printed beside it.
 * ============================================================================
 */
console.log('\n=== weapon specialization, same gear with the race swapped');
for (const [preset, other, expected] of [
  // An Orc holding an AXE, against an Undead who has no weapon specialization.
  ['bm_hunter', 'troll', 1],
  ['lw_ranged', 'troll', 1],
  // An Orc holding SWORDS, which Axe Specialization does not name.
  ['dw_fury', 'tauren', 0],
  ['two_hand_arms', 'tauren', 0],
  ['lw_melee', 'troll', 0],
  ['hawk_melee', 'troll', 0],
  // A Human holding a SWORD, against an Undead Paladin who has none.
  ['pally_ret', 'undead', 2],
  ['pally_shockadin', 'undead', 2],
  ['prot_pally', 'undead', 2],
] as const) {
  const mine = PRESETS_BY_ID.get(preset)!.build();
  const swapped = {
    ...mine,
    character: { ...mine.character, race: other },
  } as typeof mine;

  const a = characterAtCombatStart(mine)!;
  const b = characterAtCombatStart(swapped)!;
  const spell = a.stats.effective.spellCritChance - b.stats.effective.spellCritChance;
  const melee = a.stats.effective.critChance - b.stats.effective.critChance;
  const verdict = Math.abs(spell - expected) < 1e-9 ? 'ok' : 'MISMATCH';
  console.log(
    `    ${preset.padEnd(16)} vs ${other.padEnd(7)} spellCrit ${spell.toFixed(3)} ` +
      `(expected ${expected}) ${verdict}   melee ${melee.toFixed(3)}`,
  );
}

/*
 * AND EUREKA!'S CHARGES, which are the half a cast count cannot show.
 *
 * One cast and three charges: the question is whether all three are spent, on
 * three different casts, and whether the aura is gone afterwards. An aura that
 * is applied and never spent is +10% for the whole fight and reports a tidy
 * uptime -- the Adrenaline Rush shape, and the hardest kind of mistake to see.
 */
console.log('\n=== Eureka! charges');
for (const preset of ['mage_arcane', 'mage_fire', 'mage_frostfire'] as const) {
  const built = PRESETS_BY_ID.get(preset)!.build();
  const recorder = new TelemetryRecorder();
  const simulation = new Simulation(
    { ...trainingDummyEncounter(built), seed: SEED },
    recorder,
  );
  simulation.run();
  const types = new Map<string, number>();
  for (const event of recorder.all) {
    if ('auraId' in event && event.auraId === 'eureka') {
      types.set(event.type, (types.get(event.type) ?? 0) + 1);
    }
  }
  console.log(`    ${preset.padEnd(16)} ${[...types].map(([t, n]) => `${t}=${n}`).join('  ')}`);
}
