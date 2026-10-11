import { describe, expect, it } from 'vitest';
import { ROGUE_VENOM } from '../../src/game/rotations/rogue';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { COLD_BLOOD_ABILITY } from '../../src/game/abilities/rogue';
import { runProfileBatch } from '../../src/simulator';

/*
 * ============================================================================
 * THE VENOM LIST, AS THE RULESET OWNER SPECIFIED IT.
 *
 * Written out BY HAND from the panel they sent rather than read back out of
 * the list under test, the shape `protectionRotation.test.ts`,
 * `armsRotation.test.ts` and `berserkerRotation.test.ts` already use.
 *
 * IT PINS A ROTATION DECISION ON PURPOSE, and this list is the sharpest case
 * for why that is right: the previous version was ALSO measured, and two of
 * its decisions -- Rupture in, Eviscerate out -- are reversed here. A
 * measurement of ours does not outrank the owner, and the day they respecify
 * it again this failing is how that gets noticed.
 * ============================================================================
 */

/** Every entry the list declares, including the groups that narrow to nothing. */
const OWNER_ORDER = [
  // The mid-fight consumables OPEN this list, which is new.
  'major_mana_potion',
  'demonic_rune',
  'thistle_tea',
  'mighty_rage_potion',
  'major_frenzy_potion',
  'major_spellblasting_potion',
  // Neither of the next two groups is drawn for the preset: a Venom Rogue is
  // Undead and drinks Thistle Tea rather than a Healthstone.
  'blood_fury',
  'berserking',
  'elunes_light',
  'eureka',
  'major_healing_potion',
  'healthstone',
  'slice_and_dice',
  'venom',
  'cold_blood',
  'eviscerate',
  'mutilate',
];

/** The seven the owner's screenshot actually shows. */
const VENOM_ORDER = [
  'thistle_tea',
  'major_frenzy_potion',
  'slice_and_dice',
  'venom',
  'cold_blood',
  'eviscerate',
  'mutilate',
];

const entryFor = (abilityId: string) => {
  const found = ROGUE_VENOM.entries.find((entry) => entry.abilityId === abilityId);
  if (!found) throw new Error(`${abilityId} is not in the Venom list`);
  return found;
};

/**
 * ONE BATCH, MEMOISED, AND DELIBERATELY SMALL.
 *
 * ----------------------------------------------------------------------------
 * EVERY QUESTION THIS FILE ASKS OF A FIGHT IS "does this fire at all", which is
 * a question sixty iterations answer as well as three hundred -- `uses` is a
 * MEAN PER FIGHT, so more iterations buy a tighter mean and nothing else.
 *
 * THE FIRST VERSION RAN THREE BATCHES OF 200, 200 AND 40 AND COST 7.5 SECONDS,
 * which made it the heaviest file in the suite -- and `chargeAndShieldTalents`
 * timed out on the run that added it. That file is a documented flake under
 * load (it takes 1.6s alone against a 5s limit), so this is not proof of cause;
 * it is a reason not to spend seven seconds asking a question worth one.
 * ----------------------------------------------------------------------------
 */
let batch: ReturnType<typeof runProfileBatch> | undefined;
const venom = () => {
  if (!batch) {
    const built = PRESETS_BY_ID.get('rogue_venom')!.build();
    batch = runProfileBatch({
      ...built,
      simulation: { ...built.simulation, iterations: 60, seed: 4242 },
    } as never);
  }
  return batch;
};

describe('the Venom list', () => {
  it('is in the order the ruleset owner gave', () => {
    expect(ROGUE_VENOM.entries.map((entry) => entry.abilityId)).toEqual(OWNER_ORDER);
  });

  it('narrows to the seven entries the owner can see', () => {
    expect(PRESETS_BY_ID.get('rogue_venom')!.build().rotation.entries.map((e) => e.abilityId)).toEqual(
      VENOM_ORDER,
    );
  });

  it('carries no Rupture at all', () => {
    /*
     * ==========================================================================
     * THE REVERSAL, ASSERTED RATHER THAN IMPLIED BY AN ORDER.
     *
     * Rupture was measured INTO this list at +16.7 and was there because the
     * build's combo points were overflowing -- about 28.5 gained a fight with
     * 7.21 wasted at the cap. The overflow is real and the owner has given it a
     * different outlet: Eviscerate, at three points instead of the five its old
     * gate asked for.
     *
     * So the half of the old argument that had to survive -- that the points go
     * SOMEWHERE -- is asserted next door by Eviscerate actually firing.
     * ==========================================================================
     */
    expect(ROGUE_VENOM.entries.some((entry) => entry.abilityId === 'rupture')).toBe(false);
  });

  it('gates Slice and Dice at ONE point and everything else at three', () => {
    /*
     * THE ASYMMETRY IS THE DESIGN. Slice and Dice is a MAINTENANCE buff, so
     * what matters is uptime rather than duration and the cheapest cast that
     * keeps it up is the right one. Everything else is damage, and damage
     * waits for points.
     */
    expect(entryFor('slice_and_dice').condition).toEqual({
      kind: 'all',
      of: [
        { kind: 'auraTime', on: 'self', auraId: 'slice_and_dice', compare: 'atMost', seconds: 0 },
        { kind: 'comboPoints', compare: 'atLeast', points: 1 },
      ],
    });
    for (const id of ['venom', 'cold_blood', 'eviscerate']) {
      const condition = JSON.stringify(entryFor(id).condition);
      expect(condition, id).toContain('"comboPoints","compare":"atLeast","points":3');
    }
  });

  it('holds both finishers behind a three-second FLOOR on the two buffs', () => {
    /*
     * A FLOOR, NOT A REFRESH WINDOW -- the opposite polarity, and it reads
     * almost the same. Spend on damage only while both buffs have plenty of
     * time left, so a finisher never lands with Slice and Dice about to drop.
     */
    for (const id of ['cold_blood', 'eviscerate']) {
      const condition = JSON.stringify(entryFor(id).condition);
      for (const auraId of ['slice_and_dice', 'venom']) {
        expect(condition, `${id}/${auraId}`).toContain(
          `"auraId":"${auraId}","compare":"atLeast","seconds":3`,
        );
      }
    }
  });

  it('asks Cold Blood for the energy the Eviscerate beneath it costs', () => {
    // Cold Blood is free, so the 35 is not its own cost -- it is the cost of
    // what it is being saved for. See `VENOM_COLD_BLOOD_ENERGY`.
    expect(JSON.stringify(entryFor('cold_blood').condition)).toContain(
      '"resource":"energy","compare":"atLeast","amount":35',
    );
  });
});

describe('Cold Blood takes no global cooldown', () => {
  /*
   * ============================================================================
   * THE OWNER ASKED FOR THIS AND IT WAS ALREADY TRUE, which is the result
   * rather than a disappointment -- and it is load-bearing for the list above
   * in a way it was not for the previous one.
   *
   * BEING OFF THE GCD MEANS ONE THING: the ability does not START one. So the
   * Eviscerate directly beneath Cold Blood is the next thing out, and takes the
   * guaranteed crit. An entry above a finisher that DID cost a global would
   * push that finisher a cast later and aim the crit at whatever came next
   * instead -- a smaller number, and no error anywhere.
   *
   * IT STILL COSTS ONE 100ms POLL, which is not nothing and is not a global.
   * See the second test for the band and why it is the band that is asserted.
   *
   * PINNED ON THE BEHAVIOUR AS WELL AS THE DECLARATION, because a flag nothing
   * reads is the shape this project keeps paying for.
   * ============================================================================
   */
  it('declares it', () => {
    expect(COLD_BLOOD_ABILITY.triggersGcd).toBe(false);
  });

  it('is followed by the Eviscerate it was saved for, one poll later', () => {
    /*
     * ==========================================================================
     * READ OFF THE EVENT STREAM rather than asserted on the flag: "does not
     * start a global cooldown" is a claim about what can happen NEXT, and the
     * only honest check is that the next thing did.
     *
     * ONE ROTATION POLL, NOT ZERO, AND THAT IS THE DOCUMENTED PRICE OF A FREE
     * OFF-GCD CAST. The actor is left FREE after casting Cold Blood, so
     * `nextDecisionTime` returns `now + ROTATION_POLL_MS` and the Eviscerate
     * lands 100ms later -- the same 100ms Charge and the four racial cooldowns
     * already pay, and about 0.17% of a fight.
     *
     * WHAT MATTERS IS THAT IT IS A POLL AND NOT A GLOBAL. A global cooldown
     * would push the finisher ~1,000ms out and the guaranteed crit would land
     * on whatever the list reached first instead -- a smaller number with
     * nothing on the page to say so. The assertion is the BAND, because that is
     * the distinction the owner's gate depends on.
     * ==========================================================================
     */
    const batch = venom();
    const casts = batch.representative.timeline.filter((event) => event.type === 'cast');
    const coldBloods = casts.filter((event) => event.type === 'cast' && event.abilityId === 'cold_blood');
    expect(coldBloods.length, 'Cold Blood never fired, so this proves nothing').toBeGreaterThan(0);

    for (const coldBlood of coldBloods) {
      const next = casts.find((event) => event.timestamp >= coldBlood.timestamp && event !== coldBlood);
      expect(next, 'nothing followed Cold Blood').toBeDefined();
      expect(next!.type === 'cast' && next!.abilityId, 'what followed Cold Blood').toBe('eviscerate');
      const gap = next!.timestamp - coldBlood.timestamp;
      expect(gap, 'Cold Blood to Eviscerate').toBeLessThanOrEqual(100);
    }
  });
});

describe('every entry in the list fires', () => {
  /*
   * ============================================================================
   * THE INVARIANT THE PREVIOUS VERSION OF THIS LIST WAS BUILT TO PROTECT, and
   * it is worth keeping across the respecification rather than discarding with
   * the decision it justified.
   *
   * Eviscerate was REMOVED from this list because it fired 0.0 times a fight --
   * "an entry that cannot fire is the single most common rotation bug in this
   * project and the one that hides best: it produces an ordinary DPS figure and
   * an ordinary results page". The owner has put it back with every number
   * loosened, so the thing to check is that the loosening worked.
   * ============================================================================
   */
  it('casts all five of the abilities the preset can reach', () => {
    const batch = venom();
    const uses = (name: string) =>
      batch.abilities.find((row) => row.abilityName === name)?.uses ?? 0;
    for (const name of ['Slice and Dice', 'Venom', 'Cold Blood', 'Eviscerate', 'Mutilate']) {
      expect(uses(name), name).toBeGreaterThan(0);
    }
  });

  it('casts Eviscerate far more than the 0.3 a fight that got it removed', () => {
    const batch = venom();
    const eviscerate = batch.abilities.find((row) => row.abilityName === 'Eviscerate');
    expect(eviscerate?.uses ?? 0).toBeGreaterThan(2);
  });
});

describe('what the Venom Rogue drinks', () => {
  it('eats +20 Agility rather than +40 Attack Power', () => {
    expect(PRESETS_BY_ID.get('rogue_venom')!.build().consumables.food).toBe('food_agility');
  });

  it('leaves the other four members of the agility row alone', () => {
    /*
     * THE CONTAINMENT CHECK, and the third row it has been written for.
     * `AGILITY_CONSUMABLES` is shared with the other three Rogues and the melee
     * Hunter; the owner has named one of the five.
     */
    for (const id of ['rogue_hemo', 'lw_melee']) {
      expect(PRESETS_BY_ID.get(id)!.build().consumables.food, id).toBe('food_attack_power');
    }
  });

  /*
   * THE THISTLE TEA GATE MAP AND THE NOTE CHECK BOTH MOVED to
   * `consumableCooldownGates.test.ts`, which is where a claim about a SHARED
   * fragment belongs -- the owner has now given THREE different gates (twenty
   * shared, fifteen on Combat, ten here), and a per-list copy of that set means
   * one ruling fails several files and the set has to be edited in each. It is
   * the same move the food row's test made into `consumables.test.ts`.
   */
});
