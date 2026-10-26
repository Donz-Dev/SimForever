import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation, seconds } from '../../src/engine';
import { CURRENT_PROFILE_VERSION } from '../../src/profiles/CharacterProfile';
import type { CharacterProfile, StoredRotation } from '../../src/profiles/CharacterProfile';
import { fightSection, sectionOf, setSection, withSection } from '../../src/profiles/aplSections';
import { syncDefaultRotation } from '../../src/profiles/rotation';
import { migrateProfile } from '../../src/profiles/migrateProfile';
import { validateProfile } from '../../src/profiles/validateProfile';
import { PRESETS_BY_ID, PROFILE_PRESETS } from '../../src/profiles/presets';
import { MULTI_TARGET_DEFAULTS, narrowedEntries } from '../../src/profiles/multiTarget';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { HEALER_ID, healerEncounter } from '../../src/simulator/healerEncounter';

/*
 * ==============================================================================
 * ROUND 64: the Priority List split into "APL: Single Target" and "APL: Multi
 * Target", each with its own pre-combat and combat list, and each fight running
 * one of them.
 * ==============================================================================
 */

const only = (abilityId: string): StoredRotation => ({ source: 'custom', name: abilityId, entries: [{ abilityId }] });

function castsIn(config: ReturnType<typeof trainingDummyEncounter>, casterId: string): ReadonlySet<string> {
  const events: TelemetryEvent[] = [];
  const simulation = new Simulation(config, { emit: (e) => events.push(e) });
  simulation.begin();
  simulation.advanceTo(seconds(30));
  return new Set(
    events.filter((e) => e.type === 'cast' && e.sourceId === casterId).map((e) => (e as { abilityId: string }).abilityId),
  );
}

describe('which section a fight runs', () => {
  it("is the owner's split", () => {
    expect(fightSection({ targets: 1 })).toBe('single');
    expect(fightSection({ targets: 2 })).toBe('multi');
    expect(fightSection({ targets: 8 })).toBe('multi');
    expect(fightSection({ targets: 1, healer: 'tank' })).toBe('single');
    expect(fightSection({ targets: 1, healer: 'raid' })).toBe('multi');
  });

  it('runs the Single Target list at one target and the Multi Target list at three', () => {
    const preset = PRESETS_BY_ID.get('mage_fire')!.build();
    const profile: CharacterProfile = {
      ...preset,
      precombat: undefined,
      rotation: only('fireball'),
      multiTarget: { rotation: only('flamestrike') },
    };
    const at = (targets: number) =>
      castsIn(
        trainingDummyEncounter({ ...profile, encounter: { ...profile.encounter, numberOfTargets: targets } }, 3),
        'player_1',
      );
    expect([...at(1)]).toEqual(['fireball']);
    expect([...at(3)]).toEqual(['flamestrike']);
  });

  it('runs Single Target in the tank healer fight and Multi Target in the raid healer fight', () => {
    const preset = PRESETS_BY_ID.get('holy_pal')!.build();
    const profile: CharacterProfile = {
      ...preset,
      precombat: undefined,
      rotation: { ...only('flash_of_light'), entries: [{ abilityId: 'flash_of_light', target: { kind: 'tank' } }] },
      multiTarget: {
        rotation: { ...only('holy_light'), entries: [{ abilityId: 'holy_light', target: { kind: 'tank' } }] },
      },
    };
    expect([...castsIn(healerEncounter(profile, 'tank', 3), HEALER_ID)]).toEqual(['flash_of_light']);
    expect([...castsIn(healerEncounter(profile, 'raid', 3), HEALER_ID)]).toEqual(['holy_light']);
  });

  it('runs each section with ITS OWN pre-combat list', () => {
    const preset = PRESETS_BY_ID.get('mage_fire')!.build();
    const profile: CharacterProfile = {
      ...preset,
      rotation: only('fireball'),
      precombat: [{ abilityId: 'mage_armor', secondsBefore: 5 }],
      multiTarget: { rotation: only('flamestrike') },
    };
    const atThree = { ...profile, encounter: { ...profile.encounter, numberOfTargets: 3 } };
    expect(castsIn(trainingDummyEncounter(profile, 3), 'player_1').has('mage_armor')).toBe(true);
    expect(castsIn(trainingDummyEncounter(atThree, 3), 'player_1').has('mage_armor')).toBe(false);
  });
});

describe('the presets', () => {
  it('carry both lists, starting identical, so no figure moves', () => {
    for (const preset of PROFILE_PRESETS) {
      const profile = preset.build();
      expect(profile.multiTarget, preset.id).toBeDefined();
      /*
       * Round 78: a preset with an optimised Multi Target list carries THAT, as
       * a custom list; every other preset still starts with an identical copy.
       */
      const own = MULTI_TARGET_DEFAULTS[preset.id];
      if (own) {
        expect(profile.multiTarget!.rotation, preset.id).toEqual({
          source: 'custom',
          name: own.name,
          entries: narrowedEntries(own, profile),
          ...(own.smartHealing ? { smartHealing: true } : {}),
        });
        expect(profile.multiTarget!.precombat, preset.id).toEqual(own.precombat ?? profile.precombat);
        continue;
      }
      expect(profile.multiTarget!.rotation, preset.id).toEqual(profile.rotation);
      expect(profile.multiTarget!.precombat, preset.id).toEqual(profile.precombat);
    }
  });
});

describe('editing one section', () => {
  it('leaves the other alone', () => {
    const profile = PRESETS_BY_ID.get('dw_fury')!.build();
    const view = withSection(profile, 'multi');
    const edited = setSection(profile, 'multi', { ...view, rotation: only('whirlwind') });
    expect(edited.multiTarget!.rotation).toEqual(only('whirlwind'));
    expect(edited.rotation).toEqual(profile.rotation);
    expect(sectionOf(edited, 'single').rotation).toEqual(profile.rotation);
  });

  it('re-derives a default list in either section and never touches a custom one', () => {
    // DW Fury's own Multi Target list (round 78) is custom, so start from the
    // default copy a fresh character gets.
    const { multiTarget: _own, ...built } = PRESETS_BY_ID.get('dw_fury')!.build();
    void _own;
    const profile = syncDefaultRotation(built);
    const customSingle = { ...profile, rotation: only('slam') };
    // A change to the build: the default Multi Target list follows, the custom
    // Single Target one does not.
    const synced = syncDefaultRotation({
      ...customSingle,
      character: { ...customSingle.character, stance: 'battle' },
    });
    expect(synced.rotation).toEqual(only('slam'));
    expect(synced.multiTarget!.rotation.source).toBe('default');
    expect(synced.multiTarget!.rotation).not.toEqual(profile.multiTarget!.rotation);
  });
});

describe('a saved file', () => {
  it('from version 17 gains a Multi Target list copied from its one list', () => {
    const preset = PRESETS_BY_ID.get('mage_fire')!.build();
    const { multiTarget: _dropped, ...old } = { ...preset, version: 17 };
    void _dropped;
    const result = migrateProfile(old);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const validated = validateProfile(result.value);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.profile.version).toBe(CURRENT_PROFILE_VERSION);
    expect(validated.profile.multiTarget!.rotation).toEqual(preset.rotation);
    // Version 18 to 19 then gives it the Start Auto-attack the preset already
    // carries, so the copy and the original still agree.
    expect(validated.profile.multiTarget!.precombat).toEqual(preset.precombat);
  });

  it('refuses a Multi Target list with a bad entry, naming where', () => {
    const preset = PRESETS_BY_ID.get('mage_fire')!.build();
    const bad = { ...preset, multiTarget: { rotation: { source: 'custom', name: 'x', entries: [{}] } } };
    const result = validateProfile(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((issue) => issue.path)).toContain('multiTarget.rotation.entries.0');
  });
});
