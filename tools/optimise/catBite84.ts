/**
 * The Cat's Ferocious Bite pool, priced on the 1.60.1.70707 tree: Predatory
 * Discipline keeps the energy above the bite's 35 and still pays 2.7 a point
 * for it, so the bite at five points waits for the bar.
 *
 *   PRESET=druid_cat FILE=tools/optimise/catBite84.ts VARIANTS=cat84Pool DURATION=120 ITER=400 npx vite-node tools/probe_build.ts
 *
 * Every group starts with the shipped list as its control. The pool bite is
 * the SECOND `ferocious_bite` entry (the first is the last-eight-seconds one)
 * and the filler is the THIRD `shred` (Clearcasting, end-of-fight, filler).
 */
import { type Apply, type Variant, apl, chain } from '../buildVariants';
import { all, comboPoints, not, resource, targetTime } from '../../src/game/rotations/apl/shorthand';
import type { AplCondition } from '../../src/game/rotations/apl';

const control: Variant = { label: 'the shipped list -- the control', apply: (p) => p };

const setCondition = (id: string, condition: AplCondition | undefined, nth: number): Apply =>
  apl((entries) => {
    let seen = -1;
    const at = entries.findIndex((e) => e.abilityId === id && ++seen === nth);
    if (at < 0) throw new Error(`no entry ${nth} for ${id}`);
    const { condition: _old, ...rest } = entries[at];
    entries[at] = condition === undefined ? rest : { ...rest, condition };
    return entries;
  });

const removeNth = (id: string, nth: number): Apply =>
  apl((entries) => {
    let seen = -1;
    const at = entries.findIndex((e) => e.abilityId === id && ++seen === nth);
    if (at < 0) throw new Error(`no entry ${nth} for ${id}`);
    entries.splice(at, 1);
    return entries;
  });

const five = comboPoints('atLeast', 5);

/** The pool bite and its held filler, at pool `energy` and Rip gate `ripSeconds`. */
const pool = (energy: number, ripSeconds = 4): Apply => {
  const ripUp = ripSeconds > 0 ? all(five, targetTime('atLeast', ripSeconds, 'rip')) : five;
  return chain(
    setCondition('ferocious_bite', all(ripUp, resource('atLeast', energy, 'energy')), 1),
    setCondition('shred', not(all(ripUp, resource('below', energy, 'energy'))), 2),
  );
};

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  cat84Pool: [
    control,
    ...[35, 50, 60, 70, 80, 85, 95, 100].map((e) => ({ label: `pool to ${e} energy`, apply: pool(e) })),
  ],
  cat84Rip: [
    control,
    ...[0, 2, 6, 8].map((s) => ({ label: `bite while Rip has ${s}s or more`, apply: pool(90, s) })),
    {
      label: 'no Rip at all: every five-point finisher is a pooled bite',
      apply: chain(removeNth('rip', 0), pool(90, 0)),
    },
  ],
  // The knock-on: the pool re-swept with the bite allowed whenever Rip is up.
  cat84PoolRip0: [
    control,
    ...[35, 50, 70, 90, 100].map((e) => ({ label: `Rip up at all, pool to ${e}`, apply: pool(e, 0) })),
  ],
  cat84Sp: [
    control,
    {
      label: 'Shifting Power at 60 energy or less',
      apply: setCondition('shifting_power', resource('atMost', 60, 'energy'), 0),
    },
    {
      label: 'Shifting Power ungated',
      apply: setCondition('shifting_power', undefined, 0),
    },
  ],
};
