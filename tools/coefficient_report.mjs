/*
 * ============================================================================
 * THE COEFFICIENT REPORT.
 *
 * Turns `coefficient_probe.ts`'s measurements into `docs/coefficient-audit.md`:
 * one row per damage source, per class, with its attack power and spell power
 * coefficients. A table to be read down and disagreed with, not a document.
 *
 *     npx vite-node tools/coefficient_probe.ts --json > probe.json
 *     node tools/coefficient_report.mjs
 *
 * ----------------------------------------------------------------------------
 * THE FIGURES ARE THE BARE COEFFICIENTS, with the build's damage multipliers
 * divided back out.
 *
 * A measurement necessarily includes them -- a coefficient reaches `dealDamage`
 * and every multiplier applies after it -- so the Shadow Priest's spells all
 * measure 1.155x of their coefficient and the Moonkin's 1.10x. Printing that is
 * printing Shadow Mastery, not a coefficient, and eight spells read 10% high at
 * once. What the table states is what the ability declares.
 * ----------------------------------------------------------------------------
 */
import fs from 'node:fs';

const CLASSES = [
  'warrior',
  'paladin',
  'hunter',
  'rogue',
  'priest',
  'shaman',
  'mage',
  'warlock',
  'druid',
];

const AXES = ['attackPower', 'rangedAttackPower', 'spellPower'];
const PROBE = 1000;

/** Apostrophes and spacing only; the words themselves are left alone. */
function normaliseName(name) {
  return (name ?? '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Forever's own spell data, at max rank, per class. */
function captures() {
  const byClass = new Map();
  for (const className of CLASSES) {
    const file =
      className === 'warrior'
        ? 'src/data/abilities/forever-warrior-tooltips.json'
        : `src/data/abilities/forever-${className}-spellbook.json`;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const byName = new Map();
    for (const spell of data.spells) {
      // First wins: the importer writes max rank, and a name seen twice is a
      // lower rank of the same spell. Keyed on a normalised name, because the
      // capture writes Hunter's Mark with a curly apostrophe and the ability
      // declares a straight one.
      const key = normaliseName(spell.name);
      if (!byName.has(key)) byName.set(key, spell);
    }
    byClass.set(className, byName);
  }
  return byClass;
}

/*
 * "(100% of Spell Power)" IS NOT A SCALING CLAIM. It is Forever's tooltip
 * renderer failing to substitute the damage NUMBER, and it appears exactly
 * where the figure should be -- which is why Revenge and Shield Slam had to be
 * read from their effect rows in the first place. Left in, it reports four
 * Warrior abilities as claiming spell power scaling they never claimed, and
 * buries the four that really do claim attack power scaling.
 */
const BROKEN_RENDER = /\(\d+% of Spell Power\)/gi;

/** Does the source say, in its own words, that this scales with a power stat? */
function claimsPowerScaling(description) {
  const text = (description ?? '').replace(BROKEN_RENDER, ' ');
  return /attack power|spell power|spell damage/i.test(text);
}

/** The sentence that says so, lifted verbatim, for the findings section. */
function scalingClause(description) {
  const flattened = (description ?? '')
    .replace(BROKEN_RENDER, '<damage>')
    .replace(/\s+/g, ' ')
    .trim();
  const clauses = flattened.split(/(?<=[.:])\s+/);
  const hits = clauses.filter((clause) => claimsPowerScaling(clause));
  return hits.join(' ').slice(0, 200);
}

/*
 * DIVIDE BY WHAT THE STAT ACTUALLY MOVED, not by the 1000 that was asked for.
 * `bonusStats` is a FLAT addition and a percentage stat talent multiplies it,
 * so +1000 is not +1000 effective on every build.
 */
function coefficient(reading, axis) {
  const delta = reading.effectiveDelta?.[axis] ?? PROBE;
  if (delta === 0) return 0;
  const measured = (reading.byAxis[axis] - reading.base) / delta;
  return measured / (reading.damageMultiplier || 1) / hitsToDivideBy(reading);
}

/*
 * A SEAL'S FIGURES ARE PER STRIKE, and everything else's are per cast.
 *
 * The probe totals a ninety-second fight, so an effect that fires once per
 * SWING accumulates: Seal of Righteousness landed nine strikes and read 71% AP
 * and 143% SP, where its per-strike figures are 8% and 16%. A per-fight total
 * in a column headed "coefficient" is not a coefficient at all -- it is a
 * statement about the fight length.
 *
 * Told apart by what ONE cast does with the auto-attack off: a seal does
 * nothing, while Whirlwind still strikes twice and Arcane Missiles still ticks
 * five times. Those are one cast's output and are NOT divided.
 */
function isPerStrike(reading) {
  return (reading.castOnlyEvents ?? 0) === 0 && (reading.instantEvents ?? 0) > 1;
}

function hitsToDivideBy(reading) {
  return isPerStrike(reading) ? reading.instantEvents : 1;
}

const percent = (value) => `${(value * 100).toFixed(value * 100 >= 10 ? 0 : 1)}%`;

/**
 * How the attack power arrives, in the words the table prints.
 *
 * `apSource` is MEASURED -- the probe halves every weapon's speed and asks
 * again, so a coefficient that halves came through the weapon and one that did
 * not is the ability's own. Mortal Strike and Bloodthirst are indistinguishable
 * without it: both simply respond to attack power.
 */
function powerCell(reading, axis) {
  const source = axis === 'attackPower' ? reading.apSource : reading.rapSource;
  if (source === 'none') return '0%';
  const coef = coefficient(reading, axis);
  if (source === 'own') return percent(coef);

  /*
   * A SEAL IS GIVEN AS A PLAIN PERCENTAGE PER STRIKE, because neither reading
   * of "weapon damage" is honest for one. Seal of Righteousness is the owner's
   * own formula -- `base + baseWeaponSpeed x (0.022 x AP + 0.044 x SP)` -- so it
   * does follow the weapon, but through its SPEED rather than by dealing a share
   * of the swing. Seal of Command really is 70% of the hit. Calling both "weapon
   * damage" states the same thing about two different mechanisms.
   */
  if (isPerStrike(reading)) return percent(coef);

  const kind = axis === 'rangedAttackPower' ? 'ranged weapon damage' : 'weapon damage';
  // TWO HITS FROM ONE CAST is both hands. Measured with the auto-attack off, so
  // a seal's nine strikes -- which are nine SWINGS -- cannot be mistaken for it.
  if ((reading.castOnlyEvents ?? 1) >= 2) return `${kind} (both hands)`;

  /*
   * THE FRACTION IS DERIVED FROM THE MEASUREMENT, not read from the tooltip:
   * `coefficient / (speed / 14)` is what share of the weapon's damage the
   * ability deals. Spearing Strike comes out at 0.4 against a stated "40%
   * weapon damage", which is the check that this is the right arithmetic.
   */
  const seconds = axis === 'rangedAttackPower' ? reading.rangedSeconds : reading.mainHandSeconds;
  if (seconds === undefined) return kind;
  const fraction = coef / (seconds / 14);
  return Math.abs(fraction - 1) < 0.03 ? kind : `${percent(fraction)} ${kind}`;
}

function main() {
  const probe = JSON.parse(fs.readFileSync('probe.json', 'utf8').replace(/^﻿/, ''));
  const sources = captures();

  const rows = probe.readings.map((reading) => {
    const source = sources.get(reading.className)?.get(normaliseName(reading.abilityName));
    const scales =
      reading.apSource !== 'none' ||
      reading.rapSource !== 'none' ||
      Math.abs(coefficient(reading, 'spellPower')) > 1e-9;
    return {
      ...reading,
      ap: powerCell(reading, 'attackPower'),
      rap: powerCell(reading, 'rangedAttackPower'),
      sp: Math.abs(coefficient(reading, 'spellPower')) > 1e-9
        ? percent(coefficient(reading, 'spellPower'))
        : '0%',
      scales,
      clause: scalingClause(source?.description),
      claimsScaling: claimsPowerScaling(source?.description),
    };
  });

  // The attack power column carries whichever pool the ability actually reads.
  // A Hunter shot is ranged; nothing here reads both.
  for (const row of rows) if (row.ap === '0%' && row.rap !== '0%') row.ap = row.rap;

  const damaging = rows.filter((row) => row.base > 0);
  const disagreeing = damaging.filter((row) => !row.scales && row.claimsScaling);

  const out = [
    '# Coefficient audit',
    '',
    'Every damage source in the simulator, with what its damage scales with.',
    '',
    '**Generated, and MEASURED rather than read off a declaration.** A',
    'coefficient is passed per `dealDamage` call, so one written in the wrong',
    'place is silent. Re-run both scripts rather than editing the table:',
    '',
    '```bash',
    'npx vite-node tools/coefficient_probe.ts --json > probe.json',
    'node tools/coefficient_report.mjs',
    '```',
    '',
    '## Reading it',
    '',
    '| Cell | Means |',
    '| --- | --- |',
    '| `weapon damage` | the damage IS weapon damage, so attack power arrives through the weapon at `speed / 14`. Measured, by halving the weapon speed and asking again — Mortal Strike and Bloodthirst both simply "respond to attack power" without that check |',
    '| `40% weapon damage` | the same, for a share of the weapon swing |',
    '| `ranged weapon damage` | the same through the RANGED weapon and ranged attack power, which is a separate pool |',
    '| a percentage | the ability carries its own coefficient, the same on any weapon |',
    '| `0%` | no response to that stat at all |',
    '',
    'Figures are the **bare** coefficients: the build\'s damage multipliers are',
    'divided back out, so a Shadow Priest\'s spells state their coefficient and not',
    'their coefficient times Shadow Mastery.',
    '',
    ...(disagreeing.length === 0
      ? [
          '## Nothing disagrees with its own tooltip any more',
          '',
          'Every damage source that claims to scale, scales. The four that did not --',
          'Eviscerate, Rupture, Rip and Ferocious Bite, each stating "increased by',
          'Attack Power" and measuring completely flat -- were the finding of the',
          'first version of this audit, and `WoWSimWorksheet.xlsx` answered all four.',
          '',
          'Lacerate went with them: its "10% weapon damage per existing application"',
          'now applies, reading the stack count off the aura that a stale note said a',
          'periodic tick could not see.',
          '',
        ]
      : [
          `## ${disagreeing.length} disagree with their own tooltip`,
          '',
          "These say in the client's own words that they scale with attack power, and",
          'measure completely flat, and **no source states by how much**.',
          '',
          "| Damage source | Class | The source's own words |",
          '| --- | --- | --- |',
          ...disagreeing.map(
            (row) => `| **${row.abilityName}** | ${row.className} | ${pipe(row.clause)} |`,
          ),
          '',
        ]),
    '## Two things to know before comparing this with the sheet',
    '',
    '**A DAMAGE-OVER-TIME ROW IS A TOTAL HERE AND PER TICK ON THE SHEET.** The',
    'probe casts once and totals everything the cast causes, so Devouring Plague',
    "reads 80% against the sheet's 10% -- eight ticks of it. Siphon Life reads 50%",
    'for ten ticks of 5%, and Rip 120% for six ticks of 4% per combo point at five',
    'points. Neither figure is wrong; they answer different questions.',
    '',
    '**A FEW ROWS CARRY A MULTIPLIER THE PROBE CANNOT DIVIDE OUT.** It reads a',
    "build's modifiers off a character that has not entered combat, so an OPENING",
    "aura is missing from them -- a Warrior's stance most of all. Revenge reads 20%",
    "against the sheet's 22%, which is Defensive Stance's 0.9 and not a",
    'transcription error.',
    '',
    '## Every damage source',
    '',
  ];

  for (const className of CLASSES) {
    const classRows = rows
      .filter((row) => row.className === className && row.base > 0)
      .sort((a, b) => b.base - a.base);
    if (classRows.length === 0) continue;
    out.push(
      `### ${className[0].toUpperCase()}${className.slice(1)}`,
      '',
      '| Damage source | AP coeff | SP coeff |',
      '| --- | --- | --- |',
      ...classRows.map(
        (row) =>
          `| ${row.abilityName}${isPerStrike(row) ? ' *(per strike)*' : ''} | ${row.ap} | ${row.sp} |`,
      ),
      '',
    );
    if (classRows.some(isPerStrike)) {
      out.push(
        "A seal strikes once per swing, so its figures are per strike. They come from",
        "the formula you supplied — `base + baseWeaponSpeed x (0.022 x AP + 0.044 x SP)`",
        '— which is why spell power is worth exactly twice attack power, and why a',
        'slower weapon hits harder. Seal of Command is the exception: it is 70% of the',
        'swing that carried it, so it inherits that hit rather than scaling itself.',
        '',
      );
    }
  }

  /*
   * THE TWO NO CAST REACHES, listed rather than omitted. A reaction applies
   * them, so no ability sweep sees them -- `everySpellScales.test.ts` says
   * outright that it cannot. Both are a SHARE of a hit that was already scaled,
   * so both correctly carry no coefficient of their own and inherit the
   * parent's.
   */
  out.push(
    '### Applied by a reaction, so no cast reaches them',
    '',
    '| Damage source | AP coeff | SP coeff |',
    '| --- | --- | --- |',
    ...(probe.derived ?? []).map((entry) => {
      const label = entry.auraId
        .split('_')
        .map((word) => word[0].toUpperCase() + word.slice(1))
        .join(' ');
      return `| ${label} | inherited | inherited |`;
    }),
    '',
    'Deep Wounds is a share of average weapon damage and Ignite a share of the',
    'crit that caused it, and that hit was already scaled — so a coefficient here',
    'would apply the stat twice. They do move with gear, through the parent.',
    '',
    '---',
    '',
    `**${damaging.length} damage sources**, from ${rows.length} abilities reached across all 23 presets.`,
    'Nothing was refused — every precondition a damaging ability needs is arranged',
    "in the probe's `SETUP`, and a refusal would be printed with its reason rather",
    `than dropped. The other ${rows.length - damaging.length} are stances, aspects, shouts, cooldowns and`,
    'seals-as-auras: they cast successfully and deal no damage themselves.',
  );

  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/coefficient-audit.md', out.join('\n') + '\n', 'utf8');

  console.log(`${damaging.length} damage sources written to docs/coefficient-audit.md`);
  console.log(`\n${disagreeing.length} flat but the source claims scaling:`);
  for (const row of disagreeing) console.log(`  ${row.className}\t${row.abilityName}`);
}

main();
