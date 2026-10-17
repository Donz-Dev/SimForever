import { describe, expect, it } from 'vitest';
import { CHARGE, CHARGE_RAGE_GENERATED, SPEARING_STRIKE } from '../../src/game/abilities/warrior';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import {
  WARRIOR_DUAL_WIELD_BERSERKER,
  WARRIOR_SHIELD_DEFENSIVE,
  WARRIOR_TWO_HAND_BATTLE,
} from '../../src/game/rotations/warrior';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { talentBuild, talentContextFor } from '../../src/game/talents/talentBuild';
import { weaponsFor } from '../../src/game/actors/createPlayer';
import { PRESETS_BY_ID, PROFILE_PRESETS } from '../../src/profiles/presets';
import { runProfileBatch, characterAtCombatStart, resourceFlowOf } from '../../src/simulator';
import { legalise } from '../helpers/legalTalents';
/*
 * NO `compiled` HELPER ANY MORE. It turned a condition back into the closure
 * the engine runs, and both of its callers were asserting on the CHARGE
 * ENTRY'S condition -- which the owner has moved to `precombat`, where
 * `castAbility`'s own stance check does the job the condition did. Both
 * assertions now read the resulting STATE instead, which is what they were
 * really about and survives the gate moving again.
 */

/*
 * Charge at the pull, Vanguard as its gate, and Master of Defense's shield.
 *
 * Three rulings from the ruleset owner that all land on the same seam: an
 * ability or a proc whose availability depends on something outside the
 * ability itself -- the clock, the stance, the off hand.
 */

const preset = (id: string, iterations = 200) => {
  const built = PRESETS_BY_ID.get(id)!.build();
  return { ...built, simulation: { ...built.simulation, iterations, seed: 4242 } } as never;
};

/** The same preset's talent allocation, which `preset` casts away to `never`. */
const presetTalents = (id: string): Record<string, number> =>
  PRESETS_BY_ID.get(id)!.build().talents;

const casts = (id: string, name: string) => {
  const batch = runProfileBatch(preset(id));
  return batch.abilities.find((a) => a.abilityName === name)?.uses ?? 0;
};

/** What a warrior of this combat style and allocation actually knows. */
const abilityIds = (style: 'two_hander' | 'dual_wield' | 'one_hand_shield', talents: object) =>
  abilitiesForClass('warrior', style, talents as never).map((ability) => ability.id);

// ---------------------------------------------------------------------------
// Charge
// ---------------------------------------------------------------------------

describe('Charge is used exactly once, as the first action', () => {
  it('is castable only at timestamp zero', () => {
    /*
     * "Cannot be used in combat." Every fight here opens in combat, so the
     * only legal moment is the instant before anything has happened.
     *
     * ONCE FALLS OUT OF THE RULE rather than being counted: the clock passes
     * zero exactly once. A "has cast it" flag would instead allow a second
     * Charge at fifteen seconds if the first were ever skipped.
     */
    const at = (now: number) =>
      CHARGE.canCast?.({ simulation: { clock: { now: () => now } } } as never) ?? true;

    expect(at(0)).toBe(true);
    expect(at(1)).toBe(false);
    expect(at(15_000)).toBe(false); // its own cooldown would have elapsed
  });

  it('opens the two-hander and Protection PROFILES, and no others', () => {
    /*
     * ========================================================================
     * THIS READ "lists" AND CHARGE IS IN NO LIST ANY MORE.
     *
     * The owner moved it to `precombat` on both profiles -- "Charge ... should
     * be removed from the normal APL" -- which is where an action castable for
     * a single instant belongs: `runPrecombat` is not on the fight's clock, so
     * it cannot be beaten to the moment by anything.
     *
     * THE CLAIM IS UNCHANGED AND IS NOW ASSERTED WHERE IT LIVES: exactly two
     * profiles Charge, and both do it at 0 seconds. Checked over ALL 28 rather
     * than on the two by name, which is what makes "and no others" mean
     * something -- the old version asserted two lists and said nothing about
     * the rest.
     * ========================================================================
     */
    const charging = PROFILE_PRESETS.filter((preset) =>
      (preset.build().precombat ?? []).some((action) => action.abilityId === 'charge'),
    ).map((preset) => preset.id);
    expect(charging).toEqual(['two_hand_arms', 'prot_warr']);

    for (const id of charging) {
      const action = PRESETS_BY_ID.get(id)!.build().precombat!.find(
        (entry) => entry.abilityId === 'charge',
      );
      expect(action!.secondsBefore, id).toBe(0);
    }

    for (const list of [WARRIOR_TWO_HAND_BATTLE, WARRIOR_SHIELD_DEFENSIVE]) {
      expect(list.entries.some((entry) => entry.abilityId === 'charge'), list.name).toBe(false);
    }
  });

  it('fires exactly once a fight for 2H Arms, and pays 21 rage', () => {
    const batch = runProfileBatch(preset('two_hand_arms'));
    const charge = batch.abilities.find((a) => a.abilityName === 'Charge');
    expect(charge?.uses).toBe(1);

    /*
     * 15 base plus 6 from 2/2 Improved Charge, which the preset takes.
     *
     * IT WAS 1/2 AND 18 RAGE until client build 1.60.1.70170: Improved Cleave
     * was removed from the Fury tree and the owner's new build put one of its
     * three freed points here. So this figure moved because a BUILD changed, not
     * because the ability or the talent did -- and the rank is read from the
     * preset by the test above, which is why both halves are asserted.
     */
    expect(presetTalents('two_hand_arms').improved_charge).toBe(2);
    const rage = resourceFlowOf(batch, 'rage').gained.find((row) => row.sourceId === 'charge');
    expect(rage?.amount).toBeCloseTo(CHARGE_RAGE_GENERATED + 6, 6);
  });
});

// ---------------------------------------------------------------------------
// Vanguard
// ---------------------------------------------------------------------------

describe('Vanguard is what lets a tank Charge', () => {
  it('adds Defensive Stance to Charge rather than replacing Battle', () => {
    /*
     * Replacing would take Charge away from an Arms warrior who somehow had
     * the talent. The effect is declared as one stance and merged into the
     * list the ability already carries.
     */
    expect(WARRIOR_TALENT_EFFECTS.vanguard).toEqual([
      { kind: 'abilityStance', abilityId: 'charge', stance: 'defensive_stance' },
    ]);

    const withIt = talentBuild('warrior', legalise({ vanguard: 1 }));
    expect(withIt.abilityExtraStances.get('charge')).toEqual(['defensive_stance']);
    expect(talentBuild('warrior', {}).abilityExtraStances.get('charge')).toBeUndefined();
  });

  /*
   * ============================================================================
   * AN EXPLICIT TIMEOUT, AFTER THIS TEST FLAKED FOR THE FOURTH TIME.
   *
   * It runs TWO Monte Carlo batches -- `casts()` is one and the `runProfileBatch`
   * below is another -- which makes it the heaviest of the four batch tests in
   * this file, and under full-suite CPU contention it crosses vitest's 5,000ms
   * default. The fourth failure was measured at **5,224ms**, and the suite
   * passes on a captured re-run with nothing changed.
   *
   * THIS SETTLES A CLAIM CLAUDE.md HAS CARRIED THROUGH THREE INSTANCES.
   * "A SYNCHRONOUS TEST CANNOT TIME OUT -- the body blocks the event loop, so
   * vitest's timer never fires" was the reasoning that explained away the first
   * failure, and the file still has **zero async bodies and zero awaits**. The
   * reasoning is simply wrong: a synchronous body that overruns is reported as a
   * timeout, and 5,224ms against a 5,000ms limit is the measurement that says so
   * rather than another argument about it.
   *
   * SO THE FIX IS A LIMIT AND NOT A DIAGNOSIS. This test measures BEHAVIOUR --
   * that the Protection build Charges once with Vanguard and not at all without
   * it -- and nothing about it is a claim about speed, so a generous limit costs
   * the suite nothing and removes a failure that has misdirected three separate
   * investigations: into non-determinism, into a shared checkout, and into the
   * commit that first added 449 items.
   *
   * THE OTHER THREE BATCH TESTS HERE ARE LEFT ALONE, deliberately: none has ever
   * failed, each runs ONE batch, and widening all four would hide the next one
   * that genuinely gets slower. `vite.config.ts` sets no `testTimeout`, so the
   * default still governs everything else.
   * ============================================================================
   */
  const TWO_BATCHES_MS = 30_000;

  it('lets the Prot preset Charge once, and stops it without the talent', () => {
    expect(casts('prot_warr', 'Charge')).toBe(1);

    const built = PRESETS_BY_ID.get('prot_warr')!.build();
    const withoutVanguard = { ...built.talents };
    delete (withoutVanguard as Record<string, number>).vanguard;

    const batch = runProfileBatch({
      ...built,
      talents: withoutVanguard,
      simulation: { ...built.simulation, iterations: 200, seed: 4242 },
    } as never);
    expect(batch.abilities.find((a) => a.abilityName === 'Charge')?.uses ?? 0).toBe(0);
  }, TWO_BATCHES_MS);

  it('NEVER drags the tank out of Defensive Stance to reach it', () => {
    /*
     * ----------------------------------------------------------------------
     * THE TRAP. `PriorityRotation` treats a wrong stance as "not yet, and here
     * is how" and casts a stance change to unblock an entry -- correct for
     * Revenge, catastrophic here. Charge lists Battle Stance, so adding it to
     * the Protection list sent the tank into Battle Stance at the pull, and
     * three separate stance tests caught it.
     *
     * IT IS THE ENGINE'S OWN STANCE CHECK NOW, which is a stronger version of
     * the same guarantee. Charge is a PRE-COMBAT action on this profile and a
     * pre-combat cast has no rotation attached to swap anything -- so without
     * Vanguard the tank is in a stance Charge does not list, `castAbility`
     * refuses it, and `runPrecombat` skips it.
     * ----------------------------------------------------------------------
     */
    const built = PRESETS_BY_ID.get('prot_warr')!.build();
    const withoutVanguard = { ...built.talents };
    delete (withoutVanguard as Record<string, number>).vanguard;
    const profile = {
      ...built,
      talents: withoutVanguard,
      simulation: { ...built.simulation, iterations: 200, seed: 4242 },
    } as never;

    const batch = runProfileBatch(profile);
    /*
     * NO *BATTLE* STANCE ROW, where this asserted no row containing "Stance"
     * at all. That was safe only while nothing cast a stance: the opener now
     * re-casts DEFENSIVE Stance before the pull, which is a correct row and
     * has to be allowed through. The claim was always about the wrong stance.
     */
    for (const row of batch.abilities) {
      expect(row.abilityName, 'never swaps to Battle').not.toContain('Battle Stance');
      expect(row.abilityName, 'nor to Berserker').not.toContain('Berserker Stance');
    }

    // And Charge itself never happens, which is what the stance refusal means.
    expect(batch.abilities.find((row) => row.abilityName === 'Charge')).toBeUndefined();
    const tank = characterAtCombatStart(profile)!;
    expect(tank.auras.has('defensive_stance'), 'still Defensive at the pull').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Master of Defense
// ---------------------------------------------------------------------------

describe('Master of Defense needs the shield the player chose', () => {
  it('registers its proc with a shield and not without one', () => {
    /*
     * It used to carry a note admitting the shield clause was unexpressed,
     * because a reaction cannot see the off hand when it fires. It does not
     * need to: equipping a shield is a choice made on the GUI, so the build
     * knows about it, and the proc is simply not registered for a character
     * without one.
     */
    const talents = legalise({ master_of_defense: 2 });
    const shielded = PRESETS_BY_ID.get('prot_warr')!.build();
    const withShield = talentBuild(
      'warrior',
      talents,
      talentContextFor(
        shielded.equipment,
        'one_hand_shield',
        weaponsFor(shielded.equipment, 'one_hand_shield'),
      ),
    );
    expect(withShield.reactions.some((r) => r.id === 'master_of_defense')).toBe(true);
    expect(withShield.unmodelled.some((u) => u.talentId === 'master_of_defense')).toBe(false);

    const fury = PRESETS_BY_ID.get('dw_fury')!.build();
    const withoutShield = talentBuild(
      'warrior',
      talents,
      talentContextFor(fury.equipment, 'dual_wield', weaponsFor(fury.equipment, 'dual_wield')),
    );
    expect(withoutShield.reactions.some((r) => r.id === 'master_of_defense')).toBe(false);
    // And it says so, rather than going quiet.
    expect(withoutShield.unmodelled.some((u) => u.talentId === 'master_of_defense')).toBe(true);
  });

  it('carries no standing caveat any more', () => {
    expect(WARRIOR_TALENT_EFFECTS.master_of_defense).toEqual([
      { kind: 'reaction', reactionId: 'master_of_defense', requires: { shield: true } },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Concussion Blow
// ---------------------------------------------------------------------------

describe('Concussion Blow is deliberately silent', () => {
  it('carries no unmodelled entry, on the ruleset owner instruction', () => {
    /*
     * "Concussion Blow is still not to be implemented. No note about this
     * needs to be made on the GUI."
     *
     * A DELIBERATE EXCEPTION to the rule that an inert choice says so where it
     * is made, asserted here so it reads as a decision rather than an
     * oversight. The stun is out of scope; there is nothing for a reader to
     * act on. The ability grant stays so the talent gates its tier.
     */
    expect(WARRIOR_TALENT_EFFECTS.concussion_blow).toEqual([
      { kind: 'grantAbility', abilityId: 'concussion_blow' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Spearing Strike
// ---------------------------------------------------------------------------

describe('Spearing Strike needs Battle Stance', () => {
  /*
   * ----------------------------------------------------------------------------
   * THIS TEST HAS NOW ASSERTED THREE DIFFERENT THINGS, AND EACH WAS TRUE WHEN
   * WRITTEN. It is worth keeping the sequence, because the ability is this
   * project's worked example of a requirement line being read wrongly.
   *
   * FIRST it read "is cast by DW Fury now, below Bloodthirst and Whirlwind".
   * Spearing Strike was in the DW Fury preset's talents and in no list that
   * build could reach, so the owner added the entry and the point stopped
   * looking wasted.
   *
   * THEN it read "is not in a dual-wielder's book": the ability required a
   * two-handed weapon, stated by `forever-warrior-spellbook.json` and by
   * `foreverchanges.pro` and omitted only by the older Wowhead tooltip -- and an
   * omission is not a denial, so two sources against a silence settled it with
   * no tie-break involved.
   *
   * NOW the requirement is a STANCE. Client build 1.60.1.70170: "Spearing Strike
   * no longer requires a 2handed weapon. Spearing Strike requires Battle
   * Stance", and the refreshed capture says the same. So `abilitiesForBuild` has
   * no opinion about it any more and `Ability.stances` carries the rule, which is
   * where Overpower's has always lived.
   *
   * AND THE ANSWER FOR DW FURY DID NOT CHANGE. That build is in Berserker
   * Stance, so an ability it can now hold the weapons for is one it cannot hold
   * the stance for -- and the owner's new build moves the talent point out
   * anyway. What is asserted is the stance rule, which is an invariant, rather
   * than a list position, which is the owner's.
   * ----------------------------------------------------------------------------
   */
  it('is in a dual-wielder\'s book now, and declares Battle Stance', () => {
    const ids = abilityIds('dual_wield', legalise({ spearing_strike: 1 }));
    expect(ids).toContain('spearing_strike');
    expect(SPEARING_STRIKE.stances).toEqual(['battle_stance']);
  });

  it('is in a two-hander\'s book, and 2H Arms casts it', () => {
    const ids = abilityIds('two_hander', legalise({ spearing_strike: 1 }));
    expect(ids).toContain('spearing_strike');
    expect(casts('two_hand_arms', 'Spearing Strike')).toBeGreaterThan(1);
  });

  it('is still in the Berserker list, where it can never fire', () => {
    /*
     * The owner's entry, left as written. It cannot fire for TWO reasons now:
     * the owner's new DW Fury build does not take the talent, so
     * `PriorityRotation` skips an ability the actor does not know -- and even
     * with the talent, this list is Berserker Stance and the ability is Battle.
     *
     * What must stay true is that it produces no casts rather than an error, and
     * that the build has not quietly regained the talent.
     */
    expect(
      WARRIOR_DUAL_WIELD_BERSERKER.entries.some((entry) => entry.abilityId === 'spearing_strike'),
    ).toBe(true);
    expect(presetTalents('dw_fury').spearing_strike).toBeUndefined();
    expect(casts('dw_fury', 'Spearing Strike')).toBe(0);
  });
});
