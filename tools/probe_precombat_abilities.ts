/**
 * What each preset can actually DO before the pull, read off the built
 * character's own ability book.
 *
 * ==============================================================================
 * WRITTEN FOR ONE JOB: the ruleset owner specified a "Before the Pull" opener
 * for all 28 profiles by ABILITY NAME, and a precombat action is stored by
 * ability ID. Mapping one to the other by guessing is how an entry ends up
 * naming something the build does not have -- and `runPrecombat` SKIPS an
 * unknown id in silence, exactly as `PriorityRotation` does, so a typo is a
 * line that does nothing rather than an error.
 *
 * SO THIS PRINTS THE BOOK, not a list somebody believes in: every ability a
 * preset's built character holds, with the three fields that decide whether a
 * pre-pull cast of it means anything.
 *
 *   castTimeMs      a "begin casting X" lead is this, and `castAbility`'s
 *                   precombat mode zeroes it so the spell lands at t=0
 *   cooldownMs       one of the two observable consequences of the lead time
 *   onNextSwing     a QUEUED ability -- it is not cast, it replaces a swing
 *   channelTicks    `runPrecombat` refuses a channel outright
 *
 * `ABILITIES=name` filters to ability names containing that text, which is how
 * one of the owner's names is checked across every profile at once.
 * ==============================================================================
 */
import { PROFILE_PRESETS } from '../src/profiles/presets';
import { characterAtCombatStart } from '../src/simulator';

const wanted = (process.env.ABILITIES ?? '').toLowerCase();
const only = (process.env.PROFILES ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

for (const preset of PROFILE_PRESETS) {
  if (only.length > 0 && !only.includes(preset.id)) continue;

  const player = characterAtCombatStart(preset.build());
  if (!player) {
    console.log(`${preset.id}: NO PLAYER`);
    continue;
  }

  const rows = player.abilities.all
    .filter((ability) =>
      wanted === ''
        ? true
        : ability.name.toLowerCase().includes(wanted) ||
          ability.id.toLowerCase().includes(wanted),
    )
    .map((ability) => {
      const cast = ability.castTimeMs ?? 0;
      const flags = [
        cast > 0 ? `cast ${(cast / 1000).toFixed(1)}s` : 'instant',
        ability.cooldownMs ? `cd ${(ability.cooldownMs / 1000).toFixed(0)}s` : '',
        (ability.channelTicks ?? 1) > 1 ? `CHANNEL x${ability.channelTicks}` : '',
        ability.onNextSwing !== undefined ? 'ON-NEXT-SWING' : '',
        ability.stances ? `stances ${ability.stances.join('/')}` : '',
      ].filter((part) => part.length > 0);
      return `    ${ability.id.padEnd(28)} ${ability.name.padEnd(26)} ${flags.join(', ')}`;
    });

  console.log(`\n${preset.id}  (${preset.label})`);
  if (rows.length === 0) console.log('    -- nothing matched --');
  else console.log(rows.join('\n'));
}
