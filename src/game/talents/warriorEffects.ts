import type { TalentEffects } from './TalentEffect';

/**
 * What every Warrior talent does, by talent id.
 *
 * ALL 53 have an entry. A talent that cannot be modelled says so and says why,
 * rather than being absent — absence would be indistinguishable from an
 * oversight, and this file is the only place that can tell the difference. A
 * test asserts the coverage both ways, which is how three entries lost to a
 * careless edit were caught.
 *
 * 43 are fully modelled and 3 more are PARTLY modelled — something real plus an
 * `unmodelled` entry naming the part that is missing (Sweeping Strikes,
 * Weaponmaster, Piercing Howl). 7 do nothing at all.
 *
 * Those three numbers must sum to 53. An earlier count said 21 inert and summed
 * to 54, which is how the drift below went unnoticed, and the count after it
 * (29/6/18) went stale as the talents were filled in.
 *
 * SIX OF THE SEVEN INERT ONES ARE PERMANENTLY OUT OF SCOPE BY RULING — movement,
 * crowd control or threat — and each says so with a `scope` on its `unmodelled`
 * entry rather than only in prose, so the milestone counts it as a decision and
 * not as work. Only three talents on this class are blocked on anything that
 * could ever change: Improved Berserker Rage (no priority list casts Berserker
 * Rage), Sweeping Strikes (needs a second target) and Weaponmaster's mace clause
 * (armor ignore). See CLAUDE.md, "Scope".
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
 *     ruleset owner (Bloodrage, Berserker Rage, Shield Wall, Shield Block)
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
 * The Gear panel's "Equipped but not simulated" does the same job for items,
 * and the Talent panel prints these the same way.
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
        'missing second target. See engine/combat/targeting.ts.',
    },
  ],

  /*
   * Three clauses, one per weapon family, and only two of them can be modelled.
   * The axe and polearm crit is expressible; the sword extra-attack chance
   * needs a reaction that can trigger another swing, which `extraAttack`
   * supports but nothing wires to a talent yet; the mace and staff armor
   * ignore has no home in the damage pipeline at all.
   *
   * The crit clause applies on its own rather than the talent being written off
   * whole: with an axe equipped it is exactly right, and with anything else it
   * reports as not applying rather than silently contributing.
   */
  /*
   * PARTLY MODELLED, and the sword clause is the part that is.
   *
   * Three clauses by weapon type: crit with an axe or polearm, armor
   * penetration with a mace or staff, and a chance at an extra attack with a
   * sword. The third is a reaction and is implemented, reading the talent's
   * THIRD value through `valueIndex`.
   *
   * The other two are unmodelled for the same reason as each other: an ability
   * cannot ask what weapon type it is holding. Nothing in the engine carries a
   * weapon's type -- only its speed, damage and skill -- so all three clauses
   * are ungated and the sword one fires whatever the warrior is wielding.
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
   */
  weaponmaster: [
    { kind: 'conditionalCrit', requires: { weaponTypes: ['axe', 'polearm'] } },
    { kind: 'reaction', reactionId: 'weaponmaster', valueIndex: 2 },
    {
      kind: 'unmodelled',
      reason:
        'The mace and staff clause ignores a percentage of the target armor, ' +
        'which the damage pipeline cannot express. The axe/polearm crit and ' +
        'the sword extra attack both work; the crit reads the MAIN HAND only, ' +
        'because crit chance has no per-slot form in this engine.',
    },
  ],

  /*
   * Two effects that scale and one that does not. "Slam no longer interrupts
   * your melee swing time" is granted by both ranks, and is worth far more than
   * the quarter second of cast time: without it a Slam costs a whole swing.
   */
  improved_slam: [
    { kind: 'abilityCastTime', abilityId: 'slam' },
    { kind: 'abilityGcd', abilityId: 'slam' },
    { kind: 'abilityHoldsSwing', abilityId: 'slam' },
  ],

  improved_hamstring: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Immobilises the target. There is no movement to prevent.' },
  ],

  mortal_strike: [{ kind: 'grantAbility', abilityId: 'mortal_strike' }],

  // ---------------------------------------------------------------------
  // Fury
  // ---------------------------------------------------------------------
  booming_voice: [
    { kind: 'unmodelled', scope: 'positioning', reason: 'Shout radius. The encounter has no positions.' },
  ],

  // Crit is held in percentage POINTS, so "+1%" is a flat +1 and needs no scale.
  cruelty: [{ kind: 'stat', stat: 'critChance', operation: 'flat' }],

  iron_will: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'Stun and fear duration. Nothing stuns or fears the player.' },
  ],

  unbridled_wrath: [{ kind: 'reaction', reactionId: 'unbridled_wrath' }],

  improved_cleave: [{ kind: 'abilityCost', abilityId: 'cleave' }],

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
   * FULLY MODELLED. All three triggers fire:
   * being critically struck, taking more than 20% of maximum health from one
   * blow, and landing a Bloodthirst. Two reactions, because the first two
   * watch attacks RECEIVED and the third one dealt.
   *
   * THE TICK CADENCE IS NOW THE RULESET OWNER'S, not a placeholder: once every
   * two seconds for three ticks across the six. It was the last thing about
   * this talent that came from Classic rather than from Forever.
   *
   * Its old reason said the healing "would not be observable: the player
   * cannot drop below one health, so a heal has nothing to restore and
   * survival is not modelled". True when written. The character now dies,
   * the deaths are counted, and healing received is a figure on the results
   * page.
   */
  blood_craze: [
    { kind: 'reaction', reactionId: 'blood_craze' },
    { kind: 'reaction', reactionId: 'blood_craze_bloodthirst' },
  ],

  boundless_rage: [{ kind: 'resourceMax', resource: 'rage' }],

  /*
   * FULLY MODELLED, all three clauses. At 5/5: off-hand damage +25%, which
   * takes the multiplier from 0.5 to 0.625; off-hand rage generation +100%,
   * so it doubles; and +10 percentage points of hit on off-hand attacks only.
   *
   * Every rank is real captured data rather than interpolation -- the values
   * file holds [5,20,2] through [25,100,10] and all three clauses were
   * confirmed independently by the ruleset owner.
   *
   * Three effect kinds because the three land in three different places, and
   * that is precisely why this went unmodelled: one kind could only ever have
   * done a third of the talent.
   */
  dual_wield_specialization: [
    { kind: 'offHandDamage', valueIndex: 0 },
    { kind: 'offHandResourceGeneration', valueIndex: 1 },
    { kind: 'offHandHit', valueIndex: 2 },
  ],

  /*
   * The Whirlwind half is MODELLED: the off hand strikes immediately after
   * the main hand, carrying the off-hand damage penalty -- 0.625 with Dual
   * Wield Specialization at 5/5 -- and not the off-hand miss penalty, which
   * lives only in the auto-attack table and which a special never uses.
   *
   * The Cleave half is modelled too, now that the ruleset owner has confirmed
   * the number: one rank, two rage off Cleave's twenty. A single-rank talent
   * has no variable the calculator can identify from its own text, so the
   * values file carries `null` until someone fills it in by hand -- which is
   * exactly the workflow that directory's README describes, and the note on
   * the entry records who confirmed it.
   */
  raging_blows: [
    { kind: 'abilityFlag', abilityId: 'whirlwind', key: 'offHandStrike' },
    { kind: 'abilityCost', abilityId: 'cleave' },
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

  precision: [{ kind: 'stat', stat: 'hitChance', operation: 'flat' }],

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
  improved_berserker_rage: [
    {
      kind: 'unmodelled',
      reason:
        'Grants Rage when Berserker Rage is activated, and no priority list ' +
        'casts Berserker Rage. The movement-impairing clause has nothing to ' +
        'remove.',
    },
  ],

  flurry: [{ kind: 'reaction', reactionId: 'flurry' }],

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
   * FULLY MODELLED. 10% more armor FROM ITEMS at 5/5.
   *
   * The old reason was right about the problem and wrong that it was
   * unsolvable: the engine held one armor number, so a percentage would have
   * scaled the class base too. `armorFromItems` reads the equipped
   * contribution on its own, and the talent adds a flat amount computed from
   * that -- so a character in no armor gets nothing, which is correct.
   */
  toughness: [{ kind: 'itemArmorPercent' }],

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
