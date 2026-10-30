import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { Simulation } from '../../src/engine';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { PRESETS_BY_ID, PROFILE_PRESETS } from '../../src/profiles/presets';
import { getCombatStyle } from '../../src/game/character/combatStyles';
import {
  ALL_RACIAL_ABILITY_IDS,
  viableRacialsFor,
} from '../../src/game/rotations/racialCooldowns';
import { revelationSpender } from '../../src/game/items/procs';
import { GARROTE } from '../../src/game/auras/rogue';
import { GARROTE_TICK_AP_COEFFICIENT } from '../../src/game/combat/coefficients';
import { benchmarkItemIdsFor } from '../../src/game/items/benchmarkSets';
import { pickerItems } from '../../src/ui/panels/gear/slots';
import { CAT_BITE_POOL_ENERGY, DRUID_CAT } from '../../src/game/rotations/druid';
import { ruptureRogueProfile } from '../helpers/ruptureRogue';

/*
 * ==============================================================================
 * ROUND 37'S MECHANISMS, each asserted on what it DOES rather than on the
 * declaration that asks for it. The list and opener changes are pinned in their
 * own files; this one holds the pieces that needed engine or content work.
 * ==============================================================================
 */

/** Every cast one fight of a preset made, with its timestamp. */
function castsIn(presetId: string, seed = 4242): readonly { id: string; at: number }[] {
  // `rogue_rupture` is no longer a preset (round 82); its build is rebuilt by hand.
  const profile =
    presetId === 'rogue_rupture' ? ruptureRogueProfile() : PRESETS_BY_ID.get(presetId)!.build();
  const events: TelemetryEvent[] = [];
  new Simulation(trainingDummyEncounter(profile, seed), {
    emit: (event) => events.push(event),
  }).run();
  return events
    .filter((event) => event.type === 'cast')
    .map((event) => ({
      id: (event as { abilityId: string }).abilityId,
      at: event.timestamp,
    }));
}

describe('a racial no race of the class can learn is removed from its list', () => {
  /*
   * "Ensure that a non-visible racial is actually a viable racial" -- the owner.
   * The audit found 40 such entries across 19 presets (Elune's Light on a
   * Paladin, Berserking on a Warlock, and so on); every one is gone.
   */
  it('leaves no preset carrying a racial its class cannot have', () => {
    for (const preset of PROFILE_PRESETS) {
      const profile = preset.build();
      const viable = viableRacialsFor(profile.character.characterClass);
      for (const entry of profile.rotation.entries) {
        const named = [entry.abilityId, ...(entry.sequence ?? [])];
        for (const id of named) {
          if (!ALL_RACIAL_ABILITY_IDS.has(id)) continue;
          expect(viable.has(id), `${preset.id} / ${id}`).toBe(true);
        }
      }
    }
  });
});

describe('a channel inherits a cast charge for the whole channel', () => {
  it('spends Revelation only on the final tick', () => {
    const spender = revelationSpender();
    expect(spender.canTrigger!(undefined as never, undefined as never, { final: false } as never))
      .toBe(false);
  });
});

describe('a Vanish sequence opens its own stealth gate', () => {
  /*
   * PREMEDITATION, AMBUSH AND GARROTE ALL REQUIRE STEALTH, which Vanish is what
   * grants -- so checking the whole sequence before casting any of it would
   * refuse every one of them. `Ability.enabledBy` names the step that opens the
   * gate, and the sequence check forgives that refusal and no other.
   */
  it('casts Vanish, Premeditation and Ambush in one instant on Rupture', () => {
    const casts = castsIn('rogue_rupture');
    const vanishes = casts.filter((cast) => cast.id === 'vanish');
    expect(vanishes.length).toBeGreaterThan(0);
    for (const vanish of vanishes) {
      const same = casts.filter((cast) => cast.at === vanish.at).map((cast) => cast.id);
      expect(same).toEqual(expect.arrayContaining(['vanish', 'premeditation', 'ambush']));
    }
  });

  it('casts Vanish, Premeditation and Garrote in one instant on Pure Hemo', () => {
    const casts = castsIn('rogue_pure_hemo');
    const vanishes = casts.filter((cast) => cast.id === 'vanish');
    expect(vanishes.length).toBeGreaterThan(0);
    for (const vanish of vanishes) {
      const same = casts.filter((cast) => cast.at === vanish.at).map((cast) => cast.id);
      expect(same).toEqual(expect.arrayContaining(['vanish', 'premeditation', 'garrote']));
    }
  });
});

describe('Garrote', () => {
  it('is a bleed at 7% of attack power a tick, the owner’s figure', () => {
    expect(GARROTE.isBleed).toBe(true);
    expect(GARROTE_TICK_AP_COEFFICIENT).toBe(0.07);
  });

  it('is cast at the pull by Pure Hemo, and only from stealth', () => {
    const casts = castsIn('rogue_pure_hemo');
    expect(casts.some((cast) => cast.id === 'garrote' && cast.at === 0)).toBe(true);
    // Every Garrote shares its instant with the pull or a Vanish.
    const vanishTimes = new Set(casts.filter((c) => c.id === 'vanish').map((c) => c.at));
    for (const cast of casts.filter((c) => c.id === 'garrote')) {
      expect(cast.at === 0 || vanishTimes.has(cast.at), `garrote at ${cast.at}`).toBe(true);
    }
  });
});

describe('the off-hand weapon effect is empty where nothing swings there', () => {
  it('holds for every preset', () => {
    for (const preset of PROFILE_PRESETS) {
      const profile = preset.build();
      const style = getCombatStyle(profile.character.combatStyle!);
      if (style?.offHand === 'weapon') continue;
      expect(profile.consumables.weapon_effect_off_hand, preset.id).toBeUndefined();
    }
  });
});

describe('the Cat pools energy for Ferocious Bite, since Berserk left the tree', () => {
  it('has no Berserk entry, and holds its filler Shred for the bite pool', () => {
    expect(DRUID_CAT.entries.some((entry) => entry.abilityId === 'berserk')).toBe(false);
    const shreds = DRUID_CAT.entries.filter((entry) => entry.abilityId === 'shred');
    const filler = JSON.stringify(shreds[shreds.length - 1].condition);
    expect(filler).toContain(`"amount":${CAT_BITE_POOL_ENERGY}`);
    expect(filler).toContain('rip');
  });
});

describe('the gear picker lists the build’s template items', () => {
  it('offers the B55 to E85 templates first, for the profile’s own template', () => {
    const ids = benchmarkItemIdsFor('dw_fury');
    expect(ids.size).toBeGreaterThan(0);
    const rows = pickerItems({
      slot: 'head',
      characterClass: 'warrior',
      style: 'dual_wield',
      valuation: {},
      search: '',
      showUnusable: false,
      benchmarkIds: ids,
    } as never);
    const templates = rows.filter((row) => ids.has(row.item.id));
    expect(templates.length).toBe(4);
    expect(rows.slice(0, 4).every((row) => ids.has(row.item.id))).toBe(true);
  });
});
