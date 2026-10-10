import type { Rotation } from '../../engine';
import type { AplList } from './apl';
import { RACIAL_COOLDOWNS, RACIAL_DEFENSIVE_COOLDOWNS } from './racialCooldowns';
import { CONSUMABLE_COOLDOWNS, CONSUMABLE_HEALS } from './consumableCooldowns';
import {
  all,
  comboPoints,
  compileRotation,
  not,
  resource,
  selfHas,
  selfHealth,
  selfStacks,
  targetExpired,
  targetHas,
} from './apl';
import type { CombatStyleId } from '../character';
import { MAX_COMBO_POINTS } from '../combat/comboPoints';

/**
 * Druid priority lists.
 *
 * ----------------------------------------------------------------------------
 * THE RULESET OWNER'S OWN LISTS. Every list in this file was specified by them,
 * entry by entry, and measured after -- so a number taken off one describes the
 * ruleset rather than this file's guess.
 *
 * IT SAID THE OPPOSITE FOR MOST OF THIS PROJECT'S LIFE, and the header that
 * said so was doing real work: "these are the standard shape of each build and
 * are NOT the ruleset owner's own lists, which have not been given." That is
 * how a shell is supposed to read, and it is why the figures measured off one
 * were never mistaken for the ruleset's.
 *
 * CHOSEN BY FORM, not by talents. A Druid's form IS its combat style, and a
 * style is a field on the character -- so unlike the Rogue, whose three specs
 * are all dual-wield and had to be told apart by their capstone, this is the
 * Warrior's arrangement: the style selects the list.
 * ----------------------------------------------------------------------------
 */



/*
 * ============================================================================
 * THE RULESET OWNER'S CONDITIONS. These three lists are theirs; what was here
 * before was this file's own guess and said so.
 * ============================================================================
 */

/**
 * "IF NOT ACTIVE", which is the owner's wording and NOT the two-second refresh
 * window that `missing` implements.
 *
 * A refresh RESETS an aura, so a window throws away whatever is left -- and the
 * faster the character acts, the sooner it reaches the entry inside the window
 * and the more it clips.
 *
 * MEASURED ON THIS CLASS. Nature's Grace cost the Moonkin 14.9 DPS doing
 * nothing but speeding it up: casts went 26.3 a fight to 27.4 while Moonfire
 * ticks fell 25.1 to 22.5 and Insect Swarm's 27.9 to 25.5. The buff was fine;
 * the two-second window was paying for it. `missing` and `REFRESH_WINDOW_MS`
 * are gone from this file with the lists that used them.
 */
const expired = targetExpired;

/** "<buff> duration > 0", on the Druid. */
const selfActive = selfHas;

/** "<buff> stacks >= N", on the Druid. */
const selfStacksAtLeast = (auraId: string, minimum: number) =>
  selfStacks('atLeast', minimum, auraId);

/**
 * The energy ceiling Shifting Power is gated on, from the owner's condition.
 *
 * FIFTY IS THE OWNER'S FIGURE AND IS NOT THE ARITHMETIC BOUNDARY, which is the
 * thing to not quietly "correct". They stated it -- "only uses Shifting Power if
 * current energy is <= 50" -- and the point at which the ability's 40 energy
 * starts overflowing a 100 cap is **60**, so 50 sits ten energy inside the
 * no-waste region rather than on its edge. Both readings waste nothing and the
 * owner's is the one implemented.
 */
export const SHIFTING_POWER_ENERGY_CEILING = 50;

/** "energy <= N". */
const energyAtMost = (maximum: number) => resource('atMost', maximum, 'energy');

/** "rage >= N". */
const rageAtLeast = (minimum: number) => resource('atLeast', minimum, 'rage');

/** "hit points <= N% of maximum". */
const healthAtMostFraction = (fraction: number) => selfHealth('atMost', fraction);

/** "combo points = N", read THROUGH the target so a stale pool reads zero. */
const exactlyPoints = (count: number) => comboPoints('exactly', count);

/** "<debuff> is on the target". */
const hasDebuff = targetHas;

/** Every condition must hold. */

/** The condition must NOT hold. */

/*
 * ----------------------------------------------------------------------------
 * A FORM IS NOT AN ABILITY HERE, so "moonkin form if not active", "cat form if
 * not active" and "bear form if not active" are absent from the three lists
 * below rather than unimplemented.
 *
 * A Druid's form is its COMBAT STYLE -- a field the preset sets and the
 * character is built with -- not an aura and not something in the spellbook.
 * Every profile starts in the right form and cannot leave it, so the entry
 * would be a no-op even if it existed.
 *
 * IT WOULD BECOME REAL WORK the day form-shifting is modelled mid-fight, and
 * that same day would have to answer why nothing currently stops a Cat casting
 * Starfire: the engine gates on WARRIOR STANCES and on nothing else.
 *
 * WHAT THAT DOES *NOT* BLOCK, and this file helped spread the confusion. The
 * form being fixed is why nothing can pay out ON A SHIFT; it is not a reason a
 * talent cannot read WHICH FORM IS HELD. Three Druid talents were written up as
 * blocked on shapeshifting and were only ever blocked on a declaration --
 * `BuildRequirement.styles` -- because the style is knowable before the pull.
 * Two remain, Furor and Natural Shapeshifter, and both genuinely need the shift.
 * ----------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------

/**
 * MOONKIN — two damage-over-time effects held up, then Starfire.
 *
 * Starfire is 350-412 for 340 mana on a 3.5 second cast; Wrath is 86-96 for 120
 * on a 2 second one. Starfire is far better per cast AND per mana, so Wrath
 * appears only as the filler that keeps Eclipse stacking.
 *
 * TWO FIGURES IN THAT SENTENCE HAVE EXPIRED SINCE IT WAS WRITTEN, which is why
 * they are corrected rather than left: Wrath was 62-68 at client build
 * 1.60.1.69876 and is 86-96 now, and Eclipse "currently stacks and does
 * nothing" stopped being true when the one-shot cast rule landed. Both were
 * right on the day.
 *
 * AND THE TWO DoT ENTRIES ARE WORTH MORE THAN THEY WERE. Nature's Splendor
 * lengthens Moonfire by three seconds and Insect Swarm by two, which is a fifth
 * tick and a seventh -- so "if not active" holds each one up for longer and the
 * list reaches Starfire more often.
 */
export const DRUID_MOONKIN: AplList = {
  name: 'Druid (Moonkin)',
  entries: [
  { abilityId: 'moonfire', condition: expired('moonfire') },
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_COOLDOWNS,
  ...CONSUMABLE_HEALS,
  { abilityId: 'insect_swarm', condition: expired('insect_swarm') },
  /*
   * TWO STARFIRE ENTRIES, and the second is not a duplicate. Eclipse charges
   * shorten Starfire's cast and Nature's Grace shortens every cast AND the
   * global cooldown -- so the owner's first entry spends charges freely when
   * there are two or more, and the second spends the LAST one only while
   * Nature's Grace is up, which is the window where it is worth most.
   *
   * A repeated ability id is legal and is checked for the shape that is not:
   * a copy below an UNCONDITIONAL one, which can never be reached. Both of
   * these are gated, and the ungated filler below is Wrath.
   */
  {
    abilityId: 'starfire',
    condition: selfStacksAtLeast('eclipse', 2),
  },
  {
    abilityId: 'starfire',
    condition: all(selfStacksAtLeast('eclipse', 1), selfActive('natures_grace')),
  },
  { abilityId: 'wrath' },
  ],
};

/**
 * CAT — Rake and Rip held up, Ferocious Bite otherwise, Shred as the builder.
 *
 * SHRED IS THE BUILDER DESPITE ITS POSITIONAL REQUIREMENT, which this project
 * drops because nothing here has a facing. That is generous to the build and
 * the ability says so where it is declared.
 *
 * RIP ABOVE FEROCIOUS BITE. Rip at five points is 855 over twelve seconds for
 * 30 energy; Bite is 817 plus whatever the energy bar converts, for 35 and the
 * whole bar. Holding the bleed up is worth more than a burst that empties the
 * resource the rest of the list runs on.
 *
 * AND THE LIST NOW OPENS WITH AN ENERGY SOURCE RATHER THAN A DAMAGE BUFF, which
 * is the 1.60.1.70170 change: Shifting Power buys 40 energy for 55% of base
 * mana, where Tiger's Fury bought 15% physical damage for six seconds.
 *
 * SHRED APPEARS TWICE, AND THE SECOND IS NOT A DUPLICATE: gated on Clearcasting
 * above the finisher, and ungated as the filler at the bottom. That is the one
 * legal shape for a repeated id -- what is not legal is a copy BELOW an
 * unconditional one, which can never be reached. The Mage's Arcane Missiles and
 * the Warlock's Shadow Bolt are each in their lists twice for the same reason.
 */
export const DRUID_CAT: AplList = {
  name: 'Druid (Cat)',
  entries: [
  /*
   * SHIFTING POWER ON A LOW ENERGY BAR, which is the owner's condition: "Make
   * sure shifting power has a clause in the APL when it only uses Shifting
   * Power if current energy is <= 50."
   *
   * IT GRANTS 40 ENERGY AGAINST A CAP OF 100, so a cast on a full bar throws the
   * whole grant away, and the gate is worth **+13.2 DPS** -- a GATE THAT PAYS,
   * which is not the usual direction. Measured over 20 fights, ungated against
   * gated:
   *
   *     ungated   8.00 casts a fight   280.0 energy gained   40.0 WASTED
   *     gated     7.45 casts a fight   298.0 energy gained    0.0 wasted
   *
   * So the gated list casts it LESS and collects MORE, which is the whole
   * mechanism: 12.5% of the ungated grant never lands, across 1.4 wasting casts
   * a fight, the reliable one being the pull -- every fight opens at a full
   * energy bar. `grantResource` reports the overflow rather than hiding it, so
   * this shows on the resource panel; a DPS figure alone could not have said
   * which half moved.
   *
   * "AS LONG AS YOU HAVE THE MANA" IS STILL NOT A CONDITION, and the owner's
   * first instruction said that half: `checkCast` refuses an ability the
   * character cannot afford and a refused entry is walked past, so writing a
   * mana clause would be the list restating an engine rule -- the shape the
   * Rogue's Ambush entry was corrected for. This gate is about the ENERGY the
   * cast produces, which nothing else can know.
   *
   * IT WAS UNCONDITIONAL FOR ONE COMMIT, on the owner's "on cooldown as long as
   * you have the mana", and that was not a floor under the list either: an entry
   * blocks the ones below it only when it is ungated AND ALWAYS CASTABLE, and
   * this has a sixteen second cooldown -- eight with Improved Shifting Power,
   * which the Cat build takes 2/2 of. Now it is neither.
   *
   * WHAT IT REPLACED: Tiger's Fury, gated on "energy <= 30". Both the ability
   * and King of the Jungle, the talent that refunded 60 energy on casting it,
   * were removed in the same patch -- so this is the second entry in this list
   * to be gated on a low bar, for a completely different reason. Tiger's Fury
   * was free and cost a global cooldown; this one buys the resource back.
   */
  { abilityId: 'shifting_power', condition: energyAtMost(SHIFTING_POWER_ENERGY_CEILING) },
  /*
   * THE RACIAL COOLDOWNS, AFTER WHATEVER OPENS THIS LIST.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   */
  ...RACIAL_COOLDOWNS,
  ...CONSUMABLE_COOLDOWNS,
  ...CONSUMABLE_HEALS,
  { abilityId: 'berserk' },
  /*
   * EVERY CLEARCASTING PROC GOES ON SHRED, REGARDLESS OF COMBO POINTS -- the
   * ruleset owner's instruction, and the reason it needs its own entry above
   * the finisher rather than being left to fall out of the order below.
   *
   * WHAT IT WAS DOING INSTEAD: whichever entry the list reached next spent it.
   * Measured over twenty seeds, the Cat's 2.05 procs a fight were landing on
   * Shred, Rake and Rip in roughly 1.3 / 0.4 / 0.3 -- so about a third of them
   * paid for the two cheapest abilities in the build. Shred is the dearest at
   * 42 energy after Improved Shred, so it is the one worth making free.
   *
   * ABOVE `rip` AND NOT BELOW IT, which is what "regardless of existing Combo
   * Points" means: at five points the list would otherwise reach Rip first and
   * spend the charge on a 30-energy finisher.
   *
   * TIGER'S FURY AND BERSERK STAY ABOVE IT and cannot take the charge anyway --
   * both are free, and Clearcasting is "not consumed by ... abilities that cost
   * no resources". So their position costs this entry nothing.
   */
  { abilityId: 'shred', condition: selfActive('clearcasting') },
  { abilityId: 'rip', condition: exactlyPoints(MAX_COMBO_POINTS) },
  { abilityId: 'rake', condition: expired('rake') },
  { abilityId: 'shred' },
  ],
};

/**
 * BEAR — Mangle on cooldown, Lacerate held up, Maul as the rage dump.
 *
 * MAUL IS LAST AND IS NOT A GLOBAL COOLDOWN. It replaces the next swing rather
 * than taking a cast, exactly as the Warrior's Heroic Strike does, so putting
 * it at the bottom costs the entries above it nothing.
 *
 * THE RAGE FLOOR ON MAUL IS WORTH RE-READING NOW THAT NATURAL REACTION PAYS.
 * The Bear is the one Druid profile the target swings at, and its dodge proc
 * grants five rage a dodge at a 100% chance -- so the bar fills faster than it
 * did when this list was measured. The owner's "queue Maul if rage >= 42" is
 * unchanged and the entry above it is not: `rageAtLeast(42)` is a claim about a
 * rage economy that has moved.
 */
export const DRUID_BEAR: AplList = {
  name: 'Druid (Bear)',
  entries: [
  /*
   * NOT IF THE WARRIOR'S SHOUT IS ALREADY ON THE TARGET. The two do not stack
   * -- both are an attack power reduction -- so the owner's condition checks
   * for the other before spending a global cooldown on this one.
   *
   * IT CANNOT FIRE TODAY and is correct anyway: `demoralizing_shout` is not in
   * any preset's raid buff list, so nothing applies it to this encounter's
   * target. The clause costs nothing and is right the day a raid does.
   */
  {
    abilityId: 'demoralizing_roar',
    condition: all(expired('demoralizing_roar'), not(hasDebuff('demoralizing_shout'))),
  },
  { abilityId: 'barkskin', condition: healthAtMostFraction(0.5) },
  { abilityId: 'frenzied_regeneration', condition: healthAtMostFraction(0.35) },
  /*
   * THE TWO HEALS, WITH THE REST OF THE SURVIVAL COOLDOWNS -- WHICH IS *NOT*
   * WHERE THIS LIST PUTS THE OTHER FREE ENTRIES.
   *
   * The racial and consumable cooldowns sit LAST in a tank list, because "100ms
   * is not free to a tank at thirty percent health". A healing potion is the one
   * free entry that argument does not reach: the bottom of a tank list is a
   * place entries are not REACHED, and something above is nearly always
   * castable -- which is how five of seven racials came back inert.
   *
   * So they go here, beside the cooldowns that answer the same question, and
   * below them because those are the bigger answer. See `CONSUMABLE_HEALS`.
   */
  ...CONSUMABLE_HEALS,
  { abilityId: 'enrage' },
  { abilityId: 'berserk' },
  /*
   * "QUEUE MAUL IF RAGE >= 42". Maul is on-next-swing, so `queue` is exactly
   * what the list does with it: arming costs no global cooldown and the swing
   * carries it. The rage floor is what stops it eating the rage Primal Bite
   * and Lacerate below it need.
   */
  { abilityId: 'maul', condition: rageAtLeast(42) },
  // Primal Bite is `mangle`: the id kept the old name, the display name did not.
  { abilityId: 'mangle' },
  { abilityId: 'lacerate' },
    /*
   * THE RACIAL COOLDOWNS LAST, WHICH IS A TANK LIST'S OWN RULE.
   *
   * Everywhere else they sit second -- high enough to fire, below whatever
   * opens the list. A TANK LIST PUTS THEM LAST INSTEAD, and the reason is the
   * one `protectionRotation.test.ts` already states about Charge: an entry
   * above a survival cooldown "would cost a survival cooldown the moment it was
   * needed". A racial is free and off the global cooldown, but casting one
   * still moves the next decision 100ms out -- and 100ms is not free to a tank
   * at thirty percent health taking twelve thousand a swing.
   *
   * WHAT IT COSTS: the four offensive racials may not fire at all here, because
   * a tank list rarely falls this far. That is the right trade for a build
   * whose figure of merit is a DEATH COUNT, and it is worth 0.0 to all three
   * tank presets either way -- prot_warr and druid_bear are Tauren and
   * prot_pally is Human, so not one of them learns an active racial. Stoneform
   * is the one a tank would actually want, and at the bottom it fires when
   * nothing more pressing can, which is the honest policy for a ten percent
   * reduction that costs a global cooldown.
   */
  ...RACIAL_COOLDOWNS,
  ...RACIAL_DEFENSIVE_COOLDOWNS,
  ...CONSUMABLE_COOLDOWNS,
],
};

export const DRUID_MOONKIN_ROTATION: Rotation = compileRotation(DRUID_MOONKIN);
export const DRUID_CAT_ROTATION: Rotation = compileRotation(DRUID_CAT);
export const DRUID_BEAR_ROTATION: Rotation = compileRotation(DRUID_BEAR);

/** Which list a Druid runs, from the form it is in. */
export function druidRotation(style: CombatStyleId): Rotation | undefined {
  if (style === 'moonkin') return DRUID_MOONKIN_ROTATION;
  if (style === 'cat') return DRUID_CAT_ROTATION;
  if (style === 'bear') return DRUID_BEAR_ROTATION;
  // Caster and Tree of Life have no damage list worth the name.
  return undefined;
}
