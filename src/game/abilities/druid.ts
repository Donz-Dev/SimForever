import type { Ability } from '../../engine';
import { dealDamage, seconds } from '../../engine';
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
  BERSERK_COOLDOWN_MS,
  ENRAGE,
  ENRAGE_COOLDOWN_MS,
  ENRAGE_INSTANT_RAGE,
  FRENZIED_REGENERATION,
  FRENZIED_REGENERATION_COOLDOWN_MS,
  TIGERS_FURY,
  NATURES_SWIFTNESS,
  NATURES_SWIFTNESS_COOLDOWN_MS,
  berserkAura,
  lengthened,
  ripAura,
} from '../auras/druid';
import { awardComboPoint, hasComboPoints, spendComboPoints } from '../combat/comboPoints';
import {
  FEROCIOUS_BITE_AP_COEFFICIENT_PER_COMBO_POINT,
  RAKE_AP_COEFFICIENT,
  STARFIRE_SP_COEFFICIENT,
  SWIPE_AP_COEFFICIENT,
  WRATH_SP_COEFFICIENT,
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
 * RESISTANCE IS RULED TO HAVE NO EFFECT. The ruleset owner: assume resistances
 * on enemy targets have no impact on damage for now. So a spell lands for full
 * against a raid boss, and `resistancesFromItems` staying unread is CORRECT
 * rather than a gap -- which is a change from how the engine survey recorded
 * it, and the reason these figures are not "optimistic".
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
  unmodelled:
    'Its "must be behind the target" is dropped: nothing here has a facing, ' +
    'so the requirement cannot be checked and is not pretended to be met.',
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
     * Everything still in the bar, converted at 2.7 a point -- and spent
     * through `spendResource` rather than drained, for the reason written out
     * at length on `EXECUTE`.
     *
     * THIS ONE WAS LATENT AND THE WARRIOR'S WAS LIVE, which is the only
     * difference between them. Execute is in both damage Warriors' lists and
     * was under-reporting its cost by 1.72x; no Cat list casts Ferocious Bite,
     * so the identical bare drain here had never had the chance to lose a
     * number. **A silent bug in an ability nothing casts is still the bug**,
     * and it would have surfaced as "the energy panel does not add up" on the
     * day a list reached for it.
     */
    const remaining = caster.resources.get('energy')?.current ?? 0;
    simulation.spendResource(caster, 'energy', remaining, {
      id: ability.id,
      name: ability.name,
    });

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

export const TIGERS_FURY_ABILITY: Ability = {
  id: 'tigers_fury',
  name: "Tiger's Fury",
  cooldownMs: seconds(30),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, TIGERS_FURY, caster.id);
  },
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
        // Flat, plus the sheet's 10% of attack power.
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

export const DEMORALIZING_ROAR_ABILITY: Ability = {
  id: 'demoralizing_roar',
  name: 'Demoralizing Roar',
  cost: { resource: 'rage', amount: 10 },
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, DEMORALIZING_ROAR, caster.id);
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
 * Berserk, learned at 40 and usable in Cat, Bear and Dire Bear form.
 *
 * Free, instant, three minute cooldown. Every clause of it, what each one
 * reaches and what "+100%" was ruled to mean are on `berserkAura`.
 *
 * THE GENERATORS ARE READ OFF THIS FILE'S OWN ABILITIES rather than named, so
 * an ability that starts awarding a combo point is covered by Berserk on the
 * same day. The list is computed once at module load, not per cast.
 */
export const COMBO_POINT_GENERATORS: readonly string[] = [SHRED, CLAW, RAKE]
  .filter((ability) => (ability.comboPointsAwarded ?? 0) > 0)
  .map((ability) => ability.id);

export const BERSERK: Ability = {
  id: 'berserk',
  name: 'Berserk',
  cooldownMs: BERSERK_COOLDOWN_MS,
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, berserkAura(COMBO_POINT_GENERATORS), caster.id);
  },
  unmodelled:
    'Its "strike up to 3 targets" does nothing -- every encounter here has ' +
    'one -- and its Fear immunity is crowd control, which is out of scope.',
};

/**
 * Nature's Swiftness: the next Nature spell is instant.
 *
 * Free, instant, three minute cooldown. Everything about the aura -- which
 * spells it names, why it spends `all` rather than a stack, and why an instant
 * must not eat the charge -- is on `NATURES_SWIFTNESS`.
 *
 * TALENT-GRANTED like Berserk below, and for the same reason: it is in the
 * captured spellbook with a "Learned at level 30" line, and so are Insect
 * Swarm, Swiftmend, Feral Charge and Moonkin Form, every one of which is a
 * talent. `talentsforever.com` lists a talent-granted spell in the spellbook
 * with a level attached, so that line is not evidence of a trainer spell.
 */
export const NATURES_SWIFTNESS_ABILITY: Ability = {
  id: 'natures_swiftness',
  name: "Nature's Swiftness",
  cooldownMs: NATURES_SWIFTNESS_COOLDOWN_MS,
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, NATURES_SWIFTNESS, caster.id);
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
export const DRUID_ABILITIES: readonly Ability[] = [
  WRATH,
  STARFIRE,
  MOONFIRE,
  INSECT_SWARM_ABILITY,
  SHRED,
  CLAW,
  RAKE,
  FEROCIOUS_BITE,
  RIP,
  TIGERS_FURY_ABILITY,
  MANGLE,
  MAUL,
  SWIPE,
  LACERATE_ABILITY,
  DEMORALIZING_ROAR_ABILITY,
  BARKSKIN_ABILITY,
  ENRAGE_ABILITY,
  FRENZIED_REGENERATION_ABILITY,
  // Talent-granted: in the catalogue so the book can find them, and in no
  // character's book without the point spent.
  BERSERK,
  NATURES_SWIFTNESS_ABILITY,
];
