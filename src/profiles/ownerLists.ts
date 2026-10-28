import type { PrecombatAction } from '../engine';
import type { AplCondition, AplEntry, AplList } from '../game/rotations/apl';

/*
 * ============================================================================
 * THE OWNER'S THREE SAVED 3-TARGET BUILDS (round 82), their lists as data.
 *
 * Transcribed from the owner's saved profiles -- "1658 survival weave",
 * "1308 spellhance" and "1614 sm ruin" -- and carried by their presets as
 * CUSTOM lists, which is what the saved files were. A custom list is never
 * re-derived from the build, so these are what the presets run whatever the
 * stock dispatch would pick for their talents.
 *
 * DECLARED HERE AND NOT IN `game/rotations`, because that directory holds the
 * lists `rotationFor` can select and `rotationIds.test.ts` requires each one
 * to be reached by a preset's dispatch. These are owner lists for one preset
 * each, so `ownerSavedProfiles.test.ts` gives them the check the registry
 * would: every ability they name is in the built character's book.
 *
 * WHAT CHANGED FROM THE SAVED FILES, and why:
 * - each list gains the SECONDARY potion's entry, drunk only in the last 30 s,
 *   which is the Primary and Secondary Potion standard of round 79;
 * - the other races' disabled racial entries are dropped (all three are Orc);
 * - stale notes are dropped -- several were copied from another entry and
 *   described a gate the entry does not have;
 * - Spellhance loses its Rage of the Farseer: the opener line and both list
 *   entries. It is the Enhancement talent this 22-point build does not take,
 *   so none of the three could ever fire -- they look carried over from the
 *   Enh Shaman's list;
 * - SM Ruin's Single Target Hellfire is gated to two or more targets, the
 *   owner's ruling: as saved it cast Hellfire at one target and never Shadow
 *   Bolt, 675 DPS against 906 at 1T/120s. Its Multi Target list is unchanged.
 * Nothing else is touched: every gate and order is the owner's.
 * ============================================================================
 */

/** The secondary potion's window, the last 30 s -- the round 80 pair pattern. */
const LAST_30_SECONDS: AplCondition = { kind: 'fightRemaining', compare: 'atMost', seconds: 30 };

const secondaryPotion = (abilityId: string): AplEntry => ({ abilityId, condition: LAST_30_SECONDS });

const manaAtMost = (fraction: number): AplCondition => ({
  kind: 'resourceFraction',
  resource: 'mana',
  compare: 'atMost',
  fraction,
});

const selfExpired = (auraId: string): AplCondition => ({
  kind: 'auraTime',
  on: 'self',
  auraId,
  compare: 'atMost',
  seconds: 0,
});

const targetExpired = (auraId: string): AplCondition => ({
  kind: 'auraTime',
  on: 'target',
  auraId,
  compare: 'atMost',
  seconds: 0,
});

const swingAtLeast = (milliseconds: number): AplCondition => ({
  kind: 'swingIn',
  slot: 'mainHand',
  compare: 'atLeast',
  milliseconds,
});

const before = (secondsBefore: number, abilityId: string): PrecombatAction => ({ abilityId, secondsBefore });

// ---------------------------------------------------------------------------
// Survival Weave -- Hunter, 0/20/31
// ---------------------------------------------------------------------------

export const SURVIVAL_WEAVE_SINGLE: AplList = {
  name: 'Hunter (Survival Weave)',
  entries: [
    { abilityId: 'aspect_of_the_hawk', condition: selfExpired('aspect_of_the_hawk') },
    { abilityId: 'major_mana_potion', condition: manaAtMost(0.6) },
    secondaryPotion('major_frenzy_potion'),
    { abilityId: 'demonic_rune', condition: manaAtMost(0.5) },
    { abilityId: 'rapid_fire', sequence: ['blood_fury'] },
    { abilityId: 'hunters_mark', condition: selfExpired('hunters_mark') },
    { abilityId: 'serpent_sting', condition: { kind: 'aura', on: 'target', auraId: 'serpent_sting', present: false } },
    {
      abilityId: 'melee_weave',
      condition: { kind: 'swingIn', slot: 'mainHand', compare: 'atMost', milliseconds: 700 },
      weave: ['mongoose_bite', 'strider_kick', 'immolation_trap', 'wing_clip'],
    },
    { abilityId: 'multi_shot' },
    { abilityId: 'arcane_shot' },
    { abilityId: 'raptor_strike' },
  ],
};

export const SURVIVAL_WEAVE_MULTI: AplList = {
  name: 'Hunter (Survival Weave)',
  entries: [
    { abilityId: 'aspect_of_the_hawk', condition: selfExpired('aspect_of_the_hawk') },
    { abilityId: 'major_mana_potion', condition: manaAtMost(0.6) },
    secondaryPotion('major_frenzy_potion'),
    { abilityId: 'demonic_rune', condition: manaAtMost(0.5) },
    {
      abilityId: 'rapid_fire',
      sequence: ['blood_fury'],
      condition: { kind: 'cooldown', abilityId: 'multi_shot', state: 'ready' },
    },
    { abilityId: 'hunters_mark', condition: selfExpired('hunters_mark') },
    { abilityId: 'multi_shot' },
    { abilityId: 'melee_weave', weave: ['explosive_trap', 'strider_kick', 'mongoose_bite'] },
    { abilityId: 'serpent_sting', condition: targetExpired('serpent_sting'), multiDot: 3 },
    { abilityId: 'arcane_shot' },
    // Off in the saved file, and kept off: the owner's switch.
    { abilityId: 'volley', disabled: true },
  ],
};

export const SURVIVAL_WEAVE_PRECOMBAT: readonly PrecombatAction[] = [
  before(60, 'aspect_of_the_hawk'),
  before(10, 'hunters_mark'),
  before(2.5, 'aimed_shot'),
  before(0, 'start_auto_attack_ranged'),
  before(0, 'serpent_sting'),
];

export const SURVIVAL_WEAVE_MULTI_PRECOMBAT: readonly PrecombatAction[] = [
  before(60, 'aspect_of_the_hawk'),
  before(10, 'hunters_mark'),
  before(0.5, 'multi_shot'),
  before(0, 'start_auto_attack_ranged'),
];

// ---------------------------------------------------------------------------
// Spellhance -- Shaman, 29/22/0, a two-handed caster staff
// ---------------------------------------------------------------------------

export const SPELLHANCE_SINGLE: AplList = {
  name: 'Shaman (Spellhance)',
  entries: [
    { abilityId: 'blood_fury' },
    { abilityId: 'demonic_rune', condition: manaAtMost(0.2) },
    { abilityId: 'major_mana_potion', condition: manaAtMost(0.5) },
    secondaryPotion('major_spellblasting_potion'),
    { abilityId: 'fire_nova' },
    { abilityId: 'chain_lightning', condition: swingAtLeast(2000) },
    { abilityId: 'lava_burst', condition: swingAtLeast(2000) },
    { abilityId: 'flame_shock', condition: targetExpired('flame_shock') },
    { abilityId: 'magma_totem', condition: targetExpired('magma_totem') },
    { abilityId: 'stormstrike' },
    { abilityId: 'earth_shock' },
    { abilityId: 'lightning_bolt', condition: swingAtLeast(2000) },
  ],
};

export const SPELLHANCE_MULTI: AplList = {
  name: 'Shaman (Spellhance)',
  entries: [
    { abilityId: 'blood_fury' },
    { abilityId: 'demonic_rune', condition: manaAtMost(0.2) },
    { abilityId: 'major_mana_potion', condition: manaAtMost(0.5) },
    secondaryPotion('major_spellblasting_potion'),
    { abilityId: 'fire_nova' },
    { abilityId: 'chain_lightning', condition: swingAtLeast(2000) },
    { abilityId: 'flame_shock', condition: targetExpired('flame_shock') },
    { abilityId: 'magma_totem', condition: targetExpired('magma_totem') },
    { abilityId: 'stormstrike' },
    { abilityId: 'earth_shock' },
    { abilityId: 'lava_burst', condition: swingAtLeast(2000) },
    { abilityId: 'lightning_bolt', condition: swingAtLeast(2000) },
  ],
};

export const SPELLHANCE_PRECOMBAT: readonly PrecombatAction[] = [
  before(3, 'flametongue_weapon'),
  before(1.5, 'magma_totem'),
  before(0, 'flame_shock'),
  before(0, 'start_auto_attack_main_hand'),
];

// ---------------------------------------------------------------------------
// SM Ruin -- Warlock, 30/0/21
// ---------------------------------------------------------------------------

const present = (on: 'self' | 'target', auraId: string, isPresent: boolean): AplCondition => ({
  kind: 'aura',
  on,
  auraId,
  present: isPresent,
});

const atLeastLeft = (seconds: number): AplCondition => ({ kind: 'fightRemaining', compare: 'atLeast', seconds });

/** Everything in both lists but the DoT spreads and the Hellfire gate. */
function smRuinEntries(multiDot: number, siphonSpread: boolean, hellfire: AplCondition): AplEntry[] {
  return [
    { abilityId: 'amplify_curse' },
    { abilityId: 'major_mana_potion', condition: manaAtMost(0.6) },
    secondaryPotion('major_spellblasting_potion'),
    {
      abilityId: 'blood_fury',
      condition: {
        kind: 'all',
        of: [present('target', 'corruption', true), present('target', 'bane_of_agony', true), present('target', 'immolate', true)],
      },
    },
    {
      abilityId: 'life_tap',
      condition: {
        kind: 'all',
        of: [
          { kind: 'resourceFraction', resource: 'mana', compare: 'below', fraction: 0.1 },
          { kind: 'fightRemaining', compare: 'atLeast', fraction: 0.2 },
        ],
      },
      sequence: ['life_tap'],
    },
    { abilityId: 'life_tap', condition: { kind: 'resourceFraction', resource: 'mana', compare: 'below', fraction: 0.05 } },
    { abilityId: 'bane_of_havoc', condition: present('target', 'bane_of_havoc', false) },
    {
      abilityId: 'bane_of_agony',
      multiDot,
      condition: {
        kind: 'all',
        of: [present('target', 'bane_of_agony', false), atLeastLeft(12), present('target', 'bane_of_havoc', false)],
      },
    },
    {
      abilityId: 'corruption',
      multiDot,
      condition: { kind: 'all', of: [present('target', 'corruption', false), atLeastLeft(10)] },
    },
    {
      abilityId: 'siphon_life',
      condition: present('target', 'siphon_life', false),
      ...(siphonSpread ? { multiDot } : {}),
    },
    {
      abilityId: 'immolate',
      multiDot,
      condition: { kind: 'all', of: [present('target', 'immolate', false), atLeastLeft(10)] },
    },
    { abilityId: 'demonic_rune', condition: { kind: 'resourceFraction', resource: 'mana', compare: 'below', fraction: 0.5 } },
    { abilityId: 'shadow_bolt', condition: present('self', 'shadow_trance', true) },
    { abilityId: 'hellfire', condition: hellfire },
    { abilityId: 'shadow_bolt', condition: targetExpired('improved_shadow_bolt') },
    { abilityId: 'shadow_bolt' },
  ];
}

const HELLFIRE_MANA: AplCondition = { kind: 'resourceFraction', resource: 'mana', compare: 'atLeast', fraction: 0.2 };

export const SM_RUIN_SINGLE: AplList = {
  name: 'Warlock (SM Ruin)',
  // The saved list spreads its DoTs to four and its Siphon Life too; the gate
  // on Hellfire is the one change (see the header).
  entries: smRuinEntries(4, true, {
    kind: 'all',
    of: [HELLFIRE_MANA, { kind: 'targetCount', compare: 'atLeast', count: 2 }],
  }),
};

export const SM_RUIN_MULTI: AplList = {
  name: 'Warlock (SM Ruin)',
  entries: smRuinEntries(3, false, HELLFIRE_MANA),
};

export const SM_RUIN_PRECOMBAT: readonly PrecombatAction[] = [before(2.5, 'shadow_bolt'), before(0, 'corruption')];
