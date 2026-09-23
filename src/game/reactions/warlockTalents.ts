import type { TalentReactionBuilder } from './warriorTalents';
import {
  SHADOW_TRANCE,
  improvedShadowBoltAura,
  shadowAndFlameAura,
} from '../auras/warlock';

/**
 * Warlock talent procs.
 *
 * ----------------------------------------------------------------------------
 * ALL THREE ARE CROSS-EFFECTS: a spell of one kind changing what a spell of
 * another kind does. Nightfall turns a damage-over-time tick into an instant
 * Shadow Bolt, Improved Shadow Bolt turns a Shadow Bolt crit into a debuff
 * every later Shadow spell reads, and Shadow and Flame has Fire buff Shadow
 * and Shadow buff Fire.
 *
 * That is why the two builds look the way they do -- neither is a single
 * school poured into one button.
 * ----------------------------------------------------------------------------
 */

/** The spells Nightfall listens to: "Corruption, Drain Soul, Drain Life, Wrack". */
const NIGHTFALL_SOURCES = new Set(['corruption', 'drain_soul', 'drain_life', 'wrack']);

/**
 * Nightfall: a damage-over-time tick may make the next Shadow Bolt instant.
 *
 * IT FIRES OFF A TICK, not off the cast. "Gives your Corruption ... spells a
 * chance to cause you to enter a Shadow Trance AFTER DAMAGING the opponent" --
 * and what damages the opponent is the periodic tick, which carries the aura's
 * id. So the ability ids here are AURA ids, which is the same route Malediction
 * takes to reach periodic damage.
 */
export const nightfall: TalentReactionBuilder = (chancePercent) => ({
  id: 'nightfall',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (context, _actor, attack) =>
    attack.abilityId !== undefined &&
    NIGHTFALL_SOURCES.has(attack.abilityId) &&
    context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, SHADOW_TRANCE, actor.id);
  },
});

/**
 * Improved Shadow Bolt: a Shadow Bolt crit makes the target take more Shadow.
 *
 * A CRIT ONLY, which `outcomes` says directly -- and it is why this talent is
 * worth more to a build with Malevolence in it, which raises Shadow crit.
 */
export const improvedShadowBolt: TalentReactionBuilder = (percent) => ({
  id: 'improved_shadow_bolt',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) => attack.abilityId === 'shadow_bolt',
  onTrigger: (context, actor, attack) => {
    context.applyAura(attack.defender, improvedShadowBoltAura(percent), actor.id);
  },
});

/**
 * Shadow and Flame: Conflagrate buffs Shadow, Shadowburn buffs Fire.
 *
 * TWO BUFFS FROM ONE REACTION, chosen by which spell landed. Its other two
 * clauses -- Conflagrate keeping Immolate and Shadowburn refunding a shard --
 * are `abilityFlag`s on those abilities rather than anything here, because
 * they are on or off and have no magnitude.
 */
export const shadowAndFlame: TalentReactionBuilder = (percent) => ({
  id: 'shadow_and_flame',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (_context, _actor, attack) =>
    attack.abilityId === 'conflagrate' || attack.abilityId === 'shadowburn',
  onTrigger: (context, actor, attack) => {
    // Conflagrate is Fire and raises SHADOW; Shadowburn is Shadow and raises
    // FIRE. The crossover is the whole point of the talent.
    const school = attack.abilityId === 'conflagrate' ? 'shadow' : 'fire';
    context.applyAura(actor, shadowAndFlameAura(school, percent), actor.id);
  },
});

export const WARLOCK_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  nightfall,
  improved_shadow_bolt: improvedShadowBolt,
  shadow_and_flame: shadowAndFlame,
};
