import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Combatant } from '../../src/engine';
import {
  RATING_PER_PERCENT,
  Simulation,
  TelemetryRecorder,
  dealDamage,
  hasteMultiplierFrom,
  resolveCast,
  seconds,
} from '../../src/engine';
import {
  RACE_IDS,
  RACES,
  baseHitPointsFor,
  baseManaFor,
  baseStatsFor,
  getRace,
} from '../../src/game/character';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { RACIALS, RACIAL_ABILITIES, racialBuild } from '../../src/game/racials';
import {
  BERSERKING,
  BLOOD_FURY,
  ELUNES_LIGHT,
  EUREKA,
  STONEFORM,
} from '../../src/game/racials/auras';
import {
  TOUCH_OF_THE_GRAVE_ABILITY_ID,
  TOUCH_OF_THE_GRAVE_CHANNEL_EXCEPTIONS,
  TOUCH_OF_THE_GRAVE_PERIODIC_EXCEPTIONS,
  TOUCH_OF_THE_GRAVE_POISON_EXCLUSIONS,
  touchOfTheGraveMayProc,
} from '../../src/game/racials/reactions';
import { ALL_PRIORITY_LISTS } from '../../src/game/rotations/allLists';
import {
  RACIAL_COOLDOWNS,
  RACIAL_DEFENSIVE_COOLDOWNS,
} from '../../src/game/rotations/racialCooldowns';
import { abilityChoicesFor, aplNamesFor } from '../../src/ui/panels/AplPanel';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { buildSimulation } from '../helpers/buildSimulation';

/*
 * ============================================================================
 * RACIALS, from the ruleset owner's statement of the ten races.
 *
 * THE NUMBERS ARE WRITTEN OUT BY HAND HERE rather than imported from the racial
 * tables, which is what makes this a test of the ruleset rather than of the
 * transcription. Where a constant IS imported it is because the assertion is
 * about a mechanism rather than a magnitude -- an aura id, a set membership.
 *
 * WHAT THIS FILE IS AIMED AT. Four of the five active racials apply an aura and
 * nothing else, which is the shape this project has been caught by twice:
 * Adrenaline Rush was cast, spent its cooldown, applied its aura and reported
 * 24.9% uptime for a year while delivering no energy at all. So every active
 * racial here is asserted on what it MOVES -- the attack power, the haste
 * multiplier, the resolved cost, the damage of a real hit -- and not on the
 * aura being present.
 * ============================================================================
 */

// --- The owner's figures, by hand. -----------------------------------------
const SWORD_CRIT = 2;
const MACE_CRIT = 1;
const AXE_CRIT = 1;
const HUMAN_SPIRIT = 0.05;
const NIGHT_ELF_DODGE = 1;
const TAUREN_HEALTH = 0.05;
const TAUREN_HIT = 1;
const GNOME_RESOURCE = 0.05;
const SKYBORNE_HASTE = 1;
const BLOOD_FURY_POWER = 0.1;
const BERSERKING_HASTE = 10;
const ELUNES_LIGHT_CRIT = 10;
const STONEFORM_PHYSICAL = 0.9;
const EUREKA_CHARGES = 3;
const EUREKA_COST = 0.1;
const EUREKA_DAMAGE = 1.1;
const TOUCH_HEALTH_FRACTION = 0.05;
const TOUCH_MELEE_CHANCE = 5;
const TOUCH_CASTER_CHANCE = 10;
/** The two poisons this project has actually built. See the exclusion test. */
const IMPLEMENTED_POISONS = new Set(['instant_poison', 'deadly_poison']);

describe('every race is declared, and nothing it names is missing', () => {
  it('covers RACE_IDS exactly', () => {
    /*
     * A RACE ABSENT HERE WOULD BE A CHARACTER WITH NO RACIALS AND NOTHING TO
     * SAY SO, which is the `lone_wolf` shape: that talent was never registered
     * in `TALENT_AURAS`, both Hunter profiles named after it went the whole
     * project without its 20% damage, and nothing errored. The registry is
     * checked against the vocabulary rather than trusted.
     */
    expect(Object.keys(RACIALS).sort()).toEqual([...RACE_IDS].sort());
    for (const race of RACE_IDS) expect(RACIALS[race].race, race).toBe(race);
  });

  it('gives every race four traits, with unique ids and the client text kept', () => {
    for (const race of RACE_IDS) {
      const traits = RACIALS[race].traits;
      // Every race in `racials.js` has exactly four.
      expect(traits.length, race).toBe(4);
      const ids = traits.map((trait) => trait.id);
      expect(new Set(ids).size, race).toBe(ids.length);
      for (const trait of traits) {
        expect(trait.name.length, `${race} ${trait.id}`).toBeGreaterThan(0);
        expect(trait.text.length, `${race} ${trait.id}`).toBeGreaterThan(0);
        expect(trait.effects.length, `${race} ${trait.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('resolves every granted ability, because a missed lookup is not an error', () => {
    /*
     * `createPlayer` DROPS an ability id `RACIAL_ABILITIES` does not carry,
     * deliberately -- a typo should be a racial that visibly does nothing, not
     * a character that cannot be built. This is what makes that safe: the only
     * way the drop is honest is if something asks whether it happened.
     */
    const granted = new Set<string>();
    for (const race of RACE_IDS) {
      for (const trait of RACIALS[race].traits) {
        for (const effect of trait.effects) {
          if (effect.kind !== 'grantAbility') continue;
          expect(RACIAL_ABILITIES[effect.abilityId], `${race} ${trait.id}`).toBeDefined();
          granted.add(effect.abilityId);
        }
      }
    }
    // The owner names five actives; nothing in the table is unreachable.
    expect([...granted].sort()).toEqual(
      ['berserking', 'blood_fury', 'elunes_light', 'eureka', 'stoneform'].sort(),
    );
    expect(Object.keys(RACIAL_ABILITIES).sort()).toEqual([...granted].sort());
  });

  it('builds a usable character for every legal race and class', () => {
    for (const race of RACES) {
      for (const characterClass of race.classes) {
        expect(() => createPlayer({ race: race.id, characterClass })).not.toThrow();
      }
    }
  });
});

describe('the weapon specializations', () => {
  /** The same context twice, with only the race changed. */
  const critFor = (race: Parameters<typeof racialBuild>[0], subclassItemId?: number) =>
    racialBuild(race, {
      characterClass: 'warrior',
      equipment: subclassItemId === undefined ? {} : { mainHand: { itemId: subclassItemId } },
      style: 'two_hander',
    }).stats;

  it('grants BOTH crit stats, because "all spells and attacks" is two of them', () => {
    /*
     * `critChance` AND `spellCritChance` ARE READ BY SEPARATE TABLES, which is
     * the reading sixty-two item lines saying the same words already take. It
     * is not academic: all three Human Paladin presets hold a sword and the
     * Shockadin's damage is almost entirely Holy spells, so the melee-only
     * reading would be right about two builds and silently worth nothing to the
     * third.
     */
    const sword = PRESETS_BY_ID.get('pally_shockadin')!.build();
    const asHuman = characterAtCombatStart(sword)!;
    const asUndead = characterAtCombatStart({
      ...sword,
      character: { ...sword.character, race: 'undead' },
    })!;

    expect(
      asHuman.stats.effective.critChance - asUndead.stats.effective.critChance,
    ).toBeCloseTo(SWORD_CRIT, 9);
    expect(
      asHuman.stats.effective.spellCritChance - asUndead.stats.effective.spellCritChance,
    ).toBeCloseTo(SWORD_CRIT, 9);
  });

  it('reads what is EQUIPPED and not what swings, which decides two profiles', () => {
    /*
     * ========================================================================
     * THE OWNER'S RULING, AND IT IS THE DIFFERENCE BETWEEN TWO PROFILES AND
     * NONE.
     *
     * Of the seven Orc presets, exactly two hold an axe -- `bm_hunter` and
     * `lw_ranged`, both of which carry Dreadforge Retaliator in the TWO-HAND
     * slot as a STAT STICK, because their style is `ranged`. The two melee Orc
     * Hunters dual-wield a sword and a dagger, and the two Orc Warriors hold
     * swords.
     *
     * So `weaponsForEquipment` builds no main-hand weapon profile for either of
     * the two that qualify: reading the profile rather than the equipment would
     * have made Axe Specialization reach ZERO of the 25 presets while looking
     * like a working trait. This test is that fact, written down.
     * ========================================================================
     */
    const holdsAnAxe = ['bm_hunter', 'lw_ranged'] as const;
    const noAxe = ['dw_fury', 'two_hand_arms', 'lw_melee', 'hawk_melee', 'rogue_combat'] as const;

    for (const preset of holdsAnAxe) {
      const built = PRESETS_BY_ID.get(preset)!.build();
      expect(built.character.race, preset).toBe('orc');
      // The style's main hand is a stat stick, so nothing swings the axe.
      expect(built.character.combatStyle, preset).toBe('ranged');
      const delta = racialSpellCritDelta(preset, 'troll');
      expect(delta, preset).toBeCloseTo(AXE_CRIT, 9);
    }

    for (const preset of noAxe) {
      const built = PRESETS_BY_ID.get(preset)!.build();
      expect(built.character.race, preset).toBe('orc');
      expect(racialSpellCritDelta(preset, 'troll'), preset).toBeCloseTo(0, 9);
    }
  });

  it('counts either hand, so a dual-wielder with one sword is holding a sword', () => {
    // Vis'kag in the main hand and a dagger in the off hand, and the other way.
    const viskag = itemIdIn('dw_fury', 'mainHand');
    const dagger = itemIdIn('rogue_rupture', 'offHand');

    const mainHand = racialBuild('human', {
      characterClass: 'rogue',
      equipment: { mainHand: { itemId: viskag }, offHand: { itemId: dagger } },
      style: 'dual_wield',
    });
    const offHand = racialBuild('human', {
      characterClass: 'rogue',
      equipment: { mainHand: { itemId: dagger }, offHand: { itemId: viskag } },
      style: 'dual_wield',
    });
    const neither = racialBuild('human', {
      characterClass: 'rogue',
      equipment: { mainHand: { itemId: dagger }, offHand: { itemId: dagger } },
      style: 'dual_wield',
    });

    expect(mainHand.stats.critChance).toBe(SWORD_CRIT);
    expect(offHand.stats.critChance).toBe(SWORD_CRIT);
    expect(neither.stats.critChance ?? 0).toBe(0);
  });

  it('gives a Dwarf its mace and nobody else', () => {
    const mace = itemIdIn('shaman_enhancement', 'twoHand') ?? itemIdIn('shaman_enhancement', 'mainHand');
    const equipment = { mainHand: { itemId: mace! } };
    expect(
      racialBuild('dwarf', { characterClass: 'warrior', equipment, style: 'two_hander' }).stats
        .critChance,
    ).toBe(MACE_CRIT);
    for (const race of ['human', 'orc', 'tauren', 'troll', 'night_elf'] as const) {
      expect(
        racialBuild(race, { characterClass: 'warrior', equipment, style: 'two_hander' }).stats
          .critChance ?? 0,
        race,
      ).toBe(0);
    }
    expect(critFor('dwarf').critChance ?? 0).toBe(0);
  });

  it('reaches the PET, which is the owner\'s own clause and needs no code', () => {
    /*
     * "This includes +1% for pet crit chance if you're holding an axe."
     *
     * `createPet` reads `owner.stats.effective.critChance` and inherits all of
     * it, so a STAT on the Hunter is already on the pet -- which is why the
     * trait grants a stat and not `attackTableModifiers`. The bow enchant's
     * "+2% Crit Chance" points the opposite way: the owner ruled it must NOT
     * reach the pet, and it is a table modifier for exactly that reason.
     *
     * ASSERTED ON THE PET RATHER THAN ON THE ARGUMENT, because the argument is
     * a paragraph and the pet is a number.
     */
    /*
     * ========================================================================
     * TWO CLEAN ASSERTIONS RATHER THAN ONE END-TO-END ONE, because the obvious
     * end-to-end comparison does not isolate anything.
     *
     * "Pet crit for an Orc minus pet crit for a Troll" came back 0.906 for a
     * racial worth 1, and the missing 0.094 is not an inheritance share: the
     * two races have different BASE AGILITY, and a raid buff that scales stats
     * by a percentage amplifies that difference before it reaches crit. So the
     * delta carries the racial AND the conversion of a base-stat difference,
     * and reading it as a share would have invented a 90% figure that is in no
     * source. (The owner's BASE crit delta between the two is exactly 1.000;
     * it is the derived figure that moves.)
     *
     * What the owner's clause actually needs is two facts, and each is cleanly
     * checkable on its own: the trait grants a crit STAT, and the pet inherits
     * a crit stat in full.
     * ========================================================================
     */

    // ONE: the trait grants a STAT. That is the choice that reaches the pet --
    // the bow enchant's "+2% Crit Chance" is `attackTableModifiers` precisely
    // so that it does NOT, which is the owner's ruling pointing the other way.
    const axe = itemIdIn('bm_hunter', 'twoHand');
    expect(
      racialBuild('orc', {
        characterClass: 'hunter',
        equipment: { twoHand: { itemId: axe } },
        style: 'ranged',
      }).stats.critChance,
    ).toBe(AXE_CRIT);

    // TWO: the pet inherits a crit stat in FULL, isolated by moving the owner's
    // crit by a known amount and holding everything else fixed.
    const petCritWith = (bonus: number): number => {
      const built = PRESETS_BY_ID.get('bm_hunter')!.build();
      const simulation = new Simulation(
        trainingDummyEncounter({
          ...built,
          stats: { ...built.stats, critChance: bonus },
        }),
      );
      simulation.begin();
      const pet = simulation.combatants.find((actor) => actor.kind === 'pet');
      expect(pet).toBeDefined();
      return pet!.stats.effective.critChance;
    };

    expect(petCritWith(10) - petCritWith(0)).toBeCloseTo(10, 6);
  });
});

describe('the passive racials', () => {
  it('gives a Human 5% more spirit, as a modifier that follows a buff', () => {
    /*
     * A MODIFIER AND NOT A FLAT NUMBER. A percentage resolved at build time
     * freezes against the unbuffed stat, so the check is that it tracks: a
     * Human handed 200 more spirit gains 5% of the BIGGER number, not 5% of the
     * base.
     */
    /*
     * AGAINST THE HUMAN'S OWN BASE, not another race's. This compared a Human
     * to an Undead at first and read 51.45 against an expected 52.5, because
     * the two races have different BASE spirit -- 49 and 50. A racial
     * percentage has to be measured against the stat the same character would
     * have had without it, which is its own base stats row.
     */
    const base = baseStatsFor('human', 'warrior')!.spirit;
    const bare = createPlayer({ race: 'human', characterClass: 'warrior' });
    expect(bare.stats.get('spirit')).toBeCloseTo(base * (1 + HUMAN_SPIRIT), 6);

    const buffed = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      bonusStats: { spirit: 200 },
    });
    expect(buffed.stats.get('spirit')).toBeCloseTo((base + 200) * (1 + HUMAN_SPIRIT), 6);
  });

  it('gives a Night Elf a point of dodge', () => {
    const elf = racialBuild('night_elf', {
      characterClass: 'warrior',
      equipment: {},
      style: 'two_hander',
    });
    expect(elf.stats.dodgeChance).toBe(NIGHT_ELF_DODGE);
  });

  it('gives a Tauren 5% health and a point of hit on all three tables', () => {
    /*
     * AGAINST THE TAUREN'S OWN UNRACIALLED POOL, which is the base hit points
     * for its row plus ten a point of stamina. Comparing to another race was
     * wrong for the same reason the spirit check was: base stamina differs.
     */
    const tauren = createPlayer({ race: 'tauren', characterClass: 'warrior' });
    const unracialled =
      baseHitPointsFor('tauren', 'warrior') + baseStatsFor('tauren', 'warrior')!.stamina * 10;
    expect(tauren.health.maximum).toBe(Math.round(unracialled * (1 + TAUREN_HEALTH)));

    /*
     * AND THE HIT, which has no base difference to confuse it: no race in
     * Forever's table grants hit except this one, so another race's figure IS
     * the unracialled one.
     */
    const troll = createPlayer({ race: 'troll', characterClass: 'warrior' });
    expect(troll.stats.get('hitChance')).toBe(0);
    expect(tauren.stats.get('hitChance')).toBeCloseTo(TAUREN_HIT, 9);
  });

  it('gives a Gnome 5% of the pool its class uses, and nothing else', () => {
    /*
     * "Maximum Mana, Rage or Energy increased by 5%, WHICHEVER YOUR CLASS
     * USES." The three named pools scale and the other two must not: a 5%
     * bigger combo point cap would change what every finisher can spend, and a
     * 5% bigger shard pool is 10.5 shards.
     */
    /*
     * AGAINST THE GNOME'S OWN UNRACIALLED POOL -- base mana plus fifteen a
     * point of intellect, which is the owner's conversion. A Human Mage's pool
     * is a different number for a reason that has nothing to do with the trait.
     */
    const gnomeMage = createPlayer({ race: 'gnome', characterClass: 'mage' });
    const unracialled =
      baseManaFor('gnome', 'mage') + baseStatsFor('gnome', 'mage')!.intellect * 15;
    expect(gnomeMage.resources.require('mana').maximum).toBe(
      Math.round(unracialled * (1 + GNOME_RESOURCE)),
    );

    const gnomeWarrior = createPlayer({ race: 'gnome', characterClass: 'warrior' });
    expect(gnomeWarrior.resources.require('rage').maximum).toBe(105);

    const gnomeRogue = createPlayer({ race: 'gnome', characterClass: 'rogue' });
    expect(gnomeRogue.resources.require('energy').maximum).toBe(105);
    // A pool that starts full starts at the RAISED maximum.
    expect(gnomeRogue.resources.require('energy').current).toBe(105);
    // AND THE COMBO POINT CAP IS UNTOUCHED, which is the point of the test.
    expect(gnomeRogue.resources.require('comboPoints').maximum).toBe(5);

    const gnomeWarlock = createPlayer({ race: 'gnome', characterClass: 'warlock' });
    const humanWarlock = createPlayer({ race: 'human', characterClass: 'warlock' });
    expect(gnomeWarlock.resources.require('soulShards').maximum).toBe(
      humanWarlock.resources.require('soulShards').maximum,
    );
  });

  it('gives both Skyborne races exactly one percent of haste', () => {
    /*
     * ASSERTED AS A MULTIPLIER AND NOT AS A RATING, which is the whole reason
     * the trait goes through `RATING_PER_PERCENT.haste`: 170 rating is 1.01 out
     * of `hasteMultiplierFrom` whatever that placeholder constant becomes.
     */
    for (const race of ['high_order_skyborne', 'windshaper_skyborne'] as const) {
      const build = racialBuild(race, {
        characterClass: 'warrior',
        equipment: {},
        style: 'two_hander',
      });
      expect(build.stats.hasteRating, race).toBe(SKYBORNE_HASTE * RATING_PER_PERCENT.haste);
      const player = createPlayer({ race, characterClass: 'warrior' });
      expect(hasteMultiplierFrom(player.stats.effective), race).toBeCloseTo(1.01, 9);
    }
  });
});

describe('Blood Fury', () => {
  it('raises all THREE power pools by a tenth, and the owner added the ranged one', () => {
    /*
     * ========================================================================
     * THE CLIENT SAYS "Attack Power and Spell Power" AND THE OWNER SAYS "Attack
     * Power, Ranged Attack Power, and Spell Power". The later, more specific
     * statement wins -- the same answer the owner gave about Careful Aim, where
     * bare "Attack Power" also meant both pools.
     *
     * IT MATTERS MORE THAN A THIRD OF THE TRAIT: four of the seven Orc presets
     * are Hunters, whose damage is almost entirely ranged. The melee-only
     * reading would have been worth close to nothing on them while reading as a
     * working cooldown.
     *
     * AND IT IS ASSERTED ON THE DERIVED POOL, not on the modifier. A
     * `percentAdd` applies after the derivation runs, so +10% scales the
     * strength conversion and the gear and everything else -- which is the
     * difference between a modifier and a flat figure taken at build time.
     * ========================================================================
     */
    const player = createPlayer({
      race: 'orc',
      characterClass: 'hunter',
      bonusStats: { strength: 100, agility: 100, intellect: 100, spellPower: 300 },
    });
    const before = {
      attackPower: player.stats.get('attackPower'),
      rangedAttackPower: player.stats.get('rangedAttackPower'),
      spellPower: player.stats.get('spellPower'),
    };
    expect(before.attackPower).toBeGreaterThan(0);
    expect(before.rangedAttackPower).toBeGreaterThan(0);
    expect(before.spellPower).toBeGreaterThan(0);

    const simulation = buildSimulation([player, makeTarget()]);
    simulation.begin();
    simulation.applyAura(player, BLOOD_FURY, player.id);

    for (const stat of ['attackPower', 'rangedAttackPower', 'spellPower'] as const) {
      expect(player.stats.get(stat), stat).toBeCloseTo(before[stat] * (1 + BLOOD_FURY_POWER), 6);
    }
  });

  it('is off the global cooldown, which is what makes it free', () => {
    expect(RACIAL_ABILITIES.blood_fury.triggersGcd).toBe(false);
    expect(RACIAL_ABILITIES.blood_fury.cooldownMs).toBe(seconds(120));
    expect(BLOOD_FURY.durationMs).toBe(seconds(15));
    // No cost line exists for any racial in the client, so none is invented.
    expect(RACIAL_ABILITIES.blood_fury.cost).toBeUndefined();
  });
});

describe('Berserking', () => {
  it('is exactly ten percent of haste, as a multiplier', () => {
    const player = createPlayer({ race: 'troll', characterClass: 'shaman' });
    const before = hasteMultiplierFrom(player.stats.effective);
    const simulation = buildSimulation([player, makeTarget()]);
    simulation.begin();
    simulation.applyAura(player, BERSERKING, player.id);
    const after = hasteMultiplierFrom(player.stats.effective);
    /*
     * A RATIO RATHER THAN A VALUE, because the build already carries haste from
     * its gear: `hasteRating` is additive, so the DIFFERENCE in rating is what
     * the trait grants and the ratio of the multipliers is the clean statement.
     */
    expect(after - before).toBeCloseTo(BERSERKING_HASTE / 100, 9);
  });

  it('is off the global cooldown and lasts ten seconds', () => {
    expect(RACIAL_ABILITIES.berserking.triggersGcd).toBe(false);
    expect(RACIAL_ABILITIES.berserking.cooldownMs).toBe(seconds(180));
    expect(BERSERKING.durationMs).toBe(seconds(10));
  });
});

describe("Elune's Light", () => {
  it('grants ten points on both crit stats', () => {
    const player = createPlayer({ race: 'night_elf', characterClass: 'druid' });
    const before = {
      critChance: player.stats.get('critChance'),
      spellCritChance: player.stats.get('spellCritChance'),
    };
    const simulation = buildSimulation([player, makeTarget()]);
    simulation.begin();
    simulation.applyAura(player, ELUNES_LIGHT, player.id);
    expect(player.stats.get('critChance')).toBeCloseTo(before.critChance + ELUNES_LIGHT_CRIT, 6);
    expect(player.stats.get('spellCritChance')).toBeCloseTo(
      before.spellCritChance + ELUNES_LIGHT_CRIT,
      6,
    );
  });
});

describe('Stoneform', () => {
  it('reduces PHYSICAL damage taken and leaves every other school alone', () => {
    /*
     * `damageTakenBySchool` AND NOT `damageTakenMultiplier`. The blanket field
     * would also soften magic the encounter does not currently deal -- worth
     * nothing today and wrong the day it does, in the direction that reads as a
     * slightly better tank.
     */
    /*
     * ON A CARRIER THAT CANNOT DIE, which is what this test got wrong first.
     * It put the aura on a real Dwarf Warrior -- about 2,700 health -- and hit
     * it for a thousand four times, so a later blow was capped by the health
     * left and the comparison was between a full hit and a partial one. The
     * figure came back exactly 1000 against an expected 1100, which reads like
     * a modifier applying the wrong way round.
     */
    const carrier = makeTarget({ maxHealth: 1_000_000, stats: { armor: 0 } });
    const simulation = buildSimulation([makeAttacker(), carrier]);
    simulation.begin();

    const hit = (school: 'physical' | 'shadow'): number =>
      dealDamage(simulation, {
        source: makeAttacker(),
        target: carrier,
        abilityName: 'probe',
        school,
        baseAmount: 1000,
      }).amount;

    const barePhysical = hit('physical');
    const bareShadow = hit('shadow');
    simulation.applyAura(carrier, STONEFORM, carrier.id);
    expect(hit('physical')).toBeCloseTo(barePhysical * STONEFORM_PHYSICAL, 6);
    expect(hit('shadow')).toBeCloseTo(bareShadow, 6);

    // And it is a DWARF who gets it, which is the other half of the claim.
    expect(
      racialBuild('dwarf', { characterClass: 'warrior', equipment: {}, style: 'two_hander' })
        .grantedAbilities.has('stoneform'),
    ).toBe(true);
  });

  it('is the ONE racial that costs a global cooldown', () => {
    // The owner states 1.5 seconds for this one and none for the other four.
    expect(RACIAL_ABILITIES.stoneform.triggersGcd).toBe(true);
    for (const id of ['blood_fury', 'berserking', 'elunes_light', 'eureka'] as const) {
      expect(RACIAL_ABILITIES[id].triggersGcd, id).toBe(false);
    }
  });
});

describe('Eureka!', () => {
  /** A Gnome Mage with the buff up, in a running simulation. */
  const gnomeWithEureka = () => {
    const player = createPlayer({ race: 'gnome', characterClass: 'mage' });
    const simulation = buildSimulation([player, makeTarget()]);
    simulation.begin();
    simulation.applyAura(player, EUREKA, player.id);
    return { player, simulation };
  };

  it('arrives at three charges rather than one', () => {
    /*
     * `chargesOnApply` AND NOT `instance.stacks = 3`. Writing the field by hand
     * does not re-apply stat modifiers -- `applyStatModifiers` runs inside
     * `apply` at ONE stack -- and the failure is an aura that reports three
     * stacks and pays one, which is what Combustion did while its own caveat
     * called it generous.
     */
    const { player } = gnomeWithEureka();
    expect(player.auras.get(EUREKA.id)!.stacks).toBe(EUREKA_CHARGES);
  });

  it('takes a tenth off the cost of an ability that has one', () => {
    const { player, simulation } = gnomeWithEureka();
    const fireball = player.abilities.all.find((ability) => ability.id === 'fireball');
    expect(fireball).toBeDefined();
    const base = fireball!.cost!.amount;
    expect(resolveCast(player, fireball!).costAmount).toBeCloseTo(base * (1 - EUREKA_COST), 6);
    // And a Human Mage with the same gear pays the full price.
    const human = createPlayer({ race: 'human', characterClass: 'mage' });
    const theirs = human.abilities.all.find((ability) => ability.id === 'fireball')!;
    expect(resolveCast(human, theirs).costAmount).toBeCloseTo(base, 6);
    void simulation;
  });

  it('raises NON-PERIODIC damage by a tenth and leaves a tick alone', () => {
    /*
     * ========================================================================
     * "PERIODIC EFFECTS GET NOTHING FROM IT; A CHANNELED SPELL IS NOT
     * PERIODIC." This is the clause that could not ride on `abilityModifiers`:
     * a catch-all entry there selects every ability correctly and
     * `abilityModifierFor` is never told whether the damage is a tick, so
     * Ignite, Pyroblast's burn and every Corruption tick inside the window
     * would have collected it. A bigger number and no error.
     * ========================================================================
     */
    const { player, simulation } = gnomeWithEureka();
    const hit = (periodic: boolean): number =>
      dealDamage(simulation, {
        source: player,
        target: simulation.combatants.find((actor) => actor.kind === 'enemy')!,
        abilityId: 'probe',
        abilityName: 'probe',
        school: 'fire',
        baseAmount: 1000,
        periodic,
      }).amount;

    const bare = createPlayer({ race: 'human', characterClass: 'mage' });
    const control = buildSimulation([bare, makeTarget()]);
    control.begin();
    const controlHit = (periodic: boolean): number =>
      dealDamage(control, {
        source: bare,
        target: control.combatants.find((actor) => actor.kind === 'enemy')!,
        abilityId: 'probe',
        abilityName: 'probe',
        school: 'fire',
        baseAmount: 1000,
        periodic,
      }).amount;

    expect(hit(false)).toBeCloseTo(controlHit(false) * EUREKA_DAMAGE, 6);
    expect(hit(true)).toBeCloseTo(controlHit(true), 6);
  });

  it('spends one charge per CAST, so a channel is one of the three', () => {
    /*
     * ========================================================================
     * THE OWNER'S RULING, AND `cast.final` IS WHAT BUYS IT. `runCast` runs once
     * per channel tick, so without it the first of five Arcane Missiles would
     * spend a charge and the last two would fire unbuffed -- a smaller number,
     * no error, and the opposite of what the Arcane list is built around.
     *
     * COUNTED OVER A REAL FIGHT rather than by calling the reaction, because
     * what is being tested is the INTERACTION of three things: the marker
     * firing from inside `dealDamage`, the spender firing from
     * `runCastReactions` afterwards, and the latch being cleared in between.
     * ========================================================================
     */
    const built = PRESETS_BY_ID.get('mage_arcane')!.build();
    const recorder = new TelemetryRecorder();
    const simulation = new Simulation(
      { ...trainingDummyEncounter(built), seed: 4242 },
      recorder,
    );
    simulation.run();

    const applied = recorder.all.filter(
      (event) => event.type === 'aura_applied' && event.auraId === EUREKA.id,
    ).length;
    const ended = recorder.all.filter(
      (event) => event.type === 'aura_removed' && event.auraId === EUREKA.id,
    ).length;

    /*
     * APPLIED AND SPENT. An aura applied and never ended is +10% for the whole
     * fight with a tidy uptime row -- the Adrenaline Rush shape -- and with no
     * duration there is nothing else that could end it, so `ended` can only be
     * the third charge being spent.
     */
    expect(applied).toBeGreaterThan(0);
    expect(ended).toBe(applied);
  });

  it('is not consumed by an ability that deals no damage', () => {
    /*
     * The two counter-examples that made the reaction pair necessary: Rupture
     * and Serpent Sting both DECLARE a combat table -- they roll it to decide
     * whether the bleed lands -- and neither deals a point of direct damage. So
     * `requiresAttackTable` would have spent a charge on either, and the charge
     * is spent off the DAMAGE instead.
     */
    const { player, simulation } = gnomeWithEureka();
    const before = player.auras.get(EUREKA.id)!.stacks;
    // An ability with no damage at all cannot mark the cast, so nothing spends.
    simulation.advanceTo(seconds(1));
    expect(player.auras.get(EUREKA.id)?.stacks).toBe(before);
  });
});

describe('Touch of the Grave', () => {
  const undeadRogue = () => {
    const player = createPlayer({ race: 'undead', characterClass: 'rogue' });
    const target = makeTarget();
    const simulation = buildSimulation([player, target]);
    simulation.begin();
    return { player, target, simulation };
  };

  it('is 5% for a melee class and 10% for a caster, and nothing for the rest', () => {
    // The owner's enumeration, which agrees with the client's "10% for casters,
    // 5% for melee" on all six classes an Undead can be.
    for (const characterClass of ['warrior', 'paladin', 'rogue'] as const) {
      expect(
        racialBuild('undead', { characterClass, equipment: {}, style: 'two_hander' }).reactions
          .length,
        characterClass,
      ).toBeGreaterThan(0);
    }
    // A class no Undead can be gets no reaction at all rather than a default.
    for (const characterClass of ['druid', 'shaman', 'hunter'] as const) {
      expect(
        racialBuild('undead', { characterClass, equipment: {}, style: 'two_hander' }).reactions
          .length,
        characterClass,
      ).toBe(0);
    }
    expect(getRace('undead')!.classes).not.toContain('druid');
    // And the figures themselves, written out.
    expect(TOUCH_MELEE_CHANCE).toBe(5);
    expect(TOUCH_CASTER_CHANCE).toBe(10);
  });

  it('drains five percent of MAXIMUM health, and reads no attack or spell power', () => {
    /*
     * "ONLY SCALES OFF YOUR HIT POINTS - not attack power or spell power or
     * shadow damage talents." The first two are structural: the drain declares
     * no coefficient and no weapon scaling, so there is nothing for either pool
     * to multiply. Checked by moving them and seeing nothing happen.
     */
    const lean = createPlayer({ race: 'undead', characterClass: 'rogue' });
    const loaded = createPlayer({
      race: 'undead',
      characterClass: 'rogue',
      bonusStats: { attackPower: 2000, spellPower: 2000 },
    });
    expect(loaded.health.maximum).toBe(lean.health.maximum);

    const drain = (player: Combatant): number => {
      const target = makeTarget({ stats: { armor: 0 } });
      const simulation = buildSimulation([player, target]);
      simulation.begin();
      // Scripted so the spell table cannot miss: the roll is the first draw.
      return dealDamage(simulation, {
        source: player,
        target,
        abilityId: TOUCH_OF_THE_GRAVE_ABILITY_ID,
        abilityName: 'Touch of the Grave',
        school: 'shadow',
        baseAmount: player.health.maximum * TOUCH_HEALTH_FRACTION,
        ignoresAttackerDamageScaling: true,
      }).amount;
    };

    // Identical health, identical power pools ignored, identical drain.
    expect(drain(loaded)).toBeCloseTo(drain(lean), 6);
  });

  it('is not raised by the attacker\'s own shadow scaling and IS by the target\'s', () => {
    /*
     * ========================================================================
     * THE OWNER'S ONE EXCEPTION, AND IT IS WHAT `ignoresAttackerDamageScaling`
     * EXISTS FOR: "BUT it does scale if the target is vulnerable to
     * shadow/magic damage from a debuff like Curse of the Elements or Improved
     * Shadow Bolt."
     *
     * Both Undead Warlock presets carry Shadow Mastery, so without the flag a
     * drain fixed by the Undead's health would have been scaled by a tenth and
     * more of somebody else's talent.
     * ========================================================================
     */
    const target = makeTarget({ stats: { armor: 0 } });
    const player = createPlayer({ race: 'undead', characterClass: 'warlock' });
    const simulation = buildSimulation([player, target]);
    simulation.begin();

    const drain = (): number =>
      dealDamage(simulation, {
        source: player,
        target,
        abilityId: TOUCH_OF_THE_GRAVE_ABILITY_ID,
        abilityName: 'Touch of the Grave',
        school: 'shadow',
        baseAmount: 1000,
        ignoresAttackerDamageScaling: true,
      }).amount;

    // The attacker's own per-school bonus is ignored.
    player.schoolModifiers.add('shadow', { damageMultiplier: 2 });
    const withAttackerTalent = drain();

    // The TARGET's vulnerability is not.
    simulation.applyAura(target, {
      id: 'probe_vulnerability',
      name: 'Shadow Vulnerability',
      durationMs: seconds(60),
      isDebuff: true,
      damageTakenBySchool: { shadow: 1.5 },
    }, player.id);
    const withTargetDebuff = drain();

    expect(withTargetDebuff / withAttackerTalent).toBeCloseTo(1.5, 6);
  });

  it('cannot crit, even on a caster given a hundred points of crit', () => {
    /*
     * ========================================================================
     * THIS IS THE TEST THAT FOUND THE BUG, AND IT ONLY FOUND IT ONCE IT RAN THE
     * REAL REACTION.
     *
     * The drain shipped with no `critFrom`, which is the obvious way to write
     * "cannot crit" and is about the OTHER case: `critFrom` governs an attack
     * with no table, and this one declares the spell table -- whose crit slice
     * IS the caster's `spellCritChance`. So it critted at the caster's full
     * spell crit, for a 1.5x it was never entitled to.
     *
     * THE FIRST VERSION OF THIS TEST BUILT THE DamageRequest BY HAND and
     * therefore asserted nothing: it omitted `cannotCrit` exactly as the
     * reaction did, so it agreed with the bug. A test that reconstructs the
     * thing under test will reproduce its mistakes. It drives the reaction now,
     * through real fights, and reads the event stream.
     * ========================================================================
     */
    let procs = 0;
    let crits = 0;
    for (let i = 0; i < 20; i += 1) {
      const built = PRESETS_BY_ID.get('warlock_smds')!.build();
      const recorder = new TelemetryRecorder();
      const simulation = new Simulation(
        {
          ...trainingDummyEncounter({
            ...built,
            // A hundred points on both crit stats: if anything about the drain
            // could roll a crit, every one of them would be one.
            stats: { ...built.stats, critChance: 100, spellCritChance: 100 },
          }),
          seed: 5100 + i,
        },
        recorder,
      );
      simulation.run();
      for (const event of recorder.all) {
        if (event.type !== 'damage') continue;
        if (event.abilityId !== TOUCH_OF_THE_GRAVE_ABILITY_ID) continue;
        procs += 1;
        if (event.critical) crits += 1;
      }
    }

    // The proc has to have FIRED, or "no crits" is a statement about nothing.
    expect(procs).toBeGreaterThan(10);
    expect(crits).toBe(0);
  });

  it('refuses a poison, which the owner excludes by name', () => {
    const { player } = undeadRogue();
    for (const abilityId of TOUCH_OF_THE_GRAVE_POISON_EXCLUSIONS) {
      expect(touchOfTheGraveMayProc(player, abilityId, 500), abilityId).toBe(false);
    }
    /*
     * AND THE EXCLUSION LIST IS REAL. The ids are written out because there is
     * no structural test -- a poison hit carries no `weaponSlot` and neither
     * does a seal, which is NOT excluded -- so a rename would quietly re-admit
     * one. This is what fails instead.
     */
    const source = readFileSync('src/game/reactions/poisons.ts', 'utf8');
    for (const abilityId of TOUCH_OF_THE_GRAVE_POISON_EXCLUSIONS) {
      /*
       * READ OUT OF THE SOURCE, which is the `auraCatalog.test.ts` argument:
       * every other assertion about poisons keys off ids this project already
       * uses, and the two poisons nobody has built yet are exactly the ones a
       * rename would strand. Three of these five are declared in the ruleset
       * and not yet implemented, so the check is that the name still appears
       * where poisons are written -- not that an ability object exists.
       */
      expect(source.includes(abilityId) || !IMPLEMENTED_POISONS.has(abilityId), abilityId).toBe(
        true,
      );
    }
  });

  it('refuses an ability that dealt no damage, and accepts a swing', () => {
    const { player } = undeadRogue();
    // "Abilities which do not have a damage component ... cannot proc." Read
    // off the DAMAGE, because Rupture declares a table and deals none.
    expect(touchOfTheGraveMayProc(player, 'rupture', 0)).toBe(false);
    // An auto-attack carries no ability id and DOES qualify: "attacks".
    expect(touchOfTheGraveMayProc(player, undefined, 500)).toBe(true);
    // And it cannot chain off itself.
    expect(touchOfTheGraveMayProc(player, TOUCH_OF_THE_GRAVE_ABILITY_ID, 500)).toBe(false);
  });

  it('names its two owner-stated exceptions, for two different reasons', () => {
    /*
     * "This rule has two exceptions for Mage's Arcane Missiles and Paladin's
     * Consecration - each tick of both have a chance to trigger."
     *
     * THEY ARE IN TWO SETS BECAUSE THEY ARE EXCEPTIONS TO TWO RULES. Arcane
     * Missiles is a CHANNEL, and a channel's ticks are not periodic -- so it is
     * the per-channel rule it escapes. Consecration deals nothing on its cast
     * and is nothing but periodic ticks, which `dealt` reactions never see at
     * all -- so it needs the `periodicDealt` trigger, and without it a
     * Paladin's only area spell could never proc.
     */
    expect([...TOUCH_OF_THE_GRAVE_CHANNEL_EXCEPTIONS]).toEqual(['arcane_missiles']);
    expect([...TOUCH_OF_THE_GRAVE_PERIODIC_EXCEPTIONS]).toEqual(['consecration']);
  });

  it("procs off CONSECRATION'S TICKS, which no `dealt` reaction can ever see", () => {
    /*
     * ========================================================================
     * THE OWNER'S SECOND EXCEPTION, AND IT IS WHY `periodicDealt` EXISTS.
     *
     * "This rule has two exceptions for Mage's Arcane Missiles and Paladin's
     * Consecration - each tick of both have a chance to trigger." Arcane
     * Missiles needs no new machinery: a channel's ticks are not periodic, so
     * each missile is an ordinary non-periodic damage event and the general
     * rule reaches it already.
     *
     * CONSECRATION IS NOT LIKE THAT. Its cast deals nothing at all -- it
     * applies a ground aura that ticks -- and `dealDamage` runs `dealt`
     * reactions only for damage that consulted a combat table and is not
     * periodic. So through `dealt` the ability could NEVER have procced, and
     * the exception would have been silently absent on a racial whose every
     * other clause was implemented.
     *
     * DRIVEN THROUGH A REAL FIGHT, because what is under test is the wiring
     * between an aura's `onTick` and a reaction list -- which is exactly what a
     * hand-built DamageRequest would skip, the mistake the crit test made.
     * ========================================================================
     */
    const built = PRESETS_BY_ID.get('prot_pally')!.build();
    // An Undead Paladin: the same build, the same Consecration, a race that
    // drains. Undead can be a Paladin in Forever -- it is not Alliance-locked.
    const undead = { ...built, character: { ...built.character, race: 'undead' as const } };

    let fromConsecration = 0;
    let consecrationTicks = 0;
    for (let i = 0; i < 20; i += 1) {
      const recorder = new TelemetryRecorder();
      const simulation = new Simulation(
        { ...trainingDummyEncounter(undead), seed: 8200 + i },
        recorder,
      );
      simulation.run();
      /*
       * COUNTED BY ADJACENCY, which is the only signal available: the drain is
       * dealt inline from inside the reaction, so its damage event follows the
       * tick that caused it immediately in the stream.
       */
      let previousWasConsecrationTick = false;
      for (const event of recorder.all) {
        if (event.type !== 'damage') continue;
        if (event.abilityId === TOUCH_OF_THE_GRAVE_ABILITY_ID) {
          if (previousWasConsecrationTick) fromConsecration += 1;
          continue;
        }
        previousWasConsecrationTick = event.abilityId === 'consecration';
        if (previousWasConsecrationTick) consecrationTicks += 1;
      }
    }

    // The ability has to be ticking, or the rest asserts nothing at all.
    expect(consecrationTicks).toBeGreaterThan(50);
    expect(fromConsecration).toBeGreaterThan(0);
  });

  it('does not proc off an ordinary DoT tick, which is the rule those two escape', () => {
    /*
     * "Channeled abilities can only trigger Touch of the Grave on the initial
     * cast not each tick. Same rule for DoTs - only on cast not each tick."
     *
     * Rupture is the Rogue's own bleed and is not one of the two exceptions, so
     * its ticks must never proc -- which the engine gives for free, since a tick
     * reaches no `dealt` reaction, and which `periodicDealt` must not undo.
     * Asserted on the exception SET, because the set is the thing a later reader
     * would widen.
     */
    expect(TOUCH_OF_THE_GRAVE_PERIODIC_EXCEPTIONS.has('rupture')).toBe(false);
    expect(TOUCH_OF_THE_GRAVE_PERIODIC_EXCEPTIONS.has('corruption')).toBe(false);
    expect(TOUCH_OF_THE_GRAVE_PERIODIC_EXCEPTIONS.size).toBe(1);
  });

  it('a PET never triggers it, because the reaction is only ever the player\'s', () => {
    /*
     * "Pets can never trigger Touch of the grave." There is nothing to switch
     * off: `racialBuild` is called by `createPlayer` and `createPet` builds its
     * own combatant with its own reaction list, so the pet has no route to it.
     * Asserted because "there is nothing to do" is exactly the claim that
     * quietly stops being true.
     */
    const built = PRESETS_BY_ID.get('bm_hunter')!.build();
    const simulation = new Simulation(
      trainingDummyEncounter({ ...built, character: { ...built.character, race: 'orc' } }),
    );
    simulation.begin();
    const pet = simulation.combatants.find((actor) => actor.kind === 'pet')!;
    expect(pet.reactions.some((reaction) => reaction.id.startsWith('touch_of_the_grave'))).toBe(
      false,
    );
  });

  it('procs in a real fight, at a rate the internal cooldown explains', () => {
    /*
     * A PROC THAT NEVER FIRES LEAVES NOTHING BEHIND TO NOTICE, which is why a
     * rate over real fights is asserted and not only the branch. Windfury spent
     * its whole life refusing abilities and every figure was self-consistent
     * and too low; `isWeaponUseOf(attack, 'ranged')` was false for every attack
     * forever and read exactly like a predicate that was sometimes true.
     */
    let procs = 0;
    let heals = 0;
    const fights = 20;
    for (let i = 0; i < fights; i += 1) {
      const built = PRESETS_BY_ID.get('rogue_rupture')!.build();
      const recorder = new TelemetryRecorder();
      const simulation = new Simulation(
        { ...trainingDummyEncounter(built), seed: 7000 + i },
        recorder,
      );
      simulation.run();
      for (const event of recorder.all) {
        if (event.type === 'damage' && event.abilityId === TOUCH_OF_THE_GRAVE_ABILITY_ID) procs += 1;
        if (event.type === 'heal' && event.abilityId === TOUCH_OF_THE_GRAVE_ABILITY_ID) heals += 1;
      }
    }
    expect(procs / fights).toBeGreaterThan(1);
    /*
     * AND THE DRAIN HEALS FOR WHAT LANDED. Fewer heals than procs, because the
     * drain rolls the spell table and a miss must heal nothing -- reading the
     * requested amount instead would make a missed drain a free heal.
     */
    expect(heals).toBeGreaterThan(0);
    expect(heals).toBeLessThanOrEqual(procs);
  });
});

describe('the racials are in the priority lists, or they never fire', () => {
  it('puts the four free cooldowns in every player list', () => {
    /*
     * AN ABILITY IN THE BOOK AND IN NO LIST NEVER FIRES, and that is the fourth
     * cause of inert -- the one that reads exactly like an engine gap. These
     * four are learned by a RACE, so no class list was ever going to name them.
     */
    const ids = RACIAL_COOLDOWNS.map((entry) => entry.abilityId);
    expect(ids.sort()).toEqual(['berserking', 'blood_fury', 'elunes_light', 'eureka']);

    for (const { list } of ALL_PRIORITY_LISTS) {
      // The pet's list is the one exception: a pet gets no racials.
      if (list.name.toLowerCase().includes('pet')) continue;
      for (const abilityId of ids) {
        expect(
          list.entries.some((entry) => entry.abilityId === abilityId),
          `${list.name} / ${abilityId}`,
        ).toBe(true);
      }
    }
  });

  it('puts Stoneform in the TANK lists only, which is the Shield Wall case', () => {
    /*
     * It is the one racial that costs a global cooldown and the one that buys
     * nothing offensively, so in a DPS list it is a straight loss. Survival is
     * a count of deaths here, which is what makes it a real decision for a tank
     * -- exactly what was said about Shield Wall.
     */
    expect(RACIAL_DEFENSIVE_COOLDOWNS.map((entry) => entry.abilityId)).toEqual(['stoneform']);

    const withStoneform = ALL_PRIORITY_LISTS.filter(({ list }) =>
      list.entries.some((entry) => entry.abilityId === 'stoneform'),
    ).map(({ list }) => list.name);

    expect(withStoneform.sort()).toEqual(
      ['Druid (Bear)', 'Paladin (Protection)', 'Warrior (Shield, Defensive)'].sort(),
    );
  });

  it('is skipped in silence by a build of the wrong race, which is what makes one list serve ten', () => {
    // A Tauren Druid's list names Blood Fury, Berserking, Elune's Light and
    // Eureka!, and the character knows none of them.
    const built = PRESETS_BY_ID.get('druid_cat')!.build();
    const player = characterAtCombatStart(built)!;
    for (const abilityId of RACIAL_COOLDOWNS.map((entry) => entry.abilityId)) {
      expect(player.abilities.has(abilityId), abilityId).toBe(false);
    }
    expect(built.rotation!.entries.some((entry) => entry.abilityId === 'blood_fury')).toBe(true);
  });
});

describe('what is NOT modelled says so, in the owner\'s own words', () => {
  it('declares every other trait, with a reason', () => {
    /*
     * THE OWNER'S LIST IS THE SCOPE, and the other traits say so rather than
     * being absent. A trait nobody declared is indistinguishable from one
     * nobody noticed, and an inert effect that SAYS it is inert is the honest
     * failure mode.
     */
    let modelled = 0;
    let ruledOut = 0;
    let liveGaps = 0;
    for (const race of RACE_IDS) {
      for (const trait of RACIALS[race].traits) {
        const live = trait.effects.filter((effect) => effect.kind !== 'unmodelled');
        if (live.length > 0) modelled += 1;
        for (const effect of trait.effects) {
          if (effect.kind !== 'unmodelled') continue;
          expect(effect.text.length, `${race} ${trait.id}`).toBeGreaterThan(0);
          expect(effect.reason.length, `${race} ${trait.id}`).toBeGreaterThan(0);
          if (effect.scope) ruledOut += 1;
          else liveGaps += 1;
        }
      }
    }
    /*
     * COUNTED FROM THE DECLARATIONS AND PINNED, so a trait losing its reason or
     * gaining a scope is a visible change. This file's own rule: re-count
     * rather than increment -- two branches that each move a count by one from
     * the same base both write the same number and git merges them cleanly.
     */
    expect(modelled).toBe(15);
    expect(ruledOut).toBe(20);
    expect(liveGaps).toBe(11);
  });

  it('names only real OutOfScope members, so a typo cannot invent a ruling', () => {
    /*
     * A `scope` TAG IS THE QUIETEST MISTAKE AROUND THIS TABLE, because its
     * whole purpose is to stop anybody looking again: a ruled-out effect is
     * kept out of the live-gap list by design. Three Rogue talents carried
     * `scope: 'stealth'` through the whole release in which the owner ruled
     * their blocker away.
     */
    const members = new Set([
      'positioning',
      'crowdControl',
      'threat',
      'healing',
      'stealth',
      'castPushback',
      'totemEntities',
      'dispel',
      'immunity',
    ]);
    for (const race of RACE_IDS) {
      for (const trait of RACIALS[race].traits) {
        for (const effect of trait.effects) {
          if (effect.kind !== 'unmodelled' || !effect.scope) continue;
          expect(members.has(effect.scope), `${race} ${trait.id}: ${effect.scope}`).toBe(true);
        }
      }
    }
  });

  it('keeps the three traits the owner was asked about as LIVE gaps, not rulings', () => {
    /*
     * Orc's Shatter Curse, Troll's Regeneration and Skyborne's Read Ley Line
     * each carry a clause this engine could express today -- magic damage
     * taken, health regeneration and mana regeneration. The owner ruled their
     * list is the scope, so none is built; none carries a `scope` either,
     * because a ruling is permanent by design and these are questions. The
     * census is what points at them if the owner revisits.
     */
    const live = (race: Parameters<typeof racialBuild>[0], traitId: string) => {
      const trait = RACIALS[race].traits.find((entry) => entry.id === traitId);
      expect(trait, `${race} ${traitId}`).toBeDefined();
      return trait!.effects.filter(
        (effect) => effect.kind === 'unmodelled' && effect.scope === undefined,
      );
    };
    expect(live('orc', 'shatter_curse').length).toBe(1);
    expect(live('troll', 'regeneration').length).toBe(1);
    expect(live('high_order_skyborne', 'read_ley_line').length).toBe(1);
  });
});

// --- helpers ---------------------------------------------------------------

/** The spell crit a preset's race grants, isolated by swapping the race. */
function racialSpellCritDelta(presetId: string, otherRace: 'troll' | 'tauren' | 'undead'): number {
  /*
   * SWAPPING THE RACE ON IDENTICAL GEAR, which is the only honest isolation.
   * The first version of this probe took the WEAPON off instead and was
   * useless: Obsidian Edged Blade and Azuresong Mageblade both carry "+1% crit
   * with all spells and attacks", so the deltas came back 1.000 and 3.269 where
   * the racial is 0 and 2, with the item's own line in both columns.
   *
   * `spellCritChance` IS THE CLEAN COLUMN under a race swap too, because no
   * race differs from another in BASE spell crit -- where they do differ in base
   * agility, which feeds melee crit.
   */
  const built = PRESETS_BY_ID.get(presetId)!.build();
  const mine = characterAtCombatStart(built)!;
  const theirs = characterAtCombatStart({
    ...built,
    character: { ...built.character, race: otherRace },
  })!;
  return mine.stats.effective.spellCritChance - theirs.stats.effective.spellCritChance;
}

/** The item id a preset carries in one slot, for building a context by hand. */
function itemIdIn(presetId: string, slot: 'mainHand' | 'offHand' | 'twoHand'): number {
  const built = PRESETS_BY_ID.get(presetId)!.build();
  const equipped = built.equipment?.[slot];
  expect(equipped, `${presetId} ${slot}`).toBeDefined();
  return equipped!.itemId;
}

describe('the panel can name and offer a racial ability', () => {
  it('names all five properly, rather than prettifying the id', () => {
    /*
     * ========================================================================
     * `aplNamesFor` FALLS BACK TO PRETTIFYING THE ID, which is right for an
     * aura -- "`shadow_trance` reading as Shadow Trance is honest" is its own
     * comment -- and gets two of the five racials wrong, because a racial
     * belongs to no class and `abilitiesForClass` does not carry one.
     *
     * `elunes_light` prettifies to "Elunes Light" and `eureka` to "Eureka":
     * close enough to look deliberate, which is why this is asserted on the
     * two that differ rather than on all five.
     * ========================================================================
     */
    const gnome = PRESETS_BY_ID.get('mage_fire')!.build();
    expect(aplNamesFor(gnome).nameOf('eureka')).toBe('Eureka!');

    const nightElf = {
      ...gnome,
      character: { ...gnome.character, race: 'night_elf' as const, characterClass: 'rogue' as const },
    };
    expect(aplNamesFor(nightElf).nameOf('elunes_light')).toBe("Elune's Light");
  });

  it('offers the race\'s own racial in the dropdown, and not another race\'s', () => {
    /*
     * Every list names all four free racial cooldowns, so somebody who removed
     * one has to be able to add it back -- and the dropdown offers the build's
     * BOOK, which is exactly the set `PriorityRotation` will act on.
     */
    const gnome = PRESETS_BY_ID.get('mage_fire')!.build();
    const offered = new Set(abilityChoicesFor(gnome).map((choice) => choice.id));
    expect(offered.has('eureka')).toBe(true);
    expect(offered.has('blood_fury')).toBe(false);
    expect(offered.has('berserking')).toBe(false);

    const orc = PRESETS_BY_ID.get('dw_fury')!.build();
    const orcOffered = new Set(abilityChoicesFor(orc).map((choice) => choice.id));
    expect(orcOffered.has('blood_fury')).toBe(true);
    expect(orcOffered.has('eureka')).toBe(false);
  });
});
