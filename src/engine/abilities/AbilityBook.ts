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
   *
   * IT REMEMBERS WHICH ABILITY SET IT, because that ability is not bound by its
   * own lockout -- its own cooldown is. See `groupRemaining`, and
   * `Ability.cooldownGroupMs` for the one talent that makes the two differ.
   */
  private readonly groupReadyAt = new Map<
    string,
    { readonly until: Milliseconds; readonly byAbilityId: string }
  >();

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

  /**
   * Put every ability back on full charges, optionally sparing one.
   *
   * ----------------------------------------------------------------------------
   * "IMMEDIATELY FINISHES THE COOLDOWN ON YOUR OTHER ROGUE ABILITIES", which is
   * Preparation and which nothing could express: a cooldown lives here and
   * content reaches it through nothing at all. Its `unmodelled` reason said
   * exactly that -- "nothing can reset a cooldown from content; the engine owns
   * them" -- and this is the engine saying so.
   *
   * `exceptId` IS THE WHOLE POINT OF THE ARGUMENT. Preparation is not one of
   * "your OTHER abilities", and a reset that included itself would put a ten
   * minute cooldown back up instantly and hand the character an infinite
   * supply of them. That failure is not visible in a DPS figure; it is visible
   * as a suspiciously good Rogue.
   *
   * SHARED GROUPS ARE CLEARED TOO, and only the groups the reset abilities
   * belong to. Clearing every group would reach a group whose other member was
   * spared, which is a rule nobody stated.
   *
   * ----------------------------------------------------------------------------
   * `only` IS WHICH ABILITIES THE CALLER IS ENTITLED TO RESET, and it exists
   * because "your other ROGUE abilities" turned out to be narrower than "every
   * ability in the book".
   *
   * A BOOK HOLDS MORE THAN A CLASS'S OWN ABILITIES NOW. A racial is learned by a
   * RACE and a potion by DRINKING one, and both are appended to the same book --
   * so an unrestricted reset handed a Rogue a second Thistle Tea, which is a
   * five minute cooldown fired TWICE in a sixty second fight. Measured at two
   * casts a fight on both Subtlety profiles, and worth about thirty DPS of
   * inflation: a bigger number and no error.
   *
   * THE ENGINE CANNOT ANSWER "is this a Rogue ability" and must not try -- it
   * knows nothing about classes. So the CALLER passes the set it owns, which
   * keeps the rule here ("reset these, if the book has them") and the content
   * question in content. Omitted means every ability, which is what the only
   * caller used to get and is still the right default for a reset that genuinely
   * covers everything.
   * ----------------------------------------------------------------------------
   */
  resetCooldowns(exceptId?: string, only?: ReadonlySet<string>): void {
    for (const [id, ability] of this.abilities) {
      if (id === exceptId) continue;
      if (only && !only.has(id)) continue;
      const state = this.states.get(id);
      if (state) {
        state.available = ability.charges ?? 1;
        state.rechargeStartedAt = null;
      }
      if (ability.cooldownGroup) this.groupReadyAt.delete(ability.cooldownGroup);
    }
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
    const entry = this.groupReadyAt.get(group);
    if (!entry) return 0;
    /*
     * THE ABILITY THAT SET THE LOCKOUT IS NOT BOUND BY IT -- its OWN cooldown
     * is, and `isReady` checks that separately.
     *
     * This matters only when the two differ, which is only when something
     * declares `cooldownGroupMs`: Arcane Shot imposes six seconds on Summon
     * Hawk while coming back in four and a half itself. For every other group
     * the two numbers are equal and this changes nothing -- a potion, a shock
     * or a stance is still held by its own cooldown for exactly as long.
     */
    if (entry.byAbilityId === abilityId) return 0;
    return Math.max(0, entry.until - now);
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

  /**
   * Treat a cooldown as having started `byMs` earlier than it did.
   *
   * ----------------------------------------------------------------------------
   * FOR A PRE-COMBAT CAST AND NOTHING ELSE. "Use Stealth <= 2 sec before combat
   * initiates" means the two seconds have already gone by the time the fight
   * starts, and on the owner's ruling that is real: the cooldown comes back two
   * seconds sooner.
   *
   * IT MOVES THE START RATHER THAN THE REMAINDER, which is what makes it
   * compose with everything else the book does. `cooldownRemaining` reads
   * `rechargeStartedAt + cooldown - now`, and a charge system recharges from
   * that same instant -- so rewinding the start is "it happened earlier" in
   * every reading, where subtracting from a remainder would be a one-off nudge
   * that a recharge would then undo.
   *
   * CLAMPED AT THE PRESENT. A cooldown rewound past its own length is simply
   * ready, and `sync` will hand the charge back on the next read -- which is
   * correct for an ability used long enough before the pull.
   * ----------------------------------------------------------------------------
   */
  rewindCooldown(abilityId: string, byMs: Milliseconds): void {
    const state = this.states.get(abilityId);
    if (!state || state.rechargeStartedAt === null) return;
    state.rechargeStartedAt -= byMs;
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
      // `cooldownGroupMs` is what this ability imposes on the OTHERS, and
      // defaults to its own cooldown. See `Ability.cooldownGroupMs`.
      const until = now + (ability.cooldownGroupMs ?? ability.cooldownMs ?? 0);
      const existing = this.groupReadyAt.get(ability.cooldownGroup);
      if (!existing || until >= existing.until) {
        this.groupReadyAt.set(ability.cooldownGroup, { until, byAbilityId: abilityId });
      }
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
