/*
 * ==============================================================================
 * THE VARIANTS `probe_build.ts` MEASURES ON THE TWO SHAMANS.
 *
 * Written for the owner's six-profile optimisation pass. Client build
 * 1.60.1.70425 removed Call of Thunder, added the ELEMENTAL MASTERY capstone,
 * moved Lava Burst from row 6 to row 4 and renamed Improved Fire Nova -- and
 * Call of Flame's nine seconds of Flame Shock duration were implemented in the
 * same round, which changed what the Elemental list spends its time on.
 *
 * ------------------------------------------------------------------------------
 * THE ELEMENTAL BUILD IS CAST-BOUND AND NOT MANA-BOUND, WHICH IS THE FINDING
 * THAT RULES OUT HALF ITS TREE.
 *
 * It was measured directly: CONVECTION 5/5 is "10% off Shock, Lightning Bolt,
 * Lava Burst and Chain Lightning", bought with ten dead points, and it measured
 * **-0.18 against an interval of 1.63** -- with the cast counts IDENTICAL to the
 * decimal. 25.0 Lightning Bolts, 6.0 Lava Bursts, 3.0 Flame Shocks before and
 * after. The mana was saved and there was nothing to spend it on.
 *
 * SO "A MANA TALENT ON A CASTER" IS SETTLED FOR THIS BUILD and the variants
 * below do not re-ask it. What is left is DAMAGE and CAST TIME.
 *
 * ------------------------------------------------------------------------------
 * AND ITS HIT IS EXACTLY AT THE CAP, WITH A TALENT HOLDING IT THERE. 16.00
 * points against a usable spell cap of 16 -- 17% miss floored at 1% -- and
 * TIDAL FOCUS supplies five of them. So the five Restoration points that look
 * like filler are the difference between 1% and 6% spell miss, which is why no
 * variant here touches them. The three Mages and the Shadow Priest sit at 11
 * and make it up with SCHOOL-scoped hit; the Elemental Shaman's is school-blind
 * and comes from this talent.
 *
 * ------------------------------------------------------------------------------
 * THE ENHANCEMENT BUILD IS A PHYSICAL BUILD WEARING A CASTER'S TREE: Main Hand
 * Auto-Attack 38.3% plus Windfury Attack 22.4% is 61% of it, against Stormstrike
 * 12.8%, Fire Nova 7.7%, Searing Totem 6.2% and Earth Shock 6.1%. Lightning
 * Bolt is 1.2% on 1.8 casts.
 *
 * AND ALMOST NOTHING ON IT MOVED: its list was measured entry by entry and
 * every removal lost -- Fire Nova by **69.6**, even after the client cut its
 * damage 44%. Its one gain was a dead boot enchant, +1.9.
 * ==============================================================================
 */
import {
  type Variant,
  SHAMAN_TREE as tree,
  addPrecombat,
  apl,
  chain,
  consumable,
  enchant,
  moveAbove,
  moveToBottom,
  precombatLead,
  removeEntry,
  removePrecombat,
} from './buildVariants';
import type { AplCondition, AplEntry } from '../src/game/rotations/apl';
import { all, selfStacks, targetHas, targetTime } from '../src/game/rotations/apl';

/*
 * REWRITE ONE ENTRY'S CONDITION, which no shared helper does: `moveAbove` and
 * `removeEntry` change WHERE an entry sits, and a threshold sweep changes WHAT
 * GATES it.
 *
 * IT THROWS ON AN ID THE LIST DOES NOT CARRY, which is the identical-cells
 * failure a one-shot string replace produces, met before any fight is run.
 */
const regate = (abilityId: string, condition: AplCondition | undefined) =>
  apl((entries: AplEntry[]) => {
    const at = entries.findIndex((entry) => entry.abilityId === abilityId);
    if (at < 0) throw new Error(`no entry for ${abilityId}`);
    const { condition: _replaced, ...rest } = entries[at];
    entries[at] = condition === undefined ? rest : { ...rest, condition };
    return entries;
  });

/* --------------------------------------------------------------- the trees */

/**
 * ELEMENTAL, with the ten dead points moved to Convection and Reverberation.
 *
 * KEPT AS A MEASURED NEGATIVE RATHER THAN DELETED. `elemental_warding` 3 is
 * damage taken on a profile nothing attacks, `eye_of_the_storm` 3 is cast
 * pushback, `elemental_reach` 2 is range and `trial_by_fire` 2 is Fire Nova,
 * which the Elemental list never casts -- ten points that provably do nothing.
 * They still measured as NOISE when moved, because the only things left to buy
 * in the tree are MANA, and this build has mana to spare.
 *
 * **TEN DEAD POINTS WITH NOWHERE LIVE TO GO IS A STATEMENT ABOUT THE TREE**,
 * not a failure of the search, and it is the reason this variant is here: a
 * reader who finds Elemental Warding in the owner's spread should see that
 * moving it was tried and measured rather than assume nobody looked.
 */
const ELEMENTAL_NO_DEAD_POINTS = {
  // Elemental, 32
  convection: 5,
  concussion: 5,
  reverberation: 5,
  elemental_alacrity: 3,
  call_of_flame: 3,
  elemental_focus: 1,
  lava_burst: 1,
  lightning_overload: 3,
  elemental_fury: 5,
  elemental_mastery: 1,
  // Enhancement, 6
  thundering_strikes: 5,
  ancestral_knowledge: 1,
  // Restoration, 13
  tidal_focus: 5,
  totemic_focus: 5,
  mindfulness: 3,
};

/**
 * ELEMENTAL, trading the near-dead Restoration filler for +8% Intellect.
 *
 * `totemic_focus` is 25% off a totem cast twice a fight and `mindfulness` is
 * threat; ANCESTRAL KNOWLEDGE is +2% Intellect a rank at Enhancement tier 0, so
 * four of those eight points become +8% Intellect without disturbing a single
 * tier gate. Worth **+2.95 +/- 0.63** -- small, real, and the only talent move
 * on this profile that measured as anything at all. It is the shipped spread.
 */
const ELEMENTAL_INTELLECT = {
  // Elemental, 32 -- unchanged from the owner's spread
  concussion: 5,
  elemental_warding: 3,
  call_of_flame: 3,
  elemental_focus: 1,
  elemental_alacrity: 3,
  trial_by_fire: 2,
  eye_of_the_storm: 3,
  elemental_mastery: 1,
  elemental_reach: 2,
  lightning_overload: 3,
  elemental_fury: 5,
  lava_burst: 1,
  // Enhancement, 10
  thundering_strikes: 5,
  ancestral_knowledge: 5,
  // Restoration, 9
  tidal_focus: 5,
  totemic_focus: 4,
};

/** The control: Ancestral Knowledge back at 1, the filler back in Restoration. */
const ELEMENTAL_OWNER_SPREAD = {
  ...ELEMENTAL_INTELLECT,
  ancestral_knowledge: 1,
  totemic_focus: 5,
  mindfulness: 3,
};

/* ------------------------------------------------- the ENHANCEMENT trees */

/**
 * THE OWNER'S ENHANCEMENT SPREAD, 17/34/0, written out as the control.
 *
 * ------------------------------------------------------------------------------
 * FIVE OF THE 51 POINTS ARE PROVABLY DEAD, AND ONLY THREE OF THE DESTINATIONS
 * ARE ALIVE -- which makes this one of the smallest design spaces in the
 * project, and establishing that is the first result.
 *
 *   elemental_warding 3    damage taken from Fire, Frost and Nature, on a
 *                          profile with `targetAttacks: false`
 *   improved_ghost_wolf 1  a travel form, `scope: 'positioning'`
 *   spirit_weapons 1       an unquantified parry chance plus two threat
 *                          clauses, `scope: 'threat'`
 *
 * AND TWO MORE ARE NEARLY DEAD: `improved_stormstrike` 2 has one clause that
 * can NEVER fire here (a Stormstrike reset on a dodge or parry, and nothing
 * attacks this build) and one -- 50% mana regeneration while casting -- that is
 * live and worth nothing at 1,984 mana of headroom.
 *
 * ------------------------------------------------------------------------------
 * EVERYTHING LIVE IN THE ENHANCEMENT TREE IS ALREADY MAXED, which is why no
 * variant below moves a point INTO it. What is unbought there is
 * `toughness` (stamina), `anticipation` (dodge), `earth_s_grasp` and
 * `guardian_totems` (both `scope: 'totemEntities'`), `improved_lightning_shield`
 * (the shield is not in the book) and the second rank of Improved Ghost Wolf.
 * So the three live destinations are all OUTSIDE it: `reverberation`,
 * `tidal_focus` and the fifth rank of `ancestral_knowledge`.
 *
 * ------------------------------------------------------------------------------
 * THE TIER ARITHMETIC IS WHAT BOUNDS THE SEARCH, and it bounds it twice.
 *
 * ELEMENTAL's seventeen sit exactly on `trial_by_fire`'s tier-15 gate: 5 + 6 + 4
 * below it, which is 15. So Elemental Warding's three dead points may not leave
 * the tree at all -- but they MAY move DOWN a row, which is what makes
 * `reverberation` (row 1) reachable and `tidal_focus` (another tree) not.
 *
 * ENHANCEMENT's thirty-four hold every gate with slack: 17 below tier 15 where
 * 15 is wanted, and 33 below tier 30 where 30 is wanted. So at most **three**
 * points may leave the tree, and at most **two** of those from rows 0-2.
 * `mental_dexterity` 3 and `mental_quickness` 2 are locked by `requiresRanks`
 * on Flurry and on the capstone.
 */
const ENHANCEMENT_OWNER_SPREAD = {
  // Elemental, 17
  concussion: 5,
  elemental_warding: 3,
  call_of_flame: 3,
  elemental_devastation: 3,
  elemental_focus: 1,
  trial_by_fire: 2,
  // Enhancement, 34
  thundering_strikes: 5,
  ancestral_knowledge: 4,
  mental_dexterity: 3,
  improved_ghost_wolf: 1,
  elemental_weapons: 3,
  shamanistic_focus: 1,
  flurry: 5,
  stormstrike: 1,
  spirit_weapons: 1,
  mental_quickness: 2,
  improved_stormstrike: 2,
  maelstrom_weapon: 5,
  rage_of_the_farseer: 1,
};

/** Elemental Warding's three dead points, moved DOWN a row to Reverberation. */
const ENH_REVERBERATION_3 = {
  ...ENHANCEMENT_OWNER_SPREAD,
  elemental_warding: 0,
  reverberation: 3,
};

/** The same three into Convection instead -- the mana control. */
const ENH_CONVECTION_3 = {
  ...ENHANCEMENT_OWNER_SPREAD,
  elemental_warding: 0,
  convection: 3,
};

/** The same three into Elemental Alacrity -- cast time on a bolt already instant. */
const ENH_ALACRITY_3 = {
  ...ENHANCEMENT_OWNER_SPREAD,
  elemental_warding: 0,
  elemental_alacrity: 3,
};

/** Reverberation 5/5: the three plus the two Enhancement rulings. */
const ENH_REVERBERATION_5 = {
  ...ENHANCEMENT_OWNER_SPREAD,
  elemental_warding: 0,
  reverberation: 5,
  improved_ghost_wolf: 0,
  spirit_weapons: 0,
};

/** The two Enhancement rulings into Restoration hit, Elemental untouched. */
const ENH_TIDAL_FOCUS_2 = {
  ...ENHANCEMENT_OWNER_SPREAD,
  improved_ghost_wolf: 0,
  spirit_weapons: 0,
  tidal_focus: 2,
};

/** Reverberation 3 AND two points of spell hit -- the two together. */
const ENH_REVERBERATION_3_TIDAL_2 = {
  ...ENH_REVERBERATION_3,
  improved_ghost_wolf: 0,
  spirit_weapons: 0,
  tidal_focus: 2,
};

/**
 * THREE points of spell hit, which prices Improved Stormstrike's live clause.
 *
 * Taking its second rank is the only way to a third free point, and the clause
 * it costs is 50% mana regeneration while casting on a build with mana to
 * spare. If this beats the two-point row, the mana clause is worth nothing.
 */
const ENH_TIDAL_FOCUS_3 = {
  ...ENHANCEMENT_OWNER_SPREAD,
  improved_ghost_wolf: 0,
  spirit_weapons: 0,
  improved_stormstrike: 1,
  tidal_focus: 3,
};

/** The fifth rank of Ancestral Knowledge, which Mental Dexterity turns into AP. */
const ENH_ANCESTRAL_5 = {
  ...ENHANCEMENT_OWNER_SPREAD,
  improved_ghost_wolf: 0,
  ancestral_knowledge: 5,
};

/**
 * ALL THREE DESTINATIONS AT ONCE, which is what the two point pools allow.
 *
 * Elemental Warding's three may only move DOWN inside Elemental, so they are
 * Reverberation. Improved Ghost Wolf's one is in Enhancement rows 0-2, so
 * spending it on Ancestral Knowledge's fifth rank keeps the tier count where it
 * was and costs nothing; Spirit Weapons' one is in row 4, which is where the
 * slack is, so it can leave the tree for Restoration.
 */
const ENH_ALL_THREE = {
  ...ENH_REVERBERATION_3,
  improved_ghost_wolf: 0,
  ancestral_knowledge: 5,
  spirit_weapons: 0,
  tidal_focus: 1,
};

/** The same two pools, with Spirit Weapons' point in Reverberation instead. */
const ENH_REVERBERATION_4_ANCESTRAL_5 = {
  ...ENHANCEMENT_OWNER_SPREAD,
  elemental_warding: 0,
  reverberation: 4,
  improved_ghost_wolf: 0,
  ancestral_knowledge: 5,
  spirit_weapons: 0,
};

/**
 * REVERBERATION 5 AND ANCESTRAL KNOWLEDGE 5, which needs a SIXTH point and the
 * only one left is Improved Stormstrike's second rank.
 *
 * It moves from Enhancement row 4 to row 0, which is always legal -- a tier gate
 * counts points strictly BELOW it, so moving one down can only raise the count.
 * What it costs is the talent's live clause, 50% mana regeneration while casting
 * for 15 seconds, taken from a 100% chance to a 50% one.
 */
const ENH_REVERBERATION_5_ANCESTRAL_5 = {
  ...ENH_REVERBERATION_5,
  improved_stormstrike: 1,
  ancestral_knowledge: 5,
};

/** Improved Stormstrike's second rank priced on its own, into the same place. */
const ENH_IMPROVED_STORMSTRIKE_1 = {
  ...ENHANCEMENT_OWNER_SPREAD,
  improved_stormstrike: 1,
  ancestral_knowledge: 5,
};

/* -------------------------------------------------------------- the groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
  elementalTalents: [
    { label: 'ancestral_knowledge 1 -> 5 (out of Restoration filler)', apply: tree(ELEMENTAL_INTELLECT) },
    { label: 'back to the owner spread -- the control', apply: tree(ELEMENTAL_OWNER_SPREAD) },
    {
      label: '10 dead points -> convection 5 + reverberation 5 (measured NOISE)',
      apply: tree(ELEMENTAL_NO_DEAD_POINTS),
    },
  ],

  /*
   * THE ELEMENTAL LIST. Elemental Mastery's entry is worth **+24.4** and is
   * shipped; these are the questions left after it. Both maintenance entries
   * are load-bearing -- Searing Totem by 80.4 and Flame Shock by 32.9 -- and
   * Earth Shock as a filler on the shock cooldowns Call of Flame freed up is
   * **-30.3**, because it cost 6.5 Lightning Bolts and pushed the build into
   * its mana.
   */
  elementalApl: [
    { label: 'no elemental_mastery entry -- the control', apply: removeEntry('elemental_mastery') },
    { label: 'no searing_totem entry', apply: removeEntry('searing_totem') },
    { label: 'no flame_shock entry', apply: removeEntry('flame_shock') },
    { label: 'no lava_burst entry', apply: removeEntry('lava_burst') },
  ],

  /*
   * ============================================================================
   * THE PRE-COMBAT DIMENSION, AND ELEMENTAL MASTERY IS THE REASON IT IS HERE.
   *
   * A pre-combat action skips the global cooldown it would start, so a fifteen
   * second window opened at a 0s lead is the SAME window the fight would get,
   * bought for no GCD -- and this build's GCD is the thing it is short of. The
   * list entry is worth +24.4 with the GCD paid; the pre-cast is **+13.9** on
   * top, and Searing Totem moved to the Enhancement opener's own 1.5s lead is
   * **+11.0**. Together **+27.5 +/- 5.0**.
   *
   * THE LEAD CUTS BOTH WAYS AND 0s IS WHAT WINS. The lead is REAL, so 0s gives
   * the full fifteen seconds from the pull and a 5s lead gives ten -- while the
   * cooldown comes back five seconds sooner, which on a three minute cooldown
   * in a hundred second fight buys nothing.
   * ============================================================================
   */
  elementalPrecombat: [
    {
      label: 'elemental_mastery 0s + searing_totem 1.5s before',
      apply: chain(addPrecombat(0, 'elemental_mastery'), addPrecombat(1.5, 'searing_totem')),
    },
    { label: 'elemental_mastery at 0s before only', apply: addPrecombat(0, 'elemental_mastery') },
    { label: 'searing_totem at 1.5s before only', apply: addPrecombat(1.5, 'searing_totem') },
    { label: 'elemental_mastery lead 0s -> 5s', apply: precombatLead('elemental_mastery', 5) },
    { label: 'no pre-combat lightning_bolt', apply: removePrecombat('lightning_bolt') },
    { label: 'no pre-combat flame_shock', apply: removePrecombat('flame_shock') },
  ],

  /*
   * ============================================================================
   * THE ENHANCEMENT TREE, AND ITS DESIGN SPACE IS FIVE DEAD POINTS WITH THREE
   * LIVE DESTINATIONS. `ENHANCEMENT_OWNER_SPREAD` carries why it is that small
   * and what the tier arithmetic allows.
   *
   * THE CONTROL IS THE OWNER'S OWN SPREAD WRITTEN OUT IN FULL, not a delta --
   * a tier gate counts points STRICTLY BELOW it, so a delta can strand a talent
   * five rows down and `createPlayer` drops an illegal one in silence.
   * ============================================================================
   */
  enhancementTalents: [
    { label: "the owner's 17/34/0 -- the control", apply: tree(ENHANCEMENT_OWNER_SPREAD) },
    {
      label: 'warding 3 -> reverberation 3  (shock cooldown 6.0 -> 5.4s)',
      apply: tree(ENH_REVERBERATION_3),
    },
    {
      label: 'warding 3 -> convection 3  (mana -- the control for "is it mana-bound")',
      apply: tree(ENH_CONVECTION_3),
    },
    {
      label: 'warding 3 -> elemental_alacrity 3  (cast time, on a bolt already instant)',
      apply: tree(ENH_ALACRITY_3),
    },
    {
      label: '+ ghost_wolf 1 + spirit_weapons 1 -> reverberation 5  (6.0 -> 5.0s)',
      apply: tree(ENH_REVERBERATION_5),
    },
    {
      label: 'ghost_wolf 1 + spirit_weapons 1 -> tidal_focus 2  (spell miss 9% -> 7%)',
      apply: tree(ENH_TIDAL_FOCUS_2),
    },
    { label: 'reverberation 3 AND tidal_focus 2', apply: tree(ENH_REVERBERATION_3_TIDAL_2) },
    {
      label: '+ improved_stormstrike 2 -> 1 -> tidal_focus 3  (prices its mana clause)',
      apply: tree(ENH_TIDAL_FOCUS_3),
    },
    {
      label: 'ghost_wolf 1 -> ancestral_knowledge 5  (+2% Intellect, which is AP here)',
      apply: tree(ENH_ANCESTRAL_5),
    },
  ],

  /*
   * ============================================================================
   * THE SAME SEARCH NARROWED TO ITS LIVE CELLS AND RE-RUN ON THE FLASK.
   *
   * Pass one measured all nine at 400 iterations and every positive row came
   * back inside its own interval -- the four that move a shock cast carry a
   * spread of 95 to 103, because changing a cast count flips a roll and the two
   * paired fights then decorrelate completely. Three rows were decided there and
   * are not re-asked: Convection and Elemental Alacrity both ran **IDENTICAL
   * FIGHTS**, which is the containment check that the build is neither
   * mana-bound nor casting a Lightning Bolt that has a cast time.
   *
   * AND THE BASELINE MOVED UNDER THEM IN THE SAME ROUND. The flask took spell
   * power from 124 to 274, so Earth Shock's average went 517 to 590 and every
   * figure here is a different question from the one pass one asked: more shocks
   * and better spell hit are both worth more on the new build. **A prior
   * measurement is true of the build it was taken in**, including the build you
   * had an hour ago.
   * ============================================================================
   */
  enhancementTalents2: [
    { label: "the owner's 17/34/0 -- the control", apply: tree(ENHANCEMENT_OWNER_SPREAD) },
    { label: 'reverberation 3 AND tidal_focus 2', apply: tree(ENH_REVERBERATION_3_TIDAL_2) },
    { label: 'reverberation 5', apply: tree(ENH_REVERBERATION_5) },
    { label: 'reverberation 3 only', apply: tree(ENH_REVERBERATION_3) },
    { label: 'tidal_focus 2 only', apply: tree(ENH_TIDAL_FOCUS_2) },
    { label: 'ancestral_knowledge 5 only', apply: tree(ENH_ANCESTRAL_5) },
    {
      label: 'reverberation 3 + ancestral_knowledge 5 + tidal_focus 1',
      apply: tree(ENH_ALL_THREE),
    },
    {
      label: 'reverberation 4 + ancestral_knowledge 5',
      apply: tree(ENH_REVERBERATION_4_ANCESTRAL_5),
    },
    {
      label: 'reverberation 5 + ancestral_knowledge 5  (costs improved_stormstrike 2 -> 1)',
      apply: tree(ENH_REVERBERATION_5_ANCESTRAL_5),
    },
    {
      label: 'improved_stormstrike 2 -> 1 -> ancestral_knowledge 5  (prices that rank alone)',
      apply: tree(ENH_IMPROVED_STORMSTRIKE_1),
    },
  ],

  /*
   * ============================================================================
   * THE OPENER. The owner's three lines are Windfury Weapon at 3s, Searing Totem
   * at 1.5s and Flame Shock at 0s, and Gate B passes: Flame Shock is the one
   * damaging cast and it finishes at the pull.
   *
   * RAGE OF THE FARSEER IS THE ONE CANDIDATE AND ITS ARGUMENT IS THE GCD. It is
   * +30% attack speed for 25 seconds on a 180 second cooldown, it applies an
   * aura and deals nothing, and `abilities/shaman.ts` deliberately leaves it ON
   * the global cooldown -- so a 0s lead buys the whole window for no GCD and
   * cannot fail Gate B. The retraction that matters here is the converse:
   * pre-casting is worth NOTHING on an ability already off the GCD, and this one
   * is not off it.
   * ============================================================================
   */
  enhancementPrecombat: [
    { label: 'rage_of_the_farseer at 0s before', apply: addPrecombat(0, 'rage_of_the_farseer') },
    { label: 'no pre-combat flame_shock', apply: removePrecombat('flame_shock') },
    { label: 'no pre-combat searing_totem', apply: removePrecombat('searing_totem') },
    { label: 'no pre-combat windfury_weapon', apply: removePrecombat('windfury_weapon') },
    { label: 'windfury_weapon lead 3s -> 0s', apply: precombatLead('windfury_weapon', 0) },
  ],

  /*
   * ============================================================================
   * EVERY SHIPPED CHANGE, REVERTED ONE AT A TIME OFF THE FINISHED BUILD -- which
   * is the only reading that can be published beside it, because a figure taken
   * against the baseline the round STARTED from is a figure about a build that
   * no longer exists.
   *
   * MEASURED IN AN ISOLATED WORKTREE AT `e5f45ad`, which this round had to redo:
   * the first pass was run in the shared checkout while four other sessions had
   * uncommitted edits to `talentBuild.ts`, `TalentEffect.ts`, `warriorEffects.ts`
   * and `probe_build.ts` in it. **The measurement tool itself was one of the
   * modified files.** Every figure from that pass is reported here only where
   * this group reproduces it.
   * ============================================================================
   */
  enhancementShipped: [
    { label: 'the shipped build -- the control', apply: (p) => p },
    {
      label: 'REVERT the talents: reverberation 5 -> the owner 17/34/0',
      apply: tree(ENHANCEMENT_OWNER_SPREAD),
    },
    {
      label: 'REVERT the flask: +150 Spell Power -> +1200 Hit Points',
      apply: consumable('flask', 'flask_hit_points'),
    },
    {
      label: 'REVERT the food: +20 Strength -> +40 Attack Power',
      apply: consumable('food', 'food_attack_power'),
    },
    {
      label: 'REVERT both consumable rows together',
      apply: chain(
        consumable('flask', 'flask_hit_points'),
        consumable('food', 'food_attack_power'),
      ),
    },
    {
      label: 'REVERT the bolt position: back above stormstrike',
      apply: moveAbove('lightning_bolt', 'stormstrike'),
    },
    {
      label: 'REVERT the pre-cast racial: no 0s rage_of_the_farseer',
      apply: removePrecombat('rage_of_the_farseer'),
    },
    {
      label: 'REVERT everything shipped -- the round, end to end',
      apply: chain(
        tree(ENHANCEMENT_OWNER_SPREAD),
        consumable('flask', 'flask_hit_points'),
        consumable('food', 'food_attack_power'),
        moveAbove('lightning_bolt', 'stormstrike'),
        removePrecombat('rage_of_the_farseer'),
      ),
    },
  ],

  /*
   * FIRE NOVA AFTER A 44% DAMAGE CUT: removing it is **-69.6**, so it is still
   * the fourth-largest source on this profile and stays where the owner put it.
   * Its position is noise.
   */
  enhancementApl: [
    { label: 'no fire_nova entry', apply: removeEntry('fire_nova') },
    { label: 'fire_nova above earth_shock', apply: moveAbove('fire_nova', 'earth_shock') },
    { label: 'no lightning_bolt entry', apply: removeEntry('lightning_bolt') },
    { label: 'no earth_shock entry', apply: removeEntry('earth_shock') },
    { label: 'no searing_totem entry', apply: removeEntry('searing_totem') },
    { label: 'no flame_shock entry', apply: removeEntry('flame_shock') },
    { label: 'no stormstrike entry', apply: removeEntry('stormstrike') },
    { label: 'no rage_of_the_farseer entry', apply: removeEntry('rage_of_the_farseer') },
  ],

  /*
   * ============================================================================
   * THE EARTH SHOCK GATE, SWEPT. The owner's condition is "Flame Shock has at
   * least 3 seconds left", and it exists because all three shocks are ONE
   * `cooldownGroup` -- spending the group on Earth Shock while Flame Shock is
   * about to drop costs the burn as well as the hit.
   *
   * SWEPT RATHER THAN COMPARED, because two readings somebody wrote down are two
   * cells of a curve and the peak sits between them as often as not.
   *
   * THE SHOCKS ARE NEAR-SATURATED AT THE DEFAULT CLOCK -- 5.90 Earth Shocks plus
   * 3.22 Flame Shocks against 10 charges in 60 seconds -- so this gate decides
   * WHICH shock gets a charge rather than whether one is spent at all.
   * ============================================================================
   */
  enhancementShockGate: [
    { label: "flame_shock >= 3s left -- the owner's gate, the control", apply: (p) => p },
    {
      label: 'flame_shock >= 1s left',
      apply: regate('earth_shock', targetTime('atLeast', 1, 'flame_shock')),
    },
    {
      label: 'flame_shock >= 2s left',
      apply: regate('earth_shock', targetTime('atLeast', 2, 'flame_shock')),
    },
    {
      label: 'flame_shock >= 5s left',
      apply: regate('earth_shock', targetTime('atLeast', 5, 'flame_shock')),
    },
    {
      label: 'flame_shock >= 8s left',
      apply: regate('earth_shock', targetTime('atLeast', 8, 'flame_shock')),
    },
    {
      label: 'flame_shock merely PRESENT (has, not the clock)',
      apply: regate('earth_shock', targetHas('flame_shock')),
    },
    { label: 'ungated', apply: regate('earth_shock', undefined) },
  ],

  /*
   * ============================================================================
   * THE STORMSTRIKE DEBUFF, WHICH IS THE ONE PIECE OF STATE THIS LIST DOES NOT
   * READ, AND THE MAELSTROM THRESHOLD BESIDE IT.
   *
   * Stormstrike leaves "+20% to your next Lightning Bolt, Chain Lightning or
   * EARTH SHOCK for 12 sec", consumed by the SPELL rather than by the clock --
   * each of the three removes the aura in its own `onCast`. Its debuff uptime is
   * **50.6%**, and Stormstrike fires 7.66 times a fight against Earth Shock 5.90
   * plus Lightning Bolt 1.80, which is 7.70. **Every charge is already being
   * consumed**, so the question is not whether one is wasted but WHICH spell
   * takes it: the bolt averages 418 damage against the shock's 517, so the same
   * 20% is 84 against 103.
   *
   * AND THE MAELSTROM THRESHOLD IS 5 BECAUSE FIVE STACKS MAKE THE BOLT INSTANT.
   * Below that it is a real cast -- 0.5s at four stacks, 1.0s at three -- and a
   * cast with a cast time RESETS THE SWING TIMER, which is 60.7% of this
   * profile's damage. An instant does not: `castAbility` returns before the
   * reset when `castTime <= 0`. So the two cells below are not a sweep of a
   * damage trade, they are a sweep of how much swing time a bolt is worth.
   * ============================================================================
   */
  enhancementStormstrike: [
    {
      label: 'earth_shock also requires the stormstrike debuff',
      apply: regate(
        'earth_shock',
        all(targetTime('atLeast', 3, 'flame_shock'), targetHas('stormstrike')),
      ),
    },
    {
      label: 'lightning_bolt to the bottom (so the shock takes the debuff)',
      apply: moveAbove('lightning_bolt', 'fire_nova'),
    },
    { label: 'lightning_bolt below stormstrike', apply: moveAbove('lightning_bolt', 'flame_shock') },
    {
      label: 'maelstrom threshold 5 -> 4 (a 0.5s cast, which resets the swing)',
      apply: regate('lightning_bolt', selfStacks('atLeast', 4, 'maelstrom_weapon')),
    },
    {
      label: 'maelstrom threshold 5 -> 3 (a 1.0s cast)',
      apply: regate('lightning_bolt', selfStacks('atLeast', 3, 'maelstrom_weapon')),
    },
  ],

  /*
   * ============================================================================
   * LIGHTNING BOLT'S POSITION, SWEPT ACROSS THE WHOLE LIST.
   *
   * It is the first damage entry in the owner's list and it CONTENDS WITH EARTH
   * SHOCK FOR THE STORMSTRIKE DEBUFF -- "+20% to your next Lightning Bolt, Chain
   * Lightning or Earth Shock", consumed by whichever of the three casts first.
   * At the top of the list the bolt takes that charge the instant Maelstrom
   * reaches five stacks, and the shock is the harder-hitting of the two.
   *
   * SWEPT RATHER THAN MOVED ONCE, because position IS priority and every step
   * down passes a different entry: the two maintenance entries and the racial
   * block cost the bolt nothing, and only Earth Shock and Fire Nova can take a
   * decision away from it. A single A/B could not say which step did the work.
   *
   * AND THE BOLT CANNOT SIMPLY BE DELAYED FOR FREE. Maelstrom Weapon caps at
   * five stacks and lasts 30 seconds, so a bolt held too long wastes the procs
   * that would have been its sixth stack -- which is the same shape as the Cat's
   * Shifting Power, where GATING a resource-granter raised what it collected.
   * ============================================================================
   */
  enhancementBoltPosition: [
    { label: "top of the damage entries -- the owner's position, the control", apply: (p) => p },
    { label: 'below stormstrike', apply: moveAbove('lightning_bolt', 'flame_shock') },
    { label: 'below flame_shock', apply: moveAbove('lightning_bolt', 'searing_totem') },
    {
      label: 'below searing_totem',
      apply: moveAbove('lightning_bolt', 'rage_of_the_farseer'),
    },
    { label: 'below the racial', apply: moveAbove('lightning_bolt', 'earth_shock') },
    { label: 'below earth_shock', apply: moveAbove('lightning_bolt', 'fire_nova') },
    { label: 'the very bottom, below fire_nova', apply: moveToBottom('lightning_bolt') },
  ],

  /*
   * THE ELEMENTAL LOADOUT IS THE SAME FIVE-CASTER ONE, so the same slots are
   * the only live questions -- see `mageVariants.ts`, which carries the
   * argument: the cloak and feet slots offer a caster NOTHING, so their
   * `unmodelled` enchants are dead by table rather than by choice.
   */
  elementalEnchants: [
    { label: 'head +8 Intellect (was +1% Haste)', apply: enchant('head', 900006) },
    { label: 'legs +8 Intellect (was +1% Haste)', apply: enchant('legs', 900006) },
    { label: 'gloves +1% Haste (was +20 Spell Power)', apply: enchant('gloves', 900002) },
  ],

  /*
   * ============================================================================
   * THE ENHANCEMENT SHAMAN HAD A DEAD ENCHANT ITS SLOT COULD ACTUALLY FIX, which
   * none of the five casters does: its boots carried MINOR SPEED, and the feet
   * slot offers +7 AGILITY -- which a 61%-physical build reads in full. Worth
   * **+1.9 +/- 1.8**, and it was the one free enchant in the six profiles: a
   * slot worth zero with a live option in the same table. It is shipped, so the
   * row below is the control.
   *
   * EVERYTHING ELSE STAYS ON STRENGTH, measured rather than assumed: +15 Agility
   * for +15 Strength is -1.7, +8 Agility on the head is -1.0, and haste on the
   * head, legs or gloves is noise against an interval of 11.
   * ============================================================================
   */
  enhancementEnchants: [
    { label: 'feet Minor Speed (was +7 Agility) -- the control', apply: enchant('feet', 900025) },
    { label: 'feet +7 Stamina', apply: enchant('feet', 900027) },
    { label: 'gloves +15 Agility (was +15 Strength)', apply: enchant('gloves', 900022) },
    { label: 'head +8 Agility (was +8 Strength)', apply: enchant('head', 900003) },
    { label: 'head +1% Haste (was +8 Strength)', apply: enchant('head', 900002) },
    { label: 'legs +1% Haste (was +8 Strength)', apply: enchant('legs', 900002) },
    { label: 'gloves +1% Haste (was +15 Strength)', apply: enchant('gloves', 900002) },
  ],

  /*
   * ============================================================================
   * THE TWO-HAND ENCHANT, WHICH NO EARLIER ROUND ASKED ABOUT AT ALL -- and it is
   * the biggest single enchant on any profile.
   *
   * THE OTHER NINE SLOTS ARE SETTLED BY ARITHMETIC AND NEED NO FIGHT, off this
   * build's own stat weights at 1500 paired iterations (baseline 765.9):
   *
   *     strength 0.3956   intellect 0.3296   agility 0.2845
   *     spellPower 0.2227   attackPower 0.1798   1% haste 2.88 +/- 2.38
   *     dodgeChance / armor / defenseSkill / stamina / spirit / manaPer5  ZERO
   *
   * head +8 Str 3.16 beats +8 Int 2.64 and +8 Agi 2.28; neck +5 Str 1.98 beats
   * +6 SP 1.34; chest +4 Stats 4.04 is the only live option; gloves +15 Str 5.93
   * beats +20 SP 4.45 and +15 Agi 4.27; cloak +5 Agi and feet +7 Agi are each
   * the only live option in their table. **WRISTS IS THE ONE TIE**: +9 Strength
   * is 3.560 and +16 Spell Power is 3.563, which is a dead heat the measurement
   * cannot split -- so it is here as a cell rather than as an arithmetic answer,
   * and the flask row below is what could break the tie by moving spell power.
   *
   * CRUSADER IS 1.1 PROCS A MINUTE OF +100 STRENGTH FOR 15s, and the report
   * reads its aura at **44.8% uptime** -- so about 44.8 effective strength,
   * 17.7 DPS by the weight above, against +65 Spell Power's 14.5 and +25
   * Agility's 7.1. A PROC IS ONE OF THE FIVE ENCHANTS THE WEIGHT TABLE CANNOT
   * SETTLE, so it gets a fight.
   * ============================================================================
   */
  enhancementWeaponEnchant: [
    { label: 'twoHand Crusader -- the control', apply: (p) => p },
    { label: 'twoHand +65 Spell Power', apply: enchant('twoHand', 900029) },
    { label: 'twoHand +25 Agility', apply: enchant('twoHand', 900031) },
    { label: 'twoHand Revelation', apply: enchant('twoHand', 900032) },
    { label: 'twoHand Enchant Weapon - Spell Power (+30)', apply: enchant('twoHand', 22749) },
    { label: 'wrists +16 Spell Power (was +9 Strength) -- the 3.560 vs 3.563 tie', apply: enchant('wrists', 900018) },
  ],

  /*
   * ============================================================================
   * THE CONSUMABLES, AND THE FLASK ROW IS THE LARGEST UNASKED QUESTION ON THIS
   * PROFILE.
   *
   * `hybridConsumables` gives all four of its callers `flask_hit_points`, and
   * the three Paladins that want otherwise OVERRIDE it per preset -- Retribution
   * and both Shockadins carry `flask_spell_power`, and HANDOVER round 9 priced
   * that pair at +59.9 and +73.3. **The Enhancement Shaman was never asked.**
   *
   * +1200 HIT POINTS REACHES NOTHING HERE: `targetAttacks` is false, so health
   * never leaves maximum, and a Shaman has no `D x 10 / H` rage rule for a
   * bigger pool to feed. +150 Spell Power is 150 x 0.2227 = **33.4 DPS** by the
   * weight table.
   *
   * AND SPELL POWER BEATS ATTACK POWER PER POINT ON A 73.5% PHYSICAL BUILD,
   * which reads like a contradiction and is not: attack power sits at 1,965 and
   * spell power at 124, so a point of the second is a far larger share of the
   * 26.4% it reaches. That is also why the potion row does not divide -- +40
   * Spell Power for 30s beats +40 Attack Power for 30s, 4.45 against 3.60.
   *
   * THE FOOD ROW IS THE SAME ARITHMETIC THAT MOVED FOUR OTHER PROFILES: +40
   * Attack Power is 7.19 and +20 Strength is 7.91.
   * ============================================================================
   */
  enhancementConsumables: [
    { label: 'flask +150 Spell Power (was +1200 Hit Points)', apply: consumable('flask', 'flask_spell_power') },
    { label: 'food +20 Strength (was +40 Attack Power)', apply: consumable('food', 'food_strength') },
    { label: 'food +28 Spell Power', apply: consumable('food', 'food_spell_power') },
    { label: 'food +20 Agility', apply: consumable('food', 'food_agility') },
    { label: 'blasted lands +25 Intellect (was +25 Strength)', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'blasted lands +25 Agility', apply: consumable('blasted_lands', 'blasted_agility') },
    { label: 'school power Nature (was Fire)', apply: consumable('school_spell_power', 'school_nature') },
    { label: 'potion Major Frenzy (was Spellblasting)', apply: consumable('potion', 'major_frenzy_potion') },
    { label: 'main-hand weapon effect +1% Spell Crit & +36 Spell Power', apply: consumable('weapon_effect_main_hand', 'weapon_spell_crit_main_hand') },
    { label: 'main-hand weapon effect +8 Weapon Damage', apply: consumable('weapon_effect_main_hand', 'dense_sharpening_stone_main_hand') },
    { label: 'other Healthstone (was the Demonic Rune, which fires 0.00 times)', apply: consumable('other', 'healthstone') },
  ],

  /* Every alternative lost on both Shamans. Kept so that can be re-derived. */
  shamanConsumables: [
    { label: 'school power Fire', apply: consumable('school_spell_power', 'school_fire') },
    { label: 'school power Nature', apply: consumable('school_spell_power', 'school_nature') },
    { label: 'blasted lands +25 Intellect', apply: consumable('blasted_lands', 'blasted_intellect') },
    { label: 'potion Major Mana (was Spellblasting)', apply: consumable('potion', 'major_mana_potion') },
  ],
};
