import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import type { Ability, Combatant, TelemetryEvent } from '../../src/engine';
import { NO_CHANCES, castAbility, seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeTarget } from '../helpers/actors';
import {
  WARLOCK_AFFLICTION_PERIODICS,
  WARLOCK_DESTRUCTION_SPELLS,
  WARLOCK_SOUL_SIPHON_EFFECTS,
  WRACK,
  WRACK_SOUL_SIPHON_CAP,
  WRACK_SOUL_SIPHON_PER_EFFECT,
} from '../../src/game/abilities/warlock';
import {
  BANE_OF_AGONY,
  CORRUPTION,
  SIPHON_LIFE,
  WRACK_AMPLIFICATION,
} from '../../src/game/auras/warlock';
import { COMBAT_CONSTANTS } from '../../src/game/combat/attackChances';
import { WARLOCK_TALENT_EFFECTS } from '../../src/game/talents/warlockEffects';
import type { TalentEffect } from '../../src/game/talents/TalentEffect';

/*
 * ============================================================================
 * THE WARLOCK TALENTS THAT SELECT A LIST OF ABILITIES, and the two that select
 * a TREE and were reading a SCHOOL instead.
 *
 * ASSERTING THE MECHANISM AND NOT A DPS DELTA, by the standing rule -- and
 * this file is the worked argument for that rule. Three of the five talents
 * here reach only Wrack, which was in no list when they were written, so all
 * three were worth EXACTLY ZERO and all three were correct. Wrack is in the
 * SM/DS list now and they are live, and NOT ONE ASSERTION HERE CHANGED. A test
 * written against a DPS delta would have had to be rewritten twice.
 *
 * THE BONUS HALF IS THE NUMBER TO GET RIGHT. A spell crit multiplies by 1.5, so
 * "+100% critical strike damage bonus" adds 0.5 and takes it to 2.0x. Reading
 * the melee figure would add 1.0 and give 2.5x -- a plausible number, and twice
 * the talent. It is written out from the constant here rather than hardcoded,
 * so a ruleset change moves the test and the code together.
 * ============================================================================
 */

const SPELL_CRIT_BONUS_HALF = COMBAT_CONSTANTS.spellCritMultiplier - 1;

const playerFor = (preset: string): Combatant => {
  const built = PRESETS_BY_ID.get(preset)!.build();
  return createPlayer({
    race: 'undead',
    characterClass: 'warlock',
    combatStyle: 'caster',
    talents: built.talents,
    equipment: built.equipment,
  });
};

/**
 * The same character with its PRIORITY LIST taken away.
 *
 * ----------------------------------------------------------------------------
 * A `createPlayer` COMBATANT CARRIES A ROTATION, AND A TEST THAT RUNS THE CLOCK
 * IS THEREFORE TESTING THE LIST TOO. That is how the Soul Siphon test below
 * broke: it cast Wrack once, ran ten seconds, and summed every `wrack` damage
 * event -- and when Wrack entered the SM/DS list the ROTATION cast it again
 * inside the window. Worse, it did so ASYMMETRICALLY: the second cast is gated
 * on the three bleeds being up, so the "three bleeds" arm got ten ticks and the
 * "no bleeds" arm got six. The ratio read 2.27 against an expected 1.36 and
 * neither number was about Soul Siphon.
 *
 * IT WAS A LATENT FLAW THAT A LIST CHANGE EXPOSED, not a mechanism breaking:
 * the test was only ever correct while Wrack was in no list, and nothing said
 * so. Any test that advances the clock on a built character wants this.
 * ----------------------------------------------------------------------------
 */
const soloPlayerFor = (preset: string): Combatant => {
  const actor = playerFor(preset);
  (actor as { rotation?: unknown }).rotation = undefined;
  return actor;
};

describe('Pandemic, the first talent to reach critMultiplierBonus', () => {
  const smds = playerFor('warlock_smds');

  it('gives every DECLARED spell it names the spell-crit bonus half', () => {
    /*
     * ------------------------------------------------------------------------
     * "+100% CRITICAL STRIKE DAMAGE BONUS" at 3/3, over seven named spells.
     * `AbilityModifiers.critMultiplierBonus` had existed since Impale with no
     * talent effect reaching it, which is what the old `unmodelled` reason said
     * -- a missing DECLARATION rather than a missing rule, and the Rogue's
     * Lethality wanted the identical one.
     *
     * AN AURA ID IS AN ABILITY ID, which is the whole reason this is
     * expressible: a periodic tick carries its AURA's id and `rollPeriodicCrit`
     * applies the same modifier a cast gets.
     * ------------------------------------------------------------------------
     */
    for (const id of [...WARLOCK_AFFLICTION_PERIODICS, 'wrack']) {
      expect(smds.abilityModifiers.for(id).critMultiplierBonus, id).toBeCloseTo(
        SPELL_CRIT_BONUS_HALF,
        6,
      );
    }
  });

  it('does NOT reach Shadow Bolt, which it does not name', () => {
    /*
     * The containment check, and the one that separates this from the three
     * scopes that already existed. Shadow Bolt is 52% of this profile's damage
     * and is not in the talent's list; a whole-character or per-school reading
     * would have swept it up and produced a much larger and entirely plausible
     * number.
     */
    expect(smds.abilityModifiers.for('shadow_bolt').critMultiplierBonus ?? 0).toBe(0);
    expect(smds.schoolModifiers.for('shadow').critMultiplierBonus ?? 0).toBe(0);
  });

  it('is absent from the build that does not take it', () => {
    const firelock = playerFor('warlock_firelock');
    expect(firelock.abilityModifiers.for('corruption').critMultiplierBonus ?? 0).toBe(0);
  });
});

describe('Ruin and Agonizing Flames, which select a TREE and not a school', () => {
  const firelock = playerFor('warlock_firelock');

  it('Ruin reaches every declared Destruction spell', () => {
    // 5/5 is +100%, so the spell bonus half. Shadow Bolt is in the list
    // because the source's own spellbook puts it in the Destruction tab.
    for (const id of WARLOCK_DESTRUCTION_SPELLS) {
      expect(firelock.abilityModifiers.for(id).critMultiplierBonus, id).toBeCloseTo(
        SPELL_CRIT_BONUS_HALF,
        6,
      );
    }
    expect(WARLOCK_DESTRUCTION_SPELLS).toContain('shadow_bolt');
  });

  it('and stops at Corruption, which is an AFFLICTION spell', () => {
    /*
     * ------------------------------------------------------------------------
     * THE BUG THIS PAIR OF TALENTS CARRIED. Both were read as "Fire and Shadow"
     * -- the two schools a Warlock has, which is every spell it owns -- so both
     * also reached Corruption, Bane of Agony, Siphon Life and Wrack.
     *
     * CORRUPTION IS 13.5% OF THIS PROFILE'S DAMAGE and it was collecting +100%
     * crit damage and +10% damage from two Destruction talents. Worth -3.3 and
     * -4.8 DPS respectively, measured over 30 batches of 10.
     * ------------------------------------------------------------------------
     */
    expect(firelock.abilityModifiers.for('corruption').critMultiplierBonus ?? 0).toBe(0);
    expect(firelock.abilityModifiers.for('corruption').damageMultiplier ?? 1).toBe(1);
    // And the school scope they used to travel on is now empty.
    expect(firelock.schoolModifiers.for('shadow').critMultiplierBonus ?? 0).toBe(0);
  });

  it('Agonizing Flames gives its +10% to a Destruction spell and nothing else', () => {
    // 3/3 is 10%, and Incinerate is touched by no other damage talent here.
    expect(firelock.abilityModifiers.for('incinerate').damageMultiplier).toBeCloseTo(1.1, 6);
  });
});

describe('Improved Drains and Soul Siphon, which reach Wrack and nothing else', () => {
  const smds = playerFor('warlock_smds');

  it('Improved Drains and Malediction BOTH reach Wrack, and they multiply', () => {
    /*
     * ------------------------------------------------------------------------
     * 1.2 x 1.05 = 1.26, AND THE SECOND FACTOR IS A RULING.
     *
     * Improved Drains names "Drain Life, Drain Soul, and Wrack" and is the only
     * one of those three this project declares. Malediction names "all periodic
     * damage done by your Warlock spells" -- and whether a CHANNEL's ticks are
     * periodic damage is a question the data could not answer, because Wrack's
     * ticks are cast ticks and carry no `periodic` flag. The ruleset owner has
     * ruled that for Malediction they are.
     *
     * THIS ASSERTED 1.2 AND WAS RIGHT UNTIL THAT RULING. It is the product now,
     * written out with both factors named, so the next reader can see which
     * talent contributes what rather than meeting a bare 1.26.
     *
     * THEY MULTIPLY RATHER THAN ADD, which is `combineAbilityModifiers`' rule
     * for damage and the same one `SchoolModifiers` uses: two independent +10%
     * effects are +21%.
     * ------------------------------------------------------------------------
     */
    const improvedDrains = 1.2;
    const malediction = 1.05;
    expect(smds.abilityModifiers.for('wrack').damageMultiplier).toBeCloseTo(
      improvedDrains * malediction,
      6,
    );
  });

  it('Soul Siphon hands Wrack its per-effect number and its cap', () => {
    const wrack = smds.abilities.get('wrack');
    expect(wrack?.bonuses?.[WRACK_SOUL_SIPHON_PER_EFFECT]).toBe(12);
    expect(wrack?.bonuses?.[WRACK_SOUL_SIPHON_CAP]).toBe(36);
  });

  it('and Soul Siphon is read per CAST, off what is on the target', () => {
    /*
     * ------------------------------------------------------------------------
     * "+12% PER EACH OF YOUR OTHER AFFLICTION EFFECTS ACTIVE ON THE TARGET, UP
     * TO 36%", which is why it is an `abilityBonus` read in `onCast` rather
     * than a standing modifier: its size depends on the target's state.
     *
     * SCRIPTED, NOT SAMPLED. `NO_CHANCES` with a large negative crit makes
     * every tick a clean non-critical hit, so the ratio is the talent and not
     * a seed.
     * ------------------------------------------------------------------------
     */
    const damageWith = (dots: number): number => {
      const events: TelemetryEvent[] = [];
      // NO ROTATION -- see `soloPlayerFor`. With one, the list casts Wrack a
      // second time inside the window and only when the bleeds are up.
      const caster = soloPlayerFor('warlock_smds');
      const target = makeTarget({ maxHealth: 100_000_000 });
      const simulation = buildSimulation(
        [caster, target],
        {
          durationMs: seconds(30),
          attackChances: () => ({ ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1.5 }),
        },
        { emit: (event) => events.push(event) },
      );
      for (const aura of [CORRUPTION, BANE_OF_AGONY, SIPHON_LIFE].slice(0, dots)) {
        simulation.applyAura(target, aura, caster.id);
      }
      /*
       * NOTE WHAT IS *NOT* HERE: Curse of the Elements. The owner has ruled it
       * counts for Soul Siphon, and in a real fight it arrives from the preset
       * raid buffs and is up for the hour -- so a profile reaches the 36% cap on
       * Corruption, Curse of the Elements and Bane of Agony alone. This test
       * builds the target by hand precisely so the count is the three it
       * applies and not whatever the raid turned up with.
       */

      castAbility(simulation, caster, caster.abilities.get('wrack') as Ability, target);
      simulation.advanceTo(seconds(10));

      let total = 0;
      for (const event of events) {
        if (event.type === 'damage' && event.abilityId === 'wrack') total += event.amount;
      }
      return total;
    };

    // No other Affliction effect up: the bonus is 1.0 and the ticks are plain.
    const bare = damageWith(0);
    // Three up: 3 x 12% = 36%, which is exactly the cap.
    const loaded = damageWith(3);
    expect(loaded / bare).toBeCloseTo(1.36, 3);
    // Two up is 24%, under the cap, so it scales rather than jumping to it.
    expect(damageWith(2) / bare).toBeCloseTo(1.24, 3);
  });
});

describe('Wrack, whose debuff amplifies only damage OVER TIME', () => {
  it('is a debuff the ability applies, with the ability id it shares', () => {
    // Same id as the ability, so Pandemic and Improved Drains reach the ticks
    // and the debuff through one key. `WRACK` applies it in its own `onCast`.
    expect(WRACK_AMPLIFICATION.id).toBe(WRACK.id);
    expect(WRACK_AMPLIFICATION.isDebuff).toBe(true);
  });

  it('raises a Corruption TICK and leaves a Shadow Bolt CAST alone', () => {
    /*
     * ------------------------------------------------------------------------
     * THE DISTINCTION IS THE WHOLE FEATURE, and it is why this is not
     * `damageTakenBySchool`. Both spells here are Shadow and both are the
     * caster's; one is damage OVER TIME and the other is not.
     *
     * SHADOW BOLT IS 52% OF THIS PROFILE'S DAMAGE, which is what the old
     * `unmodelled` reason said would be swept up by a plain Shadow
     * vulnerability -- "a bigger number wearing the right label rather than an
     * approximation". This assertion is that sentence.
     *
     * AND IT IS ALSO WHY WRACK CANNOT AMPLIFY ITSELF. Wrack is a CHANNEL, so
     * its six ticks are cast ticks exactly as Shadow Bolt is, and they are
     * covered by the second assertion rather than by a special case.
     *
     * A RATIO OF TWO RUNS, not an absolute: this profile carries Shadow
     * Mastery, Malevolence and a sacrificed Imp, and an absolute figure would
     * be a test of those as well.
     * ------------------------------------------------------------------------
     */
    const damageOf = (abilityId: string, amplified: boolean): number => {
      const events: TelemetryEvent[] = [];
      const caster = soloPlayerFor('warlock_smds');
      const target = makeTarget({ maxHealth: 100_000_000 });
      const simulation = buildSimulation(
        [caster, target],
        {
          durationMs: seconds(60),
          attackChances: () => ({ ...NO_CHANCES, crit: -1_000_000, critMultiplier: 1.5 }),
        },
        { emit: (event) => events.push(event) },
      );
      if (amplified) simulation.applyAura(target, WRACK_AMPLIFICATION, caster.id);
      castAbility(simulation, caster, caster.abilities.get(abilityId) as Ability, target);
      // Inside the debuff's six seconds, so Corruption's first tick lands under
      // it and Shadow Bolt's three-second cast resolves under it too.
      simulation.advanceTo(seconds(4));

      let total = 0;
      for (const event of events) {
        if (event.type === 'damage' && event.abilityId === abilityId) total += event.amount;
      }
      return total;
    };

    expect(damageOf('corruption', true) / damageOf('corruption', false)).toBeCloseTo(1.1, 6);
    expect(damageOf('shadow_bolt', true) / damageOf('shadow_bolt', false)).toBeCloseTo(1, 6);
  });
});

describe('Two lists, and conflating them would have been the bug', () => {
  /*
   * ============================================================================
   * PANDEMIC SELECTS PERIODIC SPELLS BY NAME. SOUL SIPHON COUNTS "AFFLICTION
   * EFFECTS". They overlap and they are not the same set, and the ruleset owner
   * has ruled that Soul Siphon's includes CURSE OF THE ELEMENTS -- a raid
   * debuff, which is neither periodic nor one of the seven spells Pandemic
   * lists.
   *
   * SO ADDING IT TO ONE SHARED LIST WOULD HAVE HANDED A CRIT DAMAGE BONUS TO A
   * RAID DEBUFF, which is the sort of thing that produces a slightly larger
   * number and no error anywhere.
   * ============================================================================
   */
  it('Soul Siphon counts Curse of the Elements and Pandemic does not', () => {
    expect(WARLOCK_SOUL_SIPHON_EFFECTS).toContain('curse_of_the_elements');
    expect(WARLOCK_AFFLICTION_PERIODICS).not.toContain('curse_of_the_elements');

    // And the modifier really does stop at the spells Pandemic names.
    const smds = playerFor('warlock_smds');
    expect(
      smds.abilityModifiers.for('curse_of_the_elements').critMultiplierBonus ?? 0,
    ).toBe(0);
  });

  it('counts three effects to the cap, which the raid supplies for free', () => {
    /*
     * The owner's enumeration: "corruption, curse of the elements, and bane of
     * agony are the 3 affliction effects needed to max out the 36% damage buff
     * to wrack." Curse of the Elements comes from the preset raid buffs and
     * sits on the target for the hour.
     *
     * WORTH +0.4 AND THAT IS NOT A FAILURE: with Siphon Life in the list the
     * three bleeds already reach the 36% cap on their own, so the fourth
     * counted effect is redundant while they are all up. It becomes
     * load-bearing the moment one drops.
     */
    const smds = playerFor('warlock_smds');
    const wrack = smds.abilities.get('wrack');
    const perEffect = wrack?.bonuses?.[WRACK_SOUL_SIPHON_PER_EFFECT] ?? 0;
    const cap = wrack?.bonuses?.[WRACK_SOUL_SIPHON_CAP] ?? 0;
    expect(perEffect * 3).toBe(cap);
  });

  it('Malediction reaches Wrack, which is the owner calling a channel periodic', () => {
    const malediction = WARLOCK_TALENT_EFFECTS.malediction;
    const ids = malediction
      .filter((e: TalentEffect) => e.kind === 'abilityDamage')
      .map((e: TalentEffect) => (e as { abilityId: string }).abilityId);
    expect(ids).toContain('wrack');
    // The four aura ids it already had, so the ruling ADDED rather than moved.
    expect(ids).toEqual(
      expect.arrayContaining(['corruption', 'bane_of_agony', 'siphon_life', 'immolate']),
    );
  });

  it('Amplify Curse grants its ability and reports only the curses it cannot reach', () => {
    const effects = WARLOCK_TALENT_EFFECTS.amplify_curse;
    expect(effects.some((e: TalentEffect) => e.kind === 'grantAbility')).toBe(true);
    // Its old reason asked for a one-shot per-ability DAMAGE modifier and was
    // wrong about the mechanism; nothing should still claim that.
    for (const effect of effects) {
      if (effect.kind === 'unmodelled') {
        expect(effect.reason).not.toContain('CastModifier');
      }
    }
  });
});
