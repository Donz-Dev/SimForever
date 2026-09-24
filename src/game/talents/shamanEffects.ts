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
 *   TOTEMS             six. A totem is a separate attacking or buffing entity
 *                      and the engine has none, so anything scaling one is
 *                      inert -- including Call of Flame's fire-totem clause
 *                      and the whole of Fire Nova, which needs an active fire
 *                      totem to go off at all.
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

/** Said once; six talents say it. */
const TOTEMS_NOT_MODELLED =
  'A totem is a separate entity that attacks or buffs on its own, and the ' +
  'engine has none. Nothing scaling one can do anything.';

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
    {
      kind: 'unmodelled',
      reason: `Its Fire Totem and Fire Nova clauses do nothing. ${TOTEMS_NOT_MODELLED}`,
    },
  ],

  elemental_devastation: [{ kind: 'reaction', reactionId: 'elemental_devastation' }],

  elemental_focus: [
    {
      kind: 'unmodelled',
      reason:
        'A 10% chance of a Clearcasting state that removes the NEXT damage ' +
        "spell's mana cost entirely. A one-shot, charge-consuming cost " +
        'modifier, which has no declaration.',
    },
  ],

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
    {
      kind: 'unmodelled',
      reason: `Its Searing and Magma Totem clauses do nothing. ${TOTEMS_NOT_MODELLED}`,
    },
  ],

  improved_fire_nova: [
    {
      kind: 'unmodelled',
      reason:
        'Fire Nova requires an active fire totem to go off at all, so it is ' +
        `not an ability here. ${TOTEMS_NOT_MODELLED}`,
    },
  ],

  eye_of_the_storm: [
    {
      kind: 'unmodelled',
      reason: 'Pushback from damage taken while casting, and nothing here interrupts a cast.',
    },
  ],

  call_of_thunder: [
    { kind: 'abilityCrit', abilityId: 'lightning_bolt' },
    { kind: 'abilityCrit', abilityId: 'chain_lightning' },
  ],

  elemental_reach: [{ kind: 'unmodelled', reason: 'Range, and nothing here has a position.' }],

  lightning_overload: [
    {
      kind: 'unmodelled',
      reason:
        'A chance for Lightning Bolt or Chain Lightning to cast a SECOND copy ' +
        'at half damage. A cast reaction could roll it, but nothing lets a ' +
        'reaction re-cast an ability at a fraction of its damage.',
    },
  ],

  earthbound: [{ kind: 'unmodelled', reason: 'Earthbind Totem, and an immobilise.' }],

  elemental_alacrity: [
    { kind: 'abilityCastTime', abilityId: 'lightning_bolt' },
    { kind: 'abilityCastTime', abilityId: 'chain_lightning' },
    { kind: 'abilityCastTime', abilityId: 'lava_burst' },
  ],

  lava_burst: [{ kind: 'grantAbility', abilityId: 'lava_burst' }],

  // --- Enhancement ---------------------------------------------------------

  earth_s_grasp: [{ kind: 'unmodelled', reason: TOTEMS_NOT_MODELLED }],

  thundering_strikes: [
    // "all spells and attacks", so both tables.
    { kind: 'stat', stat: 'critChance', operation: 'flat' },
    { kind: 'stat', stat: 'spellCritChance', operation: 'flat' },
  ],

  ancestral_knowledge: [
    { kind: 'stat', stat: 'intellect', operation: 'percentAdd', scale: 0.01 },
  ],

  guardian_totems: [{ kind: 'unmodelled', reason: TOTEMS_NOT_MODELLED }],

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
    { kind: 'unmodelled', reason: 'A travel form, and nothing here moves.' },
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

  improved_stormstrike: [
    {
      kind: 'unmodelled',
      reason:
        'Mana regeneration while casting, and a Stormstrike cooldown reset on ' +
        'a DODGE OR PARRY. Neither profile is attacked, so neither ever dodges.',
    },
  ],

  maelstrom_weapon: [
    /*
     * LIVE. The value handed to the reaction is the REDUCTION -- 4/8/12/16/20
     * by rank, index 0 -- not the proc chance, which the tooltip does not
     * state at all. The first version of this passed it in as the chance, and
     * a 20% proc rate looked completely ordinary.
     */
    { kind: 'reaction', reactionId: 'maelstrom_weapon' },
    {
      kind: 'unmodelled',
      reason:
        'The cast time and mana reduction apply, per stack. Its PROC CHANCE ' +
        'is a placeholder: the tooltip says only "a chance" and no value for ' +
        'it exists in the client data.',
    },
  ],

  rage_of_the_farseer: [{ kind: 'grantAbility', abilityId: 'rage_of_the_farseer' }],

  // --- Restoration ---------------------------------------------------------

  improved_healing_wave: [{ kind: 'unmodelled', reason: NO_PROFILE_HEALS }],
  totemic_focus: [{ kind: 'unmodelled', reason: TOTEMS_NOT_MODELLED }],
  mindfulness: [{ kind: 'unmodelled', reason: 'Threat, which the engine does not track.' }],
  natural_grace: [{ kind: 'unmodelled', reason: NO_PROFILE_HEALS }],
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
    { kind: 'unmodelled', reason: `Its mana half is healing only. ${NO_PROFILE_HEALS}` },
  ],
  improved_reincarnation: [
    { kind: 'unmodelled', reason: 'A self-resurrection out of combat.' },
  ],
  ancestral_healing: [{ kind: 'unmodelled', reason: NO_PROFILE_HEALS }],
  healing_focus: [
    { kind: 'unmodelled', reason: 'Avoiding interruption, and nothing interrupts a cast here.' },
  ],
  water_shield: [
    {
      kind: 'unmodelled',
      reason:
        'Restores mana when the CARRIER is hit or when a heal crits. Neither ' +
        'profile is attacked and neither heals.',
    },
  ],
  tidal_mastery: [{ kind: 'unmodelled', reason: NO_PROFILE_HEALS }],
  restorative_totems: [{ kind: 'unmodelled', reason: TOTEMS_NOT_MODELLED }],
  mana_tide_totem: [{ kind: 'unmodelled', reason: TOTEMS_NOT_MODELLED }],
  healing_way: [{ kind: 'unmodelled', reason: NO_PROFILE_HEALS }],

  nature_s_swiftness: [
    {
      kind: 'unmodelled',
      reason:
        'Makes the NEXT Nature spell instant. A one-shot cast-time modifier, ' +
        'the same rule Maelstrom Weapon wants and the Druid found first.',
    },
  ],

  purification: [{ kind: 'unmodelled', reason: NO_PROFILE_HEALS }],
  riptide: [{ kind: 'unmodelled', reason: NO_PROFILE_HEALS }],
};
