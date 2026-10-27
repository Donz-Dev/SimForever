import type { AplEntry } from '../../game/rotations/apl';
import { PRIEST_SHADOW } from '../../game/rotations/priest';
import { RACIAL_COOLDOWNS, racialsForRace } from '../../game/rotations/racialCooldowns';
import { CONSUMABLE_COOLDOWNS, withoutUnselectedConsumables } from '../../game/rotations/consumableCooldowns';
import { casterConsumables } from '../../game/buffs/consumables';
import type { ConsumableSelection } from '../../game/buffs/consumables';
import type { MultiTargetDefaults } from './types';

/**
 * ==============================================================================
 * SHADOW ON SEVERAL TARGETS (round 78): the Single Target list with Shadow Word:
 * Pain walked across up to eight enemies and moved above the Inner Focus / Mind
 * Flay sequence, so the DoTs go out before the channel.
 *
 * MEASURED PAIRED AGAINST THE SINGLE TARGET LIST ON THE SAME TARGETS, 400
 * fights, before the move above Inner Focus:
 *
 *   3 targets, 60s   +159.7 +/- 4.4
 *   5 targets, 60s   +338.4 +/- 5.3     (the objective)
 *   8 targets, 30s   +462.1 +/- 6.1
 *
 * MULTI-DOT 8 IS EVERY COUNT AT ONCE: an X above the fight's Number of Targets
 * is the number of targets, so one list serves three, five and eight.
 *
 * ONLY WITH SIX SECONDS OR MORE OF THE FIGHT LEFT -- two ticks, about what the
 * global cooldown is worth as a Mind Flay. +49.7 over the ungated multi-dot at
 * five targets; three seconds measured -21.4 against six, and nine -2.7.
 *
 * ABOVE THE INNER FOCUS SEQUENCE: +60.9 at eight targets over thirty seconds,
 * where the opening channel delays the spread, and -3.0 / -1.0 (noise) at five
 * and three. Devouring Plague walked across targets as well changed nothing --
 * its 24 second cooldown is its duration, so only one is ever out.
 *
 * HOLY NOVA IS PRICED AND NOT SHIPPED: it needs eleven Holy points, which costs
 * Inner Focus -- the owner's Inner Focus / Mind Flay pairing would go silent --
 * Mental Strength and Meditation. -10.5 at one target and 120s, about +35 at
 * five targets and +235 at eight. A question for the owner.
 * ==============================================================================
 */
const swpEverywhere: AplEntry = {
  abilityId: 'shadow_word_pain',
  multiDot: 8,
  condition: {
    kind: 'all',
    of: [
      { kind: 'aura', on: 'target', auraId: 'shadow_word_pain', present: false },
      { kind: 'fightRemaining', compare: 'atLeast', seconds: 6 },
    ],
  },
  note: 'On every target it is not on, while six seconds or more of the fight is left.',
};

/**
 * AND AT THREE TARGETS OR FEWER THE SPREAD MAY CUT A MIND FLAY SHORT (round 80),
 * after its two protected ticks. +7.96 +/- 2.68 DPS at three targets over 60s
 * (600 paired fights); at five it is -2.78 and at eight noise, so it is a copy
 * of the spread gated on the target count rather than a flag on the spread
 * itself, and five and eight run the identical fight.
 */
const swpEverywhereClipping: AplEntry = {
  ...swpEverywhere,
  condition: { kind: 'all', of: [swpEverywhere.condition!, { kind: 'targetCount', compare: 'atMost', count: 3 }] },
  interruptsChannel: true,
  note: 'At three targets or fewer, the spread cuts a Mind Flay short after its two protected ticks.',
};

const shadowMulti = (): readonly AplEntry[] => {
  const rest = PRIEST_SHADOW.entries.filter((entry) => entry.abilityId !== 'shadow_word_pain');
  const at = rest.findIndex((entry) => entry.abilityId === 'inner_focus');
  return [...rest.slice(0, at), swpEverywhereClipping, swpEverywhere, ...rest.slice(at)];
};

/* ------------------------------------------------------------------ healers */

const TANK = { kind: 'tank' } as const;
const LOWEST_PARTY = { kind: 'lowestParty' } as const;

/**
 * ==============================================================================
 * THE RACIALS IN BOTH RAID LISTS, WITH BERSERKING HELD FIVE SECONDS (round 80).
 * Both healers are Trolls since round 80, and Berserking at the pull spends its
 * ten seconds of haste before the first raid pulse lands at five -- so it waits
 * for it. Measured on the weighted healer score against Troll at the pull:
 * Holy +4.8 (raid +9.6), Disc +18.7 (raid +37.4). Berserking in the TANK fight
 * is worth nothing either way (switched off it runs the identical fight).
 * ==============================================================================
 */
const RAID_RACIALS: readonly AplEntry[] = RACIAL_COOLDOWNS.map((entry) =>
  entry.abilityId === 'berserking'
    ? {
        ...entry,
        condition: { kind: 'fightElapsed', compare: 'atLeast', seconds: 5 },
        note: 'Held for the first raid pulse, which lands at five seconds.',
      }
    : entry,
);

const POWER_WORD_SHIELD_ON_THE_TANK: AplEntry = {
  abilityId: 'power_word_shield',
  target: TANK,
  condition: { kind: 'aura', on: 'target', auraId: 'weakened_soul', present: false },
  note: 'Kept up on the tank, whenever Weakened Soul allows.',
};

/**
 * GREATER HEAL ON THE TANK WHEN IT IS LOW (round 80), an addition above the
 * owner's lines. The raid tank takes a tenth of its health every two seconds,
 * and Prayer of Healing goes to the lowest PARTY -- so a tank that has fallen
 * low is otherwise only reached by the Renew, the shield and Prayer of Mending.
 * Swept at 30/40/50/60/70/80/90% on 600 paired raid fights at 60s:
 *
 *   Holy, above Prayer of Healing   -26.8 / -12.5 / +4.0 / +25.1 / **+29.5** / +8.8 / -60.9
 *   Disc, above the shield          60% **+26.5**, 70% +26.1 (above PoH: +19.5 / +17.4)
 *
 * A Flash Heal there instead loses (-41.0 Holy, -70.0 Disc at 70%): Greater Heal
 * is the efficient heal, and this fight runs out of mana.
 */
const greaterHealTheTank = (fraction: number): AplEntry => ({
  abilityId: 'greater_heal',
  target: TANK,
  condition: { kind: 'health', on: 'target', compare: 'below', fraction },
  note: `Greater Heal on the tank under ${fraction * 100}% health.`,
});

const PRAYER_OF_HEALING_SPAM: AplEntry = {
  abilityId: 'prayer_of_healing',
  target: LOWEST_PARTY,
  condition: { kind: 'friendlyHealth', of: 'party', compare: 'below', fraction: 1 },
  note: 'On the party with the lowest average health.',
};

/**
 * ==============================================================================
 * THE HOLY PRIEST'S RAID HEALER LIST (round 78): the owner's four raid lines --
 * Renew and the shield kept up on the tank, a Prayer of Mending out, Prayer of
 * Healing spammed on the lowest party -- with two changes of ours, measured in
 * the raid healer fight at 60s, 400 paired fights:
 *
 *   INNER FOCUS, THEN PRAYER OF HEALING, as one sequence -- the talent is new
 *   this round. A free 1,070-mana cast with +25% crit on five heals: +83.8.
 *
 *   PRAYER OF MENDING FIRST rather than third: +44.9 over the owner's order.
 *   It is about twelve healing a mana against Prayer of Healing's four, and the
 *   fight is mana-bound, so it should never wait behind a Renew or a shield.
 *
 * Every owner line is still in the list and still does its job. Two of them
 * cost HPS here and are KEPT, by the rule that the owner's lines outrank a
 * measurement: without the shield line the list is +71.2, without Renew +4.8.
 * ==============================================================================
 */
const HOLY_RAID: readonly AplEntry[] = [
  ...RAID_RACIALS,
  ...CONSUMABLE_COOLDOWNS,
  {
    abilityId: 'inner_focus',
    target: LOWEST_PARTY,
    sequence: ['prayer_of_healing'],
    condition: { kind: 'friendlyHealth', of: 'lowestParty', compare: 'below', fraction: 1 },
    note: 'Inner Focus, then Prayer of Healing on the lowest party at once.',
  },
  {
    abilityId: 'prayer_of_mending',
    target: TANK,
    condition: { kind: 'raidAura', auraId: 'prayer_of_mending', present: false },
    note: 'On the tank, whenever none of yours is out -- first, as the best healing per mana.',
  },
  {
    abilityId: 'renew',
    target: TANK,
    condition: { kind: 'aura', on: 'target', auraId: 'renew', present: false },
    note: 'Kept up on the tank.',
  },
  POWER_WORD_SHIELD_ON_THE_TANK,
  greaterHealTheTank(0.7),
  PRAYER_OF_HEALING_SPAM,
];

/**
 * ==============================================================================
 * THE DISC PRIEST'S RAID HEALER LIST (round 78): the owner's raid lines exactly
 * -- Inner Focus on Penance, Penance on cooldown on the tank, the shield kept up
 * on the tank, Prayer of Healing spammed -- with the tank healer's Renew and
 * Flash Heal lines left out, since they never fire here.
 *
 * PRICED AND NOT SHIPPED, as owner lines: Inner Focus spent on Prayer of Healing
 * instead of Penance is +42.3, and that with the Penance line removed as well
 * +60.5. Adding Renew on the tank above Prayer of Healing is -10.9.
 * ==============================================================================
 */
const DISC_RAID: readonly AplEntry[] = [
  ...RAID_RACIALS,
  ...CONSUMABLE_COOLDOWNS,
  {
    abilityId: 'inner_focus',
    target: TANK,
    sequence: ['penance'],
    note: 'Inner Focus, then Penance on the tank at once.',
  },
  { abilityId: 'penance', target: TANK, note: 'On cooldown, on the tank.' },
  greaterHealTheTank(0.6),
  POWER_WORD_SHIELD_ON_THE_TANK,
  PRAYER_OF_HEALING_SPAM,
];

/**
 * The racial entries lit for the preset's own race and switched off (or, for a
 * racial no Priest race learns, removed) for every other, and the mid-fight
 * consumables narrowed to the ones the preset carries -- what
 * `syncDefaultRotation` does to a stored Single Target list, done here because
 * a custom list is never re-derived. The races and selections are the presets'.
 */
const forPreset = (
  entries: readonly AplEntry[],
  race: 'undead' | 'troll',
  consumables: ConsumableSelection,
): readonly AplEntry[] =>
  withoutUnselectedConsumables({ name: '', entries: racialsForRace({ entries }, race, 'priest').entries }, 'priest', consumables)
    .entries;

const HEALER_MID_FIGHT: ConsumableSelection = { potion: 'major_mana_potion', other: 'demonic_rune' };

/**
 * The Priest presets' optimised Multi Target lists (round 78), keyed by preset
 * id. A preset with no entry runs its Single Target list on several targets.
 */
export const PRIEST_MULTI_TARGET: MultiTargetDefaults = {
  shadow_priest: { name: 'Priest (Shadow, multi-target)', entries: forPreset(shadowMulti(), 'troll', { ...casterConsumables('school_shadow'), potion_secondary: 'secondary_major_mana_potion' }) },
  // No opener in the raid fight: the Single Target section's pre-pull Inner Focus would be spent on the first spell
  // and take the raid list's Inner Focus -> Prayer of Healing with it (round 80).
  priest_holy: { name: 'Priest (Holy, raid)', entries: forPreset(HOLY_RAID, 'troll', HEALER_MID_FIGHT), precombat: [] },
  priest_disc: { name: 'Priest (Discipline, raid)', entries: forPreset(DISC_RAID, 'troll', HEALER_MID_FIGHT) },
};
