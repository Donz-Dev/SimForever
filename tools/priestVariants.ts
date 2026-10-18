/*
 * ==============================================================================
 * THE VARIANTS `probe_build.ts` MEASURES ON THE SHADOW PRIEST.
 *
 * Written for the owner's six-profile optimisation pass. Client build
 * 1.60.1.70425 removed Shadow Affinity and Improved Fade, added DARK
 * INSPIRATION in Improved Fade's slot, and swapped two Discipline rows -- which
 * forced a rebuild of this profile's Discipline thirteen and handed it five live
 * points for five dead ones on the way.
 *
 * ------------------------------------------------------------------------------
 * WHERE ITS DAMAGE IS: Mind Flay 35.4%, Mind Blast 23.0%, Shadow Word: Pain
 * 20.0%, Devouring Plague 12.4%, Shadow Word: Death 9.2%. Every one of them is
 * Shadow, so a per-school effect reaches ALL of it -- which is unusual among the
 * six and makes Shadow Weaving's new debuff and Shadow Focus's hit the two
 * things most worth getting right.
 *
 * ITS HIT IS AT THE CAP FOR EVERYTHING IT CASTS. 11 points school-blind plus
 * Shadow Focus 5/5 is 16, which is exactly the usable spell cap, and the profile
 * casts nothing that is not Shadow. So there is no hit variant here.
 *
 * AND IT IS THE QUIETEST OF THE SIX: +/- 3.5 DPS at 300 fights, against +/- 15.1
 * on the Frostfire Mage. Five maintained effects and a channel is a far more
 * deterministic fight than one built on crit procs, which is worth knowing
 * before reading a small delta on either.
 *
 * ------------------------------------------------------------------------------
 * AND IT WAS THE SECOND-LARGEST MOVER IN THE PASS, at **+77.4 +/- 4.7** -- two
 * changes that both buy global cooldowns, measured as a pair because they
 * compete for the same scarce thing.
 * ==============================================================================
 */
import {
  type Variant,
  PRIEST_TREE as tree,
  addEntry,
  addPrecombat,
  apl,
  chain,
  consumable,
  enchant,
  moveAbove,
  precombatLead,
  removeEntry,
  removePrecombat,
} from './buildVariants';
import { ready, targetTime } from '../src/game/rotations/apl';
import type { AplCondition } from '../src/game/rotations/apl';

/**
 * Mark one entry as willing to cut an interruptible channel short.
 *
 * ----------------------------------------------------------------------------
 * BOTH HALVES HAVE TO AGREE and only one of them is missing. Mind Flay already
 * declares `interruptibleChannel` AND `protectedChannelTicks: 2`; no entry in
 * any of the 28 stock lists declares `interruptsChannel`, so the whole feature
 * has never had a caller. These variants are the box the owner built for
 * somebody to tick: "I still want the functionality so the user can choose."
 * ----------------------------------------------------------------------------
 */
const interrupts = (abilityId: string) =>
  apl((entries) =>
    entries.map((entry) =>
      entry.abilityId === abilityId ? { ...entry, interruptsChannel: true } : entry,
    ),
  );


/**
 * Drop one entry's condition entirely, so it is offered unconditionally.
 *
 * THE KEY IS DELETED RATHER THAN SET TO `undefined`, because a stored list is
 * compared BY VALUE against the stock one -- the rule `AplEntry.disabled`
 * already follows, where `JSON.stringify` writes an explicit key and omits an
 * absent one.
 */
const ungate = (abilityId: string) =>
  apl((entries) =>
    entries.map((entry) => {
      if (entry.abilityId !== abilityId) return entry;
      const { condition: _dropped, ...rest } = entry;
      return rest;
    }),
  );

/** Replace the condition on one entry, keeping everything else about it. */
const regate = (abilityId: string, condition: AplCondition) =>
  apl((entries) =>
    entries.map((entry) => (entry.abilityId === abilityId ? { ...entry, condition } : entry)),
  );

/**
 * Shadow Word: Pain back on the pure `expired` reading, written out rather
 * than relying on what the list happens to hold.
 */
const expiryGate = regate('shadow_word_pain', targetTime('atMost', 0, 'shadow_word_pain'));

/* --------------------------------------------------------------- the trees */

/**
 * THE SHIPPED SPREAD after the refresh repair, written out as the control.
 *
 * 13 Discipline / 3 Holy / 35 Shadow. Mental Strength 5/5 and Meditation 3/3
 * replaced a Power Word: Shield nothing attacks and a threat ruling -- the two
 * Discipline rows the client swapped -- and Dark Inspiration took Shadow
 * Affinity's three points.
 */
const CURRENT = {
  twin_disciplines: 5,
  mental_strength: 5,
  meditation: 3,
  twilight_focus: 3,
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
 * EARLY DEMISE'S TWO POINTS MOVED OUT, which measured **-6.26 +/- 0.95** -- so
 * the talent is worth +6.26 and stays.
 *
 * Kept as a measured negative: its window is 11.6 seconds against a 15 second
 * Shadow Word: Death cooldown, so at most one cast ever lands inside it, and
 * that made it look like a candidate to move.
 */
const NO_EARLY_DEMISE = {
  ...CURRENT,
  early_demise: 0,
  mental_agility: 2,
};

/**
 * INNER FOCUS, BOUGHT WITH THE THREE HOLY POINTS THAT DO NOTHING.
 *
 * ----------------------------------------------------------------------------
 * `twilight_focus` 3/3 IS A `castPushback` RULING -- three points of this
 * build buying a permanently out-of-scope effect. They are the only points in
 * the spread with somewhere live to go, and Inner Focus is the only live
 * DAMAGE talent anywhere in Discipline that 16 points can reach: Penance is
 * tier 20 and Power Infusion tier 30 behind it.
 *
 * 16 / 0 / 35, so SHADOW STAYS THE MAJORITY and the theme holds. Discipline
 * spends exactly 10 below tier 10, which is what Inner Focus needs.
 *
 * THE SPARE TWO GO TO `mental_agility`, which reduces instant-cast mana costs
 * and is expected to be worth nothing: this build ends a 60-second fight with
 * 5,250 mana of headroom out of 9,952 gained. It is named as the parking spot
 * rather than pretended to be a gain.
 * ----------------------------------------------------------------------------
 */
const INNER_FOCUS_FROM_HOLY = {
  ...CURRENT,
  twilight_focus: 0,
  inner_focus: 1,
  mental_agility: 2,
};

/** The same talent, bought out of Meditation instead -- 13/3/35 is untouched. */
const INNER_FOCUS_FROM_MEDITATION = {
  ...CURRENT,
  meditation: 2,
  inner_focus: 1,
};

/**
 * DARK INSPIRATION 3/5 -> 5/5, paid for by Shadow Reach's two `positioning`
 * points. Legal: Shadow then spends exactly 15 below tier 15.
 *
 * EXPECTED TO BE WORTH NOTHING AND MEASURED ANYWAY. The talent grants SPIRIT,
 * and `stat_weights` reads spirit at **0.0000 -- "nothing: this build cannot
 * read it"** -- because the build is GCD-bound rather than mana-bound and no
 * Priest talent this spread can reach converts spirit to spell power
 * (Spiritual Guidance is Holy tier 20). It is here because the two points are
 * genuinely movable and this is the only live thing they can move to.
 */
const DARK_INSPIRATION_5 = {
  ...CURRENT,
  shadow_reach: 0,
  dark_inspiration: 5,
};

/**
 * THE MINIMAL WAY TO PAY FOR INNER FOCUS: **14 / 2 / 35**, one point out of
 * `twilight_focus` and nothing else touched.
 *
 * ----------------------------------------------------------------------------
 * WHY THIS DONOR. `twilight_focus` is a `castPushback` RULING -- the owner has
 * declared the whole concept out of scope, so those points can never become
 * live, where `meditation` is a working talent that happens to be worth
 * nothing only because this build is GCD-bound. Paying out of the ruling is a
 * strict improvement; paying out of meditation is a bet on the build never
 * becoming mana-bound.
 *
 * AND IT IS ONE POINT RATHER THAN THREE, so the owner's 13/3/35 split moves as
 * little as it can. Discipline still spends exactly 10 below tier 10, which is
 * what Inner Focus's tier needs; Shadow is untouched and stays the majority.
 * ----------------------------------------------------------------------------
 */
const INNER_FOCUS_MINIMAL = {
  ...CURRENT,
  twilight_focus: 2,
  inner_focus: 1,
};

/* -------------------------------------------------------------- the groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  /*
   * ==========================================================================
   * THE CHANNEL INTERRUPT -- A SHIPPED ENGINE CAPABILITY WITH NO CALLER, BUILT
   * FOR THIS PROFILE.
   *
   * Mind Flay declares `interruptibleChannel` and `protectedChannelTicks: 2`;
   * nothing in any of the 28 stock lists declares `interruptsChannel`, so the
   * feature has never fired. The owner asked for it in those terms -- "this
   * may no longer be optimal play, but I still want the functionality so the
   * user can choose" -- which makes a measurement the answer either way.
   *
   * WHAT IT CAN TAKE IS THE THIRD TICK ONLY, and Improved Mind Flay makes that
   * the EXPENSIVE one: the ticks compound 20% each, so they are 1, 1.2 and
   * 1.44 of the base and the cuttable one is **39.6% of the channel** rather
   * than a third of it. The two rulings arrived together and pull against each
   * other.
   *
   * WHY IT COULD STILL PAY, and why each candidate is a separate row: this
   * build is GCD-BOUND, not mana-bound, so what a recovered second buys is
   * another cast. Damage per second of global cooldown, off the baseline run:
   *
   *   Shadow Word: Pain   3363 per cast / 1.5s = 2242
   *   Devouring Plague    2105 per cast / 1.5s = 1403
   *   Shadow Word: Death  1607 per cast / 1.5s = 1071
   *   Mind Blast          1456 per cast / 1.5s =  971
   *   Mind Flay           1663 per channel / 3s =  554
   *
   * **EVERY OTHER CAST IN THE LIST IS WORTH MORE PER SECOND THAN THE FILLER
   * IT WOULD INTERRUPT**, which is the whole argument. What it costs is the
   * 658-damage third tick; what it buys is reaching the next entry sooner.
   * ==========================================================================
   */
  priestChannel: [
    { label: 'nothing interrupts the channel -- the control', apply: (p) => p },
    { label: 'mind_blast interrupts mind_flay', apply: interrupts('mind_blast') },
    { label: 'shadow_word_death interrupts mind_flay', apply: interrupts('shadow_word_death') },
    { label: 'shadow_word_pain interrupts mind_flay', apply: interrupts('shadow_word_pain') },
    { label: 'devouring_plague interrupts mind_flay', apply: interrupts('devouring_plague') },
    {
      label: 'both DoTs interrupt mind_flay',
      apply: chain(interrupts('shadow_word_pain'), interrupts('devouring_plague')),
    },
    {
      label: 'everything above mind_flay interrupts it',
      apply: chain(
        interrupts('shadow_word_pain'),
        interrupts('devouring_plague'),
        interrupts('mind_blast'),
        interrupts('shadow_word_death'),
      ),
    },
  ],

  /*
   * ==========================================================================
   * THE LIST'S SHAPE, RE-PRICED. Every figure in `priestApl` above was taken
   * before round 20 put every raid buff on every profile (+9.1 to a caster),
   * before round 19c let a free off-GCD cast act again at once, and before
   * round 19e moved Shadow Weaving onto the target. **A prior measurement is
   * true of the build it was taken in.**
   *
   * THE ORDERING QUESTION IS NARROW AND THAT IS WORTH STATING. Mind Blast and
   * Shadow Word: Death are both on cooldowns shorter than the fight, so their
   * relative order only decides which goes first in the instants where BOTH
   * are ready -- it cannot stop either being cast. Shadow Word: Death is 1071
   * damage per second of global cooldown against Mind Blast's 971, so the
   * arithmetic says swap them; the cooldowns say it will be small.
   * ==========================================================================
   */
  priestOrder: [
    { label: 'the shipped order -- the control', apply: (p) => p },
    {
      label: 'shadow_word_death above mind_blast',
      apply: moveAbove('shadow_word_death', 'mind_blast'),
    },
    {
      label: 'devouring_plague above shadow_word_pain',
      apply: moveAbove('devouring_plague', 'shadow_word_pain'),
    },
    {
      label: 'mind_blast above devouring_plague',
      apply: moveAbove('mind_blast', 'devouring_plague'),
    },
    { label: 'mind_flay above shadow_word_death', apply: moveAbove('mind_flay', 'shadow_word_death') },
  ],

  /*
   * ==========================================================================
   * THE TALENTS, AND THE FIRST RESULT IS THAT THE TREE IS ALMOST ENTIRELY
   * FORCED.
   *
   * Every live Shadow talent this spread can reach is already MAXED --
   * shadow_focus 5/5, improved_mind_blast 5/5, improved_shadow_word_pain 2/2,
   * improved_mind_flay 2/2, shadow_weaving 3/3, devouring_contagion 2/2,
   * early_demise 2/2, darkness 5/5. What is left is six points whose effects
   * are rulings or worth nothing:
   *
   *   twilight_focus 3   `castPushback` ruling      movable (out of Holy)
   *   shadow_reach 2     `positioning` ruling       movable within Shadow
   *   silence 1          `crowdControl` ruling      movable within Shadow
   *   vampiric_embrace 1 heals a profile nothing attacks -- MANDATORY, it is
   *                      Shadowform's `requiresRanks` prerequisite
   *   dark_inspiration 3 live, and grants SPIRIT, which weighs 0.0000 here
   *   meditation 3       live, and mana regen on a build with 5,250 headroom
   *
   * SO THE ONLY LIVE DESTINATION IN THE WHOLE 51 IS INNER FOCUS, and the rows
   * below are the legal ways to pay for it or to refuse it.
   *
   * **BOTH HALVES OR NEITHER**, which is the Berserker Rage lesson: taking the
   * talent grants the ability and NO stock list entry casts it, so the talent
   * alone is an ability in the book and in no list. The talent-only row is
   * kept precisely to show that, because it is the shape that reads as "the
   * talent is worthless".
   * ==========================================================================
   */
  priestInnerFocus: [
    { label: '13/3/35 -- the shipped spread, the control', apply: (p) => p },
    {
      label: 'TALENT ONLY: 16/0/35 with inner_focus, no list entry',
      apply: tree(INNER_FOCUS_FROM_HOLY),
    },
    {
      label: 'BOTH HALVES: 16/0/35 with inner_focus, entry above mind_blast',
      apply: chain(
        tree(INNER_FOCUS_FROM_HOLY),
        addEntry({ abilityId: 'inner_focus' }),
        moveAbove('inner_focus', 'mind_blast'),
      ),
    },
    {
      label: 'BOTH HALVES, paid out of meditation: 13/3/35, entry above mind_blast',
      apply: chain(
        tree(INNER_FOCUS_FROM_MEDITATION),
        addEntry({ abilityId: 'inner_focus' }),
        moveAbove('inner_focus', 'mind_blast'),
      ),
    },
    {
      label: 'BOTH HALVES from Holy, entry at the bottom instead',
      apply: chain(tree(INNER_FOCUS_FROM_HOLY), addEntry({ abilityId: 'inner_focus' })),
    },
    { label: 'shadow_reach 2 -> dark_inspiration 5/5', apply: tree(DARK_INSPIRATION_5) },
  ],

  /*
   * ==========================================================================
   * REVELATION ON THE STAFF, which is the one enchant question the stat weight
   * table cannot answer -- it is a proc and none of it is a stat.
   *
   * THE ARITHMETIC SAYS IT LOSES AND THE MARGIN IS NARROW ENOUGH TO MEASURE.
   * `revelationChance(spellCrit)` is `0.11 * (1 - 2 * spellCrit)`, so at this
   * build's 11.61% spell crit it is **8.45% per non-critting non-periodic
   * spell**. The DoT ticks do not roll -- they are periodic -- but a channel's
   * ticks DO, so the rolls are Mind Flay's 38.5 attempts plus Mind Blast's 8.8
   * plus Shadow Word: Death's 3.5, of which about 41.5 fail to crit: roughly
   * **3.5 procs a fight**, each a guaranteed crit on the next spell.
   *
   * Against that, `+65 Spell Power` is 65 x 0.5340 = **+34.7 DPS** off the
   * weight table. The enchant has to find 34.7 in 3.5 procs, which is 10 DPS a
   * proc, and the proc's chance SHRINKS as crit rises.
   * ==========================================================================
   */
  /*
   * ==========================================================================
   * WHERE INNER FOCUS GOES, SWEPT RATHER THAN REASONED ABOUT.
   *
   * It is FREE and OFF the global cooldown, so it does not displace anything --
   * what its position decides is WHICH SPELL collects the +25% crit, because
   * the aura is spent by the next cast that can crit.
   *
   * `INNER_FOCUS_CRITTABLE` is ['mind_blast', 'mind_flay', 'shadow_word_death']
   * -- the two DoTs are excluded, because a spell that applies an aura and
   * rolls no table has no crit to improve. Average hit off the baseline run:
   * Shadow Word: Death 1607, Mind Blast 1456, a Mind Flay tick 568. So the
   * ordering of these rows is a claim about which of the three it lands on.
   *
   * AND THE BOTTOM OF THE LIST IS WHERE IT CANNOT BE REACHED, measured at
   * **IDENTICAL FIGHTS**: Mind Flay is an ungated filler above it, so a list
   * with anything castable never falls that far. That is the free-off-GCD-
   * cooldown rule -- such an entry goes SECOND, not last.
   * ==========================================================================
   */
  priestInnerFocusPlacement: [
    {
      label: 'above mind_blast (the +6.67 arrangement) -- the control',
      apply: chain(
        tree(INNER_FOCUS_FROM_HOLY),
        addEntry({ abilityId: 'inner_focus' }),
        moveAbove('inner_focus', 'mind_blast'),
      ),
    },
    {
      label: 'second, directly under shadowform',
      apply: chain(
        tree(INNER_FOCUS_FROM_HOLY),
        addEntry({ abilityId: 'inner_focus' }),
        moveAbove('inner_focus', 'blood_fury'),
      ),
    },
    {
      label: 'above shadow_word_pain',
      apply: chain(
        tree(INNER_FOCUS_FROM_HOLY),
        addEntry({ abilityId: 'inner_focus' }),
        moveAbove('inner_focus', 'shadow_word_pain'),
      ),
    },
    {
      label: 'above shadow_word_death',
      apply: chain(
        tree(INNER_FOCUS_FROM_HOLY),
        addEntry({ abilityId: 'inner_focus' }),
        moveAbove('inner_focus', 'shadow_word_death'),
      ),
    },
    {
      label: 'above mind_flay (last castable position)',
      apply: chain(
        tree(INNER_FOCUS_FROM_HOLY),
        addEntry({ abilityId: 'inner_focus' }),
        moveAbove('inner_focus', 'mind_flay'),
      ),
    },
    {
      label: 'above mind_blast, and gated on shadow_word_death being ready',
      apply: chain(
        tree(INNER_FOCUS_FROM_HOLY),
        addEntry({ abilityId: 'inner_focus', condition: ready('shadow_word_death') }),
        moveAbove('inner_focus', 'mind_blast'),
      ),
    },
  ],

  /*
   * The three legal donors for Inner Focus's one point, measured against each
   * other. All three are expected to be worth the same, because every donor is
   * worth nothing -- which is the result, not a disappointment.
   */
  priestInnerFocusDonor: [
    /*
     * THE SAME CONTROL TRAP AS `priestSwpWindow`, AND IT CAUGHT THIS GROUP TOO.
     *
     * `(p) => p` is "whatever is SHIPPED". This row was labelled "13/3/35 --
     * no inner_focus" and was honest exactly until Inner Focus shipped, after
     * which every row in the group read IDENTICAL FIGHTS and the group
     * appeared to say the talent was worth nothing. **A no-op control is a
     * control over the CURRENT list, never over the list it was written
     * against** -- so the reverting row below is written out in full.
     */
    { label: 'the SHIPPED spread and list -- the control', apply: (p) => p },
    {
      label: 'NO inner_focus: back to 13/3/35 and the entry removed',
      apply: chain(tree(CURRENT), removeEntry('inner_focus')),
    },
    {
      label: 'MINIMAL 14/2/35: one point off twilight_focus',
      apply: chain(
        tree(INNER_FOCUS_MINIMAL),
        addEntry({ abilityId: 'inner_focus' }),
        moveAbove('inner_focus', 'shadow_word_pain'),
      ),
    },
    {
      label: '16/0/35: all three off twilight_focus, two parked in mental_agility',
      apply: chain(
        tree(INNER_FOCUS_FROM_HOLY),
        addEntry({ abilityId: 'inner_focus' }),
        moveAbove('inner_focus', 'shadow_word_pain'),
      ),
    },
    {
      label: '13/3/35: one point off meditation instead',
      apply: chain(
        tree(INNER_FOCUS_FROM_MEDITATION),
        addEntry({ abilityId: 'inner_focus' }),
        moveAbove('inner_focus', 'shadow_word_pain'),
      ),
    },
  ],


  /*
   * ==========================================================================
   * SECOND PASS: the two levers the first pass identified and did not measure.
   *
   * 1. THE DoT REFRESH WINDOWS. Both DoTs are gated on `expired(...)`, which is
   *    the owner's own "if not active" wording and the reading that cannot
   *    clip. Measured uptimes are **Shadow Word: Pain 97.4%** and **Devouring
   *    Plague 94.9%**, so there is 2.6% and 5.1% of uptime notionally on the
   *    table -- and Shadow Word: Pain is the best cast in the list at **2242
   *    damage per second of global cooldown**, four times Mind Flay's 554.
   *
   *    THE ARITHMETIC SAYS IT LOSES AND THE SWEEP IS WHAT SETTLES IT. A
   *    refresh RESETS the aura, so a window of N seconds throws N seconds of
   *    ticks away: closing 2.6% of a 10,090-damage DoT is worth about 262
   *    damage, and each early refresh costs a ~528 tick. That is the Moonkin's
   *    Nature's Grace finding -- a two-second window cost 14.9 DPS by doing
   *    nothing but speeding the character up -- so these rows are expected to
   *    be losses and are swept rather than argued about.
   *
   * 2. INNER FOCUS BEFORE THE PULL. It is free and off the global cooldown, so
   *    pre-casting buys nothing it does not already have -- the retracted
   *    `arcane_power` +24.9 is exactly this mistake. What it WOULD change is
   *    which spell eats the buff: pre-cast, the opener's own Mind Blast takes
   *    it at t=0; in the fight it lands on Shadow Word: Death, whose share
   *    rose 10.6% -> 11.3% when the entry shipped. Shadow Word: Death hits for
   *    1,607 against Mind Blast's 1,456, so the in-fight entry should win.
   *
   *    AND THE LEAD MATTERS FOR A REASON THAT IS NOT THE BUFF: a 180-second
   *    cooldown started 3 seconds early comes back 3 seconds sooner, which is
   *    worth something only in a fight long enough to cast it twice.
   * ==========================================================================
   */
  priestRefresh: [
    { label: 'both DoTs on expiry -- the owner\'s wording, the control', apply: (p) => p },
    {
      label: 'shadow_word_pain refreshed at 1s left',
      apply: regate('shadow_word_pain', targetTime('atMost', 1, 'shadow_word_pain')),
    },
    {
      label: 'shadow_word_pain refreshed at 2s left',
      apply: regate('shadow_word_pain', targetTime('atMost', 2, 'shadow_word_pain')),
    },
    {
      label: 'shadow_word_pain refreshed at 3s left',
      apply: regate('shadow_word_pain', targetTime('atMost', 3, 'shadow_word_pain')),
    },
    {
      label: 'devouring_plague refreshed at 2s left',
      apply: regate('devouring_plague', targetTime('atMost', 2, 'devouring_plague')),
    },
    {
      label: 'both refreshed at 2s left',
      apply: chain(
        regate('shadow_word_pain', targetTime('atMost', 2, 'shadow_word_pain')),
        regate('devouring_plague', targetTime('atMost', 2, 'devouring_plague')),
      ),
    },
  ],

  /*
   * ==========================================================================
   * THE FULL SWEEP OF SHADOW WORD: PAIN'S REFRESH WINDOW, because the coarse
   * one found a PEAK where the arithmetic predicted a loss.
   *
   * 1s **+3.88**, 2s **+7.04**, 3s **-11.82** -- monotone either side, and the
   * sign flips between 2 and 3. **THE TICK CADENCE IS WHY.** Shadow Word: Pain
   * ticks every 3 seconds, so a window SHORTER than one tick interval has no
   * tick left inside it to throw away and closes the uptime gap for free; a
   * window of 3 seconds or more clips a real ~528-damage tick. The DoT's
   * period is the boundary, and the measured sign change lands exactly on it.
   *
   * SO THE ARITHMETIC THAT SAID THIS WOULD LOSE WAS RIGHT ABOUT CLIPPING AND
   * WRONG ABOUT WHEN IT STARTS. "A refresh resets the aura, so anything left
   * on the clock is thrown away" is true of TIME and the damage is in TICKS --
   * two seconds of a three-second period is no ticks at all. This is why the
   * procedure says sweep a threshold rather than reason about it.
   * ==========================================================================
   */
  priestSwpWindow: [
    /*
     * TWO SEPARATE ROWS, AND CONFLATING THEM MISREPORTED THIS SWEEP ONCE.
     *
     * `(p) => p` is "whatever is SHIPPED", which is the control every group
     * needs so that "this loses" can be told from "the group did not apply".
     * It was LABELLED "on expiry" -- true on the first run and false the
     * moment a window shipped, at which point the 300s figures were deltas
     * against the 2.0s build rather than against the owner's wording, while
     * the label still said otherwise.
     *
     * `expiryGate` is the real on-expiry reading, stated explicitly so it
     * cannot drift with whatever the list currently holds. **A row is only
     * about what its label says if nothing else can change underneath it.**
     */
    { label: 'the SHIPPED window -- the control', apply: (p) => p },
    { label: 'on expiry -- the owner\'s wording, explicitly', apply: expiryGate },
    {
      label: 'refresh at 0.5s left',
      apply: regate('shadow_word_pain', targetTime('atMost', 0.5, 'shadow_word_pain')),
    },
    {
      label: 'refresh at 1.0s left',
      apply: regate('shadow_word_pain', targetTime('atMost', 1, 'shadow_word_pain')),
    },
    {
      label: 'refresh at 1.5s left',
      apply: regate('shadow_word_pain', targetTime('atMost', 1.5, 'shadow_word_pain')),
    },
    {
      label: 'refresh at 2.0s left',
      apply: regate('shadow_word_pain', targetTime('atMost', 2, 'shadow_word_pain')),
    },
    {
      label: 'refresh at 2.5s left',
      apply: regate('shadow_word_pain', targetTime('atMost', 2.5, 'shadow_word_pain')),
    },
    {
      label: 'refresh at 3.0s left',
      apply: regate('shadow_word_pain', targetTime('atMost', 3, 'shadow_word_pain')),
    },
  ],

  priestInnerFocusPrecombat: [
    { label: 'inner_focus in the list only -- the control', apply: (p) => p },
    {
      label: 'inner_focus ALSO pre-cast at 0s (entry kept)',
      apply: addPrecombat(0, 'inner_focus'),
    },
    {
      label: 'inner_focus pre-cast at 3s, entry removed',
      apply: chain(addPrecombat(3, 'inner_focus'), removeEntry('inner_focus')),
    },
    {
      label: 'inner_focus pre-cast at 0s, entry removed',
      apply: chain(addPrecombat(0, 'inner_focus'), removeEntry('inner_focus')),
    },
  ],
  /*
   * ==========================================================================
   * THE SHADOW WORD: DEATH HOLD BAND, **NOT REOPENED -- RE-PRICED AT A LENGTH
   * THE OWNER'S OWN ARITHMETIC DID NOT COVER.**
   *
   * THE RULING STANDS: the band measured -4.9, was put to the owner with that
   * figure, and the answer was "leave the hold band". `docs/handoff/priest.md`
   * says in as many words: **do not re-raise it on the strength of the
   * measurement.** This group does not propose removing it.
   *
   * WHAT THAT DOCUMENT SAYS WOULD LEGITIMATELY REOPEN IT IS THE ARITHMETIC,
   * and the arithmetic is a function of the CLOCK. The band buys nothing at
   * 60s because Early Demise's window is 11.6 seconds against a 15-second
   * cooldown, so **at most one cast can ever land inside it** -- and an
   * ungated entry already lands that one cast there by itself.
   *
   * BUT THE WINDOW IS A FRACTION OF THE FIGHT AND THE COOLDOWN IS NOT. At 300s
   * the window is five times longer while the cooldown is unchanged, so
   * several casts can fall inside it and the premise of the -4.9 stops
   * holding. Shadow Word: Death goes from 3.52 casts a fight to 13.05.
   *
   * SO THIS IS A FIGURE FOR THE OWNER AND NOT AN EDIT:
   *
   *   PRESET=shadow_priest VARIANTS=priestHoldBand DURATION=300 \
   *     npx vite-node tools/probe_build.ts
   * ==========================================================================
   */
  priestHoldBand: [
    { label: 'the hold band -- the owner\'s ruling, the control', apply: (p) => p },
    { label: 'ungated shadow_word_death (band removed)', apply: ungate('shadow_word_death') },
  ],

  priestRevelation: [
    { label: 'twoHand +65 Spell Power -- the control', apply: (p) => p },
    { label: 'twoHand Revelation (was +65 Spell Power)', apply: enchant('twoHand', 900032) },
    { label: 'twoHand +25 Agility (was +65 Spell Power)', apply: enchant('twoHand', 900031) },
  ],

  /*
   * DARK INSPIRATION'S THREE POINTS CANNOT MOVE, and the harness is what said
   * so rather than a reading of the tree: `treeFor` REFUSED the variant --
   * "illegal tree: wanted 51 legal 43 dropped [early_demise, darkness,
   * shadowform]" -- because three points leaving Shadow row three drops the
   * tree under three later tier gates at once.
   *
   * **SO THE TALENT IS TIER TAX WHATEVER IT DOES**, which is the `requiresRanks`
   * lesson in a different shape: a talent whose own effect is worth little can
   * still be mandatory, and the guard is the cheapest place to find out.
   */
  priestTalents: [
    { label: 'early_demise 2 -> mental_agility 2 (measured -6.26)', apply: tree(NO_EARLY_DEMISE) },
  ],

  /*
   * ============================================================================
   * VAMPIRIC EMBRACE IS THE ENTRY THAT MOVED: removing it is **+39.5 +/- 4.6**.
   *
   * It fired twice a fight for **0.0% of the damage**, because the debuff
   * returns a share of the Priest's Shadow damage to the party as HEALTH and
   * this profile sets `targetAttacks: false` -- so the clause pays out to nobody
   * and the two global cooldowns are a straight loss.
   *
   * NO AUDIT HERE COULD HAVE FOUND IT. `ability_audit` looks for an ability in
   * the book and never cast; `USES=1` flags an entry that never fires. This one
   * fired every fight and dealt nothing. **A healing debuff on a profile nothing
   * attacks is the one shape both checks are blind to.**
   *
   * The talent POINT stays -- Shadowform requires it 1/1 -- so what was removed
   * is the CAST and not the choice. The row below is therefore the control.
   * ============================================================================
   */
  priestApl: [
    { label: 'vampiric_embrace back in the list -- the control', apply: (p) => p },
    { label: 'no devouring_plague entry', apply: removeEntry('devouring_plague') },
    { label: 'no shadow_word_pain entry', apply: removeEntry('shadow_word_pain') },
    { label: 'mind_flay above shadow_word_death', apply: moveAbove('mind_flay', 'shadow_word_death') },
    { label: 'shadow_word_death above mind_blast', apply: moveAbove('shadow_word_death', 'mind_blast') },
  ],

  /*
   * ============================================================================
   * BOTH DoTs BEFORE THE PULL, worth **+35.5 +/- 4.1** together and +26.8 and
   * +26.7 alone.
   *
   * Shadow Word: Pain is 20% of this build and Devouring Plague 12.4%, both pure
   * DoTs with nothing to roll at the pull -- so applying them before it costs NO
   * GLOBAL COOLDOWN where in the fight they cost two. It is the Enhancement
   * Shaman's own Flame Shock line applied to a caster.
   *
   * **THE PAIR IS WORTH LESS THAN THE SUM OF ITS HALVES**: 26.8 + 26.7 = 53.5
   * against a measured 35.5, because both buy the same scarce thing. Marginal
   * values, not addends -- which is why the pair was measured as a pair.
   *
   * AT A 0s LEAD, so each aura is at full duration when the fight starts. A
   * longer lead hands the fight a DoT already partly expired, which is the one
   * thing a real lead costs.
   * ============================================================================
   */
  priestPrecombat: [
    { label: 'no pre-combat DoTs -- the control', apply: chain(removePrecombat('shadow_word_pain'), removePrecombat('devouring_plague')) },
    { label: 'shadow_word_pain at 0s only', apply: removePrecombat('devouring_plague') },
    { label: 'devouring_plague at 0s only', apply: removePrecombat('shadow_word_pain') },
    { label: 'both DoTs at a 5s lead instead of 0s', apply: chain(precombatLead('shadow_word_pain', 5), precombatLead('devouring_plague', 5)) },
    { label: 'no pre-combat mind_blast', apply: removePrecombat('mind_blast') },
    { label: 'mind_blast lead 1.5s -> 0s', apply: precombatLead('mind_blast', 0) },
  ],

  /* The same five-caster loadout. See `mageVariants.ts` for why only these
   * slots have a live question at all -- and all three alternatives lose. */
  priestEnchants: [
    { label: 'head +8 Intellect (was +1% Haste)', apply: enchant('head', 900006) },
    { label: 'legs +8 Intellect (was +1% Haste)', apply: enchant('legs', 900006) },
    { label: 'head +8 Spirit (was +1% Haste)', apply: enchant('head', 900007) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
  ],

  priestConsumables: [
    { label: 'blasted lands +25 Spirit', apply: consumable('blasted_lands', 'blasted_spirit') },
    { label: 'blasted lands +25 Intellect', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
  ],
};
