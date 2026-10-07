import { describe, expect, it } from 'vitest';
import { seconds } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { ROGUE_ABILITIES } from '../../src/game/abilities/rogue';
import { ROGUE_TALENT_EFFECTS } from '../../src/game/talents/rogueEffects';
import { ROGUE_TALENT_REACTIONS } from '../../src/game/reactions/rogueTalents';
import { STEALTH, CUTTHROAT } from '../../src/game/auras/rogue';
import { ROGUE_RUPTURE } from '../../src/game/rotations/rogue';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';

const rogue = () => createPlayer({ race: 'orc', characterClass: 'rogue' });
const effectsFor = (id: string) => ROGUE_TALENT_EFFECTS[id] ?? [];
const abilityOf = (id: string) => ROGUE_ABILITIES.find((a) => a.id === id);

/*
 * A BARE COMBATANT WITH A DAGGER, for the gate tests. `createPlayer` with no
 * gear holds no weapons at all, and Ambush's first condition is a dagger in the
 * main hand -- so a profile-less Rogue would fail the gate for the wrong reason
 * and the test would pass for the wrong reason too.
 */
const daggerRogue = () =>
  makeAttacker({
    autoAttack: 'none',
    abilities: [abilityOf('ambush')!],
    weapons: {
      mainHand: { name: 'Dagger', weaponType: 'dagger', baseDamage: 100, swingTimerMs: 1800 },
    },
    resources: [{ type: 'energy', maximum: 100, initial: 100 }],
  });

describe('a Rogue opens from stealth', () => {
  /*
   * THE OPENING WINDOW IS WHAT MAKES THE OWNER'S OPENER EXPRESSIBLE. "You start
   * from stealth, and you take your stealth action which is Ambush" -- so the
   * aura is on the CLASS, not on a profile or a talent, because every Rogue has
   * Stealth from a trainer.
   */
  it('carries the stealth aura before anything has happened', () => {
    expect(rogue().openingAuras.map((a) => a.id)).toContain('stealth');
  });

  it('gives it to no other class', () => {
    const warrior = createPlayer({ race: 'orc', characterClass: 'warrior' });
    const druid = createPlayer({ race: 'tauren', characterClass: 'druid' });
    expect(warrior.openingAuras.map((a) => a.id)).not.toContain('stealth');
    expect(druid.openingAuras.map((a) => a.id)).not.toContain('stealth');
  });

  it('is actually applied when the fight starts, not merely declared', () => {
    /*
     * THE HALF A DECLARATION DOES NOT PROVE. `openingAuras` is a list the
     * simulation walks at the pull; a list nobody walked would read exactly the
     * same from the character. So this asserts the aura is UP once the fight has
     * begun, which is the thing Ambush's `canCast` will ask about.
     */
    const player = rogue();
    const sim = buildSimulation([player, makeTarget()], { durationMs: seconds(60) });
    sim.begin();
    expect(player.auras.has('stealth')).toBe(true);
  });
});

describe('Ambush takes either route to its gate', () => {
  const ambush = abilityOf('ambush');

  it('is castable from a stealth window with no Cutthroat anywhere', () => {
    const player = daggerRogue();
    const sim = buildSimulation([player, makeTarget()], { durationMs: seconds(60) });
    sim.begin();
    sim.applyAura(player, STEALTH, player.id);
    expect(player.auras.has(CUTTHROAT.id)).toBe(false);
    expect(ambush?.canCast?.({ caster: player } as never)).toBe(true);
  });

  it('is refused when neither aura is up', () => {
    const player = daggerRogue();
    buildSimulation([player, makeTarget()], { durationMs: seconds(60) }).begin();
    expect(player.auras.has(STEALTH.id)).toBe(false);
    expect(player.auras.has(CUTTHROAT.id)).toBe(false);
    expect(ambush?.canCast?.({ caster: player } as never)).toBe(false);
  });

  it('is refused without a dagger, however open the gate is', () => {
    /*
     * THE DAGGER HALF IS STILL ENFORCED. Widening the stealth half is not a
     * licence for the other condition to go missing, and a gate that opens for
     * the wrong reason reads exactly like one that works.
     */
    const player = makeAttacker({
      autoAttack: 'none',
      abilities: [ambush!],
      weapons: {
        mainHand: { name: 'Sword', weaponType: 'sword', baseDamage: 100, swingTimerMs: 2400 },
      },
      resources: [{ type: 'energy', maximum: 100, initial: 100 }],
    });
    const sim = buildSimulation([player, makeTarget()], { durationMs: seconds(60) });
    sim.begin();
    sim.applyAura(player, STEALTH, player.id);
    expect(ambush?.canCast?.({ caster: player } as never)).toBe(false);
  });

  it('spends Cutthroat FIRST and keeps the stealth window', () => {
    /*
     * A REAL DECISION, NOT AN ARBITRARY ORDER. Cutthroat comes off a Backstab
     * proc several times a fight; a stealth window comes from a five-minute
     * cooldown. Spending both on one Ambush would throw the scarce one away, and
     * spending the scarce one first wastes the renewable one.
     */
    const player = daggerRogue();
    const target = makeTarget();
    const sim = buildSimulation([player, target], { durationMs: seconds(60) });
    sim.begin();
    sim.applyAura(player, STEALTH, player.id);
    sim.applyAura(player, CUTTHROAT, player.id);
    expect(player.auras.has(STEALTH.id)).toBe(true);

    ambush?.onCast?.({
      simulation: sim,
      caster: player,
      target,
      ability: ambush,
    } as never);

    expect(player.auras.has(CUTTHROAT.id)).toBe(false);
    expect(player.auras.has(STEALTH.id)).toBe(true);
  });
});

describe('Vanish', () => {
  const vanish = abilityOf('vanish');

  it('is in every Rogue book, because it is a trainer ability', () => {
    expect(vanish).toBeDefined();
    expect(rogue().abilities.has('vanish')).toBe(true);
  });

  it('carries the capture’s five minutes and no energy cost', () => {
    /*
     * WRITTEN OUT BY HAND FROM `forever-rogue-spellbook.json` at rank 2, which
     * is max: `cooldown: "5 min cooldown"`, `cast: "Instant"`, and a cost line
     * of `Reagents: Flash Powder` -- a consumable, not a resource, so there is
     * nothing for the engine to charge.
     */
    expect(vanish?.cooldownMs).toBe(seconds(300));
    expect(vanish?.cost).toBeUndefined();
    expect(vanish?.castTimeMs).toBeUndefined();
  });

  it('applies the same stealth aura the pull does', () => {
    /*
     * ONE MECHANISM FOR BOTH WINDOWS, which is the point: if Vanish applied an
     * aura of its own, the opener and a mid-fight Vanish would be two code paths
     * that could drift, and Ambush would need to read both.
     */
    const player = rogue();
    const sim = buildSimulation([player, makeTarget()], { durationMs: seconds(60) });
    sim.begin();
    sim.advanceTo(seconds(30));
    // The opening window is long gone by thirty seconds.
    expect(player.auras.has('stealth')).toBe(false);

    vanish?.onCast?.({ simulation: sim, caster: player, ability: vanish } as never);
    expect(player.auras.has('stealth')).toBe(true);
  });

  it('is reset by Preparation, which is what makes it rotational', () => {
    /*
     * FIVE MINUTES IS LONGER THAN EVERY FIGHT, so without this Vanish is one
     * extra Ambush at the pull and nothing else. Preparation finishing its
     * cooldown is the whole reason the owner's list has a Preparation clause.
     */
    const player = rogue();
    const preparation = abilityOf('preparation');
    buildSimulation([player, makeTarget()], { durationMs: seconds(60) }).begin();

    expect(player.abilities.isReady('vanish', 0)).toBe(true);
    player.abilities.consumeCharge('vanish', 0);
    expect(player.abilities.isReady('vanish', seconds(30))).toBe(false);

    preparation?.onCast?.({ caster: player, ability: preparation } as never);
    expect(player.abilities.isReady('vanish', seconds(30))).toBe(true);
  });
});

describe('the three talents that pointed at Ambush and did nothing', () => {
  /*
   * ============================================================================
   * ONE FALSE PREMISE, THREE TALENTS, AND A `scope` TAG THAT HID ALL OF THEM.
   *
   * Improved Ambush, Initiative and Opportunity's Ambush clause all carried an
   * `unmodelled` entry reading "Ambush requires stealth and is absent" -- which
   * stopped being true the day the owner ruled that Cutthroat's proc IS Ambush's
   * stealth requirement and the ability was declared. Ambush was in the book, in
   * the Rupture list and dealing damage while three talents aimed at it reported
   * themselves out of scope.
   *
   * THE SCOPE TAG IS WHY NOBODY NOTICED. A ruled-out effect is deliberately kept
   * out of the live-gap list, so tagging a live effect `stealth` removed it from
   * the one list that gets re-read. These assert the WORDING is gone, not just
   * that the effects exist, because the wording is what a reader would trust.
   * ============================================================================
   */
  const reasonsFor = (id: string) =>
    effectsFor(id)
      .filter((e): e is { kind: 'unmodelled'; reason: string } => e.kind === 'unmodelled')
      .map((e) => e.reason);

  it('no longer claims anywhere that Ambush is absent', () => {
    for (const id of Object.keys(ROGUE_TALENT_EFFECTS)) {
      for (const reason of reasonsFor(id)) {
        expect(reason).not.toMatch(/Ambush.*(is absent|are absent)/i);
        expect(reason).not.toMatch(/Keyed to the stealth openers/i);
      }
    }
  });

  it('gives Improved Ambush its crit, on Ambush and nothing else', () => {
    const crits = effectsFor('improved_ambush').filter((e) => e.kind === 'abilityCrit');
    expect(crits).toHaveLength(1);
    expect((crits[0] as { abilityId: string }).abilityId).toBe('ambush');
  });

  it('gives Opportunity its third ability, and keeps Garrote out of scope', () => {
    const damaged = effectsFor('opportunity')
      .filter((e) => e.kind === 'abilityDamage')
      .map((e) => (e as { abilityId: string }).abilityId);
    expect(damaged).toEqual(['backstab', 'mutilate', 'ambush']);
    // The clause that genuinely cannot be reached still says so.
    expect(reasonsFor('opportunity').join(' ')).toMatch(/Garrote/);
  });

  it('wires Initiative as a reaction, and keeps its other two abilities scoped', () => {
    const reactions = effectsFor('initiative').filter((e) => e.kind === 'reaction');
    expect(reactions).toHaveLength(1);
    expect((reactions[0] as { reactionId: string }).reactionId).toBe('initiative');
    expect(ROGUE_TALENT_REACTIONS.initiative).toBeDefined();
    expect(reasonsFor('initiative').join(' ')).toMatch(/Garrote and Cheap Shot/);
  });

  it('awards Initiative’s point only on an Ambush that connected', () => {
    /*
     * MATCHING AMBUSH'S OWN AWARD, which is gated on `!result.avoided`. A dodged
     * Ambush awarding a point from a talent and none from the ability itself
     * would be a strange shape, and `outcomes` is how that is expressed -- it
     * also means no random number is drawn on an avoided Ambush, so adding this
     * cannot shift a seeded run through the roll it does not make.
     */
    const reaction = ROGUE_TALENT_REACTIONS.initiative(100);
    expect(reaction.outcomes).toEqual(['hit', 'crit']);
    expect(reaction.id).toBe('initiative');
  });

  it('fires on Ambush and on nothing else', () => {
    const reaction = ROGUE_TALENT_REACTIONS.initiative(100);
    const context = { rng: { rollChance: () => true } } as never;
    const actor = rogue();
    const yes = reaction.canTrigger?.(context, actor, { abilityId: 'ambush' } as never);
    const no = reaction.canTrigger?.(context, actor, { abilityId: 'backstab' } as never);
    expect(yes).toBe(true);
    expect(no).toBe(false);
  });
});

describe('the Rupture list carries the owner’s stealth cycle', () => {
  const ids = ROGUE_RUPTURE.map((entry) => entry.abilityId);

  it('has every ability the four sequences name', () => {
    for (const id of ['premeditation', 'ambush', 'vanish', 'preparation']) {
      expect(ids).toContain(id);
    }
  });

  it('puts Ambush and Vanish above the damage finishers', () => {
    /*
     * A STRUCTURAL CLAIM AND NOT A DPS ONE. Ambush's window is ten seconds and
     * Vanish's cooldown is five minutes, so both have to outrank abilities that
     * are available every global cooldown -- otherwise a window closes while the
     * list is spending points.
     */
    expect(ids.indexOf('ambush')).toBeLessThan(ids.indexOf('rupture'));
    expect(ids.indexOf('vanish')).toBeLessThan(ids.indexOf('rupture'));
    expect(ids.indexOf('ambush')).toBeLessThan(ids.indexOf('backstab'));
  });

  it('leaves Ambush unconditional, because its own canCast is the gate', () => {
    /*
     * THE ENTRY USED TO RESTATE THE RULE as `selfActive('cutthroat')`, which was
     * harmless while there was one route to the gate and would have been HALF
     * the rule once there were two. An entry that restates half a condition is
     * worse than one that restates none.
     */
    const entry = ROGUE_RUPTURE.find((e) => e.abilityId === 'ambush');
    expect(entry?.condition).toBeUndefined();
  });

  it('does not add a fourth entry for the fourth sequence', () => {
    /*
     * "If Prep is on CD and Vanish + Premed are not: Vanish, Premed, Ambush" is
     * what the first three entries already do once Preparation has reset them. A
     * priority list is re-read every global cooldown, so a sequence is what
     * EMERGES rather than something written down -- and a second entry per
     * ability would be the duplicate-id shape this project only wants
     * deliberately.
     */
    expect(new Set(ids).size).toBe(ids.length);
  });
});
