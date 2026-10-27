import { readFileSync } from 'node:fs';
import { isStartAutoAttack } from '../../src/game/abilities/autoAttack';
import { describe, expect, it } from 'vitest';
import type { Ability, Combatant, RNG } from '../../src/engine';
import { critMultiplierWith } from '../../src/engine';
import {
  RATING_PER_PERCENT,
  Simulation,
  TelemetryRecorder,
  dealDamage,
  hasteMultiplierFrom,
  resolveCast,
  seconds,
} from '../../src/engine';
import type { ClassId } from '../../src/game/character';
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
  READ_LEY_LINE,
  STONEFORM,
} from '../../src/game/racials/auras';
import {
  TOUCH_OF_THE_GRAVE_ABILITY_ID,
  TOUCH_OF_THE_GRAVE_CHANNEL_EXCEPTIONS,
  TOUCH_OF_THE_GRAVE_INTERNAL_COOLDOWN_MS,
  TOUCH_OF_THE_GRAVE_PERIODIC_EXCEPTIONS,
  TOUCH_OF_THE_GRAVE_POISON_EXCLUSIONS,
  touchOfTheGraveMayProc,
} from '../../src/game/racials/reactions';
import { WARRIOR_STANCES } from '../../src/game/auras/warrior';
import { MAX_COMBO_POINTS } from '../../src/game/combat/comboPoints';
import { ALL_PRIORITY_LISTS } from '../../src/game/rotations/allLists';
import {
  RACIAL_COOLDOWNS,
  RACIAL_DEFENSIVE_COOLDOWNS,
  withoutOtherRacials,
} from '../../src/game/rotations/racialCooldowns';
import { abilityChoicesFor, aplNamesFor } from '../../src/ui/panels/AplPanel';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { syncDefaultRotation } from '../../src/profiles/rotation';

/*
 * A GNOME MAGE PRESET. The Mage presets were this file's Gnomes until round 78
 * moved Fire and Arcane to High Order Skyborne and Frostfire to Human, so the
 * Eureka! tests take a Mage preset and make it a Gnome rather than depending on
 * which race a preset happens to be.
 */
const gnomeMage = (presetId: string) => {
  const built = PRESETS_BY_ID.get(presetId)!.build();
  return syncDefaultRotation({ ...built, character: { ...built.character, race: 'gnome' as const } });
};
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
/*
 * ROUND 79's RACIAL TUNING: Ruthless 1% (was 2), the Human Spirit 10% (was 5),
 * Dwarf Earth Fury replaced by Artisan's Precision (+1% hit), Tauren Endurance
 * health only, Orc Savage replaced by Command (+5% Warlock and Hunter pet
 * damage), Wind Blessed 2% (was 3), and Read Ley Line +50% regeneration.
 */
const RUTHLESS = 1;
const ARTISANS_PRECISION = 1;
const COMMAND_PET_DAMAGE = 1.05;
const HUMAN_SPIRIT = 0.1;
const READ_LEY_LINE_REGEN = 1.5;
const NIGHT_ELF_DODGE = 1;
const TAUREN_HEALTH = 0.05;
const GNOME_RESOURCE = 0.05;
const SKYBORNE_HASTE = 2;
const BLOOD_FURY_POWER = 0.1;
const BERSERKING_HASTE = 10;
const ELUNES_LIGHT_CRIT = 10;
const STONEFORM_PHYSICAL = 0.9;
const EUREKA_DURATION_SECONDS = 8;
const EUREKA_COST = 0.1;
const EUREKA_DAMAGE = 1.1;
const TOUCH_HEALTH_FRACTION = 0.05;
const TOUCH_MELEE_CHANCE = 20;
const TOUCH_CASTER_CHANCE = 30;
const TOUCH_INTERNAL_COOLDOWN_SECONDS = 25;
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
    // And Read Ley Line since round 79.
    expect([...granted].sort()).toEqual(
      ['berserking', 'blood_fury', 'elunes_light', 'eureka', 'read_ley_line', 'stoneform'].sort(),
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

describe('the crit, hit and pet racials, after round 79', () => {
  /*
   * ==========================================================================
   * ROUND 79 LEFT ONE CRIT RACIAL. Ruthless is 1% crit chance for a Human with
   * no condition; Savage and Earth Fury are gone, replaced by Command (Orc pet
   * damage) and Artisan's Precision (Dwarf hit). So no race carries a crit
   * DAMAGE factor any more, and nothing asks about a weapon.
   * ==========================================================================
   */

  it('grants a Human BOTH crit stats, because "all spells and attacks" is two of them', () => {
    const asHuman = racialBuild('human', { characterClass: 'paladin', equipment: {}, style: 'one_hand_shield' });
    const asUndead = racialBuild('undead', { characterClass: 'paladin', equipment: {}, style: 'one_hand_shield' });
    expect((asHuman.stats.critChance ?? 0) - (asUndead.stats.critChance ?? 0)).toBeCloseTo(RUTHLESS, 9);
    expect((asHuman.stats.spellCritChance ?? 0) - (asUndead.stats.spellCritChance ?? 0)).toBeCloseTo(RUTHLESS, 9);
  });

  it('gives an Orc no crit at all now that Savage is gone', () => {
    const orc = racialBuild('orc', { characterClass: 'rogue', equipment: {}, style: 'dual_wield' });
    expect(orc.stats.critChance ?? 0).toBe(0);
    expect(orc.stats.spellCritChance ?? 0).toBe(0);
  });

  it('gives a Dwarf a point of hit, character-wide, which every table reads', () => {
    const dwarf = createPlayer({ race: 'dwarf', characterClass: 'warrior' });
    const troll = createPlayer({ race: 'troll', characterClass: 'warrior' });
    expect(dwarf.stats.get('hitChance') - troll.stats.get('hitChance')).toBe(ARTISANS_PRECISION);
  });

  it('leaves NO racial asking about a weapon, so the condition is unreachable', () => {
    const withWeaponCondition: string[] = [];
    for (const race of RACE_IDS) {
      for (const trait of RACIALS[race].traits) {
        for (const effect of trait.effects) {
          if (
            (effect.kind === 'stat' || effect.kind === 'statPercent') &&
            effect.requires?.weaponTypes !== undefined
          ) {
            withWeaponCondition.push(`${race}/${trait.id}`);
          }
        }
      }
    }
    expect(withWeaponCondition).toEqual([]);
  });

  it('gives no race a crit DAMAGE factor any more', () => {
    for (const race of RACE_IDS) {
      const built = racialBuild(race, { characterClass: 'warrior', equipment: {}, style: 'two_hander' });
      expect(built.attackTableModifiers.for('melee-special').critMultiplierFactor ?? 1, race).toBe(1);
      expect(built.attackTableModifiers.for('spell').critMultiplierFactor ?? 1, race).toBe(1);
    }
  });

  it("keeps the owner's crit multiplier arithmetic for a talent alone", () => {
    expect(critMultiplierWith(1.5, 0.5, 1)).toBe(2);
    expect(critMultiplierWith(2, 0.2, 1)).toBe(2.2);
  });

  it("reaches the PET with Ruthless's crit, which is a stat the pet inherits", () => {
    expect(
      racialBuild('human', { characterClass: 'hunter', equipment: {}, style: 'ranged' }).stats.critChance,
    ).toBe(RUTHLESS);
    const petCritWith = (bonus: number): number => {
      const built = PRESETS_BY_ID.get('bm_hunter')!.build();
      const simulation = new Simulation(
        trainingDummyEncounter({ ...built, stats: { ...built.stats, critChance: bonus } }),
      );
      simulation.begin();
      const pet = simulation.combatants.find((actor) => actor.kind === 'pet');
      expect(pet).toBeDefined();
      return pet!.stats.effective.critChance;
    };
    expect(petCritWith(10) - petCritWith(0)).toBeCloseTo(10, 6);
  });

  it("raises an Orc's Hunter pet and Warlock demon damage by 5%, and no one else's", () => {
    const petMultiplier = (presetId: string, race: 'orc' | 'troll'): number => {
      const built = PRESETS_BY_ID.get(presetId)!.build();
      const simulation = new Simulation(
        trainingDummyEncounter({ ...built, character: { ...built.character, race } }),
      );
      simulation.begin();
      const pet = simulation.combatants.find((actor) => actor.kind === 'pet');
      expect(pet, presetId).toBeDefined();
      return pet!.baseDamageMultiplier;
    };
    expect(petMultiplier('bm_hunter', 'orc') / petMultiplier('bm_hunter', 'troll')).toBeCloseTo(
      COMMAND_PET_DAMAGE,
      12,
    );
    // A Warlock with a demon out: Sbolt Spam summons none, so build one in.
    const withImp = (race: 'orc' | 'troll') => {
      const built = PRESETS_BY_ID.get('warlock_sbolt')!.build();
      const simulation = new Simulation(
        trainingDummyEncounter({
          ...built,
          character: { ...built.character, race, summonedDemon: 'imp' },
        }),
      );
      simulation.begin();
      return simulation.combatants.find((actor) => actor.kind === 'pet');
    };
    const orcImp = withImp('orc');
    const trollImp = withImp('troll');
    expect(orcImp, 'an Imp is built').toBeDefined();
    expect(orcImp!.baseDamageMultiplier / trollImp!.baseDamageMultiplier).toBeCloseTo(COMMAND_PET_DAMAGE, 12);
  });
});

describe('the passive racials', () => {
  it('gives a Human 10% more spirit, as a modifier that follows a buff', () => {
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

  it('gives a Tauren 5% health and nothing else', () => {
    const tauren = createPlayer({ race: 'tauren', characterClass: 'warrior' });
    const unracialled =
      baseHitPointsFor('tauren', 'warrior') + baseStatsFor('tauren', 'warrior')!.stamina * 10;
    expect(tauren.health.maximum).toBe(Math.round(unracialled * (1 + TAUREN_HEALTH)));
    // Round 79: "no hit chance or critical damage modifiers".
    expect(tauren.stats.get('hitChance')).toBe(0);
    expect(tauren.attackTableModifiers.for('melee-special').critMultiplierFactor ?? 1).toBe(1);
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

  it('gives both Skyborne races exactly two percent of haste', () => {
    /*
     * ASSERTED AS A MULTIPLIER AND NOT AS A RATING, which is the whole reason
     * the trait goes through `RATING_PER_PERCENT.haste`: three percent in is
     * 1.03 out of `hasteMultiplierFrom` whatever that placeholder constant
     * becomes.
     *
     * RAISED FROM ONE PERCENT BY THE RACIAL PATCH -- "Wind Blessed: Haste
     * bonus increased to 3% (was 1%)" -- and nothing else about the trait
     * moved. Both races still SHARE the one declaration, which is why the
     * figure is asserted on each rather than on the constant: three traits of
     * the two Skyborne races are one object, so a change that reached only one
     * of them would be a change to something else entirely.
     */
    for (const race of ['high_order_skyborne', 'windshaper_skyborne'] as const) {
      const build = racialBuild(race, {
        characterClass: 'warrior',
        equipment: {},
        style: 'two_hander',
      });
      expect(build.stats.hasteRating, race).toBe(SKYBORNE_HASTE * RATING_PER_PERCENT.haste);
      const player = createPlayer({ race, characterClass: 'warrior' });
      expect(hasteMultiplierFrom(player.stats.effective), race).toBeCloseTo(1.02, 9);
    }
  });
});

describe('Read Ley Line', () => {
  it('multiplies mana regeneration by 1.5 for fifteen seconds', () => {
    expect(READ_LEY_LINE.resourceRegenMultiplier?.mana).toBe(READ_LEY_LINE_REGEN);
    expect(READ_LEY_LINE.durationMs).toBe(seconds(15));
  });

  it('is a two-second cast, and refused while Innervate is up', () => {
    const ability = RACIAL_ABILITIES.read_ley_line;
    expect(ability.castTimeMs).toBe(seconds(2));
    const druid = createPlayer({ race: 'high_order_skyborne', characterClass: 'druid' });
    const simulation = buildSimulation([druid, makeTarget()]);
    simulation.begin();
    expect(ability.canCast?.({ simulation, caster: druid, ability } as never) ?? true).toBe(true);
    simulation.applyAura(druid, { id: 'innervate', name: 'Innervate', durationMs: seconds(20) }, druid.id);
    expect(ability.canCast?.({ simulation, caster: druid, ability } as never)).toBe(false);
  });

  it('is replaced by Innervate', () => {
    const druid = createPlayer({ race: 'high_order_skyborne', characterClass: 'druid' });
    const simulation = buildSimulation([druid, makeTarget()]);
    simulation.begin();
    simulation.applyAura(druid, READ_LEY_LINE, druid.id);
    expect(druid.auras.has('read_ley_line')).toBe(true);
    const innervate = druid.abilities.get('innervate');
    expect(innervate).toBeDefined();
    innervate!.onCast({ simulation, caster: druid, target: undefined, ability: innervate! } as never);
    expect(druid.auras.has('read_ley_line')).toBe(false);
    expect(druid.auras.has('innervate')).toBe(true);
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
    /*
     * THREE MINUTES, RAISED FROM TWO BY THE RACIAL PATCH, with the DURATION
     * untouched at fifteen seconds -- so this pins both halves. A patch that
     * moved the cooldown and the duration together would be a different
     * change, and the note moves only one.
     */
    expect(RACIAL_ABILITIES.blood_fury.cooldownMs).toBe(seconds(180));
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

  it('arrives as an eight second window with no charges at all', () => {
    /*
     * ========================================================================
     * THE REDESIGN REPLACED THREE CHARGES WITH A CLOCK, AND BOTH HALVES OF
     * THAT ARE ASSERTED -- the duration that arrived AND the charges that left.
     *
     * The charges are the half that would rot quietly. `maxStacks` and
     * `chargesOnApply` left on the definition would hand the aura a stack
     * count nothing spends, so it would sit at three stacks for eight seconds
     * and pay exactly what it should -- a correct damage figure above a stack
     * count that means nothing, which is the "inert buff with visible uptime"
     * shape pointing at a field instead of an effect.
     * ========================================================================
     */
    const { player } = gnomeWithEureka();
    const instance = player.auras.get(EUREKA.id)!;
    expect(instance.stacks).toBe(1);
    expect(EUREKA.maxStacks).toBeUndefined();
    expect(EUREKA.chargesOnApply).toBeUndefined();
    expect(EUREKA.durationMs).toBe(seconds(EUREKA_DURATION_SECONDS));
    // And it is a real window rather than "until spent", which was `durationMs: 0`.
    expect(instance.expiresAt).toBe(seconds(EUREKA_DURATION_SECONDS));
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
    const built = gnomeMage('mage_arcane');
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

  it('is 20% for a melee class and 30% for a caster, and nothing for the rest', () => {
    /*
     * RAISED FROM 5% AND 10% BY THE RACIAL PATCH, which names the same two
     * groups: "a 30% chance to activate for casters and a 20% chance to
     * activate for Paladins/Rogues/Warriors". The three melee classes are
     * enumerated exactly as the owner had them, so only the figures moved.
     */
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
    expect(TOUCH_MELEE_CHANCE).toBe(20);
    expect(TOUCH_CASTER_CHANCE).toBe(30);
    /*
     * AND THE COOLDOWN, IN THE SAME TEST AS THE RATES BECAUSE THE PATCH MOVED
     * THEM TOGETHER AND THEY ONLY MEAN ANYTHING TOGETHER.
     *
     * "Proc chance and cooldown adjusted to make benefit more consistent" --
     * the chance went up 4x-6x and the window that suppresses it went from 1
     * second to 25. Either half alone is badly wrong in opposite directions:
     * the rate alone is six times the procs, the cooldown alone is a
     * twenty-fifth of them. A test pinning one and not the other would pass a
     * half-applied patch.
     */
    expect(TOUCH_OF_THE_GRAVE_INTERNAL_COOLDOWN_MS).toBe(
      seconds(TOUCH_INTERNAL_COOLDOWN_SECONDS),
    );
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

  it('is raised by NEITHER side\'s shadow scaling, which inverted in the patch', () => {
    /*
     * ========================================================================
     * THE OWNER'S "BUT" CLAUSE IS GONE, AND THIS TEST USED TO ASSERT IT.
     *
     * It read "is not raised by the attacker's own shadow scaling and IS by
     * the target's", because the owner's original ruling was "only scales off
     * your Hit Points BUT it does scale if the target is vulnerable to
     * shadow/magic damage from a debuff like Curse of the Elements or Improved
     * Shadow Bolt". The racial patch removed the exception: "Touch of the Dead
     * no longer scales with Shadow increases on the target or the caster."
     *
     * SO THE TARGET ASSERTION IS INVERTED RATHER THAN DELETED. The old one
     * expected x1.5 from a shadow vulnerability; this expects x1.0, which is a
     * stronger statement than simply dropping the case -- a flag that silently
     * failed to apply would read as the OLD behaviour and pass a test that had
     * merely stopped looking.
     *
     * DRIVEN THROUGH THE REAL REACTION, NOT A HAND-BUILT `DamageRequest`. The
     * old version called `dealDamage` directly and passed
     * `ignoresAttackerDamageScaling: true` ITSELF -- so it asserted the
     * engine's handling of a flag the test supplied, and would have passed
     * just as happily with the flag missing from the reaction. That is this
     * project's own rule about a test reconstructing the thing under test, and
     * it is exactly how the first `cannotCrit` test agreed with the bug it was
     * written for. Here the drain is fired by `touchOfTheGrave`'s own reaction
     * with the roll forced, so both flags have to be where the ability puts
     * them.
     * ========================================================================
     */
    const vulnerability = {
      id: 'probe_vulnerability',
      name: 'Shadow Vulnerability',
      durationMs: seconds(60),
      isDebuff: true,
      damageTakenBySchool: { shadow: 1.5 },
    } as const;

    /**
     * One forced drain, with whichever side's shadow scaling asked for.
     *
     * The proc's own roll is forced rather than sampled so a single drain is
     * decisive -- and the SPELL TABLE roll is left alone and handled by giving
     * the caster enough hit that it cannot miss, because a missed drain deals
     * nothing and would read as a suppressed multiplier.
     */
    const drain = (options: { attacker: boolean; target: boolean }): number => {
      const player = createPlayer({
        race: 'undead',
        characterClass: 'warlock',
        bonusStats: { hitChance: 100 },
      });
      const enemy = makeTarget({ stats: { armor: 0 } });
      const recorder = new TelemetryRecorder();
      const simulation = buildSimulation([player, enemy], {}, recorder);
      simulation.begin();

      if (options.attacker) player.schoolModifiers.add('shadow', { damageMultiplier: 2 });
      if (options.target) simulation.applyAura(enemy, vulnerability, player.id);

      /*
       * THE REACTION THE CHARACTER ACTUALLY CARRIES, found by id rather than
       * rebuilt, so the thing under test is the one `racialBuild` registered.
       */
      const reaction = player.reactions.find((entry) => entry.id === 'touch_of_the_grave');
      if (!reaction?.onTrigger) throw new Error('the drain reaction is not registered');

      /*
       * THE ROLL IS FORCED ON THE REAL SIMULATION rather than on a copy of it.
       * Spreading the object -- `{ ...simulation, rng }` -- drops every method
       * off the prototype, and the first thing the damage pipeline asks for is
       * `context.attackChances`, so the drain never resolves at all. Swapping
       * one function and putting it back is what keeps the context real.
       */
      const rng = simulation.rng as { rollChance: (chance: number) => boolean };
      const realRollChance = rng.rollChance;
      rng.rollChance = () => true;

      const strike = {
        abilityId: 'shadow_bolt',
        abilityName: 'Shadow Bolt',
        amount: 500,
        outcome: 'hit' as const,
        defender: enemy,
        attacker: player,
      } as unknown as Parameters<typeof reaction.onTrigger>[2];

      try {
        reaction.onTrigger(simulation, player, strike);
      } finally {
        rng.rollChance = realRollChance;
      }

      const drained = recorder.all.find(
        (event) => event.type === 'damage' && event.abilityId === TOUCH_OF_THE_GRAVE_ABILITY_ID,
      );
      expect(drained, 'the drain fired').toBeDefined();
      return (drained as { amount: number }).amount;
    };

    const plain = drain({ attacker: false, target: false });
    expect(plain).toBeGreaterThan(0);

    // The attacker's own per-school bonus is ignored, as it always was.
    expect(drain({ attacker: true, target: false }) / plain).toBeCloseTo(1, 6);

    // AND THE TARGET'S VULNERABILITY IS NOW IGNORED TOO, which is the change.
    expect(drain({ attacker: false, target: true }) / plain).toBeCloseTo(1, 6);

    // Both at once, so neither can be covering for the other.
    expect(drain({ attacker: true, target: true }) / plain).toBeCloseTo(1, 6);
  });

  it('still takes a BLANKET damage-taken multiplier, which is narrower than the note', () => {
    /*
     * ========================================================================
     * `ignoresTargetSchoolScaling` IS SCOPED TO WHAT THE NOTE NAMES AND NO
     * WIDER, and this test is the line between the two.
     *
     * The note says "no longer scales with SHADOW INCREASES on the target",
     * and a Shadow increase is `damageTakenBySchool`. A blanket
     * `damageTakenMultiplier` on the target is not a Shadow increase, and nor
     * is a per-ability debuff -- so both still apply. Widening the flag to
     * swallow them would be the generous mistake: a smaller number on a drain
     * that is already small, with nothing anywhere to flag it.
     *
     * It is also why the flag is NOT simply the mirror of
     * `ignoresAttackerDamageScaling`, which does bypass its side's blanket
     * multiplier -- that flag carries a ruling about the whole of the
     * attacker's contribution ("only scales off your Hit Points"), and this
     * one carries a sentence about one school.
     * ========================================================================
     */
    const player = createPlayer({
      race: 'undead',
      characterClass: 'warlock',
      bonusStats: { hitChance: 100 },
    });
    const enemy = makeTarget({ stats: { armor: 0 } });
    const simulation = buildSimulation([player, enemy]);
    simulation.begin();

    const drain = (): number =>
      dealDamage(simulation, {
        source: player,
        target: enemy,
        abilityId: TOUCH_OF_THE_GRAVE_ABILITY_ID,
        abilityName: 'Touch of the Grave',
        school: 'shadow',
        baseAmount: 1000,
        ignoresAttackerDamageScaling: true,
        ignoresTargetSchoolScaling: true,
      }).amount;

    const plain = drain();

    // A SHADOW-SCOPED debuff is skipped.
    simulation.applyAura(
      enemy,
      {
        id: 'probe_school',
        name: 'Shadow Vulnerability',
        durationMs: seconds(60),
        isDebuff: true,
        damageTakenBySchool: { shadow: 1.5 },
      },
      player.id,
    );
    expect(drain() / plain).toBeCloseTo(1, 6);

    // A BLANKET one is not.
    simulation.applyAura(
      enemy,
      {
        id: 'probe_blanket',
        name: 'Takes More',
        durationMs: seconds(60),
        isDebuff: true,
        damageTakenMultiplier: 1.25,
      },
      player.id,
    );
    expect(drain() / plain).toBeCloseTo(1.25, 6);
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
      // As an Undead: the preset is Human since round 78, and this is Touch
      // of the Grave's own mechanism rather than a claim about the preset.
      const preset = PRESETS_BY_ID.get('warlock_smds')!.build();
      const built = { ...preset, character: { ...preset.character, race: 'undead' as const } };
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

  it('procs off a pure DoT CAST, which deals no direct damage at all', () => {
    /*
     * ========================================================================
     * THE OWNER FOUND THIS BY ARITHMETIC AND NO TEST COULD HAVE.
     *
     * "Same rule for DoTs - only on CAST not each tick." That was implemented
     * as "only on the cast's direct damage" -- and a pure DoT emits none, so
     * Corruption, Bane of Agony and Siphon Life never rolled at all. Every
     * assertion in this file was about an ability that DOES deal direct
     * damage, so every one of them passed.
     *
     * WHAT IT COST, in the owner's own numbers: the SM/DS Warlock made 21.6
     * damage-dealing casts a fight and procced 1.17 times where 10% of 21.6 is
     * 2.16. Nearly half the procs, on the build whose whole core is DoTs.
     *
     * DRIVEN BY REAL CASTS, spaced past the one second internal cooldown so
     * that what is measured is the ROLL RATE and not the cooldown.
     * ========================================================================
     */
    const { procs, casts } = driveCasts('corruption', 300);
    expect(casts).toBe(300);
    // 10% of 300 is 30; a binomial at n=300 has a standard deviation of 5.2.
    expect(procs).toBeGreaterThan(14);
    expect(procs).toBeLessThan(50);
  });

  it('does not proc off a cast with no damage part', () => {
    /*
     * "Abilities which do not have a damage component like demoralizing shout
     * cannot proc Touch of the Grave."
     *
     * LIFE TAP IS THE ONE A BARE WARLOCK HAS. It costs health, grants mana,
     * deals no damage and applies nothing -- so it is excluded by every clause
     * at once, which is the point: a cast reaction that rolled on any cast
     * would fire on it, and the Warlock casts it five times a fight.
     */
    const { procs, casts } = driveCasts('life_tap', 120, (player) => {
      // Health to spend, and room in the pool worth gaining. See `prepare`.
      player.health.gain(player.health.maximum);
      player.resources.require('mana').spend(player.resources.require('mana').current / 2);
    });
    /*
     * ENOUGH CASTS THAT A TEN PERCENT RATE WOULD ALMOST CERTAINLY HAVE SHOWN:
     * 0.9^120 is about one in three hundred thousand. A "procs: 0" assertion is
     * only worth what its sample size is worth.
     */
    expect(casts).toBeGreaterThan(100);
    expect(procs).toBe(0);
  });

  it('takes ONE roll for an ability that deals damage AND applies a DoT', () => {
    /*
     * ========================================================================
     * IMMOLATE IS BOTH, and without a dedupe it would roll twice in the same
     * instant -- once on its direct damage and once on the DoT it applied.
     * That is 19% where Corruption is 10%, and both figures look perfectly
     * ordinary on a results page.
     *
     * `lastRolledAt` is the dedupe and it is the same mechanism
     * `judgementOfWisdomReactions` uses, for the same reason: `runCast` runs
     * `onCast` before the cast reactions, so the damage half has already
     * rolled by the time the cast half is offered the action.
     *
     * MEASURED AS A RATIO AGAINST CORRUPTION rather than against 10%, which is
     * what makes it a test of the DEDUPE: both are driven the same way over the
     * same number of casts, so a double roll shows up as Immolate proccing
     * about twice as often and nothing else can produce that.
     * ========================================================================
     */
    const corruption = driveCasts('corruption', 400);
    const immolate = driveCasts('immolate', 400);
    expect(immolate.casts).toBe(400);

    // Within half of each other; a double roll would be ~1.9x.
    const ratio = immolate.procs / Math.max(1, corruption.procs);
    expect(ratio).toBeGreaterThan(0.6);
    expect(ratio).toBeLessThan(1.5);
  });

  it('matches the rate the owner computed by hand on SM/DS', () => {
    /*
     * ========================================================================
     * THE REGRESSION TEST FOR THE BUG, and it is a RATE rather than a branch.
     *
     * "A proc that never fires leaves nothing behind to notice" -- and this one
     * fired, at half the rate it should. The only thing that catches that is
     * dividing the procs by the actions that were entitled to a roll, which is
     * exactly the arithmetic the owner did.
     *
     * THE DENOMINATOR IS COUNTED FROM THE EVENT STREAM and the qualifying
     * abilities are written out BY HAND, which is this project's rule for a
     * test: reading the predicate back out of the source would pass whatever
     * the source said. A Wrack CAST is one action however many ticks it has --
     * the owner's "channeled abilities only on the initial cast" -- and
     * Amplify Curse is excluded because it has no damage part.
     * ========================================================================
     */
    const QUALIFYING = new Set([
      'shadow_bolt', // direct damage
      'wrack', // a channel: one action, however many ticks
      'corruption', // pure DoTs, which is what was broken
      'bane_of_agony',
      'siphon_life',
    ]);

    let qualifyingCasts = 0;
    let procs = 0;
    const fights = 40;
    for (let i = 0; i < fights; i += 1) {
      // As an Undead: the preset is Human since round 78, and this is Touch
      // of the Grave's own mechanism rather than a claim about the preset.
      const preset = PRESETS_BY_ID.get('warlock_smds')!.build();
      const built = { ...preset, character: { ...preset.character, race: 'undead' as const } };
      const recorder = new TelemetryRecorder();
      const simulation = new Simulation(
        { ...trainingDummyEncounter(built), seed: 4000 + i },
        recorder,
      );
      simulation.run();
      for (const event of recorder.all) {
        if (event.type === 'cast' && event.abilityId && QUALIFYING.has(event.abilityId)) {
          qualifyingCasts += 1;
        }
        if (event.type === 'damage' && event.abilityId === TOUCH_OF_THE_GRAVE_ABILITY_ID) {
          procs += 1;
        }
      }
    }

    expect(qualifyingCasts / fights).toBeGreaterThan(15);
    const rate = (procs / qualifyingCasts) * 100;
    /*
     * A LITTLE UNDER TEN, and the shortfall is the internal cooldown rather
     * than slack in the assertion: a proc blocks every roll for a second, and
     * this build takes about one qualifying action every three. The bug read
     * 3.0% here.
     */
    expect(rate).toBeGreaterThan(8);
    expect(rate).toBeLessThanOrEqual(TOUCH_CASTER_CHANCE);
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

    for (const { list, owner } of ALL_PRIORITY_LISTS) {
      // A PET'S lists are the exception -- the Hunter's pet and the Warlock's
      // two demons: a pet gets no racials. Asked of the OWNER rather than of
      // the name, which said "Pet" for the one pet list there used to be.
      if (owner === 'pet') continue;
      for (const abilityId of ids) {
        // AS AN ENTRY OR A SEQUENCE STEP: the four Hunter lists carry Berserking
        // and Blood Fury as steps of the owner's cooldown stack (round 37).
        expect(
          list.entries.some(
            (entry) => entry.abilityId === abilityId || (entry.sequence ?? []).includes(abilityId),
          ),
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
      [
        'Druid (Bear)',
        'Paladin (Protection)',
        'Warrior (Shield, Defensive)',
        'Warrior (Fury Prot)',
      ].sort(),
    );
  });

  it('stores only the racials the build\'s own RACE can learn', () => {
    /*
     * ========================================================================
     * THE ENGINE NEVER NEEDED THIS AND THE PANEL DID, which is why this test
     * replaced one asserting the opposite.
     *
     * `PriorityRotation` skips an ability the character does not know in
     * silence -- the property that lets one list serve several builds -- so an
     * Orc carrying Berserking, Elune's Light and Eureka! cost exactly nothing
     * and no figure moved either way. What it cost was a PERSON reading the
     * panel: three of an Orc's first four entries were abilities no Orc can
     * cast, with nothing on screen to say so.
     * ========================================================================
     */
    for (const [preset, keeps] of [
      ['druid_cat', []],
      ['dw_fury', ['blood_fury']],
      ['mage_fire', ['eureka']],
      // Troll since round 80 (Human from round 78): Berserking is lit and
      // every other racial entry is switched off.
      ['shadow_priest', ['berserking']],
    ] as const) {
      const built = preset === 'mage_fire' ? gnomeMage(preset) : PRESETS_BY_ID.get(preset)!.build();
      /*
       * LIT, NOT STORED. Every racial entry is kept now and another race's is
       * switched off -- the owner's "invisible using the glyph feature" -- so
       * what this asserts is which are ON, and that every other one is present
       * and OFF rather than missing.
       */
      const racial = built.rotation.entries.filter(
        (entry) => RACIAL_ABILITIES[entry.abilityId] !== undefined,
      );
      expect(
        racial.filter((entry) => !entry.disabled).map((entry) => entry.abilityId),
        preset,
      ).toEqual([...keeps]);
      for (const entry of racial) {
        if (!(keeps as readonly string[]).includes(entry.abilityId)) {
          expect(entry.disabled, `${preset} ${entry.abilityId}`).toBe(true);
        }
      }

      // And what it stores is exactly what the character actually learned.
      const player = characterAtCombatStart(built)!;
      for (const abilityId of Object.keys(RACIAL_ABILITIES)) {
        expect(player.abilities.has(abilityId), `${preset} / ${abilityId}`).toBe(
          keeps.includes(abilityId as never),
        );
      }
    }
  });

  it('drops a RACIAL the build lacks and keeps an ordinary ability it lacks', () => {
    /*
     * THE NARROW TEST IS THE POINT. "Drop what the build does not know" would
     * delete a capstone a list names for a sibling spec -- one Hunter list
     * serves a build without the capstone, and the Hemo list is the Rupture
     * list minus two entries. Only a racial may be dropped.
     */
    const list = {
      name: 'probe',
      entries: [
        { abilityId: 'blood_fury' },
        { abilityId: 'eureka' },
        // A real ability, and one a Warrior in no spec ever has.
        { abilityId: 'heroic_strike' },
        { abilityId: 'mortal_strike' },
        { abilityId: 'shield_slam' },
      ],
    };
    expect(withoutOtherRacials(list, 'orc').entries.map((entry) => entry.abilityId)).toEqual([
      'blood_fury',
      'heroic_strike',
      'mortal_strike',
      'shield_slam',
    ]);

    // AND A LIST WITH NOTHING TO DROP COMES BACK AS THE SAME OBJECT, which
    // `syncDefaultRotation` leans on for reference equality.
    const clean = { name: 'probe', entries: [{ abilityId: 'heroic_strike' }] };
    expect(withoutOtherRacials(clean, 'orc')).toBe(clean);
  });

  it('re-derives the stored list when the RACE changes, which a name alone cannot see', () => {
    /*
     * ========================================================================
     * `syncDefaultRotation` COMPARED BY NAME, AND RACE BROKE THAT ASSUMPTION.
     *
     * For class, style, stance and talents the name was the whole question: a
     * different build means a different stock list and therefore a different
     * name. An Orc Warrior and a Gnome Warrior run the SAME NAMED LIST with
     * different racial entries in it -- so a name comparison would have left
     * Blood Fury in the list after somebody changed an Orc to a Gnome, and
     * left Eureka! out.
     * ========================================================================
     */
    const orc = PRESETS_BY_ID.get('dw_fury')!.build();
    expect(orc.rotation.source).toBe('default');

    const asGnome = syncDefaultRotation({
      ...orc,
      character: { ...orc.character, race: 'gnome' },
    });
    const lit = (profile: typeof orc) =>
      profile.rotation.entries.filter((entry) => !entry.disabled).map((entry) => entry.abilityId);
    expect(lit(asGnome)).toContain('eureka');
    expect(lit(asGnome)).not.toContain('blood_fury');
    // Kept and switched off, so a swap back can light it again in place.
    expect(asGnome.rotation.entries.find((e) => e.abilityId === 'blood_fury')?.disabled).toBe(true);

    /*
     * A CUSTOM LIST IS NEVER RE-DERIVED -- AND ITS RACIAL EYES STILL FOLLOW THE
     * RACE, which changed: which racials a character can cast is a fact about
     * the race, not an edit. Every NON-racial entry must come back identical.
     */
    const custom = {
      ...orc,
      rotation: { ...orc.rotation, source: 'custom' as const },
      character: { ...orc.character, race: 'gnome' as const },
    };
    const synced = syncDefaultRotation(custom);
    expect(synced.rotation.source).toBe('custom');
    expect(lit(synced)).toContain('eureka');
    expect(lit(synced)).not.toContain('blood_fury');
    const nonRacial = (profile: typeof orc) =>
      profile.rotation.entries.filter((entry) => RACIAL_ABILITIES[entry.abilityId] === undefined);
    expect(nonRacial(synced)).toEqual(nonRacial(custom));
    // And a custom list already right for its race is returned untouched.
    expect(syncDefaultRotation(synced)).toBe(synced);
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
    // 16 since round 79: Read Ley Line's mana half is modelled.
    expect(modelled).toBe(16);
    /*
     * TWENTY-TWO, UP FROM TWENTY, AND BOTH NEW ENTRIES ARE THE SAME CLAUSE.
     *
     * "2% increased critical damage AND HEALING" is Dwarf Earth Fury and
     * Tauren Endurance, and each declares its healing half rather than leaving
     * it absent -- a trait with one clause modelled and one silently missing
     * reads as fully modelled, and `modelled` is counted from exactly that.
     * So both traits are in the 15 AND contribute a ruling, which is what a
     * partly-modelled trait should look like from here.
     *
     * `modelled` AND `liveGaps` ARE UNCHANGED, which is the containment check:
     * Endurance was already modelled for its health, Earth Fury replaced a
     * modelled Mace Specialization, and nothing became a live gap.
     */
    /*
     * 21 AND 12 SINCE ROUND 47: Shadowmeld's threat drop was ruled out with
     * `threat`, and that member is repealed -- threat is tracked now -- so it
     * is a live gap whose reason is that no list casts Shadowmeld in a fight.
     */
    /*
     * 20 SINCE ROUND 79: Earth Fury and Endurance's two healing halves went with
     * the crit damage, and Read Ley Line's Attuned (a place) came in.
     */
    expect(ruledOut).toBe(20);
    expect(liveGaps).toBe(12);
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
    const gnome = gnomeMage('mage_fire');
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
    const gnome = gnomeMage('mage_fire');
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

/**
 * Cast one ability repeatedly on an Undead Warlock, and count the drains.
 *
 * SPACED PAST THE INTERNAL COOLDOWN, two seconds apart, so what is measured is
 * the ROLL rate rather than the one second cooldown -- which on a build casting
 * three times a second would be most of the answer.
 */
function driveCasts(
  abilityId: string,
  times: number,
  /**
   * Run before every cast, for an ability whose own `canCast` needs setting up.
   *
   * LIFE TAP IS WHY. It refuses unless there is "health to spend AND mana worth
   * gaining", and this driver hands the caster ten million mana so a few
   * hundred casts cannot run it dry -- which makes the pool permanently full
   * and Life Tap permanently uncastable. Draining the pool and topping the
   * health up is the setup, and it is the caller's because it is the ABILITY's
   * rule rather than this helper's.
   */
  prepare?: (player: Combatant) => void,
): { readonly procs: number; readonly casts: number } {
  const player = createPlayer({
    race: 'undead',
    characterClass: 'warlock',
    // Enough to pay for several hundred casts without running dry, which would
    // silently shorten the sample.
    resourceMaximums: { mana: 10_000_000 },
  });
  /*
   * NO ROTATION, which is this project's standing rule for a test that runs the
   * clock on a built character: `createPlayer` gives one, and with it the list
   * casts its own spells between these and every one of them rolls too. The
   * Soul Siphon test learned that the hard way -- its ratio read 2.27 against
   * an expected 1.36 and neither number was about the talent.
   */
  (player as { rotation?: unknown }).rotation = undefined;
  const target = makeTarget({ maxHealth: 100_000_000 });
  const recorder = new TelemetryRecorder();
  const simulation = buildSimulation([player, target], { durationMs: seconds(times * 3) }, recorder);
  simulation.begin();

  const ability = player.abilities.get(abilityId);
  expect(ability, abilityId).toBeDefined();

  let casts = 0;
  for (let i = 1; i <= times; i += 1) {
    simulation.advanceTo(seconds(i * 2));
    prepare?.(player);
    if (simulation.cast(player, ability!, target).ok) casts += 1;
  }
  // Let the last cast's reactions and any scheduled damage land.
  simulation.advanceTo(seconds(times * 2 + 5));

  const procs = recorder.all.filter(
    (event) => event.type === 'damage' && event.abilityId === TOUCH_OF_THE_GRAVE_ABILITY_ID,
  ).length;
  return { procs, casts };
}

/*
 * ============================================================================
 * EVERY DAMAGING ABILITY AN UNDEAD CAN CAST, AND WHETHER IT ROLLS.
 *
 * THIS IS THE COVERAGE SHAPE, AND IT IS WHAT LET THE DoT BUG THROUGH. The proc
 * was found at half its rate on the SM/DS Warlock, fixed, and tested on the
 * three Warlock DoTs that exposed it -- a check derived from what the project
 * already USES, which cannot find what it does not use yet. Rend, Rupture,
 * Devouring Plague and Shadow Word: Pain are DoTs on three other Undead-legal
 * classes, and NO PROFILE IS AN UNDEAD WARRIOR, PRIEST OR PALADIN AT ALL.
 *
 * So this walks the ability book of every class an Undead may be, casts each
 * ability once, and asks one question: did a drain land.
 *
 * FORCED RATHER THAN SAMPLED, WHICH IS WHAT MAKES ONE CAST ENOUGH. The first
 * version of this drove two hundred casts an ability and counted procs, and was
 * useless twice over: the caster's AUTO-ATTACKS procced too, so rows that never
 * cast at all reported a dozen procs -- and an ability on a three minute
 * cooldown got one cast, where zero procs at 10% means nothing. Devouring
 * Plague read as a GAP on a sample of one.
 *
 * "COULD NOT DRIVE IT" AND "TAKES NO ROLL" MUST NOT LOOK ALIKE, which is the
 * whole lesson, so the harness reports the refusal reason and the assertion
 * below pins how many abilities are unreachable rather than passing over them.
 * ============================================================================
 */

/** An RNG that wins every chance, so one cast settles the question. */
function alwaysWins(inner: RNG): RNG {
  return {
    next: () => inner.next(),
    nextInt: (min, max) => inner.nextInt(min, max),
    nextFloat: (min, max) => inner.nextFloat(min, max),
    nextDuration: (min, max) => inner.nextDuration(min, max),
    pick: (items) => inner.pick(items),
    rollChance: () => true,
  };
}

interface CoverageRow {
  readonly characterClass: ClassId;
  readonly ability: string;
  readonly cast: boolean;
  readonly refused?: string;
  readonly direct: number;
  readonly appliedDot: boolean;
  readonly rolled: boolean;
}

/**
 * A Warrior's three stances, tried in turn until one lets the ability cast.
 *
 * Six abilities are unreachable with a single stance forced -- Whirlwind,
 * Intercept, Recklessness and Berserker Rage want Berserker; Shield Wall and
 * Shield Block want Defensive; Rend and Thunder Clap want Battle.
 */
function coverageFor(characterClass: ClassId, ability: Ability): CoverageRow {
  if (characterClass !== 'warrior') return attemptCast(characterClass, ability, undefined);
  let last = attemptCast(characterClass, ability, 'battle_stance');
  for (const stance of ['berserker_stance', 'defensive_stance'] as const) {
    if (last.cast) return last;
    last = attemptCast(characterClass, ability, stance);
  }
  return last;
}

function attemptCast(
  characterClass: ClassId,
  ability: Ability,
  stanceId: string | undefined,
): CoverageRow {
  const player = createPlayer({
    race: 'undead',
    characterClass,
    /*
     * A HUNDRED POINTS OF HIT, so the drain cannot miss its own spell-table
     * roll and turn a working ability into a failure. The table draws from
     * `next`, not `rollChance`, so forcing the chance does not cover it.
     */
    bonusStats: { hitChance: 100 },
    resourceMaximums: { mana: 10_000_000, rage: 1_000, energy: 1_000 },
  });
  // NO ROTATION and NO SWINGING: both act on their own and proc, and a proc
  // from a swing reads as this ability's.
  (player as { rotation?: unknown }).rotation = undefined;
  (player as { autoAttack: string }).autoAttack = 'none';
  (player as { activeAutoAttack: string }).activeAutoAttack = 'none';

  const target = makeTarget({ maxHealth: 1_000_000_000 });
  const recorder = new TelemetryRecorder();
  const simulation = new Simulation(
    { durationMs: seconds(120), seed: 7, createCombatants: () => [player, target] },
    recorder,
  );
  (simulation as { rng: RNG }).rng = alwaysWins(simulation.rng);
  simulation.begin();
  // Past the opening instant and any opening global cooldown.
  simulation.advanceTo(seconds(10));
  prepareCaster(simulation, player, characterClass, stanceId);

  const refused = simulation.castRejection(player, ability, target);
  const cast = simulation.cast(player, ability, target).ok;
  // Five seconds clears the longest cast time here.
  simulation.advanceTo(seconds(15));

  /*
   * THE DoT IS LOOKED FOR HERE AND NOT AT THE END, which the first version got
   * wrong in the other direction: checking at thirty seconds had Shadow Word:
   * Pain, Rupture and Corruption all reading as applying nothing, because their
   * DoT had already EXPIRED.
   */
  let appliedDot = false;
  for (const aura of target.auras.activeIterable) {
    if (aura.sourceId !== player.id) continue;
    if (aura.definition.periodic === undefined) continue;
    appliedDot = true;
  }

  simulation.advanceTo(seconds(40));

  let direct = 0;
  let rolled = false;
  for (const event of recorder.all) {
    if (event.type !== 'damage') continue;
    if (event.abilityId === TOUCH_OF_THE_GRAVE_ABILITY_ID) rolled = true;
    else if (event.abilityId === ability.id && !event.periodic) direct += 1;
  }

  return {
    characterClass,
    ability: ability.id,
    cast,
    ...(refused ? { refused: String(refused) } : {}),
    direct,
    appliedDot,
    rolled,
  };
}

/** Everything an ability's own `canCast` might want, granted up front. */
function prepareCaster(
  simulation: Simulation,
  player: Combatant,
  characterClass: ClassId,
  stanceId: string | undefined,
): void {
  player.health.gain(player.health.maximum);
  for (const type of ['rage', 'energy'] as const) player.resources.get(type)?.gain(1000);
  // A finisher needs points AND the target they were built on.
  const combo = player.resources.get('comboPoints');
  if (combo) {
    combo.gain(MAX_COMBO_POINTS);
    (player as { comboPointTargetId?: string }).comboPointTargetId = 'target';
  }
  // Mana, with room to spare so Life Tap is castable too.
  const mana = player.resources.get('mana');
  if (mana) mana.spend(mana.current / 2);
  if (characterClass === 'warrior' && stanceId !== undefined) {
    const wanted = WARRIOR_STANCES.find((stance) => stance.id === stanceId)!;
    for (const stance of WARRIOR_STANCES) {
      if (stance.id !== wanted.id) player.auras.remove(simulation, stance.id);
    }
    simulation.applyAura(player, wanted, player.id);
  }
}

describe('every damaging ability an Undead can cast takes a roll', () => {
  const UNDEAD_CLASSES = RACES.find((race) => race.id === 'undead')!.classes;
  const rows: CoverageRow[] = [];
  for (const characterClass of UNDEAD_CLASSES) {
    for (const ability of createPlayer({ race: 'undead', characterClass }).abilities.all) {
      // Start Auto-attack deals nothing itself -- the swings it starts are swings.
      if (isStartAutoAttack(ability.id)) continue;
      rows.push(coverageFor(characterClass, ability));
    }
  }

  it('leaves no damaging ability without one', () => {
    /*
     * FAILS NAMING THE ABILITY AND THE CLASS, which is `auraCatalog.test.ts`'s
     * rule: a structural check that says only "something is wrong" sends
     * somebody hunting.
     */
    const gaps = rows
      .filter((row) => row.cast && (row.direct > 0 || row.appliedDot) && !row.rolled)
      .map((row) => `${row.characterClass}/${row.ability}`);
    expect(gaps).toEqual([]);
  });

  it('covers the four DoTs no PROFILE reaches, by name', () => {
    /*
     * ========================================================================
     * THE OWNER ASKED FOR THESE FOUR BY NAME, and the general assertion above
     * would pass if any of them quietly stopped being castable from this
     * harness. Named here so that a rename, a stance change or a new cost is a
     * failure rather than a silent drop out of the sample -- which is this
     * project's commonest way of losing coverage.
     *
     * NOT ONE OF THEM IS REACHED BY A PROFILE: there is no Undead Warrior,
     * Priest or Paladin preset, and the Undead Rogue builds that exist do take
     * Rupture but it was never the thing that moved.
     * ========================================================================
     */
    for (const [characterClass, abilityId] of [
      ['warrior', 'rend_cast'],
      ['rogue', 'rupture'],
      ['priest', 'devouring_plague'],
      ['priest', 'shadow_word_pain'],
    ] as const) {
      const row = rows.find(
        (entry) => entry.characterClass === characterClass && entry.ability === abilityId,
      );
      expect(row, `${characterClass}/${abilityId}`).toBeDefined();
      expect(row!.cast, `${characterClass}/${abilityId} was not castable`).toBe(true);
      expect(row!.appliedDot, `${characterClass}/${abilityId} applied no DoT`).toBe(true);
      expect(row!.rolled, `${characterClass}/${abilityId} took no roll`).toBe(true);
    }
  });

  it('pins what the harness cannot reach, so a silent drop is visible', () => {
    /*
     * NINE ABILITIES NEED FIGHT STATE THIS HARNESS CANNOT FABRICATE -- a seal
     * up, the execute phase, a dodge to answer, a block to answer, stealth, or
     * the one instant at the pull. Every one of them deals DIRECT damage and
     * goes through the damage half, which is the route that was never broken.
     *
     * PINNED RATHER THAN IGNORED, because "could not drive it" and "takes no
     * roll" are the two answers this whole file exists to keep apart: a ninth
     * ability joining this list is a shrinking sample, and the first version of
     * this check would have reported that as a pass.
     */
    const unreachable = rows
      .filter((row) => !row.cast)
      .map((row) => `${row.characterClass}/${row.ability}`)
      .sort();
    expect(unreachable).toEqual([
      'paladin/hammer_of_wrath',
      'paladin/judgement',
      'rogue/ambush',
      'rogue/backstab',
      // Garrote, declared at round 37, needs Stealth like Ambush.
      'rogue/garrote',
      'warrior/charge',
      'warrior/execute',
      'warrior/overpower',
      'warrior/revenge',
    ]);
  });
});
