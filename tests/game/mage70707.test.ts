import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { castAbility, resolveCast, seconds } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { CONE_OF_COLD, CONE_OF_COLD_DAMAGE, ICE_LANCE } from '../../src/game/abilities/mage';
import {
  ARCANE_BLAST_COST_INCREASE_PER_STACK,
  ARCANE_BLAST_DURATION_MS,
  ARCANE_BLAST_INTELLECT_TO_SPELL_POWER,
  WINTERS_CHILL_DAMAGE_PER_STACK,
  WINTERS_CHILL_SPELL_POWER_PER_STACK,
  fingersOfFrostAura,
  wintersChillAura,
} from '../../src/game/auras/mage';
import { CONE_OF_COLD_SP_COEFFICIENT } from '../../src/game/combat/coefficients';
import { missileBarrage, wintersChill } from '../../src/game/reactions/mageTalents';
import { MAGE_TALENT_EFFECTS } from '../../src/game/talents/mageEffects';
import { talentNumber, talentNumbers } from '../../src/game/talents/talentValues';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { legalise } from '../helpers/legalTalents';

/*
 * ============================================================================
 * THE MAGE TREE AT CLIENT BUILD 1.60.1.70707, read off foreverchanges.pro.
 *
 * The owner's note listed seven changes; the tree carried more -- Arcane Focus,
 * Improved Fireball and Elemental Precision removed, Accelerant and Precision in
 * their places, Critical Mass back to three ranks and Incineration to five. The
 * figures below are written out BY HAND from the client's text, and the values
 * file is asserted to agree, so a typo and an upstream drift fail differently.
 * ============================================================================
 */

describe("Winter's Chill at 1.60.1.70707", () => {
  it('states 20% and 7% a stack, five stacks, at every rank -- and the values file agrees', () => {
    expect(WINTERS_CHILL_DAMAGE_PER_STACK).toBe(20);
    expect(WINTERS_CHILL_SPELL_POWER_PER_STACK).toBe(7);
    for (const rank of [1, 2, 3, 4, 5]) {
      // [chance, damagePercent, spellPowerPercent, maxStacks]
      expect(talentNumbers('mage', 'winter_s_chill', rank)).toEqual([rank * 20, 20, 7, 5]);
      const reaction = wintersChill(rank * 20, talentNumbers('mage', 'winter_s_chill', rank));
      const actor = makeAttacker({ autoAttack: 'none' });
      const target = makeTarget();
      const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
      simulation.begin();
      reaction.onTrigger(simulation, actor, {
        attacker: actor, defender: target, outcome: 'hit', abilityId: 'frostbolt',
        abilityName: 'Frostbolt', amount: 100, weaponSlot: undefined, critical: false,
      } as never);
      // Index 3, which moved: index 2 is the 7 and would have capped it at seven.
      expect(target.auras.get('winters_chill')!.maxStacks, `rank ${rank}`).toBe(5);
    }
  });

  it('is applied by an EMPOWERED Ice Lance and not a plain one', () => {
    const actor = makeAttacker({ autoAttack: 'none' });
    const target = makeTarget();
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) });
    simulation.begin();
    const reaction = wintersChill(100, talentNumbers('mage', 'winter_s_chill', 5));
    const applies = (abilityId: string) =>
      reaction.canTrigger?.(simulation, actor, { abilityId } as never) ?? true;
    expect(applies('ice_lance')).toBe(false);
    simulation.applyAura(actor, fingersOfFrostAura(2), actor.id);
    expect(applies('ice_lance')).toBe(true);
  });

  it('is SPENT by the next Cone of Cold, which gains 20% damage and 7% spell power a stack', () => {
    /*
     * A hundred points of NEGATIVE crit, so neither cast can crit -- `NO_CHANCES`
     * does not stop one -- and the engine's default table, which does not miss.
     * Five stacks: x(1 + 5 x 20%) = x2 damage, and 5 x 7% = +0.35 coefficient.
     */
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: [CONE_OF_COLD],
      stats: { spellPower: 1000, spellCritChance: -1000 },
      resources: [{ type: 'mana', maximum: 50_000 }],
    });
    const target = makeTarget({ maxHealth: 10_000_000 });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([actor, target], { durationMs: seconds(60) }, {
      emit: (event) => events.push(event),
    });
    simulation.begin();
    const last = () => {
      const hit = events.filter((e) => e.type === 'damage' && e.abilityId === 'cone_of_cold').pop();
      return hit && hit.type === 'damage' ? hit.amount : 0;
    };

    castAbility(simulation, actor, CONE_OF_COLD, target);
    const plain = last();

    simulation.advanceTo(seconds(11));
    const chill = wintersChillAura(5);
    for (let stack = 0; stack < 5; stack++) simulation.applyAura(target, chill, actor.id);
    expect(target.auras.stacksOf('winters_chill')).toBe(5);
    castAbility(simulation, actor, CONE_OF_COLD, target);
    const chilled = last();

    const expected =
      (2 * (CONE_OF_COLD_DAMAGE + (CONE_OF_COLD_SP_COEFFICIENT + 0.35) * 1000)) /
      (CONE_OF_COLD_DAMAGE + CONE_OF_COLD_SP_COEFFICIENT * 1000);
    expect(chilled / plain).toBeCloseTo(expected, 6);
    // "Your NEXT Cone of Cold": spent.
    expect(target.auras.has('winters_chill')).toBe(false);
  });
});

describe('Ice Lance at 1.60.1.70707', () => {
  it('has the 8 second cooldown at every rank', () => {
    expect(ICE_LANCE.cooldownMs).toBe(seconds(8));
  });
});

describe('Missile Barrage at 1.60.1.70707', () => {
  it('reads its other-spells chance at index 1, now the Missile clause is gone', () => {
    // [blast, others, duration%, cost%, interval]
    expect(talentNumbers('mage', 'missile_barrage', 2)).toEqual([40, 20, 50, 100, 0.5]);
    const reaction = missileBarrage(40, talentNumbers('mage', 'missile_barrage', 2));
    const seen: number[] = [];
    const context = { rng: { rollChance: (p: number) => (seen.push(p), true) } } as never;
    for (const abilityId of ['arcane_blast', 'fireball', 'frostbolt', 'arcane_missiles']) {
      reaction.canTrigger?.(context, undefined as never, { abilityId } as never);
    }
    // 40% off Arcane Blast, 20% off Fireball and Frostbolt -- and NOT the 50% at
    // index 2 -- and nothing at all off a missile.
    expect(seen).toEqual([0.4, 0.2, 0.2]);
  });
});

describe('the replaced talents', () => {
  it('Accelerant takes half a second off Arcane Wrath as well as Fireball and Frostfire Bolt', () => {
    const mage = createPlayer({
      race: 'gnome',
      characterClass: 'mage',
      combatStyle: 'caster',
      talents: legalise({ accelerant: 5, arcane_wrath: 1, arcane_blast: 1 }, 'mage'),
    });
    expect(resolveCast(mage, mage.abilities.get('arcane_wrath')!).baseCastTimeMs).toBe(seconds(3));
    expect(MAGE_TALENT_EFFECTS.accelerant.map((e) => (e as { abilityId: string }).abilityId)).toEqual([
      'fireball',
      'frostfire_bolt',
      'arcane_wrath',
    ]);
  });

  it('removes Arcane Focus, Improved Fireball and Elemental Precision', () => {
    for (const id of ['arcane_focus', 'improved_fireball', 'elemental_precision']) {
      expect(MAGE_TALENT_EFFECTS[id], id).toBeUndefined();
    }
  });

  it('gives Arcane Resilience a third rank, 75% of Intellect', () => {
    expect(talentNumber('mage', 'arcane_resilience', 3, 0)).toBe(75);
  });

  it('moves Critical Mass to three ranks and Incineration to five', () => {
    expect(talentNumber('mage', 'critical_mass', 3, 0)).toBe(6);
    expect(talentNumber('mage', 'incineration', 5, 0)).toBe(10);
  });
});

describe('Arcane Blast at 1.60.1.70707', () => {
  it('is 12% of Intellect, +100% cost and 18 seconds a stack', () => {
    expect(ARCANE_BLAST_INTELLECT_TO_SPELL_POWER).toBe(0.12);
    expect(ARCANE_BLAST_COST_INCREASE_PER_STACK).toBe(1.0);
    expect(ARCANE_BLAST_DURATION_MS).toBe(seconds(18));
  });
});
