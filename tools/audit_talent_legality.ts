/**
 * Is every preset's talent tree legal? A preset's allocation goes through
 * `legalAllocation` inside `createPlayer`, which DROPS what it cannot keep in
 * silence -- so a stranded talent never errors, it just stops existing.
 *
 *   npx vite-node tools/audit_talent_legality.ts
 */
import { PROFILE_PRESETS as PRESETS } from '../src/profiles/presets';
import { legalAllocation } from '../src/game/talents/talentRules';
import { talentsForClass } from '../src/game/talents/talentData';

let illegal = 0;
for (const preset of PRESETS) {
  const profile = preset.build();
  const cls = profile.character.characterClass;
  const tree = talentsForClass(cls)!;
  const talents = profile.talents;
  const spent = Object.values(talents).reduce((a, b) => a + b, 0);
  const { dropped } = legalAllocation(tree, talents);
  const ok = dropped.length === 0 && spent <= 51;
  if (!ok) illegal++;
  console.log(
    `${ok ? 'ok     ' : 'ILLEGAL'}  ${preset.id.padEnd(28)} ${String(spent).padStart(2)} pts` +
      (dropped.length ? `  dropped: ${dropped.join(', ')}` : '') +
      (spent > 51 ? '  OVER 51' : ''),
  );
}
console.log(`\n${PRESETS.length} presets, ${illegal} illegal`);
