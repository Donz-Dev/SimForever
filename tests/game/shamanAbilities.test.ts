import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  CHAIN_LIGHTNING_DAMAGE,
  EARTH_SHOCK_DAMAGE,
  FLAME_SHOCK_DIRECT,
  FROST_SHOCK_DAMAGE,
  LAVA_BURST_DAMAGE,
  LAVA_BURST_FLAME_SHOCK_BONUS,
  LIGHTNING_BOLT_DAMAGE,
} from '../../src/game/abilities/shaman';
import {
  FLAME_SHOCK_DOT_DURATION_MS,
  FLAME_SHOCK_DOT_TOTAL,
  FLAME_SHOCK_TICK_INTERVAL_MS,
  STORMSTRIKE_DAMAGE_BONUS,
} from '../../src/game/auras/shaman';
import {
  WINDFURY_WEAPON_ATTACK_POWER,
  WINDFURY_WEAPON_EXTRA_ATTACKS,
  WINDFURY_WEAPON_PROC_CHANCE,
} from '../../src/game/reactions/shaman';
import { SHAMAN_TALENT_EFFECTS } from '../../src/game/talents/shamanEffects';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { castAbility, resolveCast } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { MAELSTROM_WEAPON_MAX_STACKS, maelstromWeaponAura } from '../../src/game/auras/shaman';
import {
  MAELSTROM_WEAPON_UNMODELLED,
  PLACEHOLDER_MAELSTROM_WEAPON_PROC_CHANCE,
} from '../../src/game/reactions/shamanTalents';
import { SHAMAN_ENHANCEMENT } from '../../src/game/rotations/shaman';
import { talentNumber } from '../../src/game/talents/talentValues';

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
    expect(presetPlayer('shaman_elemental').stats.get('spellPower')).toBe(453);

    const batch = batchOf('shaman_elemental', 40, 5);
    const named = batch.castButNotSimulated.map((entry) => entry.abilityName);

    // Lava Burst had NOTHING else wrong with it, so it leaves the list.
    expect(named).not.toContain('Lava Burst');

    /*
     * LIGHTNING BOLT STAYS ON IT, and that is correct rather than a miss: it
     * carries a SECOND caveat, about the placeholder proc chance Maelstrom
     * Weapon rides on, which has nothing to do with scaling.
     *
     * Asserted on the REASON TEXT rather than on the ability name, because
     * "is it listed" cannot tell two different caveats apart -- and only the
     * coefficient one was supposed to go.
     */
    const reasons = batch.castButNotSimulated
      .filter((entry) => entry.abilityName === 'Lightning Bolt')
      .map((entry) => entry.reason)
      .join(' ');
    expect(reasons).not.toMatch(/spell power coefficient/i);
    expect(reasons).toMatch(/PLACEHOLDER/i);
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
     * The tooltip states no chance at all. So the rate is a named placeholder
     * and the talent prints that caveat, and the reduction is read from the
     * talent where it actually lives. Asserted as the two being DIFFERENT
     * things rather than as a number, because the placeholder is expected to
     * change the moment the ruleset owner supplies the real one.
     * --------------------------------------------------------------------------
     */
    const built = PRESETS_BY_ID.get('shaman_enhancement')!.build();
    expect(built.talents.maelstrom_weapon).toBe(5);

    // The reduction at rank 5, from the values file.
    expect(talentNumber('shaman', 'maelstrom_weapon', 5, 0)).toBe(20);

    // And the caveat is surfaced, not buried in a comment.
    expect(MAELSTROM_WEAPON_UNMODELLED).toContain('PLACEHOLDER');
    expect(PLACEHOLDER_MAELSTROM_WEAPON_PROC_CHANCE).toBeGreaterThan(0);
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
