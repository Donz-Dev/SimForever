import type { TalentEffects } from './TalentEffect';
import { BERSERKER_RAGE_ACTIVATION_BONUS } from '../abilities/warrior';

/**
 * What every Warrior talent does, by talent id.
 *
 * ALL 53 have an entry. A talent that cannot be modelled says so and says why,
 * rather than being absent — absence would be indistinguishable from an
 * oversight, and this file is the only place that can tell the difference. A
 * test asserts the coverage both ways, which is how three entries lost to a
 * careless edit were caught.
 *
 * 43 are fully modelled and 4 more are PARTLY modelled — something real plus an
 * `unmodelled` entry naming the part that is missing (Sweeping Strikes,
 * Weaponmaster, Piercing Howl, Improved Berserker Rage). 6 do nothing at all.
 *
 * Those three numbers must sum to 53. An earlier count said 21 inert and summed
 * to 54, which is how the drift below went unnoticed, and the count after it
 * (29/6/18) went stale as the talents were filled in.
 *
 * ALL SIX INERT ONES ARE PERMANENTLY OUT OF SCOPE BY RULING — movement, crowd
 * control or threat — and each says so with a `scope` on its `unmodelled`
 * entry rather than only in prose, so the milestone counts it as a decision and
 * not as work. **THE CLASS HAS NO LIVE GAP LEFT.** The last one was Improved
 * Berserker Rage, whose reason argued from a priority LIST and was filed as an
 * engine gap; its number was stated in the values file the whole time.
 *
 * TWO CLAUSES ARE STILL BLOCKED ON SOMETHING THAT COULD CHANGE, both inside
 * PARTLY modelled talents: Sweeping Strikes (needs a second target) and
 * Weaponmaster's mace-and-staff clause (armor ignore, which the damage
 * pipeline cannot express). Neither can reach any of the three profiles --
 * every encounter has one enemy, and every Warrior gear set is swords. See
 * CLAUDE.md, "Scope".
 *
 * NINE GRANT AN ABILITY, and those are where being wrong costs most: an ability
 * handed to a character who never took its talent is free damage that nothing
 * in the results explains, which is exactly what happened when every warrior
 * had all three 31-point capstones at once. All nine declare `grantAbility`, so
 * `abilitiesForClass` gates them from one list. Four have an implemented
 * ability today; the other five declare the grant anyway, so they are gated
 * correctly the moment their ability exists rather than being remembered later.
 *
 * The reasons a talent is unmodelled fall into a few groups, and each names its
 * own specific obstacle so the list doubles as the work queue:
 *
 *   - a concept the engine does not have (threat, movement, stuns, multiple
 *     targets, defense skill)
 *   - the ability it modifies is itself inert, pending its numbers from the
 *     ruleset owner. THIS GROUP IS NOW EMPTY for the Warrior: Bloodrage,
 *     Shield Wall and Shield Block were all filled in, and Berserker Rage's
 *     own rage-on-damage is still unstated but its TALENT never depended on
 *     that number
 *   - it needs a mechanism that exists but is not wired to talents yet
 *     (combat-start auras, a talent-granted reaction)
 *
 * "Nothing attacks the player" USED to be a group here, and is not one any
 * more: `encounter.targetAttacks` makes the target swing back. Five entries
 * went on claiming it long after that shipped — two of them on talents that had
 * become fully modelled without anyone noticing. Whether the switch is ON is an
 * encounter setting, not a modelling gap, so it is not a reason to file
 * anything as unmodelled.
 *
 * Items carry the same kind of reason, in their own `unmodelled` lists. Neither
 * is printed in the app now -- `tools/class_audit.ts` is the reader.
 *
 * Edge cases, interpretations and the talents that are deliberately only PARTLY
 * modelled are all written up in `docs/talent-effects.md`. Read that before
 * deciding a reason below is out of date -- eight of them already were, in two
 * separate rounds. A reason here is a claim about the engine on the day it was
 * written, and it does not re-check itself.
 *
 * The NUMBERS are not here. They live in `src/data/talents/values/warrior.json`,
 * per rank, hand-editable. This file says what a talent does with its number.
 */
export const WARRIOR_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // ---------------------------------------------------------------------
  // Arms
  // ---------------------------------------------------------------------
  improved_heroic_strike: [{ kind: 'abilityCost', abilityId: 'heroic_strike' }],

  // Parry is held in percentage POINTS, like dodge and crit, so no scaling.
  deflection: [{ kind: 'stat', stat: 'parryChance', operation: 'flat' }],

  // Scales the bleed, not the cast: a periodic tick carries the AURA's id.
  improved_rend: [{ kind: 'abilityDamage', abilityId: 'rend' }],


  improved_charge: [{ kind: 'abilityBonus', abilityId: 'charge', key: 'rage' }],

  /*
   * "Retain up to an additional 3/6/9/12/15 Rage when you change stances", so
   * rank 5 keeps 25 against the base floor of 10.
   *
   * Declared once per stance ability rather than as a character-wide value.
   * Repetitive, and it keeps the rule where the rule belongs: a stance change
   * is the thing that costs rage, so the ability that performs one carries the
   * number. A character-wide field would have to be read by something, and the
   * only reader would be these same three abilities.
   */
  improved_tactical_mastery: [
    { kind: 'abilityBonus', abilityId: 'battle_stance_cast', key: 'rageRetained' },
    { kind: 'abilityBonus', abilityId: 'defensive_stance_cast', key: 'rageRetained' },
    { kind: 'abilityBonus', abilityId: 'berserker_stance_cast', key: 'rageRetained' },
  ],

  improved_overpower: [{ kind: 'abilityCrit', abilityId: 'overpower' }],


  /*
   * FULLY MODELLED. One rage every three seconds, from the talent's own
   * words, with the first tick placed randomly in the first three seconds to
   * model a pull that did not line up with the passive's timer.
   *
   * The second half of the tooltip -- "reduces Rage loss while out of combat
   * by 30%" -- is out of scope by the ruleset owner's decision: there is no
   * out-of-combat state here, so the character is always in combat and there
   * is no decay to reduce.
   */
  anger_management: [{ kind: 'grantAura', auraId: 'anger_management' }],

  deep_wounds: [{ kind: 'reaction', reactionId: 'deep_wounds' }],

  spearing_strike: [{ kind: 'grantAbility', abilityId: 'spearing_strike' }],

  // Covers auto attacks as well as abilities, so it is a whole-character
  // multiplier rather than a per-ability one -- conditional on what is held.
  two_handed_weapon_specialization: [
    { kind: 'conditionalDamage', requires: { twoHanded: true } },
  ],

  impale: [{ kind: 'critDamageBonus' }],


  bloodthrill: [{ kind: 'reaction', reactionId: 'bloodthrill' }],

  sweeping_strikes: [
    { kind: 'grantAbility', abilityId: 'sweeping_strikes' },
    {
      kind: 'unmodelled',
      reason:
        'The ability is implemented and does nothing: its whole effect is that ' +
        'the next 5 melee attacks strike an ADDITIONAL opponent, and an ' +
        'encounter here has exactly one enemy. Not a missing number -- a ' +
        'missing second target. Re-checked 2026-09-30: `trainingDummyEncounter` ' +
        'still builds exactly one dummy and nothing creates a second. See ' +
        'engine/combat/targeting.ts.',
    },
  ],

  /*
   * ----------------------------------------------------------------------
   * TWO STALE COMMENT BLOCKS WERE DELETED FROM HERE, and what they said is
   * worth one line because both are the same failure. One claimed the sword
   * extra attack "needs a reaction that ... nothing wires to a talent yet";
   * the other claimed "nothing in the engine carries a weapon's type ... so
   * all three clauses are ungated and the sword one fires whatever the
   * warrior is wielding". Both sat directly above code doing the opposite,
   * and the block BELOW them already said so. A comment asserting the
   * opposite of its own code is worse than no comment, because it is read
   * first.
   * ----------------------------------------------------------------------
   */
  /*
   * Three clauses, one per weapon family, and two of the three are real.
   *
   *   Axe/Polearm  +1-5% crit         -- applied when the MAIN HAND is one
   *   Sword        1-5% extra attack  -- per swinging weapon, either hand
   *   Mace/Staff   3-15% armor ignore -- not modelled
   *
   * The sword clause reads the talent's THIRD value (`valueIndex: 2`) and is
   * gated on the weapon that actually swung, so a mace-and-sword dual wielder
   * gets it from the sword and gets it from the off hand. Its extra attack is
   * always a MAIN HAND swing, matching Hand of Justice: an off-hand sword's
   * proc swings the main-hand mace.
   *
   * A previous version of this entry said the engine "does not record a weapon
   * type". It does -- `WeaponProfile.weaponType`, filled from the item's
   * subclass -- and the clause was ungated as a result.
   *
   * The crit clause is MAIN HAND ONLY, and that is an interpretation rather
   * than the rule: `critChance` is a whole-character stat with no per-slot
   * form, so a bonus earned by an off-hand axe would apply to main-hand swings
   * too. Main hand is the reading that is right for the hand doing most of the
   * damage and wrong for the other, which beats being wrong for both.
   *
   * THE ARMOR CLAUSE IS STILL A REAL ENGINE GAP, re-checked 2026-09-30 rather
   * than assumed: `resolveDamage` computes its reduction from
   * `armorReduction(target.stats.get('armor'), target.level)` and the pipeline
   * has no attacker-side term at any step, so a percentage the ATTACKER
   * ignores has nowhere to go.
   *
   * IT CANNOT REACH ANY OF THE THREE PROFILES EITHER WAY: every weapon in
   * every Warrior gear set is a SWORD, so the only clause a Warrior profile
   * can exercise is the one that is implemented. Both facts are worth keeping
   * and they expire separately -- the gap when the pipeline changes, the
   * irrelevance when the gear does.
   */
  /*
   * --------------------------------------------------------------------------
   * ITS ARMOR CLAUSE WAS CLOSED BY THE ROGUE DIVE, not by this class. The reason
   * here said "the damage pipeline has no attacker-side armor term at any step
   * -- re-checked 2026-09-30", which was true on the day and stopped being true
   * when `armorPenetration` became a stat for Hack and Slash and Serrated
   * Blades. **The expiry crossed a class boundary**, which is the kind this
   * project keeps missing: nothing in the Warrior's own files changed.
   *
   * `armorPenetration.test.ts` asserts BOTH callers on purpose, so neither can
   * be quietly dropped by an edit to the other -- and it is what caught this.
   * --------------------------------------------------------------------------
   */
  weaponmaster: [
    { kind: 'conditionalCrit', requires: { weaponTypes: ['axe', 'polearm'] } },
    {
      kind: 'stat',
      stat: 'armorPenetration',
      operation: 'flat',
      valueIndex: 1,
      requires: { weaponTypes: ['mace', 'staff'] },
    },
    { kind: 'reaction', reactionId: 'weaponmaster', valueIndex: 2 },
    {
      kind: 'unmodelled',
      reason:
        'All three clauses apply. Two of them read the MAIN HAND only -- the ' +
        'axe/polearm crit because crit chance has no per-slot form, and the ' +
        'mace/staff armor penetration because it is a whole-character stat -- ' +
        'so an off-hand axe earns neither. The sword extra attack is gated on ' +
        'the weapon that actually swung and does reach the off hand.',
    },
  ],

  /*
   * Two effects that scale and two that do not. "Slam no longer interrupts or
   * delays your melee swing" is granted by both ranks, and is worth far more
   * than the half second of cast time: without it a Slam costs a whole swing.
   *
   * THE COOLDOWN CLAUSE IS NEW AT CLIENT BUILD 1.60.1.70170 and is the reason
   * this entry now carries indices. The tooltip gained "and Slam's cooldown is
   * reduced by 3.0 sec", so the row went from one number to two -- `[0.25, 3]`
   * and `[0.5, 3]` -- and every effect that was reading it unindexed would have
   * kept reading the first by accident. That is right for the three that want
   * the cast time and wrong the moment a fourth wants something else, so all
   * four say which number they take. See CLAUDE.md on `valueIndex`: four Druid
   * talents and one Priest talent have been found reading the wrong one.
   *
   * THE THREE SECONDS DO NOT SCALE WITH RANK -- both ranks state 3 -- which is
   * what the values file records and is why the sheet-style "one varying number"
   * assumption does not hold here.
   */
  improved_slam: [
    { kind: 'abilityCastTime', abilityId: 'slam', valueIndex: 0 },
    { kind: 'abilityGcd', abilityId: 'slam', valueIndex: 0 },
    { kind: 'abilityHoldsSwing', abilityId: 'slam' },
    { kind: 'abilityCooldown', abilityId: 'slam', unit: 'seconds', valueIndex: 1 },
  ],

  improved_hamstring: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Immobilises the target. There is no movement to prevent.' },
  ],

  mortal_strike: [{ kind: 'grantAbility', abilityId: 'mortal_strike' }],

  // ---------------------------------------------------------------------
  // Fury
  // ---------------------------------------------------------------------
  /*
   * "Increases the area of effect of your Shouts by {0}% and reduces their Rage
   * cost by {1}%" -- 50% and 25% at 5/5.
   *
   * THE SECOND CLAUSE IS NEW AT CLIENT BUILD 1.60.1.70170 and the talent was a
   * pure `positioning` ruling before it. The notes: "Booming Voice is now a
   * 10/20/30/40/50% increase area of effect to your Shouts and a 5/10/15/20/25%
   * reduction to their Rage costs."
   *
   * WHICH IS EXACTLY THE SHAPE CLAUDE.md WARNS ABOUT UNDER `scope`: a ruling is
   * permanent by design, so a talent filed under one is deliberately kept out of
   * the live-gap list and off the Talent panel's "not modelled" column. A second
   * clause arriving on a scoped talent is therefore the quietest kind of change
   * there is -- the entry that exists to stop anybody looking again would have
   * swallowed a real rage saving on two abilities. The positioning half stays
   * ruled out and gets its own entry; the rage half is live.
   *
   * A PERCENTAGE, SO `grantCastModifier` AND NOT `abilityCost`. `abilityCost`
   * subtracts a FLAT amount -- right for Improved Thunder Clap's two rage, wrong
   * for a quarter of a ten-rage shout. Two on the same ability stack additively,
   * which `resolveCast` gives for free by subtracting each from the base.
   *
   * "YOUR SHOUTS" IS THE TWO THIS PROJECT DECLARES. Battle Shout and Demoralizing
   * Shout are the Warrior's shouts that are modelled; Challenging Shout is a
   * taunt and threat is out of scope, and Piercing Howl is a howl. Listed by id
   * because `abilityIds` is a list and there is no "is a shout" fact to read --
   * which is the same reason Twin Disciplines names its instants one by one.
   *
   * WORTH NOTHING TO ANY PROFILE TODAY, and for a reason that is a LIST cause
   * rather than an engine one: `battle_shout` is in the preset raid buff list, so
   * every Warrior list's Battle Shout entry refuses itself for the whole fight,
   * and no list casts Demoralizing Shout at all. See CLAUDE.md, "A MEASUREMENT IN
   * A COMMENT EXPIRES THE SAME WAY AN `unmodelled` REASON DOES".
   */
  booming_voice: [
    {
      kind: 'grantCastModifier',
      abilityIds: ['battle_shout_cast', 'demoralizing_shout_cast'],
      property: 'costFraction',
      valueIndex: 1,
    },
    {
      kind: 'unmodelled',
      scope: 'positioning',
      reason: 'Shout radius. The encounter has no positions.',
    },
  ],

  // Crit is held in percentage POINTS, so "+1%" is a flat +1 and needs no scale.
  cruelty: [{ kind: 'stat', stat: 'critChance', operation: 'flat' }],

  iron_will: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Stun and fear duration. Nothing stuns or fears the player.' },
  ],

  unbridled_wrath: [{ kind: 'reaction', reactionId: 'unbridled_wrath', valueIndex: 0 }],

  /*
   * IMPROVED CLEAVE IS GONE, removed at client build 1.60.1.70170, and its
   * three points went with it -- the 2H Arms build spent them there and the
   * owner's new URL spends them on Improved Charge and Improved Bloodrage.
   *
   * ITS WORK MOVED TO RAGING BLOWS, which now reads "Reduces the Rage cost of
   * your Cleave and Whirlwind abilities by 3" where it read 2 and named Cleave
   * alone. So the rage saving on Cleave survives the talent that provided it.
   */

  /*
   * FURIOUS PRECISION, new at client build 1.60.1.70170: "Increases your chance
   * to hit with off-hand attacks by 4/7/10%."
   *
   * IT IS THE CLAUSE DUAL WIELD SPECIALIZATION LOST, at the same ranks and the
   * same cap, moved onto a talent of its own -- "Dual Wield Specialization no
   * longer grants hit to your off-hand attacks" and this in the row above it.
   * So the `offHandHit` kind that was built for that talent needed no change
   * and has a new owner.
   *
   * OFF-HAND ONLY, which no character-wide stat can express: `hitChance` would
   * hand the main hand ten free points. `Combatant.hitBonusBySlot` is the field
   * and `attackChances` adds the wielding hand's own bonus, which is also why
   * `isWeaponUseOf` had to stop accepting a ranged slot -- see CLAUDE.md.
   */
  furious_precision: [{ kind: 'offHandHit' }],

  piercing_howl: [
    { kind: 'grantAbility', abilityId: 'piercing_howl' },
    {
      kind: 'unmodelled',
      scope: 'crowdControl',
      reason:
        'Dazes nearby enemies, -50% movement for 6 sec. NOT TO BE IMPLEMENTED: the ' +
        'project owner classes snares as non-combat, so this is out of scope ' +
        'rather than waiting on anything.',
    },
  ],

  /*
   * FULLY MODELLED. Both triggers fire: being critically struck, and taking
   * more than 20% of maximum health from one blow.
   *
   * ----------------------------------------------------------------------
   * IT HAD A THIRD AND FOREVER TOOK IT AWAY. "Blood Craze no longer activates
   * off of Bloodthirst casts" at client build 1.60.1.70170, and the refreshed
   * tooltip drops the clause -- so `blood_craze_bloodthirst`, which was a
   * SECOND reaction because it watched the other side of the attack, is gone
   * with it.
   *
   * WHICH MAKES THE TALENT WORTH NOTHING TO A FURY BUILD, and that is why the
   * owner's new URL does not take it: the Bloodthirst clause was the only one a
   * warrior nothing is hitting could ever meet. Both survivors fire on attacks
   * RECEIVED, which needs `encounter.targetAttacks` -- a Protection setting --
   * and Blood Craze is a Fury talent. It did not become inert; it became a tank
   * talent in a damage tree.
   * ----------------------------------------------------------------------
   *
   * THE TICK CADENCE IS THE RULESET OWNER'S, not a placeholder: once every
   * two seconds for three ticks across the six. It was the last thing about
   * this talent that came from Classic rather than from Forever.
   *
   * Its old reason said the healing "would not be observable: the player
   * cannot drop below one health, so a heal has nothing to restore and
   * survival is not modelled". True when written. The character now dies,
   * the deaths are counted, and healing received is a figure on the results
   * page.
   */
  blood_craze: [{ kind: 'reaction', reactionId: 'blood_craze' }],

  /*
   * BOUNDLESS RAGE IS GONE, removed at client build 1.60.1.70170 -- +10/20/30
   * maximum rage, which the DW Fury build spent two points on.
   *
   * `resourceMax` HAS NO OTHER CALLER NOW and is kept rather than deleted: it
   * is a general declaration and exactly the kind of thing a ruleset adds back.
   * A kind with no caller is visible in the type; a deleted one has to be
   * re-derived from scratch.
   */

  /*
   * FULLY MODELLED, both clauses. At 5/5: off-hand damage +25%, which takes the
   * multiplier from 0.5 to 0.625, and off-hand rage generation +50%.
   *
   * ----------------------------------------------------------------------
   * IT HAD THREE CLAUSES AND CLIENT BUILD 1.60.1.70170 CHANGED TWO OF THEM.
   * The hit is gone -- "Dual Wield Specialization no longer grants hit to your
   * off-hand attacks" -- and that is exactly what happened to it: the 2/4/6/8/10
   * points of off-hand hit moved to FURIOUS PRECISION, a new talent one row
   * above, at 4/7/10. The `offHandHit` kind needed no change and has a new
   * owner.
   *
   * THE RAGE CLAUSE IS WHERE THE NOTES AND THE CLIENT DID NOT QUITE AGREE, AND
   * THE OWNER HAS SETTLED IT: "The client tooltip was correct." The note reads
   * "no longer provides a 20/40/60/80/100% increase to your Off-Hand weapon's
   * Rage generation", which on its own reads as the clause being removed; the
   * client's own tooltip carries one at HALF the old figure -- "the Rage
   * generated by your off-hand attacks by 50%" at 5/5, with the values file
   * holding 10/20/30/40/50. So the note is about THAT increase rather than about
   * rage generation as such.
   *
   * WHICH MAKES IT A RULING RATHER THAN A JUDGEMENT, and the standing rule it
   * confirms is worth stating: **where a patch note and the client disagree, the
   * CLIENT is the ruleset** -- the note describes an intent and the client is
   * what players run. The same precedence `foreverchanges.pro` has over our own
   * capture, one level up.
   *
   * THE VALUE ROW WENT FROM THREE NUMBERS TO TWO, which is the half of this that
   * could have gone wrong in silence: `offHandResourceGeneration` still wants
   * index 1 and still finds the rage there, but anything reading index 2 now
   * reads nothing -- and a talent effect that reads NO value is DROPPED without
   * saying so, which reads as an unmodelled talent that never reported itself.
   * The hit entry is deleted rather than left pointing past the end of the row.
   * ----------------------------------------------------------------------
   */
  dual_wield_specialization: [
    { kind: 'offHandDamage', valueIndex: 0 },
    { kind: 'offHandResourceGeneration', valueIndex: 1 },
  ],

  /*
   * "Reduces the Rage cost of your Cleave and Whirlwind abilities by 3."
   *
   * ----------------------------------------------------------------------
   * IT WAS A COST REDUCTION AND AN OFF-HAND STRIKE, AND THE STRIKE IS NOW FREE.
   * Client build 1.60.1.70170: "Raging Blows no longer causes your Whirlwind to
   * strike with your offhand. Whirlwind will now always strike with both weapons
   * without requiring a talent point", and "Raging Blows now reduces the Rage
   * cost of your Cleave and Whirlwind abilities by 3."
   *
   * So the `abilityFlag` is gone -- `WHIRLWIND` reads its own off hand now, and
   * the only question left there is whether one is equipped -- and the cost
   * reduction gained a second ability and a third rage. It took over Improved
   * Cleave's job in the same patch that deleted Improved Cleave.
   *
   * A FLAT AMOUNT, so `abilityCost` is right, where Booming Voice's percentage
   * needed `grantCastModifier`. Still a single-rank talent, so its value is
   * hand-filled in `values/warrior.json` with a note: the importer cannot
   * identify a variable in a sentence with no `{0}` placeholder, and an effect
   * that reads no value is dropped in silence.
   * ----------------------------------------------------------------------
   */
  raging_blows: [
    { kind: 'abilityCost', abilityId: 'cleave' },
    { kind: 'abilityCost', abilityId: 'whirlwind' },
  ],

  /*
   * FULLY MODELLED. A 30% chance on being hit to deal 2-10% more physical
   * damage for 12 seconds. The rank value is the DAMAGE BONUS, not the proc
   * chance, which is fixed at 30% -- the one reaction here where the two are
   * not the same number.
   *
   * Fires only when something attacks the player, which is an encounter
   * setting (`targetAttacks`, off by default) and not a gap in the model.
   */
  enrage: [{ kind: 'reaction', reactionId: 'enrage' }],

  improved_execute: [{ kind: 'abilityCost', abilityId: 'execute' }],

  /*
   * LINGERING RAGE, new at client build 1.60.1.70170 and standing where Iron
   * Will stood: "Increases the time before your Rage begins to decay after
   * leaving combat by 2/4/6/8/10 sec."
   *
   * ----------------------------------------------------------------------
   * THERE IS NO OUT-OF-COMBAT STATE HERE, so the whole talent is inert. A fight
   * begins in combat -- which is why Charge is a one-shot opener and why every
   * stealth opener is out of scope -- and it ends when the clock does. Nothing
   * ever leaves combat, so no rage ever begins to decay, so there is no delay
   * to lengthen.
   *
   * NO `scope` TAG, DELIBERATELY, and that is the whole judgement in this
   * entry. `OutOfScope` has no member covering an out-of-combat state, and
   * adding one is a scope DECISION that needs the owner. A scoped entry is
   * filed as ANSWERED -- kept out of the live-gap list and shown apart in the
   * Talent panel -- so tagging this would delete it from the one list that gets
   * re-read, which has already cost three Rogue talents at once.
   *
   * SO IT IS A LIVE GAP WITH A REASON THAT NAMES ITS QUESTION, which is what
   * makes it askable. ANGER MANAGEMENT'S SECOND CLAUSE IS THE SAME QUESTION --
   * "reduces Rage loss while out of combat by 30%" -- and it is carried in a
   * COMMENT on that talent rather than as a declaration, so the census counts
   * Anger Management as fully modelled. That is the undeclared-ruling shape
   * CLAUDE.md records under Feral Swiftness, and it is left alone here because
   * fixing it means first deciding whether it is a ruling or a gap.
   *
   * THE DW FURY BUILD TAKES 2/5 OF IT, which the owner chose, so this is a
   * talent whose points are real and whose effect is nothing -- the same honest
   * shape Improved Tactical Mastery has had all along.
   * ----------------------------------------------------------------------
   */
  lingering_rage: [
    {
      kind: 'unmodelled',
      reason:
        'Rage decay after leaving combat. Nothing here leaves combat: a fight ' +
        'begins in combat and ends with the clock, so no rage decays and there ' +
        'is no delay to lengthen. Whether an out-of-combat state belongs in ' +
        'scope is a question for the ruleset owner rather than a gap in the ' +
        "engine -- Anger Management's second clause is the same question. Gore " +
        "Drinker's Enrage clause is NOT: that one needs a hook on an aura " +
        'being applied, and Enrage fires on being HIT, in combat.',
    },
  ],

  /*
   * PRECISION IS GONE from the Warrior, removed at client build 1.60.1.70170 and
   * named in the patch notes nowhere at all -- the Fury tree is one talent
   * shorter, 53 to 52, and this is the fourth removal that accounts for it,
   * beside Improved Cleave, Boundless Rage and Toughness.
   *
   * NO WARRIOR BUILD SPENT A POINT HERE, so nothing moved. The PALADIN still has
   * a talent of this name, in its Protection tree, which the Prot Pally build
   * takes 3/3 of -- ids are unique within a class and not across them, which is
   * why `values/*.json` is one file per class. Deleting the wrong one would have
   * typechecked cleanly and produced a silently weaker tank.
   */

  /*
   * FULLY MODELLED. The ability was missing from the spreadsheet and is in
   * Forever's spell data: +20% damage done, +5% damage taken, 30 sec, 10 rage,
   * 3 minute cooldown.
   */
  death_wish: [{ kind: 'grantAbility', abilityId: 'death_wish' }],

  improved_intercept: [{ kind: 'abilityCooldown', abilityId: 'intercept', unit: 'seconds' }],

  /*
   * REASON CORRECTED 2026-09-23. It used to read "inert pending its effect
   * values from the ruleset owner", and the values have been in
   * `data/talents/values/warrior.json` since the talents were captured: 5 Rage
   * and 50% at 1/2, 10 and 100% at 2/2. The blocker it named no longer exists.
   *
   * The instant Rage does NOT depend on the base ability's missing magnitude --
   * Berserker Rage's own "generating extra rage when taking damage" still has
   * no number anywhere, including the spellbook, but this talent grants its
   * Rage on activation and could be modelled on its own.
   *
   * What stops it is the rotation: no Warrior priority list casts Berserker
   * Rage, so an ability-cost or on-cast effect would never fire. That is a
   * smaller and much more checkable claim than the one it replaces.
   */
  /*
   * BUILT, and it was never an engine gap.
   *
   * "Your Berserker Rage ability will instantly generate 10 Rage and has a
   * 100% chance to remove all movement impairing effects when activated" --
   * two clauses, and the first states its number: 5 at one rank and 10 at two.
   * The old entry wrote the whole talent off because "no priority list casts
   * Berserker Rage", which is an argument about a LIST and was recorded as
   * though it were an argument about the engine. A talent working and a talent
   * mattering are different questions; this is the first.
   *
   * `valueIndex: 0` because the row carries the rage AND the 100% dispel
   * chance, and taking the second would grant 100 rage on activation.
   *
   * Still worth nothing to any of the three profiles: none of them spends a
   * point here, and no list casts the ability. That is a BUILD cause and a
   * LIST cause, both of which expire differently from an engine one.
   */
  improved_berserker_rage: [
    {
      kind: 'abilityBonus',
      abilityId: 'berserker_rage_cast',
      key: BERSERKER_RAGE_ACTIVATION_BONUS,
      valueIndex: 0,
    },
    {
      kind: 'unmodelled',
      scope: 'crowdControl',
      reason:
        'The movement-impairing clause removes snares, which are out of ' +
        'scope by the same ruling that covers Piercing Howl -- and nothing ' +
        'in an encounter here applies one. The rage on activation is applied.',
    },
  ],

  /*
   * ITS PREREQUISITE MOVED AND ITS EFFECT DID NOT. Flurry required Enrage 5/5
   * and requires Death Wish 1/1 at client build 1.60.1.70170 -- which is tree
   * STRUCTURE and lives in `data/talents/warrior.json`, so nothing here changes.
   *
   * IT IS WHAT LET THE OWNER'S NEW DW FURY BUILD DROP ENRAGE TO 4/5 and keep
   * Flurry at 5/5. Gore Drinker, the new talent that DOES require Enrage 5, is
   * the one that build passed over.
   */
  flurry: [{ kind: 'reaction', reactionId: 'flurry' }],

  /*
   * GORE DRINKER, new at client build 1.60.1.70170: "Your Enrage, Berserker
   * Rage, Bloodrage, Death Wish, and Bloodthirst abilities cause your next 3
   * melee attacks to restore 0.5/1% of your maximum Health."
   *
   * ----------------------------------------------------------------------
   * FOUR OF THE FIVE TRIGGERS ARE CASTS AND THE FIFTH IS NOT. Berserker Rage,
   * Bloodrage, Death Wish and Bloodthirst are abilities a Warrior presses;
   * ENRAGE IS A TALENT PROC in Forever and appears in no spellbook, so there is
   * no cast for a cast reaction to see. That clause gets its own `unmodelled`
   * entry rather than being quietly folded in with the other four -- a reason
   * that names what is missing is the kind that expires.
   *
   * ONE CAST REACTION FOR FOUR ABILITIES, NOT FOUR REACTIONS.
   * `CastReaction.abilityId` holds one id, so the set is checked in
   * `canTrigger` instead. That is the opposite of what King of the Jungle's
   * note argued for a SINGLE-ability reaction, and for the same reason: the
   * field expresses one ability exactly and cannot express four at all.
   *
   * `valueIndex: 1` IS THE HEALTH PERCENTAGE. The row is `[3, 0.5]` and
   * `[3, 1]` -- the charge count first, the percentage second -- so index 0
   * would grant 3% of maximum health per attack at BOTH ranks: six times the
   * talent at 1/2, three times at 2/2, and a perfectly plausible number either
   * way. Both entries take index 1; the charge count is a constant on the aura,
   * which is where Flurry keeps its three as well.
   *
   * TWO EFFECTS FOR ONE TALENT because the triggers sit on both sides: a CAST
   * opens the window and an ATTACK spends it. The same two-entry shape Blood
   * Craze had when its third clause existed.
   *
   * WORTH NOTHING TO ANY PROFILE -- no build takes it, and the one that could
   * (DW Fury, which has Enrage) spends its points elsewhere. A BUILD cause, so
   * it expires the day a build changes rather than the day the engine does.
   *
   * AND THE OWNER HAS RULED THE WHOLE TALENT INERT FOR NOW: "Gore Drinker can be
   * considered to be inert for now. It's a non-combat talent for DPS warriors."
   * So the Enrage clause below is a gap nobody is waiting on, which is a
   * different thing from a gap nobody has got to -- and the four cast triggers
   * are kept rather than reverted, because they are built, tested and cost
   * nothing to carry. **A ruling not to model something is not an instruction to
   * delete a working mechanism.**
   *
   * "NON-COMBAT" IS ABOUT WHAT THE TALENT IS FOR, NOT ABOUT WHEN IT FIRES, and
   * the two are easy to run together. It restores health, which a warrior
   * nothing is attacking has no use for -- that is the owner's point. Its Enrage
   * trigger fires on being HIT, squarely in combat, so it is not the
   * out-of-combat question Lingering Rage and Anger Management are waiting on.
   * ----------------------------------------------------------------------
   */
  gore_drinker: [
    { kind: 'castReaction', reactionId: 'gore_drinker', valueIndex: 1 },
    { kind: 'reaction', reactionId: 'gore_drinker_heal', valueIndex: 1 },
    {
      kind: 'unmodelled',
      reason:
        'Its Enrage trigger does nothing: Enrage is a talent PROC in Forever ' +
        'rather than an ability, so it is never cast and a cast reaction cannot ' +
        'see it. It would need a hook on an aura being APPLIED, which the ' +
        'engine has no equivalent of. The other four triggers are casts and ' +
        'all four fire. THE OWNER HAS RULED THE TALENT INERT FOR NOW -- "a ' +
        'non-combat talent for DPS warriors" -- so this clause is a gap nobody ' +
        'is waiting on rather than one nobody has got to. It keeps no scope tag: ' +
        'the ruling is about the TALENT being worth modelling, and what blocks ' +
        'this clause is a missing engine hook on an aura being applied, which ' +
        'is a capability question and not a scope one.',
    },
  ],

  bloodthirst: [{ kind: 'grantAbility', abilityId: 'bloodthirst' }],

  // ---------------------------------------------------------------------
  // Protection
  // ---------------------------------------------------------------------
  /*
   * Two values: block chance is the first, the rage proc chance the second.
   *
   * FULLY MODELLED. It carried an `unmodelled` entry saying neither half could
   * fire because nothing attacked the player; that stopped being true when
   * `encounter.targetAttacks` landed, and the entry outlived it. Both halves
   * run whenever the target swings back. Whether that switch is on is an
   * encounter choice, not a gap in the model, so nothing is flagged here.
   */
  shield_specialization: [
    { kind: 'stat', stat: 'blockChance', operation: 'flat' },
    { kind: 'reaction', reactionId: 'shield_specialization', valueIndex: 1 },
  ],

  /*
   * FULLY MODELLED, now that the ruleset owner has given the formula. 4 skill
   * a rank to 20 at 5/5, and one point of defense skill is worth 0.04
   * percentage points to FIVE numbers at once: the attacker's miss goes up,
   * its crit goes down, and the defender's dodge, parry and block all go up.
   *
   * The talent was blocked on exactly that formula and the received table said
   * so -- "a defense skill talent cannot be modelled yet. That is the ONLY
   * missing piece here now."
   */
  anticipation: [{ kind: 'stat', stat: 'defenseSkill', operation: 'flat' }],

  /*
   * FULLY MODELLED. "Increases all the Rage generated by your Bloodrage
   * ability by 25/50%", so at 2/2 the ten on cast becomes fifteen and the ten
   * over ten seconds becomes fifteen too -- ALL the rage, both halves.
   *
   * The old reason said Bloodrage was "castable but inert", which was true
   * when it was written and stopped being true the day Bloodrage got its
   * periodic. A reason is a claim about the engine on the day it was made.
   */
  improved_bloodrage: [
    { kind: 'abilityBonus', abilityId: 'bloodrage_cast', key: 'ragePercent' },
  ],

  /*
   * TOUGHNESS IS GONE from the Warrior, removed at client build 1.60.1.70170 and
   * named in the patch notes under Protection. No Warrior build spent a point on
   * it -- the Prot build's 34 Protection points went elsewhere -- so nothing
   * moved.
   *
   * `itemArmorPercent` STILL HAS TWO CALLERS and is not going anywhere: the
   * PALADIN's Toughness, which the Prot Pally takes 5/5 of, and the Druid's
   * Thick Hide, which the Bear takes 3/3 of. The argument for it is recorded
   * there -- the engine held one armor number, so a percentage would have scaled
   * the class base too, and `armorFromItems` reads the equipped contribution on
   * its own, which is also why an ENCHANT's armor is outside it by the owner's
   * ruling.
   */

  improved_thunder_clap: [{ kind: 'abilityCost', abilityId: 'thunder_clap' }],

  /*
   * FULLY MODELLED, and the last of this file's reasons to expire.
   *
   * It said: "the ability is implemented, but it changes no outcome, because
   * the player cannot drop below one health and survival is not modelled. It
   * is a real ability with nothing here to measure it against." Every clause
   * was true when it was written and none of them is now. The character dies,
   * the deaths are counted, and Last Stand is the FIRST entry of the
   * Protection list -- cast at under 30% health, about once a fight.
   *
   * Nothing about the talent changed to make that happen. The encounter did.
   */
  last_stand: [{ kind: 'grantAbility', abilityId: 'last_stand' }],

  /*
   * FULLY MODELLED: a 50/100% chance of 5 rage when the warrior dodges or
   * parries, while a shield is equipped.
   *
   * It used to carry a note: "a reaction cannot see the wearer gear, so it
   * would also fire for a Protection warrior holding two weapons". True of the
   * reaction, and the wrong place to give up -- EQUIPPING A SHIELD IS A CHOICE
   * THE PLAYER MAKES ON THE GUI, as the ruleset owner put it, so the engine is
   * entitled to know about it.
   *
   * It is knowable exactly once, when the build is assembled and the equipment
   * is in scope. `requires` on the reaction effect does that: no shield, no
   * proc registered at all, which is more accurate than a proc that fires and
   * a note admitting it should not have. Bastion has gated on the same field
   * for as long as it has existed.
   */
  master_of_defense: [
    { kind: 'reaction', reactionId: 'master_of_defense', requires: { shield: true } },
  ],
  /*
   * FULLY MODELLED, for the same reason as Shield Specialization above: the
   * `unmodelled` entry here said Revenge could never fire, and Revenge has been
   * in the rotation since the target learned to swing back.
   */
  improved_revenge: [{ kind: 'abilityDamage', abilityId: 'revenge' }],


  defiance: [{ kind: 'unmodelled', scope: 'threat', reason: 'Threat, which the engine does not track.' }],

  improved_sunder_armor: [{ kind: 'abilityCost', abilityId: 'sunder_armor_cast' }],

  // Disarm is a control effect and a raid boss cannot be disarmed, so the
  // ability is absent by ruling rather than pending.
  improved_disarm: [
    {
      kind: 'unmodelled',
      scope: 'crowdControl',
      reason: 'Disarm is a control effect, and control is not modelled. The ability is absent for that reason.',
    },
  ],

  /*
   * FULLY MODELLED, and it took three steps to get here.
   *
   * It first read "Stances gate nothing", which was true when written and
   * false from the day abilities got a `stances` field. Corrected to "Charge
   * is in no priority list and cannot be used in combat" -- also true, until
   * the ruleset owner put Charge in two lists as the opening action and asked
   * for this one to gate the Protection version of it.
   *
   * SO IT IS THE GATE ITSELF NOW. Charge declares `stances: ['battle_stance']`
   * and a Protection warrior opens in Defensive, so `casting.ts` refuses the
   * cast; Vanguard adds Defensive Stance and the same entry starts working.
   * Nothing in the Protection list has to mention the talent -- the rule is
   * the ability's stance list, and the talent edits it.
   */
  vanguard: [{ kind: 'abilityStance', abilityId: 'charge', stance: 'defensive_stance' }],

  /*
   * FULLY MODELLED. 5.5 minutes off at 1/2 and 11 at 2/2, from the captured
   * per-rank values.
   *
   * Its old reason said "modifies Shield Wall, which is castable but inert" --
   * true until Shield Wall got its damage reduction, and until survival was
   * something a run could measure.
   *
   * ITS VALUES ARE ALSO WHAT SETTLED SHIELD WALL'S COOLDOWN. Eleven minutes
   * off a fifteen minute cooldown leaves four, which is exactly what the
   * ruleset owner states. Off the spreadsheet's thirty it would leave
   * nineteen, which is not a number anyone would write a talent for.
   */
  improved_shield_wall: [
    { kind: 'abilityCooldown', abilityId: 'shield_wall_cast', unit: 'minutes' },
  ],

  /*
   * NOT TO BE IMPLEMENTED, AND DELIBERATELY SILENT ON THE GUI.
   *
   * It stuns the target for 5 sec, and the project owner classes stuns as
   * non-combat -- so this is out of scope rather than waiting on anything.
   *
   * THE `unmodelled` ENTRY WAS REMOVED ON THE OWNER'S INSTRUCTION: "no note
   * about this needs to be made on the GUI". That is a deliberate exception to
   * the rule that an inert choice says so where it is made, and it is written
   * here because the exception is the surprising part. The talent is not
   * broken and is not waiting on data; there is nothing for a reader to act
   * on, so the panel stays quiet.
   *
   * The ability grant stays so the talent gates its tier correctly, and no
   * priority list casts it.
   */
  concussion_blow: [{ kind: 'grantAbility', abilityId: 'concussion_blow' }],

  improved_shield_bash: [
    {
      kind: 'unmodelled',
      scope: 'crowdControl',
      reason:
        'Its whole effect is a silence on Shield Bash, and control is not ' +
        'modelled. The ability is absent for that reason.',
    },
  ],

  // Two stats at once. `percentAdd` wants a fraction, so 2% is scaled to 0.02.
  /*
   * BASTION REPLACED VITALITY IN THIS SLOT, and the replacement is a fact about
   * the tree rather than a rename. Forever's tier 20 Protection talent is
   * "Increases all damage you deal by 10% while a shield is equipped"; the
   * repository had Vitality, a stamina and strength percentage, because the
   * structure file was once hand-corrected and the hand edit put the wrong
   * talent here. Re-scraped 2026-09-18.
   *
   * Its effect is expressible -- a damage multiplier conditional on a shield --
   * and its PER-RANK VALUES ARE NOT KNOWN. Forever prints the same 10% at every
   * rank and the talent has no per-rank spell ids, so the split across five
   * ranks is unpublished. 2/4/6/8/10 is the obvious guess and is exactly the
   * plausible invented number this project refuses.
   *
   * So it is declared unmodelled, not given a number. Capture the ranks with
   * tools/talent_ranks_browser.js and this becomes a `damageMultiplier` effect
   * gated on a shield.
   */
  /*
   * MODELLED, with a caveat recorded in the values file rather than here.
   *
   * The ruleset owner confirmed rank 5: a 1.1x multiplier on ALL damage the
   * character deals, for as long as a shield is equipped. Ranks 1 to 4 are a
   * linear fill and are NOT confirmed -- Forever prints the same figure at
   * every rank and the talent has no per-rank spell ids. See the note on the
   * entry in `src/data/talents/values/warrior.json`.
   *
   * `conditionalDamage` rather than a per-ability modifier, because "all
   * damage you deal" includes auto attacks, which are not abilities.
   */
  bastion: [{ kind: 'conditionalDamage', requires: { shield: true } }],

  /*
   * FULLY MODELLED, now that the ruleset owner has defined the set. One rage
   * a rank to three at 3/3, off every ability that is PROCESSED THROUGH A
   * COMBAT TABLE -- Heroic Strike, Thunder Clap, Sunder Armor -- and off
   * nothing that is not, which is what excludes Battle Shout.
   *
   * Derived from `attackTable` rather than a list of ability ids. A list
   * would need editing every time an ability was added, and the edit that was
   * forgotten would make the talent silently weaker.
   */
  focused_rage: [{ kind: 'attackAbilityCost' }],

  shield_slam: [{ kind: 'grantAbility', abilityId: 'shield_slam' }],
};
