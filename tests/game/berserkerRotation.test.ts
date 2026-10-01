import { describe, expect, it } from 'vitest';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { createTrainingDummy } from '../../src/game/actors/createTrainingDummy';
import { buildSimulation } from '../helpers/buildSimulation';
import { legalise } from '../helpers/legalTalents';
import { createDefaultProfile } from '../../src/profiles';
import { runProfile, runProfileBatch, resourceFlowOf } from '../../src/simulator';
import { startingEquipmentFor } from '../../src/game/items/startingSets';
import { warriorRotation } from '../../src/game/rotations/warrior';
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
   * ASSERTED ON THE MECHANISM AND NOT ON A DPS FIGURE, because no priority list
   * casts Berserker Rage and none of the three profiles spends a point here --
   * so its worth to every published number is exactly zero, and that is a BUILD
   * and LIST fact rather than a modelling one. A talent working and a talent
   * mattering are different questions.
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
