import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import type { Ability, TelemetryEvent } from '../../src/engine';
import { NO_CHANCES, castAbility, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { WRACK_TICK_SP_COEFFICIENT } from '../../src/game/combat/coefficients';
import { WARLOCK_AFFLICTION } from '../../src/game/rotations/warlock';
import {
  CONFLAGRATE_DAMAGE,
  CONFLAGRATE_KEEPS_IMMOLATE,
  INCINERATE_DAMAGE,
  INCINERATE_IMMOLATE_BONUS,
  LIFE_TAP_AMOUNT,
  SEARING_PAIN_DAMAGE,
  SHADOWBURN,
  SHADOWBURN_DAMAGE,
  SHADOWBURN_MANA,
  SHADOWBURN_REFUNDS_SHARD,
  SHADOW_BOLT_DAMAGE,
  WRACK,
  WRACK_TICKS,
  WRACK_TICK_DAMAGE,
} from '../../src/game/abilities/warlock';
import {
  BANE_OF_AGONY_TOTAL,
  CORRUPTION_TOTAL,
  DEMONIC_SACRIFICE_DAMAGE,
  WRACK_AMPLIFICATION,
  WRACK_DEBUFF_DURATION_MS,
  WRACK_DOT_AMPLIFICATION_PERCENT,
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

/**
 * Every point of damage one ability causes at a given spell power, ticks
 * included.
 *
 * ----------------------------------------------------------------------------
 * SCRIPTED, NOT SAMPLED. `NO_CHANCES` with a large NEGATIVE crit is what makes
 * this exact: every attack is a clean hit and nothing crits, so the figure is
 * the coefficient arithmetic and not a seed. A zero crit chance would NOT do --
 * `applyAbilityModifiers` ADDS a talent's crit to whatever the provider
 * returned, so zero is the number that looks right and is not.
 *
 * The clock runs past the whole six-second channel, because a channel deals
 * nothing at the instant it is cast.
 * ----------------------------------------------------------------------------
 */
function damageFrom(ability: Ability, spellPower: number): number {
  const events: TelemetryEvent[] = [];
  const actor = makeAttacker({
    autoAttack: 'none',
    abilities: [ability],
    stats: { spellPower },
    resources: [{ type: 'mana', maximum: 1_000_000 }],
  });
  const target = makeTarget({ maxHealth: 100_000_000 });
  const simulation = buildSimulation(
    [actor, target],
    {
      durationMs: seconds(30),
      attackChances: () => ({ ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1 }),
    },
    { emit: (event) => events.push(event) },
  );

  castAbility(simulation, actor, actor.abilities.get(ability.id)!, target);
  simulation.advanceTo(seconds(20));

  let total = 0;
  for (const event of events) {
    if (event.type === 'damage' && event.sourceId === actor.id) total += event.amount;
  }
  return total;
}

describe('the numbers', () => {
  it('takes the midpoint of each stated range, at MAX RANK', () => {
    // Both sources agree on these three, at rank 10, 3 and 6 respectively.
    expect(SHADOW_BOLT_DAMAGE).toBe(268);
    expect(INCINERATE_DAMAGE).toBe(217);
    expect(CONFLAGRATE_DAMAGE).toBe(282);
  });

  /*
   * THREE FIGURES THE TWO SOURCES DISAGREE ON, AT THE SAME CLIENT BUILD.
   *
   * `talentsforever.com` and `foreverchanges.pro` were both read at build
   * 1.60.1.70009 and disagree on Life Tap (424 against 840), Shadowburn
   * (258-288 against 251-281) and Searing Pain (107-125 against 105-123). The
   * ruleset owner ruled 840 and gave the standing rule that goes with it:
   * **prefer foreverchanges.pro**. See `docs/source-cross-checks.md`.
   *
   * These expectations carry the ruling rather than only the number, which is
   * the same shape as the Shield Wall override in `warriorAbilities.test.ts`:
   * an override without its reason turns a check on the source into a place to
   * file whatever the code happens to do.
   *
   * THE CHECKED-IN CAPTURE STILL SAYS 424, deliberately -- it is scraped data
   * and is never hand-edited, so the constant disagreeing with it is the honest
   * state and not drift.
   */
  it('follows foreverchanges.pro where the two sources disagree', () => {
    expect(LIFE_TAP_AMOUNT).toBe(840);
    expect(SHADOWBURN_DAMAGE).toBe(266);
    expect(SEARING_PAIN_DAMAGE).toBe(114);
  });

  /*
   * Its mana half. The sources do not contradict each other here -- one states
   * a Soul Shard reagent, the other 365 mana and no reagent field for ANY spell
   * -- so both are charged. See the note on SHADOWBURN in `abilities/warlock.ts`.
   */
  it('charges Shadowburn a shard AND its mana', () => {
    expect(SHADOWBURN.cost).toEqual({ resource: 'soulShards', amount: 1 });
    expect(SHADOWBURN_MANA).toBe(365);
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

  it('gives each damage demon ONE school, and the other two nothing', () => {
    /*
     * ------------------------------------------------------------------------
     * "IMP: INCREASES YOUR SHADOW DAMAGE BY 15%. SUCCUBUS: INCREASES YOUR FIRE
     * DAMAGE BY 15%." Two demons, two schools, and this used to be one
     * whole-character multiplier for both with a caveat admitting it.
     *
     * THE CAVEAT SAID "EXACT FOR EITHER PROFILE", AND IT WAS HALF RIGHT. SM/DS
     * deals almost nothing but Shadow, so the Imp's reading cost nothing.
     * FIRELOCK DEALS 22% OF ITS DAMAGE IN SHADOW -- Corruption and Shadowburn
     * -- and was collecting a sacrificed Succubus's FIRE bonus on all of it.
     *
     * ASSERTING THE SCHOOL AND THE ABSENCE OF THE BLANKET FIELD, because the
     * failure to catch is somebody restoring `damageDoneMultiplier` beside it,
     * which would apply the bonus twice to the right school and once to every
     * wrong one.
     * ------------------------------------------------------------------------
     */
    expect(demonicSacrificeAura('imp')?.damageDoneBySchool).toEqual({
      shadow: DEMONIC_SACRIFICE_DAMAGE,
    });
    expect(demonicSacrificeAura('imp')?.damageDoneMultiplier).toBeUndefined();
    expect(demonicSacrificeAura('succubus')?.damageDoneBySchool).toEqual({
      fire: DEMONIC_SACRIFICE_DAMAGE,
    });
    expect(demonicSacrificeAura('succubus')?.damageDoneMultiplier).toBeUndefined();
    // Voidwalker restores mana and Felhunter health, neither of which moves a
    // damage figure for a profile nothing attacks.
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

describe('Wrack, scaling now, and still not worth casting', () => {
  /*
   * --------------------------------------------------------------------------
   * "Tears the target apart from within, dealing 36 Shadow damage every 1 sec
   * and increasing the damage they take from your other Shadow damage over
   * time effects by 10%. Lasts 6 sec." 200 mana, a six-second channel, new in
   * Forever, and rank 1 IS max.
   *
   * ONE HALF IS MODELLED NOW. The coefficient arrived from the ruleset owner
   * directly -- 14.3% of spell power a tick -- and the amplification clause did
   * not, so that one keeps its own words and is asserted to still say so.
   * --------------------------------------------------------------------------
   */
  it('ticks six times a second for a flat 36 plus 14.3% spell power each', () => {
    /*
     * WRITTEN OUT BY HAND from the owner's own message: "14.3% of spell power
     * each tick, ticks every second for 6 seconds, 6 total ticks."
     *
     * NOT FROM THE SHEET, which has no Wrack row -- so unlike every other
     * coefficient in the project this one cannot be re-checked against
     * `WoWSimWorksheet.xlsx`, and the provenance is recorded beside the
     * constant rather than only here.
     */
    expect(WRACK_TICK_DAMAGE).toBe(36);
    expect(WRACK_TICKS).toBe(6);
    expect(WRACK_TICK_SP_COEFFICIENT).toBe(0.143);
    expect(WRACK.castTimeMs).toBe(seconds(6));
    expect(WRACK.channelTicks).toBe(6);
    expect(WRACK.cost).toEqual({ resource: 'mana', amount: 200 });
    // Six ticks one second apart, which is what makes the tick figure per-tick.
    expect(WRACK.castTimeMs! / WRACK.channelTicks!).toBe(seconds(1));
  });

  it('adds the coefficient to the flat damage rather than replacing it', () => {
    /*
     * THE OWNER'S STANDING INSTRUCTION WITH THE SHEET -- "make sure that flat
     * ability damage doesn't get lost" -- and the risk is not the pipeline but
     * an edit that overwrites a `baseAmount` while setting a coefficient. So
     * this casts at ZERO spell power, where the coefficient contributes nothing
     * and what is left is the flat 36 a tick.
     */
    expect(damageFrom(WRACK, 0)).toBeCloseTo(WRACK_TICK_DAMAGE * WRACK_TICKS, 6);

    /*
     * AND AT REAL SPELL POWER the six ticks carry 0.858 between them, which is
     * Shadow Bolt's 0.857 delivered in twice the time. Asserted as the TOTAL
     * across the channel, because per-tick is what the constant states and the
     * total is what a reader compares against another spell.
     */
    const withPower = damageFrom(WRACK, 1000);
    const expected = WRACK_TICK_DAMAGE * WRACK_TICKS + 1000 * WRACK_TICK_SP_COEFFICIENT * WRACK_TICKS;
    expect(withPower).toBeCloseTo(expected, 6);
  });

  it('amplifies PERIODIC shadow damage only, which is what "other" buys', () => {
    /*
     * ----------------------------------------------------------------------
     * THE CLAUSE THAT WAS THE WHOLE REASON TO CAST IT, and the reason it went
     * unmodelled named the field it wanted: a plain Shadow vulnerability would
     * also raise Shadow Bolt, at over half of the SM/DS profile's damage.
     *
     * THE TWO ASSERTIONS ARE THE SPEC. `periodicDamageTakenBySchool` is read
     * only for a tick, and `damageTakenBySchool` -- which would reach every
     * Shadow cast -- must stay absent. The second one is what fails if somebody
     * "simplifies" this into the field beside it.
     *
     * WRACK'S OWN TICKS ARE CAST TICKS, because it is a channel, so they carry
     * no `periodic` flag and cannot be amplified by their own debuff. That is
     * what the tooltip's word "other" asks for and it falls out rather than
     * being special-cased.
     * ----------------------------------------------------------------------
     */
    expect(WRACK_DOT_AMPLIFICATION_PERCENT).toBe(10);
    expect(WRACK_AMPLIFICATION.periodicDamageTakenBySchool).toEqual({ shadow: 1.1 });
    expect(WRACK_AMPLIFICATION.damageTakenBySchool).toBeUndefined();
    // Six seconds from the FIRST tick, so `ignore` and not `reset`.
    expect(WRACK_AMPLIFICATION.durationMs).toBe(WRACK_DEBUFF_DURATION_MS);
    expect(WRACK_AMPLIFICATION.refreshBehaviour).toBe('ignore');
    // Its coefficient reason is gone too, and stayed gone.
    expect(WRACK.unmodelled).toBeUndefined();
  });

  it('is in no list, which the owner asked for outright', () => {
    /*
     * "It's unimportant for the rest of the simulator for now, there isn't a
     * profile that uses it." BOTH HALVES ARE BUILT NOW and it is still out,
     * because that is the owner's instruction and not a measurement of ours --
     * and this project has a documented rule that the owner's list outranks a
     * measured decision of ours.
     *
     * ONE LINE PUTS IT IN, and what it is worth is now genuinely an open
     * question rather than arithmetic: six ticks at 14.3% is Shadow Bolt's
     * 0.857 in twice the time, and against that sits 10% of the profile's
     * periodic damage for the six seconds the channel occupies. Thirty batches
     * of ten is what answers it.
     */
    expect(WARLOCK_AFFLICTION.map((entry) => entry.abilityId)).not.toContain('wrack');
  });

  it('is granted by the capstone, so only SM/DS carries one', () => {
    const smds = PRESETS_BY_ID.get('warlock_smds')!.build();
    expect(
      abilitiesForClass('warlock', 'caster', smds.talents).map((a) => a.id),
    ).toContain('wrack');

    const firelock = PRESETS_BY_ID.get('warlock_firelock')!.build();
    expect(
      abilitiesForClass('warlock', 'caster', firelock.talents).map((a) => a.id),
    ).not.toContain('wrack');
  });
});
