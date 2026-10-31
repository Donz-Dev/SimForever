import type { AttackEvent, Combatant, Reaction, SimulationContext } from '../../engine';
import { dealDamage, isWeaponUse, spellPowerAgainst } from '../../engine';
import { ppmChance } from '../items/procs';
import {
  SEAL_OF_COMMAND_SP_COEFFICIENT,
  SEAL_OF_FURY_SP_COEFFICIENT,
} from '../combat/coefficients';
import {
  JUDGEMENT_OF_THE_CRUSADER,
  SEAL_OF_COMMAND_WEAPON_FRACTION,
  SEAL_OF_FURY_DAMAGE,
  UNSEALED_WRATH_AURA_IDS,
  activeSeal,
  sealDamage,
  sealOfFuryShield,
  sealOfRighteousnessBase,
  sealOfRighteousnessCoefficient,
  unsealedWrathAura,
} from '../auras/paladin';

/**
 * Seal procs: the half of a Seal that rides on every melee swing.
 *
 * ------------------------------------------------------------------------------
 * SEAL DAMAGE IS NOT A WEAPON USE, by the ruleset owner's ruling, and this file
 * is where that is enforced. Every `dealDamage` below passes NO `weaponSlot`,
 * which is the whole of `isWeaponUse` -- so a Seal of Righteousness hit cannot
 * trigger Windfury, Crusader or Hand of Justice, and cannot trigger another
 * seal proc either.
 *
 * THE SWING THAT CARRIED IT STILL DOES. A Paladin's auto-attack is an ordinary
 * main-hand use and procs everything it normally would; only the Holy damage
 * the seal adds is excluded. The two are one line apart on purpose.
 *
 * WHICH SEAL IS UP IS READ FROM THE AURA rather than from which reaction is
 * registered, because a Paladin carries every seal's reaction and swaps the
 * aura. That is what makes seal-swapping mid-fight work at all, and it is what
 * the Retribution capstone is built around.
 *
 * AND A SEAL CRITS, AT THE PALADIN'S MELEE CRIT CHANCE -- the owner's ruling,
 * covering Seal of Righteousness, Seal of Fury and Seal of Command. It is one
 * field, `critFrom`, and the reasoning is on `sealHit`. **The Echo gets it for
 * free and that is correct**: Twist of Light applies "the replaced Seal's
 * effects", so an echoed seal is the seal, and it goes through the same
 * function.
 *
 * SEAL OF THE CRUSADER IS NOT AFFECTED because it has no per-swing damage to
 * crit -- it grants attack power and haste. Said so the absence reads as the
 * seal rather than as an oversight.
 * ------------------------------------------------------------------------------
 */

const HOLY = 'holy' as const;

/**
 * Which crit chance a seal's Holy damage rolls against.
 *
 * The ruleset owner's ruling: Seal of Righteousness, Seal of Fury and Seal of
 * Command all crit, and they use the Paladin's MELEE attack crit chance rather
 * than its spell crit -- so a seal crit is 2x like a swing, not 1.5x like a
 * spell, even though the damage is Holy.
 *
 * Named once because all three seals and the Echo share it, and because the
 * long version of why it is the swing table lives on `sealHit`.
 */
const SEAL_CRIT_TABLE = 'melee-auto' as const;

/** The base speed of the weapon that landed this attack, for the formula. */
function baseSpeedSeconds(actor: Combatant, attack: AttackEvent): number {
  const slot = attack.weaponSlot ?? 'mainHand';
  const weapon = actor.weapons[slot];
  // `swingTimerMs` is the BASE speed: haste is applied when a swing is
  // scheduled, never stored back onto the weapon. The owner's formula asks for
  // the base, so reading it here is exactly right and not an approximation.
  return (weapon?.swingTimerMs ?? 0) / 1000;
}

/**
 * Whether a landed attack can carry a seal: a melee weapon use that is NOT Holy
 * Strike.
 *
 * THE SEAL BALANCE PASS EXCLUDES HOLY STRIKE BY NAME, for all three damage
 * seals: "Does not proc from Holy Strike." Holy Strike is still a weapon use --
 * it procs Crusader, Windfury and Hand of Justice exactly as before -- so this
 * is a rule about seals and not about the strike, and it lives here rather than
 * on the ability. The Echo reads it too, because Twist of Light applies "the
 * replaced Seal's effects" and those effects do not ride on a Holy Strike.
 */
export function carriesSeal(attack: AttackEvent): boolean {
  return isWeaponUse(attack) && attack.abilityId !== 'holy_strike';
}

/** Seal of Righteousness's damage for the weapon this attack came from. */
function sealOfRighteousnessHit(actor: Combatant, attack: AttackEvent): number {
  const twoHanded = actor.weapons.mainHand?.twoHanded === true;
  return sealDamage(
    sealOfRighteousnessBase(baseSpeedSeconds(actor, attack), twoHanded),
    /*
     * HOLY SPELL POWER, not the school-blind pool alone. Eight pieces of
     * Lawbringer say "Increases damage done by Holy spells and effects by up
     * to N" and the seal is Holy, so `spellPowerAgainst` adds them -- and the
     * TARGET'S side of the same pool, Judgement of the Crusader's "+ up to 161
     * Holy damage taken". A seal computes its own damage and hands it over as
     * a `baseAmount`, so it has to ASK.
     */
    spellPowerAgainst(actor, attack.defender, HOLY),
    sealOfRighteousnessCoefficient(twoHanded),
  );
}

/** Deal a seal's Holy damage, with no weapon slot so nothing procs off it. */
function sealHit(
  context: SimulationContext,
  actor: Combatant,
  attack: AttackEvent,
  id: string,
  name: string,
  amount: number,
  /*
   * A SHARE OF NORMALISED WEAPON DAMAGE, for Seal of Command alone. Passed
   * rather than assumed, because every other seal states a flat figure plus
   * spell power and would be wrong to read a weapon at all.
   */
  weaponScaling?: {
    readonly slot: 'mainHand';
    readonly fraction: number;
    readonly normalized: true;
  },
  /*
   * SEAL OF COMMAND ROLLS THE MELEE TABLE, by the balance pass -- "Is on the
   * melee combat table" where Righteousness and Fury "cannot miss". So it can
   * be missed or dodged on its own, and its crit comes from the table it rolls.
   */
  rollsMeleeTable = false,
): void {
  dealDamage(context, {
    source: actor,
    target: attack.defender,
    abilityId: id,
    abilityName: name,
    school: HOLY,
    baseAmount: amount,
    ...(weaponScaling ? { weaponScaling } : {}),
    ...(rollsMeleeTable ? { attackTable: 'melee-special' as const } : {}),
    /*
     * NO `weaponSlot` AND NO `attackTable`. The swing already rolled the
     * table; this is the damage that rides on it having landed, so rolling
     * again would give it its own chance to miss on top of the swing's.
     */
    /*
     * ...BUT IT DOES ROLL FOR A CRIT, at the Paladin's MELEE crit chance, on
     * the ruleset owner's ruling. `critFrom` is the field for exactly this: a
     * hit whose LANDING was settled by something else and which still crits at
     * the crit chance of the kind of event that carried it. A damage-over-time
     * tick is the other caller and is the same shape.
     *
     * ------------------------------------------------------------------------
     * `melee-auto` RATHER THAN `melee-special`, AND TODAY NOTHING RESTS ON IT.
     * `attackChances` computes one `crit` and one `critMultiplier` for both
     * melee tables, above the switch, so the two are interchangeable for a
     * `critFrom` that reads nothing else. The swing is the plainer reading of
     * "melee attack crit chance" and is what a seal rides on, so it is the one
     * named -- and this is the line to revisit if the two tables ever diverge,
     * because `attackTableModifiers` is consulted through `attackTable ??
     * critFrom` and a talent scoped to one table would then reach seals or not.
     *
     * A MELEE CRIT IS 2x, NOT A SPELL'S 1.5x, which is the half of the ruling
     * that is easy to lose. The seal deals HOLY damage, so `spellCritChance`
     * and `spellCritMultiplier` are the plausible wrong answer on both counts;
     * the owner named the melee chance, and the multiplier follows the table
     * rather than the school.
     *
     * IT COSTS ONE RANDOM NUMBER PER SEAL HIT, so every seeded Paladin fight
     * shifts. That is contained -- nothing but a Paladin has a seal -- and it is
     * why the three profiles move by more than the crits alone are worth.
     *
     * IT DOES NOT ARM VENGEANCE, and that is not a decision made here: a seal
     * hit carries no `attackTable`, so `dealDamage` offers it to no reaction at
     * all, and `sealHit` is called from inside the seal's own reaction where the
     * re-entrancy guard would refuse a second one anyway. Said rather than left
     * to be rediscovered, because "after landing a critical strike" now has a
     * kind of critical strike it does not see.
     * ------------------------------------------------------------------------
     */
    critFrom: SEAL_CRIT_TABLE,
    powerCoefficient: 0,
    appliesArmor: false,
  });
}

/** Every landed melee use, which is when a seal pays out. */
const LANDED = ['hit', 'crit', 'glance', 'crush'] as const;

/**
 * Seal of Righteousness: Holy damage on every melee attack.
 *
 * The balance pass's formula -- a speed-scaled base times the base speed times
 * a hand multiplier, plus 10% or 12% spell power. See `sealOfRighteousnessBase`
 * in `auras/paladin.ts`. 100% proc chance, cannot miss, crits for 2x at the
 * melee crit chance, and does not ride on Holy Strike.
 */
export function sealOfRighteousnessProc(): Reaction {
  return {
    id: 'seal_of_righteousness',
    on: 'dealt',
    outcomes: [...LANDED],
    canTrigger: (_context, actor, attack) =>
      carriesSeal(attack) && actor.auras.has('seal_of_righteousness'),
    onTrigger: (context, actor, attack) => {
      sealHit(
        context,
        actor,
        attack,
        'seal_of_righteousness',
        'Seal of Righteousness',
        sealOfRighteousnessHit(actor, attack),
      );
    },
  };
}

/**
 * Seal of Command: a PPM chance of Holy damage worth 70% of a weapon swing.
 *
 * ------------------------------------------------------------------------------
 * PROCS PER MINUTE, on the ruleset owner's ruling -- the same normalisation
 * Crusader and Vis'kag use, so a fast weapon and a slow one proc the same
 * number of times a minute and the seal is not quietly worth more on a dagger.
 *
 * AND THE RATE IS 7 PPM, WHICH IS THE RULESET OWNER'S OWN FIGURE.
 *
 * IT WAS A NAMED PLACEHOLDER CONSTANT FOR MOST OF THIS PROJECT, and the
 * largest invented number in the fifth-highest profile -- Seal of Command plus
 * its Echo is 26.5% of Seal Twist Retribution's damage, so the caveat on that
 * profile was load-bearing. The owner has now confirmed 7 is the real value, so
 * the placeholder is deleted rather than renamed and the profile loses its one
 * big asterisk. The VALUE does not move; what moves is whether it can be quoted.
 *
 * ITS OLD NAME IS DELIBERATELY NOT WRITTEN OUT ANYWHERE IN `src`, because the
 * project counts placeholders by grepping for the `PLACEHOLDER_` prefix -- so a
 * prose mention of a deleted one inflates the count, which is exactly the kind
 * of un-auditable figure the naming convention exists to prevent.
 * ------------------------------------------------------------------------------
 */
export const SEAL_OF_COMMAND_PPM = 7;

/** Seal of Command's 7 PPM roll, off the BASE speed of the weapon that landed. */
function rollSealOfCommand(
  context: SimulationContext,
  actor: Combatant,
  attack: AttackEvent,
): boolean {
  const speed = baseSpeedSeconds(actor, attack);
  if (speed <= 0) return false;
  return context.rng.nextFloat(0, 1) < ppmChance(speed, SEAL_OF_COMMAND_PPM);
}

export function sealOfCommandProc(): Reaction {
  return {
    id: 'seal_of_command',
    on: 'dealt',
    outcomes: [...LANDED],
    canTrigger: (context, actor, attack) => {
      if (!carriesSeal(attack)) return false;
      if (!actor.auras.has('seal_of_command')) return false;
      return rollSealOfCommand(context, actor, attack);
    },
    onTrigger: (context, actor, attack) => {
      /*
       * ----------------------------------------------------------------------
       * "70% OF NORMAL WEAPON DAMAGE", AND IT IS NORMALISED -- so it is
       * RECOMPUTED from the weapon rather than taken from the swing.
       *
       * It used to be `attack.amount x 0.7`: 70% of what actually landed, after
       * that swing's own crit and armor. That was a defensible reading of
       * "normal weapon damage" while there was nothing better, and it cannot
       * survive normalisation -- a normalised figure is by definition NOT the
       * damage of the swing that happened, because it replaces the weapon's own
       * speed with a fixed one.
       *
       * So it goes through `weaponScaling` like every other weapon-damage
       * ability, and keeps NO `weaponSlot` -- `isWeaponUse` still refuses it and
       * a seal still triggers nothing. The two fields are independent, which is
       * the same distinction Thunder Clap relies on.
       * ----------------------------------------------------------------------
       */
      sealHit(
        context,
        actor,
        attack,
        'seal_of_command',
        'Seal of Command',
        // The spell power half is the seal's OWN, added to the weapon half --
        // plus whatever the target's own Judgement debuff contributes.
        SEAL_OF_COMMAND_SP_COEFFICIENT * spellPowerAgainst(actor, attack.defender, HOLY),
        { slot: 'mainHand', fraction: SEAL_OF_COMMAND_WEAPON_FRACTION, normalized: true },
        true,
      );
    },
  };
}

/**
 * Seal of Fury: a flat 35 Holy damage on every melee attack.
 *
 * ITS ABSORB IS `sealOfFuryShieldProc` below, registered for a shield-holding
 * Paladin only. A note here used to say the absorb was not modelled, with an
 * exported reason nothing read; both outlived the shield being built.
 */
export function sealOfFuryProc(): Reaction {
  return {
    id: 'seal_of_fury',
    on: 'dealt',
    outcomes: [...LANDED],
    canTrigger: (_context, actor, attack) =>
      carriesSeal(attack) && actor.auras.has('seal_of_fury'),
    onTrigger: (context, actor, attack) => {
      sealHit(
        context,
        actor,
        attack,
        'seal_of_fury',
        'Seal of Fury',
        // Its flat 35 PLUS the sheet's 10% spell power. The 35 is not part of
        // the coefficient and must not be replaced by it.
        sealDamage(
          SEAL_OF_FURY_DAMAGE,
          spellPowerAgainst(actor, attack.defender, HOLY),
          SEAL_OF_FURY_SP_COEFFICIENT,
        ),
      );
    },
  };
}

/*
 * ============================================================================
 * SEAL OF FURY'S SHIELD: a separate reaction from its damage, for the same
 * swing.
 *
 * WHY IT IS NOT PART OF `sealOfFuryProc`. "While a shield is equipped" is a
 * BUILD fact and cannot be checked when the reaction fires -- an `AttackEvent`
 * carries the weapon slot and a `WeaponProfile` says nothing about what is in the
 * off hand. `reactionsForClass` takes the combat STYLE, which is where the
 * question is answerable, so the shield half is registered only for a Paladin
 * holding one and the damage half is registered for all of them.
 *
 * That is the same place Shield Slam's gate lives, and the same reasoning the
 * Warrior's Master of Defense was fixed by after its rage proc fired for a
 * Protection warrior carrying two weapons.
 * ============================================================================
 */
export function sealOfFuryShieldProc(): Reaction {
  return {
    id: 'seal_of_fury_shield',
    on: 'dealt',
    outcomes: [...LANDED],
    canTrigger: (_context, actor, attack) =>
      carriesSeal(attack) && actor.auras.has('seal_of_fury'),
    onTrigger: (context, actor) => {
      context.applyAura(actor, sealOfFuryShield(), actor.id);
    },
  };
}

/**
 * Judgement of the Crusader: "your melee strikes will refresh the spell's
 * duration."
 *
 * ----------------------------------------------------------------------------
 * WHAT TURNS ONE OPENING CAST INTO A WHOLE FIGHT'S DEBUFF. All three Paladin
 * lists judge the Crusader once, at the pull, and then never cast that seal
 * again -- so without this the +161 Holy power would run out forty seconds in
 * and the lists would look badly written rather than correct.
 *
 * REFRESHING IS RE-APPLYING, which `refreshBehaviour: 'reset'` already means.
 * Nothing new: the aura is put back on the target at full duration, exactly as a
 * second Judgement would.
 *
 * IT IS NOT GATED ON A TALENT, because the clause is the SPELL'S. Sacred
 * Arbiter's "causes Holy Strike to refresh all Judgement effects" is therefore
 * already satisfied for free -- Holy Strike is a melee strike.
 * ----------------------------------------------------------------------------
 */
export function judgementOfTheCrusaderRefresh(): Reaction {
  return {
    id: 'judgement_of_the_crusader_refresh',
    on: 'dealt',
    outcomes: [...LANDED],
    canTrigger: (_context, _actor, attack) =>
      isWeaponUse(attack) && attack.defender.auras.has('judgement_of_the_crusader'),
    onTrigger: (context, actor, attack) => {
      context.applyAura(attack.defender, JUDGEMENT_OF_THE_CRUSADER, actor.id);
    },
  };
}

/**
 * Fire one stored copy of a seal: its "normal chance to activate".
 *
 * Seal of Righteousness and Seal of Fury deal their hit on every melee attack,
 * so each stored copy is a hit; Seal of Command's effect IS a chance, so each
 * copy rolls the seal's own PPM -- the reading the owner ruled for Twist of
 * Light's Echo, which this replaced. Seal of the Crusader has no per-attack
 * effect to fire: its haste and attack power are the seal's AURA.
 */
function fireStoredSeal(
  context: SimulationContext,
  actor: Combatant,
  attack: AttackEvent,
  sealId: string,
): void {
  if (sealId === 'seal_of_righteousness') {
    sealHit(
      context,
      actor,
      attack,
      'unsealed_wrath',
      'Unsealed Wrath (Seal of Righteousness)',
      sealOfRighteousnessHit(actor, attack),
    );
    return;
  }
  if (sealId === 'seal_of_fury') {
    sealHit(
      context,
      actor,
      attack,
      'unsealed_wrath',
      'Unsealed Wrath (Seal of Fury)',
      sealDamage(SEAL_OF_FURY_DAMAGE, spellPowerAgainst(actor, attack.defender, HOLY), SEAL_OF_FURY_SP_COEFFICIENT),
    );
    return;
  }
  if (sealId === 'seal_of_command') {
    if (!rollSealOfCommand(context, actor, attack)) return;
    sealHit(
      context,
      actor,
      attack,
      'unsealed_wrath',
      'Unsealed Wrath (Seal of Command)',
      // The same normalised weapon share as the seal itself.
      SEAL_OF_COMMAND_SP_COEFFICIENT * spellPowerAgainst(actor, attack.defender, HOLY),
      { slot: 'mainHand', fraction: SEAL_OF_COMMAND_WEAPON_FRACTION, normalized: true },
      true,
    );
  }
}

/**
 * Unsealed Wrath, the Retribution capstone since 1.60.1.70707 (Twist of Light
 * renamed and reworked): "Your melee attacks store a copy of your active Seal
 * for 15 sec, stacking up to 3 times. Landing an attack with a different Seal
 * consumes all stacks, giving the stored Seal its normal chance to activate
 * once per stack."
 *
 * ------------------------------------------------------------------------------
 * ONE REACTION DOES BOTH HALVES, in one order: an attack under a DIFFERENT seal
 * spends what is stored first -- every copy, each firing on this attack -- and
 * then stores its own seal; an attack under the SAME seal adds a copy, up to
 * three. So the attack that consumes also starts the next store, which is the
 * reading where "your melee attacks store" holds of every attack.
 *
 * "MELEE ATTACKS" IS `carriesSeal`, the set every seal already rides on: a
 * swing or a weapon ability, and not Holy Strike, which carries no seal by the
 * seal balance pass. The stored copies are seal hits like the seal's own, so
 * they are not weapon uses and cannot proc a Crusader or store themselves.
 *
 * "LANDING" IS THE LANDED OUTCOMES, so a miss stores nothing and spends
 * nothing -- the same set the seal procs fire on.
 * ------------------------------------------------------------------------------
 */
export function unsealedWrathProc(): Reaction {
  return {
    id: 'unsealed_wrath',
    on: 'dealt',
    outcomes: [...LANDED],
    canTrigger: (_context, actor, attack) => carriesSeal(attack) && activeSeal(actor) !== undefined,
    onTrigger: (context, actor, attack) => {
      const current = activeSeal(actor);
      if (current === undefined) return;

      const storedId = UNSEALED_WRATH_AURA_IDS.find((id) => actor.auras.has(id));
      if (storedId !== undefined && storedId !== `unsealed_wrath_${current}`) {
        const copies = actor.auras.stacksOf(storedId);
        actor.auras.remove(context, storedId);
        const sealId = storedId.replace(/^unsealed_wrath_/, '');
        for (let i = 0; i < copies; i++) fireStoredSeal(context, actor, attack, sealId);
      }

      // A refresh adds a copy up to the cap and restarts the 15 seconds; at
      // three the window still restarts and the count simply cannot rise.
      context.applyAura(actor, unsealedWrathAura(current), actor.id);
    },
  };
}

/** Every Paladin carries all of them; the aura decides which one fires. */
export const PALADIN_REACTIONS: readonly Reaction[] = [
  sealOfRighteousnessProc(),
  sealOfCommandProc(),
  sealOfFuryProc(),
  judgementOfTheCrusaderRefresh(),
];

/**
 * The ones that need a shield, which is a question only the build can answer.
 *
 * One entry today. Kept as a list rather than a single reaction so that the next
 * shield-gated seal clause is an addition here instead of a change of shape at
 * the call site.
 */
export const PALADIN_SHIELD_REACTIONS: readonly Reaction[] = [sealOfFuryShieldProc()];
