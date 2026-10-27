/*
 * ==============================================================================
 * ROUND 80 -- THE THREE PRIEST PRESETS, SECOND PASS UNDER THE OWNER'S ROUND 79
 * RULES (weighted talents, two potions, Horde-or-Windshaper races, go deeper).
 *
 *   PRESET=shadow_priest FILE=tools/optimise/priestVariants80.ts VARIANTS=sp80Race WEIGHTED=1 npx vite-node tools/probe_build.ts
 *   PRESET=priest_holy  FILE=tools/optimise/priestVariants80.ts VARIANTS=holy80Tank DURATION=120 npx vite-node tools/probe_build.ts
 *   PRESET=priest_holy  FILE=tools/optimise/priestVariants80.ts VARIANTS=holy80Raid FIGHT=raid DURATION=60 npx vite-node tools/probe_build.ts
 *
 * Groups are prefixed `sp80`, `holy80`, `disc80`. Every group's first row is
 * `(p) => p`, "the shipped X": whatever is on the branch NOW.
 *
 * THE THEME, which may not move: Shadow -- 35 Shadow majority, caster,
 * Shadowform. Holy -- Holy majority with Prayer of Mending, caster staff.
 * Disc -- Discipline majority with Penance, caster staff. A Priest may be
 * Undead or Troll only (round 79).
 *
 * The write-up and every figure: docs/handoff/priest.md, round 80.
 * ==============================================================================
 */
import type { CharacterProfile } from '../../src/profiles';
import type { AplCondition, AplEntry } from '../../src/game/rotations/apl';
import type { RaceId } from '../../src/game/character/ids';
import type { TalentAllocation } from '../../src/game/talents/Talent';
import { racialsForRace } from '../../src/game/rotations/racialCooldowns';
import { syncDefaultRotation } from '../../src/profiles/rotation';
import {
  PRIEST_TREE as tree,
  addAbove,
  addEntry,
  addPrecombat,
  apl,
  chain,
  consumable,
  enchant,
  inMulti,
  moveAbove,
  removeEntry,
  type Apply,
  type Variant,
} from '../buildVariants';

/* ------------------------------------------------------------------ helpers */

/** A race swap that also re-lights the racial entries of the custom Multi Target list. */
export const race =
  (id: RaceId): Apply =>
  (p: CharacterProfile): CharacterProfile =>
    inMulti(apl((e) => [...racialsForRace({ entries: e }, id, 'priest').entries]))({
      ...p,
      character: { ...p.character, race: id },
    });

/** An edit to both sections: the tank healer fight runs Single Target, the raid fight Multi Target. */
export const both = (...applies: Apply[]): Apply => chain(chain(...applies), inMulti(...applies));

const raceGroup = (): Variant[] => [
  { label: 'the shipped race -- the control', apply: (p) => p },
  { label: 'race undead', apply: race('undead') },
  { label: 'race troll', apply: race('troll') },
];

/** Map one entry (by ability id) of the root list; throws unless exactly one matches. */
const mapEntry = (id: string, edit: (entry: AplEntry) => AplEntry): Apply =>
  apl((e) => {
    const hits = e.filter((x) => x.abilityId === id).length;
    if (hits !== 1) throw new Error(`mapEntry ${id}: ${hits} matches`);
    return e.map((x) => (x.abilityId === id ? edit(x) : x));
  });

const andCond = (entry: AplEntry, extra: AplCondition): AplEntry => ({
  ...entry,
  condition: entry.condition ? { kind: 'all', of: [entry.condition, extra] } : extra,
});

const manaBelow = (fraction: number): AplCondition => ({ kind: 'resourceFraction', resource: 'mana', compare: 'below', fraction });
const manaAtLeast = (fraction: number): AplCondition => ({ kind: 'resourceFraction', resource: 'mana', compare: 'atLeast', fraction });
const elapsed = (seconds: number): AplCondition => ({ kind: 'fightElapsed', compare: 'atLeast', seconds });
const remaining = (compare: 'atLeast' | 'atMost', seconds: number): AplCondition => ({ kind: 'fightRemaining', compare, seconds });
const tankBelow = (fraction: number): AplCondition => ({ kind: 'health', on: 'target', compare: 'below', fraction });

/* ------------------------------------------------------------------ shadow */

export const SHADOW_SHIPPED: TalentAllocation = {
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

/** Holy Nova (11 Holy) for Inner Focus, Mental Strength and Meditation. */
const SHADOW_HOLY_NOVA: TalentAllocation = {
  ...SHADOW_SHIPPED,
  mental_strength: 0,
  meditation: 0,
  inner_focus: 0,
  twilight_focus: 3,
  holy_specialization: 5,
  improved_renew: 2,
  holy_nova: 1,
};

const VARIANTS_SHADOW: Record<string, Variant[]> = {
  sp80Race: [
    ...raceGroup(),
    ...[10, 30].map((s) => ({
      label: `troll, Berserking after ${s}s (both lists)`,
      apply: (p: CharacterProfile) => chain(race('troll'), syncDefaultRotation, both(mapEntry('berserking', (x) => ({ ...x, condition: elapsed(s) }))))(p),
    })),
    {
      label: 'troll, Berserking with Shadow Weaving at 5 stacks',
      apply: (p: CharacterProfile) =>
        chain(race('troll'), syncDefaultRotation, both(mapEntry('berserking', (x) => ({ ...x, condition: { kind: 'auraStacks', on: 'target', auraId: 'shadow_weaving', compare: 'atLeast', stacks: 5 } }))))(p),
    },
  ],
  sp80Talents: [
    { label: 'the shipped tree -- the control', apply: (p) => p },
    { label: '14/2/35 written out', apply: tree(SHADOW_SHIPPED) },
    { label: 'shadow_reach 2 -> mental_agility 2 (16/2/33)', apply: tree({ ...SHADOW_SHIPPED, shadow_reach: 0, mental_agility: 2 }) },
    { label: 'twilight_focus 2 -> mental_agility 2 (16/0/35)', apply: tree({ ...SHADOW_SHIPPED, twilight_focus: 0, mental_agility: 2 }) },
    { label: 'reach+twilight -> mental_agility 3 + wand 1', apply: tree({ ...SHADOW_SHIPPED, twilight_focus: 0, shadow_reach: 0, mental_agility: 3, wand_specialization: 1 }) },
    { label: 'dark_inspiration 3 -> ... (reach 2 kept) mental_agility 3', apply: tree({ ...SHADOW_SHIPPED, dark_inspiration: 0, twilight_focus: 0, mental_agility: 3, power_in_light: 2 }) },
    { label: 'Holy Nova build 5/11/35, no Holy Nova entry', apply: tree(SHADOW_HOLY_NOVA) },
    ...[0, 0.2, 0.4, 0.6].map((f) => ({
      label: `Holy Nova build + HN above mind_flay in Multi, mana >= ${f * 100}%`,
      apply: chain(tree(SHADOW_HOLY_NOVA), inMulti(addAbove(f === 0 ? { abilityId: 'holy_nova' } : { abilityId: 'holy_nova', condition: manaAtLeast(f) }, 'mind_flay'))),
    })),
    {
      label: 'Holy Nova build + HN above mind_blast at 5+ targets, >=20% mana',
      apply: chain(
        tree(SHADOW_HOLY_NOVA),
        inMulti(addAbove({ abilityId: 'holy_nova', condition: { kind: 'all', of: [manaAtLeast(0.2), { kind: 'targetCount', compare: 'atLeast', count: 5 }] } }, 'mind_blast')),
        inMulti(addAbove({ abilityId: 'holy_nova', condition: manaAtLeast(0.2) }, 'mind_flay')),
      ),
    },
  ],
  sp80Ench: [
    { label: 'the shipped enchants -- the control', apply: (p) => p },
    { label: 'staff Revelation (was +65 Spell Power)', apply: enchant('twoHand', 900032) },
    { label: 'staff Enchant Weapon - Spell Power', apply: enchant('twoHand', 22749) },
    { label: 'head +8 Intellect (was +1% Haste)', apply: enchant('head', 900006) },
    { label: 'head and legs +8 Spirit', apply: chain(enchant('head', 900007), enchant('legs', 900007)) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'cloak +5 Agility (was -2% Threat)', apply: enchant('cloak', 900011) },
    { label: 'potion: secondary Major Mana (logic in the shared list)', apply: consumable('potion_secondary', 'secondary_major_mana_potion') },
    { label: 'blasted lands +25 Spirit', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'other Healthstone (was Demonic Rune)', apply: consumable('other', 'healthstone') },
  ],
  sp80Pass2: [
    { label: 'the shipped preset -- the control', apply: (p) => p },
    { label: 'race troll', apply: race('troll') },
    {
      label: 'HN build: HN at 8+ above MB, at 5-7 above MF over 20% mana',
      apply: chain(
        tree(SHADOW_HOLY_NOVA),
        inMulti(addAbove({ abilityId: 'holy_nova', condition: { kind: 'targetCount', compare: 'atLeast', count: 8 } }, 'mind_blast')),
        inMulti(addAbove({ abilityId: 'holy_nova', condition: { kind: 'all', of: [manaAtLeast(0.2), { kind: 'targetCount', compare: 'atLeast', count: 5 }] } }, 'mind_flay')),
      ),
    },
    {
      label: 'HN build: HN at 8+ above MB, at 4+ above MF over 20% mana',
      apply: chain(
        tree(SHADOW_HOLY_NOVA),
        inMulti(addAbove({ abilityId: 'holy_nova', condition: { kind: 'targetCount', compare: 'atLeast', count: 8 } }, 'mind_blast')),
        inMulti(addAbove({ abilityId: 'holy_nova', condition: { kind: 'all', of: [manaAtLeast(0.2), { kind: 'targetCount', compare: 'atLeast', count: 4 }] } }, 'mind_flay')),
      ),
    },
  ],
  sp80Pass3: [
    { label: 'the shipped preset -- the control', apply: (p) => p },
    { label: 'staff +65 Spell Power (was Revelation)', apply: enchant('twoHand', 900029) },
    { label: 'race undead', apply: race('undead') },
    { label: 'head +8 Intellect (was +1% Haste)', apply: enchant('head', 900006) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
    {
      label: 'HN build: HN at 8+ above MB, at 5+ above MF over 20% mana',
      apply: chain(
        tree(SHADOW_HOLY_NOVA),
        inMulti(addAbove({ abilityId: 'holy_nova', condition: { kind: 'targetCount', compare: 'atLeast', count: 8 } }, 'mind_blast')),
        inMulti(addAbove({ abilityId: 'holy_nova', condition: { kind: 'all', of: [manaAtLeast(0.2), { kind: 'targetCount', compare: 'atLeast', count: 5 }] } }, 'mind_flay')),
      ),
    },
    {
      label: 'HN build: HN at 5+ above MB, ungated',
      apply: chain(tree(SHADOW_HOLY_NOVA), inMulti(addAbove({ abilityId: 'holy_nova', condition: { kind: 'targetCount', compare: 'atLeast', count: 5 } }, 'mind_blast'))),
    },
    {
      label: 'HN build: HN at 3+ above MF over 50% mana, 8+ above MB',
      apply: chain(
        tree(SHADOW_HOLY_NOVA),
        inMulti(addAbove({ abilityId: 'holy_nova', condition: { kind: 'targetCount', compare: 'atLeast', count: 8 } }, 'mind_blast')),
        inMulti(addAbove({ abilityId: 'holy_nova', condition: manaAtLeast(0.5) }, 'mind_flay')),
      ),
    },
  ],
  sp80Dots: [
    { label: 'the shipped Multi Target list -- the control', apply: (p) => p },
    ...[3, 4, 6].map((n) => ({ label: `SWP spread to ${n} targets`, apply: inMulti(apl((e) => e.map((x) => (x.abilityId === 'shadow_word_pain' ? { ...x, multiDot: n } : x)))) })),
  ],
  sp80Multi: [
    { label: 'the shipped Multi Target list -- the control', apply: (p) => p },
    { label: 'SWP spread interrupts Mind Flay', apply: inMulti(mapEntry('shadow_word_pain', (x) => ({ ...x, interruptsChannel: true }))) },
    {
      label: 'SWP spread interrupts Mind Flay at 3 targets or fewer',
      apply: inMulti(
        apl((e) => {
          const at = e.findIndex((x) => x.abilityId === 'shadow_word_pain');
          const swp = e[at]!;
          const few: AplEntry = andCond({ ...swp, interruptsChannel: true }, { kind: 'targetCount', compare: 'atMost', count: 3 });
          e.splice(at, 0, few);
          return e;
        }),
      ),
    },
    { label: 'mind_blast below shadow_word_death', apply: inMulti(moveAbove('shadow_word_death', 'mind_blast')) },
    { label: 'devouring_plague above SWP spread', apply: inMulti(moveAbove('devouring_plague', 'shadow_word_pain')) },
    { label: 'no shadow_word_death', apply: inMulti(removeEntry('shadow_word_death')) },
    { label: 'Inner Focus -> Mind Blast instead of Mind Flay (owner line)', apply: inMulti(mapEntry('inner_focus', (x) => ({ ...x, sequence: ['mind_blast'] }))) },
    { label: 'SWP spread only while 9s+ left', apply: inMulti(mapEntry('shadow_word_pain', (x) => ({ ...x, condition: { kind: 'all', of: [{ kind: 'aura', on: 'target', auraId: 'shadow_word_pain', present: false }, remaining('atLeast', 9)] } }))) },
    { label: 'SWP spread only while 4s+ left', apply: inMulti(mapEntry('shadow_word_pain', (x) => ({ ...x, condition: { kind: 'all', of: [{ kind: 'aura', on: 'target', auraId: 'shadow_word_pain', present: false }, remaining('atLeast', 4)] } }))) },
  ],
  sp80St: [
    { label: 'the shipped list -- the control', apply: (p) => p },
    { label: 'mind_blast interrupts Mind Flay (after 2 ticks)', apply: mapEntry('mind_blast', (x) => ({ ...x, interruptsChannel: true })) },
    { label: 'shadow_word_death interrupts Mind Flay', apply: mapEntry('shadow_word_death', (x) => ({ ...x, interruptsChannel: true })) },
    { label: 'both interrupt Mind Flay', apply: chain(mapEntry('mind_blast', (x) => ({ ...x, interruptsChannel: true })), mapEntry('shadow_word_death', (x) => ({ ...x, interruptsChannel: true }))) },
    { label: 'swp + dp interrupt Mind Flay', apply: chain(mapEntry('shadow_word_pain', (x) => ({ ...x, interruptsChannel: true })), mapEntry('devouring_plague', (x) => ({ ...x, interruptsChannel: true }))) },
    { label: 'shadow_word_death above mind_blast', apply: moveAbove('shadow_word_death', 'mind_blast') },
    { label: 'mind_blast above devouring_plague', apply: moveAbove('mind_blast', 'devouring_plague') },
    { label: 'SWD hold band 35%-20% (owner removed it)', apply: mapEntry('shadow_word_death', (x) => andCond(x, { kind: 'any', of: [{ kind: 'fightRemaining', compare: 'above', fraction: 0.35 }, { kind: 'fightRemaining', compare: 'atMost', fraction: 0.2 }] })) },
    { label: 'SWD only with 20% health or more (backlash)', apply: mapEntry('shadow_word_death', (x) => andCond(x, { kind: 'health', on: 'self', compare: 'atLeast', fraction: 0.2 })) },
    { label: '+ vampiric_embrace above mind_flay', apply: addAbove({ abilityId: 'vampiric_embrace', condition: { kind: 'aura', on: 'target', auraId: 'vampiric_embrace', present: false } }, 'mind_flay') },
    ...[0, 3, 6, 10].map((s) => ({ label: `+ spellblasting pre-pull at ${s}s`, apply: addPrecombat(s, 'major_spellblasting_potion') })),
    { label: '+ inner_focus pre-pull at 0s', apply: addPrecombat(0, 'inner_focus') },
  ],
};

/* ------------------------------------------------------------------ healers */

export const HOLY_SHIPPED: TalentAllocation = {
  twin_disciplines: 5,
  mental_strength: 5,
  improved_power_word_shield: 3,
  meditation: 3,
  soul_warding: 1,
  inner_focus: 1,
  twilight_focus: 3,
  improved_renew: 3,
  holy_specialization: 5,
  divine_fury: 5,
  inspiration: 3,
  improved_healing: 3,
  binding_heal: 1,
  spirit_of_redemption: 1,
  spiritual_guidance: 5,
  spiritual_healing: 3,
  prayer_of_mending: 1,
};

export const DISC_SHIPPED: TalentAllocation = {
  twin_disciplines: 5,
  silent_resolve: 2,
  mental_strength: 5,
  inner_focus: 1,
  improved_power_word_shield: 3,
  meditation: 3,
  soul_warding: 1,
  penance: 1,
  renewed_hope: 5,
  divine_aegis: 3,
  twilight_focus: 2,
  improved_renew: 3,
  holy_specialization: 5,
  divine_fury: 5,
  holy_nova: 1,
  inspiration: 3,
  improved_healing: 3,
};

const TANK = { kind: 'tank' } as const;
const lowestRaid = (withoutAura?: string) =>
  ({ kind: 'lowestHealth', excludeTank: true, ...(withoutAura ? { withoutAura } : {}) }) as const;

/** Greater Heal on the tank under `f`, cancelled if the tank is topped up at 80% of the cast. */
const ghOnTank = (f: number, cancelAbove?: number): AplEntry => ({
  abilityId: 'greater_heal',
  target: TANK,
  condition: tankBelow(f),
  ...(cancelAbove === undefined
    ? {}
    : { cancel: { atFraction: 0.8, condition: { kind: 'health', on: 'target', compare: 'above', fraction: cancelAbove } } }),
});
const ifInto = (spell: string, condition?: AplCondition): AplEntry => ({
  abilityId: 'inner_focus',
  target: TANK,
  sequence: [spell],
  ...(condition ? { condition } : {}),
});
/** The mid-fight Major Mana Potion entry, re-gated. */
const manaPotionAt = (condition: AplCondition): Apply =>
  mapEntry('major_mana_potion', (x) => ({ ...x, condition }));
const smart: Apply = (p) => ({ ...p, rotation: { ...p.rotation, smartHealing: true } });

/** Rewrite the owner's tank-fight Flash Heal gate (an owner line: priced, not shipped). */
const flashHealBelow = (f: number): Apply =>
  apl((e) =>
    e.map((x) =>
      x.abilityId === 'flash_heal'
        ? { ...x, condition: { kind: 'all', of: [{ kind: 'raidSize', compare: 'below', count: 6 }, tankBelow(f)] } }
        : x,
    ),
  );
const flashHealCancel = (above: number): Apply =>
  apl((e) =>
    e.map((x) =>
      x.abilityId === 'flash_heal'
        ? { ...x, cancel: { atFraction: 0.8, condition: { kind: 'health', on: 'target', compare: 'above', fraction: above } } }
        : x,
    ),
  );

/** The tank-fight (Single Target) group, shared by both healers. */
const tankGroup = (disc: boolean): Variant[] => [
  { label: 'the shipped list -- the control', apply: (p) => p },
  ...[0.5, 0.7, 0.9, 1].map((f) => ({ label: `+ Greater Heal on the tank under ${f * 100}%, above Flash Heal`, apply: addAbove(ghOnTank(f), 'flash_heal') })),
  ...[0.5, 0.7].map((f) => ({
    label: `+ Greater Heal under ${f * 100}%, cancelled over 95%`,
    apply: addAbove(ghOnTank(f, 0.95), 'flash_heal'),
  })),
  ...(disc
    ? [
        { label: 'Inner Focus -> Greater Heal instead of Penance (owner line)', apply: mapEntry('inner_focus', (x) => ({ ...x, sequence: ['greater_heal'] })) },
      ]
    : [
        { label: '+ Inner Focus -> Greater Heal on the tank, under 70%', apply: addAbove(ifInto('greater_heal', tankBelow(0.7)), 'flash_heal') },
        { label: '+ Inner Focus -> Flash Heal on the tank, under 90%', apply: addAbove(ifInto('flash_heal', tankBelow(0.9)), 'flash_heal') },
        { label: '+ Inner Focus -> Prayer of Mending (top)', apply: addAbove(ifInto('prayer_of_mending'), 'renew') },
        { label: 'Prayer of Mending (ours) above Flash Heal', apply: moveAbove('prayer_of_mending', 'flash_heal') },
      ]),
  { label: '+ Inner Focus pre-pull at 0s', apply: addPrecombat(0, 'inner_focus') },
  ...[0.9, 0.8, 0.7, 0.6].map((f) => ({ label: `Flash Heal only under ${f * 100}% (owner line)`, apply: flashHealBelow(f) })),
  ...[0.95, 0.9].map((f) => ({ label: `Flash Heal cancelled over ${f * 100}% at 80% (owner line)`, apply: flashHealCancel(f) })),
  ...[0.5, 0.7, 0.8].map((f) => ({ label: `mana potion under ${f * 100}%`, apply: manaPotionAt(manaBelow(f)) })),
  { label: 'mana potion under 50% after 60s', apply: manaPotionAt({ kind: 'all', of: [manaBelow(0.5), elapsed(60)] }) },
];

/** The raid-fight (Multi Target) group. */
const raidGroup = (disc: boolean): Variant[] => [
  { label: 'the shipped list -- the control', apply: (p) => p },
  { label: 'smart healing on', apply: inMulti(smart) },
  { label: '+ Renew on the lowest non-tank without it, under 90%, above PoH', apply: inMulti(addAbove({ abilityId: 'renew', target: lowestRaid('renew'), condition: tankBelow(0.9) }, 'prayer_of_healing')) },
  { label: '+ Flash Heal on the lowest non-tank under 50%, above PoH', apply: inMulti(addAbove({ abilityId: 'flash_heal', target: lowestRaid(), condition: tankBelow(0.5) }, 'prayer_of_healing')) },
  { label: '+ Greater Heal on the tank under 50%, above PoH', apply: inMulti(addAbove(ghOnTank(0.5), 'prayer_of_healing')) },
  { label: '+ Flash Heal on the tank under 50%, above PoH', apply: inMulti(addAbove({ abilityId: 'flash_heal', target: TANK, condition: tankBelow(0.5) }, 'prayer_of_healing')) },
  ...(disc
    ? [
        { label: 'Inner Focus -> Prayer of Healing instead of Penance (owner line)', apply: inMulti(mapEntry('inner_focus', (x) => ({ ...x, target: { kind: 'lowestParty' }, sequence: ['prayer_of_healing'] }))) },
        { label: 'no Penance line (owner line)', apply: inMulti(removeEntry('penance')) },
        { label: 'no Power Word: Shield line (owner line)', apply: inMulti(removeEntry('power_word_shield')) },
      ]
    : [
        { label: 'owner order: Renew, Shield, PoM, then PoH (PoM third)', apply: inMulti(moveAbove('power_word_shield', 'prayer_of_mending'), moveAbove('renew', 'power_word_shield')) },
        { label: 'no Power Word: Shield line (owner line)', apply: inMulti(removeEntry('power_word_shield')) },
        { label: 'no Renew line (owner line)', apply: inMulti(removeEntry('renew')) },
        { label: 'Inner Focus -> PoH only with the lowest party under 60%', apply: inMulti(mapEntry('inner_focus', (x) => ({ ...x, condition: { kind: 'friendlyHealth', of: 'lowestParty', compare: 'below', fraction: 0.6 } }))) },
      ]),
  { label: 'PoH only with the lowest party under 90%', apply: inMulti(mapEntry('prayer_of_healing', (x) => ({ ...x, condition: { kind: 'friendlyHealth', of: 'lowestParty', compare: 'below', fraction: 0.9 } }))) },
  ...[0.5, 0.7].map((f) => ({ label: `mana potion under ${f * 100}%`, apply: inMulti(manaPotionAt(manaBelow(f))) })),
];

const berserkingWhen = (condition: AplCondition): Apply => mapEntry('berserking', (x) => ({ ...x, condition }));
const trollGroup = (): Variant[] => [
  { label: 'the shipped race -- the control', apply: (p) => p },
  { label: 'race undead', apply: race('undead') },
  { label: 'race troll', apply: race('troll') },
  {
    label: 'troll, raid Berserking with the lowest party under 70%',
    apply: chain(race('troll'), inMulti(berserkingWhen({ kind: 'friendlyHealth', of: 'lowestParty', compare: 'below', fraction: 0.7 }))),
  },
  { label: 'troll, raid Berserking after 5s', apply: chain(race('troll'), inMulti(berserkingWhen(elapsed(5)))) },
  ...[3, 8].map((s) => ({ label: `troll, raid Berserking after ${s}s`, apply: chain(race('troll'), inMulti(berserkingWhen(elapsed(s)))) })),
  {
    label: 'troll, raid after 5s, tank Berserking switched off',
    apply: chain(race('troll'), syncDefaultRotation, inMulti(berserkingWhen(elapsed(5))), mapEntry('berserking', (x) => ({ ...x, disabled: true }))),
  },
  {
    label: 'troll, raid after 5s, tank Berserking under 30% tank',
    apply: chain(race('troll'), syncDefaultRotation, inMulti(berserkingWhen(elapsed(5))), berserkingWhen({ kind: 'friendlyHealth', of: 'tank', compare: 'below', fraction: 0.3 })),
  },
  {
    label: 'troll, raid after 5s, tank Berserking in the last 15s',
    apply: chain(race('troll'), syncDefaultRotation, inMulti(berserkingWhen(elapsed(5))), berserkingWhen(remaining('atMost', 15))),
  },
  {
    label: 'troll, raid after 5s, tank Berserking under 60% tank',
    apply: chain(race('troll'), syncDefaultRotation, inMulti(berserkingWhen(elapsed(5))), berserkingWhen({ kind: 'friendlyHealth', of: 'tank', compare: 'below', fraction: 0.6 })),
  },
];

const IF_PREPULL = addPrecombat(0, 'inner_focus');
const GH_ANY = addAbove(ghOnTank(1), 'flash_heal');
const ghRaid = (f: number): Apply => inMulti(addAbove(ghOnTank(f), 'prayer_of_healing'));

const VARIANTS_HEALER_TALENTS: Record<string, Variant[]> = {
  holy80Talents: [
    { label: 'the shipped tree -- the control', apply: (p) => p },
    { label: '18/33 written out', apply: tree(HOLY_SHIPPED) },
    { label: 'improved_pws 3 -> mental_agility 3', apply: tree({ ...HOLY_SHIPPED, improved_power_word_shield: 0, mental_agility: 3 }) },
    { label: 'meditation 3 -> mental_agility 3', apply: tree({ ...HOLY_SHIPPED, meditation: 0, mental_agility: 3 }) },
    { label: 'divine_fury 5 -> spell_warding 5 (GH slower)', apply: tree({ ...HOLY_SHIPPED, divine_fury: 0, spell_warding: 5 }) },
    { label: 'twin_disciplines 5 -> holy_precision 3 + silent_resolve 2', apply: tree({ ...HOLY_SHIPPED, twin_disciplines: 0, holy_precision: 3, silent_resolve: 2 }) },
  ],
  disc80Talents: [
    { label: 'the shipped tree -- the control', apply: (p) => p },
    { label: '29/22 written out', apply: tree(DISC_SHIPPED) },
    { label: 'divine_aegis 3 -> spiritual_guidance 3 (26/25)', apply: tree({ ...DISC_SHIPPED, divine_aegis: 0, spiritual_guidance: 3 }) },
    {
      label: 'twin_disciplines 5 -> holy_precision 3, spiritual_guidance 2 (27/24)',
      apply: tree({ ...DISC_SHIPPED, twin_disciplines: 0, holy_precision: 3, spiritual_guidance: 2 }),
    },
    { label: 'divine_fury 5 -> spell_warding 5', apply: tree({ ...DISC_SHIPPED, divine_fury: 0, spell_warding: 5 }) },
    { label: 'silent_resolve 2 -> mental_agility 2', apply: tree({ ...DISC_SHIPPED, silent_resolve: 0, mental_agility: 2 }) },
    { label: 'meditation 3 -> silent_resolve 3 (no regen while casting)', apply: tree({ ...DISC_SHIPPED, meditation: 0, silent_resolve: 3, mental_agility: 2 }) },
  ],
};

const healEnch = (): Variant[] => [
  { label: 'the shipped enchants -- the control', apply: (p) => p },
  { label: 'staff Revelation (was +65 Spell Power)', apply: enchant('twoHand', 900032) },
  { label: 'head and legs +8 Spirit (was Intellect)', apply: chain(enchant('head', 900007), enchant('legs', 900007)) },
  { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
  { label: 'neck +6 Spell Power (was +11 Healing)', apply: enchant('neck', 900009) },
  { label: 'blasted lands +25 Spirit (was Intellect)', apply: consumable('blasted_lands', 'blasted_spirit') },
  { label: 'other Healthstone (was Demonic Rune)', apply: consumable('other', 'healthstone') },
  { label: 'spellblasting secondary (never drunk first)', apply: consumable('potion_secondary', 'secondary_major_spellblasting_potion') },
];

/** Move the TANK-fight Prayer of Mending (the last entry, ours since round 78) above `beforeId`. */
const tankPomAbove = (beforeId: string): Apply =>
  apl((e) => {
    const at = e.length - 1;
    if (e[at]!.abilityId !== 'prayer_of_mending') throw new Error('last entry is not Prayer of Mending');
    const [pom] = e.splice(at, 1);
    e.splice(e.findIndex((x) => x.abilityId === beforeId), 0, pom!);
    return e;
  });

const healPass2 = (disc: boolean): Variant[] => [
  { label: 'the shipped preset -- the control', apply: (p) => p },
  { label: 'race undead', apply: race('undead') },
  { label: 'mana potion under 50%, both lists', apply: both(manaPotionAt(manaBelow(0.5))) },
  { label: 'mana potion under 70%, both lists', apply: both(manaPotionAt(manaBelow(0.7))) },
  { label: 'mana potion under 50% after 60s, both lists', apply: both(manaPotionAt({ kind: 'all', of: [manaBelow(0.5), elapsed(60)] })) },
  { label: 'blasted lands +25 Spirit', apply: consumable('blasted_lands', 'blasted_spirit') },
  {
    label: disc ? 'raid GH threshold 70% (was 60%)' : 'raid GH threshold 60% (was 70%)',
    apply: inMulti(mapEntry('greater_heal', (x) => ({ ...x, condition: tankBelow(disc ? 0.7 : 0.6) }))),
  },
];

/** The "Needs the owner" prices, against the finished round 80 presets. */
const ownerGroup = (disc: boolean): Variant[] => [
  { label: 'the shipped preset -- the control', apply: (p) => p },
  ...[0.85, 0.8, 0.75].map((f) => ({ label: `tank: Flash Heal only under ${f * 100}%`, apply: flashHealBelow(f) })),
  { label: 'tank: Greater Heal under 100% above Flash Heal (silences it)', apply: GH_ANY },
  { label: 'tank: FH under 80% + GH under 100%', apply: chain(flashHealBelow(0.8), GH_ANY) },
  { label: 'raid: no Power Word: Shield line', apply: inMulti(removeEntry('power_word_shield')) },
  ...(disc
    ? [{ label: 'raid: Inner Focus -> PoH instead of Penance', apply: inMulti(mapEntry('inner_focus', (x) => ({ ...x, target: { kind: 'lowestParty' }, sequence: ['prayer_of_healing'] }))) }]
    : [
        { label: 'raid: owner order (PoM third)', apply: inMulti(moveAbove('power_word_shield', 'prayer_of_mending'), moveAbove('renew', 'power_word_shield')) },
        { label: 'raid: no Renew line', apply: inMulti(removeEntry('renew')) },
      ]),
];

const VARIANTS_HEALERS: Record<string, Variant[]> = {
  holy80Owner: ownerGroup(false),
  disc80Owner: ownerGroup(true),
  holy80Pass2: healPass2(false),
  disc80Pass2: healPass2(true),
  holy80Pom: [
    { label: 'the shipped list -- the control', apply: (p) => p },
    { label: 'tank PoM above Flash Heal', apply: tankPomAbove('flash_heal') },
    { label: 'tank PoM above Renew (first)', apply: tankPomAbove('renew') },
    { label: 'tank PoM above the shield', apply: tankPomAbove('power_word_shield') },
  ],
  holy80Ench: healEnch(),
  disc80Ench: healEnch(),
  ...VARIANTS_HEALER_TALENTS,
  holy80Combo: [
    { label: 'the shipped preset -- the control', apply: (p) => p },
    { label: 'IF pre-pull', apply: IF_PREPULL },
    { label: 'IF pre-pull + GH under 100% above FH', apply: chain(IF_PREPULL, GH_ANY) },
    { label: 'IF -> PoM top + GH under 100%', apply: chain(addAbove(ifInto('prayer_of_mending'), 'renew'), GH_ANY) },
    { label: 'IF pre-pull, raid section opener empty', apply: chain(IF_PREPULL, inMulti((p) => ({ ...p, precombat: [] }))) },
    { label: 'IF pre-pull + FH under 80% (owner line)', apply: chain(IF_PREPULL, flashHealBelow(0.8)) },
    { label: 'IF pre-pull + FH under 80% + GH under 100% (owner line)', apply: chain(IF_PREPULL, flashHealBelow(0.8), GH_ANY) },
    { label: 'IF pre-pull + FH under 80% + GH under 70% (owner line)', apply: chain(IF_PREPULL, flashHealBelow(0.8), addAbove(ghOnTank(0.7), 'flash_heal')) },
    { label: 'IF pre-pull + FH under 85% (owner line)', apply: chain(IF_PREPULL, flashHealBelow(0.85)) },
    { label: 'IF pre-pull + FH under 75% (owner line)', apply: chain(IF_PREPULL, flashHealBelow(0.75)) },
  ],
  disc80Combo: [
    { label: 'the shipped preset -- the control', apply: (p) => p },
    { label: 'FH under 80% (owner line)', apply: flashHealBelow(0.8) },
    { label: 'FH under 75% (owner line)', apply: flashHealBelow(0.75) },
    { label: 'FH under 85% (owner line)', apply: flashHealBelow(0.85) },
    { label: 'FH under 80% + GH under 100% (owner line)', apply: chain(flashHealBelow(0.8), GH_ANY) },
    { label: 'FH under 80% + GH under 60% (owner line)', apply: chain(flashHealBelow(0.8), addAbove(ghOnTank(0.6), 'flash_heal')) },
  ],
  heal80RaidGh: [
    { label: 'the shipped list -- the control', apply: (p) => p },
    ...[0.3, 0.4, 0.5, 0.6, 0.7].map((f) => ({ label: `+ GH on the tank under ${f * 100}% above PoH`, apply: ghRaid(f) })),
    { label: '+ GH on the tank under 50% above Shield', apply: inMulti(addAbove(ghOnTank(0.5), 'power_word_shield')) },
    { label: '+ GH under 50%, cancelled over 90%', apply: inMulti(addAbove(ghOnTank(0.5, 0.9), 'prayer_of_healing')) },
  ],
  heal80RaidGh2: [
    { label: 'the shipped list -- the control', apply: (p) => p },
    ...[0.6, 0.7, 0.8, 0.9].map((f) => ({ label: `+ GH on the tank under ${f * 100}% above PoH`, apply: ghRaid(f) })),
    ...[0.6, 0.7].map((f) => ({ label: `+ GH under ${f * 100}% above PoH, cancelled over 95%`, apply: inMulti(addAbove(ghOnTank(f, 0.95), 'prayer_of_healing')) })),
    ...[0.6, 0.7].map((f) => ({ label: `+ GH under ${f * 100}% above Shield`, apply: inMulti(addAbove(ghOnTank(f), 'power_word_shield')) })),
    { label: '+ FH on the tank under 70% above PoH', apply: inMulti(addAbove({ abilityId: 'flash_heal', target: TANK, condition: tankBelow(0.7) }, 'prayer_of_healing')) },
  ],
  heal80Troll: trollGroup(),
  holy80Race: raceGroup(),
  disc80Race: raceGroup(),
  holy80Tank: tankGroup(false),
  disc80Tank: tankGroup(true),
  holy80Raid: raidGroup(false),
  disc80Raid: raidGroup(true),
};

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  ...VARIANTS_SHADOW,
  ...VARIANTS_HEALERS,
};

void [addAbove, addEntry, addPrecombat, consumable, enchant, moveAbove, removeEntry, mapEntry, andCond, manaBelow, manaAtLeast, elapsed, remaining, tankBelow];
