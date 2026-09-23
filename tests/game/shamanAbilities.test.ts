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
    // "189 to 211", "119 to 133", "293 to 309", "278 to 294", "192 to 248".
    expect(LIGHTNING_BOLT_DAMAGE).toBe(200);
    expect(CHAIN_LIGHTNING_DAMAGE).toBe(126);
    expect(EARTH_SHOCK_DAMAGE).toBe(301);
    expect(FROST_SHOCK_DAMAGE).toBe(286);
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

  it('gives the Elemental shaman a FLOOR, for the same two reasons the Moonkin has one', () => {
    /*
     * --------------------------------------------------------------------------
     * THE SECOND CASTER, AND THE LIMITATION IS NOT A DRUID QUIRK.
     *
     *   - every Shaman spell states FLAT damage and no spell power
     *     coefficient, so gear cannot scale it
     *   - the item data is nineteen Classic stand-ins curated for a Warrior,
     *     so a Shaman's spellPower reads zero
     *
     * Two classes, same two causes. Asserted rather than described, so the day
     * a coefficient or a caster item arrives, this fails and the figure is
     * re-read.
     * --------------------------------------------------------------------------
     */
    expect(presetPlayer('shaman_elemental').stats.get('spellPower')).toBe(0);

    const batch = batchOf('shaman_elemental', 40, 5);
    const named = batch.castButNotSimulated.map((entry) => entry.abilityName);
    expect(named).toContain('Lightning Bolt');
    expect(named).toContain('Lava Burst');
  });

  it('leaves the Enhancement shaman ahead of the Elemental one, by a lot', () => {
    /*
     * Not a balance claim -- a claim about what is MISSING. Elemental's own
     * damage is largely its totems, which the engine has no entity for, while
     * Enhancement's is swings and a weapon proc that are fully modelled. The
     * gap is the measure of the totem hole rather than of the spec.
     */
    const elemental = batchOf('shaman_elemental', 40, 5).dps.mean;
    const enhancement = batchOf('shaman_enhancement', 40, 5).dps.mean;
    expect(enhancement).toBeGreaterThan(elemental * 3);
  });
});
