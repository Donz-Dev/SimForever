import type { AuraDefinition, AttackOutcome, Reaction, WeaponProfile } from '../../engine';
import { seconds } from '../../engine';

/**
 * A raid boss's melee, for an encounter where the target hits back.
 *
 * WHY THIS MATTERS AT ALL
 *
 * Three whole systems are built, tested, and have never fired in a real fight:
 * the attacks-received combat table, rage from damage taken, and Revenge. Six
 * Warrior talents are inert for the same reason. All of it is waiting on
 * something swinging at the player, and this is that something.
 *
 *
 * THE NUMBERS ARE BORROWED, AND EVERY ONE IS A PLACEHOLDER
 *
 * The ruleset gives the attacks-received TABLE -- boss miss, crit, crush and
 * their multipliers are all real Forever data in `COMBAT_CONSTANTS`. What it
 * does not give is how hard a boss hits or how often.
 *
 * So these are WoW Classic figures for a mid-tier raid boss, used on the
 * explicit instruction to prefer clearly-flagged Classic values over leaving
 * the systems unreachable. They are PLACEHOLDER-prefixed, they are editable
 * per encounter from the profile, and the Encounter panel labels them on
 * screen. Nothing here is Forever data.
 *
 * A wrong figure here moves rage income, and rage income moves everything a
 * warrior does. Treat any absolute number from a fight with this enabled as
 * provisional even by this project's standards.
 */

/**
 * Seconds between boss swings.
 *
 * PLACEHOLDER. Two seconds is the Classic raid-boss convention and nothing in
 * Forever states it.
 */
export const PLACEHOLDER_BOSS_SWING_SECONDS = 2;

/**
 * Damage per swing, BEFORE armor and before the attacks-received table.
 *
 * PLACEHOLDER. A mid-tier Classic raid boss against plate. The engine applies
 * armor on top, so a warrior in the starting set takes materially less than
 * this per landed swing.
 */
export const PLACEHOLDER_BOSS_SWING_DAMAGE = 5000;

/**
 * How far a boss swing varies either side of its average.
 *
 * PLACEHOLDER, and deliberately narrow: the point of the variance is that two
 * swings are not identical, not to model a specific boss's spread.
 */
export const PLACEHOLDER_BOSS_DAMAGE_VARIANCE = 0.15;

/**
 * How much harder the target hits with each swing it takes.
 *
 * ----------------------------------------------------------------------------
 * THE RULE, from the ruleset owner:
 *
 *   Every time the target swings, its damage is increased by 10%.
 *
 * COMPOUNDING, which is what "increased by 10%" says: swing one is the base
 * figure, swing two is 1.1 times it, swing three 1.21 times, and so on. It is
 * not 10% of the base added each time, which would be a straight line.
 *
 * It exists to make the fight get away from the character. A tank who is
 * comfortably healed through a flat 5,000 every two seconds is never tested,
 * and half the Protection tree -- everything keyed on being hurt, on blocking,
 * on being close to death -- never fires. A ramp guarantees the fight ends
 * with damage nothing can survive, and the interesting part is how long that
 * takes.
 *
 * It is NOT a Forever number and nothing in the source states one. Like the
 * swing damage it multiplies, it is a modelling choice about how the encounter
 * is set up. Two swings a second at ten percent a swing is ferocious: thirty
 * swings into a sixty second fight the target is hitting for seventeen times
 * what it started at.
 * ----------------------------------------------------------------------------
 */
export const BOSS_SWING_DAMAGE_RAMP = 0.1;

/**
 * The most the ramp can stack to.
 *
 * A CAP ON THE MODEL, not a rule: at ten percent a swing this is already
 * 1.1^200, which no character survives a single blow of, so it can only ever
 * bind in a fight far past the point of interest. It exists so that an
 * accidentally long run cannot climb until a float stops being one.
 */
export const BOSS_DAMAGE_RAMP_MAX_STACKS = 200;

/** Every outcome a swing can produce, avoided or not. */
const EVERY_OUTCOME: readonly AttackOutcome[] = [
  'miss',
  'dodge',
  'parry',
  'block',
  'glance',
  'crush',
  'crit',
  'hit',
];

/**
 * The ramp itself, as a stacking buff on the target.
 *
 * An aura rather than a counter on the encounter, for the usual reason: it is
 * then in the telemetry, visible in the combat log, and read by the same
 * `damageDoneMultiplier` every other damage buff goes through. A private field
 * would work and nobody could audit it.
 *
 * `modifiersScaleWithStacks` raises the multiplier to the power of the stack
 * count, which is exactly the compounding the rule describes.
 */
export const BOSS_DAMAGE_RAMP: AuraDefinition = {
  id: 'boss_damage_ramp',
  name: 'Mounting Fury',
  // Permanent. Nothing in the rule says it ever falls off, and a fight that
  // lets the target calm down is a different encounter.
  durationMs: 0,
  maxStacks: BOSS_DAMAGE_RAMP_MAX_STACKS,
  damageDoneMultiplier: 1 + BOSS_SWING_DAMAGE_RAMP,
  modifiersScaleWithStacks: true,
};

/**
 * What adds a stack: the target's own swing, after it has landed.
 *
 * AFTER, which is what puts the first swing at the base figure. Reactions run
 * once the damage is applied and the telemetry emitted, so the swing that adds
 * the stack is not the swing that benefits from it.
 *
 * Every outcome counts, including a miss. The rule is "every time the target
 * swings", and a swing the character dodged is still a swing -- a tank who
 * avoided everything would otherwise freeze the ramp by being good at their
 * job, which is the opposite of the point.
 *
 * Keyed on the swing rather than on a three-second timer so that it stays
 * correct if the target's swing speed is ever changed. The two happen to agree
 * today only because nothing resets a target's swing timer.
 */
export const BOSS_DAMAGE_RAMP_REACTION: Reaction = {
  id: 'boss_damage_ramp',
  on: 'dealt',
  outcomes: EVERY_OUTCOME,
  onTrigger: (context, actor) => {
    context.applyAura(actor, BOSS_DAMAGE_RAMP, actor.id);
  },
};

/**
 * The weapon a target swings with when an encounter says it attacks back.
 *
 * No attack power contribution: the damage figure IS the whole swing, rather
 * than a base that something scales. A boss has no attack power in this model
 * and inventing one would be a second guess on top of the first.
 */
export function bossMeleeWeapon(options: {
  readonly damage?: number;
  readonly swingSeconds?: number;
} = {}): WeaponProfile {
  return {
    name: 'Melee',
    swingTimerMs: seconds(options.swingSeconds ?? PLACEHOLDER_BOSS_SWING_SECONDS),
    baseDamage: options.damage ?? PLACEHOLDER_BOSS_SWING_DAMAGE,
    damageVariance: PLACEHOLDER_BOSS_DAMAGE_VARIANCE,
    powerCoefficient: 0,
  };
}
