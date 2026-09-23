import type { AttackEvent, Combatant, Reaction, SimulationContext } from '../../engine';
import { dealDamage, isWeaponUse } from '../../engine';
import { ppmChance } from '../items/procs';
import {
  ECHO_AURA_IDS,
  SEAL_OF_COMMAND_WEAPON_FRACTION,
  SEAL_OF_FURY_DAMAGE,
  SEAL_OF_RIGHTEOUSNESS_BASE,
  sealDamage,
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
 * ------------------------------------------------------------------------------
 */

const HOLY = 'holy' as const;

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
): void {
  dealDamage(context, {
    source: actor,
    target: attack.defender,
    abilityId: id,
    abilityName: name,
    school: HOLY,
    baseAmount: amount,
    /*
     * NO `weaponSlot` AND NO `attackTable`. The swing already rolled the
     * table; this is the damage that rides on it having landed, so rolling
     * again would give it its own chance to miss on top of the swing's.
     */
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
      const stats = actor.stats.effective;
      sealHit(
        context,
        actor,
        attack,
        'seal_of_righteousness',
        'Seal of Righteousness',
        sealDamage(
          SEAL_OF_RIGHTEOUSNESS_BASE,
          baseSpeedSeconds(actor, attack),
          stats.attackPower,
          stats.spellPower,
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
 * THE RATE ITSELF IS STILL MISSING. The owner chose PPM and the figure has not
 * arrived, so `PLACEHOLDER_SEAL_OF_COMMAND_PPM` stands in, is named, and is
 * printed on the results page. It is the single largest number in the Seal
 * Twist Retribution build, so this is the one caveat on that profile worth
 * reading before quoting its DPS.
 * ------------------------------------------------------------------------------
 */
export const PLACEHOLDER_SEAL_OF_COMMAND_PPM = 7;

export const SEAL_OF_COMMAND_UNMODELLED =
  'Its proc RATE is a placeholder. The tooltip says only "a chance" and no ' +
  'figure exists in the client data; the ruleset owner chose procs-per-minute ' +
  `and ${PLACEHOLDER_SEAL_OF_COMMAND_PPM} PPM is assumed and unverified. The ` +
  '70% of weapon damage is the source’s own.';

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
      return context.rng.nextFloat(0, 1) < ppmChance(speed, PLACEHOLDER_SEAL_OF_COMMAND_PPM);
    },
    onTrigger: (context, actor, attack) => {
      /*
       * "70% OF NORMAL WEAPON DAMAGE", taken from the swing that triggered it
       * rather than recomputed. `attack.amount` is what actually landed --
       * after crit, after armor -- which is the honest reading of "normal
       * weapon damage" for a proc that rides on a specific hit.
       */
      sealHit(
        context,
        actor,
        attack,
        'seal_of_command',
        'Seal of Command',
        attack.amount * SEAL_OF_COMMAND_WEAPON_FRACTION,
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
      sealHit(context, actor, attack, 'seal_of_fury', 'Seal of Fury', SEAL_OF_FURY_DAMAGE);
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
      const stats = actor.stats.effective;

      if (sealId === 'seal_of_righteousness') {
        sealHit(
          context,
          actor,
          attack,
          'twist_of_light',
          'Echo (Seal of Righteousness)',
          sealDamage(
            SEAL_OF_RIGHTEOUSNESS_BASE,
            baseSpeedSeconds(actor, attack),
            stats.attackPower,
            stats.spellPower,
          ),
        );
        return;
      }

      if (sealId === 'seal_of_fury') {
        sealHit(context, actor, attack, 'twist_of_light', 'Echo (Seal of Fury)', SEAL_OF_FURY_DAMAGE);
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
          attack.amount * SEAL_OF_COMMAND_WEAPON_FRACTION,
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
];
