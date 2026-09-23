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
import { talentBuild } from '../../src/game/talents/talentBuild';

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

describe("the owner's talents reach the pet", () => {
  /*
   * ----------------------------------------------------------------------------
   * SIX TALENTS WERE INERT AND EVERY ONE OF THEM SAID SO. Endurance Training,
   * Focused Fire's pet half, Unleashed Fury, Ferocity, Frenzy and Bestial
   * Discipline all carried an `unmodelled` reason naming the same cause: a
   * talent effect reaches the character carrying it, and a pet is a separate
   * combatant built afterwards.
   *
   * They are most of what a Beast Mastery build spends its points on, so the
   * profile was understating by a fifth. `petStat` and `petReaction` are the
   * declarations that fix it, and `TalentBuild.pet` is where they collect.
   *
   * THE REASONS ARE WHAT FOUND THEM. CLAUDE.md says an `unmodelled` reason is
   * a claim about the engine on the day it was written and expires; these six
   * expired together the moment pets existed.
   * ----------------------------------------------------------------------------
   */
  const bmBuild = () => talentBuild('hunter', PRESETS_BY_ID.get('bm_hunter')!.build().talents);

  it('collects every pet talent into the build', () => {
    const pet = bmBuild().pet;

    // Unleashed Fury 5/5 is +15% and Focused Fire 2/2 is +2%, summed as
    // percentages and turned into one multiplier.
    expect(pet.damageMultiplier).toBeCloseTo(1.17, 6);
    // Ferocity 5/5 is +10 crit, ON TOP of the 100% of the owner's it inherits.
    expect(pet.critBonus).toBe(10);
    // Endurance Training 3/3 is +9% health and armor.
    expect(pet.healthMultiplier).toBeCloseTo(1.09, 6);
    expect(pet.armorMultiplier).toBeCloseTo(1.09, 6);
    // Bestial Discipline 2/2 is +20% focus regeneration.
    expect(pet.focusRegenMultiplier).toBeCloseTo(1.2, 6);
    // Frenzy is a reaction the PET carries.
    expect(pet.reactions.map((r) => r.id)).toContain('frenzy');
  });

  it('applies them to the pet it builds', () => {
    const owner = hunterFor('bm_hunter');
    const pet = createPet({ owner, family: 'cat', talents: bmBuild().pet });
    const stats = owner.stats.effective;

    expect(pet.damageDoneMultiplier).toBeCloseTo(1.17, 6);
    expect(pet.stats.get('critChance')).toBeCloseTo(stats.critChance + 10, 6);
    expect(pet.health.maximum).toBe(
      Math.round(stats.stamina * PET_HEALTH_PER_OWNER_STAMINA * 1.09),
    );
    expect(pet.reactions.map((r) => r.id)).toContain('frenzy');
  });

  it('reaches no pet for a Lone Wolf hunter, because none is built', () => {
    /*
     * THE MODIFIER EXISTS AND NOTHING RECEIVES IT. Both Lone Wolf builds take
     * Focused Fire 2/2 -- a cheap tier-1 step towards Careful Aim -- so the
     * build carries a 2% pet damage bonus. `petFor` then builds no pet, so it
     * lands on nothing.
     *
     * That is the honest assertion. Claiming the build carries no modifier at
     * all would be asserting a tidiness the code does not have, and would
     * break the moment a Lone Wolf build spent a point differently.
     */
    const lone = talentBuild('hunter', PRESETS_BY_ID.get('lw_ranged')!.build().talents);
    expect(lone.pet.reactions).toEqual([]);

    const fought = batchOf('lw_ranged', 20, 5).abilities.map((a) => a.abilityName);
    expect(fought).not.toContain('Claw');
    expect(fought).not.toContain('Bite');
  });

  it('reaches the HAWKS too, through the aura id a tick carries', () => {
    /*
     * "Increases the damage done by your pets AND HAWKS." A hawk is a periodic
     * effect whose ticks carry the aura's own id, and `abilityDamage` reaches
     * a periodic tick through exactly that -- the route Improved Rend takes on
     * the Warrior. The hawk half needed no new machinery, only noticing it was
     * already there.
     */
    const build = bmBuild();
    expect(build.abilityModifiers.for('summon_hawk').damageMultiplier).toBeCloseTo(1.15, 6);
    expect(build.abilityModifiers.for('summon_hawk').critBonus).toBe(10);
  });

  it('shows Frenzy on the results page, or it cannot be audited', () => {
    // Buff uptime read the PLAYER alone, so a buff a talent puts on the PET
    // was invisible -- and a working pet talent looked exactly like an inert
    // one. Every friendly actor is read now, as the damage table already was.
    const uptime = batchOf('bm_hunter', 30, 5).buffUptime.find((b) => b.auraName === 'Frenzy');
    expect(uptime?.uptime ?? 0).toBeGreaterThan(0.3);
  });

  it('gives a pet NO raid buffs, which is a Forever rule', () => {
    /*
     * ------------------------------------------------------------------------
     * "Pets can no longer receive external buffs. Player-applied buffs that
     * worked on pets in Classic no longer apply." -- the Forever Hunter wiki.
     *
     * `isPlayerControlled` counts a pet, which is right for deciding who the
     * raid is FIGHTING and wrong for deciding who it BUFFS. Using it handed a
     * Hunter's pet the whole raid, and printed every buff twice on the results
     * page -- which is how it was noticed.
     * ------------------------------------------------------------------------
     */
    const names = batchOf('bm_hunter', 20, 5).buffUptime.map((b) => b.auraName);
    const battleShouts = names.filter((name) => name === 'Battle Shout');
    expect(battleShouts).toHaveLength(1);
  });
});
