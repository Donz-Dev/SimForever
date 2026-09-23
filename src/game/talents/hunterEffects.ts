import type { TalentEffects } from './TalentEffect';

/**
 * What each Hunter talent does, as data.
 *
 * Every one of the 50 has an entry, and one that cannot be expressed says so.
 *
 * ----------------------------------------------------------------------------
 * THE FIFTH STAT-FROM-STAT TALENT IS HERE, AND IT IS THE BIGGEST YET. Careful
 * Aim reads "Increases your Attack Power by 100% of your Intellect", all three
 * profiles take it at 5/5, and nothing declares a stat derived from another
 * stat. The others are the Shaman's Mental Dexterity and Mental Quickness, the
 * Mage's Arcane Resilience and the Paladin's Champion of the Light -- five
 * talents across four classes now, which is enough to be a shape rather than
 * a coincidence.
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

/** Said once; the Careful Aim family. */
const STAT_FROM_STAT =
  'A stat derived from a PERCENTAGE OF ANOTHER STAT, which has no declaration: ' +
  '`stat` adds a flat amount or a percentage of the same stat, and nothing ' +
  'crosses from one to another. The fifth talent in the project with this ' +
  'shape and the largest -- all three Hunter profiles take it at full rank.';

export const HUNTER_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Beast Mastery -------------------------------------------------------

  deadly_aspects: [{ kind: 'reaction', reactionId: 'deadly_aspects' }],

  endurance_training: [
    { kind: 'petStat', property: 'health' },
    { kind: 'petStat', property: 'armor' },
  ],

  focused_fire: [
    /*
     * "Increases all damage you and your pet deal by {0}% while your pet is
     * active." The owner's half is expressible; the pet's is not, because a
     * talent effect reaches the character it is on and the pet is a separate
     * combatant built afterwards.
     */
    { kind: 'conditionalDamage', requires: {} },
    /*
     * "Increases all damage YOU AND YOUR PET deal." Both halves now, which is
     * what `petStat` was added for -- the pet half was inert and said so.
     */
    { kind: 'petStat', property: 'damage' },
    {
      kind: 'unmodelled',
      reason:
        'Its "WHILE YOUR PET IS ACTIVE" condition is not checked on the ' +
        'HUNTER’S half: `conditionalDamage` selects on weapons and has no ' +
        'clause for having a pet. So both Lone Wolf builds -- which take this ' +
        'as a cheap route to Careful Aim and then take the talent for having ' +
        'no pet -- get 2% they should not. The PET half is correctly nothing ' +
        'for them, because no pet is built at all.',
    },
  ],

  improved_aspect_of_the_monkey: [
    { kind: 'unmodelled', reason: 'Dodge from an Aspect no damage profile uses.' },
  ],

  pathfinding: [{ kind: 'unmodelled', reason: NO_MOVEMENT }],

  improved_revive_pet: [
    { kind: 'unmodelled', reason: 'Reviving a pet, and no pet dies in these fights.' },
  ],

  bestial_swiftness: [{ kind: 'unmodelled', reason: NO_MOVEMENT }],

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

  improved_mend_pet: [{ kind: 'unmodelled', reason: 'Healing a pet, and nothing damages it here.' }],

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

  intimidation: [{ kind: 'unmodelled', reason: 'A stun, which is out of scope as every stun is.' }],

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

  hawk_eye: [{ kind: 'unmodelled', reason: 'Range, and nothing here has a position.' }],

  improved_concussive_shot: [
    { kind: 'unmodelled', reason: 'A stun on a shot no damage list casts.' },
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
    {
      kind: 'unmodelled',
      reason:
        'Reduces mana costs by a PERCENTAGE. `abilityCost` subtracts a flat ' +
        'amount, which is wrong for a 310-mana Aimed Shot -- and this remains ' +
        'the most common unmodelled reason in the project.',
    },
  ],

  careful_aim: [{ kind: 'unmodelled', reason: STAT_FROM_STAT }],

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
     * "Increases the critical strike damage bonus on all RANGED abilities."
     * `critDamageBonus` is whole-character with no school and no table, so it
     * also raises a Lone Wolf melee build's crits -- which is why that build
     * takes it and this note exists.
     */
    { kind: 'critDamageBonus' },
    {
      kind: 'unmodelled',
      reason:
        'It applies to every ability rather than only to ranged ones: ' +
        '`critDamageBonus` has no table. Exact for the two ranged builds, ' +
        'generous to the Lone Wolf melee one.',
    },
  ],

  rapid_recuperation: [
    { kind: 'stat', stat: 'manaRegenBypass', operation: 'flat' },
  ],

  barrage: [
    { kind: 'abilityDamage', abilityId: 'multi_shot' },
    { kind: 'abilityDamage', abilityId: 'aimed_shot' },
  ],

  scatter_shot: [
    { kind: 'unmodelled', reason: 'A disorient that also turns off auto-attack.' },
  ],

  ranged_weapon_specialization: [
    {
      kind: 'unmodelled',
      reason:
        'Raises damage with RANGED weapons. `conditionalDamage` selects on the ' +
        'MAIN HAND -- two-handed or not, and a weapon type -- and has no clause ' +
        'for the ranged slot, so there is nothing to express it with.',
    },
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
    {
      kind: 'unmodelled',
      reason:
        'Crit for MELEE ABILITIES as a group. `abilityCrit` names one ability ' +
        'and `critChance` is every attack including ranged, so neither selects ' +
        'the melee half of a hybrid class.',
    },
  ],

  survivalist: [{ kind: 'stat', stat: 'stamina', operation: 'percentAdd', scale: 0.01 }],

  improved_wing_clip: [{ kind: 'unmodelled', reason: NO_MOVEMENT }],

  clever_traps: [{ kind: 'unmodelled', reason: NO_TRAPS }],

  surefooted: [
    { kind: 'stat', stat: 'hitChance', operation: 'flat' },
    { kind: 'unmodelled', reason: `The hit applies. ${NO_MOVEMENT}` },
  ],

  deterrence: [
    { kind: 'unmodelled', reason: 'Dodge and parry, and no Hunter profile is attacked.' },
  ],

  survival_tactics: [{ kind: 'unmodelled', reason: NO_TRAPS }],

  predator_s_edge: [
    { kind: 'critDamageBonus' },
    {
      kind: 'unmodelled',
      reason:
        'Its melee crit damage applies, through a whole-character bonus with ' +
        'no table. Its off-hand clause does not: a Hunter here holds one melee ' +
        'weapon.',
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
