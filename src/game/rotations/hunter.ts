import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { TalentAllocation } from '../talents/Talent';

/**
 * Hunter priority lists — MEASURED, though still not the ruleset owner's own.
 *
 * ----------------------------------------------------------------------------
 * WHAT CHANGED IS THAT EVERY ENTRY IS NOW ARGUED FROM A NUMBER. Each variant
 * was measured over 30 batches of 10 fights, and a difference inside the
 * interval was treated as no difference. The three lists disagree with each
 * other on purpose, and each says why.
 *
 * THE ONE RULE THAT DECIDED MOST OF IT: A CAST RESETS THE SWING TIMER.
 * `resetSwingTimers` runs for any ability with a cast time and covers the
 * RANGED slot, so a two-second Aimed Shot throws away most of a 3.2-second bow
 * cycle -- and auto-shot is 42% of a Marksmanship Hunter's damage. The per-use
 * damage of a shot says nothing about this, which is why the list that read as
 * obvious was worth 23 DPS less than the one that drops the heaviest shot in
 * the book.
 *
 * TWO OF THE THREE RUN OUT OF MANA, and that decides the rest. A geared Hunter
 * empties 3,651 mana by the 30-second mark and spends the REST OF THE FIGHT on
 * auto-shot alone, so what binds is damage per MANA rather than damage per
 * global cooldown. The melee build is the opposite -- it ends with 44% of its
 * mana unspent -- which is why an instant shot was worth 55 DPS to it.
 *
 * CHOSEN BY TALENTS. All three builds could be `ranged`, and the Lone Wolf
 * melee one is not -- so style separates that one and the capstones separate
 * the other two.
 *
 * EVERY LIST OPENS WITH AN ASPECT, which is not decoration: an Aspect is
 * exclusive like a stance, nothing is up at the pull, and a ranged build with
 * no Aspect of the Hawk is missing 120 ranged attack power for the whole
 * fight. Its `canCast` refuses once it is up, so the entry falls through.
 *
 * HUNTER'S MARK IS IN TWO LISTS OF THE THREE, and that is measured rather than
 * assumed. It is +71 ranged attack power for two minutes off one instant cast,
 * which sounds like something every Hunter should open with -- and over 40
 * batches it is +8.0 to Beast Mastery, +0.8 to Lone Wolf Ranged inside a 3.3
 * interval, and **-10.1 to Lone Wolf Melee**. Ranged attack power buys a melee
 * build almost nothing, and the global cooldown at the pull costs it a real
 * opener. Measuring the stat on its own said +1.9 for that build; measuring
 * the ABILITY, which also spends 60 mana and a global cooldown, said the
 * opposite.
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
 * HUNTER'S MARK IS WORTH THE MOST HERE, +8.0, and it is the only list where it
 * is a clear gain: this build has the fewest competing uses for 60 mana, and a
 * pet carrying a third of the damage makes the global cooldown cheap.
 *
 * THE HAWK LOSES TO ARCANE SHOT, and the note that used to sit here said the
 * opposite. They share a cooldown group, so every six seconds is one or the
 * other -- and "a hawk is 32 damage a tick for eighteen seconds against Arcane
 * Shot's one hit" counted the hawk's ticks and not its price. Measured, putting
 * Arcane Shot above it is worth +20 DPS, and once it is above, the hawk never
 * fires at all.
 *
 * IT IS KEPT, LAST, rather than deleted. It measures identical to removing it,
 * and a build with mana to spare would use it -- so this stays a priority
 * decision rather than a deletion.
 *
 * AIMED SHOT STAYS HERE THOUGH THE MARKSMANSHIP LIST DROPS IT, which is the
 * one place these lists genuinely disagree. Beast Mastery has no Sniper Shot
 * to spend mana on, so Aimed is its best remaining sink, and the pet carries
 * enough of the damage that the auto-shot the cast interrupts is a smaller
 * share. Worth +4 here against -23 there.
 */
export const HUNTER_BEAST_MASTERY: readonly PriorityEntry[] = [
  { abilityId: 'aspect_of_the_hawk' },
  { abilityId: 'hunters_mark' },
  { abilityId: 'bestial_wrath' },
  { abilityId: 'serpent_sting', condition: missingOn('serpent_sting') },
  { abilityId: 'rapid_fire' },
  { abilityId: 'arcane_shot' },
  { abilityId: 'aimed_shot' },
  { abilityId: 'summon_hawk' },
];

/**
 * LONE WOLF RANGED — no pet, and 20% more damage for not having one.
 *
 * 7/39/5, the deep Marksmanship build.
 *
 * NO AIMED SHOT, AND IT IS THE HEAVIEST SHOT IN THE BOOK. 784 damage a cast
 * against Sniper Shot's 638, which is exactly why it used to be here -- and
 * dropping it is worth +23 DPS. Two seconds of cast time RESETS THE BOW, whose
 * cycle is 3.2 seconds and whose auto-shots are 42% of this build's damage,
 * and the 310 mana it spends is mana Sniper Shot does not get. This Hunter is
 * dry by the 30-second mark and spends half the fight auto-shooting.
 *
 * So the ranking is damage per MANA and not damage per cast -- Serpent Sting
 * 4.13, Sniper Shot 3.19, Arcane Shot 2.57, Aimed Shot 2.53 -- and the one
 * with a cast time comes last on both counts.
 *
 * MULTI-SHOT IS OUT FOR THE SAME REASON, tested and worth -1: half a second of
 * cast still resets the same bow.
 *
 * HUNTER'S MARK IS KEPT THOUGH IT MEASURES AS NOTHING, +0.8 inside a 3.3
 * interval. The 71 ranged attack power it buys is real and the 60 mana it
 * spends comes out of a build that is dry by the thirty-second mark, and the
 * two cancel. It stays because a Hunter marks its target and it costs nothing
 * measurable -- stated, because "no measured difference" is not "a gain".
 *
 * SNIPER ABOVE ARCANE IS NOT A MEASURED DIFFERENCE. Over 80 batches they are
 * 0.55 apart inside a 2.26 interval, so the capstone goes first on the grounds
 * that it hits harder and nothing argues otherwise.
 */
export const HUNTER_LONE_WOLF_RANGED: readonly PriorityEntry[] = [
  { abilityId: 'aspect_of_the_hawk' },
  { abilityId: 'hunters_mark' },
  { abilityId: 'serpent_sting', condition: missingOn('serpent_sting') },
  { abilityId: 'rapid_fire' },
  { abilityId: 'sniper_shot' },
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
 * SERPENT STING NEAR THE BOTTOM. It is a ranged special and this build stands
 * in melee with Aspect of the BEAST up, so its ranged attack power is the
 * unbuffed one and the sting's 15% coefficient reads that. Still worth a
 * global cooldown, which is why it is low rather than absent -- and moving it
 * to the top is worth nothing measurable.
 *
 * ARCANE SHOT AT THE BOTTOM IS THE BIGGEST SINGLE ENTRY IN ANY OF THESE LISTS,
 * at +55 DPS. This is the build that does NOT run out of mana -- it ends a
 * fight with 44% unspent -- so the cooldowns on its melee abilities leave
 * global cooldowns with nothing to put in them. An instant shot fills them
 * with mana that was otherwise going to waste.
 *
 * AND ONLY AN INSTANT ONE. Adding Aimed Shot as well is -17 and Multi-Shot is
 * -7, because a cast resets the MELEE swing here and this build's auto-attack
 * is its single largest share. The same rule that removes Aimed Shot from the
 * Marksmanship list keeps it out of this one.
 *
 * ASPECT OF THE BEAST IS CORRECT AND WAS WORTH CHECKING -- swapping it for
 * Aspect of the Hawk costs 35 DPS, because Forever's Beast grants MELEE attack
 * power and this Hunter swings a two-hander.
 *
 * NO HUNTER'S MARK, WHICH IS THE ONE LIST IT DOES NOT BELONG IN. +71 RANGED
 * attack power is worth about 1.9 to a build whose damage is melee swings,
 * melee specials and a sting -- and the ability also costs a global cooldown
 * at the pull. Measured at -10.1 over 40 batches, against a 7.7 interval. The
 * Hunter would still cast it in the game; it is not in the damage list because
 * the damage list is measured.
 */
export const HUNTER_LONE_WOLF_MELEE: readonly PriorityEntry[] = [
  { abilityId: 'aspect_of_the_beast' },
  { abilityId: 'mongoose_bite', condition: hasAura('expose_prey') },
  { abilityId: 'raptor_strike' },
  { abilityId: 'strider_kick' },
  { abilityId: 'rapid_fire' },
  { abilityId: 'serpent_sting', condition: missingOn('serpent_sting') },
  { abilityId: 'arcane_shot' },
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
