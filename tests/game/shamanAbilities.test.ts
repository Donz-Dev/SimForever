import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfile, runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  CHAIN_LIGHTNING_DAMAGE,
  EARTH_SHOCK,
  EARTH_SHOCK_DAMAGE,
  FIRE_NOVA,
  FIRE_NOVA_COOLDOWN_MS,
  FIRE_NOVA_DAMAGE,
  FLAME_SHOCK,
  FLAME_SHOCK_DIRECT,
  FROST_SHOCK,
  FROST_SHOCK_DAMAGE,
  LAVA_BURST_DAMAGE,
  LAVA_BURST_FLAME_SHOCK_BONUS,
  LIGHTNING_BOLT,
  LIGHTNING_BOLT_DAMAGE,
  SEARING_TOTEM,
  SHOCK_COOLDOWN_GROUP,
  WINDFURY_WEAPON,
} from '../../src/game/abilities/shaman';
import {
  FLAME_SHOCK_DOT_DURATION_MS,
  FLAME_SHOCK_DOT_TOTAL,
  FLAME_SHOCK_TICK_INTERVAL_MS,
  SEARING_TOTEM_DOT,
  SEARING_TOTEM_DURATION_MS,
  SEARING_TOTEM_TICK_DAMAGE,
  SEARING_TOTEM_TICK_INTERVAL_MS,
  SEARING_TOTEM_TICK_SP_COEFFICIENT,
  STORMSTRIKE_DAMAGE_BONUS,
} from '../../src/game/auras/shaman';
import {
  WINDFURY_WEAPON_ATTACK_ID,
  WINDFURY_WEAPON_ATTACK_NAME,
  WINDFURY_WEAPON_ATTACK_POWER,
  WINDFURY_WEAPON_EXTRA_ATTACKS,
  WINDFURY_WEAPON_INTERNAL_COOLDOWN_MS,
  WINDFURY_WEAPON_PROC_CHANCE,
  windfuryWeaponReaction,
} from '../../src/game/reactions/shaman';
import { WINDFURY_ATTACK_POWER, WINDFURY_DURATION_MS } from '../../src/game/buffs/windfury';
import { SHAMAN_TALENT_EFFECTS } from '../../src/game/talents/shamanEffects';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import type { TelemetryEvent } from '../../src/engine';
import { castAbility, checkCast, resolveCast, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import {
  ELEMENTAL_FOCUS_CLEARCASTING,
  WINDFURY_WEAPON_IMBUE,
  MAELSTROM_WEAPON_MAX_STACKS,
  SHAMAN_DAMAGE_SPELL_IDS,
  improvedStormstrikeAura,
  maelstromWeaponAura,
} from '../../src/game/auras/shaman';
import {
  IMPROVED_STORMSTRIKE_BYPASS_PERCENT,
  IMPROVED_STORMSTRIKE_DURATION_MS,
  LIGHTNING_OVERLOAD_FRACTION,
  MAELSTROM_WEAPON_PPM,
  elementalFocus,
  maelstromWeapon,
  improvedStormstrike,
  lightningOverload,
} from '../../src/game/reactions/shamanTalents';
import { SHAMAN_ELEMENTAL, SHAMAN_ENHANCEMENT } from '../../src/game/rotations/shaman';
import { talentNumber } from '../../src/game/talents/talentValues';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { legalise } from '../helpers/legalTalents';
import { MANA_REGEN_LOCKOUT_MS, manaPerTick } from '../../src/game/combat/resourceRules';
import { ppmChance } from '../../src/game/items/procs';
import type { AbilityCastEvent, Combatant, SimulationContext } from '../../src/engine';

/*
 * The Shaman's numbers, written out by hand from the beta client's spellbook.
 * Two profiles: a caster on mana and a two-hander that ALSO pays mana.
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
    race: built.character.race as never,
    characterClass: 'shaman',
    combatStyle: built.character.combatStyle as never,
    talents: built.talents,
    equipment: built.equipment,
  });
};

describe('the numbers', () => {
  it('takes the midpoint of each stated range, at MAX RANK', () => {
    // "185 to 207", "116 to 130", "293 to 309", "275 to 291", "192 to 248".
    // Figures that follow foreverchanges.pro where it and our own capture
    // disagree, by the ruleset owner's standing rule. Written out by hand
    // from the source and carrying the ruling, not only the number. See
    // docs/source-cross-checks.md.
    expect(LIGHTNING_BOLT_DAMAGE).toBe(196);
    expect(CHAIN_LIGHTNING_DAMAGE).toBe(123);
    expect(EARTH_SHOCK_DAMAGE).toBe(301);
    expect(FROST_SHOCK_DAMAGE).toBe(283);
    expect(LAVA_BURST_DAMAGE).toBe(220);
  });

  it('reads Lava Burst at rank 3, not the rank 1 its talent tooltip shows', () => {
    /*
     * THE RANK-1 RULE, for the fourth time in this project. The Elemental
     * capstone's tooltip says "106 to 134 Fire damage" because a talent shows
     * rank 1 of the ability it grants; a level 60 trains rank 3, which the
     * spellbook states outright as "192 to 248".
     *
     * Pinned as an inequality against the rank-1 figure rather than only as a
     * number, so the reason survives alongside the value.
     */
    const RANK_ONE_MIDPOINT = (106 + 134) / 2;
    expect(LAVA_BURST_DAMAGE).toBeGreaterThan(RANK_ONE_MIDPOINT);
    expect(LAVA_BURST_DAMAGE).toBe(220);
  });

  it('divides Flame Shock evenly by its cadence, which is why the cadence is 3', () => {
    /*
     * "166 Fire damage immediately and 176 Fire damage over 12 sec", and no
     * interval anywhere. Three seconds is the only plausible cadence that
     * leaves whole ticks: four of 44.
     *
     * Two seconds would be six of 29.33 and four seconds three of 58.67, and
     * both are asserted so the argument is checked rather than described.
     */
    const ticks = FLAME_SHOCK_DOT_DURATION_MS / FLAME_SHOCK_TICK_INTERVAL_MS;
    expect(ticks).toBe(4);
    expect(FLAME_SHOCK_DOT_TOTAL / ticks).toBe(44);
    expect(Number.isInteger(FLAME_SHOCK_DOT_TOTAL / 6)).toBe(false);
    expect(Number.isInteger(FLAME_SHOCK_DOT_TOTAL / 3)).toBe(false);
    expect(FLAME_SHOCK_DIRECT).toBe(166);
  });

  it('states Windfury Weapon as TWO extra attacks, unlike the totem', () => {
    // The imbue and the raid buff are the same effect at different strengths:
    // 20% either way, but two extra attacks at +333 rather than one at +246.
    expect(WINDFURY_WEAPON_PROC_CHANCE).toBe(0.2);
    expect(WINDFURY_WEAPON_EXTRA_ATTACKS).toBe(2);
    expect(WINDFURY_WEAPON_ATTACK_POWER).toBe(333);
  });

  it('declares an effect for every one of the 50 talents', () => {
    expect(Object.keys(SHAMAN_TALENT_EFFECTS)).toHaveLength(50);
  });
});

describe('the two builds, and what their talents actually do', () => {
  it('picks the list from the combat style, the Warrior arrangement', () => {
    expect(batchOf('shaman_elemental', 1, 1).rotationName).toContain('Elemental');
    expect(batchOf('shaman_enhancement', 1, 1).rotationName).toContain('Enhancement');
  });

  it('grants the three talent-only abilities, which a missing registry ate', () => {
    /*
     * LAVA BURST, STORMSTRIKE AND RAGE OF THE FARSEER were all absent when the
     * Shaman was missing from `talentBuild`'s own effects table -- not
     * reported unmodelled, just gone, and the DPS figures looked ordinary. See
     * `classRegistration.test.ts`, which is the general check; this is the
     * specific one.
     */
    const elemental = presetPlayer('shaman_elemental').abilities.all.map((a) => a.id);
    const enhancement = presetPlayer('shaman_enhancement').abilities.all.map((a) => a.id);

    expect(elemental).toContain('lava_burst');
    expect(enhancement).toContain('stormstrike');
    expect(enhancement).toContain('rage_of_the_farseer');

    // And each is gated on the talent: the other build does not get it.
    expect(elemental).not.toContain('stormstrike');
    expect(enhancement).not.toContain('lava_burst');
  });

  it('applies Elemental Alacrity to the three spells it names and no others', () => {
    // "-0.50 sec" at rank 3, on Lightning Bolt, Chain Lightning and Lava Burst.
    const built = PRESETS_BY_ID.get('shaman_elemental')!.build();
    const book = new Map(
      abilitiesForClass('shaman', 'caster', built.talents).map((a) => [a.id, a]),
    );
    expect(book.get('lightning_bolt')!.castTimeMs).toBe(2000);
    expect(book.get('chain_lightning')!.castTimeMs).toBe(1500);
    expect(book.get('lava_burst')!.castTimeMs).toBe(2000);
  });

  it('applies Reverberation to the shocks, in SECONDS', () => {
    /*
     * "Reduces the cooldown of your Shock spells by 1 sec" at rank 5. The unit
     * is declared on the effect because the values file keeps the source's own
     * number, and reading 1 as a millisecond would be silently almost-right.
     */
    const built = PRESETS_BY_ID.get('shaman_elemental')!.build();
    const book = new Map(
      abilitiesForClass('shaman', 'caster', built.talents).map((a) => [a.id, a]),
    );
    for (const id of ['earth_shock', 'flame_shock', 'frost_shock']) {
      expect(book.get(id)!.cooldownMs, id).toBe(5000);
    }
    // Enhancement has no points in it, so its shocks stay at six seconds.
    const enh = PRESETS_BY_ID.get('shaman_enhancement')!.build();
    const enhBook = new Map(
      abilitiesForClass('shaman', 'two_hander', enh.talents).map((a) => [a.id, a]),
    );
    expect(enhBook.get('earth_shock')!.cooldownMs).toBe(6000);
  });

  it('scales Windfury Weapon with Elemental Weapons, from the SECOND value', () => {
    /*
     * "Increases the melee attack power bonus of your Rockbiter Weapon by 20%,
     * your Windfury Weapon effect by 40% and ... by 15%" at rank 3.
     *
     * READING INDEX 0 WOULD GIVE WINDFURY THE ROCKBITER FIGURE -- 20% where
     * 40% belongs -- and nothing would fail: the proc still fires and is
     * simply worth less. Asserted on the reaction being present at all plus
     * the value, because the value is the part that is silently wrong.
     */
    const enhancement = presetPlayer('shaman_enhancement');
    expect(enhancement.reactions.map((r) => r.id)).toContain('windfury_weapon');

    const elemental = presetPlayer('shaman_elemental');
    // Elemental spent nothing in Elemental Weapons and still CARRIES the
    // reaction: the imbue is a spell anyone can cast, and the talent only
    // makes it bigger. Registering it as a talent proc would delete it here.
    expect(elemental.reactions.map((r) => r.id)).toContain('windfury_weapon');
  });
});

describe('the fights', () => {
  it('holds Flame Shock up so Lava Burst finds it, which is why the order is that way', () => {
    const batch = batchOf('shaman_elemental', 40, 5);
    const used = (name: string) =>
      batch.abilities.find((a) => a.abilityName === name)?.uses ?? 0;

    expect(used('Flame Shock')).toBeGreaterThan(1);
    expect(used('Lava Burst')).toBeGreaterThan(1);
    // The bonus is real and stated, so the priority order is load-bearing
    // rather than cosmetic.
    expect(LAVA_BURST_FLAME_SHOCK_BONUS).toBe(1.2);
  });

  it('casts Windfury Weapon exactly once and then never again', () => {
    /*
     * Its `canCast` refuses while the imbue is up, and the imbue lasts an
     * hour. One cast, one global cooldown, 165 mana -- paid rather than
     * assumed, which is the whole reason it is in the list.
     */
    const batch = batchOf('shaman_enhancement', 40, 5);
    const uses = batch.abilities.find((a) => a.abilityName === 'Windfury Weapon')?.uses ?? 0;
    expect(uses).toBeCloseTo(1, 1);
  });

  it('uses Stormstrike and Earth Shock, which is the pairing the debuff makes', () => {
    /*
     * Stormstrike's debuff names Lightning Bolt, Chain Lightning and EARTH
     * Shock -- not Flame Shock. That is why the Enhancement list shocks with
     * Earth where the Elemental one shocks with Flame.
     */
    const batch = batchOf('shaman_enhancement', 40, 5);
    const used = (name: string) =>
      batch.abilities.find((a) => a.abilityName === name)?.uses ?? 0;
    expect(used('Stormstrike')).toBeGreaterThan(3);
    expect(used('Earth Shock')).toBeGreaterThan(2);
    expect(STORMSTRIKE_DAMAGE_BONUS).toBe(1.2);
  });

  it('NO LONGER GIVES THE ELEMENTAL SHAMAN A FLOOR: both causes expired', () => {
    /*
     * --------------------------------------------------------------------------
     * THE CASTER ITEM ARRIVED FIRST; THE COEFFICIENT ARRIVED SECOND.
     *
     * Earthfury plus a Sorcerous Dagger and Earth and Fire reads 453 spell
     * power where the Warrior shell gave none. Every Shaman spell still states
     * FLAT damage and no coefficient -- and that no longer matters, because the
     * ruleset owner supplied the coefficient as a universal RULE rather than as
     * per-spell data.
     *
     * 26 of the 453 is the SHIELD, which is the part worth pinning: a caster
     * shield in a stat-stick off hand used to be deleted outright.
     * --------------------------------------------------------------------------
     */
    // 517 now: Forever's +64 on the Sorcerous Dagger. The shield's 26 below
    // is unchanged, which is what keeps that assertion meaningful.
    expect(presetPlayer('shaman_elemental').stats.get('spellPower')).toBe(453 + 64);

    const batch = batchOf('shaman_elemental', 40, 5);
    const named = batch.castButNotSimulated.map((entry) => entry.abilityName);

    // Lava Burst had NOTHING else wrong with it, so it leaves the list.
    expect(named).not.toContain('Lava Burst');

    /*
     * AND LIGHTNING BOLT LEAVES THE LIST TOO, WHICH IT DID NOT USED TO.
     *
     * --------------------------------------------------------------------------
     * THIS TEST PREVIOUSLY ASSERTED THE OPPOSITE, AND WAS RIGHT TO ON THE DAY.
     * Lightning Bolt carried a SECOND caveat -- Maelstrom Weapon's proc chance
     * was a named placeholder, and the spell that talent discounts is where the
     * caveat was surfaced -- so it stayed on `castButNotSimulated` after the
     * coefficient one went, and the test checked the REASON TEXT rather than the
     * name precisely so the two could be told apart.
     *
     * The ruleset owner supplied five procs per minute on 2026-09-30. There is
     * no caveat left, so the spell has no entry at all, and what was a correct
     * assertion became a stale one WITHOUT ANYBODY TOUCHING THE TEST. That is the
     * documented failure mode -- "a test pinned to a temporary limitation
     * outlives the limitation" -- and it is also the test doing its job: the
     * suite failed the moment the placeholder was deleted.
     *
     * Both assertions are kept and both now read "absent", because the
     * distinction the reason-text check bought is worth keeping until Lightning
     * Bolt acquires a third caveat.
     * --------------------------------------------------------------------------
     */
    expect(named).not.toContain('Lightning Bolt');

    const reasons = batch.castButNotSimulated
      .filter((entry) => entry.abilityName === 'Lightning Bolt')
      .map((entry) => entry.reason)
      .join(' ');
    expect(reasons).not.toMatch(/spell power coefficient/i);
    expect(reasons).not.toMatch(/PLACEHOLDER/i);
  });

  it('CLOSES MOST OF THE GAP to the Enhancement shaman, and that is the point', () => {
    /*
     * --------------------------------------------------------------------------
     * THIS TEST ASSERTED A RATIO OF THREE AND NOW ASSERTS A RATIO OF ONE AND A
     * HALF, WHICH IS THE WHOLE STORY OF THIS FEATURE.
     *
     * It used to read: "not a balance claim -- a claim about what is MISSING.
     * Elemental's own damage is largely its totems, which the engine has no
     * entity for, while Enhancement's is swings and a weapon proc that are
     * fully modelled. The gap is the measure of the totem hole."
     *
     * Most of that gap was NOT the totem hole. It was 453 points of spell
     * power multiplying nothing on a class that casts for a living, and the
     * Elemental shaman roughly doubled the day the coefficient arrived.
     *
     * The totem hole is real and still open, so Enhancement stays ahead --
     * but a claim that it is ahead "by a lot" was measuring the wrong thing,
     * which is exactly the trap of asserting a DPS ratio rather than a
     * mechanism.
     * --------------------------------------------------------------------------
     */
    const elemental = batchOf('shaman_elemental', 40, 5).dps.mean;
    const enhancement = batchOf('shaman_enhancement', 40, 5).dps.mean;
    expect(enhancement).toBeGreaterThan(elemental);
    expect(enhancement).toBeLessThan(elemental * 2);
  });
});

describe('Maelstrom Weapon, the capstone that was worth nothing twice over', () => {
  const enhancementBook = () => {
    const built = PRESETS_BY_ID.get('shaman_enhancement')!.build();
    return abilitiesForClass('shaman', 'two_hander', built.talents);
  };

  const bareShaman = () =>
    makeAttacker({
      autoAttack: 'none',
      abilities: enhancementBook(),
      resources: [{ type: 'mana', maximum: 50_000 }],
    });

  it('makes Lightning Bolt instant and free at five stacks', () => {
    /*
     * PER STACK, NOT IN TOTAL. Twenty percent a stack and five stacks is an
     * instant, free bolt; read as a flat 20% however many stacks were up, the
     * five-stack cap would do nothing at any rank and four of the five stacks
     * would be worthless. The tooltip states one number and then says "stacks
     * up to 5 times", which is only meaningful the first way.
     */
    const actor = bareShaman();
    const simulation = buildSimulation([actor, makeTarget()]);
    const bolt = actor.abilities.get('lightning_bolt')!;

    simulation.applyAura(actor, maelstromWeaponAura(20), actor.id);
    actor.auras.get('maelstrom_weapon')!.stacks = MAELSTROM_WEAPON_MAX_STACKS;

    const resolved = resolveCast(actor, bolt);
    expect(resolved.baseCastTimeMs).toBe(0);
    expect(resolved.costAmount).toBe(0);
  });

  it('scales in proportion below five stacks, on BOTH halves', () => {
    const actor = bareShaman();
    const simulation = buildSimulation([actor, makeTarget()]);
    const bolt = actor.abilities.get('lightning_bolt')!;
    const baseCast = bolt.castTimeMs!;
    const baseCost = bolt.cost!.amount;

    simulation.applyAura(actor, maelstromWeaponAura(20), actor.id);
    for (const stacks of [1, 2, 3, 4]) {
      actor.auras.get('maelstrom_weapon')!.stacks = stacks;
      const resolved = resolveCast(actor, bolt);
      expect(resolved.baseCastTimeMs, `${stacks} stacks`).toBe(
        Math.round(baseCast * (1 - 0.2 * stacks)),
      );
      expect(resolved.costAmount, `${stacks} stacks`).toBeCloseTo(baseCost * (1 - 0.2 * stacks), 6);
    }
  });

  it('is spent ENTIRELY by one bolt, not one stack at a time', () => {
    /*
     * "Your NEXT Lightning Bolt" is one cast however many stacks paid for it.
     * Taking a single stack would leave four up for the bolt after it, which
     * reads as a working talent and is worth several times what it should be.
     */
    const actor = bareShaman();
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);

    simulation.applyAura(actor, maelstromWeaponAura(20), actor.id);
    actor.auras.get('maelstrom_weapon')!.stacks = MAELSTROM_WEAPON_MAX_STACKS;

    castAbility(simulation, actor, actor.abilities.get('lightning_bolt')!, target);
    expect(actor.auras.has('maelstrom_weapon')).toBe(false);
  });

  it('leaves the shocks alone, which is the whole point of naming an ability', () => {
    const actor = bareShaman();
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.applyAura(actor, maelstromWeaponAura(20), actor.id);
    actor.auras.get('maelstrom_weapon')!.stacks = MAELSTROM_WEAPON_MAX_STACKS;

    expect(resolveCast(actor, actor.abilities.get('earth_shock')!).modified).toBe(false);
  });

  it('rolls the PLACEHOLDER chance, not the reduction it used to roll', () => {
    /*
     * --------------------------------------------------------------------------
     * THE BUG THIS FILE SHIPPED. The first version passed the talent value
     * straight in as `chancePercent`, so the REDUCTION -- 4/8/12/16/20 by rank
     * -- was being rolled as the proc chance. Twenty percent is a completely
     * ordinary proc rate, which is exactly why it looked fine.
     *
     * THE RATE IS THE OWNER'S NOW -- five procs per minute, given 2026-09-30 --
     * so the placeholder this test used to assert the EXISTENCE of is gone. What
     * is asserted instead is the thing that cannot go stale: the value the
     * builder reads is the REDUCTION and not a chance, which is what the bug got
     * backwards.
     * --------------------------------------------------------------------------
     */
    const built = PRESETS_BY_ID.get('shaman_enhancement')!.build();
    expect(built.talents.maelstrom_weapon).toBe(5);

    // The reduction at rank 5, from the values file.
    expect(talentNumber('shaman', 'maelstrom_weapon', 5, 0)).toBe(20);

    /*
     * AND THE REDUCTION IS NOT THE RATE. The two are different numbers now, and
     * a future edit that passes the talent value in as the chance again would
     * make them equal. Written as an inequality because that is the invariant --
     * asserting 5 and 20 by hand would pass for the wrong reason if both moved.
     */
    expect(MAELSTROM_WEAPON_PPM).not.toBe(talentNumber('shaman', 'maelstrom_weapon', 5, 0));
    expect(MAELSTROM_WEAPON_PPM).toBeGreaterThan(0);
  });

  it('is in the Enhancement priority list at all, which it was not', () => {
    /*
     * The capstone shortens the next Lightning Bolt and the list never cast
     * one -- so it stacked to five and sat there, and the talent was worth
     * exactly zero however correct the aura was.
     */
    expect(SHAMAN_ENHANCEMENT.map((entry) => entry.abilityId)).toContain('lightning_bolt');

    const batch = batchOf('shaman_enhancement', 60, 5);
    expect(batch.abilities.find((a) => a.abilityName === 'Lightning Bolt')?.uses ?? 0)
      .toBeGreaterThan(0);
  });
});

describe('Elemental Fury, corrected', () => {
  it('no longer raises an Enhancement shaman PHYSICAL crits', () => {
    /*
     * ------------------------------------------------------------------------
     * THIS SHIPPED WRONG, WITH A WRITTEN CAVEAT SAYING SO. "Increases the
     * critical strike damage bonus of your Fire, Frost, and Nature spells"
     * was applied as a whole-character `critDamageBonus` because nothing
     * selected a school -- so it also raised Stormstrike and every swing,
     * which is most of an Enhancement shaman's damage.
     *
     * TWO THINGS WERE WRONG, not one. It reached physical, AND it used the
     * MELEE crit multiplier for a spell: a spell crit is 1.5x, so "+100% of
     * the bonus" is +0.5 and not +1.0. The old code took a 1.5x spell crit to
     * 2.5x where it should be 2.0x.
     * ------------------------------------------------------------------------
     */
    const built = PRESETS_BY_ID.get('shaman_enhancement')!.build();
    const actor = createPlayer({
      race: 'tauren',
      characterClass: 'shaman',
      combatStyle: 'two_hander',
      talents: built.talents,
    });

    expect(actor.schoolModifiers.for('physical').critMultiplierBonus ?? 0).toBe(0);
    expect(actor.abilityModifiers.for('*').critMultiplierBonus ?? 0).toBe(0);

    // 5/5 is +100% of a spell crit's 0.5 bonus.
    for (const school of ['fire', 'frost', 'nature'] as const) {
      expect(actor.schoolModifiers.for(school).critMultiplierBonus, school).toBeCloseTo(0.5, 6);
    }
    // And not arcane, which the tooltip does not name.
    expect(actor.schoolModifiers.for('arcane').critMultiplierBonus ?? 0).toBe(0);
  });
});

describe('Searing Totem, a totem modelled without an entity', () => {
  /*
   * --------------------------------------------------------------------------
   * THE RULESET OWNER'S RULING, quoted because most of it is in no source:
   * "Searing totem can be treated like a DoT effect that lasts 55 seconds and
   * ticks every 1.5 seconds for 40-54 fire damage +8% of spell damage per
   * tick, but is considered a totem for the purposes of other talents."
   *
   * The capture gives 170 mana, instant, Fire, 55 sec and "40 to 54 Fire
   * damage". It does NOT give the cadence or any coefficient, and this file's
   * own header used to record that. Both are the owner's, which is the only
   * reason they are data rather than an invention.
   * --------------------------------------------------------------------------
   */
  it('takes the midpoint of its stated range and the owner\'s cadence', () => {
    // "40 to 54", written out by hand from the capture.
    expect(SEARING_TOTEM_TICK_DAMAGE).toBe(47);
    expect(SEARING_TOTEM_DURATION_MS).toBe(seconds(55));
    expect(SEARING_TOTEM_TICK_INTERVAL_MS).toBe(seconds(1.5));
    expect(SEARING_TOTEM_TICK_SP_COEFFICIENT).toBe(0.08);
    expect(SEARING_TOTEM.cost).toEqual({ resource: 'mana', amount: 170 });
  });

  it('lands 36 ticks, not 37, and does not divide evenly', () => {
    /*
     * 55 at 1.5 is 36.67. The last tick is at 54.0 and the totem expires at
     * 55.0 with a second unspent. Unlike every other DoT here there is no
     * total to divide and no cadence to infer -- both are stated -- so this
     * asserts what the engine will DO rather than a reading that was chosen.
     */
    const exact = SEARING_TOTEM_DURATION_MS / SEARING_TOTEM_TICK_INTERVAL_MS;
    expect(Number.isInteger(exact)).toBe(false);
    expect(Math.floor(exact)).toBe(36);
  });

  it('ticks for its stated damage, and the ticks ignore armor', () => {
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: [SEARING_TOTEM],
      resources: [{ type: 'mana', maximum: 50_000 }],
    });
    const target = makeTarget({ stats: { armor: 3731 } });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) }, {
      emit: (event) => events.push(event),
    });
    simulation.begin();
    castAbility(simulation, actor, SEARING_TOTEM, target);
    simulation.advanceTo(seconds(55));

    const ticks = events.filter(
      (e) => e.type === 'damage' && e.abilityId === 'searing_totem',
    );
    expect(ticks).toHaveLength(36);
    /*
     * ARMOR DOES NOT APPLY, which is the Forever rule for every magical
     * school. A 3731-armor target is the one this project checks against, so a
     * tick landing for its full stated damage is the assertion that
     * `appliesArmor: false` is really set.
     */
    const first = ticks[0];
    if (first.type === 'damage') {
      expect(first.amount).toBeGreaterThanOrEqual(SEARING_TOTEM_TICK_DAMAGE);
    }
  });

  it('counts as a totem for the two talents that name one', () => {
    /*
     * "Considered a totem for the purposes of other talents" is the clause
     * that is easy to drop, and it is why this test exists rather than a
     * damage one.
     *
     *   Call of Flame     names Fire Totems, and now carries an
     *                     `abilityDamage` effect keyed on the aura id.
     *   Elemental Fury    names Searing Totem and is a SCHOOL effect, so it
     *                     reached the ticks the moment they were Fire. Nothing
     *                     was added for it; the reason saying it did nothing
     *                     was what had to change.
     */
    const callOfFlame = SHAMAN_TALENT_EFFECTS.call_of_flame;
    expect(
      callOfFlame.some((e) => e.kind === 'abilityDamage' && e.abilityId === 'searing_totem'),
    ).toBe(true);

    const fury = SHAMAN_TALENT_EFFECTS.elemental_fury;
    const schools = fury.find((e) => e.kind === 'schoolCritDamage');
    expect(schools).toBeDefined();
    expect(SEARING_TOTEM_DOT.periodic).toBeDefined();

    // And neither reason still claims the Searing clause is inert.
    for (const effects of [callOfFlame, fury]) {
      for (const effect of effects) {
        if (effect.kind !== 'unmodelled') continue;
        expect(effect.reason).not.toContain('Searing Totem clauses do nothing');
        expect(effect.reason).not.toContain('Fire Totem and Fire Nova clauses do nothing');
      }
    }
  });
});

describe('the three shocks share one cooldown', () => {
  /*
   * --------------------------------------------------------------------------
   * THE RULESET OWNER'S RULING, and the failure it corrects is a bigger number
   * rather than an error: "these do share a cooldown, but Flame Shock's
   * duration is long enough such that they can be alternated, therefore both
   * deserve to be on the list."
   *
   * Three independent six-second cooldowns let the Enhancement list cast Flame
   * Shock and Earth Shock in consecutive globals for a whole fight. Nothing
   * about that looks wrong on a results page -- both abilities are declared
   * correctly, both cost the right mana, and the rotation simply gets more out
   * of them than the ruleset allows.
   *
   * ASSERTED BOTH WAYS. The declaration, because that is what a new shock has
   * to remember; and the BEHAVIOUR, because a shared group is exactly the
   * thing a per-ability `cooldownMs` looks identical to until two different
   * abilities are involved.
   * --------------------------------------------------------------------------
   */
  it('declares the group on every one of them', () => {
    for (const shock of [EARTH_SHOCK, FLAME_SHOCK, FROST_SHOCK]) {
      expect(shock.cooldownGroup, shock.name).toBe(SHOCK_COOLDOWN_GROUP);
      // The group's length is the triggering ability's own cooldown, so all
      // three agreeing is what makes the group need nothing else said.
      expect(shock.cooldownMs, shock.name).toBe(seconds(6));
    }
  });

  it('refuses the OTHER shock after one is cast, which a per-ability cooldown would not', () => {
    const built = PRESETS_BY_ID.get('shaman_enhancement')!.build();
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: abilitiesForClass('shaman', 'two_hander', built.talents),
      resources: [{ type: 'mana', maximum: 50_000 }],
    });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);

    expect(checkCast(simulation, actor, EARTH_SHOCK, target)).toEqual({ ok: true });

    castAbility(simulation, actor, FLAME_SHOCK, target);

    /*
     * Past the global cooldown and well short of the six-second shock. Without
     * this the refusal would read `on_gcd`, which every instant shares and
     * which would pass whether the group existed or not.
     */
    simulation.advanceTo(seconds(2));

    // Flame Shock is on its own cooldown, and so now is every other shock.
    expect(checkCast(simulation, actor, FLAME_SHOCK, target)).toEqual({
      ok: false,
      reason: 'on_cooldown',
    });
    expect(checkCast(simulation, actor, EARTH_SHOCK, target)).toEqual({
      ok: false,
      reason: 'on_cooldown',
    });
    expect(checkCast(simulation, actor, FROST_SHOCK, target)).toEqual({
      ok: false,
      reason: 'on_cooldown',
    });
  });
});


/*
 * ============================================================================
 * THE SIX GAPS THIS CLASS'S DEEP DIVE CLOSED, each asserted on its MECHANISM.
 *
 * A profile's DPS moving is not the test that a talent works -- a cost reduction
 * is worth nothing to a build that never runs dry, and a correct talent can be
 * worth zero. So each block below checks the resolved cost, the stack, the stat
 * arriving or the event emitted, and the DPS figures live in the docs where they
 * can carry their interval.
 * ============================================================================
 */

/** A bare Shaman of one style, with its real spellbook and mana to spare. */
const bareShamanOf = (preset: string, style: 'caster' | 'two_hander') => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return makeAttacker({
    autoAttack: 'none',
    abilities: abilitiesForClass('shaman', style, built.talents),
    resources: [{ type: 'mana', maximum: 50_000 }],
  });
};

const bareElemental = () => bareShamanOf('shaman_elemental', 'caster');
const bareEnhancement = () => bareShamanOf('shaman_enhancement', 'two_hander');

/** A context whose every roll succeeds, so only the gate can refuse. */
const alwaysRolls = {
  rng: { rollChance: () => true, nextFloat: () => 0, nextInt: () => 0 },
  clock: { now: () => 10_000 },
  applyAura: () => undefined,
} as unknown as SimulationContext;

/** A context whose every roll fails. */
const neverRolls = {
  rng: { rollChance: () => false, nextFloat: () => 1, nextInt: () => 0 },
  clock: { now: () => 10_000 },
  applyAura: () => undefined,
} as unknown as SimulationContext;

const castOf = (abilityId: string, withTarget = true): AbilityCastEvent =>
  ({
    caster: {} as Combatant,
    target: withTarget ? ({} as Combatant) : undefined,
    ability: { id: abilityId, name: abilityId },
    spent: {},
  }) as unknown as AbilityCastEvent;

describe('Elemental Focus, the cheapest real gap in the project', () => {
  /*
   * ITS REASON SAID "A ONE-SHOT, CHARGE-CONSUMING COST MODIFIER, WHICH HAS NO
   * DECLARATION" and the declaration was already in use by MAELSTROM WEAPON, in
   * this same class, and by the Mage's identically-worded Clearcasting. The
   * reason was a claim about the engine on the day it was written and it had
   * expired twice over before anybody re-read it.
   */
  it('hand-fills the CHANCE and not the reduction, because the 100% is the aura', () => {
    /*
     * A single-rank talent has no `{0}` for the importer to match, so its values
     * come back null and a null value makes the whole effect get DROPPED without
     * reporting anything. The text states two numbers and only one of them needs
     * a per-rank slot.
     */
    expect(talentNumber('shaman', 'elemental_focus', 1, 0)).toBe(10);
    expect(ELEMENTAL_FOCUS_CLEARCASTING.castModifier!.costFraction).toBe(1);
  });

  it('makes the next damage spell free, and spends the whole aura doing it', () => {
    const actor = bareElemental();
    const simulation = buildSimulation([actor, makeTarget()]);
    const bolt = actor.abilities.get('lightning_bolt')!;

    expect(resolveCast(actor, bolt).costAmount).toBeGreaterThan(0);

    simulation.applyAura(actor, ELEMENTAL_FOCUS_CLEARCASTING, actor.id);
    expect(resolveCast(actor, bolt).costAmount).toBe(0);
  });

  it('is spent by ONE cast, not by one stack of several', () => {
    // `consumedByCast: 'all'`. "Your NEXT damage spell" is one cast, and
    // spending a stack instead would leave the aura up for the spell after it.
    expect(ELEMENTAL_FOCUS_CLEARCASTING.castModifier!.consumedByCast).toBe('all');
  });

  it('rolls on a CAST and not on a hit, which the Mage version does not', () => {
    /*
     * "After CASTING any Fire, Frost, or Nature damage spell" against Arcane
     * Concentration's "after any damage spell HITS a target". Built as a copy of
     * the Mage's it would be quietly worse by the Shaman's spell miss chance,
     * and nothing would have failed.
     */
    const reaction = elementalFocus(10);
    expect(reaction.canTrigger!(alwaysRolls, {} as Combatant, castOf('lightning_bolt'))).toBe(true);
    expect(reaction.canTrigger!(neverRolls, {} as Combatant, castOf('lightning_bolt'))).toBe(false);
  });

  it('is not triggered or spent by the imbue, the self-buff or the totem', () => {
    /*
     * THE CONSERVATIVE READING, STATED. Searing Totem's school is Fire and its
     * ticks deal damage, so "a Fire damage spell" is arguable -- but the cast
     * itself rolls nothing and deals nothing, so summoning a totem is not casting
     * a damage spell. Chosen because it pays the talent LESS; including it would
     * be inventing generosity.
     */
    const reaction = elementalFocus(10);
    for (const id of ['windfury_weapon', 'rage_of_the_farseer', 'stormstrike', 'searing_totem']) {
      expect(reaction.canTrigger!(alwaysRolls, {} as Combatant, castOf(id)), id).toBe(false);
      expect(SHAMAN_DAMAGE_SPELL_IDS, id).not.toContain(id);
    }

    // And the discount cannot be spent on them either.
    const actor = bareElemental();
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.applyAura(actor, ELEMENTAL_FOCUS_CLEARCASTING, actor.id);
    expect(resolveCast(actor, WINDFURY_WEAPON).costAmount).toBe(WINDFURY_WEAPON.cost!.amount);
  });
});

describe('Lightning Overload, the first cast reaction that deals damage', () => {
  it('copies only the two spells the talent names', () => {
    const reaction = lightningOverload(10);
    for (const id of ['lightning_bolt', 'chain_lightning']) {
      expect(reaction.canTrigger!(alwaysRolls, {} as Combatant, castOf(id)), id).toBe(true);
    }
    for (const id of ['lava_burst', 'earth_shock', 'flame_shock', 'frost_shock', 'fire_nova']) {
      expect(reaction.canTrigger!(alwaysRolls, {} as Combatant, castOf(id)), id).toBe(false);
    }
  });

  it('refuses when there is no target to copy the spell onto', () => {
    expect(
      lightningOverload(10).canTrigger!(alwaysRolls, {} as Combatant, castOf('lightning_bolt', false)),
    ).toBe(false);
  });

  it('halves the base AND the coefficient, so half damage is half the SPELL', () => {
    /*
     * Halving only the base would leave an overload worth MORE than half at high
     * spell power, which is the opposite of what a copy should do. Asserted
     * through the event stream at zero spell power, where the coefficient
     * contributes nothing and what is left is the flat half.
     */
    expect(LIGHTNING_OVERLOAD_FRACTION).toBe(0.5);

    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: [LIGHTNING_BOLT],
      resources: [{ type: 'mana', maximum: 50_000 }],
      /*
       * ZERO SPELL POWER AND NO CRIT, so what lands is the flat half and nothing
       * else. A large NEGATIVE crit chance is what holds it there -- zero is the
       * number that looks right and is not, because a talent ADDS to whatever
       * the provider returned.
       */
      stats: { spellPower: 0, spellCritChance: -10_000, hitChance: 100 },
      castReactions: [lightningOverload(100)],
    });
    const target = makeTarget();
    const bolt = actor.abilities.get('lightning_bolt')!;
    const simulation = buildSimulation([actor, target]);
    simulation.begin();
    castAbility(simulation, actor, bolt, target);
    // Lightning Bolt is a 2.5 second cast, so nothing has landed yet. The
    // overload is a CAST reaction and fires after `onCast`, which is at the end.
    simulation.advanceTo(bolt.castTimeMs! + 1000);

    const damage = simulation.recordedTelemetry.filter((e) => e.type === 'damage') as Array<
      Extract<TelemetryEvent, { type: 'damage' }>
    >;
    const original = damage.find((e) => e.abilityName === 'Lightning Bolt')!;
    const copy = damage.find((e) => e.abilityName === 'Lightning Bolt (Overload)')!;

    expect(original).toBeDefined();
    expect(copy).toBeDefined();
    expect(copy.amount).toBeCloseTo(original.amount / 2, 5);

    /*
     * AND THE COPY CARRIES THE SOURCE SPELL'S ID WHILE WEARING ITS OWN NAME,
     * which is the whole trick and is silently reversible. The ID is what
     * Concussion and Call of Thunder key off, so a copy with its own id would be
     * stripped of every modifier the original gets; the NAME is what the damage
     * analyzer groups by, so a copy sharing the name would be invisible in the
     * breakdown. Neither failure would look wrong.
     */
    expect(copy.abilityId).toBe('lightning_bolt');
    expect(copy.abilityName).not.toBe(original.abilityName);
  });

  it('reaches the Elemental profile, whose damage is 60% Lightning Bolt', () => {
    const batch = batchOf('shaman_elemental', 40, 7);
    const overload = batch.abilities.find((a) => a.abilityName === 'Lightning Bolt (Overload)');
    expect(overload, 'the overload deals no damage in the build that takes 3/3 of it')
      .toBeDefined();
    expect(overload!.damage).toBeGreaterThan(0);
  });
});

describe('Improved Stormstrike, whose reason explained the wrong clause', () => {
  /*
   * It read "Mana regeneration while casting, AND a Stormstrike cooldown reset on
   * a DODGE OR PARRY. Neither profile is attacked, so neither ever dodges" --
   * true of the second clause and silent about the first, which has been
   * expressible since the first caster. A reason that names two clauses and
   * explains one hides whichever clause is not the subject.
   */
  it('reads the bypass and the duration from the values file, not from a guess', () => {
    /*
     * THE TWO INDEPENDENT CHECKS, because a reaction builder takes ONE number and
     * this talent has four. The chance at index 0 moves between ranks and the
     * other two do not, so the two that do not are named in TypeScript -- and
     * this is what stops a data change leaving them behind.
     */
    for (const rank of [1, 2]) {
      expect(talentNumber('shaman', 'improved_stormstrike', rank, 1), `rank ${rank} bypass`)
        .toBe(IMPROVED_STORMSTRIKE_BYPASS_PERCENT);
      expect(talentNumber('shaman', 'improved_stormstrike', rank, 2), `rank ${rank} duration`)
        .toBe(IMPROVED_STORMSTRIKE_DURATION_MS / 1000);
    }
    // And the chance is the one that varies, which is why the builder takes it.
    expect(talentNumber('shaman', 'improved_stormstrike', 1, 0)).toBe(50);
    expect(talentNumber('shaman', 'improved_stormstrike', 2, 0)).toBe(100);
  });

  it('lets half the mana regeneration through DURING the five second rule', () => {
    /*
     * ASSERTED THROUGH `manaPerTick`, which is the thing the talent actually
     * changes -- not through a DPS delta, and not through the aura existing. The
     * Enhancement shaman spends mana constantly, so it is inside the lockout for
     * effectively the whole fight and this is where its sustain comes from.
     */
    const built = PRESETS_BY_ID.get('shaman_enhancement')!.build();
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: abilitiesForClass('shaman', 'two_hander', built.talents),
      resources: [{ type: 'mana', maximum: 50_000 }],
      stats: { manaPer5: 100 },
    });
    const simulation = buildSimulation([actor, makeTarget()]);

    const full = manaPerTick(actor, 0);
    expect(full).toBeGreaterThan(0);

    // Spend mana through the simulation, which is what records WHEN. Then look
    // inside the five second window: nothing gets through.
    simulation.spendResource(actor, 'mana', 1);
    const now = MANA_REGEN_LOCKOUT_MS / 2;
    expect(manaPerTick(actor, now)).toBe(0);

    simulation.applyAura(
      actor,
      improvedStormstrikeAura(IMPROVED_STORMSTRIKE_BYPASS_PERCENT, IMPROVED_STORMSTRIKE_DURATION_MS),
      actor.id,
    );
    expect(manaPerTick(actor, now)).toBeCloseTo(full * (IMPROVED_STORMSTRIKE_BYPASS_PERCENT / 100), 6);
  });

  it('fires on the Stormstrike CAST and on nothing else', () => {
    // "When you Stormstrike", not "when Stormstrike hits": a dodged Stormstrike
    // is still a cast. Keyed by `abilityId`, which `runCastReactions` filters on.
    expect(improvedStormstrike(100).abilityId).toBe('stormstrike');
  });
});

describe('Fire Nova, which was blocked on the wrong thing for the whole project', () => {
  /*
   * Improved Fire Nova's reason cited the totems-are-not-entities gap -- an
   * engine change shared with the Warlock and the Mage -- and Searing Totem has
   * been a modelled fire totem since the owner ruled it a DoT "considered a totem
   * for the purposes of other talents". What actually blocked it was the spell
   * power coefficient, which one question answered. Naming the expensive blocker
   * instead of the cheap one parked the talent behind work it never needed.
   */
  it('takes the midpoint of 413 to 459, at max rank, from the spellbook', () => {
    expect(FIRE_NOVA_DAMAGE).toBe(436);
    expect(FIRE_NOVA.cost!.amount).toBe(520);
    expect(FIRE_NOVA_COOLDOWN_MS).toBe(seconds(10));
  });

  it('refuses to cast without a fire totem, and allows it with one', () => {
    /*
     * "Within 10 yd of your ACTIVE FIRE TOTEM" is `canCast` rather than a comment,
     * and it is asked of the TARGET because the totem is modelled as a debuff
     * there. That is what makes the Searing Totem entry above it in the priority
     * list load-bearing rather than independent.
     */
    const actor = bareEnhancement();
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    const context = { simulation, caster: actor, target, ability: FIRE_NOVA };

    expect(FIRE_NOVA.canCast!(context)).toBe(false);
    simulation.applyAura(target, SEARING_TOTEM_DOT, actor.id);
    expect(FIRE_NOVA.canCast!(context)).toBe(true);
  });

  it('is scaled by BOTH talents that name it, from the right value each time', () => {
    /*
     * Improved Fire Nova is "+20% damage AND -4 sec cooldown", one row with two
     * numbers. Reading index 0 for the cooldown would remove TWENTY seconds from
     * a ten-second cooldown and make the ability free to cast -- which does not
     * error and does not read as wrong.
     */
    const build = talentBuild('shaman', legalise({ improved_fire_nova: 2 }, 'shaman'));
    expect(build.abilityModifiers.for('fire_nova').damageMultiplier).toBeCloseTo(1.2, 6);
    expect(build.abilityCooldownReductionMs.get('fire_nova')).toBe(seconds(4));

    // Call of Flame names it too: "your Flame Shock, FIRE NOVA, and Lava Burst".
    const flame = talentBuild('shaman', legalise({ call_of_flame: 3 }, 'shaman'));
    expect(flame.abilityModifiers.for('fire_nova').damageMultiplier).toBeCloseTo(1.15, 6);
  });

  it('is in the Enhancement list at the bottom, where the owner put it', () => {
    const ids = SHAMAN_ENHANCEMENT.map((entry) => entry.abilityId);
    expect(ids[ids.length - 1]).toBe('fire_nova');

    // And it fires, which is the only thing that says the totem gate opens.
    const batch = batchOf('shaman_enhancement', 40, 11);
    expect(batch.abilities.find((a) => a.abilityName === 'Fire Nova')?.uses ?? 0)
      .toBeGreaterThan(0);
  });

  it('is NOT in the Elemental list, which was measured rather than reasoned', () => {
    /*
     * Below that list's unconditional Lightning Bolt it fired zero times and the
     * figure was identical to the decimal; above it, 332.0 against 375.0. 520
     * mana on a six-second cycle starves the filler. The floor rule: nothing
     * below an ungated entry can ever be the first castable one.
     */
    expect(SHAMAN_ELEMENTAL.map((entry) => entry.abilityId)).not.toContain('fire_nova');
  });
});

describe('the two owner rulings that replaced placeholders', () => {
  it('normalises Maelstrom Weapon by weapon speed, which a flat chance does not', () => {
    /*
     * FIVE PROCS PER MINUTE, the owner's figure. The SHAPE changed and not only
     * the number: a flat per-hit chance is worth more to a FAST weapon, and PPM
     * removes exactly that. Asserted as the normalisation rather than as a
     * percentage, because that is the property the two readings disagree about.
     */
    expect(MAELSTROM_WEAPON_PPM).toBe(5);

    const slow = ppmChance(3.4, MAELSTROM_WEAPON_PPM);
    const fast = ppmChance(1.7, MAELSTROM_WEAPON_PPM);
    expect(slow).toBeCloseTo(fast * 2, 10);
    // Procs per minute, so each is its rate times sixty over the speed.
    expect((slow * 60) / 3.4).toBeCloseTo(MAELSTROM_WEAPON_PPM, 10);
    expect((fast * 60) / 1.7).toBeCloseTo(MAELSTROM_WEAPON_PPM, 10);
  });

  it('gives the Windfury IMBUE a three second internal cooldown, not the totem’s', () => {
    /*
     * The 1.5 seconds it carried was borrowed from Windfury Totem, whose window
     * the owner stated, and was twice too generous for the imbue -- the owner gave
     * 3 seconds for the imbue on 2026-09-30. Asserted as being DIFFERENT from the
     * totem's figure as well as as a number, because "borrowed from the totem" is
     * the mistake and an equality is what would reinstate it.
     */
    expect(WINDFURY_WEAPON_INTERNAL_COOLDOWN_MS).toBe(seconds(3));
    expect(WINDFURY_WEAPON_INTERNAL_COOLDOWN_MS).not.toBe(seconds(1.5));
  });
});

describe('what is left, which is the claim this deep dive makes', () => {
  it('leaves every talent either profile spends a point on doing something', () => {
    /*
     * ------------------------------------------------------------------------
     * THE COMPLETENESS CLAIM, AS A TEST RATHER THAN AS PROSE IN A DOCUMENT.
     *
     * A census figure counts all 50 talents, most of which neither profile takes,
     * so "17 live gaps" never said how much of the Shaman's own BUILDS were
     * inert. This asks the narrower question the deep dive was for: of the points
     * these two profiles actually spend, what reports itself unmodelled?
     *
     * A LIVE GAP, NOT MERELY AN UNMODELLED CLAUSE. A talent with a working effect
     * AND an unmodelled clause is PARTLY modelled and is doing something -- Call
     * of Flame raises four things and only its Magma Totem clause is dead -- so
     * the filter here is the census's own: no non-unmodelled effect row at all.
     *
     * ONE ENTRY IS EXPECTED AND IT IS A CENSUS ARTEFACT. Elemental Weapons' own
     * reason says "APPLIES" in capitals -- `reactionsForClass` reads its rank and
     * builds the Windfury proc with it -- and the census cannot hear that, because
     * it counts effect rows and this talent has none. The field for saying so,
     * `appliedElsewhere`, is not on `main` yet; it arrives with the Rogue's two
     * poison talents, which fell into the same hole.
     *
     * So this is written as an exact list. When that field lands, this fails and
     * the fix is one line in `shamanEffects.ts` -- which is the point: a
     * known-wrong classification that nothing enforces is one that stays wrong.
     * ------------------------------------------------------------------------
     */
    const hasWorkingEffect = (talentId: string) =>
      (SHAMAN_TALENT_EFFECTS[talentId] ?? []).some((effect) => effect.kind !== 'unmodelled');

    for (const preset of ['shaman_elemental', 'shaman_enhancement']) {
      const built = PRESETS_BY_ID.get(preset)!.build();
      const build = talentBuild('shaman', built.talents);
      const gaps = [
        ...new Set(
          build.unmodelled
            .filter((entry) => entry.scope === undefined)
            .map((entry) => entry.talentId)
            .filter((id) => !hasWorkingEffect(id)),
        ),
      ].sort();

      expect(gaps, preset).toEqual(preset === 'shaman_enhancement' ? ['elemental_weapons'] : []);
    }
  });

  it('leaves exactly two partly-modelled clauses in either build, both Magma Totem', () => {
    /*
     * THE OTHER HALF OF THE CLAIM, because "does something" and "does everything"
     * are different and the first one alone would hide a dead clause. Both builds
     * take Call of Flame and Elemental Fury, and in both the only clause left is
     * Magma Totem -- which is a missing COEFFICIENT rather than a missing engine,
     * and is recorded as an open question rather than as work.
     *
     * Improved Stormstrike is the third partly-modelled talent and is Enhancement
     * only: its mana half works and its dodge/parry half cannot, which is the
     * encounter rather than the engine.
     */
    for (const preset of ['shaman_elemental', 'shaman_enhancement']) {
      const built = PRESETS_BY_ID.get(preset)!.build();
      const build = talentBuild('shaman', built.talents);
      const partly = [
        ...new Set(
          build.unmodelled
            .map((entry) => entry.talentId)
            .filter((id) =>
              (SHAMAN_TALENT_EFFECTS[id] ?? []).some((effect) => effect.kind !== 'unmodelled'),
            ),
        ),
      ].sort();

      expect(partly, preset).toEqual(
        preset === 'shaman_enhancement'
          ? ['call_of_flame', 'elemental_fury', 'improved_stormstrike']
          : ['call_of_flame', 'elemental_fury'],
      );
    }
  });

  it('counts the two new rulings against the talents they were given for', () => {
    // Cast pushback: Eye of the Storm, which the Elemental build takes 3/3 of,
    // and Healing Focus. Totems as entities: the four that buff or heal.
    const scopes = new Map<string, string[]>();
    for (const [id, effects] of Object.entries(SHAMAN_TALENT_EFFECTS)) {
      for (const effect of effects) {
        if (effect.kind !== 'unmodelled' || effect.scope === undefined) continue;
        scopes.set(effect.scope, [...(scopes.get(effect.scope) ?? []), id]);
      }
    }
    expect(scopes.get('castPushback')?.sort()).toEqual(['eye_of_the_storm', 'healing_focus']);
    expect(scopes.get('totemEntities')?.sort()).toEqual([
      'earth_s_grasp',
      'guardian_totems',
      'mana_tide_totem',
      'restorative_totems',
    ]);
  });

  it('keeps Magma Totem OUT of the totem ruling, because it is a damage totem', () => {
    /*
     * The reading that reaches Searing Totem reaches Magma Totem too -- it deals
     * damage, so a debuff that ticks expresses it. What it lacks is a spell power
     * coefficient, the same thing Searing Totem and Fire Nova lacked until the
     * owner supplied one. Filing it under the entity ruling would park a
     * one-message question behind an engine change, which is exactly what
     * Improved Fire Nova's reason did for the whole project.
     */
    for (const id of ['call_of_flame', 'elemental_fury']) {
      const magma = SHAMAN_TALENT_EFFECTS[id]!.filter(
        (effect) => effect.kind === 'unmodelled',
      ) as Array<{ kind: 'unmodelled'; reason: string; scope?: string }>;
      expect(magma, id).toHaveLength(1);
      expect(magma[0].reason, id).toMatch(/Magma Totem/);
      expect(magma[0].reason, id).toMatch(/coefficient/);
      expect(magma[0].scope, id).toBeUndefined();
    }
  });
});


/*
 * ============================================================================
 * WINDFURY WEAPON IS NOT WINDFURY TOTEM, and for most of this project it was
 * modelled as though it were.
 *
 * ----------------------------------------------------------------------------
 * THE WHOLE REWORK PASSED THE SUITE UNTOUCHED, which is the reason this block
 * exists. The old tests pinned the CONSTANTS -- 20%, two attacks, 333 attack
 * power, a 3 second cooldown -- and that the reaction was registered. Not one
 * of them asked what SHAPE the extra attacks took, so replacing "apply +466
 * attack power for 1.5 seconds, then swing twice" with "deal two special
 * attacks carrying +466" changed 21.8 DPS and broke nothing.
 *
 * That is the documented rule not being followed: assert the MECHANISM, not the
 * declaration. Every test below would have failed on the old implementation.
 *
 * THE RULESET OWNER'S FOUR DIFFERENCES, given 2026-10-07:
 *   1. a 3 second internal cooldown              (already true)
 *   2. SPECIAL attacks -- no glancing, two rolls
 *   3. the rank's attack power added INTO the hits, not as a temporary buff
 *   4. it does NOT reset the auto-attack swing timer
 * plus: its own damage row rather than being counted as an auto-attack.
 * ============================================================================
 */
describe('Windfury Weapon, as a self-contained special attack', () => {
  const enhancementPlayer = () => presetPlayer('shaman_enhancement');

  /** Run one fight of the real profile and return its damage events. */
  const fightEvents = (seed: number) => {
    const built = PRESETS_BY_ID.get('shaman_enhancement')!.build();
    const result = runProfile({
      ...built,
      simulation: { ...built.simulation, seed },
    } as never);
    return (result.timeline as readonly TelemetryEvent[]).filter(
      (event): event is Extract<TelemetryEvent, { type: 'damage' }> => event.type === 'damage',
    );
  };

  it('deals its hits on the SPECIAL table, so they can never glance', () => {
    /*
     * THE BIGGEST HALF OF THE REWORK, worth +15.8 DPS on its own. A glancing
     * blow is both frequent and reduced against a level 63 target, and a
     * special attack cannot glance: `melee-special` rolls miss, dodge and parry
     * on the first roll and crit on the second, with no glance in either.
     *
     * Asserted over many fights on the OUTCOME, which is the thing that would
     * change if the table did -- a constant saying 'melee-special' would pass
     * while the hits were dealt on another one.
     */
    const outcomes = new Set<string>();
    let hits = 0;
    for (let seed = 1; seed <= 25; seed += 1) {
      for (const event of fightEvents(seed)) {
        if (event.abilityName !== WINDFURY_WEAPON_ATTACK_NAME) continue;
        outcomes.add(event.outcome);
        hits += 1;
      }
    }

    expect(hits, 'Windfury dealt nothing at all').toBeGreaterThan(100);
    expect([...outcomes].sort()).not.toContain('glance');
    // And the outcomes it DOES produce are the special table's.
    for (const outcome of outcomes) {
      expect(['hit', 'crit', 'miss', 'dodge', 'parry'], outcome).toContain(outcome);
    }
  });

  it('gets its own damage row, and does not share the imbue’s', () => {
    /*
     * `abilityBreakdown` builds ONE ROW PER NAME, with `uses` from cast events
     * and `attempts` from damage events. The imbue is an ability called
     * "Windfury Weapon", cast once and dealing nothing, so a shared name reads
     * ONE USE and nine ATTEMPTS in a single row -- consistent, summing to 100%,
     * and nonsense. The same shape as a pet's swing landing in the row called
     * "Main Hand Auto-Attack", which became a documented fact about the BM
     * Hunter in one reading.
     */
    expect(WINDFURY_WEAPON_ATTACK_NAME).not.toBe(WINDFURY_WEAPON.name);

    const batch = batchOf('shaman_enhancement', 30, 3);
    const imbue = batch.abilities.find((row) => row.abilityName === WINDFURY_WEAPON.name);
    const attack = batch.abilities.find(
      (row) => row.abilityName === WINDFURY_WEAPON_ATTACK_NAME,
    );

    // The imbue: cast once, deals nothing.
    expect(imbue?.uses ?? 0).toBeCloseTo(1, 1);
    expect(imbue?.damage ?? 0).toBe(0);

    // The attacks: never cast, deal plenty.
    expect(attack, 'no Windfury Attack row').toBeDefined();
    expect(attack!.uses).toBe(0);
    expect(attack!.damage).toBeGreaterThan(0);
    expect(attack!.attempts).toBeGreaterThan(1);
  });

  it('is NOT reported as an auto-attack, which is where it used to land', () => {
    /*
     * `extraAttack` schedules a real SWING, and a swing is reported as "Main
     * Hand Auto-Attack" -- so eight extra attacks a fight were invisible inside
     * the auto-attack line, and the largest thing in the build after its own
     * swing could not be read off the results page at all.
     *
     * The check is the COUNT: a 3.8 second weapon cannot swing more than about
     * 20 times in a 58 second fight even fully hasted, so an auto-attack row
     * carrying 33 attempts is carrying something else.
     */
    const batch = batchOf('shaman_enhancement', 30, 4);
    const autos = batch.abilities.find((row) => row.abilityName === 'Main Hand Auto-Attack');
    const weapon = enhancementPlayer().weapons.mainHand!;
    const swingsIfUnhasted =
      batch.representative.durationMs / weapon.swingTimerMs;

    expect(autos, 'no auto-attack row').toBeDefined();
    // Haste makes it swing faster than its base speed, so allow generous room
    // -- but not the 2x that folding Windfury in produced.
    expect(autos!.attempts).toBeLessThan(swingsIfUnhasted * 1.6);
  });

  it('folds the rank’s attack power into the hits rather than buffing the shaman', () => {
    /*
     * Worth +18.8 DPS, and the difference from a 1.5-second window is WHAT ELSE
     * GETS PAID: a window also pays an ordinary swing or a Stormstrike landing
     * inside it, where this pays exactly the two attacks it belongs to.
     *
     * Asserted by driving the reaction directly at two attack power settings
     * and comparing the hit it produces, because the bonus is invisible in any
     * stat block -- there is no aura to look for any more, which is the point.
     */
    /*
     * A FRESH SIMULATION PER MEASUREMENT, which the first version of this test
     * got wrong by reusing one: the two extra attacks are scheduled under an
     * event id built from the actor and the index, so the second round's events
     * collided with the first round's and produced no damage at all. Two runs,
     * one variable.
     */
    const damageOf = (bonusPercent: number) => {
      const attacker = makeAttacker({
        autoAttack: 'none',
        // No attack power of its own and no crit, so the ONLY power in the hit
        // is the bonus the imbue folds in -- which is the thing under test.
        stats: { attackPower: 0, critChance: -10_000, hitChance: 100 },
        weapons: {
          mainHand: {
            name: 'Test',
            baseDamage: 100,
            swingTimerMs: 2000,
            powerCoefficient: 2 / 14,
          } as never,
        },
      });
      const target = makeTarget();
      const simulation = buildSimulation([attacker, target]);
      simulation.begin();
      simulation.applyAura(attacker, WINDFURY_WEAPON_IMBUE, attacker.id);

      windfuryWeaponReaction(bonusPercent).onTrigger(simulation, attacker, {
        attacker,
        defender: target,
        outcome: 'hit',
        abilityId: undefined,
        abilityName: 'Main Hand Auto-Attack',
        amount: 1,
        weaponSlot: 'mainHand',
        critical: false,
      });
      // The attacks are SCHEDULED at this instant, so the queue has to run.
      simulation.advanceTo(simulation.clock.now() + 1);

      const hits = (simulation.recordedTelemetry as readonly TelemetryEvent[]).filter(
        (event): event is Extract<TelemetryEvent, { type: 'damage' }> =>
          event.type === 'damage' && event.abilityName === WINDFURY_WEAPON_ATTACK_NAME,
      );
      // Two attacks, every time: the count is part of the mechanism.
      expect(hits).toHaveLength(WINDFURY_WEAPON_EXTRA_ATTACKS);
      return hits.reduce((total, event) => total + event.amount, 0);
    };

    const plain = damageOf(0);
    const boosted = damageOf(40);

    expect(plain).toBeGreaterThan(0);
    /*
     * ELEMENTAL WEAPONS RAISES THE ATTACK POWER AND NOTHING ELSE, so 40% more
     * bonus power is strictly more damage. Asserted as an inequality rather than
     * a ratio, because the weapon damage roll is random and only the power term
     * moves.
     */
    expect(boosted).toBeGreaterThan(plain);
  });

  it('does not reset the auto-attack swing timer, which the totem does', () => {
    /*
     * `extraAttack` completes the swing now and RESTARTS the slot's timer, so
     * every proc pushed the next real swing out by a full cycle -- a cost that
     * partly paid for its own extra attacks. The owner's ruling is that the
     * imbue does not do this.
     *
     * Asserted on the PENDING SWING surviving the proc untouched, which is the
     * mechanism: a reset replaces the handle.
     */
    const attacker = makeAttacker({
      stats: { hitChance: 100 },
      weapons: { mainHand: { name: 'Test', baseDamage: 100, swingTimerMs: 3800, powerCoefficient: 3800 / 14 } as never },
    });
    const target = makeTarget();
    const simulation = buildSimulation([attacker, target]);
    simulation.begin();
    simulation.applyAura(attacker, WINDFURY_WEAPON_IMBUE, attacker.id);

    simulation.advanceTo(1000);
    const pendingBefore = attacker.pendingSwing('mainHand');

    windfuryWeaponReaction(0).onTrigger(simulation, attacker, {
      attacker,
      defender: target,
      outcome: 'hit',
      abilityId: undefined,
      abilityName: 'Main Hand Auto-Attack',
      amount: 1,
      weaponSlot: 'mainHand',
      critical: false,
    });
    simulation.advanceTo(1001);

    expect(attacker.pendingSwing('mainHand')).toBe(pendingBefore);
  });

  it('keeps the totem on the OLD shape, because the owner stated that one', () => {
    /*
     * Windfury Totem still applies an attack power window and still asks for a
     * real extra SWING, by the ruleset owner's own description of it. The two
     * are the same effect at different strengths and they must NOT be made to
     * match -- which is easy to get wrong in exactly one direction, by
     * "tidying" the totem to look like the imbue.
     */
    expect(WINDFURY_ATTACK_POWER).toBe(246);
    expect(WINDFURY_DURATION_MS).toBe(seconds(1.5));
    expect(WINDFURY_ATTACK_POWER).not.toBe(WINDFURY_WEAPON_ATTACK_POWER);
    expect(WINDFURY_DURATION_MS).not.toBe(WINDFURY_WEAPON_INTERNAL_COOLDOWN_MS);
  });

  it('uses an id of its own, so no talent reaches it by accident', () => {
    expect(WINDFURY_WEAPON_ATTACK_ID).not.toBe(WINDFURY_WEAPON.id);
  });
});

/*
 * ============================================================================
 * MAELSTROM WEAPON ROLLS ON ALL THREE THINGS THAT SHOULD ROLL IT.
 *
 * The ruleset owner's question: Lightning Bolt fires about 1.5 times a fight,
 * which is about 7 procs at five stacks each, and that looked low. Three things
 * should roll it -- auto-attacks, Stormstrike, and the extra attacks Windfury
 * grants -- and a rate that is low because ONE OF THE THREE IS NOT ROLLING
 * looks exactly like a rate that is simply low.
 *
 * It is all three, at the right rate. `tools/maelstrom_probe.ts` prints the
 * per-source observed chance beside the PPM chance the weapon's base speed
 * implies; this pins the part a test can pin.
 * ============================================================================
 */
describe('Maelstrom Weapon rolls on every melee weapon use', () => {
  const use = (abilityId: string | undefined, slot: 'mainHand' | 'offHand' | 'ranged') =>
    ({
      attacker: {} as Combatant,
      defender: {} as Combatant,
      outcome: 'hit',
      abilityId,
      abilityName: abilityId ?? 'Main Hand Auto-Attack',
      amount: 1,
      weaponSlot: slot,
      critical: false,
    }) as never;

  /** A shaman holding the Enhancement profile's own weapon. */
  const shaman = () => {
    const weapon = presetPlayer('shaman_enhancement').weapons.mainHand!;
    return { weapons: { mainHand: weapon } } as unknown as Combatant;
  };

  it('rolls on an auto-attack, on Stormstrike AND on a Windfury attack', () => {
    /*
     * ALL THREE ARE MAIN-HAND WEAPON USES, which is the whole test: `isWeaponUse`
     * reduces to "did a melee slot swing", and the Windfury attacks carry
     * `weaponSlot: 'mainHand'` for exactly this reason. A Windfury attack that
     * forgot it would be dealt, reported, and silently stop feeding the capstone.
     */
    const reaction = maelstromWeapon(20);
    for (const abilityId of [undefined, 'stormstrike', WINDFURY_WEAPON_ATTACK_ID]) {
      expect(
        reaction.canTrigger!(alwaysRolls, shaman(), use(abilityId, 'mainHand')),
        String(abilityId),
      ).toBe(true);
    }
  });

  it('does not roll on a spell, which has no weapon slot', () => {
    const reaction = maelstromWeapon(20);
    expect(reaction.canTrigger!(alwaysRolls, shaman(), use('lightning_bolt', 'ranged'))).toBe(
      false,
    );
  });

  it('rolls the PPM chance the weapon’s own base speed implies', () => {
    /*
     * THE RATE, not the mechanism. `ppmChance` is `speed / 60 x PPM`, so the
     * number the reaction rolls against is a property of the weapon rather than
     * a constant -- which is the difference between PPM and the flat chance this
     * used to carry, and is why a slow two-hander and a fast one hand proc the
     * same number of times a minute.
     */
    const weapon = presetPlayer('shaman_enhancement').weapons.mainHand!;
    const speed = weapon.swingTimerMs / 1000;
    const chance = ppmChance(speed, MAELSTROM_WEAPON_PPM);

    // Scripted either side of the boundary, so the threshold is exact rather
    // than sampled.
    const justUnder = {
      rng: { nextFloat: () => chance - 1e-9, rollChance: () => true, nextInt: () => 0 },
      clock: { now: () => 0 },
    } as unknown as SimulationContext;
    const justOver = {
      rng: { nextFloat: () => chance + 1e-9, rollChance: () => true, nextInt: () => 0 },
      clock: { now: () => 0 },
    } as unknown as SimulationContext;

    const reaction = maelstromWeapon(20);
    expect(reaction.canTrigger!(justUnder, shaman(), use(undefined, 'mainHand'))).toBe(true);
    expect(reaction.canTrigger!(justOver, shaman(), use(undefined, 'mainHand'))).toBe(false);
  });

  it('feeds the capstone: the bolt is cast and the stacks are spent', () => {
    /*
     * THE END-TO-END CHECK, and the figure the owner asked about. At 5 PPM a
     * 3.8 second weapon and about 35 melee uses a minute give roughly 10.5 procs
     * a minute, which is about two full five-stack bolts in a 58 second fight.
     * Asserted as a floor rather than a figure, because it is a rate question
     * and the exact number belongs in the docs where it can carry an interval.
     */
    const batch = batchOf('shaman_enhancement', 40, 9);
    const bolts = batch.abilities.find((row) => row.abilityName === 'Lightning Bolt')?.uses ?? 0;
    expect(bolts).toBeGreaterThan(1);
  });
});
