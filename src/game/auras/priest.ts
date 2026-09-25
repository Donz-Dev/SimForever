import type { AuraDefinition } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import { periodicTickCoefficient } from '../combat/spellCoefficient';

/**
 * Priest auras, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * THE NINTH AND LAST CLASS. One profile, Shadow, and it is the only build in
 * the project whose damage is almost entirely periodic and channelled at once
 * -- two effects ticking while a third channel runs.
 *
 * SHADOWFORM IS THE CAPSTONE AND IT DOES FOUR THINGS, three of which land in
 * different places: the damage and the mana go on the aura, the crit damage
 * goes on the talent as a school modifier, and the physical mitigation does
 * nothing because nothing attacks this profile. See `SHADOWFORM` below.
 * ----------------------------------------------------------------------------
 */

const SHADOW = 'shadow' as const;

/** One tick of a Shadow damage-over-time effect. */
function tick(
  context: Parameters<NonNullable<AuraDefinition['periodic']>['onTick']>[0],
  aura: Parameters<NonNullable<AuraDefinition['periodic']>['onTick']>[1],
  amount: number,
  powerCoefficient: number,
): void {
  const source = context.combatant(aura.sourceId);
  const target = context.combatant(aura.targetId);
  if (!source || !target || !target.isAlive) return;

  dealDamage(context, {
    source,
    target,
    abilityId: aura.id,
    abilityName: aura.name,
    school: SHADOW,
    baseAmount: amount,
    // Per TICK. Both of the Priest's DoTs are PURE -- their casts deal no
    // damage of their own -- so each takes the whole periodic coefficient
    // rather than a share of a hybrid pair.
    powerCoefficient,
    periodic: true,
    critFrom: 'spell',
    appliesArmor: false,
  });
}

/**
 * Shadow Word: Pain: "762 Shadow damage over 18 sec".
 *
 * IMPROVED SHADOW WORD: PAIN LENGTHENS IT AND THAT IS WORTH REAL DAMAGE. The
 * talent adds six seconds at 2/2, and the tooltip's total is for the BASE
 * eighteen -- so the extra two ticks are extra damage rather than the same
 * total spread thinner. Expressed by building the aura from its duration,
 * which is the only reading that makes a duration talent worth taking.
 */
export const SHADOW_WORD_PAIN_TOTAL = 762;
export const SHADOW_WORD_PAIN_DURATION_MS = seconds(18);
export const SHADOW_WORD_PAIN_TICK_INTERVAL_MS = seconds(3);

/**
 * Per tick, from the BASE eighteen seconds and its six ticks.
 *
 * Improved Shadow Word: Pain adds two more ticks at the same cadence, and they
 * carry this same coefficient -- so the talent scales with gear exactly as the
 * ticks it is adding to do. It comes to the tick interval over 15, which means
 * base and talented give the same answer; see `periodicTickCoefficient`.
 */
export const SHADOW_WORD_PAIN_TICK_COEFFICIENT = periodicTickCoefficient(
  SHADOW_WORD_PAIN_DURATION_MS,
  SHADOW_WORD_PAIN_DURATION_MS / SHADOW_WORD_PAIN_TICK_INTERVAL_MS,
);

export function shadowWordPainAura(extraSeconds = 0): AuraDefinition {
  const duration = SHADOW_WORD_PAIN_DURATION_MS + seconds(extraSeconds);
  const perTick =
    SHADOW_WORD_PAIN_TOTAL /
    (SHADOW_WORD_PAIN_DURATION_MS / SHADOW_WORD_PAIN_TICK_INTERVAL_MS);

  return {
    id: 'shadow_word_pain',
    name: 'Shadow Word: Pain',
    durationMs: duration,
    isDebuff: true,
    refreshBehaviour: 'reset',
    periodic: {
      intervalMs: SHADOW_WORD_PAIN_TICK_INTERVAL_MS,
      onTick: (context, aura) =>
        tick(context, aura, perTick, SHADOW_WORD_PAIN_TICK_COEFFICIENT),
    },
  };
}

/** Devouring Plague: "848 Shadow damage over 24 sec". Eight ticks of 106. */
export const DEVOURING_PLAGUE_TOTAL = 848;
export const DEVOURING_PLAGUE_DURATION_MS = seconds(24);
export const DEVOURING_PLAGUE_TICK_INTERVAL_MS = seconds(3);

/** A pure DoT, 24 seconds in eight ticks: 1.6 in total. */
export const DEVOURING_PLAGUE_TICK_COEFFICIENT = periodicTickCoefficient(
  DEVOURING_PLAGUE_DURATION_MS,
  DEVOURING_PLAGUE_DURATION_MS / DEVOURING_PLAGUE_TICK_INTERVAL_MS,
);

export const DEVOURING_PLAGUE: AuraDefinition = {
  id: 'devouring_plague',
  name: 'Devouring Plague',
  durationMs: DEVOURING_PLAGUE_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: DEVOURING_PLAGUE_TICK_INTERVAL_MS,
    onTick: (context, aura) =>
      tick(
        context,
        aura,
        DEVOURING_PLAGUE_TOTAL /
          (DEVOURING_PLAGUE_DURATION_MS / DEVOURING_PLAGUE_TICK_INTERVAL_MS),
        DEVOURING_PLAGUE_TICK_COEFFICIENT,
      ),
  },
};

/**
 * Shadow Weaving: "Your Shadow damage spells have a {0}% chance to increase
 * THE SHADOW DAMAGE YOU DEAL by 2% for 15 sec, stacking up to 5 times."
 *
 * ON THE CASTER, NOT ON THE TARGET, and that is a Forever change worth
 * noticing -- Classic's Shadow Weaving is a debuff every shadow priest in the
 * raid shares. Here it is a personal buff, so it is worth the same in a raid
 * of one as in a raid of five and there is nobody to collide with.
 *
 * At 3/3 the chance is 100%, so five stacks arrive almost immediately and stay.
 */
export const SHADOW_WEAVING_MAX_STACKS = 5;
export const SHADOW_WEAVING_DURATION_MS = seconds(15);

export function shadowWeavingAura(percentPerStack: number): AuraDefinition {
  return {
    id: 'shadow_weaving',
    name: 'Shadow Weaving',
    durationMs: SHADOW_WEAVING_DURATION_MS,
    maxStacks: SHADOW_WEAVING_MAX_STACKS,
    refreshBehaviour: 'reset',
    modifiersScaleWithStacks: true,
    // A whole-character multiplier, for the reason every stacking damage buff
    // in this project uses one: `SchoolModifiers` is built once when the
    // character is and cannot come and go. A Shadow priest deals almost
    // nothing but Shadow, so the two readings agree for this build.
    damageDoneMultiplier: 1 + percentPerStack / 100,
  };
}

/**
 * Shadowform, the Shadow capstone.
 *
 * ----------------------------------------------------------------------------
 * "Increasing your Shadow damage by 10%, reducing the Mana cost of all Shadow
 * spells by 50%, increasing the critical strike damage bonus of your Shadow
 * spells by 100%, and reducing Physical damage taken by you by 15%."
 *
 * FOUR CLAUSES AND THEY LAND IN THREE PLACES:
 *
 *   damage          here, as a whole-character multiplier
 *   mana            here, as a `castModifier` naming every Shadow spell --
 *                   which is the FIRST time a percentage mana reduction has
 *                   been expressible in this project. `costFraction` is a
 *                   fraction of the cost, which is exactly what a percentage
 *                   reduction is; `abilityCost` subtracts a flat amount and
 *                   is why so many talents in other classes say "unmodelled".
 *   crit damage     on the TALENT, as `schoolCritDamage` -- an aura cannot
 *                   carry a school modifier
 *   physical taken  nowhere, because nothing attacks this profile
 *
 * NOT CONSUMED BY THE CAST. There is no `consumedByCast`, so the discount
 * applies to every Shadow spell for as long as the form is up -- which is the
 * whole fight. Hot Streak is the other modifier in the project shaped this
 * way.
 * ----------------------------------------------------------------------------
 */
export const SHADOWFORM_DAMAGE = 1.1;
export const SHADOWFORM_MANA_REDUCTION = 0.5;

/** Every Shadow spell the form discounts. Listed, because the modifier is by id. */
export const SHADOW_SPELLS = [
  'mind_blast',
  'shadow_word_pain',
  'mind_flay',
  'devouring_plague',
  'shadow_word_death',
  'vampiric_embrace',
] as const;

export const SHADOWFORM: AuraDefinition = {
  id: 'shadowform',
  name: 'Shadowform',
  durationMs: 0,
  damageDoneMultiplier: SHADOWFORM_DAMAGE,
  castModifier: {
    abilityIds: [...SHADOW_SPELLS],
    costFraction: SHADOWFORM_MANA_REDUCTION,
  },
};

export const SHADOWFORM_UNMODELLED =
  'Its Shadow damage and its 50% Shadow mana reduction both apply, and so does ' +
  'its crit damage bonus. Its "reducing Physical damage taken by 15%" does ' +
  'nothing, because nothing attacks this profile. The damage bonus is applied ' +
  'to every school rather than only to Shadow -- a multiplier that comes and ' +
  'goes cannot be per-school -- which is exact for a build that casts almost ' +
  'nothing else.';

/**
 * Vampiric Embrace: "causes all party members to be healed for 20% of any
 * Shadow spell damage you deal for 30 sec."
 *
 * TRACKED AND HEALING NOBODY. The engine simulates one character and nothing
 * attacks this profile, so a party heal has no one to reach and no damage to
 * undo. Applied so the talent is not silent and its uptime is visible, which
 * is the same decision Eclipse carried before its rule arrived.
 */
export const VAMPIRIC_EMBRACE_DURATION_MS = seconds(30);
export const VAMPIRIC_EMBRACE_HEAL_SHARE = 0.2;

export const VAMPIRIC_EMBRACE_UNMODELLED =
  'It heals the PARTY for a share of Shadow damage dealt. The engine ' +
  'simulates one character and nothing attacks this profile, so there is ' +
  'nobody to heal and nothing to heal from. Tracked so it is visible.';

export const VAMPIRIC_EMBRACE: AuraDefinition = {
  id: 'vampiric_embrace',
  name: 'Vampiric Embrace',
  durationMs: VAMPIRIC_EMBRACE_DURATION_MS,
  isDebuff: true,
  refreshBehaviour: 'reset',
};
