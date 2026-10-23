import type { AttackChanceProvider, Combatant, SimulationConfig, SimulationContext } from '../engine';
import {
  Combatant as CombatantClass,
  EventPriority,
  armorConstantForLevel,
  createEvent,
  dealDamage,
  runPrecombat,
  seconds,
  toRollUnits,
} from '../engine';
import type { CharacterProfile } from '../profiles';
import { selectedRaidBuffs } from '../game/buffs/raidBuffs';
import { MAX_CHARACTER_LEVEL } from '../game/character';
import { createDummyFor, createPlayerFor, trainingDummyEncounter } from './trainingDummyEncounter';

/**
 * THE TWO HEALER FIGHTS (round 52, adjusted in round 53), each a
 * `SimulationConfig` built on the ordinary encounter so the raid buffs, threat
 * rules, fight-length variance and pre-combat list all behave exactly as they
 * do for a damage profile.
 *
 * ==============================================================================
 * THE TANK IS A STATED TANK, NOT A BUILT ONE (round 53). The owner's figures:
 *
 *   health        8,500 -- in both fights, and what the raid's 30% is OF
 *   armor         65% damage reduction, in the tank fight
 *   the table     18% dodge, 10% parry, 15% crushed, 2% crit, 55% hit
 *
 * Round 52 built the Prot Warr preset and let it fight: it swung, sundered and
 * slowed the boss, and its health and avoidance moved with its gear. A healer
 * benchmark wants a tank that is the same every time, so it is a plain
 * friendly combatant with a pool, an armor figure and a fixed attacks-received
 * table, and nothing of its own to do.
 *
 * TANK HEALER: one target to heal, that tank, under the boss's ordinary swing
 * and 10% ramp -- the mechanism a tank run uses. The base swing is the owner's
 * 2,000 (round 54); the swing SPEED is still the Encounter panel's.
 *
 * RAID HEALER: twenty to heal, in five parties of five, with the tank in party
 * one. The owner's pattern, as percentages of each target's maximum health:
 *
 *   the tank       30% every 2 seconds
 *   all twenty     25% every 15 seconds, then 15% every 2 seconds for 8
 *
 * so a raid pulse is 25% at once and four 15% ticks after it.
 *
 * THE OTHER NINETEEN ROLL THEIR HEALTH, a whole number from 4,500 to 6,500 each
 * fight, off the fight's own random stream at the pull -- so a seed reproduces
 * the raid, and the batch averages over raids rather than over one.
 *
 * EVERYBODY HEALED IS STOOD BACK UP AT FULL THE INSTANT THEY DIE, and the
 * death is recorded first. That is `revivesOnDeath`, the mechanism a tank run
 * already uses.
 *
 * THE FIRST RAID PULSE LANDS AT 15 SECONDS, not at the pull: "every 15 seconds"
 * read as a period, so a sixty-second fight takes four. A modelling choice the
 * owner stated no figure for, and the one constant to move if they meant t=0.
 * ==============================================================================
 */

export type HealerFight = 'tank' | 'raid';

/** The healer's id in both fights, which the batch is told to report on. */
export const HEALER_ID = 'player_1';
export const TANK_ID = 'tank';

/** The tank's health, in both fights. */
export const HEALER_TANK_HEALTH = 8_500;
/** The share of a physical blow the tank's armor removes, in the tank fight. */
export const HEALER_TANK_ARMOR_REDUCTION = 0.65;
/** The tank's attacks-received table in the tank fight, in percent. */
export const HEALER_TANK_TABLE = { dodge: 18, parry: 10, crush: 15, crit: 2, hit: 55 } as const;

/**
 * The boss's base swing in the tank fight, before the ramp (round 54): the
 * owner's 2,000, in place of whatever the Encounter panel says. A healer
 * benchmark wants the same boss every time, as it wants the same tank.
 */
export const HEALER_TANK_BOSS_SWING_DAMAGE = 2_000;

/** What the other nineteen roll their health between, inclusive. */
export const RAID_MEMBER_HEALTH_MIN = 4_500;
export const RAID_MEMBER_HEALTH_MAX = 6_500;

export const RAID_SIZE = 20;
export const PARTY_SIZE = 5;
/** The tank's share of its health lost on each hit, and how often. */
export const RAID_TANK_HIT_FRACTION = 0.3;
export const RAID_TANK_HIT_PERIOD_MS = seconds(2);
/** The raid-wide pulse: an opening hit, then ticks, every period. */
export const RAID_PULSE_PERIOD_MS = seconds(15);
export const RAID_PULSE_FIRST_MS = seconds(15);
export const RAID_PULSE_OPENING_FRACTION = 0.25;
export const RAID_PULSE_TICK_FRACTION = 0.15;
export const RAID_PULSE_TICK_PERIOD_MS = seconds(2);
export const RAID_PULSE_DURATION_MS = seconds(8);

/**
 * The armor that removes exactly `HEALER_TANK_ARMOR_REDUCTION` of a blow:
 * `armor / (K + armor)` solved for armor, with K read at the DEFENDER's level
 * -- which is the level `armorDamageMultiplier` is handed. Reading it at the
 * boss's 63 gave 66%, a point over the stated figure.
 */
export function healerTankArmor(defenderLevel: number = MAX_CHARACTER_LEVEL): number {
  const reduction = HEALER_TANK_ARMOR_REDUCTION;
  return (reduction / (1 - reduction)) * armorConstantForLevel(defenderLevel);
}

/** The stated tank, as a combatant. */
function statedTank(armor: number): Combatant {
  return new CombatantClass({
    id: TANK_ID,
    name: 'Tank',
    // A summon receives no raid buffs, which is right: the figures are stated.
    kind: 'summon',
    faction: 'friendly',
    level: MAX_CHARACTER_LEVEL,
    maxHealth: HEALER_TANK_HEALTH,
    stats: { armor },
    revivesOnDeath: true,
    raidRole: 'tank',
    party: 1,
  });
}

/**
 * The owner's table for the stated tank, laid over the ordinary one so the
 * crit and crush MULTIPLIERS stay the ruleset's. Every other attack in the
 * fight -- the healer's own -- is untouched.
 */
function statedTankChances(base: AttackChanceProvider): AttackChanceProvider {
  return (kind, source, target, context) => {
    const chances = base(kind, source, target, context);
    if (kind !== 'melee-received' || target.raidRole !== 'tank') return chances;
    return {
      ...chances,
      miss: 0,
      dodge: toRollUnits(HEALER_TANK_TABLE.dodge),
      parry: toRollUnits(HEALER_TANK_TABLE.parry),
      block: 0,
      glance: 0,
      crush: toRollUnits(HEALER_TANK_TABLE.crush),
      crit: toRollUnits(HEALER_TANK_TABLE.crit),
    };
  };
}

/**
 * A healer fight for a profile. The healer's own encounter settings are used
 * for the target, so its armor, level, swing damage and swing speed are
 * whatever the panel says.
 */
export function healerEncounter(
  profile: CharacterProfile,
  fight: HealerFight,
  seed: number = profile.simulation.seed,
): SimulationConfig {
  // The healer is not attacked in either fight.
  const healer: CharacterProfile = {
    ...profile,
    encounter: { ...profile.encounter, targetAttacks: false },
  };
  const base = trainingDummyEncounter(healer, seed);
  const buffs = selectedRaidBuffs(healer.raidBuffs);

  // What the tank fight's boss is: the healer's encounter, swinging for 2,000.
  const swinging: CharacterProfile = {
    ...profile,
    encounter: {
      ...profile.encounter,
      targetAttacks: true,
      targetSwingDamage: HEALER_TANK_BOSS_SWING_DAMAGE,
    },
  };

  const createCombatants = (): Combatant[] => {
    const healerActor = createPlayerFor(healer, buffs, { id: HEALER_ID });

    if (fight === 'tank') {
      const boss = createDummyFor(swinging);
      // THE TANK FIRST: the boss swings at the first friendly it finds.
      return [statedTank(healerTankArmor()), healerActor, boss];
    }

    // Percent damage applies no armor, so the raid's tank carries none.
    const members = [statedTank(0)];
    for (let index = 1; index < RAID_SIZE; index++) {
      members.push(
        new CombatantClass({
          id: `raid_${index + 1}`,
          name: `Raid ${index + 1}`,
          kind: 'summon',
          faction: 'friendly',
          level: MAX_CHARACTER_LEVEL,
          // Rolled at the pull; see `rollRaidHealth`.
          maxHealth: RAID_MEMBER_HEALTH_MAX,
          revivesOnDeath: true,
          party: Math.floor(index / PARTY_SIZE) + 1,
        }),
      );
    }
    // No swings in a raid fight: the damage is the scheduled pattern below.
    return [...members, healerActor, createDummyFor(healer)];
  };

  return {
    ...base,
    ...(fight === 'tank'
      ? { attackChances: statedTankChances(trainingDummyEncounter(swinging, seed).attackChances!) }
      : {}),
    createCombatants,
    /*
     * THE HEALER'S PRE-COMBAT LIST ONLY. The base hook runs it for every
     * player-kind actor; nobody else here is one, but it is said rather than
     * relied on.
     */
    onPrecombat: (context) => {
      const actions = healer.precombat ?? [];
      const actor = context.combatants.find((candidate) => candidate.id === HEALER_ID);
      if (actor && actions.length > 0) runPrecombat(context, actor, actions);
    },
    onCombatStart: (context) => {
      base.onCombatStart?.(context);
      if (fight === 'raid') {
        rollRaidHealth(context);
        scheduleRaidDamage(context);
      }
    },
  };
}

/** The nineteen who are not the tank roll their health, once, at the pull. */
function rollRaidHealth(context: SimulationContext): void {
  for (const member of context.combatants) {
    if (member.party === undefined || member.raidRole === 'tank') continue;
    member.health.setMaximum(context.rng.nextInt(RAID_MEMBER_HEALTH_MIN, RAID_MEMBER_HEALTH_MAX));
    member.health.fill();
  }
}

/** Percent-of-maximum damage from the boss, with no roll and no armor. */
function hit(context: SimulationContext, target: Combatant, fraction: number, name: string): void {
  if (!target.isAlive) return;
  const boss = context.combatants.find((actor) => actor.faction === 'hostile');
  if (!boss) return;
  dealDamage(context, {
    source: boss,
    target,
    abilityName: name,
    school: 'physical',
    baseAmount: fraction * target.health.maximum,
    appliesArmor: false,
  });
}

/** The raid fight's damage pattern, scheduled once at the pull. */
function scheduleRaidDamage(context: SimulationContext): void {
  const members = context.combatants.filter((actor) => actor.party !== undefined);
  const tank = members.find((member) => member.raidRole === 'tank');

  const tankHit = (ctx: SimulationContext) => {
    if (ctx.hasEnded) return;
    if (tank) hit(ctx, tank, RAID_TANK_HIT_FRACTION, 'Boss Strike');
    ctx.schedule(RAID_TANK_HIT_PERIOD_MS, createEvent('raid-tank-hit', EventPriority.AutoAttack, tankHit));
  };
  context.schedule(RAID_TANK_HIT_PERIOD_MS, createEvent('raid-tank-hit', EventPriority.AutoAttack, tankHit));

  const pulse = (ctx: SimulationContext) => {
    if (ctx.hasEnded) return;
    for (const member of members) hit(ctx, member, RAID_PULSE_OPENING_FRACTION, 'Raid Pulse');
    for (let at = RAID_PULSE_TICK_PERIOD_MS; at <= RAID_PULSE_DURATION_MS; at += RAID_PULSE_TICK_PERIOD_MS) {
      ctx.schedule(
        at,
        createEvent('raid-pulse-tick', EventPriority.Periodic, (tickCtx) => {
          if (tickCtx.hasEnded) return;
          for (const member of members) hit(tickCtx, member, RAID_PULSE_TICK_FRACTION, 'Raid Pulse (tick)');
        }),
      );
    }
    ctx.schedule(RAID_PULSE_PERIOD_MS, createEvent('raid-pulse', EventPriority.AutoAttack, pulse));
  };
  context.schedule(RAID_PULSE_FIRST_MS, createEvent('raid-pulse', EventPriority.AutoAttack, pulse));
}
