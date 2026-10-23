import type { Combatant, SimulationConfig, SimulationContext } from '../engine';
import { Combatant as CombatantClass, EventPriority, createEvent, dealDamage, runPrecombat, seconds } from '../engine';
import type { CharacterProfile } from '../profiles';
import { PROFILE_PRESETS, PRESETS_BY_ID } from '../profiles/presets';
import { selectedRaidBuffs } from '../game/buffs/raidBuffs';
import { MAX_CHARACTER_LEVEL } from '../game/character';
import { characterAtCombatStart } from './characterAtCombatStart';
import { createDummyFor, createPlayerFor, trainingDummyEncounter } from './trainingDummyEncounter';

/**
 * THE TWO HEALER FIGHTS (round 52), each a `SimulationConfig` built on the
 * ordinary encounter so the raid buffs, threat rules, fight-length variance
 * and pre-combat list all behave exactly as they do for a damage profile.
 *
 * ==============================================================================
 * TANK HEALER: one target to heal, the TANK, taking damage "in exactly the same
 * fashion as the current Target attacks back function" -- so it is a real tank
 * fighting the real boss: the Prot Warr preset, swinging, blocking and parrying,
 * under the same 10% ramp a tank run uses. The assumed healer is OFF -- the
 * healer being simulated is the one keeping it up -- and it is stood back up
 * when it dies, which is how a tank run already counts deaths.
 *
 * RAID HEALER: twenty to heal, in five parties of five, with the tank in party
 * one. The owner's pattern, as percentages of each target's maximum health:
 *
 *   the tank       30% every 2 seconds
 *   all twenty     25% every 15 seconds, then 15% every 2 seconds for 8
 *
 * so a raid pulse is 25% at once and four 15% ticks after it. Percent damage
 * needs no armor, no avoidance and no stats, so the raid members are plain
 * friendly combatants with a health pool and nothing else.
 *
 * THEIR HEALTH IS NOT INVENTED: each takes the maximum health of a real preset's
 * built character, raid buffs included -- the tank Prot Warr's, the other
 * nineteen the first nineteen damage presets'. Measured once, because the
 * presets do not change during a run and building twenty characters three
 * thousand times would cost more than the fights.
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
/** The preset the tank is built from in both fights. */
export const HEALER_TANK_PRESET = 'prot_warr';

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

/** Healer presets, which a raid is never assembled from. */
const HEALER_PRESETS = new Set(['holy_pal']);
const TANK_PRESETS = new Set(['prot_warr', 'fury_prot', 'prot_pally', 'druid_bear']);

let memberHealthCache: readonly { readonly name: string; readonly health: number }[] | undefined;

/**
 * The twenty raid members' maximum health, the tank first. See the header for
 * where each figure comes from.
 */
export function raidMemberHealth(): readonly { readonly name: string; readonly health: number }[] {
  if (memberHealthCache) return memberHealthCache;
  const healthOf = (id: string) => {
    const profile = PRESETS_BY_ID.get(id)!.build();
    const built = characterAtCombatStart(profile);
    return { name: profile.character.name, health: built?.health.maximum ?? 0 };
  };
  const others = PROFILE_PRESETS.filter(
    (preset) => !TANK_PRESETS.has(preset.id) && !HEALER_PRESETS.has(preset.id),
  )
    .slice(0, RAID_SIZE - 1)
    .map((preset) => healthOf(preset.id));
  memberHealthCache = [healthOf(HEALER_TANK_PRESET), ...others];
  return memberHealthCache;
}

/** The profile the tank is built from, as a tank -- its target swings. */
function tankProfile(): CharacterProfile {
  const profile = PRESETS_BY_ID.get(HEALER_TANK_PRESET)!.build();
  return { ...profile, encounter: { ...profile.encounter, targetAttacks: true } };
}

/**
 * A healer fight for a profile. The healer's own encounter settings are used
 * for the target, so its armor and level are whatever the panel says.
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

  const tank = tankProfile();
  const tankBuffs = selectedRaidBuffs(tank.raidBuffs);

  const createCombatants = (): Combatant[] => {
    const healerActor = createPlayerFor(healer, buffs, { id: HEALER_ID });

    if (fight === 'tank') {
      const tankActor = createPlayerFor(tank, tankBuffs, {
        id: TANK_ID,
        name: 'Tank',
        externalHealing: false,
        revivesOnDeath: true,
        raidRole: 'tank',
        party: 1,
      });
      // THE TANK FIRST: the boss swings at the first friendly it finds.
      return [tankActor, healerActor, createDummyFor(tank)];
    }

    const members = raidMemberHealth().map(
      (member, index) =>
        new CombatantClass({
          id: index === 0 ? TANK_ID : `raid_${index + 1}`,
          name: index === 0 ? `Tank (${member.name})` : member.name,
          // A summon receives no raid buffs, which is right: the health was
          // measured WITH them.
          kind: 'summon',
          faction: 'friendly',
          level: MAX_CHARACTER_LEVEL,
          maxHealth: member.health,
          revivesOnDeath: true,
          party: Math.floor(index / PARTY_SIZE) + 1,
          ...(index === 0 ? { raidRole: 'tank' as const } : {}),
        }),
    );
    // No swings in a raid fight: the damage is the scheduled pattern below.
    const boss = createDummyFor({ ...healer, encounter: { ...healer.encounter, targetAttacks: false } });
    return [...members, healerActor, boss];
  };

  return {
    ...base,
    /*
     * A TANK'S PARRY TABLE, in the tank fight: the boss swings at somebody,
     * so the attacks-received table and the boss's parry of the tank's own
     * blows are the ordinary tank-run ones.
     */
    ...(fight === 'tank' ? { attackChances: trainingDummyEncounter(tank, seed).attackChances } : {}),
    createCombatants,
    /*
     * THE HEALER'S PRE-COMBAT LIST ONLY. The base hook runs it for every
     * player-kind actor, and the tank is one in the tank fight.
     */
    onPrecombat: (context) => {
      const actions = healer.precombat ?? [];
      const actor = context.combatants.find((candidate) => candidate.id === HEALER_ID);
      if (actor && actions.length > 0) runPrecombat(context, actor, actions);
    },
    onCombatStart: (context) => {
      base.onCombatStart?.(context);
      if (fight === 'raid') scheduleRaidDamage(context);
    },
  };
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
