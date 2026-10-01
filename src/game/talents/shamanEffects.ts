import type { TalentEffects } from './TalentEffect';

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

/**
 * Said once; two talents say it, and it is NOT the totem ruling.
 *
 * ----------------------------------------------------------------------------
 * MAGMA TOTEM IS A DAMAGE TOTEM, so the reading that reaches Searing Totem
 * reaches it too -- it is not blocked on a totem being an entity and must not
 * borrow that ruling. The capture states everything but one number: "Summons a
 * Magma Totem with 5 health at the feet of the caster for 20 sec that causes 73
 * Fire damage to creatures within 8 yards every 2 seconds", 650 mana, instant.
 *
 * WHAT IS MISSING IS THE SPELL POWER COEFFICIENT, exactly as it was for Searing
 * Totem until the owner supplied 8% a tick, and for Fire Nova until the owner
 * supplied 10%. `WoWSimWorksheet.xlsx` has no row for either. So this is a
 * question one message would answer, and recording it as the entity ruling
 * would park it behind an engine change it does not need -- which is the
 * mistake Improved Fire Nova's reason made for the whole project.
 *
 * IT WOULD NOT BE CAST EITHER WAY, which is worth knowing before anyone spends
 * the question: 73 every 2 seconds for 20 seconds is 36.5 damage a second for
 * 650 mana, against Searing Totem's 31.3 a second for 55 seconds and 170 mana,
 * and only one fire totem stands at a time. Single-target it loses on both
 * sustain and mana. Recorded in HANDOVER.md as an open question rather than as
 * work.
 * ----------------------------------------------------------------------------
 */
const MAGMA_TOTEM_UNDECLARED =
  'Magma Totem is not a declared ability. It is a DAMAGE totem, so the ' +
  'damage-over-time reading that reaches Searing Totem reaches it too and the ' +
  'entity ruling does not apply -- what it lacks is a spell power ' +
  'coefficient, which the owner supplied for Searing Totem and Fire Nova and ' +
  'which the coefficient sheet has no row for.';

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
    {
      kind: 'unmodelled',
      reason: `Its Magma Totem clause does nothing; every other clause is modelled. ${MAGMA_TOTEM_UNDECLARED}`,
    },
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
    {
      kind: 'unmodelled',
      reason: `Its Magma Totem clause does nothing. ${MAGMA_TOTEM_UNDECLARED}`,
    },
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
  improved_fire_nova: [
    { kind: 'abilityDamage', abilityId: 'fire_nova' },
    { kind: 'abilityCooldown', abilityId: 'fire_nova', unit: 'seconds', valueIndex: 1 },
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

  call_of_thunder: [
    { kind: 'abilityCrit', abilityId: 'lightning_bolt' },
    { kind: 'abilityCrit', abilityId: 'chain_lightning' },
  ],

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
    {
      kind: 'unmodelled',
      reason:
        'Its Windfury Weapon clause APPLIES -- the attack power of the proc is ' +
        'raised by it. Its Rockbiter, Flametongue and Frostbrand clauses do ' +
        'nothing, because those three imbues are not modelled: the first is a ' +
        'threat imbue and the other two scale with weapon speed off a ' +
        'coefficient the source does not state.',
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

  spirit_weapons: [
    {
      kind: 'unmodelled',
      scope: 'threat',
      reason:
        'A parry chance the tooltip does not quantify, plus two threat ' +
        'clauses. The engine does not track threat, and a number that is not ' +
        'stated is not invented.',
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
  mindfulness: [{ kind: 'unmodelled', scope: 'threat', reason: 'Threat, which the engine does not track.' }],
  natural_grace: [{ kind: 'unmodelled', scope: 'healing', reason: NO_PROFILE_HEALS }],
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
