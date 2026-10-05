import { describe, expect, it } from 'vitest';
import type { TelemetryEvent } from '../../src/engine';
import { ALL_ABILITIES } from '../../src/engine';
import {
  THUNDER_CLAP,
  WARRIOR_ABILITIES,
  warriorAbility,
} from '../../src/game/abilities/warrior';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { buildSimulation } from '../helpers/buildSimulation';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { legalise } from '../helpers/legalTalents';

/*
 * ==============================================================================
 * THUNDER CLAP TAKES ITS CRIT FROM THE SPELL TABLE.
 *
 * The ruleset owner: "Thunder Clap uses the spell crit table, so global sources
 * of critical strike chance apply, but not crit from agility, or the Cruelty
 * talent or Weaponmaster talent."
 *
 * TWO OF THE THREE EXCLUSIONS FALL OUT OF THE TABLE AND ONE DID NOT, which is
 * the whole content of this file:
 *
 *   CRUELTY  is `{ stat: 'critChance' }`, and the spell table reads
 *            `spellCritChance`. Excluded for free.
 *   AGILITY  has no conversion to crit in this engine AT ALL, so the exclusion
 *            is vacuous today. Asserted anyway, so that the day one is built
 *            somebody sees this and checks it feeds `critChance`.
 *   WEAPONMASTER was an `ALL_ABILITIES` ability modifier, which reaches any
 *            ability with an id whatever table it uses. It needed a real fix,
 *            and the fix is at the TALENT: scoped to the melee tables, which is
 *            what "your melee weapon attacks" says anyway.
 * ==============================================================================
 */

describe('the crit comes from the spell table and the rest of the roll does not', () => {
  /*
   * DRIVEN THROUGH THE REAL `onCast`, so the request under test is the one the
   * ability actually builds. The simulation is left WITHOUT a chances provider on
   * purpose: the engine's own fallback gives `spell` the character's
   * `spellCritChance` and every other table its `critChance`, which is exactly
   * the pair of tables this splice has to choose between.
   */
  function castWith(critChance: number, spellCritChance: number) {
    const attacker = makeAttacker({ stats: { attackPower: 0, critChance, spellCritChance } });
    const target = makeTarget({ maxHealth: 1e9 });
    const events: TelemetryEvent[] = [];
    const sim = buildSimulation([attacker, target], {}, { emit: (e) => events.push(e) });
    sim.begin();

    THUNDER_CLAP.onCast({
      simulation: sim,
      caster: attacker,
      target,
      ability: THUNDER_CLAP,
    } as never);

    const hit = events.find(
      (e) => e.type === 'damage' && (e as { abilityId?: string }).abilityId === 'thunder_clap',
    ) as unknown as { critical: boolean } | undefined;
    return hit;
  }

  it('crits off SPELL crit, even at zero melee crit', () => {
    const hit = castWith(0, 100);
    expect(hit?.critical).toBe(true);
  });

  it('does NOT crit off melee crit, even at a hundred percent', () => {
    /*
     * THE ASSERTION THE WHOLE RULING REDUCES TO. Before this, Thunder Clap took
     * the ranged table's crit, which the provider fills from `critChance` -- so
     * every melee crit source reached it.
     */
    const hit = castWith(100, 0);
    expect(hit?.critical).toBe(false);
  });

  it('still RESOLVES on the ranged table, which is not the same question', () => {
    /*
     * `critTable` moves two slices and nothing else. CLAUDE.md records why
     * Thunder Clap is on `ranged-special` and neither reason was range: that
     * table has no dodge or parry, and carrying no main- or off-hand slot is how
     * `isWeaponUse` keeps it out of weapon procs.
     *
     * MOVING THE WHOLE TABLE WAS TRIED AND MEASURED. Spell miss is a flat figure
     * where `missFromSkill` gave Thunder Clap almost none: 0.9% avoided became
     * 9.4%, a melee ability missing ten times as often off a sentence about
     * critical strikes. Every clause of the ruling is about crit, so only crit
     * moved.
     */
    expect(warriorAbility('thunder_clap')?.attackTable).toBe('ranged-special');
  });

  it('leaves Intercept and Charge alone', () => {
    // The owner named Thunder Clap. A ruling covers what it says.
    expect(warriorAbility('intercept')?.attackTable).toBe('ranged-special');
    expect(warriorAbility('charge')?.attackTable).toBe('ranged-special');
  });
});

describe('Cruelty cannot reach it, for free', () => {
  it('is a `critChance` stat, which the spell table does not read', () => {
    expect(WARRIOR_TALENT_EFFECTS.cruelty).toEqual([
      { kind: 'stat', stat: 'critChance', operation: 'flat' },
    ]);

    // It moves melee crit and leaves spell crit alone, so Thunder Clap is
    // untouched without anything having to name the ability.
    const build = talentBuild('warrior', legalise({ cruelty: 5 }));
    expect(build.stats.critChance).toBe(5);
    expect(build.stats.spellCritChance ?? 0).toBe(0);
  });
});

describe('Weaponmaster cannot reach it, and this is the part that needed fixing', () => {
  // The same fixture shape `armsTalentAudit.test.ts` uses: only the weapon
  // TYPE is read by this talent, so the rest is not built.
  const axe = { name: 'A', weaponType: 'axe' } as never;

  it('scopes its crit to the MELEE tables rather than every ability', () => {
    const build = talentBuild('warrior', legalise({ weaponmaster: 5 }), { mainHand: axe });

    expect(build.attackTableModifiers.for('melee-auto').critBonus).toBe(5);
    expect(build.attackTableModifiers.for('melee-special').critBonus).toBe(5);

    // The table Thunder Clap is now on, and the one it used to be on.
    expect(build.attackTableModifiers.for('spell').critBonus ?? 0).toBe(0);
    expect(build.attackTableModifiers.for('ranged-special').critBonus ?? 0).toBe(0);
  });

  it('is no longer a blanket per-ability bonus', () => {
    /*
     * THE OLD SCOPE WAS WRONG IN BOTH DIRECTIONS, and only one of them is the
     * owner's question. `ALL_ABILITIES` reaches every ability carrying an id --
     * so it caught Thunder Clap, Intercept and Charge -- and reaches NO auto
     * attack, because a swing has no ability id. "Your melee weapon attacks"
     * includes swings, which are the largest source on every Warrior profile.
     */
    const build = talentBuild('warrior', legalise({ weaponmaster: 5 }), { mainHand: axe });
    expect(build.abilityModifiers.for(ALL_ABILITIES).critBonus ?? 0).toBe(0);
  });
});

describe('the agility exclusion is vacuous, and says so', () => {
  it('has no agility-to-crit conversion anywhere to exclude', () => {
    /*
     * NOT A PASSING TEST DRESSED AS A CHECK. The owner excluded crit from
     * agility; this records that there is nothing to exclude yet, so the next
     * person to read the ruling does not go looking for the mechanism that
     * implements it. `baseStatTypes.ts` states it outright: the base crit
     * figures "are therefore NOT a character's actual crit chance, and the
     * engine does not currently use them: the agility-to-crit conversion that
     * completes the formula does not exist yet."
     *
     * WHEN IT IS BUILT it must feed `critChance`, and then this exclusion holds
     * for free exactly as Cruelty's does. If it ever feeds `spellCritChance`,
     * this test is where the ruling is written down.
     */
    const build = talentBuild('warrior', legalise({ cruelty: 5 }));
    // `statConversions` is the mechanism a stat-from-stat would arrive by --
    // `statFromStat`, the one Careful Aim uses for attack power. Nothing in the
    // project converts anything into either crit stat.
    const intoCrit = build.statConversions.filter(
      (c) => c.to === 'critChance' || c.to === 'spellCritChance',
    );
    expect(intoCrit).toEqual([]);
  });
});

describe('every Warrior ability still declares a table the provider knows', () => {
  it('uses only the two kinds a Warrior resolves on', () => {
    // A Warrior rolls on the melee and ranged special tables and nothing else --
    // the spell table is reached only as a CRIT source, never as a resolution.
    const allowed = new Set([undefined, 'melee-special', 'ranged-special']);
    for (const ability of WARRIOR_ABILITIES) {
      expect(allowed.has(ability.attackTable), `${ability.id}: ${ability.attackTable}`).toBe(true);
    }
  });
});
