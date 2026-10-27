import { describe, expect, it } from 'vitest';
import { PRESETS_BY_ID } from '../../src/profiles';
import { sectionOf } from '../../src/profiles/aplSections';
import { ROGUE_MULTI_TARGET } from '../../src/profiles/multiTarget/rogue';
import type { AplEntry } from '../../src/game/rotations/apl';

/*
 * THE ROGUE MULTI TARGET LISTS (rounds 78 and 80).
 *
 * Each is DERIVED from its preset's Single Target stock list, and narrowed by
 * a race and the consumable selections written into `multiTarget/rogue.ts` by
 * hand -- so the thing that can drift is that copy of the preset's race and
 * selections. Each test compares the stored Multi Target list against the
 * stored Single Target list entry for entry: the only differences allowed are
 * the ones that file names, written out again here.
 */

const isEndOfFight = (entry: AplEntry) => JSON.stringify(entry.condition ?? {}).includes('fightRemaining');
const text = (entry: AplEntry | undefined) => JSON.stringify(entry?.condition ?? null);

function lists(id: string) {
  const profile = PRESETS_BY_ID.get(id)!.build();
  return { single: profile.rotation.entries, multi: sectionOf(profile, 'multi').rotation.entries };
}

/**
 * Walk both lists, skipping what the Multi Target list REMOVED and what it
 * ADDED at the top, and hand every pair whose ability is in `changed` to
 * `check`; every other pair must be identical.
 */
function compare(
  id: string,
  changed: Readonly<Record<string, (multi: AplEntry, single: AplEntry) => void>>,
  removed: readonly string[] = [],
  addedAtTop = 0,
) {
  const { single, multi } = lists(id);
  const kept = single.filter((e) => !removed.includes(e.abilityId));
  const rest = multi.slice(addedAtTop);
  expect(rest.map((e) => [e.abilityId, e.disabled ?? false])).toEqual(
    kept.map((e) => [e.abilityId, e.disabled ?? false]),
  );
  rest.forEach((entry, i) => {
    const check = changed[entry.abilityId];
    if (check && !isEndOfFight(entry)) check(entry, kept[i]);
    else expect(entry).toEqual(kept[i]);
  });
  return multi.slice(0, addedAtTop);
}

describe('the Rogue Multi Target defaults', () => {
  it('give Combat Slice and Dice at one point, Thistle Tea at 25, an ungated potion and no Vanish into Garrote', () => {
    compare('rogue_combat', {
      slice_and_dice: (m, s) => {
        expect(text(m)).toContain('"points":1');
        expect(text(s)).toContain('"points":3');
      },
      thistle_tea: (m, s) => {
        expect(text(m)).toContain('"amount":25');
        expect(text(s)).toContain('"amount":15');
      },
      major_frenzy_potion: (m) => expect(m.condition).toBeUndefined(),
    }, ['vanish']);
    expect(lists('rogue_combat').single[0].abilityId).toBe('vanish');
  });

  it('give Venom Cold Blood on points, Slice and Dice at two, Thistle Tea at 25 and an ungated potion', () => {
    compare('rogue_venom', {
      cold_blood: (m) => {
        expect(m.sequence).toEqual(['eviscerate']);
        expect(m.condition).toEqual({ kind: 'comboPoints', compare: 'atLeast', points: 3 });
      },
      slice_and_dice: (m) => expect(text(m)).toContain('"points":2'),
      thistle_tea: (m, s) => {
        expect(text(m)).toContain('"amount":25');
        expect(text(s)).toContain('"amount":10');
      },
      major_frenzy_potion: (m) => expect(m.condition).toBeUndefined(),
    });
  });

  it('give Combat Mut Slice and Dice at two and an ungated potion', () => {
    compare('rogue_combat_mut', {
      slice_and_dice: (m, s) => {
        expect(text(m)).toContain('"points":2');
        expect(text(s)).toContain('"points":1');
      },
      major_frenzy_potion: (m) => expect(m.condition).toBeUndefined(),
    });
  });

  it('give Hemo Dagger a two-point Rupture, four-point finishers and an end-of-fight Eviscerate', () => {
    const four = (m: AplEntry) => {
      expect(text(m)).toContain('"points":4');
      expect(text(m)).toContain('"seconds":2');
    };
    const added = compare(
      'rogue_hemo',
      {
        rupture: (m) => expect(text(m)).toContain('"points":2'),
        cold_blood: four,
        eviscerate: four,
      },
      [],
      1,
    );
    expect(added).toHaveLength(1);
    expect(added[0].abilityId).toBe('eviscerate');
    expect(isEndOfFight(added[0])).toBe(true);
  });

  it('give Pure Hemo no Rupture, Slice and Dice at one point and Thistle Tea at 25', () => {
    compare(
      'rogue_pure_hemo',
      {
        slice_and_dice: (m, s) => {
          expect(text(m)).toContain('"points":1');
          expect(text(s)).toContain('"points":3');
        },
        thistle_tea: (m) => expect(text(m)).toContain('"amount":25'),
      },
      ['rupture'],
    );
    expect(lists('rogue_pure_hemo').multi.some((e) => e.abilityId === 'rupture')).toBe(false);
  });

  it('give Rupture no list of its own, because nothing tried beat its Single Target list', () => {
    expect(Object.keys(ROGUE_MULTI_TARGET).sort()).toEqual(
      ['rogue_combat', 'rogue_combat_mut', 'rogue_hemo', 'rogue_pure_hemo', 'rogue_venom'],
    );
  });
});
