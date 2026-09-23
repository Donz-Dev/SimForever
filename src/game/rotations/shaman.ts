import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { CombatStyleId } from '../character';

/**
 * Shaman priority lists — APL SHELLS.
 *
 * ----------------------------------------------------------------------------
 * SHELLS, AND SAID TO BE, exactly as the Rogue's and the Druid's are. These
 * are the standard shape of each build and are NOT the ruleset owner's own
 * lists, which have not been given for this class. Every Warrior list came
 * from the owner directly; a number measured off one of these describes this
 * file's guess.
 *
 * CHOSEN BY COMBAT STYLE, the Warrior's arrangement. An Elemental shaman
 * casts and an Enhancement one swings a two-hander, so the style already tells
 * them apart and nothing has to read the capstone the way the Rogue's three
 * dual-wield specs did.
 * ----------------------------------------------------------------------------
 */

/** Refresh a debuff when it is nearly gone, not on cooldown. */
const REFRESH_WINDOW_MS = 2000;

const missing = (auraId: string) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined &&
    target.auras.remainingMs(auraId, context.clock.now()) < REFRESH_WINDOW_MS;

const withoutAura = (auraId: string) => (_context: SimulationContext, actor: Combatant): boolean =>
  !actor.auras.has(auraId);

// ---------------------------------------------------------------------------

/**
 * ELEMENTAL — Flame Shock held up, Lava Burst on cooldown, Lightning Bolt as
 * the filler.
 *
 * FLAME SHOCK ABOVE LAVA BURST, AND THE ORDER IS LOAD-BEARING. Lava Burst
 * reads the target for Flame Shock at the moment it casts and is worth 20%
 * more when it finds it, so a list that put the burst first would quietly
 * throw that away on the opener and after every refresh.
 *
 * CHAIN LIGHTNING IS NOT HERE. It jumps to two further enemies and every
 * encounter in this project has one target, so all it does against a single
 * boss is cost 485 mana for less damage than a Lightning Bolt. Leaving it out
 * is the correct single-target list and its absence is not an oversight.
 *
 * EARTH SHOCK IS NOT HERE EITHER, for the opposite reason: it shares a
 * cooldown with Flame Shock in the shock school, and Flame Shock's twelve
 * seconds of burn beat one instant hit.
 */
export const SHAMAN_ELEMENTAL: readonly PriorityEntry[] = [
  { abilityId: 'flame_shock', condition: missing('flame_shock') },
  { abilityId: 'lava_burst' },
  { abilityId: 'lightning_bolt' },
];

/**
 * ENHANCEMENT — the imbue first, then Stormstrike, then shocks between swings.
 *
 * WINDFURY WEAPON IS THE FIRST ENTRY AND IS CAST EXACTLY ONCE. Its own
 * `canCast` refuses while the imbue is up, so this entry falls through for the
 * rest of the fight rather than needing a condition of its own -- but the
 * condition is written anyway, because a priority list that has to CAST an
 * ability to discover it cannot be cast is a wasted evaluation every tick.
 *
 * IT COSTS A GLOBAL COOLDOWN AND 165 MANA, paid at the pull. Assuming the
 * imbue instead would be a free buff, and Windfury is worth far too much to
 * hand over for nothing.
 *
 * EARTH SHOCK RATHER THAN FLAME SHOCK, which is the reverse of Elemental and
 * is Stormstrike's doing: Stormstrike leaves a debuff that raises the damage
 * of the next Lightning Bolt, Chain Lightning or EARTH SHOCK by 20%, and
 * Flame Shock is not on that list.
 */
export const SHAMAN_ENHANCEMENT: readonly PriorityEntry[] = [
  { abilityId: 'windfury_weapon', condition: withoutAura('windfury_weapon') },
  { abilityId: 'rage_of_the_farseer' },
  { abilityId: 'stormstrike' },
  { abilityId: 'earth_shock' },
];

export const SHAMAN_ELEMENTAL_ROTATION: Rotation = new PriorityRotation(
  'Shaman (Elemental)',
  SHAMAN_ELEMENTAL,
);
export const SHAMAN_ENHANCEMENT_ROTATION: Rotation = new PriorityRotation(
  'Shaman (Enhancement)',
  SHAMAN_ENHANCEMENT,
);

/** Which list a Shaman runs, from its combat style. */
export function shamanRotation(style: CombatStyleId): Rotation | undefined {
  if (style === 'caster') return SHAMAN_ELEMENTAL_ROTATION;
  if (style === 'two_hander') return SHAMAN_ENHANCEMENT_ROTATION;
  return undefined;
}
