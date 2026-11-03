import { describe, expect, it } from 'vitest';
import type { Combatant } from '../../src/engine';
import { Simulation, TelemetryRecorder, threatMultiplierFor } from '../../src/engine';
import { createPlayer } from '../../src/game/actors/createPlayer';
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
  it('gives a Rogue x0.71, confirmed by the owner', () => {
    const rogue = createPlayer({ race: 'human', characterClass: 'rogue' });
    expect(threatMultiplierFor(rogue, all)).toBeCloseTo(0.71, 10);
  });

  it('gives Bear Form x2.15 -- Dire Bear included, one style -- and Cat Form x0.71', () => {
    // +115% since 1.60.1.70755, "to compensate for Blessing of Salvation being removed".
    const bear = createPlayer({ race: 'tauren', characterClass: 'druid', combatStyle: 'bear' });
    const cat = createPlayer({ race: 'tauren', characterClass: 'druid', combatStyle: 'cat' });
    expect(threatMultiplierFor(bear, all)).toBeCloseTo(2.15, 10);
    expect(threatMultiplierFor(cat, all)).toBeCloseTo(0.71, 10);
  });
});

describe('the presets at the pull', () => {
  it('give the Protection Warrior Defensive Stance x Defiance, and no Salvation', () => {
    const warrior = atPull('prot_warr');
    const defiance = warrior.threatModifiers.some((m) => m.whileAura === 'defensive_stance');
    expect(warrior.auras.has('salvation')).toBe(false);
    // 1.8 for the stance since 1.60.1.70755, times whatever Defiance and gloves add.
    expect(threatMultiplierFor(warrior, all)).toBeGreaterThanOrEqual(1.8);
    expect(defiance).toBe(true);
  });

  it('give a Retribution Paladin Two-Handed Weapon Specialization, with no Righteous Fury', () => {
    // 20% off all threat while a two-hander is held (1.60.1.70707). The
    // Retribution list never casts the Fury, and there is no Salvation since
    // 1.60.1.70755 removed the spell.
    const paladin = atPull('pally_ret');
    expect(paladin.auras.has('righteous_fury')).toBe(false);
    expect(paladin.auras.has('salvation')).toBe(false);
    expect(threatMultiplierFor(paladin, all)).toBeCloseTo(0.8, 6);
  });

  it('give a DPS Warrior Berserker Stance alone: 0.8, with no Salvation', () => {
    const warrior = atPull('dw_fury');
    expect(warrior.auras.has('salvation')).toBe(false);
    expect(threatMultiplierFor(warrior, all)).toBeCloseTo(0.8, 6);
  });

  it('multiply Arcane Subtlety and the -2% cloak on the Arcane Mage', () => {
    /*
     * THE CLOAK WAS THE THIRD FACTOR AND THE FIRST DRAFT OF THIS TEST MISSED IT:
     * eleven caster presets wear "-2% Threat", which did nothing until threat
     * was tracked. 0.7 x 0.98, and Arcane Subtlety only on Arcane. (Salvation's
     * 0.7 was a third factor until 1.60.1.70755 removed it.)
     */
    const mage = atPull('mage_arcane');
    expect(
      threatMultiplierFor(mage, { kind: 'damage', school: 'arcane', table: 'spell' }),
    ).toBeCloseTo(0.7 * 0.98, 6);
    // And Burning Soul 1/3 since round 80 (the 32/16/3 tree's Fire tier tax):
    // 10% off Fire threat.
    expect(threatMultiplierFor(mage, { kind: 'damage', school: 'fire', table: 'spell' })).toBeCloseTo(
      0.98 * 0.9,
      6,
    );
  });
});

describe('talents', () => {
  it('reads Defiance only with a shield', () => {
    // 7/13/20% since 1.60.1.70755.
    expect(talentBuild('warrior', { defiance: 3 }, { hasShield: true }).threatModifiers).toEqual([
      { multiplier: 1.2, whileAura: 'defensive_stance' },
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
    // Three ranks and 30% since 1.60.1.70707.
    expect(talentBuild('paladin', { iron_creed: 3 }).threatModifiers).toEqual([
      { multiplier: 1.3, abilityIds: ['holy_strike'] },
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
