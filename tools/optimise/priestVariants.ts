/*
 * ==============================================================================
 * ROUND 78 -- THE THREE PRIEST PRESETS, OPTIMISED FOR THE FULL REPORT.
 *
 *   PRESET=shadow_priest FILE=tools/optimise/priestVariants.ts VARIANTS=spRace DURATION=120 npx vite-node tools/probe_build.ts
 *   PRESET=shadow_priest FILE=tools/optimise/priestVariants.ts VARIANTS=spAoe TARGETS=5 DURATION=60 npx vite-node tools/probe_build.ts
 *   PRESET=priest_holy  FILE=tools/optimise/priestVariants.ts VARIANTS=holyApl DURATION=120 npx vite-node tools/probe_build.ts
 *   PRESET=priest_holy  FILE=tools/optimise/priestVariants.ts VARIANTS=holyRaid FIGHT=raid DURATION=60 npx vite-node tools/probe_build.ts
 *
 * THE OBJECTIVES (the brief): Shadow -- DPS at 1 target 120s, and DPS at 5
 * targets 60s for the Multi Target list (reused at 3/60s and 8/30s). Holy and
 * Disc -- HPS in the tank healer fight at 120s (Single Target section) and in
 * the raid healer fight at 60s (Multi Target section).
 *
 * THE THEME, which may not move (Step 0):
 *
 *   shadow_priest  Priest, 14/2/35 SHADOW majority, caster style, Shadowform,
 *                  target does not swing back
 *   priest_holy    Priest, 17/34/0 HOLY majority, caster staff, healer
 *   priest_disc    Priest, 31/20/0 DISCIPLINE majority, caster staff, healer
 *
 * GROUP NAMES are prefixed `sp`, `holy` and `disc`, because `FILE=` spreads this
 * file first into the shared registry and a name collision would shadow a group
 * in `tools/priestVariants.ts` (whose groups all start `priest`).
 *
 * Every group's first row is `(p) => p`, labelled "the shipped X": it means
 * whatever is on the branch now, never the value a label might name.
 *
 * WHAT SHIPPED (round 78), so every figure in a group measured before it is a
 * figure against the PRE-ROUND build: Shadow -- Human, and the Multi Target
 * list in `src/profiles/multiTarget/priest.ts`. Holy -- Gnome, 18/33/0 (Inner
 * Focus and Improved Renew 3/3 from Holy Reach), the staff's +65 Spell Power
 * and +8 Intellect head and legs, Prayer of Mending at the bottom of the tank
 * list, and the raid list. Disc -- Gnome, 29/22/0 (Improved Healing 3/3), the
 * same enchants, and the owner's raid lines as their own list. The rows still
 * labelled "(was +1% Haste)" are now no-ops. Full write-up and every figure:
 * docs/handoff/priest.md, round 78.
 * ==============================================================================
 */
import type { CharacterProfile } from '../../src/profiles';
import type { AplEntry } from '../../src/game/rotations/apl';
import type { RaceId } from '../../src/game/character/ids';
import { RACIAL_COOLDOWNS } from '../../src/game/rotations/racialCooldowns';
import { CONSUMABLE_COOLDOWNS } from '../../src/game/rotations/consumableCooldowns';
import {
  PRIEST_TREE as tree,
  addAbove,
  addEntry,
  addPrecombat,
  apl,
  moveAbove,
  chain,
  consumable,
  enchant,
  inMulti,
  multiList,
  type Apply,
  type Variant,
} from '../buildVariants';

const race =
  (id: RaceId) =>
  (p: CharacterProfile): CharacterProfile => ({ ...p, character: { ...p.character, race: id } });

/** An edit to both sections: the tank healer fight runs Single Target, the raid fight Multi Target. */
const both = (...applies: Apply[]): Apply => chain(chain(...applies), inMulti(...applies));

const PRIEST_RACES: readonly RaceId[] = ['human', 'dwarf', 'night_elf', 'gnome', 'undead', 'troll'];
const raceGroup = (): Variant[] => [
  { label: 'the shipped race -- the control', apply: (p) => p },
  ...PRIEST_RACES.map((r) => ({ label: `race ${r}`, apply: race(r) })),
];

/* ------------------------------------------------------------------ shadow */

const SHADOW_SHIPPED = {
  twin_disciplines: 5,
  mental_strength: 5,
  meditation: 3,
  inner_focus: 1,
  twilight_focus: 2,
  shadow_focus: 5,
  dark_inspiration: 3,
  improved_shadow_word_pain: 2,
  shadow_reach: 2,
  improved_mind_blast: 5,
  mind_flay: 1,
  improved_mind_flay: 2,
  vampiric_embrace: 1,
  shadow_weaving: 3,
  silence: 1,
  devouring_contagion: 2,
  early_demise: 2,
  darkness: 5,
  shadowform: 1,
};

/**
 * HOLY NOVA FOR THE MULTI TARGET SECTION: 5/0/... Discipline down to Twin
 * Disciplines alone, and eleven Holy points -- ten below tier 10 and Holy Nova.
 * Shadow's 35 are untouched and stay the majority.
 */
const SHADOW_HOLY_NOVA = {
  ...SHADOW_SHIPPED,
  mental_strength: 0,
  meditation: 0,
  inner_focus: 0,
  twilight_focus: 3,
  holy_specialization: 5,
  improved_renew: 2,
  holy_nova: 1,
};

const SHADOW_DOTS = (count: number): readonly AplEntry[] => [
  { abilityId: 'shadow_word_pain', condition: { kind: 'aura', on: 'target', auraId: 'shadow_word_pain', present: false }, multiDot: count },
];

/** Shadow Word: Pain walked across up to `n` targets, in its own place in the Multi Target list. */
const SWP_MULTI = (n: number): Apply =>
  inMulti(apl((e) => e.map((x) => (x.abilityId === 'shadow_word_pain' ? { ...x, multiDot: n } : x))));

/** Shadow Word: Pain on up to 8 targets while `seconds` or more of the fight is left. */
const SHADOW_AOE_L = (seconds: number): Apply =>
  inMulti(
    apl((e) =>
      e.map((x) =>
        x.abilityId === 'shadow_word_pain'
          ? {
              ...x,
              multiDot: 8,
              condition: { kind: 'all', of: [x.condition!, { kind: 'fightRemaining', compare: 'atLeast', seconds }] },
            }
          : x,
      ),
    ),
  );
const MB_BELOW_SWD: Apply = inMulti(
  apl((e) => {
    const [mb] = e.splice(
      e.findIndex((x) => x.abilityId === 'mind_blast'),
      1,
    );
    e.splice(e.findIndex((x) => x.abilityId === 'shadow_word_death') + 1, 0, mb);
    return e;
  }),
);
const HOLY_NOVA_ABOVE_FLAY = (fraction: number): Apply =>
  inMulti(
    addAbove(
      { abilityId: 'holy_nova', condition: { kind: 'resourceFraction', resource: 'mana', compare: 'atLeast', fraction } },
      'mind_flay',
    ),
  );

/* -------------------------------------------------------------- the healers */

const TANK = { kind: 'tank' } as const;
const tankBelow = (fraction: number) => ({ kind: 'health', on: 'target', compare: 'below', fraction }) as const;
const RAID = { kind: 'raidSize', compare: 'atLeast', count: 6 } as const;

const greaterHealBelow = (fraction: number): AplEntry => ({
  abilityId: 'greater_heal',
  target: TANK,
  condition: { kind: 'all', of: [{ kind: 'raidSize', compare: 'below', count: 6 }, tankBelow(fraction)] },
  note: `Greater Heal on the tank under ${fraction * 100}% health.`,
});

const pomOnTank: AplEntry = {
  abilityId: 'prayer_of_mending',
  target: TANK,
  condition: { kind: 'raidAura', auraId: 'prayer_of_mending', present: false },
  note: 'Prayer of Mending on the tank whenever none of yours is out.',
};

/* The Holy Priest's tree, the owner's 17/34/0, written out as the control. */
const HOLY_SHIPPED = {
  twin_disciplines: 5,
  mental_strength: 5,
  improved_power_word_shield: 3,
  meditation: 3,
  soul_warding: 1,
  twilight_focus: 3,
  improved_renew: 2,
  holy_specialization: 5,
  divine_fury: 5,
  inspiration: 3,
  holy_reach: 2,
  improved_healing: 3,
  binding_heal: 1,
  spirit_of_redemption: 1,
  spiritual_guidance: 5,
  spiritual_healing: 3,
  prayer_of_mending: 1,
};

/* Holy Reach's two `positioning` points: one buys Inner Focus, one Improved Renew 3/3. */
const HOLY_INNER_FOCUS = { ...HOLY_SHIPPED, holy_reach: 0, inner_focus: 1, improved_renew: 3 };
const HOLY_RENEW_ONLY = { ...HOLY_SHIPPED, holy_reach: 1, improved_renew: 3 };

/* The Disc Priest's tree, the owner's 31/20/0. */
const DISC_SHIPPED = {
  twin_disciplines: 5,
  silent_resolve: 3,
  mental_strength: 5,
  inner_focus: 1,
  improved_power_word_shield: 3,
  meditation: 3,
  soul_warding: 1,
  penance: 1,
  renewed_hope: 5,
  divine_aegis: 3,
  power_infusion: 1,
  twilight_focus: 3,
  improved_renew: 3,
  holy_specialization: 5,
  divine_fury: 5,
  holy_nova: 1,
  inspiration: 3,
};

/*
 * POWER INFUSION (whose healing half the engine does not apply), one of Silent
 * Resolve's threat points and one Twilight Focus `castPushback` point buy
 * Improved Healing 3/3: Penance 15% cheaper. Discipline keeps 20 points below
 * Penance's tier and 26 below Divine Aegis's, so both stay legal. 29/22/0.
 */
const DISC_IMPROVED_HEALING = {
  ...DISC_SHIPPED,
  power_infusion: 0,
  silent_resolve: 2,
  twilight_focus: 2,
  improved_healing: 3,
};
/*
 * SPIRITUAL GUIDANCE: Divine Aegis, Power Infusion and a Silent Resolve point
 * out of Discipline (26 left, still the majority). Holy 25: Twilight Focus's
 * three move to Improved Healing 3/3, keeping 20 below tier 20, then Spiritual
 * Guidance 5/5.
 */
const DISC_SPIRITUAL_GUIDANCE = {
  ...DISC_SHIPPED,
  divine_aegis: 0,
  power_infusion: 0,
  silent_resolve: 2,
  twilight_focus: 0,
  improved_healing: 3,
  spiritual_guidance: 5,
};

const innerFocusThen = (spell: string, target: AplEntry['target'], condition?: AplEntry['condition']): AplEntry => ({
  abilityId: 'inner_focus',
  target,
  sequence: [spell],
  ...(condition ? { condition } : {}),
  note: `Inner Focus, then ${spell} at once.`,
});

/* The owner's raid healer lines, as the Multi Target list's starting point. */
const HOLY_RAID_LINES: readonly AplEntry[] = [
  { abilityId: 'renew', target: TANK, condition: { kind: 'aura', on: 'target', auraId: 'renew', present: false }, note: 'Kept up on the tank.' },
  {
    abilityId: 'power_word_shield',
    target: TANK,
    condition: { kind: 'aura', on: 'target', auraId: 'weakened_soul', present: false },
    note: 'Kept up on the tank, whenever Weakened Soul allows.',
  },
  {
    abilityId: 'prayer_of_mending',
    target: TANK,
    condition: { kind: 'raidAura', auraId: 'prayer_of_mending', present: false },
    note: 'On the tank, whenever none of yours is out.',
  },
  {
    abilityId: 'prayer_of_healing',
    target: { kind: 'lowestParty' },
    condition: { kind: 'friendlyHealth', of: 'party', compare: 'below', fraction: 1 },
    note: 'On the party with the lowest average health.',
  },
];

const HOLY_RAID: readonly AplEntry[] = [...RACIAL_COOLDOWNS, ...CONSUMABLE_COOLDOWNS, ...HOLY_RAID_LINES];
const holyRaidWithIf = (fraction: number): readonly AplEntry[] => [
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_COOLDOWNS,
  innerFocusThen('prayer_of_healing', { kind: 'lowestParty' }, { kind: 'friendlyHealth', of: 'lowestParty', compare: 'below', fraction }),
  ...HOLY_RAID_LINES,
];
const pomFirst = (entries: readonly AplEntry[]): readonly AplEntry[] => {
  const list = [...entries];
  const [pom] = list.splice(list.findIndex((e) => e.abilityId === 'prayer_of_mending'), 1);
  list.splice(list.findIndex((e) => e.abilityId === 'renew'), 0, pom);
  return list;
};

/* The Disc Priest's raid lines: Penance on cooldown, the shield, Prayer of Healing. */
const discRaid = (innerFocusOn: 'penance' | 'prayer_of_healing'): readonly AplEntry[] => [
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_COOLDOWNS,
  innerFocusOn === 'penance'
    ? innerFocusThen('penance', TANK)
    : innerFocusThen('prayer_of_healing', { kind: 'lowestParty' }, { kind: 'friendlyHealth', of: 'lowestParty', compare: 'below', fraction: 1 }),
  { abilityId: 'penance', target: TANK, note: 'On cooldown, on the tank.' },
  HOLY_RAID_LINES[1],
  HOLY_RAID_LINES[3],
];

/* ---------------------------------------------------------------- combined */

const SP_COMBINED: Apply = chain(race('human'), SHADOW_AOE_L(6));

const HEALER_ENCHANTS: Apply = chain(enchant('twoHand', 900029), enchant('head', 900006), enchant('legs', 900006));
const HOLY_MULTI = (pom: boolean): Apply =>
  multiList('Priest (Holy, raid)', pom ? pomFirst(holyRaidWithIf(1)) : holyRaidWithIf(1));
const HOLY_COMBINED: Apply = chain(race('gnome'), HEALER_ENCHANTS, tree(HOLY_INNER_FOCUS), HOLY_MULTI(true));

const renewOnTankAbovePoh = (entries: readonly AplEntry[]): readonly AplEntry[] => {
  const list = [...entries];
  list.splice(list.findIndex((e) => e.abilityId === 'prayer_of_healing'), 0, HOLY_RAID_LINES[0]);
  return list;
};
const DISC_COMBINED: Apply = chain(
  race('gnome'),
  HEALER_ENCHANTS,
  tree(DISC_IMPROVED_HEALING),
  multiList('Priest (Discipline, raid)', discRaid('penance')),
);

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  /* ============================== SHADOW ============================== */
  spRace: raceGroup(),
  spEnchants: [
    { label: 'the shipped enchants -- the control', apply: (p) => p },
    { label: 'head +8 Intellect (was +1% Haste)', apply: enchant('head', 900006) },
    { label: 'head +8 Spirit (was +1% Haste)', apply: enchant('head', 900007) },
    { label: 'legs +8 Intellect (was +1% Haste)', apply: enchant('legs', 900006) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
  ],
  spConsumables: [
    { label: 'the shipped consumables -- the control', apply: (p) => p },
    { label: 'blasted lands +25 Spirit', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
    { label: 'other Healthstone (was Demonic Rune)', apply: consumable('other', 'healthstone') },
  ],
  spTalents: [
    { label: 'the shipped tree -- the control', apply: (p) => p },
    { label: '14/2/35 written out', apply: tree(SHADOW_SHIPPED) },
    { label: 'Holy Nova build 5/11/35', apply: tree(SHADOW_HOLY_NOVA) },
  ],
  spAoe: [
    { label: 'the shipped Multi Target list -- the control', apply: (p) => p },
    ...[2, 3, 5].map((n) => ({
      label: `SWP multi-dot ${n} above mind_blast`,
      apply: inMulti(addAbove(SHADOW_DOTS(n)[0], 'mind_blast')),
    })),
    {
      label: 'SWP multi-dot 5 + DP multi-dot 5',
      apply: inMulti(
        apl((e) =>
          e.map((x) =>
            x.abilityId === 'shadow_word_pain' || x.abilityId === 'devouring_plague' ? { ...x, multiDot: 5 } : x,
          ),
        ),
      ),
    },
    {
      label: 'SWP multi-dot 5 at the top (above inner focus)',
      apply: inMulti(apl((e) => e.map((x) => (x.abilityId === 'shadow_word_pain' ? { ...x, multiDot: 5 } : x)))),
    },
  ],

  spAoe2: [
    { label: 'the shipped Multi Target list -- the control', apply: (p) => p },
    { label: 'A: SWP multi-dot 8 in place', apply: SWP_MULTI(8) },
    { label: 'A + SWP only with 6s+ of fight left', apply: chain(SWP_MULTI(8), inMulti(apl((e) => e.map((x) => (x.abilityId === 'shadow_word_pain' ? { ...x, condition: { kind: 'all', of: [x.condition!, { kind: 'fightRemaining', compare: 'atLeast', seconds: 6 }] } } : x))))) },
    { label: 'A + SWP only with 9s+ of fight left', apply: chain(SWP_MULTI(8), inMulti(apl((e) => e.map((x) => (x.abilityId === 'shadow_word_pain' ? { ...x, condition: { kind: 'all', of: [x.condition!, { kind: 'fightRemaining', compare: 'atLeast', seconds: 9 }] } } : x))))) },
    { label: 'A + mind_blast below shadow_word_death', apply: chain(SWP_MULTI(8), inMulti(apl((e) => { const i = e.findIndex((x) => x.abilityId === 'mind_blast'); const [mb] = e.splice(i, 1); e.splice(e.findIndex((x) => x.abilityId === 'shadow_word_death') + 1, 0, mb); return e; }))) },
    { label: 'A + Holy Nova build, Holy Nova above mind_flay', apply: chain(tree(SHADOW_HOLY_NOVA), SWP_MULTI(8), inMulti(addAbove({ abilityId: 'holy_nova' }, 'mind_flay'))) },
    { label: 'A + Holy Nova build, Holy Nova above mind_flay over 40% mana', apply: chain(tree(SHADOW_HOLY_NOVA), SWP_MULTI(8), inMulti(addAbove({ abilityId: 'holy_nova', condition: { kind: 'resourceFraction', resource: 'mana', compare: 'atLeast', fraction: 0.4 } }, 'mind_flay'))) },
    { label: 'A + Holy Nova build, no Holy Nova entry', apply: chain(tree(SHADOW_HOLY_NOVA), SWP_MULTI(8)) },
  ],

  spAoe3: [
    { label: 'the shipped Multi Target list -- the control', apply: (p) => p },
    { label: 'L: SWP multi-dot 8, 6s+ left', apply: SHADOW_AOE_L(6) },
    { label: 'L with 3s+ left', apply: SHADOW_AOE_L(3) },
    { label: 'L + mind_blast below shadow_word_death', apply: chain(SHADOW_AOE_L(6), MB_BELOW_SWD) },
    ...[0.2, 0.4, 0.6].map((f) => ({
      label: `L + Holy Nova build, Holy Nova above mind_flay over ${f * 100}% mana`,
      apply: chain(tree(SHADOW_HOLY_NOVA), SHADOW_AOE_L(6), HOLY_NOVA_ABOVE_FLAY(f)),
    })),
    { label: 'L + Holy Nova build, no entry', apply: chain(tree(SHADOW_HOLY_NOVA), SHADOW_AOE_L(6)) },
  ],

  spAoe4: [
    { label: 'the shipped Multi Target list -- the control', apply: (p) => p },
    { label: 'L: SWP multi-dot 8, 6s+ left', apply: SHADOW_AOE_L(6) },
    { label: 'L, SWP above inner_focus', apply: chain(SHADOW_AOE_L(6), inMulti(apl((e) => { const [x] = e.splice(e.findIndex((y) => y.abilityId === 'shadow_word_pain'), 1); e.splice(e.findIndex((y) => y.abilityId === 'inner_focus'), 0, x); return e; }))) },
    { label: 'L + race human', apply: chain(SHADOW_AOE_L(6), race('human')) },
    { label: 'L + race night_elf', apply: chain(SHADOW_AOE_L(6), race('night_elf')) },
  ],

  spOpener: [
    { label: 'the shipped opener -- the control', apply: (p) => p },
    { label: '+ inner_focus pre-cast at 0s (list entry kept)', apply: addPrecombat(0, 'inner_focus') },
  ],
  spApl: [
    { label: 'the shipped list -- the control', apply: (p) => p },
    { label: 'shadow_word_death above mind_blast', apply: moveAbove('shadow_word_death', 'mind_blast') },
    { label: 'devouring_plague above shadow_word_pain', apply: moveAbove('devouring_plague', 'shadow_word_pain') },
    { label: 'mind_blast above shadow_word_pain', apply: moveAbove('mind_blast', 'shadow_word_pain') },
  ],
  spCombined: [
    { label: 'the shipped preset -- the control', apply: (p) => p },
    { label: 'human + Multi Target L', apply: SP_COMBINED },
    { label: 'Multi Target L alone', apply: SHADOW_AOE_L(6) },
    { label: 'human alone', apply: race('human') },
  ],

  /* =============================== HOLY =============================== */
  holyRace: raceGroup(),
  holyEnchants: [
    { label: 'the shipped enchants -- the control', apply: (p) => p },
    { label: 'staff +65 Spell Power (was Enchant Weapon - Spell Power, +30 spell power and NO healing)', apply: enchant('twoHand', 900029) },
    { label: 'head +8 Intellect (was +1% Haste)', apply: enchant('head', 900006) },
    { label: 'head +8 Spirit (was +1% Haste)', apply: enchant('head', 900007) },
    { label: 'legs +8 Intellect (was +1% Haste)', apply: enchant('legs', 900006) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
  ],
  holyConsumables: [
    { label: 'the shipped consumables -- the control', apply: (p) => p },
    { label: 'blasted lands +25 Spirit (was Intellect)', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'food +28 Spell Power (was +44 Healing Power)', apply: consumable('food', 'food_spell_power') },
    { label: 'potion Spellblasting (was Major Mana)', apply: consumable('potion', 'major_spellblasting_potion') },
    { label: 'other Healthstone (was Demonic Rune)', apply: consumable('other', 'healthstone') },
  ],
  holyTalents: [
    { label: 'the shipped tree -- the control', apply: (p) => p },
    { label: '17/34/0 written out', apply: tree(HOLY_SHIPPED) },
    { label: 'holy_reach 1 -> improved_renew 3/3', apply: tree(HOLY_RENEW_ONLY) },
    { label: 'holy_reach 2 -> inner_focus + improved_renew 3/3, no IF entry', apply: tree(HOLY_INNER_FOCUS) },
    {
      label: 'holy_reach 2 -> inner_focus + improved_renew 3/3, IF -> Flash Heal (tank)',
      apply: chain(tree(HOLY_INNER_FOCUS), both(addAbove(innerFocusThen('flash_heal', TANK, tankBelow(1)), 'renew'))),
    },
    {
      label: 'as above, IF -> Prayer of Healing in the raid fight too',
      apply: chain(
        tree(HOLY_INNER_FOCUS),
        both(addAbove(innerFocusThen('flash_heal', TANK, { kind: 'all', of: [{ kind: 'raidSize', compare: 'below', count: 6 }, tankBelow(1)] }), 'renew'),
        addAbove(
          innerFocusThen('prayer_of_healing', { kind: 'lowestParty' }, { kind: 'all', of: [RAID, { kind: 'friendlyHealth', of: 'party', compare: 'below', fraction: 0.8 }] }),
          'renew',
        )),
      ),
    },
  ],
  holyApl: [
    { label: 'the shipped list -- the control', apply: (p) => p },
    ...[0.3, 0.5, 0.7, 1].map((f) => ({
      label: `+ Greater Heal on the tank under ${f * 100}%, above Flash Heal`,
      apply: addAbove(greaterHealBelow(f), 'flash_heal'),
    })),
    { label: '+ Prayer of Mending on the tank in the tank fight (bottom)', apply: addEntry(pomOnTank) },
    { label: '+ Prayer of Mending on the tank in the tank fight (above Flash Heal)', apply: addAbove(pomOnTank, 'flash_heal') },
  ],
  holyCombined: [
    { label: 'the shipped preset -- the control', apply: (p) => p },
    { label: 'C: gnome, staff/head/legs enchants, Inner Focus tree, raid list (IF -> PoH, PoM first)', apply: HOLY_COMBINED },
    { label: 'C with human', apply: chain(HOLY_COMBINED, race('human')) },
    { label: 'C without the head/legs Intellect', apply: chain(HOLY_COMBINED, enchant('head', 900002), enchant('legs', 900002)) },
    { label: 'C with the owner order (PoM third)', apply: chain(HOLY_COMBINED, HOLY_MULTI(false)) },
    { label: 'C + Prayer of Mending in the tank fight (bottom)', apply: chain(HOLY_COMBINED, addEntry(pomOnTank)) },
  ],
  holyPomTank: [
    { label: 'C -- the control for this group', apply: HOLY_COMBINED },
    { label: 'C + Prayer of Mending in the tank fight (bottom)', apply: chain(HOLY_COMBINED, addEntry(pomOnTank)) },
    { label: 'C + Prayer of Mending in the tank fight (above Flash Heal)', apply: chain(HOLY_COMBINED, addAbove(pomOnTank, 'flash_heal')) },
    { label: 'C + Prayer of Mending in the tank fight (above Renew)', apply: chain(HOLY_COMBINED, addAbove(pomOnTank, 'renew')) },
  ],
  holyRaid2: [
    { label: 'the shipped Multi Target list -- the control', apply: (p) => p },
    { label: 'R0: racials, consumables, the owner raid lines', apply: multiList('Priest (Holy, raid)', HOLY_RAID) },
    { label: 'R1: R0 + Inner Focus (talent) -> PoH, party below full', apply: chain(tree(HOLY_INNER_FOCUS), multiList('Priest (Holy, raid)', holyRaidWithIf(1))) },
    { label: 'R1 with the lowest party below 70%', apply: chain(tree(HOLY_INNER_FOCUS), multiList('Priest (Holy, raid)', holyRaidWithIf(0.7))) },
    { label: 'R1 with the lowest party below 50%', apply: chain(tree(HOLY_INNER_FOCUS), multiList('Priest (Holy, raid)', holyRaidWithIf(0.5))) },
    { label: 'R1 without the Power Word: Shield line (owner line, priced)', apply: chain(tree(HOLY_INNER_FOCUS), multiList('Priest (Holy, raid)', holyRaidWithIf(1).filter((e) => e.abilityId !== 'power_word_shield'))) },
    { label: 'R1 without the Renew line (owner line, priced)', apply: chain(tree(HOLY_INNER_FOCUS), multiList('Priest (Holy, raid)', holyRaidWithIf(1).filter((e) => e.abilityId !== 'renew'))) },
    { label: 'R1 with Prayer of Mending first', apply: chain(tree(HOLY_INNER_FOCUS), multiList('Priest (Holy, raid)', pomFirst(holyRaidWithIf(1)))) },
  ],
  holyRaid: [
    { label: 'the shipped Multi Target list -- the control', apply: (p) => p },
    { label: "the owner's raid lines alone as the Multi Target list", apply: multiList('Priest (Holy, raid)', HOLY_RAID_LINES) },
  ],

  /* =============================== DISC =============================== */
  discRace: raceGroup(),
  discEnchants: [
    { label: 'the shipped enchants -- the control', apply: (p) => p },
    { label: 'staff +65 Spell Power (was Enchant Weapon - Spell Power, +30 spell power and NO healing)', apply: enchant('twoHand', 900029) },
    { label: 'head +8 Intellect (was +1% Haste)', apply: enchant('head', 900006) },
    { label: 'head +8 Spirit (was +1% Haste)', apply: enchant('head', 900007) },
    { label: 'legs +8 Intellect (was +1% Haste)', apply: enchant('legs', 900006) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
  ],
  discConsumables: [
    { label: 'the shipped consumables -- the control', apply: (p) => p },
    { label: 'blasted lands +25 Spirit (was Intellect)', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'food +28 Spell Power (was +44 Healing Power)', apply: consumable('food', 'food_spell_power') },
    { label: 'potion Spellblasting (was Major Mana)', apply: consumable('potion', 'major_spellblasting_potion') },
    { label: 'other Healthstone (was Demonic Rune)', apply: consumable('other', 'healthstone') },
  ],
  discTalents: [
    { label: 'the shipped tree -- the control', apply: (p) => p },
    { label: '31/20/0 written out', apply: tree(DISC_SHIPPED) },
    { label: 'power_infusion, 1 silent_resolve, 1 twilight_focus -> improved_healing 3/3 (29/22/0)', apply: tree(DISC_IMPROVED_HEALING) },
    { label: 'divine_aegis, power_infusion, 1 silent_resolve, 3 twilight_focus -> improved_healing 3 + spiritual_guidance 5 (26/25/0)', apply: tree(DISC_SPIRITUAL_GUIDANCE) },
  ],
  discApl: [
    { label: 'the shipped list -- the control', apply: (p) => p },
    ...[0.3, 0.5, 0.7, 1].map((f) => ({
      label: `+ Greater Heal on the tank under ${f * 100}%, above Flash Heal`,
      apply: addAbove(greaterHealBelow(f), 'flash_heal'),
    })),
  ],
  discCombined: [
    { label: 'the shipped preset -- the control', apply: (p) => p },
    { label: 'C: gnome, staff/head/legs enchants, Improved Healing tree, owner raid lines', apply: DISC_COMBINED },
    { label: 'C with human', apply: chain(DISC_COMBINED, race('human')) },
    { label: 'C without the head/legs Intellect', apply: chain(DISC_COMBINED, enchant('head', 900002), enchant('legs', 900002)) },
    { label: 'C + Renew on the tank above PoH in the raid fight', apply: chain(DISC_COMBINED, multiList('Priest (Discipline, raid)', renewOnTankAbovePoh(discRaid('penance')))) },
  ],
  discRaid2: [
    { label: 'the shipped Multi Target list -- the control', apply: (p) => p },
    { label: 'D0: racials, consumables, IF -> Penance, the owner raid lines', apply: multiList('Priest (Discipline, raid)', discRaid('penance')) },
    { label: 'D1: Inner Focus -> Prayer of Healing instead of Penance', apply: multiList('Priest (Discipline, raid)', discRaid('prayer_of_healing')) },
    { label: 'D1 without the Power Word: Shield line (owner line, priced)', apply: multiList('Priest (Discipline, raid)', discRaid('prayer_of_healing').filter((e) => e.abilityId !== 'power_word_shield')) },
    { label: 'D1 without the Penance line (owner line, priced)', apply: multiList('Priest (Discipline, raid)', discRaid('prayer_of_healing').filter((e) => e.abilityId !== 'penance')) },
    { label: 'D1 + improved_healing tree', apply: chain(tree(DISC_IMPROVED_HEALING), multiList('Priest (Discipline, raid)', discRaid('prayer_of_healing'))) },
  ],
  discRaid: [
    { label: 'the shipped Multi Target list -- the control', apply: (p) => p },
  ],
};
