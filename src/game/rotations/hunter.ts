import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { TalentAllocation } from '../talents/Talent';

/**
 * Hunter priority lists — APL SHELLS.
 *
 * ----------------------------------------------------------------------------
 * SHELLS, AND SAID TO BE. Not the ruleset owner's own lists.
 *
 * CHOSEN BY TALENTS. All three builds could be `ranged`, and the Lone Wolf
 * melee one is not -- so style separates that one and the capstones separate
 * the other two.
 *
 * EVERY LIST OPENS WITH AN ASPECT, which is not decoration: an Aspect is
 * exclusive like a stance, nothing is up at the pull, and a ranged build with
 * no Aspect of the Hawk is missing 120 ranged attack power for the whole
 * fight. Its `canCast` refuses once it is up, so the entry falls through.
 * ----------------------------------------------------------------------------
 */

const missingOn = (auraId: string) =>
  (_context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined && !target.auras.has(auraId);

const hasAura = (auraId: string) => (_context: SimulationContext, actor: Combatant): boolean =>
  actor.auras.has(auraId);

// ---------------------------------------------------------------------------

/**
 * BEAST MASTERY — the pet does the work and the Hunter feeds it cooldowns.
 *
 * 31/20/0, and its damage comes from three places at once: the Hunter's own
 * shots, the PET, and the HAWKS. The pet is a separate combatant whose damage
 * is summed into DPS; the hawks are a periodic effect on the Hunter.
 *
 * BESTIAL WRATH FIRST, because it buffs the pet for eighteen seconds and the
 * pet is the largest single share of this build.
 *
 * SUMMON HAWK SHARES ARCANE SHOT'S COOLDOWN, so the two compete directly --
 * a hawk is 32 damage every two seconds for eighteen seconds against Arcane
 * Shot's one hit. The hawk wins on paper and is above it here for that reason.
 */
export const HUNTER_BEAST_MASTERY: readonly PriorityEntry[] = [
  { abilityId: 'aspect_of_the_hawk' },
  { abilityId: 'bestial_wrath' },
  { abilityId: 'serpent_sting', condition: missingOn('serpent_sting') },
  { abilityId: 'summon_hawk' },
  { abilityId: 'rapid_fire' },
  { abilityId: 'aimed_shot' },
  { abilityId: 'arcane_shot' },
];

/**
 * LONE WOLF RANGED — no pet, and 20% more damage for not having one.
 *
 * 7/39/5, the deep Marksmanship build. Sniper Shot is its capstone and Aimed
 * Shot is its heaviest trainer shot; both are ranged specials competing for
 * the same global cooldowns, so the list is simply the shots in order of what
 * they are worth.
 */
export const HUNTER_LONE_WOLF_RANGED: readonly PriorityEntry[] = [
  { abilityId: 'aspect_of_the_hawk' },
  { abilityId: 'serpent_sting', condition: missingOn('serpent_sting') },
  { abilityId: 'rapid_fire' },
  { abilityId: 'sniper_shot' },
  { abilityId: 'aimed_shot' },
  { abilityId: 'arcane_shot' },
];

/**
 * LONE WOLF MELEE — Aspect of the Beast, and a Hunter in melee range.
 *
 * 7/13/31, and it exists because Forever changed Aspect of the Beast to grant
 * MELEE attack power -- Classic's granted none, so this build could not have
 * been made there.
 *
 * MONGOOSE BITE IS GATED ON EXPOSE PREY, which is the only thing that opens it
 * here: the ability says "can only be performed after you dodge" and nothing
 * attacks this Hunter. Its entry reads the aura rather than hoping.
 *
 * NO SERPENT STING. It is a ranged special and this build is standing in melee
 * with Aspect of the BEAST up, so its ranged attack power is the unbuffed one
 * -- and the sting's 15% coefficient reads that. It is still worth a global
 * cooldown, which is why it is last rather than absent.
 */
export const HUNTER_LONE_WOLF_MELEE: readonly PriorityEntry[] = [
  { abilityId: 'aspect_of_the_beast' },
  { abilityId: 'mongoose_bite', condition: hasAura('expose_prey') },
  { abilityId: 'raptor_strike' },
  { abilityId: 'strider_kick' },
  { abilityId: 'rapid_fire' },
  { abilityId: 'serpent_sting', condition: missingOn('serpent_sting') },
];

export const HUNTER_BEAST_MASTERY_ROTATION: Rotation = new PriorityRotation(
  'Hunter (Beast Mastery)',
  HUNTER_BEAST_MASTERY,
);
export const HUNTER_LONE_WOLF_RANGED_ROTATION: Rotation = new PriorityRotation(
  'Hunter (Lone Wolf Ranged)',
  HUNTER_LONE_WOLF_RANGED,
);
export const HUNTER_LONE_WOLF_MELEE_ROTATION: Rotation = new PriorityRotation(
  'Hunter (Lone Wolf Melee)',
  HUNTER_LONE_WOLF_MELEE,
);

/**
 * Which list a Hunter runs.
 *
 * BEAST MASTERY BY ITS CAPSTONE. Bestial Wrath is 31 points deep and no other
 * build reaches it -- and it is also the talent that means "I have a pet",
 * which is the single largest difference between these three.
 *
 * THEN THE TWO LONE WOLF BUILDS BY STYLE, not by talents. Both take Lone Wolf
 * and both stop short of a capstone that separates them, so what tells them
 * apart is that one stands in melee and the other does not -- which is a
 * combat style and is exactly what a combat style is for.
 */
export function hunterRotation(
  style: string | undefined,
  talents: TalentAllocation,
): Rotation | undefined {
  if ((talents.bestial_wrath ?? 0) > 0) return HUNTER_BEAST_MASTERY_ROTATION;
  if (style === 'two_hander' || style === 'dual_wield') return HUNTER_LONE_WOLF_MELEE_ROTATION;
  return HUNTER_LONE_WOLF_RANGED_ROTATION;
}

/** Whether this build brings a pet. Lone Wolf is the talent that says it does not. */
export function hasPet(talents: TalentAllocation): boolean {
  return (talents.lone_wolf ?? 0) === 0;
}
