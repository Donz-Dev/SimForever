/* Which abilities a build KNOWS but its list never names. The Hunter lesson. */
import { PRESETS_BY_ID } from '../src/profiles';
import { characterAtCombatStart } from '../src/simulator';

for (const preset of (process.env.PRESETS ?? 'druid_moonkin,druid_cat').split(',')) {
  const profile = PRESETS_BY_ID.get(preset)!.build();
  const named = new Set(profile.rotation.entries.map((e) => e.abilityId));
  const book = characterAtCombatStart(profile)!.abilities.all.map((a) => a.id);
  console.log(`\n${preset}: in the book, in no list --`);
  for (const id of book) if (!named.has(id)) console.log(`   ${id}`);
}
