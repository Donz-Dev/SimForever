import { describe, expect, it } from 'vitest';
import { ALL_RACIAL_ABILITY_IDS } from '../../src/game/rotations/racialCooldowns';
import { ROGUE_COMBAT } from '../../src/game/rotations/rogue';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { MAX_COMBO_POINTS } from '../../src/game/combat/comboPoints';
import { runProfileBatch } from '../../src/simulator';

/*
 * ============================================================================
 * THE COMBAT LIST, AS THE RULESET OWNER SPECIFIED IT.
 *
 * Written out BY HAND from the panel they sent, the shape the other four list
 * files use. It pins a rotation decision on purpose, and this list is the
 * second Rogue one in a row where the owner has overturned a MEASURED choice
 * of ours -- see the Eviscerate gate below.
 * ============================================================================
 */

/** Every entry the list declares, including what narrows away per preset. */
const OWNER_ORDER = [
  // THISTLE TEA ABOVE THE RACIALS, and the rest of its own row below them.
  'thistle_tea',
  'blood_fury',
  'berserking',
  'elunes_light',
  'eureka',
  'major_mana_potion',
  'demonic_rune',
  'mighty_rage_potion',
  'major_spellblasting_potion',
  // THE FRENZY POTION LEFT THE SHARED ROW at round 37 and sits below it, gated
  // on Slice and Dice and Adrenaline Rush both being up -- the owner's words.
  'major_frenzy_potion',
  'major_healing_potion',
  'healthstone',
  'adrenaline_rush',
  'blade_flurry',
  'slice_and_dice',
  // Cold Blood paired with a five-point Eviscerate, as one sequence (round 37).
  'cold_blood',
  'eviscerate',
  'sinister_strike',
];

/** The nine an ORC drinking Thistle Tea and a Frenzy Potion actually runs. */
const COMBAT_ORDER = [
  'thistle_tea',
  // Gnome since round 78, so Eureka! is the racial lit where Blood Fury was.
  'eureka',
  'major_frenzy_potion',
  'adrenaline_rush',
  'blade_flurry',
  'slice_and_dice',
  // Cold Blood paired with a five-point Eviscerate, as one sequence (round 37).
  'cold_blood',
  'eviscerate',
  'sinister_strike',
];

const entryFor = (abilityId: string) => {
  const found = ROGUE_COMBAT.entries.find((entry) => entry.abilityId === abilityId);
  if (!found) throw new Error(`${abilityId} is not in the Combat list`);
  return found;
};

let cached: ReturnType<typeof runProfileBatch> | undefined;
/** One small memoised batch; see `venomRotation.test.ts` for why it is small. */
const combat = () => {
  if (!cached) {
    const built = PRESETS_BY_ID.get('rogue_combat')!.build();
    cached = runProfileBatch({
      ...built,
      simulation: { ...built.simulation, iterations: 60, seed: 4242 },
    } as never);
  }
  return cached;
};

/**
 * The entries a person sees LIT in the panel: every entry except another race's
 * racial, which is now kept and switched off rather than dropped -- see
 * `racialsForRace`. Recklessness stays in, switched off or not, because it is
 * off by the owner's choice and not by race.
 */
const lit = (entries: readonly { abilityId: string; disabled?: boolean }[]) =>
  entries.filter((e) => !(e.disabled && ALL_RACIAL_ABILITY_IDS.has(e.abilityId)));

describe('the Combat list', () => {
  it('is in the order the ruleset owner gave', () => {
    expect(ROGUE_COMBAT.entries.map((entry) => entry.abilityId)).toEqual(OWNER_ORDER);
  });

  it('narrows to the nine entries the owner can see', () => {
    expect(
      lit(PRESETS_BY_ID.get('rogue_combat')!.build().rotation.entries).map((e) => e.abilityId),
    ).toEqual(COMBAT_ORDER);
  });

  it('puts Thistle Tea above the racials and the rest of its row below them', () => {
    /*
     * THE SPLIT IS THE SHAPE OF THE EDIT. Thistle Tea moved from third to
     * first and Blood Fury and the Frenzy Potion stayed exactly where they
     * were relative to each other -- one entry dragged to the top, nothing
     * else touched. Reordering the whole group would have been a different
     * list.
     */
    const ids = ROGUE_COMBAT.entries.map((entry) => entry.abilityId);
    expect(ids.indexOf('thistle_tea')).toBe(0);
    expect(ids.indexOf('blood_fury')).toBeLessThan(ids.indexOf('major_frenzy_potion'));
  });

  it('spends the FULL five on Eviscerate, with no Slice and Dice floor', () => {
    /*
     * ==========================================================================
     * BOTH HALVES REVERSE A MEASURED DECISION, AND THE SWEEP IS WORTH KEEPING.
     * Sweeping the point gate over every count gave 577.7, 588.5, 587.2, 580.6,
     * 572.2 for one through five -- so TWO was the peak and FIVE was the worst
     * cell, 16.3 below it. The old entry also held a nine-second floor on Slice
     * and Dice, which is gone.
     *
     * THE SWEEP IS TRUE OF THE BUILD IT WAS RUN ON. It predates the benchmark
     * gear, the racials, and Hack and Slash paying this build its off-hand
     * dagger's 5% crit -- which is +32.5 on this profile alone.
     *
     * AND IT IS THE OWNER'S CALL EITHER WAY: their list outranks a measured
     * decision of ours, and the measurement becomes the PRICE of the choice.
     * ==========================================================================
     */
    expect(entryFor('eviscerate').condition).toEqual({
      kind: 'comboPoints',
      compare: 'atLeast',
      points: MAX_COMBO_POINTS,
    });
    expect(JSON.stringify(entryFor('eviscerate').condition)).not.toContain('slice_and_dice');
  });

  it('keeps Slice and Dice on "if not active" at three points', () => {
    // Unchanged by the respecification: only its POSITION moved, from first to
    // sixth. The refresh-window alternative was measured and rejected.
    expect(entryFor('slice_and_dice').condition).toEqual({
      kind: 'all',
      of: [
        { kind: 'auraTime', on: 'self', auraId: 'slice_and_dice', compare: 'atMost', seconds: 0 },
        { kind: 'comboPoints', compare: 'atLeast', points: 3 },
      ],
    });
  });

  it('puts both cooldowns above everything that spends energy', () => {
    const ids = ROGUE_COMBAT.entries.map((entry) => entry.abilityId);
    for (const spender of ['slice_and_dice', 'eviscerate', 'sinister_strike']) {
      expect(ids.indexOf('adrenaline_rush'), spender).toBeLessThan(ids.indexOf(spender));
      expect(ids.indexOf('blade_flurry'), spender).toBeLessThan(ids.indexOf(spender));
    }
  });

  it('fires every entry the preset can reach', () => {
    /*
     * THE INVARIANT, AND IT IS THE ONE AT RISK HERE. Eviscerate moved from two
     * points to five, which is exactly the kind of tightening that produced a
     * 0.0-cast entry on the Venom list -- so the thing to check is that the
     * tightening did not take it out of reach.
     */
    const batch = combat();
    const uses = (name: string) =>
      batch.abilities.find((row) => row.abilityName === name)?.uses ?? 0;
    for (const name of [
      'Thistle Tea',
      'Eureka!',
      'Adrenaline Rush',
      'Blade Flurry',
      'Slice and Dice',
      'Eviscerate',
      'Sinister Strike',
    ]) {
      expect(uses(name), name).toBeGreaterThan(0);
    }
  });
});

describe('what the Combat Rogue drinks', () => {
  it('eats +20 Agility rather than +40 Attack Power', () => {
    expect(PRESETS_BY_ID.get('rogue_combat')!.build().consumables.food).toBe('food_agility');
  });

  it('leaves the two unnamed members of the agility row alone', () => {
    /*
     * THREE OF FIVE NAMED NOW -- Venom, Combat and Rupture, all on agility.
     * The Hemo Rogue and the melee Hunter are what is left, and the moment the
     * Hemo Rogue is named too the question becomes whether the ROW should move:
     * four of five agreeing is still not five, because the melee Hunter shares
     * it and has not been spoken about.
     */
    for (const id of ['rogue_hemo', 'lw_melee']) {
      expect(PRESETS_BY_ID.get(id)!.build().consumables.food, id).toBe('food_attack_power');
    }
  });
});
