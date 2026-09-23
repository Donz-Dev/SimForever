import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { CombatStyleId } from '../character';
import { MAX_COMBO_POINTS, comboPointsOn } from '../combat/comboPoints';

/**
 * Druid priority lists — APL SHELLS.
 *
 * ----------------------------------------------------------------------------
 * SHELLS, AND SAID TO BE, exactly as the Rogue's are. These are the standard
 * shape of each build and are NOT the ruleset owner's own lists, which have not
 * been given. Every Warrior list came from the owner directly, and a number
 * measured off one of these describes this file's guess.
 *
 * CHOSEN BY FORM, not by talents. A Druid's form IS its combat style, and a
 * style is a field on the character -- so unlike the Rogue, whose three specs
 * are all dual-wield and had to be told apart by their capstone, this is the
 * Warrior's arrangement: the style selects the list.
 * ----------------------------------------------------------------------------
 */

/** Refresh a debuff when it is nearly gone, not on cooldown. */
const REFRESH_WINDOW_MS = 2000;

const missing = (auraId: string) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined &&
    target.auras.remainingMs(auraId, context.clock.now()) < REFRESH_WINDOW_MS;

const atFive = (_context: SimulationContext, actor: Combatant): boolean =>
  comboPointsOn(actor) >= MAX_COMBO_POINTS;

// ---------------------------------------------------------------------------

/**
 * MOONKIN — two damage-over-time effects held up, then Starfire.
 *
 * Starfire is 350-412 for 340 mana on a 3.5 second cast; Wrath is 62-68 for 120
 * on a 2 second one. Starfire is far better per cast AND per mana, so Wrath
 * appears only as the filler that keeps Eclipse stacking -- which currently
 * stacks and does nothing, and says so.
 */
export const DRUID_MOONKIN: readonly PriorityEntry[] = [
  { abilityId: 'moonfire', condition: missing('moonfire') },
  { abilityId: 'insect_swarm', condition: missing('insect_swarm') },
  { abilityId: 'starfire' },
  { abilityId: 'wrath' },
];

/**
 * CAT — Rake and Rip held up, Ferocious Bite otherwise, Shred as the builder.
 *
 * SHRED IS THE BUILDER DESPITE ITS POSITIONAL REQUIREMENT, which this project
 * drops because nothing here has a facing. That is generous to the build and
 * the ability says so where it is declared.
 *
 * RIP ABOVE FEROCIOUS BITE. Rip at five points is 855 over twelve seconds for
 * 30 energy; Bite is 817 plus whatever the energy bar converts, for 35 and the
 * whole bar. Holding the bleed up is worth more than a burst that empties the
 * resource the rest of the list runs on.
 */
export const DRUID_CAT: readonly PriorityEntry[] = [
  { abilityId: 'tigers_fury' },
  { abilityId: 'rake', condition: missing('rake') },
  { abilityId: 'rip', condition: (context, actor, target) =>
      atFive(context, actor) && missing('rip')(context, actor, target) },
  { abilityId: 'ferocious_bite', condition: atFive },
  { abilityId: 'shred' },
  // Falls back when Shred is unaffordable, which at 60 energy it often is.
  { abilityId: 'claw' },
];

/**
 * BEAR — Mangle on cooldown, Lacerate held up, Maul as the rage dump.
 *
 * MAUL IS LAST AND IS NOT A GLOBAL COOLDOWN. It replaces the next swing rather
 * than taking a cast, exactly as the Warrior's Heroic Strike does, so putting
 * it at the bottom costs the entries above it nothing.
 */
export const DRUID_BEAR: readonly PriorityEntry[] = [
  { abilityId: 'demoralizing_roar', condition: missing('demoralizing_roar') },
  { abilityId: 'mangle' },
  { abilityId: 'lacerate', condition: missing('lacerate') },
  { abilityId: 'swipe' },
  { abilityId: 'maul' },
];

export const DRUID_MOONKIN_ROTATION: Rotation = new PriorityRotation(
  'Druid (Moonkin)',
  DRUID_MOONKIN,
);
export const DRUID_CAT_ROTATION: Rotation = new PriorityRotation('Druid (Cat)', DRUID_CAT);
export const DRUID_BEAR_ROTATION: Rotation = new PriorityRotation('Druid (Bear)', DRUID_BEAR);

/** Which list a Druid runs, from the form it is in. */
export function druidRotation(style: CombatStyleId): Rotation | undefined {
  if (style === 'moonkin') return DRUID_MOONKIN_ROTATION;
  if (style === 'cat') return DRUID_CAT_ROTATION;
  if (style === 'bear') return DRUID_BEAR_ROTATION;
  // Caster and Tree of Life have no damage list worth the name.
  return undefined;
}
