import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { TalentAllocation } from '../talents/Talent';
import { HEATING_UP_MAX_STACKS, IMPROVED_SCORCH_MAX_STACKS } from '../auras/mage';

/**
 * Mage priority lists.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S OWN LISTS. Every list in this file was specified by them,
 * entry by entry, and measured after -- so a number taken off one describes the
 * ruleset rather than this file's guess.
 *
 * IT SAID THE OPPOSITE FOR MOST OF THIS PROJECT'S LIFE, and the header that
 * said so was doing real work: "these are the standard shape of each build and
 * are NOT the ruleset owner's own lists, which have not been given." That is
 * how a shell is supposed to read, and it is why the figures measured off one
 * were never mistaken for the ruleset's.
 *
 * CHOSEN BY TALENTS, the ROGUE'S arrangement rather than the Warrior's. All
 * three Mage builds are `caster` and the Mage has no stances and one form, so
 * style cannot tell them apart -- and unlike the Rogue there is no single
 * capstone that does it either, because the Frostfire build's points are split
 * 0/29/22 with no 31-point talent at all. The TREE WITH THE MOST POINTS is
 * what names the spec, which is how a person reads a build too.
 * ----------------------------------------------------------------------------
 */


/*
 * ============================================================================
 * THE RULESET OWNER'S CONDITIONS. All three lists below are theirs; what was
 * here before was this file's own guess and said so.
 * ============================================================================
 */

/** "<buff> is not active", on the Mage. */
const selfExpired = (auraId: string) =>
  (context: SimulationContext, actor: Combatant): boolean =>
    actor.auras.remainingMs(auraId, context.clock.now()) <= 0;

/** "<buff> stacks = N", on the Mage. */
const selfStacksExactly = (auraId: string, count: number) =>
  (_context: SimulationContext, actor: Combatant): boolean =>
    actor.auras.stacksOf(auraId) === count;

/** "<buff> stacks >= N", on the Mage. */
const selfStacksAtLeast = (auraId: string, minimum: number) =>
  (_context: SimulationContext, actor: Combatant): boolean =>
    actor.auras.stacksOf(auraId) >= minimum;

/** "<buff> stacks > 0", on the Mage. */
const selfHasStack = (auraId: string) => selfStacksAtLeast(auraId, 1);

/** "<debuff> stacks >= N", on the target. */
const targetStacksAtLeast = (auraId: string, minimum: number) =>
  (_context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined && target.auras.stacksOf(auraId) >= minimum;

/** "<debuff> duration <= N seconds", on the target. An absent debuff counts. */
const targetAuraAtMost = (auraId: string, secondsLeft: number) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined &&
    target.auras.remainingMs(auraId, context.clock.now()) <= secondsLeft * 1000;

/** "<debuff> duration >= N seconds", on the target. */
const targetAuraAtLeast = (auraId: string, secondsLeft: number) =>
  (context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined &&
    target.auras.remainingMs(auraId, context.clock.now()) >= secondsLeft * 1000;

/** "<debuff> stacks < N", on the target. */
const targetStacksBelow = (auraId: string, cap: number) =>
  (_context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined && target.auras.stacksOf(auraId) < cap;

/**
 * "The character actually has <reaction>", which is how a list asks whether a
 * TALENT was taken.
 *
 * ----------------------------------------------------------------------------
 * IT READS THE BUILT CHARACTER AND NOT THE BUILD, which is the arrangement
 * this codebase already uses to gate Charge behind Vanguard: the talent puts
 * something on the character and the rule reads that, so no list has to name a
 * talent id and no rank arithmetic happens here.
 *
 * A REACTION IS THE RIGHT THING TO READ FOR THIS ONE. Improved Scorch IS its
 * reaction -- the Fire Vulnerability debuff is applied by it and by nothing
 * else -- so "does this character have the reaction" and "is Scorch worth
 * casting for the debuff" are the same question. Asking the ability book would
 * not work: Scorch is a trainer spell every Mage owns.
 * ----------------------------------------------------------------------------
 */
const hasReaction = (reactionId: string) =>
  (_context: SimulationContext, actor: Combatant): boolean =>
    actor.reactions.some((reaction) => reaction.id === reactionId);

/** "Mana is at or below N% of maximum." */
const selfResourceBelowPercent = (resource: 'mana', percent: number) =>
  (_context: SimulationContext, actor: Combatant): boolean => {
    const pool = actor.resources.get(resource);
    if (!pool || pool.maximum <= 0) return false;
    return (pool.current / pool.maximum) * 100 <= percent;
  };

/** "<buff> is not on the Mage at all." */
const selfLacks = (auraId: string) =>
  (_context: SimulationContext, actor: Combatant): boolean => !actor.auras.has(auraId);

type Condition = (
  context: SimulationContext,
  actor: Combatant,
  target?: Combatant,
) => boolean;

const all =
  (...conditions: readonly Condition[]): Condition =>
  (context, actor, target) =>
    conditions.every((condition) => condition(context, actor, target));

const either =
  (...conditions: readonly Condition[]): Condition =>
  (context, actor, target) =>
    conditions.some((condition) => condition(context, actor, target));

/*
 * ----------------------------------------------------------------------------
 * "SCORCH IF SCORCH DEBUFF < 5", CONFIRMED BY THE RULESET OWNER.
 *
 * The spec said `<= 5` and it was implemented as `< 5`, flagged as an
 * interpretation, and the owner has since settled it in those words: "scorch
 * should be cast if there are <5 stacks of it, not <=5". So the reading that
 * was chosen is the one intended, and this is no longer a question.
 *
 * WHY IT COULD NOT BE TAKEN LITERALLY. Fire Vulnerability caps at five stacks,
 * so `<= 5` is always true -- Scorch would be unconditional and every entry
 * below it in the Fire and Frostfire lists unreachable. The evidence for `< 5`
 * was the owner's own Combustion entry using `>= 5` to mean "at cap", and the
 * rule this project follows: implement the reading that leaves every clause
 * doing work, name the constant, and say which reading was chosen. Both halves
 * of that worked -- the reading was right and the flag is what got it asked.
 * ----------------------------------------------------------------------------
 */
const SCORCH_STACK_CAP = IMPROVED_SCORCH_MAX_STACKS;
/** "or scorch duration <= 3 seconds", which refreshes it before it drops. */
const SCORCH_REFRESH_SECONDS = 3;

/*
 * ----------------------------------------------------------------------------
 * AND ONLY IF THE BUILD HAS IMPROVED SCORCH AT ALL, which the ruleset owner
 * has now added. Without the talent, Scorch applies no Fire Vulnerability --
 * so the two clauses below are permanently true, Scorch becomes an
 * unconditional entry near the top of two lists, and every entry beneath it is
 * unreachable. That is the same failure the `<= 5` reading would have caused,
 * arrived at from the other direction: there the cap made the test always
 * true, here the absent debuff does.
 *
 * AND IT IS NOT HYPOTHETICAL FOR A LIST THAT SERVES SEVERAL BUILDS. All three
 * of the owner's Mage profiles take Improved Scorch 3/3 today, so this changes
 * none of them -- it is a guard on the LIST rather than a fix to a profile,
 * and the reason to put it in now is that an untalented Fire mage running the
 * Fire list would otherwise cast a 181-damage spell over a 483-damage one for
 * a whole fight and look perfectly ordinary doing it.
 * ----------------------------------------------------------------------------
 */
/*
 * ============================================================================
 * EVOCATION AT 10% MANA, IN ALL THREE LISTS, by the ruleset owner.
 *
 * ONCE A FIGHT EFFECTIVELY -- an eight-minute cooldown against a one-minute
 * encounter -- so the only decision the list makes is WHEN, and the owner has
 * set it at a tenth of the pool. That is late on purpose: the channel is eight
 * seconds of casting nothing, so spending it early means paying the eight
 * seconds for mana the Mage had not yet run out of.
 *
 * ABOVE EVERYTHING BUT THE ARMOR, because a conditional entry that is almost
 * never true costs the entries below it nothing -- and when it IS true, a Mage
 * at 10% mana is about to be unable to cast its filler anyway.
 *
 * ----------------------------------------------------------------------------
 * IT FIRES ON NO PROFILE AT ALL, AND THE OWNER HAS RULED THAT INTENDED.
 *
 * None of the three Mage builds now drops to a tenth of its pool -- the Fire one
 * stopped running dry when Heating Up became consumed by a single Pyroblast, so
 * it spends 7,854 mana of 9,751 instead of emptying the bar. Measured at ZERO
 * casts across three profiles and twenty seeds each.
 *
 * Reported to the owner with the threshold offered as the thing to move, and the
 * answer was **"This is intended"** (2026-10-08). So the entry stays where it is
 * at the threshold it has, and **a never-fired entry is not therefore a defect**
 * -- the second time the owner's list has outranked a measurement of ours, after
 * Hunter's Mark's -10.1. It is a safety net that costs nothing: it pays out only
 * in a fight that goes differently from the ones measured, which is what a 10%
 * gate is for.
 *
 * DO NOT "FIX" THE ZERO. `mageAbilities.test.ts` records it as a known fact and
 * asserts the invariant -- the entry present in all three lists at the owner's
 * threshold, with the condition answering correctly on both sides of it -- rather
 * than a cast count, which three unrelated changes had already invalidated.
 * ----------------------------------------------------------------------------
 * ============================================================================
 */
const EVOCATION_MANA_PERCENT = 10;
const evocationNeeded = selfResourceBelowPercent('mana', EVOCATION_MANA_PERCENT);

const scorchNeeded = all(
  hasReaction('improved_scorch'),
  either(
    targetStacksBelow('fire_vulnerability', SCORCH_STACK_CAP),
    targetAuraAtMost('fire_vulnerability', SCORCH_REFRESH_SECONDS),
  ),
);

// ---------------------------------------------------------------------------

/**
 * FIRE — Scorch to five stacks, then Fireball, with Pyroblast on Hot Streak.
 *
 * SCORCH FIRST AND ONLY UNTIL IT CAPS. Improved Scorch is a stacking FIRE
 * VULNERABILITY on the target worth 3% a stack, so the first few casts buy
 * every Fire spell after them a discount. Once it is at five, Scorch is a
 * 181-damage spell and Fireball is a 483-damage one, so the condition stops
 * casting it rather than a timer doing so.
 *
 * PYROBLAST ONLY WITH HOT STREAK. Six seconds of cast time for 583 is worse
 * than two Fireballs; at three Hot Streak stacks it is a second and a half,
 * which is better than either. The entry says exactly that.
 *
 * COMBUSTION AND FIRE BLAST ON COOLDOWN, both instants that cost nothing but
 * a global cooldown.
 */
export const MAGE_FIRE: readonly PriorityEntry[] = [
  { abilityId: 'mage_armor', condition: selfExpired('mage_armor') },
  { abilityId: 'evocation', condition: evocationNeeded },
  { abilityId: 'scorch', condition: scorchNeeded },
  /*
   * AT THREE STACKS, WHICH IS THE CAP. Hot Streak takes a quarter off
   * Pyroblast's cast per stack, so three turns a six-second cast into a second
   * and a half -- the only point at which it beats two Fireballs.
   */
  { abilityId: 'pyroblast', condition: selfStacksExactly('heating_up', HEATING_UP_MAX_STACKS) },
  /*
   * COMBUSTION ONLY WITH THE DEBUFF CAPPED AND HOLDING. It is a crit cooldown,
   * so it is worth most when every Fire spell under it is already taking the
   * full Fire Vulnerability -- and the ten-second floor is what stops it being
   * spent on a stack about to fall off.
   */
  {
    abilityId: 'combustion',
    condition: all(
      targetStacksAtLeast('fire_vulnerability', IMPROVED_SCORCH_MAX_STACKS),
      targetAuraAtLeast('fire_vulnerability', 10),
    ),
  },
  { abilityId: 'fireball' },
];

/**
 * FROSTFIRE — Frostfire Bolt as the filler, with the same Scorch opener.
 *
 * 0/29/22, WITH NO CAPSTONE IN EITHER TREE. It is the Fire tree's cast-time
 * and crit talents plus the Frost tree's crit damage, and Frostfire Bolt is
 * what both halves scale: Improved Fireball shortens it, Fire Power raises it,
 * and Ice Shards raises its crits because it is the one spell that is both.
 *
 * ICE LANCE IS IN THE BOOK AND NOT IN THE LIST. Its 300% clause needs a frozen
 * target and nothing freezes a raid boss, so what is left is a 148-damage
 * instant for 160 mana -- worse per global cooldown than anything above it.
 * Left out deliberately rather than forgotten.
 */
export const MAGE_FROSTFIRE: readonly PriorityEntry[] = [
  { abilityId: 'mage_armor', condition: selfExpired('mage_armor') },
  { abilityId: 'evocation', condition: evocationNeeded },
  { abilityId: 'scorch', condition: scorchNeeded },
  { abilityId: 'pyroblast', condition: selfStacksExactly('heating_up', HEATING_UP_MAX_STACKS) },
  /*
   * ICE LANCE ENTERS A LIST FOR THE FIRST TIME. Its 300% clause was inert for
   * as long as nothing could make the target count as Frozen; Fingers of Frost
   * does not freeze anything, it makes the caster's next spells behave as
   * though it were. With a charge in hand it is a times-four instant.
   */
  { abilityId: 'ice_lance', condition: selfHasStack('fingers_of_frost') },
  { abilityId: 'frostfire_bolt' },
];

/**
 * ARCANE — Arcane Blast until it is too expensive, Missiles on a proc.
 *
 * THE COST ESCALATION IS THE WHOLE ROTATION. Arcane Blast is 140 mana at no
 * stacks and 175% more per stack, so a fourth cast costs eight times the
 * first. The list spends up to a threshold and then lets the debuff fall off
 * during an Arcane Missiles channel, which is what makes Missile Barrage worth
 * having: the channel is both the damage and the pause.
 *
 * MISSILE BARRAGE FIRST, because a procced Arcane Missiles is free, half as
 * long, and the reason to stop casting Arcane Blast at all.
 *
 * PRESENCE OF MIND AND ARCANE POWER ON COOLDOWN. Presence of Mind makes the
 * next cast instant, which is worth most on the longest one it can reach --
 * but the list uses it on cooldown rather than saving it, because a shell that
 * hoards a three-minute cooldown for a perfect moment is describing a player
 * and not a rotation.
 */
export const ARCANE_BLAST_STACK_LIMIT = 2;

export const MAGE_ARCANE: readonly PriorityEntry[] = [
  { abilityId: 'mage_armor', condition: selfExpired('mage_armor') },
  { abilityId: 'evocation', condition: evocationNeeded },
  /*
   * ARCANE POWER SPENT INTO A PROC RATHER THAN ON COOLDOWN, which is the shape
   * of the owner's whole list: it fires only when a free, half-length Arcane
   * Missiles is already waiting AND Arcane Blast has stacked its damage bonus
   * three deep. A three-minute cooldown held for the moment it is worth most,
   * where this file's shell spent it the instant it came up.
   */
  {
    abilityId: 'arcane_power',
    condition: all(selfHasStack('missile_barrage'), selfStacksAtLeast('arcane_blast', 3)),
  },
  { abilityId: 'arcane_missiles', condition: selfHasStack('missile_barrage') },
  /*
   * AND AT FOUR ARCANE BLAST STACKS WITHOUT ONE. Four is the cap, where the
   * next Blast costs 175% more for no further damage bonus -- so the list
   * spends the stack on Missiles rather than paying that price.
   *
   * A repeated ability id is legal; what is not is a copy below an
   * UNCONDITIONAL one. Both entries are gated and Arcane Blast is the filler.
   */
  { abilityId: 'arcane_missiles', condition: selfStacksExactly('arcane_blast', 4) },
  /*
   * PRESENCE OF MIND AT EXACTLY ONE ARCANE BLAST STACK, WITHOUT A BARRAGE, by
   * the ruleset owner -- and it was in no list at all before, which the
   * handoff recorded as deliberate: "it makes the next cast instant, and the
   * shell used it on cooldown; the owner's order does not name it".
   *
   * WHAT THE CONDITION BUYS. The next cast after this one is Arcane Blast --
   * the filler below, and nothing between here and there can fire, because
   * Missile Barrage is excluded by this entry's own condition and the
   * four-stack Missiles entry cannot be true at one stack. So the instant goes
   * where the owner aimed it rather than wherever the list happened to be.
   *
   * ONE STACK AND NOT FOUR, which is the opposite of where a damage cooldown
   * goes and is the point: the stacks raise the cost of Arcane Blast by 175%
   * each, so the CHEAP Blast is the one worth making free of its cast time,
   * and the expensive ones are what the Missiles entry above is for.
   *
   * `requiresCastTime` on its aura is what stops the charge being eaten by an
   * instant, so this cannot be wasted on the Mage Armor or Evocation entries
   * above it.
   */
  {
    abilityId: 'presence_of_mind',
    condition: all(
      selfStacksExactly('arcane_blast', 1),
      selfLacks('missile_barrage'),
    ),
  },
  { abilityId: 'arcane_blast' },
];

/*
 * PRESENCE OF MIND IS NOT IN THE OWNER'S LIST and is left out rather than kept.
 * It makes the next cast instant, and the shell used it on cooldown; the
 * owner's order does not name it at all.
 */

/**
 * How much Frost makes a mostly-Fire build a FROSTFIRE one.
 *
 * The owner's Frostfire build is 0/29/22 and the Fire one is 10/39/2, so
 * anything between those two works; fifteen is stated rather than tuned.
 */
export const FROSTFIRE_FROST_THRESHOLD = 15;

export const MAGE_FIRE_ROTATION: Rotation = new PriorityRotation('Mage (Fire)', MAGE_FIRE);
export const MAGE_FROSTFIRE_ROTATION: Rotation = new PriorityRotation(
  'Mage (Frostfire)',
  MAGE_FROSTFIRE,
);
export const MAGE_ARCANE_ROTATION: Rotation = new PriorityRotation('Mage (Arcane)', MAGE_ARCANE);

/**
 * Which list a Mage runs, from where its points went.
 *
 * THE TREE WITH THE MOST POINTS NAMES THE SPEC, which is how a person reads a
 * build. A capstone cannot do it here: the Frostfire build is 0/29/22 and has
 * no 31-point talent in either tree, so the Rogue's test would find nothing
 * and fall through to a default that describes none of the three.
 */
export function mageRotation(talents: TalentAllocation): Rotation | undefined {
  const spent = (ids: readonly string[]) =>
    ids.reduce((total, id) => total + (talents[id] ?? 0), 0);

  /*
   * ALL THREE TREES ARE COUNTED, and the first version of this counted two.
   * It compared Arcane against Frost and never looked at Fire, so the 10/39/2
   * Fire build -- ten Arcane points against two Frost -- came back as ARCANE
   * and ran a list built around a spell it has one point in. It produced a
   * perfectly ordinary 143.9 DPS while casting nothing but Arcane Missiles.
   *
   * Named rather than derived from the tree data, so this file states which
   * talents it considers which tree and a rename fails a test rather than
   * quietly reclassifying a build.
   */
  const arcane = spent([
    'wand_specialization',
    'arcane_focus',
    'improved_channeling',
    'arcane_subtlety',
    'magic_absorption',
    'arcane_concentration',
    'arcane_resilience',
    'arcane_geometry',
    'arcane_impact',
    'arcane_blast',
    'arcane_shielding',
    'improved_counterspell',
    'arcane_meditation',
    'missile_barrage',
    'presence_of_mind',
    'arcane_mind',
    'arcane_instability',
    'arcane_power',
  ]);
  const fire = spent([
    'wake_of_fire',
    'incineration',
    'improved_fireball',
    'ignite',
    'flame_throwing',
    'impact',
    'burning_soul',
    'improved_flamestrike',
    'pyroblast',
    'improved_scorch',
    'improved_fire_ward',
    'heating_up',
    'master_of_elements',
    'critical_mass',
    'blast_wave',
    'fire_power',
    'combustion',
  ]);
  const frost = spent([
    'frost_warding',
    'improved_frostbolt',
    'elemental_precision',
    'ice_shards',
    'permafrost',
    'improved_frost_nova',
    'frostbite',
    'piercing_ice',
    'frost_channeling',
    'ice_lance',
    'improved_blizzard',
    'arctic_reach',
    'ice_block',
    'shatter',
    'improved_cone_of_cold',
    'cold_snap',
    'fingers_of_frost',
    'winter_s_chill',
    'ice_barrier',
  ]);

  /*
   * A MAGE WITH NO TALENTS STILL GETS A LIST, and falls through to Fire below.
   *
   * Returning nothing would leave it standing still -- a `caster` has no
   * auto-attack, so no rotation means no damage at all -- and it has a
   * trainer's Fireball and Scorch in hand either way. The Fire list names two
   * talent-granted abilities it will not have, and `PriorityRotation` skips
   * an entry whose ability is not in the book, which is the same thing every
   * other class's list relies on.
   */
  if (arcane > fire && arcane > frost) return MAGE_ARCANE_ROTATION;
  /*
   * FROST POINTS MAKE IT FROSTFIRE, not Frost. There is no pure Frost profile
   * in the owner's list, and the 0/29/22 build's Frost half exists to scale
   * Frostfire Bolt's crits rather than to cast Frostbolt -- so a build with
   * real Frost investment runs the Frostfire list even though Fire has more
   * points in it.
   */
  if (frost >= FROSTFIRE_FROST_THRESHOLD) return MAGE_FROSTFIRE_ROTATION;
  return MAGE_FIRE_ROTATION;
}
