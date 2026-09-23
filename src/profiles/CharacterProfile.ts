import type { PartialStats } from '../engine';
import type { ClassId, CombatStyleId, RaceId, StanceId } from '../game/character';
import type { Equipment } from '../game/items/Item';
import type { TalentAllocation } from '../game/talents/Talent';

/**
 * The profile format version.
 *
 * Bump this whenever the shape changes in a way that older files do not match,
 * and add a step to `migrations` in `migrateProfile.ts`. Every saved profile
 * carries its version, so a file written today keeps loading after the format
 * moves on. Getting this in before anyone has saved anything is much cheaper
 * than retrofitting it later.
 */
export const CURRENT_PROFILE_VERSION = 9;

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
}

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
}

/** A sensible starting profile, matching the first-milestone prototype. */
export function createDefaultProfile(): CharacterProfile {
  return {
    version: CURRENT_PROFILE_VERSION,
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
    },
  };
}

/** A deep copy, so callers can edit without touching the original. */
export function cloneProfile(profile: CharacterProfile): CharacterProfile {
  return {
    version: profile.version,
    character: { ...profile.character },
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
  };
}
