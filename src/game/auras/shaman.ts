import type { AuraDefinition } from '../../engine';
import { RATING_PER_PERCENT, dealDamage, flat, seconds } from '../../engine';
import { PLACEHOLDER_MAGMA_TOTEM_PULSE_SP_COEFFICIENT } from '../combat/coefficients';
import {
  FLAME_SHOCK_SP_COEFFICIENT,
  FLAME_SHOCK_TICK_SP_COEFFICIENT,
} from '../combat/coefficients';

/**
 * Shaman auras, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * Captured in `src/data/abilities/forever-shaman-spellbook.json` at MAX RANK.
 *
 * ----------------------------------------------------------------------------
 * THE FIRST CLASS TO BUFF ITS OWN WEAPON. Windfury Weapon is a SPELL the
 * Shaman casts on itself, not an item enchant and not a raid buff, and it is
 * the same effect the raid already has as Windfury Totem -- at a different
 * rate, with TWO extra attacks rather than one, and with the totem explicitly
 * switched off for whoever carries it.
 *
 * So the imbue is modelled as an aura that a reaction READS. Nothing else in
 * the project needed that: Crusader rides on an item and the totem rides on a
 * raid-buff selection, and neither is something the character spends a global
 * cooldown to put up. `windfuryWeaponReaction` in `reactions/shaman.ts` is the
 * other half, and it fires only while this is up.
 * ----------------------------------------------------------------------------
 */

const FIRE = 'fire' as const;

/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

/**
 * A flat percentage as the engine's own haste rating.
 *
 * Converted with the SAME constant `hasteMultiplierFrom` divides by, so the
 * round trip is exact whatever that constant is set to. Copied in spirit from
 * the Warrior's Flurry, which is where this trick was worked out.
 */
const hasteFromPercent = (percent: number) =>
  flat('hasteRating', percent * RATING_PER_PERCENT.haste);

// ---------------------------------------------------------------------------
// Elemental
// ---------------------------------------------------------------------------

/**
 * Flame Shock's burn half: "166 Fire damage immediately and 176 Fire damage
 * over 12 sec".
 *
 * THE THREE-SECOND CADENCE IS THE READING THAT DIVIDES EVENLY. The source
 * gives a total and a duration and no interval, and of the plausible cadences
 * only three seconds splits 176 over 12 seconds into whole ticks: four of 44.
 * Two seconds would leave six of 29.33 and four seconds three of 58.67. Same
 * argument as Moonfire's, and stated here rather than assumed.
 *
 * FIRE, AND THEREFORE NOT REDUCED BY ARMOR, which is true of every magical
 * school. It still crits, at the crit chance of the event that applied it.
 */
export const FLAME_SHOCK_DOT_TOTAL = 176;
export const FLAME_SHOCK_DOT_DURATION_MS = seconds(12);
export const FLAME_SHOCK_TICK_INTERVAL_MS = seconds(3);

/** Flame Shock hits AND burns, and the sheet gives each half its own row. */
export const FLAME_SHOCK_COEFFICIENTS = {
  direct: FLAME_SHOCK_SP_COEFFICIENT,
  perTick: FLAME_SHOCK_TICK_SP_COEFFICIENT,
};

/**
 * The number of ticks the SOURCE's own 176-over-12-seconds describes.
 *
 * ==============================================================================
 * NAMED BECAUSE CALL OF FLAME EXTENDS THE DURATION AND THE PER-TICK FIGURE MUST
 * NOT MOVE WITH IT.
 *
 * `FLAME_SHOCK_DOT_TOTAL / FLAME_SHOCK_BASE_TICKS` is 44, and that is a tick of
 * Flame Shock whatever the duration is. Dividing the total by the EXTENDED tick
 * count instead would spread the same 176 more thinly -- a talent that adds nine
 * seconds and no damage, which is a smaller number and no error, and the exact
 * inverse of the mistake Rip made by multiplying a duration total per tick.
 *
 * **WHEN A DoT'S DURATION BECOMES VARIABLE, ITS PER-TICK FIGURE HAS TO BE
 * COMPUTED FROM A CONSTANT**, and the cheap way to say so is to name that
 * constant rather than to write an expression that happens to use the base.
 * ==============================================================================
 */
export const FLAME_SHOCK_BASE_TICKS =
  FLAME_SHOCK_DOT_DURATION_MS / FLAME_SHOCK_TICK_INTERVAL_MS;
export const FLAME_SHOCK_TICK_DAMAGE = FLAME_SHOCK_DOT_TOTAL / FLAME_SHOCK_BASE_TICKS;

/**
 * Flame Shock's burn, with whatever Call of Flame adds to its duration.
 *
 * ==============================================================================
 * A FACTORY BECAUSE A TALENT MOVES THE DURATION. "Increases the duration of your
 * Flame Shock spell by 9 sec" at 3/3, which both Shaman profiles take -- and the
 * clause reached nothing at all before this: Call of Flame's `unmodelled` entry
 * named only its Magma Totem half, which is the "a reason that describes a
 * working half" failure with the dead half unmentioned.
 *
 * EXTRA TICKS OF THE SAME SIZE, which is what extending a DoT means and what
 * `FLAME_SHOCK_BASE_TICKS` is for: 12 seconds is four ticks of 44 and 21 seconds
 * is SEVEN, so 3/3 is a 75% larger burn rather than the same burn stretched.
 *
 * AND THE EXTENSION IS A WHOLE NUMBER OF TICKS AT EVERY RANK, which is worth
 * checking rather than assuming: the clause is 3, 6 and 9 seconds on a
 * three-second interval, so one, two and three extra ticks. A rank that added
 * an odd number of seconds would leave a partial tick, and `Periodic` sorts
 * before `AuraExpiration` -- so a tick due at the moment the aura falls off
 * still lands, and the honest reading would then be a ragged final tick. It
 * does not arise; said here because it would be silent.
 * ==============================================================================
 */
export function flameShockDot(extraSeconds = 0): AuraDefinition {
  return {
    id: 'flame_shock',
    name: 'Flame Shock',
    /*
     * SECONDS IN AND MILLISECONDS INSIDE, which is `shadowWordPainAura`'s
     * signature exactly -- the Priest's Improved Shadow Word: Pain is the same
     * clause on another class, and two factories that do the same job should
     * take the same unit. The talent states seconds; everything below the UI is
     * integer milliseconds; `seconds()` is the one conversion.
     */
    durationMs: FLAME_SHOCK_DOT_DURATION_MS + seconds(extraSeconds),
    isDebuff: true,
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: FLAME_SHOCK_TICK_INTERVAL_MS,
      onTick: (context, aura) => {
        const source = context.combatant(aura.sourceId);
        const target = context.combatant(aura.targetId);
        if (!source || !target || !target.isAlive) return;

        dealDamage(context, {
          source,
          target,
          abilityId: aura.id,
          abilityName: aura.name,
          school: FIRE,
          // PER TICK FROM THE BASE COUNT, never from the extended one.
          baseAmount: FLAME_SHOCK_TICK_DAMAGE,
          // No coefficient is stated, so none is invented -- the decision every
          // periodic effect in this project carries.
          powerCoefficient: FLAME_SHOCK_COEFFICIENTS.perTick,
          periodic: true,
          critFrom: 'spell',
          appliesArmor: false,
        });
      },
    },
  };
}

/** The untalented burn, for anything that only needs the id and the shape. */
export const FLAME_SHOCK_DOT: AuraDefinition = flameShockDot();


/*
 * ============================================================================
 * THE SHAMAN'S DAMAGE SPELLS, NAMED ONCE.
 *
 * "Any Fire, Frost, or Nature damage spell" is Elemental Focus's trigger and
 * "your next damage spell" is what it discounts, and both are this list. There
 * is no `school` on `Ability`, so a set of ids is how every class in this
 * project expresses a tooltip that selects by school -- the Mage's
 * `DAMAGE_SPELLS` and Hot Streak's four names are the same arrangement, and the
 * field is deliberately absent because one that is silent when forgotten is the
 * failure mode this project keeps meeting.
 *
 * WHAT IS IN: the six nukes and Fire Nova. Every one is Fire, Frost or Nature,
 * every one deals damage, and every one costs mana.
 *
 * WHAT IS OUT, AND WHY EACH:
 *
 *   searing_totem      a totem SUMMON. Its school is Fire and its ticks deal
 *                      damage, so "a Fire damage spell" is arguable -- and the
 *                      cast itself rolls nothing and deals nothing, so the
 *                      conservative reading is that summoning a totem is not
 *                      casting a damage spell. Chosen because it is the reading
 *                      that pays the talent LESS: excluding it costs the
 *                      Enhancement shaman one trigger and one discount a fight,
 *                      where including it would be inventing generosity.
 *   windfury_weapon    an imbue. Nature school in the capture, no damage.
 *   stormstrike        Physical, and a melee ability rather than a spell.
 *   rage_of_the_farseer  a self-buff with no school and no damage.
 *
 * DECLARED HERE rather than in `abilities/shaman.ts` because the aura below
 * needs it and `abilities` already imports this file -- putting it the other way
 * round would be a cycle.
 * ============================================================================
 */
export const SHAMAN_DAMAGE_SPELL_IDS: readonly string[] = [
  'lightning_bolt',
  'chain_lightning',
  'earth_shock',
  'flame_shock',
  'frost_shock',
  'lava_burst',
  'fire_nova',
];

/**
 * Clearcasting, from Elemental Focus: "reduces the mana cost of your next
 * damage spell by 100%."
 *
 * ----------------------------------------------------------------------------
 * THE MAGE'S ARCANE CONCENTRATION, WORD FOR WORD ON THE PAYOUT AND DIFFERENT ON
 * THE TRIGGER, which is the only interesting thing about it.
 *
 *   Arcane Concentration   "after any damage spell HITS a target" -- so it is
 *                          an attack reaction on `dealt`, and a resisted spell
 *                          rolls nothing.
 *   Elemental Focus        "after CASTING any Fire, Frost, or Nature damage
 *                          spell" -- so it is a CAST reaction, and a spell that
 *                          misses still rolls.
 *
 * Two tooltips, two mechanisms, and reading the second as the first would make
 * this talent quietly worse by the Shaman's spell miss chance. See
 * `elementalFocus` in `reactions/shamanTalents.ts`.
 *
 * `costFraction: 1` IS THE 100%, so no per-rank number is involved -- which is
 * why the values file stores the CHANCE and says so.
 *
 * FIFTEEN SECONDS, borrowed from the Mage's Clearcasting because Forever's
 * Shaman tooltip states no duration at all. It is a backstop rather than the
 * mechanic: `consumedByCast: 'all'` is what ends it in practice, and an
 * Elemental shaman casting every 1.5 to 2.5 seconds reaches a damage spell long
 * before fifteen seconds pass. The one case it decides is a Windfury Weapon or
 * Rage of the Farseer cast in between, which neither spends the charge nor
 * resets the clock.
 */
export const ELEMENTAL_FOCUS_DURATION_MS = seconds(15);

export const ELEMENTAL_FOCUS_CLEARCASTING: AuraDefinition = {
  id: 'elemental_focus',
  name: 'Clearcasting',
  durationMs: ELEMENTAL_FOCUS_DURATION_MS,
  castModifier: {
    abilityIds: SHAMAN_DAMAGE_SPELL_IDS,
    costFraction: 1,
    /*
     * `all`, not `stack`. "Your NEXT damage spell" is one cast, and the aura
     * has no stacks to spend anyway -- but saying it explicitly is what stops
     * a later edit adding `maxStacks` and quietly turning one free spell into
     * several.
     */
    consumedByCast: 'all',
  },
};

/*
 * ============================================================================
 * SEARING TOTEM, MODELLED AS A DAMAGE-OVER-TIME EFFECT AND NOT AS AN ENTITY.
 *
 * THE RULESET OWNER'S RULING, given in full because no source states most of
 * it: "Searing totem can be treated like a DoT effect that lasts 55 seconds and
 * ticks every 1.5 seconds for 40-54 fire damage +8% of spell damage per tick,
 * but is considered a totem for the purposes of other talents."
 *
 * The capture supplies the rest -- 170 mana, instant, Fire, "Summons a Searing
 * Totem with 5 health at your feet for 55 sec that repeatedly attacks an enemy
 * within 20 yards for 40 to 54 Fire damage." What it does NOT state is how
 * often "repeatedly" is, or whether the totem scales at all, and this file used
 * to say so: the shaman ability header recorded that Searing Totem "does not
 * even state an attack interval". The owner supplied the cadence and the
 * coefficient, which is the only reason this is data rather than an invention.
 *
 * IT WAS BLOCKED ON AN ENGINE GAP AND IS NOT ANY MORE, because the ruling
 * removed the need for the gap rather than the gap being closed. The engine
 * cannot add a combatant mid-fight, so a totem that acts on its own is
 * unreachable; a debuff on the target that ticks is reachable and, against one
 * enemy standing still, deals exactly the same damage. Same shape as the
 * Hunter's hawk, modelled without a combatant by an earlier ruling of the
 * owner's. WHAT IS LOST is that the totem is not separately targetable and
 * cannot be killed.
 *
 * "CONSIDERED A TOTEM FOR THE PURPOSES OF OTHER TALENTS" IS THE CLAUSE THAT IS
 * EASY TO DROP, and two Elemental talents read it:
 *
 *   Call of Flame     "damage done by your Fire Totems" -- now an
 *                     `abilityDamage` effect keyed on this aura's id.
 *   Elemental Fury    "critical strike damage bonus of your Searing and Magma
 *                     Totems and your Fire, Frost, and Nature spells" -- which
 *                     already reaches it, because the ticks are FIRE and that
 *                     talent is a school effect. Nothing had to be added; what
 *                     had to change is the reason saying it did nothing.
 *
 * TWENTY-TWO TICKS, NOT TWENTY-THREE. The owner moved the attack interval from
 * 1.5 seconds to 2.43, so 55 seconds is 22.63 intervals: the last tick lands at
 * 53.46 and the totem expires at 55.0 with 1.54 seconds unspent. (It was 36
 * ticks at 1.5.) That falls out of the engine rather than being chosen -- the
 * duration and the cadence are both stated, so unlike every other DoT here
 * there is no total to divide and no cadence to infer.
 *
 * A 1.5-SECOND PRE-COMBAT LEAD NO LONGER REACHES A TICK BEFORE THE PULL: the
 * first lands 0.93 seconds into the fight. That moves nothing about the
 * opener's legality question -- it only makes it moot for this line.
 * ============================================================================
 */
export const SEARING_TOTEM_TICK_DAMAGE = midpoint(40, 54);
export const SEARING_TOTEM_DURATION_MS = seconds(55);
/** The owner's figure: "attack interval to 2.43 seconds". Was 1.5. */
export const SEARING_TOTEM_TICK_INTERVAL_MS = seconds(2.43);
/** "+8% of spell damage per tick", the owner's figure. In no capture. */
export const SEARING_TOTEM_TICK_SP_COEFFICIENT = 0.08;

export const SEARING_TOTEM_DOT: AuraDefinition = {
  id: 'searing_totem',
  name: 'Searing Totem',
  durationMs: SEARING_TOTEM_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: SEARING_TOTEM_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target || !target.isAlive) return;

      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: FIRE,
        baseAmount: SEARING_TOTEM_TICK_DAMAGE,
        powerCoefficient: SEARING_TOTEM_TICK_SP_COEFFICIENT,
        periodic: true,
        /*
         * IT CRITS, and Elemental Fury is the reason that has to be true: a
         * talent raising "the critical strike damage bonus of your Searing
         * Totem" is meaningless against something that cannot crit.
         */
        critFrom: 'spell',
        appliesArmor: false,
      });
    },
  },
};

/**
 * Magma Totem, rank 4: "Summons a Magma Totem with 5 health at the feet of the
 * caster for 20 sec that causes 73 Fire damage to creatures within 8 yards
 * every 2 seconds." (round 57)
 *
 * SEARING TOTEM'S SHAPE: a damage totem is expressible as a debuff that ticks,
 * and this one is applied to EVERY target, because "creatures within 8 yards"
 * is everyone when nothing has a position. Ten pulses over twenty seconds, each
 * a periodic tick that rolls a crit at spell crit the way Searing Totem's does.
 * Its coefficient is a placeholder zero -- the sheet has no row for it.
 */
export const MAGMA_TOTEM_PULSE_DAMAGE = 73;
export const MAGMA_TOTEM_DURATION_MS = seconds(20);
export const MAGMA_TOTEM_PULSE_INTERVAL_MS = seconds(2);

export const MAGMA_TOTEM_DOT: AuraDefinition = {
  id: 'magma_totem',
  name: 'Magma Totem',
  durationMs: MAGMA_TOTEM_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: MAGMA_TOTEM_PULSE_INTERVAL_MS,
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target || !target.isAlive) return;
      dealDamage(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        school: FIRE,
        baseAmount: MAGMA_TOTEM_PULSE_DAMAGE,
        powerCoefficient: PLACEHOLDER_MAGMA_TOTEM_PULSE_SP_COEFFICIENT,
        periodic: true,
        critFrom: 'spell',
        appliesArmor: false,
      });
    },
  },
};

// ---------------------------------------------------------------------------
// Enhancement
// ---------------------------------------------------------------------------

/**
 * Stormstrike's debuff: "increase the damage you deal to the target with your
 * next Lightning Bolt, Chain Lightning, or Earth Shock spell by 20% for 12
 * sec".
 *
 * ----------------------------------------------------------------------------
 * CONSUMED BY THE SPELL, NOT BY THE CLOCK, and that is why it carries no
 * `damageTakenBySchool`. All three named spells are Nature, so a school
 * multiplier would be an exact fit for WHICH spells -- and completely wrong
 * about HOW MANY, because nothing in the engine consumes a debuff when the
 * attacker's damage lands. Twelve seconds of +20% Nature is several spells,
 * and the tooltip says one.
 *
 * So each of the three reads this aura in its own `onCast` and removes it, and
 * the multiplier lives in `abilities/shaman.ts` beside them. That is content
 * doing what content can do, rather than an engine rule named after one
 * talent.
 * ----------------------------------------------------------------------------
 */
export const STORMSTRIKE_DAMAGE_BONUS = 1.2;
export const STORMSTRIKE_DEBUFF_DURATION_MS = seconds(12);

export const STORMSTRIKE_DEBUFF: AuraDefinition = {
  id: 'stormstrike',
  name: 'Stormstrike',
  durationMs: STORMSTRIKE_DEBUFF_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
};

/**
 * Improved Stormstrike's mana clause: "you have a 100% chance to gain 50% mana
 * regeneration while casting spells for 15 sec."
 *
 * ----------------------------------------------------------------------------
 * `manaRegenBypass` IS EXACTLY THIS STAT, and it has been in the engine since
 * the first caster -- "percentage of mana regeneration that continues while
 * casting". Five talents across five classes already grant it flat and
 * permanently (the Mage's Arcane Meditation, the Priest's Meditation, the
 * Paladin's Reverence, the Druid's Reflection, a Hunter tier-two talent); this
 * is the first one that grants it for a WINDOW, which is an aura and nothing
 * new.
 *
 * SO THE TALENT'S `unmodelled` REASON WAS WRONG ABOUT WHICH HALF WAS BLOCKED.
 * It read "Mana regeneration while casting, and a Stormstrike cooldown reset on
 * a DODGE OR PARRY. Neither profile is attacked, so neither ever dodges" --
 * which is true of the SECOND clause and says nothing about the first. Both
 * clauses were reported under the second clause's reason, and the mana half has
 * been expressible the whole time. That is the failure mode CLAUDE.md names: a
 * reason specific enough to re-read is one that can be checked, and a reason
 * covering two clauses with one sentence hides whichever clause is not the
 * subject.
 *
 * IT IS MANA RETURN, WHICH IS IN SCOPE. Healing throughput is ruled out and
 * mana return explicitly is not, because it changes a damage profile's sustain
 * -- and the Enhancement shaman is the one build in this project that spends
 * mana on Stormstrike, its shocks and an imbue while swinging a two-hander.
 *
 * BOTH NUMBERS COME FROM THE TALENT: the bypass percentage at index 1 and the
 * duration at index 2. Index 0 is the PROC CHANCE and index 3 is the
 * dodge/parry reset chance, and reading index 0 would grant 100 percentage
 * points of bypass at rank 2 -- full regeneration while casting, which is twice
 * the talent.
 */
export function improvedStormstrikeAura(
  bypassPercent: number,
  durationMs: number,
): AuraDefinition {
  return {
    id: 'improved_stormstrike',
    name: 'Improved Stormstrike',
    durationMs,
    refreshBehaviour: 'reset',
    statModifiers: [flat('manaRegenBypass', bypassPercent)],
  };
}

/**
 * Windfury Weapon, the imbue itself.
 *
 * Sixty minutes, so it is up for every fight this project measures once it has
 * been cast -- which costs one global cooldown at the pull and is in the
 * priority list for that reason rather than being assumed.
 *
 * It grants nothing on its own. `windfuryWeaponReaction` reads it.
 */
export const WINDFURY_WEAPON_DURATION_MS = seconds(60 * 60);

export const WINDFURY_WEAPON_IMBUE: AuraDefinition = {
  id: 'windfury_weapon',
  name: 'Windfury Weapon',
  durationMs: WINDFURY_WEAPON_DURATION_MS,
};

/**
 * Flametongue Weapon, the imbue. Sixty minutes, and it grants nothing on its
 * own: `flametongueWeaponReaction` reads it and deals the Fire damage.
 */
export const FLAMETONGUE_WEAPON_IMBUE: AuraDefinition = {
  id: 'flametongue_weapon',
  name: 'Flametongue Weapon',
  durationMs: WINDFURY_WEAPON_DURATION_MS,
};

/**
 * Rockbiter Weapon: "increasing melee attack power by 653 ... Lasts for 60
 * minutes."
 *
 * ----------------------------------------------------------------------------
 * A STAT ON THE CARRIER, not a proc. `attackPower` is the shared pool, which
 * the owner's general ruling says reaches ranged as well -- and the tooltip
 * says MELEE. No Shaman swings a bow, so the two readings cannot differ for any
 * character that can cast this; said so the choice is visible.
 *
 * ITS THREAT CLAUSE IS OUT OF SCOPE (`threat`), and has no effect to declare.
 *
 * A FACTORY, because Elemental Weapons raises "the melee attack power bonus of
 * your Rockbiter Weapon by {0}%" and the ability hands the rank's figure down.
 * The id is the same at every bonus, so a re-cast refreshes rather than stacks.
 * ----------------------------------------------------------------------------
 */
export const ROCKBITER_WEAPON_ATTACK_POWER = 653;

export function rockbiterWeaponImbue(elementalWeaponsPercent = 0): AuraDefinition {
  return {
    id: 'rockbiter_weapon',
    name: 'Rockbiter Weapon',
    durationMs: WINDFURY_WEAPON_DURATION_MS,
    refreshBehaviour: 'reset',
    statModifiers: [
      flat('attackPower', ROCKBITER_WEAPON_ATTACK_POWER * (1 + elementalWeaponsPercent / 100)),
    ],
  };
}

/**
 * THE THREE MAIN-HAND IMBUES, of which a weapon holds one. Casting any of them
 * removes the other two -- an imbue is ON the weapon, and the owner's three
 * combinations ("Windfury weapon + Flametongue totem OR Flametongue weapon +
 * Windfury totem OR Windfury weapon + Windfury totem") all assume exactly one.
 */
export const MAIN_HAND_IMBUE_IDS: readonly string[] = [
  'windfury_weapon',
  'flametongue_weapon',
  'rockbiter_weapon',
];

/*
 * ============================================================================
 * THE ATTACK POWER WINDOW IS GONE, AND THAT IS THE WHOLE DIFFERENCE BETWEEN THE
 * IMBUE AND THE TOTEM.
 *
 * `windfuryWeaponAura` applied +333 attack power for 1.5 seconds and then asked
 * for two extra SWINGS. It was Windfury Totem's shape, borrowed because the
 * owner had stated the totem's mechanics and the spellbook states only the
 * chance, the count and the attack power -- and the 1.5 seconds was a named
 * `PLACEHOLDER_`, which is the only reason the borrow was visible enough to
 * correct.
 *
 * THE OWNER HAS NOW SEPARATED THEM. The imbue "grants 2 extra SPECIAL attacks
 * with the rank's added attack power", and it differs from the totem in four
 * ways, every one of which the window got wrong:
 *
 *   SPECIAL, NOT A SWING   `melee-special` -- no glancing blow, and a two-roll
 *                          table. A swing rolls one table where glancing is
 *                          most of what a level 63 target produces.
 *   THE POWER IS IN THE    `weaponScaling.bonusAttackPower`, so it pays exactly
 *   HITS                   the two attacks. A 1.5-second window also paid a
 *                          Stormstrike or an ordinary swing landing inside it.
 *   NO SWING TIMER RESET   `extraAttack` reschedules the slot from now, so every
 *                          proc pushed the next real swing out by a full timer.
 *   ITS OWN DAMAGE ROW     a swing is reported as "Main Hand Auto-Attack", so
 *                          8 extra attacks a fight were invisible inside the
 *                          auto-attack line and the biggest thing in the build
 *                          could not be read off the results page.
 *
 * SO THE AURA AND ITS PLACEHOLDER BOTH GO. `windfuryWeaponReaction` in
 * `reactions/shaman.ts` carries the whole effect now, and the imbue below is
 * the only aura left -- it grants nothing and exists to be READ.
 *
 * WINDFURY TOTEM IS UNCHANGED and still works the old way, because the owner
 * stated that one directly. `buffs/windfury.ts` is a separate file for a
 * separate effect, and the two must not be made to match.
 * ============================================================================
 */

/**
 * Rage of the Farseer: "Increases your melee attack speed and spell casting
 * speed by 30% for 25 sec."
 *
 * ONE STAT COVERS BOTH CLAUSES. `hasteMultiplierFrom` is what scales a swing
 * timer AND what scales a cast time, so a single haste modifier is the whole
 * talent rather than half of it -- which is not true of most two-clause
 * talents in this project and is worth saying out loud.
 */
export const RAGE_OF_THE_FARSEER_HASTE_PERCENT = 30;
export const RAGE_OF_THE_FARSEER_DURATION_MS = seconds(25);

export const RAGE_OF_THE_FARSEER: AuraDefinition = {
  id: 'rage_of_the_farseer',
  name: 'Rage of the Farseer',
  durationMs: RAGE_OF_THE_FARSEER_DURATION_MS,
  refreshBehaviour: 'reset',
  statModifiers: [hasteFromPercent(RAGE_OF_THE_FARSEER_HASTE_PERCENT)],
};

/**
 * Elemental Devastation: "Your offensive spell critical strikes will increase
 * your chance to get a critical strike with melee attacks by {0}% for 10 sec."
 *
 * A SPELL CRIT BUFFING MELEE, which is the whole point of the talent and the
 * reason it sits in a hybrid's Elemental tree. `critChance` is the melee one;
 * `spellCritChance` is separate, so this raises exactly what it says.
 */
export const ELEMENTAL_DEVASTATION_DURATION_MS = seconds(10);

export function elementalDevastationAura(critPercent: number): AuraDefinition {
  return {
    id: 'elemental_devastation',
    name: 'Elemental Devastation',
    durationMs: ELEMENTAL_DEVASTATION_DURATION_MS,
    refreshBehaviour: 'reset',
    statModifiers: [flat('critChance', critPercent)],
  };
}

/**
 * Maelstrom Weapon: "When you deal damage with a melee attack, you have a
 * chance to reduce the cast time and Mana cost of your next Lightning Bolt
 * spell by {0}%. Stacks up to 5 times. Lasts 30 sec."
 *
 * ----------------------------------------------------------------------------
 * LIVE NOW. It spent the Shaman PR tracked and inert, saying so; the engine's
 * `CastModifier` is the rule it wanted, and the Druid's Eclipse wanted the
 * same one.
 *
 * PER STACK, NOT IN TOTAL, and that is an interpretation rather than a quote.
 * The tooltip states one percentage and then says "stacks up to 5 times",
 * which is only meaningful if the stacks multiply it -- a flat 20% however
 * many stacks were up would make four of them worthless. Read per stack, rank
 * 5 reaches 100% at five stacks and Lightning Bolt becomes instant, which is
 * the behaviour the ability is known for; rank 1's 4% reaches 20%. The
 * alternative reading has a five-stack cap that does nothing at any rank.
 * `scalesWithStacks` is how that is expressed, and Eclipse is the contrast:
 * a charge per cast rather than a magnitude per stack.
 *
 * THE MANA CLAUSE COMES FREE with the same field, which is the argument for
 * the modifier carrying cost as well as cast time. Both halves are the same
 * percentage and the tooltip gives them one number.
 *
 * ITS PROC CHANCE IS NOT STATED ANYWHERE. See
 * `PLACEHOLDER_MAELSTROM_WEAPON_PROC_CHANCE` in `reactions/shamanTalents.ts`.
 * ----------------------------------------------------------------------------
 */
export const MAELSTROM_WEAPON_MAX_STACKS = 5;
export const MAELSTROM_WEAPON_DURATION_MS = seconds(30);

export function maelstromWeaponAura(reductionPercentPerStack: number): AuraDefinition {
  return {
    id: 'maelstrom_weapon',
    name: 'Maelstrom Weapon',
    durationMs: MAELSTROM_WEAPON_DURATION_MS,
    maxStacks: MAELSTROM_WEAPON_MAX_STACKS,
    refreshBehaviour: 'reset',
    castModifier: {
      abilityIds: ['lightning_bolt'],
      castTimeFraction: reductionPercentPerStack / 100,
      costFraction: reductionPercentPerStack / 100,
      scalesWithStacks: true,
      /*
       * `all`, NOT `stack`. "Your NEXT Lightning Bolt" is one cast however
       * many stacks paid for it, so five stacks buy one instant bolt and
       * leave nothing behind. Spending a single stack instead would leave
       * four up for the bolt after it -- which reads as a working talent and
       * is worth several times what it should be.
       *
       * Eclipse is the other answer, and the reason this is an enum.
       */
      consumedByCast: 'all',
    },
  };
}

/*
 * ----------------------------------------------------------------------------
 * THE AURAS THIS MODULE BUILDS WITH A FACTORY, LISTED SO THE PANEL CAN OFFER
 * THEM.
 *
 * `auraCatalog` finds an aura by walking a module's exports and keeping
 * whatever looks like an `AuraDefinition`. That finds every aura declared as a
 * constant and NONE built by a function -- which silently cost the dropdowns 20
 * auras across nine classes, Rip and Deep Wounds and Ignite among them. Rip is
 * how it was noticed: a Druid could not gate Rip on Rip already being up, which
 * is the single most ordinary thing a feral rotation does.
 *
 * THE ARGUMENT IS REPRESENTATIVE AND ONLY THE ID, NAME AND `isDebuff` ARE READ,
 * none of which depends on it. It lives here rather than in the catalog because
 * what a sensible argument IS belongs next to the factory -- the catalog would
 * otherwise be guessing, and a factory that gained a required argument would
 * break it from a distance.
 * ----------------------------------------------------------------------------
 */
/**
 * Elemental Mastery, the new Elemental capstone's window.
 *
 * ==============================================================================
 * "Gain mastery over Fire and Lightning, reducing the cast time of Lightning
 * Bolt and Lava Burst by 0.5 sec, and removing the cooldown from Chain
 * Lightning. Lasts 15 sec." Three minute cooldown.
 *
 * A `castModifier` NAMING TWO ABILITIES, WITH NO `consumedByCast`. That absence
 * is the whole shape: this is a DURATION effect, so every Lightning Bolt and
 * Lava Burst inside the fifteen seconds is shortened rather than only the next
 * one. Arcane Power already rests on the same distinction, and Heating Up is
 * the counter-example -- "your NEXT Pyroblast" spends `all`.
 *
 * `castTimeReductionMs` AND NOT `castTimeFraction`, because the clause states a
 * flat half second rather than a percentage. The two differ on a hasted caster:
 * half a second off a 2.0s Lightning Bolt is 25%, and off a 1.5s one it is 33%.
 *
 * ------------------------------------------------------------------------------
 * THE THIRD CLAUSE IS NOT HERE AND THE TALENT SAYS SO. "Removing the cooldown
 * from Chain Lightning" needs an aura that SUSPENDS a cooldown while it is up,
 * and nothing expresses that: `abilityCooldown` is resolved when the character
 * is built, and a `CastModifier` carries cast time and cost. Declared as an
 * `unmodelled` reason on the talent rather than silently absent.
 *
 * WHICH COSTS LESS THAN IT READS, on a single-target encounter: Chain Lightning
 * is a multi-target spell and sits in no priority list here, so a cooldown it
 * never reaches is a cooldown worth removing to nobody. That is a LIST cause
 * rather than an engine one, and it is named on the talent so the day a
 * multi-target encounter exists somebody re-reads it.
 * ==============================================================================
 */
export const ELEMENTAL_MASTERY_DURATION_MS = seconds(15);
export const ELEMENTAL_MASTERY_CAST_REDUCTION_MS = 500;

export const ELEMENTAL_MASTERY_AURA: AuraDefinition = {
  id: 'elemental_mastery',
  name: 'Elemental Mastery',
  durationMs: ELEMENTAL_MASTERY_DURATION_MS,
  castModifier: {
    abilityIds: ['lightning_bolt', 'lava_burst'],
    castTimeReductionMs: ELEMENTAL_MASTERY_CAST_REDUCTION_MS,
  },
};

export const CATALOG_AURAS: readonly AuraDefinition[] = [
  /*
   * ADDED BY THE AURA-CATALOGUE AUDIT, which found these reachable ONLY through
   * `aurasForClass`'s stock-list safety net -- "anything a stock list names must
   * be choosable, wherever its definition lives". The id was offered with a name
   * derived from it and nothing else, where a listed definition carries the
   * aura's own name and `isDebuff`. A SAFETY NET MASKS THE THING IT IS A NET
   * FOR, which is why the audit asks the modules rather than the catalogue.
   */
  maelstromWeaponAura(0),
  elementalDevastationAura(0),
  rockbiterWeaponImbue(0),
];
