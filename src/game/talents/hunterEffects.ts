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
 *   TRAPS            six. Nothing here places a trap.
 *   MOVEMENT AND     seven. Roots, slows, disorients and speed, none of which
 *   CONTROL          a standing raid boss cares about.
 * ----------------------------------------------------------------------------
 */

/** Said once; five talents say it. */
const NO_TRAPS = 'Traps, and no profile places one.';

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
    {
      kind: 'unmodelled',
      reason:
        'Its pet focus regeneration applies. Its "mana regeneration continues ' +
        'while casting" half does not matter: a Hunter has no cast long enough ' +
        'for it to reach.',
    },
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
    {
      kind: 'unmodelled',
      reason:
        'Its Rapid Fire cooldown reduction is real and its damage bonus needs ' +
        'a KILL, which never happens -- the target survives every fight.',
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

  entrapment: [{ kind: 'unmodelled', reason: NO_TRAPS }],

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

  clever_traps: [{ kind: 'unmodelled', reason: NO_TRAPS }],

  surefooted: [
    { kind: 'stat', stat: 'hitChance', operation: 'flat' },
    { kind: 'unmodelled', scope: 'crowdControl', reason: `The hit applies. ${NO_MOVEMENT}` },
  ],

  deterrence: [
    { kind: 'unmodelled', reason: 'Dodge and parry, and no Hunter profile is attacked.' },
  ],

  survival_tactics: [{ kind: 'unmodelled', reason: NO_TRAPS }],

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
    {
      kind: 'unmodelled',
      reason:
        'Its melee crit damage applies. Its OFF-HAND clause does not: every ' +
        'Hunter profile here holds one melee weapon, so there is no off hand ' +
        'for the second number to raise.',
    },
  ],

  counterattack: [
    {
      kind: 'unmodelled',
      reason: 'Becomes active after a PARRY, and no Hunter profile is attacked.',
    },
  ],

  resourcefulness: [{ kind: 'unmodelled', reason: `Percentage mana costs, and ${NO_TRAPS}` }],

  expose_prey: [{ kind: 'reaction', reactionId: 'expose_prey' }],

  survivalist_s_discipline: [{ kind: 'unmodelled', reason: NO_TRAPS }],

  strider_kick: [{ kind: 'grantAbility', abilityId: 'strider_kick' }],

  lightning_reflexes: [{ kind: 'stat', stat: 'agility', operation: 'percentAdd', scale: 0.01 }],

  lacerating_strikes: [
    {
      kind: 'unmodelled',
      reason:
        'A bleed worth a share of the damage Mongoose Bite dealt. The bleed ' +
        'itself is expressible; what is missing is that Mongoose Bite fires ' +
        'only through Expose Prey here, so it would be a fraction of a ' +
        'fraction -- written down rather than built.',
    },
  ],
};
