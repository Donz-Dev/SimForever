/*
 * ============================================================================
 * WHAT ACTUALLY PROCS MAELSTROM WEAPON, counted from the event stream.
 *
 *   npx vite-node tools/maelstrom_probe.ts
 *   FIGHTS=400 PRESET=shaman_enhancement npx vite-node tools/maelstrom_probe.ts
 *
 * The question this answers: Lightning Bolt fires about 1.5 times a fight for
 * the Enhancement shaman, which is about 7 Maelstrom procs at five stacks each,
 * and the ruleset owner expects more. Three things should roll it -- auto
 * attacks, Stormstrike, and whatever Windfury Weapon grants -- and a rate that
 * is low because one of the three is not rolling looks exactly like a rate that
 * is simply low.
 *
 * SO IT COUNTS THE ROLLS AND THE PROCS SEPARATELY, per source, and prints the
 * implied chance beside the PPM chance the weapon's base speed says it should
 * be. That makes it an arithmetic check rather than a plausibility one: a source
 * whose observed rate is half its expected one is a source that is not rolling
 * on every use.
 *
 * It also counts what the STACKS do, because a proc landing on a full aura
 * bought nothing and an aura expiring below five is a bolt that never happened.
 * Both are invisible in a proc count.
 * ============================================================================
 */
import { runProfile } from '../src/simulator';
import { PRESETS_BY_ID } from '../src/profiles';
import { MAELSTROM_WEAPON_PPM } from '../src/game/reactions/shamanTalents';
import { WINDFURY_WEAPON_ATTACK_NAME } from '../src/game/reactions/shaman';
import { MAELSTROM_WEAPON_MAX_STACKS } from '../src/game/auras/shaman';
import { ppmChance } from '../src/game/items/procs';
import { createPlayer } from '../src/game/actors/createPlayer';
import type { TelemetryEvent } from '../src/engine';

const FIGHTS = Number(process.env.FIGHTS ?? 200);
const PRESET = process.env.PRESET ?? 'shaman_enhancement';

const built = PRESETS_BY_ID.get(PRESET)!.build();

const player = createPlayer({
  race: built.character.race as never,
  characterClass: built.character.characterClass as never,
  combatStyle: built.character.combatStyle as never,
  talents: built.talents,
  equipment: built.equipment,
});
const weapon = player.weapons.mainHand;
const speedSeconds = (weapon?.swingTimerMs ?? 0) / 1000;

/**
 * Melee weapon uses, by the name the damage event carries.
 *
 * `Main Hand Auto-Attack` USED TO BE TWO THINGS, which is half of what this
 * probe was written to show: Windfury Weapon granted its extra attacks through
 * `extraAttack`, which schedules a real SWING, so they landed in the
 * auto-attack row and nothing in the stream told them apart by name. The probe
 * separated them by TIMESTAMP, because an extra attack is scheduled at `now`.
 *
 * IT DOES NOT HAVE TO ANY MORE. The imbue deals its own special attacks under
 * `Windfury Attack`, so each source is named and the heuristic is gone -- it
 * mislabelled about half a hit a fight anyway, whenever an ordinary swing
 * happened to land in the same millisecond as a Windfury one.
 */
const MELEE_USE_NAMES = new Set([
  'Main Hand Auto-Attack',
  'Stormstrike',
  WINDFURY_WEAPON_ATTACK_NAME,
]);

interface Tally {
  uses: number;
  procs: number;
}

const tallies = new Map<string, Tally>();
let maelstromApplied = 0;
let maelstromWasted = 0;
let boltCasts = 0;
let fullStackReached = 0;
let expiredBelowFive = 0;
let durationMs = 0;

const tally = (name: string): Tally => {
  let entry = tallies.get(name);
  if (!entry) {
    entry = { uses: 0, procs: 0 };
    tallies.set(name, entry);
  }
  return entry;
};

const LANDED = (outcome: string) =>
  outcome !== 'miss' && outcome !== 'dodge' && outcome !== 'parry';

for (let i = 0; i < FIGHTS; i += 1) {
  const result = runProfile({
    ...built,
    simulation: { ...built.simulation, seed: 1000 + i },
  } as never);
  durationMs = result.durationMs;

  /*
   * ATTRIBUTED BY WHAT HAPPENED LAST, which is the only handle the stream
   * gives: a Maelstrom proc emits an aura event and names no attack. The damage
   * event immediately before it is the one that provoked it, because
   * `runReactions` runs inside `dealDamage` and nothing can interleave.
   */
  let lastUse: string | undefined;
  let stacks = 0;

  for (const event of result.timeline as readonly TelemetryEvent[]) {
    if (event.type === 'damage') {
      if (!MELEE_USE_NAMES.has(event.abilityName)) {
        lastUse = undefined;
        continue;
      }
      const bucket = event.abilityName;

      if (LANDED(event.outcome)) {
        tally(bucket).uses += 1;
        lastUse = bucket;
      } else {
        tally(`${bucket} (avoided)`).uses += 1;
        lastUse = undefined;
      }
      continue;
    }

    if (event.type === 'cast' && event.abilityId === 'lightning_bolt') boltCasts += 1;

    const isMaelstrom =
      (event.type === 'aura_applied' ||
        event.type === 'aura_refreshed' ||
        event.type === 'aura_stacks_changed' ||
        event.type === 'aura_removed') &&
      event.auraId === 'maelstrom_weapon';
    if (!isMaelstrom) continue;

    if (event.type === 'aura_removed') {
      if (stacks > 0 && stacks < MAELSTROM_WEAPON_MAX_STACKS) expiredBelowFive += 1;
      stacks = 0;
      continue;
    }

    maelstromApplied += 1;
    if (lastUse) tally(lastUse).procs += 1;
    if (event.stacks === stacks) maelstromWasted += 1;
    stacks = event.stacks;
    if (stacks === MAELSTROM_WEAPON_MAX_STACKS) fullStackReached += 1;
  }
}

const per = (n: number) => (n / FIGHTS).toFixed(2);
const expected = ppmChance(speedSeconds, MAELSTROM_WEAPON_PPM);
const minutes = durationMs / 60000;

console.log(`\n${PRESET}  --  ${FIGHTS} fights of ${(durationMs / 1000).toFixed(0)}s`);
console.log(
  `main hand: ${weapon?.name ?? '-'}  base speed ${speedSeconds.toFixed(2)}s  ` +
    `=> ${MAELSTROM_WEAPON_PPM} PPM is ${(expected * 100).toFixed(2)}% a use\n`,
);

console.log('source                         uses   procs    observed    expected');
let totalLandedUses = 0;
let totalProcs = 0;
for (const [name, entry] of [...tallies].sort((a, b) => b[1].uses - a[1].uses)) {
  const avoided = name.endsWith('(avoided)');
  if (!avoided) {
    totalLandedUses += entry.uses;
    totalProcs += entry.procs;
  }
  const observed = entry.uses > 0 ? entry.procs / entry.uses : 0;
  console.log(
    `${name.padEnd(28)}${per(entry.uses).padStart(7)}${per(entry.procs).padStart(8)}` +
      `${(observed * 100).toFixed(2).padStart(11)}%` +
      `${avoided ? '          -' : (expected * 100).toFixed(2).padStart(11) + '%'}`,
  );
}
console.log(
  `${'ALL LANDED MELEE USES'.padEnd(28)}${per(totalLandedUses).padStart(7)}${per(totalProcs).padStart(8)}` +
    `${((totalLandedUses > 0 ? totalProcs / totalLandedUses : 0) * 100).toFixed(2).padStart(11)}%` +
    `${(expected * 100).toFixed(2).padStart(11)}%`,
);

console.log(`\nmaelstrom procs/fight       ${per(maelstromApplied)}`);
console.log(`  attributed to a use       ${per(totalProcs)}`);
console.log(`  unattributed              ${per(maelstromApplied - totalProcs)}`);
console.log(`stacks wasted at cap        ${per(maelstromWasted)}`);
console.log(`reached ${MAELSTROM_WEAPON_MAX_STACKS} stacks             ${per(fullStackReached)}`);
console.log(`expired below ${MAELSTROM_WEAPON_MAX_STACKS}            ${per(expiredBelowFive)}`);
console.log(`lightning bolt casts        ${per(boltCasts)}`);
console.log(
  `\nprocs a MINUTE              ${(maelstromApplied / FIGHTS / minutes).toFixed(2)}`,
);
console.log(
  `melee uses a MINUTE         ${(totalLandedUses / FIGHTS / minutes).toFixed(2)}` +
    `   (a ${speedSeconds.toFixed(2)}s weapon alone swings ${(60 / speedSeconds).toFixed(1)})`,
);
