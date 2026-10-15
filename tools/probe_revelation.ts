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
import { spellCritChanceFrom } from '../src/engine';

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
const sheetCrit = spellCritChanceFrom(actor.stats.effective) * 100;

console.log(`${PRESET}, Revelation on ${slot}`);
console.log(
  `  spell crit ${sheetCrit.toFixed(2)}% on the character sheet` +
    `  ->  ${(revelationChance(sheetCrit / 100) * 100).toFixed(3)}% if the SHEET decided it`,
);
console.log(
  '  -- but the owner ruled EFFECTIVE per-spell crit, which is higher and varies by spell,',
);
console.log('     so the expected rate is computed per event below.');

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
let expectedProcs = 0;
let critChanceSum = 0;

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
    if (event.outcome === 'hit') {
      eligible += 1;
      /*
       * THE EXPECTATION IS SUMMED PER EVENT, not computed once, because the
       * rate now depends on what THAT spell rolled against -- a Fire Mage's
       * Scorch carries Improved Scorch's crit and its Fireball does not.
       */
      const c = event.critChance ?? 0;
      critChanceSum += c;
      expectedProcs += revelationChance(c);
    }

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
  `  mean EFFECTIVE crit on an eligible spell  ${((critChanceSum / eligible) * 100).toFixed(2)}%`,
);
/*
 * SIGMA, BECAUSE A PROC RATE IS A BINOMIAL AND 2 SIGMA LOOKS EXACTLY LIKE A
 * BUG. Chasing this cost an hour: at 60 fights the rate read 1.3x its
 * expectation with EVERY ability row high, which is the "all thirteen moved
 * down" tell -- and at 400 fights it came back at z = -0.33. What settled it
 * was driving the reaction 200,000 times at five fixed crit chances, where it
 * reproduces the formula to three decimal places.
 *
 * So the figure to read is z, not the percentages: |z| under about 2 is noise
 * at this sample size, and SEEDS=400 is what it takes to see a real 10% bias.
 */
const sigma = Math.sqrt(expectedProcs * (1 - expectedProcs / Math.max(1, eligible)));
console.log(
  `  measured rate              ${((procs / eligible) * 100).toFixed(3)}%` +
    `  against an expected ${((expectedProcs / eligible) * 100).toFixed(3)}%`,
);
console.log(
  `  procs ${procs} against ${expectedProcs.toFixed(1)} expected, sigma ${sigma.toFixed(1)}` +
    `  ->  z = ${((procs - expectedProcs) / sigma).toFixed(2)}`,
);
/*
 * ONE OUTSTANDING PER FIGHT IS CORRECT, not a leak: a fight can finish with
 * the charge unspent, and over 200 fights a handful will. What would be wrong
 * is a difference that GROWS with the proc count rather than with the fight
 * count -- that is the spender not firing, which is Inner Focus's failure and
 * is invisible in every other figure here.
 */
console.log(
  `  applied / removed          ${procs} / ${removed}` +
    `  (up to ${SEEDS} apart is right -- one unspent charge per fight)`,
);
console.log(
  `  spells landing in-window   ${inWindow}, crit ${inWindowCrit}, missed ${inWindowMiss}` +
    `  (crit + miss should be all of them)`,
);
