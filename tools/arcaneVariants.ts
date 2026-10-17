/*
 * ==============================================================================
 * THE ARCANE MAGE, OPTIMISED DIMENSION BY DIMENSION.
 *
 *   PRESET=mage_arcane VARIANTS=arcApl npx vite-node tools/probe_build.ts
 *
 * ------------------------------------------------------------------------------
 * WHERE ITS DAMAGE IS, off a 30-fight `USES=1` run at **1090.3 DPS** on the
 * current legal build:
 *
 *   arcane_missiles  75.6%  on 13.5 casts   (the entry appears TWICE, pooled)
 *   arcane_blast     16.7%  on 14.0 casts
 *   pyroblast         7.7%  on  2.0 casts
 *   Ignite            0.1%  not in the list
 *
 * **THE GROUPS IN THIS FILE SPLIT INTO TWO ERAS AND THE OLDER ONE IS VOID.**
 * `arcPrecombat`, `arcStackGate`'s first run, `arcCombined`, `arcPackage`,
 * `arcShipping`, `arcIterate` and `arcLegal` were all measured against an opener
 * that finished FOUR damaging casts before the pull -- about 1,200 to 1,400
 * damage dealt before the clock started -- which the owner has ruled starts
 * combat. **`arcLegal` is the worst-named group here**: it was named for the
 * OVERLAP constraint and every one of its rows breaks the binding one.
 *
 * THE LIVE GROUPS, all measured on the legal opener: `arcGate` (the opener's
 * whole remaining design space), `arcChannel` (the +13.2 that shipped),
 * `arcPass2` (its knock-on), `arcWeapon`, `arcMaintain`, and re-runs of
 * `arcApl`, `arcTalents`, `arcaneWrath` and `arcConsumables` -- **every one of
 * which still loses on the legal build**, which is most of what this round
 * found. A prior measurement is true of the build it was taken in; these were
 * re-taken rather than carried over.
 *
 * SO IT IS 95% ARCANE AND 4.8% FIRE, AND ELEVEN OF ITS FIFTY-ONE POINTS ARE IN
 * FIRE. That ratio is the whole question this file exists to answer.
 *
 * AND THE ARCANE TREE HAS NOTHING LEFT TO BUY, which is what makes the question
 * unavoidable rather than academic. Every Arcane talent that touches damage is
 * already at its maximum -- arcane_focus 5/5, arcane_impact 3/3, arcane_mind
 * 5/5, arcane_instability 3/3, arcane_blast 1/1, presence_of_mind 1/1,
 * arcane_power 1/1 -- and **missile_barrage has TWO ranks, not three**, so the
 * obvious upgrade does not exist. What is left in that tree is a wand, a range
 * increase, armour from Intellect, mana regeneration this build never needs,
 * and `improved_channeling`, which is pure cast pushback and therefore a
 * declared `OutOfScope` member. **The spare points have nowhere good to go
 * inside Arcane, so the only live question is what they buy OUTSIDE it.**
 * ==============================================================================
 */
import {
  type Apply,
  type Variant,
  MAGE_TREE as tree,
  addAbove,
  addEntry,
  addPrecombat,
  apl,
  chain,
  consumable,
  enchant,
  precombatLead,
  removeEntry,
  removePrecombat,
} from './buildVariants';
import { all, selfHas, selfStacks, selfTime } from '../src/game/rotations/apl/shorthand';
import { ARCANE_WITH_WRATH } from './mageVariants';
import type { AplEntry } from '../src/game/rotations/apl';
import { ARCANE_BLAST_MAX_STACKS } from '../src/game/auras/mage';

/* --------------------------------------------------------------- the trees */

/** The shipped spread, written out as the control: 35 Arcane / 11 Fire / 5 Frost. */
const CURRENT = {
  arcane_focus: 5,
  improved_channeling: 4,
  missile_barrage: 2,
  arcane_subtlety: 2,
  arcane_concentration: 5,
  arcane_impact: 3,
  arcane_blast: 1,
  arcane_meditation: 3,
  presence_of_mind: 1,
  arcane_mind: 5,
  arcane_instability: 3,
  arcane_power: 1,
  improved_fire_blast: 2,
  incineration: 3,
  ignite: 5,
  pyroblast: 1,
  elemental_precision: 5,
};

/**
 * FIRE HIT DROPPED. `elemental_precision` is "Frost and Fire spells by 5%" and
 * this build casts no Frost at all -- so five points reach **4.8% of the
 * damage**, taking Pyroblast and Ignite from the 16-point cap to 11 and their
 * miss chance from 1% to 6%.
 *
 * The five go to `improved_channeling` 4 -> 5 and `arcane_geometry` 2, both
 * provably inert, so this isolates the hit and nothing else.
 */
const NO_FIRE_HIT = {
  ...CURRENT,
  elemental_precision: 0,
  improved_channeling: 5,
  arcane_geometry: 2,
  wand_specialization: 2,
};

/**
 * THE WHOLE FIRE INVESTMENT OUT, which is the question the damage table asks:
 * eleven points for 4.8%.
 *
 * `incineration` is the one Fire talent that pays an ARCANE bill -- "+6% crit
 * to your Fire Blast, Ice Lance, **Arcane Blast** and Scorch" -- so it is kept
 * and measured separately below. What goes is Pyroblast, its Ignite, and the
 * two points of `improved_fire_blast` that are only there to open Ignite's tier.
 */
const NO_FIRE_AT_ALL = {
  arcane_focus: 5,
  improved_channeling: 5,
  missile_barrage: 2,
  arcane_subtlety: 2,
  arcane_concentration: 5,
  arcane_impact: 3,
  arcane_blast: 1,
  arcane_meditation: 3,
  presence_of_mind: 1,
  arcane_mind: 5,
  arcane_instability: 3,
  arcane_power: 1,
  // the dump, all of it provably inert on this build
  arcane_geometry: 2,
  wand_specialization: 2,
  arcane_resilience: 2,
  magic_absorption: 2,
  improved_counterspell: 2,
  arcane_shielding: 2,
  // and the one Fire talent that reaches Arcane Blast
  incineration: 3,
};

/*
 * AND `elemental_precision` GOES WITH THE FIRE, which is the knock-on the owner
 * names: its five points are Frost AND Fire hit, so a build with no Fire spell
 * left has nothing for them to reach at all. Dropping Pyroblast turns a talent
 * worth 0.3% into one worth exactly nothing -- **one decision changing what a
 * second decision is worth**, and the reason the two cannot be priced apart.
 *
 * ARCANE CANNOT ABSORB 51 POINTS. Its nineteen talents hold **49** between them
 * (and that counts Arcane Wrath, which is measured at -77 to -119 wherever it is
 * cast), so a spread with no Fire investment has to put something in Frost
 * whatever it would prefer. That is a fact about the tree and not a choice.
 */

/** Incineration out as well, to price its +6% crit on Arcane Blast alone. */
const NO_INCINERATION = {
  ...NO_FIRE_AT_ALL,
  incineration: 0,
  elemental_precision: 3,
};

/**
 * HEATING UP, WHICH NEEDS FOUR DEAD POINTS TO REACH AND A FIRE BLAST TO FEED.
 *
 * Fire row 3 wants 15 points above it and rows 0-2 hold 11, so the talent costs
 * **five points: four of tier tax and one for itself.**
 *
 * AND ONLY FOUR OF THE FIVE CAN COME OUT OF ARCANE, which the harness is what
 * said rather than a reading of the tree: the first attempt took four from
 * `improved_channeling` and one from `arcane_subtlety` and `treeFor` REFUSED it
 * -- "wanted 51 legal 50 dropped [arcane_power]" -- because that leaves 29
 * points above Arcane's row 6 against a gate of 30. So the fifth comes out of
 * `elemental_precision`, which the row below prices at noise. **A dead point is
 * not always a movable one**, and the tier arithmetic is the cheapest place to
 * find that out.
 */
const HEATING_UP = {
  ...CURRENT,
  improved_channeling: 0,
  // Fire 11 -> 16, and the fifth point comes out of FROST rather than Arcane
  improved_fireball: 4,
  heating_up: 1,
  elemental_precision: 4,
};

/* ------------------------------------------------------------------ the APL */

const atCap = selfStacks('atLeast', ARCANE_BLAST_MAX_STACKS, 'arcane_blast');

/**
 * THE WINNING OPENER, named once so the second iteration can be written as
 * `WINNER + the change` rather than as five copies of a six-call chain.
 *
 * Four Arcane Blasts and a Pyroblast before the pull, each at its own cast
 * time, the sequence complete AT zero -- worth **+105.3 +/- 11.2** together
 * against +74.7 and +41.5 apart.
 */
const WINNER = chain(
  precombatLead('mage_armor', 13.5),
  addPrecombat(12, 'arcane_blast'),
  addPrecombat(10.5, 'arcane_blast'),
  addPrecombat(9, 'arcane_blast'),
  addPrecombat(6, 'pyroblast'),
);

/** The second Arcane Missiles entry's stack gate, as a function of the count. */
const stackGate = (n: number) =>
  apl((entries) =>
    entries.map((e, i) =>
      e.abilityId === 'arcane_missiles' && i > 0 && entries[i - 1]?.abilityId === 'arcane_missiles'
        ? { ...e, condition: selfStacks('atLeast', n, 'arcane_blast') }
        : e,
    ),
  );

/**
 * REPLACE THE WHOLE OPENER, rather than adding to the shipped one.
 *
 * `addPrecombat` appends, so stacking three blasts onto a list that already
 * holds one at a 1.5s lead is how the ILLEGAL overlap above was built without
 * anybody meaning to. Writing the sequence out in full is what makes the leads
 * checkable against each action's cast time.
 */
const openerOf =
  (actions: readonly [string, number][]): Apply =>
  (profile) => ({
    ...profile,
    precombat: actions.map(([abilityId, secondsBefore]) => ({ abilityId, secondsBefore })),
  });

/** A Fire Blast entry, which the shipped list does not have at all. */
const fireBlast = { abilityId: 'fire_blast' };

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  /*
   * ==========================================================================
   * THE OPENER UNDER GATE B, WHICH IS A DESIGN SPACE OF ABOUT FOUR ROWS.
   *
   * **THE RULING: "Once you deal damage or finish casting a damaging ability
   * combat has started."** So a pre-combat list may finish AT MOST ONE damaging
   * ability and it must finish at exactly t=0. Everything the earlier rounds
   * measured here -- `arcPrecombat`, `arcStackGate`, `arcCombined`, `arcPackage`
   * and `arcLegal` -- holds four or five damaging casts and is void; `arcLegal`
   * is the worst-named group in this file, because it was named for the OVERLAP
   * constraint and every one of its rows breaks the binding one.
   *
   * WHAT IS LEFT. One damaging cast, so it is Arcane Blast OR Pyroblast and not
   * both. A CHANNEL IS REFUSED outright by `runPrecombat`, so Arcane Missiles
   * and Evocation cannot go here at all. Everything else that may be added is a
   * non-damaging instant at any lead, and this build owns exactly four of those:
   * Arcane Power, Presence of Mind, Eureka and the Spellblasting potion.
   *
   * THE CONTROL IS THE SHIPPED LEGAL OPENER -- mage_armor t-3, arcane_blast
   * t-1.5 (the pull), arcane_power t0.
   * ==========================================================================
   */
  /*
   * ==========================================================================
   * IS ARCANE BLAST A MAINTENANCE BUFF? The owner: "Arcane Blast changed
   * significantly to be a maintenance buff that is meant to be kept at 4 stacks
   * for an entire fight."
   *
   * `refreshBehaviour: 'ignore'` CANNOT EXPRESS THAT -- the window is fifteen
   * seconds from FIRST application and no cast extends it -- so these rows are
   * measured with the aura flipped to `'reset'` in `game/auras/mage.ts`. With
   * the flip alone nothing maintains anything, because at four stacks the
   * shipped list casts MISSILES; the maintenance entry below is what actually
   * holds the buff up, and it is the thing the ruling would buy.
   *
   * THE COST IS WHY THIS IS NOT OBVIOUSLY A WIN. A stack raises Arcane Blast's
   * own cost by 175%, so a refresh cast at four stacks costs EIGHT TIMES base
   * -- about 3,660 mana against a pool of 7,182 and a fight that already ends
   * with 2,618 to spare. Four refreshes would spend more than the pool holds.
   * ==========================================================================
   */
  arcMaintain: [
    { label: 'the flip alone, nothing maintaining it -- the control', apply: (p) => p },
    ...[1, 2, 3, 4].map((seconds) => ({
      label: `maintain: re-blast at 4 stacks with <= ${seconds}s left`,
      apply: addAbove(
        {
          abilityId: 'arcane_blast',
          condition: all(
            selfStacks('exactly', ARCANE_BLAST_MAX_STACKS, 'arcane_blast'),
            selfTime('atMost', seconds, 'arcane_blast'),
          ),
        },
        'arcane_missiles',
      ),
    })),
  ],
  /*
   * ==========================================================================
   * THE WEAPON ENCHANT, WHICH IS THE ONLY ENCHANT SLOT ARITHMETIC CANNOT
   * SETTLE -- and which `tools/enchant_report.ts` could not even SHOW when this
   * was measured, because that report covered ten armour slots and no weapon.
   * It has a second block for the four weapon slots now, and a guard derived
   * from the enchant catalogue that throws if any enchantable slot is in
   * neither.
   *
   * Every armour slot is decided off the stat weight table (1% crit 8.74, 1%
   * haste 6.50, spell power 0.643, intellect 0.404, and agility, strength,
   * stamina, spirit and mana-per-5 all exactly nothing on this build), so the
   * shipped loadout is provably best-available there: +1% Haste beats +8
   * Intellect on head and legs, +20 Spell Power beats +1% Haste on gloves, and
   * cloak and feet have NO option worth anything at all.
   *
   * REVELATION IS A PROC AND THEREFORE NEEDS A FIGHT. "A chance to trigger when
   * a non-periodic spell fails to critically strike", granting a guaranteed crit
   * on the next spell, with "chance to trigger diminished as your critical
   * strike chance increases" -- and this build is at 14.48% spell crit.
   * ==========================================================================
   */
  /*
   * ==========================================================================
   * THE 22.3% OF THE FIGHT WITH NO ARCANE BLAST BUFF AT ALL, which is the one
   * thing the uptime table says and no previous group asked about.
   *
   * Arcane Blast's window is FIFTEEN SECONDS FROM FIRST APPLICATION
   * (`refreshBehaviour: 'ignore'`), the ramp spends 6s of it reaching four
   * stacks, and the list then spends the rest on Arcane Missiles -- which is a
   * CHANNEL. So the window expires part-way through a channel, the remaining
   * missiles are paid at the unbuffed price, and the re-ramp cannot start until
   * the channel ends. **Measured uptime is 77.7%, and the missing 22.3% is a
   * channel straddling the expiry.**
   *
   * SO THE CANDIDATE IS: DO NOT START A CHANNEL THE WINDOW CANNOT COVER. If the
   * buff has less than N seconds left, fall through to the filler instead and
   * let the window die on a cheap cast rather than an expensive one.
   *
   * AND THE COUNTER-ARGUMENT IS THE COST, which is why it has to be measured:
   * the filler is Arcane Blast, and at four stacks Arcane Blast costs EIGHT
   * TIMES base for a stack that is about to vanish anyway.
   * ==========================================================================
   */
  /*
   * ==========================================================================
   * SECOND PASS, WHICH EXISTS BECAUSE THE FIRST ONE CHANGED WHAT THE LIST DOES.
   *
   * The channel floor now refuses a Missiles channel with under two seconds of
   * Arcane Blast left, and what it falls through to is the Arcane Blast filler
   * at EIGHT TIMES base cost. So the obvious new question is whether something
   * cheaper belongs in that gap -- Fire Blast is instant, this build already
   * spends two points on `improved_fire_blast`, and the ability is in the book
   * and in no list.
   *
   * AND THE STACK GATE IS RE-SWEPT, because a gate measured before the floor
   * existed is a measurement of a different list. That is the knock-on the
   * owner's brief names, and re-running it costs one group.
   * ==========================================================================
   */
  /*
   * ==========================================================================
   * THE COOLDOWN STACK, WHICH IS HOW A REAL PLAYER SPENDS THESE. The owner:
   * "Take a look at setting up a cooldown overlap condition with Arcane Wrath /
   * Pyroblast. This is often times how real players use their cooldowns."
   *
   * `AplEntry.sequence` IS EXACTLY THAT SHAPE -- the condition gates the WHOLE
   * thing, the steps resolve as one unit, and nothing may be cast between them.
   * Two ordinary entries cannot express it: the potion, Arcane Power and
   * Presence of Mind are all off the global cooldown now, so the instant one
   * goes out the list is re-read and the filler wins the gap.
   *
   * ------------------------------------------------------------------------
   * THE TWO REAL DECISIONS, AND BOTH ARE MEASURED RATHER THAN REASONED:
   *
   * **WHERE ARCANE POWER LIVES.** It is pre-cast at t=0 today and that is worth
   * +24.2. It cannot be BOTH pre-cast and a step here: the whole sequence is
   * resolved before any of it is cast, so a step on cooldown refuses the lot --
   * which would make the burst silently never fire. So either the opener keeps
   * it and the stack is built around it, or the opener gives it up.
   *
   * **WHAT THE PAYLOAD IS.** Presence of Mind makes the next cast instant, so
   * the payload wants to be the longest cast in the kit. Pyroblast is SIX
   * seconds and already in the build; Arcane Wrath is 3.5 and costs a talent
   * point out of `improved_channeling`, which is a declared `OutOfScope` cast
   * pushback talent and therefore provably inert.
   *
   * **AND ARCANE WRATH HAS ONLY EVER BEEN MEASURED AS A FILLER**, at -76.7 and
   * -118.2, which is a different question entirely: that priced it DISPLACING
   * Arcane Blasts every cycle. As a once-a-fight payload inside a +30% window
   * it displaces nothing. This is the measurement that was actually missing.
   * ==========================================================================
   */
  arcBurst: (() => {
    /* Strip the three entries the stack absorbs, then insert it as one. */
    const asStack = (entry: AplEntry): Apply =>
      chain(
        removeEntry('major_spellblasting_potion'),
        removeEntry('presence_of_mind'),
        removeEntry('pyroblast'),
        addAbove(entry, 'arcane_missiles'),
      );
    const atCapGate = selfStacks('exactly', ARCANE_BLAST_MAX_STACKS, 'arcane_blast');

    const stack = (
      label: string,
      steps: readonly string[],
      opts: { gated: boolean; wrath?: boolean; dropPrecombatAp?: boolean },
    ): Variant => ({
      label,
      apply: chain(
        opts.wrath === true ? tree(ARCANE_WITH_WRATH) : (p) => p,
        opts.dropPrecombatAp === true ? removePrecombat('arcane_power') : (p) => p,
        asStack({
          abilityId: steps[0],
          sequence: steps.slice(1),
          ...(opts.gated ? { condition: atCapGate } : {}),
        }),
      ),
    });

    return [
      { label: 'the shipped list -- the control', apply: (p) => p },
      /* Arcane Power stays pre-cast; the stack is potion + PoM + payload. */
      stack('AP pre-cast | potion>PoM>pyroblast, at the 4-stack cap',
        ['major_spellblasting_potion', 'presence_of_mind', 'pyroblast'], { gated: true }),
      stack('AP pre-cast | potion>PoM>arcane_wrath, at the cap',
        ['major_spellblasting_potion', 'presence_of_mind', 'arcane_wrath'],
        { gated: true, wrath: true }),
      /* The opener gives Arcane Power up and the stack owns it -- the owner's shape. */
      stack('AP in the stack | potion>AP>PoM>pyroblast, at the cap',
        ['major_spellblasting_potion', 'arcane_power', 'presence_of_mind', 'pyroblast'],
        { gated: true, dropPrecombatAp: true }),
      stack('AP in the stack | potion>AP>PoM>arcane_wrath, at the cap -- THE SCREENSHOT',
        ['major_spellblasting_potion', 'arcane_power', 'presence_of_mind', 'arcane_wrath'],
        { gated: true, wrath: true, dropPrecombatAp: true }),
      /* Ungated, to separate "the stack" from "waiting for the cap". */
      stack('AP pre-cast | potion>PoM>pyroblast, UNGATED',
        ['major_spellblasting_potion', 'presence_of_mind', 'pyroblast'], { gated: false }),
      stack('AP in the stack | potion>AP>PoM>arcane_wrath, UNGATED',
        ['major_spellblasting_potion', 'arcane_power', 'presence_of_mind', 'arcane_wrath'],
        { gated: false, wrath: true, dropPrecombatAp: true }),
    ];
  })(),
  arcPass2: [
    { label: 'the shipped list with the channel floor -- the control', apply: (p) => p },
    {
      label: 'fire_blast in the straddle gap (4 stacks, < 2s left)',
      apply: addAbove(
        {
          abilityId: 'fire_blast',
          condition: all(
            selfStacks('exactly', ARCANE_BLAST_MAX_STACKS, 'arcane_blast'),
            selfTime('atMost', 2, 'arcane_blast'),
          ),
        },
        'arcane_blast',
      ),
    },
    {
      label: 'fire_blast in the gap AND whenever the window is down',
      apply: addAbove(
        { abilityId: 'fire_blast', condition: selfTime('atMost', 2, 'arcane_blast') },
        'arcane_blast',
      ),
    },
    /* The barrage entry given the same floor -- the assumption it should NOT have one. */
    {
      label: 'the BARRAGE missiles entry given the floor too',
      apply: apl((entries) =>
        entries.map((e, i) =>
          e.abilityId === 'arcane_missiles' && entries[i + 1]?.abilityId === 'arcane_missiles'
            ? { ...e, condition: all(selfHas('missile_barrage'), selfTime('atLeast', 2, 'arcane_blast')) }
            : e,
        ),
      ),
    },
    /* The stack gate re-swept against the floor. */
    ...[3, 5].map((n) => ({
      label: `stack gate ${n} instead of 4, with the floor in place`,
      apply: apl((entries) =>
        entries.map((e, i) =>
          e.abilityId === 'arcane_missiles' &&
          i > 0 &&
          entries[i - 1]?.abilityId === 'arcane_missiles'
            ? {
                ...e,
                condition: all(
                  selfStacks('exactly', n, 'arcane_blast'),
                  selfTime('atLeast', 2, 'arcane_blast'),
                ),
              }
            : e,
        ),
      ),
    })),
  ],
  arcChannel: [
    { label: 'the shipped list -- the control', apply: (p) => p },
    ...[0.5, 1, 1.5, 2, 2.5, 3].map((seconds) => ({
      label: `no missiles channel with < ${seconds}s of arcane_blast left`,
      apply: apl((entries) =>
        entries.map((e, i) =>
          e.abilityId === 'arcane_missiles' &&
          i > 0 &&
          entries[i - 1]?.abilityId === 'arcane_missiles'
            ? {
                ...e,
                condition: all(
                  selfStacks('exactly', ARCANE_BLAST_MAX_STACKS, 'arcane_blast'),
                  selfTime('atLeast', seconds, 'arcane_blast'),
                ),
              }
            : e,
        ),
      ),
    })),
    /* And the two cooldowns re-gated onto the high-spell-power window. */
    {
      label: 'arcane_power gated on the 4-stack cap instead of a barrage proc',
      apply: apl((entries) =>
        entries.map((e) =>
          e.abilityId === 'arcane_power'
            ? { ...e, condition: selfStacks('exactly', ARCANE_BLAST_MAX_STACKS, 'arcane_blast') }
            : e,
        ),
      ),
    },
    {
      label: 'spellblasting potion gated on the 4-stack cap instead of PoM',
      apply: apl((entries) =>
        entries.map((e) =>
          e.abilityId === 'major_spellblasting_potion'
            ? { ...e, condition: selfStacks('exactly', ARCANE_BLAST_MAX_STACKS, 'arcane_blast') }
            : e,
        ),
      ),
    },
  ],
  arcWeapon: [
    { label: 'the shipped +65 Spell Power -- the control', apply: (p) => p },
    { label: 'Revelation on the staff (was +65 Spell Power)', apply: enchant('twoHand', 900032) },
    { label: '+25 Agility on the staff (the inert control)', apply: enchant('twoHand', 900031) },
    /* Two arithmetic predictions, verified with fights rather than trusted. */
    { label: 'head +8 Intellect (arithmetic says -3.3 vs +1% Haste)', apply: enchant('head', 900006) },
    { label: 'gloves +1% Haste (arithmetic says -6.4 vs +20 Spell Power)', apply: enchant('gloves', 900002) },
  ],
  arcGate: [
    { label: 'the shipped legal opener -- the control', apply: (p) => p },
    /*
     * THE VOID OPENER RESTORED, to price the revert honestly rather than by
     * subtracting two figures taken at different iteration counts. This row is
     * ILLEGAL and is here only as a measurement.
     */
    {
      label: 'ILLEGAL (void): the 4-cast pre-ramp restored',
      apply: openerOf([
        ['pyroblast', 13.5],
        ['arcane_blast', 7.5],
        ['arcane_blast', 6],
        ['arcane_blast', 4.5],
        ['mage_armor', 3],
        ['arcane_blast', 1.5],
        ['arcane_power', 0],
      ]),
    },
    /* Arcane Power re-priced on the legal opener rather than on the ramp. */
    { label: 'no arcane_power at t0 (prices the one legal addition)', apply: removePrecombat('arcane_power') },
    /* The other three non-damaging instants this build owns. */
    { label: '+ presence_of_mind at t0', apply: addPrecombat(0, 'presence_of_mind') },
    { label: '+ eureka at t0', apply: addPrecombat(0, 'eureka') },
    { label: '+ major_spellblasting_potion at t0', apply: addPrecombat(0, 'major_spellblasting_potion') },
    /* Pyroblast as the pull INSTEAD of the Arcane Blast -- still exactly one. */
    {
      label: 'pyroblast as the pull instead of arcane_blast (6s cast, free)',
      apply: openerOf([
        ['mage_armor', 3],
        ['pyroblast', 6],
        ['arcane_power', 0],
      ]),
    },
    /* No damaging cast at all, which is the floor. */
    {
      label: 'NO damaging cast at all -- the floor',
      apply: openerOf([
        ['mage_armor', 3],
        ['arcane_power', 0],
      ]),
    },
  ],
  /*
   * ==========================================================================
   * THE APL, AND THE FIRST ROUND ASKED NOTHING OF IT -- which is what the owner
   * caught. Every row here is a list change at the shipped talents.
   *
   * FIRE BLAST IS THE ENTRY THAT IS NOT THERE. It is a trainer spell every Mage
   * owns, the build carries `improved_fire_blast` 2/2 for a **6 second**
   * cooldown, and `incineration` 3/3 gives it +6% crit -- so the build pays for
   * it three ways and never casts it. Two placements, because an instant on a
   * cooldown is a filler and the floor rule says position decides whether it
   * ever fires.
   * ==========================================================================
   */
  arcApl: [
    { label: 'fire_blast at the BOTTOM (below arcane_blast)', apply: addEntry(fireBlast) },
    { label: 'fire_blast above arcane_blast (the filler slot)', apply: addAbove(fireBlast, 'arcane_blast') },
    {
      label: 'fire_blast above the gated arcane_missiles',
      apply: addAbove(fireBlast, 'arcane_missiles'),
    },
    /*
     * PRESENCE OF MIND OFF PYROBLAST AND ONTO ARCANE BLAST. The shipped pair
     * spends a three-minute cooldown making ONE six-second Pyroblast instant,
     * on a spell that is 4.5% of the damage -- where Arcane Blast is 17.1% and
     * the Missiles the Blast feeds are 78%.
     */
    {
      label: 'presence_of_mind spent on arcane_blast, pyroblast entry removed',
      apply: chain(
        removeEntry('pyroblast'),
        apl((entries) =>
          entries.map((e) =>
            e.abilityId === 'presence_of_mind' ? { abilityId: 'presence_of_mind' } : e,
          ),
        ),
      ),
    },
    /* The Pyroblast pair out entirely, leaving the talent paid for and unused. */
    {
      label: 'no pyroblast entry, no presence_of_mind entry',
      apply: chain(removeEntry('pyroblast'), removeEntry('presence_of_mind')),
    },
    /* Pyroblast without waiting for Presence of Mind -- a real 6s cast. */
    {
      label: 'pyroblast at the cap WITHOUT presence_of_mind',
      apply: apl((entries) =>
        entries.map((e) => (e.abilityId === 'pyroblast' ? { abilityId: 'pyroblast', condition: atCap } : e)),
      ),
    },
  ],

  /*
   * ==========================================================================
   * THE ARCANE BLAST STACK GATE, SWEPT. The list spends the stack on Missiles
   * at EXACTLY four and fills with Blast below -- so the gate decides how long
   * the spell-power ramp is allowed to build before the 78% spell collects it.
   *
   * **SWEEP IT RATHER THAN COMPARING THE TWO READINGS SOMEBODY WROTE DOWN**,
   * which is this project's own rule after a two-point Eviscerate comparison
   * hid a +10.8 peak between its two cells.
   * ==========================================================================
   */
  arcStackGate: [1, 2, 3, 5].map((n) => ({
    label: `arcane_missiles at ${n} arcane_blast stacks (shipped: ${ARCANE_BLAST_MAX_STACKS})`,
    apply: apl((entries) =>
      entries.map((e, i) =>
        e.abilityId === 'arcane_missiles' && i > 0 && entries[i - 1]?.abilityId === 'arcane_missiles'
          ? { ...e, condition: selfStacks('atLeast', n, 'arcane_blast') }
          : e,
      ),
    ),
  })),

  /*
   * ==========================================================================
   * THE TALENTS. Every row is measured at the shipped APL, and the knock-on is
   * measured separately once a winner is known -- which is the owner's own
   * point about this being iterative.
   * ==========================================================================
   */
  /*
   * ==========================================================================
   * THE PACKAGE, WHICH IS THE OWNER'S OWN POINT ABOUT THIS BEING ITERATIVE.
   *
   * `heating_up` reduces the cast time of the NEXT Pyroblast by 25% a stack up
   * to three, off non-periodic crits with Fireball, Frostfire Bolt, **Fire
   * Blast** and Scorch -- and this build casts none of those four. So the
   * talent measured alone is a talent with nothing to feed it, and Fire Blast
   * measured alone is an instant with nothing to pay for it. **Both halves or
   * neither**, which is the Berserker Rage lesson: measured one at a time, each
   * half of a talent-plus-entry pair reads as worthless.
   * ==========================================================================
   */
  arcPackage: [
    { label: 'heating_up alone, nothing feeding it', apply: tree(HEATING_UP) },
    { label: 'fire_blast entry alone, no heating_up', apply: addAbove(fireBlast, 'arcane_blast') },
    {
      label: 'heating_up AND a fire_blast above arcane_blast -- the pair',
      apply: chain(tree(HEATING_UP), addAbove(fireBlast, 'arcane_blast')),
    },
    {
      label: 'the pair, with fire_blast above the gated arcane_missiles',
      apply: chain(tree(HEATING_UP), addAbove(fireBlast, 'arcane_missiles')),
    },
  ],

  arcTalents: [
    { label: 'the shipped spread -- the control', apply: (p) => p },
    { label: 'elemental_precision 5 -> 0 (Fire hit dropped)', apply: tree(NO_FIRE_HIT) },
    { label: 'ALL Fire out but incineration (11 -> 3)', apply: tree(NO_FIRE_AT_ALL) },
    { label: 'ALL Fire out INCLUDING incineration', apply: tree(NO_INCINERATION) },
    { label: 'heating_up, paid for with 5 dead Arcane points', apply: tree(HEATING_UP) },
  ],

  /*
   * THE ENCHANTS. The caster loadout is head and legs +1% Haste, neck +6 Spell
   * Power, chest +4 Stats, wrists +16 Spell Power, gloves +20 Spell Power,
   * cloak, feet and the two-hander. Only the slots with a real alternative are
   * here -- see `mageVariants.ts` for why the other six are no-ops.
   */
  /*
   * ==========================================================================
   * THE PRE-COMBAT RAMP, WHICH IS THE ONE DIMENSION WITH REAL HEADROOM LEFT.
   *
   * Arcane Blast is **1.5 seconds** and its stack is +15% of Intellect as spell
   * power, four stacks deep, in a FIFTEEN second window that refreshes with
   * `refreshBehaviour: 'ignore'`. The opener casts it once, so the fight starts
   * on **one** stack and the 78% spell waits for three more real casts before it
   * collects a full ramp.
   *
   * A PRE-COMBAT CAST SKIPS THE GLOBAL COOLDOWN, THE SWING RESET AND THE CAST
   * TIME, so stacking the ramp before the pull is the one thing in this build
   * that buys ramp for free. The lead for each is its own cast time, stepped --
   * which is the owner's own "start casting" convention, and it is what makes
   * the sequence complete AT zero.
   *
   * AND THE WINDOW IS WHAT BOUNDS IT: at a 6s lead the first stack has 9 of its
   * 15 seconds left at the pull, so a deeper ramp is also an older one. That is
   * the trade this group measures rather than reasons about.
   * ==========================================================================
   */
  arcPrecombat: [
    {
      label: 'TWO arcane_blast before the pull -- 2 stacks at t=0',
      apply: chain(precombatLead('mage_armor', 4.5), addPrecombat(3, 'arcane_blast')),
    },
    {
      label: 'THREE arcane_blast before the pull -- 3 stacks at t=0',
      apply: chain(
        precombatLead('mage_armor', 6),
        addPrecombat(4.5, 'arcane_blast'),
        addPrecombat(3, 'arcane_blast'),
      ),
    },
    {
      label: 'FOUR arcane_blast before the pull -- the CAP at t=0',
      apply: chain(
        precombatLead('mage_armor', 7.5),
        addPrecombat(6, 'arcane_blast'),
        addPrecombat(4.5, 'arcane_blast'),
        addPrecombat(3, 'arcane_blast'),
      ),
    },
    {
      label: 'no pre-combat arcane_blast at all -- 0 stacks, the control',
      apply: removePrecombat('arcane_blast'),
    },
    {
      label: 'pyroblast before the pull as well (6s cast, free of it)',
      apply: chain(precombatLead('mage_armor', 9), addPrecombat(6, 'pyroblast')),
    },
  ],

  /*
   * ==========================================================================
   * EUREKA, WHICH FIRES ON THE FIRST POLL AND IS UNGATED.
   *
   * The Gnome racial is "+10% damage for 8 seconds, periodic effects get
   * nothing" -- a WINDOW, and it sits in the shared `RACIAL_COOLDOWNS` block
   * with no condition, so it is spent on whatever the opening of the fight
   * happens to be. Arcane Power's own entry is gated on a Missile Barrage proc
   * for exactly this reason, and nothing does the same for Eureka.
   *
   * THE SHARED BLOCK IS WHY IT HAS NO GATE: the constant is spread into lists
   * belonging to no race, so a per-race condition there would be a condition
   * on three abilities the build cannot cast. Gating it is therefore a change
   * to THIS list rather than to the block.
   * ==========================================================================
   */
  arcEureka: [
    {
      label: 'eureka gated on a missile_barrage proc, like arcane_power',
      apply: apl((entries) =>
        entries.map((e) =>
          e.abilityId === 'eureka'
            ? { ...e, condition: selfHas('missile_barrage') }
            : e,
        ),
      ),
    },
    {
      label: 'eureka gated on arcane_power being up',
      apply: apl((entries) =>
        entries.map((e) =>
          e.abilityId === 'eureka' ? { ...e, condition: selfHas('arcane_power') } : e,
        ),
      ),
    },
    {
      label: 'eureka gated on the arcane_blast CAP',
      apply: apl((entries) =>
        entries.map((e) => (e.abilityId === 'eureka' ? { ...e, condition: atCap } : e)),
      ),
    },
    { label: 'no eureka entry at all -- the control', apply: removeEntry('eureka') },
  ],

  /*
   * ==========================================================================
   * THE COMBINATIONS, BECAUSE MARGINAL VALUES DO NOT SUM.
   *
   * Three things measured positive alone -- a four-stack ramp at **+74.74**, a
   * pre-combat Pyroblast at **+41.49** and Eureka's gate at **+1.92** -- and
   * each was measured with the other two absent. They compete for the same
   * pre-combat window and the same opening seconds, so the pair has to be
   * measured as a pair; this project has already had a ranking INVERT that way
   * on the Firelock's two mana sources.
   *
   * AND THE FOUR-STACK OPENER CHANGES WHAT THE LIST DOES AT t=0, which is the
   * knock-on. Presence of Mind is gated on EXACTLY four stacks and the Pyroblast
   * under it on the same clause plus the charge -- so a build that arrives at the
   * cap fires that pair on the first poll instead of a third of the way into the
   * fight. The ramp is not only bigger, it arrives before the cooldowns.
   * ==========================================================================
   */
  arcCombined: [
    {
      label: 'FOUR stacks -- the single winner, repeated as this group control',
      apply: chain(
        precombatLead('mage_armor', 7.5),
        addPrecombat(6, 'arcane_blast'),
        addPrecombat(4.5, 'arcane_blast'),
        addPrecombat(3, 'arcane_blast'),
      ),
    },
    {
      label: 'FOUR stacks + pyroblast before the pull',
      apply: chain(
        precombatLead('mage_armor', 13.5),
        addPrecombat(12, 'arcane_blast'),
        addPrecombat(10.5, 'arcane_blast'),
        addPrecombat(9, 'arcane_blast'),
        addPrecombat(6, 'pyroblast'),
      ),
    },
    {
      label: 'FOUR stacks + eureka gated on a barrage proc',
      apply: chain(
        precombatLead('mage_armor', 7.5),
        addPrecombat(6, 'arcane_blast'),
        addPrecombat(4.5, 'arcane_blast'),
        addPrecombat(3, 'arcane_blast'),
        apl((entries) =>
          entries.map((e) =>
            e.abilityId === 'eureka' ? { ...e, condition: selfHas('missile_barrage') } : e,
          ),
        ),
      ),
    },
    {
      label: 'FOUR stacks + pyroblast + eureka gate -- everything',
      apply: chain(
        precombatLead('mage_armor', 13.5),
        addPrecombat(12, 'arcane_blast'),
        addPrecombat(10.5, 'arcane_blast'),
        addPrecombat(9, 'arcane_blast'),
        addPrecombat(6, 'pyroblast'),
        apl((entries) =>
          entries.map((e) =>
            e.abilityId === 'eureka' ? { ...e, condition: selfHas('missile_barrage') } : e,
          ),
        ),
      ),
    },
    /*
     * AND THE RAMP CAST LATE RATHER THAN EARLY. The stack window is FIFTEEN
     * seconds with `refreshBehaviour: 'ignore'`, so it opens on the FIRST
     * application and a four-cast ramp beginning at t-12 is already 12 seconds
     * old at the pull. This row puts the Pyroblast FIRST and the blasts last,
     * so the ramp is as young as the sequence allows.
     */
    {
      label: 'pyroblast FIRST, then the four blasts -- the youngest ramp',
      apply: chain(
        precombatLead('mage_armor', 13.5),
        addPrecombat(12, 'pyroblast'),
        addPrecombat(6, 'arcane_blast'),
        addPrecombat(4.5, 'arcane_blast'),
        addPrecombat(3, 'arcane_blast'),
      ),
    },
  ],

  /*
   * ==========================================================================
   * THE SECOND ITERATION: EVERY EARLIER DECISION RE-ASKED ON TOP OF THE WINNER.
   *
   * "This process is iterative because some decisions have a knock-on effect"
   * -- the owner's own brief, and the four-stack opener is exactly the kind of
   * change that could move the others. It arrives at the Arcane Blast CAP, so
   * Presence of Mind and the Pyroblast beneath it now fire on the FIRST poll;
   * the ramp is full before a single in-fight cast; and the window the stack
   * gate reads is already open when the fight starts.
   *
   * SO THE GATE, THE PYROBLAST PAIR, THE FIRE INVESTMENT AND THE HASTE ENCHANT
   * ARE ALL PRICED AGAINST A DIFFERENT OPENING THAN THE ONE THAT PRICED THEM
   * FIRST. Each row below is `WINNER + the change`, so the figure is the change
   * at the new baseline rather than at the old one.
   * ==========================================================================
   */
  arcIterate: [
    { label: 'the WINNER alone -- this group control', apply: WINNER },
    {
      label: 'winner + arcane_missiles gate at 3 stacks (was 4)',
      apply: chain(WINNER, stackGate(3)),
    },
    {
      label: 'winner + arcane_missiles gate at 5 stacks (was 4)',
      apply: chain(WINNER, stackGate(5)),
    },
    {
      label: 'winner + no pyroblast/presence_of_mind entries',
      apply: chain(WINNER, removeEntry('pyroblast'), removeEntry('presence_of_mind')),
    },
    {
      label: 'winner + ALL Fire out but incineration',
      apply: chain(WINNER, tree(NO_FIRE_AT_ALL)),
    },
    { label: 'winner + head +8 Intellect (was +1% Haste)', apply: chain(WINNER, enchant('head', 900006)) },
    {
      label: 'winner + fire_blast above arcane_blast',
      apply: chain(WINNER, addAbove(fireBlast, 'arcane_blast')),
    },
  ],

  /*
   * ==========================================================================
   * THE LEGAL OPENERS ONLY, AND THE BEST FIGURE IN THIS FILE IS DISCARDED.
   *
   * `arcCombined`'s top row measured **+105.33** and is **NOT A POSSIBLE CAST
   * SEQUENCE**: it holds a Pyroblast from t-6 to t0 AND an Arcane Blast from
   * t-1.5 to t0. `runPrecombat` resolves every action at timestamp zero and
   * never asks whether one cast was still in progress when the next began, so
   * the opener banked five casts into four seconds of real time.
   *
   * **A PRE-COMBAT LIST IS A CLAIM ABOUT WHAT THE CHARACTER DID, AND THE ENGINE
   * DOES NOT CHECK IT.** That is a modelling gap rather than a free 105 DPS, and
   * this project's rule is to flag one rather than bank it -- the figure reads
   * exactly like the three legal rows beside it and is 6 DPS above the best of
   * them, which is inside their combined interval. Nothing would have looked
   * wrong.
   *
   * ------------------------------------------------------------------------
   * AND THE TRADE BETWEEN THE TWO LEGAL ARRANGEMENTS IS THE PYROBLAST'S BURN
   * AGAINST THE RAMP'S REMAINING WINDOW, which is a real decision:
   *
   *   Pyroblast LAST  (lead 6 = its cast time, burn unaged, completes at t0)
   *     -> the blasts are pushed to t-12..t-7.5, the first stack lands t-10.5,
   *        and the 15s stack window **expires 4.5s into the fight**
   *   Pyroblast FIRST (lead 12, so its 12s burn arrives 6s aged)
   *     -> the blasts sit in the last six seconds, first stack lands t-4.5,
   *        and the window **lasts 10.5s into the fight**
   *
   * One trades half a Pyroblast DoT for six more seconds of a ramp that feeds
   * 78% of the damage. Measured rather than argued.
   * ==========================================================================
   */
  arcLegal: [
    {
      label: 'LEGAL: pyroblast first (aged burn), 4 blasts last -- window to t+10.5',
      apply: openerOf([
        ['mage_armor', 13.5],
        ['pyroblast', 12],
        ['arcane_blast', 6],
        ['arcane_blast', 4.5],
        ['arcane_blast', 3],
        ['arcane_blast', 1.5],
        ['arcane_power', 0],
      ]),
    },
    {
      label: 'LEGAL: 4 blasts first, pyroblast last (fresh burn) -- window to t+4.5',
      apply: openerOf([
        ['mage_armor', 13.5],
        ['arcane_blast', 12],
        ['arcane_blast', 10.5],
        ['arcane_blast', 9],
        ['arcane_blast', 7.5],
        ['pyroblast', 6],
        ['arcane_power', 0],
      ]),
    },
    {
      label: 'LEGAL: 3 blasts, pyroblast last (fresh burn) -- window to t+6',
      apply: openerOf([
        ['mage_armor', 12],
        ['arcane_blast', 10.5],
        ['arcane_blast', 9],
        ['arcane_blast', 7.5],
        ['pyroblast', 6],
        ['arcane_power', 0],
      ]),
    },
    {
      label: 'LEGAL: 4 blasts, NO pyroblast -- window to t+10.5',
      apply: openerOf([
        ['mage_armor', 7.5],
        ['arcane_blast', 6],
        ['arcane_blast', 4.5],
        ['arcane_blast', 3],
        ['arcane_blast', 1.5],
        ['arcane_power', 0],
      ]),
    },
    {
      label: 'the shipped opener -- one blast, the control',
      apply: (p) => p,
    },
  ],

  /*
   * ==========================================================================
   * THE SHIPPING CANDIDATE, WHICH KEEPS THE OWNER'S OWN TWO LINES.
   *
   * `precombatOpeners.test.ts` transcribes the owner's openers a second time
   * and asserts that a profile's pre-combat list is **their lines plus an
   * explicitly declared set of additions** -- so it FAILED on the first
   * arrangement here, which had moved `mage_armor` from a 3s lead to 13.5 and
   * replaced their single `arcane_blast` at 1.5 with four at other leads.
   *
   * THE TEST WAS RIGHT AND THE ARRANGEMENT WAS WRONG. The owner asked for the
   * opener to be OPTIMISED, not rewritten, and the two best arrangements are
   * **tied** -- 7.6 apart against a combined interval of 11.4 -- so there is no
   * measurement to trade against keeping their transcription intact.
   *
   * SO THE BLASTS GO WHERE THE OWNER'S ONE ALREADY WAS and three more are
   * stacked in front of it, with the Pyroblast ahead of those and Mage Armor
   * left at its stated 3s lead, which falls in the gap the sequence leaves:
   *
   *   pyroblast     t-13.5 -> t-7.5    (6s, added)
   *   arcane_blast  t-7.5  -> t-6.0    (added, and the first stack)
   *   arcane_blast  t-6.0  -> t-4.5    (added)
   *   arcane_blast  t-4.5  -> t-3.0    (added)
   *   mage_armor    instant at t-3     (**the owner's own line, untouched**)
   *   arcane_blast  t-1.5  -> t0       (**the owner's own line, untouched**)
   *   arcane_power  instant at t0      (added last round)
   *
   * Four stacks, no overlap, and the stack window runs to **t+9**.
   * ==========================================================================
   */
  arcShipping: [
    {
      label: 'the candidate: owner lines kept, 3 blasts + pyroblast added',
      apply: openerOf([
        ['pyroblast', 13.5],
        ['arcane_blast', 7.5],
        ['arcane_blast', 6],
        ['arcane_blast', 4.5],
        ['mage_armor', 3],
        ['arcane_blast', 1.5],
        ['arcane_power', 0],
      ]),
    },
    {
      label: 'the same, with eureka also gated on a barrage proc',
      apply: chain(
        openerOf([
          ['pyroblast', 13.5],
          ['arcane_blast', 7.5],
          ['arcane_blast', 6],
          ['arcane_blast', 4.5],
          ['mage_armor', 3],
          ['arcane_blast', 1.5],
          ['arcane_power', 0],
        ]),
        apl((entries) =>
          entries.map((e) =>
            e.abilityId === 'eureka' ? { ...e, condition: selfHas('missile_barrage') } : e,
          ),
        ),
      ),
    },
    { label: 'the shipped opener -- one blast, the control', apply: (p) => p },
  ],

  arcEnchants: [
    { label: 'head +8 Intellect (was +1% Haste)', apply: enchant('head', 900006) },
    { label: 'legs +8 Intellect (was +1% Haste)', apply: enchant('legs', 900006) },
    { label: 'head +8 Spirit (was +1% Haste)', apply: enchant('head', 900007) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
    { label: 'feet +8 Agility (was Minor Speed)', apply: enchant('feet', 900026) },
  ],

  /*
   * THE CONSUMABLES. **The Demonic Rune never fires** -- gated at 10% mana by
   * the owner's ruling, on a build that ends the fight above it -- so the
   * `other` row is the one with a real question, and the alternative is a
   * category that does something at all.
   */
  arcConsumables: [
    { label: 'blasted lands +25 Intellect (was Spirit)', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
    { label: 'other: healthstone (was demonic_rune, which never fires)', apply: consumable('other', 'healthstone') },
  ],
};
