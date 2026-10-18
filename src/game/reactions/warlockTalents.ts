import type { TalentReactionBuilder } from './warriorTalents';
import type { CastReaction } from '../../engine';
import { dealDamage } from '../../engine';
import { inExecutePhase } from '../combat/executePhase';
import {
  DECIMATION_TRIGGERS,
  DECIMATION_WINDOW_FRACTION,
  DEMONIC_BRAND_DAMAGE_MAX,
  DEMONIC_BRAND_DAMAGE_MIN,
  decimationAura,
  SHADOW_TRANCE,
  demonicBrandAura,
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

/**
 * Demonic Brand, the WARLOCK's half: a Searing Pain that lands brands its
 * target with `charges` charges -- 2/4/6 by rank, the row's {2}.
 */
export const demonicBrand: TalentReactionBuilder = (charges) => ({
  id: 'demonic_brand',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (_context, _actor, attack) => attack.abilityId === 'searing_pain',
  onTrigger: (context, actor, attack) => {
    context.applyAura(attack.defender, demonicBrandAura(charges), actor.id);
  },
});

/**
 * Demonic Brand, the DEMON's half: each of its landed attacks on a branded
 * target spends a charge and deals 65 to 68 more -- Fire from the Imp, Shadow
 * from anything else, "based on the pet".
 *
 * ----------------------------------------------------------------------------
 * ONLY ITS OWNER'S BRAND, because the aura's source is the Warlock who cast
 * the Searing Pain and "your pet's next attacks" means the brand that
 * Warlock's demon reads.
 *
 * THE EXTRA HIT ROLLS NO TABLE AND CANNOT CRIT -- no `attackTable` and no
 * `critFrom` -- because the attack it rides on already landed; the
 * mythicsim-forever-engine repository casts it as a hit that "cannot miss".
 * And having no table is also what keeps it from triggering this same
 * reaction: `dealt` reactions run only for damage that consulted a table.
 * Dealt inline for the same reason.
 * ----------------------------------------------------------------------------
 */
export const demonicBrandStrike: TalentReactionBuilder = () => ({
  id: 'demonic_brand_strike',
  on: 'dealt',
  outcomes: ['hit', 'crit', 'glance', 'block'],
  canTrigger: (_context, actor, attack) => {
    const brand = attack.defender.auras.get('demonic_brand');
    return brand !== undefined && brand.sourceId === actor.ownerId;
  },
  onTrigger: (context, actor, attack) => {
    attack.defender.auras.consumeStack(context, 'demonic_brand');
    dealDamage(context, {
      source: actor,
      target: attack.defender,
      abilityId: 'demonic_brand_strike',
      abilityName: 'Demonic Brand',
      school: actor.abilities.has('imp_firebolt') ? 'fire' : 'shadow',
      baseAmount: (DEMONIC_BRAND_DAMAGE_MIN + DEMONIC_BRAND_DAMAGE_MAX) / 2,
    });
  },
});

/**
 * Decimation: a Shadow Bolt or Searing Pain cast inside the last 35% of the
 * fight opens -- or refreshes -- the ten-second Soul Fire window. `value` is
 * the rank's cast-time cut. See `decimationAura`.
 */
const decimation = (castTimePercent: number): CastReaction => ({
  id: 'decimation',
  canTrigger: (context, _actor, cast) =>
    DECIMATION_TRIGGERS.includes(cast.ability.id) &&
    inExecutePhase(context, DECIMATION_WINDOW_FRACTION),
  onTrigger: (context, actor) => {
    context.applyAura(actor, decimationAura(castTimePercent), actor.id);
  },
});

export const WARLOCK_CAST_REACTIONS: Readonly<Record<string, (value: number) => CastReaction>> = {
  decimation,
};

export const WARLOCK_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  demonic_brand: demonicBrand,
  demonic_brand_strike: demonicBrandStrike,
  nightfall,
  improved_shadow_bolt: improvedShadowBolt,
  shadow_and_flame: shadowAndFlame,
};
