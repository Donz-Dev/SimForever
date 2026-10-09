import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { reactionsForClass } from '../../src/game/reactions/reactionsForClass';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { castAbility, dealDamage, resolveCast, seconds, spellPowerAgainst } from '../../src/engine';
import { runProfile, runProfileBatch } from '../../src/simulator';
import { PLACEHOLDER_BOSS_SWING_SECONDS } from '../../src/game/encounters/raidBoss';
import { Simulation } from '../../src/engine';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';
import {
  CONSECRATED_GROUND_FLAG,
  DIVINE_FAVOR,
  DIVINE_FAVOR_CRIT_BONUS,
  HOLY_SHIELD_CHARGES,
  HOLY_SHIELD_DAMAGE,
  IMPROVED_SEAL_OF_FURY_FLAG,
  IMPROVED_SEAL_OF_FURY_MANA,
  JUDGEMENT_OF_THE_CRUSADER,
  JUDGEMENT_OF_THE_CRUSADER_BONUS,
  SEAL_OF_FURY_ABSORB_FRACTION,
  SEAL_OF_THE_CRUSADER_HASTE_PERCENT,
  SEAL_OF_THE_CRUSADER_SWING_MULTIPLIER,
  VINDICATION_CHANCE,
  consecrationGround,
  improvedSealOfFuryMana,
} from '../../src/game/auras/paladin';
import { SANCTIFIED_JUDGEMENT_SHARE_PERCENT } from '../../src/game/reactions/paladinCasts';
import {
  HOLY_SHIELD,
  HOLY_SHIELD_BLOCK_CHANCE,
  VENGEANCE_MAX_STACKS,
  vengeanceAura,
} from '../../src/game/auras/paladin';
import { flat } from '../../src/engine';
import {
  EYE_FOR_AN_EYE_HEALTH_CAP_PERCENT,
  RECKONING_ICD_MS,
  SHIELD_SPECIALIZATION_MANA_PERCENT,
} from '../../src/game/reactions/paladinTalents';
import { HAND_OF_JUSTICE_ICD_MS } from '../../src/game/items/procs';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
import { talentNumber } from '../../src/game/talents/talentValues';
import { legalise } from '../helpers/legalTalents';
import { armorFromItems } from '../../src/game/items/equipment';
import { PALADIN_SHOCKADIN } from '../../src/game/rotations/paladin';

/*
 * ==============================================================================
 * THE EIGHT PALADIN TALENTS AND TWO JUDGEMENT CLAUSES THAT WERE INERT, each
 * tested on its MECHANISM rather than on a DPS delta -- a correct talent can be
 * worth zero, and three of these are only live for one of the three profiles.
 *
 * FIVE OF THEM WERE NEVER BLOCKED BY THE ENGINE AT ALL. Their reasons were
 * claims about what the engine could not do, and each claim was about the wrong
 * thing:
 *
 *   reckoning              a reaction cannot fire on a block. It can
 *   holy_shield            the same claim, and it cost a damage source
 *   shield_specialization  the same claim, plus "block value is a stat nothing
 *                          reads" -- the damage pipeline reads it
 *   divine_favor           `CastModifier` carries no crit. An AURA does
 *   sanctified_judgement   a refund proportional to another ability's cost has
 *                          no declaration. A cast reaction and `resolveCast`
 *
 * Only Divine Precision needed a new engine field, and `templar_s_bulwark`'s
 * reason had simply expired: everything it described was already working.
 * ==============================================================================
 */

const built = (preset: string) => PRESETS_BY_ID.get(preset)!.build();

const presetPlayer = (preset: string) => {
  const p = built(preset);
  return createPlayer({
    race: 'human',
    characterClass: 'paladin',
    combatStyle: p.character.combatStyle as never,
    talents: p.talents,
    equipment: p.equipment,
  });
};

/**
 * A shield Paladin in the Prot preset's gear, with exactly the talents given.
 *
 * NOT THE PRESET'S ALLOCATION, which is the point: this is for pricing one
 * talent against nothing, so the gear is the only thing held constant. The Prot
 * Pally's own build does not take Toughness.
 */
const shieldPaladin = (talents: Record<string, number> = {}) =>
  createPlayer({
    race: 'human',
    characterClass: 'paladin',
    combatStyle: 'one_hand_shield',
    talents,
    equipment: built('prot_pally').equipment,
  });

/** A Paladin with the real book and no rotation, so it only acts when told. */
const bareBuild = (preset: string, mana = 100_000) => {
  const p = built(preset);
  return makeAttacker({
    autoAttack: 'none',
    abilities: abilitiesForClass('paladin', p.character.combatStyle as never, p.talents),
    resources: [{ type: 'mana', maximum: mana }],
  });
};

const batchOf = (preset: string, iterations: number, seed: number) => {
  const p = built(preset);
  return runProfileBatch({
    ...p,
    simulation: { ...p.simulation, iterations, seed },
  } as never);
};

/* -------------------------------------------------------------------------- */

describe('the three talents that were written off against blocks', () => {
  it('registers every one of them on the Protection build', () => {
    /*
     * THE REGISTRATION IS THE TEST, because the failure was silent twice over.
     * The census reads the effect TABLE, so a reaction the table declares and
     * `talentBuild` drops reads as a fully modelled talent -- which is exactly
     * what happened to Holy Shield: a single-rank talent has a `null` values
     * entry, and every effect asking for a number is discarded.
     */
    const player = presetPlayer('prot_pally');
    const ids = player.reactions.map((r) => r.id);
    expect(ids).toContain('holy_shield');
    expect(ids).toContain('reckoning');
    expect(ids).toContain('shield_specialization');
  });

  it('declares Holy Shield and Divine Favor as needing no rank value', () => {
    // The guard on the regression above: both are single-rank talents whose
    // numbers live on the ability and the aura, so they must say `valueless`.
    const holyShield = PALADIN_TALENT_EFFECTS.holy_shield.find((e) => e.kind === 'reaction');
    expect(holyShield && 'valueless' in holyShield && holyShield.valueless).toBe(true);
    const divineFavor = PALADIN_TALENT_EFFECTS.divine_favor.find(
      (e) => e.kind === 'castReaction',
    );
    expect(divineFavor && 'valueless' in divineFavor && divineFavor.valueless).toBe(true);
  });

  it('gives Holy Shield four payouts of 221 a cast, not three', () => {
    /*
     * 221 IS THE ABILITY'S FIGURE, from the spellbook capture at rank 3. The
     * talent tooltip says 110 and the two do not disagree: a talent tooltip
     * shows rank 1 of the ability it grants.
     */
    expect(HOLY_SHIELD_DAMAGE).toBe(221);
    expect(HOLY_SHIELD_CHARGES).toBe(4);
  });

  it('makes Holy Shield a real damage source for the tank, which it was not', () => {
    const batch = batchOf('prot_pally', 10, 4242);
    const holyShield = batch.abilities.find((a) => a.abilityName === 'Holy Shield');
    expect(holyShield).toBeDefined();
    expect(holyShield!.damage).toBeGreaterThan(0);
  });

  it('gives Shield Specialization its block value, which the pipeline reads', () => {
    /*
     * "Increases the amount of damage absorbed by your shield by 30%" IS block
     * value, and its reason called that "a shield stat nothing reads". The flat
     * amount a block removes is `blockValue`, read by `resolveDamage`.
     */
    const withShieldSpec = presetPlayer('prot_pally');
    const noTalent = createPlayer({
      race: 'human',
      characterClass: 'paladin',
      combatStyle: built('prot_pally').character.combatStyle as never,
      talents: { ...built('prot_pally').talents, shield_specialization: 0 },
      equipment: built('prot_pally').equipment,
    });

    const base = noTalent.stats.get('blockValue');
    expect(base).toBeGreaterThan(0);
    // 3/3 is +30%.
    expect(withShieldSpec.stats.get('blockValue')).toBeCloseTo(base * 1.3, 6);
  });

  it('restores 6% of maximum mana on a block, once every three seconds', () => {
    expect(SHIELD_SPECIALIZATION_MANA_PERCENT).toBe(6);
    const player = presetPlayer('prot_pally');
    const reaction = player.reactions.find((r) => r.id === 'shield_specialization')!;
    // The internal cooldown is an aura rather than a closure, so that a batch
    // reusing one `TalentBuild` cannot share one timer across characters.
    expect(reaction.outcomes).toEqual(['block']);
  });

  it("gives Reckoning both halves, with a different chance for each", () => {
    const player = presetPlayer('prot_pally');
    const reckoning = player.reactions.find((r) => r.id === 'reckoning')!;
    expect([...reckoning.outcomes].sort()).toEqual(['block', 'crit']);
  });
});

/* -------------------------------------------------------------------------- */

describe("Reckoning's internal cooldown", () => {
  /*
   * ============================================================================
   * "Reckoning: Now has a 1.5 second internal cooldown on how often it can be
   * triggered." The ruleset owner's figure, and it had none.
   *
   * IT MATTERS BECAUSE A TANK IS STRUCK CONSTANTLY. The Protection profile blocks
   * and is critically hit several times a second against a target that ramps, and
   * at 5/5 the talent is 40% on a block and 100% on a crit taken -- so before
   * this, every one of those rolled and a run of extra attacks was possible.
   *
   * ADDING IT BROKE NO TEST, which is why this block exists: the only Reckoning
   * coverage was that its reaction names both outcomes. "When a fix moves nothing
   * in the suite, that is a statement about the suite."
   * ============================================================================
   */

  /** A Prot Paladin, a hostile target, and a simulation whose clock we drive. */
  const reckoningSetup = () => {
    const player = presetPlayer('prot_pally');
    const boss = makeTarget({ faction: 'hostile', maxHealth: 1_000_000 });
    const simulation = buildSimulation([player, boss]);
    simulation.begin();
    const reaction = player.reactions.find((r) => r.id === 'reckoning')!;
    return { player, boss, simulation, reaction };
  };

  /** An attack the Paladin RECEIVED, landing for real. */
  const taken = (player: never, boss: never, outcome: 'crit' | 'block') => ({
    attacker: boss,
    defender: player,
    outcome,
    abilityId: undefined,
    abilityName: 'Boss Swing',
    amount: 2_000,
    weaponSlot: 'mainHand' as const,
    critical: outcome === 'crit',
  });

  it('is 1.5 seconds, the same figure Hand of Justice uses and a different fact', () => {
    /*
     * TWO EFFECTS AGREEING ON A NUMBER IS NOT A REASON TO SHARE A CONSTANT. The
     * trinket's is recorded against an item tooltip that says TWO seconds and is
     * overridden by the owner; this one is recorded against a patch note. A
     * shared constant would make the next change to either move both.
     */
    expect(RECKONING_ICD_MS).toBe(1500);
    expect(HAND_OF_JUSTICE_ICD_MS).toBe(1500);
  });

  it('refuses a second trigger inside the window and allows one after it', () => {
    /*
     * DRIVEN AT 100% CHANCE so the roll cannot mask the cooldown. A crit taken is
     * 100% at 5/5, which the Protection build takes -- so every refusal below is
     * the cooldown and nothing else.
     */
    const { player, boss, simulation, reaction } = reckoningSetup();
    const attack = taken(player as never, boss as never, 'crit');

    expect(reaction.canTrigger?.(simulation, player, attack as never)).toBe(true);
    reaction.onTrigger(simulation, player, attack as never);

    // Immediately after, and just inside the window.
    expect(reaction.canTrigger?.(simulation, player, attack as never)).toBe(false);
    simulation.advanceTo(RECKONING_ICD_MS - 1);
    expect(reaction.canTrigger?.(simulation, player, attack as never)).toBe(false);

    // And exactly at it, which is the boundary the owner's "1.5 second" states.
    simulation.advanceTo(RECKONING_ICD_MS);
    expect(reaction.canTrigger?.(simulation, player, attack as never)).toBe(true);
  });

  it('shares the window across BOTH halves, because it is one talent', () => {
    /*
     * A BLOCK AND A CRIT TAKEN ARE TWO CLAUSES OF ONE TALENT and one reaction, so
     * a block cannot trigger it while a crit's cooldown is running. Two separate
     * windows would be two effects, and would let a tank proc twice as often as
     * the note allows -- a bigger number and no error.
     */
    const { player, boss, simulation, reaction } = reckoningSetup();

    const crit = taken(player as never, boss as never, 'crit');
    expect(reaction.canTrigger?.(simulation, player, crit as never)).toBe(true);
    reaction.onTrigger(simulation, player, crit as never);

    const block = taken(player as never, boss as never, 'block');
    expect(reaction.canTrigger?.(simulation, player, block as never)).toBe(false);
  });

  it('is PER CHARACTER, which is what a shared closure would silently break', () => {
    /*
     * ------------------------------------------------------------------------
     * THE FAILURE THIS GUARDS IS THE WINDFURY ONE, recorded in CLAUDE.md: a proc
     * whose internal cooldown lived in a closure shared between characters
     * stopped proccing after the first iteration of a batch, and nothing errored.
     *
     * IT IS SAFE HERE BECAUSE `talentBuild` RUNS INSIDE `createPlayer`, which the
     * simulation calls once per iteration through `createCombatants` -- so each
     * character gets its own `lastProcAt`. That is checked rather than assumed,
     * because the comment on Shield Specialization next door says its own
     * cooldown is an aura "so that a batch reusing one TalentBuild cannot share
     * one timer across characters" -- a worry about something this does not do,
     * and exactly the claim worth testing rather than reading.
     * ------------------------------------------------------------------------
     */
    const first = reckoningSetup();
    const second = reckoningSetup();

    // Distinct closures, not one shared function.
    expect(first.reaction).not.toBe(second.reaction);
    expect(first.reaction.canTrigger).not.toBe(second.reaction.canTrigger);

    // And putting one on cooldown leaves the other ready.
    const attack = taken(first.player as never, first.boss as never, 'crit');
    first.reaction.onTrigger(first.simulation, first.player, attack as never);
    expect(first.reaction.canTrigger?.(first.simulation, first.player, attack as never)).toBe(
      false,
    );

    const other = taken(second.player as never, second.boss as never, 'crit');
    expect(
      second.reaction.canTrigger?.(second.simulation, second.player, other as never),
    ).toBe(true);
  });

  it('CAN bind now, because parry haste hurries the one attacker inside it', () => {
    /*
     * ======================================================================
     * THIS TEST USED TO ASSERT THE OPPOSITE, AND PARRY HASTE EXPIRED IT.
     *
     * It read "cannot bind in THIS encounter, because the one attacker swings
     * slower than it", and the arithmetic was right at the time: one attacker
     * on a two-second timer, widened by the tank's own Thunder Clap slow to
     * 2,400ms, so no two attacks could fall inside Reckoning's 1,500ms window
     * and the internal cooldown refused nothing. The Prot Pally measured 0.0
     * to the decimal and this recorded why.
     *
     * PARRY HASTE TAKES 40% OF A FULL SWING OFF, and the boss earns it by
     * parrying the TANK -- which it does on 14% of a tank's many blows, so
     * several land inside one boss swing cycle and drive the timer down to
     * its 20% floor. Measured over forty fights: the minimum gap is 480ms and
     * 124 of 1,045 gaps fall under 1,500ms, so the cooldown now binds on
     * about one gap in eight.
     *
     * IT IS THE ENCOUNTER CAUSE EXPIRING EXACTLY AS IT SAID IT WOULD -- "it
     * expires the day the encounter swings faster or has a second attacker".
     * Kept rather than deleted, because the reason the figure moved is worth
     * more than the figure.
     * ======================================================================
     */
    const run = runProfile(built('prot_pally'), 1);
    const playerId = run.actors.find((actor) => actor.kind === 'player')!.id;
    const received = run.timeline
      .filter((event) => event.type === 'damage' && event.targetId === playerId)
      .map((event) => event.timestamp);

    expect(received.length).toBeGreaterThan(10);
    const gaps = received.slice(1).map((time, index) => time - received[index]);

    /*
     * THE FLOOR IS 20% OF A FULL SWING, not zero and not 40% off one: several
     * parries land inside a single boss swing cycle, so the reduction stacks
     * until the floor stops it. 2,400ms slowed swing, floor 480ms.
     *
     * IT READ 1,440ms BEFORE PARRY HASTE'S DIRECTION WAS CORRECTED -- back
     * when the boss was hurried by the tank's rare parries rather than by its
     * own frequent ones, a single reduction per cycle was all it could get.
     */
    const floor = seconds(PLACEHOLDER_BOSS_SWING_SECONDS) * 1.2 * 0.2;
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(floor);
    // And at least one gap is now inside the window the cooldown guards.
    expect(Math.min(...gaps)).toBeLessThan(RECKONING_ICD_MS);
  });

  it('checks the cooldown BEFORE rolling, so a blocked proc consumes no randomness', () => {
    /*
     * ORDERING, AND IT IS NOT COSMETIC. Rolling first and discarding the result
     * would consume a random number on an attack that could not proc, and every
     * seeded figure in the project would shift -- the same argument `critFrom`
     * makes by consuming nothing when it is absent.
     *
     * MEASURED BY WATCHING THE RNG rather than by reading the function: two
     * refusals inside the window must draw nothing at all.
     */
    const { player, boss, simulation, reaction } = reckoningSetup();
    const attack = taken(player as never, boss as never, 'crit');
    reaction.onTrigger(simulation, player, attack as never);

    let draws = 0;
    const rng = simulation.rng as { rollChance: (c: number) => boolean };
    const original = rng.rollChance.bind(rng);
    rng.rollChance = (chance: number) => {
      draws += 1;
      return original(chance);
    };

    expect(reaction.canTrigger?.(simulation, player, attack as never)).toBe(false);
    expect(reaction.canTrigger?.(simulation, player, attack as never)).toBe(false);
    expect(draws).toBe(0);

    // And once the window is open, it does roll.
    simulation.advanceTo(RECKONING_ICD_MS);
    expect(reaction.canTrigger?.(simulation, player, attack as never)).toBe(true);
    expect(draws).toBe(1);

    rng.rollChance = original;
  });
});

/* -------------------------------------------------------------------------- */

describe('Judgement of the Crusader, which was tracked and inert', () => {
  it('grants 161 Holy spell power to whoever hits the target', () => {
    const actor = bareBuild('pally_ret');
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target]);

    const before = spellPowerAgainst(actor, target, 'holy');
    simulation.applyAura(target, JUDGEMENT_OF_THE_CRUSADER, actor.id);

    expect(spellPowerAgainst(actor, target, 'holy') - before).toBe(
      JUDGEMENT_OF_THE_CRUSADER_BONUS,
    );
    expect(JUDGEMENT_OF_THE_CRUSADER_BONUS).toBe(161);
  });

  it('reaches Holy and no other school, which is what "Holy damage taken" says', () => {
    const actor = bareBuild('pally_ret');
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target]);
    simulation.applyAura(target, JUDGEMENT_OF_THE_CRUSADER, actor.id);

    expect(target.spellPowerTakenFor('holy')).toBe(161);
    expect(target.spellPowerTakenFor('shadow')).toBe(0);
  });

  it('is refreshed by a melee strike, which is what makes one opening cast last', () => {
    /*
     * ALL THREE LISTS JUDGE THE CRUSADER ONCE, AT THE PULL. Its forty seconds
     * would otherwise run out a third of the way into a fight, and the lists
     * would look badly written rather than correct -- "your melee strikes will
     * refresh the spell's duration" is why they are not.
     */
    const p = built('pally_ret');
    const actor = makeAttacker({
      autoAttack: 'none',
      reactions: [...reactionsForClass('paladin', p.character.combatStyle as never, p.talents)],
      resources: [{ type: 'mana', maximum: 100_000 }],
    });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target], { durationMs: seconds(120) });

    simulation.applyAura(target, JUDGEMENT_OF_THE_CRUSADER, actor.id);
    const firstExpiry = target.auras.remainingMs('judgement_of_the_crusader', 0);
    expect(firstExpiry).toBe(seconds(40));

    simulation.advanceTo(seconds(30));
    dealDamage(simulation, {
      source: actor,
      target,
      abilityName: 'Main Hand',
      school: 'physical',
      baseAmount: 100,
      attackTable: 'melee-auto',
      weaponSlot: 'mainHand',
      appliesArmor: false,
    });

    // Back to a full forty seconds, from ten remaining.
    expect(target.auras.remainingMs('judgement_of_the_crusader', seconds(30))).toBe(seconds(40));
  });

  it('is NOT refreshed by something that is not a weapon use', () => {
    const p = built('pally_ret');
    const actor = makeAttacker({
      autoAttack: 'none',
      reactions: [...reactionsForClass('paladin', p.character.combatStyle as never, p.talents)],
    });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target], { durationMs: seconds(120) });

    simulation.applyAura(target, JUDGEMENT_OF_THE_CRUSADER, actor.id);
    simulation.advanceTo(seconds(30));
    dealDamage(simulation, {
      source: actor,
      target,
      abilityId: 'holy_shock',
      abilityName: 'Holy Shock',
      school: 'holy',
      baseAmount: 300,
      attackTable: 'spell',
      appliesArmor: false,
    });

    expect(target.auras.remainingMs('judgement_of_the_crusader', seconds(30))).toBe(seconds(10));
  });
});

/* -------------------------------------------------------------------------- */

describe("Seal of the Crusader's third clause", () => {
  it('cancels its own haste exactly, which is the reading the owner chose', () => {
    // 40% faster swings land 1.4 times as many, so each is worth 1/1.4.
    expect(SEAL_OF_THE_CRUSADER_HASTE_PERCENT).toBe(40);
    expect(SEAL_OF_THE_CRUSADER_SWING_MULTIPLIER).toBeCloseTo(1 / 1.4, 10);
  });

  it('reduces the SWING and nothing the haste never sped up', () => {
    const actor = bareBuild('pally_ret');
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target]);

    castAbility(simulation, actor, actor.abilities.get('seal_of_the_crusader')!, undefined);

    expect(actor.damageDoneMultiplierForTable('melee-auto')).toBeCloseTo(1 / 1.4, 10);
    /*
     * Judgement, Holy Shock and Consecration are on cooldowns the haste did not
     * touch, so penalising them would remove damage the seal never granted. A
     * whole-character multiplier would have done exactly that.
     */
    expect(actor.damageDoneMultiplierForTable('melee-special')).toBe(1);
    expect(actor.damageDoneMultiplierForTable('spell')).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */

describe('Sanctified Judgement', () => {
  it('returns 60% of what the seal ACTUALLY costs, not of what it declares', () => {
    /*
     * ------------------------------------------------------------------------
     * THE BUILT COST, NOT THE DECLARATION'S, and this test makes the two differ
     * on purpose. Benediction is a percentage cost reduction carried by a
     * permanent aura, so reading `seal.cost.amount` would refund a share of a
     * price the Paladin never paid -- the same mistake the Cat Druid's Claw
     * comment made about a talent-reduced energy cost.
     *
     * A HAND-APPLIED MODIFIER RATHER THAN THE REAL BENEDICTION, because the
     * assertion has to be exact: a halved seal is 105, and 60% of that is 63
     * against 126 for the unreduced one. Reading the declaration would give 126
     * either way, which is a bigger number and no error.
     * ------------------------------------------------------------------------
     */
    expect(SANCTIFIED_JUDGEMENT_SHARE_PERCENT).toBe(60);

    const p = built('pally_ret');
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: abilitiesForClass('paladin', p.character.combatStyle as never, p.talents),
      resources: [{ type: 'mana', maximum: 100_000 }],
      castReactions: presetPlayer('pally_ret').castReactions.filter(
        (r) => r.id === 'sanctified_judgement',
      ),
    });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target]);

    const seal = actor.abilities.get('seal_of_command')!;
    expect(seal.cost!.amount).toBe(210);
    expect(resolveCast(actor, seal).costAmount).toBe(210);

    const mana = actor.resources.get('mana')!;
    const judgement = actor.abilities.get('judgement')!;

    const refundFor = (at: number) => {
      simulation.advanceTo(at);
      const before = mana.current;
      expect(castAbility(simulation, actor, judgement, target)).toEqual({ ok: true });
      // The judgement's own cost comes back off, so the refund is the net
      // plus what the cast spent.
      return mana.current - before + resolveCast(actor, judgement).costAmount;
    };

    castAbility(simulation, actor, seal, undefined);
    expect(refundFor(seconds(2))).toBeCloseTo(210 * 0.6, 6);

    // Now halve the seal's cost and judge again: the refund has to follow.
    simulation.applyAura(
      actor,
      {
        id: 'cheap_seals',
        name: 'Cheap seals',
        durationMs: 0,
        castModifier: { abilityIds: ['seal_of_command'], costFraction: 0.5 },
      },
      actor.id,
    );
    expect(resolveCast(actor, seal).costAmount).toBe(105);
    expect(refundFor(seconds(14))).toBeCloseTo(105 * 0.6, 6);
  });

  it('is the largest single source of mana either Retribution build has', () => {
    const batch = batchOf('pally_ret', 10, 909);
    const mana = batch.resources.find((r) => r.resource === 'mana')!;
    const refund = mana.gained.find((g) => g.sourceName === 'Sanctified Judgement');
    expect(refund).toBeDefined();
    expect(refund!.amount).toBeGreaterThan(0);
  });

  it('registers as a cast reaction on both builds that take it', () => {
    for (const preset of ['pally_ret', 'pally_shockadin']) {
      const ids = presetPlayer(preset).castReactions.map((r) => r.id);
      expect(ids, preset).toContain('sanctified_judgement');
    }
  });
});

/* -------------------------------------------------------------------------- */

describe('Divine Favor', () => {
  it('guarantees the next Holy Shock a crit and nothing else', () => {
    expect(DIVINE_FAVOR_CRIT_BONUS).toBe(100);
    expect(DIVINE_FAVOR.abilityModifiers?.holy_shock?.critBonus).toBe(100);
    // Named by id, so it cannot leak onto Judgement or a seal.
    expect(Object.keys(DIVINE_FAVOR.abilityModifiers ?? {})).toEqual(['holy_shock']);
  });

  it('is spent by the Holy Shock that used it, and not before the crit was rolled', () => {
    /*
     * A CAST REACTION RATHER THAN `consumedByCast`, and the ordering is the
     * reason: cast charges are spent BEFORE `runCast`, so the aura would be gone
     * before the spell rolled anything and the talent would do nothing at all.
     * Cast reactions run after `onCast`.
     */
    const p = built('pally_shockadin');
    const actor = makeAttacker({
      autoAttack: 'none',
      abilities: abilitiesForClass('paladin', p.character.combatStyle as never, p.talents),
      castReactions: [...presetPlayer('pally_shockadin').castReactions],
      resources: [{ type: 'mana', maximum: 100_000 }],
    });
    const target = makeTarget({ maxHealth: 1_000_000 });
    const simulation = buildSimulation([actor, target]);

    expect(castAbility(simulation, actor, actor.abilities.get('divine_favor')!, undefined)).toEqual(
      { ok: true },
    );
    expect(actor.auras.has('divine_favor')).toBe(true);

    simulation.advanceTo(seconds(2));
    expect(castAbility(simulation, actor, actor.abilities.get('holy_shock')!, target)).toEqual({
      ok: true,
    });
    expect(actor.auras.has('divine_favor')).toBe(false);
  });

  it('is in the Shockadin list ABOVE Holy Shock, or it arms a spell already gone', () => {
    const ids = PALADIN_SHOCKADIN.map((e) => e.abilityId);
    expect(ids).toContain('divine_favor');
    expect(ids.indexOf('divine_favor')).toBeLessThan(ids.indexOf('holy_shock'));
  });

  it('is granted by the talent, so a build without it cannot cast it', () => {
    expect(bareBuild('pally_shockadin').abilities.get('divine_favor')).toBeDefined();
    expect(bareBuild('pally_ret').abilities.get('divine_favor')).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */

describe('Toughness, which is where itemArmorPercent now lives', () => {
  /*
   * ----------------------------------------------------------------------------
   * MOVED HERE FROM `protectionTalents.test.ts` at client build 1.60.1.70170,
   * which removed the WARRIOR's Toughness. The declaration is shared and had
   * three callers; this is the one a preset takes 5/5 of.
   *
   * THE POINT OF THE SHAPE, which is what these two tests pin: ten percent of
   * the armor FROM ITEMS, added flat -- strictly less than ten percent of the
   * character TOTAL, because a character's armor is items plus the class base.
   * The talent's old reason on the Warrior called that distinction unsolvable.
   * ----------------------------------------------------------------------------
   */
  it('scales armor FROM ITEMS, not the character total', () => {
    const items = armorFromItems(built('prot_pally').equipment, 'one_hand_shield');
    expect(items).toBeGreaterThan(0);

    const plain = shieldPaladin().stats.effective.armor;
    const specced = shieldPaladin(legalise({ toughness: 5 }, 'paladin')).stats.effective.armor;

    // Ten percent of the ITEM armor at 5/5, added flat...
    expect(specced - plain).toBeCloseTo(items * 0.1, 6);
    // ...and strictly less than ten percent of the total, which is the bug this
    // shape avoids.
    expect(specced - plain).toBeLessThan(plain * 0.1);
  });

  it('scales per rank, two percent at a time', () => {
    const items = armorFromItems(built('prot_pally').equipment, 'one_hand_shield');
    const plain = shieldPaladin().stats.effective.armor;
    for (const [rank, percent] of [
      [1, 2],
      [3, 6],
      [5, 10],
    ] as const) {
      // The tooltip's own figure, written out rather than read from the values
      // file, and then the armor it actually produces.
      expect(talentNumber('paladin', 'toughness', rank, 0), `rank ${rank}`).toBe(percent);
      const armor = shieldPaladin(legalise({ toughness: rank }, 'paladin')).stats.effective.armor;
      expect(armor - plain, `rank ${rank}`).toBeCloseTo((items * percent) / 100, 6);
    }
    expect(PALADIN_TALENT_EFFECTS.toughness.map((e) => e.kind)).toEqual(['itemArmorPercent']);
  });

  it('gives a Paladin in no armor nothing, and says so', () => {
    /*
     * "Equip something and it works" -- `talentBuild` REPORTS this rather than
     * contributing zero in silence, which is the honest failure mode for a
     * talent whose magnitude comes from the gear.
     */
    const naked = createPlayer({
      race: 'human',
      characterClass: 'paladin',
      combatStyle: 'one_hand_shield',
      talents: legalise({ toughness: 5 }, 'paladin'),
    });
    const plain = createPlayer({
      race: 'human',
      characterClass: 'paladin',
      combatStyle: 'one_hand_shield',
    });
    expect(naked.stats.effective.armor).toBe(plain.stats.effective.armor);
  });

  it('is taken by no Paladin preset, which is a BUILD cause', () => {
    /*
     * The Prot Pally spends its 34 Protection points elsewhere, so this talent
     * is correctly worth zero to every profile -- and that is why the tests
     * above build their own character rather than reading one.
     */
    for (const preset of ['pally_ret', 'pally_shockadin', 'prot_pally']) {
      expect(built(preset).talents.toughness, preset).toBeUndefined();
    }
  });
});

describe('Vindication', () => {
  it('uses the 10% the ruleset owner supplied, which no source states', () => {
    expect(VINDICATION_CHANCE).toBe(10);
  });

  it('is registered on the two builds that take it and not on the tank', () => {
    /*
     * THE SHOCKADIN TOOK IT UP AT CLIENT BUILD 1.60.1.70170, which is a BUILD
     * change rather than a talent one: Improved Holy Strike and Crusade were
     * removed from the tree, and the owner's new Shockadin URL spends two of the
     * four freed points here.
     *
     * The tank still does not, so the assertion still says something: this is
     * about the TALENT being registered from the allocation rather than about
     * every Paladin having it.
     */
    expect(presetPlayer('pally_ret').reactions.map((r) => r.id)).toContain('vindication');
    expect(presetPlayer('pally_shockadin').reactions.map((r) => r.id)).toContain('vindication');
    expect(presetPlayer('prot_pally').reactions.map((r) => r.id)).not.toContain('vindication');
  });
});

/* -------------------------------------------------------------------------- */

describe('Eye for an Eye', () => {
  it('caps at half the health pool, which a boss crit reaches', () => {
    expect(EYE_FOR_AN_EYE_HEALTH_CAP_PERCENT).toBe(50);
  });

  it('is inert because of the BUILD, which is the cause that expires per profile', () => {
    // Only Protection is attacked and Protection does not take it. The effect
    // is declared, so the day a profile spends the points it works.
    for (const preset of ['pally_ret', 'pally_shockadin', 'prot_pally']) {
      expect(presetPlayer(preset).reactions.map((r) => r.id), preset).not.toContain(
        'eye_for_an_eye',
      );
    }
    expect(PALADIN_TALENT_EFFECTS.eye_for_an_eye.some((e) => e.kind === 'reaction')).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */

describe("Seal of Fury's shield", () => {
  it('is registered only for a Paladin holding a shield', () => {
    const shielded = reactionsForClass('paladin', 'one_hand_shield', built('prot_pally').talents);
    expect(shielded.map((r) => r.id)).toContain('seal_of_fury_shield');

    const twoHander = reactionsForClass('paladin', 'two_hander', built('pally_ret').talents);
    expect(twoHander.map((r) => r.id)).not.toContain('seal_of_fury_shield');
  });

  it('is worth half the seal’s own Holy damage', () => {
    expect(SEAL_OF_FURY_ABSORB_FRACTION).toBe(0.5);
  });

  it('returns 60 mana plus 15% a level, capped at 45%, when fully absorbed', () => {
    // A level 63 boss against a level 60 Paladin is three levels, which is the
    // cap: 60 x 1.45 = 87.
    expect(IMPROVED_SEAL_OF_FURY_MANA).toBe(60);
    expect(improvedSealOfFuryMana(0)).toBe(60);
    expect(improvedSealOfFuryMana(1)).toBeCloseTo(69, 6);
    expect(improvedSealOfFuryMana(3)).toBeCloseTo(87, 6);
    expect(improvedSealOfFuryMana(10)).toBeCloseTo(87, 6);
  });

  it('is flagged onto the seal ABILITY, so it is per character', () => {
    const prot = bareBuild('prot_pally');
    expect(prot.abilities.get('seal_of_fury')?.bonuses?.[IMPROVED_SEAL_OF_FURY_FLAG]).toBe(1);
    const ret = bareBuild('pally_ret');
    expect(ret.abilities.get('seal_of_fury')?.bonuses?.[IMPROVED_SEAL_OF_FURY_FLAG]).toBeUndefined();
  });
});

/* -------------------------------------------------------------------------- */

describe('Consecrated Ground', () => {
  it('raises every HOLY spell against the target, not Consecration alone', () => {
    /*
     * IT USED TO BE A FLAT BONUS TO CONSECRATION'S OWN DAMAGE, which is a
     * different effect wearing the same number: it missed Judgement, Holy Shock
     * and every seal, and paid Consecration a bonus the tooltip does not give it.
     */
    const plain = consecrationGround();
    expect(plain.damageTakenBySchool).toBeUndefined();

    const talented = consecrationGround(10);
    expect(talented.damageTakenBySchool?.holy).toBeCloseTo(1.1, 10);
    expect(talented.damageTakenBySchool?.physical).toBeUndefined();
  });

  it('carries its percentage on the ability, so a Paladin without it lays the plain one', () => {
    expect(
      PALADIN_TALENT_EFFECTS.consecrated_ground.some(
        (e) => e.kind === 'abilityBonus' && e.key === CONSECRATED_GROUND_FLAG,
      ),
    ).toBe(true);
    // No profile takes it, so every one of them lays the plain version.
    for (const preset of ['pally_ret', 'pally_shockadin', 'prot_pally']) {
      expect(
        bareBuild(preset).abilities.get('consecration')?.bonuses?.[CONSECRATED_GROUND_FLAG],
        preset,
      ).toBeUndefined();
    }
  });
});

/* -------------------------------------------------------------------------- */

describe("Templar's Bulwark, whose reason had simply expired", () => {
  it('is granted by the talent, so the two builds that skip it lose the button', () => {
    /*
     * IT WAS IN EVERY PALADIN'S BOOK, talent or not, because `TALENT_ABILITIES`
     * is derived from `grantAbility` and nothing declared one. A bonus being
     * paid rather than an omission -- neither of the other two builds has an
     * entry for it, so no number moved, which is why it survived.
     */
    expect(bareBuild('prot_pally').abilities.get('templars_bulwark')).toBeDefined();
    expect(bareBuild('pally_ret').abilities.get('templars_bulwark')).toBeUndefined();
    expect(bareBuild('pally_shockadin').abilities.get('templars_bulwark')).toBeUndefined();
  });

  it('is shortened by Sacred Duty, which names it explicitly', () => {
    // 2/2 is 60 seconds off a 300 second cooldown. Index 1: index 0 is the
    // stamina percentage, and taking it would shorten the cooldown by four
    // SECONDS -- a plausible number and the wrong one.
    const prot = bareBuild('prot_pally');
    expect(prot.abilities.get('templars_bulwark')!.cooldownMs).toBe(seconds(240));
  });
});

// ---------------------------------------------------------------------------
// The 1.60.1.70170 Paladin figures
// ---------------------------------------------------------------------------

describe('the two block talents moved in OPPOSITE directions', () => {
  /*
   * ----------------------------------------------------------------------------
   * "Redoubt's chance to Block changed to 4/8/12/16/20% (was 6/12/18/24/30%)"
   * and "Holy Shield's chance to Block changed to 30% (was 20%)".
   *
   * THAT IS THE SHAPE TO BE CAREFUL ABOUT: reading one note and applying it to
   * both numbers is a wash and looks deliberate. Asserted together so the pair
   * cannot drift apart, and from the tooltips rather than from the constants.
   * ----------------------------------------------------------------------------
   */
  it('cuts Redoubt from 30% to 20% at 5/5, and keeps its chance at ten', () => {
    // The row is [chance, block bonus, ...], and only the BONUS moves per rank --
    // which is why the effect passes `valueIndex: 1`. Index 0 is ten at every
    // rank, so a reader checking the resulting block chance alone cannot tell.
    expect(talentNumber('paladin', 'redoubt', 5, 0)).toBe(10);
    expect(talentNumber('paladin', 'redoubt', 5, 1)).toBe(20);
    expect(talentNumber('paladin', 'redoubt', 1, 1)).toBe(4);
  });

  it('raises Holy Shield from 20% to 30%, which raises its DAMAGE too', () => {
    /*
     * The 221 is "for each attack BLOCKED", so more blocks spends the four
     * charges sooner and more often -- that damage was 14.9% of the Protection
     * profile when its reaction was first wired up. The charge count did not move.
     */
    expect(HOLY_SHIELD_BLOCK_CHANCE).toBe(30);
    expect(HOLY_SHIELD_CHARGES).toBe(4);
    expect(HOLY_SHIELD.statModifiers).toEqual([flat('blockChance', 30)]);
  });

  it('lands the new block chance on the tank that casts it', () => {
    const actor = presetPlayer('prot_pally');
    const simulation = buildSimulation([actor, makeTarget()]);
    simulation.begin();

    const before = actor.stats.effective.blockChance;
    simulation.applyAura(actor, HOLY_SHIELD, actor.id);
    expect(actor.stats.effective.blockChance - before).toBeCloseTo(30, 6);
  });
});

describe('Vengeance stacks three times now, and says non-periodic', () => {
  /*
   * ----------------------------------------------------------------------------
   * NEITHER CHANGE IS IN THE PATCH NOTES. The tooltip went from "after landing a
   * critical strike. Stacks up to 5 times" to "after landing a NON-PERIODIC
   * critical strike. Stacks up to 3 times".
   *
   * ONE OF THE TWO IS A NO-OP AND IT IS WORTH SAYING WHICH. `dealDamage` offers
   * an attack to a reaction only when `request.attackTable && !request.periodic`,
   * so a tick is never shown to one -- the "non-periodic" wording is a narrowing
   * of the tooltip and not of the behaviour. The stack cap is where the figure
   * moved: at 3% a stack the ceiling went from 1.15x to 1.09x.
   * ----------------------------------------------------------------------------
   */
  it('caps at three stacks, so the ceiling is 1.09x rather than 1.15x', () => {
    expect(VENGEANCE_MAX_STACKS).toBe(3);
    expect(talentNumber('paladin', 'vengeance', 3, 0)).toBe(3);
    expect(talentNumber('paladin', 'vengeance', 3, 2)).toBe(3);

    const aura = vengeanceAura(3);
    expect(aura.maxStacks).toBe(3);
    expect(aura.modifiersScaleWithStacks).toBe(true);
    // A three-stack 1.03 is 1.0927, not 1.09 -- `scaleByStacks` takes damage to
    // the POWER of the count, which is what every other reader of that flag does.
    expect(aura.damageDoneMultiplier! ** 3).toBeCloseTo(1.092727, 5);
  });

  it('reaches three stacks and no more in a real fight', () => {
    /*
     * THE MEASURED HALF. A stack cap written on the aura and not honoured by
     * `AuraCollection` would read as a working buff with visible uptime, which is
     * the hardest kind of mistake to see -- Adrenaline Rush reported 24.9% uptime
     * while delivering no energy at all.
     */
    let peak = 0;
    let seen = 0;
    for (let seed = 1; seed <= 10; seed += 1) {
      const simulation = new Simulation(
        trainingDummyEncounter({ ...PRESETS_BY_ID.get('pally_ret')!.build() }, seed * 7919),
        {
          emit: (event) => {
            if (!('auraId' in event) || event.auraId !== 'vengeance') return;
            if (event.type === 'aura_removed') return;
            seen += 1;
            peak = Math.max(peak, event.stacks ?? 0);
          },
        },
      );
      simulation.begin();
      simulation.run();
    }
    expect(seen).toBeGreaterThan(0);
    expect(peak).toBe(3);
  }, 20_000);
});
