import type { AttackEvent, AuraDefinition, Combatant, Reaction, WeaponSlot } from '../../engine';
import { dealDamage, flat, seconds } from '../../engine';
import { ITEMS_BY_ID } from './itemData';

/**
 * Procs per minute.
 *
 * A PPM effect fires with a chance proportional to the speed of the weapon that
 * triggered it:
 *
 *     chance = weapon speed in seconds / 60 * PPM
 *
 * A 2.6 second weapon at 1 PPM is a 4.33% chance per attack; a 2.5 second
 * weapon at 1.1 PPM is 4.58%. The point of the system is that a slow weapon and
 * a fast weapon proc the same number of times per minute, so an effect is not
 * quietly worth more on a dagger.
 *
 * Stated by the ruleset owner, along with the rate for each effect below. The
 * item tooltips give none of this -- they say "Chance on hit" and "often" --
 * which is why these sat unmodelled until now.
 */
export function ppmChance(weaponSpeedSeconds: number, ppm: number): number {
  return (weaponSpeedSeconds / 60) * ppm;
}

/**
 * The speed of the weapon that landed an attack.
 *
 * A proc belongs to the weapon it is ON, so the chance has to come from that
 * weapon's speed rather than from whichever hand happens to be faster. Returns
 * undefined when the attack came from no weapon at all, in which case a
 * weapon proc cannot fire.
 */
function triggeringSpeedSeconds(actor: Combatant, slot: WeaponSlot | undefined): number | undefined {
  if (!slot) return undefined;
  const weapon = actor.weapons[slot];
  if (!weapon) return undefined;
  return weapon.swingTimerMs / 1000;
}

/** Whether the attack that just landed could carry a weapon proc at all. */
function canProc(attack: AttackEvent): boolean {
  // An attack that never landed cannot proc, and a bleed tick is not an attack.
  return !attack.outcome || (attack.outcome !== 'miss' && attack.outcome !== 'dodge' && attack.outcome !== 'parry');
}

/**
 * Build a reaction that fires on a PPM roll from the weapon in one slot.
 *
 * `slot` is which weapon carries the effect. Only attacks made WITH that weapon
 * can trigger it, which is what makes an off-hand enchant an off-hand enchant.
 */
function weaponProc(options: {
  readonly id: string;
  readonly slot: WeaponSlot;
  readonly ppm: number;
  readonly onProc: (context: Parameters<Reaction['onTrigger']>[0], actor: Combatant, attack: AttackEvent) => void;
}): Reaction {
  return {
    id: options.id,
    on: 'dealt',
    // Every landed outcome, including glancing and critical blows.
    outcomes: ['hit', 'crit', 'glance', 'crush'],
    canTrigger: (context, actor, attack) => {
      if (!canProc(attack)) return false;
      if (attack.weaponSlot !== options.slot) return false;

      const speed = triggeringSpeedSeconds(actor, attack.weaponSlot);
      if (speed === undefined) return false;

      return context.rng.nextFloat(0, 1) < ppmChance(speed, options.ppm);
    },
    onTrigger: (context, actor, attack) => options.onProc(context, actor, attack),
  };
}

// ---------------------------------------------------------------------------
// Vis'kag the Bloodletter
// ---------------------------------------------------------------------------

/** Vis'kag's stated rate. */
export const VISKAG_PPM = 1;

/** "Delivers a fatal wound for 240 damage." */
export const VISKAG_DAMAGE = 240;

/**
 * Fatal Wound.
 *
 * Damage in its own right rather than added to the swing, so it shows as its
 * own line in the breakdown and can be seen to be worth what it is worth.
 *
 * It takes no attack table: the swing that triggered it already landed, and
 * rolling a second time would let a proc from a hit come out as a miss.
 */
function fatalWound(context: Parameters<Reaction['onTrigger']>[0], actor: Combatant, attack: AttackEvent) {
  dealDamage(context, {
    source: actor,
    target: attack.defender,
    abilityId: 'fatal_wound',
    abilityName: 'Fatal Wound',
    school: 'physical',
    baseAmount: VISKAG_DAMAGE,
    // Flat damage, and it is not a weapon swing, so no armor reduction applies
    // to it any differently than to any other physical hit.
  });
}

// ---------------------------------------------------------------------------
// Enchant Weapon - Crusader
// ---------------------------------------------------------------------------

/** Crusader's stated rate. */
export const CRUSADER_PPM = 1.1;

/** "increases Strength by 100 for 15 sec" */
export const CRUSADER_STRENGTH = 100;
export const CRUSADER_DURATION_MS = seconds(15);

/**
 * Holy Strength, ONE AURA PER HAND.
 *
 * ----------------------------------------------------------------------------
 * THE TWO HANDS STACK. This is a Forever rule given by the ruleset owner, and
 * it is not what this file assumed.
 *
 * Both hands used to share a single `holy_strength`, so the second to proc
 * refreshed the first and a dual-wielder enchanted on both weapons got one
 * hundred strength however often either hand fired. Forever gives each hand
 * its own effect, so both up at once is TWO HUNDRED strength.
 *
 * That is a real damage change and not a reporting one -- and it also answers
 * the uptime question, because there are now genuinely two buffs to chart
 * rather than one shared window that could not be attributed to a hand.
 *
 * Each still refreshes ITSELF rather than stacking: a second main-hand proc
 * while the main hand's buff is up resets its fifteen seconds, which is what
 * "capable of triggering again to refresh its duration" means. The stacking is
 * between hands, not within one.
 *
 * The heal is not modelled. Nothing damages the player by default, so healing
 * has nothing to restore, and the strength is the entire reason anyone uses
 * this.
 * ----------------------------------------------------------------------------
 */
function holyStrengthFor(slot: WeaponSlot): AuraDefinition {
  return {
    id: `holy_strength_${slot}`,
    name: slot === 'offHand' ? 'Holy Strength (Off Hand)' : 'Holy Strength (Main Hand)',
    durationMs: CRUSADER_DURATION_MS,
    refreshBehaviour: 'reset',
    statModifiers: [flat('strength', CRUSADER_STRENGTH)],
  };
}

export const HOLY_STRENGTH_MAIN_HAND = holyStrengthFor('mainHand');
export const HOLY_STRENGTH_OFF_HAND = holyStrengthFor('offHand');

/** Both, so a caller can look one up by the hand that procced it. */
export const HOLY_STRENGTH_BY_SLOT: Partial<Record<WeaponSlot, AuraDefinition>> = {
  mainHand: HOLY_STRENGTH_MAIN_HAND,
  offHand: HOLY_STRENGTH_OFF_HAND,
};

/**
 * Crusader can be on both hands at once, each rolling off its own weapon's
 * speed and each granting its own hundred strength.
 *
 * The aura is chosen by the hand that PROCCED, which is the attack's slot --
 * not by the reaction's configured slot, though `canTrigger` has already made
 * those the same. Reading it off the attack keeps the two from ever drifting.
 */
function crusaderProc(
  context: Parameters<Reaction['onTrigger']>[0],
  actor: Combatant,
  attack: AttackEvent,
) {
  const aura = attack.weaponSlot ? HOLY_STRENGTH_BY_SLOT[attack.weaponSlot] : undefined;
  if (!aura) return;
  context.applyAura(actor, aura, actor.id);
}

// ---------------------------------------------------------------------------
// Hand of Justice
// ---------------------------------------------------------------------------

/** "2% chance for any attack to trigger an extra attack." */
export const HAND_OF_JUSTICE_CHANCE = 0.02;

/**
 * The internal cooldown that stops an extra attack from proccing another.
 *
 * Without it the effect chains off itself: the extra swing is an attack, so it
 * rolls again, and a run of them is possible. 1.5 seconds is the stated window.
 */
export const HAND_OF_JUSTICE_ICD_MS = 1500;

/**
 * Hand of Justice.
 *
 * NOT a PPM effect -- a flat 2% on ANY attack, ability or swing, from either
 * hand. The internal cooldown is what keeps it bounded rather than the roll.
 */
export function handOfJusticeReaction(): Reaction {
  // The last time it fired, per combatant. Held in the closure rather than on
  // the combatant, because the reaction is built per character in
  // `reactionsForEquipment` and never shared between them.
  let lastProcAt: number | null = null;

  return {
    id: 'hand_of_justice',
    on: 'dealt',
    outcomes: ['hit', 'crit', 'glance', 'crush'],
    canTrigger: (context, _actor, attack) => {
      if (!canProc(attack)) return false;

      const now = context.clock.now();
      if (lastProcAt !== null && now - lastProcAt < HAND_OF_JUSTICE_ICD_MS) return false;

      return context.rng.nextFloat(0, 1) < HAND_OF_JUSTICE_CHANCE;
    },
    onTrigger: (context, actor) => {
      lastProcAt = context.clock.now();
      context.extraAttack(actor, 'mainHand');
    },
  };
}

// ---------------------------------------------------------------------------

/**
 * Every proc the equipped set brings, as reactions.
 *
 * Built per character rather than shared, because Hand of Justice keeps its own
 * cooldown and two warriors must not share one.
 */
export function reactionsForEquipment(
  equipment: Readonly<Record<string, { itemId: number; enchantId?: number } | undefined>>,
): readonly Reaction[] {
  const reactions: Reaction[] = [];

  const weaponSlots: readonly (readonly [string, WeaponSlot])[] = [
    ['mainHand', 'mainHand'],
    ['twoHand', 'mainHand'],
    ['offHand', 'offHand'],
  ];

  for (const [equipmentSlot, weaponSlot] of weaponSlots) {
    const equipped = equipment[equipmentSlot];
    if (!equipped) continue;

    const item = ITEMS_BY_ID.get(equipped.itemId);
    if (item?.id === 17075) {
      reactions.push(
        weaponProc({
          id: `viskag_${weaponSlot}`,
          slot: weaponSlot,
          ppm: VISKAG_PPM,
          onProc: fatalWound,
        }),
      );
    }

    if (equipped.enchantId === 20034) {
      reactions.push(
        weaponProc({
          id: `crusader_${weaponSlot}`,
          slot: weaponSlot,
          ppm: CRUSADER_PPM,
          onProc: crusaderProc,
        }),
      );
    }
  }

  for (const slot of ['trinket1', 'trinket2'] as const) {
    if (equipment[slot]?.itemId === 11815) reactions.push(handOfJusticeReaction());
  }

  return reactions;
}
