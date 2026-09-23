import { isWeaponUse } from '../../engine';
import type { TalentReactionBuilder } from './warriorTalents';
import { flurry } from './warriorTalents';
import {
  MAELSTROM_WEAPON,
  elementalDevastationAura,
} from '../auras/shaman';

/**
 * Shaman talent procs.
 *
 * ----------------------------------------------------------------------------
 * FLURRY IS THE WARRIOR'S, REUSED RATHER THAN RETYPED. Both read "increases
 * your attack speed by {0}% for your next 3 swings after dealing a melee
 * critical strike" -- the same effect at a different percentage, which is
 * exactly what a `TalentReactionBuilder` takes. Copying it would have been two
 * files to keep in step, and the copy would be the one that went stale.
 *
 * The builder is per-class-registry-keyed, so the Shaman's five ranks reach
 * the same code with 25 where a Warrior's reach it with 30.
 * ----------------------------------------------------------------------------
 */

/**
 * Elemental Devastation: a spell crit raises MELEE crit.
 *
 * THE TRIGGER IS A SPELL AND THE PAYOUT IS MELEE, which is why the usual
 * `isWeaponUse` test is inverted here: this is the one reaction in the project
 * that fires on something that is NOT a weapon use. A Stormstrike crit does
 * not arm it; a Lightning Bolt crit does.
 *
 * "Offensive spell critical strikes" -- so a periodic tick of Flame Shock
 * counts, because it crits off the spell table and is offensive. Nothing here
 * excludes it and nothing in the tooltip does either.
 */
export const elementalDevastation: TalentReactionBuilder = (critPercent) => ({
  id: 'elemental_devastation',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) => !isWeaponUse(attack),
  onTrigger: (context, actor) => {
    context.applyAura(actor, elementalDevastationAura(critPercent), actor.id);
  },
});

/**
 * Maelstrom Weapon, TRACKED AND INERT.
 *
 * The stacks are real -- rolled at the stated chance off a melee use, capped
 * at five, refreshed to thirty seconds -- and they buy nothing, because the
 * cast-time reduction they exist for has no declaration. See
 * `MAELSTROM_WEAPON_UNMODELLED` in `auras/shaman.ts`.
 *
 * Applied anyway so the capstone has visible uptime rather than being silent,
 * which is the same decision Eclipse carries on the Druid. A talent that does
 * nothing and SAYS SO is the honest failure mode; one that does nothing
 * quietly is the bug this project keeps finding.
 */
export const maelstromWeapon: TalentReactionBuilder = (chancePercent) => ({
  id: 'maelstrom_weapon',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance', 'crush'],
  canTrigger: (context, _actor, attack) =>
    isWeaponUse(attack) && context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    // `applyAura` adds a stack itself, up to `maxStacks`, and resets the
    // thirty seconds. Setting `stacks` here as well would count every proc
    // twice -- which the Warrior's Flurry does deliberately and this must not.
    context.applyAura(actor, MAELSTROM_WEAPON, actor.id);
  },
});

export const SHAMAN_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  flurry,
  elemental_devastation: elementalDevastation,
  maelstrom_weapon: maelstromWeapon,
};
