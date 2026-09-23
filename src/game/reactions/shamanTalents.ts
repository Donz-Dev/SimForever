import { isWeaponUse } from '../../engine';
import type { TalentReactionBuilder } from './warriorTalents';
import { flurry } from './warriorTalents';
import { elementalDevastationAura, maelstromWeaponAura } from '../auras/shaman';

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
 * Maelstrom Weapon: melee damage stacks a discount on the next Lightning Bolt.
 *
 * ----------------------------------------------------------------------------
 * LIVE NOW, and it carries the one number in this class that nobody has.
 *
 * THE TOOLTIP STATES NO PROC CHANCE. "When you deal damage with a melee
 * attack, you have A CHANCE to reduce the cast time and Mana cost of your next
 * Lightning Bolt spell by {0}%." The `{0}` is the REDUCTION -- 4, 8, 12, 16,
 * 20 by rank -- and the chance has no placeholder and no value anywhere in the
 * client data.
 *
 * WHICH IS A BUG THIS FILE ALREADY SHIPPED. The first version passed
 * `talentNumber(...)` straight in as `chancePercent`, so the reduction was
 * being rolled as the chance: a 20% proc rate that happened to look completely
 * ordinary, because 20% IS an ordinary proc rate. The aura did nothing at the
 * time, so it moved no damage -- only the stack uptime on the results page --
 * but the moment the aura started working it would have been wrong.
 *
 * So the chance is a PLACEHOLDER, named, and printed where a person can see
 * it. The reduction is read from the talent, at index 0, which is where it
 * actually lives.
 * ----------------------------------------------------------------------------
 */

/**
 * UNVERIFIED, AND ONE LINE FROM THE RULESET OWNER WOULD SETTLE IT.
 *
 * Not borrowed from Classic, because Classic has no Maelstrom Weapon to borrow
 * from -- it is a later-expansion talent that Forever has brought back, and
 * the version it resembles procced on a per-minute rate rather than a flat
 * chance. Inventing either shape would be inventing game data.
 *
 * Twenty percent is chosen to be VISIBLY a round number rather than a derived
 * one, so it reads as the placeholder it is. The talent prints this caveat on
 * the results page.
 */
export const PLACEHOLDER_MAELSTROM_WEAPON_PROC_CHANCE = 20;

export const MAELSTROM_WEAPON_UNMODELLED =
  'Its proc chance is a PLACEHOLDER. The tooltip states the reduction and ' +
  'says only "a chance" for the rate, and no value for it exists in the ' +
  'client data, so ' +
  `${PLACEHOLDER_MAELSTROM_WEAPON_PROC_CHANCE}% is assumed and unverified. ` +
  'The reduction itself, the five stacks and the thirty seconds are the ' +
  "source's own.";

export const maelstromWeapon: TalentReactionBuilder = (reductionPercentPerStack) => ({
  id: 'maelstrom_weapon',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance', 'crush'],
  canTrigger: (context, _actor, attack) =>
    isWeaponUse(attack) &&
    context.rng.rollChance(PLACEHOLDER_MAELSTROM_WEAPON_PROC_CHANCE / 100),
  onTrigger: (context, actor) => {
    // `applyAura` adds a stack itself, up to `maxStacks`, and resets the
    // thirty seconds. Setting `stacks` here as well would count every proc
    // twice -- which the Warrior's Flurry does deliberately and this must not.
    context.applyAura(actor, maelstromWeaponAura(reductionPercentPerStack), actor.id);
  },
});

export const SHAMAN_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  flurry,
  elemental_devastation: elementalDevastation,
  maelstrom_weapon: maelstromWeapon,
};
