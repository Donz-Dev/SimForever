import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { TalentAllocation } from '../talents/Talent';
import { IMPROVED_SCORCH_MAX_STACKS } from '../auras/mage';

/**
 * Mage priority lists — APL SHELLS.
 *
 * ----------------------------------------------------------------------------
 * SHELLS, AND SAID TO BE, as every list since the Warrior's has been. These
 * are the standard shape of each build and are NOT the ruleset owner's own,
 * which have not been given for this class.
 *
 * CHOSEN BY TALENTS, the ROGUE'S arrangement rather than the Warrior's. All
 * three Mage builds are `caster` and the Mage has no stances and one form, so
 * style cannot tell them apart -- and unlike the Rogue there is no single
 * capstone that does it either, because the Frostfire build's points are split
 * 0/29/22 with no 31-point talent at all. The TREE WITH THE MOST POINTS is
 * what names the spec, which is how a person reads a build too.
 * ----------------------------------------------------------------------------
 */

const hasAura = (auraId: string) => (_context: SimulationContext, actor: Combatant): boolean =>
  actor.auras.has(auraId);

/** Below the cap, so the opener stacks it and the rest of the fight does not. */
const belowStacks = (auraId: string, cap: number) =>
  (_context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined && target.auras.stacksOf(auraId) < cap;

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
  { abilityId: 'combustion' },
  {
    abilityId: 'scorch',
    condition: belowStacks('fire_vulnerability', IMPROVED_SCORCH_MAX_STACKS),
  },
  { abilityId: 'pyroblast', condition: hasAura('hot_streak') },
  { abilityId: 'fire_blast' },
  { abilityId: 'blast_wave' },
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
  {
    abilityId: 'scorch',
    condition: belowStacks('fire_vulnerability', IMPROVED_SCORCH_MAX_STACKS),
  },
  { abilityId: 'pyroblast', condition: hasAura('hot_streak') },
  { abilityId: 'fire_blast' },
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
  { abilityId: 'arcane_power' },
  { abilityId: 'presence_of_mind' },
  { abilityId: 'arcane_missiles', condition: hasAura('missile_barrage') },
  {
    abilityId: 'arcane_blast',
    condition: (_context, actor) =>
      actor.auras.stacksOf('arcane_blast') < ARCANE_BLAST_STACK_LIMIT,
  },
  { abilityId: 'arcane_missiles' },
];

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
    'hot_streak',
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
