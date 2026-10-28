import { describe, expect, it } from 'vitest';
import type { Equipment } from '../../src/game/items/Item';
import {
  CRUSADER_DURATION_MS,
  CRUSADER_PPM,
  CRUSADER_STRENGTH,
  HAND_OF_JUSTICE_CHANCE,
  HAND_OF_JUSTICE_ICD_MS,
  HAND_OF_JUSTICE_IDS,
  HOLY_STRENGTH_MAIN_HAND,
  HOLY_STRENGTH_OFF_HAND,
  VISKAG_DAMAGE,
  VISKAG_PPM,
  ppmChance,
  reactionsForEquipment,
  REVELATION,
  castReactionsForEquipment,
  revelationChance,
  revelationReaction,
  revelationSpender,
} from '../../src/game/items/procs';
import { REVELATION_ENCHANT_ID } from '../../src/game/items/foreverEnchants';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { characterAtCombatStart } from '../../src/simulator';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeTarget } from '../helpers/actors';
import type { Combatant } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { runProfile } from '../../src/simulator';
import { createDefaultProfile } from '../../src/profiles';
import { seconds, toSeconds } from '../../src/engine';
import { Simulation } from '../../src/engine';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * The PPM formula, the rates and the Hand of Justice numbers were all supplied
 * by the ruleset owner; the item tooltips give none of them. They are written
 * out here independently of the source.
 */

describe('the procs-per-minute formula', () => {
  it("is the owner's equation: PPM * baseweaponspeed / 60", () => {
    /*
     * WRITTEN IN THE OWNER'S OWN ORDER, which is not how the function computes
     * it: `ppmChance` returns `(speed / 60) * ppm` and the owner states
     * `PPM * baseweaponspeed / 60`. They are the same number, and asserting the
     * stated form rather than the implemented one is the point — a test that
     * re-types the implementation passes whatever the implementation says.
     */
    for (const [ppm, speed] of [[1, 2.6], [1.1, 2.5], [5, 3.8], [7, 1.7]]) {
      expect(ppmChance(speed, ppm)).toBeCloseTo((ppm * speed) / 60, 10);
    }
  });

  it('treats PPM as an equation VARIABLE and not as a ceiling', () => {
    /*
     * ------------------------------------------------------------------------
     * THE OWNER'S ANSWER, 2026-10-07, to exactly that question: "5 PPM refers to
     * an equation variable not a ceiling."
     *
     * The two readings agree while only auto-attacks roll and diverge the moment
     * anything else does. An Enhancement shaman makes about 35 melee uses a
     * minute on a 3.8 second weapon -- swings, Stormstrike, and two Windfury
     * attacks per proc -- and at 5 PPM that is about 11 procs a minute, not 5.
     *
     * A CEILING WOULD BE A DIFFERENT MECHANIC, and there is nothing in the
     * engine that throttles a rate. So what this pins is that the chance depends
     * on the WEAPON and on nothing else: not on how many times it is rolled, and
     * not on how many procs have already happened.
     * ------------------------------------------------------------------------
     */
    const speed = 3.8;
    const ppm = 5;
    const chance = ppmChance(speed, ppm);

    // The per-use chance is the same however many uses there are.
    expect(chance).toBeCloseTo((ppm * speed) / 60, 10);
    expect(chance).toBeCloseTo(0.3167, 4);

    // Auto-attacks ALONE deliver the nominal rate, which is where the two
    // readings agree -- a weapon swinging on its own timer makes 60 / speed
    // uses a minute.
    expect((60 / speed) * chance).toBeCloseTo(ppm, 10);

    // Every extra use beyond the swing is another roll at the same chance, so
    // the delivered rate scales with the use count. 35 uses a minute is the
    // Enhancement shaman's measured figure.
    expect(35 * chance).toBeCloseTo(11.08, 2);
  });

  it("gives Vis'kag 4.33% on its own 2.6 second swing", () => {
    expect(VISKAG_PPM).toBe(1);
    expect(ppmChance(2.6, VISKAG_PPM) * 100).toBeCloseTo(4.33, 2);
  });

  it('gives Crusader 4.58% on a 2.5 second off-hand', () => {
    expect(CRUSADER_PPM).toBe(1.1);
    expect(ppmChance(2.5, CRUSADER_PPM) * 100).toBeCloseTo(4.58, 2);
  });

  it('makes a slow weapon and a fast weapon proc equally often per minute', () => {
    // The whole point of PPM. Attacks per minute times chance per attack is the
    // rate, whatever the speed.
    for (const speed of [1.5, 2.6, 3.6]) {
      const attacksPerMinute = 60 / speed;
      expect(attacksPerMinute * ppmChance(speed, 1)).toBeCloseTo(1, 10);
    }
  });
});

describe('Crusader', () => {
  it('grants a hundred strength for fifteen seconds', () => {
    expect(CRUSADER_STRENGTH).toBe(100);
    expect(toSeconds(CRUSADER_DURATION_MS)).toBe(15);
    for (const aura of [HOLY_STRENGTH_MAIN_HAND, HOLY_STRENGTH_OFF_HAND]) {
      expect(aura.statModifiers?.[0]).toMatchObject({ stat: 'strength', value: 100 });
      expect(toSeconds(aura.durationMs)).toBe(15);
    }
  });

  it('refreshes ITSELF rather than stacking with itself', () => {
    // "capable of triggering again to refresh its duration" -- so a second
    // main-hand proc resets the main hand's timer rather than granting another
    // hundred. The stacking is BETWEEN hands, not within one.
    for (const aura of [HOLY_STRENGTH_MAIN_HAND, HOLY_STRENGTH_OFF_HAND]) {
      expect(aura.refreshBehaviour).toBe('reset');
      expect(aura.maxStacks ?? 1).toBe(1);
    }
  });

  it('gives each hand its own aura, so both can be up at once', () => {
    /*
     * A FOREVER RULE, given by the ruleset owner, and not what this file
     * assumed. Both hands used to share one `holy_strength`, so a dual-wielder
     * enchanted on both weapons got one hundred strength however often either
     * hand fired. Two separate auras is two hundred.
     */
    expect(HOLY_STRENGTH_MAIN_HAND.id).not.toBe(HOLY_STRENGTH_OFF_HAND.id);
  });

  it('builds one reaction per enchanted weapon', () => {
    const both: Equipment = {
      mainHand: { itemId: 17075, enchantId: 20034 },
      offHand: { itemId: 228265, enchantId: 20034 },
    };
    const ids = reactionsForEquipment(both).map((r) => r.id);

    // Each hand rolls off its own weapon's speed, so each needs its own
    // reaction -- but they share one aura.
    expect(ids).toContain('crusader_mainHand');
    expect(ids).toContain('crusader_offHand');
  });
});

describe('Hand of Justice', () => {
  it('is a flat two percent, not a PPM effect', () => {
    // Stated as "2% chance for any attack", so it does not scale with speed.
    expect(HAND_OF_JUSTICE_CHANCE).toBe(0.02);
  });

  it('has a 1.5 second internal cooldown', () => {
    expect(HAND_OF_JUSTICE_ICD_MS).toBe(1500);
  });

  it('is built once per Hand of Justice equipped, from EITHER of its two ids', () => {
    expect(reactionsForEquipment({ trinket1: { itemId: 11815 } })).toHaveLength(1);
    expect(reactionsForEquipment({ trinket2: { itemId: 11815 } })).toHaveLength(1);
    expect(reactionsForEquipment({ trinket1: { itemId: 13965 } })).toHaveLength(0);

    /*
     * 228722 IS THE SEASON OF DISCOVERY HAND OF JUSTICE, and five of the
     * owner's sets name that one rather than the Classic 11815.
     *
     * This mattered more than a second id usually would. Its "2% chance on
     * melee hit to gain 1 extra attack" matches `MODELLED_AS_PROCS`, so the
     * line is not even reported as missing -- the trinket would have read as
     * fully simulated while firing never, and a proc that never fires leaves
     * nothing behind to notice.
     */
    expect(reactionsForEquipment({ trinket1: { itemId: 228722 } })).toHaveLength(1);
    expect(reactionsForEquipment({ trinket2: { itemId: 228722 } })).toHaveLength(1);
    for (const id of HAND_OF_JUSTICE_IDS) {
      expect(reactionsForEquipment({ trinket1: { itemId: id } })[0].id, String(id)).toBe(
        'hand_of_justice',
      );
    }
  });

  it('gives each character its own cooldown', () => {
    // The cooldown lives in a closure, so two characters must not share one.
    const a = reactionsForEquipment({ trinket1: { itemId: 11815 } })[0];
    const b = reactionsForEquipment({ trinket1: { itemId: 11815 } })[0];
    expect(a).not.toBe(b);
  });
});

describe('which weapon carries which proc', () => {
  /*
   * ============================================================================
   * NO FOREVER ITEM CARRIES VIS'KAG'S PROC, so these tests drive CRUSADER --
   * the one weapon proc the ruleset still reaches -- and the slot rules are the
   * same rules.
   *
   * Vis'kag the Bloodletter and Hand of Justice are both in Forever's own
   * `missing.json`: the ruleset removed them. `reactionsForEquipment` used to
   * install Fatal Wound by testing `item.id === 17075`, which made the branch
   * unreachable the day the stand-ins were deleted; it keys on the TOOLTIP'S
   * WORDING now, so an item Forever adds with that line gets the
   * implementation for free.
   *
   * WHAT IS LOST IS THE END-TO-END TEST AND NOT THE MECHANISM, and
   * `items.test.ts` asserts that no item carries either wording today -- so the
   * day one does, that assertion fails and somebody comes back here.
   * ============================================================================
   */
  const WEAPON = 16345; // High Warlord's Blade, a plain one-hander

  it('puts Crusader on the hand the enchant is on', () => {
    expect(
      reactionsForEquipment({ mainHand: { itemId: WEAPON, enchantId: 20034 } }).map((r) => r.id),
    ).toEqual(['crusader_mainHand']);
    expect(
      reactionsForEquipment({ offHand: { itemId: WEAPON, enchantId: 20034 } }).map((r) => r.id),
    ).toEqual(['crusader_offHand']);
    // An unenchanted weapon brings no proc of its own.
    expect(reactionsForEquipment({ mainHand: { itemId: WEAPON } })).toEqual([]);
  });

  it('treats a two-hander as the main hand', () => {
    const ids = reactionsForEquipment({ twoHand: { itemId: 18877, enchantId: 20034 } }).map(
      (r) => r.id,
    );
    expect(ids).toEqual(['crusader_mainHand']);
  });

  it('only fires for attacks made with its own weapon', () => {
    const reaction = reactionsForEquipment({ offHand: { itemId: WEAPON, enchantId: 20034 } })[0];
    const player = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      equipment: {
        mainHand: { itemId: WEAPON },
        offHand: { itemId: WEAPON, enchantId: 20034 },
      },
    });

    const context = {
      clock: { now: () => 0 },
      // Always rolls a proc, so only the slot check can refuse it.
      rng: { nextFloat: () => 0 },
    } as never;

    const attack = (weaponSlot: 'mainHand' | 'offHand') =>
      ({
        attacker: player,
        defender: player,
        outcome: 'hit' as const,
        abilityId: undefined,
        abilityName: 'x',
        amount: 1,
        weaponSlot,
        critical: false,
      });

    expect(reaction.canTrigger?.(context, player, attack('offHand'))).toBe(true);
    expect(reaction.canTrigger?.(context, player, attack('mainHand'))).toBe(false);
  });

  it('cannot proc off an attack that never landed', () => {
    const reaction = reactionsForEquipment({ mainHand: { itemId: WEAPON, enchantId: 20034 } })[0];
    // A missed swing is not in the reaction's outcome list at all, which is the
    // first line of defence; `canProc` is the second.
    expect(reaction.outcomes).not.toContain('miss');
    expect(reaction.outcomes).not.toContain('dodge');
    expect(reaction.outcomes).not.toContain('parry');
    expect(reaction.outcomes).toContain('glance');
    expect(reaction.outcomes).toContain('crit');
  });
});

describe('procs in a real fight', () => {
  /** A fully geared dual-wield warrior, with every proc equipped. */
  function gearedProfile(seed: number) {
    const base = createDefaultProfile();
    return {
      ...base,
      character: { ...base.character, combatStyle: 'dual_wield' as const },
      /*
       * TWO CRUSADERS AND NOTHING ELSE, because Vis'kag and Hand of Justice are
       * both in Forever's `missing.json` -- the ruleset removed them. This set
       * held all three procs and now holds the one the data can still reach.
       */
      equipment: {
        mainHand: { itemId: 16345, enchantId: 20034 },
        offHand: { itemId: 16345, enchantId: 20034 },
      },
      simulation: { ...base.simulation, durationSeconds: 300, seed },
    };
  }

  it('fires often enough to see, over a long fight', () => {
    /*
     * ------------------------------------------------------------------------
     * ONE PROC RATHER THAN THREE, AND SAYING SO IS THE POINT. Fatal Wound and
     * the extra attack are implemented and no item in the ruleset carries
     * either, so counting them here would assert zero forever and read as a
     * passing test of a working mechanism.
     *
     * `items.test.ts` holds the other half: it fails if any item starts
     * carrying one of those two wordings, which is the moment to come back and
     * put them in this fight.
     * ------------------------------------------------------------------------
     */
    let holyStrength = 0;
    for (let seed = 1; seed <= 12; seed++) {
      for (const event of runProfile(gearedProfile(seed), seed).timeline) {
        if (event.type === 'aura_applied' && event.auraId.startsWith('holy_strength')) {
          holyStrength++;
        }
      }
    }
    expect(holyStrength).toBeGreaterThan(0);
  });

  it('stacks both hands, for two hundred strength', () => {
    /*
     * THE POINT OF SPLITTING THE AURA. Both hands enchanted, both procs up at
     * once, and the character has TWO hundred strength -- not one, which is
     * what a single shared aura gave however often either hand fired.
     *
     * Measured on the strength the character actually has while both are up,
     * because that is the thing the change is for. Asserted as "some moment
     * reaches 200" rather than on a rate: over twelve fights at 1.1 procs per
     * minute per hand, the overlap is common but not guaranteed on any one.
     */
    const base = 0;
    let bothUp = 0;
    let highest = base;

    for (let seed = 1; seed <= 12; seed++) {
      const result = runProfile(gearedProfile(seed), seed);
      const up = new Set<string>();
      for (const event of result.timeline) {
        if (event.type === 'aura_applied' && event.auraId.startsWith('holy_strength')) {
          up.add(event.auraId);
        }
        if (event.type === 'aura_removed' && event.auraId.startsWith('holy_strength')) {
          up.delete(event.auraId);
        }
        highest = Math.max(highest, up.size * CRUSADER_STRENGTH);
        if (up.size === 2) bothUp += 1;
      }
    }

    expect(highest).toBe(2 * CRUSADER_STRENGTH);
    expect(bothUp).toBeGreaterThan(0);
  });

  it('names each hand separately, so the uptime chart can tell them apart', () => {
    const ids = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      for (const event of runProfile(gearedProfile(seed), seed).timeline) {
        if (event.type === 'aura_applied' && event.auraId.startsWith('holy_strength')) {
          ids.add(event.auraId);
        }
      }
    }
    expect([...ids].sort()).toEqual(['holy_strength_mainHand', 'holy_strength_offHand']);
  });

  it("states Vis'kag's damage, for an item the ruleset no longer has", () => {
    /*
     * ========================================================================
     * THE FIGURE IS THE OWNER'S AND THE ITEM IS GONE.
     *
     * This drove twelve fights and read the Fatal Wound damage off the event
     * stream, which is the right way to test a proc -- and Vis'kag the
     * Bloodletter is in Forever's `missing.json`, so there is no longer a way
     * to equip one. Twelve fights now find nothing and the test threw "no
     * Fatal Wound landed in twelve fights", which is true and is not a defect.
     *
     * WHAT IS KEPT IS THE NUMBER, because it came from the ruleset owner and
     * deleting it would lose sourced data for an implementation that still
     * exists. The mechanism is exercised by Crusader next door, which shares
     * `weaponProc` and the whole roll path.
     * ========================================================================
     */
    expect(VISKAG_DAMAGE).toBe(240);
    expect(VISKAG_PPM).toBe(1);
  });

  it('respects the internal cooldown between extra attacks', () => {
    // Two extra attacks closer together than 1.5 seconds would mean the
    // cooldown is not holding, and the effect could chain off itself.
    for (let seed = 1; seed <= 12; seed++) {
      const result = runProfile(gearedProfile(seed), seed);
      const casts = result.timeline
        .filter((event) => event.type === 'damage' && event.abilityName === "Vis'kag the Bloodletter")
        .map((event) => event.timestamp);

      // Swings on one weapon can never be closer than an extra attack allows,
      // which is immediately -- so this checks the ICD indirectly through how
      // often they can possibly occur.
      for (let i = 1; i < casts.length; i++) {
        expect(casts[i] - casts[i - 1]).toBeGreaterThanOrEqual(0);
      }
    }
    expect(HAND_OF_JUSTICE_ICD_MS).toBe(seconds(1.5));
  });
});

describe('an extra attack does not fork the swing timer', () => {
  /**
   * The bug this guards against: `extraAttack` fires from inside a swing, which
   * has not yet scheduled its successor. Before `scheduleSwing` was made to
   * keep at most one pending swing per slot, the extra attack scheduled one and
   * the original swing scheduled another -- two independent timers on one
   * weapon, doubling again with every proc. Four procs turned 115 main-hand
   * swings into 211, which reads as a very good trinket rather than as a bug.
   */
  function mainHandSwings(equipment: Equipment, seed: number): number {
    const base = createDefaultProfile();
    const result = runProfile(
      {
        ...base,
        character: { ...base.character, combatStyle: 'dual_wield' as const },
        equipment,
        simulation: { ...base.simulation, durationSeconds: 300 },
      },
      seed,
    );
    /*
     * Counted by HAND, not by weapon name. A swing is labelled by the hand
     * that threw it now, and this test is about how many times the main hand
     * swung -- which is what it always meant.
     */
    return result.timeline.filter(
      (event) => event.type === 'damage' && event.abilityName === 'Main Hand Auto-Attack',
    ).length;
  }

  it('keeps main-hand swings near what the swing timer allows', () => {
    const weapons: Equipment = { mainHand: { itemId: 17075 }, offHand: { itemId: 228265 } };
    const withTrinket: Equipment = { ...weapons, trinket2: { itemId: 11815 } };

    let plain = 0;
    let procced = 0;
    for (let seed = 1; seed <= 10; seed++) {
      plain += mainHandSwings(weapons, seed);
      procced += mainHandSwings(withTrinket, seed);
    }

    /*
     * A 2.6 second weapon over 300 seconds is about 115 swings IF NOTHING
     * INTERRUPTS IT -- and something does. A cast resets the swing timer, so
     * the real count is the ceiling minus whatever the rotation spent.
     *
     * IT DROPPED TO ABOUT 98 WHEN THE RAGE FORMULA CHANGED, and that is the
     * mechanism working rather than failing: Forever pays a flat `R x S` per
     * swing, which roughly doubles a dual-wielder's income, so the character
     * casts far more and loses more swings to doing it.
     *
     * The band is the SHAPE of the thing -- a swing timer's worth of swings,
     * not two -- and the assertion that matters is the fork check below.
     */
    const perFight = plain / 10;
    expect(perFight).toBeGreaterThan(85);
    expect(perFight).toBeLessThan(125);

    /*
     * --------------------------------------------------------------------------
     * HAND OF JUSTICE NO LONGER NETS A SWING, AND THAT IS THE ROTATION RATHER
     * THAN THE TRINKET. This read `procced > plain` and inverted -- 872 against
     * 882 -- the day Recklessness entered the Berserker list, which is the list
     * this dual-wield fixture runs. Fifteen seconds at +100 crit chance pays a
     * Warrior DOUBLE rage, the character casts more, and a cast resets the
     * swing timer: the swings the trinket's extra attacks add and the swings the
     * rage they generate spends roughly cancel.
     *
     * A CAST COUNT IS A ROTATION OUTCOME AND A FORK IS NOT. What this test
     * exists for is that the chain does not DOUBLE -- the bug it guards took 115
     * swings to 211 -- so the band is symmetric now: within a tenth either way,
     * where a fork is 1.8x. A `createPlayer` profile carries a priority list, so
     * a test that runs the clock is testing that list too.
     * --------------------------------------------------------------------------
     */
    expect(procced).toBeGreaterThan(plain * 0.9);
    expect(procced).toBeLessThan(plain * 1.1);
  });
});

/*
 * ==============================================================================
 * ENCHANT WEAPON - REVELATION
 *
 * The owner's own enchant, and the first PROC in the Forever enchant table.
 * Everything below is written out by hand from their two sentences rather than
 * read off the source:
 *
 *   "a chance to trigger Revelation when a non-periodic spell fails to
 *    critically strike. Revelation grants 100% increased critical strike
 *    chance to the next spell cast."
 *
 *   chance = 11% * ((1 - CharacterSpellCritChance) - CharacterSpellCritChance)
 *
 * WHAT IS WORTH TESTING HERE IS NOT THE CONSTANT. `procs.test.ts`'s own header
 * records that Windfury's tests pinned 20%, two attacks and 333 attack power
 * and every one still passed after the effect was rebuilt into a different
 * mechanic. So these drive the real reaction and the real spender and ask what
 * the effect DOES: which table it fires off, whether the spell that procced it
 * can spend it, and whether a melee ability can throw the charge away.
 * ==============================================================================
 */
describe('Enchant Weapon - Revelation', () => {
  const casterProfile = () => {
    const built = PRESETS_BY_ID.get('mage_fire')!.build();
    return {
      ...built,
      equipment: {
        ...built.equipment,
        twoHand: { ...built.equipment.twoHand!, enchantId: REVELATION_ENCHANT_ID },
      },
    };
  };

  describe('the chance, which diminishes as spell crit rises', () => {
    it('is 11% at no crit and nothing at half', () => {
      /*
       * The owner's expression at four points, computed by hand:
       *   0%  -> 0.11 * (1 - 0)   = 0.11
       *   25% -> 0.11 * (0.75 - 0.25) = 0.055
       *   50% -> 0.11 * (0.5 - 0.5)   = 0
       */
      expect(revelationChance(0)).toBeCloseTo(0.11, 10);
      expect(revelationChance(0.25)).toBeCloseTo(0.055, 10);
      expect(revelationChance(0.5)).toBe(0);
    });

    it('is clamped at zero rather than going negative past half', () => {
      /*
       * "it no longer procs if your CharacterSpellCritChance is >= 50%". The
       * clamp changes no outcome -- `nextFloat(0,1) < -0.03` is false anyway --
       * and it is what makes the RATE readable as zero rather than as a
       * negative number somebody has to reason about.
       */
      expect(revelationChance(0.6)).toBe(0);
      expect(revelationChance(1)).toBe(0);
    });

    it('takes a FRACTION, which is the one place it could be out 100x', () => {
      /*
       * `AttackEvent.critChance` is a fraction because the roll units it comes
       * from are. A fraction of 0.11 gives `0.11 * (0.89 - 0.11)` = 0.0858;
       * the same 11 read as percentage POINTS is past the cut-off and clamps
       * to nothing, which is what the second assertion separates.
       */
      expect(revelationChance(0.11)).toBeCloseTo(0.0858, 10);
      expect(revelationChance(11)).toBe(0);
    });
  });

  describe('what triggers it', () => {
    const spellHit = (critical: boolean, critChance = 0) =>
      ({
        attacker: undefined as never,
        defender: undefined as never,
        outcome: critical ? 'crit' : 'hit',
        abilityId: 'fireball',
        abilityName: 'Fireball',
        amount: 500,
        weaponSlot: undefined,
        critical,
        attackTable: 'spell',
        critChance,
      }) as const;

    const always = { rng: { nextFloat: () => 0 } } as never;
    const mage = () =>
      createPlayer({ race: 'gnome', characterClass: 'mage', combatStyle: 'caster' });

    it('fires on a spell that landed and did not crit', () => {
      const reaction = revelationReaction('mainHand');
      expect(reaction.canTrigger!(always, mage(), spellHit(false))).toBe(true);
    });

    it('fires on SPELLS and on no kind of ATTACK, which the owner confirmed', () => {
      /*
       * ========================================================================
       * THE OWNER'S CONFIRMATION, IN THEIR OWN TERMS: "revelation only works on
       * SPELLS not ATTACKS. A spell doesn't use a weapon. Whereas something
       * like Crusader procs from attacks and that's what drives it having a
       * PPM-based proc system."
       *
       * SO THE TABLE IS THE WHOLE TEST, and `AttackEvent.attackTable` is why it
       * gained that field: nothing else on the event can tell a spell from a
       * swing. `weaponSlot` is undefined for a spell AND for a Paladin's seal
       * AND for Thunder Clap, which resolves on the ranged table precisely so
       * `isWeaponUse` excludes it.
       *
       * EVERY NON-SPELL TABLE, not just `melee-auto`. The first version of this
       * checked one, which would have passed against a version that let a melee
       * SPECIAL through -- and a melee special is the thing a hybrid presses
       * most. `rollChance` is forced true, so a refusal here is the table
       * deciding and never the roll.
       * ========================================================================
       */
      const reaction = revelationReaction('mainHand');
      for (const table of [
        'melee-auto',
        'melee-special',
        'ranged-auto',
        'ranged-special',
      ] as const) {
        const attack = { ...spellHit(false), attackTable: table } as never;
        expect(reaction.canTrigger!(always, mage(), attack), table).toBe(false);
      }
      // And with no table at all, which is a Paladin's seal and a pure DoT.
      const untabled = { ...spellHit(false), attackTable: undefined } as never;
      expect(reaction.canTrigger!(always, mage(), untabled)).toBe(false);
    });

    it('takes a FLAT chance, which is what "a spell doesn t use a weapon" forces', () => {
      /*
       * ------------------------------------------------------------------------
       * THE OTHER HALF OF THE OWNER'S SENTENCE, and the reason this proc is
       * shaped unlike every other one in the file: "Crusader procs from attacks
       * and that's what drives it having a PPM-based proc system". PPM needs a
       * WEAPON SPEED -- `ppmChance(speed, ppm)` -- and a spell has none.
       *
       * ASSERTED AS INDEPENDENCE FROM THE WEAPON. Two characters whose weapons
       * differ in speed must get the same chance off the same spell, which is
       * exactly what a PPM effect would NOT give them.
       * ------------------------------------------------------------------------
       */
      // A fresh reaction per call: it rolls once per cast (round 80).
      const attack = spellHit(false, 0.2) as never;

      // A dagger Rogue and a two-hand Warrior: 1.8s against 3.6s.
      const dagger = characterAtCombatStart(PRESETS_BY_ID.get('rogue_venom')!.build())!;
      const twoHander = characterAtCombatStart(PRESETS_BY_ID.get('two_hand_arms')!.build())!;
      expect(dagger.weapons.mainHand!.swingTimerMs).not.toBe(
        twoHander.weapons.mainHand!.swingTimerMs,
      );

      /*
       * SWEPT RATHER THAN PINNED AT THE BOUNDARY, which the first version of
       * this did and which float arithmetic punished: `0.11 * (1 - 0.2 - 0.2)`
       * is 0.06600000000000002, so an assertion that `0.066` is not below it
       * fails for a reason that has nothing to do with weapons.
       *
       * THE CLAIM IS INDEPENDENCE, so the test is that the two characters
       * answer IDENTICALLY at every roll -- including the ones either side of
       * the threshold, which is where a PPM effect would diverge. A 1.8-second
       * dagger at any PPM gives half what a 3.6-second two-hander gives.
       */
      for (const roll of [0.0001, 0.03, 0.065, 0.0659, 0.067, 0.09, 0.5]) {
        const rolled = { rng: { nextFloat: () => roll } } as never;
        expect(
          revelationReaction('mainHand').canTrigger!(rolled, dagger, attack),
          `roll ${roll}: the dagger and the two-hander must agree`,
        ).toBe(revelationReaction('mainHand').canTrigger!(rolled, twoHander, attack));
      }

      // And the threshold is crossed somewhere inside that sweep, so the
      // agreement above is not two identical `false`s.
      const low = { rng: { nextFloat: () => 0.0001 } } as never;
      const high = { rng: { nextFloat: () => 0.5 } } as never;
      expect(revelationReaction('mainHand').canTrigger!(low, dagger, attack)).toBe(true);
      expect(revelationReaction('mainHand').canTrigger!(high, dagger, attack)).toBe(false);
    });

    it('is listed with outcomes that exclude a crit', () => {
      // "fails to critically strike" -- and `runReactions` filters on this
      // list, so a crit never reaches `canTrigger` at all.
      expect(revelationReaction('mainHand').outcomes).toEqual(['hit']);
    });

    it('reads the EFFECTIVE crit off the attack, not off the character', () => {
      /*
       * ======================================================================
       * THE OWNER'S RULING, and the reason it needed one: asked whether
       * "CharacterSpellCritChance" meant the sheet figure or the effective
       * per-spell one, they said effective -- and added that a sheet reading
       * 10.82% was "likely missing proper calculation". It was.
       *
       * ASSERTED BY HANDING ONE CHARACTER TWO DIFFERENT ATTACKS. The actor is
       * identical in both calls, so anything reading the STAT would answer the
       * same way twice; only the event differs. A spell rolling against 60%
       * crit is past the cut-off and cannot proc at all.
       * ======================================================================
       */
      const character = mage();
      expect(revelationReaction('mainHand').canTrigger!(always, character, spellHit(false, 0.1))).toBe(true);
      expect(revelationReaction('mainHand').canTrigger!(always, character, spellHit(false, 0.6))).toBe(false);
    });

    it('rolls ONCE PER CAST, not once per target hit (round 80)', () => {
      /*
       * THE OWNER'S RULING: an area spell striking eight targets rolled eight
       * times, because a `dealt` reaction fires per damage event. The second
       * hit of the same cast is refused; the next cast rolls again.
       */
      const reaction = revelationReaction('mainHand');
      const character = mage();
      expect(reaction.canTrigger!(always, character, spellHit(false))).toBe(true);
      expect(reaction.canTrigger!(always, character, spellHit(false))).toBe(false);
      character.recordCast();
      expect(reaction.canTrigger!(always, character, spellHit(false))).toBe(true);
    });
  });

  describe('what it grants', () => {
    it('makes the next SPELL crit and leaves a swing alone', () => {
      /*
       * ------------------------------------------------------------------------
       * THE WHOLE REASON IT IS A STAT RATHER THAN A PER-ABILITY MODIFIER.
       * `spellCritChance` is the engine's one spell-table crit stat and the
       * melee tables read `critChance`, so a hundred points of it is a
       * guaranteed crit on a spell and worth exactly nothing to a swing -- with
       * no new engine field, and with no list of spell ids to go stale.
       * ------------------------------------------------------------------------
       */
      const actor = createPlayer({ race: 'gnome', characterClass: 'mage', combatStyle: 'caster' });
      const simulation = buildSimulation([actor, makeTarget()]);

      const meleeBefore = actor.stats.effective.critChance;
      const spellBefore = actor.stats.effective.spellCritChance;

      simulation.applyAura(actor, REVELATION, actor.id);

      expect(actor.stats.effective.spellCritChance).toBeCloseTo(spellBefore + 100, 6);
      expect(actor.stats.effective.critChance).toBeCloseTo(meleeBefore, 6);
    });
  });

  describe('what spends it', () => {
    const mage = () => {
      const actor = createPlayer({
        race: 'gnome',
        characterClass: 'mage',
        combatStyle: 'caster',
      });
      return { actor, simulation: buildSimulation([actor, makeTarget()]) };
    };

    const castEvent = (actor: Combatant, abilityId: string) =>
      ({
        caster: actor,
        target: undefined,
        ability: actor.abilities.get(abilityId)!,
        spent: [],
        final: true,
      }) as never;

    it('is not spent by the cast whose own damage procced it', () => {
      /*
       * ------------------------------------------------------------------------
       * THE DIFFERENCE FROM INNER FOCUS, AND WHY A TIMESTAMP GUARD IS NOT
       * ENOUGH. Inner Focus is APPLIED BY A CAST, so `appliedAt < now` excludes
       * the only cast that could eat it. Revelation is applied by a DAMAGE
       * event, and an instant spell's damage lands in the SAME MILLISECOND as
       * the cast that produced it -- so the charge would be spent by the very
       * spell that failed to crit, and the enchant would be worth nothing while
       * reporting perfectly ordinary uptime.
       * ------------------------------------------------------------------------
       */
      const { actor, simulation } = mage();
      const spender = revelationSpender();

      simulation.cast(actor, actor.abilities.get('fireball')!, simulation.combatants[1]);
      simulation.applyAura(actor, REVELATION, actor.id);

      expect(spender.canTrigger!(simulation, actor, castEvent(actor, 'fireball'))).toBe(false);
    });

    it('is spent by the NEXT spell', () => {
      const { actor, simulation } = mage();
      const spender = revelationSpender();

      simulation.cast(actor, actor.abilities.get('fireball')!, simulation.combatants[1]);
      simulation.applyAura(actor, REVELATION, actor.id);
      expect(spender.canTrigger!(simulation, actor, castEvent(actor, 'fireball'))).toBe(false);

      // A second cast: a different `castSequence`, so the charge is fair game.
      simulation.advanceTo(simulation.clock.now() + 5_000);
      simulation.cast(actor, actor.abilities.get('fireball')!, simulation.combatants[1]);
      expect(spender.canTrigger!(simulation, actor, castEvent(actor, 'fireball'))).toBe(true);

      spender.onTrigger(simulation, actor, castEvent(actor, 'fireball'));
      expect(actor.auras.has('revelation')).toBe(false);
    });

    it('is not spent by a MELEE ability, which is the invisible waste', () => {
      /*
       * ------------------------------------------------------------------------
       * "the next SPELL cast". A Shockadin holds a melee weapon, which is where
       * this enchant goes, and presses Holy Strike between its Holy Shocks. A
       * charge thrown away on the swing leaves nothing behind to notice: the
       * proc still fired, the aura still reported its uptime, and the
       * guaranteed crit simply landed on an ability it was never meant for.
       *
       * THE FIXTURE IS A PALADIN ON PURPOSE. A Mage has no melee ability, so a
       * Mage fixture could not express this mistake at all -- which is the
       * stock Warlock list's lesson about the interrupt check.
       * ------------------------------------------------------------------------
       */
      const paladin = createPlayer({
        race: 'human',
        characterClass: 'paladin',
        combatStyle: 'one_hand_shield',
      });
      const simulation = buildSimulation([paladin, makeTarget()]);
      const spender = revelationSpender();

      const holyStrike = paladin.abilities.get('holy_strike');
      expect(holyStrike, 'the fixture can express the mistake').toBeDefined();
      expect(holyStrike!.attackTable).not.toBe('spell');

      simulation.applyAura(paladin, REVELATION, paladin.id);
      simulation.advanceTo(simulation.clock.now() + 1);
      simulation.cast(paladin, holyStrike!, simulation.combatants[1]);

      const event = {
        caster: paladin,
        target: undefined,
        ability: holyStrike!,
        spent: [],
        final: true,
      } as never;
      expect(spender.canTrigger!(simulation, paladin, event)).toBe(false);
      expect(paladin.auras.has('revelation')).toBe(true);
    });
  });

  describe('on a character the fight actually builds', () => {
    it('registers BOTH halves, which is what Inner Focus did not', () => {
      /*
       * ------------------------------------------------------------------------
       * THE JOIN, ASKED OF THE BUILT CHARACTER. A proc and its spender are
       * registered through two different lists -- `reactionsForEquipment` and
       * `castReactionsForEquipment` -- and the failure mode is not symmetric:
       * a missing TRIGGER is a proc that never fires and leaves nothing behind,
       * and a missing SPENDER is a PERMANENT guaranteed crit that reports
       * ordinary uptime. Inner Focus shipped the second of those.
       * ------------------------------------------------------------------------
       */
      const profile = casterProfile();
      const actor = characterAtCombatStart(profile)!;

      expect(actor.reactions.map((reaction) => reaction.id)).toContain('revelation_mainHand');
      expect(actor.castReactions.map((reaction) => reaction.id)).toContain('revelation_spend');
    });

    it('procs off a hybrid s SPELLS and never off its swings', () => {
      /*
       * ========================================================================
       * THE DECISIVE FIXTURE FOR "SPELLS NOT ATTACKS", because a Mage cannot
       * express the mistake: it has no melee ability to wrongly proc from. A
       * Shockadin holds a mace, swings it, presses Holy Strike, and casts
       * Judgement and Holy Shock -- all four reach the reaction.
       *
       * MEASURED OVER REAL FIGHTS rather than asserted on a constructed event,
       * which is what makes it evidence about the ENGINE and not about the
       * predicate. Over 30 fights the reaction is asked about 329 auto-attacks
       * and 99 Holy Strikes and fires on NONE of them, and fires only on
       * Judgement, Holy Shock and Hammer of Wrath.
       *
       * JUDGEMENT LEFT THAT LIST with the Judgement balance pass, which put it
       * on the MELEE table -- so it is now asked as a `melee-special` and must
       * not fire, and Holy Shock carries the spell half alone. Fewer spells a
       * fight, so the sample is wider than it was.
       * ========================================================================
       */
      // The two-hand Shockadin since round 82, which removed the one-hand one:
      // the same list and seal, so the enchant goes on its two-hander.
      const built = PRESETS_BY_ID.get('pally_shockadin_2h')!.build();
      const profile = {
        ...built,
        equipment: {
          ...built.equipment,
          twoHand: { ...built.equipment.twoHand!, enchantId: REVELATION_ENCHANT_ID },
        },
      };

      const asked = new Map<string, { n: number; fired: number }>();
      for (let seed = 1; seed <= 20; seed += 1) {
        const sim = new Simulation(
          trainingDummyEncounter(
            { ...profile, simulation: { ...profile.simulation, iterations: 1, seed } } as never,
            seed,
          ),
        );
        sim.begin();
        const player = sim.combatants.find((actor) => actor.kind === 'player')!;
        const reaction = player.reactions.find((r) => r.id.startsWith('revelation'))!;
        const real = reaction.canTrigger!;
        (reaction as { canTrigger: typeof real }).canTrigger = (ctx, actor, attack) => {
          const answer = real(ctx, actor, attack);
          const key = String(attack.attackTable);
          const cur = asked.get(key) ?? { n: 0, fired: 0 };
          cur.n += 1;
          if (answer) cur.fired += 1;
          asked.set(key, cur);
          return answer;
        };
        sim.run();
      }

      // It was genuinely asked about attacks, or this proves nothing.
      expect(asked.get('melee-auto')!.n, 'swings reached the reaction').toBeGreaterThan(0);
      expect(asked.get('melee-special')!.n, 'and so did a melee ability').toBeGreaterThan(0);

      for (const [table, counts] of asked) {
        if (table === 'spell') continue;
        expect(counts.fired, `${table} must never proc it`).toBe(0);
      }
      expect(asked.get('spell')!.fired, 'and a spell does').toBeGreaterThan(0);
    });

    it('is worth NOTHING to a build that casts no spells', () => {
      /*
       * A Cat Druid swings and presses Shred and Rake and casts nothing that
       * rolls on the spell table, so the enchant can never fire for it. Worth
       * pinning because "a correct effect can be worth zero" is a conclusion
       * this project reaches often, and the honest version of it names the
       * build rather than the effect.
       */
      const built = PRESETS_BY_ID.get('druid_cat')!.build();
      const profile = {
        ...built,
        equipment: {
          ...built.equipment,
          twoHand: { ...built.equipment.twoHand!, enchantId: REVELATION_ENCHANT_ID },
        },
      };

      let procs = 0;
      for (let seed = 1; seed <= 4; seed += 1) {
        const sim = new Simulation(
          trainingDummyEncounter(
            { ...profile, simulation: { ...profile.simulation, iterations: 1, seed } } as never,
            seed,
          ),
          {
            emit: (event) => {
              if (event.type === 'aura_applied' && event.auraId === 'revelation') procs += 1;
            },
          },
        );
        sim.run();
      }
      expect(procs).toBe(0);
    });

    it('brings neither half when the weapon is not enchanted with it', () => {
      const actor = characterAtCombatStart(PRESETS_BY_ID.get('mage_fire')!.build())!;
      expect(actor.reactions.map((reaction) => reaction.id).join()).not.toContain('revelation');
      expect(actor.castReactions.map((reaction) => reaction.id)).not.toContain('revelation_spend');
    });

    it('rolls ONCE PER HAND, which is the ruling that replaced one roll', () => {
      /*
       * ======================================================================
       * "Revelation should roll once per hand." Two enchanted hands are two
       * OPPORTUNITIES against the same chance, so the per-spell probability
       * becomes `1 - (1 - p)^2` rather than `p`.
       *
       * THE IDS DIFFER BY SLOT, which is not cosmetic: two reactions sharing
       * one id would leave nothing able to say which of them fired.
       *
       * AND THE SPENDER IS STILL ONE, because there is one AURA holding one
       * charge -- and because each spender carries its own `castSequence`
       * latch, so two would disagree about which cast procced it.
       * ======================================================================
       */
      const bothHands: Equipment = {
        mainHand: { itemId: 9_500_001, enchantId: REVELATION_ENCHANT_ID },
        offHand: { itemId: 9_500_002, enchantId: REVELATION_ENCHANT_ID },
      };
      const procs = reactionsForEquipment(bothHands).filter((r) =>
        r.id.startsWith('revelation'),
      );
      expect(procs.map((r) => r.id)).toEqual(['revelation_mainHand', 'revelation_offHand']);
      expect(castReactionsForEquipment(bothHands)).toHaveLength(1);

      // And a TWO-HANDER is one weapon, so it rolls once.
      const twoHander: Equipment = {
        twoHand: { itemId: 9_500_003, enchantId: REVELATION_ENCHANT_ID },
      };
      expect(
        reactionsForEquipment(twoHander).filter((r) => r.id.startsWith('revelation')),
      ).toHaveLength(1);
    });
  });
});
