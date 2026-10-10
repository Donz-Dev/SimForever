import { describe, expect, it } from 'vitest';
import type { AttackTableKind, Combatant } from '../../src/engine';
import { NO_CHANCES, ROLL_MAX, Simulation, toRollUnits } from '../../src/engine';
import { COMBAT_CONSTANTS, createForeverAttackChances } from '../../src/game/combat/attackChances';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { talentNumber } from '../../src/game/talents/talentValues';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import { SERPENT_STING_ABILITY } from '../../src/game/abilities/hunter';
import { INSECT_SWARM, MOONFIRE_DOT, RAKE_DOT } from '../../src/game/auras/druid';
import { SERPENT_STING } from '../../src/game/auras/hunter';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { buildSimulation } from '../helpers/buildSimulation';

/*
 * ============================================================================
 * CHANCE TO HIT AND SPELLS, from the ruleset owner's four statements.
 *
 *   - spell direct damage AND spell DoT APPLICATIONS miss on a flat 17%,
 *     reducible to a floor of 1% -- so the usable hit cap is 16%;
 *   - once a DoT is APPLIED it never checks hit again;
 *   - Nature's Reach improves melee AND spell hit by 4%, and was doing neither.
 *
 * Written out BY HAND here rather than read back out of the source, which is
 * what makes it a test of the ruleset rather than of the transcription.
 * ============================================================================
 */

/** By hand, from the owner's statement. */
const SPELL_MISS_PERCENT = 17;
const SPELL_MISS_FLOOR_PERCENT = 1;
const SPELL_HIT_CAP_PERCENT = 16;

/** Nature's Reach at rank 2, by hand from the tooltip. */
const NATURES_REACH_HIT = 4;
/*
 * AND ALL THREE DRUID PRESETS ARE A TAUREN, whose Endurance is "chance to hit
 * for melee, ranged, and spells increased by 1%" -- the same `hitChance` stat
 * Nature's Reach grants. Written out by hand like the figure above, so this
 * stays a test of the ruleset rather than of the transcription.
 */
const TAUREN_ENDURANCE_HIT = 1;

const spellMiss = (hitChance: number): number => {
  const caster = makeAttacker({ stats: { hitChance } });
  return createForeverAttackChances()('spell', caster, makeTarget(), {}).miss;
};

describe("the owner's spell hit numbers", () => {
  it('is 17% base, 1% floor, and therefore a 16% cap', () => {
    expect(COMBAT_CONSTANTS.spellMiss).toBe(toRollUnits(SPELL_MISS_PERCENT));
    expect(COMBAT_CONSTANTS.spellMissFloor).toBe(toRollUnits(SPELL_MISS_FLOOR_PERCENT));
    expect(SPELL_MISS_PERCENT - SPELL_MISS_FLOOR_PERCENT).toBe(SPELL_HIT_CAP_PERCENT);
  });

  it('spends every point up to the cap and nothing after it', () => {
    expect(spellMiss(0)).toBe(toRollUnits(17));
    expect(spellMiss(1)).toBe(toRollUnits(16));
    expect(spellMiss(SPELL_HIT_CAP_PERCENT)).toBe(toRollUnits(SPELL_MISS_FLOOR_PERCENT));
    // The seventeenth point is the first wasted one.
    expect(spellMiss(17)).toBe(toRollUnits(SPELL_MISS_FLOOR_PERCENT));
    expect(spellMiss(99)).toBe(toRollUnits(SPELL_MISS_FLOOR_PERCENT));
  });

  it('reads the character-wide stat and not a per-HAND hit bonus', () => {
    /*
     * A SPELL HAS NO HAND. `attackChances` defaults an unnamed slot to
     * `mainHand`, and the melee term adds that hand's own bonus -- Dual Wield
     * Specialization's ten points, which belong to the off hand alone.
     *
     * NOTHING GRANTS MAIN-HAND HIT TODAY, so this is worth zero and is asserted
     * anyway: the day something does, a spell quietly collecting it would look
     * exactly like a correct number.
     */
    const caster = makeAttacker({ stats: { hitChance: 0 }, hitBonusBySlot: { mainHand: 10 } });
    expect(createForeverAttackChances()('spell', caster, makeTarget(), {}).miss).toBe(
      toRollUnits(SPELL_MISS_PERCENT),
    );
    // And the melee table DOES read it, which is the half that must not change.
    const melee = createForeverAttackChances()('melee-special', caster, makeTarget(), {});
    const without = createForeverAttackChances()('melee-special', makeAttacker({}), makeTarget(), {});
    expect(melee.miss).toBeLessThan(without.miss);
  });
});

describe("Nature's Reach, which was doing neither of its clauses", () => {
  /*
   * --------------------------------------------------------------------------
   * "Increases the range of your offensive Balance spells by 20% and improves
   * your chance to hit by 4%."
   *
   * IT WAS ONE `unmodelled` ENTRY SCOPED `positioning` -- "Range, and nothing
   * here has a position" -- which is true of the first clause and silent about
   * the second. A `scope` is PERMANENT by design, so the hit clause was not a
   * live gap waiting to be found: the talent was counted as RULED OUT and the
   * census had nothing to report. All three Druid profiles take it at rank 2.
   *
   * THE NAME IS WHY. Classic's Nature's Reach is range and nothing else.
   * --------------------------------------------------------------------------
   */
  it('states 20% range and 4% hit at rank 2, in that order', () => {
    expect(talentNumber('druid', 'nature_s_reach', 2, 0)).toBe(20);
    expect(talentNumber('druid', 'nature_s_reach', 2, 1)).toBe(NATURES_REACH_HIT);
  });

  it('grants the hit and keeps the range clause ruled out', () => {
    const build = talentBuild('druid', { nature_s_reach: 2 });
    expect(build.stats.hitChance).toBe(NATURES_REACH_HIT);

    const [hit, unmodelled] = DRUID_TALENT_EFFECTS.nature_s_reach;
    expect(hit).toMatchObject({ kind: 'stat', stat: 'hitChance', valueIndex: 1 });
    expect(unmodelled).toMatchObject({ kind: 'unmodelled', scope: 'positioning' });
  });

  it('scales with rank, so rank 1 is 2%', () => {
    expect(talentBuild('druid', { nature_s_reach: 1 }).stats.hitChance).toBe(2);
  });

  it('reaches all three profiles, each of which takes it at rank 2', () => {
    /*
     * ONE `hitChance` REACHES EVERY TABLE, which is what the tooltip means by
     * "your chance to hit" and what this engine already does: the spell branch
     * reads the stat directly and the melee branches read it through
     * `missFromSkill`. So the Moonkin's spells and the Cat's and Bear's
     * abilities are all covered by one entry.
     */
    /*
     * AND SO DOES TAUREN ENDURANCE, WHICH ALL THREE PRESETS CARRY. It grants
     * the same `hitChance` stat, so each figure is gear plus the racial plus
     * the talent -- kept as three terms rather than one total so that either
     * source going missing fails here instead of netting out against the other.
     */
    for (const [preset, fromGear] of [
      ['druid_moonkin', 5],
      ['druid_cat', 5],
      ['druid_bear', 7],
    ] as const) {
      const built = PRESETS_BY_ID.get(preset)!.build();
      expect(built.character.race, preset).toBe('tauren');
      expect(built.talents.nature_s_reach, preset).toBe(2);
      const snapshot = characterAtCombatStart(built)!;
      expect(snapshot.stats.effective.hitChance, preset).toBeCloseTo(
        fromGear + TAUREN_ENDURANCE_HIT + NATURES_REACH_HIT,
        6,
      );
    }
  });

  it('narrows the miss band on every table the three profiles use', () => {
    const tableFor = (preset: string, kind: AttackTableKind) => {
      const built = PRESETS_BY_ID.get(preset)!.build();
      const player = characterAtCombatStart(built)!;
      const bare = makeAttacker({ stats: { hitChance: 0 } });
      const chances = (actor: Combatant) =>
        createForeverAttackChances()(
          kind,
          actor,
          makeTarget(),
          {},
        ).miss;
      return { talented: chances(player), untalented: chances(bare) };
    };

    // The Moonkin's spells, and the two feral builds' abilities.
    // 5 from gear + 1 from Tauren Endurance + 4 from Nature's Reach.
    const moonkin = tableFor('druid_moonkin', 'spell');
    expect(moonkin.talented).toBe(
      moonkin.untalented - toRollUnits(5 + TAUREN_ENDURANCE_HIT + NATURES_REACH_HIT),
    );
    for (const preset of ['druid_cat', 'druid_bear'] as const) {
      const melee = tableFor(preset, 'melee-special');
      expect(melee.talented, preset).toBeLessThan(melee.untalented);
    }
  });
});

describe('a DoT rolls to hit when it is APPLIED and never again', () => {
  /**
   * A table that always misses, or never does.
   *
   * SCRIPTED RATHER THAN STACKED, because hit cannot be pushed negative:
   * `toRollUnits` returns 0 for anything at or below zero, so a `hitChance` of
   * -1000 is a hit of 0 and the character still lands most of its casts. The
   * first draft of this test did exactly that and passed for the wrong reason.
   */
  const scripted = (miss: number) => () => ({
    ...NO_CHANCES,
    miss,
  });

  /** A Hunter with mana, one ability and nothing else going on. */
  const hunter = () =>
    makeAttacker({
      autoAttack: 'none',
      abilities: [SERPENT_STING_ABILITY],
      resources: [{ type: 'mana', maximum: 10_000, initial: 10_000 }],
    });

  it('refuses to apply Serpent Sting when the roll misses', () => {
    /*
     * ------------------------------------------------------------------------
     * SERPENT STING WAS THE ONE DoT THAT COULD NOT MISS. It declares
     * `ranged-special` and applied its aura unconditionally, where every other
     * DoT in the project either gates on `dealDamage`'s own outcome (Moonfire,
     * Immolate, Flame Shock) or rolls explicitly (Rip, Rend, Rupture, Lacerate).
     *
     * INVISIBLE BECAUSE A MISSING MISS IS NOT AN ERROR: the sting landed every
     * cast, its ticks were the right size, and the damage table summed to 100%.
     * The figure was simply high by the ranged miss chance.
     * ------------------------------------------------------------------------
     */
    const caster = hunter();
    const target = makeTarget();
    const simulation = buildSimulation([caster, target], {
      attackChances: scripted(ROLL_MAX),
    });
    simulation.begin();
    const cast = simulation.cast(caster, SERPENT_STING_ABILITY, target);
    expect(cast.ok, JSON.stringify(cast)).toBe(true);
    expect(target.auras.has(SERPENT_STING.id)).toBe(false);
  });

  it('applies it when the roll cannot miss', () => {
    const caster = hunter();
    const target = makeTarget();
    const simulation = buildSimulation([caster, target], {
      attackChances: scripted(0),
    });
    simulation.begin();
    simulation.cast(caster, SERPENT_STING_ABILITY, target);
    expect(target.auras.has(SERPENT_STING.id)).toBe(true);
  });

  it('never re-rolls hit once it is on, however much the carrier would miss', () => {
    /*
     * The owner's second statement. A tick declares no `attackTable` at all --
     * only `critFrom`, which borrows a crit chance and resolves nothing else --
     * so there is no band for it to fall into. Asserted on the DEFINITIONS,
     * because "it cannot miss" is a property of how the tick is declared rather
     * than of any particular fight.
     */
    for (const aura of [MOONFIRE_DOT, INSECT_SWARM, RAKE_DOT, SERPENT_STING]) {
      expect(aura.periodic, aura.id).toBeDefined();
    }

    /*
     * AND IN A FIGHT: a sting applied on a table that cannot miss, which then
     * becomes a table that cannot hit. Every tick must still land, because the
     * tick never asks.
     */
    const caster = hunter();
    const target = makeTarget({ stats: { armor: 0 } });
    const ticks: number[] = [];
    let miss = 0;
    const simulation = buildSimulation(
      [caster, target],
      { attackChances: () => ({ ...NO_CHANCES, miss }), durationMs: 60_000 },
      {
        emit: (event) => {
          if (event.type === 'damage' && event.periodic) ticks.push(event.amount);
        },
      },
    );
    simulation.begin();
    simulation.cast(caster, SERPENT_STING_ABILITY, target);
    expect(target.auras.has(SERPENT_STING.id)).toBe(true);
    // The table goes to always-miss AFTER the aura is on.
    miss = ROLL_MAX;
    simulation.advanceTo(60_000);

    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.every((amount) => amount > 0)).toBe(true);
  });
});

describe('the Moonkin end to end', () => {
  it('casts its spells against a 17-minus-9 miss band', () => {
    /*
     * THROUGH THE REAL ENCOUNTER, because the stat arrives from `createPlayer`
     * and the table from `trainingDummyEncounter`, and a hit talent that
     * reached the build and not the roll would pass every test above.
     */
    const base = PRESETS_BY_ID.get('druid_moonkin')!.build();
    const simulation = new Simulation(trainingDummyEncounter(base));
    simulation.begin();
    const player = simulation.combatants.find((actor) => actor.kind === 'player')!;
    const enemy = simulation.combatants.find((actor) => actor.kind === 'enemy')!;

    // 5 from gear + 1 from Tauren Endurance + 4 from Nature's Reach, against
    // the flat 17% a spell misses on.
    expect(player.stats.effective.hitChance).toBeCloseTo(10, 6);
    expect(simulation.attackChances('spell', player, enemy, {}).miss).toBe(toRollUnits(7));
  });
});
