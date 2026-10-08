import { describe, expect, it } from 'vitest';
import { castAbility, seconds } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import {
  GORE_DRINKER_ATTACKS,
  GORE_DRINKER_ID,
  PLACEHOLDER_GORE_DRINKER_DURATION_MS,
  goreDrinkerAura,
} from '../../src/game/auras/warriorTalents';
import {
  GORE_DRINKER_ABILITIES,
  goreDrinker,
  goreDrinkerHeal,
} from '../../src/game/reactions/warriorTalents';
import { WARRIOR_CAST_REACTIONS } from '../../src/game/reactions/warriorTalents';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { talentNumber, talentValue } from '../../src/game/talents/talentValues';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeTarget } from '../helpers/actors';
import { legalise } from '../helpers/legalTalents';

/*
 * ==============================================================================
 * GORE DRINKER, new at client build 1.60.1.70170:
 *
 *   "Your Enrage, Berserker Rage, Bloodrage, Death Wish, and Bloodthirst
 *    abilities cause your next 3 melee attacks to restore 0.5/1% of your
 *    maximum Health."
 *
 * FIVE TRIGGERS AND FOUR OF THEM ARE CASTS. Enrage is a talent PROC in Forever
 * and appears in no spellbook, so there is no cast for a cast reaction to see --
 * which is the talent's one `unmodelled` clause and is asserted here as such,
 * because an undeclared gap and a declared one read identically from a DPS
 * figure and only one of them is in the census.
 *
 * ------------------------------------------------------------------------------
 * EVERY TEST IS ON THE MECHANISM. No profile takes this talent -- the DW Fury
 * build is the only one that could, and the owner's new URL spends its points
 * elsewhere -- so a DPS delta is zero by construction and would prove nothing
 * either way. A BUILD cause, which expires the day a build changes.
 * ==============================================================================
 */

/** A dual-wielding warrior with exactly the talents given, and a target. */
function fury(talents: Record<string, number> = {}) {
  const actor = createPlayer({
    race: 'orc',
    characterClass: 'warrior',
    combatStyle: 'dual_wield',
    stance: 'berserker',
    talents,
  });
  const target = makeTarget({ maxHealth: 10_000_000 });
  const simulation = buildSimulation([actor, target]);
  simulation.begin();
  return { actor, target, simulation };
}

const melee = (actor: ReturnType<typeof fury>['actor'], target: ReturnType<typeof fury>['target']) => ({
  attacker: actor,
  defender: target,
  outcome: 'hit' as const,
  abilityId: undefined,
  abilityName: 'Main Hand Auto-Attack',
  amount: 400,
  weaponSlot: 'mainHand' as const,
  critical: false,
});

describe('what the tooltip states, transcribed by hand', () => {
  it('is three attacks and one percent of maximum health at 2/2', () => {
    /*
     * THE ROW IS `[3, 0.5]` AND `[3, 1]`, charge count first. Written out here
     * from the tooltip rather than read off the constant, and asserted at BOTH
     * ranks -- index 0 would grant 3% of maximum health per attack at either
     * rank, which is six times the talent at 1/2 and three times at 2/2 and a
     * perfectly plausible number both times.
     */
    expect(talentValue('warrior', 'gore_drinker', 1)).toEqual([3, 0.5]);
    expect(talentValue('warrior', 'gore_drinker', 2)).toEqual([3, 1]);
    expect(talentNumber('warrior', 'gore_drinker', 2, 1)).toBe(1);
    expect(GORE_DRINKER_ATTACKS).toBe(3);
  });

  it('reads index 1 in both of its effects, and never index 0', () => {
    for (const effect of WARRIOR_TALENT_EFFECTS.gore_drinker) {
      if (effect.kind === 'unmodelled') continue;
      expect('valueIndex' in effect ? effect.valueIndex : 0, effect.kind).toBe(1);
    }
  });

  it('declares the Enrage clause it cannot reach, rather than leaving it silent', () => {
    const reasons = WARRIOR_TALENT_EFFECTS.gore_drinker.filter((e) => e.kind === 'unmodelled');
    expect(reasons).toHaveLength(1);
    // No `scope`: whether Enrage should be reachable is a gap, not a ruling.
    expect(reasons[0]).not.toHaveProperty('scope');
    expect(reasons[0]).toMatchObject({ reason: expect.stringContaining('Enrage') });
  });
});

describe('the window, which is charges rather than a clock', () => {
  it('starts full at three and is restored to full, not incremented', () => {
    /*
     * `chargesOnApply` and `refreshRestoresCharges`, DECLARED. Writing
     * `instance.stacks` by hand moves the state and leaves the telemetry
     * reporting a count the engine does not hold -- which Flurry did and
     * Combustion was nearly caught by.
     */
    const aura = goreDrinkerAura(1);
    expect(aura.chargesOnApply).toBe(GORE_DRINKER_ATTACKS);
    expect(aura.maxStacks).toBe(GORE_DRINKER_ATTACKS);
    expect(aura.refreshRestoresCharges).toBe(true);

    const { actor, simulation } = fury();
    simulation.applyAura(actor, aura, actor.id);
    expect(actor.auras.stacksOf(GORE_DRINKER_ID)).toBe(3);
    // A second trigger refills rather than adding a fourth.
    simulation.applyAura(actor, aura, actor.id);
    expect(actor.auras.stacksOf(GORE_DRINKER_ID)).toBe(3);
  });

  it('carries a duration that is a flagged placeholder, not a ruleset figure', () => {
    /*
     * The tooltip states NO duration -- only the three attacks -- so a warrior
     * who stopped attacking would carry the window forever. Thirty seconds is
     * far longer than any gap between melee attacks in any list here, and the
     * name says it is invented.
     */
    expect(PLACEHOLDER_GORE_DRINKER_DURATION_MS).toBe(seconds(30));
    expect(goreDrinkerAura(1).durationMs).toBe(PLACEHOLDER_GORE_DRINKER_DURATION_MS);
  });
});

describe('the four casts that open it', () => {
  it('names exactly the four abilities a Warrior presses, and not Enrage', () => {
    // Transcribed from the tooltip's own list, minus the one that is not an
    // ability. A fifth id appearing here without the reason above changing is
    // the shape worth failing on.
    expect([...GORE_DRINKER_ABILITIES].sort()).toEqual([
      'berserker_rage_cast',
      'bloodrage_cast',
      'bloodthirst',
      'death_wish',
    ]);
    expect(GORE_DRINKER_ABILITIES).not.toContain('enrage');
  });

  it('has no abilityId of its own, because the field holds exactly one', () => {
    /*
     * `CastReaction.abilityId` is what King of the Jungle used and is what a
     * single-ability reaction should use -- `runCastReactions` skips a mismatch,
     * so nothing else can run it. Four ids cannot go in one field, so the set is
     * checked in `canTrigger` instead and the field is deliberately absent.
     */
    const reaction = goreDrinker(1);
    expect(reaction.abilityId).toBeUndefined();
    expect(reaction.canTrigger).toBeDefined();
  });

  it('opens the window on a Bloodthirst in a real cast, and on nothing else', () => {
    const { actor, target, simulation } = fury(
      legalise({ gore_drinker: 2, bloodthirst: 1, death_wish: 1 }),
    );
    // A warrior opens on nothing, and both abilities below cost rage.
    actor.resources.require('rage').gain(100);
    expect(actor.auras.has(GORE_DRINKER_ID)).toBe(false);

    // An ability that is not a trigger: Thunder Clap is in the book and is not
    // in the tooltip's list.
    castAbility(simulation, actor, actor.abilities.get('thunder_clap')!, target);
    expect(actor.auras.has(GORE_DRINKER_ID)).toBe(false);

    castAbility(simulation, actor, actor.abilities.get('bloodthirst')!, target);
    expect(actor.auras.stacksOf(GORE_DRINKER_ID)).toBe(3);
  });

  it('is the Warrior\'s first cast reaction, and the class is registered for it', () => {
    /*
     * `CAST_REACTIONS` in `talentBuild.ts` is OPTIONAL and SILENT: a class
     * missing from it produces no cast reactions and no complaint. The Warrior
     * was absent until this talent arrived.
     */
    expect(Object.keys(WARRIOR_CAST_REACTIONS)).toEqual(['gore_drinker']);
    const build = talentBuild('warrior', legalise({ gore_drinker: 2 }));
    expect(build.castReactions.map((r) => r.id)).toEqual(['gore_drinker']);
    expect(talentBuild('warrior', {}).castReactions).toEqual([]);
  });
});

describe('the heal, which spends its own charge', () => {
  it('restores one percent of maximum health per melee attack and spends a stack', () => {
    const { actor, target, simulation } = fury();
    simulation.applyAura(actor, goreDrinkerAura(1), actor.id);
    const reaction = goreDrinkerHeal(1);

    actor.health.spend(actor.health.maximum / 2);
    const before = actor.health.current;

    expect(reaction.canTrigger?.(simulation, actor, melee(actor, target) as never)).toBe(true);
    reaction.onTrigger(simulation, actor, melee(actor, target) as never);

    expect(actor.health.current - before).toBeCloseTo(actor.health.maximum / 100, 6);
    expect(actor.auras.stacksOf(GORE_DRINKER_ID)).toBe(2);
  });

  it('pays out THREE times and then the window closes', () => {
    /*
     * ------------------------------------------------------------------------
     * THE ORDERING IS LOAD-BEARING, exactly as Holy Shield's is: the heal runs
     * and THEN the charge is spent, so the third attack is paid before the aura
     * goes. Spending first drops the aura on the third and the talent is quietly
     * worth two thirds of itself.
     * ------------------------------------------------------------------------
     */
    const { actor, target, simulation } = fury();
    simulation.applyAura(actor, goreDrinkerAura(1), actor.id);
    const reaction = goreDrinkerHeal(1);
    actor.health.spend(actor.health.maximum / 2);

    let paid = 0;
    for (let attack = 0; attack < 5; attack += 1) {
      if (reaction.canTrigger?.(simulation, actor, melee(actor, target) as never) === false) continue;
      const before = actor.health.current;
      reaction.onTrigger(simulation, actor, melee(actor, target) as never);
      if (actor.health.current > before) paid += 1;
    }

    expect(paid).toBe(GORE_DRINKER_ATTACKS);
    expect(actor.auras.has(GORE_DRINKER_ID)).toBe(false);
  });

  it('refuses an attack that is not a melee weapon use', () => {
    /*
     * "MELEE attacks" is `isWeaponUse`, the project's own definition of a use: a
     * swing, an extra attack, or an ability that needs the weapon. Thunder Clap
     * declares a RANGED slot precisely so that predicate excludes it.
     */
    const { actor, target, simulation } = fury();
    simulation.applyAura(actor, goreDrinkerAura(1), actor.id);
    const reaction = goreDrinkerHeal(1);

    const ranged = { ...melee(actor, target), weaponSlot: 'ranged' as const };
    expect(reaction.canTrigger?.(simulation, actor, ranged as never)).toBe(false);
    const noWeapon = { ...melee(actor, target), weaponSlot: undefined };
    expect(reaction.canTrigger?.(simulation, actor, noWeapon as never)).toBe(false);
  });

  it('does nothing at all without the window open', () => {
    const { actor, target, simulation } = fury();
    const reaction = goreDrinkerHeal(1);
    expect(reaction.canTrigger?.(simulation, actor, melee(actor, target) as never)).toBe(false);
  });
});

describe('what it is worth to the profiles, which is nothing', () => {
  it('is taken by no preset, so this is a BUILD cause rather than an engine one', () => {
    for (const id of ['two_hand_arms', 'dw_fury', 'prot_warr']) {
      expect(PRESETS_BY_ID.get(id)!.build().talents.gore_drinker, id).toBeUndefined();
    }
  });

  it('is the talent DW Fury passed over when Flurry stopped needing Enrage 5', () => {
    /*
     * Gore Drinker requires Enrage 5/5. Flurry required Enrage 5/5 too until this
     * patch and now requires Death Wish 1/1 -- which is what let the owner's new
     * build drop Enrage to 4/5 and keep Flurry at 5/5, and what makes the choice
     * between the two talents visible rather than forced.
     */
    const talents = PRESETS_BY_ID.get('dw_fury')!.build().talents;
    expect(talents.enrage).toBe(4);
    expect(talents.flurry).toBe(5);
  });
});
