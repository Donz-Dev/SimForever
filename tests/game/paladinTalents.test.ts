import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { abilitiesForClass } from '../../src/game/abilities/abilitiesForClass';
import { reactionsForClass } from '../../src/game/reactions/reactionsForClass';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { castAbility, dealDamage, resolveCast, seconds, spellPowerAgainst } from '../../src/engine';
import { runProfileBatch } from '../../src/simulator';
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
  EYE_FOR_AN_EYE_HEALTH_CAP_PERCENT,
  SHIELD_SPECIALIZATION_MANA_PERCENT,
} from '../../src/game/reactions/paladinTalents';
import { PALADIN_TALENT_EFFECTS } from '../../src/game/talents/paladinEffects';
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

describe('Vindication', () => {
  it('uses the 10% the ruleset owner supplied, which no source states', () => {
    expect(VINDICATION_CHANCE).toBe(10);
  });

  it('is registered on the build that takes it and on neither of the others', () => {
    expect(presetPlayer('pally_ret').reactions.map((r) => r.id)).toContain('vindication');
    expect(presetPlayer('pally_shockadin').reactions.map((r) => r.id)).not.toContain('vindication');
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
