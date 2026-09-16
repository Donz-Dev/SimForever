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

  /** True if at least one charge is up. */
  isReady(abilityId: string, now: Milliseconds): boolean {
    return this.chargesAvailable(abilityId, now) > 0;
  }

  /** Time until the next charge becomes available. 0 when one is already up. */
  cooldownRemaining(abilityId: string, now: Milliseconds): Milliseconds {
    const ability = this.abilities.get(abilityId);
    const state = this.states.get(abilityId);
    if (!ability || !state) return 0;

    this.sync(ability, state, now);
    if (state.available > 0 || state.rechargeStartedAt === null) return 0;

    const cooldown = ability.cooldownMs ?? 0;
    return Math.max(0, state.rechargeStartedAt + cooldown - now);
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
