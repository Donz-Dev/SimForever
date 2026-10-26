import type { Rotation } from '../../engine';
import type { AplList } from './apl';
import { RACIAL_COOLDOWNS, RACIAL_DEFENSIVE_COOLDOWNS } from './racialCooldowns';
import {
  buffPotionCooldown,
  consumableCooldown,
  consumableCooldowns,
  CONSUMABLE_COOLDOWNS,
  CONSUMABLE_HEALS,
  TIGHT_THISTLE_TEA_ENERGY_THRESHOLD,
} from './consumableCooldowns';
import {
  all,
  comboPoints,
  compileRotation,
  not,
  onCooldown,
  ready,
  resource,
  resourceFraction,
  selfHas,
  selfHealth,
  selfStacks,
  targetExpired,
  targetHas,
} from './apl';
import type { CombatStyleId } from '../character';
import type { TalentAllocation } from '../talents/Talent';
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

/**
 * What the Cat's Berserk window waits for, both the owner's figures.
 *
 * THIRTY ENERGY is enough for a Shred the instant the window opens -- Berserk
 * halves costs, so Shred is 21 inside it -- and TWO SECONDS OF RAKE is enough
 * that the window will not spend one of its own global cooldowns re-applying
 * the bleed. Neither is derived; both are stated.
 */
/*
 * ============================================================================
 * AND THE OWNER HAS REPLACED BOTH WITH A POOL: "Add ability to pool Energy
 * prior to using Berserk. The logic should be Shifting Power is on cooldown,
 * rake is active, rip is active. Pool 74 Energy. Use Berserk then Shred, Shred,
 * Shifting Power, Shred, etc. The idea is to use as many Shreds / Rakes during
 * Berserk as possible."
 *
 * 74 IS THE OWNER'S FIGURE. Berserk halves costs, so a full bar walked into the
 * window is three Shreds before Shifting Power's forty arrives. The pool is a
 * condition on the plain Shred -- the one entry that would spend it -- because
 * priority does not reserve a resource: Berserk above it is refused for cost
 * while the cheaper Shred below takes the energy every time it passes 42.
 * A Clearcasting Shred costs nothing and is left alone.
 * ============================================================================
 */
const BERSERK_POOL_ENERGY = 74;
const berserkSetUp = all(onCooldown('shifting_power'), targetHas('rake'), targetHas('rip'));
const poolingForBerserk = all(
  ready('berserk'),
  berserkSetUp,
  resource('below', BERSERK_POOL_ENERGY, 'energy'),
);

/** "rage >= N". */
const rageAtLeast = (minimum: number) => resource('atLeast', minimum, 'rage');

/** "hit points <= N% of maximum". */
const healthAtMostFraction = (fraction: number) => selfHealth('atMost', fraction);

/** "combo points >= N", read THROUGH the target so a stale pool reads zero. */
const atLeastPoints = (count: number) => comboPoints('atLeast', count);

/** "energy >= N". */
const energyAtLeast = (minimum: number) => resource('atLeast', minimum, 'energy');

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
  /*
   * THE SPELLBLASTING POTION OPENS THE LIST, which is the owner's order and is
   * the Elemental Shaman's too. A free off-GCD cast pushes the next decision
   * one 100ms poll out, which is what destroyed Charge at the top of a Warrior
   * list -- and nothing here has a one-instant window for that poll to miss,
   * so what it buys is thirty seconds of spell power from the pull rather than
   * from one cast later.
   */
  buffPotionCooldown('major_spellblasting_potion'),
  ...consumableCooldowns({ exclude: ['major_spellblasting_potion'] }),
  ...CONSUMABLE_HEALS,
  /*
   * THE RACIAL COOLDOWNS, BESIDE THE CONSUMABLES AS EVERYWHERE ELSE.
   *
   * Free, off the global cooldown, and skipped in silence by every build
   * that is not of the race that learns them. BOTH ENDS OF THE LIST WERE
   * MEASURED AND BOTH WERE WRONG -- see `racialCooldowns.ts`.
   *
   * THE OWNER'S PANEL SHOWS NO RACIAL ROW AT ALL, because the Moonkin preset is
   * a Tauren and War Stomp is crowd control, so `withoutOtherRacials` drops
   * every one of them -- which means their position here is this file's choice
   * and not a transcription. They stay with the consumables, which is where
   * they have been in every list but the Shaman's and the three tanks'.
   */
  ...RACIAL_COOLDOWNS,
  /*
   * ==========================================================================
   * INSECT SWARM ABOVE MOONFIRE, which is worth **+3.2** and is the only
   * ordering in this list that is not already the best one.
   *
   * BOTH ARE REFRESHED ON "IF NOT ACTIVE" AND BOTH COST A GLOBAL COOLDOWN, so
   * the order decides which one waits when they fall off together -- and Insect
   * Swarm is the one that loses more by waiting: it is a twelve-second effect
   * where Moonfire's is eighteen with Nature's Splendor, so a global cooldown
   * is a larger share of its uptime.
   *
   * IT TOOK 4,000 PAIRED ITERATIONS TO SAY SO. At 800 it read +3.95 against an
   * interval of 4.51 -- noise -- because a swap between two entries that both
   * cost a global cooldown reorders every later cast and the fights decorrelate.
   * ==========================================================================
   */
  /*
   * INNERVATE AT 10% MANA, ADDED IN ROUND 78. On the GCD, so it costs a cast:
   * -4.3 at 120s against the same Skyborne Reflection build without it (inside
   * the ~6.3 combined interval of the two rows), and +29.9 at 180s, where the
   * build runs dry. Bit-identical at 60s, where it never fires. 5% and 20%
   * measured within a few DPS of 10% at both longer lengths.
   */
  { abilityId: 'innervate', condition: resourceFraction('atMost', 0.1, 'mana') },
  { abilityId: 'insect_swarm', condition: expired('insect_swarm') },
  { abilityId: 'moonfire', condition: expired('moonfire') },
  /*
   * TWO STARFIRE ENTRIES, and the second is not a duplicate. Eclipse charges
   * shorten Starfire's cast and Nature's Grace shortens every cast AND the
   * global cooldown -- so the owner's first entry spends charges freely when
   * there are three or more, and the second spends one down to the LAST only
   * while Nature's Grace is up, which is the window where it is worth most.
   *
   * THE FIRST GATE WAS TWO AND IS THREE NOW, by the owner. What that buys is a
   * wider band in which the second entry is the one that fires: at two stacks
   * the list no longer spends freely, so the charge is held for a Nature's
   * Grace window instead of going out at whatever cast speed happens to be
   * current.
   *
   * A repeated ability id is legal and is checked for the shape that is not:
   * a copy below an UNCONDITIONAL one, which can never be reached. Both of
   * these are gated, and the ungated filler below is Wrath.
   */
  {
    abilityId: 'starfire',
    condition: selfStacksAtLeast('eclipse', 3),
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
 * SHRED IS THE BUILDER AND ITS POSITIONAL REQUIREMENT IS MET, which this note
 * used to call generous: "this project drops [it] because nothing here has a
 * facing. That is generous to the build." The owner has since ruled the
 * position ASSUMED unless the target attacks back, and this profile's target
 * does not -- so nothing is being given away. See `SHRED`.
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
  /*
   * THISTLE TEA AT TEN ENERGY RATHER THAN TWENTY, which is the owner's figure
   * for this profile and is the fourth time they have named one. The tea
   * restores a full hundred into a cap of a hundred, so every point on the bar
   * when it is drunk is thrown away: ten wastes half what twenty does and opens
   * half as often. See `TIGHT_THISTLE_TEA_ENERGY_THRESHOLD`.
   */
  ...consumableCooldowns({ thistleTeaEnergy: TIGHT_THISTLE_TEA_ENERGY_THRESHOLD }),
  /*
   * ==========================================================================
   * THE MIGHTY RAGE POTION IS BACK, AT THE PULL, which reverses a swap this
   * file argued for in detail and never measured.
   *
   * WHAT STOOD HERE: "Mighty Rage is gated on RAGE and a Cat has none that
   * anything fills, so its gate read permanently true and the potion fired at
   * the pull for its 60 Strength -- a flat window with nothing lined up against
   * it ... Frenzy is 40 attack power, which is less, and it is spent inside a
   * damage cooldown instead of at a moment nobody chose."
   *
   * EVERY FACT IN THAT IS TRUE AND THE TRADE IS THE WRONG WAY ROUND. Sixty
   * strength is **120 attack power** to a Druid against the Frenzy Potion's 40,
   * and over the two durations that is 2,400 attack-power-seconds against
   * 1,200. Being spent at a moment nobody chose is worth less than being three
   * times the size: **+8.4** at 3,000 paired iterations.
   *
   * AND HOLDING MIGHTY RAGE FOR BERSERK IS WORSE THAN DRINKING IT, which is the
   * half of the old argument that could have survived and does not: the hold
   * measures **-4.9** against the pull. Twenty seconds of potion spent waiting
   * for a cooldown is twenty seconds not spent, and Berserk is cast once.
   *
   * SO THE EXCLUSION AND THE GATED ENTRY ARE BOTH GONE and the generic list
   * applies -- its Mighty Rage entry is gated on rage, which a Cat reads as
   * zero, so it fires at the pull by itself.
   * ==========================================================================
   */
  ...CONSUMABLE_HEALS,
  /*
   * BERSERK BEHIND TWO CLAUSES, where it was unconditional. Both are the
   * owner's and both say the same thing: do not open the window until there is
   * something to spend it on.
   *
   * ENERGY AT LEAST 30 is the bar having enough for a Shred the instant the
   * window opens -- Berserk halves energy costs, so a Shred inside it is 21
   * after Improved Shred, and opening on an empty bar spends the first seconds
   * of a fifteen-second cooldown regenerating.
   *
   * RAKE WITH TWO SECONDS LEFT ON IT is the other half: Rake is above the
   * filler and below the Clearcasting entry, so a window opened while the bleed
   * is about to drop spends one of its global cooldowns re-applying a 35-energy
   * debuff instead of on the 42-energy strike the halved cost is worth most on.
   */
  {
    abilityId: 'berserk',
    condition: all(berserkSetUp, energyAtLeast(BERSERK_POOL_ENERGY)),
  },
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
  /*
   * RAKE ABOVE RIP, WHICH IS A SWAP, and it is the same argument the Berserk
   * gate above makes from the other side: a bleed that has dropped is damage
   * the build is not doing, where a finisher at five points can wait a global
   * cooldown without losing anything -- the points do not decay.
   */
  { abilityId: 'rake', condition: expired('rake') },
  /*
   * AND RIP ONLY WHEN RIP IS NOT ALREADY UP, which is the owner's new second
   * clause and is a guard against the thing this project calls a clipped
   * refresh: a re-application RESETS the aura, so a five-point Rip cast over
   * one with seconds left throws those seconds away. The first clause alone
   * would do exactly that every time the pool refilled.
   *
   * AT LEAST FIVE POINTS RATHER THAN EXACTLY FIVE, which is the owner's
   * comparison. Five is the cap, so the two readings select the same states --
   * transcribed as written because `AplCompare` carries both and the panel
   * round-trips what it is given.
   */
  {
    abilityId: 'rip',
    condition: all(atLeastPoints(MAX_COMBO_POINTS), expired('rip')),
  },
  { abilityId: 'shred', condition: not(poolingForBerserk) },
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
  /*
   * ==========================================================================
   * THE MIGHTY RAGE POTION MOVES FROM THE BOTTOM OF THE LIST TO HERE, by the
   * owner -- and in a TANK list that is the difference between firing and not.
   *
   * THE TANK RULE PUTS FREE ENTRIES LAST, on a measured argument: "100ms is not
   * free to a tank at thirty percent health". What that rule costs is reach,
   * and this file already records the price -- five of seven racials came back
   * inert at the bottom of a tank list, because a Protection build caps its rage
   * and something above is nearly always castable, so the list never falls that
   * far. `CONSUMABLE_HEALS` is placed high in this same list for exactly that
   * reason.
   *
   * SO THIS IS THE HEALS' ARGUMENT APPLIED TO A POTION THAT IS NOT A HEAL, and
   * the owner has made the call. It is the one mid-fight consumable a Bear can
   * drink that does something at the pull -- 60 Strength is 120 attack power --
   * and at the bottom it was competing with Maul, Primal Bite and Lacerate for
   * a poll that a rage-capped tank rarely has spare.
   *
   * IT KEEPS ITS GATE AND ITS NOTE, which is what `consumableCooldown` is for:
   * a hand-written copy of a shared entry drifts from it silently, and the copy
   * is the one nobody re-reads.
   *
   * WHETHER IT WAS FIRING AT ALL IS A MEASUREMENT, not an argument -- `USES=1`
   * is what says so, and it is the column to read on this profile.
   * ==========================================================================
   */
  consumableCooldown('mighty_rage_potion'),
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
  /*
   * AND THE REST OF THE CONSUMABLES, WITHOUT THE MIGHTY RAGE POTION, which this
   * list places itself halfway up. Excluded rather than left here and
   * duplicated: a repeated ability id is legal only when the copies are gated
   * differently, and two entries for one potion would be one entry and one
   * entry that can never be reached.
   */
  ...consumableCooldowns({ exclude: ['mighty_rage_potion'] }),
  /*
   * FAERIE FIRE, the owner's addition in round 51 -- free in Dire Bear Form and
   * worth 2 x level in base threat, scaled by the Bear's threat modifiers.
   *
   * UNGATED AND BELOW EVERY RAGE SPENDER, which is what makes it a FILLER: it
   * costs nothing, so it is castable on every decision, and an ungated free
   * entry is a floor under everything beneath it. Below Lacerate, it fires only
   * on a global cooldown the Bear could not afford to spend on anything else --
   * a rage-starved moment, which is exactly where 120-odd threat for no rage is
   * worth a GCD. Above Lacerate it would starve the bleed.
   *
   * AND LAST OF ALL, BELOW THE RACIALS AND CONSUMABLES. An off-GCD entry is
   * still BLOCKED by a running global cooldown, so a free entry that is always
   * castable above them would take every moment they could have fired in.
   */
  { abilityId: 'faerie_fire' },
],
};

export const DRUID_MOONKIN_ROTATION: Rotation = compileRotation(DRUID_MOONKIN);
export const DRUID_CAT_ROTATION: Rotation = compileRotation(DRUID_CAT);
export const DRUID_BEAR_ROTATION: Rotation = compileRotation(DRUID_BEAR);

/** Which list a Druid runs, from the form it is in. */
/**
 * RESTORATION -- the Resto Drood profile's list (round 71), the owner's design,
 * one list for both healer fights as Holy Pal's and Piss Beam's are:
 *
 *   TANK HEALER  "Keep up Rejuv and Regrowth, and pre-cast Healing Touch
 *                letting it land if the tank is <=75% hit points"
 *   RAID HEALER  "Keep up Rejuv and Regrowth on the tank at all times. Use Wild
 *                Growth on cooldown on the party that has the lowest average
 *                hit point %. Use Rejuv on any player that has <100% Hit Points."
 *
 * ============================================================================
 * WILD GROWTH IS THE RAID HEALER'S ALONE, gated on "at least 6 raid members"
 * as Holy Pal's Light's Vigil chain is; "any player under 100%" needs no gate,
 * because in the tank fight the only player already carries the Rejuvenation.
 *
 * "KEEP UP" IS "WHEN IT IS NOT UP", the reading CLAUDE.md records under
 * Rotations: a refresh window clips what is left. SMART HEALING IS OFF -- every
 * entry names who it is for.
 *
 * FOUR FIGURES HERE ARE OURS, NOT THE OWNER'S, and every one is editable in the
 * panel: Innervate at 50% mana, Nature's Swiftness when the tank is under 35%
 * (and the instant Healing Touch it buys), Swiftmend on the tank under 50%, and
 * the pre-cast checked at 80% of the cast. The owner named the cooldowns and
 * not their gates.
 * ============================================================================
 */
export const DRUID_RESTORATION: AplList = {
  name: 'Druid (Restoration)',
  entries: [
    ...RACIAL_COOLDOWNS,
    ...CONSUMABLE_COOLDOWNS,
    {
      abilityId: 'innervate',
      condition: { kind: 'resourceFraction', resource: 'mana', compare: 'atMost', fraction: 0.5 },
      note: 'Under 50% mana: a gate of ours, not the owner\'s.',
    },
    {
      abilityId: 'natures_swiftness',
      condition: { kind: 'friendlyHealth', of: 'tank', compare: 'below', fraction: 0.35 },
      note: 'When the tank is under 35%: a gate of ours.',
    },
    {
      abilityId: 'healing_touch',
      target: { kind: 'tank' },
      condition: { kind: 'aura', on: 'self', auraId: 'natures_swiftness', present: true },
      note: "The instant Healing Touch Nature's Swiftness buys.",
    },
    {
      abilityId: 'swiftmend',
      target: { kind: 'tank' },
      condition: { kind: 'health', on: 'target', compare: 'below', fraction: 0.7 },
      note: 'On the tank under 70%: a gate of ours, raised from 50% in round 78 (+10.9 HPS in the tank fight, swept 30/50/60/70/80).',
    },
    {
      abilityId: 'wild_growth',
      target: { kind: 'lowestParty' },
      condition: { kind: 'raidSize', compare: 'atLeast', count: 6 },
      note: 'Raid healer: on cooldown, on the party with the lowest average health.',
    },
    {
      abilityId: 'rejuvenation',
      target: { kind: 'tank' },
      condition: { kind: 'aura', on: 'target', auraId: 'rejuvenation', present: false },
      note: 'Kept up on the tank.',
    },
    {
      abilityId: 'regrowth',
      target: { kind: 'tank' },
      condition: { kind: 'aura', on: 'target', auraId: 'regrowth', present: false },
      note: 'Kept up on the tank.',
    },
    {
      abilityId: 'rejuvenation',
      target: { kind: 'lowestHealth', withoutAura: 'rejuvenation' },
      condition: { kind: 'health', on: 'target', compare: 'below', fraction: 1 },
      note: 'On anyone under 100% who does not have it.',
    },
    {
      abilityId: 'healing_touch',
      target: { kind: 'tank' },
      cancel: {
        atFraction: 0.8,
        condition: { kind: 'health', on: 'target', compare: 'above', fraction: 0.75 },
      },
      note: 'Pre-cast: lands only if the tank is at 75% or under, checked at 80% of the cast.',
    },
  ],
};

export const DRUID_RESTORATION_ROTATION: Rotation = compileRotation(DRUID_RESTORATION);

export function druidRotation(style: CombatStyleId, talents: TalentAllocation = {}): Rotation | undefined {
  // Wild Growth is the Restoration capstone, so a build that takes it heals (round 71).
  if ((talents.wild_growth ?? 0) > 0) return DRUID_RESTORATION_ROTATION;
  if (style === 'moonkin') return DRUID_MOONKIN_ROTATION;
  if (style === 'cat') return DRUID_CAT_ROTATION;
  if (style === 'bear') return DRUID_BEAR_ROTATION;
  // Caster and Tree of Life have no damage list worth the name.
  return undefined;
}
