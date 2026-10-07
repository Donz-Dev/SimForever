import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import type { Ability, TelemetryEvent } from '../../src/engine';
import { NO_CHANCES, castAbility, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import {
  BANE_OF_AGONY_SP_COEFFICIENT,
  WRACK_TICK_SP_COEFFICIENT,
} from '../../src/game/combat/coefficients';
import { WARLOCK_AFFLICTION, WARLOCK_DESTRUCTION } from '../../src/game/rotations/warlock';
import {
  CONFLAGRATE_DAMAGE,
  CONFLAGRATE_KEEPS_IMMOLATE,
  INCINERATE_DAMAGE,
  INCINERATE_IMMOLATE_BONUS,
  AMPLIFY_CURSE,
  BANE_OF_AGONY_ABILITY,
  LIFE_TAP,
  LIFE_TAP_AMOUNT,
  SEARING_PAIN_DAMAGE,
  SHADOWBURN,
  SHADOWBURN_DAMAGE,
  SHADOWBURN_MANA,
  SHADOWBURN_REFUNDS_SHARD,
  SHADOW_BOLT_DAMAGE,
  WRACK,
  WRACK_CHANNEL_MS,
  WRACK_TICKS,
  WRACK_TICK_DAMAGE,
} from '../../src/game/abilities/warlock';
import {
  AMPLIFY_CURSE_MULTIPLIER,
  BANE_OF_AGONY,
  BANE_OF_AGONY_AMPLIFIED,
  BANE_OF_AGONY_DURATION_MS,
  BANE_OF_AGONY_TICKS,
  BANE_OF_AGONY_TICK_INTERVAL_MS,
  BANE_OF_AGONY_TICK_SHARES,
  BANE_OF_AGONY_TOTAL,
  CORRUPTION,
  CORRUPTION_TOTAL,
  SIPHON_LIFE,
  baneOfAgonyTickShare,
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

  it('taps its own life for mana, and the SM/DS entry no longer reaches it', () => {
    /*
     * ------------------------------------------------------------------------
     * THIS ASSERTED A CAST COUNT TWICE AND HAS NOW BEEN WRONG TWICE. It wanted
     * more than three taps a fight, fell to about 2.6 when the preset raid
     * buffs gained Blessing of Wisdom and Mana Spring Totem, was loosened to
     * "more than one", and is now **ZERO** -- because Wrack entered the list
     * above it.
     *
     * WHY: Wrack is 200 mana against Shadow Bolt's 380, and it displaced nine
     * Shadow Bolt casts a fight. Measured, this profile now GAINS 8,236 mana
     * and SPENDS 6,034, so `manaBelowFraction(0.15)` is never true and the
     * entry is unreachable. That is the entry's condition reading a state the
     * fight no longer enters -- a documented cause of a never-fired entry, and
     * not a broken declaration.
     *
     * SO THE SUBJECT CHANGES TO THE MECHANISM, which is what should have been
     * asserted all along: a cast count is a ROTATION outcome and this one has
     * now been invalidated by a raid-buff change and a list change in turn. The
     * mechanism is Life Tap's alone and does not move when either does.
     *
     * THE ENTRY STAYS IN THE LIST. It is the ruleset owner's, and the owner's
     * list outranks a measured decision of ours -- so the honest state is a
     * live entry that this encounter cannot reach, recorded rather than
     * removed. A profile that spent more mana would reach it immediately.
     * ------------------------------------------------------------------------
     */
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: [LIFE_TAP],
      maxHealth: 10_000,
      resources: [{ type: 'mana', maximum: 10_000 }],
    });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target], { durationMs: seconds(30) });

    // Drain the pool, or its own `canCast` refuses a tap into a full bar.
    actor.resources.get('mana')!.spend(9_000);
    const healthBefore = actor.health.current;
    const manaBefore = actor.resources.get('mana')!.current;

    castAbility(simulation, actor, actor.abilities.get('life_tap')!, target);

    // Health for mana, one for one, at the figure foreverchanges.pro states.
    expect(healthBefore - actor.health.current).toBe(LIFE_TAP_AMOUNT);
    expect(actor.resources.get('mana')!.current - manaBefore).toBe(LIFE_TAP_AMOUNT);

    // And it is still in the owner's list, unreached rather than removed.
    expect(WARLOCK_AFFLICTION.map((e) => e.abilityId)).toContain('life_tap');
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

  it('is in the SM/DS list, between Life Tap and Shadow Bolt', () => {
    /*
     * ------------------------------------------------------------------------
     * THE OWNER'S OWN POSITION, AND THIS TEST USED TO ASSERT THE OPPOSITE.
     * "It's unimportant for the rest of the simulator for now, there isn't a
     * profile that uses it" was the instruction, and the owner has withdrawn
     * it -- so this is the documented case of a test that PINS A ROTATION
     * DECISION giving way when the decision changes owner. The figure the old
     * test carried was not a reason to keep it out; it was an open question,
     * and it is answered now.
     *
     * THE POSITION IS ASSERTED AND NOT JUST THE PRESENCE, because the position
     * is the half the owner specified and the half that matters: above Shadow
     * Bolt it displaces the filler, and below it would never be reached.
     * ------------------------------------------------------------------------
     */
    const ids = WARLOCK_AFFLICTION.map((entry) => entry.abilityId);
    expect(ids).toContain('wrack');
    expect(ids.indexOf('wrack')).toBe(ids.indexOf('life_tap') + 1);
    /*
     * `lastIndexOf` FOR THE FILLER, AND THAT IS NOT A DETAIL. Shadow Bolt is in
     * this list TWICE on purpose -- gated on Shadow Trance at the top, ungated
     * as the filler at the bottom -- which is the documented legal shape. This
     * assertion read `indexOf` and therefore found the GATED copy at index 1,
     * so it broke the moment the proc entry went in, having been correct only
     * while there was one Shadow Bolt. The filler is the one Wrack sits above.
     */
    expect(ids.indexOf('wrack')).toBe(ids.lastIndexOf('shadow_bolt') - 1);
    expect(ids.filter((id) => id === 'shadow_bolt')).toHaveLength(2);
  });

  it('is gated on all three bleeds outlasting the channel', () => {
    /*
     * ------------------------------------------------------------------------
     * THE OWNER'S CONDITION -- "all three bleeds having six seconds left" --
     * and six seconds is exactly the channel, which is why the gate reads
     * `WRACK_CHANNEL_MS` rather than a literal.
     *
     * WHY IT MATTERS: a channel LOCKS THE CASTER for its whole duration, so
     * committing to one while Corruption is about to drop trades that bleed's
     * remaining ticks for Wrack's. The entry is asking "can I afford to stop
     * acting for six seconds", and ALL three have to answer yes.
     *
     * THE NEW CONDITION PRIMITIVE IS THE THING MOST LIKELY TO BE SILENTLY
     * WRONG -- a window that never opens fires zero times and errors nothing,
     * which has happened in this project before -- so each of the three bleeds
     * is dropped below the line on its own.
     * ------------------------------------------------------------------------
     */
    const entry = WARLOCK_AFFLICTION.find((e) => e.abilityId === 'wrack')!;
    const bleeds = [CORRUPTION, BANE_OF_AGONY, SIPHON_LIFE];

    const canCast = (shortOne?: string): boolean => {
      const caster = makeAttacker({ autoAttack: 'none' });
      const target = makeTarget({ maxHealth: 100_000_000 });
      const simulation = buildSimulation([caster, target], { durationMs: seconds(60) });
      for (const aura of bleeds) simulation.applyAura(target, aura, caster.id);
      /*
       * Advance until the named bleed has LESS than the channel left, which is
       * the only way to make one short without inventing an aura -- and it is
       * what the fight actually does to them.
       */
      if (shortOne) {
        const def = bleeds.find((a) => a.id === shortOne)!;
        simulation.advanceTo(def.durationMs - WRACK_CHANNEL_MS + 1);
      }
      return entry.condition!(simulation, caster, target);
    };

    // All three fresh, so all three outlast the channel.
    expect(canCast()).toBe(true);
    // Each one short on its own is enough to refuse it.
    for (const aura of bleeds) {
      expect(canCast(aura.id), aura.id).toBe(false);
    }
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

describe("Bane of Agony's ramp, which the owner has now quantified", () => {
  /*
   * ============================================================================
   * THE OWNER'S WORDS: "ticks every 2 seconds, lasts 24 seconds, benefits from
   * 160% of the character sheet spell power. Base Damage is 552, so with a
   * character that had 500 spell power it becomes: 552 + 500 * 1.6 = 1352 total
   * damage. This is the way the damage ramps: first 4 ticks = 1/24th total
   * damage each, next 4 ticks = 1/12th total damage each, last 4 ticks = 1/8th
   * total damage each."
   *
   * WRITTEN OUT BY HAND FROM THAT MESSAGE, including the worked example, which
   * is the second independent check: the bands could be right while the total
   * was wrong, and 1352 catches that.
   *
   * IT SUPERSEDES `WoWSimWorksheet.xlsx`, which gives 13.3% a tick -- 1.064 in
   * total over the eight ticks it then had, against 1.6 now.
   * ============================================================================
   */
  const SPELL_POWER = 500;
  const OWNER_TOTAL_AT_500 = 1352;

  /** Every Bane tick of one application, in order. */
  const ticksOf = (definition: typeof BANE_OF_AGONY) => {
    const events: TelemetryEvent[] = [];
    const caster = makeAttacker({ autoAttack: 'none', stats: { spellPower: SPELL_POWER } });
    const target = makeTarget({ maxHealth: 100_000_000 });
    const simulation = buildSimulation(
      [caster, target],
      {
        durationMs: seconds(60),
        // No crits, so each tick is its share exactly.
        attackChances: () => ({ ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1.5 }),
      },
      { emit: (event) => events.push(event) },
    );
    simulation.applyAura(target, definition, caster.id);
    simulation.advanceTo(seconds(30));
    return events.filter(
      (event) => event.type === 'damage' && event.abilityId === 'bane_of_agony',
    ) as Array<{ amount: number; timestamp: number }>;
  };

  it('splits the total into three bands of four that sum to exactly 1', () => {
    expect(BANE_OF_AGONY_TICK_SHARES).toHaveLength(12);
    expect(BANE_OF_AGONY_TICK_SHARES.slice(0, 4)).toEqual([1 / 24, 1 / 24, 1 / 24, 1 / 24]);
    expect(BANE_OF_AGONY_TICK_SHARES.slice(4, 8)).toEqual([1 / 12, 1 / 12, 1 / 12, 1 / 12]);
    expect(BANE_OF_AGONY_TICK_SHARES.slice(8)).toEqual([1 / 8, 1 / 8, 1 / 8, 1 / 8]);
    /*
     * THE SUM IS THE CHECK THAT THE RAMP REDISTRIBUTES RATHER THAN INFLATES.
     * Any set of bands can be made plausible; only one set leaves the stated
     * 24-second total alone.
     */
    expect(BANE_OF_AGONY_TICK_SHARES.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });

  it('ticks twelve times, two seconds apart, over twenty-four seconds', () => {
    expect(BANE_OF_AGONY_TICK_INTERVAL_MS).toBe(seconds(2));
    expect(BANE_OF_AGONY_DURATION_MS).toBe(seconds(24));
    expect(BANE_OF_AGONY_TICKS).toBe(12);

    const ticks = ticksOf(BANE_OF_AGONY);
    expect(ticks).toHaveLength(12);
    ticks.forEach((tick, index) => {
      expect(tick.timestamp, `tick ${index + 1}`).toBe(seconds(2) * (index + 1));
    });
  });

  it("reproduces the owner's worked example: 552 + 500 * 1.6 = 1352", () => {
    expect(BANE_OF_AGONY_TOTAL).toBe(552);
    expect(BANE_OF_AGONY_SP_COEFFICIENT).toBe(1.6);
    expect(BANE_OF_AGONY_TOTAL + SPELL_POWER * BANE_OF_AGONY_SP_COEFFICIENT).toBe(
      OWNER_TOTAL_AT_500,
    );

    // And the twelve ticks deliver exactly that, which is the pipeline agreeing
    // with the arithmetic rather than the arithmetic agreeing with itself.
    const total = ticksOf(BANE_OF_AGONY).reduce((n, t) => n + t.amount, 0);
    expect(total).toBeCloseTo(OWNER_TOTAL_AT_500, 6);
  });

  it('is back-loaded in a 1:2:3 ratio, which is 50/100/150% of the average', () => {
    /*
     * CLASSIC'S SHAPE AT A DIFFERENT RESOLUTION, and worth pinning because the
     * old caveat GUESSED this ratio with no authority to assert it. The flat
     * share over twelve ticks is 1/12, so the bands are half, equal to, and
     * half again the average.
     */
    const ticks = ticksOf(BANE_OF_AGONY).map((t) => t.amount);
    expect(ticks[0]).toBeCloseTo(OWNER_TOTAL_AT_500 / 24, 6);
    expect(ticks[4]).toBeCloseTo(OWNER_TOTAL_AT_500 / 12, 6);
    expect(ticks[8]).toBeCloseTo(OWNER_TOTAL_AT_500 / 8, 6);
    expect(ticks[4]! / ticks[0]!).toBeCloseTo(2, 6);
    expect(ticks[8]! / ticks[0]!).toBeCloseTo(3, 6);
  });

  it('restarts the ramp on a refresh, because a reset moves appliedAt', () => {
    /*
     * `baneOfAgonyTickShare` reads the aura's own clock rather than a counter,
     * so `refreshBehaviour: 'reset'` carries the ramp with it -- which is what
     * reset means everywhere else in this engine. Asserted on the pure function
     * so it needs no fight.
     */
    expect(baneOfAgonyTickShare(seconds(2))).toBeCloseTo(1 / 24, 12);
    expect(baneOfAgonyTickShare(seconds(10))).toBeCloseTo(1 / 12, 12);
    expect(baneOfAgonyTickShare(seconds(24))).toBeCloseTo(1 / 8, 12);
    // Clamped at both ends: a tick at or past the end reads the last band.
    expect(baneOfAgonyTickShare(0)).toBeCloseTo(1 / 24, 12);
    expect(baneOfAgonyTickShare(seconds(99))).toBeCloseTo(1 / 8, 12);
  });

  it('is amplified by exactly 50% when Amplify Curse is up, and only once', () => {
    /*
     * ------------------------------------------------------------------------
     * THE AMPLIFICATION TRAVELS WITH THE AURA, not with the cast. That is the
     * whole reason this talent did not need the one-shot per-ability DAMAGE
     * modifier its `unmodelled` reason asked for: the 50% applies to ticks
     * landing over the next twenty-four seconds, and a `CastModifier` is spent
     * at the cast.
     * ------------------------------------------------------------------------
     */
    const plain = ticksOf(BANE_OF_AGONY).reduce((n, t) => n + t.amount, 0);
    const amplified = ticksOf(BANE_OF_AGONY_AMPLIFIED).reduce((n, t) => n + t.amount, 0);
    expect(AMPLIFY_CURSE_MULTIPLIER).toBe(1.5);
    expect(amplified / plain).toBeCloseTo(AMPLIFY_CURSE_MULTIPLIER, 6);
    // Both definitions share the id, which is what keeps every talent and the
    // priority list's `expired('bane_of_agony')` reaching them equally.
    expect(BANE_OF_AGONY_AMPLIFIED.id).toBe(BANE_OF_AGONY.id);
  });
});

describe('Amplify Curse, the opener', () => {
  it('is instant, free, off the global cooldown, and on three minutes', () => {
    /*
     * "A cooldown that needs to be cast before applying the first Bane of Agony
     * of the fight. It does not trigger a global cooldown" -- the owner, and the
     * GCD half is what makes it worth a talent point in a sixty-second fight.
     *
     * FREE IS A STATEMENT, NOT A GAP: the spellbook capture gives it a cooldown
     * and a cast and no cost line, exactly as it does for Demonic Sacrifice.
     */
    expect(AMPLIFY_CURSE.triggersGcd).toBe(false);
    expect(AMPLIFY_CURSE.cost).toBeUndefined();
    expect(AMPLIFY_CURSE.castTimeMs ?? 0).toBe(0);
    expect(AMPLIFY_CURSE.cooldownMs).toBe(seconds(180));
  });

  it('is consumed by the Bane it precedes, so a second Bane is unamplified', () => {
    const caster = makeAttacker({
      autoAttack: 'none',
      abilities: [AMPLIFY_CURSE, BANE_OF_AGONY_ABILITY],
      resources: [{ type: 'mana', maximum: 100_000 }],
    });
    const target = makeTarget({ maxHealth: 100_000_000 });
    const simulation = buildSimulation([caster, target], { durationMs: seconds(120) });

    castAbility(simulation, caster, caster.abilities.get('amplify_curse')!, target);
    expect(caster.auras.has('amplify_curse')).toBe(true);

    castAbility(simulation, caster, caster.abilities.get('bane_of_agony')!, target);
    // Spent by the application, which is what "your NEXT" means.
    expect(caster.auras.has('amplify_curse')).toBe(false);
    expect(target.auras.has('bane_of_agony')).toBe(true);
  });

  it('is cast exactly once a fight, before the first Bane of Agony', () => {
    /*
     * The three-minute cooldown is what makes "once" true without a condition
     * saying so, and the list puts it first. Its own entry is ungated, which is
     * only safe BECAUSE of that cooldown -- an ungated entry with no cooldown
     * would be a floor under everything below it.
     */
    const ids = WARLOCK_AFFLICTION.map((entry) => entry.abilityId);
    expect(ids[0]).toBe('amplify_curse');
    expect(ids.indexOf('amplify_curse')).toBeLessThan(ids.indexOf('bane_of_agony'));

    const batch = batchOf('warlock_smds', 30, 9);
    expect(batch.abilities.find((a) => a.abilityName === 'Amplify Curse')?.uses ?? 0)
      .toBeCloseTo(1, 1);
  });
});

describe('Siphon Life, the one damage-over-time effect that cannot crit', () => {
  it('rolls no crit at all, where every other Warlock DoT does', () => {
    /*
     * ------------------------------------------------------------------------
     * THE OWNER'S RULING, and it is an exception to a Forever rule rather than
     * a change to it: every damage-over-time effect in this ruleset can crit,
     * which is what makes Siphon Life worth stating separately.
     *
     * ASSERTED BY SCRIPTING A GUARANTEED CRIT. With `crit` at the top of the
     * roll space every tick that CAN crit does, so a Corruption tick comes back
     * multiplied and a Siphon Life tick does not. Reading `critFrom` off the
     * definition would test the declaration; this tests the behaviour.
     * ------------------------------------------------------------------------
     */
    const tickOnce = (definition: typeof CORRUPTION) => {
      const events: TelemetryEvent[] = [];
      const caster = makeAttacker({ autoAttack: 'none' });
      const target = makeTarget({ maxHealth: 100_000_000 });
      const simulation = buildSimulation(
        [caster, target],
        {
          durationMs: seconds(60),
          // Everything that can crit, does.
          attackChances: () => ({ ...NO_CHANCES, crit: 10_000, critMultiplier: 1.5 }),
        },
        { emit: (event) => events.push(event) },
      );
      simulation.applyAura(target, definition, caster.id);
      simulation.advanceTo(seconds(4));
      return events.filter(
        (event) => event.type === 'damage' && event.abilityId === definition.id,
      ) as Array<{ amount: number; critical?: boolean }>;
    };

    const corruption = tickOnce(CORRUPTION);
    expect(corruption.length).toBeGreaterThan(0);
    expect(corruption.every((t) => t.critical === true)).toBe(true);

    const siphon = tickOnce(SIPHON_LIFE);
    expect(siphon.length).toBeGreaterThan(0);
    expect(siphon.some((t) => t.critical === true)).toBe(false);
  });

  it('is still worth casting, which is what the owner asked', () => {
    /*
     * ------------------------------------------------------------------------
     * +13.6 DPS, measured over thirty batches of ten: 476.5 with its entry and
     * 462.9 without. So the answer is yes, even having lost its crits -- which
     * cost 4.3 on their own.
     *
     * AND THE FIRST ANSWER WAS WRONG BY A FACTOR OF TWO. Simply removing the
     * entry reads 452.4, which looks like -24.1 -- but `WARLOCK_AFFLICTION`
     * gates Wrack on all three bleeds having six seconds left, and one of the
     * three is Siphon Life. Without it the gate can never open, so that figure
     * is the loss of Siphon Life AND Wrack together. The honest measurement
     * repairs the gate first. See the comment on the Wrack entry.
     * ------------------------------------------------------------------------
     */
    const ids = WARLOCK_AFFLICTION.map((entry) => entry.abilityId);
    expect(ids).toContain('siphon_life');
    // The coupling itself, pinned: Wrack's gate names Siphon Life, so anyone
    // removing the latter has to repair the former.
    const wrack = WARLOCK_AFFLICTION.find((entry) => entry.abilityId === 'wrack');
    expect(wrack?.condition).toBeDefined();
  });
});

describe('Firelock casts no Corruption, by the owner\'s instruction', () => {
  it('has it in neither the list nor the fight', () => {
    /*
     * IT WAS 10.3% OF THE PROFILE AND COSTS -0.4 TO REMOVE, which is inside the
     * interval: a 2-second cast and a global cooldown on a Shadow bleed this
     * build's talents barely touch, against an Incinerate that is 25% larger
     * on a burning target. Firelock takes no Malediction, no Improved
     * Corruption and no Shadow Mastery, and Ruin and Agonizing Flames stop at
     * the Destruction tree.
     */
    expect(WARLOCK_DESTRUCTION.map((entry) => entry.abilityId)).not.toContain('corruption');

    const batch = batchOf('warlock_firelock', 20, 4);
    expect(batch.abilities.find((a) => a.abilityName === 'Corruption')?.uses ?? 0).toBe(0);
  });
});
