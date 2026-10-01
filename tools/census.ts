/*
 * The whole talent census, derived rather than adjusted.
 *
 * `class_audit.ts` prints one class and throws if its four buckets do not
 * account for every talent. This prints all nine and the totals, because
 * HANDOVER.md carries a table of them and **a count is exactly where a clean
 * merge goes arithmetically wrong** -- two branches moving a total by one from
 * the same base both write the same number and git merges it silently.
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

const totals = { talents: 0, fully: 0, partly: 0, ruled: 0, gap: 0 };
const scopes = new Map<string, number>();

console.log('| Class | Talents | Fully | Partly | Ruled out | Live gap |');
console.log('| --- | --- | --- | --- | --- | --- |');

for (const [name, table] of TABLES) {
  let talents = 0;
  let fully = 0;
  let partly = 0;
  let ruled = 0;
  let gap = 0;

  for (const effects of Object.values(table)) {
    talents += 1;
    const unmodelled = effects.filter((e) => e.kind === 'unmodelled');
    const working = effects.length - unmodelled.length;

    for (const entry of unmodelled) {
      const scope = (entry as { scope?: string }).scope;
      if (scope) scopes.set(scope, (scopes.get(scope) ?? 0) + 1);
    }

    if (unmodelled.length === 0) fully += 1;
    else if (working > 0) partly += 1;
    else if (unmodelled.every((e) => (e as { scope?: string }).scope !== undefined)) ruled += 1;
    else gap += 1;
  }

  if (fully + partly + ruled + gap !== talents) {
    throw new Error(`${name}: buckets ${fully + partly + ruled + gap} != ${talents} talents`);
  }

  console.log(`| ${name} | ${talents} | ${fully} | ${partly} | ${ruled} | **${gap}** |`);
  totals.talents += talents;
  totals.fully += fully;
  totals.partly += partly;
  totals.ruled += ruled;
  totals.gap += gap;
}

console.log(
  `| **Total** | **${totals.talents}** | **${totals.fully}** | ` +
    `**${totals.partly}** | **${totals.ruled}** | **${totals.gap}** |`,
);
console.log(
  `\n${totals.fully + totals.partly} of ${totals.talents} talents do something, ` +
    `${totals.ruled} never will, and ${totals.gap} are the actual remaining work.`,
);
const scoped = [...scopes.values()].reduce((a, b) => a + b, 0);
console.log(
  `${scoped} scoped entries: ` +
    [...scopes].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(', '),
);
