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
  chain,
  consumable,
  enchant,
  moveAbove,
  precombatLead,
  removeEntry,
  removePrecombat,
} from './buildVariants';

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

/* -------------------------------------------------------------- the groups */

export const VARIANT_GROUPS: Readonly<Record<string, readonly Variant[]>> = {
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
