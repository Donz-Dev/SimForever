/**
 * Round 81: why a Tauren Bear out-damages a Windshaper Bear on one target.
 *
 *   PRESET=druid_bear FILE=tools/optimise/bearRaceProbe81.ts VARIANTS=bear81Race ITER=1000 DURATION=120 METRIC=dps npx vite-node tools/probe_build.ts
 */
import { type Apply, type Variant, apl, chain } from '../buildVariants';
import type { RaceId } from '../../src/game/character';
import type { AplEntry } from '../../src/game/rotations/apl';

const race =
  (id: RaceId): Apply =>
  (profile) => ({ ...profile, character: { ...profile.character, race: id } });

/** Lacerate only while Primal Bite has more than `s` seconds of cooldown left. */
const lacerateClearOfBite = (s: number): Apply =>
  apl((entries: AplEntry[]) =>
    entries.map((entry) =>
      entry.abilityId === 'lacerate'
        ? { ...entry, condition: { kind: 'cooldownTime', abilityId: 'mangle', compare: 'above', seconds: s } as never }
        : entry,
    ),
  );

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  bear81Race: [
    { label: 'Windshaper Skyborne (the shipped race) -- the control', apply: (p) => p },
    { label: 'Tauren', apply: race('tauren') },
    { label: 'Windshaper, Lacerate only while Primal Bite has >1.5s left', apply: lacerateClearOfBite(1.5) },
    { label: 'Tauren, Lacerate only while Primal Bite has >1.5s left', apply: chain(race('tauren'), lacerateClearOfBite(1.5)) },
  ],
};
