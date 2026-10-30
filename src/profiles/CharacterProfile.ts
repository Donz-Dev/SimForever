import type { PrecombatAction } from '../engine';
import type { PartialStats } from '../engine';
import type { ClassId, CombatStyleId, RaceId, StanceId } from '../game/character';
import type { Equipment } from '../game/items/Item';
import type { TalentAllocation } from '../game/talents/Talent';
import { DEFAULT_POISON_LOADOUT, type PoisonLoadout } from '../game/reactions/poisons';
import {
  DEFAULT_WARLOCK_STONE,
  type WarlockStoneId,
} from '../game/buffs/warlockStones';
import type { ConsumableSelection } from '../game/buffs/consumables';
import type { StatValuation } from '../game/items/itemValue';
import type { AplEntry } from '../game/rotations/apl';

/**
 * The profile format version.
 *
 * Bump this whenever the shape changes in a way that older files do not match,
 * and add a step to `migrations` in `migrateProfile.ts`. Every saved profile
 * carries its version, so a file written today keeps loading after the format
 * moves on. Getting this in before anyone has saved anything is much cheaper
 * than retrofitting it later.
 */
export const CURRENT_PROFILE_VERSION = 19;

/** The most targets an encounter can hold: the Encounter panel's presets run 1 to 8. */
export const MAX_ENCOUNTER_TARGETS = 8;

export interface CharacterSection {
  readonly name: string;
  /**
   * Race and class are stored as ids (`night_elf`, not `Night Elf`), so that
   * display names can be reworded without invalidating saved profiles.
   *
   * Faction is deliberately NOT stored. It is determined by the race, so
   * storing it would allow a profile to claim an Alliance Orc. Derive it with
   * `getRace(profile.character.race).faction`. If Forever ever introduces a
   * race playable by both factions, this becomes a real field.
   */
  readonly race: RaceId;
  readonly characterClass: ClassId;
  readonly level: number;
  /**
   * Which pet family a Hunter brings, when it brings one.
   *
   * ----------------------------------------------------------------------
   * A PLAYER ACTION ON THE GUI, which is the ruleset owner's standard for
   * what the engine is entitled to know -- the same reasoning that made the
   * shield a profile field rather than something inferred. Pet abilities are
   * family-gated in the spellbook, so a Cat has Claw and a Wolf does not.
   *
   * Absent on every profile that is not a Hunter, and absent on a Hunter that
   * took Lone Wolf, which is the talent for choosing to bring no pet at all.
   * A Hunter with a pet and no family named defaults to a Cat.
   * ----------------------------------------------------------------------
   */
  readonly petFamily?: string;
  /**
   * The demon a WARLOCK has out in the fight: `imp` or `succubus`.
   *
   * ----------------------------------------------------------------------
   * SEPARATE FROM `petFamily`, WHICH FOR A WARLOCK IS THE SACRIFICED DEMON.
   * With Demonic Pact a Warlock holds both at once -- the owner's strategy is
   * "sacrifice Succubus and summon Imp" for a Fire build and the mirror for
   * Shadow -- so one field cannot carry both.
   *
   * ABSENT MEANS NO DEMON IS OUT, which is what every Warlock profile saved
   * before this field existed was: nothing built one. So no migration.
   * ----------------------------------------------------------------------
   */
  readonly summonedDemon?: string;
  /**
   * How the character fights: which weapons auto-attack, and which action
   * priority list applies.
   *
   * For a Druid this is also its form, and so determines hit points, attack
   * power and the active resource. Omitted means "use the class default".
   */
  readonly combatStyle?: CombatStyleId;
  /**
   * Which stance a Warrior fights in. Meaningless for every other class.
   *
   * A PLAYER CHOICE rather than something the rotation works out. Stance
   * gating left several abilities reachable only by swapping, and a rotation
   * that swaps whenever anything in another stance looks castable spent 540
   * rage a fight doing it. Choosing up front removes most of that, because
   * most of the swapping was the character starting in the wrong stance.
   *
   * Omitted means the combat style's default -- Battle for a two-hander,
   * Berserker for dual-wield, Defensive for a shield.
   */
  readonly stance?: StanceId;
}

export interface SimulationSection {
  /**
   * Fight length in SECONDS.
   *
   * Profiles are written and read by people, so they use seconds; the engine
   * works exclusively in milliseconds. `toSimulationConfig` is the one place
   * that converts, which is how the two conventions never get mixed up.
   */
  readonly durationSeconds: number;
  /*
   * Fight length no longer varies by profile. It varies by a FIXED fraction
   * built into the simulator -- see FIGHT_DURATION_VARIANCE. Removed in
   * version 8; older profiles have the field dropped on migration.
   */
  /** Monte Carlo iteration count. 1 runs a single fight. */
  readonly iterations: number;
  /** Base RNG seed. The same seed reproduces the run exactly. */
  readonly seed: number;
}

export interface EncounterSection {
  readonly targetName: string;
  /**
   * A nominal pool for damage to be subtracted from. IT DOES NOT END A FIGHT.
   *
   * The target is a damage sink running for a predetermined duration, not
   * something with a health bar to get through: it carries
   * `survivesLethalDamage`, so a fight always runs its full length however
   * hard it is hit. The CHARACTER no longer carries it -- they can die, and
   * are stood back up when they do -- but the target still does. The number exists so the combat log and the overkill
   * column have somewhere to point, and nothing should be concluded from it.
   *
   * Kept rather than removed because it is not user-editable and removing it
   * is a profile format change for no gain. It is NOT a difficulty setting,
   * and lowering it does not shorten a fight.
   */
  readonly targetHealth: number;
  readonly targetArmor: number;
  /**
   * Target level. Sets defense skill (5 x level), the armor constant and
   * crit suppression, so it shapes the entire combat table.
   */
  readonly targetLevel: number;
  /**
   * Whether the target swings back.
   *
   * OFF by default, and that default is a judgement rather than an oversight: a
   * dual-wielding damage warrior in a raid is not the one being hit, and
   * turning this on for them would hand them rage they would never have.
   *
   * Turning it on is what makes the attacks-received table, rage from damage
   * taken, Revenge and six Warrior talents reachable at all.
   */
  readonly targetAttacks: boolean;
  /**
   * Damage of the target's FIRST swing, before armor and the attacks-received
   * table. Every swing after it is ten percent harder than the one before.
   *
   * A PLACEHOLDER borrowed from Classic, not Forever data. It is on the profile
   * rather than buried in code so that it is visible, editable, and obviously
   * a number someone chose. The ramp that compounds it is NOT on the profile,
   * because nobody asked to vary it: see `BOSS_SWING_DAMAGE_RAMP` in
   * `game/encounters/raidBoss.ts`.
   */
  readonly targetSwingDamage: number;
  /** Seconds between target swings. Also a Classic placeholder. */
  readonly targetSwingSeconds: number;
  /**
   * How many hostile targets the fight holds, 1 to `MAX_ENCOUNTER_TARGETS`
   * (round 57). The owner's "Number of Targets" dropdown.
   *
   * THE FIRST IS THE BOSS AND THE REST ARE ADDS. Every target is the same
   * training dummy -- same level, same armor -- and the rotation's primary
   * target is always the first; what the extra targets are FOR is the area
   * abilities, which strike them through `selectTargets`, and the APL's
   * `targetCount` condition, which reads this number.
   *
   * ON A TANK RUN THE ADDS SWING TOO, by the owner's ruling: "each extra target
   * swings for base 500 damage every 2 seconds, does not ramp." The boss keeps
   * `targetSwingDamage` and its ramp. See `EXTRA_TARGET_SWING_DAMAGE`.
   *
   * ONE BY DEFAULT, and a migrated profile gets one, so no saved result moves.
   */
  readonly numberOfTargets: number;
  /**
   * A FIGHT THAT IS A ROUTE RATHER THAN ONE TARGET -- the owner's "Dungeon
   * Route", chosen in the Target dropdown. When set, the route's own pulls
   * decide the targets, their levels and the fight's length, and the level,
   * target count and duration fields are ignored (the panel greys them out).
   * See `game/encounters/dungeonRoute.ts`.
   *
   * ABSENT IS THE ORDINARY TARGET, which is every profile saved before this
   * existed, so it needs no migration and no saved result moves.
   */
  readonly route?: EncounterRoute;
}

/** The routes the Target dropdown offers. */
export type EncounterRoute = 'dungeon';
export const ENCOUNTER_ROUTES: readonly EncounterRoute[] = ['dungeon'];

/**
 * Everything needed to reproduce a simulation, as plain JSON-safe data.
 *
 * Deliberately free of engine objects: a profile can be saved to a file,
 * pasted into a text box, or sent to a server. Gear, talents and professions
 * will become further sections here as they are implemented.
 */
export interface CharacterProfile {
  readonly version: number;
  readonly character: CharacterSection;
  /**
   * Stats from gear, buffs and anything else, ADDED to the race and class base
   * from the base stats table. A profile describes what a character has beyond
   * being a level 60 Tauren Druid, not their stats from scratch.
   */
  readonly stats: PartialStats;
  /**
   * What is equipped, by slot, as item ids with an optional enchant.
   *
   * Ids rather than copies of the items: an item's numbers belong to the item
   * data, and a profile that carried its own would drift the moment that data
   * was corrected. Added in format version 4; older profiles have none, which
   * reads as an empty set.
   */
  readonly equipment: Equipment;
  /**
   * Points spent per talent, by talent id.
   *
   * Talent ids are unique WITHIN a class, not across classes, so this map only
   * means anything alongside `character.characterClass`. A profile that changed
   * class would be carrying another class's talents, which is why the UI clears
   * them when the class changes rather than trying to translate them.
   *
   * Added in format version 5, when talents first affected a simulation by
   * gating which abilities a character knows. Older profiles have none, which
   * reads as an empty allocation: no talents, and therefore no talent-granted
   * abilities.
   */
  readonly talents: TalentAllocation;
  readonly simulation: SimulationSection;
  readonly encounter: EncounterSection;
  /**
   * Raid buffs, debuffs and consumables assumed to be up, by id.
   *
   * ----------------------------------------------------------------------------
   * IDS, not copies, for the same reason equipment stores item ids: what a buff
   * IS belongs to `game/buffs/raidBuffs.ts`, and a profile carrying its own
   * numbers would drift the moment one was corrected.
   *
   * A LIST RATHER THAN A MAP of id to boolean. The question a profile answers
   * is "which are on", and a map answers it twice -- an id absent and an id
   * present with `false` would mean the same thing and could disagree.
   *
   * EMPTY BY DEFAULT, and that is a judgement rather than an oversight. Every
   * number this project has ever recorded was measured without them, and a
   * default that silently applied a raid's worth of attack power would move
   * all of it. It is also how `BATTLE_FURY` went wrong: a buff nobody asked
   * for inflating every figure.
   *
   * Added in format version 9. Older profiles have none, which reads as a
   * character fighting unbuffed -- which is exactly what they were.
   */
  readonly raidBuffs: readonly string[];
  /**
   * A number per raid buff that needs one, by id -- the SUPPLIER'S spell power
   * for Thorns and Retribution Aura, whose strength is somebody else's.
   *
   * OPTIONAL AND ABSENT MEANS THE BUFF'S OWN DEFAULT, so no profile saved
   * before it existed changes and no migration is needed: an older file never
   * selected either buff. Kept beside `raidBuffs` rather than inside it, so the
   * list keeps answering one question.
   */
  readonly raidBuffValues?: Readonly<Record<string, number>>;
  /**
   * Which poison coats which weapon. A Rogue's, and nobody else's.
   *
   * ----------------------------------------------------------------------------
   * A PROFILE FIELD RATHER THAN A CONSTANT, because it is a CHOICE a player
   * makes and changes -- the same argument that put raid buffs and enchants
   * here. The Gear panel shows it under the weapon enchants, for Rogues only.
   *
   * Added in format version 10, defaulting to Instant on the main hand and
   * Deadly on the off hand, which is the ruleset owner's stated default.
   * OLDER PROFILES GET THE SAME DEFAULT RATHER THAN NOTHING, and that is the
   * one migration here that deliberately CHANGES old results: poisons did not
   * exist before this version, so every saved Rogue was fighting without them
   * and every Rogue figure ever recorded is a floor.
   */
  readonly poisons: PoisonLoadout;
  /**
   * Which temporary weapon enchant a Warlock carries, if any.
   *
   * --------------------------------------------------------------------------
   * THE SAME DECISION AS `poisons` AND THE OPPOSITE DEFAULT. It is a profile
   * field because it is a player's choice, it has a control in the Gear panel
   * under the weapon enchants, and it is Warlocks only.
   *
   * WHERE IT DIFFERS: version 10 gave every Rogue the owner's stated pairing
   * and changed old results doing it, because a saved Rogue was not CHOOSING to
   * fight without poisons. The owner has not stated which stone a Warlock
   * carries -- the request was for a control to choose with -- so the default
   * is `none` and no saved profile's figure moves. See `DEFAULT_WARLOCK_STONE`.
   *
   * A SINGLE VALUE RATHER THAN A PER-HAND LOADOUT, which is the other
   * difference from poisons: a stone enchants the weapon, and a Warlock has one
   * stone. Poisons are per hand because a Rogue coats each weapon separately.
   *
   * Arrived in version 11.
   * --------------------------------------------------------------------------
   */
  readonly warlockStone: WarlockStoneId;
  /**
   * What the character drank, as consumable ids keyed by CATEGORY.
   *
   * ----------------------------------------------------------------------------
   * A MAP RATHER THAN A LIST, which is the opposite choice from `raidBuffs`
   * above and is made for the reason that one gives. Raid buffs answer "which
   * are on", and a map of id to boolean would answer it twice; consumables
   * answer "which one from each category", and only a map answers that ONCE.
   * A list of consumable ids could hold two flasks, and the exclusivity would
   * then be a rule something has to enforce rather than a shape -- which is
   * exactly how the Moonkin's 3% crit became 6%, with the rule living in a
   * chooser that a talent did not pass through.
   *
   * IDS, not copies, for the reason equipment stores item ids: what a
   * consumable IS belongs to `game/buffs/consumables.ts`.
   *
   * EMPTY BY DEFAULT, as raid buffs are: a consumable that applied itself would
   * move every figure ever recorded. What the 24 PRESETS open with is a
   * different question, answered in `presets.ts`.
   *
   * Added in format version 12. Older profiles get an empty selection, so
   * nothing about their results changes -- the version 9 decision rather than
   * the version 10 one, and for the version 9 reason: a saved character with no
   * consumables was genuinely fighting without them.
   *
   * IT WAS WRITTEN AS 11 AND SO WAS THE WARLOCK STONE ABOVE, from the same
   * base, and git merged the two migration tables with no conflict at all --
   * one object literal with the key `10` twice, where the second wins and the
   * first migration never runs. See `migrateProfile.ts`.
   */
  readonly consumables: ConsumableSelection;
  /**
   * The Action Priority List this character runs.
   *
   * ============================================================================
   * WRITTEN OUT IN FULL, ALWAYS, which is the ruleset owner's call and is the
   * opposite of how `combatStyle` handles its default. A saved file is a
   * COMPLETE description of the build: nothing about it depends on what this
   * version of the simulator happens to think the stock list for a Beast
   * Mastery Hunter is.
   *
   * THE COST IS THAT A SAVED PROFILE IS FROZEN, and that is the trade the owner
   * chose knowing it: a file saved today keeps its list after a stock list is
   * improved, where storing a REFERENCE would have let the improvement reach
   * old files and would have made the file depend on this build of the app.
   * ============================================================================
   */
  readonly rotation: StoredRotation;
  /**
   * What the character did BEFORE the pull, in the owner's own framing.
   *
   * ============================================================================
   * "A way to capture pre-combat events a character can do. Things like
   * swapping into berserker stance, shadow form, cat form, going stealth,
   * pre-casting a spell... 'Use Stealth <= 2 sec before combat initiates',
   * 'Cast Fireball <= 2.5 sec before combat initiates'."
   *
   * ON THE PROFILE ROOT RATHER THAN INSIDE `rotation`, AND THAT IS NOT
   * COSMETIC. `syncDefaultRotation` REPLACES the whole `StoredRotation` object
   * whenever a `default` list stops matching the build -- which happens on a
   * talent change, a stance change, a class change and a consumable selection.
   * A pre-combat list stored in there would be silently wiped by any of them,
   * and the panel would simply show it gone.
   *
   * IT IS SHOWN IN THE APL PANEL ANYWAY, which is what the owner asked for --
   * "a small section above the main APL controller, but within the same
   * panel". Where a thing is EDITED and where it is STORED are different
   * questions, and this is the one case so far where they differ.
   *
   * OPTIONAL, AND ABSENT MEANS NONE, which is the `statValuation` decision:
   * every profile saved before this behaves exactly as it did, and the engine
   * runs no pre-combat action for a character that declares none. Arrived in
   * format version 16.
   * ============================================================================
   */
  readonly precombat?: readonly PrecombatAction[];
  /**
   * THE MULTI TARGET LIST (round 64), the owner's split of the Priority List
   * into "APL: Single Target" and "APL: Multi Target", each with its own
   * pre-combat and combat list.
   *
   * ============================================================================
   * `rotation` AND `precombat` ABOVE ARE THE SINGLE TARGET LIST, unchanged, so
   * every reader that existed before goes on reading the list it always did.
   * This is the second list, run instead of them by:
   *
   *   - a DPS or tank fight with more than one target, and
   *   - the RAID HEALER fight, always. The tank healer fight is single target.
   *
   * `fightProfile` in `aplSections.ts` is the one place that choice is made.
   *
   * ABSENT MEANS "THE SAME AS SINGLE TARGET", so nothing can run an empty list
   * by accident -- but the migration, the presets and the app all write it out
   * in full, because a file is a complete description of the build.
   * Arrived in format version 18.
   * ============================================================================
   */
  readonly multiTarget?: StoredAplSection;
  /**
   * What a point of each stat is worth to this character, for SORTING GEAR.
   *
   * ==========================================================================
   * NOT A SIMULATED NUMBER, and nothing in `engine`, `game` or `simulator`
   * reads it. It decides what order the Gear panel lists a slot's items in and
   * what figure sits beside each one -- so a wrong weight sorts a list badly
   * and cannot move a DPS figure. That is why it is allowed to carry numbers
   * nobody measured.
   *
   * THE UNIT IS THE STAT-WEIGHT RUN'S UNIT, deliberately: "per displayed unit",
   * with the two ratings in percentage points. A Stat Weights run produces
   * exactly these, so "use these weights" is a copy rather than a conversion.
   * See `game/items/itemValue.ts`.
   *
   * OPTIONAL, AND ABSENT MEANS "DERIVE IT", which is the `combatStyle`
   * decision rather than the `rotation` one -- and the two are opposite on
   * purpose. A stored priority list is written out in full because the owner
   * wanted a file to be a complete description of the build; a valuation is
   * left out because it is a TOOL SETTING that no result depends on, and a
   * file that froze it would keep a placeholder after the owner supplies a
   * real one. `defaultValuationForPreset` is what fills it in.
   *
   * Arrived in format version 14. Older profiles have none, which reads as
   * "use the default", and no figure anywhere moves.
   * ==========================================================================
   */
  readonly statValuation?: StatValuation;
  /**
   * Which benchmark template this character was built from, if any.
   *
   * --------------------------------------------------------------------------
   * IT REPLACES A JOIN ON THE CHARACTER'S NAME. `BENCHMARK_TEMPLATES_BY_LABEL`
   * matches `character.name` against the 25 template labels, because `game`
   * may not import `profiles` and the name was the only thing both sides had.
   * That join is on a string a user can edit: renaming the character took away
   * the four test-set buttons AND the default stat valuation, which is a
   * visible failure rather than a wrong one and is still a failure.
   *
   * THE NAME JOIN IS KEPT AS THE FALLBACK, for every file saved before this
   * field existed. `templateIdFor` is the one place that order is decided.
   *
   * Arrived in format version 14, alongside `statValuation`. Older profiles
   * have none and fall back to the name, which is exactly what they did
   * before.
   * --------------------------------------------------------------------------
   */
  readonly benchmarkTemplateId?: string;
}

/**
 * A priority list as a profile stores it.
 *
 * ----------------------------------------------------------------------------
 * `source` IS WHAT STOPS A STORED LIST BECOMING THE WRONG LIST, and it exists
 * because of a failure this project has already had: a Fire Mage ran the Arcane
 * list for its whole life and produced a perfectly ordinary DPS figure, because
 * nothing about a wrong rotation looks wrong.
 *
 * Storing the list freezes it, which is what was asked for -- and a frozen list
 * stops following the BUILD. Change a Rogue's capstone and the stock list that
 * belongs to the new spec is a different one; change class and the stored list
 * names another class's abilities entirely. So:
 *
 *   - `'default'` means "this is the stock list, written out". Changing the
 *     build INSIDE THE APP re-derives it, the way changing class replaces gear.
 *   - `'custom'` means somebody edited it, so nothing touches it again -- and
 *     the panel SAYS when a custom list no longer matches the build's stock
 *     one, rather than silently running something meant for another spec.
 *
 * LOADING A FILE NEVER RE-DERIVES, whichever it says. That is the freezing the
 * owner asked for: a loaded profile runs exactly the list in the file.
 * ----------------------------------------------------------------------------
 */
export interface StoredRotation {
  readonly source: 'default' | 'custom';
  /**
   * What the list is called -- the stock list's own name, or whatever a custom
   * one was derived from. Shown in the panel badge and carried onto the
   * compiled rotation, so the results page names the list that actually ran.
   */
  readonly name: string;
  readonly entries: readonly AplEntry[];
  /** Smart healing, list-wide (round 54). See `AplList.smartHealing`. */
  readonly smartHealing?: boolean;
}

/** One APL section: a combat list and what to do before the pull (round 64). */
export interface StoredAplSection {
  readonly rotation: StoredRotation;
  readonly precombat?: readonly PrecombatAction[];
}

/** A sensible starting profile, matching the first-milestone prototype. */
export function createDefaultProfile(): CharacterProfile {
  return {
    version: CURRENT_PROFILE_VERSION,
    poisons: { ...DEFAULT_POISON_LOADOUT },
    warlockStone: DEFAULT_WARLOCK_STONE,
    consumables: {},
    /*
     * EMPTY, AND FILLED IN BY THE CALLER. This function cannot derive the
     * stock list without importing `aplFor`, and `profiles/rotation.ts`
     * imports THIS file -- so deriving here would be a cycle. The app calls
     * `syncDefaultRotation` on the profile it builds, which fills it from the
     * class and talents the character actually ends up with.
     */
    rotation: { source: 'default', name: '', entries: [] },
    /*
     * ABSENT RATHER THAN EMPTY on a new profile, which is the rule a dropped
     * `disabled` flag already follows: an absent key and an empty array are
     * different FILES, and `syncDefaultRotation` and the preset tests compare
     * profiles by value.
     */
    character: {
      name: 'Example',
      race: 'human',
      characterClass: 'warrior',
      level: 60,
    },
    // Stats from gear and other sources, ADDED to the race/class base. A brand
    // new character has none, which is why these are all zero.
    stats: {
      attackPower: 0,
      critRating: 0,
      hasteRating: 0,
    },
    // Nothing equipped. Gear is chosen in the Gear panel.
    equipment: {},
    // No talents spent. A warrior with an empty tree knows no Mortal Strike,
    // no Bloodthirst and no Shield Slam, which is what the trees say.
    talents: {},
    simulation: {
      /*
       * Sixty seconds and three thousand iterations, both the project owner's
       * choice.
       *
       * The iteration count is the one that matters: a single fight is a
       * sample, not a result, and reading one was the source of several
       * "findings" that turned out to be noise. Three thousand of them at this
       * length runs in a couple of seconds, so there is no reason to default
       * to fewer.
       */
      durationSeconds: 60,
      iterations: 3000,
      seed: 12345,
    },
    // Nothing assumed. See the field: a default raid buff would move every
    // number anyone has ever recorded.
    raidBuffs: [],
    encounter: {
      targetName: 'Training Dummy',
      targetHealth: 100_000,
      targetArmor: 3731,
      targetLevel: 63,
      // Off by default: a damage warrior is not the one being hit. See the
      // field's own note.
      targetAttacks: false,
      // The opening swing. It grows by ten percent every swing from there.
      targetSwingDamage: 5000,
      targetSwingSeconds: 2,
      numberOfTargets: 1,
    },
  };
}

/** A deep copy, so callers can edit without touching the original. */
export function cloneProfile(profile: CharacterProfile): CharacterProfile {
  return {
    version: profile.version,
    character: { ...profile.character },
    // Its own object, or two profiles would share one loadout and swapping a
    // poison on either would swap it on both.
    poisons: { ...profile.poisons },
    /*
     * NO SPREAD, because a stone is a STRING. Copied by the enclosing spread
     * already; the line is here so the next reader sees that it was considered
     * rather than forgotten, which is the question `poisons` above raises.
     */
    warlockStone: profile.warlockStone,
    // Its own object for the same reason, so changing one profile's flask does
    // not change another's.
    consumables: { ...profile.consumables },
    stats: { ...profile.stats },
    // One level deeper than a spread: each slot is its own object, so copying
    // only the map would leave both profiles sharing the same slot entries.
    equipment: Object.fromEntries(
      Object.entries(profile.equipment).map(([slot, equipped]) => [slot, { ...equipped }]),
    ),
    talents: { ...profile.talents },
    simulation: { ...profile.simulation },
    encounter: { ...profile.encounter },
    raidBuffs: [...profile.raidBuffs],
    ...(profile.raidBuffValues ? { raidBuffValues: { ...profile.raidBuffValues } } : {}),
    /*
     * The entries are copied so two profiles never share a list -- reordering
     * one would otherwise reorder the other. The ENTRIES THEMSELVES are not
     * deep-copied, because nothing mutates an entry in place: the editor
     * replaces one, the way every other update here works.
     */
    rotation: { ...profile.rotation, entries: [...profile.rotation.entries] },
    /*
     * SPREAD ONLY WHEN PRESENT, because absent and empty are different files
     * and `cloneProfile` must not turn one into the other -- `presets.test.ts`
     * compares built profiles by value.
     */
    ...(profile.precombat ? { precombat: [...profile.precombat] } : {}),
    ...(profile.multiTarget
      ? {
          multiTarget: {
            rotation: { ...profile.multiTarget.rotation, entries: [...profile.multiTarget.rotation.entries] },
            ...(profile.multiTarget.precombat ? { precombat: [...profile.multiTarget.precombat] } : {}),
          },
        }
      : {}),
  };
}
