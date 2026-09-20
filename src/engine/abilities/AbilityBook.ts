import type { Milliseconds } from '../time';
import type { Ability } from './Ability';

/**
 * Per-ability cooldown and charge state for one combatant.
 *
 * Recharging is computed lazily when queried rather than driven by scheduled
 * events. A two-charge ability off cooldown for ten minutes would otherwise
 * generate a stream of recharge events nobody ever looks at; this way an idle
 * ability costs nothing.
 */
interface AbilityState {
  /** Charges currently available. */
  available: number;
  /** When the charge now recharging started, or null if all charges are up. */
  rechargeStartedAt: Milliseconds | null;
}

/**
 * The abilities a combatant knows, plus their cooldown state.
 *
 * Separate from the ability definitions themselves, because definitions are
 * shared content: two warriors know the same Strike object but must have
 * independent cooldowns on it.
 */
export class AbilityBook {
  private readonly abilities = new Map<string, Ability>();
  private readonly states = new Map<string, AbilityState>();
  /**
   * When each shared cooldown group becomes usable again.
   *
   * Separate from per-ability state because a group is not an ability: it has
   * no charges and belongs to no single entry. Kept as an absolute timestamp
   * rather than a remaining duration so nothing has to tick it.
   */
  private readonly groupReadyAt = new Map<string, Milliseconds>();

  constructor(abilities: readonly Ability[] = []) {
    for (const ability of abilities) {
      this.add(ability);
    }
  }

  add(ability: Ability): void {
    this.abilities.set(ability.id, ability);
    this.states.set(ability.id, {
      available: ability.charges ?? 1,
      rechargeStartedAt: null,
    });
  }

  get(abilityId: string): Ability | undefined {
    return this.abilities.get(abilityId);
  }

  has(abilityId: string): boolean {
    return this.abilities.has(abilityId);
  }

  get all(): readonly Ability[] {
    return [...this.abilities.values()];
  }

  /** Charges available right now, after accounting for elapsed recharge time. */
  chargesAvailable(abilityId: string, now: Milliseconds): number {
    const ability = this.abilities.get(abilityId);
    const state = this.states.get(abilityId);
    if (!ability || !state) return 0;
    this.sync(ability, state, now);
    return state.available;
  }

  /** True if at least one charge is up AND no shared cooldown is blocking. */
  isReady(abilityId: string, now: Milliseconds): boolean {
    if (this.groupRemaining(abilityId, now) > 0) return false;
    return this.chargesAvailable(abilityId, now) > 0;
  }

  /**
   * Time left on this ability's shared cooldown group, or 0.
   *
   * An ability in no group is never blocked by one.
   */
  groupRemaining(abilityId: string, now: Milliseconds): Milliseconds {
    const group = this.abilities.get(abilityId)?.cooldownGroup;
    if (!group) return 0;
    return Math.max(0, (this.groupReadyAt.get(group) ?? 0) - now);
  }

  /** Time until the next charge becomes available. 0 when one is already up. */
  cooldownRemaining(abilityId: string, now: Milliseconds): Milliseconds {
    const ability = this.abilities.get(abilityId);
    const state = this.states.get(abilityId);
    if (!ability || !state) return 0;

    this.sync(ability, state, now);

    const group = this.groupRemaining(abilityId, now);
    if (state.available > 0 || state.rechargeStartedAt === null) return group;

    const cooldown = ability.cooldownMs ?? 0;
    // Whichever runs longer: both have to be clear before it can be used.
    return Math.max(group, Math.max(0, state.rechargeStartedAt + cooldown - now));
  }

  /** Consume a charge and start its recharge. Returns false if none were up. */
  consumeCharge(abilityId: string, now: Milliseconds): boolean {
    const ability = this.abilities.get(abilityId);
    const state = this.states.get(abilityId);
    if (!ability || !state) return false;

    this.sync(ability, state, now);
    if (state.available <= 0) return false;

    state.available--;
    // Recharging only starts when the first charge is spent; spending a second
    // charge does not restart the timer already running for the first.
    if (state.rechargeStartedAt === null) {
      state.rechargeStartedAt = now;
    }

    /*
     * Start the shared cooldown for everything in the group, including this
     * ability. Extends rather than overwrites, so a shorter cooldown used
     * while a longer one is running cannot cut it short.
     */
    if (ability.cooldownGroup) {
      const until = now + (ability.cooldownMs ?? 0);
      const existing = this.groupReadyAt.get(ability.cooldownGroup) ?? 0;
      this.groupReadyAt.set(ability.cooldownGroup, Math.max(existing, until));
    }
    return true;
  }

  /** Immediately restore every charge. For cooldown-reset effects and tests. */
  resetCooldown(abilityId: string): void {
    const ability = this.abilities.get(abilityId);
    const state = this.states.get(abilityId);
    if (!ability || !state) return;
    state.available = ability.charges ?? 1;
    state.rechargeStartedAt = null;
  }

  /** Advance recharge state to `now`. Idempotent. */
  private sync(ability: Ability, state: AbilityState, now: Milliseconds): void {
    const cooldown = ability.cooldownMs ?? 0;
    const maxCharges = ability.charges ?? 1;

    if (cooldown <= 0) {
      state.available = maxCharges;
      state.rechargeStartedAt = null;
      return;
    }

    while (
      state.rechargeStartedAt !== null &&
      state.available < maxCharges &&
      now >= state.rechargeStartedAt + cooldown
    ) {
      state.available++;
      state.rechargeStartedAt =
        state.available < maxCharges ? state.rechargeStartedAt + cooldown : null;
    }
  }
}
