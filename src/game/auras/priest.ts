import type { AuraDefinition, AuraInstance, Combatant, SimulationContext } from '../../engine';
import { percent, ALL_ABILITIES, applyHealing, dealDamage, seconds } from '../../engine';
import { RENEW_TICK_HEAL_COEFFICIENT } from '../combat/coefficients';
import {
  DEVOURING_PLAGUE_TICK_SP_COEFFICIENT,
  SHADOW_WORD_PAIN_TICK_SP_COEFFICIENT,
} from '../combat/coefficients';

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
export const SHADOW_WORD_PAIN_TICK_COEFFICIENT = SHADOW_WORD_PAIN_TICK_SP_COEFFICIENT;

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
export const DEVOURING_PLAGUE_TICK_COEFFICIENT = DEVOURING_PLAGUE_TICK_SP_COEFFICIENT;

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
/**
 * Dark Inspiration: Spirit, from a Mind Blast or a COMPLETED Mind Flay.
 *
 * ==============================================================================
 * "Your Mind Blast and fully channeled Mind Flay causes Dark Inspiration,
 * increasing yours and your party's Spirit by {0}% for 10 sec." New at client
 * build 1.60.1.70425, replacing Shadow Affinity.
 *
 * SPIRIT IS A REAL STAT HERE and this is a mana-return talent rather than a
 * dead one: `manaPer5` is `spirit * manaPer5PerSpirit`, so the percentage
 * reaches the regeneration rule. What it is WORTH is another matter -- the five
 * second rule suppresses most regeneration on a caster that is casting, so the
 * honest expectation is small and the measurement decides.
 *
 * "YOURS AND YOUR PARTY'S" IS ONE CHARACTER HERE, as every party clause in this
 * project is. Recorded rather than silently narrowed.
 *
 * ------------------------------------------------------------------------------
 * "FULLY CHANNELED" IS `AbilityCastEvent.final`, WHICH IS EXACTLY THE WORD.
 * A cast reaction fires once per channel TICK, and `final` marks the last one
 * -- so a Mind Flay that is interrupted never reaches it and never grants this.
 *
 * THAT COUPLES IT TO THE INTERRUPT RULING, which is worth knowing before
 * reading either: the owner asked that an interrupt preserve Mind Flay's first
 * two ticks and take only the third. The third tick IS the final one, so an
 * interrupted channel still loses this buff -- the two rulings arrived days
 * apart and meet here.
 * ==============================================================================
 */
export const DARK_INSPIRATION_DURATION_MS = seconds(10);

export function darkInspirationAura(percentIncrease: number): AuraDefinition {
  return {
    id: 'dark_inspiration',
    name: 'Dark Inspiration',
    durationMs: DARK_INSPIRATION_DURATION_MS,
    refreshBehaviour: 'reset',
    statModifiers: [percent('spirit', percentIncrease / 100)],
  };
}

export const SHADOW_WEAVING_MAX_STACKS = 5;
export const SHADOW_WEAVING_DURATION_MS = seconds(15);

export function shadowWeavingAura(percentPerStack: number): AuraDefinition {
  return {
    id: 'shadow_weaving',
    name: 'Shadow Weaving',
    durationMs: SHADOW_WEAVING_DURATION_MS,
    maxStacks: SHADOW_WEAVING_MAX_STACKS,
    /*
     * DECLARED, BECAUSE THE ENGINE CANNOT INFER IT FROM WHO HOLDS THE AURA.
     * `AuraInstance.isDebuff` reads the DEFINITION, so moving this onto the
     * target without saying so left it off both reporting tables -- the buff
     * table reads friendly actors and the debuff table filters on this flag, so
     * an unflagged enemy aura is in neither. It applied, it multiplied the
     * damage, and it reported NOTHING: the inert-buff-with-visible-uptime shape
     * with the uptime missing instead.
     */
    isDebuff: true,
    refreshBehaviour: 'reset',
    modifiersScaleWithStacks: true,
    /*
     * ========================================================================
     * A DEBUFF ON THE TARGET NOW, BY THE OWNER'S RULING: "Shadow Weaving is now
     * a debuff, where the target takes more shadow damage from me."
     *
     * IT WAS A WHOLE-CHARACTER `damageDoneMultiplier` ON THE CASTER, with a
     * caveat admitting the reach -- "a Shadow priest deals almost nothing but
     * Shadow, so the two readings agree for this build." **That caveat is
     * exactly the shape this project has been caught by twice**, on Demonic
     * Sacrifice and Shadow and Flame: a claim about a PROFILE rather than about
     * the effect, which silently becomes false for the next build. The client
     * has since restated the talent -- "the Shadow damage the target takes from
     * you" where it said "the Shadow damage you deal" -- and the owner ruled it.
     *
     * `damageTakenBySchool` IS THE FIELD, which is Fire Vulnerability's
     * arrangement one file over: the same stacking, the same `1 + pct / 100`,
     * read on the DEFENDER through `damageTakenFor`. So the whole change is
     * which side of the attack holds it.
     *
     * ------------------------------------------------------------------------
     * "FROM ME" IS NOT EXPRESSIBLE AND IS INERT, which is worth saying rather
     * than leaving as a silent approximation. A debuff here is carried by the
     * target and raises that school for EVERY attacker; scoping it to one
     * caster would need a per-source debuff the engine does not have. With a
     * single player in every encounter the two readings cannot differ, and the
     * day a second Shadow caster exists they would.
     *
     * AND THE STACKING COMPOUNDS, WHICH IS UNCHANGED RATHER THAN CHOSEN.
     * `scaleByStacks` raises a damage multiplier to the POWER of the count, so
     * five stacks of 2% are 1.02^5 = 1.1041 and not 1.10 -- the same arithmetic
     * the caster-side version already produced, so moving sides moves no
     * figure by itself.
     * ========================================================================
     */
    damageTakenBySchool: { shadow: 1 + percentPerStack / 100 },
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

/**
 * Inner Focus: "reduces the Mana cost of your next spell by 100% and increases
 * its critical effect chance by 25% if it is capable of a critical effect."
 *
 * ----------------------------------------------------------------------------
 * TWO CLAUSES ON ONE AURA, AND THE ORDER THEY ARE SPENT IN IS THE WHOLE
 * PROBLEM. Its reason used to say the crit half was "a one-shot per-ability
 * crit modifier, which nothing carries", and that was right about
 * `CastModifier` and wrong about the project: FINGERS OF FROST IS ALREADY THIS
 * SHAPE. An aura that changes what the DAMAGE sees, whose charge is spent by a
 * CAST, with the spend as a cast reaction rather than as `consumedByCast`.
 *
 * `consumedByCast` WOULD NOT HAVE WORKED, and the failure is silent.
 * `consumeCastCharges` runs at cast START -- before `runCast`, and 1.5 seconds
 * before a Mind Blast lands -- so the aura would be gone by the time anything
 * rolled a crit. The cost would be right, the crit would be nothing, and the
 * talent would read as fully modelled. So the cost rides a `castModifier` with
 * no `consumedByCast` at all and `innerFocusSpender` removes the aura after
 * the cast, which is the order Fingers of Frost already relies on:
 * `runCast` runs `onCast` BEFORE the cast reactions.
 *
 * THE COST REACHES EVERY SPELL AND THE CRIT REACHES THREE, which is the
 * tooltip's own "if it is capable of a critical effect". Shadow Word: Pain and
 * Devouring Plague apply auras and roll no table, so they get the free cast
 * and no crit -- and leaving them out of `abilityModifiers` is also what stops
 * a TICK of one of them collecting 25% during the window, since a periodic
 * tick carries its aura's id.
 * ----------------------------------------------------------------------------
 */
export const INNER_FOCUS_CRIT_BONUS = 25;
/**
 * A minute, as a backstop only.
 *
 * FOREVER STATES NO DURATION -- the capture says "Instant, 3 min cooldown" and
 * the tooltip says "your next spell", which is a charge and not a clock. This
 * is not a `PLACEHOLDER_` because no figure is being invented for it to stand
 * in for: the aura is spent by the next cast, and a priest who casts nothing
 * for a minute does not exist in any fight here. It exists because an aura
 * with no duration never expires and would sit on the character for the whole
 * fight if the spender ever failed to fire.
 */
export const INNER_FOCUS_DURATION_MS = seconds(60);

/**
 * The spells a crit can happen to. The two damage-over-time casts cannot, and
 * nor can Renew, Power Word: Shield or Prayer of Mending, whose heal lands
 * later than the charge is spent. The non-periodic heals joined in round 73,
 * for the Disc Priest's "Inner Focus (use on Penance)".
 */
export const INNER_FOCUS_CRITTABLE = [
  'mind_blast',
  'mind_flay',
  'shadow_word_death',
  'flash_heal',
  'greater_heal',
  'binding_heal',
  'prayer_of_healing',
  'penance',
] as const;

/** The Priest's heals (round 73), which Inner Focus also makes free. */
export const PRIEST_HEALS = [
  'flash_heal',
  'greater_heal',
  'binding_heal',
  'prayer_of_healing',
  'renew',
  'power_word_shield',
  'prayer_of_mending',
  'penance',
] as const;

export const INNER_FOCUS: AuraDefinition = {
  id: 'inner_focus',
  name: 'Inner Focus',
  durationMs: INNER_FOCUS_DURATION_MS,
  refreshBehaviour: 'reset',
  castModifier: {
    // Every spell, because "your next spell" is every spell. The list is the
    // Priest's own book, for the reason `CastModifier` says: it selects by id.
    abilityIds: [...SHADOW_SPELLS, 'shadowform', ...PRIEST_HEALS],
    costFraction: 1,
  },
  abilityModifiers: Object.fromEntries(
    INNER_FOCUS_CRITTABLE.map((id) => [id, { critBonus: INNER_FOCUS_CRIT_BONUS }]),
  ),
};

/**
 * Power Infusion: "increasing their spell damage and healing done by 20% for
 * 15 sec."
 *
 * ----------------------------------------------------------------------------
 * ON A TARGET, WHICH FOR ONE CHARACTER IS ITSELF -- the encounter simulates one
 * player, so the only friendly target a Priest has is the Priest. That is what
 * its old reason meant by "expressible", and it is the whole of why this was
 * written down rather than built.
 *
 * IT USES `abilityModifiers` RATHER THAN `damageDoneMultiplier`, which is the
 * one decision here. A whole-character multiplier would also raise PHYSICAL
 * damage, and "spell damage" does not. `ALL_ABILITIES` on an aura reaches every
 * ability and no auto attack -- and since a Priest owns no physical ability,
 * "every ability a Priest has" and "every spell a Priest casts" are the same
 * set. Exact here, and it would not be on a hybrid, which is why the
 * restriction is stated rather than assumed.
 *
 * ITS TICKS COUNT, correctly: a periodic tick carries its aura's id and `pick`
 * folds in the catch-all, so a Shadow Word: Pain ticking inside the fifteen
 * seconds is spell damage and is raised.
 * ----------------------------------------------------------------------------
 */
export const POWER_INFUSION_DURATION_MS = seconds(15);
export const POWER_INFUSION_DAMAGE = 1.2;

export const POWER_INFUSION: AuraDefinition = {
  id: 'power_infusion',
  name: 'Power Infusion',
  durationMs: POWER_INFUSION_DURATION_MS,
  refreshBehaviour: 'reset',
  abilityModifiers: { [ALL_ABILITIES]: { damageMultiplier: POWER_INFUSION_DAMAGE } },
};

export const POWER_INFUSION_UNMODELLED =
  'Its 20% spell damage applies. Its "and healing done" does not, because ' +
  'nothing in this project measures healing. It is cast on the Priest ' +
  'itself, which is the only friendly target a one-character encounter has -- ' +
  'the buff is real and the CHOICE of who to put it on is what is missing.';

/*
 * ----------------------------------------------------------------------------
 * THE AURAS THIS MODULE BUILDS WITH A FACTORY, LISTED SO THE PANEL CAN OFFER
 * THEM.
 *
 * `auraCatalog` finds an aura by walking a module's exports and keeping
 * whatever looks like an `AuraDefinition`. That finds every aura declared as a
 * constant and NONE built by a function -- which silently cost the dropdowns 20
 * auras across nine classes, Rip and Deep Wounds and Ignite among them. Rip is
 * how it was noticed: a Druid could not gate Rip on Rip already being up, which
 * is the single most ordinary thing a feral rotation does.
 *
 * THE ARGUMENT IS REPRESENTATIVE AND ONLY THE ID, NAME AND `isDebuff` ARE READ,
 * none of which depends on it. It lives here rather than in the catalog because
 * what a sensible argument IS belongs next to the factory -- the catalog would
 * otherwise be guessing, and a factory that gained a required argument would
 * break it from a distance.
 * ----------------------------------------------------------------------------
 */

/* -------------------------------------------------------------------------- */
/* The healers (round 73): the Holy and Disc Priest profiles' auras           */
/* -------------------------------------------------------------------------- */

/**
 * Renew, rank 10: "Heals the target of 830 damage over 15 sec." Five ticks,
 * one every three seconds, of a fifth each and 20% of healing power. A tick
 * carries the ability's id, so Improved Renew, Spiritual Healing and Holy
 * Specialization reach it, and it can crit.
 */
export const RENEW_TOTAL = 830;
export const RENEW_DURATION_MS = seconds(15);
export const RENEW_TICK_INTERVAL_MS = seconds(3);
export const RENEW_TICK = RENEW_TOTAL / (RENEW_DURATION_MS / RENEW_TICK_INTERVAL_MS);

export const RENEW_HOT: AuraDefinition = {
  id: 'renew',
  name: 'Renew',
  durationMs: RENEW_DURATION_MS,
  refreshBehaviour: 'reset',
  periodic: {
    intervalMs: RENEW_TICK_INTERVAL_MS,
    onTick: (context, aura) => {
      const source = context.combatant(aura.sourceId);
      const target = context.combatant(aura.targetId);
      if (!source || !target || !target.isAlive) return;
      applyHealing(context, {
        source,
        target,
        abilityId: aura.id,
        abilityName: aura.name,
        baseAmount: RENEW_TICK,
        powerCoefficient: RENEW_TICK_HEAL_COEFFICIENT,
        periodic: true,
        threatens: true,
      });
    },
  },
};

/**
 * Weakened Soul: "Once shielded, the target cannot be shielded again for 15
 * sec." On the person shielded, from the Priest that shielded them.
 *
 * RENEWED HOPE RIDES ON IT, and that is why it can be built two ways: "your
 * heals from Flash Heal, Binding Heal, ... Greater Heal, and Penance gain 10%
 * increased critical strike chance when cast on targets with Weakened Soul" is
 * a crit the TARGET carries, the shape Winter's Chill already has -- so a
 * Priest with the talent puts on a Weakened Soul carrying it.
 */
export const WEAKENED_SOUL_DURATION_MS = seconds(15);
export const RENEWED_HOPE_HEALS = ['flash_heal', 'binding_heal', 'greater_heal', 'penance'] as const;

export const WEAKENED_SOUL: AuraDefinition = {
  id: 'weakened_soul',
  name: 'Weakened Soul',
  durationMs: WEAKENED_SOUL_DURATION_MS,
  isDebuff: true,
};

/** Weakened Soul carrying Renewed Hope's crit, for a Priest with the talent. */
export function weakenedSoulAura(renewedHopeCrit: number): AuraDefinition {
  if (renewedHopeCrit <= 0) return WEAKENED_SOUL;
  return {
    ...WEAKENED_SOUL,
    attackerAbilityModifiers: Object.fromEntries(
      RENEWED_HOPE_HEALS.map((id) => [id, { critBonus: renewedHopeCrit }]),
    ),
  };
}

/**
 * Power Word: Shield's absorb: "absorbing 928 damage. Lasts 30 sec." -- plus
 * 10% of healing power, the owner's, sized when it is cast. ABSORBED DAMAGE IS
 * THE PRIEST'S HEALING, the owner's, which is `absorbCountsAsHealing`.
 */
export const POWER_WORD_SHIELD_DURATION_MS = seconds(30);

export function powerWordShieldAura(amount: number): AuraDefinition {
  return {
    id: 'power_word_shield',
    name: 'Power Word: Shield',
    durationMs: POWER_WORD_SHIELD_DURATION_MS,
    refreshBehaviour: 'reset',
    absorb: () => amount,
    absorbCountsAsHealing: true,
  };
}

/**
 * Divine Aegis: "Your non-periodic critical heals create a protective shield on
 * the target, absorbing 15% of the amount healed. Shields up to 1,200 damage
 * and lasts 12 sec."
 *
 * IT ADDS UP, the owner's: "This adds up, rather than the effect refreshing when
 * a new crit occurs." So a new crit tops the shield up -- what is left plus the
 * new 15%, never past 1,200 -- and restarts its twelve seconds. Absorbed damage
 * is the Priest's healing, as Power Word: Shield's is.
 *
 * THE CAP AND THE DURATION ARE WRITTEN HERE, because the values file reads the
 * tooltip's "1,200" as two numbers, 1 and 200, at indices 1 and 2.
 */
export const DIVINE_AEGIS_CAP = 1200;
export const DIVINE_AEGIS_DURATION_MS = seconds(12);

export function divineAegisAura(amount: number): AuraDefinition {
  return {
    id: 'divine_aegis',
    name: 'Divine Aegis',
    durationMs: DIVINE_AEGIS_DURATION_MS,
    refreshBehaviour: 'reset',
    absorb: () => amount,
    absorbCountsAsHealing: true,
  };
}

/**
 * Inspiration: "Your non-periodic critical heals increase your target's Armor
 * by 25% for 15 sec." TRACKED AS AN UPTIME ONLY, as the Shaman's Ancestral
 * Healing is, by the owner's instruction for that talent: the healer fights'
 * tank has a STATED armor reduction, which an armor stat would quietly change.
 */
export const INSPIRATION: AuraDefinition = {
  id: 'inspiration',
  name: 'Inspiration',
  durationMs: seconds(15),
  refreshBehaviour: 'reset',
};

/**
 * Prayer of Mending, rank 3: "Places a spell on the target that heals them for
 * 413 the next time they take damage ... When the heal occurs, Prayer of
 * Mending jumps to a party or raid member within 20 yds. Jumps up to 5 times
 * and lasts 30 sec after each jump."
 *
 * ============================================================================
 * THE OWNER'S: cast on the tank, and "when they take damage it jumps again. 5
 * total jumps / 6 total heals". So each charge heals its carrier for 413 plus
 * 42.9% of healing power the first time the carrier is hit -- `onCarrierDamaged`
 * -- and then moves to ANOTHER raid member chosen at random, until six heals
 * have been made or nobody is left to jump to.
 *
 * ONE PER CASTER, and the count travels with it: each cast builds its own
 * definition around its own count, so a recast starts a fresh six.
 *
 * "OR RECEIVE NON-PERIODIC HEALING" IS NOT MODELLED: the owner's mechanic names
 * damage, and only damage moves it here.
 * ============================================================================
 */
export const PRAYER_OF_MENDING_HEALS = 6;
export const PRAYER_OF_MENDING_DURATION_MS = seconds(30);

/** How one charge heals; supplied by the ability, so talents reach it. */
export type PrayerOfMendingHeal = (context: SimulationContext, caster: Combatant, carrier: Combatant) => void;

export function prayerOfMendingAura(heal: PrayerOfMendingHeal, healsLeft: number = PRAYER_OF_MENDING_HEALS): AuraDefinition {
  const definition: AuraDefinition = {
    id: 'prayer_of_mending',
    name: 'Prayer of Mending',
    durationMs: PRAYER_OF_MENDING_DURATION_MS,
    refreshBehaviour: 'reset',
    onCarrierDamaged: (context: SimulationContext, aura: AuraInstance) => {
      const caster = context.combatant(aura.sourceId);
      const carrier = context.combatant(aura.targetId);
      if (!caster || !carrier) return;
      carrier.auras.remove(context, aura.definition.id);
      heal(context, caster, carrier);
      if (healsLeft <= 1) return;
      const others = context.combatants.filter(
        (other) =>
          other !== carrier &&
          other !== caster &&
          other.party !== undefined &&
          other.isAlive &&
          !other.isHostileTo(caster),
      );
      if (others.length === 0) return;
      const next = context.rng.pick(others);
      if (!next) return;
      context.applyAura(next, prayerOfMendingAura(heal, healsLeft - 1), caster.id);
    },
  };
  return definition;
}

export const CATALOG_AURAS: readonly AuraDefinition[] = [
  // The healers' factory-built auras (round 73), one representative each.
  powerWordShieldAura(0),
  divineAegisAura(0),
  prayerOfMendingAura(() => undefined),
  /*
   * ADDED BY THE AURA-CATALOGUE AUDIT, which found these reachable ONLY through
   * `aurasForClass`'s stock-list safety net -- "anything a stock list names must
   * be choosable, wherever its definition lives". The id was offered with a name
   * derived from it and nothing else, where a listed definition carries the
   * aura's own name and `isDebuff`. A SAFETY NET MASKS THE THING IT IS A NET
   * FOR, which is why the audit asks the modules rather than the catalogue.
   */
  shadowWordPainAura(0),
  shadowWeavingAura(0),
  darkInspirationAura(0),
];
