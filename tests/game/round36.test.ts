import { describe, expect, it } from 'vitest';
import type { AttackEvent, TelemetryEvent } from '../../src/engine';
import { seconds } from '../../src/engine';
import { buildSimulation } from '../helpers/buildSimulation';
import { makeAttacker, makeTarget } from '../helpers/actors';
import { createForeverAttackChances } from '../../src/game/combat/attackChances';
import {
  CONSECRATION_TICK_SP_COEFFICIENT,
  HOLY_STRIKE_SP_COEFFICIENT,
} from '../../src/game/combat/coefficients';
import {
  HOLY_STRIKE,
  HOLY_STRIKE_HOLY_DAMAGE,
  HOLY_STRIKE_WEAPON_FRACTION,
} from '../../src/game/abilities/paladin';
import { talentBuild } from '../../src/game/talents/talentBuild';
import { PRESETS_BY_ID } from '../../src/profiles/presets';
import { RAID_BUFFS_BY_ID, DEVOTION_AURA_ARMOR } from '../../src/game/buffs/raidBuffs';
import {
  DEFAULT_SUPPLIER_SPELL_POWER,
  retaliationReaction,
} from '../../src/game/buffs/retaliation';
import { createPlayer } from '../../src/game/actors/createPlayer';
import { missileBarrage } from '../../src/game/reactions/mageTalents';
import { MAGE_ABILITIES } from '../../src/game/abilities/mage';
import { ARCANE_BLAST_DURATION_MS } from '../../src/game/auras/mage';
import { racialsForRace } from '../../src/game/rotations/racialCooldowns';
import { auraStackTimeline } from '../../src/ui/charts/ResourceTimeline';
import { parseProfile, serializeProfile } from '../../src/profiles/serialization';

/*
 * ============================================================================
 * ROUND 36, ONE MECHANISM EACH. Every figure is written out BY HAND from the
 * owner's message rather than read back from the source.
 * ============================================================================
 */

const damageOf = (events: TelemetryEvent[], abilityId: string) =>
  events.filter(
    (e) => e.type === 'damage' && (e as { abilityId?: string }).abilityId === abilityId,
  ) as unknown as { amount: number; outcome: string }[];

describe('the Paladin balance items', () => {
  it('puts Holy Strike’s flat Holy damage inside the 50% as well as its spell power', () => {
    /*
     * "(weapon damage + flat holy damage based on rank + 42.9% spell power) *
     * 50%". At ZERO weapon damage and ZERO attack power, what lands is the
     * flat half alone: (93 + 0.429 x SP) x 0.5.
     */
    expect(HOLY_STRIKE_WEAPON_FRACTION).toBe(0.5);
    expect(HOLY_STRIKE_SP_COEFFICIENT).toBe(0.429);
    expect(HOLY_STRIKE_HOLY_DAMAGE).toBe(93);

    const spellPower = 400;
    const paladin = makeAttacker({
      autoAttack: 'none',
      stats: { attackPower: 0, spellPower, critChance: -100, hitChance: 100 },
      weapons: {
        mainHand: {
          name: 'Zero',
          swingTimerMs: seconds(3),
          baseDamage: 0,
          damageVariance: 0,
          powerCoefficient: 0,
        },
      },
    });
    const boss = makeTarget({ maxHealth: 1e9, stats: { armor: 0 } });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([paladin, boss], {}, { emit: (e) => events.push(e) });
    simulation.begin();
    HOLY_STRIKE.onCast!({ simulation, caster: paladin, target: boss, ability: HOLY_STRIKE });

    const hit = damageOf(events, 'holy_strike')[0];
    expect(hit.amount).toBeCloseTo((93 + 0.429 * spellPower) * 0.5, 0);
  });

  it('gives Consecration 4.125% spell power a tick', () => {
    expect(CONSECRATION_TICK_SP_COEFFICIENT).toBe(0.04125);
  });

  it('has no One-Handed Weapon Specialization to apply since 1.60.1.70707', () => {
    /*
     * The talent left the tree -- "it gave up to 10% more damage with one-handed
     * weapons", everything but Consecration, Retribution Aura, Thorns and Holy
     * Shock by the owner's two rulings. The Prot Pally's one-hander carries no
     * blanket multiplier now.
     */
    const built = PRESETS_BY_ID.get('prot_pally')!.build();
    expect(built.talents.one_handed_weapon_specialization).toBeUndefined();
    const build = talentBuild('paladin', built.talents, {
      mainHand: {
        name: 'One-Hander',
        twoHanded: false,
        swingTimerMs: seconds(2.6),
        baseDamage: 100,
        powerCoefficient: 2.6 / 14,
      },
      hasShield: true,
    });
    expect(build.damageMultiplier).toBeCloseTo(1, 10);
  });
});

describe('Thorns, Retribution Aura and Devotion Aura', () => {
  it('deals 18 or 20 plus 6% of the SUPPLIER’s spell power to every attacker', () => {
    const tank = makeAttacker({ autoAttack: 'none', stats: { spellPower: 9999 } });
    const boss = makeTarget({ maxHealth: 1e9 });
    const events: TelemetryEvent[] = [];
    const simulation = buildSimulation([tank, boss], {}, { emit: (e) => events.push(e) });
    simulation.begin();

    const thorns = retaliationReaction('thorns', 'Thorns', 'nature', 18, 700);
    const ret = retaliationReaction('retribution_aura', 'Retribution Aura', 'holy', 20, 500);
    // EVERY attack, including one the tank avoided -- "every time a target
    // attacks you", read literally.
    for (const outcome of ['hit', 'dodge', 'miss'] as const) {
      const attack = {
        attacker: boss,
        defender: tank,
        outcome,
        abilityId: undefined,
        abilityName: 'Boss Swing',
        amount: outcome === 'hit' ? 1000 : 0,
        weaponSlot: 'mainHand',
        critical: false,
        attackTable: 'melee-received',
      } as AttackEvent;
      expect(thorns.outcomes).toContain(outcome);
      thorns.onTrigger(simulation, tank, attack);
      ret.onTrigger(simulation, tank, attack);
    }

    const t = damageOf(events, 'thorns');
    const r = damageOf(events, 'retribution_aura');
    expect(t).toHaveLength(3);
    expect(r).toHaveLength(3);
    // The CARRIER's 9999 spell power reaches neither: it is the supplier's.
    for (const hit of t) expect(hit.amount).toBeCloseTo(18 + 0.06 * 700, 6);
    for (const hit of r) expect(hit.amount).toBeCloseTo(20 + 0.06 * 500, 6);
  });

  it('defaults the supplier to 700 spell power and carries a saved value through a load', () => {
    expect(DEFAULT_SUPPLIER_SPELL_POWER).toBe(700);
    expect(RAID_BUFFS_BY_ID.get('thorns')?.value?.defaultValue).toBe(700);
    expect(RAID_BUFFS_BY_ID.get('retribution_aura')?.value?.defaultValue).toBe(700);

    const profile = {
      ...PRESETS_BY_ID.get('prot_pally')!.build(),
      raidBuffValues: { thorns: 850 },
    };
    const loaded = parseProfile(serializeProfile(profile));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.profile.raidBuffValues).toEqual({ thorns: 850 });
  });

  it('gives Devotion Aura 735 armor that is NOT armor from items', () => {
    expect(DEVOTION_AURA_ARMOR).toBe(735);
    const aura = RAID_BUFFS_BY_ID.get('devotion_aura')!.aura!;
    const bear = createPlayer({ race: 'tauren', characterClass: 'druid', combatStyle: 'bear' });
    const before = bear.stats.get('armor');
    const simulation = buildSimulation([bear, makeTarget()]);
    simulation.begin();
    const begun = bear.stats.get('armor');
    simulation.applyAura(bear, aura, bear.id);
    // FLAT: Dire Bear Form multiplies item armor, and this is not item armor.
    expect(bear.stats.get('armor') - begun).toBe(735);
    expect(begun).toBe(before);
  });
});

describe('Arcane Blast and Missile Barrage', () => {
  const book = (id: string) => MAGE_ABILITIES.find((a) => a.id === id)!;

  it('keeps every stack through Arcane Missiles and ends only on the clock', () => {
    const mage = makeAttacker({
      autoAttack: 'none',
      stats: { intellect: 300, hitChance: 17 },
      resources: [{ type: 'mana', maximum: 1e6 }],
      abilities: MAGE_ABILITIES,
    });
    const boss = makeTarget({ maxHealth: 1e9 });
    const simulation = buildSimulation([mage, boss], {
      attackChances: createForeverAttackChances(),
    });
    simulation.begin();
    const blast = book('arcane_blast');
    const missiles = book('arcane_missiles');

    blast.onCast!({ simulation, caster: mage, target: boss, ability: blast });
    simulation.advanceTo(seconds(2));
    blast.onCast!({ simulation, caster: mage, target: boss, ability: blast });
    expect(mage.auras.get('arcane_blast')?.stacks).toBe(2);

    // Arcane Missiles, all five, does not touch them.
    simulation.advanceTo(seconds(4));
    for (let i = 0; i < 5; i += 1) {
      missiles.onCast!({ simulation, caster: mage, target: boss, ability: missiles });
    }
    expect(mage.auras.get('arcane_blast')?.stacks).toBe(2);

    // A third Blast at 12s adds a stack and does NOT push the window past 15s.
    simulation.advanceTo(seconds(12));
    blast.onCast!({ simulation, caster: mage, target: boss, ability: blast });
    expect(mage.auras.get('arcane_blast')?.stacks).toBe(3);
    simulation.advanceTo(ARCANE_BLAST_DURATION_MS + 1);
    expect(mage.auras.has('arcane_blast')).toBe(false);
  });

  it('no longer lets an Arcane Missile proc Missile Barrage', () => {
    // A row where every chance is 100%, so only the RULE can refuse.
    const reaction = missileBarrage(100, [100, 100, 100]);
    const mage = makeAttacker();
    const boss = makeTarget();
    const simulation = buildSimulation([mage, boss]);
    simulation.begin();
    const from = (abilityId: string) =>
      reaction.canTrigger!(simulation, mage, {
        attacker: mage,
        defender: boss,
        outcome: 'hit',
        abilityId,
        abilityName: abilityId,
        amount: 100,
        weaponSlot: undefined,
        critical: false,
        attackTable: 'spell',
      } as AttackEvent);
    expect(from('arcane_missiles')).toBe(false);
    expect(from('arcane_blast')).toBe(true);
    expect(from('fireball')).toBe(true);
  });
});

describe('a race swap', () => {
  it('switches another race’s racial entries OFF in place and lights its own', () => {
    const list = {
      name: 'test',
      entries: [
        { abilityId: 'blood_fury' },
        { abilityId: 'heroic_strike' },
        { abilityId: 'berserking', disabled: true },
      ],
    };
    const asTroll = racialsForRace(list, 'troll');
    expect(asTroll.entries).toEqual([
      { abilityId: 'blood_fury', disabled: true },
      { abilityId: 'heroic_strike' },
      { abilityId: 'berserking' },
    ]);
    // Nothing to change returns the same object, which the sync leans on.
    expect(racialsForRace(asTroll, 'troll')).toBe(asTroll);
  });

  it('charts a stacking buff the way a combo point line is charted', () => {
    const base = { sourceId: 'm', targetId: 'm', auraId: 'arcane_blast', auraName: 'AB', isDebuff: false };
    const timeline = [
      { ...base, type: 'aura_applied', timestamp: 0, stacks: 1 },
      { ...base, type: 'aura_stacks_changed', timestamp: 1500, stacks: 2 },
      { ...base, type: 'aura_removed', timestamp: 15000, stacks: 2 },
      { ...base, targetId: 'other', type: 'aura_applied', timestamp: 100, stacks: 4 },
    ] as unknown as TelemetryEvent[];
    expect(auraStackTimeline(timeline, 'm', 'arcane_blast')).toEqual([
      { timeMs: 0, value: 1 },
      { timeMs: 1500, value: 2 },
      { timeMs: 15000, value: 0 },
    ]);
  });
});
