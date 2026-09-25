import type { Ability } from '../../engine';
import { dealDamage, seconds } from '../../engine';
import { baseManaFor } from '../character/baseStatLookup';
import {
  DEVOURING_PLAGUE,
  SHADOWFORM,
  SHADOWFORM_UNMODELLED,
  VAMPIRIC_EMBRACE,
  VAMPIRIC_EMBRACE_UNMODELLED,
  shadowWordPainAura,
} from '../auras/priest';
import {
  channelTickCoefficient,
  directSpellCoefficient,
} from '../combat/spellCoefficient';

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

// ---------------------------------------------------------------------------

export const MIND_BLAST_CAST_MS = seconds(1.5);
export const MIND_BLAST_COEFFICIENT = directSpellCoefficient(MIND_BLAST_CAST_MS);
export const MIND_BLAST_DAMAGE = midpoint(477, 503);

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
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
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
export const MIND_FLAY_CHANNEL_MS = seconds(MIND_FLAY_TICKS);

/*
 * A CHANNEL, so the WHOLE three seconds is the cast: 0.857 in total, 0.286 a
 * tick. Not `directSpellCoefficient(0)` per tick, which is what treating each
 * tick as its own instant would give and would be worth half as much again.
 */
export const MIND_FLAY_TICK_COEFFICIENT = channelTickCoefficient(
  MIND_FLAY_CHANNEL_MS,
  MIND_FLAY_TICKS,
);

export const MIND_FLAY: Ability = {
  id: 'mind_flay',
  name: 'Mind Flay',
  cost: { resource: 'mana', amount: 205 },
  castTimeMs: MIND_FLAY_CHANNEL_MS,
  channelTicks: MIND_FLAY_TICKS,
  attackTable: 'spell',
  onCast: ({ simulation, caster, target, ability }) => {
    if (!target) return;
    dealDamage(simulation, {
      source: caster,
      target,
      abilityId: ability.id,
      abilityName: ability.name,
      school: 'shadow',
      baseAmount: MIND_FLAY_TOTAL / MIND_FLAY_TICKS,
      powerCoefficient: MIND_FLAY_TICK_COEFFICIENT,
      attackTable: ability.attackTable,
    });
  },
};

export const DEVOURING_PLAGUE_ABILITY: Ability = {
  id: 'devouring_plague',
  name: 'Devouring Plague',
  cost: { resource: 'mana', amount: 985 },
  cooldownMs: seconds(60),
  onCast: ({ simulation, caster, target }) => {
    if (!target) return;
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
export const SHADOW_WORD_DEATH_DAMAGE = midpoint(444, 472);
export const SHADOW_WORD_DEATH_BACKLASH_FRACTION = 0.1;
export const SHADOW_WORD_DEATH_COEFFICIENT = directSpellCoefficient(0);

export const SHADOW_WORD_DEATH: Ability = {
  id: 'shadow_word_death',
  name: 'Shadow Word: Death',
  cost: { resource: 'mana', amount: 340 },
  cooldownMs: seconds(15),
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

export const VAMPIRIC_EMBRACE_ABILITY: Ability = {
  id: 'vampiric_embrace',
  name: 'Vampiric Embrace',
  cost: { resource: 'mana', amount: 40 },
  cooldownMs: seconds(60),
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

export const PRIEST_ABILITIES: readonly Ability[] = [
  SHADOWFORM_ABILITY,
  MIND_BLAST,
  SHADOW_WORD_PAIN,
  MIND_FLAY,
  DEVOURING_PLAGUE_ABILITY,
  SHADOW_WORD_DEATH,
  VAMPIRIC_EMBRACE_ABILITY,
];
