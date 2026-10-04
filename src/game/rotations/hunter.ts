import type { PriorityEntry, Rotation, SimulationContext, Combatant } from '../../engine';
import { PriorityRotation } from '../../engine';
import type { TalentAllocation } from '../talents/Talent';
import { HAWK_MAX_ACTIVE, activeHawks } from '../auras/hunter';

/**
 * Hunter priority lists — THE RULESET OWNER'S OWN, entry by entry.
 *
 * ----------------------------------------------------------------------------
 * THE HEADER USED TO SAY "still not the ruleset owner's own" AND THE COMMENTS
 * BELOW IT DESCRIBED A DIFFERENT SET OF LISTS. They were replaced by the
 * owner's, and the prose around them was not re-read: the Marksmanship note
 * still argued "NO AIMED SHOT" beside a list containing Aimed Shot, and the
 * melee note still priced Serpent Sting and Arcane Shot entries that are not in
 * it. Every measurement quoted below is true of the list it was taken in, and
 * says which. CLAUDE.md's rule about a measurement in a comment expiring was
 * written for exactly this and it happened here anyway.
 *
 * EVERY ENTRY IS STILL ARGUED FROM A NUMBER. Each variant was measured over 30
 * batches of 10 fights, and a difference inside the interval was treated as no
 * difference. The three lists disagree with each other on purpose, and each
 * says why.
 *
 * THE ONE RULE THAT DECIDED MOST OF IT: A CAST RESETS THE SWING TIMER.
 * `resetSwingTimers` runs for any ability with a cast time and covers the
 * RANGED slot, so a two-second Aimed Shot throws away most of a 3.2-second bow
 * cycle -- and auto-shot is 42% of a Marksmanship Hunter's damage. The per-use
 * damage of a shot says nothing about this, which is why every cast in the
 * owner's two ranged lists is gated on a shot having just landed and the melee
 * list contains no cast at all.
 *
 * TWO OF THE THREE RUN OUT OF MANA, and that decides the rest. A geared Hunter
 * empties 3,651 mana by the 30-second mark and spends the REST OF THE FIGHT on
 * auto-shot alone, so what binds is damage per MANA rather than damage per
 * global cooldown. The melee build is the opposite -- it ends with 44% of its
 * mana unspent -- which is why it can afford an entry the other two cannot, and
 * why Immolation Trap goes at the bottom of it.
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

/*
 * ============================================================================
 * THE RULESET OWNER'S CONDITIONS. All three lists below are theirs.
 * ============================================================================
 */

/**
 * "ONLY IF A RANGED AUTO-ATTACK HAS FIRED IN THE LAST 0.5 SECONDS", which all
 * three of the owner's shot entries with a cast time carry.
 *
 * ----------------------------------------------------------------------------
 * IT IS ABOUT THE SWING IT WOULD THROW AWAY. A cast interrupts the swing in
 * progress and RESETS that slot's timer, and `resetSwingTimers` covers the
 * RANGED slot -- so a two-second Aimed Shot started at the wrong moment
 * discards most of a 3.2-second bow cycle, and the damage it loses is on a
 * different row of the table from the damage it deals.
 *
 * Started just after a shot has landed, the cast fits inside the gap and costs
 * almost nothing. "Just after" is a question `pendingSwing` cannot answer --
 * that is the NEXT swing -- which is why `lastSwingAt` had to be added.
 *
 * THIS IS THE RULE THAT REMOVED AIMED SHOT FROM THE MARKSMANSHIP LIST once,
 * worth +23 DPS, and the owner's lists keep the ability and gate it instead.
 * ----------------------------------------------------------------------------
 */
const RANGED_WEAVE_WINDOW_MS = 500;
const shotLandedRecently =
  (windowMs: number) =>
  (context: SimulationContext, actor: Combatant): boolean =>
    actor.swungWithin('ranged', context.clock.now(), windowMs);

/**
 * "BESTIAL WRATH IF PET FRENZY IS ACTIVE", which reads across two combatants.
 *
 * A pet names its owner -- `ownerId` has been on `Combatant` since before pets
 * existed -- so the Hunter finds it by looking for the friendly actor that
 * points back. Frenzy is the pet's own proc, and Bestial Wrath is the owner's
 * cooldown: the entry spends one on the other, which is the only condition in
 * any list here that crosses actors.
 */
const petHasAura = (auraId: string) =>
  (context: SimulationContext, actor: Combatant): boolean => {
    const pet = context.combatants.find(
      (combatant) => combatant.ownerId === actor.id && combatant.isAlive,
    );
    return pet !== undefined && pet.auras.has(auraId);
  };

/** "<buff> is not active", on the Hunter -- the owner's "if not active". */
const selfExpired = (auraId: string) =>
  (context: SimulationContext, actor: Combatant): boolean =>
    actor.auras.remainingMs(auraId, context.clock.now()) <= 0;

/**
 * "CAST SUMMON HAWK IF summoned_hawks < 2", the ruleset owner's clause.
 *
 * ----------------------------------------------------------------------------
 * THE GATE MOVED FROM THE ABILITY TO THE LIST, AND THAT IS A REAL DISTINCTION
 * RATHER THAN A REFACTOR. Summon Hawk USED to refuse its own third cast, which
 * made "only 2 hawks can be active" a rule of the game; the owner's model says
 * a third cast is legal and overwrites, so the ability permits it and the list
 * is what declines. An ability says what is LEGAL, a list says what is WISE.
 *
 * WHAT IT IS WORTH: without it this list casts Summon Hawk every six seconds
 * for the whole fight, and every cast past the second spends 190 mana to
 * restart a hawk that had twelve seconds left -- on a build that runs dry. With
 * it, the entry falls through to Aimed Shot instead.
 *
 * `activeHawks` COUNTS THE TWO AURAS rather than reading a stack count, because
 * there is no longer a stack count to read: `hawk_1` and `hawk_2` are separate
 * auras with separate clocks, which is the whole point of the model.
 * ----------------------------------------------------------------------------
 */
const hawksBelowCap =
  (_context: SimulationContext, actor: Combatant): boolean =>
    activeHawks(actor) < HAWK_MAX_ACTIVE;

const missingOn = (auraId: string) =>
  (_context: SimulationContext, _actor: Combatant, target?: Combatant): boolean =>
    target !== undefined && !target.auras.has(auraId);

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
 * THE HAWK IS IN AND ARCANE SHOT IS NOT, WHICH IS THE OWNER'S LIST AND NOT AN
 * EARLIER MEASUREMENT OF OURS. Two notes have stood here saying opposite things
 * about the two -- they share a cooldown group, so every six seconds is one or
 * the other -- and both were about a 32-damage hawk. THE OWNER HAS SINCE RULED
 * THE HAWK AT 108 A STRIKE, dive included, with both of the two it can have
 * dealing damage. Whatever those measurements said, they were taken on a hawk
 * worth under a third of this one and neither survives the ruling.
 *
 * SO THIS ENTRY IS THE BIGGEST THING IN THE LIST NOW, and it is gated by the
 * ability rather than by the entry: Summon Hawk refuses at two active hawks, so
 * the list falls through to Aimed Shot instead of spending 190 mana to reset a
 * timer.
 *
 * AIMED SHOT IS GATED ON THE SHOT WINDOW, the same condition the Marksmanship
 * list puts on it. Beast Mastery has no Sniper Shot to spend mana on, so Aimed
 * is its best remaining sink.
 */
export const HUNTER_BEAST_MASTERY: readonly PriorityEntry[] = [
  /*
   * THE OWNER'S LIST OPENS WITH "disable melee auto-attacks and start ranged
   * auto-attack", AND IT IS ALREADY TRUE. A combatant's auto-attack mode comes
   * from its COMBAT STYLE, and `ranged` returns the ranged slot alone -- so
   * there is nothing for a list entry to do. Said here rather than left out
   * silently, because the instruction is in the spec.
   *
   * The same line on the melee list is the same answer in the other direction:
   * `dual_wield` swings both melee hands and never the bow.
   */
  { abilityId: 'aspect_of_the_hawk', condition: selfExpired('aspect_of_the_hawk') },
  { abilityId: 'hunters_mark', condition: selfExpired('hunters_mark') },
  { abilityId: 'serpent_sting', condition: missingOn('serpent_sting') },
  { abilityId: 'bestial_wrath', condition: petHasAura('frenzy') },
  { abilityId: 'rapid_fire' },
  { abilityId: 'summon_hawk', condition: hawksBelowCap },
  { abilityId: 'aimed_shot', condition: shotLandedRecently(RANGED_WEAVE_WINDOW_MS) },
];

/**
 * LONE WOLF RANGED — no pet, and 20% more damage for not having one.
 *
 * 7/39/5, the deep Marksmanship build.
 *
 * AIMED SHOT IS IN, GATED. An earlier version of this file dropped it and the
 * note explaining why survived the owner's list arriving with it kept: "784
 * damage a cast against Sniper Shot's 638 ... two seconds of cast RESETS THE
 * BOW, whose cycle is 3.2 seconds and whose auto-shots are 42% of this build's
 * damage", measured at +23 DPS for removing it. That was true of a list with no
 * shot-window condition. The owner's list keeps the ability and gates it on a
 * shot having just landed, which is the same rule answered a better way.
 *
 * THE RANKING IS DAMAGE PER MANA AND NOT DAMAGE PER CAST -- Serpent Sting 4.13,
 * Sniper Shot 3.19, Arcane Shot 2.57, Aimed Shot 2.53 -- because this Hunter is
 * dry by the 30-second mark and spends half the fight auto-shooting.
 *
 * MULTI-SHOT IS OUT, tested and worth -1: half a second of cast still resets
 * the same bow, and it hits three targets where there is one.
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
  { abilityId: 'aspect_of_the_hawk', condition: selfExpired('aspect_of_the_hawk') },
  { abilityId: 'hunters_mark', condition: selfExpired('hunters_mark') },
  { abilityId: 'serpent_sting', condition: missingOn('serpent_sting') },
  { abilityId: 'rapid_fire' },
  /*
   * BOTH CASTS GATED ON THE SHOT WINDOW. Sniper Shot is a FOUR-second cast --
   * it was transcribed as an instant for months and the correction cost this
   * profile 11.1% -- so it throws away more of a bow cycle than anything else
   * in the class if it is started at the wrong moment.
   *
   * --------------------------------------------------------------------------
   * SNIPER SHOT COSTS THIS LIST 12.1 DPS AND IS KEPT, WHICH IS THE OWNER'S
   * CALL. Measured at the full 30 batches of 10: 311.7 with it against 323.8
   * without, on a 2.4 interval, so REAL. An earlier single run said +7.9 and
   * this is the number that replaces it.
   *
   * AND NO PLACEMENT HELPS. Moving it BELOW Arcane Shot measures 311.7 to the
   * decimal and it still fires twice a fight -- because Arcane Shot has a
   * six-second cooldown of its own, so it is not a floor under anything. The
   * rule that an unconditional entry blocks everything below it holds only for
   * an entry with no cooldown, which is worth knowing before reordering any
   * list. The 12.1 is the price of the ability, not of its position.
   *
   * WHY IT LOSES: four seconds of cast resets the ranged swing timer, and this
   * build's auto-shot is 49.7% of its damage on a 3.2-second cycle. 295 damage
   * and 365 mana do not pay for a cycle and a quarter of bow.
   *
   * THE OWNER'S LIST OUTRANKS THE MEASUREMENT AND THE MEASUREMENT STAYS -- the
   * same arrangement Hunter's Mark's -10.1 has on the melee list below. Asked
   * directly, the owner chose to keep it. `petsAndHunter.test.ts` pins that the
   * ability is CAST, which is an invariant, and not that it belongs in the
   * list, which is a decision that can change owner.
   * --------------------------------------------------------------------------
   */
  { abilityId: 'aimed_shot', condition: shotLandedRecently(RANGED_WEAVE_WINDOW_MS) },
  { abilityId: 'sniper_shot', condition: shotLandedRecently(RANGED_WEAVE_WINDOW_MS) },
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
 * IT SHOOTS NOTHING, AND THE NOTES THAT SAID OTHERWISE WERE ABOUT A DIFFERENT
 * LIST. This file used to price a Serpent Sting entry "near the bottom" and an
 * Arcane Shot entry at "+55 DPS, the biggest single entry in any of these
 * lists" -- both real measurements, both taken on this project's own shell, and
 * neither ability is in the owner's list. Recorded because they are the reason
 * to ask the owner about it rather than quietly adding an entry: this build
 * ends a fight with 44% of its mana unspent, so a cheap instant has somewhere
 * to go.
 *
 * IMMOLATION TRAP IS WHERE THAT SPARE MANA GOES NOW, and the owner placed it:
 * "add it to the LW melee APL after strider kick". 245 mana for 690 fire damage
 * over 15 seconds on a 30-second cooldown, and Resourcefulness takes 60% off
 * the cost for this build -- so it is the cheapest entry in the list by a wide
 * margin.
 *
 * NO CAST TIME ANYWHERE IN IT, which is the rule the whole list obeys. A cast
 * resets the MELEE swing here and this build's auto-attack is its single
 * largest share: Aimed Shot measured -17 and Multi-Shot -7 when they were
 * tried.
 *
 * ASPECT OF THE BEAST IS CORRECT AND WAS WORTH CHECKING -- swapping it for
 * Aspect of the Hawk costs 35 DPS, because Forever's Beast grants MELEE attack
 * power and this Hunter swings a two-hander.
 *
 * RAPID FIRE IS IN IT NOW, and it should have been all along: "ranged AND
 * MELEE attack speed by 40%". It was absent for as long as this build swung a
 * two-hander and nobody re-read the list against the ability book -- the other
 * two Hunter lists have always had it.
 *
 * NO HUNTER'S MARK, WHICH IS THE ONE LIST IT DOES NOT BELONG IN. +71 RANGED
 * attack power is worth about 1.9 to a build whose damage is melee swings,
 * melee specials and a sting -- and the ability also costs a global cooldown
 * at the pull. Measured at -10.1 over 40 batches, against a 7.7 interval. The
 * Hunter would still cast it in the game; it is not in the damage list because
 * the damage list is measured.
 */
export const HUNTER_LONE_WOLF_MELEE: readonly PriorityEntry[] = [
  { abilityId: 'aspect_of_the_beast', condition: selfExpired('aspect_of_the_beast') },
  { abilityId: 'hunters_mark', condition: selfExpired('hunters_mark') },
  /*
   * RAPID FIRE, AND IT WAS IN THE BOOK AND IN NO LIST. "Increases RANGED AND
   * MELEE attack speed by 40% for 15 sec" -- the melee half is why it belongs
   * here, and `hasteFromPercent` is a flat haste rating, so the engine's one
   * haste stat reaches both hands without anything extra.
   *
   * IT WENT UNCAST BECAUSE THE BUILD USED TO BE A TWO-HANDER AND NOBODY
   * RE-READ THE LIST. The other two Hunter lists have carried it since they
   * were written; this one is the odd one out, which is exactly the shape
   * `ability_audit.ts` was built to surface -- declared, learnable, castable,
   * never cast, reported nowhere.
   *
   * THIRD, WHERE THE OWNER'S OTHER TWO LISTS PUT IT: after the maintenance
   * entries and above the damage. A fifteen-second window wants to open early
   * and overlap as many swings as it can, and this build now has two of them.
   *
   * ONE CAST A FIGHT EITHER WAY. Five minutes, or three with Rapid Killing
   * 2/2, which this build takes -- both longer than the encounter, so its
   * position decides WHEN the window opens and not how often.
   */
  { abilityId: 'rapid_fire' },
  /*
   * "QUEUE RAPTOR STRIKE", and it is on-next-swing now, so `queue` is exactly
   * what the list does with it: arming costs no global cooldown and the swing
   * carries it. Its capture said "Next melee" all along.
   */
  { abilityId: 'raptor_strike' },
  /*
   * MONGOOSE BITE NEEDS NO CONDITION HERE. "Activated from Expose Prey" is
   * already the ability's own `canCast` -- it reads the aura that talent
   * applies, which is its only route to being cast at all when nothing dodges.
   */
  { abilityId: 'mongoose_bite' },
  { abilityId: 'strider_kick' },
  /*
   * IMMOLATION TRAP LAST, WHERE THE OWNER PUT IT -- "after strider kick". It is
   * unconditional, which makes it the FLOOR under this list: nothing can sit
   * below an ungated entry and ever be reached, so its position is also a
   * statement that this list is five entries and not six-and-a-spare.
   *
   * Its 30-second cooldown is what keeps it from crowding the abilities above
   * it, and it is the only entry here that neither swings a weapon nor scales
   * with attack power.
   */
  { abilityId: 'immolation_trap' },
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
