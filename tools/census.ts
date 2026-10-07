/*
 * The whole talent census, derived rather than adjusted.
 *
 *   npx vite-node tools/census.ts
 *
 * ----------------------------------------------------------------------------
 * `class_audit.ts` prints ONE class and throws if its four buckets do not
 * account for every talent. This prints all nine and the totals, because
 * HANDOVER.md carries a table of them and **a count is exactly where a clean
 * merge goes arithmetically wrong**: two branches moving a total by one from the
 * same base both write the same number, and git merges it without a conflict.
 *
 * BOTH TOOLS SHARE ONE CLASSIFIER NOW. This file used to carry its own copy of
 * the four-way rule, and the copy left out `appliedElsewhere` -- so the moment a
 * clause of a working Rogue poison talent was scoped, this tool called the
 * talent RULED OUT and `class_audit.ts` called it PARTLY. Whichever was run last
 * would have been published. See `game/talents/talentCensus.ts`.
 * ----------------------------------------------------------------------------
 */
import { WARRIOR_TALENT_EFFECTS } from '../src/game/talents/warriorEffects';
import { PALADIN_TALENT_EFFECTS } from '../src/game/talents/paladinEffects';
import { DRUID_TALENT_EFFECTS } from '../src/game/talents/druidEffects';
import { HUNTER_TALENT_EFFECTS } from '../src/game/talents/hunterEffects';
import { SHAMAN_TALENT_EFFECTS } from '../src/game/talents/shamanEffects';
import { MAGE_TALENT_EFFECTS } from '../src/game/talents/mageEffects';
import { PRIEST_TALENT_EFFECTS } from '../src/game/talents/priestEffects';
import { ROGUE_TALENT_EFFECTS } from '../src/game/talents/rogueEffects';
import { WARLOCK_TALENT_EFFECTS } from '../src/game/talents/warlockEffects';
import type { TalentEffects } from '../src/game/talents/TalentEffect';
import {
  assertAccountsForEveryTalent,
  censusOf,
  scopesOf,
} from '../src/game/talents/talentCensus';

const TABLES: [string, Readonly<Record<string, TalentEffects>>][] = [
  ['Warrior', WARRIOR_TALENT_EFFECTS],
  ['Paladin', PALADIN_TALENT_EFFECTS],
  ['Druid', DRUID_TALENT_EFFECTS],
  ['Hunter', HUNTER_TALENT_EFFECTS],
  ['Shaman', SHAMAN_TALENT_EFFECTS],
  ['Mage', MAGE_TALENT_EFFECTS],
  ['Priest', PRIEST_TALENT_EFFECTS],
  ['Rogue', ROGUE_TALENT_EFFECTS],
  ['Warlock', WARLOCK_TALENT_EFFECTS],
];

const totals = { talents: 0, fully: 0, partly: 0, ruledOut: 0, liveGap: 0 };
const scopes = new Map<string, number>();

console.log('| Class | Talents | Fully | Partly | Ruled out | Live gap |');
console.log('| --- | --- | --- | --- | --- | --- |');

for (const [name, table] of TABLES) {
  const counts = censusOf(table);
  assertAccountsForEveryTalent(name, counts);

  for (const scope of scopesOf(table)) scopes.set(scope, (scopes.get(scope) ?? 0) + 1);

  console.log(
    `| ${name} | ${counts.talents} | ${counts.fully} | ${counts.partly} | ` +
      `${counts.ruledOut} | **${counts.liveGap}** |`,
  );
  totals.talents += counts.talents;
  totals.fully += counts.fully;
  totals.partly += counts.partly;
  totals.ruledOut += counts.ruledOut;
  totals.liveGap += counts.liveGap;
}

console.log(
  `| **Total** | **${totals.talents}** | **${totals.fully}** | ` +
    `**${totals.partly}** | **${totals.ruledOut}** | **${totals.liveGap}** |`,
);
console.log(
  `\n${totals.fully + totals.partly} of ${totals.talents} talents do something, ` +
    `${totals.ruledOut} never will, and ${totals.liveGap} are the actual remaining work.`,
);
const scoped = [...scopes.values()].reduce((a, b) => a + b, 0);
console.log(
  `${scoped} scoped entries: ` +
    [...scopes]
      .sort((a, b) => b[1] - a[1])
      .map(([name, n]) => `${n} ${name}`)
      .join(', '),
);
