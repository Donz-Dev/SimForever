import type { TalentEffects } from './TalentEffect';

/**
 * What each Hunter talent does, as data.
 *
 * Every one of the 50 has an entry, and one that cannot be expressed says so.
 *
 * ----------------------------------------------------------------------------
 * CAREFUL AIM WORKS NOW, and it was the talent that forced `statFromStat`.
 * "Increases your Attack Power by 100% of your Intellect", taken at 5/5 by
 * all three profiles, and for a long time nothing could declare a stat
 * derived from another stat. Six talents across five classes said so; they
 * were retired together, which is the fourth time reasons written
 * specifically enough to re-read have paid for themselves.
 *
 * WHAT ELSE CLUSTERS:
 *
 *   PETS             eight, and SIX OF THEM NOW WORK. They were all inert for
 *                    one reason -- a talent effect reaches the character
 *                    carrying it and a pet is a separate combatant -- which
 *                    `petStat` and `petReaction` answer. Both Lone Wolf builds
 *                    take the talent that says they have no pet, so the whole
 *                    cluster is still correctly inert for them.
 *   TRAPS            four, down from six. Immolation and Explosive Trap are
 *                    both DECLARED on the owner's rulings; what is left needs a
 *                    trap to sit on the ground and be walked onto.
 *   MOVEMENT AND     seven. Roots, slows, disorients and speed, none of which
 *   CONTROL          a standing raid boss cares about.
 * ----------------------------------------------------------------------------
 */

/** Said once; seven talents say it. */
const NO_MOVEMENT = 'Movement or control, and the target neither moves nor can be controlled.';

export const HUNTER_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Beast Mastery -------------------------------------------------------

  deadly_aspects: [{ kind: 'reaction', reactionId: 'deadly_aspects' }],

  endurance_training: [
    { kind: 'petStat', property: 'health' },
    { kind: 'petStat', property: 'armor' },
  ],

  focused_fire: [
    /*
     * "Increases all damage you and your pet deal by {0}% WHILE YOUR PET IS
     * ACTIVE."
     *
     * THE CONDITION IS CHECKED NOW, and it was not merely missing before --
     * it was wrong. Declared with `requires: {}`, meaning no requirement at
     * all, both Lone Wolf builds collected the 2% for a pet that is never
     * built. They take this as a cheap route to Careful Aim and then take
     * the talent that means "no pet", so it was the one clause that mattered.
     *
     * `hasPet` is answered by `bringsPet`, the same function the encounter
     * uses to decide whether to construct one -- so the talent and the fight
     * cannot disagree.
     */
    { kind: 'conditionalDamage', requires: { hasPet: true } },
    /*
     * "Increases all damage YOU AND YOUR PET deal." Both halves, which is what
     * `petStat` was added for. This one needs no condition: a build with no
     * pet has nothing for it to land on.
     */
    { kind: 'petStat', property: 'damage' },
  ],

  improved_aspect_of_the_monkey: [
    { kind: 'unmodelled', reason: 'Dodge from an Aspect no damage profile uses.' },
  ],

  pathfinding: [{ kind: 'unmodelled', scope: 'positioning', reason: NO_MOVEMENT }],

  improved_revive_pet: [
    { kind: 'unmodelled', reason: 'Reviving a pet, and no pet dies in these fights.' },
  ],

  bestial_swiftness: [{ kind: 'unmodelled', scope: 'positioning', reason: NO_MOVEMENT }],

  unleashed_fury: [
    { kind: 'petStat', property: 'damage' },
    /*
     * "...AND YOUR HAWKS". A hawk is a periodic effect carrying the aura's own
     * id, and `abilityDamage` reaches a periodic tick through exactly that --
     * the route Improved Rend takes on the Warrior. So the hawk half needed
     * no new machinery at all, only noticing it was available.
     */
    { kind: 'abilityDamage', abilityId: 'summon_hawk' },
  ],

  improved_mend_pet: [{ kind: 'unmodelled', scope: 'healing', reason: 'Healing a pet, and nothing damages it here.' }],

  ferocity: [
    // ON TOP of the 100% of the Hunter's crit a pet already inherits, which
    // is the Forever rule. The talent is a further bonus and says so.
    { kind: 'petStat', property: 'crit' },
    { kind: 'abilityCrit', abilityId: 'summon_hawk' },
  ],

  summon_hawk: [{ kind: 'grantAbility', abilityId: 'summon_hawk' }],

  spirit_bond: [
    { kind: 'unmodelled', reason: 'Health regeneration, and no damage profile is attacked.' },
  ],

  intimidation: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'A stun, which is out of scope as every stun is.' }],

  bestial_discipline: [
    { kind: 'petStat', property: 'focusRegen' },
    /*
     * "...and allows {1}% of your Mana regeneration to continue while casting."
     *
     * THE REASON THIS REPLACES WAS WRONG TWICE OVER. It said the clause "does
     * not matter: a Hunter has no cast long enough for it to reach", and both
     * halves of that are false.
     *
     * First, `manaRegenBypass` is not about a CAST. `manaPerTick` reads it
     * during the FIVE SECOND RULE -- the lockout after spending mana -- so what
     * it needs is a Hunter that spends mana, not one standing still casting.
     * Beast Mastery spends 190 a hawk and 310 an Aimed Shot and is inside that
     * lockout for almost the whole fight.
     *
     * Second, the Hunter does have a long cast: Sniper Shot is FOUR seconds.
     * That was true from the day the transcription was corrected and the reason
     * was never re-read -- the same shape as the five expired caveats CLAUDE.md
     * counts.
     *
     * Five talents across five classes already read this exact wording into
     * this exact stat. This is the sixth, and the only new thing about it is
     * `valueIndex`, because the talent's row states the pet's focus first.
     */
    { kind: 'stat', stat: 'manaRegenBypass', operation: 'flat', valueIndex: 1 },
  ],

  frenzy: [{ kind: 'petReaction', reactionId: 'frenzy' }],

  bestial_wrath: [{ kind: 'grantAbility', abilityId: 'bestial_wrath' }],

  // --- Marksmanship --------------------------------------------------------

  hawk_eye: [{ kind: 'unmodelled', scope: 'positioning', reason: 'Range, and nothing here has a position.' }],

  improved_concussive_shot: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'A stun on a shot no damage list casts.' },
  ],

  lethal_attacks: [
    /*
     * "Increases your critical strike chance with ALL attacks."
     *
     * ONE STAT COVERS BOTH TABLES. The engine has `critChance` and
     * `spellCritChance` and no third for ranged -- the ranged table reads
     * `critChance`, the same one melee does. So this is exactly right rather
     * than approximately, and a Hunter casts no spells for the other to reach.
     */
    { kind: 'stat', stat: 'critChance', operation: 'flat' },
  ],

  improved_stings: [
    { kind: 'abilityDamage', abilityId: 'serpent_sting' },
    {
      kind: 'unmodelled',
      reason: 'The Serpent Sting damage applies. Its Viper and Scorpid clauses reach neither.',
    },
  ],

  efficiency: [
    // "Your Shots, Stings, and melee abilities" -- everything a Hunter pays
    // mana for bar the Aspects.
    {
      kind: 'grantCastModifier',
      abilityIds: [
        'arcane_shot',
        'aimed_shot',
        'multi_shot',
        'sniper_shot',
        'serpent_sting',
        'raptor_strike',
        'mongoose_bite',
      ],
      property: 'costFraction',
    },
  ],

  careful_aim: [
    /*
     * "Increases your Attack Power by {0}% of your Intellect", 100% at 5/5,
     * and all three Hunter profiles take it at full rank.
     *
     * BOTH POOLS, ON THE RULESET OWNER'S RULING -- "Careful Aim contributes
     * to attack power and ranged attack power". Not an interpretation any
     * more, and worth recording that the wording alone pointed the other way:
     * the talent says only "Attack Power", and Forever names the ranged pool
     * explicitly everywhere else it means it (Aspect of the Hawk, Trueshot
     * Aura). Asking was the whole difference, because declaring the melee
     * half alone would have produced a Hunter that looked entirely ordinary.
     *
     * TWO CONVERSIONS RATHER THAN ONE EFFECT WITH TWO TARGETS, because that
     * is what the shape already is: each is a separate term in the
     * derivation, and `withStatConversions` adds them independently.
     */
    { kind: 'statFromStat', from: 'intellect', to: 'attackPower' },
    { kind: 'statFromStat', from: 'intellect', to: 'rangedAttackPower' },
  ],

  rapid_killing: [
    /*
     * "Reduces the cooldown on your Rapid Fire ability by 2 min."
     *
     * ITS OWN `unmodelled` REASON SAID THIS WAS "REAL" AND NOTHING APPLIED IT.
     * The talent carried a single unmodelled entry whose first clause read
     * "Its Rapid Fire cooldown reduction is real" -- and there was no effect in
     * the list at all, so the cooldown stayed 5 minutes for both builds that
     * take the talent at 2/2. A reason that describes a working half is a claim
     * about the code, and this one was false the day it was written.
     *
     * WORTH NOTHING TO EITHER PROFILE TODAY, and declared anyway. 5 minutes and
     * 3 minutes are both longer than a fight, so Rapid Fire is cast once either
     * way -- which is exactly why nobody noticed. Assert the MECHANISM rather
     * than a DPS delta: the resolved cooldown is what changed.
     *
     * MINUTES, because the values file keeps the source's own number: the text
     * reads "by {0} min" and the rank-2 value is 2.
     */
    { kind: 'abilityCooldown', abilityId: 'rapid_fire', unit: 'minutes' },
    {
      kind: 'unmodelled',
      reason:
        'Its Rapid Fire cooldown reduction applies. Its damage bonus needs a ' +
        'KILL -- "when you kill a non-trivial enemy or it dies while afflicted ' +
        'by your Serpent Sting" -- and the target survives every fight here.',
    },
  ],

  improved_arcane_shot: [{ kind: 'abilityCooldown', abilityId: 'arcane_shot', unit: 'seconds' }],

  lone_wolf: [{ kind: 'grantAura', auraId: 'lone_wolf' }],

  trueshot_aura: [
    {
      kind: 'unmodelled',
      reason:
        'A party-wide ranged attack power aura. The engine simulates one ' +
        'character, so it is the raid buff of the same name -- selectable ' +
        'there rather than granted here.',
    },
  ],

  mortal_shots: [
    /*
     * "Increases the critical strike damage bonus on all RANGED ABILITIES."
     *
     * `ranged-special` only -- abilities, so Auto Shot is not included, which
     * is what separates this from Ranged Weapon Specialization above.
     *
     * It reaches a Serpent Sting tick, and should: the tick borrows the
     * ranged table for its crit, so the crit DAMAGE that goes with it belongs
     * to the same table.
     *
     * It was `critDamageBonus`, which is whole-character with no table, and
     * carried a note saying so. A ranged build has no melee ability to
     * over-apply to, so this costs those two nothing and stops being a
     * caveat.
     */
    { kind: 'attackTableCritDamage', tables: ['ranged-special'] },
  ],

  rapid_recuperation: [
    { kind: 'stat', stat: 'manaRegenBypass', operation: 'flat' },
  ],

  barrage: [
    { kind: 'abilityDamage', abilityId: 'multi_shot' },
    { kind: 'abilityDamage', abilityId: 'aimed_shot' },
  ],

  scatter_shot: [
    { kind: 'unmodelled', scope: 'crowdControl', reason: 'A disorient that also turns off auto-attack.' },
  ],

  ranged_weapon_specialization: [
    /*
     * "Increases the damage you deal with RANGED WEAPONS."
     *
     * BOTH RANGED TABLES, because this one is about the WEAPON rather than
     * about abilities -- Auto Shot is most of what a bow does and excluding
     * it would gut the talent.
     *
     * A damage-over-time tick is deliberately out of reach: Serpent Sting
     * ticks nature damage and only borrows the ranged table for its CRIT, so
     * `dealDamage` looks this up on `attackTable` alone. A sting's poison is
     * not weapon damage.
     */
    { kind: 'attackTableDamage', tables: ['ranged-auto', 'ranged-special'] },
  ],

  sniper_shot: [{ kind: 'grantAbility', abilityId: 'sniper_shot' }],

  // --- Survival ------------------------------------------------------------

  improved_tracking: [
    /*
     * "While tracking Beasts, Demons, ... all damage you deal to the tracked
     * creature type is increased." A Hunter tracks what it is fighting, so for
     * a single-target fight this is simply a damage bonus -- stated, because
     * the reading is an assumption about the player rather than about the
     * engine.
     */
    { kind: 'conditionalDamage', requires: {} },
    {
      kind: 'unmodelled',
      reason:
        'Applied as a flat damage bonus, which ASSUMES the Hunter is tracking ' +
        'the creature type it is fighting. True for any real pull and not ' +
        'something the engine checks.',
    },
  ],

  deflection: [{ kind: 'stat', stat: 'parryChance', operation: 'flat' }],

  /*
   * "When your traps are triggered, all affected targets are Entrapped,
   * PREVENTING THEM FROM MOVING for 5 sec."
   *
   * A ROOT, so it is crowd control and permanently out of scope -- which is a
   * stronger statement than the "no profile places a trap" it used to carry.
   * That reason expired the moment Immolation Trap was declared; this one
   * cannot, because the whole effect is the root.
   */
  entrapment: [
    {
      kind: 'unmodelled',
      scope: 'crowdControl',
      reason: 'A root, which is out of scope as every root is.',
    },
  ],

  savage_strikes: [
    /*
     * "Increases the critical strike chance of all your MELEE ABILITIES."
     *
     * `melee-special` ONLY. Abilities, so the melee swing underneath them is
     * not included -- that is `melee-auto` and the tooltip does not name it.
     * The Hunter's three melee abilities all declare this table, so the
     * selection is the class's own list without anyone writing one out.
     */
    { kind: 'attackTableCrit', tables: ['melee-special'] },
  ],

  survivalist: [{ kind: 'stat', stat: 'stamina', operation: 'percentAdd', scale: 0.01 }],

  improved_wing_clip: [{ kind: 'unmodelled', scope: 'crowdControl', reason: NO_MOVEMENT }],

  clever_traps: [
    /*
     * "Increases the duration of Freezing and Frost trap effects by 30% AND THE
     * DAMAGE of Immolation and Explosive trap effects by 30%."
     *
     * THE DAMAGE HALF BECAME EXPRESSIBLE WHEN A TRAP DID, and it is WHOLE now
     * that both are declared. `abilityDamage` reaches each trap through its aura
     * id the way Improved Rend reaches a bleed. **This entry was half-paid for
     * exactly as long as Explosive Trap was undeclared**, which is what a
     * partially expressible talent looks like when it is honest about it.
     *
     * TWO ENTRIES AND NOT ONE, because `abilityDamage` is keyed by a single
     * ability id -- and Explosive Trap's INITIAL hit and its burn share the id
     * `explosive_trap`, so one entry reaches both halves of it.
     *
     * `valueIndex: 1` because the row is [duration, damage] and the first
     * number belongs to the Freezing and Frost clause. Both are 30 at every
     * rank, which is exactly the coincidence that hides an index mistake, so it
     * is written out rather than left to default.
     */
    { kind: 'abilityDamage', abilityId: 'immolation_trap', valueIndex: 1 },
    { kind: 'abilityDamage', abilityId: 'explosive_trap', valueIndex: 1 },
    {
      kind: 'unmodelled',
      scope: 'crowdControl',
      reason:
        'Both of its trap DAMAGE clauses apply, Immolation and Explosive. Its ' +
        'Freezing and Frost trap durations are crowd control.',
    },
  ],

  surefooted: [
    { kind: 'stat', stat: 'hitChance', operation: 'flat' },
    { kind: 'unmodelled', scope: 'crowdControl', reason: `The hit applies. ${NO_MOVEMENT}` },
  ],

  deterrence: [
    { kind: 'unmodelled', reason: 'Dodge and parry, and no Hunter profile is attacked.' },
  ],

  /*
   * "Increases your chance to HIT with your Trap and Feign Death abilities."
   *
   * NOTHING FOR IT TO ACT ON, AND THE REASON CHANGED RATHER THAN EXPIRING.
   * Immolation Trap exists now, and on the owner's ruling it triggers instantly
   * when cast -- so it rolls no attack table and cannot miss. Feign Death is
   * not a damage ability and is not declared. A hit chance needs something that
   * can miss.
   */
  survival_tactics: [
    {
      kind: 'unmodelled',
      reason:
        'Hit chance for a trap that cannot miss. Immolation Trap triggers on ' +
        'cast by the owner\u2019s ruling and rolls no attack table, and Feign ' +
        'Death is not a damage ability.',
    },
  ],

  predator_s_edge: [
    /*
     * "Increases your MELEE critical strike damage by {0}% and your offhand
     * weapon damage by {1}%."
     *
     * BOTH MELEE TABLES. Unlike Savage Strikes this does not say "abilities",
     * so the swing is included -- and for a two-hander build the swing is
     * most of the damage, which makes the distinction worth reading twice.
     *
     * It was `critDamageBonus`, whole-character, which reached the Hunter's
     * RANGED abilities as well. That was generous rather than exact, and the
     * note saying so is what expired here.
     */
    { kind: 'attackTableCritDamage', tables: ['melee-auto', 'melee-special'] },
    /*
     * "...and your offhand weapon damage by {1}%", WHICH IS LIVE NOW AND WAS
     * THE TALENT'S LARGER HALF ALL ALONG.
     *
     * Its `unmodelled` reason read "there is no off hand for the second number
     * to raise", and that was a claim about the PROFILE rather than about the
     * engine -- the kind that expires without anybody touching it. The owner
     * made the Lone Wolf melee build a dual-wielder and it expired.
     *
     * `offHandDamage` MULTIPLIES THE PENALTY RATHER THAN REPLACING IT.
     * `createPlayer` composes `0.5 x (1 + value / 100)`, so 50% at rank 5 is
     * 0.5 x 1.5 = 0.75 -- a TWENTY-FIVE percent penalty, which is the figure
     * the owner stated when asking for this. Reading it as "the penalty becomes
     * 25%" and writing 0.75 somewhere would produce the same number today and
     * the wrong one at every other rank.
     *
     * `valueIndex: 1` because the row is [crit damage, off-hand damage] and the
     * two differ at every rank -- 6/10 through 30/50 -- so an index mistake
     * here is visible rather than hidden the way Clever Traps' matching pair
     * would hide one.
     */
    { kind: 'offHandDamage', valueIndex: 1 },
  ],

  counterattack: [
    {
      kind: 'unmodelled',
      reason: 'Becomes active after a PARRY, and no Hunter profile is attacked.',
    },
  ],

  /*
   * "Reduces the mana cost of your Trap abilities and MELEE abilities by {0}%.
   * In addition, your critical strikes have a {1}% chance to allow 50% of your
   * Mana regeneration to continue while casting for 30 sec."
   *
   * --------------------------------------------------------------------------
   * BOTH CLAUSES WORK NOW AND NEITHER NEEDED NEW MACHINERY. Its old reason read
   * "Percentage mana costs, and Traps, and no profile places one", and both
   * halves of that had expired:
   *
   *   A PERCENTAGE MANA COST IS `grantCastModifier`, which retired this exact
   *   sentence for eleven talents across seven classes. Efficiency, two entries
   *   up, already uses it on almost the same ability list. The reason survived
   *   because it was worded around TRAPS as well, so the wording test in
   *   `grantCastModifier.test.ts` -- which matches the sentence rather than an
   *   id -- did not catch it.
   *
   *   AND A TRAP EXISTS. Immolation Trap is declared, so "your Trap abilities"
   *   has one member and it belongs in the list.
   *
   * THE MELEE LIST IS THE ABILITIES THAT COST MANA. Strider Kick is omitted for
   * the same reason Efficiency omits it: it is declared with no cost at all, so
   * a fraction of nothing is nothing.
   * --------------------------------------------------------------------------
   */
  resourcefulness: [
    {
      kind: 'grantCastModifier',
      abilityIds: ['raptor_strike', 'mongoose_bite', 'immolation_trap'],
      property: 'costFraction',
    },
    /*
     * The second clause, as a proc. `valueIndex: 1` is the CHANCE; the 50% and
     * the 30 seconds are constants beside the aura, because neither moves with
     * rank -- see `RESOURCEFULNESS_REGEN`.
     */
    { kind: 'reaction', reactionId: 'resourcefulness', valueIndex: 1 },
  ],

  expose_prey: [{ kind: 'reaction', reactionId: 'expose_prey' }],

  /*
   * "Reduces the cooldown of your Trap and Deterrence abilities by 40%."
   *
   * A PERCENTAGE COOLDOWN REDUCTION, WHICH IS A REAL AND NAMED ENGINE GAP.
   * `abilityCooldown` subtracts a FLAT amount in seconds or minutes, because
   * every talent that has wanted one so far states one; there is no fractional
   * form, and 40% of Immolation Trap's 30 seconds cannot be written without
   * one. It is the same shape `grantCastModifier` was built for on the COST
   * side, and it is the only talent in the project asking for it -- which is
   * why the reason names the declaration rather than the concept.
   *
   * NO HUNTER PROFILE TAKES IT, so building the capability would move nothing.
   */
  survivalist_s_discipline: [
    {
      kind: 'unmodelled',
      reason:
        'A PERCENTAGE cooldown reduction, and `abilityCooldown` subtracts a ' +
        'flat amount in seconds or minutes with no fractional form. Its ' +
        'Deterrence half is a survival cooldown nothing here needs.',
    },
  ],

  strider_kick: [{ kind: 'grantAbility', abilityId: 'strider_kick' }],

  lightning_reflexes: [{ kind: 'stat', stat: 'agility', operation: 'percentAdd', scale: 0.01 }],

  /*
   * "Your Mongoose Bite also causes the target to Bleed for damage over 21 sec
   * equal to 40% of the damage done by Mongoose Bite."
   *
   * ITS REASON ARGUED ITSELF OUT OF BEING BUILT AND THE ARGUMENT WAS WRONG. It
   * said the bleed was expressible but that "Mongoose Bite fires only through
   * Expose Prey here, so it would be a fraction of a fraction -- written down
   * rather than built". Mongoose Bite is 9.2% of the Lone Wolf melee profile,
   * which is the build that takes this talent, so the fraction was never small
   * and the conclusion was reasoned rather than measured.
   *
   * THE VALUE IS HAND-FILLED. A single-rank talent has no `{0}` for the importer
   * to match, so `values` came back null -- and an effect that reads no value is
   * DROPPED IN SILENCE, which would have read as an unmodelled talent that never
   * said so. The 40 is written into `src/data/talents/values/hunter.json` with a
   * note, per that directory's README, exactly as Nature's Grace's 10 and
   * Shadowform's 100 are.
   */
  lacerating_strikes: [{ kind: 'reaction', reactionId: 'lacerating_strikes' }],
};
