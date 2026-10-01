import type { CastReaction } from '../../engine';
import type { TalentReactionBuilder } from './warriorTalents';
import { INNER_FOCUS, SHADOW_WEAVING_MAX_STACKS, shadowWeavingAura } from '../auras/priest';

/**
 * Priest talent procs. One, and it is the Shadow build's engine.
 */

/** The spells Shadow Weaving listens to: every Shadow damage spell. */
const SHADOW_DAMAGE_SPELLS = new Set([
  'mind_blast',
  'shadow_word_pain',
  'mind_flay',
  'devouring_plague',
  'shadow_word_death',
]);

/**
 * Shadow Weaving: a Shadow spell raises the Shadow damage you deal, stacking.
 *
 * ----------------------------------------------------------------------------
 * ON THE CASTER IN FOREVER, NOT ON THE TARGET. Classic's is a debuff every
 * shadow priest in a raid shares and fights over; this one is personal, so it
 * is worth the same in a raid of one as in a raid of five.
 *
 * AT 3/3 THE CHANCE IS 100%, so five stacks arrive within the first few casts
 * and stay for the rest of the fight. Which is why the value handed here is
 * the CHANCE at index 0 and the per-stack percentage is index 1 -- reading the
 * wrong one would give a 2% chance of a 100% damage buff, which is a different
 * talent entirely and would not obviously be wrong on the results page.
 *
 * ITS TICKS COUNT. A periodic tick carries its aura's id, and Shadow Word:
 * Pain is on that list -- so the two damage-over-time effects keep the stacks
 * up on their own while the priest casts something else.
 * ----------------------------------------------------------------------------
 */
export const SHADOW_WEAVING_PERCENT_PER_STACK = 2;

export const shadowWeaving: TalentReactionBuilder = (chancePercent) => ({
  id: 'shadow_weaving',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (context, _actor, attack) =>
    attack.abilityId !== undefined &&
    SHADOW_DAMAGE_SPELLS.has(attack.abilityId) &&
    context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    // `applyAura` adds a stack itself, up to `maxStacks`, and resets the
    // fifteen seconds. Setting stacks here as well would double every proc.
    context.applyAura(actor, shadowWeavingAura(SHADOW_WEAVING_PERCENT_PER_STACK), actor.id);
  },
});

export const SHADOW_WEAVING_CAP = SHADOW_WEAVING_MAX_STACKS;

export const PRIEST_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  shadow_weaving: shadowWeaving,
};

/**
 * What spends Inner Focus: the next cast, AFTER it has happened.
 *
 * ----------------------------------------------------------------------------
 * NOT `consumedByCast`, AND THE DIFFERENCE IS THE WHOLE TALENT. That field is
 * spent at cast START, which is right for a cost and useless for a crit: a
 * Mind Blast lands a second and a half later, by which time the aura carrying
 * the 25% would be gone. The cost still comes off -- `resolveCast` reads the
 * modifier before anything is spent -- so the failure would have been a free
 * cast with no crit, reporting itself fully modelled.
 *
 * A CAST REACTION RUNS AFTER `onCast`, which is the ordering Fingers of Frost
 * already rests on, and `appliedAt < now` is the same guard it uses: without
 * it the cast of Inner Focus itself would eat the charge it just created.
 * ----------------------------------------------------------------------------
 */
export const innerFocusSpender = (): CastReaction => ({
  id: 'inner_focus_spend',
  canTrigger: (context, actor) => {
    const aura = actor.auras.get(INNER_FOCUS.id);
    return aura !== undefined && aura.appliedAt < context.clock.now();
  },
  onTrigger: (context, actor) => {
    actor.auras.remove(context, INNER_FOCUS.id);
  },
});

export const PRIEST_CAST_REACTIONS: Readonly<Record<string, (value: number) => CastReaction>> = {
  inner_focus: innerFocusSpender,
};
