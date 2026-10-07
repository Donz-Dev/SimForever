import { describe, expect, it } from 'vitest';
import type { Ability, Combatant } from '../../src/engine';
import { castAbility, resolveCast, seconds } from '../../src/engine';
import {
  CLEARCASTING,
  OMEN_OF_CLARITY_INTERNAL_COOLDOWN_MS,
  OMEN_OF_CLARITY_MOONKIN_MULTIPLIER,
  OMEN_OF_CLARITY_PROC_CHANCE,
} from '../../src/game/auras/druid';
import { omenOfClarityChanceFor, omenOfClarityReaction } from '../../src/game/reactions/druid';
import { reactionsForClass } from '../../src/game/reactions/reactionsForClass';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { DRUID_ABILITIES } from '../../src/game/abilities/druid';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { buildSimulation } from '../helpers/buildSimulation';

/*
 * ============================================================================
 * OMEN OF CLARITY, AND THE TWO THINGS CLEARCASTING MUST NOT BE SPENT ON.
 *
 * "Your spells and attacks have a chance to grant you Clearcasting, reducing
 * the Mana, Rage, or Energy cost of your next damage or healing spell or
 * offensive ability by 100%. Clearcasting is not consumed by Wrath or by spells
 * or abilities that cost no resources."
 *
 * THE THREE NUMBERS ARE THE RULESET OWNER'S and the tooltip states none of
 * them: 4% to proc, doubled in Moonkin form, ten second internal cooldown.
 *
 * THE EXCLUSIONS ARE WHAT THIS FILE IS MOSTLY FOR. A charge spent on the wrong
 * thing is the failure mode: the proc still fires, the aura still shows its
 * uptime, and the saving simply lands somewhere it should not. Nothing about it
 * looks wrong.
 * ============================================================================
 */

const byId = (id: string): Ability => DRUID_ABILITIES.find((a) => a.id === id)!;

/** A Druid carrying Clearcasting and every ability, with all three pools. */
function clearcasting(): { actor: Combatant; simulation: ReturnType<typeof buildSimulation> } {
  const actor = makeAttacker({
    autoAttack: 'none',
    abilities: DRUID_ABILITIES,
    resources: [
      { type: 'mana', maximum: 10_000, initial: 10_000 },
      { type: 'rage', maximum: 100, initial: 100 },
      { type: 'energy', maximum: 100, initial: 100 },
    ],
  });
  const simulation = buildSimulation([actor, makeTarget()]);
  simulation.applyAura(actor, CLEARCASTING, actor.id);
  return { actor, simulation };
}

describe('what Clearcasting pays for', () => {
  it('makes the next costing, table-rolling ability free', () => {
    const { actor } = clearcasting();
    for (const id of ['starfire', 'moonfire', 'insect_swarm', 'shred', 'rake', 'maul', 'lacerate']) {
      const ability = byId(id);
      expect(ability.cost!.amount, id).toBeGreaterThan(0);
      expect(resolveCast(actor, ability).costAmount, id).toBe(0);
    }
  });

  it('does NOT pay for Wrath, which the tooltip names', () => {
    /*
     * THE ONE NAMED EXCLUSION, and the only way to say it against a catch-all.
     * Without it the Moonkin's cheapest filler would eat every charge before
     * its 340-mana nuke ever saw one -- a proc that fires, reports its uptime
     * and is worth a third of what it should be.
     */
    const { actor } = clearcasting();
    const wrath = byId('wrath');
    expect(wrath.cost!.amount).toBeGreaterThan(0);
    expect(resolveCast(actor, wrath).costAmount).toBe(wrath.cost!.amount);
    expect(resolveCast(actor, wrath).modified).toBe(false);
  });

  it('does NOT pay for an ability that costs nothing', () => {
    // "nor by spells or abilities that cost no resources."
    const { actor } = clearcasting();
    for (const id of ['tigers_fury', 'barkskin', 'enrage', 'berserk']) {
      expect(byId(id).cost, id).toBeUndefined();
      expect(resolveCast(actor, byId(id)).modified, id).toBe(false);
    }
  });

  it('does NOT pay for Demoralizing Roar, which is the Druid\'s Battle Shout', () => {
    /*
     * "OFFENSIVE ability" IS THE OWNER'S OWN DEFINITION, already on the books:
     * asked which abilities Focused Rage reduces, they ruled that "an ability is
     * offensive if it is PROCESSED THROUGH A COMBAT TABLE. Heroic Strike,
     * Thunder Clap and Sunder Armor are; Battle Shout is not."
     *
     * Demoralizing Roar costs ten rage and rolls nothing, and the Bear's list
     * opens with it -- so without this clause it would eat a charge on the pull
     * roughly every other fight.
     */
    const { actor } = clearcasting();
    const roar = byId('demoralizing_roar');
    expect(roar.cost!.amount).toBeGreaterThan(0);
    expect(roar.attackTable).toBeUndefined();
    expect(resolveCast(actor, roar).costAmount).toBe(roar.cost!.amount);
  });

  it('is the ONLY Druid ability that costs something and rolls nothing', () => {
    /*
     * The claim the clause above rests on, checked rather than asserted: if a
     * second one appears, this fails and somebody decides whether it is
     * offensive rather than finding out from a DPS figure.
     */
    const costingWithoutTable = DRUID_ABILITIES.filter(
      (ability) => (ability.cost?.amount ?? 0) > 0 && !ability.attackTable,
    ).map((ability) => ability.id);
    expect(costingWithoutTable).toEqual(['demoralizing_roar']);
  });
});

describe('how Clearcasting is spent', () => {
  it('is spent by ONE cast, not drawn down', () => {
    // "your NEXT". A stack would leave the rest of the charge behind.
    const { actor, simulation } = clearcasting();
    simulation.begin();
    expect(actor.auras.has(CLEARCASTING.id)).toBe(true);

    const shred = actor.abilities.get('shred')!;
    castAbility(simulation, actor, shred, simulation.combatants.find((c) => c.kind === 'enemy'));
    expect(actor.auras.has(CLEARCASTING.id)).toBe(false);
  });

  it('survives a cast it does not pay for', () => {
    /*
     * The half an exclusion has to get right: Wrath must not be made free AND
     * must not spend the charge. One without the other is still a bug -- a
     * charge consumed for nothing is indistinguishable from one that worked.
     */
    const { actor, simulation } = clearcasting();
    simulation.begin();
    const target = simulation.combatants.find((c) => c.kind === 'enemy');
    castAbility(simulation, actor, actor.abilities.get('wrath')!, target);
    expect(actor.auras.has(CLEARCASTING.id)).toBe(true);
  });
});

describe("the proc, and the owner's three numbers", () => {
  it('is 4%, doubled to 8% in Moonkin form', () => {
    expect(OMEN_OF_CLARITY_PROC_CHANCE).toBe(4);
    expect(OMEN_OF_CLARITY_MOONKIN_MULTIPLIER).toBe(2);
    expect(omenOfClarityChanceFor('moonkin')).toBe(8);
    for (const style of ['cat', 'bear', 'caster', undefined] as const) {
      expect(omenOfClarityChanceFor(style), String(style)).toBe(4);
    }
  });

  it('has a ten second internal cooldown', () => {
    expect(OMEN_OF_CLARITY_INTERNAL_COOLDOWN_MS).toBe(seconds(10));
  });

  it('is registered for every Druid style and for no other class', () => {
    for (const style of ['moonkin', 'cat', 'bear'] as const) {
      expect(reactionsForClass('druid', style, {}).map((r) => r.id), style).toContain(
        'omen_of_clarity',
      );
    }
    for (const cls of ['warrior', 'rogue', 'mage', 'paladin', 'hunter', 'warlock', 'priest', 'shaman'] as const) {
      expect(reactionsForClass(cls, 'dual_wield', {}).map((r) => r.id), cls).not.toContain(
        'omen_of_clarity',
      );
    }
  });

  it('carries the doubled chance for a Moonkin and the base one for a Cat', () => {
    /*
     * ASSERTED THROUGH THE REGISTRATION rather than on the helper, because the
     * style has to reach the reaction and a doubling computed and then not
     * passed would pass every test above.
     */
    const rate = (style: 'moonkin' | 'cat'): number => {
      let fired = 0;
      const reaction = reactionsForClass('druid', style, {}).find(
        (r) => r.id === 'omen_of_clarity',
      )!;
      const actor = makeAttacker({});
      const target = makeTarget();
      // A die that always rolls the lowest value: `rollChance(p)` is true while
      // p is anything above zero, so instead the chance is read by counting
      // successes over a scripted sequence.
      for (let roll = 1; roll <= 100; roll += 1) {
        const simulation = buildSimulation([actor, target]);
        (simulation as unknown as { rng: unknown }).rng = {
          next: () => 0,
          nextInt: () => roll,
          nextFloat: () => (roll - 1) / 100,
          nextDuration: () => 0,
          rollChance: (chance: number) => (roll - 1) / 100 < chance,
          pick: (items: readonly unknown[]) => items[0],
        };
        if (
          reaction.canTrigger!(simulation, actor, {
            attacker: actor,
            defender: target,
            outcome: 'hit',
            abilityId: 'starfire',
            abilityName: 'Starfire',
            amount: 1,
            weaponSlot: undefined,
            critical: false,
          })
        ) {
          fired += 1;
        }
      }
      return fired;
    };

    expect(rate('moonkin')).toBe(8);
    expect(rate('cat')).toBe(4);
  });

  it('refuses a second proc inside the window, and spends no die doing it', () => {
    /*
     * THE COOLDOWN IS CHECKED BEFORE THE ROLL, which keeps a seeded run
     * identical whether or not the window happens to be open. Windfury orders
     * it the same way, and getting it backwards shifts every roll after a
     * blocked proc.
     */
    const reaction = omenOfClarityReaction(100);
    const actor = makeAttacker({});
    const target = makeTarget();
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
    simulation.begin();

    let rolls = 0;
    (simulation as unknown as { rng: unknown }).rng = {
      next: () => 0,
      nextInt: () => 1,
      nextFloat: () => 0,
      nextDuration: () => 0,
      rollChance: () => {
        rolls += 1;
        return true;
      },
      pick: (items: readonly unknown[]) => items[0],
    };
    const attack = {
      attacker: actor,
      defender: target,
      outcome: 'hit' as const,
      abilityId: 'shred',
      abilityName: 'Shred',
      amount: 1,
      weaponSlot: undefined,
      critical: false,
    };

    expect(reaction.canTrigger!(simulation, actor, attack)).toBe(true);
    reaction.onTrigger(simulation, actor, attack);
    expect(rolls).toBe(1);

    // Still inside the window: refused, and no die consumed.
    expect(reaction.canTrigger!(simulation, actor, attack)).toBe(false);
    expect(rolls).toBe(1);

    // Past it: allowed again.
    simulation.advanceTo(OMEN_OF_CLARITY_INTERNAL_COOLDOWN_MS + 1);
    expect(reaction.canTrigger!(simulation, actor, attack)).toBe(true);
    expect(rolls).toBe(2);
  });

  it('applies Clearcasting when it fires', () => {
    const reaction = omenOfClarityReaction(100);
    const actor = makeAttacker({});
    const target = makeTarget();
    const simulation = buildSimulation([actor, target]);
    simulation.begin();
    reaction.onTrigger(simulation, actor, {
      attacker: actor,
      defender: target,
      outcome: 'hit',
      abilityId: 'shred',
      abilityName: 'Shred',
      amount: 1,
      weaponSlot: undefined,
      critical: false,
    });
    expect(actor.auras.has(CLEARCASTING.id)).toBe(true);
  });

  it('fires on what CONNECTED, which is an interpretation', () => {
    /*
     * "Your spells and attacks have a chance" names the ACTION, which could be
     * read as including one that missed. Every other reaction in this project
     * keys off what landed, and that reading is the conservative one -- it can
     * only understate the proc. Pinned so the choice is visible rather than
     * incidental, and recorded as a question for the owner.
     */
    expect(omenOfClarityReaction(4).outcomes).toEqual(['hit', 'crit', 'glance', 'crush', 'block']);
    for (const avoided of ['miss', 'dodge', 'parry'] as const) {
      expect(omenOfClarityReaction(4).outcomes).not.toContain(avoided);
    }
  });
});

describe("Moonkin Form's third clause", () => {
  it('has no unmodelled clause left, because the proc exists to double', () => {
    /*
     * Its reason was "Omen of Clarity's trigger chance is doubled, and Omen of
     * Clarity is not declared ... so there is no proc here for this to double."
     * True when written, and specific enough to find the day the proc landed.
     */
    expect(DRUID_TALENT_EFFECTS.moonkin_form.some((e) => e.kind === 'unmodelled')).toBe(false);
    // And the two clauses that DO apply are still both there.
    expect(DRUID_TALENT_EFFECTS.moonkin_form).toHaveLength(2);
  });
});
