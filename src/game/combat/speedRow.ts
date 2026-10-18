/**
 * A per-swing figure the owner states at TWO weapon speeds -- a 1.3 and a 4.0
 * BASE speed -- with "a linear relationship between those points".
 *
 * Seal of Righteousness's base, Flametongue Totem and Flametongue Weapon are
 * all stated this way, so the shape lives once.
 *
 * ----------------------------------------------------------------------------
 * CLAMPED OUTSIDE THE TWO POINTS rather than extended. The owner gave two
 * points and a line between them; continuing the line past either end is a
 * number nobody stated, and a held weapon slower than 4.0 or faster than 1.3 is
 * rare enough that the clamp is the honest reading. Said here so a reader
 * meeting a 1.2-speed dagger knows which choice was made.
 * ----------------------------------------------------------------------------
 */
export const SPEED_ROW_MIN_SPEED = 1.3;
export const SPEED_ROW_MAX_SPEED = 4.0;

export function linearBySpeed(speedSeconds: number, atMin: number, atMax: number): number {
  const clamped = Math.min(SPEED_ROW_MAX_SPEED, Math.max(SPEED_ROW_MIN_SPEED, speedSeconds));
  const t = (clamped - SPEED_ROW_MIN_SPEED) / (SPEED_ROW_MAX_SPEED - SPEED_ROW_MIN_SPEED);
  return atMin + (atMax - atMin) * t;
}
