import type { AttackEvent, Combatant, Reaction, WeaponSlot } from '../../engine';
import { dealDamage, isWeaponUseOf } from '../../engine';
import { deadlyPoisonAura } from '../auras/rogue';
import { INSTANT_POISON_AP_COEFFICIENT } from '../combat/coefficients';
import type { TalentAllocation } from '../talents/Talent';
import { talentNumber } from '../talents/talentValues';

/*
 * ============================================================================
 * POISONS: a coating on a weapon that rolls on every use of THAT weapon.
 *
 * ----------------------------------------------------------------------------
 * A POISON PROC IS NOT A WEAPON USE, BUT IS TRIGGERED BY ONE. The ruleset
 * owner's ruling, and the two halves are separate mechanisms:
 *
 *   TRIGGERED BY   `isWeaponUseOf(attack, slot)` -- an auto-attack swing, a
 *                  Windfury extra attack, or an ability that needed that
 *                  weapon, Mutilate included. Exactly the predicate the weapon
 *                  ENCHANTS already use, so a poison and a Crusader fire off
 *                  the same set of events.
 *   NOT A USE      every poison hit below is dealt with NO `weaponSlot`, which
 *                  is the whole of `isWeaponUse`. So a poison cannot proc a
 *                  second poison, cannot trigger Crusader, and cannot feed
 *                  Hand of Justice. Identical to how seal damage is kept out.
 *
 * Getting that backwards would not look wrong: poisons chaining off poisons
 * produces a bigger number and no error, which is the failure mode this
 * project keeps meeting.
 *
 * ----------------------------------------------------------------------------
 * A FLAT CHANCE PER STRIKE, NOT PROCS PER MINUTE. Every other weapon proc here
 * is normalised by weapon speed so that a fast weapon and a slow one proc
 * alike; a poison is stated as "each strike has a 20% chance", which is the
 * opposite -- a fast off hand really does poison more often. The two live side
 * by side and must not be made to match.
 *
 * ----------------------------------------------------------------------------
 * CHARGES ARE NOT MODELLED, on the owner's instruction: treat them as
 * infinite. The tooltips state 175 and 180, and a sixty-second fight at
 * roughly 1.5 swings a second is about 90 strikes, so they could never bind
 * here even if they were counted.
 * ============================================================================
 */

/** The poisons that deal damage. The other three are crowd control. */
export type PoisonId = 'instant_poison' | 'deadly_poison';

/** Which poison coats which weapon. */
export interface PoisonLoadout {
  readonly mainHand: PoisonId;
  readonly offHand: PoisonId;
}

/**
 * The default, on the ruleset owner's instruction: Instant on the main hand,
 * Deadly on the off hand.
 *
 * A player may swap them, which is why this is a PROFILE field with a control
 * beside the weapon enchants rather than a constant. The default is the
 * conventional pairing and not a claim that it is optimal.
 */
export const DEFAULT_POISON_LOADOUT: PoisonLoadout = {
  mainHand: 'instant_poison',
  offHand: 'deadly_poison',
};

export const POISON_NAMES: Readonly<Record<PoisonId, string>> = {
  instant_poison: 'Instant Poison',
  deadly_poison: 'Deadly Poison',
};

/** "Each strike has a 20% chance ... 76 to 100 Nature damage." Rank 6. */
export const INSTANT_POISON_CHANCE = 0.2;
export const INSTANT_POISON_DAMAGE = (76 + 100) / 2;

/** "Each strike has a 30% chance ..." Rank 5. */
export const DEADLY_POISON_CHANCE = 0.3;

export const POISON_CHANCES: Readonly<Record<PoisonId, number>> = {
  instant_poison: INSTANT_POISON_CHANCE,
  deadly_poison: DEADLY_POISON_CHANCE,
};

/**
 * What the two poison talents are worth, as plain multipliers and points.
 *
 * Read from the allocation here rather than registered as talent effects,
 * because a Rogue who spent no points still applies poisons -- the same
 * argument that keeps Windfury Weapon a CLASS reaction reading one talent
 * number rather than a talent-granted proc.
 */
export function poisonTalentBonuses(talents: TalentAllocation | undefined): {
  readonly damageMultiplier: number;
  readonly extraChance: number;
} {
  // Vile Poisons: "Increases the damage dealt by your poisons by 20%" at 5/5.
  // Its second clause resists DISPELS, which nothing here does.
  const damagePercent = talentNumber('rogue', 'vile_poisons', talents?.vile_poisons ?? 0) ?? 0;
  /*
   * Improved Poisons: "+10% chance to apply" at 5/5. Its second clause is a
   * 50% chance not to consume a CHARGE, and charges are infinite here by the
   * owner's instruction -- so that half is inert for a stated reason rather
   * than forgotten.
   */
  const chancePercent =
    talentNumber('rogue', 'improved_poisons', talents?.improved_poisons ?? 0) ?? 0;
  return {
    damageMultiplier: 1 + damagePercent / 100,
    /*
     * ADDED TO THE CHANCE IN PERCENTAGE POINTS, not multiplied by it: "increases
     * the chance to APPLY poisons by 10%" takes Instant Poison from 20% to 30%,
     * not to 22%. Both readings are plausible and one is half the value of the
     * other, so it is stated here rather than left to the call site.
     */
    extraChance: chancePercent / 100,
  };
}

/** Instant Poison's hit: flat Nature damage, plus the sheet's 0.5% of attack power. */
function instantPoisonHit(
  context: Parameters<Reaction['onTrigger']>[0],
  actor: Combatant,
  attack: AttackEvent,
  damageMultiplier: number,
): void {
  dealDamage(context, {
    source: actor,
    target: attack.defender,
    abilityId: 'instant_poison',
    abilityName: 'Instant Poison',
    school: 'nature',
    baseAmount: INSTANT_POISON_DAMAGE * damageMultiplier,
    powerCoefficient: INSTANT_POISON_AP_COEFFICIENT,
    /*
     * NO `weaponSlot` AND NO `attackTable`. The strike that carried it already
     * rolled the table, so rolling again would give the poison its own chance
     * to miss on top of the swing's -- and the missing slot is what stops it
     * counting as a weapon use.
     */
    critFrom: 'melee-special',
  });
}

/**
 * The proc for one poison on one hand.
 *
 * Built per character and per slot, because the chance depends on talents and
 * the poison depends on the loadout -- and because a reaction built once at
 * module load would share state across a Monte Carlo batch, which is how
 * Windfury silently stopped proccing after the first iteration.
 */
function poisonProc(slot: WeaponSlot, poison: PoisonId, talents: TalentAllocation | undefined): Reaction {
  const { damageMultiplier, extraChance } = poisonTalentBonuses(talents);
  const chance = POISON_CHANCES[poison] + extraChance;

  return {
    id: `${poison}_${slot}`,
    on: 'dealt',
    // Every landed outcome, as the weapon enchants take.
    outcomes: ['hit', 'crit', 'glance', 'crush'],
    canTrigger: (context, _actor, attack) => {
      // A use of THIS weapon: its swing, a Windfury extra attack with it, or
      // an ability that needed it.
      if (!isWeaponUseOf(attack, slot)) return false;
      return context.rng.nextFloat(0, 1) < chance;
    },
    onTrigger: (context, actor, attack) => {
      if (poison === 'instant_poison') {
        instantPoisonHit(context, actor, attack, damageMultiplier);
        return;
      }
      /*
       * Deadly Poison APPLIES rather than hits. Applying it again adds a stack
       * and resets the duration, which `maxStacks` and `refreshBehaviour`
       * between them already do -- so a sixth application on a full stack
       * refreshes and does not overflow.
       */
      context.applyAura(attack.defender, deadlyPoisonAura(damageMultiplier), actor.id);
    },
  };
}

/**
 * Every poison proc a Rogue carries: one per hand.
 *
 * A one-handed Rogue has no off hand, and `isWeaponUseOf` simply never matches
 * for it -- so the reaction is harmless rather than needing a guard here.
 */
export function poisonReactions(
  loadout: PoisonLoadout,
  talents: TalentAllocation | undefined,
): readonly Reaction[] {
  return [
    poisonProc('mainHand', loadout.mainHand, talents),
    poisonProc('offHand', loadout.offHand, talents),
  ];
}
