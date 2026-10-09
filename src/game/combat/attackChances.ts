import type {
  AttackChanceProvider,
  AttackChances,
  AttackContext,
  AttackTableKind,
  Combatant,
  ParryHaste,
  RollUnits,
  WeaponSlot,
} from '../../engine';
import { NO_CHANCES, ROLL_MAX, toRollUnits } from '../../engine';

/**
 * The World of Warcraft: Forever combat table numbers.
 *
 * Most of these are DERIVED from the difference between the attacker's weapon
 * skill and the defender's defense skill, rather than being flat. The constants
 * below are the coefficients in those formulas.
 *
 * Everything is in roll units, where 10000 is 100%. The formulas produce those
 * units directly: `600` means 6%.
 */
export const COMBAT_CONSTANTS = {
  /**
   * Base miss, BOTH regimes -- only the per-point penalty changes past the
   * threshold, not the base.
   *
   * ----------------------------------------------------------------------------
   * 5% BASE PLUS 0.2% A POINT IS 8% AT A 15-POINT GAP, which is the ruleset
   * owner's figure: "The new melee and ranged attack miss chance against a level
   * 63 target is now 8% not 9%." A level 60 character caps weapon skill at 300
   * and a level 63 target carries 315 defense, so that gap is the only one any
   * profile in this project ever faces -- no item grants weapon skill.
   *
   * IT WAS TWO BASES, 500 AND 600, AND THE SECOND ONE IS WHAT MADE IT 9%. That
   * was not a transcription of anything: `BASE_CHANCES` in this file's first
   * version carried `meleeMiss: 8` and `rangedMiss: 8` from the owner's own
   * combat table, and the commit that derived the table from weapon skill
   * (#10) raised it to 9% as a SIDE EFFECT of giving the large-gap regime its
   * own base.
   *
   * **THAT COMMIT SAID SO, IN THE DOCS, AND IT WAS LEFT STANDING FOR THE WHOLE
   * PROJECT.** `docs/combat-tables.md` read "the formulas are consistent with
   * the constants they replace; only miss moves, from 8% to 9%" -- dodge's 6.5%
   * and glance's 40% reproduced exactly, and miss alone did not. A derivation
   * that reproduces two of the three flat figures it replaces and changes the
   * third by a point is a derivation with a bug in it, and the sentence
   * recording the discrepancy was read as a note about the formula rather than
   * as a defect. **A DIFFERENCE THAT GETS WRITTEN DOWN STILL NEEDS SOMEBODY TO
   * CALL IT WRONG.**
   *
   * SO THE OWNER'S NOTE RESTORES THEIR OWN ORIGINAL FIGURE rather than changing
   * the ruleset, and it is implemented by deleting the extra base rather than by
   * back-solving a coefficient: one base of 5% with the per-point rate doubling
   * past the threshold gives 8% at a 15-point gap on the nose.
   *
   * IT IS ALSO MONOTONIC NOW, WHICH THE OLD PAIR WAS NOT SMOOTHLY. At a 10-point
   * gap miss was 6% and at 11 points it jumped to 8.2%; it now goes 6% to 7.2%.
   * Nothing measures that -- every profile sits at the 15-point gap -- so it is
   * evidence about the SHAPE of the rule rather than a figure that moved.
   *
   * THE ONE THING THIS CANNOT DISTINGUISH, recorded because no measurement here
   * can: any rule giving 8% at a 15-point gap is observationally identical for
   * every profile in the project, because nothing grants weapon skill and the
   * only target is level 63. Reading it as "the base does not rise" is the
   * choice; the alternatives are a lower per-point rate (0.1333, which is not a
   * figure anybody states) or a flat 8% with no skill term at all (which would
   * discard the gap formula that dodge and glance share). Isolated in this one
   * constant so it is cheap to flip if the owner says otherwise.
   * ----------------------------------------------------------------------------
   */
  missBase: 500,
  /** Miss added per point of skill deficit, on a small gap. */
  missPerSkillSmallGap: 10,
  /** Miss added per point of skill deficit, on a large gap. */
  missPerSkillLargeGap: 20,
  /** The skill gap above which the steeper miss formula applies. */
  largeGapThreshold: 10,

  /** Added to BOTH weapons' miss chance while dual-wielding. */
  dualWieldMissPenalty: 1900,

  /** Dodge, which scales with the skill gap. */
  dodgeBase: 500,
  dodgePerSkill: 10,

  /** Glancing blows, which scale with the defender's level rather than skill. */
  glanceBase: 1000,
  glancePerDefenseOver300: 200,

  /** Enemy parry. Not derived from skill; see `EncounterChances`. */
  enemyParry: 1400,

  /** Spells miss on their own flat chance, unaffected by weapon skill. */
  spellMiss: 1700,
  /**
   * The miss a spell can never go below, however much hit is stacked.
   *
   * ----------------------------------------------------------------------------
   * THE RULESET OWNER: 17% base, "reduced to a minimum of 1% chance to miss.
   * Effectively making the 'hit cap' 16% for Spells." So the useful range of
   * spell hit is 0 to 16 and the seventeenth point buys nothing.
   *
   * IT WAS A FLOOR OF ZERO, which made the cap 17 and handed a caster at 17%
   * hit a spell that could not miss.
   *
   * AND A PROFILE WAS ALREADY THERE, which this comment first claimed it was
   * not. No profile exceeds 16% on the `hitChance` STAT -- Venom and Combat sit
   * exactly on it -- and that is only one of the two routes to spell hit. The
   * SHOCKADIN takes Divine Precision for +12% HOLY hit on top of 6% from gear,
   * which is 18 against a 17% miss: its Holy spells could not miss at all, and
   * now miss 1%. Worth -2.4 DPS.
   *
   * **A CAP NOBODY HAS REACHED YET IS STILL THE WRONG CAP** -- and checking only
   * the stat said nobody had reached it. See `missFloor` on `AttackChances` for
   * why the floor has to travel with the table rather than live here.
   *
   * MELEE AND RANGED KEEP THEIR FLOOR OF ZERO, deliberately: the owner stated
   * this for SPELLS and `missFromSkill` is a different formula with a skill
   * term in it. Giving them a floor by analogy would be inventing a rule.
   * ----------------------------------------------------------------------------
   */
  spellMissFloor: 100,

  /**
   * Crit lost against a higher-level target: 180 plus 100 per level of
   * difference. Against a level 63 boss at level 60 that is 480, or 4.8
   * percentage points, which is enough to erase an ungeared character's crit
   * entirely.
   */
  critSuppressionBase: 180,
  critSuppressionPerLevel: 100,

  meleeCritMultiplier: 2,
  rangedCritMultiplier: 2,
  spellCritMultiplier: 1.5,

  /* --- Attacks received by the player --- */
  /**
   * What ONE point of defense skill above the baseline is worth, in roll
   * units, to each of the five things it touches.
   *
   * Given by the ruleset owner: a point of defense adds 0.04 percentage points
   * to the attacker's miss chance and to the defender's dodge, parry and
   * block, and takes 0.04 away from the attacker's crit. 0.04% is 4 roll
   * units.
   *
   * This is what Anticipation was blocked on, and the comment in the received
   * table below said so: the formula did not exist, so a defense skill talent
   * could not be modelled. It exists now.
   */
  defensePerSkill: 4,

  /**
   * PARRY HASTE, in fractions of a full swing.
   *
   * ----------------------------------------------------------------------------
   * THE RULESET OWNER: "successfully parrying an attack reduces the attacker's
   * remaining swing timer by 40% of their max swing time, provided the
   * reduction does not lower the timer below 20% of its original duration",
   * and "this mechanic applies to both players and mobs, including raid
   * bosses".
   *
   * BOTH ARE OF A FULL SWING, which is what makes the mechanic converge rather
   * than compound -- see `engine/combat/parryHaste.ts`, which owns the rule.
   * Here are the two numbers and nothing else.
   * ----------------------------------------------------------------------------
   */
  parryHasteReduction: 0.4,
  parryHasteFloor: 0.2,

  bossMiss: 500,
  bossCrush: 1500,
  bossCrushMultiplier: 1.5,
  bossCrit: 500,
  bossCritMultiplier: 2,
} as const;

/**
 * What the ruleset needs to know about the encounter, beyond the two
 * combatants themselves.
 *
 * ------------------------------------------------------------------------------
 * ONE FIELD, AND IT DECIDES ENEMY PARRY. The source says enemy parry is 14%,
 * "0% if 1H & Shield is not selected", and that was read as a statement about
 * the STYLE: only a character tanking with a shield stands in front of the
 * target, and everybody else is behind it where a parry cannot happen.
 *
 * THE RULESET OWNER HAS SINCE STATED THE CONDITION DIRECTLY: "when the Target
 * Attacks Back checkbox in the Encounter panel is selected, the target gains a
 * 14% chance to parry you." Which is the same idea one level up -- being in
 * front of something is what makes it hit you -- and it is a property of the
 * ENCOUNTER rather than of the weapon in your hand.
 *
 * IT MOVES TWO PROFILES IN OPPOSITE DIRECTIONS, and both are corrections. The
 * BEAR tanks without a shield and was never being parried; it is now. The
 * SHOCKADIN holds a shield against a target that does not swing back, so it was
 * eating 14% parry while standing behind a dummy; it no longer is.
 *
 * THE STYLE LOOKUP IS GONE WITH IT. Parry was the only thing it fed, so a
 * provider no longer needs to know how anybody fights -- which also removes the
 * last reason for `game/combat` to know what a `CombatStyleId` is.
 * ------------------------------------------------------------------------------
 */
export interface EncounterChances {
  /**
   * Whether the target is swinging at the player.
   *
   * Defaults to false, so a provider built with no options rolls no enemy
   * parry -- which is what every standing-target profile and every unit test
   * that does not say otherwise wants.
   */
  readonly targetAttacks?: boolean;
}

/**
 * Miss chance from a weapon skill deficit.
 *
 * Two regimes, and ONLY the per-point penalty changes between them: past a
 * 10-point gap each point of deficit costs 0.2% instead of 0.1%, off a base of
 * 5% either way. A level 63 target (315 defense) against a character capped at
 * 300 skill is a 15-point gap, so **8%** -- the owner's figure.
 *
 * THE BASE USED TO RISE TOO, which made it 9%, and see `missBase` for why that
 * was a bug in the derivation rather than a ruleset number.
 *
 * `hit` is subtracted, and the result floors at zero. **Melee and ranged have no
 * miss FLOOR**, unlike spells -- so the usable melee hit cap moved with this,
 * from 9 to 8.
 */
export function missFromSkill(
  skill: number,
  defenseSkill: number,
  hit: RollUnits,
  dualWieldPenalty: RollUnits,
): RollUnits {
  const gap = defenseSkill - skill;
  const large = defenseSkill > skill + COMBAT_CONSTANTS.largeGapThreshold;

  const perPoint = large
    ? COMBAT_CONSTANTS.missPerSkillLargeGap
    : COMBAT_CONSTANTS.missPerSkillSmallGap;

  return Math.max(
    0,
    COMBAT_CONSTANTS.missBase - hit + dualWieldPenalty + gap * perPoint,
  );
}

/** Dodge chance from a weapon skill deficit. */
export function dodgeFromSkill(skill: number, defenseSkill: number): RollUnits {
  return Math.max(
    0,
    COMBAT_CONSTANTS.dodgeBase + (defenseSkill - skill) * COMBAT_CONSTANTS.dodgePerSkill,
  );
}

/**
 * What the ATTACKER takes off the defender's dodge and parry.
 *
 * ----------------------------------------------------------------------------
 * THE ONLY ATTACKER-SIDE TERM IN TWO DEFENDER-SIDE SLICES. Dodge comes from the
 * skill gap and enemy parry is a flat ruleset figure, so Weapon Expertise's
 * "reduces the chance for your attacks to be Dodged or Parried by 2%" had
 * nowhere to land -- and granting it as `hitChance` instead would have taken it
 * off the MISS slice, which is a different size and moves differently with the
 * level gap.
 *
 * SUBTRACTED FROM BOTH, not split between them: the tooltip states one figure
 * and names both outcomes, so 2% is two points off each rather than one each.
 * Clamped at zero by the callers, which every slice already is.
 * ----------------------------------------------------------------------------
 */
export function dodgeParryReduction(source: Combatant): RollUnits {
  return toRollUnits(source.stats.get('dodgeParryReduction'));
}

/**
 * Glancing blow chance.
 *
 * Depends on the defender's level alone, not on the attacker's skill: at
 * defense 315 it is 40%, and a character cannot reduce it by training.
 */
export function glanceChance(defenseSkill: number): RollUnits {
  return Math.max(
    0,
    COMBAT_CONSTANTS.glanceBase +
      (defenseSkill - 300) * COMBAT_CONSTANTS.glancePerDefenseOver300,
  );
}

/**
 * The damage range of a glancing blow, as multipliers.
 *
 * Both ends are floored to whole percentage points and capped, so at a
 * 15-point deficit a glance lands somewhere in 55%..75% of normal damage rather
 * than at a fixed value.
 */
export function glanceMultiplierRange(
  skill: number,
  defenseSkill: number,
): { min: number; max: number } {
  const gap = defenseSkill - skill;

  const min = Math.min(91, Math.floor((1.3 - gap * 0.05) * 100));
  const max = Math.min(99, Math.floor((1.2 - gap * 0.03) * 100));

  // Guard the degenerate case where a large gap pushes min above max.
  const low = Math.max(0, Math.min(min, max));
  const high = Math.max(0, Math.max(min, max));
  return { min: low / 100, max: high / 100 };
}

/** Crit lost against a higher-level target. Zero against equal or lower level. */
export function critSuppression(attackerLevel: number, targetLevel: number): RollUnits {
  if (targetLevel <= attackerLevel) return 0;
  return (
    COMBAT_CONSTANTS.critSuppressionBase +
    (targetLevel - attackerLevel) * COMBAT_CONSTANTS.critSuppressionPerLevel
  );
}

/** Build the Forever chance provider. */
export function createForeverAttackChances(
  encounter: EncounterChances = {},
): AttackChanceProvider {
  return (kind, source, target, context) =>
    buildChances(kind, source, target, context ?? {}, encounter);
}

function buildChances(
  kind: AttackTableKind,
  source: Combatant,
  target: Combatant,
  context: AttackContext,
  encounter: EncounterChances,
): AttackChances {
  const stats = source.stats.effective;
  const defense = target.defenseSkill;

  // Which weapon swung decides the skill used, the dual-wield penalty AND any
  // hit that belongs to that hand alone.
  const slot: WeaponSlot = context.slot ?? 'mainHand';
  const skill = source.weaponSkill(slot);
  /*
   * PER-HAND HIT, added on top of the character-wide stat.
   *
   * Dual Wield Specialization gives ten points of hit to the off hand only.
   * Folding that into `hitChance` would hand the main hand ten free points,
   * which is both wrong and invisible -- the character sheet already reports
   * the two hands separately for exactly this reason.
   */
  const hit = toRollUnits(stats.hitChance) + toRollUnits(source.hitBonusFor(slot));
  /*
   * A SPELL HAS NO HAND, so it reads the character-wide stat and nothing else.
   *
   * `hit` above adds the bonus belonging to the slot that swung, and `slot`
   * defaults to `mainHand` for a request that names none -- which every spell
   * is. Nothing grants main-hand hit today (`hitBonusBySlot` is only ever
   * populated for the off hand, by Dual Wield Specialization), so the two terms
   * are equal and this moves nothing. It is separated because the DAY something
   * grants main-hand hit, a spell silently collecting it would be wrong and
   * would look exactly like a correct number.
   */
  const spellHit = toRollUnits(stats.hitChance);

  const crit = Math.max(
    0,
    toRollUnits(stats.critChance) - critSuppression(source.level, target.level),
  );
  const spellCrit = Math.max(
    0,
    toRollUnits(stats.spellCritChance) - critSuppression(source.level, target.level),
  );

  switch (kind) {
    case 'melee-auto': {
      // The off-hand always carries the penalty; the main hand only while
      // dual-wielding. Both hands are penalised, not one.
      const dualWield =
        slot === 'offHand' || source.autoAttack === 'dual-wield'
          ? COMBAT_CONSTANTS.dualWieldMissPenalty
          : 0;
      const glance = glanceMultiplierRange(skill, defense);

      /*
       * TAKEN OFF BOTH SLICES, AND OFF THE SWING AS WELL AS THE SPECIAL.
       * "Reduces the chance for your attacks to be Dodged or Parried" names
       * attacks rather than abilities, so an auto attack is one of them.
       */
      const avoidanceOff = dodgeParryReduction(source);

      return {
        ...NO_CHANCES,
        miss: missFromSkill(skill, defense, hit, dualWield),
        dodge: clampChance(dodgeFromSkill(skill, defense) - avoidanceOff),
        parry: clampChance(enemyParry(encounter) - avoidanceOff),
        glance: glanceChance(defense),
        crit,
        glanceMultiplierMin: glance.min,
        glanceMultiplierMax: glance.max,
        critMultiplier: COMBAT_CONSTANTS.meleeCritMultiplier,
      };
    }

    case 'melee-special':
      return {
        ...NO_CHANCES,
        // Specials never carry the dual-wield penalty: one strike, not one
        // per hand. They also never glance.
        miss: missFromSkill(skill, defense, hit, 0),
        dodge: clampChance(dodgeFromSkill(skill, defense) - dodgeParryReduction(source)),
        parry: clampChance(enemyParry(encounter) - dodgeParryReduction(source)),
        crit,
        critMultiplier: COMBAT_CONSTANTS.meleeCritMultiplier,
      };

    case 'ranged-auto':
    case 'ranged-special':
      // INTERPRETATION: the source gives no ranged formula, so ranged uses the
      // special-attack shape with the ranged weapon's skill: no dual-wield
      // penalty, no dodge, no parry, no glancing blow.
      return {
        ...NO_CHANCES,
        miss: missFromSkill(source.weaponSkill('ranged'), defense, hit, 0),
        crit,
        critMultiplier: COMBAT_CONSTANTS.rangedCritMultiplier,
      };

    case 'spell':
      return {
        ...NO_CHANCES,
        /*
         * Spell miss is flat: weapon skill has nothing to do with it, and it
         * FLOORS AT 1% rather than at zero -- the owner's cap, which makes 16
         * points of hit the most a caster can use. See `spellMissFloor`.
         */
        miss: Math.max(
          COMBAT_CONSTANTS.spellMissFloor,
          COMBAT_CONSTANTS.spellMiss - spellHit,
        ),
        /*
         * AND THE FLOOR TRAVELS WITH THE TABLE, so the school-scoped hit that
         * `withModifier` applies later cannot push the miss below it either.
         * Five talents across three classes grant that, and a floor applied
         * only here would be a floor a Mage could stack its way around.
         */
        missFloor: COMBAT_CONSTANTS.spellMissFloor,
        crit: spellCrit,
        critMultiplier: COMBAT_CONSTANTS.spellCritMultiplier,
      };

    case 'melee-received': {
      /*
       * DEFENSE SKILL ABOVE THE BASELINE, which is the only part that counts.
       *
       * `bossMiss`, `bossCrit` and `bossCrush` are flat ruleset figures for a
       * character at the level baseline, so charging for all 300 points would
       * move every one of them before a talent was spent. What a talent or a
       * piece of gear ADDED is the surplus, and that is what is worth 0.04
       * percentage points a point to five separate numbers.
       *
       * This is what Anticipation was blocked on. The formula is the ruleset
       * owner's.
       */
      const surplus = target.defenseSkill - target.baseDefenseSkill;
      const fromDefense = surplus * COMBAT_CONSTANTS.defensePerSkill;

      return {
        ...NO_CHANCES,
        miss: clampChance(COMBAT_CONSTANTS.bossMiss + fromDefense),
        /*
         * The player's own avoidance, read from its stats exactly as the
         * attacker's crit is. Percentage POINTS from the character -- agility
         * through the class conversion table, talents such as Deflection on
         * top, and now defense skill as well.
         */
        dodge: clampChance(toRollUnits(target.stats.get('dodgeChance')) + fromDefense),
        parry: clampChance(toRollUnits(target.stats.get('parryChance')) + fromDefense),
        // Block comes from the shield, so a character without one has 0 here
        // and the outcome simply never comes up. Defense does not conjure one:
        // no shield means no block chance to add to.
        block:
          target.stats.get('blockChance') > 0
            ? clampChance(toRollUnits(target.stats.get('blockChance')) + fromDefense)
            : 0,
        crush: COMBAT_CONSTANTS.bossCrush,
        crit: clampChance(COMBAT_CONSTANTS.bossCrit - fromDefense),
        crushMultiplier: COMBAT_CONSTANTS.bossCrushMultiplier,
        critMultiplier: COMBAT_CONSTANTS.bossCritMultiplier,
      };
    }
  }
}

/**
 * Keep a chance inside the table.
 *
 * NOTHING MAY GO NEGATIVE OR PAST 100%, on the ruleset owner's instruction,
 * and defense skill can push in both directions at once: it takes from the
 * attacker's crit while adding to four other slices. At 125 points of surplus
 * the boss's 5% crit would go to zero and then keep going, and a negative
 * slice does not just contribute nothing -- it would pull the cumulative walk
 * BACKWARDS and hand its range to whatever came before it.
 *
 * The total going over 100% needs no clamp here: the table walks a cumulative
 * range, so an overflowing earlier slice squeezes out later ones, which is the
 * behaviour a real combat table has.
 */
function clampChance(units: RollUnits): RollUnits {
  return Math.max(0, Math.min(ROLL_MAX, units));
}

/** Enemy parry, which only applies to a character the target is swinging at. */
function enemyParry(encounter: EncounterChances): RollUnits {
  return encounter.targetAttacks ? COMBAT_CONSTANTS.enemyParry : 0;
}

/**
 * Parry haste as a combatant carries it.
 *
 * ONE SHAPE FOR BOTH SIDES, because the owner's rule names both: a tank
 * parrying a boss hurries the boss, and a boss parrying a tank hurries the
 * tank. `createPlayer` and `createTrainingDummy` hand this to every combatant
 * they build, so the mechanic is on wherever Forever's numbers are.
 */
export const FOREVER_PARRY_HASTE: ParryHaste = {
  reductionFraction: COMBAT_CONSTANTS.parryHasteReduction,
  floorFraction: COMBAT_CONSTANTS.parryHasteFloor,
};
