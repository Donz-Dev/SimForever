import { describe, expect, it } from 'vitest';
import { seconds } from '../../src/engine';
import { runProfile } from '../../src/simulator';
import { critRageMultiplierFor } from '../../src/game/combat/resourceRules';
import {
  RECKLESSNESS_CRIT_BONUS,
  RECKLESSNESS_DURATION_MS,
} from '../../src/game/auras/warrior';
import {
  BATTLE_HEROIC_STRIKE_RAGE,
  BATTLE_SUNDER_REFRESH_WINDOW_MS,
  SLAM_SWING_WINDOW_MS,
  WARRIOR_TWO_HAND_BATTLE,
} from '../../src/game/rotations/warrior';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { withoutUnselectedConsumables } from '../../src/game/rotations/consumableCooldowns';
import { withoutOtherRacials } from '../../src/game/rotations/racialCooldowns';

/*
 * ============================================================================
 * THE 2H ARMS LIST, AS THE RULESET OWNER SPECIFIED IT.
 *
 * Written out BY HAND from what they sent rather than read back out of the
 * list under test -- a test that asks the implementation what the
 * implementation says passes whatever it says, which is the whole reason the
 * two Protection and Berserker lists have a test of this shape.
 *
 * IT PINS A ROTATION DECISION ON PURPOSE, and that is legitimate here for the
 * reason `petsAndHunter.test.ts` records: the decision belongs to the OWNER.
 * A measurement of ours does not outrank it, and the day they respecify the
 * list this failing is the point -- it is how the change gets noticed rather
 * than merged as an accident.
 * ============================================================================
 */

/**
 * THE THREE THINGS THAT MOVED, against the list this replaced.
 *
 *   - HEROIC STRIKE came from below Sunder Armor to above it, and its floor
 *     went 75 to 90. The two had to move together: a cheap entry starves an
 *     expensive one from beneath however high the expensive one sits, so the
 *     threshold is the only thing that makes the position safe.
 *   - OVERPOWER went the other way, from above Sunder Armor to below it.
 *   - SLAM came from LAST to above Mortal Strike.
 */
const OWNER_ORDER = [
  'charge',
  // The four free racial cooldowns, of which an Orc learns one.
  'blood_fury',
  'berserking',
  'elunes_light',
  'eureka',
  // Every mid-fight consumable, of which this profile carries two.
  'major_mana_potion',
  'demonic_rune',
  'thistle_tea',
  'mighty_rage_potion',
  'major_frenzy_potion',
  'major_spellblasting_potion',
  'major_healing_potion',
  'healthstone',
  'bloodrage_cast',
  'battle_stance_cast',
  'battle_shout_cast',
  'heroic_strike',
  'sunder_armor_cast',
  'overpower',
  'rend_cast',
  'slam',
  'mortal_strike',
  'execute',
  'spearing_strike',
  /*
   * AND THE TWO THIS ROUND ADDED, BOTH AT THE BOTTOM -- which is where an
   * entry goes when its whole value depends on NOT taking a global cooldown
   * from something above it. Hamstring is pressed for its procs (+26.74) and
   * Recklessness pays for a stance dance out of a moment the list had nothing
   * castable for (+37.91). Together +57.29. See the list.
   */
  'hamstring',
  'recklessness_cast',
];

/** What an ORC drinking Mighty Rage and a Healthstone actually runs. */
const ORC_ARMS_ORDER = [
  'charge',
  'blood_fury',
  'mighty_rage_potion',
  'healthstone',
  'bloodrage_cast',
  'battle_stance_cast',
  'battle_shout_cast',
  'heroic_strike',
  'sunder_armor_cast',
  'overpower',
  'rend_cast',
  'slam',
  'mortal_strike',
  'execute',
  'spearing_strike',
  'hamstring',
  'recklessness_cast',
];

describe('the 2H Arms list', () => {
  it('is in the order the ruleset owner gave', () => {
    expect(WARRIOR_TWO_HAND_BATTLE.entries.map((entry) => entry.abilityId)).toEqual(OWNER_ORDER);
  });

  it('narrows to seventeen entries for the preset that runs it', () => {
    /*
     * THE PANEL IS WHAT THE OWNER READ, and it shows the NARROWED list: every
     * stock list names all four racial cooldowns and all nine consumables,
     * and a character learns one race's and drinks its own two. Pinning the
     * narrowed order as well is what makes this test comparable to the picture
     * they sent.
     */
    const profile = PRESETS_BY_ID.get('two_hand_arms')!.build();
    expect(profile.rotation.entries.map((entry) => entry.abilityId)).toEqual(ORC_ARMS_ORDER);

    // And the narrowing is the two shared helpers rather than anything this
    // preset does, which is what stops the two lists drifting apart.
    const narrowed = withoutUnselectedConsumables(
      withoutOtherRacials(WARRIOR_TWO_HAND_BATTLE, profile.character.race),
      profile.character.characterClass,
      profile.consumables,
    );
    expect(narrowed.entries.map((entry) => entry.abilityId)).toEqual(ORC_ARMS_ORDER);
  });

  it('dumps surplus rage at 90, which is what makes its position safe', () => {
    /*
     * HEROIC STRIKE IS NOW ABOVE SUNDER ARMOR, MORTAL STRIKE, REND AND SLAM.
     * An ungated entry there would be a floor under all four; what stops it is
     * the threshold, and 90 out of a 100 cap leaves a whole Mortal Strike's 30
     * unaffordable to it -- so the entry can only ever spend rage none of them
     * could have reached.
     *
     * ASSERTED AS A BOUNDARY RATHER THAN AS A NUMBER somewhere else in the
     * file: this is the owner's figure, and what a reader needs to know is
     * that it is the highest floor in the project and why.
     */
    expect(BATTLE_HEROIC_STRIKE_RAGE).toBe(90);

    const heroic = WARRIOR_TWO_HAND_BATTLE.entries.find(
      (entry) => entry.abilityId === 'heroic_strike',
    );
    expect(heroic?.condition).toEqual({
      kind: 'resource',
      resource: 'rage',
      compare: 'atLeast',
      amount: 90,
    });

    const ids = WARRIOR_TWO_HAND_BATTLE.entries.map((entry) => entry.abilityId);
    for (const below of ['sunder_armor_cast', 'mortal_strike', 'rend_cast', 'slam']) {
      expect(ids.indexOf('heroic_strike'), below).toBeLessThan(ids.indexOf(below));
    }
  });

  it('keeps Slam gated on the swing timer at its new position', () => {
    /*
     * MOVING IT UP CHANGED ITS POSITION AND NOT ITS RULE, and the rule is what
     * makes a cast time affordable at all: Slam only fires with more than a
     * second of swing left, so it is refused outright in the window where it
     * would cost a swing. Above Mortal Strike with that gate removed would be
     * the Arms warrior trading its hardest hit for a cast.
     */
    const slam = WARRIOR_TWO_HAND_BATTLE.entries.find((entry) => entry.abilityId === 'slam');
    expect(slam?.condition).toEqual({
      kind: 'swingIn',
      slot: 'mainHand',
      compare: 'above',
      milliseconds: SLAM_SWING_WINDOW_MS,
    });

    const ids = WARRIOR_TWO_HAND_BATTLE.entries.map((entry) => entry.abilityId);
    expect(ids.indexOf('slam')).toBeLessThan(ids.indexOf('mortal_strike'));
  });

  it('refreshes Sunder Armor on its own three-second window, not the tank’s four', () => {
    // Two constants for two owner figures given for two lists. Pinned by
    // IDENTITY rather than by asserting they are equal, so the day one moves
    // the failure lands on the one that moved.
    const sunder = WARRIOR_TWO_HAND_BATTLE.entries.find(
      (entry) => entry.abilityId === 'sunder_armor_cast',
    );
    expect(JSON.stringify(sunder?.condition)).toContain(
      `"seconds":${BATTLE_SUNDER_REFRESH_WINDOW_MS / 1000}`,
    );
    expect(BATTLE_SUNDER_REFRESH_WINDOW_MS).toBe(3000);
  });
});

describe('what 2H Arms eats', () => {
  it('takes +20 Strength rather than +40 Attack Power', () => {
    /*
     * THE OWNER'S RULING, and the one profile it names. For a plate build the
     * two are the same 40 attack power before anything scales them -- strength
     * is 2 attack power a point -- and strength goes through the conversion,
     * so a percentage modifier on the primary reaches it and none reaches a
     * flat pool.
     */
    expect(PRESETS_BY_ID.get('two_hand_arms')!.build().consumables.food).toBe('food_strength');
  });

  it('does not change anything else about what it drinks', () => {
    /*
     * THE ROW-WIDE CLAIM LIVES IN `consumables.test.ts` NOW, under "who eats
     * what, on the plate-and-fur row" -- it is a claim about the consumable
     * ROW rather than about this list, and it was written here AND in
     * `berserkerRotation.test.ts`, so one ruling failed two files and the set
     * of unnamed profiles had to be edited in both. Two copies of a set is how
     * the two drift.
     *
     * WHAT BELONGS HERE is that this profile's override touches the FOOD and
     * nothing else: the Flask, the Blasted Lands elixir and the weapon effect
     * are what make it a plate build and are not what the owner changed.
     */
    const selection = PRESETS_BY_ID.get('two_hand_arms')!.build().consumables;
    expect(selection.blasted_lands).toBe('blasted_strength');
    expect(selection.potion).toBe('mighty_rage_potion');
    expect(selection.other).toBe('healthstone');
  });

  /*
   * ==========================================================================
   * THE STANCE DANCE, WHICH IS THE PART OF RECKLESSNESS THAT CAN BE WRONG.
   *
   * The entry itself is pinned above, in the order. What a test is for is the
   * MECHANISM: Recklessness requires Berserker Stance and this list lives in
   * Battle, so `PriorityRotation` has to cast its way there AND the list's own
   * `battle_stance_cast` entry has to bring it back. Either half missing leaves
   * a warrior that produces an ordinary figure -- stuck in Berserker it simply
   * stops casting Overpower, Rend, Slam and Mortal Strike, every one of which
   * the list skips in silence when the stance is wrong.
   *
   * `battle_stance_cast` FIRING AT ALL IS THE EVIDENCE. It measured 0.00 uses
   * for the life of this list, because the preset opens in Battle and nothing
   * ever moved it; it is about 1.1 a fight now, which is the return leg.
   * ==========================================================================
   */
  describe('the Recklessness stance dance', () => {
    const fight = (seed: number) =>
      runProfile(PRESETS_BY_ID.get('two_hand_arms')!.build(), seed).timeline.filter(
        (event) => event.type === 'cast',
      );

    it('reaches Berserker Stance for it and comes back to Battle', () => {
      for (const seed of [1, 7, 4242]) {
        const ids: string[] = fight(seed)
          .map((event) => (event.type === 'cast' ? event.abilityId : ''))
          .filter((id) => id === 'recklessness_cast' || id === 'battle_stance_cast' || id === 'berserker_stance_cast');

        // It is a thirty-minute cooldown, so once a fight and no more.
        expect(ids.filter((id) => id === 'recklessness_cast').length, `seed ${seed}`).toBe(1);

        // Berserker first, Recklessness inside it, Battle again afterwards.
        const at = (id: string) => ids.indexOf(id);
        expect(at('berserker_stance_cast'), `seed ${seed}`).toBeGreaterThanOrEqual(0);
        expect(at('berserker_stance_cast')).toBeLessThan(at('recklessness_cast'));
        expect(ids.lastIndexOf('battle_stance_cast')).toBeGreaterThan(at('recklessness_cast'));
      }
    });

    it('spends the window at a crit chance nothing else here reaches', () => {
      /*
       * ASSERT THE SIZE OF THE MECHANISM, not only that it is wired up: +100
       * CRIT CHANCE, which for a Warrior is two things at once -- every blow
       * crits, and `critRageMultiplierFor` pays double rage on a critical
       * swing, so the window roughly doubles income as well. A version granting
       * a tenth of this would read as a working cooldown.
       */
      expect(RECKLESSNESS_CRIT_BONUS).toBe(100);
      expect(RECKLESSNESS_DURATION_MS).toBe(seconds(15));
      expect(critRageMultiplierFor('warrior', 'two_hander')).toBe(2);
    });
  });
});
