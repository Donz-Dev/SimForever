/*
 * ==============================================================================
 * THE FIRE MAGE, OPTIMISED DIMENSION BY DIMENSION.
 *
 *   PRESET=mage_fire VARIANTS=fireApl npx vite-node tools/probe_build.ts
 *
 * ------------------------------------------------------------------------------
 * THE FIVE INVARIANTS, read off `encode_talent_build.mjs --all` and the preset
 * rather than off anybody's memory. **None of these may move:**
 *
 *   class          mage
 *   majority tree  FIRE, 31 of 51 (15 Arcane / 31 Fire / 5 Frost)
 *   style          caster, a two-handed staff, no off hand
 *   stance/form    none -- `stance: 'battle'` is the profile default and inert
 *   target         standing. `encounter.targetAttacks: false`
 *
 * THE PRESET'S OWN `detail` STRING SAID "39 Fire / 10 Arcane", which is the
 * spread from before round 8 respecified it. Derive the theme, do not recall it.
 *
 * ------------------------------------------------------------------------------
 * WHERE ITS DAMAGE IS, off a 30-fight `USES=1` run at **996.7 +/- 6.6 DPS** on
 * the ILLEGAL opener (see `fireGateB`), which is the build these groups were
 * first written against:
 *
 *   fireball         28.8%  on 10.1 casts     the filler
 *   pyroblast        19.2%  on  4.1 casts     at exactly 3 Heating Up stacks
 *   arcane_missiles  15.7%  on  3.9 casts     free, on a Missile Barrage proc
 *   Ignite           14.2%  not in the list
 *   fire_blast       12.9%  on  6.2 casts     and the Heating Up engine
 *   scorch            9.2%  on  6.8 casts     cast for the Fire Vulnerability
 *
 * ------------------------------------------------------------------------------
 * IT IS GLOBAL-COOLDOWN BOUND AT 60s AND MANA BOUND BY 300s, which is the same
 * regime change the Arcane Mage shows and it decides the whole APL pass.
 * `probe_resources` plus the clock read, 40 fights a row:
 *
 *   fight    DPS    mana headroom    combustion casts    evocation casts
 *   60s    1040.1            2782                1.00               0.00
 *   120s    967.2            3313                1.00               0.63
 *   180s    949.1            1670                1.02               1.00
 *   300s    796.0             231                2.00               1.00
 *
 * SO TWO "SETTLED" FACTS ABOUT THIS PROFILE ARE FACTS ABOUT A ONE-MINUTE CLOCK.
 * Evocation's pinned zero -- reported to the owner and ruled "This is intended"
 * -- holds at 60s and NOT at 120s, and Combustion's placement can only be
 * judged past 180s, which is the `arcane_power` lesson on a second profile.
 *
 * DAMAGE PER SECOND OF GLOBAL COOLDOWN, which is the ranking a GCD-bound build
 * is sorted by, computed off that same run:
 *
 *   pyroblast at 3 stacks   2947 / 1.5s   1965
 *   arcane_missiles         2631 / 2.5s   1052     free, and half duration
 *   fire_blast              1347 / 1.5s    898
 *   fireball                1781 / 2.5s    712     includes its own burn
 *   scorch                   843 / 1.5s    562     cast for the DEBUFF
 *
 * ------------------------------------------------------------------------------
 * **THE OWNER RULED COMBUSTION OFF THE GLOBAL COOLDOWN PART-WAY THROUGH THIS
 * FILE'S LIFE, AND IT MOVED FOUR FIGURES THAT WERE ALREADY WRITTEN DOWN.** The
 * shipped build went **1016.2 -> 1040.1**, and `fireGcd`'s question is answered:
 *
 *   pre-casting Combustion    -4.69 `noise`  ->  **-36.38 `real`**
 *   Fire Blast's CC gate      +7.68 `real`   ->  **+3.44** at 4,000 iterations
 *   the Scorch window         +9.83          ->  **+10.75**
 *   the Eureka gate           +6.81          ->  **+5.45**
 *
 * SO EVERY FIGURE IN THE GROUP COMMENTS BELOW IS DATED BY WHICH SIDE OF THAT
 * RULING IT WAS TAKEN ON, and each one says so. A prior measurement is true of
 * the build it was taken in, and that applies to the build you had an hour ago.
 *
 * ------------------------------------------------------------------------------
 * AND THREE GROUPS HAVE ROWS THAT ARE NOW SILENT NO-OPS, which is worth knowing
 * before reading an `IDENTICAL FIGHTS` verdict here as a finding. `replace()`
 * maps over the entries and leaves the list alone when nothing matches, so:
 *
 *   `fireWindows` / `fireRevert`  the potion rows match NOTHING, because the
 *                                 potion is a `sequence` STEP now and not an
 *                                 entry with an `abilityId` of its own
 *   `fireGates`                   the `3s -> 5s` row restates what shipped
 *   `fireApl`                     `mage_armor` is gone, so that row is SKIPPED
 *
 * A row that cannot apply reports `IDENTICAL FIGHTS` exactly like a change worth
 * nothing. The groups are kept as they were taken rather than rewritten, because
 * the figures in the write-up were measured with them in this shape.
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
  moveAbove,
  removeEntry,
  removePrecombat,
} from './buildVariants';
import {
  all,
  any,
  hasReaction,
  selfHas,
  selfMissing,
  selfStacks,
  selfTime,
  targetStacks,
  targetTime,
} from '../src/game/rotations/apl/shorthand';
import { foreverEnchantId } from '../src/game/items/foreverEnchants';
import type { AplEntry } from '../src/game/rotations/apl';

/* --------------------------------------------------------------- the trees */

/** The shipped spread, written out in full as the control: 15 Arcane / 31 Fire / 5 Frost. */
const CURRENT = {
  // Arcane, 15
  arcane_focus: 5,
  arcane_concentration: 5,
  arcane_impact: 3,
  missile_barrage: 2,
  // Fire, 31
  improved_fire_blast: 1,
  incineration: 3,
  improved_fireball: 5,
  ignite: 5,
  pyroblast: 1,
  improved_scorch: 3,
  heating_up: 1,
  master_of_elements: 3,
  critical_mass: 5,
  fire_power: 3,
  combustion: 1,
  // Frost, 5
  elemental_precision: 5,
};

/*
 * ==============================================================================
 * THE FIRE TREE IS FORCED AND THE ARCANE ONE IS NOT, WHICH IS WHERE THE WHOLE
 * TALENT PASS LIVES.
 *
 * Combustion sits at tier 30 and `pointsBelowTier` counts STRICTLY below it, so
 * the 30 Fire points under it are all load-bearing: take one out anywhere and
 * the capstone is refunded. What is NOT forced is WHICH of them, and the Fire
 * tree has exactly TWO unspent slots that are not a declared `OutOfScope`
 * member -- `improved_fire_blast`'s second rank and `blast_wave`. Everything
 * else left in Fire is range (`flame_throwing`), a stun (`impact`), threat and
 * cast pushback (`burning_soul`), an absorb (`improved_fire_ward`) or an area
 * spell nothing here can use (`improved_flamestrike`).
 *
 * SO THE DONOR IS THE QUESTION. The candidates, and why each is one:
 *
 *   arcane_concentration 5/5   Clearcasting -- "reduces the mana cost of your
 *                              next damage spell by 100%". **This build ends a
 *                              60-second fight with 2,782 mana unspent**, so
 *                              five points buy a saving on a pool that does not
 *                              bind, and the aura's own uptime is 4.3%.
 *   master_of_elements 3/3     a mana REFUND on a Fire crit, 957 mana a fight.
 *                              The same argument, from inside the Fire tree.
 *   arcane_impact 3/3          +6% crit to ARCANE spells, which on this build is
 *                              Arcane Missiles alone -- 15.7% of the damage.
 *   elemental_precision 5/5    NOT a candidate. Its fifth point is the Fire hit
 *                              cap and measured +10.8 when it was bought; all
 *                              three Mages sit at 11 points of school-blind hit
 *                              against a usable spell cap of 16.
 *
 * AND `improved_fire_blast` IS THE DESTINATION TO WANT, for two reasons rather
 * than one: Fire Blast is 898 damage a second of global cooldown against the
 * filler's 712, AND it is the Heating Up engine -- "Fire Blast grants an
 * additional stack every time it deals damage", so a crit gives two. Its second
 * rank is 1 second off a 7-second cooldown.
 * ==============================================================================
 */

/** One point of Clearcasting buys Fire Blast's second cooldown rank: 7s -> 6s. */
const FIRE_BLAST_FROM_CLEARCASTING = {
  ...CURRENT,
  arcane_concentration: 4,
  improved_fire_blast: 2,
};

/** The same point out of the mana refund instead, which leaves Arcane whole. */
const FIRE_BLAST_FROM_MASTER_OF_ELEMENTS = {
  ...CURRENT,
  master_of_elements: 2,
  improved_fire_blast: 2,
};

/** And out of Arcane Missiles' crit, which is the third mana-indifferent donor. */
const FIRE_BLAST_FROM_ARCANE_IMPACT = {
  ...CURRENT,
  arcane_impact: 2,
  improved_fire_blast: 2,
};

/** Two points of Clearcasting: Fire Blast's rank AND Blast Wave, an instant on 45s. */
const FIRE_BLAST_AND_BLAST_WAVE = {
  ...CURRENT,
  arcane_concentration: 3,
  improved_fire_blast: 2,
  blast_wave: 1,
};

/** Blast Wave alone, so the two halves above are separable. */
const BLAST_WAVE_ONLY = {
  ...CURRENT,
  arcane_concentration: 4,
  blast_wave: 1,
};

/**
 * CLEARCASTING OUT ENTIRELY, with all five points parked in `improved_channeling`
 * -- pure cast pushback, a declared `OutOfScope` member, and five ranks at tier
 * 0 of ARCANE. So this prices the TALENT rather than a swap, which is the only
 * way to know whether the donor above is free.
 *
 * THE FIRST VERSION OF THIS WAS AN ILLEGAL TREE AND `treeFor` CAUGHT IT, which
 * is exactly what that guard is for. The five were parked in `flame_throwing`,
 * `improved_fire_ward` and `burning_soul`: 51 points, the right total, every
 * one of them provably inert -- and all three are in FIRE, so Arcane fell from
 * 15 points to 10 and `arcane_impact` at tier 10 lost its own tier gate. The
 * probe printed `SKIPPED: illegal tree ... dropped [arcane_impact]` instead of
 * measuring a build nobody chose and reporting it as a finding.
 */
const NO_CLEARCASTING = {
  ...CURRENT,
  arcane_concentration: 0,
  improved_channeling: 5,
};

/* ---------------------------------------------------------------- APL parts */

/** Replace an entry in place, so a threshold sweep moves nothing else. */
const replace = (id: string, entry: AplEntry): Apply =>
  apl((entries) => entries.map((e) => (e.abilityId === id ? entry : e)));

/**
 * THE ARRANGEMENT THE COMBUSTION STACK REPLACED, restored by hand.
 *
 * ==============================================================================
 * `replace('major_spellblasting_potion', ...)` CANNOT EXPRESS THIS ANY MORE AND
 * IS ACTIVELY WRONG. The potion is the `abilityId` of the two-step stack now, so
 * swapping that entry for a bare potion throws COMBUSTION away with it -- which
 * is what two rows in this file did for one run, reporting **-64.11** and
 * **-77.24** that were the missing three-minute cooldown rather than anything
 * either row claimed to measure.
 *
 * SO THE REVERT IS WRITTEN OUT: the stack entry becomes a plain Combustion entry
 * with the same condition, and the potion goes back where the shared block had
 * it -- an entry of its own, above, which is the arrangement the sequence
 * replaced. The `gated` flag picks whether it carries the Combustion-aura gate
 * this round shipped or the ungated row the block ships.
 * ==============================================================================
 */
const withoutTheStack = (gated: boolean): Apply =>
  chain(
    replace('major_spellblasting_potion', {
      abilityId: 'combustion',
      condition: all(
        targetStacks('atLeast', 5, 'fire_vulnerability'),
        targetTime('atLeast', 10, 'fire_vulnerability'),
      ),
    }),
    addAbove(
      gated
        ? { abilityId: 'major_spellblasting_potion', condition: selfHas('combustion') }
        : { abilityId: 'major_spellblasting_potion' },
      'evocation',
    ),
  );

/**
 * THE OWNER'S FROSTFIRE SALVAGE, AIMED AT THE FIRE LIST. Heating Up is
 * `consumedByCast: 'all'`, so a build that reaches two stacks and then does not
 * reach three throws BOTH away. Two stacks is two thirds of the cast-time
 * reduction, so spending there is worse than waiting -- everywhere except in
 * the last moment before the waiting costs everything.
 *
 * MUTUALLY EXCLUSIVE WITH THE ENTRY ABOVE IT by construction, `exactly 3`
 * against `exactly 2`, so the order between the two decides nothing.
 */
const PYROBLAST_SALVAGE: AplEntry = {
  abilityId: 'pyroblast',
  condition: all(selfStacks('exactly', 2, 'heating_up'), selfTime('atMost', 3.5, 'heating_up')),
};

const FIRE_BLAST_UNGATED: AplEntry = { abilityId: 'fire_blast' };

const combustionGate = (secondsLeft: number): AplEntry => ({
  abilityId: 'combustion',
  condition: all(
    targetStacks('atLeast', 5, 'fire_vulnerability'),
    targetTime('atLeast', secondsLeft, 'fire_vulnerability'),
  ),
});

const scorchGate = (refreshSeconds: number): AplEntry => ({
  abilityId: 'scorch',
  condition: all(
    hasReaction('improved_scorch'),
    any(
      targetStacks('below', 5, 'fire_vulnerability'),
      targetTime('atMost', refreshSeconds, 'fire_vulnerability'),
    ),
  ),
});

/* ------------------------------------------------------------------- groups */

export const VARIANT_GROUPS: Record<string, readonly Variant[]> = {
  /*
   * ==========================================================================
   * GATE B: THE OPENER FINISHES TWO DAMAGING CASTS AND MAY FINISH ONE.
   *
   * The owner's ruling: "Once you deal damage or finish casting a damaging
   * ability combat has started." Their own opener is `mage_armor` at 4.5s and
   * `fireball` at 3s; the `scorch` at 1.5s is THIS PROJECT'S addition, recorded
   * at +15.2 +/- 10.2 in the preset's own comment, and it is the second
   * damaging cast. `docs/profile-optimisation.md` Appendix A has it as one of
   * the three profiles still failing the gate.
   *
   * SO THIS GROUP IS NOT A CHOICE. The revert ships whatever it measures, the
   * way the Arcane Mage's four illegal casts did at -96.5. The figure is for
   * the write-up, not for the decision.
   * ==========================================================================
   */
  fireGateB: [
    { label: 'the shipped opener, ILLEGAL -- the control', apply: (p) => p },
    { label: 'legal: the pre-pull scorch reverted', apply: removePrecombat('scorch') },
  ],

  fireTalents: [
    { label: '15/31/5 -- the control', apply: tree(CURRENT) },
    {
      label: 'improved_fire_blast 2/2, from arcane_concentration',
      apply: tree(FIRE_BLAST_FROM_CLEARCASTING),
    },
    {
      label: 'improved_fire_blast 2/2, from master_of_elements',
      apply: tree(FIRE_BLAST_FROM_MASTER_OF_ELEMENTS),
    },
    {
      label: 'improved_fire_blast 2/2, from arcane_impact',
      apply: tree(FIRE_BLAST_FROM_ARCANE_IMPACT),
    },
    { label: 'improved_fire_blast 2/2 AND blast_wave', apply: tree(FIRE_BLAST_AND_BLAST_WAVE) },
    { label: 'blast_wave alone, from arcane_concentration', apply: tree(BLAST_WAVE_ONLY) },
    { label: 'arcane_concentration 0/5 -- prices Clearcasting', apply: tree(NO_CLEARCASTING) },
  ],

  /*
   * ==========================================================================
   * THE ENCHANTS ARE ARITHMETIC EXCEPT FOR ONE SLOT, which is what the stat
   * weight table is for. At 1500 paired iterations on this build:
   *
   *   Crit rating    6.7019 per 1%   +/- 1.9081
   *   Haste          6.1868 per 1%   +/- 1.5235
   *   Spell power    0.6925 per pt   +/- 0.0030
   *   Intellect      0.1326 per pt   +/- 0.0501
   *   everything else                 nothing: this build cannot read it
   *
   * SO EIGHT OF THE TEN ARMOUR SLOTS ARE SETTLED WITHOUT A FIGHT, and two of
   * them are settled as DEAD: every option the cloak and the feet offer --
   * dodge, agility, armour, stamina, threat, Minor Speed, defense skill --
   * weighs zero on a caster nothing attacks. The shipped loadout is the best
   * available in all eight: +20 Spell Power beats +1% Haste on the gloves by
   * 13.85 to 6.19, and +1% Haste beats +8 Intellect on the head and legs by
   * 6.19 to 1.06.
   *
   * WHAT IS LEFT IS THE WEAPON, which carries the one enchant on this profile
   * that is not a stat: Revelation is a proc, so the table cannot price it.
   * ==========================================================================
   */
  fireEnchants: [
    { label: '+65 Spell Power on the staff -- the control', apply: (p) => p },
    {
      label: 'Revelation on the staff, instead of the 65',
      apply: enchant('twoHand', foreverEnchantId('Revelation')),
    },
    {
      label: '+25 Agility on the staff -- the sign check',
      apply: enchant('twoHand', foreverEnchantId('+25 Agility')),
    },
    {
      label: '+8 Intellect on the head -- the table predicts -5.1',
      apply: enchant('head', foreverEnchantId('+8 Intellect')),
    },
  ],

  /*
   * ==========================================================================
   * THE OPENER'S WHOLE REMAINING DESIGN SPACE IS ONE ACTION, once the illegal
   * Scorch is out. An addition may not reorder or replace an owner line; the
   * two lines they wrote are a buff and the pull; and a pre-cast is worth only
   * the global cooldown it saves -- so nothing already off the GCD is a
   * candidate at all, which rules out the potion, the rune and the racial.
   *
   * WHICH LEAVES COMBUSTION, and it is a candidate ONLY because it is on the
   * global cooldown (see `fireGcd` in the write-up). Its own comment in
   * `presets.ts` records -4.9 +/- 11.6 on the illegal build; this re-prices it
   * on the legal one, where the pull arrives with ZERO Fire Vulnerability
   * stacks rather than one.
   * ==========================================================================
   */
  firePrecombat: [
    { label: 'mage_armor 4.5s + fireball 3s -- the control', apply: (p) => p },
    { label: 'combustion added at a 0s lead', apply: addPrecombat(0, 'combustion') },
    {
      label: 'the pre-pull fireball removed -- prices the owner line',
      apply: removePrecombat('fireball'),
    },
  ],

  /*
   * ==========================================================================
   * THE APL: ORDER. The build is GCD-bound, so the question is what fills a
   * global cooldown, and the damage-per-second-of-GCD table in this file's
   * header is the ranking to test against. Arcane Missiles is SECOND in it and
   * sits fifth from the bottom of the list.
   *
   * THE COUNTER-ARGUMENT IS SLACK: Missile Barrage lasts twenty seconds, so a
   * proc does not have to be spent at once -- and its measured uptime (15.1%,
   * about 9 seconds) is almost exactly the 3.65 casts x 2.5s of channel it
   * pays for, which says the window is already being spent as it lands.
   *
   * AND `mage_armor` IS A DEAD ENTRY, the Arcane audit's first finding repeated
   * here: `USES=1` reports 1.0 uses and that use is the PRE-COMBAT cast charged
   * to the entry. The buff lasts THIRTY MINUTES, so unlike Combustion no fight
   * length brings the entry back.
   * ==========================================================================
   */
  fireApl: [
    { label: 'the shipped order -- the control', apply: (p) => p },
    { label: 'mage_armor entry removed -- the dead entry', apply: removeEntry('mage_armor') },
    { label: 'arcane_missiles above fire_blast', apply: moveAbove('arcane_missiles', 'fire_blast') },
    { label: 'arcane_missiles above pyroblast', apply: moveAbove('arcane_missiles', 'pyroblast') },
    { label: 'fire_blast above pyroblast', apply: moveAbove('fire_blast', 'pyroblast') },
    { label: 'scorch below pyroblast', apply: moveAbove('pyroblast', 'scorch') },
    { label: 'combustion above pyroblast', apply: moveAbove('combustion', 'pyroblast') },
  ],

  /*
   * ==========================================================================
   * THE APL: GATES. Three thresholds, each SWEPT rather than compared against
   * one alternative somebody wrote down.
   *
   * SCORCH'S REFRESH WINDOW CLIPS, which is the failure this project has
   * already paid for on the Moonkin: refreshing a 30-second debuff at 3 seconds
   * left throws 3 seconds away, Fire Vulnerability is at 99.9% uptime, and the
   * only thing the window buys is Scorch casts at 562 damage a second of global
   * cooldown -- the worst row in the header's table.
   *
   * THE PYROBLAST SALVAGE IS THE OWNER'S OWN FROSTFIRE LINE, and whether the
   * Fire list wants it too is a question the Frostfire ruling does not answer:
   * a ruling covers what it says.
   * ==========================================================================
   */
  fireGates: [
    { label: 'the shipped gates -- the control', apply: (p) => p },
    { label: 'scorch refresh window 3s -> 1s', apply: replace('scorch', scorchGate(1)) },
    { label: 'scorch refresh window 3s -> 2s', apply: replace('scorch', scorchGate(2)) },
    { label: 'scorch refresh window 3s -> 5s', apply: replace('scorch', scorchGate(5)) },
    { label: 'scorch refresh window 3s -> 8s', apply: replace('scorch', scorchGate(8)) },
    {
      label: 'a pyroblast salvage at 2 stacks, 3.5s left',
      apply: addAbove(PYROBLAST_SALVAGE, 'combustion'),
    },
    {
      label: 'fire_blast ungated -- drops the Clearcasting hold',
      apply: replace('fire_blast', FIRE_BLAST_UNGATED),
    },
    { label: 'combustion floor 10s -> 0s', apply: replace('combustion', combustionGate(0)) },
    { label: 'combustion floor 10s -> 20s', apply: replace('combustion', combustionGate(20)) },
  ],

  /*
   * ==========================================================================
   * THE TWELVE STAT ROWS ARE SETTLED BY THE SAME TABLE THE ENCHANTS ARE, and
   * every one is already the best option its category offers -- a caster flask,
   * the caster weapon stone, Intellect in the Blasted Lands row, Fire in the
   * school row, and Spell Power food. Three rows are worth literally nothing
   * here (Hit Points, Armor, and the OFF-HAND weapon stone on a build with no
   * off hand) and a row worth nothing is not a row that should be blank.
   *
   * WHAT NEEDS A FIGHT IS THE TWO ACTION ROWS, because `potion` and `other`
   * carry an ability and get a list entry -- so WHEN is a decision. The written
   * rule is that `other` takes the pool the build runs out of and `potion`
   * takes the damage buff, and at 60s this build runs out of nothing.
   * ==========================================================================
   */
  /*
   * ==========================================================================
   * THE SCORCH WINDOW, SWEPT FINER, because the first sweep found its peak at
   * the EDGE of what was tried and in the direction nobody predicted.
   *
   *   1s  -26.81    2s  -14.53    3s  0 (shipped)    5s  +12.76    8s  +5.99
   *
   * THE HYPOTHESIS WAS THAT THE WINDOW CLIPS, which is the Moonkin's Nature's
   * Grace failure: refreshing a 30-second debuff at 3 seconds left throws 3
   * seconds away. It is the wrong model for THIS debuff, and the sweep is what
   * said so rather than an argument -- **losing Fire Vulnerability costs FIVE
   * Scorch casts to rebuild from zero**, so a wider margin is cheap insurance
   * and a tighter one is a gamble against a 2.5-second Fireball being in flight
   * when the debuff lapses. That is why the curve turns over above 5s too:
   * refreshing at 8s really is clipping.
   *
   * A TWO-POINT COMPARISON AT 3s AND 1s WOULD HAVE CONCLUDED "KEEP 3".
   * ==========================================================================
   */
  fireScorchWindow: [
    { label: 'the shipped 3s -- the control', apply: (p) => p },
    { label: 'scorch refresh window 4s', apply: replace('scorch', scorchGate(4)) },
    { label: 'scorch refresh window 5s', apply: replace('scorch', scorchGate(5)) },
    { label: 'scorch refresh window 6s', apply: replace('scorch', scorchGate(6)) },
    { label: 'scorch refresh window 7s', apply: replace('scorch', scorchGate(7)) },
    { label: 'scorch refresh window 10s', apply: replace('scorch', scorchGate(10)) },
  ],

  /*
   * ==========================================================================
   * THE TWO FREE DAMAGE WINDOWS ARE UNGATED, AND THE ARCANE ROUND LEFT THIS
   * HERE BY NAME: "Eureka is gated on this build and nowhere else", recorded in
   * `mage.ts` because the ruling arrived as an audit of the Arcane profile and
   * a list is changed for the profile that was named.
   *
   * THIS PROFILE IS ALSO A GNOME. Eureka! is an 8-second window of +10%
   * non-periodic damage, off the global cooldown and free, and in the shared
   * `RACIAL_COOLDOWNS` block it carries no condition -- so it is spent on
   * whatever the first poll of the fight happens to be. On the LEGAL opener
   * that poll is a target with ZERO Fire Vulnerability stacks, which is the
   * worst eight seconds of the fight to spend a damage window in.
   *
   * THE MAJOR SPELLBLASTING POTION IS THE SAME SHAPE -- 40 spell power for 30
   * seconds, ungated in `CONSUMABLE_COOLDOWNS`, and the owner's own Arcane list
   * holds it for a cooldown.
   *
   * GATING THE BLOCK IS NOT AVAILABLE: that constant is spread into lists
   * belonging to no race, so a condition written there would be a condition on
   * three abilities this character cannot cast. Each gate is a change to THIS
   * list, which is what the filter-and-restate does.
   * ==========================================================================
   */
  fireWindows: [
    { label: 'both ungated -- the control', apply: (p) => p },
    {
      label: 'eureka on 5 Fire Vulnerability stacks',
      apply: replace('eureka', {
        abilityId: 'eureka',
        condition: targetStacks('atLeast', 5, 'fire_vulnerability'),
      }),
    },
    {
      label: 'eureka on a Combustion window',
      apply: replace('eureka', { abilityId: 'eureka', condition: selfHas('combustion') }),
    },
    {
      label: 'eureka on a Missile Barrage proc -- the Arcane answer',
      apply: replace('eureka', { abilityId: 'eureka', condition: selfHas('missile_barrage') }),
    },
    {
      label: 'eureka on 3 Heating Up stacks',
      apply: replace('eureka', {
        abilityId: 'eureka',
        condition: selfStacks('exactly', 3, 'heating_up'),
      }),
    },
    /*
     * THE TWO POTION ROWS ARE GONE FROM THIS GROUP. They were
     * `replace('major_spellblasting_potion', ...)` against a list where the
     * potion was an entry of its own; it is the `abilityId` of the Combustion
     * stack now, so the same call deletes a three-minute cooldown. Their
     * figures -- +0.72 on five stacks and +1.07 on a Combustion window, both
     * taken before the Combustion ruling -- are in the write-up, and
     * `fireRevert`'s `withoutTheStack` rows are how the pairing is priced now.
     */
    { label: 'eureka removed entirely -- the sign check', apply: removeEntry('eureka') },
  ],

  /*
   * ==========================================================================
   * THE TWO BEST EUREKA GATES ARE A TIE AND THE QUESTION IS WHETHER THEY ADD.
   * 3 Heating Up stacks is +5.34 +/- 0.55 and a Combustion window +4.69 +/-
   * 0.42, which is 0.65 apart against a combined interval of 0.69 -- so the
   * first sweep cannot separate them and these rows ask whether either gate is
   * leaving windows unspent that the other would catch.
   *
   * AND A GATE THAT IS NEVER TRUE WOULD BE WORSE THAN NO GATE, which the
   * `eureka removed entirely` sign check prices at -8.94. `any` of the two is
   * the version that cannot strand the cooldown.
   * ==========================================================================
   */
  fireWindowPairs: [
    { label: 'both ungated -- the control', apply: (p) => p },
    {
      label: 'eureka on 3 Heating Up stacks',
      apply: replace('eureka', {
        abilityId: 'eureka',
        condition: selfStacks('exactly', 3, 'heating_up'),
      }),
    },
    {
      label: 'eureka on EITHER 3 stacks or Combustion',
      apply: replace('eureka', {
        abilityId: 'eureka',
        condition: any(selfStacks('exactly', 3, 'heating_up'), selfHas('combustion')),
      }),
    },
    {
      label: 'eureka on 3 stacks AND the potion on Combustion',
      apply: chain(
        replace('eureka', {
          abilityId: 'eureka',
          condition: selfStacks('exactly', 3, 'heating_up'),
        }),
        replace('major_spellblasting_potion', {
          abilityId: 'major_spellblasting_potion',
          condition: selfHas('combustion'),
        }),
      ),
    },
    {
      label: 'eureka on EITHER, and the potion on Combustion',
      apply: chain(
        replace('eureka', {
          abilityId: 'eureka',
          condition: any(selfStacks('exactly', 3, 'heating_up'), selfHas('combustion')),
        }),
        replace('major_spellblasting_potion', {
          abilityId: 'major_spellblasting_potion',
          condition: selfHas('combustion'),
        }),
      ),
    },
  ],

  /*
   * ==========================================================================
   * ISOLATING THE TALENT SWAP, BECAUSE THE FIRST READING WAS WRONG IN A WAY
   * THAT LOOKED LIKE A FINDING.
   *
   * `blast_wave alone, from arcane_concentration` measured **+2.59 +/- 1.70
   * real** -- and Blast Wave is in no priority list, so it is never cast. Every
   * point of that figure is the OTHER half of the variant: one fewer rank of
   * Arcane Concentration. A variant that moves a point moves two things.
   *
   * AND THE REASON ONE RANK OF CLEARCASTING IS WORTH NEGATIVE DPS IS THE FIRE
   * BLAST GATE. `fire_blast` is gated on `selfLacks('clearcasting')`, so every
   * proc HOLDS an 898-damage-a-second instant to protect a mana saving on a
   * build with 2,782 mana spare -- which is why `arcane_concentration 0/5`
   * (+10.02) and `fire_blast ungated` (+8.50) are nearly the same number.
   *
   * SO THESE ROWS ASK WHETHER THE DONOR CHOICE SURVIVES THE GATE RULING. If
   * Clearcasting is worth nothing even with the gate gone, the point may be
   * taken from it whatever the owner decides about Fire Blast.
   * ==========================================================================
   */
  fireDonor: [
    { label: 'the shipped tree and gate -- the control', apply: (p) => p },
    {
      label: 'arcane_concentration 4/5, point parked inert -- prices ONE rank',
      apply: tree({ ...CURRENT, arcane_concentration: 4, improved_channeling: 1 }),
    },
    {
      label: 'fire_blast ungated, and arcane_concentration 0/5',
      apply: chain(
        replace('fire_blast', FIRE_BLAST_UNGATED),
        tree({ ...CURRENT, arcane_concentration: 0, improved_channeling: 5 }),
      ),
    },
    {
      label: 'fire_blast ungated, tree untouched',
      apply: replace('fire_blast', FIRE_BLAST_UNGATED),
    },
    {
      label: 'fire_blast ungated, and improved_fire_blast 2/2 from Clearcasting',
      apply: chain(
        replace('fire_blast', FIRE_BLAST_UNGATED),
        tree(FIRE_BLAST_FROM_CLEARCASTING),
      ),
    },
    {
      label: 'blast_wave taken AND given a list entry at the bottom',
      apply: chain(tree(BLAST_WAVE_ONLY), addEntry({ abilityId: 'blast_wave' })),
    },
  ],

  /*
   * ==========================================================================
   * THE KNOCK-ON CHECK. Two winners measured separately against one baseline do
   * not add and can INVERT -- the Firelock's mana potion beat Spellblasting
   * alone and lost to it paired with the Demonic Rune -- so the package is
   * measured as a package before anything ships.
   *
   * THE GATE B REVERT IS IN EVERY ROW BUT THE CONTROL, because it is not a
   * candidate: the opener may finish one damaging cast and finishes two. So the
   * `legal` row is the honest floor this round starts from and the rest is
   * measured against the shipped illegal build, which is what the published
   * figure was taken on.
   * ==========================================================================
   */
  fireCombined: [
    { label: 'the shipped ILLEGAL build -- the control', apply: (p) => p },
    { label: 'legal only (Gate B)', apply: removePrecombat('scorch') },
    {
      label: 'legal + scorch window 5s',
      apply: chain(removePrecombat('scorch'), replace('scorch', scorchGate(5))),
    },
    {
      label: 'legal + window + improved_fire_blast 2/2',
      apply: chain(
        removePrecombat('scorch'),
        replace('scorch', scorchGate(5)),
        tree(FIRE_BLAST_FROM_CLEARCASTING),
      ),
    },
    {
      label: 'legal + window + talent + both windows gated',
      apply: chain(
        removePrecombat('scorch'),
        replace('scorch', scorchGate(5)),
        tree(FIRE_BLAST_FROM_CLEARCASTING),
        replace('eureka', {
          abilityId: 'eureka',
          condition: selfStacks('exactly', 3, 'heating_up'),
        }),
        replace('major_spellblasting_potion', {
          abilityId: 'major_spellblasting_potion',
          condition: selfHas('combustion'),
        }),
      ),
    },
    {
      label: 'all of it, and the dead mage_armor entry out',
      apply: chain(
        removePrecombat('scorch'),
        replace('scorch', scorchGate(5)),
        tree(FIRE_BLAST_FROM_CLEARCASTING),
        replace('eureka', {
          abilityId: 'eureka',
          condition: selfStacks('exactly', 3, 'heating_up'),
        }),
        replace('major_spellblasting_potion', {
          abilityId: 'major_spellblasting_potion',
          condition: selfHas('combustion'),
        }),
        removeEntry('mage_armor'),
      ),
    },
  ],

  /*
   * ==========================================================================
   * THE WINDOW RE-SWEPT ON THE LEGAL BUILD, because a prior measurement is true
   * of the build it was taken in and the Gate B revert moved the baseline by
   * -24.2. Every row here reverts the illegal Scorch first, so the control is
   * the legal build rather than the shipped one.
   * ==========================================================================
   */
  fireScorchLegal: [
    { label: 'legal, shipped 3s window -- the control', apply: removePrecombat('scorch') },
    {
      label: 'legal, window 4s',
      apply: chain(removePrecombat('scorch'), replace('scorch', scorchGate(4))),
    },
    {
      label: 'legal, window 5s',
      apply: chain(removePrecombat('scorch'), replace('scorch', scorchGate(5))),
    },
    {
      label: 'legal, window 6s',
      apply: chain(removePrecombat('scorch'), replace('scorch', scorchGate(6))),
    },
    {
      label: 'legal, window 8s',
      apply: chain(removePrecombat('scorch'), replace('scorch', scorchGate(8))),
    },
    {
      label: 'legal, window 2s',
      apply: chain(removePrecombat('scorch'), replace('scorch', scorchGate(2))),
    },
  ],

  /*
   * ==========================================================================
   * DOES THE PACKAGE HOLD AT A LONGER CLOCK? Run with `DURATION=300`, and read
   * it as a REVERT from the shipped build rather than as an addition to the old
   * one -- the shipped build is the baseline now, and these rows put each piece
   * back.
   *
   * THE QUESTION IS NOT ACADEMIC. This profile is global-cooldown bound at 60s
   * with 2,615 mana spare and MANA bound by 300s with 196 -- so the two changes
   * that spend more mana per global cooldown are exactly the ones that could
   * invert. Scorch is the most mana-efficient spell the build has (150 mana for
   * about 843, against Fireball's 410 for 1,781) and the wider refresh window
   * casts FEWER of them; `improved_fire_blast` 2/2 casts MORE Fire Blasts at
   * 340 mana each.
   * ==========================================================================
   */
  fireClock: [
    { label: 'the shipped package -- the control', apply: (p) => p },
    { label: 'the scorch window back to 3s', apply: replace('scorch', scorchGate(3)) },
    { label: 'improved_fire_blast 2/2 -- NOT SHIPPED, see below', apply: tree(FIRE_BLAST_FROM_CLEARCASTING) },
    {
      label: 'the scorch window at 3s AND improved_fire_blast 2/2',
      apply: chain(replace('scorch', scorchGate(3)), tree(FIRE_BLAST_FROM_CLEARCASTING)),
    },
    { label: 'the scorch window at 8s', apply: replace('scorch', scorchGate(8)) },
    { label: 'the scorch window at 2s', apply: replace('scorch', scorchGate(2)) },
  ],

  /*
   * ==========================================================================
   * THE WHOLE ROUND, AS A REVERT FROM WHAT SHIPS. The shipped build is the
   * baseline now, so every row here puts one piece back -- which is the only
   * honest direction once the package has landed, and it is also what makes the
   * `DURATION=` re-run a one-command check.
   *
   *   PRESET=mage_fire VARIANTS=fireRevert ITER=1500 npx vite-node tools/probe_build.ts
   *   PRESET=mage_fire VARIANTS=fireRevert ITER=600 DURATION=300 npx vite-node tools/probe_build.ts
   *
   * THE ILLEGAL SCORCH IS PUT BACK IN ONE ROW, and that row is not a candidate
   * for anything: it is there so the price of the ruling stays measurable from
   * the build that obeys it.
   * ==========================================================================
   */
  fireRevert: [
    { label: 'what ships -- the control', apply: (p) => p },
    { label: 'the scorch window back to 3s', apply: replace('scorch', scorchGate(3)) },
    {
      label: 'eureka ungated again',
      apply: replace('eureka', { abilityId: 'eureka' }),
    },
    { label: 'the stack back to two entries, potion GATED', apply: withoutTheStack(true) },
    { label: 'the stack back to two entries, potion UNGATED', apply: withoutTheStack(false) },
    {
      label: 'both windows ungated again',
      apply: chain(replace('eureka', { abilityId: 'eureka' }), withoutTheStack(false)),
    },
    {
      label: 'the whole round reverted, including the ILLEGAL scorch',
      apply: chain(
        replace('scorch', scorchGate(3)),
        replace('eureka', { abilityId: 'eureka' }),
        withoutTheStack(false),
        addPrecombat(1.5, 'scorch'),
      ),
    },
    {
      label: 'the whole round reverted but the opener kept LEGAL',
      apply: chain(
        replace('scorch', scorchGate(3)),
        replace('eureka', { abilityId: 'eureka' }),
        withoutTheStack(false),
      ),
    },
  ],

  /*
   * ==========================================================================
   * `fireSequence` IS DELETED, AND WHAT IT MEASURED IS WORTH KEEPING.
   *
   * It asked whether Combustion and the potion should be ONE `AplEntry.sequence`
   * rather than two entries held together by both being off the global
   * cooldown -- the Arcane round's shape, whose verdict is "measure it as
   * neutral and ship it as structure." It measured **bit-identical fights** at
   * 1500 paired iterations and shipped.
   *
   * AND ITS FIRST VERSION MEASURED **-14.81 +/- 0.08** BECAUSE THE ENTRY WAS
   * MALFORMED. `selectAction` casts `entry.abilityId` and sets
   * `pendingSequence.index = 0`, so `sequence` holds the steps AFTER the id --
   * naming the first step in both places casts it, finds it on cooldown on the
   * resume, clears the pointer, and the SECOND step never fires. The tell was
   * the spread: 0.08 on 1500 paired iterations is the same loss in every fight.
   *
   * IT IS DELETED RATHER THAN KEPT BECAUSE IT CANNOT BE RE-RUN AGAINST THE
   * LIST IT PRODUCED. Every row swapped the potion ENTRY for something else,
   * and the potion is the `abilityId` of the stack now -- so each row threw
   * Combustion away and reported a large loss that was the missing cooldown.
   * A group that cannot apply reports a figure that reads like a finding, which
   * is the one thing a variant file must not do. `git log` has it.
   * ==========================================================================
   */

  /*
   * ==========================================================================
   * THE CLEARCASTING GATE, RE-PRICED AT 4000 ITERATIONS BECAUSE THE RULING
   * SHRANK IT. It measured **+7.68 +/- 3.22 `real`** while Combustion paid a
   * global cooldown and **+2.96 +/- 3.26 `noise`** once it stopped -- which is
   * a knock-on rather than a contradiction: the build has one more free global
   * cooldown now, so holding a 1.5-second instant costs less of one.
   *
   * THIS IS THE QUESTION PUT TO THE OWNER, so whether it survives the answer to
   * the OTHER question matters more than the figure.
   * ==========================================================================
   */
  fireClearcasting: [
    { label: 'the owner gate, shipped -- the control', apply: (p) => p },
    {
      label: 'fire_blast ungated',
      apply: replace('fire_blast', FIRE_BLAST_UNGATED),
    },
    {
      label: 'fire_blast gated on Clearcasting having 0 charges left to waste',
      apply: replace('fire_blast', {
        abilityId: 'fire_blast',
        condition: any(
          selfMissing('clearcasting'),
          targetStacks('below', 5, 'fire_vulnerability'),
        ),
      }),
    },
  ],

  fireConsumables: [
    { label: 'Spellblasting + Demonic Rune -- the control', apply: (p) => p },
    {
      label: 'the Major Mana Potion instead of Spellblasting',
      apply: consumable('potion', 'major_mana_potion'),
    },
  ],
};
