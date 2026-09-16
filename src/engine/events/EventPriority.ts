/**
 * Tie-breaker for events scheduled at the exact same millisecond.
 *
 * Sub-second collisions are common (a DoT tick, a buff expiring and a swing
 * all landing on 12000ms), and the order they resolve in changes the result.
 * A lower number executes first.
 *
 * The ordering encodes two deliberate rules:
 *
 *   1. Anything already scheduled for time T happens at T, and auras that
 *      expire at T are still present while it does. This is why Periodic sorts
 *      before AuraExpiration: a 12-second DoT ticking every 3 seconds has its
 *      final tick due at exactly the moment it falls off, and that tick must
 *      land. Ordering expiry first would silently eat it.
 *
 *   2. State settles before anyone decides what to do next. Decision sorts
 *      last, so an actor choosing its next ability is always looking at fully
 *      resolved state rather than a half-applied instant.
 *
 * Events with the same timestamp AND the same priority run in the order they
 * were scheduled (FIFO). See EventQueue for how that is enforced.
 */
export const EventPriority = {
  /** Combat start and end. Must bracket everything else at its timestamp. */
  Boundary: 0,
  /** DoT / HoT ticks and other periodic aura effects. See rule 1 above. */
  Periodic: 10,
  /** Auras falling off, after any tick they owed at this timestamp. */
  AuraExpiration: 20,
  /** A cast finishing and its effect landing. */
  CastComplete: 30,
  /** Auto-attack swings. */
  AutoAttack: 40,
  /** Resource regeneration ticks. */
  Regeneration: 50,
  /** An actor choosing its next action. Deliberately last. See rule 2 above. */
  Decision: 60,
} as const;

export type EventPriority = (typeof EventPriority)[keyof typeof EventPriority];
