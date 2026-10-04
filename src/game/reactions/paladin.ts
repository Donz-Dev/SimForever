import type { AttackEvent, Combatant, Reaction, SimulationContext } from '../../engine';
import { dealDamage, isWeaponUse, spellPowerAgainst } from '../../engine';
import { ppmChance } from '../items/procs';
import {
  SEAL_OF_COMMAND_SP_COEFFICIENT,
  SEAL_OF_FURY_SP_COEFFICIENT,
} from '../combat/coefficients';
import {
  ECHO_AURA_IDS,
  IMPROVED_SEAL_OF_FURY_FLAG,
  JUDGEMENT_OF_THE_CRUSADER,
  SEAL_OF_COMMAND_WEAPON_FRACTION,
  SEAL_OF_FURY_DAMAGE,
  SEAL_OF_RIGHTEOUSNESS_BASE,
  improvedSealOfFuryMana,
  sealDamage,
  sealOfFuryShield,
  sealOfRighteousnessCoefficient,
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
): void {
  dealDamage(context, {
    source: actor,
    target: attack.defender,
    abilityId: id,
    abilityName: name,
    school: HOLY,
    baseAmount: amount,
    ...(weaponScaling ? { weaponScaling } : {}),
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
 * THE OWNER'S FORMULA, and the first spell power coefficient in the project:
 * `base + baseWeaponSpeed x (0.022 x AP + 0.044 x SP)`. A slow weapon really
 * does hit harder with it, which is what the tooltip's "slower weapons cause
 * more Holy damage per swing" means, and it falls out of the formula rather
 * than needing a rule of its own.
 */
export function sealOfRighteousnessProc(): Reaction {
  return {
    id: 'seal_of_righteousness',
    on: 'dealt',
    outcomes: [...LANDED],
    canTrigger: (_context, actor, attack) =>
      isWeaponUse(attack) && actor.auras.has('seal_of_righteousness'),
    onTrigger: (context, actor, attack) => {
      sealHit(
        context,
        actor,
        attack,
        'seal_of_righteousness',
        'Seal of Righteousness',
        sealDamage(
          SEAL_OF_RIGHTEOUSNESS_BASE,
          /*
           * HOLY SPELL POWER, not the school-blind pool alone. Eight pieces
           * of Lawbringer say "Increases damage done by Holy spells and
           * effects by up to N" and the seal is Holy, so `spellPowerAgainst`
           * adds them -- the same function `scaleByPower` uses, so a seal
           * cannot disagree with the pipeline about what a Holy point is
           * worth.
           *
           * AND THE TARGET'S SIDE OF THE SAME POOL, which is Judgement of the
           * Crusader's "+ up to 161 Holy damage taken". A seal computes its own
           * damage here and hands it over as a `baseAmount` with no
           * coefficient, so it has to ASK for that -- `scaleByPower` would
           * never see a coefficient to apply it to. This is the half of the
           * class the debuff is worth the most to: it lands on every swing.
           */
          spellPowerAgainst(actor, attack.defender, HOLY),
          // By weapon TYPE, which is what the sheet keys it on.
          sealOfRighteousnessCoefficient(actor.weapons.mainHand?.twoHanded === true),
        ),
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

export function sealOfCommandProc(): Reaction {
  return {
    id: 'seal_of_command',
    on: 'dealt',
    outcomes: [...LANDED],
    canTrigger: (context, actor, attack) => {
      if (!isWeaponUse(attack)) return false;
      if (!actor.auras.has('seal_of_command')) return false;
      const speed = baseSpeedSeconds(actor, attack);
      if (speed <= 0) return false;
      return context.rng.nextFloat(0, 1) < ppmChance(speed, SEAL_OF_COMMAND_PPM);
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
      );
    },
  };
}

/**
 * Seal of Fury: a flat 35 Holy damage on every melee attack.
 *
 * ITS ABSORB CLAUSE IS NOT MODELLED. "While a shield is equipped, each attack
 * also grants an absorb shield equal to 50% of the Holy damage dealt" -- the
 * engine has absorbs, and what it has no shape for is a shield that is granted
 * per swing and consumed per hit taken. Only the Protection profile would use
 * it, and it says so.
 */
export const SEAL_OF_FURY_UNMODELLED =
  'Its absorb clause is not modelled: a shield granted on every swing and ' +
  'spent on every hit taken has no declaration. The 35 Holy damage applies.';

export function sealOfFuryProc(): Reaction {
  return {
    id: 'seal_of_fury',
    on: 'dealt',
    outcomes: [...LANDED],
    canTrigger: (_context, actor, attack) =>
      isWeaponUse(attack) && actor.auras.has('seal_of_fury'),
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
      isWeaponUse(attack) && actor.auras.has('seal_of_fury'),
    onTrigger: (context, actor, attack) => {
      /*
       * IMPROVED SEAL OF FURY ARRIVES AS A NUMBER, NOT AS A LOOKUP INSIDE THE
       * AURA. The talent sets a flag on the seal ABILITY -- the Twist of Light
       * pattern, and per character by construction because `applyTalentChanges`
       * hands each character its own copy -- and this reads it once here. Zero
       * without the talent, and the shield then simply returns nothing.
       *
       * THE LEVEL DIFFERENCE IS THE ATTACKER'S, and the enemy being hit is the
       * enemy hitting back in this encounter. Read from the two combatants
       * rather than assumed to be three, so a change of target level follows.
       */
      const hasTalent =
        (actor.abilities.get('seal_of_fury')?.bonuses?.[IMPROVED_SEAL_OF_FURY_FLAG] ?? 0) > 0;
      const mana = hasTalent
        ? improvedSealOfFuryMana(attack.defender.level - actor.level)
        : 0;
      context.applyAura(actor, sealOfFuryShield(mana), actor.id);
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
 * Twist of Light's Echo: the next melee attack applies the REPLACED seal.
 *
 * ------------------------------------------------------------------------------
 * THE RETRIBUTION CAPSTONE, AND THE REASON A PROFILE IS CALLED "SEAL TWIST".
 *
 * In Classic this was a timing trick -- swap seals in the window before a
 * swing lands and both resolve, a technique measured in milliseconds. Forever
 * has made it an explicit talent with an explicit trigger, so it can be
 * modelled exactly rather than approximated by a rotation pretending to have
 * millisecond hands.
 *
 * ONE CHARGE, and it fires BEFORE the seal currently up. Both land on the same
 * swing -- that is the whole point of the talent -- and the echo is removed
 * first so a second echo cannot chain off its own damage.
 *
 * THE ECHOED DAMAGE IS STILL NOT A WEAPON USE, for the same reason every other
 * seal hit is not: it goes through `sealHit`.
 * ------------------------------------------------------------------------------
 */
export function echoProc(): Reaction {
  return {
    id: 'twist_of_light',
    on: 'dealt',
    outcomes: [...LANDED],
    canTrigger: (_context, actor, attack) =>
      isWeaponUse(attack) && ECHO_AURA_IDS.some((id) => actor.auras.has(id)),
    onTrigger: (context, actor, attack) => {
      const echoId = ECHO_AURA_IDS.find((id) => actor.auras.has(id));
      if (!echoId) return;
      actor.auras.remove(context, echoId);

      const sealId = echoId.replace(/^echo_/, '');

      if (sealId === 'seal_of_righteousness') {
        sealHit(
          context,
          actor,
          attack,
          'twist_of_light',
          'Echo (Seal of Righteousness)',
          sealDamage(
            SEAL_OF_RIGHTEOUSNESS_BASE,
            // Holy-scoped gear included, exactly as the seal itself reads it.
            spellPowerAgainst(actor, attack.defender, HOLY),
            sealOfRighteousnessCoefficient(actor.weapons.mainHand?.twoHanded === true),
          ),
        );
        return;
      }

      if (sealId === 'seal_of_fury') {
        sealHit(
          context,
          actor,
          attack,
          'twist_of_light',
          'Echo (Seal of Fury)',
          sealDamage(SEAL_OF_FURY_DAMAGE, spellPowerAgainst(actor, attack.defender, HOLY), SEAL_OF_FURY_SP_COEFFICIENT),
        );
        return;
      }

      if (sealId === 'seal_of_command') {
        /*
         * AN ECHO OF SEAL OF COMMAND IS GUARANTEED, not rolled. The talent
         * says the next melee attack APPLIES the replaced seal's effects --
         * it does not say "gives it another chance to proc". Rolling PPM here
         * would make the capstone worth a fraction of what it reads as, and
         * would be invisible.
         */
        sealHit(
          context,
          actor,
          attack,
          'twist_of_light',
          'Echo (Seal of Command)',
          // The same normalised weapon share as the seal itself. See above.
          SEAL_OF_COMMAND_SP_COEFFICIENT * spellPowerAgainst(actor, attack.defender, HOLY),
          { slot: 'mainHand', fraction: SEAL_OF_COMMAND_WEAPON_FRACTION, normalized: true },
        );
      }
      // Seal of the Crusader has no per-swing damage to echo: it is attack
      // power and haste, which the aura it left behind no longer grants.
    },
  };
}

/** Every Paladin carries all of them; the aura decides which one fires. */
export const PALADIN_REACTIONS: readonly Reaction[] = [
  sealOfRighteousnessProc(),
  sealOfCommandProc(),
  sealOfFuryProc(),
  echoProc(),
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
