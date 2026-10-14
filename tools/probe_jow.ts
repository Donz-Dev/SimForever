/*
 * WHICH ACTIONS ACTUALLY ROLL FOR JUDGEMENT OF WISDOM, read off the event
 * stream rather than off the reaction's source.
 *
 * A grant carries no cause, so this joins each grant to whatever the character
 * CAST or DEALT at the same instant -- which is exactly the dedupe key the
 * reaction's own shared closure uses.
 */
import { PRESETS_BY_ID } from '../src/profiles';
import { runProfile } from '../src/simulator';

const PRESET = process.env.PRESET ?? 'bm_hunter';
const SEEDS = [12345, 777, 20260101, 4242, 99];

const grants = new Map<string, number>();
let total = 0;

for (const seed of SEEDS) {
  const built = PRESETS_BY_ID.get(PRESET)!.build();
  const run = runProfile(
    { ...built, simulation: { ...built.simulation, iterations: 1, seed } },
    seed,
  );

  // What the player cast or dealt, by instant.
  const atInstant = new Map<number, Set<string>>();
  const note = (at: number, what: string) => {
    const set = atInstant.get(at) ?? new Set<string>();
    set.add(what);
    atInstant.set(at, set);
  };
  const playerId = run.actors.find((a) => a.faction === 'friendly')!.id;

  for (const e of run.timeline) {
    const any = e as unknown as Record<string, unknown>;
    if (e.type === 'cast' && any.sourceId === playerId) note(e.timestamp, `cast ${any.abilityId}`);
    if (e.type === 'damage' && any.sourceId === playerId) {
      note(e.timestamp, `damage ${any.abilityName}${any.periodic ? ' (tick)' : ''}`);
    }
  }

  for (const e of run.timeline) {
    const any = e as unknown as Record<string, unknown>;
    if (e.type !== 'resource_gained') continue;
    if (any.sourceId !== 'judgement_of_wisdom' && any.sourceName !== 'Judgement of Wisdom') continue;
    total += 1;
    const what = [...(atInstant.get(e.timestamp) ?? new Set(['<nothing at this instant>']))]
      .sort()
      .join(' + ');
    grants.set(what, (grants.get(what) ?? 0) + 1);
  }
}

console.log(`\n${PRESET}: ${total} Judgement of Wisdom grants over ${SEEDS.length} fights\n`);
for (const [what, n] of [...grants].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${what}`);
}
