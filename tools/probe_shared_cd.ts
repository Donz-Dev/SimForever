/*
 * Does the Arcane Shot / Summon Hawk shared cooldown actually BITE in a fight?
 *
 * A `cooldownGroup` that is declared and never exercised looks exactly like one
 * that works. This reads the CAST timestamps off the event stream and prints
 * the gap between consecutive casts of EITHER ability.
 */
import { PRESETS_BY_ID } from '../src/profiles';
import { runProfile } from '../src/simulator';
import { HUNTER_TREE } from './buildVariants';

const SHARED = new Set(['arcane_shot', 'summon_hawk']);

/*
 * AND THE CASE THE TALENT'S OWN TOOLTIP NAMES: "Reduces the cooldown of your
 * Arcane Shot by 1.5 sec. DOES NOT AFFECT THE COOLDOWN OF ABILITIES WHICH SHARE
 * A COOLDOWN WITH ARCANE SHOT." A BM Hunter can take both -- Improved Arcane
 * Shot is two of its free Marksmanship points -- so the clause is reachable,
 * and the question is whether a shortened Arcane Shot also shortens the
 * lockout Summon Hawk sits behind.
 */
const BM_WITH_IMPROVED = HUNTER_TREE({
  deadly_aspects: 5,
  unleashed_fury: 5,
  ferocity: 5,
  frenzy: 5,
  focused_fire: 2,
  bestial_discipline: 2,
  summon_hawk: 1,
  bestial_wrath: 1,
  endurance_training: 3,
  bestial_swiftness: 1,
  intimidation: 1,
  hawk_eye: 3,
  lethal_attacks: 5,
  careful_aim: 5,
  improved_arcane_shot: 2,
  mortal_shots: 5,
});


for (const preset of ['bm_hunter', 'lw_ranged', 'bm_hunter+improved_arcane_shot']) {
  const id = preset.split('+')[0];
  const base = PRESETS_BY_ID.get(id)!.build();
  const built = preset.includes('+') ? BM_WITH_IMPROVED(base) : base;
  let worst = Infinity;
  let casts = 0;
  const counts = new Map<string, number>();

  for (const seed of [12345, 777, 20260101, 4242, 99]) {
    const run = runProfile({ ...built, simulation: { ...built.simulation, iterations: 1, seed } }, seed);
    const times = run.timeline
      .filter((e) => e.type === 'cast' && SHARED.has((e as { abilityId: string }).abilityId))
      .map((e) => ({ at: e.timestamp, name: (e as { abilityId: string }).abilityId }));
    for (const t of times) counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
    casts += times.length;
    for (let i = 1; i < times.length; i += 1) {
      worst = Math.min(worst, times[i].at - times[i - 1].at);
    }
  }

  console.log(
    `${preset.padEnd(12)} ${casts} casts over 5 fights  ` +
      `[${[...counts].map(([n, c]) => `${n} ${c}`).join(', ')}]  ` +
      `smallest gap between consecutive casts: ${worst === Infinity ? 'n/a' : `${worst}ms`}`,
  );
}
