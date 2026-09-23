import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { resolveCast } from '../../src/engine';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeTarget } from '../helpers/actors';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { WARRIOR_TALENT_EFFECTS } from '../../src/game/talents/warriorEffects';
import { ROGUE_TALENT_EFFECTS } from '../../src/game/talents/rogueEffects';
import { DRUID_TALENT_EFFECTS } from '../../src/game/talents/druidEffects';
import { SHAMAN_TALENT_EFFECTS } from '../../src/game/talents/shamanEffects';
import { MAGE_TALENT_EFFECTS } from '../../src/game/talents/mageEffects';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
import { HUNTER_TALENT_EFFECTS } from '../../src/game/talents/hunterEffects';
import { WARLOCK_TALENT_EFFECTS } from '../../src/game/talents/warlockEffects';
import { PRIEST_TALENT_EFFECTS } from '../../src/game/talents/priestEffects';

/*
 * ------------------------------------------------------------------------------
 * RULESET: "reduces the mana cost by N%" is a FRACTION OF THE COST.
 *
 * `CastModifier.costFraction` has been exactly that since it was built for
 * Maelstrom Weapon. What was missing was a way for a TALENT to hand one over,
 * and eleven talents across seven classes said so in almost identical words --
 * `abilityCost` subtracts a FLAT amount, which is right for a 20-rage Mortal
 * Strike and wrong for a 450-mana Earth Shock.
 *
 * So this is a new EFFECT rather than a new rule: the modifier, its resolution
 * and its consumption all already existed.
 * ------------------------------------------------------------------------------
 */

/** A live character with its talents applied and its opening auras up. */
function characterFor(preset: string, characterClass: string) {
  const built = PRESETS_BY_ID.get(preset)!.build();
  const actor = createPlayer({
    race: built.character.race as never,
    characterClass: characterClass as never,
    combatStyle: built.character.combatStyle as never,
    talents: built.talents,
  });
  // The auras arrive at the pull, so the simulation has to begin.
  buildSimulation([actor, makeTarget()]).advanceTo(0);
  return actor;
}

const costOf = (preset: string, characterClass: string, abilityId: string) => {
  const actor = characterFor(preset, characterClass);
  const ability = actor.abilities.get(abilityId)!;
  return {
    printed: ability.cost?.amount ?? 0,
    resolved: resolveCast(actor, ability).costAmount,
  };
};

describe('a talent can grant a cast modifier', () => {
  it('takes a percentage off the cost rather than a flat amount', () => {
    // Benediction 5/5 is "-10% on all instant cast spells and abilities", and
    // Seal of Command costs 210. A flat 10 would be the old, wrong reading.
    const seal = costOf('pally_ret', 'paladin', 'seal_of_command');
    expect(seal.printed).toBe(210);
    expect(seal.resolved).toBeCloseTo(210 * 0.9, 6);
  });

  it('STACKS ADDITIVELY when two talents name the same ability', () => {
    /*
     * ------------------------------------------------------------------------
     * Improved Wrath is -50% Wrath mana and Moonglow is -25% on every damaging
     * spell. Together that is -75%, not the -62.5% two multiplicative
     * reductions would give -- which is how percentage cost reductions behave
     * and falls out of `resolveCast` subtracting each from the BASE rather
     * than from the running total.
     *
     * Asserted because it is the one thing about this that could be quietly
     * wrong: both readings produce a plausible number.
     * ------------------------------------------------------------------------
     */
    const wrath = costOf('druid_moonkin', 'druid', 'wrath');
    expect(wrath.printed).toBe(120);
    expect(wrath.resolved).toBeCloseTo(120 * 0.25, 6);
    expect(wrath.resolved).not.toBeCloseTo(120 * 0.5 * 0.75, 6);
  });

  it('stacks a talent with an AURA that carries its own modifier', () => {
    /*
     * ------------------------------------------------------------------------
     * TWO ROUTES INTO THE SAME FIELD. Shadowform is -50% on Shadow spells and
     * arrives on an AURA the priest casts; Mental Agility is -10% on instants
     * and arrives from a TALENT. Sixty percent together.
     *
     * The talent-only figure is taken from a build WITHOUT the capstone
     * rather than by looking before the form goes up -- the priest casts
     * Shadowform as its opening action, so there is no "before" to measure in
     * a character that has it.
     * ------------------------------------------------------------------------
     */
    const built = PRESETS_BY_ID.get('shadow_priest')!.build();
    const withoutForm = { ...built.talents, shadowform: 0 };

    const plain = createPlayer({
      race: 'troll',
      characterClass: 'priest',
      combatStyle: 'caster',
      talents: withoutForm,
    });
    const plainPain = plain.abilities.get('shadow_word_pain')!;
    buildSimulation([plain, makeTarget()]).advanceTo(0);
    expect(resolveCast(plain, plainPain).costAmount).toBeCloseTo(470 * 0.9, 6);

    // And with the form, which the real build casts at the pull.
    const full = characterFor('shadow_priest', 'priest');
    expect(full.auras.has('shadowform')).toBe(true);
    const pain = full.abilities.get('shadow_word_pain')!;
    expect(resolveCast(full, pain).costAmount).toBeCloseTo(470 * 0.4, 6);
  });

  it('touches only the abilities the talent names', () => {
    // Shamanistic Focus is the Shocks. Lightning Bolt is not one.
    const shock = costOf('shaman_elemental', 'shaman', 'flame_shock');
    const bolt = costOf('shaman_elemental', 'shaman', 'lightning_bolt');

    // Convection (-10%) and Shamanistic Focus (-45%) both reach Flame Shock.
    expect(shock.resolved).toBeCloseTo(shock.printed * 0.45, 6);
    // Only Convection reaches Lightning Bolt.
    expect(bolt.resolved).toBeCloseTo(bolt.printed * 0.9, 6);
  });

  it('gives a character without the talent nothing at all', () => {
    const actor = createPlayer({
      race: 'tauren',
      characterClass: 'druid',
      combatStyle: 'moonkin',
    });
    const wrath = actor.abilities.get('wrath')!;
    expect(resolveCast(actor, wrath).costAmount).toBe(wrath.cost!.amount);
    expect(talentBuild('druid', {}).castModifierAuras).toEqual([]);
  });
});

describe('what it retired', () => {
  it('leaves no talent claiming a percentage cost cannot be expressed', () => {
    /*
     * ------------------------------------------------------------------------
     * THE REASON THIS TEST EXISTS. An `unmodelled` reason is a claim about the
     * engine on the day it was written, and it EXPIRES -- CLAUDE.md says so,
     * and this project has been caught by stale ones three times.
     *
     * Eleven talents across seven classes carried the same claim in almost
     * identical words: that `abilityCost` subtracts a flat amount and nothing
     * could express a percentage. That is no longer true of any of them, and
     * this fails if one is left behind.
     *
     * It deliberately matches on the WORDING rather than on a list of talent
     * ids, because a new class writing the same sentence is exactly the thing
     * worth catching.
     * ------------------------------------------------------------------------
     */
    const TABLES = {
      warrior: WARRIOR_TALENT_EFFECTS,
      rogue: ROGUE_TALENT_EFFECTS,
      druid: DRUID_TALENT_EFFECTS,
      shaman: SHAMAN_TALENT_EFFECTS,
      mage: MAGE_TALENT_EFFECTS,
      paladin: PALADIN_TALENT_EFFECTS,
      hunter: HUNTER_TALENT_EFFECTS,
      warlock: WARLOCK_TALENT_EFFECTS,
      priest: PRIEST_TALENT_EFFECTS,
    };

    const stale: string[] = [];
    for (const [characterClass, table] of Object.entries(TABLES)) {
      for (const [talentId, effects] of Object.entries(table)) {
        for (const effect of effects) {
          if (effect.kind !== 'unmodelled') continue;
          // The exact complaint: a flat cost cannot express a percentage.
          if (/`abilityCost` subtracts a flat/i.test(effect.reason)) {
            stale.push(`${characterClass}/${talentId}`);
          }
        }
      }
    }

    expect(stale).toEqual([]);
  });

  it('is declared by every class that had the gap', () => {
    // Seven classes had at least one. Asserted so that removing a declaration
    // by accident is a failure rather than a quiet loss.
    const withModifier = Object.entries({
      druid: 'druid_moonkin',
      shaman: 'shaman_elemental',
      mage: 'mage_frostfire',
      paladin: 'pally_ret',
      hunter: 'bm_hunter',
      warlock: 'warlock_firelock',
      priest: 'shadow_priest',
    });

    for (const [characterClass, preset] of withModifier) {
      const build = talentBuild(
        characterClass as never,
        PRESETS_BY_ID.get(preset)!.build().talents,
      );
      expect(build.castModifierAuras.length, characterClass).toBeGreaterThan(0);
    }
  });
});
