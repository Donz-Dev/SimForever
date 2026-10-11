import type { ClassId } from '../character';
import {
  CONSUMABLE_ABILITY_IDS,
  consumableAbilities,
  type ConsumableSelection,
} from '../buffs/consumables';
import type { AplEntry, AplList } from './apl';
import { resource, resourceFraction, selfHas, selfHealth } from './apl';

/**
 * The mid-fight consumables every priority list carries.
 *
 * ============================================================================
 * THE SAME ARGUMENT THE RACIAL COOLDOWNS MAKE, ONE CATEGORY ALONG.
 *
 * An ability in the book and in no list NEVER FIRES -- the fourth cause of
 * inert, and the one that reads exactly like an engine gap. A potion is learned
 * by DRINKING one rather than by a class, so no class list was ever going to
 * name it: without this, every one of the nine would be declared, learnable,
 * castable, never cast and reported nowhere.
 *
 * ONE SHARED CONSTANT RATHER THAN TWENTY-SEVEN COPIES, which is the
 * `withStockRotations` argument and the `RACIAL_COOLDOWNS` argument: twenty-
 * seven hand-written copies are twenty-seven chances to write the wrong one,
 * and the one that drifted would be the one nobody measured.
 *
 * AND `withoutUnselectedConsumables` TAKES THE REST BACK OUT, which is where
 * this differs from the racials in the one way that matters: a race is fixed
 * when the profile is built and a SELECTION changes while somebody is looking
 * at the panel. Selecting a Major Mana Potion is what makes its entry appear,
 * because `syncDefaultRotation` re-derives a `default` list on every profile
 * change -- the owner's ask, "when a potion is selected it will then become
 * visible on the APL so the user can place it amongst their rotation with
 * conditions".
 *
 * ============================================================================
 * THEY GO SECOND, FOR THE REASON THE RACIALS DO, AND IT IS NOT THE OBVIOUS ONE.
 *
 * All nine are OFF the global cooldown, so this project's own rule for a new
 * entry -- "the bottom is the only position that cannot change what the list
 * already does" -- is the wrong rule for them. That rule is about an entry that
 * COSTS something; what the bottom costs a free entry instead is ever being
 * reached at all, which is how five of seven racials came back inert. And the
 * TOP was tried too, and broke Charge completely: a free cast at the pull pushes
 * the next decision a poll out and Charge's one-instant window is gone.
 *
 * So: after whatever opens the list, beside the racial cooldowns. Every
 * pull-only entry keeps its position.
 *
 * WHAT THAT COSTS IS ONE POLL PER USE -- an off-GCD cast leaves the actor free,
 * so `nextDecisionTime` returns `now + ROTATION_POLL_MS` rather than a global
 * cooldown. 100ms once per two minutes is about 0.17% of a fight, the same
 * price the racials and the Warrior's Bloodrage already pay.
 *
 * AND NONE OF THEM IS A FLOOR. An unconditional entry is a floor under
 * everything below it when it is ungated AND ALWAYS CASTABLE -- and a two
 * minute cooldown is the half that is easy to forget, because the condition is
 * what is written in the list and the cooldown is not.
 * ============================================================================
 */

/**
 * The health a potion is drunk at.
 *
 * ----------------------------------------------------------------------------
 * HALF, AND IT IS A CHOICE RATHER THAN A DERIVATION. A Major Healing Potion
 * restores 1050 to 1750 against a tank's pool of several thousand, so there is
 * no threshold at which it cannot overheal and therefore no arithmetic to read
 * one off -- unlike the energy and rage gates below, where the pool's cap and
 * the grant together say where waste begins.
 *
 * IT IS WORTH ZERO ON TWENTY-TWO OF THE 25 PRESETS AND THAT IS CORRECT: with
 * `targetAttacks` off, health never leaves maximum, so the condition is
 * permanently false and the entry never fires. THE THREE TANKS are what it is
 * for -- Prot Warr, Bear and Prot Pally -- and there the measure is a count of
 * deaths rather than a DPS figure.
 *
 * THE COUNT IS NAMED RATHER THAN STATED, because the earlier version of this
 * said "twenty-three" and no reading of the presets gives 23: there are exactly
 * three profiles with `targetAttacks` on. A figure nobody can re-derive from the
 * thing it describes is the shape this project keeps finding stale.
 * ----------------------------------------------------------------------------
 */
export const POTION_HEALTH_FRACTION = 0.5;

/**
 * The share of a mana pool a mana restore is drunk at.
 *
 * ----------------------------------------------------------------------------
 * A FRACTION RATHER THAN A FLAT AMOUNT, because the nine classes' pools differ
 * by a factor of three and one constant has to serve all of them -- a flat "at
 * most 1500 mana" is a third of a Mage's pool and most of a Warrior's. The
 * Mage's own Evocation entry is `resourceFraction` at 10% for the same reason.
 *
 * THIRTY PERCENT, WHICH IS ABOVE THE NO-WASTE POINT AND DELIBERATELY SO. A
 * Major Mana Potion gives at most 2250 into pools of roughly 4,000 to 7,000, so
 * waste begins somewhere between 45% and 70% depending on the class -- a gate
 * placed exactly there would be a different number for every build and would
 * still be guessing. Thirty percent wastes nothing on any of them and leaves
 * room for the pool to keep falling before the next decision.
 *
 * "ASSERT THAT A STATED BOUNDARY IS SAFE RATHER THAN THAT IT IS TIGHT" is the
 * rule this follows, from the Cat's Shifting Power gate -- where the arithmetic
 * said 60 and the owner said 50, and both waste nothing.
 * ----------------------------------------------------------------------------
 */
export const POTION_MANA_FRACTION = 0.3;

/**
 * The mana a DEMONIC RUNE is used at, which is the OWNER'S figure and is not
 * the potion's.
 *
 * ----------------------------------------------------------------------------
 * "Demonic rune being used at 10% mana remaining should be the default behavior
 * for pure mana users" -- stated directly, and it matches the threshold the
 * owner's own Mage lists already use for Evocation.
 *
 * KEPT SEPARATE FROM `POTION_MANA_FRACTION` FOR TWO REASONS, and only one of
 * them is that a ruling covers what it says. The other is that the asymmetry
 * does real work: the two categories are not exclusive, so a character may
 * carry both, and a potion that fires at 30% ahead of a Rune that fires at 10%
 * is a LADDER -- spend the one with no downside first, and only then the one
 * that costs 600 to 1000 Hit Points.
 *
 * SO THE 30% IS STILL THIS REPOSITORY'S CHOICE AND THE 10% IS THE OWNER'S, and
 * a reader who wants them unified should ask rather than assume the difference
 * is an oversight.
 * ----------------------------------------------------------------------------
 */
export const DEMONIC_RUNE_MANA_FRACTION = 0.1;

/**
 * The energy Thistle Tea is drunk at.
 *
 * DERIVED AND THEN LOOSENED. Thistle Tea restores a full hundred into a cap of
 * a hundred, so ANY energy in the pool is energy thrown away and the no-waste
 * point is zero -- which is a gate that would almost never open, because a
 * Rogue's bar is only momentarily empty. Twenty is the compromise: it wastes
 * twenty of the hundred at worst, and it opens.
 */
export const THISTLE_TEA_ENERGY_THRESHOLD = 20;

/**
 * The TIGHT Thistle Tea gate: ten, which the Venom and Rupture lists both use.
 *
 * ============================================================================
 * THE OWNER'S FIGURE, READ OFF THEIR OWN PANEL: ten rather than twenty. It is
 * the same trade the shared constant describes, taken further -- ten wastes ten
 * of the hundred at worst instead of twenty, at the cost of the gate opening
 * less often.
 *
 * NAMED FOR THE NUMBER RATHER THAN FOR A LIST, because the owner has now given
 * it twice -- for Venom and for Rupture -- and a constant called
 * `VENOM_...` that two lists read is the shape that drifts. The third gate,
 * fifteen, is the Combat Rogue's and has its own.
 *
 * A SECOND CONSTANT RATHER THAN A MOVE OF THE FIRST, because the entry is in a
 * SHARED list fragment and FIVE profiles drink Thistle Tea: all four Rogues and
 * the Cat Druid. THREE of the five are named now and they hold TWO different
 * numbers between them, so no move of the shared constant can satisfy them --
 * which is the same arithmetic the food rows reached, and it is what settles
 * the shape rather than making it awkward.
 *
 * AND THE CAT DRUID HAS SINCE JOINED IT, which leaves the HEMO DAGGER ROGUE as
 * the only thing in the project still on twenty -- so four of the five profiles
 * that drink Thistle Tea are now named by the owner, and the shared constant is
 * what the fifth has rather than what anything was designed around.
 * ============================================================================
 */
export const TIGHT_THISTLE_TEA_ENERGY_THRESHOLD = 10;

/**
 * The Combat Rogue's own Thistle Tea gate: fifteen.
 *
 * ============================================================================
 * THREE DIFFERENT NUMBERS NOW -- twenty shared, fifteen here, ten on Venom --
 * and that is what settles the shape rather than making it awkward. A shared
 * list fragment holds ONE value and the owner has given three, so the gate had
 * to become a parameter and the question of "should the shared constant just
 * move" is answered for good.
 *
 * IT IS THE SAME TRADE AT A DIFFERENT POINT. Thistle Tea restores a full
 * hundred into a cap of a hundred, so every point on the bar when it is drunk
 * is thrown away: a lower gate wastes less and opens less often. Fifteen sits
 * between the Venom Rogue's ten and the Cat Druid's twenty, which is what a
 * build that spends its energy at a middling rate should want.
 * ============================================================================
 */
export const COMBAT_THISTLE_TEA_ENERGY_THRESHOLD = 15;

/**
 * The rage a Mighty Rage Potion is drunk at.
 *
 * ----------------------------------------------------------------------------
 * TWENTY-FIVE IS THE NO-WASTE POINT AND IT IS THE RAGE HALF THAT WANTS IT: the
 * potion gives at most 75 into a cap of 100, so above 25 some of it overflows.
 *
 * AND THE POTION'S OTHER HALF WANTS THE OPPOSITE. Sixty strength for twenty
 * seconds is 120 attack power to a Warrior or a Druid and wants to be up as
 * early and as often as possible, where the rage wants to wait for a trough --
 * so this one number is a real trade and the two clauses genuinely disagree.
 * Measured on the three builds that can drink it; see HANDOVER.
 *
 * A CAT DRUID IS UNAFFECTED BY IT EITHER WAY, so the gate is permanently TRUE
 * for a Cat and the potion fires at the pull for its strength -- but NOT for the
 * reason it first appears. A Cat has a rage pool: `resourceSpecsFor` keys pools
 * by CLASS rather than by form. What makes the gate permanently open is that
 * nothing ever puts rage in it, measured at **zero gained over twenty fights**
 * (`tools/probe_cat_rage.ts`). So the condition protecting the rage clause costs
 * the Cat nothing, which is the conclusion the wrong reasoning also reached.
 * ----------------------------------------------------------------------------
 */
export const MIGHTY_RAGE_THRESHOLD = 25;

/**
 * The mid-fight consumables, as entries, with the gates a list may override.
 *
 * ----------------------------------------------------------------------------
 * A FUNCTION BECAUSE ONE LIST NEEDED A DIFFERENT NUMBER, and the alternative
 * was writing its seven entries out by hand -- which is the shape
 * `rotationIds.test.ts` exists for: a hand-written copy of a shared fragment
 * drifts from it silently, and the copy is the one nobody re-reads.
 *
 * `CONSUMABLE_COOLDOWNS` IS THIS CALLED WITH NOTHING, so all 25 other lists are
 * byte-identical to what they were and no figure can move.
 *
 * THE NOTE IS BUILT FROM THE SAME NUMBER THE CONDITION USES, which is the whole
 * reason the override goes HERE rather than being patched onto the entry
 * afterwards: a note is a frozen string, so an override applied to the
 * condition alone would leave the row explaining a gate it no longer has.
 * ----------------------------------------------------------------------------
 */
export function consumableCooldowns(
  options: {
    readonly thistleTeaEnergy?: number;
    /**
     * Ability ids to leave OUT, for a list that places one of them itself.
     *
     * ------------------------------------------------------------------------
     * THE COMBAT ROGUE PUTS THISTLE TEA ABOVE ITS RACIALS and the rest of the
     * row below them, so the group is split rather than reordered -- the
     * owner dragged one entry to the top of their panel and left everything
     * else where it was.
     *
     * AN EXCLUSION RATHER THAN A HAND-WRITTEN COPY, because a copy of a shared
     * fragment drifts from it silently and is the copy nobody re-reads. The
     * excluded entry is still built HERE, by `thistleTeaCooldown`, so its
     * condition and its note cannot disagree with the shared one's.
     * ------------------------------------------------------------------------
     */
    readonly exclude?: readonly string[];
  } = {},
): readonly AplEntry[] {
  const exclude = new Set(options.exclude ?? []);
  return [
    /*
     * THE THREE POOL RESTORES, EACH GATED ON ITS OWN POOL. A restore drunk into a
     * nearly full pool is the waste `grantResource` reports in `wasted` and a DPS
     * figure cannot see -- the Cat's Shifting Power is the worked example, where a
     * gate on exactly this was worth POSITIVE DPS because the ungated version
     * threw away 12.5% of everything it granted and the reliable waster was THE
     * PULL, which every fight opens at a full bar.
     */
    {
      abilityId: 'major_mana_potion',
      condition: resourceFraction('atMost', POTION_MANA_FRACTION, 'mana'),
      note: `Drunk under ${POTION_MANA_FRACTION * 100}% mana, which wastes none of it on any class's pool.`,
    },
    {
      abilityId: 'demonic_rune',
      condition: resourceFraction('atMost', DEMONIC_RUNE_MANA_FRACTION, 'mana'),
      note: `Used under ${DEMONIC_RUNE_MANA_FRACTION * 100}% mana, the owner's figure -- TIGHTER than the mana potion's gate, so a character carrying both spends the free one first. It costs 600 to 1000 Hit Points and is refused below 1000 rather than allowed to kill.`,
    },
    thistleTeaCooldown(options.thistleTeaEnergy),
    /*
     * THE ONE THAT IS BOTH. Its rage half wants a trough and its strength half
     * wants to be up early; the gate serves the rage and the Cat ignores it.
     */
    {
      abilityId: 'mighty_rage_potion',
      condition: resource('atMost', MIGHTY_RAGE_THRESHOLD, 'rage'),
      note: `${MIGHTY_RAGE_THRESHOLD} rage is the no-waste point for the 45-75 it restores. A Cat Druid has no rage pool, so this reads as zero and the potion fires at the pull for its 60 Strength.`,
    },
    /*
     * THE TWO PURE BUFFS, UNGATED BY DEFAULT -- which was the racials' own
     * argument: a flat stat for a fixed window has nothing in this encounter to
     * line it up with, so any condition would be a guess at a burst phase that
     * does not exist here.
     *
     * AND TWO OF THE OWNER'S LISTS NOW LINE THEM UP WITH SOMETHING, which is
     * what `buffPotionCooldown` is for -- the Arcane Mage holds Spellblasting
     * for Presence of Mind and the Cat holds Frenzy for Berserk. So the
     * reasoning above was right about the ENCOUNTER and wrong about the BUILD:
     * what the window can be lined up against is one of the character's own
     * damage cooldowns, which is a thing only the list knows.
     */
    buffPotionCooldown('major_frenzy_potion'),
    buffPotionCooldown('major_spellblasting_potion'),
    /*
     * MAJOR MENDER'S POTION IS DELIBERATELY ABSENT, and saying so here is the
     * point -- "say so where the entry is not", because an absent entry for
     * something the catalogue offers reads exactly like an omission.
     *
     * It grants 75 Healing Power and healing power is not a stat this engine has,
     * so the ability is declared, selectable, castable and worth exactly nothing;
     * its own `unmodelled` says so. An entry for it would cost one rotation poll
     * per two minutes to achieve that nothing. It is the one mid-fight consumable
     * with no line in any list, and it is the one with nothing to decide.
     */
  ].filter((entry) => !exclude.has(entry.abilityId));
}

/**
 * The Thistle Tea entry on its own, so a list can place it itself.
 *
 * THE NOTE IS BUILT FROM THE SAME NUMBER THE CONDITION USES, which is the whole
 * reason the gate is a parameter here rather than something patched onto the
 * entry afterwards: a note is a FROZEN STRING, so an override applied to the
 * condition alone leaves the row explaining a gate it no longer has. The
 * owner's own Venom screenshot shows one -- a gate of 10 under a note reading
 * "Under 20" -- because editing a condition in the panel does not touch its
 * note. Nothing can fix a hand-edited entry; what this guarantees is that a
 * STOCK list cannot disagree with itself.
 */
export function thistleTeaCooldown(energy?: number): AplEntry {
  const gate = energy ?? THISTLE_TEA_ENERGY_THRESHOLD;
  return {
    abilityId: 'thistle_tea',
    condition: resource('atMost', gate, 'energy'),
    note: `100 energy into a cap of 100, so every point on the bar is wasted. Under ${gate} is the compromise between waste and the gate ever opening.`,
  };
}

/** The two mid-fight consumables that are a flat buff and nothing else. */
export type BuffPotionId = 'major_frenzy_potion' | 'major_spellblasting_potion';

/** What each one grants, for the note. Not a stat the engine reads from here. */
const BUFF_POTION_GRANT: Readonly<Record<BuffPotionId, string>> = {
  major_frenzy_potion: '40 attack power and ranged attack power for 30s',
  major_spellblasting_potion: '40 spell power for 30s',
};

/**
 * One of the two pure buff potions, optionally HELD FOR A WINDOW.
 *
 * ============================================================================
 * UNGATED IS STILL THE DEFAULT, AND IT IS STILL THE RIGHT DEFAULT. Thirty
 * seconds of a flat stat has nothing in a one-target, no-phase encounter to
 * line it up against, so a condition written here would be a guess -- which is
 * exactly what `RACIAL_COOLDOWNS` says about itself and for the same reason.
 *
 * WHAT A LIST CAN KNOW THAT THIS FILE CANNOT is whether the BUILD has a damage
 * cooldown worth stacking the window onto, and two of the owner's lists do:
 * the Arcane Mage holds Spellblasting for Presence of Mind and the Cat holds
 * Frenzy for Berserk. Both are the owner's conditions.
 *
 * THE GATED ENTRY CANNOT STARVE ITSELF, which is the thing to check before
 * writing one. The aura it waits on is applied by an entry BELOW it in both
 * lists, so the first poll skips the potion and casts the cooldown, and the
 * next poll finds the window open -- and because a potion is off the global
 * cooldown, that next poll is 100ms later rather than a cast later. A gate
 * waiting on something only an entry ABOVE it could supply would never open.
 *
 * ============================================================================
 * THE NOTE IS BUILT FROM THE SAME AURA THE CONDITION READS, which is the whole
 * reason this is a function rather than a condition patched onto a shared
 * entry afterwards. A note is a FROZEN STRING: an override that touched only
 * the condition would leave the row in the panel explaining a gate it no
 * longer has, which is the mistake `thistleTeaCooldown` exists to prevent one
 * category along.
 * ============================================================================
 */
export function buffPotionCooldown(
  abilityId: BuffPotionId,
  /** The damage cooldown whose window this is held for, if any. */
  insideAura?: { readonly id: string; readonly label: string },
): AplEntry {
  const grant = BUFF_POTION_GRANT[abilityId];
  if (insideAura === undefined) {
    return {
      abilityId,
      note: `${grant}. Ungated: a flat window with nothing in this encounter to line it up against.`,
    };
  }
  return {
    abilityId,
    condition: selfHas(insideAura.id),
    note: `${grant}, held for the ${insideAura.label} window so the two stack. The entry that applies ${insideAura.label} is BELOW this one, so the first poll casts the cooldown and the next -- 100ms later, because a potion takes no global cooldown -- drinks this.`,
  };
}

/**
 * One shared consumable entry on its own, so a list can place it by hand.
 *
 * ----------------------------------------------------------------------------
 * THE `exclude` OPTION'S OTHER HALF. A list that drops an entry from the group
 * has to put it back somewhere, and writing it out by hand is the shape
 * `rotationIds.test.ts` exists for -- a hand-written copy of a shared fragment
 * drifts from it silently, and the copy is the one nobody re-reads. The Bear
 * moves its Mighty Rage Potion from the bottom of the list to the middle and
 * this is how it carries the gate and the note with it.
 *
 * IT THROWS ON AN ID THE GROUP DOES NOT HOLD, rather than returning an entry
 * for an ability nobody declared -- an entry naming an unknown ability is
 * skipped by `PriorityRotation` in SILENCE, which is the fourth cause of inert
 * and the one that reads exactly like a working list.
 * ----------------------------------------------------------------------------
 */
export function consumableCooldown(abilityId: string): AplEntry {
  const entry = consumableCooldowns().find((candidate) => candidate.abilityId === abilityId);
  if (entry === undefined) {
    throw new Error(`consumableCooldown: no shared entry for "${abilityId}"`);
  }
  return entry;
}

/** The shared seven, on the default gates. What every list but one spreads. */
export const CONSUMABLE_COOLDOWNS: readonly AplEntry[] = consumableCooldowns();

/**
 * And the two that HEAL, which belong where a tank's survival cooldowns are.
 *
 * ============================================================================
 * SEPARATED FOR THE REASON `RACIAL_DEFENSIVE_COOLDOWNS` IS, AND THEN PLACED THE
 * OPPOSITE WAY ROUND.
 *
 * A tank list puts the free, ungated entries LAST -- its own rule, and a
 * measured one: "100ms is not free to a tank at thirty percent health taking
 * twelve thousand a swing". That is right for a racial that buffs attack power
 * and it is exactly wrong for a healing potion, because the bottom of a tank
 * list is a place entries are not reached. A Protection warrior is capping rage
 * and wasting income, so something above is nearly always castable, and "a list
 * with anything castable never falls that far" is how five of seven racials
 * came back inert.
 *
 * SO THESE GO WITH LAST STAND AND SHIELD WALL, second in a tank list, which is
 * where that list already puts the things that answer "I am about to die". They
 * are gated on the same kind of condition and compete for the same moment.
 *
 * AND THE POSITION IS NEARLY FREE IN THE OTHER TWENTY-TWO LISTS, because with
 * `targetAttacks` off health never leaves maximum, the condition is permanently
 * false, and an unreachable condition high in a list is not a floor under
 * anything. That is the one case where this project's "a new entry goes at the
 * bottom" rule has nothing to protect.
 *
 * ============================================================================
 * "NEARLY", AND THE EXCEPTION WAS A BUG IN LIFE TAP RATHER THAN A FACT ABOUT
 * HEALING. Worth keeping in full, because the wrong reading survived a
 * measurement, a write-up and a review.
 *
 * The first version of this note said the heals "never fire against a target
 * that does not attack, which is 23 of the 25 presets" -- a prediction dressed
 * as a fact, and wrong in the count. Measured, the FIRELOCK drank one and it was
 * **-28.4 DPS**, with a Healthstone at -26.2, both REAL.
 *
 * THAT WAS WRITTEN UP AS AN INTERESTING PROPERTY OF WARLOCKS AND IT WAS A
 * DEFECT. The owner's ruling: "this should never be the case. Spending life tap
 * on global cooldowns should only be based on the warlock's current mana." The
 * Firelock's Life Tap entry was UNGATED, so a healing potion's 1,400 health
 * bought 1.63 more taps -- each a global cooldown that deals nothing -- and the
 * list cast 1.43 fewer Incinerates for mana it did not need.
 *
 * GATED ON MANA, A HEAL IS WORTH **-0.1** ON THAT PROFILE, which is zero. The
 * heals really are worth nothing off a tank, and the 24-of-25 figure is now 25
 * of 25. See `rotations/warlock.ts` for the gate and the sweep behind it.
 *
 * THE LESSON IS THE ORDER THE TWO WERE FOUND IN. A measurement explained a
 * number correctly -- the mechanism was exactly as described -- and that
 * explanation was mistaken for a justification. **"Isolate a loss, do not blame
 * the obvious suspect" has a second half: having found the real cause, ask
 * whether the cause is itself correct.**
 * ============================================================================
 */
export const CONSUMABLE_HEALS: readonly AplEntry[] = [
  {
    abilityId: 'major_healing_potion',
    condition: selfHealth('atMost', POTION_HEALTH_FRACTION),
    note: `Under ${POTION_HEALTH_FRACTION * 100}% health. For a tank: no other preset drops that low, so this never fires on 24 of the 25.`,
  },
  {
    abilityId: 'healthstone',
    condition: selfHealth('atMost', POTION_HEALTH_FRACTION),
    note: 'The same gate as the healing potion, and a separate category: a character may carry both and use both.',
  },
];

/**
 * Every mid-fight consumable id, for telling one entry from another.
 *
 * Derived from the catalogue rather than from the entries above, which is what
 * makes the absent Mender's Potion entry safe: an id this set did not carry
 * would be a potion `withoutUnselectedConsumables` could never drop.
 */
const ALL_CONSUMABLE_ABILITY_IDS: ReadonlySet<string> = CONSUMABLE_ABILITY_IDS;

/**
 * A list with the consumable entries this character did not bring taken out.
 *
 * ============================================================================
 * THE ENGINE NEVER NEEDED THIS AND THE PANEL DOES, which is exactly what
 * `withoutOtherRacials` says about itself. `PriorityRotation` skips an ability
 * the character does not know in silence -- that is the property letting one
 * shared constant be spread into every list of every class -- so a character
 * that drank nothing carries nine entries that cost it precisely nothing and
 * every figure is identical either way.
 *
 * WHAT IT COSTS IS A PERSON READING THE PANEL. Without it every build's list
 * opens with nine lines for potions nobody chose, and the one line that matters
 * is indistinguishable from the eight that cannot fire.
 *
 * A CONSUMABLE IS THE ONLY KIND OF ENTRY THIS MAY DROP, and the test is
 * membership of the catalogue's own id set rather than "the build does not know
 * it". The wider rule would delete a capstone a list names for a sibling spec,
 * which is the same property pointing the other way and is deliberate: one
 * Hunter list serves a build without the capstone, and the Hemo list is the
 * Rupture list minus two entries.
 *
 * IT ASKS `consumableAbilities`, SO THE CLASS GATE IS NOT RESTATED HERE. A Mage
 * carrying a hand-edited Mighty Rage Potion does not get the ability, and this
 * therefore does not get the entry -- one answer, read twice, rather than two
 * conditions that can disagree.
 *
 * A LIST WITH NOTHING TO DROP IS RETURNED UNCHANGED, which keeps reference
 * equality useful upstream: `syncDefaultRotation` leans on it.
 * ============================================================================
 */
export function withoutUnselectedConsumables(
  list: AplList,
  characterClass: ClassId,
  selection: ConsumableSelection | undefined,
): AplList {
  const mine = new Set(
    consumableAbilities(characterClass, selection).map((ability) => ability.id),
  );
  const keep = list.entries.filter(
    (entry) => !ALL_CONSUMABLE_ABILITY_IDS.has(entry.abilityId) || mine.has(entry.abilityId),
  );
  return keep.length === list.entries.length ? list : { ...list, entries: keep };
}
