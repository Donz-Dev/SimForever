/*
 * DOES THE ARCANE MAGE ARRIVE AT THE ARCANE BLAST CAP?
 *
 * The `USES=1` "before the pull" block cannot answer it: that column prints the
 * ability's WHOLE-FIGHT cast count, so four identical `arcane_blast` rows each
 * read 13.2 and its `<-- NEVER HAPPENED` flag can never fire for a spell that is
 * also the filler. And `aura_applied` fires ONCE -- the other three casts are
 * refreshes -- so counting that event says 1 where the answer is 4.
 *
 * SO THE THING TO READ IS THE STACK COUNT ON THE COMBATANT at the pull.
 */
import { Simulation } from '../src/engine';
import { PRESETS_BY_ID } from '../src/profiles/presets';
import { trainingDummyEncounter } from '../src/simulator/trainingDummyEncounter';
import { ARCANE_BLAST_MAX_STACKS } from '../src/game/auras/mage';

const profile = PRESETS_BY_ID.get('mage_arcane')!.build();
const simulation = new Simulation(trainingDummyEncounter(profile, 4242));
simulation.begin();

const player = simulation.combatants.find((c) => c.kind === 'player')!;
const stacks = player.auras.stacksOf('arcane_blast');
const mana = player.resources.get('mana') as { current: number; maximum: number } | undefined;

console.log(`arcane_blast stacks at the pull: ${stacks} of ${ARCANE_BLAST_MAX_STACKS}`);
console.log(`mana at the pull: ${mana ? `${mana.current.toFixed(0)} of ${mana.maximum.toFixed(0)}` : 'n/a'}`);
for (const id of ['arcane_power', 'mage_armor', 'pyroblast']) {
  console.log(`  ${id.padEnd(14)} ${player.auras.has(id) ? 'up' : 'not up'}`);
}
console.log(
  `\nverdict: ${stacks === ARCANE_BLAST_MAX_STACKS ? 'AT THE CAP' : 'SHORT OF THE CAP'}`,
);
