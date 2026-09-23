import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import {
  CONFLAGRATE_DAMAGE,
  CONFLAGRATE_KEEPS_IMMOLATE,
  INCINERATE_DAMAGE,
  INCINERATE_IMMOLATE_BONUS,
  LIFE_TAP_AMOUNT,
  SHADOWBURN_REFUNDS_SHARD,
  SHADOW_BOLT_DAMAGE,
} from '../../src/game/abilities/warlock';
import {
  BANE_OF_AGONY_TOTAL,
  CORRUPTION_TOTAL,
  DEMONIC_SACRIFICE_DAMAGE,
  demonicSacrificeAura,
} from '../../src/game/auras/warlock';
import { WARLOCK_TALENT_EFFECTS } from '../../src/game/talents/warlockEffects';
import { sacrificedDemon } from '../../src/game/rotations/warlock';
import { PLACEHOLDER_SOUL_SHARDS } from '../../src/game/character/resources';

/*
 * The Warlock's numbers, written out by hand from the beta client's spellbook.
 * The ninth and last class, and the second running whose builds bring no pet.
 */

const batchOf = (preset: string, iterations: number, seed: number) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed },
  } as never);
};

const presetPlayer = (preset: string) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return createPlayer({
    race: 'undead',
    characterClass: 'warlock',
    combatStyle: 'caster',
    talents: built.talents,
    equipment: built.equipment,
  });
};

describe('the numbers', () => {
  it('takes the midpoint of each stated range, at MAX RANK', () => {
    expect(SHADOW_BOLT_DAMAGE).toBe(268);
    expect(INCINERATE_DAMAGE).toBe(217);
    expect(CONFLAGRATE_DAMAGE).toBe(282);
    expect(LIFE_TAP_AMOUNT).toBe(424);
  });

  it('divides each damage-over-time effect evenly by its cadence', () => {
    // 438 over 18 seconds at 3 is six ticks of 73; 552 over 24 at 3 is eight
    // of 69. Both divide exactly, which is the reading that reproduces the
    // stated totals.
    expect(CORRUPTION_TOTAL % 6).toBe(0);
    expect(BANE_OF_AGONY_TOTAL % 8).toBe(0);
  });

  it('declares an effect for every one of the 52 talents', () => {
    expect(Object.keys(WARLOCK_TALENT_EFFECTS)).toHaveLength(52);
  });
});

describe('Demonic Sacrifice, which both builds take', () => {
  it('names a different demon for each build, and the profile says which', () => {
    /*
     * ------------------------------------------------------------------------
     * THE PROFILE NAMES ARE THE MECHANIC. "SM/DS" is Shadow Mastery plus
     * Demonic Sacrifice, and it sacrifices the IMP for +15% Shadow.
     * "Firelock" sacrifices the SUCCUBUS for +15% Fire. The talent lists all
     * four demons and what each grants.
     *
     * So the Warlock is the second class running whose builds opt out of the
     * pet system -- after both Lone Wolf hunters, who take a talent that says
     * so outright.
     * ------------------------------------------------------------------------
     */
    const smds = PRESETS_BY_ID.get('warlock_smds')!.build();
    const firelock = PRESETS_BY_ID.get('warlock_firelock')!.build();

    expect(smds.character.petFamily).toBe('imp');
    expect(firelock.character.petFamily).toBe('succubus');

    expect(sacrificedDemon(smds.talents, smds.character.petFamily)).toBe('imp');
    expect(sacrificedDemon(firelock.talents, firelock.character.petFamily)).toBe('succubus');
  });

  it('grants nothing to a build that did not take the talent', () => {
    expect(sacrificedDemon({}, 'imp')).toBeUndefined();
  });

  it('gives the two damage demons a buff and the other two none', () => {
    // Voidwalker restores mana and Felhunter health, neither of which moves a
    // damage figure for a profile nothing attacks.
    expect(demonicSacrificeAura('imp')?.damageDoneMultiplier).toBe(DEMONIC_SACRIFICE_DAMAGE);
    expect(demonicSacrificeAura('succubus')?.damageDoneMultiplier).toBe(
      DEMONIC_SACRIFICE_DAMAGE,
    );
    expect(demonicSacrificeAura('voidwalker')).toBeUndefined();
    expect(demonicSacrificeAura('felhunter')).toBeUndefined();
  });

  it('is up from the pull rather than cast, because it lasts two hours', () => {
    const uptime = batchOf('warlock_smds', 20, 5).buffUptime.find((b) =>
      b.auraName.startsWith('Demonic Sacrifice'),
    );
    expect(uptime).toBeDefined();
    expect(uptime?.uptime ?? 0).toBeCloseTo(1, 2);
  });
});

describe('Shadow and Flame, which changes the rotation rather than a number', () => {
  it('flags Conflagrate to keep Immolate and Shadowburn to refund its shard', () => {
    /*
     * ------------------------------------------------------------------------
     * TWO OF ITS THREE CLAUSES ARE ON/OFF, which `abilityFlag` is for. At 5/5
     * Conflagrate no longer consumes Immolate -- so it goes on cooldown rather
     * than being weighed against the burn it would eat -- and Shadowburn
     * refunds its soul shard, which is the only reason a fight with no shard
     * income can cast it more than once.
     * ------------------------------------------------------------------------
     */
    const built = PRESETS_BY_ID.get('warlock_firelock')!.build();
    const book = new Map(
      abilitiesForClass('warlock', 'caster', built.talents).map((a) => [a.id, a]),
    );

    expect(book.get('conflagrate')?.bonuses?.[CONFLAGRATE_KEEPS_IMMOLATE]).toBe(1);
    expect(book.get('shadowburn')?.bonuses?.[SHADOWBURN_REFUNDS_SHARD]).toBe(1);

    // And SM/DS, which takes no Destruction talents, gets neither ability.
    const smds = PRESETS_BY_ID.get('warlock_smds')!.build();
    const smdsBook = abilitiesForClass('warlock', 'caster', smds.talents).map((a) => a.id);
    expect(smdsBook).not.toContain('conflagrate');
    expect(smdsBook).not.toContain('shadowburn');
  });

  it('casts Shadowburn more than once, which only the refund makes possible', () => {
    /*
     * THE BUG THIS PINS. A Warlock earns soul shards from Drain Soul KILLING
     * something, which never happens here -- so without a starting pool the
     * cost could not be paid at all and Shadowburn was silently never cast.
     * The priority list simply fell through to the next entry.
     */
    expect(PLACEHOLDER_SOUL_SHARDS).toBeGreaterThan(0);

    const batch = batchOf('warlock_firelock', 30, 5);
    expect(batch.abilities.find((a) => a.abilityName === 'Shadowburn')?.uses ?? 0)
      .toBeGreaterThan(2);
  });

  it('gives the Warlock a shard pool at all', () => {
    const actor = presetPlayer('warlock_firelock');
    expect(actor.resources.has('soulShards')).toBe(true);
    expect(actor.resources.require('soulShards').current).toBe(PLACEHOLDER_SOUL_SHARDS);
  });
});

describe('the two fights', () => {
  it('picks each list by its capstone', () => {
    expect(batchOf('warlock_smds', 1, 1).rotationName).toContain('SM/DS');
    expect(batchOf('warlock_firelock', 1, 1).rotationName).toContain('Firelock');
  });

  it('holds three damage-over-time effects up as SM/DS', () => {
    const batch = batchOf('warlock_smds', 30, 5);
    const used = (name: string) =>
      batch.abilities.find((a) => a.abilityName === name)?.uses ?? 0;

    expect(used('Corruption')).toBeGreaterThan(1);
    expect(used('Bane of Agony')).toBeGreaterThan(1);
    expect(used('Siphon Life')).toBeGreaterThan(1);
    expect(used('Shadow Bolt')).toBeGreaterThan(5);
  });

  it('keeps Immolate up for Incinerate, which reads it at cast time', () => {
    /*
     * Incinerate is worth 25% more against a burning target, so a list that
     * let Immolate lapse would quietly lose a quarter of its filler. The
     * order is load-bearing and this is what pins it.
     */
    expect(INCINERATE_IMMOLATE_BONUS).toBe(1.25);

    const batch = batchOf('warlock_firelock', 30, 5);
    const immolate = batch.debuffUptime.find((d) => d.auraName === 'Immolate');
    expect(immolate?.uptime ?? 0).toBeGreaterThan(0.8);
  });

  it('taps its own life for mana, which is free for a profile nothing attacks', () => {
    const batch = batchOf('warlock_smds', 30, 5);
    expect(batch.abilities.find((a) => a.abilityName === 'Life Tap')?.uses ?? 0)
      .toBeGreaterThan(3);
  });
});
