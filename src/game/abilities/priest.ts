import type { Ability, Combatant, SimulationContext } from '../../engine';
import { applyHealing, dealDamage, rollApplication, seconds } from '../../engine';
import { areaTargets } from '../combat/multiTarget';
import {
  BINDING_HEAL_HEAL_COEFFICIENT,
  FLASH_HEAL_HEAL_COEFFICIENT,
  GREATER_HEAL_HEAL_COEFFICIENT,
  HOLY_NOVA_SP_COEFFICIENT,
  PENANCE_HEAL_COEFFICIENT,
  POWER_WORD_SHIELD_ABSORB_COEFFICIENT,
  PRAYER_OF_HEALING_HEAL_COEFFICIENT,
  PRAYER_OF_MENDING_HEAL_COEFFICIENT,
} from '../combat/coefficients';
import {
  DIVINE_AEGIS_CAP,
  INSPIRATION,
  RENEW_HOT,
  WEAKENED_SOUL,
  divineAegisAura,
  powerWordShieldAura,
  prayerOfMendingAura,
  weakenedSoulAura,
} from '../auras/priest';
import { baseManaFor } from '../character/baseStatLookup';
import {
  DEVOURING_PLAGUE,
  INNER_FOCUS,
  POWER_INFUSION,
  POWER_INFUSION_UNMODELLED,
  SHADOWFORM,
  SHADOWFORM_UNMODELLED,
  VAMPIRIC_EMBRACE,
  VAMPIRIC_EMBRACE_UNMODELLED,
  shadowWordPainAura,
} from '../auras/priest';
import {
  MIND_BLAST_SP_COEFFICIENT,
  MIND_FLAY_TICK_SP_COEFFICIENT,
  SHADOW_WORD_DEATH_SP_COEFFICIENT,
} from '../combat/coefficients';

/**
 * Priest abilities, from the WoW Forever beta client (build 1.60.1.69876).
 *
 * ----------------------------------------------------------------------------
 * THE NINTH AND LAST CLASS, and its one profile is the most periodic build in
 * the project: two damage-over-time effects held up while a channel fills the
 * gaps, and a single hard-hitting cooldown on top.
 *
 * MIND FLAY IS THE SECOND CHANNEL EVER BUILT, after the Mage's Arcane
 * Missiles. Three ticks over three seconds, each rolling the spell table on
 * its own -- the rule landed with the Mage and needed nothing new here.
 *
 * EVERY SPELL SCALES NOW, by the universal `castTime / 3.5` rule the ruleset
 * owner supplied -- and this class is the one that shows what it is worth,
 * because almost all of its damage is PERIODIC and CHANNELLED rather than
 * direct. Its two DoTs take the whole periodic coefficient each, Mind Flay
 * takes the channel rule, and only Mind Blast and Shadow Word: Death are
 * ordinary casts. See `game/combat/spellCoefficient.ts`.
 *
 * WHAT USED TO BE HERE, and it expired: "no spell power coefficients, for the
 * fifth caster running -- the Paladin's seals remain the only thing in the
 * project that scales with spell power." True of the DATA, which still states
 * flat damage, and wrong about the RULE, which is universal and did not need
 * to be stated per spell.
 * ----------------------------------------------------------------------------
 */

/** The midpoint of a stated range. The combat table supplies the spread. */
const midpoint = (low: number, high: number) => (low + high) / 2;

/** A Priest's base mana, which a "% of base mana" cost is a share of. */
export const PRIEST_BASE_MANA = baseManaFor('troll', 'priest');
const shareOfBase = (fraction: number) => Math.round(PRIEST_BASE_MANA * fraction);

/** The talent key Improved Shadow Word: Pain hands to the ability. */
export const SWP_EXTRA_SECONDS_BONUS = 'extraDurationSeconds';

/**
 * Improved Mind Flay's per-instance escalation, in percentage points.
 *
 * ============================================================================
 * THE TALENT STOPPED BEING A FLAT MULTIPLIER AND BECAME A COMPOUNDING ONE.
 *
 * "Improved Mind Flay changes to: Each instance of damage of Mind Flay deals
 * 10/20% more damage than its previous instance of damage."
 *
 * It was "your Mind Flay now deals {0}% more damage", which is an
 * `abilityDamage` modifier on the combatant -- every tick raised by the same
 * figure, and the ability itself knowing nothing about it. "More than its
 * PREVIOUS instance" cannot be said that way: the multiplier differs per tick,
 * and the only thing that knows which tick is running is the ability's own
 * `onCast`. So the number is handed over as a BONUS and the escalation is
 * computed where the tick index lives.
 *
 * AND IT IS NEARLY WORTH THE SAME THING, WHICH IS WHY IT NEEDS SAYING. Over
 * Mind Flay's three ticks at 2/2 the multipliers are 1, 1.20 and 1.44, a mean
 * of 1.2133 against the flat 1.20 it replaced -- about +1.1% on the ability.
 * Mind Flay is roughly half the Shadow profile's damage, so expect well under
 * a percent on the row. A redesign that reads as a buff and measures as noise
 * is the shape somebody later "fixes", and this one is the ruleset.
 *
 * THE EXPONENT IS THE TICK INDEX AND NOT THE TICK COUNT.
 * `Combatant.recordChannelTick` runs BEFORE `runCast`, so the first tick sees
 * `channelTicksDelivered === 1` -- the escalation is `(1 + p)^(delivered - 1)`
 * and the first instance is unmultiplied, which is what "more than its
 * previous instance" requires. Using the count directly would raise every tick
 * including the first, which is a bigger number and no error.
 * ============================================================================
 */
export const MIND_FLAY_ESCALATION_BONUS = 'mindFlayEscalationPercent';

// ---------------------------------------------------------------------------

export const MIND_BLAST_CAST_MS = seconds(1.5);
export const MIND_BLAST_COEFFICIENT = MIND_BLAST_SP_COEFFICIENT;
/*
 * 472 to 498, from foreverchanges.pro, by the owner's standing rule. Our capture
 * says 477 to 503 at the same rank 9 and the same build 1.60.1.70009 -- five
 * lower on both ends, so the midpoint goes 490 to 485.
 *
 * THIS WAS THE PROJECT'S ONE HAND-VERIFIED COEFFICIENT EXAMPLE, so the worked
 * figure in HANDOVER moved with it: 485 base, a 1.5-second cast for 0.4286, and
 * 497 Shadow spell power gives 698.00 where it used to give 703.00.
 */
export const MIND_BLAST_DAMAGE = midpoint(472, 498);

export const MIND_BLAST: Ability = {
  id: 'mind_blast',
  name: 'Mind Blast',
  cost: { resource: 'mana', amount: 350 },
  castTimeMs: seconds(1.5),
  cooldownMs: seconds(8),
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'shadow',
      baseAmount: MIND_BLAST_DAMAGE,
      powerCoefficient: MIND_BLAST_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
  unmodelled: 'Its "high amount of threat" does nothing; the engine does not track threat.',
};

/**
 * Shadow Word: Pain.
 *
 * ITS DURATION IS A TALENT, so the aura is built per cast from the bonus
 * Improved Shadow Word: Pain hands over. The tooltip's 762 is the total over
 * the BASE eighteen seconds, so the talent's extra six seconds are two extra
 * ticks of damage rather than the same total spread thinner.
 */
export const SHADOW_WORD_PAIN: Ability = {
  id: 'shadow_word_pain',
  name: 'Shadow Word: Pain',
  cost: { resource: 'mana', amount: 470 },
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    /*
     * A PURE DoT ROLLS TO HIT ON APPLICATION -- the owner's rule -- and has no
     * damage event to carry the roll, so it asks. `rollApplication` folds in
     * school-scoped hit the way a damaging spell's roll does.
     */
    const landed = !rollApplication(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'shadow',
      attackTable: 'spell',
    }).avoided;
    if (!landed) return;
    const extra = ability.bonuses?.[SWP_EXTRA_SECONDS_BONUS] ?? 0;
    simulation.applyAura(target, shadowWordPainAura(extra), caster.id);
  },
};

/**
 * Mind Flay: "390 Shadow damage over 3 sec", CHANNELLED.
 *
 * THREE TICKS OVER THREE SECONDS, one a second, each rolling the spell table
 * on its own -- so a tick can miss while the rest land, which is what a
 * channel does and is not what a 390-damage cast at the three-second mark
 * would do. `channelTicks` is the rule, built for Arcane Missiles.
 *
 * ITS SLOW DOES NOTHING; nothing here moves.
 */
export const MIND_FLAY_TOTAL = 390;
export const MIND_FLAY_TICKS = 3;
/**
 * Ticks an interrupt may not cut. The owner's "a minimum of the first 2".
 *
 * NOT `MIND_FLAY_TICKS - 1`, though it equals it today: the owner stated a
 * COUNT, and deriving "all but the last" would extend the ruling to Arcane
 * Missiles by analogy. See `Ability.protectedChannelTicks`.
 */
export const MIND_FLAY_PROTECTED_TICKS = 2;
export const MIND_FLAY_CHANNEL_MS = seconds(MIND_FLAY_TICKS);

/*
 * A CHANNEL, so the WHOLE three seconds is the cast: 0.857 in total, 0.286 a
 * tick. Not `directSpellCoefficient(0)` per tick, which is what treating each
 * tick as its own instant would give and would be worth half as much again.
 */
export const MIND_FLAY_TICK_COEFFICIENT = MIND_FLAY_TICK_SP_COEFFICIENT;

export const MIND_FLAY: Ability = {
  id: 'mind_flay',
  name: 'Mind Flay',
  cost: { resource: 'mana', amount: 205 },
  castTimeMs: MIND_FLAY_CHANNEL_MS,
  channelTicks: MIND_FLAY_TICKS,
  /*
   * WILLING TO BE CUT SHORT, which on its own changes nothing: both halves
   * have to agree, and no entry asks for it until somebody ticks the box. Mind
   * Flay is the Shadow list's FILLER -- what it fills is the gaps between
   * everything else -- so it is exactly the channel worth leaving when a bleed
   * falls off. See `Ability.interruptibleChannel`.
   */
  interruptibleChannel: true,
  /*
   * ==========================================================================
   * AND AN INTERRUPT MAY ONLY TAKE THE LAST TICK, by the owner's ruling:
   * "preserves a minimum of the first 2 ticks of Mind Flay and thus only cuts
   * off the last tick when interrupted. This may no longer be optimal play, but
   * I still want the functionality so the user can choose."
   *
   * TWO OF THE THREE, so the channel always delivers the bulk of itself. That
   * is a REDUCTION in what the interrupt is worth, which the owner called in
   * the same sentence -- the value of cutting a channel is largest when it can
   * be cut early, and this makes the earliest cut the third tick.
   *
   * AND IMPROVED MIND FLAY MAKES THE PROTECTED TICKS THE CHEAP ONES. The talent
   * compounds 20% a tick, so the three ticks are 1, 1.2 and 1.44 of the base --
   * the tick this now allows an interrupt to take is the BIGGEST of the three,
   * 39.6% of the channel's damage rather than a third of it. The two rulings
   * arrived together and pull against each other, which is worth knowing before
   * reading a measurement of either.
   * ==========================================================================
   */
  protectedChannelTicks: MIND_FLAY_PROTECTED_TICKS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    /*
     * IMPROVED MIND FLAY COMPOUNDS ACROSS THE CHANNEL'S OWN TICKS.
     *
     * `channelTicksDelivered` is incremented by `recordChannelTick` before
     * `runCast`, so it reads 1 on the first instance and the exponent is one
     * less -- the first tick is unmultiplied and each one after it is the
     * previous times `1 + p`. See `MIND_FLAY_ESCALATION_BONUS`.
     *
     * ZERO WITHOUT THE TALENT, so `Math.pow(1, n)` is 1 and the ability is
     * untouched -- which is what lets this live on the ability rather than
     * behind a talent check it could get wrong.
     */
    const escalation = ability.bonuses?.[MIND_FLAY_ESCALATION_BONUS] ?? 0;
    const instance = Math.max(0, caster.channelTicksDelivered - 1);
    const multiplier = (1 + escalation / 100) ** instance;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'shadow',
      baseAmount: (MIND_FLAY_TOTAL / MIND_FLAY_TICKS) * multiplier,
      powerCoefficient: MIND_FLAY_TICK_COEFFICIENT * multiplier,
      attackTable: ability.attackTable,
    });
  },
};

/*
 * "DEVOURING PLAGUE CAN NOW CORRECTLY CRITICALLY STRIKE", from the 1.60.1.70170
 * notes, AND IT ALWAYS COULD HERE. Nothing changed for this patch item.
 *
 * Both Priest damage-over-time effects share one `tick` helper in
 * `auras/priest.ts` and it has always passed `critFrom: 'spell'`, because
 * "every DoT can crit" is a Forever RULE the owner gave for the whole ruleset
 * rather than a per-spell property. So the client had a bug this simulator
 * never reproduced, and the fix brings the game to where the model was.
 *
 * Recorded rather than left silent: a patch note with no diff beside it reads
 * as something that was missed.
 */
/**
 * "Devouring Plague cooldown reduced to 24 seconds (was 1 minute)."
 *
 * THE NOTE AND THE CLIENT AGREE ON WHAT IT WAS -- the capture at build
 * 1.60.1.70291 reads "1 min cooldown" -- so this is a clean prescription and
 * the note is simply later. Named rather than left as `seconds(24)` inline
 * because the DoT's own duration sits next to it and the two are now close
 * enough that a reader will want to know which is which.
 */
export const DEVOURING_PLAGUE_COOLDOWN_MS = seconds(24);

export const DEVOURING_PLAGUE_ABILITY: Ability = {
  id: 'devouring_plague',
  name: 'Devouring Plague',
  cost: { resource: 'mana', amount: 985 },
  cooldownMs: DEVOURING_PLAGUE_COOLDOWN_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    /*
     * A PURE DoT ROLLS TO HIT ON APPLICATION -- the owner's rule -- and has no
     * damage event to carry the roll, so it asks. `rollApplication` folds in
     * school-scoped hit the way a damaging spell's roll does.
     */
    const landed = !rollApplication(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'shadow',
      attackTable: 'spell',
    }).avoided;
    if (!landed) return;
    simulation.applyAura(target, DEVOURING_PLAGUE, caster.id);
  },
  unmodelled:
    'Its "damage caused heals the caster" does nothing: no Priest profile is ' +
    'attacked, so the heal lands on a character at full.',
};

/**
 * Shadow Word: Death: "444 to 472 Shadow damage. If your target is NOT KILLED
 * by Shadow Word: Death, you take backlash damage equal to 10% of your maximum
 * health."
 *
 * ----------------------------------------------------------------------------
 * THE BACKLASH ALWAYS HAPPENS HERE, and that is not a modelling choice -- it
 * is what the encounter is. The target is a damage sink that survives every
 * fight by design, so it is never killed by anything, so the condition is
 * always met.
 *
 * SO THE PRIEST HURTS ITSELF EVERY FIFTEEN SECONDS, for a tenth of its health
 * each time, with no healer -- a damage profile has `externalHealing` off.
 * That is a real cost the build pays and it is modelled rather than waved
 * away: leaving it out would make a spell that is genuinely dangerous here
 * look free.
 * ----------------------------------------------------------------------------
 */
// 434 to 462, from foreverchanges.pro by the same rule, against our capture's
// 444 to 472 at the same rank 4 and build. The 10% backlash is unchanged and both
// sources state it.
export const SHADOW_WORD_DEATH_DAMAGE = midpoint(434, 462);
export const SHADOW_WORD_DEATH_BACKLASH_FRACTION = 0.1;
export const SHADOW_WORD_DEATH_COEFFICIENT = SHADOW_WORD_DEATH_SP_COEFFICIENT;

/**
 * "Shadow Word: Death cooldown increased to 18 seconds (was 12 seconds)."
 *
 * ============================================================================
 * THE NOTE'S PARENTHETICAL DISAGREES WITH BOTH SOURCES, AND THAT IS RECORDED
 * RATHER THAN RECONCILED.
 *
 * The note says it WAS 12 seconds. The spellbook capture at build
 * 1.60.1.70291 reads "15 sec cooldown" for rank 4, and this file has carried
 * 15 from that capture; `foreverchanges.pro` has not been re-read for the
 * Priest. So nothing in the project has ever said 12.
 *
 * EIGHTEEN IS APPLIED ANYWAY, because the two halves of that sentence are
 * different kinds of claim: "increased to 18 seconds" is a PRESCRIPTION and
 * "(was 12 seconds)" is the note's own record of history. A prescription with
 * a stated number is exactly what this project takes from a note -- the same
 * reading that gives Swipe 3% against a sheet saying 10% -- and a wrong
 * parenthetical does not make the target value wrong.
 *
 * IT IS STILL WORTH ASKING. The other two Priest cooldowns in this patch both
 * match their "(was ...)" exactly, so this one is the odd row of three, and
 * this project's own rule is that two of three reproducing and the third
 * moving is the shape of a bug. The honest possibilities are that the note was
 * written against a build between captures, or that rank 4 is not the rank the
 * note means. A QUESTION FOR THE OWNER, flagged here rather than smoothed over.
 * ============================================================================
 */
export const SHADOW_WORD_DEATH_COOLDOWN_MS = seconds(18);

export const SHADOW_WORD_DEATH: Ability = {
  id: 'shadow_word_death',
  name: 'Shadow Word: Death',
  cost: { resource: 'mana', amount: 340 },
  cooldownMs: SHADOW_WORD_DEATH_COOLDOWN_MS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'shadow',
      baseAmount: SHADOW_WORD_DEATH_DAMAGE,
      powerCoefficient: SHADOW_WORD_DEATH_COEFFICIENT,
      attackTable: ability.attackTable,
    });

    // The target is never killed, so the backlash is never avoided.
    caster.health.spend(caster.health.maximum * SHADOW_WORD_DEATH_BACKLASH_FRACTION);
  },
  unmodelled:
    'Its BACKLASH ALWAYS LANDS: the target is a damage sink that survives ' +
    'every fight, so "if your target is not killed" is always true. A tenth ' +
    'of the Priest’s maximum health every fifteen seconds, with no healer, ' +
    'and it is taken from the pool directly -- so it does NOT appear in the ' +
    'damage-taken panel, which reports what attacked the character. The ' +
    'health is really gone; only its accounting is missing.',
};

/**
 * "Vampiric Embrace cooldown reduced to 30 seconds (was 1 minute)."
 *
 * The note and the capture agree on what it was. WORTH NOTHING TO THE ONE
 * PRIEST PROFILE EITHER WAY, which is why the figure is named and the
 * expectation written down rather than measured: the ability's whole effect is
 * a party HEAL from Shadow damage dealt, which is out of scope -- see
 * `VAMPIRIC_EMBRACE_UNMODELLED`. Halving the cooldown of an aura that heals
 * nobody changes no number at all, and that is the correct outcome rather than
 * a failure to apply.
 */
export const VAMPIRIC_EMBRACE_COOLDOWN_MS = seconds(30);

export const VAMPIRIC_EMBRACE_ABILITY: Ability = {
  id: 'vampiric_embrace',
  name: 'Vampiric Embrace',
  cost: { resource: 'mana', amount: 40 },
  cooldownMs: VAMPIRIC_EMBRACE_COOLDOWN_MS,
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
    simulation.applyAura(target, VAMPIRIC_EMBRACE, caster.id);
  },
  unmodelled: VAMPIRIC_EMBRACE_UNMODELLED,
};

/**
 * Shadowform, granted by the Shadow capstone.
 *
 * CAST ONCE AT THE PULL and never again -- it has no duration, and its own
 * `canCast` refuses while it is up, so the priority list stops offering it.
 * One global cooldown and 40% of base mana, paid rather than assumed.
 */
export const SHADOWFORM_ABILITY: Ability = {
  id: 'shadowform',
  name: 'Shadowform',
  cost: { resource: 'mana', amount: shareOfBase(0.4) },
  requiresTarget: false,
  canCast: ({ caster }) => !caster.auras.has('shadowform'),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, SHADOWFORM, caster.id);
  },
  unmodelled: SHADOWFORM_UNMODELLED,
};


/**
 * Inner Focus, granted by the Discipline talent of the same name.
 *
 * FREE, WHICH IS THE CAPTURE'S OWN WORD -- the spellbook entry carries no cost
 * line at all, unlike Power Infusion below, which carries "20% of base mana".
 * Two entries from the same file, one with a cost and one without, is what
 * makes the absence a fact rather than a gap.
 *
 * IT REFUSES WHILE ITS OWN BUFF IS UP, the way Shadowform does. Recasting it
 * would throw away an unspent charge for a global cooldown.
 */
export const INNER_FOCUS_COOLDOWN_MS = seconds(180);

export const INNER_FOCUS_ABILITY: Ability = {
  id: 'inner_focus',
  name: 'Inner Focus',
  cooldownMs: INNER_FOCUS_COOLDOWN_MS,
  requiresTarget: false,
  /*
   * OFF THE GLOBAL COOLDOWN, on the owner's instruction -- "ensure Inner Focus
   * does not trigger the global cooldown".
   *
   * BEING OFF IT MEANS ONE THING: this does not START a global cooldown, so the
   * spell it is being pressed for can follow immediately. It is still BLOCKED
   * by one already running, which is the half that reads wrongly -- an entry
   * for it still has to find a moment the Priest is not mid-GCD.
   *
   * IT IS WHY THE BUFF IS WORTH TAKING AT ALL. On the GCD, a free cast plus
   * 25% crit costs a Mind Flay tick's worth of time to set up; off it, the
   * charge is free and only the three-minute cooldown bounds it. The same
   * argument the five racials and all nine mid-fight consumables are off it on.
   */
  triggersGcd: false,
  canCast: ({ caster }) => !caster.auras.has('inner_focus'),
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, INNER_FOCUS, caster.id);
  },
  unmodelled:
    'Its free cast and its 25% crit both apply. What it cannot express is ' +
    '"your next SPELL" as a category: `CastModifier` selects by id, so the ' +
    'free cast names the Priest book one entry at a time and a spell added ' +
    'later has to be added here too.',
};

/**
 * Power Infusion, granted by the Discipline capstone.
 *
 * SELF-CAST, because the only friendly target a one-character encounter has is
 * the character. `requiresTarget: false` says so rather than letting the
 * rotation find the boss and buff it.
 */
export const POWER_INFUSION_COOLDOWN_MS = seconds(180);

export const POWER_INFUSION_ABILITY: Ability = {
  id: 'power_infusion',
  name: 'Power Infusion',
  cost: { resource: 'mana', amount: shareOfBase(0.2) },
  cooldownMs: POWER_INFUSION_COOLDOWN_MS,
  requiresTarget: false,
  onCast: ({ simulation, caster }) => {
    simulation.applyAura(caster, POWER_INFUSION, caster.id);
  },
  unmodelled: POWER_INFUSION_UNMODELLED,
};

/**
 * Holy Nova, granted by the Holy talent: "causing 174 to 200 Holy damage to all
 * enemy targets within 10 yards and healing all party members within 10 yards
 * for 288 to 334. These effects cause no threat." 750 mana, instant (round 57).
 *
 * The spellbook's rank 6 -- the talent tooltip's 26 to 30 is rank 1. EVERY
 * TARGET, each with its own spell roll; "no threat" is `holy_nova` in the threat
 * table at a multiplier of zero. 10.7% of spell power, the owner's figure. The
 * party heal is OUT OF SCOPE for a multi-target damage simulation, by the
 * owner's ruling.
 */
export const HOLY_NOVA_DAMAGE = (174 + 200) / 2;

export const HOLY_NOVA: Ability = {
  id: 'holy_nova',
  name: 'Holy Nova',
  cost: { resource: 'mana', amount: 750 },
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
        school: 'holy',
        baseAmount: HOLY_NOVA_DAMAGE,
        powerCoefficient: HOLY_NOVA_SP_COEFFICIENT,
        attackTable: ability.attackTable,
      });
    }
  },
  unmodelled:
    'Its party heal is out of scope for a multi-target damage simulation, by ' +
    'the owner’s ruling.',
};

/* -------------------------------------------------------------------------- */
/* The healers (round 73): the Holy and Disc Priest profiles' spells          */
/* -------------------------------------------------------------------------- */

/** The keys the healing talents carry on each heal they reach. */
export const DIVINE_AEGIS_KEY = 'divineAegisPercent';
export const INSPIRATION_KEY = 'inspirationPercent';
export const RENEWED_HOPE_SECONDS_KEY = 'renewedHopeSeconds';
export const RENEWED_HOPE_CRIT_KEY = 'renewedHopeCrit';

const isFriendly = (caster: Combatant, target: Combatant | undefined): target is Combatant =>
  target !== undefined && !target.isHostileTo(caster);

/**
 * Every Priest heal goes through here, so its three riders cannot be forgotten
 * by one of them:
 *
 *   DIVINE AEGIS    a non-periodic crit tops up a shield on the target by the
 *                   talent's share of the heal, to 1,200 at most
 *   INSPIRATION     a non-periodic crit puts Inspiration on the target
 *   RENEWED HOPE    the heal takes five seconds off a Weakened Soul of yours on
 *                   the target, and off the target entirely if less is left
 *
 * The first two read the RAW heal -- what it would have healed, overhealing
 * included -- because "the amount healed" by a crit on a full target would
 * otherwise make no shield at all.
 */
export function priestHeal(
  simulation: SimulationContext,
  caster: Combatant,
  target: Combatant,
  ability: Ability,
  amount: number,
  coefficient: number,
): void {
  const bonuses = ability.bonuses ?? {};
  const result = applyHealing(simulation, {
    source: caster,
    target,
    abilityId: ability.id,
    abilityName: ability.name,
    baseAmount: amount,
    powerCoefficient: coefficient,
    threatens: true,
  });
  const cut = bonuses[RENEWED_HOPE_SECONDS_KEY] ?? 0;
  const soul = target.auras.get(WEAKENED_SOUL.id);
  if (cut > 0 && soul && soul.sourceId === caster.id) {
    if (soul.expiresAt - simulation.clock.now() <= seconds(cut)) target.auras.remove(simulation, WEAKENED_SOUL.id);
    else target.auras.rewindWindow(simulation, soul, seconds(cut));
  }
  if (!result.critical) return;
  const aegis = bonuses[DIVINE_AEGIS_KEY] ?? 0;
  if (aegis > 0) {
    const existing = target.auras.get('divine_aegis');
    const left = existing?.sourceId === caster.id ? existing.absorbRemaining : 0;
    const shield = Math.min(DIVINE_AEGIS_CAP, left + (result.raw * aegis) / 100);
    simulation.applyAura(target, divineAegisAura(shield), caster.id);
  }
  if ((bonuses[INSPIRATION_KEY] ?? 0) > 0) simulation.applyAura(target, INSPIRATION, caster.id);
}

/** Flash Heal, rank 7: "Heals a friendly target for 774 to 910." 380 mana, 1.5s. */
export const FLASH_HEAL_HEAL = midpoint(774, 910);

export const FLASH_HEAL: Ability = {
  id: 'flash_heal',
  name: 'Flash Heal',
  heals: true,
  cost: { resource: 'mana', amount: 380 },
  castTimeMs: seconds(1.5),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    priestHeal(simulation, caster, target, ability, FLASH_HEAL_HEAL, FLASH_HEAL_HEAL_COEFFICIENT);
  },
};

/** Greater Heal, rank 5: "heals a single target for 1,853 to 2,067." 710 mana, 3s. */
export const GREATER_HEAL_HEAL = midpoint(1853, 2067);

export const GREATER_HEAL: Ability = {
  id: 'greater_heal',
  name: 'Greater Heal',
  heals: true,
  cost: { resource: 'mana', amount: 710 },
  castTimeMs: seconds(3),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    priestHeal(simulation, caster, target, ability, GREATER_HEAL_HEAL, GREATER_HEAL_HEAL_COEFFICIENT);
  },
};

/**
 * Binding Heal, rank 6, granted by the talent: "Heal yourself and a friendly
 * target for 774 to 910." 380 mana, 1.5s. The full amount on each, 42.9% of
 * healing power on each.
 */
export const BINDING_HEAL_HEAL = midpoint(774, 910);

export const BINDING_HEAL: Ability = {
  id: 'binding_heal',
  name: 'Binding Heal',
  heals: true,
  cost: { resource: 'mana', amount: 380 },
  castTimeMs: seconds(1.5),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    priestHeal(simulation, caster, target, ability, BINDING_HEAL_HEAL, BINDING_HEAL_HEAL_COEFFICIENT);
    if (target !== caster) {
      priestHeal(simulation, caster, caster, ability, BINDING_HEAL_HEAL, BINDING_HEAL_HEAL_COEFFICIENT);
    }
  },
};

/**
 * Prayer of Healing, rank 5: "heals the target and their party for 631 to
 * 667." 1,070 mana, 3s. Every member gets the full amount, the owner's; a
 * target with no party is healed alone.
 */
export const PRAYER_OF_HEALING_HEAL = midpoint(631, 667);

export const PRAYER_OF_HEALING: Ability = {
  id: 'prayer_of_healing',
  name: 'Prayer of Healing',
  heals: true,
  cost: { resource: 'mana', amount: 1070 },
  castTimeMs: seconds(3),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    const party =
      target.party === undefined
        ? [target]
        : simulation.combatants.filter(
            (member) => member.party === target.party && member.isAlive && !member.isHostileTo(caster),
          );
    for (const member of party) {
      priestHeal(simulation, caster, member, ability, PRAYER_OF_HEALING_HEAL, PRAYER_OF_HEALING_HEAL_COEFFICIENT);
    }
  },
};

/** Renew, rank 10: 410 mana, instant. The heal is `RENEW_HOT`. */
export const RENEW: Ability = {
  id: 'renew',
  name: 'Renew',
  heals: true,
  cost: { resource: 'mana', amount: 410 },
  onCast: ({ simulation, caster, target }) => {
    if (!isFriendly(caster, target)) return;
    simulation.applyAura(target, RENEW_HOT, caster.id);
  },
};

/**
 * Power Word: Shield, rank 10: 500 mana, instant, a 4 second cooldown (Soul
 * Warding takes it off). Absorbs 928 plus 10% of healing power, times the
 * shield's own modifiers -- Improved Power Word: Shield. REFUSED ON A TARGET
 * WITH WEAKENED SOUL, which it then applies.
 */
export const POWER_WORD_SHIELD_ABSORB = 928;

export const POWER_WORD_SHIELD: Ability = {
  id: 'power_word_shield',
  name: 'Power Word: Shield',
  heals: true,
  cost: { resource: 'mana', amount: 500 },
  cooldownMs: seconds(4),
  canCast: ({ target }) => target !== undefined && !target.auras.has(WEAKENED_SOUL.id),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    const modifier = caster.abilityModifierFor(ability.id);
    const amount =
      (POWER_WORD_SHIELD_ABSORB + POWER_WORD_SHIELD_ABSORB_COEFFICIENT * caster.stats.get('healingPower')) *
      (modifier?.healingMultiplier ?? 1);
    simulation.applyAura(target, powerWordShieldAura(amount), caster.id);
    simulation.applyAura(target, weakenedSoulAura(ability.bonuses?.[RENEWED_HOPE_CRIT_KEY] ?? 0), caster.id);
  },
};

/**
 * Prayer of Mending, rank 3, granted by the talent: 390 mana, instant, a 10
 * second cooldown. ONE AT A TIME PER CASTER: casting it takes yours off whoever
 * carries it, and the new one starts a fresh six heals. See `prayerOfMendingAura`.
 */
export const PRAYER_OF_MENDING_HEAL = 413;

export const PRAYER_OF_MENDING: Ability = {
  id: 'prayer_of_mending',
  name: 'Prayer of Mending',
  heals: true,
  cost: { resource: 'mana', amount: 390 },
  cooldownMs: seconds(10),
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    for (const other of simulation.combatants) {
      if (other.auras.get('prayer_of_mending')?.sourceId === caster.id) other.auras.remove(simulation, 'prayer_of_mending');
    }
    const heal = (context: SimulationContext, from: Combatant, carrier: Combatant) =>
      priestHeal(context, from, carrier, ability, PRAYER_OF_MENDING_HEAL, PRAYER_OF_MENDING_HEAL_COEFFICIENT);
    simulation.applyAura(target, prayerOfMendingAura(heal), caster.id);
  },
};

/**
 * Penance, rank 4, granted by the Discipline capstone: "425 healing to an ally,
 * instantly and every 1 sec for 2 sec." 385 mana, channelled, a 12 second
 * cooldown.
 *
 * THREE HEALS: the first as the channel starts (`onCastStart`), then one at
 * each second of a two-second channel of two ticks -- so the last lands as the
 * channel ends, where Inner Focus's spender takes its charge. 85.7% of healing
 * power across the three, the owner's, so a third each.
 */
export const PENANCE_HEAL = 425;
export const PENANCE_TICKS = 3;

export const PENANCE: Ability = {
  id: 'penance',
  name: 'Penance',
  heals: true,
  cost: { resource: 'mana', amount: 385 },
  cooldownMs: seconds(12),
  castTimeMs: seconds(2),
  channelTicks: PENANCE_TICKS - 1,
  onCastStart: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    priestHeal(simulation, caster, target, ability, PENANCE_HEAL, PENANCE_HEAL_COEFFICIENT / PENANCE_TICKS);
  },
  onCast: ({ simulation, caster, target, ability }) => {
    if (!isFriendly(caster, target)) return;
    priestHeal(simulation, caster, target, ability, PENANCE_HEAL, PENANCE_HEAL_COEFFICIENT / PENANCE_TICKS);
  },
};

export const PRIEST_ABILITIES: readonly Ability[] = [
  // Granted by the Holy talent; `grantsByAbility` gates it.
  HOLY_NOVA,
  SHADOWFORM_ABILITY,
  MIND_BLAST,
  SHADOW_WORD_PAIN,
  MIND_FLAY,
  DEVOURING_PLAGUE_ABILITY,
  SHADOW_WORD_DEATH,
  VAMPIRIC_EMBRACE_ABILITY,
  INNER_FOCUS_ABILITY,
  POWER_INFUSION_ABILITY,
  // The heals (round 73).
  FLASH_HEAL,
  GREATER_HEAL,
  PRAYER_OF_HEALING,
  RENEW,
  POWER_WORD_SHIELD,
  // Talent-granted.
  BINDING_HEAL,
  PRAYER_OF_MENDING,
  PENANCE,
];
