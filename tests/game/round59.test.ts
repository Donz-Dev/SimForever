import { describe, expect, it } from 'vitest';
import { Simulation, castAbility, seconds } from '../../src/engine';
import { fingersOfFrostSpender } from '../../src/game/reactions/mageTalents';
import { fingersOfFrostAura } from '../../src/game/auras/mage';
import { MANA_RUBY } from '../../src/game/abilities/mage';
import {
  DEMONIC_RUNE_ABILITY,
  DEMONIC_RUNE_COOLDOWN_MS,
  MANA_GEM_COOLDOWN_GROUP,
} from '../../src/game/abilities/consumables';
import { MAGE_ARCANE, MAGE_FIRE, MAGE_FROST, MAGE_FROSTFIRE } from '../../src/game/rotations/mage';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

/*
 * ==============================================================================
 * ROUND 59: Blizzard and Fingers of Frost, the conjured-mana cooldown, and the
 * owner's Frost Mage. Bane of Havoc's two rules live in `multiTarget.test.ts`.
 * ==============================================================================
 */

describe('Blizzard makes Fingers of Frost and never spends it', () => {
  it('lets a Blizzard tick past a charge that any other spell would spend', () => {
    const mage = makeAttacker({ autoAttack: 'none' });
    const simulation = buildSimulation([mage, makeTarget()], { durationMs: seconds(60) });
    simulation.begin();
    simulation.applyAura(mage, fingersOfFrostAura(2), mage.id);
    simulation.advanceTo(seconds(1));
    const spender = fingersOfFrostSpender();
    const castOf = (id: string) => ({ ability: { id } }) as never;
    expect(spender.canTrigger!(simulation, mage, castOf('blizzard'))).toBe(false);
    expect(spender.canTrigger!(simulation, mage, castOf('frostbolt'))).toBe(true);
  });
});

describe('the Mana Ruby and the Demonic Rune share a cooldown', () => {
  it('puts both in one group, the Ruby imposing the Rune\'s two minutes', () => {
    expect(MANA_RUBY.cooldownGroup).toBe(MANA_GEM_COOLDOWN_GROUP);
    expect(DEMONIC_RUNE_ABILITY.cooldownGroup).toBe(MANA_GEM_COOLDOWN_GROUP);
    expect(MANA_RUBY.cooldownGroupMs).toBe(DEMONIC_RUNE_COOLDOWN_MS);
  });

  it('locks the Rune out for two minutes after the Ruby, on the built Frost Mage', () => {
    const profile = PRESETS_BY_ID.get('mage_frost')!.build();
    const simulation = new Simulation(
      // A list that never touches either, so the cooldowns are the test's alone.
      trainingDummyEncounter(
        {
          ...profile,
          // Long enough to reach the end of the two minutes.
          simulation: { ...profile.simulation, durationSeconds: 300 },
          rotation: { ...profile.rotation, entries: [{ abilityId: 'frostbolt' }] },
        },
        1,
      ),
    );
    simulation.begin();
    const mage = simulation.combatants.find((actor) => actor.kind === 'player')!;
    const ruby = mage.abilities.get('mana_ruby')!;
    const rune = mage.abilities.get('demonic_rune')!;
    // The rotation is running too, so ask about the COOLDOWN alone: a cast in
    // progress or a global cooldown would refuse the Rune for another reason.
    const runeRefusal = () =>
      simulation.castRejection(mage, rune, undefined, { ignoreCastLock: true, ignoreGcd: true });
    expect(castAbility(simulation, mage, ruby, undefined).ok).toBe(true);
    expect(runeRefusal()).toBe('on_cooldown');
    simulation.advanceTo(DEMONIC_RUNE_COOLDOWN_MS - 1);
    expect(runeRefusal()).toBe('on_cooldown');
    simulation.advanceTo(DEMONIC_RUNE_COOLDOWN_MS + 1);
    expect(runeRefusal()).toBeUndefined();
  });

  it.each([MAGE_FIRE, MAGE_FROSTFIRE, MAGE_ARCANE, MAGE_FROST])(
    'puts the Ruby above the Rune in $name',
    (list) => {
      const ids = list.entries.map((entry) => entry.abilityId);
      expect(ids.indexOf('mana_ruby')).toBeGreaterThanOrEqual(0);
      const rune = ids.indexOf('demonic_rune');
      if (rune >= 0) expect(ids.indexOf('mana_ruby')).toBeLessThan(rune);
    },
  );

  it('holds the Frost Mage\'s Rune until the Ruby has gone', () => {
    const rune = MAGE_FROST.entries.find((entry) => entry.abilityId === 'demonic_rune')!;
    expect(JSON.stringify(rune.condition)).toContain('"abilityId":"mana_ruby"');
    expect(JSON.stringify(rune.condition)).toContain('"fraction":0.5');
  });
});

describe("the owner's Frost Mage", () => {
  const profile = PRESETS_BY_ID.get('mage_frost')!.build();

  it('is their saved build: race, 51 points, consumables, opener and list', () => {
    // Troll since round 80 (+8.0 on the weighted score); their saved file was Windshaper Skyborne.
    expect(profile.character).toMatchObject({ name: 'Frost Mage', race: 'troll', characterClass: 'mage' });
    expect(Object.values(profile.talents ?? {}).reduce((a, b) => a + b, 0)).toBe(51);
    expect(profile.talents).toMatchObject({ ice_barrier: 1, improved_blizzard: 1, winter_s_chill: 5, fingers_of_frost: 2 });
    // The potion is the Major Mana Potion since round 78 (+25.68 at a 120s fight); their saved file had Spellblasting.
    expect(profile.consumables).toMatchObject({ potion: 'major_mana_potion', other: 'demonic_rune', school_spell_power: 'school_frost' });
    expect(profile.precombat).toEqual([
      { abilityId: 'mage_armor', secondsBefore: 60 },
      { abilityId: 'ice_barrier', secondsBefore: 3.5 },
      { abilityId: 'frostbolt', secondsBefore: 2 },
    ]);
    expect(profile.rotation.name).toBe('Mage (Frost)');
    expect(profile.rotation.entries.at(-1)?.abilityId).toBe('frostbolt');
  });

  it('wears the Frostfire template gear under its own name', () => {
    expect(Object.keys(profile.equipment).length).toBeGreaterThanOrEqual(15);
    expect(profile.benchmarkTemplateId).toBe('mage_frost');
  });
});
