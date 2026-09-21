import type { CombatStyleId } from './ids';

/**
 * The stance a Warrior fights in.
 *
 * ----------------------------------------------------------------------------
 * A CHOICE THE PLAYER MAKES, not one the rotation optimises.
 *
 * Stance gating made several abilities unreachable unless the rotation swapped
 * for them, and a rotation that swaps whenever something in another stance
 * looks castable is a bad rotation: it spent 540 rage a fight changing stance,
 * and Defensive Stance's own -10% damage done applied to everything it did in
 * between.
 *
 * Rather than teach the rotation to weigh a swap against what it buys, the
 * stance is picked up front. A dual-wielder that STARTS in Berserker already
 * has Whirlwind and Recklessness; a shield warrior that starts in Defensive
 * already has Revenge, Shield Slam and Shield Wall. Most of the dancing was
 * the character beginning in the wrong place.
 *
 * The rotation can still swap, and will for the few abilities outside the
 * chosen stance. It simply has far less reason to.
 * ----------------------------------------------------------------------------
 */
export type StanceId = 'battle' | 'defensive' | 'berserker';

export interface StanceDefinition {
  readonly id: StanceId;
  readonly name: string;
  /** The aura id this stance applies. Matches `game/auras/warrior.ts`. */
  readonly auraId: string;
  /** What it does, for the person choosing. */
  readonly effect: string;
}

export const STANCES: readonly StanceDefinition[] = [
  {
    id: 'battle',
    name: 'Battle Stance',
    auraId: 'battle_stance',
    effect: 'No bonus or penalty',
  },
  {
    id: 'defensive',
    name: 'Defensive Stance',
    auraId: 'defensive_stance',
    effect: '−10% damage done, −10% damage taken',
  },
  {
    id: 'berserker',
    name: 'Berserker Stance',
    auraId: 'berserker_stance',
    effect: '+3% crit, +10% damage taken',
  },
];

const BY_ID = new Map<StanceId, StanceDefinition>(STANCES.map((stance) => [stance.id, stance]));

export function getStance(id: StanceId): StanceDefinition | undefined {
  return BY_ID.get(id);
}

/**
 * The stance a combat style opens in unless the player picks another.
 *
 * Chosen by the ruleset owner, and each one is the stance that build actually
 * wants: a two-hander for the neutral stance, a dual-wielder for the crit, a
 * shield for the abilities that need Defensive.
 *
 * A DEFAULT, not a rule. Picking Defensive on a dual-wielder is a legitimate
 * thing to want to measure, and nothing stops it.
 */
const DEFAULT_BY_STYLE: Partial<Record<CombatStyleId, StanceId>> = {
  two_hander: 'battle',
  dual_wield: 'berserker',
  one_hand_shield: 'defensive',
};

export function defaultStanceFor(style: CombatStyleId | undefined): StanceId {
  return (style && DEFAULT_BY_STYLE[style]) ?? 'battle';
}

/**
 * The stance to actually use, given what a profile asked for.
 *
 * Falls back to the style's default rather than throwing, so a profile written
 * before stances existed -- or one carrying a stance id this build does not
 * know -- opens somewhere sensible instead of nowhere. A Warrior in no stance
 * cannot cast Overpower, Rend, Execute, Thunder Clap, Hamstring or Charge.
 */
/**
 * Whether a build is TANKING: a shield, in Defensive Stance.
 *
 * Named once because three things key off it and they must not drift -- the
 * encounter defaulting to a target that swings back, the character sheet
 * showing defensive rows, and the results showing what was mitigated.
 *
 * Both halves are required. A shield warrior in Berserker Stance is a damage
 * build holding a shield, and a two-hander in Defensive is a damage build
 * paying ten percent for nothing; neither is what the defensive numbers are
 * for.
 */
export function isTankBuild(
  style: CombatStyleId | undefined,
  stance: StanceId | undefined,
): boolean {
  return style === 'one_hand_shield' && resolveStance(style, stance) === 'defensive';
}

export function resolveStance(
  style: CombatStyleId | undefined,
  requested: StanceId | undefined,
): StanceId {
  return requested && BY_ID.has(requested) ? requested : defaultStanceFor(style);
}
