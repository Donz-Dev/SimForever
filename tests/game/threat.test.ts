import { describe, expect, it } from 'vitest';
import type { Combatant } from '../../src/engine';
import { Simulation, TelemetryRecorder, threatMultiplierFor } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { withSalvationFor } from '../../src/game/buffs/raidBuffs';
import {
  FOREVER_THREAT_RULES,
  HEROIC_STRIKE_FLAT_THREAT,
  sunderArmorThreat,
} from '../../src/game/combat/threat';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { PRESETS_BY_ID } from '../../src/profiles';
import { trainingDummyEncounter } from '../../src/simulator/trainingDummyEncounter';

/*
 * ============================================================================
 * FOREVER'S THREAT FACTORS ON BUILT CHARACTERS (round 47). The numbers are the
 * owner's choices between the two Forever simulators, written out by hand.
 * ============================================================================
 */

const all = { kind: 'damage' } as const;

/** A preset's character at the pull, with its stance, buffs and auras on. */
function atPull(presetId: string): Combatant {
  const simulation = new Simulation(trainingDummyEncounter(PRESETS_BY_ID.get(presetId)!.build()));
  simulation.begin();
  return simulation.combatants.find((actor) => actor.kind === 'player')!;
}

describe('class and form', () => {
  it('gives a Rogue x0.71, before Salvation', () => {
    const rogue = createPlayer({ race: 'human', characterClass: 'rogue' });
    expect(threatMultiplierFor(rogue, all)).toBeCloseTo(0.71, 10);
  });

  it('gives Bear Form x1.5 and Cat Form x0.71', () => {
    const bear = createPlayer({ race: 'tauren', characterClass: 'druid', combatStyle: 'bear' });
    const cat = createPlayer({ race: 'tauren', characterClass: 'druid', combatStyle: 'cat' });
    expect(threatMultiplierFor(bear, all)).toBeCloseTo(1.5, 10);
    expect(threatMultiplierFor(cat, all)).toBeCloseTo(0.71, 10);
  });
});

describe('the presets at the pull', () => {
  it('give the Protection Warrior Defensive Stance x Defiance, and no Salvation', () => {
    const warrior = atPull('prot_warr');
    const defiance = warrior.threatModifiers.some((m) => m.whileAura === 'defensive_stance');
    expect(warrior.auras.has('salvation')).toBe(false);
    // 1.3 for the stance, times whatever the build's Defiance and gloves add.
    expect(threatMultiplierFor(warrior, all)).toBeGreaterThanOrEqual(1.3);
    expect(defiance).toBe(true);
  });

  it('give a DPS Warrior Berserker Stance x Salvation: 0.8 x 0.7', () => {
    const warrior = atPull('dw_fury');
    expect(warrior.auras.has('salvation')).toBe(true);
    expect(threatMultiplierFor(warrior, all)).toBeCloseTo(0.8 * 0.7, 6);
  });

  it('multiply Arcane Subtlety, Salvation and the -2% cloak on the Arcane Mage', () => {
    /*
     * THE CLOAK WAS THE THIRD FACTOR AND THE FIRST DRAFT OF THIS TEST MISSED IT:
     * eleven caster presets wear "-2% Threat", which did nothing until threat
     * was tracked. 0.7 x 0.7 x 0.98, and Arcane Subtlety only on Arcane.
     */
    const mage = atPull('mage_arcane');
    expect(
      threatMultiplierFor(mage, { kind: 'damage', school: 'arcane', table: 'spell' }),
    ).toBeCloseTo(0.7 * 0.7 * 0.98, 6);
    expect(threatMultiplierFor(mage, { kind: 'damage', school: 'fire', table: 'spell' })).toBeCloseTo(
      0.7 * 0.98,
      6,
    );
  });
});

describe('talents', () => {
  it('reads Defiance only with a shield', () => {
    expect(talentBuild('warrior', { defiance: 3 }, { hasShield: true }).threatModifiers).toEqual([
      { multiplier: 1.15, whileAura: 'defensive_stance' },
    ]);
    expect(talentBuild('warrior', { defiance: 3 }).threatModifiers).toEqual([]);
  });

  it('reads each school talent off its threat index, not its other one', () => {
    // Arcane Subtlety's index 0 is the 15 resistance; index 1 is the 30%.
    expect(talentBuild('mage', { arcane_subtlety: 2 }).threatModifiers).toEqual([
      { multiplier: 0.7, schools: ['arcane'] },
    ]);
    // Suppression's index 0 is the 5% hit.
    expect(talentBuild('warlock', { suppression: 5 }).threatModifiers).toEqual([{ multiplier: 0.8 }]);
    expect(talentBuild('paladin', { iron_creed: 5 }).threatModifiers).toEqual([
      { multiplier: 1.25, abilityIds: ['holy_strike'] },
    ]);
  });
});

describe('ability threat', () => {
  it('is the measured Warrior set', () => {
    expect(FOREVER_THREAT_RULES.ability!('heroic_strike', {} as Combatant)).toEqual({
      flat: HEROIC_STRIKE_FLAT_THREAT,
    });
    expect(HEROIC_STRIKE_FLAT_THREAT).toBeCloseTo(152.4, 6);
    expect(FOREVER_THREAT_RULES.ability!('revenge', {} as Combatant)).toEqual({ multiplier: 2.25 });
    expect(FOREVER_THREAT_RULES.ability!('shield_slam', {} as Combatant)).toBeUndefined();
  });

  it('gives Sunder Armor 206 plus 5% of attack power', () => {
    const warrior = createPlayer({ race: 'human', characterClass: 'warrior' });
    expect(sunderArmorThreat(warrior)).toBeCloseTo(206 + 0.05 * warrior.stats.get('attackPower'), 6);
  });
});

describe('Salvation follows the target', () => {
  it('turns on when the target does not attack back and off when it does', () => {
    expect(withSalvationFor(['battle_shout'], false)).toContain('salvation');
    expect(withSalvationFor(['battle_shout', 'salvation'], true)).not.toContain('salvation');
  });
});

describe('a whole fight', () => {
  it('threatens on the Protection Warrior and draws no random number doing it', () => {
    const profile = PRESETS_BY_ID.get('prot_warr')!.build();
    const config = { ...trainingDummyEncounter(profile), seed: 9 };
    const tracked = new TelemetryRecorder();
    new Simulation(config, tracked).run();
    const untracked = new TelemetryRecorder();
    new Simulation({ ...config, threatRules: undefined }, untracked).run();

    const damage = (recorder: TelemetryRecorder) =>
      recorder.ofType('damage').reduce((sum, event) => sum + event.amount, 0);
    // The SAME fight, to the point: threat changes no decision.
    expect(damage(tracked)).toBe(damage(untracked));
    expect(tracked.ofType('threat').length).toBeGreaterThan(0);
    expect(untracked.ofType('threat')).toHaveLength(0);
  }, 30_000);
});
