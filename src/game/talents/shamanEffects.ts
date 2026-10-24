import type { TalentEffects } from './TalentEffect';
import { FLAME_SHOCK_EXTRA_DURATION_BONUS, MAGMA_TOTEM_EXTRA_DURATION_BONUS } from '../abilities/shaman';

/**
 * What each Shaman talent does, as data.
 *
 * Every one of the 50 has an entry, and one that cannot be expressed says so
 * rather than being left out — see CLAUDE.md, which carries that rule because
 * the Rogue shipped with its whole tree inert and nothing said so.
 *
 * ----------------------------------------------------------------------------
 * WHAT CLUSTERS HERE, and what it tells the next class:
 *
 *   PERCENTAGE MANA    WAS the biggest cluster here and is now gone.
 *   COSTS              Convection and Shamanistic Focus are live through
 *                      `grantCastModifier`, which is worth 10% off everything
 *                      an Elemental shaman casts and 45% off its Shocks --
 *                      about a third of the profile's damage.
 *   TOTEMS             six, and two of them are now PARTLY live. A totem is a
 *                      separate attacking or buffing entity and the engine has
 *                      none -- but Searing Totem is modelled as a
 *                      damage-over-time effect by the ruleset owner's ruling
 *                      and counts as a totem for talents, so Call of Flame's
 *                      fire-totem clause and Elemental Fury's Searing clause
 *                      both reach it. Magma Totem and Fire Nova do not; Fire
 *                      Nova needs an active fire totem to go off at all.
 *   HEALING            fourteen, the whole Restoration tree bar three.
 *                      Neither profile heals.
 *   ONE-SHOT CAST      Maelstrom Weapon. The third class to want it, after
 *   MODIFIERS          the Druid's Eclipse and Nature's Swiftness.
 *
 * THE VALUES FILE IS REGISTERED IN THIS SAME COMMIT, which is the rule the
 * Rogue's silent tree produced. Without it every entry below resolves to no
 * number and the tree is invisibly dead.
 * ----------------------------------------------------------------------------
 */

/**
 * Said once; FOUR talents say it, and it is a RULING now rather than a gap.
 *
 * ----------------------------------------------------------------------------
 * IT USED TO COVER SIX, AND TWO OF THE SIX WERE NEVER BLOCKED BY IT.
 *
 *   Improved Fire Nova   needed Fire Nova declared, which needed a spell power
 *                        coefficient -- one question to the owner. The active
 *                        fire totem it asks for has been Searing Totem all
 *                        along.
 *   Totemic Focus        is a percentage mana cost reduction on a totem SPELL.
 *                        It needs a totem in the spellbook, not a totem in the
 *                        world, and `grantCastModifier` expresses it.
 *
 * Both now do something, and the shared sentence was what hid them: one reason
 * written across six talents outlived its truth on two of them. The Mage's file
 * carries the same lesson about a five-talent cluster, in almost the same words.
 *
 * SEARING TOTEM IS THE EXCEPTION the sentence never covered: the owner ruled it
 * a damage-over-time effect that counts as a totem, so the talents naming it
 * reach it. What is left is a totem that BUFFS or HEALS, which has nothing to
 * attach to -- and that is the owner's `totemEntities` ruling, given 2026-09-30.
 * ----------------------------------------------------------------------------
 */
const TOTEMS_NOT_MODELLED =
  'A totem that buffs or heals is a separate entity acting on its own, which is ' +
  'out of scope by the ruleset owner\'s ruling. The damage reading that reaches ' +
  'Searing Totem does not reach it: there is nothing to attach a group mana ' +
  'return or a damage reduction to.';

/*
 * ----------------------------------------------------------------------------
 * MAGMA TOTEM IS DECLARED SINCE ROUND 57, with the owner's 2.55% a pulse, and
 * three talents' Magma Totem clauses reach it: Call of Flame's damage, Elemental
 * Fury's crit damage (a school effect, so its Fire pulses needed nothing) and
 * Trial by Fire's twenty extra seconds. Each carried an `unmodelled` reason that
 * named the missing coefficient -- which was the right reason, and expired.
 * ----------------------------------------------------------------------------
 */

/** Said once; fourteen talents say it. */
const NO_PROFILE_HEALS = 'Healing, and neither Shaman profile heals.';

export const SHAMAN_TALENT_EFFECTS: Readonly<Record<string, TalentEffects>> = {
  // --- Elemental -----------------------------------------------------------

  convection: [
    {
      kind: 'grantCastModifier',
      abilityIds: [
        'earth_shock',
        'flame_shock',
        'frost_shock',
        'lightning_bolt',
        'chain_lightning',
        'lava_burst',
      ],
      property: 'costFraction',
    },
  ],

  concussion: [
    { kind: 'abilityDamage', abilityId: 'lightning_bolt' },
    { kind: 'abilityDamage', abilityId: 'chain_lightning' },
    { kind: 'abilityDamage', abilityId: 'earth_shock' },
  ],

  elemental_warding: [
    {
      kind: 'unmodelled',
      reason:
        'Reduces Fire, Frost and Nature damage TAKEN. Neither profile faces a ' +
        'target that deals any, and `damageTakenBySchool` is on an aura rather ' +
        'than a talent effect.',
    },
  ],

  reverberation: [
    { kind: 'abilityCooldown', abilityId: 'earth_shock', unit: 'seconds' },
    { kind: 'abilityCooldown', abilityId: 'flame_shock', unit: 'seconds' },
    { kind: 'abilityCooldown', abilityId: 'frost_shock', unit: 'seconds' },
  ],

  call_of_flame: [
    { kind: 'abilityDamage', abilityId: 'flame_shock' },
    // The aura id is the DoT's, which is how a periodic tick is reached: a
    // tick carries the aura's id rather than the cast's.
    { kind: 'abilityDamage', abilityId: 'lava_burst' },
    /*
     * ITS FIRE TOTEM CLAUSE NOW REACHES SOMETHING. Searing Totem is modelled
     * as a damage-over-time effect by the owner's ruling, and "considered a
     * totem for the purposes of other talents" is part of that ruling -- so
     * this is the talent it was written for. Keyed on the AURA's id, because a
     * tick carries the aura's id and not the cast's.
     */
    { kind: 'abilityDamage', abilityId: 'searing_totem' },
    /*
     * AND ITS FIRE NOVA CLAUSE REACHES SOMETHING TOO, now that Fire Nova is a
     * declared ability. The talent names four things -- Fire Totems, Flame
     * Shock, Fire Nova and Lava Burst -- and three of the four are live; only
     * Magma Totem is left.
     */
    { kind: 'abilityDamage', abilityId: 'fire_nova' },
    /*
     * ==========================================================================
     * AND ITS DURATION CLAUSE, WHICH REACHED NOTHING AND SAID NOTHING.
     *
     * "as well as increases the duration of your Flame Shock spell by {1} sec"
     * -- NINE seconds at 3/3, which both Shaman profiles take. It was absent
     * entirely, and the `unmodelled` entry below named only the Magma Totem
     * half: **a reason that describes the clauses that DO work is a claim about
     * the code, and this one was silent about a clause worth 75% of a DoT.**
     *
     * EXTRA TICKS OF THE SAME SIZE. 12 seconds is four ticks of 44 and 21 is
     * seven, so this is a bigger burn rather than the same burn stretched -- see
     * `flameShockDot` and `FLAME_SHOCK_BASE_TICKS`, which is named precisely so
     * the per-tick figure cannot be divided by the extended count.
     *
     * `valueIndex: 1`, which is the seconds. Index 0 is the 15% damage the four
     * `abilityDamage` entries above already read, and reading it here would add
     * FIFTEEN seconds to the burn instead of nine -- a plausible number, in the
     * generous direction, on a row this project has already been caught by four
     * times.
     * ==========================================================================
     */
    {
      kind: 'abilityBonus',
      abilityId: 'flame_shock',
      key: FLAME_SHOCK_EXTRA_DURATION_BONUS,
      valueIndex: 1,
    },
    // And Magma Totem, the other Fire Totem, since round 57 -- keyed on the
    // aura's id for the same reason Searing Totem is.
    { kind: 'abilityDamage', abilityId: 'magma_totem' },
  ],

  elemental_devastation: [{ kind: 'reaction', reactionId: 'elemental_devastation' }],

  /*
   * ELEMENTAL FOCUS. Its reason claimed "a one-shot, charge-consuming cost
   * modifier, which has no declaration" -- and `CastModifier.costFraction` with
   * `consumedByCast` is exactly that, was built for Maelstrom Weapon IN THIS
   * SAME CLASS, and has been carrying the Mage's identically-worded Clearcasting
   * for as long as the Mage has existed. The reason was a claim about the engine
   * on the day it was written and it had expired twice over.
   *
   * A CAST REACTION AND NOT A DAMAGE ONE, which is the one thing about it that
   * is not a copy of the Mage's: "after CASTING any Fire, Frost, or Nature
   * damage spell" against the Mage's "after any damage spell HITS a target".
   * See `elementalFocus` in `reactions/shamanTalents.ts`.
   */
  elemental_focus: [{ kind: 'castReaction', reactionId: 'elemental_focus' }],

  elemental_fury: [
    /*
     * "Increases the critical strike damage bonus of your Searing and Magma
     * Totems and your Fire, Frost, and Nature spells by {0}%."
     *
     * CORRECTED. This shipped as a whole-character `critDamageBonus` with a
     * written caveat saying it wrongly raised an Enhancement shaman's
     * PHYSICAL crits too -- Stormstrike and every swing. `schoolCritDamage`
     * is the declaration it wanted, and the caveat is gone rather than
     * being restated.
     *
     * That is a real reduction for Enhancement, which takes five points in it
     * and lands most of its damage with a two-hander.
     */
    { kind: 'schoolCritDamage', schools: ['fire', 'frost', 'nature'] },
    /*
     * ITS SEARING TOTEM CLAUSE NEEDED NO CODE AND STILL NEEDED THIS REASON
     * NARROWED. The totem's ticks are FIRE and this is a school effect, so the
     * moment Searing Totem existed the talent reached it -- which is exactly
     * the case an expired `unmodelled` reason hides, because nothing fails and
     * the caveat keeps printing.
     */
    // Magma Totem's pulses are Fire, so the school effect reaches them as it
    // does Searing Totem's -- nothing to declare (round 57).
  ],

  /*
   * IMPROVED FIRE NOVA, AND ITS OLD REASON NAMED THE WRONG BLOCKER.
   *
   * It read "Fire Nova requires an active fire totem to go off at all, so it is
   * not an ability here" and then cited the totems-are-not-entities sentence --
   * an engine change shared with the Warlock's Infernal and the Mage's
   * elemental. But Searing Totem has been a modelled fire totem since the owner
   * ruled it a damage-over-time effect "considered a totem for the purposes of
   * other talents", and the Enhancement list holds it up all fight. The active
   * fire totem was already there.
   *
   * What actually blocked it was Fire Nova's spell power coefficient, which
   * `WoWSimWorksheet.xlsx` has no row for because Forever ADDED the spell. One
   * question to the owner settled it. CLAUDE.md's rule -- check whether a
   * missing number is missing DATA or a missing RULE before recording it as a
   * gap -- is this case exactly, and naming the expensive blocker instead of the
   * cheap one parked the talent behind work it never needed.
   *
   * BOTH HALVES APPLY: +20% damage at index 0 and -4 seconds of cooldown at
   * index 1. Reading index 0 for the cooldown would take 20 SECONDS off a
   * 10-second cooldown and make Fire Nova free to cast.
   */
  /*
   * ==========================================================================
   * TRIAL BY FIRE REPLACES IMPROVED FIRE NOVA, and it is the same two clauses
   * with a third that reaches nothing.
   *
   * "Increases the damage done by your Fire Nova spell by {0}% and reduces its
   * cooldown by {1} sec, and increases the duration of your Magma Totem by
   * {2} sec."
   *
   * SO THE FIRST TWO ARE LIFTED STRAIGHT OFF THE TALENT IT REPLACED -- same
   * ability, same kinds, same indices -- and only the figures and the rider are
   * new. Said out loud because a new talent that is an old one renamed with an
   * extra clause is exactly what a reader re-derives from scratch.
   * ==========================================================================
   */
  trial_by_fire: [
    { kind: 'abilityDamage', abilityId: 'fire_nova' },
    { kind: 'abilityCooldown', abilityId: 'fire_nova', unit: 'seconds', valueIndex: 1 },
    // "increases the duration of your Magma Totem by {2} sec" (round 57).
    {
      kind: 'abilityBonus',
      abilityId: 'magma_totem',
      key: MAGMA_TOTEM_EXTRA_DURATION_BONUS,
      valueIndex: 2,
    },
  ],

  /*
   * EYE OF THE STORM IS THE ELEMENTAL BUILD'S ONE REMAINING LIVE GAP, and the
   * reason is narrowed rather than repeated: it needs TWO things and the
   * project has neither.
   *
   *   pushback          the engine has no notion of a cast being delayed by
   *                     damage. `castTimeMs` is resolved once, before `onCast`
   *                     runs, and nothing can lengthen it afterwards.
   *   incoming damage   both Shaman profiles set `targetAttacks: false`, so
   *                     even with pushback modelled there would be nothing to
   *                     suffer it from.
   *
   * BLOCKED TWICE IS WHY IT IS A RULING. Clearing either half alone leaves it
   * inert, so it is not the kind of reason that expires -- and the owner ruled
   * cast pushback out of scope on 2026-09-30 when asked with exactly that
   * argument. It was the last live gap either Shaman profile spent a point on.
   */
  eye_of_the_storm: [
    {
      kind: 'unmodelled',
      scope: 'castPushback',
      reason:
        'Pushback on a cast from damage taken, which is out of scope. The ' +
        'engine resolves a cast time once, before `onCast`, and nothing can ' +
        'lengthen it afterwards; and neither Shaman profile is attacked, so ' +
        'there is nothing to suffer pushback from either.',
    },
  ],

  /*
   * ==========================================================================
   * ELEMENTAL MASTERY REPLACES CALL OF THUNDER, AND IT IS THE NEW ELEMENTAL
   * CAPSTONE -- the structural half of this patch for the Shaman. Lava Burst
   * dropped from row 6 to row 4 and lost its Lightning Overload prerequisite,
   * so the 31-point talent an Elemental build is shaped around is now a
   * different ability entirely.
   *
   * "Gain mastery over Fire and Lightning, reducing the cast time of Lightning
   * Bolt and Lava Burst by 0.5 sec, and removing the cooldown from Chain
   * Lightning. Lasts 15 sec." Three minute cooldown.
   *
   * ALL THREE CLAUSES APPLY. The cast time is a `castModifier` on the aura
   * naming both abilities, with NO `consumedByCast`: it is a duration effect,
   * so every cast inside the fifteen seconds is shortened rather than only the
   * next one -- the distinction Arcane Power already rests on.
   *
   * THE COOLDOWN REMOVAL IS `suppressesCooldownOf` (round 57). This said
   * nothing could suspend a cooldown for the life of an aura, which stopped
   * being true when Berserk built that field for Primal Bite -- an expired
   * reason, found when multiple targets made Chain Lightning worth casting.
   * ==========================================================================
   */
  // All three clauses are on the aura, Chain Lightning's cooldown since round 57.
  elemental_mastery: [{ kind: 'grantAbility', abilityId: 'elemental_mastery' }],

  elemental_reach: [{ kind: 'unmodelled', scope: 'positioning', reason: 'Range, and nothing here has a position.' }],

  /*
   * LIGHTNING OVERLOAD. Its reason said "a cast reaction COULD roll it, but
   * nothing lets a reaction re-cast an ability at a fraction of its damage" --
   * which read as an engine gap and was really a missing content decision. A
   * reaction does not need to re-CAST anything: it deals the damage itself,
   * with the source spell's ability id so every per-ability modifier reaches it
   * and its own name so the breakdown can show it.
   *
   * THE ELEMENTAL BUILD LANDS 60% OF ITS DAMAGE WITH LIGHTNING BOLT, so this is
   * the largest single thing in this file for that profile.
   */
  lightning_overload: [{ kind: 'castReaction', reactionId: 'lightning_overload' }],

  earthbound: [{ kind: 'unmodelled', scope: 'crowdControl', reason: 'Earthbind Totem, and an immobilise.' }],

  elemental_alacrity: [
    { kind: 'abilityCastTime', abilityId: 'lightning_bolt' },
    { kind: 'abilityCastTime', abilityId: 'chain_lightning' },
    { kind: 'abilityCastTime', abilityId: 'lava_burst' },
  ],

  lava_burst: [{ kind: 'grantAbility', abilityId: 'lava_burst' }],

  // --- Enhancement ---------------------------------------------------------

  earth_s_grasp: [{ kind: 'unmodelled', scope: 'totemEntities', reason: TOTEMS_NOT_MODELLED }],

  thundering_strikes: [
    // "all spells and attacks", so both tables.
    { kind: 'stat', stat: 'critChance', operation: 'flat' },
    { kind: 'stat', stat: 'spellCritChance', operation: 'flat' },
  ],

  ancestral_knowledge: [
    { kind: 'stat', stat: 'intellect', operation: 'percentAdd', scale: 0.01 },
  ],

  guardian_totems: [{ kind: 'unmodelled', scope: 'totemEntities', reason: TOTEMS_NOT_MODELLED }],

  mental_dexterity: [
    /*
     * "Increases your Attack Power by an amount equal to {0}% of your
     * Intellect", 100% at 3/3. ON TOP OF the attack power the class table
     * already makes from strength and agility, which is what
     * `withStatConversions` adds rather than replaces.
     */
    { kind: 'statFromStat', from: 'intellect', to: 'attackPower' },
  ],

  improved_ghost_wolf: [
    {
      kind: 'unmodelled',
      scope: 'positioning',
      reason: 'A travel form, and nothing here moves.',
    },
  ],

  improved_lightning_shield: [
    {
      kind: 'unmodelled',
      reason:
        'Lightning Shield fires when the CARRIER is hit, and neither Shaman ' +
        'profile faces a target that swings back.',
    },
  ],

  elemental_weapons: [
    /*
     * Its Windfury clause is live and is read by `reactionsForClass`, which
     * builds the Windfury Weapon proc with this talent's SECOND number. It is
     * not declared as a `reaction` here on purpose: that would make the proc
     * exist only for a Shaman who took the talent, and the imbue is a spell
     * anyone can cast.
     */
    /*
     * THE CENSUS CALLS THIS A LIVE GAP AND IT IS NOT ONE, and the fix is
     * deliberately NOT made here.
     *
     * The reason below has said "APPLIES" in capitals since the talent was
     * written, and the census cannot hear it: it counts non-unmodelled EFFECT
     * ROWS, this talent has none, and its working half lives in
     * `reactionsForClass`, which reads the rank off the allocation and builds the
     * Windfury proc with it. So one working talent is filed as remaining work.
     *
     * `appliedElsewhere` IS THE FIELD FOR EXACTLY THIS and it is not on `main`
     * yet -- it arrives with the Rogue's two poison talents, which fell into the
     * same hole. Adding a second copy of the field here would conflict with that
     * PR over one shared type, so this class waits: the moment the Rogue's branch
     * lands, one line here (`appliedElsewhere: 'game/reactions/reactionsForClass.ts'`)
     * moves the Shaman from 10 live gaps to 9 and from 5 partly to 6, with no
     * behaviour change at all. Recorded in docs/handoff/shaman.md so it is not
     * found again from scratch.
     */
    /*
     * ROCKBITER AND FLAMETONGUE WEAPON ARE MODELLED NOW, with the owner's
     * figures, so two of the three clauses this reason called dead apply: each
     * imbue reads its own bonus off its ability. INDEX 0 is Rockbiter's attack
     * power and INDEX 2 Flametongue's damage -- index 1 is Windfury's, read by
     * `reactionsForClass`.
     */
    {
      kind: 'abilityBonus',
      abilityId: 'rockbiter_weapon',
      key: 'elementalWeaponsPercent',
      valueIndex: 0,
    },
    {
      kind: 'abilityBonus',
      abilityId: 'flametongue_weapon',
      key: 'elementalWeaponsPercent',
      valueIndex: 2,
    },
    {
      kind: 'unmodelled',
      reason:
        'Its Windfury, Rockbiter and Flametongue Weapon clauses APPLY. Its ' +
        'Frostbrand Weapon clause does nothing, because Frostbrand Weapon is not ' +
        'declared.',
    },
  ],

  shamanistic_focus: [
    // The Shocks. Lightning Shield is in its text and not in the book.
    {
      kind: 'grantCastModifier',
      abilityIds: ['earth_shock', 'flame_shock', 'frost_shock'],
      property: 'costFraction',
    },
  ],

  anticipation: [{ kind: 'stat', stat: 'dodgeChance', operation: 'flat' }],

  toughness: [{ kind: 'stat', stat: 'stamina', operation: 'percentAdd', scale: 0.01 }],

  flurry: [{ kind: 'reaction', reactionId: 'flurry' }],

  stormstrike: [{ kind: 'grantAbility', abilityId: 'stormstrike' }],

  /*
   * TWO THREAT CLAUSES, LIVE SINCE ROUND 47: -30% on ATTACKS while Rockbiter
   * Weapon is down, and +30% on ALL threat while it is up. Single rank, so the
   * values file is null and the 30 is stated here from the tooltip.
   */
  spirit_weapons: [
    {
      kind: 'threat',
      direction: 'decrease',
      percent: 30,
      tables: ['melee-auto', 'melee-special', 'ranged-auto', 'ranged-special'],
      whileNotAura: 'rockbiter_weapon',
    },
    { kind: 'threat', direction: 'increase', percent: 30, whileAura: 'rockbiter_weapon' },
    {
      kind: 'unmodelled',
      reason: 'A parry chance the tooltip does not quantify, and a number that is not stated is not invented.',
    },
  ],

  mental_quickness: [
    // The same declaration as Mental Dexterity, into spell power instead.
    { kind: 'statFromStat', from: 'intellect', to: 'spellPower' },
  ],

  /*
   * IMPROVED STORMSTRIKE, AND ITS REASON COVERED TWO CLAUSES WITH ONE SENTENCE.
   *
   * It read "Mana regeneration while casting, and a Stormstrike cooldown reset
   * on a DODGE OR PARRY. Neither profile is attacked, so neither ever dodges" --
   * true of the SECOND clause and silent about the first. `manaRegenBypass` has
   * been a stat since the first caster and five talents across five classes
   * already grant it; this is the first to grant it for a window, which is an
   * aura and nothing new.
   *
   * MANA RETURN IS IN SCOPE by the owner's ruling, explicitly, because it
   * changes a damage profile's sustain -- and Enhancement is the one build here
   * that pays mana for Stormstrike, its shocks and an imbue while swinging a
   * two-hander.
   *
   * SO: a reason that names two clauses and explains one is a reason that hides
   * the other. Worth writing one per clause when the clauses expire differently.
   */
  improved_stormstrike: [
    { kind: 'castReaction', reactionId: 'improved_stormstrike' },
    {
      kind: 'unmodelled',
      reason:
        "Its second clause alone: Stormstrike's cooldown resetting on a DODGE " +
        'OR PARRY. Neither profile is attacked, so neither ever dodges or ' +
        'parries. Its mana regeneration clause is modelled.',
    },
  ],

  maelstrom_weapon: [
    /*
     * LIVE. The value handed to the reaction is the REDUCTION -- 4/8/12/16/20
     * by rank, index 0 -- not the proc chance, which the tooltip does not
     * state at all. The first version of this passed it in as the chance, and
     * a 20% proc rate looked completely ordinary.
     */
    /*
     * AND ITS CAVEAT IS GONE. The proc chance was the last `PLACEHOLDER_` in
     * this class; the owner supplied five procs per minute on 2026-09-30, so
     * every number the talent uses is now either the source's own or the
     * owner's. The per-stack reading is an INTERPRETATION rather than a gap --
     * recorded beside the aura, which is where this project keeps them.
     */
    { kind: 'reaction', reactionId: 'maelstrom_weapon' },
  ],

  rage_of_the_farseer: [{ kind: 'grantAbility', abilityId: 'rage_of_the_farseer' }],

  // --- Restoration ---------------------------------------------------------

  improved_healing_wave: [{ kind: 'unmodelled', scope: 'healing', reason: NO_PROFILE_HEALS }],
  /*
   * TOTEMIC FOCUS WAS NEVER BLOCKED BY THE TOTEM GAP AT ALL. "Reduces the Mana
   * cost of your totems and any spells that summon or move them by 25%" is a
   * percentage cost reduction on a spell the character casts -- exactly
   * `grantCastModifier`, and it needs no totem to exist as an entity, only a
   * totem SPELL to be in the book. Searing Totem is one.
   *
   * IT WAS COUNTED AS ONE OF THE SIX TOTEM GAPS AND IS NOT ONE. Neither Shaman
   * profile spends a point on it -- both are 0 in Restoration -- so this moves
   * no figure; it moves the QUEUE, which was reporting a talent as blocked on an
   * engine change it does not need.
   *
   * The other totem spells are missing from the SPELLBOOK, not from this talent.
   * A talent that fully applies to every totem the character has is not partly
   * modelled, so this carries no `unmodelled` clause.
   */
  totemic_focus: [
    {
      kind: 'grantCastModifier',
      abilityIds: ['searing_totem'],
      property: 'costFraction',
    },
  ],
  /*
   * ==========================================================================
   * MINDFULNESS IS A MANA TALENT AND IT CARRIED THE TALENT NEXT DOOR'S RULING.
   *
   * "Allows {0}% of your Mana regeneration to continue while casting", 17/33/50
   * by rank -- and it was declared as a ruled-out THREAT effect, reason "Threat,
   * which the
   * engine does not track." That sentence is `natural_grace`'s tooltip, which
   * sits in the SAME TIER one talent across: the two had each other's rulings.
   *
   * `manaRegenBypass` IS EXACTLY THIS STAT and `manaPerTick`'s own comment
   * quotes this tooltip almost word for word -- "the stat that reads 'allows X%
   * of your mana regeneration to continue while casting'". SIX OTHER TALENTS IN
   * FIVE CLASSES ALREADY GRANT IT: the Druid's Reflection, the Hunter's two,
   * the Mage's Arcane Meditation, the Paladin's Reverence and the Priest's
   * Meditation -- and this file argues the identical point for Improved
   * Stormstrike thirty lines up. So there was never an engine gap; there was a
   * reason belonging to a different talent.
   *
   * MANA RETURN IS EXPLICITLY IN SCOPE by the owner's ruling, because it
   * changes a damage profile's sustain. CLAUDE.md says so in the scope table's
   * own `healing` row, and the Shadow Priest's spread keeps Meditation 3 on
   * exactly that authority.
   *
   * ------------------------------------------------------------------------------
   * AND THIS IS THE FAILURE A `scope` TAG IS WORST FOR, which is why it went a
   * whole project undetected. A ruled-out effect is deliberately kept out of
   * the live-gap list and shown apart in the Talent panel -- so a tag on a LIVE
   * effect deletes it from the one list that gets re-read. Nature's Reach lost
   * 4% hit the same way, and the census that exists to find unfinished work had
   * nothing to report in either case.
   *
   * IT MOVES NO PUBLISHED FIGURE BY ITSELF: neither Shaman spread spends a
   * point here, Enhancement taking no Restoration points at all. What it moves
   * is whether the Elemental build has a live DESTINATION for a dead point --
   * and that build regenerates ZERO mana in a fight today, its 163.65 MP5
   * suppressed by the five second rule from the pull to the end.
   * ==========================================================================
   */
  /*
   * AND THE PROSE ABOVE SAYS "a ruled-out THREAT effect" RATHER THAN QUOTING THE
   * DECLARATION, ON PURPOSE. CLAUDE.md's scope census is a grep for the literal
   * `scope: '<member>'`, so a comment quoting one is counted as an entry -- the
   * first draft of this note took the `threat` column from 11 to 12 without
   * declaring anything, which is that file's own "count DECLARATIONS, not
   * mentions" rule biting the paragraph that was fixing a scope tag.
   */
  mindfulness: [{ kind: 'stat', stat: 'manaRegenBypass', operation: 'flat' }],
  /*
   * NATURAL GRACE IS THE THREAT HALF OF THAT SWAP. "Reduces the threat
   * generated by your spells by {0}%" is `threat` and not `healing`: it reaches
   * every spell a Shaman casts rather than only its heals, so a healing ruling
   * would expire the day a healing profile existed and this one never does.
   */
  // "Reduces the threat generated by your spells by 15%."
  natural_grace: [{ kind: 'threat', direction: 'decrease', tables: ['spell'] }],
  tidal_focus: [
    /*
     * ITS HIT HALF IS REAL AND ITS MANA HALF REACHES NOTHING. "Reduces the
     * Mana cost of your HEALING spells by 5% and improves your chance to hit
     * by 5%" -- the hit applies to everything, and the healing spells are not
     * in the book at all.
     *
     * So this is inert for want of a HEALING PROFILE rather than for want of
     * a percentage cost, which is what its reason used to claim. A test on
     * the wording caught it when that claim stopped being true elsewhere.
     */
    { kind: 'stat', stat: 'hitChance', operation: 'flat', valueIndex: 1 },
    { kind: 'unmodelled', scope: 'healing', reason: `Its mana half is healing only. ${NO_PROFILE_HEALS}` },
  ],
  /*
   * IMPROVED REINCARNATION, AND ITS REASON NAMED ONE CLAUSE OF THREE.
   *
   * "Reduces the cooldown of your Reincarnation spell by 20 min, INCREASES YOUR
   * MAXIMUM HEALTH BY 4%, and increases the amount of health and Mana you
   * reincarnate with by an additional 20%." The reason said only "a
   * self-resurrection out of combat", which is true of two clauses and silent
   * about the one that is neither out of combat nor a resurrection.
   *
   * THE 4% IS THE LIVE GAP and it is a real missing declaration: nothing reaches
   * maximum health. `maxHealth` is computed once in `createPlayer` from a stats
   * snapshot, so the only route a talent has today is stamina -- Toughness takes
   * it -- and a flat percentage of the POOL has no effect kind. Third time in
   * this file that a multi-clause reason explained the wrong clause, after
   * Improved Stormstrike and Improved Fire Nova.
   */
  improved_reincarnation: [
    {
      kind: 'unmodelled',
      reason:
        'Its 4% maximum health clause has no declaration: `maxHealth` is ' +
        'computed once from a stats snapshot and no effect kind reaches the ' +
        'pool as a percentage. Its other two clauses are a self-resurrection ' +
        'out of combat.',
    },
  ],
  ancestral_healing: [{ kind: 'unmodelled', scope: 'healing', reason: NO_PROFILE_HEALS }],
  /*
   * HEALING FOCUS is "a 70% chance to avoid interruption caused by damage while
   * casting any HEALING spell" -- so it is doubly ruled out, by cast pushback and
   * by healing throughput. `castPushback` is the one recorded, because that is
   * the MECHANISM: the healing restriction only narrows which casts it would
   * have applied to.
   */
  healing_focus: [
    {
      kind: 'unmodelled',
      scope: 'castPushback',
      reason:
        'Avoiding interruption from damage while casting a healing spell. Cast ' +
        'pushback is out of scope, and so is healing throughput.',
    },
  ],
  water_shield: [
    {
      kind: 'unmodelled',
      reason:
        'Restores mana when the CARRIER is hit or when a heal crits. Neither ' +
        'profile is attacked and neither heals.',
    },
  ],
  tidal_mastery: [{ kind: 'unmodelled', scope: 'healing', reason: NO_PROFILE_HEALS }],
  restorative_totems: [{ kind: 'unmodelled', scope: 'totemEntities', reason: TOTEMS_NOT_MODELLED }],
  mana_tide_totem: [{ kind: 'unmodelled', scope: 'totemEntities', reason: TOTEMS_NOT_MODELLED }],
  healing_way: [{ kind: 'unmodelled', scope: 'healing', reason: NO_PROFILE_HEALS }],

  nature_s_swiftness: [
    {
      kind: 'unmodelled',
      reason:
        'Makes the NEXT Nature spell instant. A one-shot cast-time modifier, ' +
        'the same rule Maelstrom Weapon wants and the Druid found first.',
    },
  ],

  purification: [{ kind: 'unmodelled', scope: 'healing', reason: NO_PROFILE_HEALS }],
  riptide: [{ kind: 'unmodelled', scope: 'healing', reason: NO_PROFILE_HEALS }],
};
