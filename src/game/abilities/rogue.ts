import type { Ability } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import {
  ADRENALINE_RUSH,
  BLADE_FLURRY,
  BLADE_FLURRY_UNMODELLED,
  COLD_BLOOD,
  COLD_BLOOD_ABILITIES,
  CUTTHROAT,
  STEALTH,
  GHOSTLY_STRIKE_DODGE_AURA,
  HEMORRHAGE_DEBUFF,
  THOUSAND_CUTS_BONUS,
  exposeArmorAura,
  ruptureAura,
  sliceAndDiceAura,
  venomAura,
} from '../auras/rogue';
import { awardComboPoint, hasComboPoints, spendComboPoints } from '../combat/comboPoints';
import { EVISCERATE_AP_COEFFICIENT_PER_COMBO_POINT } from '../combat/coefficients';

/**
 * Rogue abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * `src/data/abilities/forever-rogue-spellbook.json` holds the capture, written
 * by `tools/import_forever_spells.mjs` at MAX RANK -- the rank a level 60
 * trains. Read `docs/class-implementation.md` before changing a number here.
 *
 * ----------------------------------------------------------------------------
 * THE SHAPE OF THE CLASS, and what is genuinely new against the Warrior.
 *
 * BUILDERS AND FINISHERS. A builder awards a combo point when it LANDS and a
 * finisher spends every point there is, scaling by how many. See
 * `game/combat/comboPoints.ts` for why that is a helper rather than five
 * copies of read-drain-scale.
 *
 * ENERGY, NOT RAGE. It arrives as a fixed batch on a timer rather than being
 * earned, so a Rogue is never rage-starved after a bad run of misses -- but
 * also never rewarded for a good one. The whole rotation is a queue against a
 * clock.
 *
 * WHAT IS NOT HERE AND WHY -- and two of the three entries this list used to
 * carry have been answered since it was written:
 *
 *   - ~~POISONS~~ BUILT. `reactions/poisons.ts` and the two poison auras. A
 *     poison is NOT a weapon use but IS triggered by one, and its chance is
 *     flat per strike rather than procs per minute -- the opposite of every
 *     weapon enchant here, and both are the owner's rulings.
 *   - ~~STEALTH OPENERS~~ RULED, AND THE RULING HAS NOW WIDENED TWICE. Garrote
 *     and Cheap Shot are absent for good. AMBUSH IS THE EXCEPTION: the owner
 *     first ruled that Cutthroat's proc IS its stealth requirement, and has
 *     since added Vanish and the pull as two more routes to the same gate --
 *     "it just needs to enable Ambush". So there is STILL no stealth system,
 *     and `STEALTH` is an aura Ambush reads rather than a state anything
 *     tracks. Premeditation never had a stealth clause in Forever at all.
 *
 *     THE PART WORTH CARRYING FORWARD is that three talents stayed dead for a
 *     release after the FIRST half of this ruling landed -- Improved Ambush,
 *     Initiative and Opportunity's Ambush clause all read "Ambush requires
 *     stealth and is absent", which stopped being true the day Ambush was
 *     declared. Clearing a blocker is not finished until every reason naming
 *     it has been re-read.
 *   - POSITIONAL REQUIREMENTS, still dropped. Backstab and Ambush "must be
 *     behind the target". Nothing in this simulator has a facing, so the
 *     requirement is dropped and SAID to be dropped rather than silently met.
 *     The dagger half of the same sentence is enforced, because a weapon type
 *     is knowable.
 * ----------------------------------------------------------------------------
 */

const MAIN_HAND = 'mainHand' as const;
const OFF_HAND = 'offHand' as const;
const PHYSICAL = 'physical' as const;

/**
 * Spend Cold Blood if it is up and this ability is one of the five it names.
 *
 * Returns nothing: the crit has already been applied by the aura's stat
 * modifier, and this only removes it. Called AFTER the damage, because
 * removing it first would take the bonus away before the roll that needed it.
 */
function consumeColdBlood(
  simulation: Parameters<NonNullable<Ability['onCast']>>[0]['simulation'],
  caster: Parameters<NonNullable<Ability['onCast']>>[0]['caster'],
  abilityId: string,
): void {
  if (!COLD_BLOOD_ABILITIES.has(abilityId)) return;
  if (caster.auras.remainingMs(COLD_BLOOD.id, simulation.clock.now()) <= 0) return;
  caster.auras.remove(simulation, COLD_BLOOD.id);
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/** "68 damage in addition to your normal weapon damage. Awards 1 combo point." */
export const SINISTER_STRIKE_BASE_DAMAGE = 68;

export const SINISTER_STRIKE: Ability = {
  id: 'sinister_strike',
  // Declared so Seal Fate can see it; the award itself is in `onCast`.
  comboPointsAwarded: 1,
  name: 'Sinister Strike',
  cost: { resource: 'energy', amount: 45 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: SINISTER_STRIKE_BASE_DAMAGE,
      weaponScaling: { slot: MAIN_HAND, normalized: true },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });

    // A builder that missed builds nothing. Same rule as rage from damage
    // dealt, and for the same reason.
    if (!result.avoided) {
      awardComboPoint(simulation, caster, target, ability.id, ability.name);
    }
    consumeColdBlood(simulation, caster, ability.id);
  },
};

/**
 * "150% weapon damage plus 225. Must be behind the target. Requires a dagger
 * in the main hand."
 *
 * THE POSITION IS DROPPED and the DAGGER IS NOT. Nothing here has a facing, so
 * "behind the target" cannot be checked and is not pretended to be; the weapon
 * is knowable, so it is enforced.
 */
/*
 * 150 AND NOT 225, from foreverchanges.pro, by the owner's standing rule that it
 * wins a disagreement. Both sources were read at build 1.60.1.70009 and the
 * tooltips are otherwise identical -- "150% weapon damage plus 150" against
 * "...plus 225". The checked-in capture still says 225 and is not hand-edited.
 *
 * 225 IS 150 x 1.5, WHICH IS WHY THIS ONE IS WORTH A SECOND LOOK IF IT EVER
 * COMES BACK: the losing figure is exactly the flat damage times the weapon
 * fraction beside it, so one of the two sources may be rendering the tooltip
 * with the coefficient already applied. Neither states which.
 */
export const BACKSTAB_BASE_DAMAGE = 150;
export const BACKSTAB_WEAPON_FRACTION = 1.5;

export const BACKSTAB: Ability = {
  id: 'backstab',
  // Declared so Seal Fate can see it; the award itself is in `onCast`.
  comboPointsAwarded: 1,
  name: 'Backstab',
  cost: { resource: 'energy', amount: 60 },
  attackTable: 'melee-special',
  canCast: ({ caster }) => caster.weapons.mainHand?.weaponType === 'dagger',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: BACKSTAB_BASE_DAMAGE,
      weaponScaling: {
        slot: MAIN_HAND,
        fraction: BACKSTAB_WEAPON_FRACTION,
        normalized: true,
      },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    if (!result.avoided) awardComboPoint(simulation, caster, target, ability.id, ability.name);
    consumeColdBlood(simulation, caster, ability.id);
  },
  unmodelled:
    'Its "must be behind the target" is dropped: nothing in this simulator ' +
    'has a facing, so the requirement cannot be checked and is not pretended ' +
    'to be met. The dagger requirement IS enforced.',
};

/**
 * "Attacks with BOTH weapons for 75% weapon damage plus 38 with each. Damage
 * increased by 20% against Poisoned targets. Awards 2 Combo Points."
 *
 * TWO ATTACKS AND TWO COMBO POINTS, which makes it the only builder in the
 * class that can take a Rogue from four points to over the cap. The overflow
 * is wasted and reported, rather than refused -- see `comboPoints.ts`.
 *
 * ITS POISON CLAUSE IS APPLIED, AND NOT FROM HERE. "Damage increased by 20%
 * against Poisoned targets" is a property of the TARGET's state, so it is
 * carried by Deadly Poison's own debuff as an `abilityDamageTaken` entry and
 * read by the damage pipeline -- `MUTILATE_POISONED_BONUS` in `auras/rogue.ts`
 * has the reasoning. Putting it in this `onCast` would have broken the
 * standing rule that per-ability damage goes through a modifier the pipeline
 * consults, and nothing here would look wrong if it had.
 *
 * IT WAS REACHABLE AND UNREAD FOR A WHOLE RELEASE. The clause said "does
 * nothing: poisons are not implemented" for as long as that was true, and the
 * poison system landing turned it into a live 20% on the signature ability of
 * the build that takes it without anybody touching this file.
 */
// 50 and not 38, from foreverchanges.pro by the same rule -- "an additional 50
// with each weapon" against our capture's 38, same rank 4, same build.
export const MUTILATE_BASE_DAMAGE = 50;
export const MUTILATE_WEAPON_FRACTION = 0.75;
export const MUTILATE_COMBO_POINTS = 2;

export const MUTILATE: Ability = {
  id: 'mutilate',
  comboPointsAwarded: MUTILATE_COMBO_POINTS,
  name: 'Mutilate',
  cost: { resource: 'energy', amount: 60 },
  attackTable: 'melee-special',
  canCast: ({ caster }) =>
    caster.weapons.mainHand?.weaponType === 'dagger' &&
    caster.weapons.offHand?.weaponType === 'dagger',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;

    let landed = false;
    for (const slot of [MAIN_HAND, OFF_HAND] as const) {
      if (!caster.weapons[slot]) continue;
      const result = dealDamage(simulation, {
        source: caster,
        target,
        abilityId: ability.id,
        abilityName: slot === OFF_HAND ? 'Mutilate (Off Hand)' : ability.name,
        school: PHYSICAL,
        baseAmount: MUTILATE_BASE_DAMAGE,
        weaponScaling: { slot, fraction: MUTILATE_WEAPON_FRACTION, normalized: true },
        attackTable: ability.attackTable,
        weaponSlot: slot,
      });
      if (!result.avoided) landed = true;
    }

    // Two points for the ability, not one per hand: the source says "Awards 2
    // Combo Points", and a half-avoided Mutilate is still a Mutilate.
    if (landed) {
      awardComboPoint(simulation, caster, target, ability.id, ability.name, MUTILATE_COMBO_POINTS);
    }
    consumeColdBlood(simulation, caster, ability.id);
  },
};

/**
 * "100% weapon damage (145% if a Dagger is equipped) and causes the target to
 * take 15% increased Rupture damage. Awards 1 Combo Point."
 */
export const HEMORRHAGE_WEAPON_FRACTION = 1.0;
export const HEMORRHAGE_DAGGER_FRACTION = 1.45;

export const HEMORRHAGE: Ability = {
  id: 'hemorrhage',
  // Declared so Seal Fate can see it; the award itself is in `onCast`.
  comboPointsAwarded: 1,
  name: 'Hemorrhage',
  cost: { resource: 'energy', amount: 35 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const dagger = caster.weapons.mainHand?.weaponType === 'dagger';
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 0,
      weaponScaling: {
        normalized: true,
        slot: MAIN_HAND,
        fraction: dagger ? HEMORRHAGE_DAGGER_FRACTION : HEMORRHAGE_WEAPON_FRACTION,
      },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });

    if (!result.avoided) {
      awardComboPoint(simulation, caster, target, ability.id, ability.name);
      simulation.applyAura(target, HEMORRHAGE_DEBUFF, caster.id);
    }
  },
};

/**
 * "125% (180% with a Dagger in your Main Hand) weapon damage and increases
 * your chance to dodge by 15% for 7 sec. Awards 1 combo point."
 */
export const GHOSTLY_STRIKE_WEAPON_FRACTION = 1.25;
export const GHOSTLY_STRIKE_DAGGER_FRACTION = 1.8;

export const GHOSTLY_STRIKE: Ability = {
  id: 'ghostly_strike',
  // Declared so Seal Fate can see it; the award itself is in `onCast`.
  comboPointsAwarded: 1,
  name: 'Ghostly Strike',
  cost: { resource: 'energy', amount: 40 },
  cooldownMs: seconds(20),
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const dagger = caster.weapons.mainHand?.weaponType === 'dagger';
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: 0,
      weaponScaling: {
        slot: MAIN_HAND,
        fraction: dagger ? GHOSTLY_STRIKE_DAGGER_FRACTION : GHOSTLY_STRIKE_WEAPON_FRACTION,
      },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });

    // The dodge goes up whether or not the strike landed: it is a state the
    // cast confers, not a rider on the hit.
    simulation.applyAura(caster, GHOSTLY_STRIKE_DODGE_AURA, caster.id);
    if (!result.avoided) awardComboPoint(simulation, caster, target, ability.id, ability.name);
  },
};

// ---------------------------------------------------------------------------
// Finishers
// ---------------------------------------------------------------------------

/**
 * Eviscerate's stated damage at 1..5 combo points, as the midpoint of each
 * range.
 *
 *     1 point : 224-332     4 points: 734-842
 *     2 points: 394-502     5 points: 904-1,012
 *     3 points: 564-672
 *
 * THE MIDPOINT, and the spread is dropped. Every step is exactly 170 apart and
 * every range is exactly 108 wide, so the table is regular enough to be
 * confident it was read correctly. The engine's combat table supplies the
 * variance a real cast shows.
 */
export const EVISCERATE_BY_COMBO_POINT: readonly number[] = [278, 448, 618, 788, 958];

export const EVISCERATE: Ability = {
  id: 'eviscerate',
  name: 'Eviscerate',
  cost: { resource: 'energy', amount: 35 },
  attackTable: 'melee-special',
  canCast: ({ caster, target }) => hasComboPoints(caster, target),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;

    // READ, DRAIN, THEN SCALE. `spendComboPoints` returns what it drained so
    // the order cannot be got wrong. See game/combat/comboPoints.ts.
    const spent = spendComboPoints(caster, target, {
      context: simulation,
      abilityId: ability.id,
      abilityName: ability.name,
    });
    if (spent <= 0) return;

    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      // The flat figure for the points spent, which the coefficient adds to.
      baseAmount: EVISCERATE_BY_COMBO_POINT[spent - 1],
      /*
       * 4% OF ATTACK POWER PER COMBO POINT SPENT, so a five-point Eviscerate
       * carries 20%.
       *
       * THE TOOLTIP SAID THIS ALL ALONG -- "causes damage per combo point,
       * increased by Attack Power" -- and the figure was the missing half. The
       * coefficient audit found it flat, the owner supplied the rate, and the
       * `unmodelled` note that used to sit here has expired with it.
       */
      powerCoefficient: EVISCERATE_AP_COEFFICIENT_PER_COMBO_POINT * spent,
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    consumeColdBlood(simulation, caster, ability.id);
  },
};

export const RUPTURE: Ability = {
  id: 'rupture',
  name: 'Rupture',
  cost: { resource: 'energy', amount: 25 },
  attackTable: 'melee-special',
  canCast: ({ caster, target }) => hasComboPoints(caster, target),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target || !ability.attackTable) return;

    const spent = spendComboPoints(caster, target, {
      context: simulation,
      abilityId: ability.id,
      abilityName: ability.name,
    });
    if (spent <= 0) return;

    /*
     * THOUSAND CUTS TRAVELS WITH THE BLEED. The talent fires off a Rupture
     * TICK, and a tick runs no reactions -- so the aura it applies has to be
     * built here, where the talent's value is reachable as a named bonus, and
     * carried into the aura. Zero for a Rogue without the talent, which
     * `ruptureAura` reads as "apply nothing".
     */
    const thousandCuts = ability.bonuses?.[THOUSAND_CUTS_BONUS] ?? 0;

    /*
     * Rolled ONCE here rather than per tick, exactly as Rend is: whether the
     * bleed landed is settled when it is applied, and then it ticks for its
     * whole duration.
     */
    const roll = simulation.rollAttack(ability.attackTable, caster, target, {
      slot: MAIN_HAND,
    });
    if (roll.avoided) return;

    simulation.applyAura(target, ruptureAura(spent, thousandCuts), caster.id);
  },
};

/** The key Improved Slice and Dice hands its percentage over on. */
export const SLICE_AND_DICE_DURATION_BONUS = 'durationPercent';

export const SLICE_AND_DICE: Ability = {
  id: 'slice_and_dice',
  name: 'Slice and Dice',
  cost: { resource: 'energy', amount: 25 },
  requiresTarget: false,
  /*
   * A SELF-BUFF FINISHER, so it spends the pool WITHOUT naming a target.
   * The points are on the enemy; the buff is on the Rogue. `requiresTarget`
   * is false and there is no target to check them against, which is exactly
   * the case `spendComboPoints` leaves the argument optional for.
   */
  canCast: ({ caster }) => hasComboPoints(caster),
  onCast: ({ simulation, caster, ability }) => {
    const spent = spendComboPoints(caster, undefined, {
      context: simulation,
      abilityId: ability.id,
      abilityName: ability.name,
    });
    if (spent <= 0) return;

    /*
     * Improved Slice and Dice lengthens it by a percentage, and that number
     * lives inside this body rather than in a declared field -- so it arrives
     * as a named bonus on the copy of this ability built for a character who
     * took the talent. Improved Charge does the same with its rage.
     */
    const bonus = ability.bonuses?.[SLICE_AND_DICE_DURATION_BONUS] ?? 0;
    simulation.applyAura(caster, sliceAndDiceAura(spent, 1 + bonus / 100), caster.id);
  },
};

/**
 * Venom, granted by the Assassination talent.
 *
 * A finisher that buffs POISONS and deals no damage of its own, which makes it
 * the only Rogue finisher whose worth depends entirely on another system. It
 * was `unmodelled` for exactly as long as poisons were.
 */
export const VENOM: Ability = {
  id: 'venom',
  name: 'Venom',
  cost: { resource: 'energy', amount: 25 },
  requiresTarget: false,
  /*
   * A SELF-BUFF FINISHER, so it spends the pool WITHOUT naming a target.
   * The points are on the enemy; the buff is on the Rogue. `requiresTarget`
   * is false and there is no target to check them against, which is exactly
   * the case `spendComboPoints` leaves the argument optional for.
   */
  canCast: ({ caster }) => hasComboPoints(caster),
  onCast: ({ simulation, caster, ability }) => {
    const spent = spendComboPoints(caster, undefined, {
      context: simulation,
      abilityId: ability.id,
      abilityName: ability.name,
    });
    if (spent <= 0) return;
    simulation.applyAura(caster, venomAura(spent), caster.id);
  },
};

export const EXPOSE_ARMOR: Ability = {
  id: 'expose_armor',
  name: 'Expose Armor',
  cost: { resource: 'energy', amount: 25 },
  canCast: ({ caster, target }) => hasComboPoints(caster, target),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const spent = spendComboPoints(caster, target, {
      context: simulation,
      abilityId: ability.id,
      abilityName: ability.name,
    });
    if (spent <= 0) return;
    simulation.applyAura(target, exposeArmorAura(spent), caster.id);
  },
};

// ---------------------------------------------------------------------------
// Cooldowns
// ---------------------------------------------------------------------------

export const ADRENALINE_RUSH_ABILITY: Ability = {
  id: 'adrenaline_rush',
  name: 'Adrenaline Rush',
  cooldownMs: seconds(300),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, ADRENALINE_RUSH, caster.id);
  },
};

export const BLADE_FLURRY_ABILITY: Ability = {
  id: 'blade_flurry',
  name: 'Blade Flurry',
  cost: { resource: 'energy', amount: 25 },
  cooldownMs: seconds(120),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, BLADE_FLURRY, caster.id);
  },
  unmodelled: BLADE_FLURRY_UNMODELLED,
};

export const COLD_BLOOD_ABILITY: Ability = {
  id: 'cold_blood',
  name: 'Cold Blood',
  cooldownMs: seconds(180),
  requiresTarget: false,
  // Off the global cooldown: it is a state change with no cast of its own,
  // and spending a GCD to buff the next ability would be self-defeating.
  triggersGcd: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, COLD_BLOOD, caster.id);
  },
};

/**
 * Preparation: "When activated, this ability immediately finishes the cooldown
 * on your other Rogue abilities." Free, instant, ten minute cooldown.
 *
 * ----------------------------------------------------------------------------
 * ITS `unmodelled` REASON WAS A STATEMENT ABOUT THE ENGINE, and the right one:
 * "nothing can reset a cooldown from content -- the engine owns them." So the
 * engine now offers `AbilityBook.resetCooldowns`, and this is its only caller.
 *
 * "YOUR OTHER ROGUE ABILITIES" -- Preparation is not one of them, and that is
 * why the reset takes an exception rather than clearing everything. A reset
 * including itself would put a ten minute cooldown back up instantly and hand
 * the Rogue an unlimited supply, which shows up as a suspiciously good Rogue
 * rather than as an error.
 *
 * WHAT IT IS ACTUALLY WORTH HERE IS SMALL AND THAT IS FINE. A sixty second
 * fight sees one cast, and the Subtlety build's resettable cooldowns are
 * Premeditation at two minutes, Ghostly Strike at twenty seconds and Cold
 * Blood. The list the owner wrote puts it LAST, below every builder, so it
 * fires only when nothing else can -- which is the correct place for an
 * ability whose value is entirely in what it gives back.
 *
 * ----------------------------------------------------------------------------
 * AND "ROGUE ABILITIES" IS NARROWER THAN "the book", WHICH IS NOT WHAT THIS
 * SHIPPED AS.
 *
 * `resetCooldowns(ability.id)` reset every ability the character had, and for as
 * long as a book held nothing but class abilities that was the same thing. It is
 * not any more: a RACIAL is learned by a race and a mid-fight CONSUMABLE by
 * drinking one, and both are appended to the same book.
 *
 * SO IT WAS HANDING A ROGUE A SECOND THISTLE TEA -- a five minute cooldown fired
 * TWICE in a sixty second fight, measured at 2.00 casts on the Rupture profile
 * and 1.86 on Hemo, worth about thirty DPS of pure inflation. A hundred energy
 * that should not exist is a bigger number and no error, and it was found only
 * because the probe printed the CAST COUNT beside the DPS: the figure alone
 * reads as a potion that is unusually good.
 *
 * THE RACIAL HALF IS THE SAME BUG AND IS WORTH 0.0 TODAY, which is why nobody
 * found it when the racials landed. Preparation is only in the two SUBTLETY
 * lists and both of those profiles are UNDEAD -- whose racial is a passive
 * reaction, not an ability with a cooldown. An Orc Subtlety Rogue would have
 * been resetting Blood Fury. "An encounter-cause note is a dated claim like any
 * other", and this one expires the day a preset changes race.
 * ----------------------------------------------------------------------------
 */
export const PREPARATION: Ability = {
  id: 'preparation',
  name: 'Preparation',
  cooldownMs: seconds(600),
  requiresTarget: false,
  onCast: ({ caster, ability }) => {
    /*
     * THE CLASS'S OWN IDS, read off `ROGUE_ABILITIES` rather than written out,
     * so an ability added to the class is covered the day it lands and nothing
     * here can disagree with the spellbook.
     */
    caster.abilities.resetCooldowns(ability.id, ROGUE_ABILITY_IDS);
  },
};

/**
 * Vanish: "Allows the rogue to vanish from sight, entering an improved stealth
 * mode for 10 sec." Instant, five minute cooldown, no energy.
 *
 * ----------------------------------------------------------------------------
 * ITS WHOLE MODELLED EFFECT IS THAT AMBUSH BECOMES CASTABLE, by the ruleset
 * owner's ruling -- "it's a stealth ability, but we don't need stealth to
 * properly function, it just needs to enable Ambush." Everything else Vanish
 * does needs systems that are out of scope, and they are listed in its
 * `unmodelled` rather than quietly dropped.
 *
 * FIVE MINUTES IS LONGER THAN EVERY FIGHT, so this would be a one-use opener
 * cooldown on its own. What makes it a rotational ability is PREPARATION, which
 * finishes the cooldown on every other Rogue ability and therefore on this one:
 * one Vanish, one Preparation, a second Vanish. That is the owner's design for
 * the list and it is why Preparation's gate matters more than its own damage.
 *
 * READ FROM THE CAPTURE AT RANK 2, which is max: `cooldown: "5 min cooldown"`,
 * `cast: "Instant"`, `cost: "Reagents: Flash Powder"`. There is no energy cost
 * to charge -- the reagent is the cost, and a consumable is not a resource this
 * engine tracks.
 *
 * IT TAKES A GLOBAL COOLDOWN, which is the engine's default and not a stated
 * fact. Nothing in the source says it is off the GCD, and `triggersGcd` is
 * derived rather than declared here precisely so a guess is never written down
 * as data. If the owner states otherwise it is one field.
 * ----------------------------------------------------------------------------
 */
export const VANISH: Ability = {
  id: 'vanish',
  name: 'Vanish',
  cooldownMs: seconds(300),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, STEALTH, caster.id);
  },
  unmodelled:
    'Only its stealth-for-Ambush effect is modelled, by the ruleset owner: ' +
    'it does not drop combat, remove threat (not tracked), break movement ' +
    'impairing effects (out of scope), or cost its Flash Powder reagent.',
};

/**
 * Ambush: "causing 250% weapon damage plus 290 to the target. Must be stealthed
 * and behind the target. Requires a dagger in the main hand. Awards 1 combo
 * point." 60 energy.
 *
 * ----------------------------------------------------------------------------
 * ITS STEALTH REQUIREMENT IS CUTTHROAT, by the ruleset owner's ruling: "because
 * we're never in stealth Cutthroat can simply be modelled by allowing Ambush to
 * be castable only when Cutthroat buff is active."
 *
 * So there is no stealth system and none is needed. The aura IS the gate, which
 * is the shape Mongoose Bite already has with Expose Prey -- an ability whose
 * only route to being cast is a proc, gated in `canCast` on the aura that proc
 * applies.
 *
 * THE DAGGER REQUIREMENT IS ENFORCED and the positional is not, which is the
 * same split Backstab and Shred make. Nothing here has a facing; every hand has
 * a weapon type.
 *
 * THE AURA IS SPENT ON CAST, not on the hit. "Your NEXT Ambush" is one cast,
 * and a dodged Ambush was still the next one -- consuming it only on a
 * connection would hand back a free window for a miss the Rogue has already
 * paid the energy for.
 *
 * ----------------------------------------------------------------------------
 * AND STEALTH IS A SECOND ROUTE TO THE SAME GATE, from the pull or from Vanish.
 * The owner has extended the Cutthroat ruling: stealth itself is not modelled,
 * and what it does is make Ambush castable. So the condition is EITHER aura
 * rather than two separate requirements -- an Ambush does not need both.
 *
 * CUTTHROAT IS SPENT FIRST WHEN BOTH ARE UP, which is a real choice and not an
 * arbitrary order. Cutthroat comes off a Backstab proc several times a fight; a
 * stealth window comes from a five-minute cooldown. Spending the renewable one
 * first keeps the scarce one available for the next Ambush, and spending both
 * would throw one away for nothing.
 * ----------------------------------------------------------------------------
 */
/** Named because the Rupture list gates Vanish on being able to afford it. */
export const AMBUSH_ENERGY_COST = 60;
export const AMBUSH_BASE_DAMAGE = 290;
export const AMBUSH_WEAPON_FRACTION = 2.5;

export const AMBUSH: Ability = {
  id: 'ambush',
  // Declared so Seal Fate can see it; the award itself is in `onCast`.
  comboPointsAwarded: 1,
  name: 'Ambush',
  cost: { resource: 'energy', amount: AMBUSH_ENERGY_COST },
  attackTable: 'melee-special',
  canCast: ({ caster }) =>
    caster.weapons.mainHand?.weaponType === 'dagger' &&
    (caster.auras.has(CUTTHROAT.id) || caster.auras.has(STEALTH.id)),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    // Cutthroat first; see the note above on why the order is a decision.
    if (caster.auras.has(CUTTHROAT.id)) caster.auras.remove(simulation, CUTTHROAT.id);
    else caster.auras.remove(simulation, STEALTH.id);
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: AMBUSH_BASE_DAMAGE,
      weaponScaling: {
        slot: MAIN_HAND,
        fraction: AMBUSH_WEAPON_FRACTION,
        normalized: true,
      },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    if (!result.avoided) awardComboPoint(simulation, caster, target, ability.id, ability.name);
    consumeColdBlood(simulation, caster, ability.id);
  },
  unmodelled:
    'Its "must be behind the target" is dropped: nothing here has a facing. ' +
    'Its "must be stealthed" is satisfied by Cutthroat rather than modelled, ' +
    "by the ruleset owner's ruling -- so a Rogue without that talent can " +
    'never cast this at all, which is correct for an encounter that opens in ' +
    'combat.',
};

/**
 * Premeditation: "Adds 2 Combo Points to your target. You must add to or use
 * those combo points within 20 sec or the combo points are lost." Free, two
 * minute cooldown.
 *
 * ----------------------------------------------------------------------------
 * IT BANKS POINTS BY WRITING THE POOL, WHICH IS THE TRAP. Combo points belong
 * to a TARGET here, and anything that grants them without setting
 * `comboPointTargetId` leaves the pool pointing at nobody -- every finisher
 * then refuses to spend and reads as an ability that lost its flat damage.
 * `awardComboPoint` is the helper that gets it right, so this goes through it
 * rather than touching the resource.
 *
 * ITS TWENTY SECOND EXPIRY IS NOT MODELLED. A combo point pool here has no
 * clock, and the list that casts this follows it immediately with a builder,
 * so the window is never the binding constraint -- but it is generous and says
 * so rather than being quietly dropped.
 * ----------------------------------------------------------------------------
 */
export const PREMEDITATION_COMBO_POINTS = 2;

export const PREMEDITATION: Ability = {
  id: 'premeditation',
  name: 'Premeditation',
  cooldownMs: seconds(120),
  requiresTarget: true,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    awardComboPoint(
      simulation,
      caster,
      target,
      ability.id,
      ability.name,
      PREMEDITATION_COMBO_POINTS,
    );
  },
  unmodelled:
    'Its "within 20 sec or the combo points are lost" is not modelled: a ' +
    'combo point pool here has no clock. Generous, and never binding in a ' +
    'list that follows it with a builder.',
};

export const ROGUE_ABILITIES: readonly Ability[] = [
  SINISTER_STRIKE,
  BACKSTAB,
  MUTILATE,
  HEMORRHAGE,
  GHOSTLY_STRIKE,
  EVISCERATE,
  RUPTURE,
  SLICE_AND_DICE,
  // Granted by the Assassination talent; `grantsByAbility` gates it.
  VENOM,
  EXPOSE_ARMOR,
  ADRENALINE_RUSH_ABILITY,
  BLADE_FLURRY_ABILITY,
  COLD_BLOOD_ABILITY,
  // Granted by the Subtlety talent; `grantsByAbility` gates it.
  PREPARATION,
  /*
   * VANISH IS A TRAINER ABILITY, not a talent -- the capture has it in the
   * Subtlety TAB, "Learned at level 42" -- so every Rogue has it, the same way
   * every Rogue has Ambush.
   */
  VANISH,
  /*
   * AMBUSH IS A TRAINER ABILITY, not a talent, so every Rogue has it -- and
   * only a Rogue with Cutthroat can ever cast one, which `canCast` enforces.
   * A Venom or Combat Rogue carrying an Ambush it can never use is the honest
   * state of the ability rather than a gap.
   */
  AMBUSH,
  // Granted by the Subtlety talent; `grantsByAbility` gates it.
  PREMEDITATION,
];

/**
 * The ids of everything above, for Preparation's reset.
 *
 * ----------------------------------------------------------------------------
 * DERIVED FROM THE LIST rather than written out, so a Rogue ability added above
 * is resettable the day it lands and the two cannot disagree. Declared AFTER
 * `ROGUE_ABILITIES` and read inside `onCast`, which is what makes the forward
 * reference from `PREPARATION` safe: the constant is resolved when the ability
 * is CAST, long after this module has finished loading.
 *
 * WHAT IT EXCLUDES IS THE WHOLE POINT. A racial and a mid-fight consumable sit
 * in the same ability BOOK and are not Rogue abilities, and resetting them gave
 * a Rogue a second Thistle Tea on a five minute cooldown. See `PREPARATION`.
 * ----------------------------------------------------------------------------
 */
export const ROGUE_ABILITY_IDS: ReadonlySet<string> = new Set(
  ROGUE_ABILITIES.map((ability) => ability.id),
);
