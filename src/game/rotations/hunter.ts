import type { Rotation } from '../../engine';
import type { AplCondition, AplList } from './apl';
import { RACIAL_COOLDOWNS } from './racialCooldowns';
import { CONSUMABLE_HEALS, consumableCooldowns } from './consumableCooldowns';
import { all, builtin, compileRotation, fightElapsed, resourceFraction, selfTime, targetMissing } from './apl';
import type { TalentAllocation } from '../talents/Talent';

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
 * THE ONE RULE THAT DECIDED MOST OF IT HAS BEEN REVERSED, AND THE ENTRIES
 * BELOW ARE STILL THE OWNER'S. It read: a cast resets the swing timer,
 * `resetSwingTimers` covers the RANGED slot, so a two-second Aimed Shot throws
 * away most of a 3.2-second bow cycle -- and auto-shot is 42% of a Marksmanship
 * Hunter's damage. That is why every cast in the owner's two ranged lists is
 * gated on a shot having just landed, and why the melee list contains no cast
 * at all.
 *
 * THE OWNER HAS SINCE RULED THAT AUTO SHOT IS NOT SUSPENDED AT ALL by Sniper
 * Shot, Aimed Shot or Multi-Shot: the bow keeps its own rhythm straight through
 * the cast. `swingTimer: 'continue'` on all three -- see the note above Aimed
 * Shot in `abilities/hunter.ts`.
 *
 * SO EVERY FIGURE BELOW THAT PRICED A CAST AGAINST A LOST BOW CYCLE IS A
 * MEASUREMENT OF A RULESET THAT NO LONGER APPLIES, and each says so where it
 * is quoted. The ENTRIES do not move for that: they are the owner's, and
 * CLAUDE.md's rule is that their list outranks a measurement of ours and the
 * measurement stays. What changed is that the shot-window gate now costs
 * rather than saves -- it makes a cast WAIT for a window that buys nothing --
 * and whether to drop it is a question for them. Recorded at
 * `shotLandedRecently`, which is where the condition is declared.
 *
 * THE MELEE LIST IS UNAFFECTED EITHER WAY. The ruling names the ranged
 * auto-attack, and that build swings two melee hands and never the bow, so a
 * cast there still costs a melee swing exactly as the note on it says.
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
 * IT WAS ABOUT THE SWING IT WOULD THROW AWAY, AND THERE IS NO LONGER A SWING TO
 * THROW AWAY. A cast interrupted the swing in progress and RESET that slot's
 * timer, `resetSwingTimers` covered the RANGED slot, and so a two-second Aimed
 * Shot started at the wrong moment discarded most of a 3.2-second bow cycle --
 * damage lost on a different row of the table from the damage it dealt.
 * Started just after a shot landed, the cast fitted inside the gap and cost
 * almost nothing. ("Just after" is a question `pendingSwing` cannot answer --
 * that is the NEXT swing -- which is why `lastSwingAt` had to be added.) It is
 * also the rule that once removed Aimed Shot from the Marksmanship list, worth
 * +23 DPS, with the owner's lists keeping the ability and gating it instead.
 *
 * THE OWNER HAS RULED THE SUSPENSION AWAY. Auto shot is not paused by Sniper
 * Shot, Aimed Shot or Multi-Shot, so the cast no longer costs a bow cycle
 * however it is timed -- and this gate now spends something to buy nothing: a
 * list that reaches the entry 0.4 seconds after a shot REFUSES it and falls
 * through to whatever is below, so the cast happens later than it would have
 * or not at all.
 *
 * IT IS KEPT, BECAUSE IT IS THE OWNER'S CONDITION AND NOT A MEASUREMENT OF
 * OURS. Removing it would be rewriting their list on an inference from a
 * ruling about the ENGINE, which is the thing this project does not do --
 * their list outranks a measured decision of ours, and that cuts both ways.
 * **A QUESTION FOR THEM**: with auto shot no longer suspended, should the
 * weave window come off the three gated entries? It is one line per entry and
 * the three are `aimed_shot` on Beast Mastery and `aimed_shot` plus
 * `sniper_shot` on Lone Wolf Ranged.
 * ----------------------------------------------------------------------------
 */
// The 500ms weave window this block describes is RETIRED: the owner removed
// the gate from every Hunter cast shot once Auto Shot stopped being suspended.

/*
 * ============================================================================
 * THE COOLDOWN STACK IN ONE SHOT, the owner's ask on all four Hunter profiles:
 * "Major Frenzy Potion paired with (Bestial Wrath and) Rapid Fire and Berserking
 * (racial) / Blood Fury (racial) so they all fire in sequence / in one shot."
 *
 * BOTH RACIALS ARE STEPS, so one list serves a Troll and an Orc: a sequence
 * step the character does not know is skipped, the rule an ordinary entry has.
 *
 * AND THEIR STANDALONE ENTRIES ARE GONE, which is what makes it a stack: a
 * standalone Rapid Fire or racial would fire first, and the sequence -- which
 * checks every step's cooldown before starting -- would then be refused until
 * that cooldown came back.
 * ============================================================================
 */
const STACKED = new Set(['berserking', 'blood_fury']);
const HUNTER_RACIALS = RACIAL_COOLDOWNS.filter((entry) => !STACKED.has(entry.abilityId));
/*
 * THE SECONDARY POTION (round 80, the owner's round 79 rule): a Major Mana
 * Potion on the Secondary row, drunk under 50% mana once a minute has passed.
 * It shares the two-minute potion cooldown with the Major Frenzy Potion that
 * leads the cooldown stack at the pull, so in the report's fights it is a
 * safety net: +1.1 weighted on BM Hunter, +1.5 on LW Ranged, 0.0 on the melee
 * builds. Taking the frenzy OUT of the Single Target stack so the mana potion
 * can be drunk instead is worth +32.5 / +19.0 on one target at 120s, and is
 * the owner's stack line to change -- a question, not a ship.
 */
const HUNTER_MANA_POTION = {
  abilityId: 'major_mana_potion',
  condition: all(resourceFraction('below', 0.5, 'mana'), fightElapsed('above', 60)),
  note: 'Secondary potion: under 50% mana and past the first minute; otherwise the potion cooldown belongs to the frenzy in the stack.',
};
const HUNTER_CONSUMABLES = [
  HUNTER_MANA_POTION,
  ...consumableCooldowns({ exclude: ['major_frenzy_potion', 'major_mana_potion'] }),
];

const potionStack = (steps: readonly string[]) => ({
  abilityId: 'major_frenzy_potion',
  sequence: [...steps, 'berserking', 'blood_fury'],
  note: 'Cooldown stack: Major Frenzy Potion with the cooldowns and the racial, in one shot.',
});

/**
 * "BESTIAL WRATH IF PET FRENZY IS ACTIVE", which reads across two combatants.
 *
 * A pet names its owner -- `ownerId` has been on `Combatant` since before pets
 * existed -- so the Hunter finds it by looking for the friendly actor that
 * points back. Frenzy is the pet's own proc, and Bestial Wrath is the owner's
 * cooldown: the entry spends one on the other, which is the only condition in
 * any list here that crosses actors.
 */

/** "<buff> is not active", on the Hunter -- the owner's "if not active". */
const selfExpired = (auraId: string) => selfTime('atMost', 0, auraId);

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
const hawksBelowCap: AplCondition = builtin('hawks_below_cap');

const missingOn = targetMissing;

/**
 * THE OWNER'S MELEE WEAVE (round 68), ON BOTH RANGED LISTS SINCE ROUND 78:
 * run in after a shot, drop an Immolation Trap (and a Raptor Strike if it is
 * ready), run back out. Neither ranged build casts a trap any other way, and
 * the trap is the best damage per MANA either of them owns -- 245 for about
 * 1,700 -- which is what a build that is mana-bound at two minutes wants.
 *
 * MEASURED AT 120s, 400 paired fights: **+22.0 on BM Hunter and +23.6 on LW
 * Ranged** above Serpent Sting; BM measured the same at three positions
 * (+21.7 to +22.0), LW Ranged preferred this one (+17.6 above Aimed Shot,
 * +14.3 at the bottom). The weave's own gate -- the bow fired in the last half
 * second and an option is castable -- is what keeps it from firing on every
 * decision.
 *
 * IMMOLATION TRAP ONLY: Strider Kick is not in either build and Mongoose Bite
 * needs Expose Prey, which neither takes.
 */
const RANGED_TRAP_WEAVE = { abilityId: 'melee_weave', weave: ['immolation_trap'] };

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
export const HUNTER_BEAST_MASTERY: AplList = {
  name: 'Hunter (Beast Mastery)',
  entries: [
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
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...HUNTER_RACIALS,
  ...HUNTER_CONSUMABLES,
  potionStack(['bestial_wrath', 'rapid_fire']),
  ...CONSUMABLE_HEALS,
  { abilityId: 'hunters_mark', condition: selfExpired('hunters_mark') },
  RANGED_TRAP_WEAVE,
  { abilityId: 'serpent_sting', condition: missingOn('serpent_sting') },
  { abilityId: 'summon_hawk', condition: hawksBelowCap },
  /*
   * UNGATED, by the owner: "Remove the condition ... that fixed it to be used
   * only if you've swung in the last 500 ms." Auto Shot is no longer suspended
   * by a cast, so the weave window protected nothing.
   */
  { abilityId: 'aimed_shot' },
  /*
   * ==========================================================================
   * ARCANE SHOT, WHICH THIS LIST DID NOT HAVE AND IS WORTH **+31**.
   *
   * It is a trainer shot every Hunter owns from level 6, and it is **14.9% of
   * LW Ranged's damage** -- where that list has an entry and this one did not.
   * So it was an ability in the BOOK, in no LIST, dealing nothing: the case
   * `ability_audit.ts` exists for and the one a DPS figure cannot show, because
   * a row that is not there looks like a row that is not there.
   *
   * AT THE BOTTOM, which is the only position that cannot change what the list
   * already does -- and here that is not merely the safe choice, it is the
   * measured one: **above Summon Hawk it is -17.8**, because the hawk is 14.5%
   * of this profile's damage and a shot that displaces one costs more than it
   * brings.
   *
   * IT ALSO WAKES A TALENT. Improved Arcane Shot measured BIT-IDENTICAL FIGHTS
   * before this entry existed -- see `HUNTER_BEAST_MASTERY_TALENTS`, which
   * tried it afterwards and still prefers Improved Stings.
   * ==========================================================================
   */
  { abilityId: 'arcane_shot' },
  ],
};

/**
 * LONE WOLF RANGED — no pet, and 20% more damage for not having one.
 *
 * 5/41/5, the deep Marksmanship build. (Written as 7/39/5 until round 13
 * respecified it; the spread is re-derived from the preset now, and
 * `talentSpreads.test.ts` is what keeps every stated one honest.)
 *
 * AIMED SHOT IS IN, GATED. An earlier version of this file dropped it and the
 * note explaining why survived the owner's list arriving with it kept: "784
 * damage a cast against Sniper Shot's 638 ... two seconds of cast RESETS THE
 * BOW, whose cycle is 3.2 seconds and whose auto-shots are 42% of this build's
 * damage", measured at +23 DPS for removing it. That was true of a list with no
 * shot-window condition. The owner's list keeps the ability and gates it on a
 * shot having just landed, which was the same rule answered a better way --
 * and **the rule itself is now gone**: a cast no longer resets the bow, so
 * neither the +23 nor the gate it motivated is about the ruleset any more.
 *
 * THE RANKING IS DAMAGE PER MANA AND NOT DAMAGE PER CAST -- Serpent Sting 4.13,
 * Sniper Shot 3.19, Arcane Shot 2.57, Aimed Shot 2.53 -- because this Hunter is
 * dry by the 30-second mark and spends half the fight auto-shooting.
 *
 * MULTI-SHOT IS OUT, tested and worth -1: half a second of cast still resets
 * the same bow, and it hits three targets where there is one. **THE FIRST HALF
 * OF THAT REASON HAS EXPIRED** -- the owner's ruling means no shot resets the
 * bow any more -- and the second half has not, so the entry would now be
 * priced on its damage alone against one target. Not re-measured here: it is
 * absent from the owner's list and adding it is their call.
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
export const HUNTER_LONE_WOLF_RANGED: AplList = {
  name: 'Hunter (Lone Wolf Ranged)',
  entries: [
  { abilityId: 'aspect_of_the_hawk', condition: selfExpired('aspect_of_the_hawk') },
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...HUNTER_RACIALS,
  ...HUNTER_CONSUMABLES,
  potionStack(['rapid_fire']),
  ...CONSUMABLE_HEALS,
  { abilityId: 'hunters_mark', condition: selfExpired('hunters_mark') },
  RANGED_TRAP_WEAVE,
  { abilityId: 'serpent_sting', condition: missingOn('serpent_sting') },
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
   * WHY IT LOST: four seconds of cast reset the ranged swing timer, and this
   * build's auto-shot is 49.7% of its damage on a 3.2-second cycle. 295 damage
   * and 365 mana did not pay for a cycle and a quarter of bow.
   *
   * **THAT IS THE WHOLE OF THE -12.1 AND IT NO LONGER HOLDS.** The owner has
   * ruled that auto shot is not suspended by the cast, so the bow cycle is not
   * spent -- what Sniper Shot costs now is a global cooldown and 365 mana on a
   * build that runs dry, which is a far smaller bill. The ability was kept on
   * the owner's call AGAINST that measurement, so the ruling removes the
   * argument the call was made over rather than changing the entry.
   *
   * THE OWNER'S LIST OUTRANKS THE MEASUREMENT AND THE MEASUREMENT STAYS -- the
   * same arrangement Hunter's Mark's -10.1 has on the melee list below. Asked
   * directly, the owner chose to keep it. `petsAndHunter.test.ts` pins that the
   * ability is CAST, which is an invariant, and not that it belongs in the
   * list, which is a decision that can change owner.
   * --------------------------------------------------------------------------
   */
  /*
   * SUMMON HAWK IS HERE TOO, AND THE ABILITY IS GRANTED BY A DIFFERENT TALENT
   * FROM THE ONE THIS LIST IS CHOSEN BY.
   *
   * --------------------------------------------------------------------------
   * `hunterRotation` dispatches on `bestial_wrath`, the 31-point capstone, and
   * `summon_hawk` is a 5-point talent five rows above it. So a build that took
   * Summon Hawk and NOT Bestial Wrath got this list -- which had no hawk entry
   * -- and silently stopped casting an ability it had paid for. The owner hit
   * exactly that: "why does hawk stop casting if I remove the bestial wrath
   * talent?"
   *
   * THE ENTRY IS SILENT FOR A BUILD WITHOUT THE TALENT, which is what lets one
   * list serve several builds and is why this is the fix rather than a second
   * dispatch rule. LW Ranged does not take Summon Hawk, so this fires zero
   * times for it and the profile does not move by a decimal.
   *
   * LAST, because for a build that has it the hawk shares a cooldown group with
   * Arcane Shot and this list is bound by MANA rather than by global cooldowns.
   * Nothing measurable rests on that -- no profile reaches it.
   * --------------------------------------------------------------------------
   */
  /*
   * UNGATED, by the owner: "Remove the condition ... that fixed it to be used
   * only if you've swung in the last 500 ms." Auto Shot is no longer suspended
   * by a cast, so the weave window protected nothing.
   */
  /*
   * ARCANE SHOT ABOVE AIMED SHOT (round 78), **+9.2** at a 120 second fight
   * (C2 against C6, 400 paired fights each against the round's baseline). At
   * two minutes this build is mana-bound and Arcane Shot is the better damage
   * per mana of the two -- 944 for 190 against 1,395 for 310 -- and it is the
   * shot on a cooldown that can be lost by waiting, which is the argument that
   * already put it above Sniper Shot below.
   */
  { abilityId: 'arcane_shot' },
  { abilityId: 'aimed_shot' },
  /*
   * ==========================================================================
   * ARCANE SHOT ABOVE SNIPER SHOT, WHICH IS WORTH **+1.4** AND TOOK 3,000
   * PAIRED ITERATIONS TO SAY SO.
   *
   * At 800 it read +2.25 against an interval of 1.55 and at 600 it read +1.59
   * against 1.76 -- real, then noise, then real, on the same change. Both
   * entries are gated on the weave window, so the pair swaps which one takes a
   * window that the other would have used, and the fights decorrelate: a spread
   * of 22 against a difference of 1.4 is what needed the iterations.
   *
   * WHY IT PAYS: Arcane Shot is on a cooldown and Sniper Shot is not, so the
   * shot that can be LOST by waiting goes first. Sniper Shot still fires 3.4
   * times a fight either way.
   * ==========================================================================
   */
  { abilityId: 'sniper_shot' },
  /*
   * SUMMON HAWK IS OUT OF THIS LIST, by the owner: "Remove Summon Hawk from the
   * combat APL."
   */
  ],
};

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
export const HUNTER_LONE_WOLF_MELEE: AplList = {
  name: 'Hunter (Lone Wolf Melee)',
  entries: [
  { abilityId: 'aspect_of_the_beast', condition: selfExpired('aspect_of_the_beast') },
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...HUNTER_RACIALS,
  ...HUNTER_CONSUMABLES,
  potionStack(['rapid_fire']),
  ...CONSUMABLE_HEALS,
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
  /*
   * "QUEUE RAPTOR STRIKE", and it is on-next-swing now, so `queue` is exactly
   * what the list does with it: arming costs no global cooldown and the swing
   * carries it. Its capture said "Next melee" all along.
   */
  /*
   * ROUND 80: SERPENT STING AND ARCANE SHOT, ADDED ABOVE THE OWNER'S RAPTOR
   * STRIKE -- **+185.5 +/- 9.1 at 120s on one target** (300 paired fights),
   * and +13.5 more with Improved Stings 2 out of Rapid Killing's dead points.
   *
   * THE "IT SHOOTS NOTHING" NOTE ABOVE IS A CLAIM ABOUT THE OWNER'S LIST, and
   * the reason it was worth re-asking is in the same note: this build ended a
   * two-minute fight with half its mana unspent. Both are instants, so neither
   * costs a melee swing, and both scale with RANGED attack power, which Careful
   * Aim and Aspect of the Beast's agility feed: Arcane Shot lands for about
   * 830 on this build, more than a Raptor Strike. Neither needs a swinging bow.
   *
   * Placement swept: both above Raptor +185.5; sting above Raptor and Arcane
   * above Immolation Trap +176.8; both above Wing Clip +168.3; Arcane alone
   * +94.9 to +103.4; the sting alone +75.6 to +77.2. Aimed Shot added below
   * them (a cast, which resets the swing) +2.7, noise; Multi-Shot -21.5.
   */
  { abilityId: 'serpent_sting', condition: missingOn('serpent_sting') },
  { abilityId: 'arcane_shot' },
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
  /*
   * WING CLIP LAST, AND IT IS A TRUE FLOOR. The owner asked for it "as a
   * filler/low priority ability if there is nothing else to press", and it has
   * NO COOLDOWN -- so unlike Immolation Trap above it, which the list falls
   * past for 30 seconds at a time, nothing could ever sit below this and be
   * reached. That is the half of the floor rule that is easy to forget: an
   * entry is a floor when it is ungated AND always castable.
   *
   * IT IS PRESSED FOR THE PROCS RATHER THAN THE 50. "it can still count as a
   * melee use in order to trigger things like hand of justice, windfury, and
   * expose prey" -- and Expose Prey is what opens Mongoose Bite for this build,
   * so a filler that rolls for it feeds an entry four rows above it.
   *
   * 80 MANA IS WHAT LIMITS IT, not a cooldown. This build used to finish with
   * mana to spare; an ungated 80-mana filler is exactly what spends it.
   */
  { abilityId: 'wing_clip' },
  ],
};

/**
 * HAWK MELEE -- Lone Wolf Melee's list with the hawk in it, and a pet behind it.
 *
 * ----------------------------------------------------------------------------
 * THE OWNER'S INSTRUCTION WAS EXACTLY THAT: "the same as the LW melee hunter
 * profile, except Summon Hawk will be used above Wing Clip." So this list is
 * `HUNTER_LONE_WOLF_MELEE` with one entry inserted, and it is built by SPREADING
 * that list rather than by copying its entries -- a copy would drift the moment
 * either list changed, which is how four rows of the baseline table went stale.
 *
 * GATED ON THE CAP, like the other two lists that press it. Summon Hawk has a
 * six-second cooldown and a hawk lasts eighteen, so an ungated entry would fire
 * every six seconds and OVERWRITE the older of the two hawks -- the ability
 * takes the oldest slot when both are full -- throwing away twelve seconds of a
 * hawk to start a new one. `hawksBelowCap` is what both the Beast Mastery and
 * the Lone Wolf Ranged lists use and there is no reason this one differs.
 *
 * ABOVE WING CLIP AND BELOW EVERYTHING ELSE, which is where the owner put it.
 * That still leaves Wing Clip as the floor: Summon Hawk has a cooldown AND a
 * condition, so the list falls past it, and an entry is only a floor when it is
 * ungated and always castable.
 * ----------------------------------------------------------------------------
 */
export const HUNTER_HAWK_MELEE: AplList = {
  name: 'Hunter (Hawk Melee)',
  entries: [
  /*
   * ROUND 80: LONE WOLF MELEE'S ARCANE SHOT DOES NOT COME WITH THE SPREAD. On
   * this build it is worth more BELOW the hawk: sting above Raptor and Arcane
   * above Wing Clip measured **+90.3 +/- 8.1** at 120s, against +58.8 with both
   * above Raptor, because a hawk is 13% of this profile and Arcane Shot shares
   * its cooldown group.
   */
  ...HUNTER_LONE_WOLF_MELEE.entries.filter(
    (entry) => entry.abilityId !== 'wing_clip' && entry.abilityId !== 'arcane_shot',
  ),
  /*
   * NO RACIAL COOLDOWNS OF ITS OWN: the spread above already carries them.
   *
   * This list is another list's entries plus a change, so `RACIAL_COOLDOWNS`
   * arrives inside that spread -- in the position the other list put them,
   * which is the position this list wants too. Adding them here as well put
   * four abilities in twice, and `rotationIds.test.ts` caught it as a duplicate
   * below an unconditional copy: a second entry for an ability on cooldown is
   * unreachable, which reads as a list four entries longer than it is.
   */
  { abilityId: 'summon_hawk', condition: hawksBelowCap },
  { abilityId: 'arcane_shot' },
  { abilityId: 'wing_clip' },
  ],
};

export const HUNTER_BEAST_MASTERY_ROTATION: Rotation = compileRotation(HUNTER_BEAST_MASTERY);
export const HUNTER_LONE_WOLF_RANGED_ROTATION: Rotation = compileRotation(HUNTER_LONE_WOLF_RANGED);
export const HUNTER_LONE_WOLF_MELEE_ROTATION: Rotation = compileRotation(HUNTER_LONE_WOLF_MELEE);
export const HUNTER_HAWK_MELEE_ROTATION: Rotation = compileRotation(HUNTER_HAWK_MELEE);

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
 *
 * AND THE TWO MELEE BUILDS BY SUMMON HAWK, which is the talent the two lists
 * actually differ by. Hawk Melee is Lone Wolf Melee's list plus that one entry,
 * so the ability it grants is the honest key -- the same reasoning that gates
 * Charge on the ability rather than on Vanguard. Keying on Lone Wolf instead
 * would read as "does it have a pet", which is true of this build and is not
 * what either list is about: a melee Hunter who took the hawk and Lone Wolf
 * both would then get the list that never presses its hawk, silently.
 *
 * ORDER MATTERS HERE. Beast Mastery takes Summon Hawk too, so the capstone has
 * to be asked first or a BM Hunter would fall into a melee list -- and it is
 * `combatStyle: 'ranged'`, so it would stand there pressing Raptor Strike.
 */
export function hunterRotation(
  style: string | undefined,
  talents: TalentAllocation,
): Rotation | undefined {
  if ((talents.bestial_wrath ?? 0) > 0) return HUNTER_BEAST_MASTERY_ROTATION;
  if (style === 'two_hander' || style === 'dual_wield') {
    return (talents.summon_hawk ?? 0) > 0
      ? HUNTER_HAWK_MELEE_ROTATION
      : HUNTER_LONE_WOLF_MELEE_ROTATION;
  }
  return HUNTER_LONE_WOLF_RANGED_ROTATION;
}

/** Whether this build brings a pet. Lone Wolf is the talent that says it does not. */
export function hasPet(talents: TalentAllocation): boolean {
  return (talents.lone_wolf ?? 0) === 0;
}
