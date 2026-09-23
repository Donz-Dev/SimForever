import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  PET_ARMOR_SHARE,
  PET_ATTACK_POWER_SHARE,
  PET_CRIT_SHARE,
  PET_FOCUS_MAXIMUM,
  PET_HEALTH_PER_OWNER_STAMINA,
  createPet,
  highestAttackPower,
} from '../../src/game/actors/createPet';
import { FOCUS_PER_SECOND } from '../../src/game/combat/resourceRules';
import { abilitiesForFamily } from '../../src/game/character/petFamilies';
import { BITE, CLAW, PET_ABILITIES } from '../../src/game/abilities/pet';
import {
  ARCANE_SHOT_DAMAGE,
  ARCANE_SHOT_RAP_COEFFICIENT,
  AIMED_SHOT_BONUS,
  RAPTOR_STRIKE_BONUS,
} from '../../src/game/abilities/hunter';
import {
  ASPECT_OF_THE_BEAST_ATTACK_POWER,
  ASPECT_OF_THE_HAWK_ATTACK_POWER,
  SERPENT_STING_RAP_PER_TICK,
  SERPENT_STING_TICK_INTERVAL_MS,
  SERPENT_STING_TOTAL,
  SERPENT_STING_DURATION_MS,
} from '../../src/game/auras/hunter';
import { HUNTER_TALENT_EFFECTS } from '../../src/game/talents/hunterEffects';
import { hasPet } from '../../src/game/rotations/hunter';

/*
 * Pets, and the Hunter that brings one. The scaling figures come from the
 * Forever Hunter wiki, which the ruleset owner named as the source.
 */

const batchOf = (preset: string, iterations: number, seed: number) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed },
  } as never);
};

const hunterFor = (preset: string) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return createPlayer({
    race: 'orc',
    characterClass: 'hunter',
    combatStyle: built.character.combatStyle as never,
    talents: built.talents,
    equipment: built.equipment,
  });
};

describe('a pet is built from its owner', () => {
  it('inherits every stat at the rate the wiki states', () => {
    /*
     * ------------------------------------------------------------------------
     * THE FOUR FIGURES, WRITTEN OUT AGAIN HERE BY HAND:
     *
     *   Stamina        1 player stamina gives the pet 2 health
     *   Armor          30% of player armor
     *   Attack Power   10% of the player's HIGHEST attack power source
     *   Crit           100% of the player's crit chance
     *
     * A hundred percent of crit is the one worth noticing: a Forever pet is
     * far more sensitive to its owner's gear than a Classic pet was, and every
     * crit talent a Hunter takes is worth something twice.
     * ------------------------------------------------------------------------
     */
    const owner = hunterFor('bm_hunter');
    const pet = createPet({ owner, family: 'cat' });
    const stats = owner.stats.effective;

    expect(pet.health.maximum).toBe(
      Math.round(stats.stamina * PET_HEALTH_PER_OWNER_STAMINA),
    );
    expect(pet.stats.get('armor')).toBeCloseTo(stats.armor * PET_ARMOR_SHARE, 6);
    expect(pet.stats.get('critChance')).toBeCloseTo(stats.critChance * PET_CRIT_SHARE, 6);
    expect(pet.stats.get('attackPower')).toBeCloseTo(
      highestAttackPower(owner) * PET_ATTACK_POWER_SHARE,
      6,
    );
  });

  it('reads the HIGHEST attack power source, not the ranged one', () => {
    /*
     * The wiki's exact phrase. A Hunter's ranged attack power is normally its
     * larger one, so taking `rangedAttackPower` would agree by accident and
     * then quietly disagree for a melee build. Asserted against both.
     */
    const ranged = hunterFor('bm_hunter');
    const stats = ranged.stats.effective;
    expect(highestAttackPower(ranged)).toBe(
      Math.max(stats.attackPower, stats.rangedAttackPower),
    );
  });

  it('carries focus, and it regenerates at ten a second', () => {
    const owner = hunterFor('bm_hunter');
    const pet = createPet({ owner, family: 'cat' });

    expect(pet.resources.has('focus')).toBe(true);
    expect(pet.resources.require('focus').maximum).toBe(PET_FOCUS_MAXIMUM);
    // "Pets regenerate 100 Focus over 10 sec, or 10 Focus per second."
    expect(FOCUS_PER_SECOND).toBe(10);
    expect(PET_FOCUS_MAXIMUM / FOCUS_PER_SECOND).toBe(10);
  });

  it('names its owner, which is how a talent reaches it', () => {
    const owner = hunterFor('bm_hunter');
    expect(createPet({ owner, family: 'cat' }).ownerId).toBe(owner.id);
  });

  it('gates abilities by family, from the ability rather than a second list', () => {
    /*
     * The spellbook writes the gating per spell: Claw is "Pet: Bear, Bird of
     * Prey, Carrion Bird, Cat, Crab, Raptor, Scorpid" and Bite is "Pet: every
     * family". So a Cat has both and a Wolf has only Bite.
     */
    const cat = abilitiesForFamily('cat', PET_ABILITIES).map((a) => a.id);
    const wolf = abilitiesForFamily('wolf', PET_ABILITIES).map((a) => a.id);

    expect(cat).toContain(CLAW.id);
    expect(cat).toContain(BITE.id);
    expect(wolf).toContain(BITE.id);
    expect(wolf).not.toContain(CLAW.id);
  });
});

describe('a pet in a real fight', () => {
  it('has its damage counted in DPS and SHOWN in the breakdown', () => {
    /*
     * ------------------------------------------------------------------------
     * THE ONE THING THAT WAS ACTUALLY MISSING. `dps` has summed every friendly
     * actor since batching was written, so a pet's damage already counted --
     * but `abilityBreakdown` read ONE actor, so the table beside that figure
     * added up to less than it and nothing said where the rest went.
     *
     * Asserted as the pet's rows being PRESENT, because that is the bug.
     * ------------------------------------------------------------------------
     */
    const batch = batchOf('bm_hunter', 30, 5);
    const names = batch.abilities.map((a) => a.abilityName);

    expect(names).toContain('Claw');
    expect(names).toContain('Bite');

    const petDamage = batch.abilities
      .filter((a) => a.abilityName === 'Claw' || a.abilityName === 'Bite')
      .reduce((total, a) => total + a.damage, 0);
    expect(petDamage).toBeGreaterThan(0);
  });

  it('reserves focus so Bite is affordable when it comes off cooldown', () => {
    /*
     * BITE IS WORTH MORE PER FOCUS than Claw -- 90 for 35 against 51 for 25 --
     * and it is on a ten-second cooldown. The first version of the pet list
     * clawed freely, drained the bar between Bites, and landed ONE Bite in a
     * sixty-second fight instead of six. Nothing errored; the pet was simply
     * worse.
     */
    const batch = batchOf('bm_hunter', 30, 5);
    const bites = batch.abilities.find((a) => a.abilityName === 'Bite')?.uses ?? 0;

    // A ten-second cooldown over a sixty-second fight is six, and it gets them.
    expect(bites).toBeGreaterThan(4);
  });

  it('gives a pet to Beast Mastery and none to either Lone Wolf build', () => {
    /*
     * "You deal 20% increased damage with all attacks WHILE YOU DO NOT HAVE AN
     * ACTIVE PET." Both Lone Wolf builds take it, so the condition is a
     * property of the build rather than something to re-check each swing.
     */
    expect(hasPet(PRESETS_BY_ID.get('bm_hunter')!.build().talents)).toBe(true);
    expect(hasPet(PRESETS_BY_ID.get('lw_ranged')!.build().talents)).toBe(false);
    expect(hasPet(PRESETS_BY_ID.get('lw_melee')!.build().talents)).toBe(false);

    const loneWolf = batchOf('lw_ranged', 20, 5).abilities.map((a) => a.abilityName);
    expect(loneWolf).not.toContain('Claw');
    expect(loneWolf).not.toContain('Bite');
  });
});

describe('the Hunter, whose numbers are Forever numbers', () => {
  it('uses the FOREVER figures, which differ sharply from Classic', () => {
    /*
     * The wiki lists them side by side, Classic first:
     *   Arcane Shot r8   183 -> 217
     *   Aimed Shot r6    600 -> 166 bonus
     *   Raptor Strike    140 -> 70 bonus
     *   Serpent Sting    490 -> 555 total
     *
     * Reading any of these from Classic would be wrong in both directions at
     * once, which is why each is pinned against its Classic value too.
     */
    expect(ARCANE_SHOT_DAMAGE).toBe(217);
    expect(ARCANE_SHOT_DAMAGE).not.toBe(183);

    expect(AIMED_SHOT_BONUS).toBe(166);
    expect(AIMED_SHOT_BONUS).toBeLessThan(600);

    expect(RAPTOR_STRIKE_BONUS).toBe(70);
    expect(RAPTOR_STRIKE_BONUS).toBeLessThan(140);

    expect(SERPENT_STING_TOTAL).toBe(555);
  });

  it('scales Serpent Sting at 3% a tick, which is 15% over the duration', () => {
    /*
     * The wiki states both: "scales with 15% RAP over the full duration" and
     * "each tick gains 3% RAP". Five ticks of 3% is 15%, so the two agree --
     * and that agreement is what fixes the cadence at three seconds.
     */
    const ticks = SERPENT_STING_DURATION_MS / SERPENT_STING_TICK_INTERVAL_MS;
    expect(ticks).toBe(5);
    expect(SERPENT_STING_RAP_PER_TICK * ticks).toBeCloseTo(0.15, 6);
  });

  it('gives Arcane Shot a ranged attack power coefficient', () => {
    expect(ARCANE_SHOT_RAP_COEFFICIENT).toBe(0.1);
  });

  it('makes an Aspect exclusive, like a stance', () => {
    expect(ASPECT_OF_THE_HAWK_ATTACK_POWER).toBe(120);
    expect(ASPECT_OF_THE_BEAST_ATTACK_POWER).toBe(110);

    const batch = batchOf('lw_melee', 20, 5);
    const used = batch.abilities.map((a) => a.abilityName);
    // The melee build takes the Beast, which Forever made grant melee attack
    // power -- Classic's granted none, so this build could not exist there.
    expect(used).toContain('Aspect of the Beast');
    expect(used).not.toContain('Aspect of the Hawk');
  });

  it('declares an effect for every one of the 50 talents', () => {
    expect(Object.keys(HUNTER_TALENT_EFFECTS)).toHaveLength(50);
  });

  it('picks each list, and only the melee one is told apart by style', () => {
    expect(batchOf('bm_hunter', 1, 1).rotationName).toContain('Beast Mastery');
    expect(batchOf('lw_ranged', 1, 1).rotationName).toContain('Lone Wolf Ranged');
    expect(batchOf('lw_melee', 1, 1).rotationName).toContain('Lone Wolf Melee');
  });

  it('opens Mongoose Bite only through Expose Prey', () => {
    /*
     * "Can only be performed after you dodge", and nothing attacks these
     * profiles -- so without the Survival talent it would never be cast once.
     * That it IS cast is the test.
     */
    const batch = batchOf('lw_melee', 30, 5);
    expect(batch.abilities.find((a) => a.abilityName === 'Mongoose Bite')?.uses ?? 0)
      .toBeGreaterThan(0);
  });
});
