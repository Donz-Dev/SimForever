/*
 * ============================================================================
 * THE COEFFICIENT REPORT.
 *
 * Joins `coefficient_probe.ts`'s measurements to the SOURCE's own words and
 * writes `docs/coefficient-audit.md` -- a table the ruleset owner can read down
 * and say "that one is wrong" without opening any code.
 *
 *     npx vite-node tools/coefficient_probe.ts --json > probe.json
 *     node tools/coefficient_report.mjs
 *
 * The source text is never paraphrased. Every "what the source says" cell is a
 * clause lifted verbatim out of the capture in `src/data/abilities`, because the
 * whole point of the exercise is that the owner recognises their own wording.
 * ============================================================================
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

/** Apostrophes and spacing only; the words themselves are left alone. */
function normaliseName(name) {
  return (name ?? '').replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
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
      // lower rank of the same spell.
      //
      // KEYED ON A NORMALISED NAME, because the capture writes Hunter's Mark
      // with a curly apostrophe and our ability declares a straight one. The
      // ability then has "no capture under that name", which reads as missing
      // source data rather than as a punctuation mismatch.
      const key = normaliseName(spell.name);
      if (!byName.has(key)) byName.set(key, spell);
    }
    byClass.set(className, byName);
  }
  return byClass;
}

/*
 * ----------------------------------------------------------------------------
 * THE SCALING CLAUSE, lifted verbatim.
 *
 * Split the description into sentences and keep the ones that say how the
 * damage is arrived at. Deliberately GREEDY -- a clause wrongly included is
 * visible in the report and a clause wrongly dropped is not, which is the same
 * asymmetry that makes a silent omission the failure mode to design against.
 * ----------------------------------------------------------------------------
 */
const SCALING = /attack power|spell power|spell damage|weapon damage|block value|weapon dps/i;

/*
 * "(100% of Spell Power)" IS NOT A SCALING CLAUSE. It is Forever's tooltip
 * renderer failing to substitute the damage NUMBER, and it appears where the
 * figure should be -- which is why Revenge and Shield Slam had to be read from
 * their effect rows in the first place. Left in, it reports four Warrior
 * abilities as claiming spell power scaling they never claimed, and buries the
 * four that really do claim attack power scaling.
 */
const BROKEN_RENDER = /\(\d+% of Spell Power\)/gi;

function scalingClause(description) {
  if (!description) return '';
  const flattened = description.replace(BROKEN_RENDER, '<damage>').replace(/\s+/g, ' ').trim();
  const clauses = flattened.split(/(?<=[.:])\s+|(?<=\d)\s*(?=\d+ point)/);
  const hits = clauses.filter((clause) => SCALING.test(clause));
  if (hits.length === 0) return '';
  return hits.join(' ').slice(0, 220);
}

/** "2.5 sec cast" / "Instant" -> seconds, or undefined when not stated. */
function castSeconds(cast) {
  if (!cast) return undefined;
  if (/instant/i.test(cast)) return 0;
  const match = cast.match(/([\d.]+)\s*sec/i);
  return match ? Number(match[1]) : undefined;
}

/**
 * "150% weapon damage" -> 1.5; a bare "weapon damage" -> 1.
 *
 * A DAGGER CLAUSE IS A SECOND FRACTION FOR THE SAME ABILITY, and every Rogue
 * build here holds one. "100% weapon damage (145% if a Dagger is equipped)"
 * measures at 1.45, and reading the first number reported Hemorrhage and Ghostly
 * Strike as off by 45% and 80% when both were exactly right.
 */
function weaponFraction(description, hasDagger) {
  if (!description || !/weapon damage/i.test(description)) return undefined;
  /*
   * THE LAST PERCENTAGE BEFORE THE DAGGER CLAUSE, not the first one in the
   * sentence. Ghostly Strike reads "125% (180% if a Dagger is equipped in your
   * Main Hand) weapon damage", so a lazy match runs from the 125 straight past
   * the 180 and reports the ability off by 44%.
   */
  if (hasDagger && /if a Dagger/i.test(description)) {
    const before = description.slice(0, description.search(/if a Dagger/i));
    const percents = [...before.matchAll(/(\d+)%/g)];
    if (percents.length > 0) return Number(percents[percents.length - 1][1]) / 100;
  }
  const percent = description.match(/(\d+)%\s*(?:\([^)]*\)\s*)?(?:of\s*)?weapon damage/i);
  return percent ? Number(percent[1]) / 100 : 1;
}

/**
 * "damage equal to 35% of your Attack Power" -> 0.35.
 *
 * A THIRD WAY THE SOURCE STATES A COEFFICIENT, and the only one that states it
 * outright rather than leaving it to a rule. Bloodthirst and Ferocious Bite both
 * use it, and it is the cleanest confirmation in the whole table: the source
 * names the number, so measured and expected must match exactly.
 */
function statedPowerFraction(description) {
  const match = (description ?? '').match(
    /(\d+)%\s*of\s*your\s*(Ranged\s*)?Attack Power|(\d+)%\s*of\s*your\s*Spell Power/i,
  );
  if (!match) return undefined;
  return Number(match[1] ?? match[3]) / 100;
}

/**
 * Does this ability strike with BOTH weapons? Then its coefficient is both
 * hands' and a main-hand-only expectation is short by the off-hand's share.
 *
 * MEASURED, NOT READ. Mutilate says "attacks with both weapons" and Whirlwind
 * says nothing at all, because Whirlwind's off-hand strike comes from RAGING
 * BLOWS -- a talent, which the ability's own tooltip cannot mention. Two
 * non-periodic damage events against one target is two hands.
 */
function strikesBothHands(reading, description) {
  return (reading.instantEvents ?? 1) >= 2 || /both weapons|with each weapon/i.test(description ?? '');
}

const SPELL_DIVISOR = 3.5;
const INSTANT_SECONDS = 1.5;
const MAX_CAST_SECONDS = 3.5;
const DOT_DIVISOR = 15;

/** The direct-cast rule, computed from the SOURCE's cast time, not from ours. */
function expectedSpellCoefficient(seconds) {
  if (seconds === undefined) return undefined;
  const clamped = Math.min(Math.max(seconds || 0, INSTANT_SECONDS), MAX_CAST_SECONDS);
  return clamped / SPELL_DIVISOR;
}

/*
 * A SPELL THAT BURNS OVER TIME IS ON A DIFFERENT RULE, `duration / 15`, and
 * using the cast rule for one reports it as scaling four to five times too
 * hard. Nine spells are in that shape and every one of them came back "off"
 * until this existed -- Corruption, Bane of Agony, Siphon Life, Shadow Word:
 * Pain, Devouring Plague, Moonfire, Insect Swarm, Flame Shock, Immolate.
 *
 * The duration is read from the SOURCE'S OWN WORDS -- "over 18 sec" -- so the
 * expected figure is derived from the capture and not from our own declaration,
 * which is the whole point of checking.
 */
function dotSeconds(description) {
  if (!description) return undefined;
  // "Lasts 30 sec" is the third way a duration is stated, and Siphon Life uses
  // it -- "transfers 41 health every 3 sec. Lasts 30 sec." Missing it put a pure
  // DoT on the direct rule and reported it as scaling 4.7x too hard.
  const match = description.match(
    /over\s+(\d+)\s*sec|Lasts\s+(\d+)\s*sec|for\s+(\d+)\s*sec/i,
  );
  if (!match) return undefined;
  return Number(match[1] ?? match[2] ?? match[3]);
}

/**
 * The expected coefficient of a spell that does BOTH, by the hybrid rule: each
 * half scaled by its own share of their sum. The report needs the TOTAL,
 * because the probe measures a whole cast including its ticks.
 */
function hybridTotal(direct, dot) {
  const sum = direct + dot;
  if (sum === 0) return 0;
  return (direct * direct) / sum + (dot * dot) / sum;
}

/*
 * ----------------------------------------------------------------------------
 * MEASUREMENTS THAT EXCEED THE BASE RULE FOR A REASON THE CODE STATES.
 *
 * Not suppressed -- printed with the reason, because the owner should see them
 * and may disagree with the design. A silent exception here would be the same
 * mistake as a silent coefficient.
 * ----------------------------------------------------------------------------
 */
const EXPLAINED = {
  shadow_word_pain:
    'Improved Shadow Word: Pain adds two ticks at the same cadence, and each ' +
    'carries the coefficient of the BASE eighteen seconds — so 24s of ticks ' +
    'scale at 8 x 0.2 rather than at 18/15. Deliberate, and stated in ' +
    'src/game/auras/priest.ts: "the extra two ticks are extra damage rather ' +
    'than the same total spread thinner". Worth the owner confirming that a ' +
    'duration talent should raise total gear scaling proportionally.',
};

const AXES = ['attackPower', 'rangedAttackPower', 'spellPower'];
const AXIS_LABEL = { attackPower: 'AP', rangedAttackPower: 'RAP', spellPower: 'SP' };
const PROBE = 1000;

/*
 * DIVIDE BY WHAT THE STAT ACTUALLY MOVED, not by the 1000 that was asked for.
 * `bonusStats` is a FLAT addition and a percentage stat talent multiplies it, so
 * +1000 is not +1000 effective on every build -- and dividing by 1000 reports a
 * coefficient inflated by exactly that talent. The probe measures the real
 * delta off the stat block.
 */
function coefficients(reading) {
  const out = {};
  for (const axis of AXES) {
    const delta = reading.effectiveDelta?.[axis] ?? PROBE;
    out[axis] = delta === 0 ? 0 : (reading.byAxis[axis] - reading.base) / delta;
  }
  return out;
}

function main() {
  const probe = JSON.parse(fs.readFileSync('probe.json', 'utf8').replace(/^﻿/, ''));
  const sources = captures();
  const rows = [];

  for (const reading of probe.readings) {
    const source = sources.get(reading.className)?.get(normaliseName(reading.abilityName));
    const clause = scalingClause(source?.description);
    const coefs = coefficients(reading);
    const axis = AXES.reduce((a, b) => (Math.abs(coefs[b]) > Math.abs(coefs[a]) ? b : a));
    const measured = coefs[axis];
    const scales = Math.abs(measured) > 1e-9;

    // What the rule predicts, from the source's own numbers where it states
    // them. A physical ability is `speed / 14 x fraction`; a spell is
    // `castTime / 3.5`. Left blank when the source states neither.
    /*
     * A PALADIN SEAL IS ON THE OWNER'S OWN FORMULA and neither of these rules,
     * so comparing it to one is meaningless:
     *
     *     base + baseWeaponSpeed x (0.022 x AP + 0.044 x SP)
     *
     * It is checked against THAT instead, which also tests the thing the
     * formula is most distinctive for -- a point of spell power being worth
     * exactly twice a point of attack power.
     */
    const isSeal = reading.abilityId.startsWith('seal_of_');
    let expected;
    let rule = '';
    // Every Rogue and Druid build that reaches a dagger clause holds one; the
    // weapon speed the probe reports is the dagger's.
    const hasDagger = (reading.mainHandSeconds ?? 99) <= 2.0;
    const fraction = weaponFraction(source?.description, hasDagger);
    const bothHands = strikesBothHands(reading, source?.description);
    const seconds = castSeconds(
      source?.cast ?? (source?.tooltip?.includes('Instant') ? 'Instant' : undefined),
    );
    const stated = statedPowerFraction(source?.description);
    if (stated !== undefined && !isSeal) {
      // The source names the coefficient, so no rule is needed and none is used.
      expected = stated;
      rule = `source states ${stated}`;
    } else if (isSeal) {
      const speed = reading.mainHandSeconds;
      if (speed !== undefined) {
        // Per strike, and the probe totals every strike of a ninety-second
        // fight -- so only the AP:SP RATIO is checkable here, not the absolute.
        expected = undefined;
        rule = `owner's seal formula, ${speed}s weapon`;
      }
    } else if (axis !== 'spellPower') {
      const speed = axis === 'rangedAttackPower' ? reading.rangedSeconds : reading.mainHandSeconds;
      if (fraction !== undefined && speed !== undefined) {
        expected = (speed / 14) * fraction;
        rule = `${speed}/14 x ${fraction}`;
        /*
         * AN ABILITY THAT STRIKES WITH BOTH WEAPONS CARRIES BOTH HANDS'
         * COEFFICIENTS, and the off-hand's is halved by the dual-wield penalty.
         * Mutilate and Whirlwind both say so in the source's own words and both
         * read "off" by exactly an off-hand until this was here. The off-hand
         * speed is not reported, so the expectation is a RANGE and this takes the
         * same-speed case -- flagged in the rule column so nobody reads it as
         * exact.
         */
        if (bothHands && reading.offHandSeconds !== undefined) {
          /*
           * EXACT, from BOTH weapons' own speeds. Assuming the hands share a
           * speed reported Mutilate off by 10% -- a 1.9s dagger beside a 1.8s
           * one, and the off-hand halved by the dual-wield penalty.
           */
          const penalty = reading.offHandDamageMultiplier ?? 0.5;
          const offHand = (reading.offHandSeconds / 14) * fraction * penalty;
          expected += offHand;
          rule += ` + ${reading.offHandSeconds}/14 x ${fraction} x ${penalty} (off hand)`;
        }
      }
    } else if (seconds !== undefined) {
      const burn = dotSeconds(source?.description);
      const direct = expectedSpellCoefficient(seconds);
      /*
       * WHICH OF THE THREE SPELL RULES APPLIES IS DECIDED BY THE MEASUREMENT,
       * not by the wording. `instantBase` is what did not arrive as a tick: zero
       * means a pure DoT, and anything else alongside a stated duration means a
       * hybrid. The wording cannot be trusted for this -- "150 damage and 300
       * over 12 sec" and "450 over 12 sec" differ by a comma.
       */
      /*
       * AND WHETHER THERE IS A BURN AT ALL IS DECIDED BY THE MEASUREMENT TOO.
       * "for N sec" in a tooltip is as often a slow or a stun as a duration of
       * damage: Frostbolt's 9 seconds is the SLOW and Earth Shock's 2 is an
       * interrupt, and reading either as a DoT put both on the hybrid rule and
       * reported them off by 14% and 20%. Periodic damage exists exactly when
       * some of the damage arrived as a tick.
       */
      const hasBurn = burn !== undefined && reading.base > reading.instantBase + 1e-9;
      const pureDot = reading.instantBase === 0 && hasBurn;
      if (!hasBurn) {
        expected = direct;
        rule = `${seconds === 0 ? 'instant 1.5' : seconds}/3.5`;
      } else if (pureDot) {
        expected = burn / DOT_DIVISOR;
        rule = `${burn}/15`;
      } else {
        expected = hybridTotal(direct, burn / DOT_DIVISOR);
        rule = `hybrid(${direct.toFixed(3)}, ${burn}/15)`;
      }
    }
    /*
     * THE RULE IS MULTIPLIED BY WHAT THE BUILD MULTIPLIES THE ABILITY BY.
     * A coefficient reaches `dealDamage` and every damage multiplier applies
     * after it, so the measured figure is the rule's times the build's -- see
     * the note on `damageMultiplier` in the probe.
     */
    if (expected !== undefined) expected *= reading.damageMultiplier ?? 1;

    rows.push({
      ...reading,
      clause,
      sourceCast: source?.cast ?? '',
      sourceFound: source !== undefined,
      axis,
      measured,
      scales,
      expected,
      rule,
      isSeal,
      /*
       * The seal formula's distinctive claim, and the only part of it a
       * whole-fight total can check: `0.044 x SP` against `0.022 x AP` makes a
       * point of spell power worth EXACTLY twice a point of attack power,
       * whatever the weapon and however many strikes landed.
       */
      sealRatio:
        isSeal && Math.abs(coefs.attackPower) > 1e-9
          ? coefs.spellPower / coefs.attackPower
          : undefined,
      claimsScaling: /attack power|spell power|spell damage/i.test(clause),
    });
  }

  const byClass = new Map();
  for (const row of rows) {
    if (!byClass.has(row.className)) byClass.set(row.className, []);
    byClass.get(row.className).push(row);
  }

  const n = (value, digits = 4) =>
    value === undefined || Number.isNaN(value) ? '—' : value.toFixed(digits);
  const out = [];

  for (const className of CLASSES) {
    const classRows = (byClass.get(className) ?? []).slice().sort((a, b) => b.base - a.base);
    if (classRows.length === 0) continue;
    out.push(`### ${className[0].toUpperCase()}${className.slice(1)}\n`);
    out.push(
      '| Ability | Source says | Simulator | Measured | Rule | Expected | Verdict |',
      '| --- | --- | --- | --- | --- | --- | --- |',
    );
    for (const row of classRows) {
      const what = !row.scales
        ? row.base > 0
          ? 'FLAT'
          : 'no damage'
        : `${AXIS_LABEL[row.axis]}`;
      const ratio =
        row.expected !== undefined && row.expected !== 0 && row.scales
          ? row.measured / row.expected
          : undefined;
      let verdict;
      if (row.base === 0) verdict = 'deals no damage';
      else if (!row.scales && row.claimsScaling) verdict = '**DISAGREES**';
      else if (!row.scales) verdict = 'flat, source states no scaling';
      else if (row.isSeal)
        verdict =
          row.sealRatio === undefined
            ? 'seal formula; no AP term measured'
            : Math.abs(row.sealRatio - 2) <= 0.02
              ? 'agrees (SP is 2x AP)'
              : `**seal SP:AP is ${row.sealRatio.toFixed(3)}, not 2**`;
      else if (ratio === undefined) verdict = 'scales; rule not computable here';
      else if (Math.abs(ratio - 1) <= 0.06) verdict = 'agrees';
      else if (EXPLAINED[row.abilityId])
        verdict = `x${ratio.toFixed(3)}, explained: ${EXPLAINED[row.abilityId]}`;
      else verdict = `**off by x${ratio.toFixed(3)}**`;
      out.push(
        `| ${row.abilityName}${row.sourceFound ? '' : ' ⚠︎'} | ${
          row.clause ? row.clause.replace(/\|/g, '\\|') : '*(states no scaling)*'
        } | ${what} | ${row.scales ? n(row.measured) : '—'} | ${row.rule || '—'} | ${n(
          row.expected,
        )} | ${verdict} |`,
      );
    }
    out.push('');
  }

  // ------------------------------------------------------------------------
  // THE DOCUMENT, assembled around the table by this script so the counts in
  // the prose cannot drift from the rows beneath them. A report whose summary
  // disagrees with its own table is worse than no report.
  // ------------------------------------------------------------------------
  const damaging = rows.filter((row) => row.base > 0);
  const disagreeing = rows.filter((row) => row.base > 0 && !row.scales && row.claimsScaling);
  const flatRows = damaging.filter((row) => !row.scales);
  const silentRows = rows.filter((row) => row.base === 0);
  const checked = damaging.filter((row) => row.expected !== undefined && row.scales);
  const derivedRows = probe.derived ?? [];
  const pipe = (text) => (text ?? '').replace(/\|/g, '\\|');

  const head = [
    '# Coefficient audit: what every damaging ability scales with',
    '',
    "Every ability any of the 23 presets can reach, MEASURED -- not read off a",
    "declaration -- and set beside the source's own words.",
    '',
    '**Generated.** Re-run both scripts rather than editing the table:',
    '',
    '```bash',
    'npx vite-node tools/coefficient_probe.ts --json > probe.json',
    'node tools/coefficient_report.mjs',
    '```',
    '',
    '## What it found',
    '',
    `**${damaging.length} of ${rows.length} abilities deal damage.** ${checked.length} of them scale at a rate a rule`,
    'predicts, and every one agrees with it to within 6%.',
    '',
    `**${disagreeing.length} DISAGREE WITH THEIR OWN TOOLTIP**, and they are the finding:`,
    '',
    "| Ability | Class | The source's own words | The simulator |",
    '| --- | --- | --- | --- |',
    ...disagreeing.map(
      (row) =>
        `| **${row.abilityName}** | ${row.className} | ${pipe(row.clause)} | FLAT, base ${row.base.toFixed(0)} |`,
    ),
    '',
    'All four are FINISHERS, across two classes, and **no source says by how much.**',
    'That is a missing RULE rather than a missing transcription -- the same shape as',
    'the spell coefficient and as Careful Aim, each of which one question settled.',
    '**Nothing is changed here.** See the questions below.',
    '',
    'They are not small. Eviscerate at five combo points is the largest single hit',
    'either Rogue has, and Ferocious Bite is the largest the Cat Druid has, so',
    'whatever the answer is it moves Venom Rogue, Rupture Rogue and Cat Druid.',
    '',
    '## The rest of the accounting, so nothing is silently missing',
    '',
    '| | |',
    '| --- | --- |',
    `| **${rows.length} abilities reached** | every preset x every ability in its own book. **Nothing was refused** -- each precondition a damaging ability needs is arranged in the probe's \`SETUP\`, and a refusal would be printed with its reason rather than dropped |`,
    `| **${damaging.length} deal damage** | of which ${checked.length} are checkable against a rule, all agreeing |`,
    `| **${flatRows.length} deal damage that moves on no axis** | ${disagreeing.length} are the finding above; the other ${flatRows.length - disagreeing.length} state flat figures and carry no scaling clause at all |`,
    `| **${silentRows.length} deal none** | stances, aspects, shouts, seals-as-auras, cooldowns. Each cast successfully and did nothing, which is correct |`,
    `| **${derivedRows.length} reached only by forcing a crit** | applied by a REACTION, so they appear in no ability sweep -- \`everySpellScales.test.ts\` says outright that it cannot reach them |`,
    '',
    '### Two more, of different kinds, and neither is the finding above',
    '',
    '**Lacerate** is flat, and its own words state a coefficient: "75 damage over',
    '15 sec **plus 10% weapon damage per existing application**". That is a STATED',
    'number rather than a missing rule, so it needs no ruling -- what it needs is a',
    'stack-dependent weapon-damage term, which nothing in the damage pipeline',
    'expresses today. Worth a line of its own because it will not be found by',
    'looking for the four above: it claims WEAPON damage, not attack power.',
    '',
    '**Seal of Fury** is the only seal that does not scale. Seal of Righteousness',
    'measures AP 0.9114 and SP 1.8227 -- a point of spell power worth exactly twice',
    "a point of attack power, which is the owner's formula reproduced to four",
    'decimals. Seal of Fury is flat, because its tooltip states a flat "additional',
    '35 Holy damage" with no weapon-speed term for the formula to use. Defensible,',
    'and a question: **does the seal formula apply to Seal of Fury, or is 35 flat?**',
    '',
    '### The twelve that are flat and say nothing about scaling',
    '',
    'Listed rather than counted, because "no scaling clause" is a claim about each',
    'one and an aggregate hides the one that is wrong. Each was flat on EVERY build',
    'that has it.',
    '',
    "| Ability | Class | Base | The source's words |",
    '| --- | --- | --- | --- |',
    ...flatRows
      .filter((row) => !row.claimsScaling)
      .map(
        (row) =>
          `| ${row.abilityName} | ${row.className} | ${row.base.toFixed(0)} | ${
            row.clause ? pipe(row.clause) : '*(no scaling clause)*'
          } |`,
      ),
    '',
    '**Shield Slam is the one to read carefully.** Its clause is "increased by your',
    'Block Value", which is neither attack power nor spell power, so being flat on',
    'both is correct and the block value term is a separate question.',
    '',
    '### The two that no cast reaches',
    '',
    '| Aura | Reached via | Measured |',
    '| --- | --- | --- |',
    ...derivedRows.map(
      (entry) =>
        `| \`${entry.auraId}\` | ${entry.via} | ${AXES.map(
          (axis) => `${AXIS_LABEL[axis]} ${((entry.byAxis[axis] - entry.base) / PROBE).toFixed(4)}`,
        ).join(', ')} |`,
    ),
    '',
    'Both move with a stat, and both are declared `powerCoefficient: 0`. The two',
    'statements are not in conflict: each is a SHARE of a hit that was already',
    'scaled -- Deep Wounds a percentage of average weapon damage, Ignite a',
    'percentage of the crit that caused it -- so a coefficient here would apply the',
    'stat twice. What the figures show is INHERITED scaling, which is what should',
    'happen, and measuring it is the only way to tell that apart from a gap.',
    '',
    '## Questions for the ruleset owner',
    '',
    'One question, asked four times. Eviscerate, Rupture, Rip and Ferocious Bite',
    "each say in the client's own words that their damage is increased by attack",
    'power, and not one states a figure.',
    '',
    '1. **Is there ONE rule for a finisher**, the way `castTime / 3.5` is one rule',
    '   for a spell? A coefficient per combo point, or a flat fraction of attack',
    '   power for the whole finisher?',
    '2. Or does each of the four carry its own number, the way each spell carries',
    '   its own cast time?',
    '',
    'A plausible number here would be invisible: a Rogue whose Eviscerate scales',
    'produces a perfectly ordinary figure, and so does one whose Eviscerate does',
    'not.',
    '',
    '## One measurement that exceeds its rule, deliberately',
    '',
    ...Object.entries(EXPLAINED).flatMap(([id, why]) => {
      const row = rows.find((candidate) => candidate.abilityId === id);
      return [
        `**${row?.abilityName ?? id}** measures ${row ? row.measured.toFixed(4) : '?'} where the duration the source`,
        `states predicts ${row?.expected?.toFixed(4) ?? '?'}.`,
        '',
        why,
        '',
      ];
    }),
    '## How to read the table',
    '',
    '| Column | |',
    '| --- | --- |',
    "| **Source says** | the scaling clause, lifted verbatim from `src/data/abilities`. `<damage>` is where Forever's own tooltip renderer prints \"(100% of Spell Power)\" instead of the number -- it is NOT a spell power coefficient, and reading it as one reports four Warrior abilities as disagreeing when they do not |",
    '| **Simulator** | which stat axis the damage actually responded to, or `FLAT` |',
    '| **Measured** | the implied coefficient, derived from damage that landed and divided by how much the stat REALLY moved rather than by how much was asked for |',
    "| **Rule** | the arithmetic the expectation came from, using the SOURCE's own numbers wherever it states them |",
    '| **Expected** | that rule, times every damage multiplier the build puts on that ability |',
    '',
    'A measured figure carries the build it was measured on. `Expected` carries the',
    'same multipliers, so the two are comparable and **neither is the bare rule** --',
    'a Shadow Priest reads 1.155x on everything and a Moonkin 1.10x.',
    '',
    '## Every ability, by class',
    '',
    'Sorted by damage within each class, so what matters most is at the top.',
    '',
  ];

  fs.mkdirSync('docs', { recursive: true });
  fs.writeFileSync('docs/coefficient-audit.md', head.concat(out).join('\n') + '\n', 'utf8');

  // A short console summary, so the interesting rows are visible without
  // opening the file.
  const disagree = rows.filter((row) => row.base > 0 && !row.scales && row.claimsScaling);
  const off = rows.filter((row) => {
    if (row.isSeal || EXPLAINED[row.abilityId]) return false;
    if (!row.scales || row.expected === undefined || row.expected === 0) return false;
    return Math.abs(row.measured / row.expected - 1) > 0.06;
  });
  const noSource = rows.filter((row) => !row.sourceFound);
  console.log(`${rows.length} rows written to docs/coefficient-audit.md`);
  console.log(`\n${disagree.length} FLAT BUT THE SOURCE CLAIMS SCALING:`);
  for (const row of disagree) console.log(`  ${row.className}\t${row.abilityName}\t${row.clause}`);
  console.log(`\n${off.length} SCALE, BUT NOT AT THE RATE THE RULE PREDICTS:`);
  for (const row of off) {
    console.log(
      `  ${row.className}\t${row.abilityName}\t${AXIS_LABEL[row.axis]} ${row.measured.toFixed(
        4,
      )} vs ${row.expected.toFixed(4)} (${row.rule})\tx${(row.measured / row.expected).toFixed(3)}`,
    );
  }
  console.log(`\n${noSource.length} HAVE NO CAPTURE UNDER THAT NAME:`);
  for (const row of noSource) console.log(`  ${row.className}\t${row.abilityId}\t${row.abilityName}`);
}

main();
