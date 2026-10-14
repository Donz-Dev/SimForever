import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { buildSimulation } from '../helpers/buildSimulation';
import { legalise } from '../helpers/legalTalents';
import { createDefaultProfile } from '../../src/profiles';
import { runProfile, runProfileBatch, resourceFlowOf } from '../../src/simulator';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import {
  BERSERKER_HEROIC_STRIKE_RAGE,
  SUNDER_REFRESH_WINDOW_MS,
  WARRIOR_DUAL_WIELD_BERSERKER,
  warriorRotation,
} from '../../src/game/rotations/warrior';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import {
  BERSERKER_RAGE,
  BERSERKER_RAGE_DURATION_MS,
  BLOODRAGE_INSTANT_RAGE,
  BLOODRAGE_RAGE_OVER_TIME,
} from '../../src/game/auras/warrior';

/*
 * The dual-wield Berserker priority list, and the stance rules it depends on.
 *
 * The order is the ruleset owner's, written out by hand here rather than read
 * back from the list under test.
 */

// ---------------------------------------------------------------------------
// The shared stance cooldown
// ---------------------------------------------------------------------------

describe('the three stances share one cooldown', () => {
  function fresh() {
    const player = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
    });
    const dummy = createTrainingDummy({ name: 'D', health: 100_000, armor: 0, level: 63 });
    const sim = buildSimulation([player, dummy]);
    sim.begin();
    return { player, sim };
  }

  it('does not trigger the global cooldown', () => {
    // Stated by the ruleset owner, and it was already true. Pinned so it stays
    // true: a stance that cost a global cooldown would make dancing far worse
    // than the rage alone makes it.
    const { player } = fresh();
    expect(player.abilities.get('battle_stance_cast')?.triggersGcd).toBe(false);
    expect(player.abilities.get('defensive_stance_cast')?.triggersGcd).toBe(false);
    expect(player.abilities.get('berserker_stance_cast')?.triggersGcd).toBe(false);
  });

  it('blocks the OTHER two for a second after any of them is used', () => {
    /*
     * The rule the old code did not implement. Each stance had its own one
     * second cooldown, so a warrior could go Berserker to Defensive to Battle
     * without the clock moving -- no two casts were the same ability, so
     * nothing was ever on cooldown.
     */
    const { player, sim } = fresh();
    sim.cast(player, player.abilities.get('defensive_stance_cast')!, undefined);

    const now = sim.clock.now();
    expect(player.abilities.isReady('berserker_stance_cast', now)).toBe(false);
    expect(player.abilities.isReady('battle_stance_cast', now)).toBe(false);
    expect(player.abilities.isReady('defensive_stance_cast', now)).toBe(false);
  });

  it('clears after exactly one second', () => {
    const { player, sim } = fresh();
    sim.cast(player, player.abilities.get('defensive_stance_cast')!, undefined);
    const start = sim.clock.now();

    expect(player.abilities.isReady('battle_stance_cast', start + 999)).toBe(false);
    expect(player.abilities.isReady('battle_stance_cast', start + 1000)).toBe(true);
  });

  it('leaves abilities outside the group alone', () => {
    // A shared cooldown must not leak. Battle Shout has nothing to do with it.
    const { player, sim } = fresh();
    sim.cast(player, player.abilities.get('defensive_stance_cast')!, undefined);
    expect(player.abilities.isReady('battle_shout_cast', sim.clock.now())).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Bloodrage
// ---------------------------------------------------------------------------

describe('Bloodrage', () => {
  /*
   * Spell 2687: "Generates 10 rage at the cost of health, and then generates
   * an additional 10 rage over 10 sec."
   *
   * It was inert, and not for want of a number -- Forever states both halves.
   * The aura had no periodic, so there was nowhere for "over 10 sec" to live.
   */
  it('is ten on cast and ten more over ten seconds', () => {
    expect(BLOODRAGE_INSTANT_RAGE).toBe(10);
    expect(BLOODRAGE_RAGE_OVER_TIME).toBe(10);
  });

  it('actually delivers twenty rage across its duration', () => {
    /*
     * Measured on what Bloodrage GRANTED, not on the bar.
     *
     * Reading `rage.current` ten seconds later measures what the rotation has
     * not spent yet, which on a geared warrior is almost nothing -- the first
     * version of this test read 0.54 and looked like the periodic was broken.
     * The telemetry says what arrived and from where, which is the question.
     */
    const base = createDefaultProfile();
    const batch = runProfileBatch({
      ...base,
      character: { ...base.character, combatStyle: 'dual_wield', stance: 'berserker' },
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
      simulation: { ...base.simulation, iterations: 40, seed: 9, durationSeconds: 60 },
    } as never);

    const bloodrage = resourceFlowOf(batch, 'rage').gained.find((row) => row.sourceId === 'bloodrage');
    expect(bloodrage).toBeDefined();
    /*
     * One cast in a sixty second fight -- it has a sixty second cooldown and
     * sits last in the list -- so twenty rage: ten instant and ten over time.
     * Per iteration, hence the tolerance.
     */
    expect(bloodrage!.amount).toBeGreaterThan(15);
  });
});

// ---------------------------------------------------------------------------
// The list itself
// ---------------------------------------------------------------------------

/**
 * Seconds from a combat log line's "mm:ss.mmm" stamp.
 *
 * MINUTES INCLUDED. Reading the seconds field alone makes 01:05 look like five
 * seconds, which is how the first version of these tests decided Death Wish
 * was being cast at the start of the fight instead of at 65 seconds.
 */
function stampSeconds(line: string): number {
  const match = line.match(/^(\d+):(\d+\.\d+)/);
  if (!match) return NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

describe('dual-wield in Berserker Stance uses its own list', () => {
  it('is selected by style AND stance together', () => {
    expect(warriorRotation('dual_wield', 'berserker').name).toBe(
      'Warrior (Dual-Wield, Berserker)',
    );
    // Any other combination falls back to the general lists.
    expect(warriorRotation('dual_wield', 'battle').name).toBe('Warrior');
    expect(warriorRotation('two_hander', 'berserker').name).toBe('Warrior');
    // A shield in Defensive has its own tank list now.
    expect(warriorRotation('one_hand_shield', 'defensive').name).toBe(
      'Warrior (Shield, Defensive)',
    );
    // A shield OUT of Defensive falls back to the general shield list.
    expect(warriorRotation('one_hand_shield', 'berserker').name).toBe('Warrior (Shield)');
  });

  function fight(talents: Record<string, number> = {}) {
    const base = createDefaultProfile();
    return runProfile({
      ...base,
      character: { ...base.character, combatStyle: 'dual_wield', stance: 'berserker' },
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
      talents,
      simulation: { ...base.simulation, seed: 9, durationSeconds: 100 },
    } as never);
  }

  /*
   * THE POINT OF THE LIST. Every ability in it is usable in Berserker Stance,
   * so a warrior running it never changes stance and never pays the rage.
   * The other lists spend hundreds of rage a fight swapping for Overpower and
   * Rend; this one does not reach for them.
   */
  it('never changes stance', () => {
    const log = fight().combatLog;
    expect(log.some((line) => /casts (Battle|Defensive|Berserker) Stance/.test(line))).toBe(
      false,
    );
  });

  it('casts nothing that would need another stance', () => {
    const log = fight().combatLog;
    // Overpower needs Battle; Rend needs Battle or Defensive. Neither is in
    // the list, so neither should appear however long the fight runs.
    expect(log.some((line) => line.includes('casts Overpower'))).toBe(false);
    expect(log.some((line) => line.includes('casts Rend'))).toBe(false);
  });

  it('opens with Battle Shout and keeps it up without recasting', () => {
    const log = fight().combatLog;
    const shouts = log.filter((line) => line.includes('casts Battle Shout'));
    // Three minutes of buff in a hundred second fight is one cast.
    expect(shouts.length).toBe(1);
  });

  it('builds Sunder Armor to five stacks', () => {
    const log = fight().combatLog;
    expect(log.some((line) => line.includes('Sunder Armor is now at 5 stacks'))).toBe(true);
  });

  it('holds Death Wish for the last 35 seconds', () => {
    const log = fight(legalise({ death_wish: 1 }));
    const cast = log.combatLog.find((line) => line.includes('casts Death Wish'));
    expect(cast).toBeDefined();
    // A hundred second fight, so it must land at or after 65 seconds.
    expect(stampSeconds(cast!)).toBeGreaterThanOrEqual(64);
  });

  it('saves Execute for the last fifth of the fight', () => {
    const log = fight().combatLog;
    const first = log.find((line) => line.includes('casts Execute'));
    expect(first).toBeDefined();
    expect(stampSeconds(first!)).toBeGreaterThanOrEqual(79);
  });

  it('spends surplus rage on Heroic Strike', () => {
    const base = createDefaultProfile();
    const batch = runProfileBatch({
      ...base,
      character: { ...base.character, combatStyle: 'dual_wield', stance: 'berserker' },
      equipment: startingEquipmentFor('warrior', 'dual_wield'),
      simulation: { ...base.simulation, iterations: 60, seed: 9 },
    } as never);
    const heroic = resourceFlowOf(batch, 'rage').spent.find((row) => row.sourceId === 'heroic_strike');
    expect(heroic?.count ?? 0).toBeGreaterThan(0);
    // Nothing was spent changing stance, because nothing changed stance.
    expect(resourceFlowOf(batch, 'rage').spent.some((row) => row.sourceId === 'stance_change')).toBe(false);
  });
});

/*
 * ============================================================================
 * THE ORDER THE RULESET OWNER GAVE, written out BY HAND rather than read back
 * out of the list under test -- a test that asks the implementation what the
 * implementation says passes whatever it says. The same shape
 * `protectionRotation.test.ts` and `armsRotation.test.ts` use.
 *
 * IT PINS A ROTATION DECISION ON PURPOSE, which is legitimate because the
 * decision is the OWNER'S: a measurement of ours does not outrank it, and the
 * day they respecify this list the failure is how that gets noticed rather
 * than merged as an accident.
 * ============================================================================
 */

/** Death Wish is FOURTH now and was eighth; nothing else about it moved. */
const OWNER_ORDER = [
  'bloodrage_cast',
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
  /*
   * RECKLESSNESS ABOVE DEATH WISH, added this round and worth **+94.15** -- it
   * was in this build's book and in no list. Unconditional, because it is free
   * and fires once; gating it to overlap Death Wish measured +87.33.
   */
  'recklessness_cast',
  'death_wish',
  'major_healing_potion',
  'healthstone',
  'berserker_stance_cast',
  'battle_shout_cast',
  'sunder_armor_cast',
  'execute',
  'heroic_strike',
  'bloodthirst',
  'whirlwind',
  'spearing_strike',
  /*
   * BERSERKER RAGE LAST, which closes the Warrior's last live gap -- a LIST
   * cause, not an engine one. Worth +6.02 WITH Improved Berserker Rage and
   * -1.13 without it; see `DW_FURY_TALENTS`.
   */
  'berserker_rage_cast',
];

/** What an ORC drinking Mighty Rage and a Healthstone actually runs. */
const ORC_FURY_ORDER = [
  'bloodrage_cast',
  'blood_fury',
  'mighty_rage_potion',
  'recklessness_cast',
  'death_wish',
  'healthstone',
  'berserker_stance_cast',
  'battle_shout_cast',
  'sunder_armor_cast',
  'execute',
  'heroic_strike',
  'bloodthirst',
  'whirlwind',
  'spearing_strike',
  'berserker_rage_cast',
];

describe('the Berserker list order', () => {
  it('is the order the ruleset owner gave', () => {
    expect(WARRIOR_DUAL_WIELD_BERSERKER.entries.map((entry) => entry.abilityId)).toEqual(
      OWNER_ORDER,
    );
  });

  it('narrows to fifteen entries for the preset that runs it', () => {
    /*
     * THE PANEL IS WHAT THE OWNER READ, and it shows the NARROWED list: every
     * stock list names all four racial cooldowns and all nine consumables, and
     * a character learns one race's and drinks its own two.
     */
    const profile = PRESETS_BY_ID.get('dw_fury')!.build();
    expect(profile.rotation.entries.map((entry) => entry.abilityId)).toEqual(ORC_FURY_ORDER);
  });

  it('puts Death Wish above four entries that never fire, and above Execute', () => {
    /*
     * ==========================================================================
     * WHY THE MOVE CHANGES NOTHING, ASSERTED RATHER THAN STATED.
     *
     * Death Wish came from EIGHTH, directly above Execute, to FOURTH. The four
     * entries it passed are all inert on this profile and each for its own
     * reason: the Healthstone needs health nothing takes, the stance is the one
     * the preset opens in, Battle Shout is in `PRESET_RAID_BUFFS` so its
     * condition refuses all fight, and a preset raid DEBUFF puts five stacks of
     * Sunder Armor on the boss before the pull.
     *
     * So the entry Death Wish is really above is STILL Execute, which is where
     * it already was -- and `rotation_fingerprint.ts` says the same thing from
     * the other end, with all 75 combat-log hashes unchanged.
     *
     * THE FOUR REASONS BELONG TO THE ENCOUNTER AND THE RAID RATHER THAN TO THE
     * ABILITIES, which is why this is pinned as "inert on this profile" and not
     * as a property of the list: change the raid buff selection, or let the
     * target swing back, and three of the four wake up.
     * ==========================================================================
     */
    const ids = WARRIOR_DUAL_WIELD_BERSERKER.entries.map((entry) => entry.abilityId);
    for (const passed of [
      'healthstone',
      'berserker_stance_cast',
      'battle_shout_cast',
      'sunder_armor_cast',
      'execute',
    ]) {
      expect(ids.indexOf('death_wish'), passed).toBeLessThan(ids.indexOf(passed));
    }

    const built = PRESETS_BY_ID.get('dw_fury')!.build();
    const batch = runProfileBatch({
      ...built,
      simulation: { ...built.simulation, iterations: 40, seed: 4242 },
    } as never);
    const uses = (name: string) =>
      batch.abilities.find((row) => row.abilityName === name)?.uses ?? 0;
    for (const name of ['Healthstone', 'Berserker Stance', 'Battle Shout', 'Sunder Armor']) {
      expect(uses(name), name).toBe(0);
    }
    // And Death Wish itself does fire, so this is not four zeros and a fifth.
    expect(uses('Death Wish')).toBeGreaterThan(0);
  });

  it('keeps its own Heroic Strike floor and its own Sunder window', () => {
    /*
     * 42, against the Arms list's 90 and the tank's 26 -- three owner figures
     * for three lists. Pinned by IDENTITY rather than by asserting any two are
     * equal, so the day one moves the failure lands on the one that moved.
     */
    const heroic = WARRIOR_DUAL_WIELD_BERSERKER.entries.find(
      (entry) => entry.abilityId === 'heroic_strike',
    );
    expect(heroic?.condition).toEqual({
      kind: 'resource',
      resource: 'rage',
      compare: 'atLeast',
      amount: BERSERKER_HEROIC_STRIKE_RAGE,
    });
    expect(BERSERKER_HEROIC_STRIKE_RAGE).toBe(42);
    expect(SUNDER_REFRESH_WINDOW_MS).toBe(4000);
  });
});

describe('what DW Fury eats', () => {
  it('takes +20 Strength rather than +40 Attack Power', () => {
    // The owner's second food ruling, named one profile at a time.
    expect(PRESETS_BY_ID.get('dw_fury')!.build().consumables.food).toBe('food_strength');
  });

  it('does not change anything else about what it drinks', () => {
    /*
     * THE ROW-WIDE CLAIM LIVES IN `consumables.test.ts` NOW -- see
     * `armsRotation.test.ts` for why it stopped being written in two places.
     * What belongs here is that the override touches the FOOD and nothing
     * else.
     */
    const selection = PRESETS_BY_ID.get('dw_fury')!.build().consumables;
    expect(selection.blasted_lands).toBe('blasted_strength');
    expect(selection.potion).toBe('mighty_rage_potion');
    expect(selection.other).toBe('healthstone');
  });
});

describe('the result says which priority list ran', () => {
  /*
   * Someone auditing a build asked why Rend was being cast in Berserker
   * Stance. It was not -- they were on a stale bundle -- but nothing on screen
   * could have told them which of the three Warrior lists had produced the
   * numbers they were reading. Which list runs depends on combat style AND
   * stance together, so it is not derivable from the character sheet.
   */
  function named(style: 'dual_wield' | 'one_hand_shield', stance: 'battle' | 'berserker') {
    const base = createDefaultProfile();
    return runProfileBatch({
      ...base,
      character: { ...base.character, combatStyle: style, stance },
      equipment: startingEquipmentFor('warrior', style),
      simulation: { ...base.simulation, iterations: 2, seed: 1 },
    } as never).rotationName;
  }

  it('names the Berserker list when that is what ran', () => {
    expect(named('dual_wield', 'berserker')).toBe('Warrior (Dual-Wield, Berserker)');
  });

  it('names the general list when the stance changes the answer', () => {
    // Same style, same gear, same everything visible -- different list.
    expect(named('dual_wield', 'battle')).toBe('Warrior');
  });

  /*
   * ==========================================================================
   * BERSERKER RAGE'S RAGE ARRIVING, WHICH IS WHAT THE TALENT WAS WAITING ON.
   *
   * `abilities/warrior.ts` recorded for several releases that Improved
   * Berserker Rage was built and that no profile could show it -- the fourth
   * cause of inert, a LIST and not the engine. The entry is pinned above, in
   * the order; what belongs here is that the ten rage actually lands, because
   * BOTH HALVES ARE SILENT ON THEIR OWN: the talent without an entry granted
   * nothing, and the entry without the talent grants nothing and still spends a
   * global cooldown.
   * ==========================================================================
   */
  describe('Berserker Rage, now that something casts it', () => {
    it('grants the talent ten rage per activation, and is cast more than once', () => {
      const profile = PRESETS_BY_ID.get('dw_fury')!.build();
      expect(profile.talents.improved_berserker_rage).toBe(2);

      const run = runProfile(profile, 4242);
      const casts = run.timeline.filter(
        (event) => event.type === 'cast' && event.abilityId === 'berserker_rage_cast',
      );
      // Thirty-second cooldown in a sixty-second fight, and it is free.
      expect(casts.length).toBeGreaterThanOrEqual(2);

      const granted = run.timeline.filter(
        (event) =>
          event.type === 'resource_gained' &&
          event.resource === 'rage' &&
          event.source === 'improved_berserker_rage',
      );
      expect(granted.length).toBe(casts.length);
      for (const event of granted) {
        if (event.type !== 'resource_gained') continue;
        expect(event.amount + event.wasted).toBe(10);
      }
    });
  });
  it('names the shield list', () => {
    expect(named('one_hand_shield', 'battle')).toBe('Warrior (Shield)');
  });
});

// ---------------------------------------------------------------------------
// Improved Berserker Rage
// ---------------------------------------------------------------------------

describe('Improved Berserker Rage grants its rage on activation', () => {
  /*
   * ----------------------------------------------------------------------------
   * THE LAST TALENT THIS CLASS COUNTED AS A LIVE GAP, and it was never one.
   *
   * Its `unmodelled` reason read "grants Rage when Berserker Rage is activated,
   * and no priority list casts Berserker Rage" -- an argument about a LIST,
   * recorded where the project keeps arguments about the ENGINE. The number was
   * stated in `values/warrior.json` the whole time: 5 rage at one rank, 10 at
   * two, beside the 50%/100% dispel chance that `valueIndex: 0` steps over.
   *
   * ASSERTED ON THE MECHANISM AND NOT ON A DPS FIGURE, which is still the right
   * shape and no longer for the reason this comment used to give. It read "no
   * priority list casts Berserker Rage and none of the three profiles spends a
   * point here -- so its worth to every published number is exactly zero", and
   * BOTH HALVES OF THAT HAVE NOW EXPIRED: the Berserker list has an entry at the
   * bottom and DW Fury spends two points, moved off an Enrage that cannot fire
   * against a target which never attacks. Worth **+6.02 +/- 5.43**, where the
   * talent alone measured BIT-IDENTICAL fights.
   *
   * SO THE REASON THAT CALLED THIS A LIVE GAP WAS AN ARGUMENT ABOUT A LIST, and
   * the fix was a list. The number was in `values/warrior.json` throughout: 5
   * rage at one rank, 10 at two, beside the 50%/100% dispel chance that
   * `valueIndex: 0` steps over.
   *
   * WHAT STAYS TRUE IS WHY THE ASSERTIONS LOOK LIKE THIS. A talent working and a
   * talent mattering are different questions, and casting the ability by hand is
   * what pins the per-rank magnitude whatever any list later does with it -- the
   * profile half is pinned separately, in `the Berserker list order` above.
   * ----------------------------------------------------------------------------
   */
  function warrior(talents: Record<string, number>) {
    const player = createPlayer({
      race: 'human',
      characterClass: 'warrior',
      combatStyle: 'dual_wield',
      talents: legalise(talents),
    });
    const dummy = createTrainingDummy({ name: 'D', health: 100_000, armor: 0, level: 63 });
    const sim = buildSimulation([player, dummy]);
    sim.begin();
    return { player, sim };
  }

  /** Cast Berserker Rage directly: no list asks for it, so nothing else will. */
  function rageFromCasting(talents: Record<string, number>) {
    const { player, sim } = warrior(talents);
    const ability = player.abilities.get('berserker_rage_cast');
    expect(ability, 'every warrior knows Berserker Rage').toBeDefined();

    const before = player.resources.get('rage')?.current ?? 0;
    ability!.onCast({ simulation: sim, caster: player, target: undefined, ability: ability! });
    const after = player.resources.get('rage')?.current ?? 0;
    return { gained: after - before, player, sim };
  }

  it('gives 10 rage at 2/2 and 5 at 1/2', () => {
    // Written out by hand from the talent text -- "will instantly generate 10
    // Rage" is the rank 2 wording, and the values file carries [5, 10].
    expect(rageFromCasting({ improved_berserker_rage: 2 }).gained).toBeCloseTo(10, 6);
    expect(rageFromCasting({ improved_berserker_rage: 1 }).gained).toBeCloseTo(5, 6);
  });

  it('gives nothing to a warrior who did not take it', () => {
    expect(rageFromCasting({}).gained).toBe(0);
  });

  it('applies the aura either way, for ten seconds', () => {
    /*
     * The ability's own half. Ten seconds is a REAL Forever figure -- "Lasts 10
     * sec", in all three sources -- and used to be a `PLACEHOLDER_` on the
     * grounds that the owner's ability spreadsheet states no duration, which
     * was true of the spreadsheet and irrelevant to the question.
     */
    const { player, sim } = rageFromCasting({});
    expect(player.auras.remainingMs(BERSERKER_RAGE.id, sim.clock.now())).toBe(
      BERSERKER_RAGE_DURATION_MS,
    );
  });
});
