import type { Rotation } from '../../engine';
import type { AplList } from './apl';
import { RACIAL_COOLDOWNS } from './racialCooldowns';
import {
  buffPotionCooldown,
  consumableCooldowns,
  CONSUMABLE_COOLDOWNS,
  CONSUMABLE_HEALS,
} from './consumableCooldowns';
import {
  compileRotation,
  selfMissing,
  selfStacks,
  targetExpired,
  targetHas,
  targetTime,
} from './apl';
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

/** "<debuff> is on the target" -- `auras.has`, not a reading of the clock. */
const hasDebuff = targetHas;

// ---------------------------------------------------------------------------

/**
 * ELEMENTAL — Flame Shock held up, Lava Burst on cooldown, Lightning Bolt as
 * the filler.
 *
 * FLAME SHOCK ABOVE LAVA BURST, AND IT IS A CLAUSE NOW RATHER THAN AN ORDER.
 * Lava Burst reads the target for Flame Shock at the moment it casts and is
 * worth 20% more when it finds it -- which the order alone guaranteed only
 * while nothing could sit between the two entries, and the owner's racial block
 * now does. `lava_burst` carries the condition itself, so the guarantee no
 * longer depends on what a later edit puts in between.
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
 * SEARING TOTEM IS WORTH +59.5, which is the largest single rotation finding in
 * this class and one of the largest in the project.
 *
 * IT WAS "THE FOURTH ENTRY" AND IS THE FIRST DAMAGE ENTRY NOW, by the owner's
 * reorder -- a position is a dated fact like any other figure, and naming one in
 * a header is how a header goes stale without anybody touching it.
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
 * ABOVE LIGHTNING BOLT, AND NOW ABOVE LAVA BURST TOO. The bolt is this list's
 * unconditional filler, so anything below it can never be the first castable
 * entry -- the floor rule, which is what made Fire Nova inert when it was tried
 * there, and it is unchanged.
 *
 * WHAT CHANGED IS THE UPPER BOUND. This file argued that "above Lava Burst
 * would cost a burst cast at the pull for a totem that lasts 55 seconds either
 * way", and the owner has put it there: the trade is one Lava Burst delayed by
 * a global cooldown once a fight against 55 seconds of totem starting that much
 * sooner, and the same argument reads either way round. It is their list, and
 * the measurement is what says what the swap cost.
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
  /*
   * ==========================================================================
   * THE SPELLBLASTING POTION OPENS THE LIST, which is the owner's order and is
   * the only list in the project where a consumable is the first entry.
   *
   * IT IS SAFE HERE FOR THE REASON THE TOP WAS UNSAFE FOR THE WARRIOR. A free
   * off-GCD cast leaves the actor idle, so `nextDecisionTime` pushes the next
   * decision one 100ms poll out -- which destroyed Charge, whose `canCast` is
   * true for a single instant at the pull. NOTHING IN THIS LIST HAS A WINDOW
   * OF THAT SHAPE: every entry below is castable for as long as its condition
   * holds, so the poll costs 100ms of a 60-second fight and buys thirty
   * seconds of spell power starting at the pull instead of one cast later.
   *
   * ABOVE THE DEMONIC RUNE, WHICH IS THE PART THAT IS NOT ARBITRARY. The Rune
   * is gated at 10% mana and this is not gated at all, so a list that reached
   * the Rune first would still fall through to here on every poll but one --
   * the order between them decides nothing except where the panel draws them,
   * and the owner drew them this way round.
   * ==========================================================================
   */
  buffPotionCooldown('major_spellblasting_potion'),
  ...consumableCooldowns({ exclude: ['major_spellblasting_potion'] }),
  ...CONSUMABLE_HEALS,
  /*
   * SEARING TOTEM ABOVE FLAME SHOCK, which is new and is the owner's order.
   * Both are maintenance, both are "if not active", and the totem lasts 55
   * seconds against the shock's twelve -- so putting it first costs the shock
   * one global cooldown once a fight and gets the totem ticking from the pull.
   */
  { abilityId: 'searing_totem', condition: expired('searing_totem') },
  { abilityId: 'flame_shock', condition: expired('flame_shock') },
  /*
   * AND THE RACIAL COOLDOWNS *BELOW* THE TWO MAINTENANCE ENTRIES, which is the
   * owner's order and is a departure from every other non-tank list in the
   * project -- they sit second everywhere else.
   *
   * IT IS THE RIGHT DEPARTURE FOR THIS BUILD. The Shaman's racial is
   * Berserking, +10% spell and attack speed for ten seconds, and haste is
   * worth what the casts inside the window are worth: opened at the pull, two
   * of its ten seconds are spent on an instant shock and a totem, which are
   * the two entries in this list haste does least for. Below them the window
   * lands on Lava Burst and Lightning Bolt.
   *
   * THE OTHER THREE RACIALS MOVE WITH IT rather than being split out. They are
   * all a flat percentage for a fixed window, so the argument above is the same
   * argument for each of them, and splitting the shared fragment to place one
   * entry would be a hand-written copy of it -- which is the shape that drifts.
   */
  ...RACIAL_COOLDOWNS,
  /*
   * LAVA BURST ONLY WITH FLAME SHOCK ON THE TARGET, which is the owner's
   * clause and it REPLACES AN ORDERING ARGUMENT WITH A CONDITION.
   *
   * The entry above used to carry the whole rule: "Flame Shock above Lava
   * Burst, and the order is load-bearing", because Lava Burst reads the target
   * for the debuff at the moment it casts and is worth 20% more when it finds
   * it. That held only while nothing could come between them -- and the racial
   * block now does. Written as a clause it holds whatever is in between.
   */
  /*
   * ==========================================================================
   * ELEMENTAL MASTERY, WHICH WAS IN NO LIST AT ALL.
   *
   * It arrived with client build 1.60.1.70425 as the tree's new 31-point
   * capstone -- half a second off Lightning Bolt and Lava Burst for fifteen
   * seconds, on a three minute cooldown -- and nothing cast it. **A new
   * capstone in the book and in no list is the quietest place in this project
   * for damage to go missing**, and this build lands 56% of its damage with
   * the first of the two spells it shortens.
   *
   * MEASURED AT **+24.4** here, paired over 400 iterations: Lightning Bolt goes
   * 24.2 casts a fight to 25.0 and Lava Burst 5.9 to 6.0.
   *
   * AND IT IS ALSO PRE-CAST NOW, WHICH MAKES THIS ENTRY READ 0.00 USES. The
   * opener claims the cooldown at a 0s lead for no global cooldown, worth a
   * further **+13.9** -- and a three minute cooldown cannot come back inside a
   * hundred second fight, so the list never reaches it. The entry is KEPT
   * deliberately: it is a safety net that costs nothing and pays out in a fight
   * longer than the cooldown, which is the same argument the owner accepted for
   * Evocation's permanent zero. **A zero here is intended.**
   *
   * BELOW THE TWO MAINTENANCE ENTRIES AND ABOVE THE TWO NUKES, which is where
   * the window is worth most: it shortens Lightning Bolt and Lava Burst and
   * does nothing for a totem or a shock.
   * ==========================================================================
   */
  { abilityId: 'elemental_mastery' },
  { abilityId: 'lava_burst', condition: hasDebuff('flame_shock') },
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
   * ==========================================================================
   * LIGHTNING BOLT AT FIVE MAELSTROM STACKS, AND ONLY THERE.
   *
   * This entry was missing once, which made the Enhancement capstone worth
   * exactly nothing: Maelstrom Weapon shortens the next Lightning Bolt and the
   * list never cast one. The talent stacked to five and sat there.
   *
   * At five stacks the bolt is INSTANT and free -- 20% a stack, five stacks --
   * so it costs a global cooldown and no swing time. Below five it is a real
   * cast on a character whose damage is 60.7% its swings, and **a cast with a
   * cast time RESETS THE SWING TIMER where an instant does not**: `castAbility`
   * returns before the reset when `castTime <= 0`. Four stacks measured
   * **-2.27** and three **-6.24**, so the threshold is the cap rather than
   * anything lower, and that is a swing-time figure rather than a damage one.
   *
   * --------------------------------------------------------------------------
   * AND IT SITS HERE RATHER THAN AT THE TOP, WHICH IS THIS ROUND'S CHANGE TO
   * THE OWNER'S ORDERING AND IS WORTH **+3.11 +/- 1.39** paired over 3000
   * iterations.
   *
   * IT CONTENDS WITH EARTH SHOCK FOR THE STORMSTRIKE DEBUFF. Stormstrike leaves
   * "+20% to your next Lightning Bolt, Chain Lightning or Earth Shock", and the
   * aura is consumed by whichever of the three casts first rather than by the
   * clock -- so at the top of the list the bolt took that charge the instant
   * Maelstrom reached five stacks. The shock is the harder hit of the two, 590
   * against 553, and it is also on a cooldown the bolt is not.
   *
   * THE POSITION WAS SWEPT RATHER THAN MOVED ONCE, and the shape of the sweep is
   * what says the mechanism is the debuff and not merely the global cooldown:
   *
   *     below stormstrike     +1.65 +/- 0.98      (Stormstrike applies it)
   *     below flame_shock     +1.82 +/- 1.14  \
   *     below searing_totem   +1.71 +/- 1.14   >  a PLATEAU -- all three are
   *     below the racial      +1.71 +/- 1.14  /   rarely castable, so passing
   *                                               them changes nothing
   *     below earth_shock     +3.11 +/- 1.39      (the shock takes it instead)
   *     the very bottom       +3.40 +/- 1.84      inside the row above's
   *                                               interval; not distinguishable
   *
   * ABOVE FIRE NOVA AND NOT BELOW IT, because the last step is worth +0.29
   * against a combined interval of 2.31 -- so the two are the same figure and
   * the bolt keeps its place above the most expensive ability in the list.
   * ==========================================================================
   */
  { abilityId: 'lightning_bolt', condition: atStacks('maelstrom_weapon', MAELSTROM_WEAPON_MAX_STACKS) },
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
