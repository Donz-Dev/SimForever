/**
 * Every ability of two minutes or more that any preset's character carries --
 * the "major cooldowns" a dungeon route holds for the pulls that call for them
 * -- with whether `isHeldMajorCooldown` holds it.
 *
 *   npx vite-node tools/probe_major_cooldowns.ts
 */
import { PROFILE_PRESETS } from '../src/profiles/presets';
import { characterAtCombatStart } from '../src/simulator';
import { isHeldMajorCooldown, majorCooldownMs } from '../src/game/encounters/dungeonRoute';

const seen = new Map<string, { name: string; cooldownMs: number; held: boolean; presets: string[] }>();
for (const preset of PROFILE_PRESETS) {
  const player = characterAtCombatStart(preset.build());
  if (!player) continue;
  for (const ability of player.abilities.all) {
    const cooldownMs = majorCooldownMs(ability);
    if (cooldownMs === undefined) continue;
    const row = seen.get(ability.id) ?? {
      name: ability.name,
      cooldownMs,
      held: isHeldMajorCooldown(ability),
      presets: [],
    };
    row.presets.push(preset.id);
    seen.set(ability.id, row);
  }
}
for (const [id, row] of [...seen].sort((a, b) => Number(b[1].held) - Number(a[1].held) || a[0].localeCompare(b[0]))) {
  console.log(
    `${row.held ? 'HELD ' : 'free '} ${id.padEnd(30)} ${(row.cooldownMs / 1000).toFixed(0).padStart(5)}s  ${row.name}  (${row.presets.length} presets)`,
  );
}
