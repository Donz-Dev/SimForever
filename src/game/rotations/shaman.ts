import type { Rotation } from '../../engine';
import type { AplList } from './apl';
import { RACIAL_COOLDOWNS } from './racialCooldowns';
import { CONSUMABLE_COOLDOWNS, CONSUMABLE_HEALS } from './consumableCooldowns';
import { compileRotation, selfMissing, selfStacks, targetExpired, targetTime } from './apl';
import type { CombatStyleId } from '../character';
import { MAELSTROM_WEAPON_MAX_STACKS } from '../auras/shaman';

/**
 * Shaman priority lists.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S OWN LISTS. Every list in this file was specified by them,
 * entry by entry, and measured after -- so a number taken off one describes the
 * ruleset rather than this file's guess.
 *
 * IT SAID THE OPPOSITE FOR MOST OF THIS PROJECT'S LIFE, and the header that
 * said so was doing real work: "these are the standard shape of each build and
 * are NOT the ruleset owner's own lists, which have not been given." That is
 * how a shell is supposed to read, and it is why the figures measured off one
 * were never mistaken for the ruleset's.
 *
 * CHOSEN BY COMBAT STYLE, the Warrior's arrangement. An Elemental shaman
 * casts and an Enhancement one swings a two-hander, so the style already tells
 * them apart and nothing has to read the capstone the way the Rogue's three
 * dual-wield specs did.
 * ----------------------------------------------------------------------------
 */

/**
 * "IF NOT ACTIVE", which is the ruleset owner's wording and is NOT the same as
 * the two-second refresh window beside it.
 *
 * ----------------------------------------------------------------------------
 * A REFRESH RESETS THE AURA, so anything left on the clock when the rotation
 * reaches the entry is thrown away. A two-second window clips up to two
 * seconds off every application -- and the faster the character acts, the
 * sooner it reaches the entry inside that window and the more it loses.
 *
 * MEASURED ON THE MOONKIN, where Nature's Grace cost 14.9 DPS by doing nothing
 * but speeding the character up: casts went 26.3 a fight to 27.4 while Moonfire
 * ticks fell 25.1 to 22.5. The buff was fine; the window was paying for it.
 *
 * BOTH SHAMAN LISTS ARE THE OWNER'S NOW, so nothing in this file uses the
 * window any more -- the reading is recorded here rather than kept alive in
 * code that no longer needs it.
 * ----------------------------------------------------------------------------
 */
const expired = targetExpired;

/** "<debuff> duration > N seconds", on the target. */
const targetAuraAtLeast = (auraId: string, secondsLeft: number) =>
  targetTime('atLeast', secondsLeft, auraId);

const withoutAura = selfMissing;

const atStacks = (auraId: string, stacks: number) => selfStacks('atLeast', stacks, auraId);

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
 *
 * ----------------------------------------------------------------------------
 * SEARING TOTEM IS THE FOURTH ENTRY AND IT IS WORTH +59.5, which is the largest
 * single rotation finding in this class and one of the largest in the project.
 *
 * THE LIST RAN WITHOUT IT FOR ITS WHOLE LIFE. Three entries, all of them nukes,
 * no totem at all -- and the build spends 3/3 on CALL OF FLAME, whose first
 * clause is "increases the damage done by your FIRE TOTEMS". Three talent points
 * were buying a clause the rotation could never reach, and nothing said so: a
 * talent that works perfectly on an ability nobody casts is worth zero and
 * reports nothing.
 *
 * MEASURED, THEN RULED ON. 315.5 to 375.0 on 30 batches of 10, and the ruleset
 * owner added the entry on 2026-09-30 having been shown the figure. It is their
 * list; the measurement only put a number beside the choice.
 *
 * ABOVE LIGHTNING BOLT, BELOW LAVA BURST. The bolt is this list's unconditional
 * filler, so anything below it can never be the first castable entry -- the
 * floor rule, which is what made Fire Nova inert when it was tried there. Above
 * Lava Burst would cost a burst cast at the pull for a totem that lasts 55
 * seconds either way.
 *
 * FIRE NOVA IS DELIBERATELY NOT HERE, and it was measured rather than reasoned
 * about: below the bolt it fired ZERO times and the figure was 375.0 to the
 * decimal, and above the bolt it measured 332.0 -- a 43-point loss, because 520
 * mana on a six-second cycle starves the filler. Enhancement casts it and
 * Elemental does not, which is a mana question rather than a damage one.
 * ----------------------------------------------------------------------------
 */
export const SHAMAN_ELEMENTAL: AplList = {
  name: 'Shaman (Elemental)',
  entries: [
  { abilityId: 'flame_shock', condition: expired('flame_shock') },
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_COOLDOWNS,
  ...CONSUMABLE_HEALS,
  { abilityId: 'lava_burst' },
  { abilityId: 'searing_totem', condition: expired('searing_totem') },
  { abilityId: 'lightning_bolt' },
  ],
};

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
export const SHAMAN_ENHANCEMENT: AplList = {
  name: 'Shaman (Enhancement)',
  entries: [
  { abilityId: 'windfury_weapon', condition: withoutAura('windfury_weapon') },
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_COOLDOWNS,
  ...CONSUMABLE_HEALS,
  /*
   * LIGHTNING BOLT AT FIVE MAELSTROM STACKS, AND ONLY THERE.
   *
   * This entry was missing, which made the Enhancement capstone worth exactly
   * nothing: Maelstrom Weapon shortens the next Lightning Bolt and the list
   * never cast one. The talent stacked to five and sat there.
   *
   * At five stacks the bolt is INSTANT and free -- 20% a stack, five stacks --
   * so it costs a global cooldown and no swing time. Below five it is a
   * 2.5-second cast on a character whose damage is its swings, which is why
   * the threshold is the cap rather than anything lower.
   */
  { abilityId: 'lightning_bolt', condition: atStacks('maelstrom_weapon', MAELSTROM_WEAPON_MAX_STACKS) },
  { abilityId: 'stormstrike' },
  { abilityId: 'flame_shock', condition: expired('flame_shock') },
  /*
   * SEARING TOTEM HELD UP. It is a damage-over-time effect here rather than an
   * entity, by the ruleset owner's ruling, so "if not active" is the same
   * question every other bleed in this project answers -- and its 55 seconds
   * mean one cast covers almost the whole fight.
   */
  { abilityId: 'searing_totem', condition: expired('searing_totem') },
  { abilityId: 'rage_of_the_farseer' },
  /*
   * EARTH SHOCK ONLY WHILE FLAME SHOCK HAS TIME LEFT, which is the owner's
   * condition and is the reason the two can share a cooldown without the
   * second one clobbering the first. The shocks are one cooldown group now:
   * spending it on Earth Shock while Flame Shock is about to drop would cost
   * the burn as well as the hit.
   */
  { abilityId: 'earth_shock', condition: targetAuraAtLeast('flame_shock', 3) },
  /*
   * FIRE NOVA AT THE BOTTOM, which is where the ruleset owner put it when asked
   * on 2026-09-30 -- the list was theirs and had seven entries, and this is the
   * eighth.
   *
   * IT NEEDS NO CONDITION AND THAT IS NOT AN OVERSIGHT. Fire Nova's own
   * `canCast` refuses unless a fire totem is up, so the Searing Totem entry
   * three lines above is what gates it, and its ten-second cooldown (six with
   * this build's 2/2 Improved Fire Nova) is what paces it. Writing the totem
   * check into the entry as well would be two copies of one rule.
   *
   * BOTTOM MEANS IT ONLY FIRES WHEN NOTHING ELSE IS READY, and at 520 mana it is
   * the most expensive thing this build casts -- so its real cost is the mana
   * that Stormstrike and the shocks above it would otherwise spend. That is why
   * a measurement and not an argument decides whether it pays: see the figures
   * in docs/handoff/shaman.md.
   */
  { abilityId: 'fire_nova' },
  ],
};

export const SHAMAN_ELEMENTAL_ROTATION: Rotation = compileRotation(SHAMAN_ELEMENTAL);
export const SHAMAN_ENHANCEMENT_ROTATION: Rotation = compileRotation(SHAMAN_ENHANCEMENT);

/** Which list a Shaman runs, from its combat style. */
export function shamanRotation(style: CombatStyleId): Rotation | undefined {
  if (style === 'caster') return SHAMAN_ELEMENTAL_ROTATION;
  if (style === 'two_hander') return SHAMAN_ENHANCEMENT_ROTATION;
  return undefined;
}
