import type { Ability, Milliseconds } from '../../engine';
import { seconds } from '../../engine';

/**
 * THE DUNGEON ROUTE -- the owner's timeline of pulls and the gaps between
 * them, as an encounter in place of one fixed fight.
 *
 * ============================================================================
 * TRANSCRIBED FROM THE OWNER'S LIST, IN ITS OWN TIMES. Each line was given as
 * `MM:SS:00`, start and end, and is kept as start and end here rather than as a
 * length, so a line can be checked against the message it came from. The two
 * are checked against each other by `dungeonRoute.test.ts`: every step starts
 * where the last ended and the route ends at 28:00.
 *
 * A PULL is `count` enemies of `level`, and `cooldowns` marks the owner's "Use
 * all available offensive cooldowns" -- the only pulls a major cooldown may be
 * spent in (`isHeldMajorCooldown`). A GAP is out of combat, and `drink` is the
 * owner's "Drink for mana", 165 mana a second on top of ordinary regeneration.
 * ============================================================================
 */
export type RouteStep =
  | {
      readonly kind: 'pull';
      readonly start: string;
      readonly end: string;
      readonly count: number;
      readonly level: number;
      readonly cooldowns: boolean;
    }
  | { readonly kind: 'gap'; readonly start: string; readonly end: string; readonly drink: boolean };

const pull = (start: string, end: string, count: number, level: number, cooldowns = false): RouteStep => ({
  kind: 'pull',
  start,
  end,
  count,
  level,
  cooldowns,
});
const gap = (start: string, end: string, drink = false): RouteStep => ({ kind: 'gap', start, end, drink });
const COOLDOWNS = true;
const DRINK = true;

export const DUNGEON_ROUTE: readonly RouteStep[] = [
  pull('00:00', '00:20', 7, 60),
  gap('00:20', '00:30'),
  pull('00:30', '01:00', 14, 60, COOLDOWNS),
  gap('01:00', '01:45', DRINK),
  pull('01:45', '02:30', 5, 60),
  gap('02:30', '02:40'),
  pull('02:40', '03:20', 6, 60),
  gap('03:20', '03:30'),
  pull('03:30', '04:00', 6, 60),
  gap('04:00', '04:15', DRINK),
  pull('04:15', '05:15', 1, 62, COOLDOWNS),
  gap('05:15', '06:15', DRINK),
  pull('06:15', '06:45', 5, 60),
  gap('06:45', '07:00'),
  pull('07:00', '07:30', 5, 60, COOLDOWNS),
  gap('07:30', '07:40', DRINK),
  pull('07:40', '08:00', 3, 60),
  gap('08:00', '08:10'),
  pull('08:10', '08:50', 7, 60),
  gap('08:50', '09:00'),
  pull('09:00', '10:00', 1, 62, COOLDOWNS),
  gap('10:00', '10:10', DRINK),
  pull('10:10', '10:30', 4, 60),
  gap('10:30', '10:40'),
  pull('10:40', '11:30', 7, 60, COOLDOWNS),
  gap('11:30', '11:50', DRINK),
  pull('11:50', '12:20', 5, 60),
  gap('12:20', '12:30'),
  pull('12:30', '12:45', 3, 60),
  gap('12:45', '13:00', DRINK),
  pull('13:00', '14:00', 1, 62, COOLDOWNS),
  gap('14:00', '14:15'),
  pull('14:15', '14:45', 5, 60),
  gap('14:45', '15:00', DRINK),
  pull('15:00', '15:30', 5, 60),
  gap('15:30', '15:40'),
  pull('15:40', '16:00', 2, 60),
  gap('16:00', '16:15', DRINK),
  pull('16:15', '17:00', 5, 60),
  gap('17:00', '17:10'),
  pull('17:10', '18:00', 3, 61, COOLDOWNS),
  gap('18:00', '19:00', DRINK),
  pull('19:00', '20:00', 3, 61, COOLDOWNS),
  gap('20:00', '20:20'),
  pull('20:20', '21:20', 3, 61),
  gap('21:20', '21:40', DRINK),
  pull('21:40', '22:40', 3, 61),
  gap('22:40', '23:00'),
  pull('23:00', '24:00', 1, 62, COOLDOWNS),
  gap('24:00', '25:00', DRINK),
  pull('25:00', '26:00', 6, 61),
  gap('26:00', '26:30', DRINK),
  pull('26:30', '28:00', 1, 63, COOLDOWNS),
];

/** `MM:SS` as milliseconds. */
export function routeTimeMs(time: string): Milliseconds {
  const match = /^(\d+):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Not a route time: "${time}"`);
  return seconds(Number(match[1]) * 60 + Number(match[2]));
}

/** The most enemies any pull has -- how many the route has to create. */
export const DUNGEON_ROUTE_MAX_ENEMIES = Math.max(
  ...DUNGEON_ROUTE.map((step) => (step.kind === 'pull' ? step.count : 0)),
);

/** The route's whole length. */
export const DUNGEON_ROUTE_DURATION_MS = routeTimeMs(DUNGEON_ROUTE[DUNGEON_ROUTE.length - 1]!.end);

/** What drinking adds, on top of ordinary out-of-combat regeneration. The owner's figure. */
export const DRINK_MANA_PER_SECOND = 165;

/**
 * Rage lost per second out of combat. The owner's figure: "1 Rage decays per
 * second when out of combat."
 */
export const RAGE_DECAY_PER_SECOND = 1;

/* ----------------------------------------------------------------------------
   Major cooldowns
   ---------------------------------------------------------------------------- */

/** The owner's definition of a major cooldown: two minutes or more. */
export const MAJOR_COOLDOWN_MS = seconds(120);

/**
 * An ability's cooldown if it is a major one, else undefined. The longer of its
 * own cooldown and any group lockout it starts -- a potion's two minutes are a
 * shared group -- read off the BUILT ability, so a talent that cuts a cooldown
 * under two minutes takes it out.
 */
export function majorCooldownMs(ability: Ability): Milliseconds | undefined {
  const cooldown = Math.max(ability.cooldownMs ?? 0, ability.cooldownGroupMs ?? 0);
  return cooldown >= MAJOR_COOLDOWN_MS ? cooldown : undefined;
}

/**
 * THE MAJOR COOLDOWNS A ROUTE DOES NOT HOLD, because they are not OFFENSIVE:
 * they restore mana or health, or mitigate damage. The owner's ruling was to
 * hold "damage ones only", and nothing on an ability says which kind it is, so
 * this list is kept by hand. `tools/probe_major_cooldowns.ts` prints every
 * major cooldown a preset carries beside whether it is held, which is the check
 * that a new one has been sorted.
 */
export const UNHELD_MAJOR_COOLDOWNS: ReadonlySet<string> = new Set<string>([
  // Mana.
  'major_mana_potion',
  'demonic_rune',
  'mana_ruby',
  'evocation',
  'innervate',
  'mana_tide_totem',
  // Health.
  'major_healing_potion',
  'healthstone',
  'frenzied_regeneration',
  // Mitigation.
  'last_stand',
  'shield_wall_cast',
  'templars_bulwark',
]);

/** Whether a route holds this ability outside the pulls that call for cooldowns. */
export function isHeldMajorCooldown(ability: Ability): boolean {
  return majorCooldownMs(ability) !== undefined && !UNHELD_MAJOR_COOLDOWNS.has(ability.id);
}
