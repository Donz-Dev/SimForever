/**
 * Enchant Weapon - Revelation, measured on its own quantities.
 *
 * ============================================================================
 * A PROC NEEDS A RATE AND A RATE NEEDS A DENOMINATOR, which is the lesson
 * Touch of the Grave cost: it fired, produced an ordinary damage row and an
 * ordinary DPS figure, and was at HALF its stated rate for the life of the
 * feature. Nothing in the suite computed a denominator, so nothing could see
 * it -- and the owner found it by dividing two numbers off the results page.
 *
 * So this prints, per fight:
 *
 *   ELIGIBLE      the actions ENTITLED to a roll -- a non-periodic spell that
 *                 landed and did not crit. Not "spells cast": a crit is not a
 *                 failure to crit and a miss is not an attack that connected.
 *   measured      procs divided by that, against what the formula says
 *   applied/removed   EQUAL means the spender is firing. Unequal means the
 *                 charge is sitting on the character, which is Inner Focus's
 *                 failure and is invisible in every other figure.
 *   in-window     what the charge actually bought. Guaranteed crit means every
 *                 spell that LANDS in the window crits; a spell can still MISS,
 *                 and at ~6% spell miss roughly one in sixteen will.
 * ============================================================================
 *
 *   npx vite-node tools/probe_revelation.ts
 */
import { PRESETS_BY_ID } from '../src/profiles/presets';
import { characterAtCombatStart, runProfile } from '../src/simulator';
import { REVELATION_ENCHANT_ID } from '../src/game/items/foreverEnchants';
import { revelationChance } from '../src/game/items/procs';

const PRESET = process.env.PRESET ?? 'mage_fire';
const SEEDS = Number(process.env.SEEDS ?? 20);

const built = PRESETS_BY_ID.get(PRESET)!.build();
/* The enchant goes on whichever melee weapon slot the build actually fills. */
const slot = built.equipment.twoHand ? 'twoHand' : 'mainHand';
const profile = {
  ...built,
  equipment: {
    ...built.equipment,
    [slot]: { ...built.equipment[slot]!, enchantId: REVELATION_ENCHANT_ID },
  },
};

const actor = characterAtCombatStart(profile)!;
const crit = actor.stats.effective.spellCritChance;

console.log(`${PRESET}, Revelation on ${slot}`);
console.log(
  `  spell crit ${crit.toFixed(2)}% on the character sheet` +
    `  ->  ${(revelationChance(crit) * 100).toFixed(3)}% per eligible spell`,
);

/*
 * SWINGS ARE EXCLUDED BY NAME because the damage TELEMETRY event does not carry
 * the attack table -- only the reaction's `AttackEvent` does. Naming the two
 * auto-attack rows is the honest version of "not a spell" here; a caster
 * profile has no melee specials to confuse it.
 */
const SWINGS = new Set(['Main Hand Auto-Attack', 'Off Hand Auto-Attack']);

let procs = 0;
let removed = 0;
let eligible = 0;
let crits = 0;
let spellDamage = 0;
let inWindow = 0;
let inWindowCrit = 0;
let inWindowMiss = 0;

for (let seed = 1; seed <= SEEDS; seed += 1) {
  const run = runProfile(
    { ...profile, simulation: { ...profile.simulation, iterations: 1, seed } } as never,
    seed,
  );

  let upFrom: number | undefined;

  for (const raw of run.timeline) {
    const event = raw as unknown as Record<string, any>;

    if (event.type === 'aura_applied' && event.auraId === 'revelation') {
      procs += 1;
      upFrom = event.timestamp;
    }
    if (
      (event.type === 'aura_removed' || event.type === 'aura_expired') &&
      event.auraId === 'revelation'
    ) {
      removed += 1;
      upFrom = undefined;
    }

    if (event.type !== 'damage' || event.periodic === true) continue;
    if (SWINGS.has(event.abilityName)) continue;

    spellDamage += 1;
    if (event.outcome === 'crit') crits += 1;
    // "fails to critically strike": landed, and not a crit.
    if (event.outcome === 'hit') eligible += 1;

    if (upFrom !== undefined && event.timestamp > upFrom) {
      inWindow += 1;
      if (event.outcome === 'crit') inWindowCrit += 1;
      if (event.outcome === 'miss') inWindowMiss += 1;
    }
  }
}

const per = (n: number) => (n / SEEDS).toFixed(2);
console.log(`over ${SEEDS} fights`);
console.log(`  spell damage events        ${per(spellDamage)} a fight`);
console.log(
  `  of which crit              ${per(crits)}` +
    `  (${((crits / spellDamage) * 100).toFixed(1)}% -- per-ability talent crit, ABOVE the sheet)`,
);
console.log(`  ELIGIBLE (landed, no crit) ${per(eligible)} a fight`);
console.log(`  Revelation procs           ${per(procs)} a fight`);
console.log(
  `  measured rate              ${((procs / eligible) * 100).toFixed(3)}%` +
    `  against an expected ${(revelationChance(crit) * 100).toFixed(3)}%`,
);
console.log(`  applied / removed          ${procs} / ${removed}  (equal: the spender fires)`);
console.log(
  `  spells landing in-window   ${inWindow}, crit ${inWindowCrit}, missed ${inWindowMiss}` +
    `  (crit + miss should be all of them)`,
);
