import type { AuraDefinition } from '../../engine';
import { ALL_ABILITIES, RATING_PER_PERCENT, flat, percent, seconds } from '../../engine';

/**
 * The auras the five active racials apply.
 *
 * Numbers are the beta client's own, from `talentsforever.com/racials.js`, and
 * cross-checked against the ruleset owner's statement of the same five. Where
 * the two differ the owner's is used and the difference is recorded at the
 * constant -- which happened once, on Blood Fury.
 */

// ---------------------------------------------------------------------------
// Dwarf: Stoneform
// ---------------------------------------------------------------------------

export const STONEFORM_DURATION_MS = seconds(8);
export const STONEFORM_COOLDOWN_MS = seconds(180);
/** "Reduces physical damage taken by 10%", so 0.9 of it lands. */
export const STONEFORM_PHYSICAL_TAKEN = 0.9;

/**
 * Stoneform: ten percent less physical damage for eight seconds.
 *
 * ----------------------------------------------------------------------------
 * `damageTakenBySchool` RATHER THAN `damageTakenMultiplier`, and the school is
 * the whole point: the client's wording is "reduces all PHYSICAL damage taken",
 * and the blanket field would also soften the magic the encounter does not
 * currently deal -- worth nothing today and wrong the day an encounter has a
 * spell, in the direction that reads as a slightly better tank.
 *
 * ITS OTHER CLAUSE IS OUT OF SCOPE. "Instantly removes and grants immunity to
 * all Bleed, Poison, and Disease effects" is `dispel`, and the Dwarf trait
 * declares it rather than leaving it unsaid.
 * ----------------------------------------------------------------------------
 */
export const STONEFORM: AuraDefinition = {
  id: 'stoneform',
  name: 'Stoneform',
  durationMs: STONEFORM_DURATION_MS,
  damageTakenBySchool: { physical: STONEFORM_PHYSICAL_TAKEN },
};

// ---------------------------------------------------------------------------
// Night Elf: Elune's Light
// ---------------------------------------------------------------------------

export const ELUNES_LIGHT_DURATION_MS = seconds(15);
export const ELUNES_LIGHT_COOLDOWN_MS = seconds(180);
/** Percentage POINTS, on both crit stats. */
export const ELUNES_LIGHT_CRIT = 10;

/**
 * Elune's Light: ten points of crit on everything, for fifteen seconds.
 *
 * TWO STATS, because `critChance` and `spellCritChance` are read by separate
 * tables -- the same reading sixty-two item lines saying "with all spells and
 * attacks" already take. The owner's wording adds "and ranged attack", which
 * `critChance` already covers: `critChanceFrom` is the one crit function and
 * both the melee and the ranged tables read it.
 */
export const ELUNES_LIGHT: AuraDefinition = {
  id: 'elunes_light',
  name: "Elune's Light",
  durationMs: ELUNES_LIGHT_DURATION_MS,
  statModifiers: [flat('critChance', ELUNES_LIGHT_CRIT), flat('spellCritChance', ELUNES_LIGHT_CRIT)],
};

// ---------------------------------------------------------------------------
// Orc: Blood Fury
// ---------------------------------------------------------------------------

export const BLOOD_FURY_DURATION_MS = seconds(15);
/**
 * TWO MINUTES AGAIN SINCE ROUND 81: "Blood Fury's cooldown reduced to 2
 * minutes (was 3 minutes)". The history below is the round that raised it.
 *
 * THREE MINUTES, RAISED FROM TWO BY THE RACIAL PATCH.
 *
 * "Blood Fury: Cooldown increased to 3 minutes (was 2 minutes)". The client's
 * tooltip still reads 2 min at build 1.60.1.70291, so the note is the later
 * statement and wins. The DURATION is untouched at 15 seconds, which is what
 * makes this a straight reduction in uptime: a 60-second fight now fits one
 * cast where it already fitted one, so what actually moves is the pull-timing
 * -- the ability is off the global cooldown and sits second in every list, so
 * every Orc profile still casts it exactly once.
 */
export const BLOOD_FURY_COOLDOWN_MS = seconds(120);
/** A fraction, because these are `percentAdd` modifiers. */
export const BLOOD_FURY_POWER = 0.1;

/**
 * Blood Fury: ten percent more attack power, ranged attack power and spell
 * power for fifteen seconds.
 *
 * ----------------------------------------------------------------------------
 * RANGED ATTACK POWER IS THE OWNER'S ADDITION AND IT IS NOT IN THE CLIENT.
 * `racials.js` reads "Increases Attack Power and Spell Power by 10%"; the owner
 * states "Attack Power, Ranged Attack Power, and Spell Power". A later and more
 * specific statement wins, and this is the same question Careful Aim raised and
 * the owner answered the same way -- bare "Attack Power" reaches both pools.
 *
 * It matters: four of the seven Orc presets are Hunters, whose damage is almost
 * entirely ranged. The melee-only reading would have made Blood Fury worth
 * close to nothing on them while reading as a working cooldown.
 *
 * `percentAdd` ON A DERIVED STAT, WHICH IS WHY IT IS A MODIFIER AND NOT A FLAT
 * NUMBER. `StatBlock.computeEffective` resolves in two passes and applies
 * modifiers AFTER the derivation, so +10% here scales the whole derived pool --
 * the strength conversion, the gear, Blessing of Might and all. A flat figure
 * taken at build time would scale the unbuffed pool and be wrong all fight.
 * ----------------------------------------------------------------------------
 */
export const BLOOD_FURY: AuraDefinition = {
  id: 'blood_fury',
  name: 'Blood Fury',
  durationMs: BLOOD_FURY_DURATION_MS,
  statModifiers: [
    percent('attackPower', BLOOD_FURY_POWER),
    percent('rangedAttackPower', BLOOD_FURY_POWER),
    percent('spellPower', BLOOD_FURY_POWER),
  ],
};

// ---------------------------------------------------------------------------
// Troll: Berserking
// ---------------------------------------------------------------------------

/** Fifteen since round 81: "Berserking duration increased to 15 seconds (was 10 seconds)". */
export const BERSERKING_DURATION_MS = seconds(15);
export const BERSERKING_COOLDOWN_MS = seconds(180);
/** Percentage points of haste. */
export const BERSERKING_HASTE_PERCENT = 10;

/**
 * Berserking: ten percent spell and attack speed for fifteen seconds (ten until round 81).
 *
 * `hasteRating` through `RATING_PER_PERCENT.haste`, the idiom Seal of the
 * Crusader, Nature's Grace, Flurry, Blade Flurry and the "+1% Haste" enchant
 * already share: `hasteMultiplierFrom` divides by the same constant, so ten
 * points in is exactly 1.10 out and the placeholder conversion moving cannot
 * change what this is worth. It reaches cast speed, melee swing speed and
 * ranged swing speed, which is all three things the tooltip names.
 */
export const BERSERKING: AuraDefinition = {
  id: 'berserking',
  name: 'Berserking',
  durationMs: BERSERKING_DURATION_MS,
  statModifiers: [flat('hasteRating', BERSERKING_HASTE_PERCENT * RATING_PER_PERCENT.haste)],
};

// ---------------------------------------------------------------------------
// Gnome: Eureka!
// ---------------------------------------------------------------------------

export const EUREKA_COOLDOWN_MS = seconds(120);
/**
 * "Now an 8 second buff with no charges."
 *
 * ===========================================================================
 * THE REDESIGN REPLACED A CHARGE COUNT WITH A CLOCK, AND DELETING THE CHARGES
 * DELETES MORE CODE THAN IT ADDS.
 *
 * It was "your next 3 damaging abilities cost 10% less and deal 10% more", and
 * the three charges needed a REACTION PAIR to spend them: a `dealt` reaction
 * marked that a non-periodic damaging ability had landed and a `final` cast
 * reaction then spent a stack, because "damaging ability" cannot be answered
 * from an ability's declaration -- Rupture and Serpent Sting both declare an
 * attack table and deal no direct damage, so `requiresAttackTable` would have
 * spent a charge on each.
 *
 * NONE OF THAT IS NEEDED BY A DURATION. An 8 second window pays whatever lands
 * inside it and nothing has to decide what counted, so `eurekaReactions` is
 * gone with the charges -- which is the better direction for this particular
 * trait, because the hard part was never the effect and always the spending.
 *
 * AND THE EFFECT IS UNCHANGED, which the note says in as many words: "Same
 * effect on damage and ability costs." So both halves keep their 10% and only
 * the way the buff ENDS has moved.
 * ===========================================================================
 */
export const EUREKA_DURATION_MS = seconds(8);
/** "... cost 10% less ..." as a fraction of the base cost. */
export const EUREKA_COST_FRACTION = 0.1;
/** "... and deal 10% more damage." */
export const EUREKA_DAMAGE_MULTIPLIER = 1.1;

/**
 * Eureka!: for eight seconds, abilities cost a tenth less and hit a tenth
 * harder.
 *
 * ============================================================================
 * A DURATION REPLACED THREE CHARGES, AND THE CHARGES WERE THE WHOLE DIFFICULTY.
 *
 * The old trait was "your next 3 damaging abilities", and spending those three
 * charges honestly took a REACTION PAIR -- a `dealt` reaction to notice that a
 * non-periodic damaging ability had landed, and a `final` cast reaction to
 * spend a stack afterwards. It had to be a pair because "a damaging ability"
 * cannot be read off an ability's declaration: Rupture and Serpent Sting both
 * declare an attack table and deal no direct damage, so `requiresAttackTable`
 * would have thrown a charge away on each, and because `consumeCastCharges`
 * runs BEFORE `onCast`, so an aura spending its own last stack would have been
 * gone by the time `dealDamage` looked for the damage half -- Holy Shield's bug
 * exactly, an ability quietly worth two thirds of itself.
 *
 * AN 8 SECOND WINDOW PAYS WHATEVER LANDS INSIDE IT and nothing has to decide
 * what counted, so `eurekaReactions` is deleted along with `consumedByCast`,
 * `maxStacks` and `chargesOnApply`. That is the rare redesign that removes a
 * mechanism rather than adding one.
 *
 * WHAT THE CHANGE IS ACTUALLY WORTH IS A QUESTION ABOUT CAST RATE, not about
 * the number 8. Three charges were spent in about three global cooldowns --
 * roughly 4.5 seconds on a 1.5s GCD, less for a Rogue -- so eight seconds is
 * MORE for a caster and about the same or less for an ability-starved melee
 * build that cannot fill the window. Said here because "a buff got longer"
 * reads as a straight buff and it is not one for every class.
 *
 * `nonPeriodicDamageMultiplier` RATHER THAN `abilityModifiers`, unchanged and
 * still load-bearing: the clause is "periodic effects get nothing from it" and
 * `abilityModifierFor` is not told whether the damage is a tick, so an
 * `abilityModifiers: { '*': ... }` entry would raise Ignite, Pyroblast's burn
 * and every Corruption tick inside the window -- a bigger number and no error.
 *
 * AND POWER WORD: SHIELD IS NOT HERE. "Now also benefits Power Word: Shield"
 * is the note's third clause and it is an ABSORB, which is healing throughput
 * -- out of scope, and declared as such on the trait rather than left silent.
 * ============================================================================
 */
export const EUREKA: AuraDefinition = {
  id: 'eureka',
  name: 'Eureka!',
  durationMs: EUREKA_DURATION_MS,
  castModifier: {
    /*
     * "Ability costs" is not a list and never will be, so the catch-all,
     * narrowed by the one clause that still matters: an ability that costs
     * nothing cannot take a discount.
     *
     * NO `requiresAttackTable`, for the reason it never had one -- Rupture and
     * Serpent Sting HAVE a table and deal no damage, so the table is the wrong
     * question. With the charges gone this is no longer even a question about
     * waste: there is nothing to throw away, so a non-damaging cast taking its
     * discount inside the window costs the trait nothing.
     */
    abilityIds: [ALL_ABILITIES],
    requiresCost: true,
    costFraction: EUREKA_COST_FRACTION,
  },
  nonPeriodicDamageMultiplier: EUREKA_DAMAGE_MULTIPLIER,
};

/** Every aura an active racial applies, for the catalog and for tests. */
// ---------------------------------------------------------------------------
// High Order Skyborne: Read Ley Line (round 79)
// ---------------------------------------------------------------------------

/** "2 sec cast, 2 min cooldown", the client's line, unchanged by the tuning. */
export const READ_LEY_LINE_CAST_MS = seconds(2);
export const READ_LEY_LINE_COOLDOWN_MS = seconds(120);
/** "Increases Mana and Health regeneration by 50% ... with a 15-second duration". */
export const READ_LEY_LINE_DURATION_MS = seconds(15);
export const READ_LEY_LINE_REGEN_MULTIPLIER = 1.5;

/**
 * Read Ley Line's window: mana regeneration at x1.5 for 15 seconds.
 *
 * THE MANA HALF ONLY. `resourceRegenMultiplier` is the field Evocation and
 * Innervate use, and every regeneration rule reads it. The health half has no
 * rate to raise and is declared `unmodelled` on the trait. Attuned -- 100% at a
 * Ley Line -- needs a place and is a question for the owner.
 */
export const READ_LEY_LINE: AuraDefinition = {
  id: 'read_ley_line',
  name: 'Read Ley Line',
  durationMs: READ_LEY_LINE_DURATION_MS,
  resourceRegenMultiplier: { mana: READ_LEY_LINE_REGEN_MULTIPLIER },
};

export const CATALOG_AURAS: readonly AuraDefinition[] = [
  READ_LEY_LINE,
  STONEFORM,
  ELUNES_LIGHT,
  BLOOD_FURY,
  BERSERKING,
  EUREKA,
];
