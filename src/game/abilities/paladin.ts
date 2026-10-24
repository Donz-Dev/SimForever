import type { Ability, AuraDefinition, Combatant, SimulationContext } from '../../engine';
import { applyHealing, dealDamage, seconds, spellPowerAgainst } from '../../engine';
import { areaTargets } from '../combat/multiTarget';
import { baseManaFor } from '../character/baseStatLookup';
import { inExecutePhase } from '../combat/executePhase';
import {
  CONSECRATED_GROUND_FLAG,
  DIVINE_FAVOR,
  ILLUMINATION_CHANCE_KEY,
  ILLUMINATION_REFUND_KEY,
  IMPROVED_RIGHTEOUS_FURY_FLAG,
  INFUSION_OF_LIGHT_KEY,
  infusionOfLight,
  HOLY_SHIELD,
  JUDGEMENT_OF_THE_CRUSADER,
  RIGHTEOUS_FURY_THREAT_PERCENT,
  SEAL_AURA_IDS,
  SEAL_OF_COMMAND,
  SEAL_OF_FURY,
  SEAL_OF_RIGHTEOUSNESS,
  SEAL_OF_THE_CRUSADER,
  TEMPLARS_BULWARK,
  TEMPLARS_BULWARK_COOLDOWN_MS,
  TEMPLARS_BULWARK_FORBEARANCE_MS,
  activeSeal,
  consecrationGround,
  echoAura,
  righteousFury,
} from '../auras/paladin';
import {
  HAMMER_OF_WRATH_SP_COEFFICIENT,
  HOLY_SHOCK_SP_COEFFICIENT,
  HOLY_STRIKE_SP_COEFFICIENT,
  JUDGEMENT_OF_COMMAND_SP_COEFFICIENT,
  JUDGEMENT_OF_FURY_SP_COEFFICIENT,
  JUDGEMENT_OF_RIGHTEOUSNESS_SP_COEFFICIENT,
  PLACEHOLDER_FLASH_OF_LIGHT_HEAL_COEFFICIENT,
  PLACEHOLDER_HOLY_LIGHT_HEAL_COEFFICIENT,
  PLACEHOLDER_HOLY_SHOCK_HEAL_COEFFICIENT,
} from '../combat/coefficients';

/**
 * Paladin abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * THE FIRST CLASS WITH A SPELL POWER COEFFICIENT. The ruleset owner supplied
 * the seal formula directly:
 *
 *     damage = base + baseWeaponSpeed x (0.022 x attackPower + 0.044 x spellPower)
 *
 * Every caster before this -- Druid, Shaman, Mage -- states flat damage and no
 * coefficient, and each says so on its results page. A Paladin's seal is the
 * one place in the project where gear reaches a Holy number, which is worth
 * knowing before comparing a Paladin figure with a Moonkin one.
 *
 * A SEAL IS EXCLUSIVE, like a stance: casting one removes the rest. Judgement
 * spends its effect WITHOUT consuming it, which the spellbook states outright
 * and which is a Forever change from Classic.
 *
 * SEAL DAMAGE IS NOT A WEAPON USE, on the owner's ruling. Every seal hit below
 * is dealt with NO `weaponSlot`, so `isWeaponUse` refuses it and Windfury,
 * Crusader and Hand of Justice see only the swing that carried it.
 *
 * NOT HERE, AND EACH FOR A STATED REASON:
 *
 *   EXORCISM       "to an Undead or Demon target", and the training dummy is
 *   HOLY WRATH     neither. Two spells that do literally nothing here.
 *   EVERY HEAL     Holy Light, Flash of Light, Light's Vigil. No profile heals.
 *   BLESSINGS      Raid buffs, selected in the buff panel rather than cast.
 *   AURAS          Devotion, Retribution, Concentration and the resistances.
 *                  Retribution Aura is real damage for a Paladin that is struck
 *                  and the owner has left it undeclared on purpose; the rest do
 *                  nothing that is modelled.
 *   CLEANSE        Dispels, and nothing here applies anything dispellable.
 *   PURIFY
 *
 * HAMMER OF WRATH WAS ON THAT LIST WITH THE REASON "the target never drops below
 * full", and it is declared below -- its health gate is the CLOCK, by the same
 * ruling Execute runs on. The entry outlived the truth of it, which is the fourth
 * time a stale caveat has been found in this project by re-reading one.
 * ----------------------------------------------------------------------------
 */

const MAIN_HAND = 'mainHand' as const;
const HOLY = 'holy' as const;
const PHYSICAL = 'physical' as const;

/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

/** A Paladin's base mana, which a "% of base mana" cost is a share of. */
export const PALADIN_BASE_MANA = baseManaFor('human', 'paladin');

/** Costs stated as a share of base mana, resolved once. */
const shareOfBase = (fraction: number) => Math.round(PALADIN_BASE_MANA * fraction);

/**
 * Cast a seal, removing whichever one is already up.
 *
 * "Only one Seal can be active on the Paladin at any one time." Handled here
 * rather than by each seal, so a new seal cannot forget the rule -- the same
 * reason the global cooldown is derived rather than declared per ability.
 *
 * TWIST OF LIGHT READS THE REPLACEMENT. The talent pays out when a seal is
 * REPLACED, which is exactly this moment and nowhere else, so the echo is
 * granted here and gated on the character actually having the talent.
 */
export const TWIST_OF_LIGHT_FLAG = 'twistOfLight';

function castSeal(
  simulation: SimulationContext,
  caster: Combatant,
  seal: AuraDefinition,
  hasTwistOfLight: boolean,
): void {
  const replaced = activeSeal(caster);

  for (const id of SEAL_AURA_IDS) {
    if (id !== seal.id) caster.auras.remove(simulation, id);
  }

  /*
   * An Echo only for a REPLACEMENT, and only by a different seal. Re-casting
   * the same seal refreshes it and replaces nothing, which is what the
   * tooltip's "with a different Seal" says.
   */
  if (hasTwistOfLight && replaced !== undefined && replaced !== seal.id) {
    simulation.applyAura(caster, echoAura(replaced), caster.id);
  }

  simulation.applyAura(caster, seal, caster.id);
}

// ---------------------------------------------------------------------------
// Seals
// ---------------------------------------------------------------------------

const sealAbility = (
  id: string,
  name: string,
  cost: number,
  aura: AuraDefinition,
  unmodelled?: string,
): Ability => ({
  id,
  name,
  cost: { resource: 'mana', amount: cost },
  requiresTarget: false,
  onCast: ({ simulation, caster, ability }) => {
    /*
     * THE TALENT ARRIVES ON THE ABILITY, not on the character. Twist of Light
     * sets an `abilityFlag` on every seal, and `applyTalentChanges` hands each
     * character its own COPY of the ability -- so reading it here is
     * per-character by construction. A module-level set keyed on the character
     * would leak the talent across a Monte Carlo batch, which is the exact bug
     * that copy exists to prevent.
     */
    castSeal(simulation, caster, aura, (ability.bonuses?.[TWIST_OF_LIGHT_FLAG] ?? 0) > 0);
  },
  ...(unmodelled ? { unmodelled } : {}),
});

export const SEAL_OF_RIGHTEOUSNESS_ABILITY = sealAbility(
  'seal_of_righteousness',
  'Seal of Righteousness',
  200,
  SEAL_OF_RIGHTEOUSNESS,
);

export const SEAL_OF_COMMAND_ABILITY = sealAbility(
  'seal_of_command',
  'Seal of Command',
  210,
  SEAL_OF_COMMAND,
);

export const SEAL_OF_THE_CRUSADER_ABILITY = sealAbility(
  'seal_of_the_crusader',
  'Seal of the Crusader',
  160,
  SEAL_OF_THE_CRUSADER,
);

export const SEAL_OF_FURY_ABILITY = sealAbility(
  'seal_of_fury',
  'Seal of Fury',
  200,
  SEAL_OF_FURY,
);

// ---------------------------------------------------------------------------
// Judgement
// ---------------------------------------------------------------------------

/**
 * Judgement: "Unleash the energy of a Seal spell upon an enemy. DOES NOT
 * CONSUME THE SEAL."
 *
 * ----------------------------------------------------------------------------
 * ONE ABILITY WITH FOUR EFFECTS, chosen by whichever seal is up. That is the
 * spellbook's own structure -- "Refer to individual Seals for Judgement
 * effect" -- so the dispatch lives here and each seal's number lives beside
 * the seal.
 *
 * AND IT DOES NOT CONSUME THE SEAL, which is a Forever change and removes the
 * whole reason a Classic paladin re-casts a seal after every judgement. It is
 * stated in the spellbook in capitals for that reason.
 *
 * WITH NO SEAL UP IT DOES NOTHING, rather than dealing some default damage.
 * `canCast` refuses, so a priority list skips it instead of wasting the
 * cooldown.
 * ----------------------------------------------------------------------------
 */
/*
 * TWO JUDGEMENTS AND HOLY STRIKE MOVED, and Holy Strike moved for two reasons
 * at once -- read `docs/source-cross-checks.md` before changing any of these.
 *
 * Judgement of Righteousness is 162 to 178 and Judgement of Fury 146 to 160 on
 * foreverchanges.pro, against our capture's 170-186 and 153-167 at the same
 * build. Judgement of Command agrees on both sides.
 */
export const JUDGEMENT_OF_RIGHTEOUSNESS = midpoint(162, 178);
export const JUDGEMENT_OF_COMMAND = midpoint(169, 187);
export const JUDGEMENT_OF_FURY = midpoint(146, 160);

/*
 * ----------------------------------------------------------------------------
 * ONE ABILITY, THREE COEFFICIENTS, because Judgement "unleashes the energy of a
 * Seal spell" and the seal decides what lands.
 *
 * The sheet gives Judgement of Command, of Fury and of Righteousness their own
 * rows -- 0.43, 0.45 and 0.5 -- where this simulator has a single `judgement`
 * that reads the active seal. It already chose its BASE DAMAGE that way; it now
 * chooses its coefficient by the same lookup, so the two cannot drift apart.
 *
 * The Crusader's judgement is absent from the sheet and from this table because
 * it deals no damage at all: it applies a debuff.
 * ----------------------------------------------------------------------------
 */
export const JUDGEMENT_COEFFICIENT_BY_SEAL: Readonly<Record<string, number>> = {
  seal_of_command: JUDGEMENT_OF_COMMAND_SP_COEFFICIENT,
  seal_of_fury: JUDGEMENT_OF_FURY_SP_COEFFICIENT,
  seal_of_righteousness: JUDGEMENT_OF_RIGHTEOUSNESS_SP_COEFFICIENT,
};

export const JUDGEMENT: Ability = {
  id: 'judgement',
  name: 'Judgement',
  cost: { resource: 'mana', amount: shareOfBase(0.06) },
  cooldownMs: seconds(10),
  /*
   * THE MELEE TABLE, by the Judgement balance pass: "42.9% Spell Power
   * Coefficient. 2x Crit Multiplier. Melee Combat Table." It was `spell`, so it
   * missed on the 17% spell miss, crit at spell crit for 1.5x, and procced
   * Revelation as a spell. `melee-special` -- a special, so no glancing blow --
   * gives it the melee miss, dodge and crit and the table's 2x multiplier.
   * The Crusader judgement deals no damage and rolls nothing either way.
   */
  attackTable: 'melee-special',
  canCast: ({ caster }) => activeSeal(caster) !== undefined,
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    const seal = activeSeal(caster);
    if (!seal) return;

    if (seal === 'seal_of_the_crusader') {
      // The only judgement that deals no damage: it applies a debuff instead.
      simulation.applyAura(target, JUDGEMENT_OF_THE_CRUSADER, caster.id);
      return;
    }

    const amount =
      seal === 'seal_of_command'
        ? JUDGEMENT_OF_COMMAND
        : seal === 'seal_of_fury'
          ? JUDGEMENT_OF_FURY
          : JUDGEMENT_OF_RIGHTEOUSNESS;

    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: HOLY,
      // The flat judgement damage, which the coefficient is added TO.
      baseAmount: amount,
      // ...and the coefficient of the SAME seal, from the same lookup.
      powerCoefficient:
        JUDGEMENT_COEFFICIENT_BY_SEAL[seal] ?? JUDGEMENT_OF_RIGHTEOUSNESS_SP_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
  /*
   * NO `unmodelled` ANY MORE. It used to read "Its Crusader judgement is tracked
   * and adds no damage", which was true and is the thing this change fixed: the
   * debuff grants 161 Holy spell power to whoever hits the target, and every
   * Paladin list opens by putting it up. See `JUDGEMENT_OF_THE_CRUSADER`.
   */
};

/**
 * Swift Judgement, granted by the Protection talent.
 *
 * "Finishes the remaining cooldown on your Judgement ability and reduces the
 * Mana cost of your next Judgement by 100%." Only the cooldown reset is
 * modelled: a one-shot cost reduction is a `CastModifier`, which exists, but
 * Judgement's cost is 6% of base mana and the reset is the whole point.
 */
export const SWIFT_JUDGEMENT: Ability = {
  id: 'swift_judgement',
  name: 'Swift Judgement',
  cooldownMs: seconds(60),
  requiresTarget: false,
  /*
   * ==========================================================================
   * OFF THE GLOBAL COOLDOWN, BY THE OWNER'S RULING, and it was on one.
   *
   * WHAT IT WAS WORTH WHILE IT TOOK ONE: a global cooldown spent dealing
   * nothing, in exchange for a Judgement arriving a global cooldown sooner --
   * which is close enough to nothing that a DPS figure could not say. That is
   * why this is a RULING rather than a measurement: an ability wrongly taking
   * a global cooldown still has the right cooldown, the right cost and the
   * right effect, so the mistake is invisible everywhere except the figure.
   *
   * BEING OFF IT MEANS ONE THING -- the ability does not START a global
   * cooldown -- and it is still BLOCKED by one already running. What it buys
   * is that the Judgement it resets can go out in the SAME decision window
   * rather than 1.5 seconds later, which is what "Judgement, Swift Judgement,
   * Judgement" was always meant to be.
   *
   * IT STILL COSTS ONE `ROTATION_POLL_MS`, because a free off-GCD cast leaves
   * the actor idle and `nextDecisionTime` returns `now + 100ms`. That is the
   * same price the racials, the consumables and Bloodrage already pay.
   * ==========================================================================
   */
  triggersGcd: false,
  // Only worth casting at all when there is something to reset.
  canCast: ({ simulation, caster }) =>
    !caster.abilities.isReady('judgement', simulation.clock.now()),
  onCast: ({ caster }) => {
    caster.abilities.resetCooldown('judgement');
  },
  unmodelled:
    'Its free-next-Judgement clause is not modelled; the cooldown reset is, ' +
    'and that is what the ability is for.',
};

// ---------------------------------------------------------------------------
// Strikes
// ---------------------------------------------------------------------------

/**
 * Holy Strike: "An instant strike that causes 40% weapon damage plus an
 * additional 32 to 42 as Holy damage."
 *
 * A WEAPON USE, and therefore able to trigger Windfury, Crusader and Hand of
 * Justice -- it goes through a melee table and needs the weapon, which is the
 * ruleset owner's own rule. That is the opposite of the seal damage it can
 * carry, and the two sit one line apart on purpose.
 *
 * ONE DAMAGE EVENT, not two. The Holy half is stated as part of the same
 * strike, so it is added to the weapon-scaled amount rather than rolled
 * separately -- a second roll would give it its own chance to miss.
 */
/*
 * HOLY STRIKE CHANGED IN THE CLIENT AND THE TWO SOURCES THEN DISAGREED.
 *
 * Our own capture moved between builds 69876 and 70009 -- 40% weapon damage on
 * a 12-second cooldown became 50% on a 10-second one -- so the fraction and the
 * cooldown here were STALE rather than wrong, and both sources now agree on
 * them. They disagree on the Holy damage: 40 to 53 in our capture, 81 to 105 on
 * foreverchanges.pro, which the standing rule prefers. That is a doubling, and
 * it is the largest single correction of the five-class cross-check.
 */
export const HOLY_STRIKE_WEAPON_FRACTION = 0.5;
export const HOLY_STRIKE_HOLY_DAMAGE = midpoint(81, 105);

export const HOLY_STRIKE: Ability = {
  id: 'holy_strike',
  name: 'Holy Strike',
  cost: { resource: 'mana', amount: 20 },
  cooldownMs: seconds(10),
  attackTable: 'melee-special',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: PHYSICAL,
      /*
       * ITS FLAT HOLY DAMAGE, PLUS THE SHEET'S SPELL POWER TERM, and the flat
       * figure is not replaced by it -- "many spells have a base damage that
       * needs to be added to this".
       *
       * FOLDED INTO `baseAmount` RATHER THAN PASSED AS A COEFFICIENT, because
       * this is ONE damage event and `scaleByPower` picks a single power pool
       * from the school: physical reads attack power, which is what the weapon
       * half needs. A spell power coefficient on a physical request would be
       * read against attack power and silently scale with the wrong stat. The
       * seals resolve the same problem the same way.
       */
      /*
       * ======================================================================
       * AND ALL OF IT IS INSIDE THE 50%, by the owner's formula: "(weapon
       * damage + flat holy damage based on rank + 42.9% spell power) * 50%".
       * The spell power half already came out at 21.45%; the FLAT Holy damage
       * did not, and landed whole beside a halved weapon. This is the owner
       * ruling the exception to "an ability's flat damage is added outside its
       * weapon percentage" for this one strike -- so the halving is written
       * here rather than by changing that rule for everyone.
       * ======================================================================
       */
      baseAmount:
        (HOLY_STRIKE_HOLY_DAMAGE +
          HOLY_STRIKE_SP_COEFFICIENT * spellPowerAgainst(caster, target, HOLY)) *
        HOLY_STRIKE_WEAPON_FRACTION,
      weaponScaling: {
        slot: MAIN_HAND,
        fraction: HOLY_STRIKE_WEAPON_FRACTION,
        normalized: true,
      },
      attackTable: ability.attackTable,
      weaponSlot: MAIN_HAND,
    });
  },
  unmodelled:
    'Its Holy half is dealt as part of the same physical strike rather than ' +
    'as a separate Holy hit, so armor applies to all of it.',
};

/**
 * Holy Shock, granted by the Holy talent.
 *
 * The damage half only. Its heal is real and no Paladin profile here heals.
 */
export const HOLY_SHOCK_DAMAGE = midpoint(334, 362);
export const HOLY_SHOCK_COEFFICIENT = HOLY_SHOCK_SP_COEFFICIENT;

export const HOLY_SHOCK: Ability = {
  id: 'holy_shock',
  name: 'Holy Shock',
  heals: true,
  cost: { resource: 'mana', amount: 325 },
  cooldownMs: seconds(10),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    /*
     * A FRIENDLY TARGET IS HEALED, an enemy is struck (round 52): "causing 334
     * to 362 Holy damage to an enemy, or 307 to 333 healing to an ally". Which
     * one is the target's side, so the entry that picked the target decides.
     */
    if (!target.isHostileTo(caster)) {
      paladinHeal(simulation, caster, target, ability, HOLY_SHOCK_HEAL, PLACEHOLDER_HOLY_SHOCK_HEAL_COEFFICIENT);
      return;
    }
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: HOLY,
      baseAmount: HOLY_SHOCK_DAMAGE,
      powerCoefficient: HOLY_SHOCK_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

/** Holy Shock's heal: "307 to 333 healing to an ally". */
export const HOLY_SHOCK_HEAL = midpoint(307, 333);

/**
 * A Paladin heal, and the two Holy talents that ride on its crit.
 *
 * ----------------------------------------------------------------------------
 * ILLUMINATION: "after getting a critical effect from your Flash of Light, Holy
 * Light, Light's Vigil, or Holy Shock heal spell you have a {0}% chance to gain
 * Mana equal to {1}% of the base cost of the spell". BASE cost, so the declared
 * `cost` rather than whatever a reduction left of it.
 *
 * INFUSION OF LIGHT: a Holy Shock or Flash of Light crit takes {1} seconds off
 * the next Holy Light within 15.
 *
 * BOTH ARE READ OFF THE ABILITY COPY'S `bonuses`, which `applyTalentChanges`
 * fills per character -- so a Paladin without the talent heals plainly.
 * ----------------------------------------------------------------------------
 */
export function paladinHeal(
  simulation: SimulationContext,
  caster: Combatant,
  target: Combatant,
  ability: Ability,
  amount: number,
  coefficient: number,
): void {
  const result = applyHealing(simulation, {
    source: caster,
    target,
    abilityId: ability.id,
    abilityName: ability.name,
    baseAmount: amount,
    powerCoefficient: coefficient,
    threatens: true,
  });
  if (!result.critical) return;

  const chance = ability.bonuses?.[ILLUMINATION_CHANCE_KEY] ?? 0;
  const refund = ability.bonuses?.[ILLUMINATION_REFUND_KEY] ?? 0;
  if (chance > 0 && refund > 0 && ability.cost?.resource === 'mana') {
    if (simulation.rng.rollChance(chance / 100)) {
      simulation.grantResource(caster, 'mana', (ability.cost.amount * refund) / 100, {
        id: 'illumination',
        name: 'Illumination',
      });
    }
  }

  const infusion = ability.bonuses?.[INFUSION_OF_LIGHT_KEY] ?? 0;
  if (infusion > 0) simulation.applyAura(caster, infusionOfLight(infusion), caster.id);
}

/**
 * Holy Light: "Heals a friendly target for 1,495 to 1,665." 660 mana, a 2.5
 * second cast. Rank 9, the capture's.
 */
export const HOLY_LIGHT_HEAL = midpoint(1495, 1665);

export const HOLY_LIGHT: Ability = {
  id: 'holy_light',
  name: 'Holy Light',
  heals: true,
  cost: { resource: 'mana', amount: 660 },
  castTimeMs: seconds(2.5),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target || target.isHostileTo(caster)) return;
    paladinHeal(simulation, caster, target, ability, HOLY_LIGHT_HEAL, PLACEHOLDER_HOLY_LIGHT_HEAL_COEFFICIENT);
  },
};

/**
 * Flash of Light: "Heals a friendly target for 291 to 325." 140 mana, a 1.5
 * second cast. Rank 6, the capture's.
 */
export const FLASH_OF_LIGHT_HEAL = midpoint(291, 325);

export const FLASH_OF_LIGHT: Ability = {
  id: 'flash_of_light',
  name: 'Flash of Light',
  heals: true,
  cost: { resource: 'mana', amount: 140 },
  castTimeMs: seconds(1.5),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target || target.isHostileTo(caster)) return;
    paladinHeal(
      simulation,
      caster,
      target,
      ability,
      FLASH_OF_LIGHT_HEAL,
      PLACEHOLDER_FLASH_OF_LIGHT_HEAL_COEFFICIENT,
    );
  },
};

/**
 * Consecration: "96 Holy damage over 8 sec to enemies who enter the area. The
 * first 4 enemies will take an additional 216 damage over 8 sec."
 *
 * A GROUND EFFECT MODELLED AS A DEBUFF ON EVERY TARGET STANDING IN IT, which
 * is the only shape the engine has and is exactly right for targets that never
 * move (round 57). The first four in the fight -- the boss and three adds --
 * take both halves, 312 over eight seconds; a fifth and later take the 96.
 * Consecrated Ground's 10% is "against the first 4 enemies", so it rides on
 * the first four only. One target in the fight is the old single debuff.
 */
export const CONSECRATION_FULL_TARGETS = 4;
export const CONSECRATION_BASE_TOTAL = 96;
export const CONSECRATION_BONUS_TOTAL = 216;

export const CONSECRATION: Ability = {
  id: 'consecration',
  name: 'Consecration',
  cost: { resource: 'mana', amount: 565 },
  cooldownMs: seconds(8),
  targets: { maxTargets: Infinity },
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    /*
     * CONSECRATED GROUND'S PERCENTAGE ARRIVES ON THE ABILITY, the Twist of Light
     * pattern -- so reading it here is per character by construction and a
     * Paladin without the talent lays the plain version.
     */
    const percent = ability.bonuses?.[CONSECRATED_GROUND_FLAG] ?? 0;
    areaTargets(simulation, caster, target, ability).forEach((struck, index) => {
      simulation.applyAura(
        struck,
        index < CONSECRATION_FULL_TARGETS
          ? consecrationGround(percent)
          : consecrationGround(0, CONSECRATION_BASE_TOTAL),
        caster.id,
      );
    });
  },
};

/** Holy Shield, granted by the Protection capstone. */
export const HOLY_SHIELD_ABILITY: Ability = {
  id: 'holy_shield',
  name: 'Holy Shield',
  cost: { resource: 'mana', amount: 240 },
  cooldownMs: seconds(10),
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, HOLY_SHIELD, caster.id);
  },
};

/**
 * Hammer of Wrath: "strikes an enemy for 474 to 522 Holy damage. Only usable
 * on enemies that have 20% or less health."
 *
 * ----------------------------------------------------------------------------
 * THE LAST ROW OF THE COEFFICIENT SHEET THAT COULD NOT BE APPLIED.
 *
 * `HAMMER_OF_WRATH_SP_COEFFICIENT` has been transcribed in
 * `combat/coefficients.ts` since the sheet arrived, carrying a comment saying
 * the ability did not exist. It does now, and the comment is corrected there.
 *
 * ITS HEALTH GATE IS THE CLOCK, the same ruling Execute runs on and for the
 * same reason: this encounter is a damage sink running for a fixed duration,
 * not something with a health bar to whittle down, so a 20%-health condition
 * could never once fire. `inExecutePhase` is the shared rule -- see
 * `combat/executePhase.ts`, which is where it moved when it stopped being the
 * Warrior's alone.
 *
 * A ONE SECOND CAST ON A MELEE CLASS IS A REAL COST. A cast interrupts the
 * swing in progress and resets the swing timer, so the Retribution and
 * Shockadin lists are trading part of an auto attack for it. That is not a
 * reason to leave it out; it is a reason the entry has to be MEASURED rather
 * than ranked by damage per cast alongside the instants around it.
 * ----------------------------------------------------------------------------
 */
export const HAMMER_OF_WRATH_DAMAGE = midpoint(474, 522);
export const HAMMER_OF_WRATH_COEFFICIENT = HAMMER_OF_WRATH_SP_COEFFICIENT;

/*
 * ============================================================================
 * AND AT 2/2 INSTRUMENT OF LAW MAKES IT AN INSTANT RANGED ATTACK.
 *
 * "Reduces the cast time of your Hammer of Wrath by 1 sec" at rank 2, against a
 * one-second cast -- so the cast is gone entirely, and the ruleset owner has
 * ruled what the ability then IS: an instant RANGED attack that scales with
 * SPELL POWER. Three separate facts, and each is wrong in a different way if
 * guessed:
 *
 *   INSTANT        no cast time AND therefore no swing timer reset. A cast
 *                  interrupts the swing in progress, which on a melee Paladin
 *                  is a real cost -- `castTimeMs: 0` removes both, because
 *                  `resetSwingTimers` is only reached by a cast with a length.
 *   RANGED TABLE   `ranged-special`, so it rolls against the ranged table:
 *                  no dodge, no parry, no glance, and a RANGED crit, which is
 *                  2x rather than a spell's 1.5x. It is no longer resisted the
 *                  way a spell is either.
 *   SPELL POWER    unchanged, and the thing most likely to be got wrong by
 *                  moving it to a ranged table. The school stays `holy`, and
 *                  `scaleByPower` picks its pool from the SCHOOL rather than
 *                  from the table -- so a non-physical school reads spell power
 *                  whatever table it rolls on. Stated in the owner's words
 *                  because the plausible reading of "ranged attack" is ranged
 *                  ATTACK POWER, and that is exactly what it is not.
 *
 * TWO ABILITIES OR ONE? One, and the talent moves it with `abilityCastTime` --
 * its own wording, "reduces the cast time by 1 sec", against a one-second cast.
 * **The table is then DERIVED from the cast time rather than declared beside
 * it**, so there is one fact on disk instead of two that can disagree: rank 1
 * takes half a second off and leaves a cast, rank 2 takes the whole second and
 * the ability becomes the ranged instant. A flag would have had to be kept in
 * step with the number by hand.
 *
 * THE RETRIBUTION LIST ASKS FOR THIS SPECIFICALLY. Its entry is gated on the
 * talent, because a Hammer of Wrath with a one-second cast is a different
 * ability with a different price and the owner wants the instant one.
 * ============================================================================
 */
export const HAMMER_OF_WRATH_CAST_MS = seconds(1);

export const HAMMER_OF_WRATH: Ability = {
  id: 'hammer_of_wrath',
  name: 'Hammer of Wrath',
  cost: { resource: 'mana', amount: 425 },
  castTimeMs: HAMMER_OF_WRATH_CAST_MS,
  cooldownMs: seconds(6),
  attackTable: 'spell',
  canCast: ({ simulation }) => inExecutePhase(simulation),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      /*
       * HOLY, WHICHEVER TABLE IT ROLLS ON, and that is what keeps it on SPELL
       * power: `scaleByPower` picks its pool from the school and not from the
       * table. A ranged table does not make an ability read ranged attack power.
       */
      school: HOLY,
      baseAmount: HAMMER_OF_WRATH_DAMAGE,
      powerCoefficient: HAMMER_OF_WRATH_COEFFICIENT,
      attackTable: hammerOfWrathTable(ability),
    });
  },
};

/**
 * Whether this character's copy has had its cast removed entirely.
 *
 * Read off the ability rather than off the talent, so it is per character by
 * construction -- `applyTalentChanges` hands each build its own copy and has
 * already subtracted the reduction. Rank 1 leaves half a second and is NOT this.
 */
export function isInstantHammerOfWrath(ability: Ability): boolean {
  return (ability.castTimeMs ?? 0) <= 0;
}

/** `ranged-special` once Instrument of Law has made it instant, else `spell`. */
export function hammerOfWrathTable(ability: Ability): 'spell' | 'ranged-special' {
  return isInstantHammerOfWrath(ability) ? 'ranged-special' : 'spell';
}

// ---------------------------------------------------------------------------
// Protection
// ---------------------------------------------------------------------------

/**
 * Templar's Bulwark. The first absorb shield in the project; everything about
 * how it is modelled is on `TEMPLARS_BULWARK`.
 */
export const TEMPLARS_BULWARK_ABILITY: Ability = {
  id: 'templars_bulwark',
  name: "Templar's Bulwark",
  cost: { resource: 'mana', amount: 110 },
  cooldownMs: TEMPLARS_BULWARK_COOLDOWN_MS,
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, TEMPLARS_BULWARK, caster.id);
  },
  unmodelled:
    `Its Forbearance -- ${TEMPLARS_BULWARK_FORBEARANCE_MS / 1000} seconds, and ` +
    'it cannot be cast while that is up -- is not modelled. It exists to stop ' +
    'this being chained with the Paladin immunities, none of which are ' +
    'declared, and one minute sits well inside a five minute cooldown, so it ' +
    'can never be the binding constraint here.',
};

/**
 * Righteous Fury. Declared and cast, and it does NOTHING, which is the honest
 * model rather than a generous one -- see `RIGHTEOUS_FURY`.
 */
export const RIGHTEOUS_FURY_ABILITY: Ability = {
  id: 'righteous_fury',
  name: 'Righteous Fury',
  cost: { resource: 'mana', amount: shareOfBase(0.3) },
  requiresTarget: false,
  canCast: ({ caster }) => !caster.auras.has('righteous_fury'),
  onCast: ({ simulation, caster, ability }) => {
    /*
     * IMPROVED RIGHTEOUS FURY'S PERCENTAGE ARRIVES ON THE ABILITY, so reading it
     * here is per character by construction and a Paladin without the talent
     * gets the plain buff. See `righteousFury`.
     */
    simulation.applyAura(
      caster,
      righteousFury(ability.bonuses?.[IMPROVED_RIGHTEOUS_FURY_FLAG] ?? 0),
      caster.id,
    );
  },
  unmodelled:
    `Its OWN effect is threat -- +${RIGHTEOUS_FURY_THREAT_PERCENT}% from Holy ` +
    'attacks -- and threat is not tracked here at all, by a permanent ruling. ' +
    'It is cast because a Protection Paladin really does spend the mana and ' +
    'the global cooldown on it, so the profile pays what it pays. **What it ' +
    'switches ON is not inert**: Improved Righteous Fury and Iron Creed both ' +
    'read "while Righteous Fury is active" and both apply.',
};

/**
 * Divine Favor, granted by the Holy talent: "gives your next Flash of Light,
 * Holy Light, or Holy Shock spell a 100% critical effect chance."
 *
 * ----------------------------------------------------------------------------
 * 4% OF BASE MANA AND A TWO MINUTE COOLDOWN, both from the spellbook capture.
 *
 * ALL OF ITS WORK IS ON THE AURA, which carries a `critBonus` of 100 for Holy
 * Shock alone and is spent by a cast reaction. The ability is only the button.
 *
 * IN THE SHOCKADIN LIST, ON THE RULESET OWNER'S CHOICE, sitting above Holy Shock
 * so the guaranteed crit is never wasted on a Holy Shock that would have gone
 * first. It is off the global cooldown for nothing -- it takes one like any
 * instant -- so the entry is paid for, and what it is worth is measured.
 * ----------------------------------------------------------------------------
 */
export const DIVINE_FAVOR_ABILITY: Ability = {
  id: 'divine_favor',
  name: 'Divine Favor',
  cost: { resource: 'mana', amount: shareOfBase(0.04) },
  cooldownMs: seconds(120),
  requiresTarget: false,
  /*
   * ==========================================================================
   * OFF THE GLOBAL COOLDOWN, BY THE OWNER'S RULING: "the Divine Favor
   * talent/cooldown doesn't trigger the global cooldown." Swift Judgement is
   * the other Paladin ability that says so, and for the same reason it is a
   * RULING rather than a measurement -- an ability wrongly taking a global
   * cooldown still has the right cost, the right cooldown and the right
   * effect, so the mistake is invisible everywhere except the figure.
   *
   * BEING OFF IT MEANS ONE THING -- the ability does not START a global
   * cooldown -- and it is still BLOCKED by one already running.
   *
   * IT RETIRES A ROTATION FINDING RATHER THAN CONFIRMING ONE. While this took
   * a global cooldown, moving the entry to the BOTTOM of the Shockadin list was
   * worth **+13.5** and deleting it **+9.9**, because once a fight it displaced
   * a Consecration or a Judgement. Off the global cooldown it costs one
   * `ROTATION_POLL_MS` -- 100ms of idle, the same price the racials and the
   * mid-fight consumables pay -- and the position stops mattering. The list
   * keeps it at the bottom anyway; see `rotations/paladin.ts` for why that is
   * now a free choice rather than a measured one.
   * ==========================================================================
   */
  triggersGcd: false,
  // Nothing to gain from a second one while the first is unspent.
  canCast: ({ caster }) => !caster.auras.has('divine_favor'),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, DIVINE_FAVOR, caster.id);
  },
  unmodelled:
    'Two of its three spells are heals -- Flash of Light and Holy Light -- and ' +
    'no Paladin profile heals, so only its Holy Shock clause does anything.',
};

export const PALADIN_ABILITIES: readonly Ability[] = [
  SEAL_OF_RIGHTEOUSNESS_ABILITY,
  SEAL_OF_COMMAND_ABILITY,
  SEAL_OF_THE_CRUSADER_ABILITY,
  SEAL_OF_FURY_ABILITY,
  JUDGEMENT,
  SWIFT_JUDGEMENT,
  HOLY_STRIKE,
  HOLY_SHOCK,
  HOLY_LIGHT,
  FLASH_OF_LIGHT,
  DIVINE_FAVOR_ABILITY,
  CONSECRATION,
  HOLY_SHIELD_ABILITY,
  HAMMER_OF_WRATH,
  TEMPLARS_BULWARK_ABILITY,
  RIGHTEOUS_FURY_ABILITY,
];
