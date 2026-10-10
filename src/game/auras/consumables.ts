import type { AuraDefinition } from '../../engine';
import { flat, seconds } from '../../engine';

/**
 * The auras the mid-fight consumables apply.
 *
 * ============================================================================
 * THREE OF THE NINE MID-FIGHT CONSUMABLES GRANT A TIMED BUFF, and the other six
 * restore a pool and are over. So this file is small on purpose: a consumable
 * that restores health, mana, rage or energy leaves nothing behind to track,
 * and giving it an aura so that the buff table had a row for it would be an
 * aura that reports uptime and does nothing.
 *
 * THAT IS NOT A HYPOTHETICAL FAILURE MODE HERE. Adrenaline Rush was cast, spent
 * its cooldown, applied its aura and reported 24.9% uptime for the whole life of
 * the project while delivering no energy at all -- "an inert buff with visible
 * uptime is the hardest kind to find, because the results page shows it
 * working". An aura applied for VISIBILITY is indistinguishable from one that
 * works, so there are exactly three here.
 *
 * AND THERE IS NO AURA FOR MAJOR MENDER'S POTION, which is the fourth
 * consumable that states a duration. "Grants 75 Healing Power for 30 seconds"
 * and healing power is not a stat this engine has -- so an aura for it would be
 * the exact mistake above, a 30-second row on the buff table carrying nothing.
 * It is declared `unmodelled` instead, in the source's own words, which is the
 * honest failure mode and the one the Food row's "+44 Healing Power" already
 * takes.
 *
 * EVERY NUMBER AND EVERY DURATION IS THE RULESET OWNER'S, from the same table
 * the other twelve consumable categories come from. Nothing here is Classic.
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Mighty Rage Potion
// ---------------------------------------------------------------------------

export const MIGHTY_RAGE_DURATION_MS = seconds(20);
export const MIGHTY_RAGE_STRENGTH = 60;

/**
 * "Increases Strength by 60 for 20 seconds", which is the half of the potion
 * that lasts.
 *
 * ----------------------------------------------------------------------------
 * A PRIMARY RATHER THAN ATTACK POWER, AND THAT IS WHAT MAKES IT WORTH DIFFERENT
 * AMOUNTS TO THE TWO CLASSES THAT CAN DRINK IT. `StatBlock` re-derives from a
 * function, so sixty strength arriving as a modifier reaches attack power
 * through the class's own conversion the way a buffed primary already does --
 * and Forever converts at 2 attack power a strength for a Warrior and a Druid.
 * Writing 120 attack power here instead would be the same number today and
 * would stop following the conversion table the day it moved.
 *
 * THE RAGE IS NOT HERE. "Restores 45 to 75 Rage" is instant, rolled per use and
 * gone, so it belongs in the ability's `onCast` beside the other five pool
 * restores rather than on an aura with a duration.
 * ----------------------------------------------------------------------------
 */
export const MIGHTY_RAGE_POTION_AURA: AuraDefinition = {
  id: 'mighty_rage_potion',
  name: 'Mighty Rage',
  durationMs: MIGHTY_RAGE_DURATION_MS,
  statModifiers: [flat('strength', MIGHTY_RAGE_STRENGTH)],
};

// ---------------------------------------------------------------------------
// Major Frenzy Potion
// ---------------------------------------------------------------------------

export const MAJOR_FRENZY_DURATION_MS = seconds(30);
export const MAJOR_FRENZY_ATTACK_POWER = 40;

/**
 * "Grants 40 Attack Power and Ranged Attack Power for 30 seconds."
 *
 * ----------------------------------------------------------------------------
 * BOTH POOLS, AND THE TABLE SAYS SO IN SO MANY WORDS -- which is the one entry
 * among these nine where the wording settles a question this project has
 * already got wrong twice. The "+40 Attack Power" ELIXIR says only "Attack
 * Power" and shipped as melee-only on the item precedent before the owner ruled
 * it feeds both; this row names the ranged pool explicitly, so there is nothing
 * to read into and nothing to ask.
 *
 * FLAT ATTACK POWER RATHER THAN A PRIMARY, unlike Mighty Rage above, because
 * the table says attack power. A Hunter reads all forty of the ranged half.
 * ----------------------------------------------------------------------------
 */
export const MAJOR_FRENZY_POTION_AURA: AuraDefinition = {
  id: 'major_frenzy_potion',
  name: 'Major Frenzy',
  durationMs: MAJOR_FRENZY_DURATION_MS,
  statModifiers: [
    flat('attackPower', MAJOR_FRENZY_ATTACK_POWER),
    flat('rangedAttackPower', MAJOR_FRENZY_ATTACK_POWER),
  ],
};

// ---------------------------------------------------------------------------
// Major Spellblasting Potion
// ---------------------------------------------------------------------------

export const MAJOR_SPELLBLASTING_DURATION_MS = seconds(30);
export const MAJOR_SPELLBLASTING_SPELL_POWER = 40;

/**
 * "Grants 40 Spell Power for 30 seconds."
 *
 * SCHOOL-BLIND, which is the plain reading and is also the only one available:
 * the table's six School Spell Power entries say which school they mean and
 * this one does not. `spellPower` is the school-blind pool every spell reads, so
 * forty of it reaches a Frostfire Bolt's frost half and its fire half alike.
 */
export const MAJOR_SPELLBLASTING_POTION_AURA: AuraDefinition = {
  id: 'major_spellblasting_potion',
  name: 'Major Spellblasting',
  durationMs: MAJOR_SPELLBLASTING_DURATION_MS,
  statModifiers: [flat('spellPower', MAJOR_SPELLBLASTING_SPELL_POWER)],
};

/**
 * The three, for the aura catalog.
 *
 * ----------------------------------------------------------------------------
 * OFFERED TO EVERY CLASS, the way the raid buffs are, and for the same reason:
 * a consumable belongs to no class, so narrowing this by class would be a
 * second, weaker copy of the gate the catalogue itself already carries. The
 * catalog is cached per class and cannot see a SELECTION at all, so the choice
 * is between offering these always and offering them never -- and a condition
 * on a buff a build has not chosen yet is a reasonable thing to write before
 * choosing it, where an id somebody has to guess is not.
 *
 * MIGHTY RAGE IS THE ONE EXCEPTION AND IT IS LEFT IN. Only a Warrior or a Druid
 * can drink it, so a Mage is offered a buff it can never carry -- which costs a
 * reader one line in a dropdown, against the alternative of threading a class
 * through a cache that has no room for one. The ABILITY is class-gated, which is
 * the gate that decides anything.
 * ----------------------------------------------------------------------------
 */
export const CATALOG_AURAS: readonly AuraDefinition[] = [
  MIGHTY_RAGE_POTION_AURA,
  MAJOR_FRENZY_POTION_AURA,
  MAJOR_SPELLBLASTING_POTION_AURA,
];
