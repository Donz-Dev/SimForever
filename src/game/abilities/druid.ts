import type { Ability, Combatant, SimulationContext } from '../../engine';
import { DEMORALIZING_ROAR_FLAT_THREAT, FAERIE_FIRE_THREAT_PER_LEVEL } from '../combat/threat';
import { applyHealing, dealDamage, seconds } from '../../engine';
import { areaTargets } from '../combat/multiTarget';
import { HURRICANE_TICK_SP_COEFFICIENT } from '../combat/coefficients';
import {
  DEMORALIZING_ROAR,
  ECLIPSE_CHARGES_PER_WRATH,
  eclipseAura,
  INSECT_SWARM,
  LACERATE,
  MAUL_BONUS_DAMAGE,
  MOONFIRE_COEFFICIENTS,
  MOONFIRE_DOT,
  RAKE_DOT,
  BARKSKIN,
  BARKSKIN_COOLDOWN_MS,
  ENRAGE,
  ENRAGE_COOLDOWN_MS,
  ENRAGE_INSTANT_RAGE,
  FAERIE_FIRE,
  FRENZIED_REGENERATION,
  FRENZIED_REGENERATION_COOLDOWN_MS,
  NATURES_SWIFTNESS,
  NATURES_SWIFTNESS_COOLDOWN_MS,
  PROWL,
  PREDATORY_DISCIPLINE_AURA_ID,
  lengthened,
  ripAura,
  INNERVATE_AURA,
  REGROWTH_HOT,
  REGROWTH_TICK,
  REJUVENATION_HOT,
  REJUVENATION_TICK,
  REJUVENATION_TICK_INTERVAL_MS,
  REGROWTH_TICK_INTERVAL_MS,
  WILD_GROWTH_HOT,
} from '../auras/druid';
import { baseManaFor } from '../character/baseStatLookup';
import { awardComboPoint, hasComboPoints, spendComboPoints } from '../combat/comboPoints';
import {
  FEROCIOUS_BITE_AP_COEFFICIENT_PER_COMBO_POINT,
  RAKE_AP_COEFFICIENT,
  STARFIRE_SP_COEFFICIENT,
  SWIPE_AP_COEFFICIENT,
  WRATH_SP_COEFFICIENT,
  HEALING_TOUCH_HEAL_COEFFICIENT,
  REGROWTH_HEAL_COEFFICIENT,
  REGROWTH_TICK_HEAL_COEFFICIENT,
  REJUVENATION_TICK_HEAL_COEFFICIENT,
} from '../combat/coefficients';

/**
 * Druid abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * THE FIRST CASTER IN THE PROJECT, and the spell path turned out to be fully
 * wired already: `dealDamage` reads `spellPower` for any non-physical school,
 * the spell attack table has its own miss and crit, and cast times are hasted.
 * Nothing here needed an engine change.
 *
 * RESISTANCE IS MODELLED SINCE ROUND 46, AND A RAID BOSS HAS NONE. It was
 * ruled to have no effect at first; Forever's partial-resist rule then arrived
 * (wowsims/forever#76) with the owner's ruling that the boss resists nothing,
 * so a spell still lands for full unless Spell Piercing pushes it past zero.
 * `resistancesFromItems` is the CHARACTER's resistance and still unread,
 * because nothing casts a spell at a profile.
 *
 * EVERY SPELL SCALES, AND THE DATA DID NOT CHANGE. The spell text still states
 * flat damage -- "62 to 68 Nature damage" -- and no coefficient; what arrived
 * is the ruleset owner's universal RULE, `castTime / 3.5` of spell power,
 * which never needed stating per spell. This file said the opposite for as
 * long as nobody had asked. See `game/combat/spellCoefficient.ts`.
 *
 * MOONFIRE IS A HYBRID and shares one coefficient between its hit and its
 * burn; Insect Swarm is a PURE DoT and takes the whole periodic one. The pairs
 * live in `auras/druid.ts`, beside the effect half.
 *
 * ----------------------------------------------------------------------------
 * ONE 1.60.1.70170 PATCH ITEM LANDS NOWHERE IN THIS FILE, AND THAT IS THE
 * ANSWER RATHER THAN AN OMISSION. "Faerie Fire no longer resets your swing
 * timer when used" -- and no Druid casts Faerie Fire here. The armor debuff is
 * modelled as a RAID BUFF (`buffs/raidBuffs.ts`), applied to the encounter's
 * target by an assumed raid rather than by this character, so there is no cast
 * to reset a swing timer and no `Ability.swingTimer: 'hold'` to set.
 *
 * IT IS WRITTEN DOWN BECAUSE A PATCH NOTE WITH NO DIFF BESIDE IT READS AS
 * SOMETHING THAT WAS MISSED, which is the same argument the `unmodelled` lists
 * make from the other direction: an inert effect that SAYS it is inert is the
 * honest failure mode. It expires the day a Druid profile casts the ability --
 * at which point the clause is one field.
 * ----------------------------------------------------------------------------
 */

const MAIN_HAND = 'mainHand' as const;
const PHYSICAL = 'physical' as const;

/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

/**
 * Eclipse's per-rank half second, handed to Wrath by the talent.
 *
 * Named here and in `druidEffects.ts`, and a test asserts the two agree --
 * a key that only one side spells correctly is silently zero.
 */
export const ECLIPSE_REDUCTION_BONUS = 'eclipseReductionSeconds';

/**
 * Seconds Nature's Splendor adds to the aura an ability applies.
 *
 * ONE KEY, TWO ABILITIES. Moonfire gets three seconds and Insect Swarm two, so
 * the talent hands each its own number under the same name -- `abilityBonuses`
 * is keyed by ability id first, which is what makes that work.
 *
 * Named here and in `druidEffects.ts`, with a test that the two agree: a key
 * only one side spells correctly is silently zero, which is why Eclipse's is
 * pinned the same way.
 */
export const AURA_DURATION_BONUS = 'auraDurationBonusSeconds';

// ---------------------------------------------------------------------------
// Balance
// ---------------------------------------------------------------------------

/*
 * WRATH WAS BUFFED IN THE CLIENT AND WE HAD MISSED IT ENTIRELY.
 *
 * 62 to 68 was correct at build 1.60.1.69876 and is not what the client says
 * now: our own refreshed capture reads 92 to 102 at build 1.60.1.70009 and
 * foreverchanges.pro reads 86 to 96. So both current sources agree Wrath gained
 * about 40%, and they disagree on the figure -- the standing rule takes 86-96.
 *
 * THIS IS THE CASE FOR REFRESHING THE CAPTURES, not just for cross-checking
 * them: nothing here was wrong when it was written and it had quietly gone stale.
 */
export const WRATH_DAMAGE = midpoint(86, 96);
export const WRATH_CAST_MS = seconds(2);
/*
 * FROM THE BASE CAST TIME, not `ability.castTimeMs`. Improved Wrath reduces
 * the cast by half a second a rank, and Eclipse shortens Starfire the same
 * way -- reading the reduced figure would make a cast-time talent quietly
 * REDUCE the spell's scaling with gear, which is backwards and would read as
 * a perfectly ordinary number.
 */
export const WRATH_COEFFICIENT = WRATH_SP_COEFFICIENT;

export const WRATH: Ability = {
  id: 'wrath',
  name: 'Wrath',
  cost: { resource: 'mana', amount: 120 },
  castTimeMs: WRATH_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'nature',
      baseAmount: WRATH_DAMAGE,
      powerCoefficient: WRATH_COEFFICIENT,
      attackTable: ability.attackTable,
    });

    /*
     * ECLIPSE. Two charges a Wrath, each worth one shorter Starfire, capped at
     * four -- and it is LIVE now rather than tracked and inert.
     *
     * THE TALENT'S OWN RANK VALUE arrives as an `abilityBonus`, which is the
     * declaration for a number that lives inside an ability's body. Zero means
     * the talent was not taken, and the aura is not applied at all: a
     * nought-second Eclipse would still consume a charge and shorten nothing,
     * which is worse than no aura because it looks like it is working.
     */
    const eclipseSeconds = ability.bonuses?.[ECLIPSE_REDUCTION_BONUS] ?? 0;
    if (eclipseSeconds > 0 && caster.abilities.get('starfire')) {
      for (let i = 0; i < ECLIPSE_CHARGES_PER_WRATH; i += 1) {
        simulation.applyAura(caster, eclipseAura(eclipseSeconds), caster.id);
      }
    }
  },
};

export const STARFIRE_DAMAGE = midpoint(350, 412);
export const STARFIRE_CAST_MS = seconds(3.5);
export const STARFIRE_COEFFICIENT = STARFIRE_SP_COEFFICIENT;

export const STARFIRE: Ability = {
  id: 'starfire',
  name: 'Starfire',
  cost: { resource: 'mana', amount: 340 },
  castTimeMs: STARFIRE_CAST_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'arcane',
      baseAmount: STARFIRE_DAMAGE,
      powerCoefficient: STARFIRE_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

// 124 to 146 from foreverchanges.pro against our capture's 128 to 150. Its
// 240-over-12-seconds bleed agrees on both sides.
export const MOONFIRE_DIRECT = midpoint(124, 146);

export const MOONFIRE: Ability = {
  id: 'moonfire',
  name: 'Moonfire',
  cost: { resource: 'mana', amount: 375 },
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    // Direct damage AND a bleed, rolled once: the roll decides both.
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'arcane',
      baseAmount: MOONFIRE_DIRECT,
      powerCoefficient: MOONFIRE_COEFFICIENTS.direct,
      attackTable: ability.attackTable,
    });
    if (!result.avoided) {
      // Nature's Splendor, or nothing. `lengthened` returns the aura unchanged
      // at zero, so an untalented Moonfire is the same object it always was.
      const extra = ability.bonuses?.[AURA_DURATION_BONUS] ?? 0;
      simulation.applyAura(target, lengthened(MOONFIRE_DOT, extra), caster.id);
    }
  },
};

export const INSECT_SWARM_ABILITY: Ability = {
  id: 'insect_swarm',
  name: 'Insect Swarm',
  cost: { resource: 'mana', amount: 160 },
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target || !ability.attackTable) return;
    const roll = simulation.rollAttack(ability.attackTable, caster, target);
    if (roll.avoided) return;
    const extra = ability.bonuses?.[AURA_DURATION_BONUS] ?? 0;
    simulation.applyAura(target, lengthened(INSECT_SWARM, extra), caster.id);
  },
  unmodelled:
    'Its damage applies. The 2% hit reduction is a DEFENSIVE effect and does ' +
    'nothing against a target that never swings, which every Balance profile ' +
    'faces -- it is applied anyway, so it works the day one does.',
};

// ---------------------------------------------------------------------------
// Feral: Cat
// ---------------------------------------------------------------------------

/** "155% damage plus 180. Must be behind the target." */
export const SHRED_BASE_DAMAGE = 180;
export const SHRED_WEAPON_FRACTION = 1.55;

export const SHRED: Ability = {
  id: 'shred',
  name: 'Shred',
  cost: { resource: 'energy', amount: 60 },
  attackTable: 'melee-special',
  comboPointsAwarded: 1,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: SHRED_BASE_DAMAGE,
      weaponScaling: { slot: MAIN_HAND, fraction: SHRED_WEAPON_FRACTION },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    if (!result.avoided) awardComboPoint(simulation, caster, target, ability.id, ability.name);
  },
  /*
   * ==========================================================================
   * ITS "MUST BE BEHIND THE TARGET" IS *MET*, BY THE OWNER'S RULING, AND THIS
   * ENTRY USED TO SAY THE OPPOSITE.
   *
   * It read: 'Its "must be behind the target" is dropped: nothing here has a
   * facing, so the requirement cannot be checked and is not pretended to be
   * met.' That was honest about the engine and wrong about the ruleset. The
   * owner, giving Ravage the same clause: **"You do NOT need to scope in behind
   * the target positioning. Once again this should be assumed in all cases
   * EXCEPT when 'Target attacks back' is checked."**
   *
   * SO THE BEHAVIOUR DOES NOT CHANGE AND THE CAVEAT DOES. Shred has always
   * dealt its damage; what was wrong was a note telling a reader the build was
   * getting something it had not earned, and an `unmodelled` entry inflating
   * the gap census with a decision.
   *
   * THE EXCEPTION IS NOT ENFORCED AND NOTHING REACHES IT. A character whose
   * target swings back is in FRONT of it -- that is why the encounter grants
   * the target 14% parry -- so a behind-the-target ability should be refused on
   * such a build. No profile combines the two: Shred, Backstab and Ambush
   * belong to the Cat Druid and the four Rogues, and all five set
   * `targetAttacks: false`. `positioning.test.ts` asserts that rather than
   * leaving it assumed, because **a condition nobody declared is not an
   * omission, it is a bonus being paid** -- and the day a tank build takes one
   * of these, that test is what says so.
   * ==========================================================================
   */
};

/*
 * ============================================================================
 * PROWL AND RAVAGE, THE CAT'S OPENER, AND THE OWNER SUPPLIED BOTH FIGURES.
 *
 * "Cat Druid -- the precombat should be 2s before cat form, 1s before prowl, 0s
 * Ravage", with the ability stated outright: "60 energy, Instant cast, Ravage
 * the target, causing 350% damage plus 343 to the target. Must be prowling and
 * behind the target. Awards 1 combo points."
 *
 * EVERY ONE OF THOSE AGREES WITH `forever-druid-spellbook.json` AT RANK 4, which
 * is the rare case of a stated figure and a capture matching exactly -- 60
 * Energy, Instant, and the description word for word.
 *
 * ----------------------------------------------------------------------------
 * 350% IS A WEAPON FRACTION AND THE 343 IS OUTSIDE IT, which is Shred's shape
 * one row up and the owner's own ruling about flat damage: `weapon x 3.5 + 343`,
 * never `(weapon + 343) x 3.5`. For a Druid the weapon is the PAW, so the
 * fraction goes through `weaponScaling` and picks up the form's cadence, the
 * held weapon's dps and the Druid's attack power.
 *
 * NO `powerCoefficient`, because a weapon-damage row carries none -- attack
 * power reaches it through the paw at `speed / 14`. The owner stated no
 * coefficient and `WoWSimWorksheet.xlsx` has no Ravage row.
 *
 * ----------------------------------------------------------------------------
 * IT BREAKS PROWL, AND THAT WAS THE ONE CLAUSE NEITHER SOURCE STATED -- UNTIL
 * THE OWNER ANSWERED IT WIDER THAN THE QUESTION.
 *
 * The reading taken was that Ravage SPENDS the window, following Ambush, with
 * `caster.auras.remove(PROWL)` in this `onCast` and a note calling it a
 * reading. The answer: "**Almost every completed cast or attack breaks
 * stealth/prowl**, and for the purposes of this simulation the only thing that
 * doesn't is a rogue's premeditation."
 *
 * SO THE LINE IS GONE AND NOTHING HERE DOES IT. `PROWL` declares
 * `brokenByAction` and the engine ends it on any completed cast or attack --
 * which is a stronger statement than the reading was, and a safer one: the
 * reading made Ravage's own code responsible for a rule that applies to
 * everything, and the next ability to touch Prowl would have had to remember.
 *
 * NOT IN THE CAT'S PRIORITY LIST, which follows from the rule rather than being
 * a separate decision: the first swing after the pull breaks Prowl and nothing
 * re-applies it, so an entry could never fire. The owner asked for it as an
 * OPENER.
 * ============================================================================
 */
export const PROWL_ABILITY: Ability = {
  id: 'prowl',
  name: 'Prowl',
  cooldownMs: seconds(10),
  requiresTarget: false,
  // Already prowling is not a reason to prowl again, which is the shape Mage
  // Armor, Shadowform, Righteous Fury and the two Aspects all use.
  canCast: ({ caster }) => !caster.auras.has(PROWL.id),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, PROWL, caster.id);
  },
  unmodelled:
    'Its "reduces your movement speed by 30%" is out of scope -- nothing here ' +
    'has a position, so there is no speed for it to reduce. What the aura is ' +
    'FOR is making Ravage castable, which it does.',
};

export const RAVAGE_BASE_DAMAGE = 343;
export const RAVAGE_WEAPON_FRACTION = 3.5;

export const RAVAGE: Ability = {
  id: 'ravage',
  name: 'Ravage',
  cost: { resource: 'energy', amount: 60 },
  attackTable: 'melee-special',
  comboPointsAwarded: 1,
  canCast: ({ caster }) => caster.auras.has(PROWL.id),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: RAVAGE_BASE_DAMAGE,
      weaponScaling: { slot: MAIN_HAND, fraction: RAVAGE_WEAPON_FRACTION },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    if (!result.avoided) awardComboPoint(simulation, caster, target, ability.id, ability.name);
  },
};

/** "110% normal damage plus 126." */
// 115 from foreverchanges.pro against our capture's 126, same rank 5, same
// build. Its 110% weapon fraction agrees on both sides.
export const CLAW_BASE_DAMAGE = 115;
export const CLAW_WEAPON_FRACTION = 1.1;

export const CLAW: Ability = {
  id: 'claw',
  name: 'Claw',
  cost: { resource: 'energy', amount: 45 },
  attackTable: 'melee-special',
  comboPointsAwarded: 1,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: CLAW_BASE_DAMAGE,
      weaponScaling: { slot: MAIN_HAND, fraction: CLAW_WEAPON_FRACTION },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    if (!result.avoided) awardComboPoint(simulation, caster, target, ability.id, ability.name);
  },
};

/** "61 damage and an additional 102 damage over 9 sec." */
export const RAKE_DIRECT_DAMAGE = 61;

export const RAKE: Ability = {
  id: 'rake',
  name: 'Rake',
  cost: { resource: 'energy', amount: 40 },
  attackTable: 'melee-special',
  comboPointsAwarded: 1,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const result = dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      // Flat, plus the sheet's 1% of attack power on the hit.
      baseAmount: RAKE_DIRECT_DAMAGE,
      powerCoefficient: RAKE_AP_COEFFICIENT,
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
    if (!result.avoided) {
      simulation.applyAura(target, RAKE_DOT, caster.id);
      awardComboPoint(simulation, caster, target, ability.id, ability.name);
    }
  },
};

/**
 * Ferocious Bite: damage per combo point, "and converts each extra point of
 * energy into 2.7 additional damage".
 *
 *     1 point  199-259      4 points  640-700
 *     2 points 346-406      5 points  787-847
 *     3 points 493-553
 *
 * THE ENERGY CONVERSION IS EXECUTE'S SHAPE: a fixed cost, then everything left
 * in the bar spent inside `onCast` and turned into damage. The cast hook
 * measures both spends by snapshot, so Ruthlessness sees the combo points
 * without this having to announce them.
 *
 * **IT WAS ALSO EXECUTE'S BUG**, and sharing a shape is how: both reached for
 * `Resource.drain`, which moves the pool and emits nothing, so the variable
 * half of the cost was absent from the resource breakdown. Both go through
 * `simulation.spendResource` now.
 */
export const FEROCIOUS_BITE_BY_COMBO_POINT: readonly number[] = [229, 376, 523, 670, 817];
export const FEROCIOUS_BITE_DAMAGE_PER_ENERGY = 2.7;

export const FEROCIOUS_BITE: Ability = {
  id: 'ferocious_bite',
  /*
   * ALWAYS DEPLETES THE POOL, by the ruleset owner's ruling -- one of exactly
   * two abilities exempt from the 80% refund. It also drains every remaining
   * point of energy into its own damage, so there would be little to hand
   * back even if it did refund.
   */
  refundsCostOnMiss: false,
  name: 'Ferocious Bite',
  cost: { resource: 'energy', amount: 35 },
  attackTable: 'melee-special',
  canCast: ({ caster, target }) => hasComboPoints(caster, target),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const spent = spendComboPoints(caster, target, {
      context: simulation,
      abilityId: ability.id,
      abilityName: ability.name,
    });
    if (spent <= 0) return;

    /*
     * PREDATORY DISCIPLINE KEEPS IT (client build 1.60.1.70707): "no longer
     * converts extra Energy into damage, but still deals extra damage based on
     * your excess Energy". So the bonus is read off the bar exactly as before
     * and the bar is left alone -- the 35 is the whole price, and every point
     * banked above it is 2.7 damage for nothing. That is what makes pooling
     * energy before a bite worth doing, and the Cat list does it.
     */
    const remaining = caster.resources.get('energy')?.current ?? 0;
    const keepsExcess = caster.auras.has(PREDATORY_DISCIPLINE_AURA_ID);

    /*
     * Otherwise everything still in the bar is converted at 2.7 a point -- and
     * spent through `spendResource` rather than drained, for the reason written
     * out at length on `EXECUTE`.
     *
     * THIS ONE WAS LATENT AND THE WARRIOR'S WAS LIVE, which is the only
     * difference between them. Execute is in both damage Warriors' lists and
     * was under-reporting its cost by 1.72x; no Cat list casts Ferocious Bite,
     * so the identical bare drain here had never had the chance to lose a
     * number. **A silent bug in an ability nothing casts is still the bug**,
     * and it would have surfaced as "the energy panel does not add up" on the
     * day a list reached for it.
     */
    if (!keepsExcess) {
      simulation.spendResource(caster, 'energy', remaining, {
        id: ability.id,
        name: ability.name,
      });
    }

    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      // The flat figure plus its energy bonus, which the coefficient adds to.
      baseAmount:
        FEROCIOUS_BITE_BY_COMBO_POINT[spent - 1] + remaining * FEROCIOUS_BITE_DAMAGE_PER_ENERGY,
      /*
       * 3% OF ATTACK POWER PER COMBO POINT SPENT, so a five-point bite carries
       * 15%. The tooltip's "Damage is increased by your Attack Power" finally
       * has its figure, and the `unmodelled` note that stood here has expired.
       */
      powerCoefficient: FEROCIOUS_BITE_AP_COEFFICIENT_PER_COMBO_POINT * spent,
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

export const RIP: Ability = {
  id: 'rip',
  name: 'Rip',
  cost: { resource: 'energy', amount: 30 },
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

    const roll = simulation.rollAttack(ability.attackTable, caster, target, { slot: MAIN_HAND });
    if (roll.avoided) return;
    simulation.applyAura(target, ripAura(spent), caster.id);
  },
  unmodelled:
    'Its "increased by your Attack Power" does not apply: the source states ' +
    'five flat totals and no coefficient.',
};

/**
 * A Druid's base mana, which a "% of base mana" cost is a share of.
 *
 * BASE MANA IS A CLASS CONSTANT, not a character one -- the same figure for
 * every race -- which is why the race passed here does not matter and the
 * Mage's own note says the same. `baseManaFor` is the shared lookup.
 */
export const DRUID_BASE_MANA = baseManaFor('tauren', 'druid');

/**
 * Shifting Power: "Instantly convert 55% of base Mana into 40 Energy."
 *
 * ----------------------------------------------------------------------------
 * THE TALENT THAT REPLACED TIGER'S FURY AND KING OF THE JUNGLE, at client build
 * 1.60.1.70170. Free instant damage buff and a 60-energy refund on it, out; a
 * mana-for-energy conversion on a sixteen second cooldown, in.
 *
 * EIGHT SECONDS, AND NO TALENT REDUCES IT ANY MORE. It was sixteen with
 * Improved Shifting Power taking 4/8 off; client build 1.60.1.70707 removed the
 * talent and gave the spell its 2/2 figure outright, which foreverchanges.pro's
 * spellbook states ("8 sec cooldown"). A Cat that took 2/2 casts it exactly as
 * often as before and has two points back.
 *
 * ITS COST IS A SHARE OF BASE MANA and not of the character's pool, which is the
 * distinction every "% of base mana" ability in this project turns on: a Cat
 * Druid in raid gear has far more mana than its base, so reading the pool would
 * make the ability cost more the better the gear is. 55% of 964 is 530.
 *
 * "SHIFTING POWER'S COST IS REDUCED BY EFFECTS THAT REDUCE THE COST OF
 * SHAPESHIFTING" IS CARRIED AS UNMODELLED. Natural Shapeshifter is the effect it
 * names and no feral preset takes it, so the clause is worth nothing today --
 * but it is a real clause and a real route, `CastModifier.costFraction`, so it
 * is recorded rather than silently dropped.
 *
 * IT IS NOT GATED ON THE ENERGY BAR HERE. `grantResource` reports what the cap
 * threw away, so a cast on a full bar shows its waste on the results page rather
 * than vanishing -- which is what lets the priority list's own mana condition be
 * the only gate, exactly as King of the Jungle's note said of Tiger's Fury.
 * ----------------------------------------------------------------------------
 */
export const SHIFTING_POWER_BASE_MANA_FRACTION = 0.55;
export const SHIFTING_POWER_ENERGY = 40;
export const SHIFTING_POWER_COOLDOWN_MS = seconds(8);
export const SHIFTING_POWER_MANA_COST = Math.round(
  DRUID_BASE_MANA * SHIFTING_POWER_BASE_MANA_FRACTION,
);

export const SHIFTING_POWER: Ability = {
  id: 'shifting_power',
  name: 'Shifting Power',
  cost: { resource: 'mana', amount: SHIFTING_POWER_MANA_COST },
  cooldownMs: SHIFTING_POWER_COOLDOWN_MS,
  requiresTarget: false,
  onCast: ({ simulation, caster, ability }) => {
    simulation.grantResource(caster, 'energy', SHIFTING_POWER_ENERGY, {
      id: ability.id,
      name: ability.name,
    });
  },
  unmodelled:
    "Its \"cost is reduced by effects that reduce the cost of Shapeshifting\" " +
    'does nothing: Natural Shapeshifter is the only such effect and no feral ' +
    'preset takes it. The route exists -- `CastModifier.costFraction` -- so ' +
    'this expires the day a build takes the talent.',
};

// ---------------------------------------------------------------------------
// Feral: Bear
// ---------------------------------------------------------------------------

/*
 * "Bite the target for 100% normal damage plus 77."
 *
 * FOREVER RENAMED THIS ABILITY. It was Mangle at build 1.60.1.69876 and is
 * **Primal Bite** at 1.60.1.70009 -- the damage, cost, cooldown and form
 * requirement are all unchanged, and the Feral talent that names it changed with
 * it ("Causes your Primal Bite ability to strike up to 3 targets").
 *
 * THE DISPLAY NAME FOLLOWS THE CLIENT AND THE ID DOES NOT. `mangle` is an
 * internal key that rotations, talents and tests all reference; renaming it
 * would be churn with no reader, while the NAME is what a person sees in the
 * damage breakdown and has to match what Forever calls it.
 */
export const MANGLE_BASE_DAMAGE = 77;

export const MANGLE: Ability = {
  id: 'mangle',
  name: 'Primal Bite',
  cost: { resource: 'rage', amount: 20 },
  cooldownMs: seconds(6),
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    // Single target since Berserk, which made it strike three, left the tree.
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: MANGLE_BASE_DAMAGE,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

export const MAUL: Ability = {
  id: 'maul',
  name: 'Maul',
  cost: { resource: 'rage', amount: 15 },
  attackTable: 'melee-special',
  onNextSwing: MAIN_HAND,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      baseAmount: MAUL_BONUS_DAMAGE,
      weaponScaling: { slot: MAIN_HAND },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
};

/** "Swipe 3 nearby enemies, inflicting 83 damage." */
export const SWIPE_DAMAGE = 83;
export const SWIPE_MAX_TARGETS = 3;

export const SWIPE: Ability = {
  id: 'swipe',
  name: 'Swipe',
  cost: { resource: 'rage', amount: 20 },
  attackTable: 'melee-special',
  targets: { maxTargets: SWIPE_MAX_TARGETS },
  onCast: ({ simulation, caster, ability }) => {
    for (const target of simulation.enemiesOf(caster).slice(0, SWIPE_MAX_TARGETS)) {
      dealDamage(simulation, {
        source: caster,
        target,
        abilityId: ability.id,
        abilityName: ability.name,
        school: PHYSICAL,
        // Flat, plus the patch notes' 3% of attack power -- see
        // `SWIPE_AP_COEFFICIENT`, which the sheet put at 10%.
        baseAmount: SWIPE_DAMAGE,
        powerCoefficient: SWIPE_AP_COEFFICIENT,
        attackTable: ability.attackTable,
        weaponSlot: MAIN_HAND,
      });
    }
  },
};

export const LACERATE_ABILITY: Ability = {
  id: 'lacerate',
  name: 'Lacerate',
  cost: { resource: 'rage', amount: 15 },
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target || !ability.attackTable) return;
    const roll = simulation.rollAttack(ability.attackTable, caster, target, { slot: MAIN_HAND });
    if (roll.avoided) return;
    simulation.applyAura(target, LACERATE, caster.id);
  },
};

/**
 * Faerie Fire, cast from Dire Bear Form -- the owner, round 51: "This can be
 * used from Dire Bear Form. Faerie Fire generate a base threat of 2 * character
 * level which is then further modified by % threat scalers."
 *
 * FREE, because "Faerie Fire costs no resources in those forms" -- the client's
 * own wording in the Omen of Clarity fix, which is why it cannot spend a
 * Clearcasting charge either (`requiresCost`). ON THE GLOBAL COOLDOWN, which is
 * the whole price of it for a Bear.
 *
 * IT DOES NOT ROLL TO HIT, which is the precedent for a non-DoT debuff here --
 * Thunder Clap's slow and Wrack's amplification apply without rolling on
 * purpose -- and is RECORDED AS A QUESTION for the owner: Classic's Faerie Fire
 * rolls spell hit, and a Bear carries none.
 *
 * IT DOES NOT SHORTEN THE RAID'S FAERIE FIRE. The preset raid debuffs already
 * put an hour of this aura on the target, and a `reset` refresh with a 40 second
 * definition would cut that to 40 seconds and let the armor lapse -- so the
 * aura is applied only when what is on the target has less than 40 seconds left,
 * and the threat is generated either way. In every preset fight that makes the
 * cast PURE THREAT, which is what the owner asked for it for.
 */
export const FAERIE_FIRE_ABILITY: Ability = {
  id: 'faerie_fire',
  name: 'Faerie Fire',
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    if (target.auras.remainingMs(FAERIE_FIRE.id, simulation.clock.now()) < FAERIE_FIRE.durationMs) {
      simulation.applyAura(target, FAERIE_FIRE, caster.id);
    }
    simulation.generateThreat(
      caster,
      target,
      FAERIE_FIRE_THREAT_PER_LEVEL * caster.level,
      'faerie_fire',
      'Faerie Fire',
    );
  },
};

export const DEMORALIZING_ROAR_ABILITY: Ability = {
  id: 'demoralizing_roar',
  name: 'Demoralizing Roar',
  cost: { resource: 'rage', amount: 10 },
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, DEMORALIZING_ROAR, caster.id);
    simulation.generateThreat(
      caster,
      target,
      DEMORALIZING_ROAR_FLAT_THREAT,
      'demoralizing_roar',
      'Demoralizing Roar',
    );
  },
  unmodelled:
    'The -204 attack power lands, but the target has no attack power term: ' +
    'its swing damage is stated outright, not derived. The same gap the ' +
    'Warrior Demoralizing Shout carries.',
};


// ---------------------------------------------------------------------------
// Feral: the Bear's three cooldowns
// ---------------------------------------------------------------------------

/**
 * Barkskin. Free, instant, one minute, and worth nothing to a Druid nothing
 * attacks -- see `BARKSKIN` for why that is not the same as inert.
 */
export const BARKSKIN_ABILITY: Ability = {
  id: 'barkskin',
  name: 'Barkskin',
  cooldownMs: BARKSKIN_COOLDOWN_MS,
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, BARKSKIN, caster.id);
  },
  unmodelled:
    'Its "damaging attacks will not cause spellcasting delays" does nothing: ' +
    'spell pushback is not modelled, so there is no delay to prevent.',
};

/**
 * Enrage. The INSTANT ten rage is here and the twenty over ten seconds is the
 * aura's, which is the same split Bloodrage has for the same reason: a grant
 * that happens once is not periodic.
 */
export const ENRAGE_ABILITY: Ability = {
  id: 'enrage',
  name: 'Enrage',
  cooldownMs: ENRAGE_COOLDOWN_MS,
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.grantResource(caster, 'rage', ENRAGE_INSTANT_RAGE, {
      id: 'enrage',
      name: 'Enrage',
    });
    simulation.applyAura(caster, ENRAGE, caster.id);
  },
  unmodelled:
    'Its "considered in combat for the duration" does nothing: every fight ' +
    'here opens in combat and never leaves it.',
};

/**
 * Frenzied Regeneration. In scope by the ruleset owner's ruling, and the
 * reason it is not the healing-throughput case is on `FRENZIED_REGENERATION`:
 * it is a rage sink as much as a heal.
 */
export const FRENZIED_REGENERATION_ABILITY: Ability = {
  id: 'frenzied_regeneration',
  name: 'Frenzied Regeneration',
  cooldownMs: FRENZIED_REGENERATION_COOLDOWN_MS,
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, FRENZIED_REGENERATION, caster.id);
  },
};

/**
 * Nature's Swiftness: the next Nature spell is instant.
 *
 * Free, instant, three minute cooldown. Everything about the aura -- which
 * spells it names, why it spends `all` rather than a stack, and why an instant
 * must not eat the charge -- is on `NATURES_SWIFTNESS`.
 *
 * TALENT-GRANTED like Shifting Power, and for the same reason: it is in the
 * captured spellbook with a "Learned at level 30" line, and so are Insect
 * Swarm, Swiftmend, Feral Charge and Moonkin Form, every one of which is a
 * talent. `talentsforever.com` lists a talent-granted spell in the spellbook
 * with a level attached, so that line is not evidence of a trainer spell.
 */
export const NATURES_SWIFTNESS_ABILITY: Ability = {
  id: 'natures_swiftness',
  name: "Nature's Swiftness",
  cooldownMs: NATURES_SWIFTNESS_COOLDOWN_MS,
  /*
   * OFF THE GLOBAL COOLDOWN (round 71), as the Shaman's talent of the same name
   * is: on it, the instant Healing Touch it buys waits out a global cooldown
   * the button itself started. No profile took it before the Resto Drood.
   */
  triggersGcd: false,
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, NATURES_SWIFTNESS, caster.id);
  },
};

/* -------------------------------------------------------------------------- */
/* Restoration (round 71): the Resto Drood profile's spells                   */
/* -------------------------------------------------------------------------- */

const isFriendly = (caster: Combatant, target: Combatant | undefined): target is Combatant =>
  target !== undefined && !target.isHostileTo(caster);

/** A Druid's direct heal. Threatens, as every heal here does. */
function druidHeal(
  simulation: SimulationContext,
  caster: Combatant,
  target: Combatant,
  ability: Ability,
  amount: number,
  coefficient: number,
): void {
  applyHealing(simulation, {
    source: caster,
    target,
    abilityId: ability.id,
    abilityName: ability.name,
    baseAmount: amount,
    powerCoefficient: coefficient,
    threatens: true,
  });
}

/** Healing Touch, rank 11: "Heals a friendly target for 2,139 to 2,525." 840 mana, 3.5s. */
export const HEALING_TOUCH_HEAL = midpoint(2139, 2525);

export const HEALING_TOUCH: Ability = {
  id: 'healing_touch',
  name: 'Healing Touch',
  heals: true,
  cost: { resource: 'mana', amount: 840 },
  castTimeMs: seconds(3.5),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    druidHeal(simulation, caster, target, ability, HEALING_TOUCH_HEAL, HEALING_TOUCH_HEAL_COEFFICIENT);
  },
};

/** Rejuvenation, rank 11: 360 mana, instant. The heal is `REJUVENATION_HOT`. */
export const REJUVENATION: Ability = {
  id: 'rejuvenation',
  name: 'Rejuvenation',
  heals: true,
  cost: { resource: 'mana', amount: 360 },
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    const extra = ability.bonuses?.[AURA_DURATION_BONUS] ?? 0;
    simulation.applyAura(target, lengthened(REJUVENATION_HOT, extra), caster.id);
  },
};

/**
 * Regrowth, rank 9: "Heals a friendly target for 965 to 1,077 and another 994
 * over 21 sec." 525 mana, 2s. 28.6% of healing power on the hit; the heal over
 * time is `REGROWTH_HOT`.
 */
export const REGROWTH_HEAL = midpoint(965, 1077);

export const REGROWTH: Ability = {
  id: 'regrowth',
  name: 'Regrowth',
  heals: true,
  cost: { resource: 'mana', amount: 525 },
  castTimeMs: seconds(2),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    druidHeal(simulation, caster, target, ability, REGROWTH_HEAL, REGROWTH_HEAL_COEFFICIENT);
    const extra = ability.bonuses?.[AURA_DURATION_BONUS] ?? 0;
    simulation.applyAura(target, lengthened(REGROWTH_HOT, extra), caster.id);
  },
};

/**
 * Wild Growth, rank 3, granted by the Restoration capstone: 1,050 mana, a
 * THREE SECOND CAST, a 6 second cooldown. It was instant on our older capture;
 * foreverchanges.pro gives every rank "3 sec cast" at client build
 * 1.60.1.70707, the owner confirmed it, and Naturalist takes half a second off
 * it -- its tooltip names Wild Growth beside Healing Touch at the same build. "Heals the target AND THEIR PARTY" -- everyone
 * alive in the target's party, the target included; a target with no party
 * (the tank healer fight's lone tank) is healed alone. The falloff is
 * `WILD_GROWTH_HOT`.
 */
export const WILD_GROWTH: Ability = {
  id: 'wild_growth',
  name: 'Wild Growth',
  heals: true,
  cost: { resource: 'mana', amount: 1050 },
  castTimeMs: seconds(3),
  cooldownMs: seconds(6),
  onCast: ({ simulation, caster, target }) => {
    if (!isFriendly(caster, target)) return;
    const party =
      target.party === undefined
        ? [target]
        : simulation.combatants.filter(
            (member) => member.party === target.party && member.isAlive && !member.isHostileTo(caster),
          );
    for (const member of party) simulation.applyAura(member, WILD_GROWTH_HOT, caster.id);
  },
};

/**
 * Swiftmend, granted by the talent: "Instantly heals a target with an active
 * Rejuvenation or Regrowth effect for an amount equal to the full duration of
 * the periodic effect of one of those spells." 20% of base mana, instant, a 15
 * second cooldown.
 *
 * ============================================================================
 * TWO READINGS, BOTH OURS AND BOTH FLAGGED IN HANDOVER:
 *
 *   IT DOES NOT CONSUME. Classic's says "Consumes a Rejuvenation or Regrowth
 *   effect"; Forever's tooltip dropped the word, so the heal over time stays.
 *
 *   "ONE OF THOSE SPELLS" IS A COIN FLIP when both of yours are up (round 72,
 *   the owner's "a 50/50 for which effect it uses"), and whichever one it is
 *   when only one is -- no roll is drawn then. It was Rejuvenation first in
 *   round 71.
 *
 * "THE FULL DURATION" is every tick of the effect as it was applied, Nature's
 * Splendor's included, at the effect's own size: its base and coefficient
 * times its tick count, then the HoT's own healing modifiers (Gift of Nature,
 * Improved Rejuvenation) and Genesis, since it heals "an amount equal to" that
 * effect. Swiftmend itself carries none of those, so nothing counts twice.
 * ============================================================================
 */
export const SWIFTMEND: Ability = {
  id: 'swiftmend',
  name: 'Swiftmend',
  heals: true,
  cost: { resource: 'mana', amount: Math.round(DRUID_BASE_MANA * 0.2) },
  cooldownMs: seconds(15),
  canCast: ({ caster, target }) =>
    target !== undefined &&
    (target.auras.get(REJUVENATION_HOT.id)?.sourceId === caster.id ||
      target.auras.get(REGROWTH_HOT.id)?.sourceId === caster.id),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    const rejuvenation = target.auras.get(REJUVENATION_HOT.id);
    const regrowth = target.auras.get(REGROWTH_HOT.id);
    const hasRejuvenation = rejuvenation?.sourceId === caster.id;
    const hasRegrowth = regrowth?.sourceId === caster.id;
    const useRejuvenation =
      hasRejuvenation && hasRegrowth ? simulation.rng.rollChance(0.5) : hasRejuvenation;
    const hot = useRejuvenation ? rejuvenation : regrowth;
    if (!hot) return;
    const interval = useRejuvenation ? REJUVENATION_TICK_INTERVAL_MS : REGROWTH_TICK_INTERVAL_MS;
    const ticks = Math.round(hot.definition.durationMs / interval);
    const perTick = useRejuvenation ? REJUVENATION_TICK : REGROWTH_TICK;
    const perTickCoefficient = useRejuvenation ? REJUVENATION_TICK_HEAL_COEFFICIENT : REGROWTH_TICK_HEAL_COEFFICIENT;
    const hotModifier = caster.abilityModifierFor(hot.definition.id);
    const scale = (hotModifier?.healingMultiplier ?? 1) * caster.periodicHealingMultiplier;
    druidHeal(simulation, caster, target, ability, perTick * ticks * scale, perTickCoefficient * ticks * scale);
  },
};

/**
 * Innervate: 5% of base mana, instant, six minutes. On the Druid itself; the
 * window is `INNERVATE_AURA`.
 */
export const INNERVATE: Ability = {
  id: 'innervate',
  name: 'Innervate',
  cost: { resource: 'mana', amount: Math.round(DRUID_BASE_MANA * 0.05) },
  cooldownMs: seconds(360),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    // "Read Leyline ... will be replaced by Innervate as a more powerful effect" (round 79).
    caster.auras.remove(simulation, 'read_ley_line');
    simulation.applyAura(caster, INNERVATE_AURA, caster.id);
  },
};

/**
 * Every Druid ability, including the ones only a talent grants.
 *
 * ----------------------------------------------------------------------------
 * THE LIST IS A CATALOGUE, NOT A SPELLBOOK. `abilitiesForClass` builds the
 * book, and a talent-granted ability reaches it only through
 * `TalentBuild.grantedAbilities` -- so what is in here and what a character
 * can cast are different questions.
 *
 * BERSERK AND NATURE'S SWIFTNESS ARE TALENTS, and Berserk was not treated as
 * one. It sat in the base list, so every Druid carried it: the Moonkin's own
 * audit line read "in book, never cast: ... berserk ...", which is exactly what
 * an ability nobody should have looks like. Insect Swarm was already granted
 * properly and is the model.
 *
 * WHAT MISLED IT is worth recording, because it will mislead the next class:
 * `forever-druid-spellbook.json` carries Berserk with "Learned at level 40",
 * and it carries Insect Swarm, Swiftmend, Feral Charge, Moonkin Form and
 * Nature's Swiftness the same way. All five are talents. The capture's level
 * line says where the client would show the spell, not how it is obtained.
 * ----------------------------------------------------------------------------
 */
/**
 * Hurricane, rank 3: "Creates a violent storm in the target area causing 132
 * Nature damage to enemies every 1 sec, and increasing the time between attacks
 * by 20%. Lasts 10 sec." 1,495 mana, channelled (round 57).
 *
 * TEN TICKS, EACH STRIKING EVERY TARGET with its own spell roll, at 3% of spell
 * power a tick -- the owner's figure. The 20% attack slow is OUT OF SCOPE for a
 * multi-target damage simulation, by the owner's ruling.
 */
export const HURRICANE_TICK_DAMAGE = 132;
export const HURRICANE_TICKS = 10;

export const HURRICANE: Ability = {
  id: 'hurricane',
  name: 'Hurricane',
  cost: { resource: 'mana', amount: 1495 },
  castTimeMs: seconds(10),
  channelTicks: HURRICANE_TICKS,
  interruptibleChannel: true,
  attackTable: 'spell',
  targets: { maxTargets: Infinity },
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    for (const struck of areaTargets(simulation, caster, target, ability)) {
      dealDamage(simulation, {
        source: caster,
        target: struck,
        abilityId: ability.id,
        abilityName: ability.name,
        school: 'nature',
        baseAmount: HURRICANE_TICK_DAMAGE,
        powerCoefficient: HURRICANE_TICK_SP_COEFFICIENT,
        attackTable: ability.attackTable,
      });
    }
  },
  unmodelled:
    'Its 20% attack slow is out of scope for a multi-target damage simulation, ' +
    'by the owner’s ruling.',
};

export const DRUID_ABILITIES: readonly Ability[] = [
  HURRICANE,
  WRATH,
  STARFIRE,
  MOONFIRE,
  INSECT_SWARM_ABILITY,
  SHRED,
  CLAW,
  RAKE,
  // The Cat's opener. Style-gated the way Shred is -- by the LIST and the
  // combat style rather than by a declaration, which is the existing shape for
  // every "Requires Cat Form" ability in this catalogue.
  PROWL_ABILITY,
  RAVAGE,
  FEROCIOUS_BITE,
  RIP,
  MANGLE,
  MAUL,
  SWIPE,
  LACERATE_ABILITY,
  DEMORALIZING_ROAR_ABILITY,
  FAERIE_FIRE_ABILITY,
  BARKSKIN_ABILITY,
  ENRAGE_ABILITY,
  FRENZIED_REGENERATION_ABILITY,
  // The Restoration trainer spells (round 71).
  HEALING_TOUCH,
  REJUVENATION,
  REGROWTH,
  INNERVATE,
  // Talent-granted: in the catalogue so the book can find them, and in no
  // character's book without the point spent.
  NATURES_SWIFTNESS_ABILITY,
  SHIFTING_POWER,
  SWIFTMEND,
  WILD_GROWTH,
];
