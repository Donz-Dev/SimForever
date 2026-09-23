import type { TalentReactionBuilder } from './warriorTalents';
import {
  CLEARCASTING,
  HOT_STREAK,
  MISSILE_BARRAGE,
  fireVulnerabilityAura,
  igniteAura,
} from '../auras/mage';

/**
 * Mage talent procs.
 *
 * ----------------------------------------------------------------------------
 * ALMOST ALL OF THE MAGE'S REACTIVE TALENTS FIRE OFF A CRITICAL STRIKE, which
 * makes crit worth more to this class than to any other in the project: Ignite
 * turns a crit into a burn, Hot Streak turns one into a faster Pyroblast, and
 * Master of Elements turns one into mana back.
 *
 * WHICH SPELLS COUNT IS PART OF EACH TOOLTIP and is checked by ability id
 * rather than by school. Hot Streak names four spells and Ignite says "Fire
 * damage spells", and those are different sets -- Pyroblast is Fire and is not
 * a Hot Streak trigger, which is what stops it feeding itself.
 * ----------------------------------------------------------------------------
 */

/** "Fire damage spells" -- every Fire spell the Mage can cast. */
const FIRE_SPELLS = new Set([
  'fireball',
  'scorch',
  'pyroblast',
  'fire_blast',
  'blast_wave',
  'frostfire_bolt',
]);

/** Hot Streak names four, and Pyroblast is deliberately not one of them. */
const HOT_STREAK_TRIGGERS = new Set(['fireball', 'frostfire_bolt', 'fire_blast', 'scorch']);

/** Every damage spell, for the talents that say "any damage spell". */
const DAMAGE_SPELLS = new Set([
  ...FIRE_SPELLS,
  'frostbolt',
  'ice_lance',
  'arcane_missiles',
  'arcane_blast',
]);

/**
 * Ignite: a Fire crit burns for a share of the damage it just dealt.
 *
 * THE MAGNITUDE COMES OFF THE ATTACK, which is what `attack.amount` is for and
 * is why the aura is built per proc rather than declared once. A crit for 1200
 * with 5/5 Ignite is 480 over four seconds.
 *
 * NON-PERIODIC ONLY, checked by refusing anything whose ability id is a
 * DoT's. Without it Ignite's own ticks would crit and re-apply Ignite, which
 * compounds forever off a single lucky roll.
 */
export const ignite: TalentReactionBuilder = (percentOfDamage) => ({
  id: 'ignite',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) =>
    attack.abilityId !== undefined &&
    FIRE_SPELLS.has(attack.abilityId) &&
    attack.amount > 0,
  onTrigger: (context, actor, attack) => {
    const target = context.combatant(attack.defender.id);
    if (!target) return;
    context.applyAura(target, igniteAura((attack.amount * percentOfDamage) / 100), actor.id);
  },
});

/**
 * Master of Elements: a Fire or Frost crit refunds part of the base mana cost.
 *
 * THE BASE COST, NOT WHAT WAS PAID. A Clearcasting-free Fireball that crits
 * still refunds 30% of 410, which is what "their base mana cost" says -- and
 * it is the reading that makes the talent worth taking with Arcane
 * Concentration, which a 47-point Arcane build has and a Fire build does not.
 *
 * The cost is read off the caster's own copy of the ability, so a talent that
 * reduced it reduces the refund too.
 */
export const masterOfElements: TalentReactionBuilder = (percentRefunded) => ({
  id: 'master_of_elements',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, actor, attack) => {
    if (attack.abilityId === undefined) return false;
    // Fire and Frost, by the spells that are them.
    if (!FIRE_SPELLS.has(attack.abilityId) && attack.abilityId !== 'frostbolt') return false;
    return (actor.abilities.get(attack.abilityId)?.cost?.amount ?? 0) > 0;
  },
  onTrigger: (context, actor, attack) => {
    const cost = actor.abilities.get(attack.abilityId!)?.cost?.amount ?? 0;
    context.grantResource(actor, 'mana', (cost * percentRefunded) / 100, {
      id: 'master_of_elements',
      name: 'Master of Elements',
    });
  },
});

/**
 * Hot Streak: a non-periodic Fire crit shortens Pyroblast.
 *
 * FOUR NAMED SPELLS, and Pyroblast is not one of them -- so a Pyroblast crit
 * does not refresh the buff that made it fast. Reading "Fire damage spells"
 * here instead would let the spell feed itself.
 */
export const hotStreak: TalentReactionBuilder = () => ({
  id: 'hot_streak',
  on: 'dealt',
  outcomes: ['crit'],
  canTrigger: (_context, _actor, attack) =>
    attack.abilityId !== undefined && HOT_STREAK_TRIGGERS.has(attack.abilityId),
  onTrigger: (context, actor) => {
    context.applyAura(actor, HOT_STREAK, actor.id);
  },
});

/**
 * Arcane Concentration: a damage spell that HITS may grant Clearcasting.
 *
 * "After any damage spell hits a target" -- so an avoided spell rolls nothing,
 * which `outcomes` expresses directly.
 */
export const arcaneConcentration: TalentReactionBuilder = (chancePercent) => ({
  id: 'arcane_concentration',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (context, _actor, attack) =>
    attack.abilityId !== undefined &&
    DAMAGE_SPELLS.has(attack.abilityId) &&
    context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor) => {
    context.applyAura(actor, CLEARCASTING, actor.id);
  },
});

/**
 * Missile Barrage: Arcane Blast at 40%, three others at 20%.
 *
 * TWO RATES IN ONE TALENT. The 40 comes through the values file, hand-filled
 * because a single-rank talent has no variable the calculator can identify --
 * and the 20 is named here, because a builder takes one number and the text
 * carries two. Both are the source's own.
 */
export const MISSILE_BARRAGE_CHANCE_OTHERS = 20;
const MISSILE_BARRAGE_OTHERS = new Set(['fireball', 'frostbolt', 'frostfire_bolt']);

export const missileBarrage: TalentReactionBuilder = (chanceFromArcaneBlast) => ({
  id: 'missile_barrage',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (context, _actor, attack) => {
    const id = attack.abilityId;
    if (id === undefined) return false;
    const chance =
      id === 'arcane_blast'
        ? chanceFromArcaneBlast
        : MISSILE_BARRAGE_OTHERS.has(id)
          ? MISSILE_BARRAGE_CHANCE_OTHERS
          : 0;
    return chance > 0 && context.rng.rollChance(chance / 100);
  },
  onTrigger: (context, actor) => {
    context.applyAura(actor, MISSILE_BARRAGE, actor.id);
  },
});

/**
 * Improved Scorch, properly. Scorch applies a stacking Fire vulnerability.
 *
 * The talent's values are `[chance, percentPerStack, duration, maxStacks]`, and
 * the effect table hands over the CHANCE at index 0. The per-stack percentage
 * is index 1 and is the same 3 at every rank, so it is named here rather than
 * threaded through a second builder argument.
 */
export const IMPROVED_SCORCH_PERCENT_PER_STACK = 3;

export const improvedScorchReaction: TalentReactionBuilder = (chancePercent) => ({
  id: 'improved_scorch',
  on: 'dealt',
  outcomes: ['hit', 'crit'],
  canTrigger: (context, _actor, attack) =>
    attack.abilityId === 'scorch' && context.rng.rollChance(chancePercent / 100),
  onTrigger: (context, actor, attack) => {
    context.applyAura(
      attack.defender,
      fireVulnerabilityAura(IMPROVED_SCORCH_PERCENT_PER_STACK),
      actor.id,
    );
  },
});

export const MAGE_TALENT_REACTIONS: Readonly<Record<string, TalentReactionBuilder>> = {
  ignite,
  master_of_elements: masterOfElements,
  hot_streak: hotStreak,
  arcane_concentration: arcaneConcentration,
  missile_barrage: missileBarrage,
  improved_scorch: improvedScorchReaction,
};
