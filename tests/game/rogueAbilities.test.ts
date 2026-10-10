import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfileBatch, resourceFlowOf } from '../../src/simulator';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  GHOSTLY_STRIKE,
  PREPARATION,
  AMBUSH,
  AMBUSH_BASE_DAMAGE,
  AMBUSH_WEAPON_FRACTION,
  EVISCERATE_BY_COMBO_POINT,
  PREMEDITATION,
  PREMEDITATION_COMBO_POINTS,
  SINISTER_STRIKE_BASE_DAMAGE,
} from '../../src/game/abilities/rogue';
import {
  CUTTHROAT,
  CUTTHROAT_DURATION_MS,
  EXPOSE_ARMOR_PER_COMBO_POINT,
  RUPTURE_BY_COMBO_POINT,
  SLICE_AND_DICE_DURATIONS_MS,
  exposeArmorAura,
  ruptureAura,
  sliceAndDiceAura,
} from '../../src/game/auras/rogue';
import { ROGUE_TALENT_EFFECTS } from '../../src/game/talents/rogueEffects';
import { cutthroat } from '../../src/game/reactions/rogueTalents';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { castAbility, checkCast, seconds } from '../../src/engine';
import { comboPointsOn } from '../../src/game/combat/comboPoints';
import { talentNumber } from '../../src/game/talents/talentValues';
import { THISTLE_TEA_ABILITY } from '../../src/game/abilities/consumables';
import { BLOOD_FURY_ABILITY } from '../../src/game/racials/abilities';

/*
 * The Rogue's numbers, written out by hand from the beta client's spellbook
 * rather than read back out of the capture. A test that derived its
 * expectations from the file under test would pass whatever the file said.
 */

const rogue = () => createPlayer({ race: 'orc', characterClass: 'rogue' });

const batchOf = (preset: string, iterations: number, seed: number) => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return runProfileBatch({
    ...built,
    simulation: { ...built.simulation, iterations, seed },
  } as never);
};

describe('finishers scale with what they spend', () => {
  it('Eviscerate steps by 170 a point, from 278 to 958', () => {
    /*
     * The source gives ranges -- 224-332 at one point, 904-1,012 at five --
     * and every step is exactly 170 apart with every range exactly 108 wide.
     * The midpoints are taken and the spread dropped, because the combat table
     * supplies the variance a real cast shows.
     */
    expect(EVISCERATE_BY_COMBO_POINT).toEqual([278, 448, 618, 788, 958]);
    for (let i = 1; i < EVISCERATE_BY_COMBO_POINT.length; i += 1) {
      expect(EVISCERATE_BY_COMBO_POINT[i] - EVISCERATE_BY_COMBO_POINT[i - 1]).toBe(170);
    }
  });

  it('Rupture lengthens AND hardens, which Slice and Dice does not', () => {
    // Both halves scale for Rupture; only the duration does for Slice and Dice.
    expect(RUPTURE_BY_COMBO_POINT.map((e) => e.damage)).toEqual([159, 222, 295, 377, 469]);
    expect(RUPTURE_BY_COMBO_POINT.map((e) => e.durationMs / 1000)).toEqual([8, 10, 12, 14, 16]);
    expect(SLICE_AND_DICE_DURATIONS_MS.map((ms) => ms / 1000)).toEqual([9, 12, 15, 18, 21]);
  });

  it('Rupture ticks every two seconds, which every duration divides by', () => {
    /*
     * Eight, ten, twelve, fourteen and sixteen are all even. A three-second
     * cadence would leave a partial final tick on four of the five, and the
     * stated totals would not come out.
     */
    for (const entry of RUPTURE_BY_COMBO_POINT) {
      expect(entry.durationMs % 2000).toBe(0);
    }
    const five = ruptureAura(5);
    expect(five.durationMs).toBe(16_000);
    expect(five.periodic?.intervalMs).toBe(2000);
  });

  it('Expose Armor reaches exactly the Warrior five-stack Sunder figure', () => {
    // 450 a point, and 2,250 at five -- the same armor five Sunders produce.
    expect(EXPOSE_ARMOR_PER_COMBO_POINT).toBe(450);
    expect(exposeArmorAura(5).statModifiers?.[0].value).toBe(-2250);
    expect(exposeArmorAura(1).statModifiers?.[0].value).toBe(-450);
  });

  it('clamps out of range rather than reading past the table', () => {
    // Nothing should ever ask for six, but asking must not return undefined.
    expect(sliceAndDiceAura(9).durationMs).toBe(SLICE_AND_DICE_DURATIONS_MS[4]);
    expect(sliceAndDiceAura(0).durationMs).toBe(SLICE_AND_DICE_DURATIONS_MS[0]);
  });

  it('Improved Slice and Dice lengthens it, and rounds to a whole millisecond', () => {
    // 45% on nine seconds is 13.05 seconds, and time is integer milliseconds.
    const base = sliceAndDiceAura(1).durationMs;
    const improved = sliceAndDiceAura(1, 1.45).durationMs;
    expect(improved).toBe(Math.round(base * 1.45));
    expect(Number.isInteger(improved)).toBe(true);
  });
});

describe('the class is wired up', () => {
  it('gives a Rogue abilities, a rotation, energy and combo points', () => {
    const player = rogue();
    expect(player.abilities.all.length).toBeGreaterThan(0);
    expect(player.rotation).toBeDefined();
    expect(player.resources.has('energy')).toBe(true);
    expect(player.resources.has('comboPoints')).toBe(true);
  });

  it('declares an effect for every one of the 53 talents', () => {
    // A talent with no entry is indistinguishable from one that silently does
    // nothing, which is the whole reason this table is exhaustive.
    expect(Object.keys(ROGUE_TALENT_EFFECTS)).toHaveLength(53);
  });

  it('picks each build list from its capstone, not from a tree total', () => {
    /*
     * A Rogue is dual-wield in every spec and has no stance, so style and
     * stance cannot tell the three apart. A tree total is a number anyone can
     * hit by accident; a capstone is a deliberate choice.
     */
    expect(batchOf('rogue_venom', 1, 1).rotationName).toContain('Venom');
    expect(batchOf('rogue_combat', 1, 1).rotationName).toContain('Combat');
    expect(batchOf('rogue_rupture', 1, 1).rotationName).toContain('Rupture');
  });

  it('Sinister Strike is 68 on top of the weapon, and is what the list runs on', () => {
    expect(SINISTER_STRIKE_BASE_DAMAGE).toBe(68);
    const strikes = batchOf('rogue_combat', 40, 7).abilities.find(
      (a) => a.abilityName === 'Sinister Strike',
    );
    expect(strikes?.uses ?? 0).toBeGreaterThan(5);
  });

  it('casts the dagger abilities now that it holds daggers', () => {
    /*
     * ------------------------------------------------------------------------
     * THIS TEST USED TO ASSERT ZERO, AND IT WAS RIGHT AT THE TIME.
     *
     * The Rogues wore a Warrior's gear with a sword in each hand, so Backstab
     * and Mutilate were uncastable and the Venom list fell back to Sinister
     * Strike for its whole life. Their own `canCast` refused, which was the
     * honest behaviour -- and it meant the build the owner asked for was never
     * the build that ran.
     *
     * Perdition's Blade and Core Hound Tooth are both daggers, so it runs now.
     * The two are checked TOGETHER rather than individually, because which of
     * the two a priority list reaches is a rotation decision and not the thing
     * under test.
     * ------------------------------------------------------------------------
     */
    const venom = batchOf('rogue_venom', 20, 5);
    const uses = (name: string) =>
      venom.abilities.find((ability) => ability.abilityName === name)?.uses ?? 0;

    expect(uses('Mutilate') + uses('Backstab')).toBeGreaterThan(0);

    // Combat still swings swords, so it still cannot.
    const combat = batchOf('rogue_combat', 20, 5);
    const combatUses = (name: string) =>
      combat.abilities.find((ability) => ability.abilityName === name)?.uses ?? 0;
    expect(combatUses('Mutilate') + combatUses('Backstab')).toBe(0);
    expect(combatUses('Sinister Strike')).toBeGreaterThan(5);
  });
});

describe('the finishers it can now afford', () => {
  it('reaches Eviscerate, which it could not before the on-cast hook', () => {
    /*
     * --------------------------------------------------------------------------
     * THIS TEST USED TO ASSERT ZERO, and the assertion was right about the
     * behaviour and wrong about the cause.
     *
     * It recorded that Eviscerate never fired, measured at every Slice and Dice
     * threshold, and blamed RELENTLESS STRIKES being unmodelled. That was one
     * of two causes and the smaller one.
     *
     * THE OTHER WAS A BUG I SHIPPED. `talentValues.ts` maps a class to its
     * values file and the Rogue was not in it, so every rank value resolved to
     * nothing and EVERY ROGUE TALENT WAS SILENTLY INERT -- Malice, Aggression,
     * Improved Sinister Strike, all twenty of them. It was invisible because a
     * talent with no value reports itself `unmodelled`, which is exactly what
     * an unfinished class is supposed to say. Twenty unmodelled talents on a
     * class shipped yesterday looks like progress, not a defect.
     *
     * Both fixed, and the class works: Eviscerate fires about once a fight on
     * the Combat build and the three profiles gained 21, 55 and 88 DPS.
     * --------------------------------------------------------------------------
     */
    const batch = batchOf('rogue_combat', 60, 11);
    expect(batch.abilities.find((a) => a.abilityName === 'Eviscerate')?.uses ?? 0).toBeGreaterThan(
      0.5,
    );
  });

  it('returns energy on a finisher, per combo point spent', () => {
    /*
     * Relentless Strikes, which is what makes the finisher affordable at all.
     * Asserted through the ENERGY LEDGER rather than by counting procs, so it
     * measures the thing the rotation actually feels.
     */
    const batch = batchOf('rogue_combat', 60, 11);
    // ENERGY, not rage: Relentless Strikes restores energy. This read the
    // pooled totals before they were keyed by resource.
    const returned = resourceFlowOf(batch, 'energy').gained.find((row) => row.sourceId === 'relentless_strikes');
    expect(returned?.amount ?? 0).toBeGreaterThan(0);
  });

  it('measures the spend by snapshot, so a finisher needs to declare nothing', () => {
    /*
     * The engine snapshots every pool around a cast and reports the
     * difference, which covers the declared cost AND anything the ability
     * drained itself. Ruthlessness keys off that, and it fires only on a cast
     * that spent combo points -- so a builder must never set it off.
     */
    const batch = batchOf('rogue_combat', 60, 11);
    // COMBO POINTS, for the same reason.
    const refunded = resourceFlowOf(batch, 'comboPoints').gained.find((row) => row.sourceId === 'ruthlessness');
    expect(refunded?.amount ?? 0).toBeGreaterThan(0);
  });

  it('says on the results page what it cannot do', () => {
    /*
     * BLADE FLURRY ONLY, AND ADRENALINE RUSH IS NO LONGER ON THAT LIST. Blade
     * Flurry's haste half works and its second target does not exist here, so
     * the caveat is real and stays.
     *
     * THIS TEST PINNED A STALE LIMITATION AND IS WHY ONE SURVIVED SO LONG. Its
     * own comment asserted "the engine has no multiplier on it", which was
     * false when it was written -- `ResourceRegen.amountPerTick` has always
     * taken the actor. So a test named for what the page SAYS was quietly
     * enforcing that the page keep saying something untrue, and fixing the
     * ability is what finally failed it. The entry for a WORKING ability is the
     * thing to assert; the entry for a broken one should be removed WITH the
     * breakage.
     */
    const named = batchOf('rogue_combat', 20, 3).castButNotSimulated.map(
      (entry) => entry.abilityName,
    );
    expect(named).toContain('Blade Flurry');
    expect(named).not.toContain('Adrenaline Rush');
  });
});

describe('Preparation, and cooldown reset as an engine capability', () => {
  /*
   * --------------------------------------------------------------------------
   * "When activated, this ability immediately finishes the cooldown on your
   * other Rogue abilities." Free, instant, ten minutes.
   *
   * Its `unmodelled` reason was a statement about the ENGINE, and the right
   * one: "nothing can reset a cooldown from content -- the engine owns them."
   * `AbilityBook.resetCooldowns` is the engine saying so, and this is its only
   * caller.
   * --------------------------------------------------------------------------
   */
  const withCooldowns = () => {
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: [GHOSTLY_STRIKE, PREPARATION],
      resources: [{ type: 'energy', maximum: 100, initial: 100 }],
    });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
    simulation.begin();
    return { actor, target, simulation };
  };

  it('finishes another ability\'s cooldown', () => {
    const { actor, target, simulation } = withCooldowns();

    castAbility(simulation, actor, GHOSTLY_STRIKE, target);
    simulation.advanceTo(seconds(2));
    // Twenty second cooldown, two seconds in.
    expect(checkCast(simulation, actor, GHOSTLY_STRIKE, target)).toEqual({
      ok: false,
      reason: 'on_cooldown',
    });

    castAbility(simulation, actor, PREPARATION, undefined);
    // Past Preparation's own global cooldown, and well short of the eighteen
    // seconds Ghostly Strike had left -- so `on_gcd` cannot stand in for the
    // answer this is asking for.
    simulation.advanceTo(seconds(4));
    expect(checkCast(simulation, actor, GHOSTLY_STRIKE, target)).toEqual({ ok: true });
  });

  it('does NOT reset itself, which would make it unlimited', () => {
    /*
     * "Your OTHER Rogue abilities." A reset including itself would put a ten
     * minute cooldown back up instantly and hand the Rogue an unlimited
     * supply -- which is not visible as an error, only as a suspiciously good
     * Rogue.
     */
    const { actor, simulation } = withCooldowns();

    castAbility(simulation, actor, PREPARATION, undefined);
    simulation.advanceTo(seconds(4));
    expect(checkCast(simulation, actor, PREPARATION, undefined)).toEqual({
      ok: false,
      reason: 'on_cooldown',
    });

    expect(PREPARATION.cooldownMs).toBe(seconds(600));
  });

  it('resets a Rogue ability and leaves a potion and a racial alone', () => {
    /*
     * ==========================================================================
     * "YOUR OTHER *ROGUE* ABILITIES", AND THAT IS NARROWER THAN THE BOOK.
     *
     * `resetCooldowns(ability.id)` cleared everything the character had, and for
     * as long as a book held nothing but class abilities those were the same
     * set. They are not any more: a RACIAL is learned by a race and a mid-fight
     * CONSUMABLE by drinking one, and both are appended to the same book.
     *
     * WHAT IT COST: a Rogue drinking a second Thistle Tea -- a FIVE MINUTE
     * cooldown fired twice in a sixty second fight, measured at 2.00 casts on
     * the Rupture profile and 1.86 on Hemo, worth about thirty DPS of pure
     * inflation. A hundred energy that should not exist is a bigger number and
     * no error.
     *
     * AND THE TESTS ABOVE COULD NOT HAVE SEEN IT, WHICH IS WHY THIS ONE IS
     * SHAPED THE WAY IT IS. `withCooldowns` hands the actor a book of Ghostly
     * Strike and Preparation -- two Rogue abilities -- so the restriction had
     * nothing to restrict. A test whose fixture cannot express the mistake
     * proves nothing about it, which is the same lesson the stock Warlock list
     * taught about the interrupt check.
     *
     * THE RACIAL HALF IS WORTH 0.0 TODAY and is asserted anyway: Preparation is
     * only in the two SUBTLETY lists and both those profiles are Undead, whose
     * racial is a passive reaction rather than an ability with a cooldown. It
     * starts costing something the day a preset changes race.
     * ==========================================================================
     */
    const actor = makeAttacker({
      autoAttack: 'none',
      // A Rogue ability, a potion, and a racial, all in one book -- which is
      // exactly what `createPlayer` builds for a Rogue that drank something.
      abilities: [GHOSTLY_STRIKE, PREPARATION, THISTLE_TEA_ABILITY, BLOOD_FURY_ABILITY],
      resources: [{ type: 'energy', maximum: 100, initial: 100 }],
    });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
    simulation.begin();

    /*
     * THE TWO FREE ONES FIRST, AND THE ORDER IS LOAD-BEARING. Both are OFF the
     * global cooldown, which means they do not START one -- it does not mean
     * they ignore one that is running. Casting Ghostly Strike first put both of
     * them behind its GCD, so neither was cast, neither started a cooldown, and
     * the test failed asserting the thing it was written to prove.
     *
     * EVERY CAST IS CHECKED, which is the other half of that lesson: a refused
     * cast and a cast that happened look identical from the state afterwards.
     */
    expect(castAbility(simulation, actor, THISTLE_TEA_ABILITY, undefined).ok).toBe(true);
    expect(castAbility(simulation, actor, BLOOD_FURY_ABILITY, undefined).ok).toBe(true);
    expect(castAbility(simulation, actor, GHOSTLY_STRIKE, target).ok).toBe(true);
    simulation.advanceTo(seconds(2));

    castAbility(simulation, actor, PREPARATION, undefined);
    simulation.advanceTo(seconds(4));

    // The Rogue ability comes back, which is the effect.
    expect(checkCast(simulation, actor, GHOSTLY_STRIKE, target)).toEqual({ ok: true });
    // The potion and the racial do not.
    expect(checkCast(simulation, actor, THISTLE_TEA_ABILITY, undefined)).toEqual({
      ok: false,
      reason: 'on_cooldown',
    });
    expect(checkCast(simulation, actor, BLOOD_FURY_ABILITY, undefined)).toEqual({
      ok: false,
      reason: 'on_cooldown',
    });
  });

  it('is granted by the talent, so only the build that takes it has one', () => {
    const rupture = PRESETS_BY_ID.get('rogue_rupture')!.build();
    expect(rupture.talents.preparation).toBe(1);
    expect(
      abilitiesForClass('rogue', 'dual_wield', rupture.talents).map((a) => a.id),
    ).toContain('preparation');

    const venom = PRESETS_BY_ID.get('rogue_venom')!.build();
    expect(
      abilitiesForClass('rogue', 'dual_wield', venom.talents).map((a) => a.id),
    ).not.toContain('preparation');
  });
});

describe('Cutthroat, Ambush and Premeditation, none of which needed stealth', () => {
  /*
   * --------------------------------------------------------------------------
   * TWO OF THE ELEVEN "STEALTH MAKES THIS INERT" TALENTS WERE NEVER THAT.
   *
   * Cutthroat: "Your Backstab has a 15% chance to cause your next Ambush
   * within 10 sec to not require Stealth." An in-combat proc whose entire
   * purpose is to remove the stealth requirement -- so a fight that opens in
   * combat is the case it was written for. Its reason said "Makes Ambush
   * castable, and Ambush is absent", which was true of the second half and hid
   * the first.
   *
   * Premeditation: the FOREVER tooltip is "Adds 2 Combo Points to your target.
   * You must add to or use those combo points within 20 sec or the combo
   * points are lost" -- no stealth clause at all, and the capture marks it
   * `changed` against Classic. Its reason read Classic's requirement into a
   * Forever ability.
   * --------------------------------------------------------------------------
   */
  const subtletyRogue = () => {
    const built = PRESETS_BY_ID.get('rogue_rupture')!.build();
    return { built, book: abilitiesForClass('rogue', 'dual_wield', built.talents) };
  };

  it('reads Cutthroat at 15% and a ten second window from the values file', () => {
    // Rank 5 of 5, which is what the Rupture build takes. Written out by hand.
    expect(talentNumber('rogue', 'cutthroat', 5, 0)).toBe(15);
    expect(talentNumber('rogue', 'cutthroat', 5, 1)).toBe(10);
    expect(CUTTHROAT_DURATION_MS).toBe(seconds(10));
    // A second proc starts a fresh window rather than extending the one running.
    expect(CUTTHROAT.refreshBehaviour).toBe('reset');
  });

  it('procs only off Backstab, and only when it connected', () => {
    const reaction = cutthroat(100);
    expect(reaction.on).toBe('dealt');
    // A Backstab that was dodged is not a Backstab that happened.
    expect(reaction.outcomes).toEqual(['hit', 'crit']);

    const actor = makeAttacker({ autoAttack: 'none' });
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();

    const attack = (abilityId: string) =>
      reaction.canTrigger?.(simulation, actor, { abilityId } as never) ?? true;
    expect(attack('backstab')).toBe(true);
    expect(attack('sinister_strike')).toBe(false);
    expect(attack('hemorrhage')).toBe(false);
  });

  it('makes Ambush castable ONLY while the buff is up, and spends it on cast', () => {
    /*
     * The ruleset owner's ruling in one assertion: there is no stealth system,
     * the aura IS the gate, and it is spent by the CAST rather than the hit --
     * a dodged Ambush was still the next one, and the Rogue has already paid
     * the energy.
     */
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: [AMBUSH],
      weapons: { mainHand: { name: 'Dagger', weaponType: 'dagger', baseDamage: 100, swingTimerMs: 1800 } },
      resources: [{ type: 'energy', maximum: 100, initial: 100 }],
    });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    simulation.begin();

    expect(checkCast(simulation, actor, AMBUSH, target)).toEqual({
      ok: false,
      reason: 'condition_failed',
    });

    simulation.applyAura(actor, CUTTHROAT, actor.id);
    expect(checkCast(simulation, actor, AMBUSH, target)).toEqual({ ok: true });

    castAbility(simulation, actor, AMBUSH, target);
    expect(actor.auras.has('cutthroat')).toBe(false);
  });

  it('is in every Rogue book and castable by one build, which is correct', () => {
    /*
     * Ambush is a TRAINER ability rather than a talent, so a Venom or Combat
     * Rogue carries one it can never cast. That is the honest state of the
     * ability: the thing that gates it is Cutthroat, and they do not take it.
     */
    for (const preset of ['rogue_venom', 'rogue_combat', 'rogue_rupture']) {
      const built = PRESETS_BY_ID.get(preset)!.build();
      const ids = abilitiesForClass('rogue', 'dual_wield', built.talents).map((a) => a.id);
      expect(ids, preset).toContain('ambush');
    }

    // Premeditation IS a talent, and only the build that takes it has it.
    const { built } = subtletyRogue();
    expect(built.talents.premeditation).toBe(1);
    const rupture = abilitiesForClass('rogue', 'dual_wield', built.talents).map((a) => a.id);
    expect(rupture).toContain('premeditation');

    const combat = PRESETS_BY_ID.get('rogue_combat')!.build();
    expect(
      abilitiesForClass('rogue', 'dual_wield', combat.talents).map((a) => a.id),
    ).not.toContain('premeditation');
  });

  it('banks Premeditation\'s two points ON THE TARGET, which is the trap', () => {
    /*
     * Combo points belong to a target here. Anything granting them without
     * setting `comboPointTargetId` leaves the pool pointing at nobody, and
     * every finisher then refuses to spend -- which reads as an ability that
     * lost its flat damage rather than as a bookkeeping error.
     */
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: [PREMEDITATION],
      resources: [{ type: 'comboPoints', maximum: 5, initial: 0 }],
    });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    simulation.begin();

    castAbility(simulation, actor, PREMEDITATION, target);

    expect(PREMEDITATION_COMBO_POINTS).toBe(2);
    expect(actor.comboPointTargetId).toBe(target.id);
    // Asked THROUGH the target, which returns zero when the pool belongs to
    // someone else -- so this passing is the whole assertion.
    expect(comboPointsOn(actor, target)).toBe(2);
  });

  it('states Ambush at 250% weapon damage plus 290', () => {
    // Written out by hand from the capture, rank 6.
    expect(AMBUSH_BASE_DAMAGE).toBe(290);
    expect(AMBUSH_WEAPON_FRACTION).toBe(2.5);
    expect(AMBUSH.cost).toEqual({ resource: 'energy', amount: 60 });
  });

  it('no longer reports either talent as stealth-blocked', () => {
    for (const id of ['cutthroat', 'premeditation']) {
      for (const effect of ROGUE_TALENT_EFFECTS[id]) {
        expect(effect.kind, id).not.toBe('unmodelled');
      }
    }
  });
});

describe('Lethality, which named six abilities and could not reach them', () => {
  /*
   * ============================================================================
   * "INCREASES THE CRITICAL STRIKE DAMAGE BONUS OF YOUR SINISTER STRIKE, GOUGE,
   * BACKSTAB, MUTILATE, GHOSTLY STRIKE, AND HEMORRHAGE ABILITIES BY {0}%."
   *
   * ITS `unmodelled` REASON WAS EXACT AND NAMED THE FIELD: none of the three
   * scopes selects a LIST, and `critMultiplierBonus` on `AbilityModifiers`
   * existed with no talent effect reaching it. `abilityCritDamage` is that
   * declaration, built for the Warlock's Pandemic, which wanted the identical
   * mechanism -- one build, two classes.
   *
   * THE MELEE HALF IS 1.0, so 5/5's +20% takes a crit from 2.0x to 2.2x. The
   * SPELL half would give 2.1x, which is plausible and half the talent -- which
   * is why `abilityCritDamage` declares its table rather than deriving it.
   *
   * ALL THREE ROGUE PROFILES TAKE IT, at 5, 4 and 2 points.
   * ============================================================================
   */
  const rogue = (preset: string) => {
    const built = PRESETS_BY_ID.get(preset)!.build();
    return createPlayer({
      race: 'orc',
      characterClass: 'rogue',
      combatStyle: 'dual_wield',
      talents: built.talents,
      equipment: built.equipment,
    });
  };

  it('scales with rank, on the MELEE crit half', () => {
    // Venom 5/5 is 20%, Combat 4/5 is 16%, Rupture 2/5 is 8%.
    expect(rogue('rogue_venom').abilityModifiers.for('sinister_strike').critMultiplierBonus)
      .toBeCloseTo(0.2, 6);
    expect(rogue('rogue_combat').abilityModifiers.for('sinister_strike').critMultiplierBonus)
      .toBeCloseTo(0.16, 6);
    expect(rogue('rogue_rupture').abilityModifiers.for('sinister_strike').critMultiplierBonus)
      .toBeCloseTo(0.08, 6);
  });

  it('reaches the five abilities it names that exist, and nothing else', () => {
    const venom = rogue('rogue_venom');
    for (const id of ['sinister_strike', 'backstab', 'mutilate', 'ghostly_strike', 'hemorrhage']) {
      expect(venom.abilityModifiers.for(id).critMultiplierBonus, id).toBeCloseTo(0.2, 6);
    }
    /*
     * THE CONTAINMENT CHECK. Eviscerate is the ability a Rogue list spends most
     * of its combo points on and the talent does not name it -- a
     * whole-character or per-table reading would have swept it up and produced a
     * larger, entirely plausible figure.
     */
    expect(venom.abilityModifiers.for('eviscerate').critMultiplierBonus ?? 0).toBe(0);
    expect(venom.attackTableModifiers.for('melee-special').critMultiplierBonus ?? 0).toBe(0);
  });
});
