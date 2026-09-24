import { describe, expect, it } from 'vitest';
import type { AttackTableKind, Combatant } from '../../src/engine';
import { AttackTableModifiers, dealDamage } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { HUNTER_TALENT_EFFECTS } from '../../src/game/talents/hunterEffects';

/*
 * ------------------------------------------------------------------------------
 * RULESET: crit, crit damage and damage can be scoped to an ATTACK TABLE.
 *
 * The other axis from `SchoolModifiers`. A school separates fire from frost;
 * this separates MELEE from RANGED, and a SWING from a SPECIAL.
 *
 * Four Hunter talents wanted it and each wanted a different subset, which is
 * exactly why it keys on the table rather than on a 'melee' | 'ranged' enum:
 *
 *   Savage Strikes      "all your melee ABILITIES"     melee-special
 *   Ranged Weapon Spec  "damage with ranged WEAPONS"   ranged-auto + special
 *   Mortal Shots        "all ranged ABILITIES"         ranged-special
 *   Predator's Edge     "your MELEE crit damage"       melee-auto + special
 *
 * Two were fully inert; two were applied whole-character with a written
 * caveat. Every expectation below is written out from the tooltip's own words.
 * ------------------------------------------------------------------------------
 */

const BASE = 1000;

/** Deals flat damage on a named table, with no roll, so only modifiers show. */
function hitOn(actor: Combatant, target: Combatant, table: AttackTableKind) {
  const simulation = buildSimulation([actor, target]);
  simulation.advanceTo(0);
  const before = target.health.current;
  dealDamage(simulation, {
    source: actor,
    target,
    abilityName: 'probe',
    school: 'physical',
    baseAmount: BASE,
    // Named, but the damage is what is being measured -- crit is pinned off
    // by the crit tests below, which read the chances instead.
    attackTable: table,
    appliesArmor: false,
  });
  return before - target.health.current;
}

function actorWith(build: (m: AttackTableModifiers) => void): Combatant {
  const attackTableModifiers = new AttackTableModifiers();
  build(attackTableModifiers);
  return makeAttacker({ autoAttack: 'none', attackTableModifiers });
}

describe('per-table damage', () => {
  it('raises the tables it names and leaves the others alone', () => {
    const actor = actorWith((m) => {
      // Ranged Weapon Specialization: the WEAPON, so both ranged tables.
      m.add('ranged-auto', { damageMultiplier: 1.05 });
      m.add('ranged-special', { damageMultiplier: 1.05 });
    });
    const target = makeTarget({ maxHealth: 1_000_000 });

    expect(hitOn(actor, target, 'ranged-auto')).toBeCloseTo(BASE * 1.05, 6);
    expect(hitOn(actor, target, 'ranged-special')).toBeCloseTo(BASE * 1.05, 6);
    // A melee build carrying it would get nothing, which is the point.
    expect(hitOn(actor, target, 'melee-auto')).toBeCloseTo(BASE, 6);
    expect(hitOn(actor, target, 'melee-special')).toBeCloseTo(BASE, 6);
  });

  it('separates a SWING from a SPECIAL on the same side', () => {
    /*
     * The distinction two of the four talents turn on. "All your melee
     * abilities" must not reach the swing underneath them, and a two-hander's
     * swing is most of its damage -- so getting this backwards would be worth
     * far more than the talent is.
     */
    const actor = actorWith((m) => m.add('melee-special', { damageMultiplier: 1.5 }));
    const target = makeTarget({ maxHealth: 1_000_000 });

    expect(hitOn(actor, target, 'melee-special')).toBeCloseTo(BASE * 1.5, 6);
    expect(hitOn(actor, target, 'melee-auto')).toBeCloseTo(BASE, 6);
  });

  it('does NOT reach a damage-over-time tick', () => {
    /*
     * ------------------------------------------------------------------------
     * A tick has no attack table -- its landing was settled when the effect
     * was applied -- and only declares `critFrom`, which says which table's
     * CRIT it borrows. The damage multiplier is looked up on `attackTable`
     * alone, so it stops here.
     *
     * Serpent Sting is the case that makes it matter: it ticks NATURE damage
     * with `critFrom: 'ranged-special'`, and "the damage you deal with ranged
     * WEAPONS" is not a sting's poison.
     * ------------------------------------------------------------------------
     */
    const actor = actorWith((m) => m.add('ranged-special', { damageMultiplier: 1.05 }));
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target]);
    simulation.advanceTo(0);

    const before = target.health.current;
    dealDamage(simulation, {
      source: actor,
      target,
      abilityName: 'sting tick',
      school: 'nature',
      baseAmount: BASE,
      periodic: true,
      critFrom: 'ranged-special',
      appliesArmor: false,
    });
    expect(before - target.health.current).toBeCloseTo(BASE, 6);
  });
});

describe('what each Hunter talent selects', () => {
  const modifiersFor = (preset: string) =>
    talentBuild('hunter', PRESETS_BY_ID.get(preset)!.build().talents).attackTableModifiers;

  it('gives Savage Strikes melee ABILITIES and not the swing', () => {
    // 2/2 is +4% crit, and LW Melee is the build that takes it.
    const m = modifiersFor('lw_melee');
    expect(m.for('melee-special').critBonus).toBe(4);
    expect(m.for('melee-auto').critBonus ?? 0).toBe(0);
    expect(m.for('ranged-special').critBonus ?? 0).toBe(0);
  });

  it('gives Ranged Weapon Specialization BOTH ranged tables', () => {
    // 5/5 is +5% damage with ranged weapons, and Auto Shot is most of that.
    const m = modifiersFor('lw_ranged');
    expect(m.for('ranged-auto').damageMultiplier).toBeCloseTo(1.05, 6);
    expect(m.for('ranged-special').damageMultiplier).toBeCloseTo(1.05, 6);
    expect(m.for('melee-auto').damageMultiplier ?? 1).toBe(1);
  });

  it("gives Predator's Edge both MELEE tables, swing included", () => {
    /*
     * It says "your melee critical strike damage", not "your melee
     * abilities", so the swing counts -- and for a two-hander build the swing
     * is most of the damage. Worth +15.5 DPS on its own.
     *
     * +30% of the BONUS half: a melee crit multiplies by 2, so the bonus is
     * 1.0 and 30% of it is 0.3, giving x2.3 rather than x2.6.
     */
    const m = modifiersFor('lw_melee');
    expect(m.for('melee-auto').critMultiplierBonus).toBeCloseTo(0.3, 6);
    expect(m.for('melee-special').critMultiplierBonus).toBeCloseTo(0.3, 6);
    // And no longer the ranged one, which is what it used to over-apply to.
    expect(m.for('ranged-special').critMultiplierBonus ?? 0).toBe(0);
  });

  it('gives Mortal Shots ranged ABILITIES only', () => {
    // 5/5 is +30% crit damage bonus. Auto Shot is not an ability.
    const m = modifiersFor('bm_hunter');
    expect(m.for('ranged-special').critMultiplierBonus).toBeCloseTo(0.3, 6);
    expect(m.for('ranged-auto').critMultiplierBonus ?? 0).toBe(0);
    expect(m.for('melee-special').critMultiplierBonus ?? 0).toBe(0);
  });

  it('gives a Hunter without any of them nothing at all', () => {
    expect(talentBuild('hunter', {}).attackTableModifiers.isEmpty).toBe(true);
  });
});

describe('what it retired', () => {
  it('leaves no Hunter talent claiming a table cannot be selected', () => {
    /*
     * An `unmodelled` reason is a claim about the engine on the day it was
     * written, and it expires. Matched on the WORDING rather than a list of
     * ids, the same way `grantCastModifier.test.ts` does it.
     */
    const stale: string[] = [];
    for (const [talentId, effects] of Object.entries(HUNTER_TALENT_EFFECTS)) {
      for (const effect of effects) {
        if (effect.kind !== 'unmodelled') continue;
        if (
          /has no table/i.test(effect.reason) ||
          /no clause\s+for the ranged slot/i.test(effect.reason) ||
          /neither selects\s+the melee half/i.test(effect.reason)
        ) {
          stale.push(talentId);
        }
      }
    }
    expect(stale).toEqual([]);
  });

  it('still says the one thing that is genuinely missing', () => {
    /*
     * Pandemic and Lethality want crit damage for a LIST OF NAMED abilities,
     * which is a different axis and still has no declaration -- the field
     * exists on `AbilityModifiers` and nothing reaches it. Their reasons were
     * re-read when this landed, so they name all three scopes rather than the
     * two that existed when they were written.
     *
     * Asserted so that clearing THAT blocker has to come back here too.
     */
    const predators = HUNTER_TALENT_EFFECTS.predator_s_edge.filter(
      (e) => e.kind === 'unmodelled',
    );
    expect(predators).toHaveLength(1);
    expect(predators[0].kind === 'unmodelled' && predators[0].reason).toMatch(/OFF-HAND/);
  });
});
