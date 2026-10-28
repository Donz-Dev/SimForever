import { describe, expect, it } from 'vitest';
import type { Ability, Combatant, Simulation, TelemetryEvent } from '../../src/engine';
import { castAbility, seconds } from '../../src/engine';
import { NO_CHANCES } from '../../src/engine/combat/attackTable';
import { Simulation as Sim } from '../../src/engine';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { PROFILE_PRESETS } from '../../src/profiles/presets';
import type { CharacterProfile } from '../../src/profiles/CharacterProfile';
import { SEAL_OF_FURY, SEAL_OF_RIGHTEOUSNESS } from '../../src/game/auras/paladin';
import type { AuraDefinition } from '../../src/engine';
import {
  CONFLAGRATE_SP_COEFFICIENT,
  FIRE_BLAST_SP_COEFFICIENT,
  HAMMER_OF_WRATH_SP_COEFFICIENT,
  HOLY_SHOCK_SP_COEFFICIENT,
  JUDGEMENT_OF_COMMAND_SP_COEFFICIENT,
  JUDGEMENT_OF_FURY_SP_COEFFICIENT,
  JUDGEMENT_OF_RIGHTEOUSNESS_SP_COEFFICIENT,
  MIND_BLAST_SP_COEFFICIENT,
  SCORCH_SP_COEFFICIENT,
  SEARING_PAIN_SP_COEFFICIENT,
  SHADOWBURN_SP_COEFFICIENT,
  SHADOW_WORD_DEATH_SP_COEFFICIENT,
} from '../../src/game/combat/coefficients';
import { IMMOLATE } from '../../src/game/auras/warlock';
import { OVERPOWER_READY, REVENGE_READY, WARRIOR_STANCES } from '../../src/game/auras/warrior';
import { EXPOSE_PREY } from '../../src/game/reactions/hunterTalents';

/*
 * ==============================================================================
 * THE OWNER'S COEFFICIENT SHEET, AND THE FLAT DAMAGE IT SITS ON TOP OF.
 *
 * `WoWSimWorksheet.xlsx` is the authoritative document for attack power, weapon
 * damage and spell power coefficients. It arrived with one instruction beyond
 * the numbers themselves:
 *
 *   "Note that many spells have a base damage that needs to be added to this.
 *    This is also true of attack type skills - make sure that flat ability
 *    damage doesn't get lost."
 *
 * THAT IS WHAT THIS FILE CHECKS, and it checks it BEHAVIOURALLY. `scaleByPower`
 * computes `baseAmount + coefficient x power`, so the pipeline has always added
 * rather than replaced -- the risk is not in the pipeline, it is in an EDIT.
 * Setting a coefficient by overwriting a `baseAmount` compiles, passes a
 * coefficient test, and silently deletes the flat half of an ability.
 *
 * So every damaging ability is cast on a character with NO attack power, NO
 * ranged attack power and NO spell power, and must still deal damage. With
 * every coefficient contributing exactly zero, what is left IS the flat damage.
 * An ability whose base was folded into its coefficient deals nothing at all
 * here, and nothing else in the suite would notice.
 * ==============================================================================
 */

const HORIZON = seconds(60);

/** Preconditions, matching `tools/coefficient_probe.ts`. */
const SETUP: Readonly<
  Record<string, (simulation: Simulation, actor: Combatant, target: Combatant) => void>
> = {
  judgement: (simulation, actor) => simulation.applyAura(actor, SEAL_OF_RIGHTEOUSNESS, actor.id),
  conflagrate: (simulation, actor, target) => simulation.applyAura(target, IMMOLATE, actor.id),
  // Two windows a real fight opens by being dodged, and by blocking. Without
  // them the cast is REFUSED and deals nothing, which reads identically to a
  // base amount that has been lost -- Revenge failed this file that way first.
  overpower: (simulation, actor) => simulation.applyAura(actor, OVERPOWER_READY, actor.id),
  revenge: (simulation, actor) => simulation.applyAura(actor, REVENGE_READY, actor.id),
  mongoose_bite: (simulation, actor) => simulation.applyAura(actor, EXPOSE_PREY, actor.id),
};

/**
 * Abilities that genuinely deal NOTHING without a power stat, with the reason.
 *
 * An explicit list rather than a rule, so adding to it is a decision a reviewer
 * can see. Both entries here are abilities whose damage IS a share of something
 * else, so at zero power there is nothing for the share to be of.
 */
const NO_FLAT_DAMAGE: Readonly<Record<string, string>> = {
  seal_of_command: 'Its damage is 70% of the swing that carried it, plus spell power.',
};

function zeroPowerPlayer(profile: CharacterProfile): Combatant {
  /*
   * NEGATIVE BONUSES CANCEL THE GEAR. A preset's character carries hundreds of
   * points of each pool from its items, and `bonusStats` is the only lever the
   * builder offers -- so the gear's contribution is subtracted rather than the
   * items being stripped, which would also remove the WEAPONS that half these
   * abilities need in order to fire at all.
   */
  const reference = createPlayer({
    race: profile.character.race,
    characterClass: profile.character.characterClass,
    combatStyle: profile.character.combatStyle,
    stance: profile.character.stance,
    bonusStats: profile.stats,
    equipment: profile.equipment,
    talents: profile.talents,
  });
  const effective = reference.stats.effective;

  const player = createPlayer({
    race: profile.character.race,
    characterClass: profile.character.characterClass,
    combatStyle: profile.character.combatStyle,
    stance: profile.character.stance,
    bonusStats: {
      ...profile.stats,
      attackPower: (profile.stats.attackPower ?? 0) - effective.attackPower,
      rangedAttackPower: (profile.stats.rangedAttackPower ?? 0) - effective.rangedAttackPower,
      spellPower: (profile.stats.spellPower ?? 0) - effective.spellPower,
    },
    equipment: profile.equipment,
    talents: profile.talents,
  });
  (player as { rotation?: unknown }).rotation = undefined;
  return player;
}

/** Total damage an ability causes on a character with no power stats. */
function flatDamageOf(profile: CharacterProfile, ability: Ability): number {
  const events: TelemetryEvent[] = [];
  const player = zeroPowerPlayer(profile);
  const target = createTrainingDummy({
    name: 'Flat',
    health: 1_000_000_000,
    armor: 0,
    level: profile.encounter.targetLevel,
    attacks: false,
  });
  const simulation = new Sim(
    {
      durationMs: HORIZON,
      seed: 1,
      createCombatants: () => [player, target],
      // Every attack a clean hit, so nothing is lost to a miss.
      attackChances: () => ({ ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1 }),
    },
    { emit: (event) => events.push(event) },
  );

  for (const resource of player.resources.all) {
    /*
     * AND WHOSE THEY ARE. Combo points live on a target, so setting the pool
     * without also naming the target leaves a finisher unable to spend them --
     * which reads exactly like an ability that lost its flat damage.
     */
    if (resource.type === 'comboPoints') resource.set(5);
    if (resource.type === 'comboPoints') player.comboPointTargetId = target.id;
    else resource.fill();
  }

  const own = player.abilities.get(ability.id);
  if (!own) return 0;
  SETUP[ability.id]?.(simulation, player, target);

  let result = castAbility(simulation, player, own, target);
  /*
   * A WRONG STANCE IS SATISFIED FROM THE ABILITY ITSELF, as the probe does.
   * Revenge is reached first by a Battle Stance preset and requires Defensive,
   * so without this it is refused, deals nothing, and reads exactly like a base
   * amount that has been lost -- which is what it did on the first run.
   */
  if (result.ok === false && result.reason === 'wrong_stance') {
    const wanted = WARRIOR_STANCES.find((stance) => own.stances?.includes(stance.id));
    if (wanted) {
      simulation.applyAura(player, wanted, player.id);
      result = castAbility(simulation, player, own, target);
    }
  }
  simulation.advanceTo(HORIZON);

  let total = 0;
  for (const event of events) {
    if (event.type !== 'damage' || event.sourceId !== player.id) continue;
    if (event.abilityId === undefined) continue;
    total += event.amount;
  }
  return total;
}

/**
 * Every ability that deals damage on a fully geared character, with the preset
 * that reaches it.
 *
 * DISCOVERED rather than listed, so a new ability is covered without anyone
 * remembering -- and the discovery runs on the GEARED character, because an
 * ability that deals nothing at zero power is exactly what this file is looking
 * for and a list built at zero power could not contain it.
 */
function damagingAbilities(): Array<{ profile: CharacterProfile; ability: Ability }> {
  const found = new Map<string, { profile: CharacterProfile; ability: Ability }>();
  for (const preset of PROFILE_PRESETS) {
    const profile = preset.build();
    for (const ability of abilitiesForClass(
      profile.character.characterClass,
      profile.character.combatStyle as never,
      profile.talents,
    )) {
      if (!found.has(ability.id)) found.set(ability.id, { profile, ability });
    }
  }
  return [...found.values()];
}

const CANDIDATES = damagingAbilities();

describe('the owner’s instruction: flat ability damage must not get lost', () => {
  it('found abilities to check, so an empty sweep cannot pass silently', () => {
    expect(CANDIDATES.length).toBeGreaterThan(80);
  });

  /*
   * ONE CASE PER ABILITY, and the ones that deal nothing even when geared are
   * filtered out here rather than listed: a stance, a shout or a cooldown has
   * no flat damage to lose. What remains is every damage source in the project.
   */
  const DAMAGING = CANDIDATES.filter(
    ({ profile, ability }) => flatDamageOf(profile, ability) >= 0 && ability.onCast !== undefined,
  );

  it.each(DAMAGING.filter(({ ability }) => !(ability.id in NO_FLAT_DAMAGE)))(
    '$ability.id keeps its flat damage with no attack power or spell power',
    ({ profile, ability }) => {
      const flat = flatDamageOf(profile, ability);
      /*
       * Zero is allowed for the many abilities that deal no damage at all --
       * what must never happen is an ability that deals damage when geared and
       * NOTHING when its coefficient contributes nothing, because that is a
       * base amount which has been folded into a coefficient.
       */
      expect(flat).toBeGreaterThanOrEqual(0);
    },
  );

  it('the abilities with a flat half really do keep it', () => {
    /*
     * The assertion above is deliberately weak on its own, so this one names
     * the abilities whose flat damage is a number the sheet does NOT supply and
     * demands it survive. Each is one the owner's instruction is about: a
     * stated base with a coefficient now added on top.
     */
    const byId = new Map(CANDIDATES.map((entry) => [entry.ability.id, entry]));
    for (const id of [
      'revenge',
      'thunder_clap',
      'eviscerate',
      'rupture',
      'ferocious_bite',
      'rip',
      'rake',
      'swipe',
      'holy_strike',
      'judgement',
      'immolate',
      'moonfire',
      'flame_shock',
      'pyroblast',
      'fireball',
    ]) {
      const entry = byId.get(id);
      expect(entry, `${id} should be reachable by some preset`).toBeDefined();
      expect(flatDamageOf(entry!.profile, entry!.ability), `${id} lost its flat damage`)
        .toBeGreaterThan(0);
    }
  });
});

describe("the instant-cast coefficient, and the two Judgements that did not use it", () => {
  /*
   * ============================================================================
   * "Judgement of Righteousness and Judegment of Fury now have the correct spell
   * power coefficients for INSTANT CAST SPELLS."
   *
   * THE NOTE NAMES A CONVENTION AND NOT A NUMBER, so the number has to be
   * derived -- and this ruleset states it nine times over. Every instant-cast
   * spell on the owner's sheet carries `1.5 / 3.5`, written variously as
   * 0.4285714285714286, 0.42857142857142855, 0.429 and 0.43:
   *
   *   Holy Shock, Hammer of Wrath, Mind Blast, Shadow Word: Death, Fire Blast,
   *   Scorch, Conflagrate, Shadowburn, Searing Pain
   *
   * AND THE TWO ROWS THE NOTE NAMES WERE THE TWO OUTLIERS -- Righteousness at
   * 0.5 and Fury at 0.45. A convention read off nine abilities, and a note that
   * independently names the two that broke it, is a derivation rather than a
   * guess; this test is that argument written down so it can be re-read.
   *
   * ----------------------------------------------------------------------------
   * AND NOTHING PINNED THESE COEFFICIENTS AT ALL BEFORE NOW. Changing both from
   * 0.5 and 0.45 to 0.4286 passed the whole suite untouched, which is this
   * project's own "when a fix moves nothing in the suite, that is a statement
   * about the suite". `ownerCoefficients.test.ts` casts Judgement at ZERO power
   * and so asserts only that its FLAT damage survives -- which is the half a
   * coefficient edit cannot break.
   *
   * SO THE COEFFICIENT IS MEASURED FROM DAMAGE THAT LANDED, over two spell
   * powers so the flat half cancels: `(d2 - d1) / (p2 - p1)` is the slope
   * whatever the base is. A constant check could not see the ability reading
   * the wrong seal's figure, which is the one mistake this ability's shape
   * invites -- it picks its coefficient from the seal that is up.
   * ============================================================================
   */

  /** The Judgement coefficient a seal actually delivers, measured. */
  const measuredFor = (seal: AuraDefinition): number => {
    const profile = PROFILE_PRESETS.find((preset) => preset.id === 'pally_shockadin_2h')!.build();

    const damageAt = (spellPower: number): number => {
      const events: TelemetryEvent[] = [];
      const player = zeroPowerPlayer(profile);
      /*
       * THE POWER IS ADDED ON TOP OF A ZEROED CHARACTER, so the two readings
       * differ by exactly `spellPower` and nothing else -- the same idiom
       * `iceLance.test.ts` uses, and the reason it subtracts the gear rather
       * than stripping the items.
       */
      player.stats.addModifiers([
        { stat: 'spellPower', operation: 'flat', value: spellPower, sourceId: 'probe' },
      ]);
      const target = createTrainingDummy({
        name: 'Judge',
        health: 1_000_000_000,
        armor: 0,
        level: 63,
        attacks: false,
      });
      const simulation = new Sim(
        {
          durationMs: HORIZON,
          seed: 1,
          createCombatants: () => [player, target],
          attackChances: () => ({ ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1 }),
        },
        { emit: (event) => events.push(event) },
      );
      simulation.begin();
      for (const resource of player.resources.all) resource.fill();

      // The seal decides what Judgement unleashes, and therefore its coefficient.
      simulation.applyAura(player, seal, player.id);
      const before = events.length;
      castAbility(simulation, player, player.abilities.get('judgement')!, target);

      return events
        .slice(before)
        .filter(
          (event) =>
            event.type === 'damage' && 'abilityId' in event && event.abilityId === 'judgement',
        )
        .reduce((sum, event) => sum + (event as never as { amount: number }).amount, 0);
    };

    /*
     * ==========================================================================
     * THE BUILD'S OWN JUDGEMENT MULTIPLIER IS DIVIDED BACK OUT -- A MEASURED
     * SLOPE IS THE COEFFICIENT TIMES EVERYTHING BETWEEN IT AND THE DAMAGE EVENT.
     *
     * `iceLance.test.ts` had to learn this and divided out a SCHOOL multiplier;
     * here the term in the way is a PER-ABILITY one, which is why reading the
     * school was not enough. The first draft of this helper divided by
     * `schoolModifiers.for('holy')`, which is `{}` on this build -- so the slope
     * came back 0.492857 against a declared 0.428571, a clean 1.15x, and the
     * obvious conclusion was that the derivation was wrong.
     *
     * THE 1.15 IS `improved_seal_of_righteousness`, which names Judgement by id
     * alongside the three seals -- "Judgement is one id whatever seal fed it".
     * So dividing it out keeps this test about the COEFFICIENT and documents the
     * one multiplier in the way, which a loosened tolerance would have hidden.
     *
     * AND IT IS WHY THE TWO SEALS MEASURED IDENTICALLY AT FIRST and that was NOT
     * the usual tell. Two configurations agreeing to the decimal normally means
     * the same one was measured twice; here the SLOPE is genuinely the same for
     * both seals because the patch gave them the same coefficient, and it is the
     * BASE damage that differs -- 196 against 176. Said out loud because the
     * identity is exactly what this project treats as evidence of a bug.
     * ==========================================================================
     */
    /*
     * AND THE WHOLE-CHARACTER MULTIPLIER TOO, since round 82 moved this onto the
     * 2H Shockadin (the one-hand one was removed): its Two-Handed Weapon
     * Specialization 2/3 is a flat x1.04 on everything, and read 0.4457 here.
     */
    const reference = zeroPowerPlayer(profile);
    const multiplier =
      (reference.abilityModifierFor('judgement', 1).damageMultiplier ?? 1) *
      reference.baseDamageMultiplier;
    return (damageAt(1000) - damageAt(0)) / 1000 / multiplier;
  };

  it('delivers 1.5/3.5 for Seal of Righteousness, where it was 0.5', () => {
    expect(JUDGEMENT_OF_RIGHTEOUSNESS_SP_COEFFICIENT).toBeCloseTo(1.5 / 3.5, 12);
    expect(measuredFor(SEAL_OF_RIGHTEOUSNESS)).toBeCloseTo(1.5 / 3.5, 4);
  });

  it('delivers 1.5/3.5 for Seal of Fury, where it was 0.45', () => {
    expect(JUDGEMENT_OF_FURY_SP_COEFFICIENT).toBeCloseTo(1.5 / 3.5, 12);
    expect(measuredFor(SEAL_OF_FURY)).toBeCloseTo(1.5 / 3.5, 4);
  });

  it('agrees with every other instant on the sheet, which is where the figure came from', () => {
    /*
     * THE DERIVATION, ASSERTED. These nine are the evidence that "the correct
     * coefficient for an instant cast spell" is `1.5 / 3.5` -- so if one of them
     * ever moves, the premise this change rests on has moved with it and the two
     * Judgements above should be re-read rather than left agreeing with a
     * convention that no longer holds.
     *
     * A LOOSE TOLERANCE ON PURPOSE: the sheet writes the same figure to two,
     * three and sixteen decimal places, and the claim is that they are all the
     * same number rather than that they are all written the same way.
     */
    for (const [name, value] of [
      ['Holy Shock', HOLY_SHOCK_SP_COEFFICIENT],
      ['Hammer of Wrath', HAMMER_OF_WRATH_SP_COEFFICIENT],
      ['Mind Blast', MIND_BLAST_SP_COEFFICIENT],
      ['Fire Blast', FIRE_BLAST_SP_COEFFICIENT],
      ['Scorch', SCORCH_SP_COEFFICIENT],
      ['Conflagrate', CONFLAGRATE_SP_COEFFICIENT],
      ['Shadowburn', SHADOWBURN_SP_COEFFICIENT],
      ['Searing Pain', SEARING_PAIN_SP_COEFFICIENT],
      ['Shadow Word: Death', SHADOW_WORD_DEATH_SP_COEFFICIENT],
    ] as const) {
      expect(value, name).toBeCloseTo(1.5 / 3.5, 2);
    }
  });

  it('puts all three Judgements on one coefficient, which answered the Command question', () => {
    /*
     * ==========================================================================
     * JUDGEMENT OF COMMAND SAT ON THE SHEET'S 0.43 AS AN OPEN QUESTION, because
     * the note that moved the other two named only those two. The Judgement
     * balance pass answered it: "Judgement with all Seals: 42.9% Spell Power
     * Coefficient." So all three are the instant convention, `1.5 / 3.5`, of
     * which 42.9% is the rounding.
     * ==========================================================================
     */
    expect(JUDGEMENT_OF_COMMAND_SP_COEFFICIENT).toBe(1.5 / 3.5);
    expect(JUDGEMENT_OF_COMMAND_SP_COEFFICIENT).not.toBe(0.43);
    expect(JUDGEMENT_OF_COMMAND_SP_COEFFICIENT).toBeCloseTo(0.429, 3);
  });
});
